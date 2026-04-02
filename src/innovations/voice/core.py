"""
Core - Main voice interface combining recognition and synthesis.
"""

import asyncio
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass
from enum import Enum, auto
import logging

from .recognition import SpeechRecognizer, RecognitionResult, RecognitionStatus
from .synthesis import SpeechSynthesizer, SynthesisResult, SynthesisStatus
from .commands import VoiceCommandProcessor, VoiceCommand, CommandHandlers, CommandType


logger = logging.getLogger(__name__)


class VoiceMode(Enum):
    """Voice interaction modes."""
    PASSIVE = auto()      # Only respond to wake word
    ACTIVE = auto()       # Always listening
    PUSH_TO_TALK = auto() # Listen on button press
    DISABLED = auto()     # Voice disabled


@dataclass
class VoiceConfig:
    """Voice interface configuration."""
    recognition_backend: str = "whisper"
    synthesis_backend: str = "pyttsx3"
    language: str = "en-US"
    voice_id: str = "default"
    speech_rate: int = 150
    speech_volume: float = 1.0
    wake_word: str = "hey assistant"
    mode: VoiceMode = VoiceMode.PUSH_TO_TALK
    auto_listen: bool = False
    confirm_commands: bool = True


class VoiceInterface:
    """
    Main voice interface combining recognition, synthesis, and commands.
    
    Provides a complete voice interaction system with:
    - Speech recognition
    - Text-to-speech
    - Command processing
    - Conversation management
    """
    
    def __init__(self, config: Optional[VoiceConfig] = None):
        self.config = config or VoiceConfig()
        
        # Initialize components
        self.recognizer = SpeechRecognizer(
            backend=self.config.recognition_backend,
            language=self.config.language
        )
        
        self.synthesizer = SpeechSynthesizer(
            backend=self.config.synthesis_backend,
            voice_id=self.config.voice_id,
            rate=self.config.speech_rate,
            volume=self.config.speech_volume
        )
        
        self.command_processor = VoiceCommandProcessor()
        self._setup_default_handlers()
        
        # State
        self._mode = self.config.mode
        self._is_listening = False
        self._conversation_history: List[Dict[str, Any]] = []
        self._callbacks: Dict[str, List[Callable]] = {
            "command": [],
            "response": [],
            "error": [],
        }
        
    def _setup_default_handlers(self) -> None:
        """Set up default command handlers."""
        self.command_processor.register_handler(
            CommandType.OPEN, CommandHandlers.handle_open
        )
        self.command_processor.register_handler(
            CommandType.CREATE, CommandHandlers.handle_create
        )
        self.command_processor.register_handler(
            CommandType.SEARCH, CommandHandlers.handle_search
        )
        self.command_processor.register_handler(
            CommandType.HELP, CommandHandlers.handle_help
        )
        
    async def start(self) -> None:
        """Start voice interface."""
        logger.info("Starting voice interface")
        
        if self.config.mode == VoiceMode.ACTIVE:
            await self.start_listening()
        elif self.config.mode == VoiceMode.PASSIVE:
            await self._start_wake_word_detection()
            
    async def stop(self) -> None:
        """Stop voice interface."""
        logger.info("Stopping voice interface")
        self._is_listening = False
        await self.recognizer.stop_listening()
        
    async def start_listening(self) -> None:
        """Start active listening."""
        self._is_listening = True
        
        # Register callback for recognition results
        self.recognizer.register_callback(self._on_recognition)
        
        # Start listening
        await self.recognizer.start_listening()
        
    async def stop_listening(self) -> None:
        """Stop listening."""
        self._is_listening = False
        await self.recognizer.stop_listening()
        
    async def listen_once(self, timeout: float = 10.0) -> Optional[str]:
        """
        Listen for a single utterance.
        
        Args:
            timeout: Maximum time to listen
            
        Returns:
            Recognized text or None
        """
        logger.info("Listening...")
        
        # Play listening sound
        await self._play_sound("listen_start")
        
        # Recognize
        result = await self.recognizer.recognize_once()
        
        # Play done sound
        await self._play_sound("listen_end")
        
        if result.text:
            logger.info(f"Heard: {result.text}")
            return result.text
        else:
            logger.info("No speech detected")
            return None
            
    async def speak(self, text: str) -> None:
        """
        Speak text.
        
        Args:
            text: Text to speak
        """
        logger.info(f"Speaking: {text}")
        
        # Add to history
        self._conversation_history.append({
            "role": "assistant",
            "text": text,
            "timestamp": asyncio.get_event_loop().time()
        })
        
        # Synthesize and play
        await self.synthesizer.speak(text)
        
        # Notify callbacks
        self._notify_callbacks("response", text)
        
    async def process_voice_command(self, text: Optional[str] = None) -> Optional[Any]:
        """
        Process a voice command.
        
        Args:
            text: Optional pre-recognized text
            
        Returns:
            Command result
        """
        # Get text if not provided
        if text is None:
            text = await self.listen_once()
            
        if not text:
            await self.speak("I didn't catch that. Could you please repeat?")
            return None
            
        # Process command
        command = self.command_processor.process(text)
        
        if not command:
            await self.speak("I'm not sure what you want me to do.")
            return None
            
        # Confirm if needed
        if self.config.confirm_commands and command.type not in [
            CommandType.HELP, CommandType.STATUS
        ]:
            confirmed = await self._confirm_command(command)
            if not confirmed:
                await self.speak("Command cancelled.")
                return None
                
        # Execute command
        try:
            result = await self.command_processor.execute(command)
            
            # Add to history
            self._conversation_history.append({
                "role": "user",
                "text": text,
                "command": command.type.name,
                "timestamp": asyncio.get_event_loop().time()
            })
            
            # Notify callbacks
            self._notify_callbacks("command", command)
            
            # Speak result if string
            if isinstance(result, str):
                await self.speak(result)
                
            return result
            
        except Exception as e:
            logger.error(f"Command execution error: {e}")
            await self.speak("Sorry, I couldn't complete that command.")
            self._notify_callbacks("error", e)
            raise
            
    async def _confirm_command(self, command: VoiceCommand) -> bool:
        """Ask user to confirm a command."""
        await self.speak(f"Did you want me to {command.action} {command.target or 'that'}?")
        
        response = await self.listen_once(timeout=5.0)
        
        if response:
            response_lower = response.lower()
            return any(word in response_lower for word in ["yes", "yeah", "sure", "ok", "confirm"])
            
        return False
        
    async def _on_recognition(self, result: RecognitionResult) -> None:
        """Handle recognition result."""
        if not result.text:
            return
            
        # Check for wake word in passive mode
        if self._mode == VoiceMode.PASSIVE:
            if self.config.wake_word.lower() not in result.text.lower():
                return
                
        # Process command
        await self.process_voice_command(result.text)
        
    async def _start_wake_word_detection(self) -> None:
        """Start wake word detection."""
        # Would implement continuous wake word detection
        pass
        
    async def _play_sound(self, sound_type: str) -> None:
        """Play a system sound."""
        # Would implement sound playback
        pass
        
    def register_callback(self, event: str, callback: Callable) -> None:
        """Register a callback for events."""
        if event in self._callbacks:
            self._callbacks[event].append(callback)
            
    def _notify_callbacks(self, event: str, data: Any) -> None:
        """Notify callbacks of an event."""
        for callback in self._callbacks.get(event, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(data))
                else:
                    callback(data)
            except Exception as e:
                logger.error(f"Callback error: {e}")
                
    def set_mode(self, mode: VoiceMode) -> None:
        """Set voice interaction mode."""
        self._mode = mode
        logger.info(f"Voice mode set to: {mode.name}")
        
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get conversation history."""
        return self._conversation_history.copy()
        
    def clear_history(self) -> None:
        """Clear conversation history."""
        self._conversation_history.clear()
        
    def is_ready(self) -> bool:
        """Check if voice interface is ready."""
        return (
            self.recognizer.status != RecognitionStatus.ERROR and
            self.synthesizer.status != SynthesisStatus.ERROR
        )
        
    def get_status(self) -> Dict[str, Any]:
        """Get voice interface status."""
        return {
            "mode": self._mode.name,
            "listening": self._is_listening,
            "recognizer_status": self.recognizer.status.name,
            "synthesizer_status": self.synthesizer.status.name,
            "history_length": len(self._conversation_history),
            "language": self.config.language,
            "voice": self.config.voice_id,
        }
