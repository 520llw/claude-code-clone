"""
Recognition - Speech-to-text functionality.
"""

import asyncio
from typing import Optional, List, Callable, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
import logging


logger = logging.getLogger(__name__)


class RecognitionStatus(Enum):
    """Status of speech recognition."""
    IDLE = auto()
    LISTENING = auto()
    PROCESSING = auto()
    COMPLETED = auto()
    ERROR = auto()


@dataclass
class RecognitionResult:
    """Result of speech recognition."""
    text: str
    confidence: float
    is_final: bool
    timestamp: datetime
    alternatives: List[Dict[str, Any]]
    language: str
    duration_ms: float


class SpeechRecognizer:
    """
    Speech recognition interface.
    
    Supports multiple backends:
    - Whisper (local)
    - Google Speech
    - Azure Speech
    - Browser Web Speech API
    """
    
    def __init__(
        self,
        backend: str = "whisper",
        language: str = "en-US",
        model_size: str = "base"
    ):
        self.backend = backend
        self.language = language
        self.model_size = model_size
        self._status = RecognitionStatus.IDLE
        self._transcript_buffer: List[str] = []
        self._callbacks: List[Callable[[RecognitionResult], None]] = []
        self._is_listening = False
        
        # Backend-specific initialization
        self._init_backend()
        
    def _init_backend(self) -> None:
        """Initialize the recognition backend."""
        if self.backend == "whisper":
            self._init_whisper()
        elif self.backend == "google":
            self._init_google()
        elif self.backend == "azure":
            self._init_azure()
        elif self.backend == "browser":
            self._init_browser()
        else:
            raise ValueError(f"Unknown backend: {self.backend}")
            
    def _init_whisper(self) -> None:
        """Initialize Whisper backend."""
        try:
            import whisper
            self._model = whisper.load_model(self.model_size)
            logger.info(f"Whisper model loaded: {self.model_size}")
        except ImportError:
            logger.warning("Whisper not available, falling back to mock")
            self._model = None
            
    def _init_google(self) -> None:
        """Initialize Google Speech backend."""
        try:
            import speech_recognition as sr
            self._recognizer = sr.Recognizer()
            self._microphone = sr.Microphone()
            logger.info("Google Speech backend initialized")
        except ImportError:
            logger.warning("SpeechRecognition not available")
            self._recognizer = None
            
    def _init_azure(self) -> None:
        """Initialize Azure Speech backend."""
        try:
            import azure.cognitiveservices.speech as speechsdk
            self._speech_config = speechsdk.SpeechConfig(
                subscription="your-key",
                region="your-region"
            )
            self._speech_config.speech_recognition_language = self.language
            logger.info("Azure Speech backend initialized")
        except ImportError:
            logger.warning("Azure Speech SDK not available")
            self._speech_config = None
            
    def _init_browser(self) -> None:
        """Initialize browser Web Speech API backend."""
        # Browser backend requires JavaScript integration
        logger.info("Browser backend initialized (requires JS)")
        self._browser_available = False
        
    async def start_listening(self) -> None:
        """Start continuous listening."""
        self._is_listening = True
        self._status = RecognitionStatus.LISTENING
        
        if self.backend == "whisper":
            await self._listen_whisper()
        elif self.backend == "google":
            await self._listen_google()
        elif self.backend == "azure":
            await self._listen_azure()
        elif self.backend == "browser":
            await self._listen_browser()
            
    async def stop_listening(self) -> None:
        """Stop listening."""
        self._is_listening = False
        self._status = RecognitionStatus.IDLE
        
    async def recognize_once(self, audio_data: Optional[bytes] = None) -> RecognitionResult:
        """
        Perform single recognition.
        
        Args:
            audio_data: Optional pre-recorded audio
            
        Returns:
            RecognitionResult
        """
        self._status = RecognitionStatus.PROCESSING
        
        if self.backend == "whisper" and self._model:
            return await self._recognize_whisper(audio_data)
        elif self.backend == "google" and self._recognizer:
            return await self._recognize_google(audio_data)
        else:
            # Mock result for testing
            return RecognitionResult(
                text="Mock recognition result",
                confidence=0.95,
                is_final=True,
                timestamp=datetime.now(),
                alternatives=[],
                language=self.language,
                duration_ms=1000.0
            )
            
    async def _recognize_whisper(self, audio_data: bytes) -> RecognitionResult:
        """Recognize using Whisper."""
        import tempfile
        import os
        
        # Save audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
            
        try:
            # Transcribe
            result = self._model.transcribe(
                temp_path,
                language=self.language[:2],
                fp16=False
            )
            
            return RecognitionResult(
                text=result["text"],
                confidence=result.get("confidence", 0.9),
                is_final=True,
                timestamp=datetime.now(),
                alternatives=[
                    {"text": s["text"], "confidence": s.get("confidence", 0.5)}
                    for s in result.get("segments", [])
                ],
                language=self.language,
                duration_ms=result.get("duration", 0) * 1000
            )
        finally:
            os.unlink(temp_path)
            
    async def _recognize_google(self, audio_data: bytes = None) -> RecognitionResult:
        """Recognize using Google Speech."""
        import speech_recognition as sr
        
        recognizer = sr.Recognizer()
        
        if audio_data:
            audio = sr.AudioData(audio_data, 16000, 2)
        else:
            with sr.Microphone() as source:
                audio = recognizer.listen(source, timeout=5)
                
        try:
            text = recognizer.recognize_google(
                audio,
                language=self.language
            )
            
            return RecognitionResult(
                text=text,
                confidence=0.9,
                is_final=True,
                timestamp=datetime.now(),
                alternatives=[],
                language=self.language,
                duration_ms=0.0
            )
        except sr.UnknownValueError:
            return RecognitionResult(
                text="",
                confidence=0.0,
                is_final=True,
                timestamp=datetime.now(),
                alternatives=[],
                language=self.language,
                duration_ms=0.0
            )
            
    async def _listen_whisper(self) -> None:
        """Continuous listening with Whisper."""
        # Would require audio streaming setup
        while self._is_listening:
            await asyncio.sleep(0.1)
            
    async def _listen_google(self) -> None:
        """Continuous listening with Google."""
        import speech_recognition as sr
        
        recognizer = sr.Recognizer()
        
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source)
            
            while self._is_listening:
                try:
                    audio = recognizer.listen(source, timeout=1, phrase_time_limit=10)
                    text = recognizer.recognize_google(audio, language=self.language)
                    
                    result = RecognitionResult(
                        text=text,
                        confidence=0.9,
                        is_final=True,
                        timestamp=datetime.now(),
                        alternatives=[],
                        language=self.language,
                        duration_ms=0.0
                    )
                    
                    self._notify_callbacks(result)
                    
                except sr.WaitTimeoutError:
                    continue
                except sr.UnknownValueError:
                    continue
                except Exception as e:
                    logger.error(f"Recognition error: {e}")
                    
    async def _listen_azure(self) -> None:
        """Continuous listening with Azure."""
        # Azure continuous recognition
        pass
        
    async def _listen_browser(self) -> None:
        """Browser-based listening."""
        # Requires JavaScript bridge
        pass
        
    def register_callback(self, callback: Callable[[RecognitionResult], None]) -> None:
        """Register a callback for recognition results."""
        self._callbacks.append(callback)
        
    def _notify_callbacks(self, result: RecognitionResult) -> None:
        """Notify all registered callbacks."""
        for callback in self._callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(result))
                else:
                    callback(result)
            except Exception as e:
                logger.error(f"Callback error: {e}")
                
    @property
    def status(self) -> RecognitionStatus:
        """Get current recognition status."""
        return self._status
        
    def get_transcript(self) -> str:
        """Get accumulated transcript."""
        return " ".join(self._transcript_buffer)
        
    def clear_transcript(self) -> None:
        """Clear transcript buffer."""
        self._transcript_buffer.clear()
