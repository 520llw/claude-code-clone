"""
Claude Code Agent System - Context Management

This module provides context management functionality including:
- CLAUDE.md discovery and parsing
- Context building and compaction
- Working directory context gathering
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from .types import (
    CLAUDEMDContent,
    Context,
    ContextItem,
    Message,
    TokenCount,
)


# =============================================================================
# CLAUDE.md Parser
# =============================================================================

class CLAUDEMDParser:
    """Parser for CLAUDE.md files."""
    
    # Common CLAUDE.md filenames to look for
    DEFAULT_FILENAMES = ["CLAUDE.md", "claude.md", "CLAUDE.MD", "Claude.md"]
    
    # Section patterns
    SECTION_PATTERNS = {
        "instructions": re.compile(
            r"(?:^|\n)#+\s*(?:Instructions|指令|指示)\s*\n(.*?)(?=\n#+\s|\Z)",
            re.IGNORECASE | re.DOTALL,
        ),
        "conventions": re.compile(
            r"(?:^|\n)#+\s*(?:Conventions|Code Conventions|约定|规范|代码规范)\s*\n(.*?)(?=\n#+\s|\Z)",
            re.IGNORECASE | re.DOTALL,
        ),
        "tools": re.compile(
            r"(?:^|\n)#+\s*(?:Tools|Available Tools|工具|可用工具)\s*\n(.*?)(?=\n#+\s|\Z)",
            re.IGNORECASE | re.DOTALL,
        ),
    }
    
    @classmethod
    def find_claude_md(
        cls,
        start_path: Path,
        max_depth: int = 5,
    ) -> Optional[Path]:
        """
        Find CLAUDE.md file by searching up the directory tree.
        
        Args:
            start_path: Path to start searching from
            max_depth: Maximum directory levels to traverse up
            
        Returns:
            Path to CLAUDE.md if found, None otherwise
        """
        current = start_path.resolve()
        
        # If start_path is a file, start from its parent directory
        if current.is_file():
            current = current.parent
        
        for _ in range(max_depth):
            for filename in cls.DEFAULT_FILENAMES:
                candidate = current / filename
                if candidate.exists() and candidate.is_file():
                    return candidate
            
            # Move up one directory
            parent = current.parent
            if parent == current:  # Reached root
                break
            current = parent
        
        return None
    
    @classmethod
    def parse(cls, path: Path) -> CLAUDEMDContent:
        """
        Parse a CLAUDE.md file.
        
        Args:
            path: Path to the CLAUDE.md file
            
        Returns:
            Parsed CLAUDEMDContent object
        """
        content = path.read_text(encoding="utf-8")
        
        # Extract sections
        instructions = cls._extract_section(content, "instructions")
        conventions = cls._extract_section(content, "conventions")
        tools_section = cls._extract_section(content, "tools")
        
        # Parse tools hints if present
        tools_hints = cls._parse_tools_hints(tools_section[0] if tools_section else "")
        
        # Extract metadata from frontmatter if present
        metadata = cls._extract_metadata(content)
        
        return CLAUDEMDContent(
            path=path,
            content=content,
            instructions=instructions,
            conventions=conventions,
            tools_hints=tools_hints,
            metadata=metadata,
        )
    
    @classmethod
    def _extract_section(cls, content: str, section_name: str) -> List[str]:
        """Extract a section from the content."""
        pattern = cls.SECTION_PATTERNS.get(section_name)
        if not pattern:
            return []
        
        matches = pattern.findall(content)
        return [m.strip() for m in matches if m.strip()]
    
    @classmethod
    def _parse_tools_hints(cls, content: str) -> Dict[str, Any]:
        """Parse tool hints from the tools section."""
        hints: Dict[str, Any] = {}
        
        # Look for tool descriptions in list format
        tool_pattern = re.compile(
            r"[-*]\s*`?(\w+)`?\s*(?::|-)\s*(.+?)(?=\n[-*]|\Z)",
            re.DOTALL,
        )
        
        for match in tool_pattern.finditer(content):
            tool_name = match.group(1)
            tool_desc = match.group(2).strip()
            hints[tool_name] = tool_desc
        
        return hints
    
    @classmethod
    def _extract_metadata(cls, content: str) -> Dict[str, Any]:
        """Extract YAML frontmatter metadata if present."""
        metadata: Dict[str, Any] = {}
        
        frontmatter_pattern = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
        match = frontmatter_pattern.match(content)
        
        if match:
            try:
                import yaml
                metadata = yaml.safe_load(match.group(1)) or {}
            except ImportError:
                # Simple key-value parsing if yaml not available
                for line in match.group(1).split("\n"):
                    if ":" in line:
                        key, value = line.split(":", 1)
                        metadata[key.strip()] = value.strip()
        
        return metadata


# =============================================================================
# Context Builder
# =============================================================================

class ContextBuilder:
    """Builds context for an Agent from various sources."""
    
    def __init__(
        self,
        working_directory: Optional[Path] = None,
        enable_claude_md: bool = True,
        claude_md_filename: str = "CLAUDE.md",
    ):
        """
        Initialize the context builder.
        
        Args:
            working_directory: The working directory for context discovery
            enable_claude_md: Whether to look for and parse CLAUDE.md files
            claude_md_filename: Filename to use for CLAUDE.md discovery
        """
        self.working_directory = working_directory or Path.cwd()
        self.enable_claude_md = enable_claude_md
        self.claude_md_filename = claude_md_filename
    
    def build_context(
        self,
        additional_items: Optional[List[ContextItem]] = None,
    ) -> Context:
        """
        Build a complete context.
        
        Args:
            additional_items: Additional context items to include
            
        Returns:
            Complete Context object
        """
        context = Context(working_directory=self.working_directory)
        
        # Add CLAUDE.md content if enabled
        if self.enable_claude_md:
            claude_md = self._load_claude_md()
            if claude_md:
                context.claude_md_path = claude_md.path
                context.add_item(
                    ContextItem(
                        source="CLAUDE.md",
                        content=self._format_claude_md(claude_md),
                        priority=100,  # High priority
                    )
                )
        
        # Add working directory info
        context.add_item(
            ContextItem(
                source="working_directory",
                content=self._format_working_directory(),
                priority=50,
            )
        )
        
        # Add environment info
        context.add_item(
            ContextItem(
                source="environment",
                content=self._format_environment(),
                priority=30,
            )
        )
        
        # Add any additional items
        if additional_items:
            for item in additional_items:
                context.add_item(item)
        
        return context
    
    def _load_claude_md(self) -> Optional[CLAUDEMDContent]:
        """Load and parse CLAUDE.md if it exists."""
        path = CLAUDEMDParser.find_claude_md(self.working_directory)
        if path:
            return CLAUDEMDParser.parse(path)
        return None
    
    def _format_claude_md(self, claude_md: CLAUDEMDContent) -> str:
        """Format CLAUDEMDContent as a string."""
        parts = ["# Project Instructions (from CLAUDE.md)"]
        
        if claude_md.instructions:
            parts.append("\n## Instructions")
            for instruction in claude_md.instructions:
                parts.append(instruction)
        
        if claude_md.conventions:
            parts.append("\n## Code Conventions")
            for convention in claude_md.conventions:
                parts.append(convention)
        
        if claude_md.tools_hints:
            parts.append("\n## Tool Hints")
            for tool_name, hint in claude_md.tools_hints.items():
                parts.append(f"- {tool_name}: {hint}")
        
        return "\n\n".join(parts)
    
    def _format_working_directory(self) -> str:
        """Format working directory information."""
        parts = ["# Working Directory"]
        parts.append(f"Path: {self.working_directory}")
        
        # List some key files/directories
        try:
            entries = list(self.working_directory.iterdir())
            dirs = [e.name for e in entries if e.is_dir() and not e.name.startswith(".")]
            files = [e.name for e in entries if e.is_file() and not e.name.startswith(".")]
            
            if dirs:
                parts.append(f"\nDirectories: {', '.join(dirs[:10])}")
                if len(dirs) > 10:
                    parts.append(f"... and {len(dirs) - 10} more")
            
            if files:
                parts.append(f"\nFiles: {', '.join(files[:10])}")
                if len(files) > 10:
                    parts.append(f"... and {len(files) - 10} more")
        
        except PermissionError:
            parts.append("\n(Cannot list directory contents - permission denied)")
        
        return "\n".join(parts)
    
    def _format_environment(self) -> str:
        """Format environment information."""
        parts = ["# Environment"]
        
        # Python version
        import sys
        parts.append(f"Python: {sys.version}")
        
        # Platform
        import platform
        parts.append(f"Platform: {platform.platform()}")
        
        # Relevant environment variables
        relevant_vars = [
            "PYTHONPATH",
            "VIRTUAL_ENV",
            "CONDA_DEFAULT_ENV",
            "HOME",
            "USER",
        ]
        
        env_info = []
        for var in relevant_vars:
            value = os.environ.get(var)
            if value:
                env_info.append(f"{var}={value}")
        
        if env_info:
            parts.append(f"\nEnvironment Variables:\n" + "\n".join(env_info))
        
        return "\n".join(parts)


# =============================================================================
# Context Compactor
# =============================================================================

class ContextCompactor:
    """
    Compacts context to fit within token limits.
    
    Implements various strategies:
    - Summarization of old messages
    - Removal of low-priority context items
    - Truncation of long content
    """
    
    # Approximate tokens per character (rough estimate)
    CHARS_PER_TOKEN = 4
    
    def __init__(self, model_max_tokens: int = 8000):
        """
        Initialize the context compactor.
        
        Args:
            model_max_tokens: Maximum tokens the model can handle
        """
        self.model_max_tokens = model_max_tokens
        # Reserve tokens for response
        self.max_context_tokens = int(model_max_tokens * 0.75)
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for text.
        
        This is a rough estimate. For accurate counts, use a tokenizer.
        
        Args:
            text: Text to estimate
            
        Returns:
            Estimated token count
        """
        return len(text) // self.CHARS_PER_TOKEN
    
    def compact(
        self,
        messages: List[Message],
        context: Context,
        max_tokens: Optional[int] = None,
    ) -> Tuple[List[Message], Context]:
        """
        Compact messages and context to fit within token limit.
        
        Args:
            messages: List of messages to compact
            context: Context to include
            max_tokens: Maximum tokens (uses default if not specified)
            
        Returns:
            Tuple of (compacted messages, compacted context)
        """
        max_tokens = max_tokens or self.max_context_tokens
        
        # First, try to fit everything
        total_tokens = self._count_total_tokens(messages, context)
        
        if total_tokens <= max_tokens:
            return messages, context
        
        # Need to compact - start by reducing context
        compacted_context = self._compact_context(context, max_tokens // 4)
        
        # Recalculate
        total_tokens = self._count_total_tokens(messages, compacted_context)
        
        if total_tokens <= max_tokens:
            return messages, compacted_context
        
        # Still too large - need to compact messages
        remaining_tokens = max_tokens - self._count_context_tokens(compacted_context)
        compacted_messages = self._compact_messages(messages, remaining_tokens)
        
        return compacted_messages, compacted_context
    
    def _count_total_tokens(self, messages: List[Message], context: Context) -> int:
        """Count total tokens for messages and context."""
        message_tokens = sum(
            self.estimate_tokens(msg.content or "")
            for msg in messages
        )
        context_tokens = self._count_context_tokens(context)
        return message_tokens + context_tokens
    
    def _count_context_tokens(self, context: Context) -> int:
        """Count tokens for context."""
        return sum(
            self.estimate_tokens(item.content)
            for item in context.items
        )
    
    def _compact_context(self, context: Context, max_tokens: int) -> Context:
        """Compact context to fit within token limit."""
        compacted = Context(
            working_directory=context.working_directory,
            claude_md_path=context.claude_md_path,
        )
        
        current_tokens = 0
        
        # Add items by priority until we hit the limit
        for item in context.items:
            item_tokens = self.estimate_tokens(item.content)
            
            if current_tokens + item_tokens > max_tokens:
                # Try to truncate this item
                remaining = max_tokens - current_tokens
                if remaining > 100:  # Only if we have meaningful space
                    truncated = self._truncate_text(item.content, remaining)
                    compacted.add_item(
                        ContextItem(
                            source=item.source,
                            content=truncated,
                            priority=item.priority,
                        )
                    )
                break
            
            compacted.add_item(item)
            current_tokens += item_tokens
        
        return compacted
    
    def _compact_messages(
        self,
        messages: List[Message],
        max_tokens: int,
    ) -> List[Message]:
        """
        Compact messages to fit within token limit.
        
        Strategy:
        1. Always keep system message and last few messages
        2. Summarize older messages
        """
        if not messages:
            return []
        
        # Separate system, recent, and older messages
        system_messages = [m for m in messages if m.role.value == "system"]
        non_system = [m for m in messages if m.role.value != "system"]
        
        # Keep last 4 messages as-is
        keep_recent = 4
        recent = non_system[-keep_recent:] if len(non_system) > keep_recent else non_system
        older = non_system[:-keep_recent] if len(non_system) > keep_recent else []
        
        # Calculate tokens
        system_tokens = sum(self.estimate_tokens(m.content or "") for m in system_messages)
        recent_tokens = sum(self.estimate_tokens(m.content or "") for m in recent)
        
        available_for_older = max_tokens - system_tokens - recent_tokens
        
        compacted: List[Message] = []
        compacted.extend(system_messages)
        
        if older and available_for_older > 200:
            # Summarize older messages
            summary = self.summarize_messages(older)
            summary_tokens = self.estimate_tokens(summary)
            
            if summary_tokens <= available_for_older:
                compacted.append(
                    Message.system(f"[Earlier conversation summary]:\n{summary}")
                )
        
        compacted.extend(recent)
        
        return compacted
    
    def _truncate_text(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token limit."""
        max_chars = max_tokens * self.CHARS_PER_TOKEN
        if len(text) <= max_chars:
            return text
        
        # Try to truncate at a sensible point
        truncated = text[:max_chars - 100]
        
        # Find last complete sentence or paragraph
        for delimiter in ["\n\n", "\n", ". ", " "]:
            last_delim = truncated.rfind(delimiter)
            if last_delim > max_chars * 0.5:  # At least half the content
                truncated = truncated[:last_delim]
                break
        
        return truncated + "\n\n[... content truncated ...]"
    
    def summarize_messages(self, messages: List[Message]) -> str:
        """
        Create a summary of messages.
        
        In a real implementation, this would use an LLM to summarize.
        For now, we create a simple extractive summary.
        
        Args:
            messages: Messages to summarize
            
        Returns:
            Summary text
        """
        if not messages:
            return ""
        
        parts = []
        
        for msg in messages:
            role = msg.role.value
            content = msg.content or ""
            
            # Truncate long content
            if len(content) > 200:
                content = content[:200] + "..."
            
            # Note tool calls
            tool_info = ""
            if msg.tool_calls:
                tool_names = [tc.name for tc in msg.tool_calls]
                tool_info = f" [tools: {', '.join(tool_names)}]"
            
            parts.append(f"{role}: {content}{tool_info}")
        
        return "\n".join(parts)
    
    def summarize(self, messages: List[Message]) -> str:
        """Alias for summarize_messages for API compatibility."""
        return self.summarize_messages(messages)


# =============================================================================
# Context Manager
# =============================================================================

class ContextManager:
    """
    Manages context throughout an Agent session.
    
    Handles:
    - Initial context building
    - Dynamic context updates
    - Context compaction as conversation grows
    """
    
    def __init__(
        self,
        working_directory: Optional[Path] = None,
        enable_claude_md: bool = True,
        max_context_tokens: int = 8000,
    ):
        """
        Initialize the context manager.
        
        Args:
            working_directory: Working directory for context discovery
            enable_claude_md: Whether to use CLAUDE.md files
            max_context_tokens: Maximum context tokens
        """
        self.builder = ContextBuilder(
            working_directory=working_directory,
            enable_claude_md=enable_claude_md,
        )
        self.compactor = ContextCompactor(max_context_tokens)
        self._context: Optional[Context] = None
    
    def initialize(self, additional_items: Optional[List[ContextItem]] = None) -> Context:
        """
        Initialize context for a new session.
        
        Args:
            additional_items: Additional context items to include
            
        Returns:
            Initial context
        """
        self._context = self.builder.build_context(additional_items)
        return self._context
    
    def get_context(self) -> Context:
        """Get the current context."""
        if self._context is None:
            return self.initialize()
        return self._context
    
    def add_context_item(self, item: ContextItem) -> None:
        """Add a new context item."""
        if self._context is None:
            self._context = self.initialize()
        self._context.add_item(item)
    
    def prepare_for_llm(
        self,
        messages: List[Message],
    ) -> Tuple[str, List[Message]]:
        """
        Prepare context and messages for LLM call.
        
        Compacts if necessary and returns the system prompt and messages.
        
        Args:
            messages: Current message history
            
        Returns:
            Tuple of (system_prompt, prepared_messages)
        """
        context = self.get_context()
        
        # Compact if needed
        compacted_messages, compacted_context = self.compactor.compact(
            messages, context
        )
        
        # Build system prompt from context
        system_prompt = compacted_context.to_text()
        
        # Filter out system messages from compacted_messages (we'll add our own)
        non_system = [m for m in compacted_messages if m.role.value != "system"]
        
        # Prepend system prompt
        prepared = [Message.system(system_prompt)] + non_system
        
        return system_prompt, prepared
    
    def get_token_count(self, messages: List[Message]) -> TokenCount:
        """Get token count for messages."""
        total = self.compactor.estimate_tokens(
            "\n".join(m.content or "" for m in messages)
        )
        return TokenCount(
            prompt_tokens=total,
            completion_tokens=0,
            total_tokens=total,
        )


# =============================================================================
# Utility Functions
# =============================================================================

def find_claude_md(path: Optional[Path] = None) -> Optional[Path]:
    """
    Find CLAUDE.md file starting from the given path.
    
    Args:
        path: Path to start searching from (defaults to current directory)
        
    Returns:
        Path to CLAUDE.md if found, None otherwise
    """
    return CLAUDEMDParser.find_claude_md(path or Path.cwd())


def parse_claude_md(path: Path) -> CLAUDEMDContent:
    """
    Parse a CLAUDE.md file.
    
    Args:
        path: Path to the CLAUDE.md file
        
    Returns:
        Parsed CLAUDEMDContent
    """
    return CLAUDEMDParser.parse(path)


def build_system_prompt(
    working_directory: Optional[Path] = None,
    claude_md_path: Optional[Path] = None,
) -> str:
    """
    Build a system prompt from available context sources.
    
    Args:
        working_directory: Working directory
        claude_md_path: Optional explicit CLAUDE.md path
        
    Returns:
        System prompt string
    """
    builder = ContextBuilder(working_directory=working_directory)
    context = builder.build_context()
    return context.to_text()


__all__ = [
    "CLAUDEMDParser",
    "ContextBuilder",
    "ContextCompactor",
    "ContextManager",
    "find_claude_md",
    "parse_claude_md",
    "build_system_prompt",
]
