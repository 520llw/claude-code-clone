"""
Undercover Mode - Anonymous Contribution System

A system for anonymizing code contributions by:
- Removing identifying information
- Generating neutral commit messages
- Sanitizing code comments
- Creating anonymous author identities
"""

from .sanitizer import UndercoverMode, CodeSanitizer, CommitSanitizer
from .identity import AnonymousIdentity, IdentityGenerator
from .patterns import SENSITIVE_PATTERNS, REPLACEMENTS

__all__ = [
    'UndercoverMode',
    'CodeSanitizer',
    'CommitSanitizer',
    'AnonymousIdentity',
    'IdentityGenerator',
    'SENSITIVE_PATTERNS',
    'REPLACEMENTS',
]
