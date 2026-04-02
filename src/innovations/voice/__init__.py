"""
Voice Module - Speech Recognition and Synthesis

Provides voice input/output capabilities for hands-free interaction.
"""

from .recognition import SpeechRecognizer, RecognitionResult
from .synthesis import SpeechSynthesizer, SynthesisResult
from .commands import VoiceCommandProcessor, VoiceCommand
from .core import VoiceInterface

__all__ = [
    'SpeechRecognizer',
    'RecognitionResult',
    'SpeechSynthesizer',
    'SynthesisResult',
    'VoiceCommandProcessor',
    'VoiceCommand',
    'VoiceInterface',
]
