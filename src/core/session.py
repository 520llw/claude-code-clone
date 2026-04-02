"""
Claude Code Agent System - Session Management

This module provides session persistence functionality including:
- Session state management
- Save/load to/from disk
- Message history tracking
- Automatic checkpointing
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from .types import (
    AgentStatus,
    Context,
    ContextItem,
    Message,
    MessageRole,
    SessionState,
    ToolCall,
)


# =============================================================================
# Message Serializer
# =============================================================================

class MessageSerializer:
    """Handles serialization and deserialization of messages."""
    
    @staticmethod
    def to_dict(message: Message) -> Dict[str, Any]:
        """Convert a Message to a dictionary."""
        data = {
            "role": message.role.value,
            "content": message.content,
            "timestamp": message.timestamp.isoformat(),
            "metadata": message.metadata,
        }
        
        if message.tool_calls:
            data["tool_calls"] = [
                {
                    "id": tc.id,
                    "name": tc.name,
                    "arguments": tc.arguments,
                }
                for tc in message.tool_calls
            ]
        
        if message.tool_call_id:
            data["tool_call_id"] = message.tool_call_id
        
        if message.name:
            data["name"] = message.name
        
        return data
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> Message:
        """Convert a dictionary to a Message."""
        tool_calls = None
        if data.get("tool_calls"):
            tool_calls = [
                ToolCall(
                    id=tc["id"],
                    name=tc["name"],
                    arguments=tc["arguments"],
                )
                for tc in data["tool_calls"]
            ]
        
        return Message(
            role=MessageRole(data["role"]),
            content=data.get("content"),
            tool_calls=tool_calls,
            tool_call_id=data.get("tool_call_id"),
            name=data.get("name"),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata", {}),
        )


# =============================================================================
# Session
# =============================================================================

class Session:
    """
    Manages a conversation session.
    
    A session contains:
    - Unique session ID
    - Message history
    - Context information
    - Metadata
    - Status tracking
    
    Example:
        # Create a new session
        session = Session.create()
        
        # Add messages
        session.add_user_message("Hello!")
        session.add_assistant_message("Hi there!")
        
        # Save session
        session.save(Path("session.json"))
        
        # Load session
        loaded = Session.load(Path("session.json"))
    """
    
    def __init__(self, state: SessionState):
        """
        Initialize a session from state.
        
        Args:
            state: The session state
        """
        self._state = state
        self._message_serializer = MessageSerializer()
    
    # -------------------------------------------------------------------------
    # Factory Methods
    # -------------------------------------------------------------------------
    
    @classmethod
    def create(
        cls,
        session_id: Optional[str] = None,
        context: Optional[Context] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Session:
        """
        Create a new session.
        
        Args:
            session_id: Optional session ID (generates UUID if not provided)
            context: Optional initial context
            metadata: Optional metadata
            
        Returns:
            New Session instance
        """
        state = SessionState(
            session_id=session_id or str(uuid.uuid4()),
            context=context or Context(),
            metadata=metadata or {},
        )
        return cls(state)
    
    @classmethod
    def load(cls, path: Path) -> Session:
        """
        Load a session from disk.
        
        Args:
            path: Path to the session file
            
        Returns:
            Loaded Session instance
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            ValueError: If the file contains invalid data
        """
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Parse messages
        messages = [
            MessageSerializer.from_dict(m) for m in data.get("messages", [])
        ]
        
        # Parse context
        context_data = data.get("context", {})
        context = Context(
            items=[
                ContextItem(**item) for item in context_data.get("items", [])
            ],
            working_directory=Path(context_data["working_directory"])
            if context_data.get("working_directory")
            else None,
            claude_md_path=Path(context_data["claude_md_path"])
            if context_data.get("claude_md_path")
            else None,
        )
        
        # Create state
        state = SessionState(
            session_id=data["session_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            messages=messages,
            context=context,
            metadata=data.get("metadata", {}),
            agent_status=AgentStatus(data.get("agent_status", "idle")),
        )
        
        return cls(state)
    
    # -------------------------------------------------------------------------
    # Properties
    # -------------------------------------------------------------------------
    
    @property
    def session_id(self) -> str:
        """Get the session ID."""
        return self._state.session_id
    
    @property
    def created_at(self) -> datetime:
        """Get the creation timestamp."""
        return self._state.created_at
    
    @property
    def updated_at(self) -> datetime:
        """Get the last update timestamp."""
        return self._state.updated_at
    
    @property
    def context(self) -> Context:
        """Get the session context."""
        return self._state.context
    
    @property
    def agent_status(self) -> AgentStatus:
        """Get the current agent status."""
        return self._state.agent_status
    
    @agent_status.setter
    def agent_status(self, status: AgentStatus) -> None:
        """Set the agent status."""
        self._state.agent_status = status
        self._state.updated_at = datetime.utcnow()
    
    @property
    def metadata(self) -> Dict[str, Any]:
        """Get session metadata."""
        return self._state.metadata
    
    # -------------------------------------------------------------------------
    # Message Management
    # -------------------------------------------------------------------------
    
    def add_message(self, message: Message) -> None:
        """
        Add a message to the session.
        
        Args:
            message: Message to add
        """
        self._state.add_message(message)
    
    def add_user_message(self, content: str, **metadata: Any) -> None:
        """
        Add a user message.
        
        Args:
            content: Message content
            **metadata: Additional metadata
        """
        self.add_message(Message.user(content, metadata=metadata))
    
    def add_assistant_message(
        self,
        content: Optional[str] = None,
        tool_calls: Optional[List[ToolCall]] = None,
        **metadata: Any,
    ) -> None:
        """
        Add an assistant message.
        
        Args:
            content: Message content
            tool_calls: Optional tool calls
            **metadata: Additional metadata
        """
        self.add_message(
            Message.assistant(content, tool_calls, metadata=metadata)
        )
    
    def add_tool_result(
        self,
        tool_call_id: str,
        content: Union[str, Dict[str, Any]],
        **metadata: Any,
    ) -> None:
        """
        Add a tool result message.
        
        Args:
            tool_call_id: ID of the tool call
            content: Result content
            **metadata: Additional metadata
        """
        self.add_message(Message.tool(tool_call_id, content, metadata=metadata))
    
    def get_messages(self) -> List[Message]:
        """
        Get all messages in the session.
        
        Returns:
            List of messages
        """
        return list(self._state.messages)
    
    def get_recent_messages(self, count: int = 10) -> List[Message]:
        """
        Get the most recent messages.
        
        Args:
            count: Number of messages to return
            
        Returns:
            List of recent messages
        """
        return self._state.messages[-count:] if count < len(self._state.messages) else self.get_messages()
    
    def clear_messages(self) -> None:
        """Clear all messages from the session."""
        self._state.messages.clear()
        self._state.updated_at = datetime.utcnow()
    
    def get_message_count(self) -> int:
        """Get the total number of messages."""
        return len(self._state.messages)
    
    # -------------------------------------------------------------------------
    # Persistence
    # -------------------------------------------------------------------------
    
    def save(self, path: Path, pretty: bool = True) -> None:
        """
        Save the session to disk.
        
        Args:
            path: Path to save to
            pretty: Whether to format JSON with indentation
        """
        # Ensure parent directory exists
        path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "session_id": self._state.session_id,
            "created_at": self._state.created_at.isoformat(),
            "updated_at": self._state.updated_at.isoformat(),
            "messages": [
                MessageSerializer.to_dict(m) for m in self._state.messages
            ],
            "context": {
                "items": [
                    {
                        "source": item.source,
                        "content": item.content,
                        "priority": item.priority,
                        "token_count": item.token_count,
                        "metadata": item.metadata,
                    }
                    for item in self._state.context.items
                ],
                "working_directory": str(self._state.context.working_directory)
                if self._state.context.working_directory
                else None,
                "claude_md_path": str(self._state.context.claude_md_path)
                if self._state.context.claude_md_path
                else None,
            },
            "metadata": self._state.metadata,
            "agent_status": self._state.agent_status.value,
        }
        
        with open(path, "w", encoding="utf-8") as f:
            if pretty:
                json.dump(data, f, indent=2, ensure_ascii=False)
            else:
                json.dump(data, f, ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert session to dictionary.
        
        Returns:
            Dictionary representation of the session
        """
        return {
            "session_id": self._state.session_id,
            "created_at": self._state.created_at.isoformat(),
            "updated_at": self._state.updated_at.isoformat(),
            "message_count": len(self._state.messages),
            "agent_status": self._state.agent_status.value,
            "metadata": self._state.metadata,
        }
    
    # -------------------------------------------------------------------------
    # Context Management
    # -------------------------------------------------------------------------
    
    def update_context(self, context: Context) -> None:
        """
        Update the session context.
        
        Args:
            context: New context
        """
        self._state.context = context
        self._state.updated_at = datetime.utcnow()
    
    def add_context_item(self, item: ContextItem) -> None:
        """
        Add an item to the context.
        
        Args:
            item: Context item to add
        """
        self._state.context.add_item(item)
        self._state.updated_at = datetime.utcnow()
    
    # -------------------------------------------------------------------------
    # Metadata Management
    # -------------------------------------------------------------------------
    
    def set_metadata(self, key: str, value: Any) -> None:
        """
        Set a metadata value.
        
        Args:
            key: Metadata key
            value: Metadata value
        """
        self._state.metadata[key] = value
        self._state.updated_at = datetime.utcnow()
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """
        Get a metadata value.
        
        Args:
            key: Metadata key
            default: Default value if key not found
            
        Returns:
            Metadata value or default
        """
        return self._state.metadata.get(key, default)
    
    # -------------------------------------------------------------------------
    # String Representation
    # -------------------------------------------------------------------------
    
    def __repr__(self) -> str:
        return (
            f"Session("
            f"id={self.session_id!r}, "
            f"messages={len(self._state.messages)}, "
            f"status={self.agent_status.value}"
            f")"
        )
    
    def __str__(self) -> str:
        return f"Session {self.session_id[:8]} ({len(self._state.messages)} messages)"


# =============================================================================
# Session Manager
# =============================================================================

class SessionManager:
    """
    Manages multiple sessions with automatic persistence.
    
    Features:
    - Automatic session checkpointing
    - Session listing and retrieval
    - Cleanup of old sessions
    """
    
    def __init__(
        self,
        storage_dir: Path,
        auto_save: bool = True,
        checkpoint_interval: int = 5,
    ):
        """
        Initialize the session manager.
        
        Args:
            storage_dir: Directory to store session files
            auto_save: Whether to auto-save sessions
            checkpoint_interval: Save after every N messages
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.auto_save = auto_save
        self.checkpoint_interval = checkpoint_interval
        
        self._sessions: Dict[str, Session] = {}
        self._active_session: Optional[Session] = None
    
    def create_session(
        self,
        session_id: Optional[str] = None,
        context: Optional[Context] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Session:
        """
        Create a new managed session.
        
        Args:
            session_id: Optional session ID
            context: Optional initial context
            metadata: Optional metadata
            
        Returns:
            New Session instance
        """
        session = Session.create(session_id, context, metadata)
        self._sessions[session.session_id] = session
        self._active_session = session
        
        if self.auto_save:
            self._save_session(session)
        
        return session
    
    def load_session(self, session_id: str) -> Optional[Session]:
        """
        Load a session by ID.
        
        Args:
            session_id: Session ID to load
            
        Returns:
            Session if found, None otherwise
        """
        # Check in-memory cache
        if session_id in self._sessions:
            return self._sessions[session_id]
        
        # Try to load from disk
        path = self._get_session_path(session_id)
        if path.exists():
            session = Session.load(path)
            self._sessions[session_id] = session
            return session
        
        return None
    
    def get_active_session(self) -> Optional[Session]:
        """Get the currently active session."""
        return self._active_session
    
    def set_active_session(self, session_id: str) -> Optional[Session]:
        """
        Set the active session by ID.
        
        Args:
            session_id: Session ID to activate
            
        Returns:
            The activated session if found
        """
        session = self.load_session(session_id)
        if session:
            self._active_session = session
        return session
    
    def save_session(self, session_id: Optional[str] = None) -> None:
        """
        Save a session to disk.
        
        Args:
            session_id: Session ID to save (uses active if not specified)
        """
        session = self._get_session(session_id)
        if session:
            self._save_session(session)
    
    def _save_session(self, session: Session) -> None:
        """Internal method to save a session."""
        path = self._get_session_path(session.session_id)
        session.save(path)
    
    def _get_session(self, session_id: Optional[str] = None) -> Optional[Session]:
        """Get a session by ID or active session."""
        if session_id:
            return self.load_session(session_id)
        return self._active_session
    
    def _get_session_path(self, session_id: str) -> Path:
        """Get the file path for a session."""
        return self.storage_dir / f"{session_id}.json"
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        List all available sessions.
        
        Returns:
            List of session info dictionaries
        """
        sessions = []
        
        for path in self.storage_dir.glob("*.json"):
            try:
                session = Session.load(path)
                sessions.append(session.to_dict())
            except Exception:
                # Skip invalid session files
                continue
        
        # Sort by updated_at descending
        sessions.sort(key=lambda s: s["updated_at"], reverse=True)
        
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.
        
        Args:
            session_id: Session ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        # Remove from memory
        if session_id in self._sessions:
            del self._sessions[session_id]
        
        # Remove from disk
        path = self._get_session_path(session_id)
        if path.exists():
            path.unlink()
            return True
        
        return False
    
    def cleanup_old_sessions(self, max_age_days: int = 30) -> int:
        """
        Delete sessions older than specified days.
        
        Args:
            max_age_days: Maximum age in days
            
        Returns:
            Number of sessions deleted
        """
        from datetime import timedelta
        
        cutoff = datetime.utcnow() - timedelta(days=max_age_days)
        deleted = 0
        
        for path in self.storage_dir.glob("*.json"):
            try:
                session = Session.load(path)
                if session.updated_at < cutoff:
                    self.delete_session(session.session_id)
                    deleted += 1
            except Exception:
                continue
        
        return deleted
    
    def checkpoint(self, session_id: Optional[str] = None) -> None:
        """
        Checkpoint a session (save if checkpoint interval reached).
        
        Args:
            session_id: Session ID to checkpoint
        """
        session = self._get_session(session_id)
        if not session:
            return
        
        message_count = session.get_message_count()
        
        # Check if we should checkpoint
        last_checkpoint = session.get_metadata("last_checkpoint_count", 0)
        if message_count - last_checkpoint >= self.checkpoint_interval:
            self._save_session(session)
            session.set_metadata("last_checkpoint_count", message_count)


# =============================================================================
# Utility Functions
# =============================================================================

def create_session(
    storage_dir: Optional[Path] = None,
    context: Optional[Context] = None,
) -> Session:
    """
    Convenience function to create a new session.
    
    Args:
        storage_dir: Optional storage directory
        context: Optional initial context
        
    Returns:
        New Session instance
    """
    if storage_dir:
        manager = SessionManager(storage_dir)
        return manager.create_session(context=context)
    
    return Session.create(context=context)


def load_session(path: Path) -> Session:
    """
    Convenience function to load a session from file.
    
    Args:
        path: Path to the session file
        
    Returns:
        Loaded Session instance
    """
    return Session.load(path)


__all__ = [
    "Session",
    "SessionManager",
    "MessageSerializer",
    "create_session",
    "load_session",
]
