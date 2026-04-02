"""
Synthesis - Text-to-speech functionality.
"""

import asyncio
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
import io
import logging


logger = logging.getLogger(__name__)


class SynthesisStatus(Enum):
    """Status of speech synthesis."""
    IDLE = auto()
    SYNTHESIZING = auto()
    PLAYING = auto()
    COMPLETED = auto()
    ERROR = auto()


@dataclass
class SynthesisResult:
    """Result of speech synthesis."""
    audio_data: Optional[bytes]
    text: str
    duration_ms: float
    sample_rate: int
    timestamp: datetime
    voice_id: str
    error: Optional[str] = None


@dataclass
class Voice:
    """Voice configuration."""
    id: str
    name: str
    language: str
    gender: str
    age: str
    description: str
    sample_rate: int = 24000


class SpeechSynthesizer:
    """
    Text-to-speech synthesis interface.
    
    Supports multiple backends:
    - pyttsx3 (local)
    - gTTS (Google)
    - Azure TTS
    - ElevenLabs
    - Browser Web Speech API
    """
    
    # Built-in voices
    VOICES = {
        "default": Voice(
            id="default",
            name="Default",
            language="en-US",
            gender="neutral",
            age="adult",
            description="Default system voice"
        ),
        "en-us-female": Voice(
            id="en-us-female",
            name="Samantha",
            language="en-US",
            gender="female",
            age="adult",
            description="American English female voice"
        ),
        "en-us-male": Voice(
            id="en-us-male",
            name="Daniel",
            language="en-US",
            gender="male",
            age="adult",
            description="American English male voice"
        ),
        "en-uk-female": Voice(
            id="en-uk-female",
            name="Victoria",
            language="en-GB",
            gender="female",
            age="adult",
            description="British English female voice"
        ),
    }
    
    def __init__(
        self,
        backend: str = "pyttsx3",
        voice_id: str = "default",
        rate: int = 150,
        volume: float = 1.0
    ):
        self.backend = backend
        self.voice_id = voice_id
        self.rate = rate
        self.volume = volume
        self._status = SynthesisStatus.IDLE
        self._callbacks: List[Callable[[SynthesisResult], None]] = []
        self._is_playing = False
        
        # Backend-specific initialization
        self._init_backend()
        
    def _init_backend(self) -> None:
        """Initialize the synthesis backend."""
        if self.backend == "pyttsx3":
            self._init_pyttsx3()
        elif self.backend == "gtts":
            self._init_gtts()
        elif self.backend == "azure":
            self._init_azure()
        elif self.backend == "elevenlabs":
            self._init_elevenlabs()
        elif self.backend == "browser":
            self._init_browser()
        else:
            raise ValueError(f"Unknown backend: {self.backend}")
            
    def _init_pyttsx3(self) -> None:
        """Initialize pyttsx3 backend."""
        try:
            import pyttsx3
            self._engine = pyttsx3.init()
            self._engine.setProperty('rate', self.rate)
            self._engine.setProperty('volume', self.volume)
            
            # Set voice if available
            voices = self._engine.getProperty('voices')
            if voices:
                self._engine.setProperty('voice', voices[0].id)
                
            logger.info("pyttsx3 backend initialized")
        except ImportError:
            logger.warning("pyttsx3 not available")
            self._engine = None
            
    def _init_gtts(self) -> None:
        """Initialize gTTS backend."""
        try:
            from gtts import gTTS
            self._gtts_class = gTTS
            logger.info("gTTS backend initialized")
        except ImportError:
            logger.warning("gTTS not available")
            self._gtts_class = None
            
    def _init_azure(self) -> None:
        """Initialize Azure TTS backend."""
        try:
            import azure.cognitiveservices.speech as speechsdk
            self._speech_config = speechsdk.SpeechConfig(
                subscription="your-key",
                region="your-region"
            )
            logger.info("Azure TTS backend initialized")
        except ImportError:
            logger.warning("Azure Speech SDK not available")
            self._speech_config = None
            
    def _init_elevenlabs(self) -> None:
        """Initialize ElevenLabs backend."""
        try:
            import elevenlabs
            self._elevenlabs = elevenlabs
            logger.info("ElevenLabs backend initialized")
        except ImportError:
            logger.warning("ElevenLabs not available")
            self._elevenlabs = None
            
    def _init_browser(self) -> None:
        """Initialize browser Web Speech API backend."""
        logger.info("Browser backend initialized (requires JS)")
        self._browser_available = False
        
    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        save_path: Optional[str] = None
    ) -> SynthesisResult:
        """
        Synthesize text to speech.
        
        Args:
            text: Text to synthesize
            voice_id: Optional voice override
            save_path: Optional path to save audio
            
        Returns:
            SynthesisResult
        """
        self._status = SynthesisStatus.SYNTHESIZING
        voice = self.VOICES.get(voice_id or self.voice_id, self.VOICES["default"])
        
        try:
            if self.backend == "pyttsx3" and self._engine:
                return await self._synthesize_pyttsx3(text, voice, save_path)
            elif self.backend == "gtts" and self._gtts_class:
                return await self._synthesize_gtts(text, voice, save_path)
            elif self.backend == "azure" and self._speech_config:
                return await self._synthesize_azure(text, voice, save_path)
            elif self.backend == "elevenlabs" and self._elevenlabs:
                return await self._synthesize_elevenlabs(text, voice, save_path)
            else:
                # Mock result
                return SynthesisResult(
                    audio_data=None,
                    text=text,
                    duration_ms=len(text) * 50,  # Rough estimate
                    sample_rate=24000,
                    timestamp=datetime.now(),
                    voice_id=voice.id,
                    error="No synthesis backend available"
                )
        except Exception as e:
            self._status = SynthesisStatus.ERROR
            logger.error(f"Synthesis error: {e}")
            return SynthesisResult(
                audio_data=None,
                text=text,
                duration_ms=0.0,
                sample_rate=0,
                timestamp=datetime.now(),
                voice_id=voice.id,
                error=str(e)
            )
            
    async def _synthesize_pyttsx3(
        self,
        text: str,
        voice: Voice,
        save_path: Optional[str]
    ) -> SynthesisResult:
        """Synthesize using pyttsx3."""
        import tempfile
        import os
        
        # pyttsx3 is synchronous, run in executor
        loop = asyncio.get_event_loop()
        
        if save_path:
            output_path = save_path
        else:
            fd, output_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            
        def _synthesize():
            self._engine.save_to_file(text, output_path)
            self._engine.runAndWait()
            
        await loop.run_in_executor(None, _synthesize)
        
        # Read audio data
        with open(output_path, 'rb') as f:
            audio_data = f.read()
            
        # Clean up temp file if not saving
        if not save_path:
            os.unlink(output_path)
            
        self._status = SynthesisStatus.COMPLETED
        
        return SynthesisResult(
            audio_data=audio_data,
            text=text,
            duration_ms=len(text) * 80,  # Rough estimate
            sample_rate=22050,
            timestamp=datetime.now(),
            voice_id=voice.id
        )
        
    async def _synthesize_gtts(
        self,
        text: str,
        voice: Voice,
        save_path: Optional[str]
    ) -> SynthesisResult:
        """Synthesize using gTTS."""
        tts = self._gtts_class(text=text, lang=voice.language[:2])
        
        # Save to bytes
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        audio_data = mp3_fp.read()
        
        # Save to file if requested
        if save_path:
            with open(save_path, 'wb') as f:
                f.write(audio_data)
                
        self._status = SynthesisStatus.COMPLETED
        
        return SynthesisResult(
            audio_data=audio_data,
            text=text,
            duration_ms=len(text) * 60,
            sample_rate=24000,
            timestamp=datetime.now(),
            voice_id=voice.id
        )
        
    async def _synthesize_azure(
        self,
        text: str,
        voice: Voice,
        save_path: Optional[str]
    ) -> SynthesisResult:
        """Synthesize using Azure TTS."""
        import azure.cognitiveservices.speech as speechsdk
        
        audio_config = speechsdk.audio.AudioOutputConfig(
            filename=save_path or "temp.wav"
        )
        
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=self._speech_config,
            audio_config=audio_config
        )
        
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            audio_data = result.audio_data
            
            self._status = SynthesisStatus.COMPLETED
            
            return SynthesisResult(
                audio_data=audio_data,
                text=text,
                duration_ms=result.audio_duration.total_seconds() * 1000,
                sample_rate=24000,
                timestamp=datetime.now(),
                voice_id=voice.id
            )
        else:
            raise Exception(f"Azure synthesis failed: {result.reason}")
            
    async def _synthesize_elevenlabs(
        self,
        text: str,
        voice: Voice,
        save_path: Optional[str]
    ) -> SynthesisResult:
        """Synthesize using ElevenLabs."""
        audio = self._elevenlabs.generate(
            text=text,
            voice=voice.name,
            model="eleven_monolingual_v1"
        )
        
        audio_data = bytes(audio) if hasattr(audio, '__iter__') else audio
        
        if save_path:
            with open(save_path, 'wb') as f:
                f.write(audio_data)
                
        self._status = SynthesisStatus.COMPLETED
        
        return SynthesisResult(
            audio_data=audio_data,
            text=text,
            duration_ms=len(text) * 50,
            sample_rate=44100,
            timestamp=datetime.now(),
            voice_id=voice.id
        )
        
    async def speak(self, text: str, voice_id: Optional[str] = None) -> None:
        """
        Synthesize and play text immediately.
        
        Args:
            text: Text to speak
            voice_id: Optional voice override
        """
        result = await self.synthesize(text, voice_id)
        
        if result.audio_data:
            await self._play_audio(result.audio_data)
            
    async def _play_audio(self, audio_data: bytes) -> None:
        """Play audio data."""
        self._status = SynthesisStatus.PLAYING
        
        try:
            import simpleaudio as sa
            
            # For WAV files, simpleaudio can play directly
            # For other formats, would need conversion
            play_obj = sa.play_buffer(audio_data, 1, 2, 24000)
            play_obj.wait_done()
            
        except ImportError:
            logger.warning("simpleaudio not available for playback")
            
        self._status = SynthesisStatus.COMPLETED
        
    def get_available_voices(self) -> List[Voice]:
        """Get list of available voices."""
        if self.backend == "pyttsx3" and self._engine:
            voices = self._engine.getProperty('voices')
            return [
                Voice(
                    id=v.id,
                    name=v.name,
                    language="en-US",
                    gender="unknown",
                    age="unknown",
                    description=v.name
                )
                for v in voices
            ]
        else:
            return list(self.VOICES.values())
            
    def set_voice(self, voice_id: str) -> bool:
        """Set the active voice."""
        if voice_id in self.VOICES:
            self.voice_id = voice_id
            
            if self.backend == "pyttsx3" and self._engine:
                # Update engine voice
                pass
                
            return True
        return False
        
    def set_rate(self, rate: int) -> None:
        """Set speech rate (words per minute)."""
        self.rate = rate
        if self.backend == "pyttsx3" and self._engine:
            self._engine.setProperty('rate', rate)
            
    def set_volume(self, volume: float) -> None:
        """Set speech volume (0.0 to 1.0)."""
        self.volume = max(0.0, min(1.0, volume))
        if self.backend == "pyttsx3" and self._engine:
            self._engine.setProperty('volume', self.volume)
            
    @property
    def status(self) -> SynthesisStatus:
        """Get current synthesis status."""
        return self._status
