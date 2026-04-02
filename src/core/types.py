"""
Claude Code Agent System - Shared Type Definitions

This module contains all shared type definitions, data models, and enums
used throughout the Agent system. Uses Pydantic for validation.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import (
    Any,
    AsyncIterator,
    Callable,
    Coroutine,
    Dict,
    Generic,
    List,
    Literal,
    Optional,
    Protocol,
    TypeVar,
    Union,
)

from pydantic import BaseModel, ConfigDict, Field, field_validator


# =============================================================================
# Enums
# =============================================================================

class MessageRole(str, Enum):
    """Message roles in the conversation."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class EventType(str, Enum):
    """Types of events that can occur during agent execution."""
    MESSAGE = "message"           # LLM message (text content)
    TOOL_CALL = "tool_call"       # Tool call request
    TOOL_RESULT = "tool_result"   # Tool execution result
    THINKING = "thinking"         # Agent reasoning/thinking
    ERROR = "error"               # Error occurred
    COMPLETE = "complete"         # Task completed
    SUBAGENT_START = "subagent_start"   # SubAgent started
    SUBAGENT_COMPLETE = "subagent_complete"  # SubAgent completed


class ToolResultStatus(str, Enum):
    """Status of a tool execution result."""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class AgentStatus(str, Enum):
    """Current status of an Agent."""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


# =============================================================================
# Tool Definitions
# =============================================================================

class ToolParameter(BaseModel):
    """Schema for a tool parameter."""
    model_config = ConfigDict(extra="allow")
    
    name: str
    type: str
    description: str
    required: bool = True
    default: Optional[Any] = None
    enum: Optional[List[str]] = None


class ToolDefinition(BaseModel):
    """Definition of a tool that can be called by the Agent."""
    model_config = ConfigDict(extra="allow")
    
    name: str
    description: str
    parameters: List[ToolParameter] = Field(default_factory=list)
    
    def to_openai_format(self) -> Dict[str, Any]:
        """Convert to OpenAI function calling format."""
        properties = {}
        required = []
        
        for param in self.parameters:
            prop = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                prop["enum"] = param.enum
            properties[param.name] = prop
            
            if param.required:
                required.append(param.name)
        
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        }


class ToolCall(BaseModel):
    """A request from the LLM to call a tool."""
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    
    @field_validator("arguments", mode="before")
    @classmethod
    def parse_arguments(cls, v: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Parse arguments if they come as a JSON string."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {"raw": v}
        return v


class ToolResult(BaseModel):
    """Result of executing a tool."""
    model_config = ConfigDict(extra="allow")
    
    tool_call_id: str
    status: ToolResultStatus
    content: Union[str, Dict[str, Any], List[Any]]
    execution_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    
    def to_message_content(self) -> str:
        """Convert result to string for LLM message."""
        if isinstance(self.content, str):
            return self.content
        return json.dumps(self.content, ensure_ascii=False, indent=2)


# =============================================================================
# Message Types
# =============================================================================

class Message(BaseModel):
    """A message in the conversation."""
    model_config = ConfigDict(extra="allow")
    
    role: MessageRole
    content: Union[str, List[Dict[str, Any]], None] = None
    tool_calls: Optional[List[ToolCall]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None  # For tool messages
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, v: Any) -> Any:
        """Ensure content is valid."""
        if v is None:
            return None
        if isinstance(v, (str, list)):
            return v
        return str(v)
    
    def to_openai_format(self) -> Dict[str, Any]:
        """Convert to OpenAI message format."""
        msg: Dict[str, Any] = {"role": self.role.value}
        
        if self.content is not None:
            msg["content"] = self.content
        
        if self.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments),
                    },
                }
                for tc in self.tool_calls
            ]
        
        if self.tool_call_id:
            msg["tool_call_id"] = self.tool_call_id
        
        if self.name:
            msg["name"] = self.name
        
        return msg
    
    @classmethod
    def system(cls, content: str, **kwargs: Any) -> Message:
        """Create a system message."""
        return cls(role=MessageRole.SYSTEM, content=content, **kwargs)
    
    @classmethod
    def user(cls, content: str, **kwargs: Any) -> Message:
        """Create a user message."""
        return cls(role=MessageRole.USER, content=content, **kwargs)
    
    @classmethod
    def assistant(cls, content: Optional[str] = None, tool_calls: Optional[List[ToolCall]] = None, **kwargs: Any) -> Message:
        """Create an assistant message."""
        return cls(role=MessageRole.ASSISTANT, content=content, tool_calls=tool_calls, **kwargs)
    
    @classmethod
    def tool(cls, tool_call_id: str, content: Union[str, Dict[str, Any]], **kwargs: Any) -> Message:
        """Create a tool result message."""
        return cls(
            role=MessageRole.TOOL,
            content=content if isinstance(content, str) else json.dumps(content),
            tool_call_id=tool_call_id,
            **kwargs
        )


# =============================================================================
# Event Types
# =============================================================================

class Event(BaseModel):
    """Base class for all events during agent execution."""
    model_config = ConfigDict(extra="allow")
    
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MessageEvent(Event):
    """Event containing a message from the LLM."""
    type: EventType = EventType.MESSAGE
    message: Message
    is_delta: bool = False  # True if this is a streaming delta


class ToolCallEvent(Event):
    """Event indicating a tool call request."""
    type: EventType = EventType.TOOL_CALL
    tool_call: ToolCall


class ToolResultEvent(Event):
    """Event containing a tool execution result."""
    type: EventType = EventType.TOOL_RESULT
    result: ToolResult


class ThinkingEvent(Event):
    """Event containing agent reasoning/thinking."""
    type: EventType = EventType.THINKING
    content: str
    step: int  # Which reasoning step this is


class ErrorEvent(Event):
    """Event indicating an error occurred."""
    type: EventType = EventType.ERROR
    error: str
    recoverable: bool = True


class CompleteEvent(Event):
    """Event indicating task completion."""
    type: EventType = EventType.COMPLETE
    final_message: Optional[Message] = None
    summary: Optional[str] = None


class SubAgentStartEvent(Event):
    """Event indicating a subagent has started."""
    type: EventType = EventType.SUBAGENT_START
    subagent_id: str
    task: str


class SubAgentCompleteEvent(Event):
    """Event indicating a subagent has completed."""
    type: EventType = EventType.SUBAGENT_COMPLETE
    subagent_id: str
    result: Any


# Union type for all events
AgentEvent = Union[
    MessageEvent,
    ToolCallEvent,
    ToolResultEvent,
    ThinkingEvent,
    ErrorEvent,
    CompleteEvent,
    SubAgentStartEvent,
    SubAgentCompleteEvent,
]


# =============================================================================
# LLM Types
# =============================================================================

class LLMConfig(BaseModel):
    """Configuration for LLM client."""
    model_config = ConfigDict(extra="allow")
    
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str = "claude-3-sonnet-20240229"
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    timeout: float = 60.0
    max_retries: int = 3
    
    # Provider-specific settings
    provider: Literal["anthropic", "openai", "azure"] = "anthropic"


class LLMEvent(BaseModel):
    """Event from LLM streaming response."""
    model_config = ConfigDict(extra="allow")
    
    type: Literal["content", "tool_call", "thinking", "done", "error"]
    content: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    thinking: Optional[str] = None
    error: Optional[str] = None
    is_complete: bool = False


# =============================================================================
# Context Types
# =============================================================================

class ContextItem(BaseModel):
    """A single item in the context."""
    model_config = ConfigDict(extra="allow")
    
    source: str  # e.g., "CLAUDE.md", "file", "user"
    content: str
    priority: int = 0  # Higher = more important
    token_count: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Context(BaseModel):
    """The context available to an Agent."""
    model_config = ConfigDict(extra="allow")
    
    items: List[ContextItem] = Field(default_factory=list)
    working_directory: Optional[Path] = None
    claude_md_path: Optional[Path] = None
    
    def add_item(self, item: ContextItem) -> None:
        """Add a context item."""
        self.items.append(item)
        # Keep sorted by priority (descending)
        self.items.sort(key=lambda x: x.priority, reverse=True)
    
    def to_text(self, max_tokens: Optional[int] = None) -> str:
        """Convert context to text, optionally respecting token limit."""
        parts = []
        current_tokens = 0
        
        for item in self.items:
            part = f"<!-- Source: {item.source} -->\n{item.content}\n"
            
            if max_tokens and item.token_count:
                if current_tokens + item.token_count > max_tokens:
                    continue
                current_tokens += item.token_count
            
            parts.append(part)
        
        return "\n".join(parts)


class CLAUDEMDContent(BaseModel):
    """Content parsed from a CLAUDE.md file."""
    model_config = ConfigDict(extra="allow")
    
    path: Path
    content: str
    instructions: List[str] = Field(default_factory=list)
    conventions: List[str] = Field(default_factory=list)
    tools_hints: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# =============================================================================
# Session Types
# =============================================================================

class SessionState(BaseModel):
    """Complete state of a session."""
    model_config = ConfigDict(extra="allow")
    
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Message] = Field(default_factory=list)
    context: Context = Field(default_factory=Context)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    agent_status: AgentStatus = AgentStatus.IDLE
    
    def add_message(self, message: Message) -> None:
        """Add a message and update timestamp."""
        self.messages.append(message)
        self.updated_at = datetime.utcnow()


# =============================================================================
# Tool Protocol
# =============================================================================

class Tool(Protocol):
    """Protocol for tools that can be executed by the Agent."""
    
    @property
    def definition(self) -> ToolDefinition:
        """Get the tool definition."""
        ...
    
    async def execute(self, **kwargs: Any) -> ToolResult:
        """Execute the tool with given arguments."""
        ...


# =============================================================================
# Agent Configuration
# =============================================================================

class AgentConfig(BaseModel):
    """Configuration for an Agent."""
    model_config = ConfigDict(extra="allow")
    
    name: str = "ClaudeCodeAgent"
    description: Optional[str] = None
    
    # LLM settings
    llm_config: LLMConfig = Field(default_factory=LLMConfig)
    
    # Context settings
    max_context_tokens: int = 8000
    enable_claude_md: bool = True
    claude_md_filename: str = "CLAUDE.md"
    
    # Execution settings
    max_iterations: int = 50
    max_tool_calls_per_iteration: int = 32
    enable_streaming: bool = True
    
    # Multi-agent settings
    enable_subagents: bool = True
    max_subagents: int = 5
    
    # System prompt template
    system_prompt_template: Optional[str] = None


# =============================================================================
# SubAgent Types
# =============================================================================

class SubAgentConfig(BaseModel):
    """Configuration for a subagent."""
    model_config = ConfigDict(extra="allow")
    
    task: str
    parent_context: Context
    llm_config: Optional[LLMConfig] = None
    max_iterations: int = 20
    inherit_tools: bool = True
    custom_tools: List[ToolDefinition] = Field(default_factory=list)


class SubAgentResult(BaseModel):
    """Result from a subagent execution."""
    model_config = ConfigDict(extra="allow")
    
    subagent_id: str
    status: AgentStatus
    result: Optional[str] = None
    messages: List[Message] = Field(default_factory=list)
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None


# =============================================================================
# Utility Types
# =============================================================================

T = TypeVar("T")


class TokenCount(BaseModel):
    """Token count information."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class UsageStats(BaseModel):
    """Usage statistics for an Agent run."""
    token_count: TokenCount = Field(default_factory=TokenCount)
    tool_calls: int = 0
    iterations: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def duration_ms(self) -> Optional[float]:
        """Get duration in milliseconds."""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds() * 1000
        return None


# Type for async tool functions
ToolFunction = Callable[..., Coroutine[Any, Any, ToolResult]]


__all__ = [
    # Enums
    "MessageRole",
    "EventType",
    "ToolResultStatus",
    "AgentStatus",
    # Tool types
    "ToolParameter",
    "ToolDefinition",
    "ToolCall",
    "ToolResult",
    # Message types
    "Message",
    # Event types
    "Event",
    "MessageEvent",
    "ToolCallEvent",
    "ToolResultEvent",
    "ThinkingEvent",
    "ErrorEvent",
    "CompleteEvent",
    "SubAgentStartEvent",
    "SubAgentCompleteEvent",
    "AgentEvent",
    # LLM types
    "LLMConfig",
    "LLMEvent",
    # Context types
    "ContextItem",
    "Context",
    "CLAUDEMDContent",
    # Session types
    "SessionState",
    # Protocols
    "Tool",
    # Configuration
    "AgentConfig",
    "SubAgentConfig",
    "SubAgentResult",
    # Utilities
    "TokenCount",
    "UsageStats",
    "ToolFunction",
]
