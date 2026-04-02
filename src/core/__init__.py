"""
Claude Code Agent System - Core Module

This module provides the core components for building AI agents:
- Agent: Main agent class with reasoning-action-observation loop
- Session: Session management and persistence
- LLMClient: Unified interface for LLM APIs
- Coordinator: Multi-agent coordination
- Context: Context management and CLAUDE.md parsing

Example:
    from claude_code_clone.core import Agent, AgentConfig
    
    agent = Agent(config=AgentConfig())
    async for event in agent.run("Hello, can you help me?"):
        print(event)
"""

# Types
from .types import (
    AgentConfig,
    AgentEvent,
    AgentStatus,
    CLAUDEMDContent,
    CompleteEvent,
    Context,
    ContextItem,
    ErrorEvent,
    EventType,
    LLMConfig,
    LLMEvent,
    Message,
    MessageEvent,
    MessageRole,
    SessionState,
    SubAgentConfig,
    SubAgentResult,
    ThinkingEvent,
    Tool,
    ToolCall,
    ToolCallEvent,
    ToolDefinition,
    ToolResult,
    ToolResultEvent,
    ToolResultStatus,
    UsageStats,
)

# LLM Client
from .llm_client import (
    AnthropicClient,
    BaseLLMClient,
    LLMClient,
    OpenAIClient,
    chat,
    stream_chat,
)

# Context Management
from .context import (
    CLAUDEMDParser,
    ContextBuilder,
    ContextCompactor,
    ContextManager,
    build_system_prompt,
    find_claude_md,
    parse_claude_md,
)

# Session Management
from .session import (
    MessageSerializer,
    Session,
    SessionManager,
    create_session,
    load_session,
)

# Agent
from .agent import (
    Agent,
    ToolRegistry,
    quick_chat,
    run_agent,
)

# Coordinator
from .coordinator import (
    Coordinator,
    ResultAggregator,
    SubAgent,
    TaskDecomposer,
    coordinated_execute,
    parallel_execute,
)

__version__ = "0.1.0"

__all__ = [
    # Version
    "__version__",
    
    # Types
    "AgentConfig",
    "AgentEvent",
    "AgentStatus",
    "CLAUDEMDContent",
    "CompleteEvent",
    "Context",
    "ContextItem",
    "ErrorEvent",
    "EventType",
    "LLMConfig",
    "LLMEvent",
    "Message",
    "MessageEvent",
    "MessageRole",
    "SessionState",
    "SubAgentConfig",
    "SubAgentResult",
    "ThinkingEvent",
    "Tool",
    "ToolCall",
    "ToolCallEvent",
    "ToolDefinition",
    "ToolResult",
    "ToolResultEvent",
    "ToolResultStatus",
    "UsageStats",
    
    # LLM Client
    "AnthropicClient",
    "BaseLLMClient",
    "LLMClient",
    "OpenAIClient",
    "chat",
    "stream_chat",
    
    # Context
    "CLAUDEMDParser",
    "ContextBuilder",
    "ContextCompactor",
    "ContextManager",
    "build_system_prompt",
    "find_claude_md",
    "parse_claude_md",
    
    # Session
    "MessageSerializer",
    "Session",
    "SessionManager",
    "create_session",
    "load_session",
    
    # Agent
    "Agent",
    "ToolRegistry",
    "quick_chat",
    "run_agent",
    
    # Coordinator
    "Coordinator",
    "ResultAggregator",
    "SubAgent",
    "TaskDecomposer",
    "coordinated_execute",
    "parallel_execute",
]
