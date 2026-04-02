"""
Sanitizer - Code and commit sanitization.
"""

import re
import random
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from .patterns import (
    SENSITIVE_PATTERNS, 
    REPLACEMENTS, 
    COMMENT_PATTERNS,
    NEUTRAL_COMMIT_TEMPLATES,
    GENERIC_REPLACEMENTS
)


@dataclass
class SanitizationResult:
    """Result of sanitization."""
    sanitized: str
    changes_made: int
    patterns_found: List[str]
    warnings: List[str]


class CodeSanitizer:
    """
    Sanitizes code by removing identifying information.
    """
    
    def __init__(self):
        self.patterns = SENSITIVE_PATTERNS
        self.replacements = REPLACEMENTS
        
    def sanitize(
        self,
        code: str,
        language: str = 'python',
        preserve_functionality: bool = True
    ) -> SanitizationResult:
        """
        Sanitize code content.
        
        Args:
            code: Source code to sanitize
            language: Programming language
            preserve_functionality: Keep code functional
            
        Returns:
            SanitizationResult with sanitized code and metadata
        """
        original = code
        changes = 0
        found_patterns = []
        warnings = []
        
        # Detect and replace sensitive patterns
        for pattern_name, pattern in self.patterns.items():
            matches = list(pattern.finditer(code))
            if matches:
                found_patterns.append(pattern_name)
                replacement = self.replacements.get(pattern_name, '[REDACTED]')
                
                for match in reversed(matches):  # Reverse to maintain positions
                    start, end = match.span()
                    code = code[:start] + replacement + code[end:]
                    changes += 1
                    
        # Sanitize comments if language is supported
        if language in COMMENT_PATTERNS:
            code, comment_changes = self._sanitize_comments(code, language)
            changes += comment_changes
            
        # Replace generic terms
        for old, new in GENERIC_REPLACEMENTS.items():
            count = code.lower().count(old.lower())
            if count > 0:
                # Case-insensitive replacement preserving case
                code = self._replace_case_insensitive(code, old, new)
                changes += count
                
        # Check for remaining sensitive content
        remaining = self._check_remaining(code)
        if remaining:
            warnings.extend(remaining)
            
        return SanitizationResult(
            sanitized=code,
            changes_made=changes,
            patterns_found=found_patterns,
            warnings=warnings
        )
        
    def _sanitize_comments(self, code: str, language: str) -> Tuple[str, int]:
        """Sanitize content within comments."""
        pattern = COMMENT_PATTERNS[language]
        changes = 0
        
        def replace_in_comment(match):
            nonlocal changes
            comment = match.group(0)
            original = comment
            
            # Remove internal references from comments
            for pattern_name, pattern in self.patterns.items():
                if pattern_name in ['internal_todo', 'ai_generated', 'author_tag']:
                    comment = pattern.sub('', comment)
                    if comment != original:
                        changes += 1
                        
            return comment
            
        return pattern.sub(replace_in_comment, code), changes
        
    def _replace_case_insensitive(self, text: str, old: str, new: str) -> str:
        """Replace preserving case patterns."""
        def replace_match(match):
            matched = match.group(0)
            if matched.isupper():
                return new.upper()
            elif matched[0].isupper():
                return new.capitalize()
            else:
                return new.lower()
                
        pattern = re.compile(re.escape(old), re.IGNORECASE)
        return pattern.sub(replace_match, text)
        
    def _check_remaining(self, code: str) -> List[str]:
        """Check for potentially remaining sensitive content."""
        warnings = []
        
        # Check for email addresses
        if re.search(r'[\w.-]+@\w+\.\w+', code):
            warnings.append("Email addresses detected")
            
        # Check for IP addresses
        if re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', code):
            warnings.append("IP addresses detected")
            
        # Check for potential secrets
        if re.search(r'\b(password|secret|key|token)\s*[=:]\s*["\'][^"\']+["\']', code, re.IGNORECASE):
            warnings.append("Potential secrets detected")
            
        return warnings
        
    def sanitize_file_path(self, filepath: str) -> str:
        """Sanitize a file path."""
        # Remove internal identifiers from paths
        sanitized = filepath
        
        # Replace internal markers
        sanitized = re.sub(r'\.(internal|corp|anthropic|claude)\.', '.', sanitized, flags=re.IGNORECASE)
        
        return sanitized


class CommitSanitizer:
    """
    Sanitizes commit messages and generates neutral ones.
    """
    
    def __init__(self):
        self.templates = NEUTRAL_COMMIT_TEMPLATES
        self.patterns = SENSITIVE_PATTERNS
        
    def sanitize_message(self, message: str) -> str:
        """
        Sanitize an existing commit message.
        
        Args:
            message: Original commit message
            
        Returns:
            Sanitized message
        """
        sanitized = message
        
        # Remove sensitive patterns
        for pattern_name, pattern in self.patterns.items():
            sanitized = pattern.sub('', sanitized)
            
        # Clean up extra whitespace
        sanitized = re.sub(r'\n+', '\n', sanitized)
        sanitized = re.sub(r' +', ' ', sanitized)
        sanitized = sanitized.strip()
        
        # Replace generic terms
        for old, new in GENERIC_REPLACEMENTS.items():
            sanitized = re.sub(r'\b' + re.escape(old) + r'\b', new, sanitized, flags=re.IGNORECASE)
            
        return sanitized if sanitized else self.generate_message('chore', 'code')
        
    def generate_message(
        self,
        commit_type: str,
        component: str,
        issue: Optional[str] = None
    ) -> str:
        """
        Generate a neutral commit message.
        
        Args:
            commit_type: Type of commit (feature, fix, refactor, etc.)
            component: Component being modified
            issue: Optional issue description
            
        Returns:
            Neutral commit message
        """
        templates = self.templates.get(commit_type, self.templates['chore'])
        template = random.choice(templates)
        
        # Sanitize component name
        component = self._sanitize_component(component)
        
        # Sanitize issue description
        if issue:
            issue = self.sanitize_message(issue)
            
        try:
            if '{issue}' in template and issue:
                return template.format(component=component, issue=issue)
            else:
                return template.format(component=component)
        except KeyError:
            return f"Update {component}"
            
    def _sanitize_component(self, component: str) -> str:
        """Sanitize component name."""
        sanitized = component
        
        # Replace sensitive terms
        for old, new in GENERIC_REPLACEMENTS.items():
            sanitized = re.sub(r'\b' + re.escape(old) + r'\b', new, sanitized, flags=re.IGNORECASE)
            
        return sanitized
        
    def analyze_changes(self, files_changed: List[str]) -> str:
        """
        Analyze file changes to determine commit type.
        
        Args:
            files_changed: List of changed file paths
            
        Returns:
            Suggested commit type
        """
        has_tests = any('test' in f.lower() for f in files_changed)
        has_docs = any(f.endswith(('.md', '.rst', '.txt')) for f in files_changed)
        has_config = any(f.endswith(('.json', '.yaml', '.yml', '.toml')) for f in files_changed)
        
        # Simple heuristic
        if has_tests:
            return 'test'
        elif has_docs:
            return 'docs'
        elif has_config:
            return 'chore'
        else:
            return 'feature'


class UndercoverMode:
    """
    Main interface for undercover/anonymous contribution mode.
    
    Provides comprehensive sanitization for:
    - Code content
    - Commit messages
    - File paths
    - Author information
    """
    
    def __init__(self):
        self.code_sanitizer = CodeSanitizer()
        self.commit_sanitizer = CommitSanitizer()
        
    def sanitize_code(
        self,
        code: str,
        language: str = 'python'
    ) -> SanitizationResult:
        """
        Sanitize code for anonymous contribution.
        
        Args:
            code: Source code
            language: Programming language
            
        Returns:
            SanitizationResult
        """
        return self.code_sanitizer.sanitize(code, language)
        
    def sanitize_commit_message(self, message: str) -> str:
        """
        Sanitize a commit message.
        
        Args:
            message: Original commit message
            
        Returns:
            Sanitized message
        """
        return self.commit_sanitizer.sanitize_message(message)
        
    def generate_commit_message(
        self,
        commit_type: str,
        component: str
    ) -> str:
        """
        Generate a neutral commit message.
        
        Args:
            commit_type: Type of change
            component: Component name
            
        Returns:
            Neutral commit message
        """
        return self.commit_sanitizer.generate_message(commit_type, component)
        
    def sanitize_file_path(self, filepath: str) -> str:
        """
        Sanitize a file path.
        
        Args:
            filepath: Original file path
            
        Returns:
            Sanitized path
        """
        return self.code_sanitizer.sanitize_file_path(filepath)
        
    def process_batch(
        self,
        files: Dict[str, str],
        language: str = 'python'
    ) -> Dict[str, SanitizationResult]:
        """
        Process multiple files for sanitization.
        
        Args:
            files: Dict of filepath -> content
            language: Programming language
            
        Returns:
            Dict of filepath -> SanitizationResult
        """
        results = {}
        for filepath, content in files.items():
            sanitized_path = self.sanitize_file_path(filepath)
            result = self.sanitize_code(content, language)
            results[sanitized_path] = result
        return results
