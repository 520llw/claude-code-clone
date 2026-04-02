"""
Claude Code Agent System - Agent Core

This module provides the main Agent class implementing the
reasoning-action-observation loop that powers Claude Code.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Type, Union

from .types import (
    AgentConfig,
    AgentEvent,
    AgentStatus,
    CompleteEvent,
    Context,
    ErrorEvent,
    EventType,
    LLMConfig,
    LLMEvent,
    Message,
    MessageEvent,
    MessageRole,
    SessionState,
    SubAgentCompleteEvent,
    SubAgentStartEvent,
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
from .llm_client import BaseLLMClient, LLMClient
from .context import ContextManager
from .session import Session


# =============================================================================
# Tool Registry
# =============================================================================

class ToolRegistry:
    """Registry for tools that the Agent can use."""
    
    def __init__(self):
        """Initialize an empty tool registry."""
        self._tools: Dict[str, Tool] = {}
        self._definitions: Dict[str, ToolDefinition] = {}
    
    def register(self, tool: Tool) -> None:
        """
        Register a tool.
        
        Args:
            tool: Tool to register (must have 'definition' and 'execute' attributes)
        """
        definition = tool.definition
        self._tools[definition.name] = tool
        self._definitions[definition.name] = definition
    
    def register_function(
        self,
        func: Callable[..., Any],
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        """
        Register a function as a tool.
        
        Args:
            func: Function to register
            name: Optional tool name (uses function name if not provided)
            description: Optional description (uses docstring if not provided)
        """
        from .types import ToolParameter
        import inspect
        
        tool_name = name or func.__name__
        tool_desc = description or (func.__doc__ or "No description")
        
        # Extract parameters from function signature
        sig = inspect.signature(func)
        parameters = []
        
        for param_name, param in sig.parameters.items():
            param_type = "string"  # Default type
            if param.annotation != inspect.Parameter.empty:
                if param.annotation == int:
                    param_type = "integer"
                elif param.annotation == float:
                    param_type = "number"
                elif param.annotation == bool:
                    param_type = "boolean"
                elif param.annotation == list:
                    param_type = "array"
                elif param.annotation == dict:
                    param_type = "object"
            
            parameters.append(
                ToolParameter(
                    name=param_name,
                    type=param_type,
                    description=f"Parameter {param_name}",
                    required=param.default == inspect.Parameter.empty,
                    default=param.default if param.default != inspect.Parameter.empty else None,
                )
            )
        
        definition = ToolDefinition(
            name=tool_name,
            description=tool_desc,
            parameters=parameters,
        )
        
        # Create a wrapper that matches the Tool protocol
        class FunctionTool:
            def __init__(self, definition: ToolDefinition, func: Callable):
                self.definition = definition
                self._func = func
            
            async def execute(self, **kwargs: Any) -> ToolResult:
                try:
                    if asyncio.iscoroutinefunction(self._func):
                        result = await self._func(**kwargs)
                    else:
                        result = self._func(**kwargs)
                    
                    return ToolResult(
                        tool_call_id="",
                        status=ToolResultStatus.SUCCESS,
                        content=str(result) if result is not None else "",
                    )
                except Exception as e:
                    return ToolResult(
                        tool_call_id="",
                        status=ToolResultStatus.ERROR,
                        content="",
                        error_message=str(e),
                    )
        
        self.register(FunctionTool(definition, func))
    
    def unregister(self, name: str) -> bool:
        """
        Unregister a tool.
        
        Args:
            name: Tool name to unregister
            
        Returns:
            True if unregistered, False if not found
        """
        if name in self._tools:
            del self._tools[name]
            del self._definitions[name]
            return True
        return False
    
    def get(self, name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self._tools.get(name)
    
    def get_definition(self, name: str) -> Optional[ToolDefinition]:
        """Get a tool definition by name."""
        return self._definitions.get(name)
    
    def get_all_definitions(self) -> List[ToolDefinition]:
        """Get all tool definitions."""
        return list(self._definitions.values())
    
    def list_tools(self) -> List[str]:
        """List all registered tool names."""
        return list(self._tools.keys())
    
    def clear(self) -> None:
        """Clear all registered tools."""
        self._tools.clear()
        self._definitions.clear()


# =============================================================================
# Agent
# =============================================================================

class Agent:
    """
    Core Agent class implementing the reasoning-action-observation loop.
    
    The Agent:
    1. Receives user input
    2. Builds context and system prompt
    3. Streams LLM responses
    4. Executes tool calls
    5. Observes results
    6. Continues until task complete
    
    Example:
        agent = Agent(config=AgentConfig())
        
        # Register tools
        agent.register_tool(my_tool)
        
        # Run with streaming
        async for event in agent.run("Hello, can you help me?"):
            if event.type == EventType.MESSAGE:
                print(event.message.content)
            elif event.type == EventType.TOOL_CALL:
                print(f"Calling tool: {event.tool_call.name}")
    """
    
    def __init__(
        self,
        config: Optional[AgentConfig] = None,
        llm_client: Optional[BaseLLMClient] = None,
        session: Optional[Session] = None,
    ):
        """
        Initialize the Agent.
        
        Args:
            config: Agent configuration
            llm_client: Optional LLM client (creates default if not provided)
            session: Optional session to use (creates new if not provided)
        """
        self.config = config or AgentConfig()
        self._llm_client = llm_client or LLMClient.from_config(self.config.llm_config)
        self._session = session or Session.create()
        
        # Initialize context manager
        self._context_manager = ContextManager(
            working_directory=self.config.working_directory or self._session.context.working_directory,
            enable_claude_md=self.config.enable_claude_md,
            max_context_tokens=self.config.max_context_tokens,
        )
        
        # Initialize tool registry
        self._tool_registry = ToolRegistry()
        
        # State
        self._status = AgentStatus.IDLE
        self._current_iteration = 0
        self._usage_stats = UsageStats()
        
        # Initialize context
        self._initialize_context()
    
    def _initialize_context(self) -> None:
        """Initialize the agent context."""
        context = self._context_manager.initialize()
        self._session.update_context(context)
    
    # -------------------------------------------------------------------------
    # Properties
    # -------------------------------------------------------------------------
    
    @property
    def status(self) -> AgentStatus:
        """Get the current agent status."""
        return self._status
    
    @property
    def session(self) -> Session:
        """Get the current session."""
        return self._session
    
    @property
    def tool_registry(self) -> ToolRegistry:
        """Get the tool registry."""
        return self._tool_registry
    
    @property
    def usage_stats(self) -> UsageStats:
        """Get usage statistics."""
        return self._usage_stats
    
    # -------------------------------------------------------------------------
    # Tool Registration
    # -------------------------------------------------------------------------
    
    def register_tool(self, tool: Tool) -> None:
        """
        Register a tool.
        
        Args:
            tool: Tool to register
        """
        self._tool_registry.register(tool)
    
    def register_tools(self, tools: List[Tool]) -> None:
        """
        Register multiple tools.
        
        Args:
            tools: List of tools to register
        """
        for tool in tools:
            self.register_tool(tool)
    
    def register_tool_function(
        self,
        func: Callable[..., Any],
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        """
        Register a function as a tool.
        
        Args:
            func: Function to register
            name: Optional tool name
            description: Optional description
        """
        self._tool_registry.register_function(func, name, description)
    
    # -------------------------------------------------------------------------
    # System Prompt
    # -------------------------------------------------------------------------
    
    def build_system_prompt(self) -> str:
        """
        Build the system prompt for the LLM.
        
        Returns:
            System prompt string
        """
        if self.config.system_prompt_template:
            return self.config.system_prompt_template
        
        parts = [
            "You are Claude Code, an AI coding assistant.",
            "You help users with programming tasks by thinking step by step",
            "and using available tools when needed.",
            "",
            "Guidelines:",
            "- Think through problems carefully before acting",
            "- Use tools when they can help accomplish tasks",
            "- Explain your reasoning when appropriate",
            "- If you need more information, ask the user",
            "- Be concise but thorough in your responses",
        ]
        
        # Add tool information
        tools = self._tool_registry.get_all_definitions()
        if tools:
            parts.extend([
                "",
                "Available Tools:",
            ])
            for tool in tools:
                parts.append(f"- {tool.name}: {tool.description}")
        
        # Add context
        context_text = self._session.context.to_text(max_tokens=2000)
        if context_text:
            parts.extend([
                "",
                "Context:",
                context_text,
            ])
        
        return "\n".join(parts)
    
    def get_context(self) -> Context:
        """
        Get the current context.
        
        Returns:
            Current context
        """
        return self._session.context
    
    # -------------------------------------------------------------------------
    # Main Loop
    # -------------------------------------------------------------------------
    
    async def run(self, user_input: str) -> AsyncIterator[AgentEvent]:
        """
        Run the agent with user input.
        
        This is the main entry point that implements the
        reasoning-action-observation loop.
        
        Args:
            user_input: User's input message
            
        Yields:
            AgentEvent objects representing the execution flow
        """
        # Reset state
        self._status = AgentStatus.RUNNING
        self._current_iteration = 0
        self._usage_stats = UsageStats(start_time=datetime_now())
        self._session.agent_status = AgentStatus.RUNNING
        
        # Add user message
        self._session.add_user_message(user_input)
        
        try:
            # Main loop
            while self._current_iteration < self.config.max_iterations:
                self._current_iteration += 1
                
                # Yield thinking event
                yield ThinkingEvent(
                    content=f"Iteration {self._current_iteration}: Processing...",
                    step=self._current_iteration,
                )
                
                # Get LLM response
                async for event in self._process_llm_turn():
                    yield event
                    
                    # Check if we got a complete event
                    if event.type == EventType.COMPLETE:
                        self._status = AgentStatus.COMPLETED
                        self._session.agent_status = AgentStatus.COMPLETED
                        self._usage_stats.end_time = datetime_now()
                        return
                    
                    # Check if we got an error event
                    if event.type == EventType.ERROR:
                        if not getattr(event, 'recoverable', True):
                            self._status = AgentStatus.ERROR
                            self._session.agent_status = AgentStatus.ERROR
                            self._usage_stats.end_time = datetime_now()
                            return
                
                # Check if we should continue
                if not self._should_continue():
                    break
            
            # Max iterations reached or loop ended
            yield CompleteEvent(
                summary="Task completed (max iterations reached or no more actions needed)",
            )
            self._status = AgentStatus.COMPLETED
            self._session.agent_status = AgentStatus.COMPLETED
        
        except Exception as e:
            self._status = AgentStatus.ERROR
            self._session.agent_status = AgentStatus.ERROR
            yield ErrorEvent(error=str(e), recoverable=False)
        
        finally:
            self._usage_stats.end_time = datetime_now()
    
    async def _process_llm_turn(self) -> AsyncIterator[AgentEvent]:
        """Process a single turn with the LLM."""
        # Prepare messages
        messages = self._session.get_messages()
        system_prompt, prepared_messages = self._context_manager.prepare_for_llm(messages)
        
        # Ensure system message is first
        if prepared_messages and prepared_messages[0].role.value != "system":
            prepared_messages.insert(0, Message.system(system_prompt))
        elif prepared_messages:
            prepared_messages[0] = Message.system(system_prompt)
        else:
            prepared_messages = [Message.system(system_prompt)]
        
        # Get available tools
        tools = self._tool_registry.get_all_definitions()
        
        # Stream LLM response
        accumulated_content = ""
        pending_tool_calls: List[ToolCall] = []
        
        if self.config.enable_streaming:
            async for llm_event in self._llm_client.stream_chat(prepared_messages, tools):
                if llm_event.type == "content":
                    accumulated_content += llm_event.content or ""
                    yield MessageEvent(
                        message=Message.assistant(llm_event.content),
                        is_delta=True,
                    )
                
                elif llm_event.type == "tool_call":
                    if llm_event.tool_call:
                        pending_tool_calls.append(llm_event.tool_call)
                        yield ToolCallEvent(tool_call=llm_event.tool_call)
                
                elif llm_event.type == "thinking":
                    yield ThinkingEvent(
                        content=llm_event.thinking or "",
                        step=self._current_iteration,
                    )
                
                elif llm_event.type == "done":
                    break
                
                elif llm_event.type == "error":
                    yield ErrorEvent(
                        error=llm_event.error or "Unknown LLM error",
                        recoverable=True,
                    )
                    return
        else:
            # Non-streaming
            response = await self._llm_client.chat(prepared_messages, tools)
            
            if response.content:
                accumulated_content = response.content
                yield MessageEvent(message=response, is_delta=False)
            
            if response.tool_calls:
                pending_tool_calls.extend(response.tool_calls)
                for tc in response.tool_calls:
                    yield ToolCallEvent(tool_call=tc)
        
        # Add assistant message to session
        if accumulated_content or pending_tool_calls:
            self._session.add_assistant_message(
                content=accumulated_content or None,
                tool_calls=pending_tool_calls if pending_tool_calls else None,
            )
        
        # Execute tool calls
        if pending_tool_calls:
            for tool_call in pending_tool_calls:
                result = await self.execute_tool(tool_call)
                yield ToolResultEvent(result=result)
                
                # Add tool result to session
                self._session.add_tool_result(
                    tool_call_id=result.tool_call_id,
                    content=result.content,
                )
        else:
            # No tool calls, task is complete
            yield CompleteEvent(
                final_message=Message.assistant(accumulated_content),
                summary="Task completed successfully",
            )
    
    def _should_continue(self) -> bool:
        """Check if the agent should continue iterating."""
        # Check if the last message was from the assistant without tool calls
        messages = self._session.get_messages()
        if not messages:
            return True
        
        last_message = messages[-1]
        
        # If last message is from assistant without tool calls, we're done
        if last_message.role.value == "assistant" and not last_message.tool_calls:
            return False
        
        # If last message is a tool result, we should continue
        if last_message.role.value == "tool":
            return True
        
        return True
    
    # -------------------------------------------------------------------------
    # Tool Execution
    # -------------------------------------------------------------------------
    
    async def execute_tool(self, tool_call: ToolCall) -> ToolResult:
        """
        Execute a tool call.
        
        Args:
            tool_call: Tool call to execute
            
        Returns:
            Tool execution result
        """
        start_time = time.time()
        
        # Find the tool
        tool = self._tool_registry.get(tool_call.name)
        
        if tool is None:
            execution_time = (time.time() - start_time) * 1000
            return ToolResult(
                tool_call_id=tool_call.id,
                status=ToolResultStatus.ERROR,
                content="",
                error_message=f"Tool '{tool_call.name}' not found",
                execution_time_ms=execution_time,
            )
        
        try:
            # Execute the tool
            result = await tool.execute(**tool_call.arguments)
            result.tool_call_id = tool_call.id
            result.execution_time_ms = (time.time() - start_time) * 1000
            
            # Update usage stats
            self._usage_stats.tool_calls += 1
            
            return result
        
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return ToolResult(
                tool_call_id=tool_call.id,
                status=ToolResultStatus.ERROR,
                content="",
                error_message=str(e),
                execution_time_ms=execution_time,
            )
    
    # -------------------------------------------------------------------------
    # Session Management
    # -------------------------------------------------------------------------
    
    def save_session(self, path: Optional[Path] = None) -> None:
        """
        Save the current session.
        
        Args:
            path: Optional path to save to (uses default if not provided)
        """
        if path:
            self._session.save(path)
        # Could also save to a default location
    
    def load_session(self, session: Session) -> None:
        """
        Load a session.
        
        Args:
            session: Session to load
        """
        self._session = session
        self._context_manager = ContextManager(
            working_directory=session.context.working_directory,
            enable_claude_md=self.config.enable_claude_md,
            max_context_tokens=self.config.max_context_tokens,
        )
    
    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------
    
    async def close(self) -> None:
        """Close the agent and cleanup resources."""
        await self._llm_client.close()
        self._status = AgentStatus.IDLE
    
    async def __aenter__(self) -> Agent:
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.close()


# Helper function to get current datetime
def datetime_now():
    from datetime import datetime
    return datetime.utcnow()


# =============================================================================
# Convenience Functions
# =============================================================================

async def run_agent(
    user_input: str,
    config: Optional[AgentConfig] = None,
    tools: Optional[List[Tool]] = None,
) -> List[AgentEvent]:
    """
    Convenience function to run an agent and collect all events.
    
    Args:
        user_input: User input
        config: Optional agent configuration
        tools: Optional list of tools to register
        
    Returns:
        List of all events
    """
    agent = Agent(config=config)
    
    if tools:
        agent.register_tools(tools)
    
    events = []
    async for event in agent.run(user_input):
        events.append(event)
    
    await agent.close()
    return events


async def quick_chat(
    user_input: str,
    system_prompt: Optional[str] = None,
    model: str = "claude-3-sonnet-20240229",
) -> str:
    """
    Quick chat without tools - just get a response.
    
    Args:
        user_input: User input
        system_prompt: Optional system prompt
        model: Model to use
        
    Returns:
        Assistant's response
    """
    config = AgentConfig(
        llm_config=LLMConfig(model=model),
        enable_streaming=False,
    )
    
    if system_prompt:
        config.system_prompt_template = system_prompt
    
    events = await run_agent(user_input, config)
    
    # Extract the final message content
    for event in reversed(events):
        if event.type == EventType.MESSAGE and hasattr(event, 'message'):
            return event.message.content or ""
        if event.type == EventType.COMPLETE and hasattr(event, 'summary'):
            return event.summary or ""
    
    return ""


__all__ = [
    "Agent",
    "ToolRegistry",
    "run_agent",
    "quick_chat",
]
