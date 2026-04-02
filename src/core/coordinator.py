"""
Claude Code Agent System - Multi-Agent Coordinator

This module provides multi-agent coordination functionality including:
- SubAgent spawning and management
- Result aggregation
- Task decomposition
- Parallel execution
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Type, Union

from .types import (
    AgentConfig,
    AgentEvent,
    AgentStatus,
    CompleteEvent,
    Context,
    ContextItem,
    ErrorEvent,
    EventType,
    LLMConfig,
    Message,
    MessageEvent,
    SubAgentConfig,
    SubAgentResult,
    ThinkingEvent,
    Tool,
    ToolDefinition,
    UsageStats,
)
from .agent import Agent, ToolRegistry
from .session import Session


# =============================================================================
# SubAgent
# =============================================================================

class SubAgent:
    """
    A subagent spawned by the coordinator for a specific task.
    
    SubAgents are lightweight agents that work on a portion of a larger task
    and report back to the coordinator.
    """
    
    def __init__(
        self,
        subagent_id: str,
        task: str,
        config: SubAgentConfig,
        parent_tools: Optional[List[ToolDefinition]] = None,
    ):
        """
        Initialize a subagent.
        
        Args:
            subagent_id: Unique ID for this subagent
            task: The task description
            config: SubAgent configuration
            parent_tools: Tools inherited from parent
        """
        self.subagent_id = subagent_id
        self.task = task
        self.config = config
        self.parent_tools = parent_tools or []
        
        # Create the underlying agent
        agent_config = AgentConfig(
            name=f"SubAgent-{subagent_id[:8]}",
            llm_config=config.llm_config or LLMConfig(),
            max_iterations=config.max_iterations,
            enable_subagents=False,  # Subagents don't spawn more subagents
        )
        
        # Create session with inherited context
        session = Session.create(
            session_id=subagent_id,
            context=config.parent_context,
        )
        
        self._agent = Agent(config=agent_config, session=session)
        
        # Register custom tools
        for tool_def in config.custom_tools:
            # Note: In a real implementation, you'd need actual tool implementations
            pass
        
        # State
        self._status = AgentStatus.IDLE
        self._result: Optional[SubAgentResult] = None
        self._events: List[AgentEvent] = []
        self._start_time: Optional[datetime] = None
        self._end_time: Optional[datetime] = None
    
    @property
    def status(self) -> AgentStatus:
        """Get the subagent status."""
        return self._status
    
    @property
    def result(self) -> Optional[SubAgentResult]:
        """Get the execution result."""
        return self._result
    
    @property
    def events(self) -> List[AgentEvent]:
        """Get all events from execution."""
        return list(self._events)
    
    @property
    def execution_time_ms(self) -> Optional[float]:
        """Get execution time in milliseconds."""
        if self._start_time and self._end_time:
            return (self._end_time - self._start_time).total_seconds() * 1000
        return None
    
    async def run(self) -> SubAgentResult:
        """
        Execute the subagent task.
        
        Returns:
            SubAgentResult with the execution outcome
        """
        self._status = AgentStatus.RUNNING
        self._start_time = datetime.utcnow()
        self._events = []
        
        try:
            # Run the agent
            async for event in self._agent.run(self.task):
                self._events.append(event)
            
            # Extract result from events
            final_content = ""
            for event in reversed(self._events):
                if event.type == EventType.MESSAGE and hasattr(event, 'message'):
                    msg = event.message
                    if msg.content:
                        final_content = msg.content
                        break
                elif event.type == EventType.COMPLETE and hasattr(event, 'summary'):
                    final_content = event.summary or ""
                    break
            
            self._status = AgentStatus.COMPLETED
            self._end_time = datetime.utcnow()
            
            self._result = SubAgentResult(
                subagent_id=self.subagent_id,
                status=AgentStatus.COMPLETED,
                result=final_content,
                messages=self._agent.session.get_messages(),
                execution_time_ms=self.execution_time_ms,
            )
        
        except Exception as e:
            self._status = AgentStatus.ERROR
            self._end_time = datetime.utcnow()
            
            self._result = SubAgentResult(
                subagent_id=self.subagent_id,
                status=AgentStatus.ERROR,
                error=str(e),
                messages=self._agent.session.get_messages(),
                execution_time_ms=self.execution_time_ms,
            )
        
        return self._result
    
    async def close(self) -> None:
        """Cleanup resources."""
        await self._agent.close()


# =============================================================================
# Task Decomposer
# =============================================================================

class TaskDecomposer:
    """
    Decomposes complex tasks into subtasks for parallel execution.
    
    Uses an LLM to analyze tasks and break them down appropriately.
    """
    
    def __init__(self, llm_config: Optional[LLMConfig] = None):
        """
        Initialize the task decomposer.
        
        Args:
            llm_config: LLM configuration for decomposition
        """
        self.llm_config = llm_config or LLMConfig()
    
    async def decompose(
        self,
        task: str,
        context: Context,
        max_subtasks: int = 5,
    ) -> List[str]:
        """
        Decompose a task into subtasks.
        
        Args:
            task: The main task to decompose
            context: Context for decomposition
            max_subtasks: Maximum number of subtasks to create
            
        Returns:
            List of subtask descriptions
        """
        from .llm_client import LLMClient
        
        # Build decomposition prompt
        prompt = f"""You are a task decomposition expert. Your job is to break down complex tasks into smaller, independent subtasks that can be executed in parallel.

Main Task: {task}

Context:
{context.to_text(max_tokens=1000)}

Instructions:
1. Analyze the task and identify distinct, independent components
2. Break down into {max_subtasks} or fewer subtasks
3. Each subtask should be self-contained and executable independently
4. Subtasks should cover all aspects of the main task

Respond with a JSON array of subtask descriptions. Each description should be clear and actionable.

Example output:
[
  "Subtask 1: Analyze the requirements",
  "Subtask 2: Design the solution",
  "Subtask 3: Implement the core logic"
]
"""
        
        messages = [
            Message.system("You are a task decomposition expert."),
            Message.user(prompt),
        ]
        
        try:
            client = LLMClient.from_config(self.llm_config)
            response = await client.chat(messages)
            await client.close()
            
            # Parse the response
            content = response.content or "[]"
            
            # Try to extract JSON array
            import json
            import re
            
            # Find JSON array in response
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            if match:
                subtasks = json.loads(match.group())
                if isinstance(subtasks, list):
                    return subtasks[:max_subtasks]
            
            # Fallback: split by newlines
            return [line.strip("- ") for line in content.split("\n") if line.strip().startswith("-")][:max_subtasks]
        
        except Exception:
            # If decomposition fails, return the task as a single subtask
            return [task]


# =============================================================================
# Result Aggregator
# =============================================================================

class ResultAggregator:
    """
    Aggregates results from multiple subagents into a coherent response.
    """
    
    def __init__(self, llm_config: Optional[LLMConfig] = None):
        """
        Initialize the result aggregator.
        
        Args:
            llm_config: LLM configuration for aggregation
        """
        self.llm_config = llm_config or LLMConfig()
    
    async def aggregate(
        self,
        original_task: str,
        results: List[SubAgentResult],
        context: Context,
    ) -> str:
        """
        Aggregate subagent results into a final response.
        
        Args:
            original_task: The original task
            results: Results from subagents
            context: Context for aggregation
            
        Returns:
            Aggregated result string
        """
        from .llm_client import LLMClient
        
        # Build results summary
        results_summary = []
        for i, result in enumerate(results, 1):
            status = "✓" if result.status == AgentStatus.COMPLETED else "✗"
            content = result.result or result.error or "No output"
            results_summary.append(
                f"## SubAgent {i} {status}\n\n{content}\n"
            )
        
        prompt = f"""You are a result aggregation expert. Synthesize the outputs from multiple subagents into a coherent, comprehensive response.

Original Task: {original_task}

Context:
{context.to_text(max_tokens=500)}

SubAgent Results:

{chr(10).join(results_summary)}

Instructions:
1. Synthesize the subagent outputs into a unified response
2. Resolve any conflicts or contradictions
3. Present the information in a clear, organized manner
4. Ensure all aspects of the original task are addressed

Provide your aggregated response:
"""
        
        messages = [
            Message.system("You are a result aggregation expert."),
            Message.user(prompt),
        ]
        
        try:
            client = LLMClient.from_config(self.llm_config)
            response = await client.chat(messages)
            await client.close()
            
            return response.content or "Aggregation failed"
        
        except Exception as e:
            # Fallback: simple concatenation
            return f"## Combined Results\n\n" + "\n\n".join(
                f"### SubAgent {i+1}\n{r.result or r.error or 'No output'}"
                for i, r in enumerate(results)
            )


# =============================================================================
# Coordinator
# =============================================================================

class Coordinator:
    """
    Coordinates multiple subagents for parallel task execution.
    
    The Coordinator:
    1. Decomposes complex tasks into subtasks
    2. Spawns subagents for each subtask
    3. Manages parallel execution
    4. Aggregates results
    
    Example:
        coordinator = Coordinator()
        
        # Spawn subagents
        subagent1 = await coordinator.spawn_subagent("Task 1", context)
        subagent2 = await coordinator.spawn_subagent("Task 2", context)
        
        # Run in parallel
        results = await coordinator.run_parallel([subagent1, subagent2])
        
        # Aggregate results
        final = await coordinator.aggregate_results(results)
    """
    
    def __init__(
        self,
        llm_config: Optional[LLMConfig] = None,
        max_subagents: int = 5,
        enable_decomposition: bool = True,
    ):
        """
        Initialize the coordinator.
        
        Args:
            llm_config: LLM configuration for decomposition/aggregation
            max_subagents: Maximum number of subagents to spawn
            enable_decomposition: Whether to enable automatic task decomposition
        """
        self.llm_config = llm_config or LLMConfig()
        self.max_subagents = max_subagents
        self.enable_decomposition = enable_decomposition
        
        self._decomposer = TaskDecomposer(llm_config)
        self._aggregator = ResultAggregator(llm_config)
        
        self._subagents: Dict[str, SubAgent] = {}
        self._parent_tools: List[ToolDefinition] = []
    
    def set_parent_tools(self, tools: List[ToolDefinition]) -> None:
        """
        Set tools that subagents should inherit.
        
        Args:
            tools: List of tool definitions
        """
        self._parent_tools = tools
    
    async def spawn_subagent(
        self,
        task: str,
        context: Context,
        config: Optional[SubAgentConfig] = None,
    ) -> SubAgent:
        """
        Spawn a new subagent for a task.
        
        Args:
            task: Task description for the subagent
            context: Context to pass to the subagent
            config: Optional subagent configuration
            
        Returns:
            The spawned SubAgent
        """
        subagent_id = f"subagent-{uuid.uuid4().hex[:8]}"
        
        subagent_config = config or SubAgentConfig(
            task=task,
            parent_context=context,
            llm_config=self.llm_config,
        )
        
        subagent = SubAgent(
            subagent_id=subagent_id,
            task=task,
            config=subagent_config,
            parent_tools=self._parent_tools if subagent_config.inherit_tools else [],
        )
        
        self._subagents[subagent_id] = subagent
        
        return subagent
    
    async def spawn_subagents(
        self,
        tasks: List[str],
        context: Context,
        config: Optional[SubAgentConfig] = None,
    ) -> List[SubAgent]:
        """
        Spawn multiple subagents for parallel tasks.
        
        Args:
            tasks: List of task descriptions
            context: Context to pass to all subagents
            config: Optional subagent configuration
            
        Returns:
            List of spawned SubAgents
        """
        subagents = []
        for task in tasks[:self.max_subagents]:
            subagent = await self.spawn_subagent(task, context, config)
            subagents.append(subagent)
        return subagents
    
    async def decompose_and_spawn(
        self,
        task: str,
        context: Context,
        max_subagents: Optional[int] = None,
    ) -> List[SubAgent]:
        """
        Decompose a task and spawn subagents for each subtask.
        
        Args:
            task: Main task to decompose
            context: Context for decomposition and subagents
            max_subagents: Override max subagents limit
            
        Returns:
            List of spawned SubAgents
        """
        if not self.enable_decomposition:
            # Don't decompose, just spawn one subagent
            return [await self.spawn_subagent(task, context)]
        
        max_subtasks = max_subagents or self.max_subagents
        
        # Decompose the task
        subtasks = await self._decomposer.decompose(task, context, max_subtasks)
        
        # Spawn subagents for each subtask
        return await self.spawn_subagents(subtasks, context)
    
    async def run_parallel(
        self,
        subagents: List[SubAgent],
        return_when: str = "ALL_COMPLETED",
    ) -> List[SubAgentResult]:
        """
        Run multiple subagents in parallel.
        
        Args:
            subagents: List of subagents to run
            return_when: When to return - "ALL_COMPLETED" or "FIRST_COMPLETED"
            
        Returns:
            List of results (may be partial if return_when is "FIRST_COMPLETED")
        """
        if not subagents:
            return []
        
        # Create tasks
        tasks = [asyncio.create_task(agent.run()) for agent in subagents]
        
        if return_when == "FIRST_COMPLETED":
            # Wait for first to complete
            done, pending = await asyncio.wait(
                tasks,
                return_when=asyncio.FIRST_COMPLETED,
            )
            
            # Cancel pending tasks
            for task in pending:
                task.cancel()
            
            # Return results from completed tasks
            results = []
            for task in done:
                try:
                    results.append(task.result())
                except Exception as e:
                    # Create error result
                    results.append(
                        SubAgentResult(
                            subagent_id="unknown",
                            status=AgentStatus.ERROR,
                            error=str(e),
                        )
                    )
            return results
        
        else:  # ALL_COMPLETED
            # Wait for all to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Convert exceptions to error results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append(
                        SubAgentResult(
                            subagent_id=subagents[i].subagent_id,
                            status=AgentStatus.ERROR,
                            error=str(result),
                        )
                    )
                else:
                    processed_results.append(result)
            
            return processed_results
    
    async def aggregate_results(
        self,
        subagents: List[SubAgent],
        original_task: str = "",
        context: Optional[Context] = None,
    ) -> str:
        """
        Aggregate results from multiple subagents.
        
        Args:
            subagents: List of subagents to aggregate results from
            original_task: The original task description
            context: Context for aggregation
            
        Returns:
            Aggregated result string
        """
        # Collect results
        results = []
        for subagent in subagents:
            if subagent.result:
                results.append(subagent.result)
        
        if not results:
            return "No results to aggregate"
        
        if len(results) == 1:
            return results[0].result or results[0].error or "No output"
        
        # Use aggregator for multiple results
        return await self._aggregator.aggregate(
            original_task=original_task,
            results=results,
            context=context or Context(),
        )
    
    async def execute(
        self,
        task: str,
        context: Context,
        decompose: bool = True,
    ) -> str:
        """
        Execute a task using subagents.
        
        This is a high-level method that handles the full lifecycle:
        decomposition -> spawning -> execution -> aggregation.
        
        Args:
            task: Task to execute
            context: Context for execution
            decompose: Whether to decompose the task
            
        Returns:
            Final aggregated result
        """
        # Spawn subagents
        if decompose and self.enable_decomposition:
            subagents = await self.decompose_and_spawn(task, context)
        else:
            subagents = [await self.spawn_subagent(task, context)]
        
        # Run in parallel
        await self.run_parallel(subagents)
        
        # Aggregate results
        return await self.aggregate_results(subagents, task, context)
    
    async def stream_execute(
        self,
        task: str,
        context: Context,
        decompose: bool = True,
    ) -> AsyncIterator[AgentEvent]:
        """
        Execute a task with streaming events.
        
        Args:
            task: Task to execute
            context: Context for execution
            decompose: Whether to decompose the task
            
        Yields:
            AgentEvent objects
        """
        # Spawn subagents
        if decompose and self.enable_decomposition:
            subagents = await self.decompose_and_spawn(task, context)
            yield ThinkingEvent(
                content=f"Decomposed task into {len(subagents)} subtasks",
                step=0,
            )
        else:
            subagents = [await self.spawn_subagent(task, context)]
        
        # Run in parallel and yield events
        tasks = [asyncio.create_task(self._run_subagent_with_events(sa)) for sa in subagents]
        
        # Collect results
        results = await asyncio.gather(*tasks)
        
        # Aggregate
        yield ThinkingEvent(content="Aggregating results...", step=999)
        
        final_result = await self.aggregate_results(subagents, task, context)
        
        yield CompleteEvent(summary=final_result)
    
    async def _run_subagent_with_events(self, subagent: SubAgent) -> SubAgentResult:
        """Run a subagent and emit events."""
        # Note: In a real implementation, you'd want to yield events from here
        # For now, we just run and return
        return await subagent.run()
    
    def get_subagent(self, subagent_id: str) -> Optional[SubAgent]:
        """Get a subagent by ID."""
        return self._subagents.get(subagent_id)
    
    def list_subagents(self) -> List[str]:
        """List all subagent IDs."""
        return list(self._subagents.keys())
    
    async def cleanup(self) -> None:
        """Cleanup all subagent resources."""
        for subagent in self._subagents.values():
            await subagent.close()
        self._subagents.clear()
    
    async def __aenter__(self) -> Coordinator:
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.cleanup()


# =============================================================================
# Convenience Functions
# =============================================================================

async def parallel_execute(
    tasks: List[str],
    context: Optional[Context] = None,
    llm_config: Optional[LLMConfig] = None,
) -> List[str]:
    """
    Execute multiple tasks in parallel and return results.
    
    Args:
        tasks: List of tasks to execute
        context: Optional context
        llm_config: Optional LLM configuration
        
    Returns:
        List of results
    """
    coordinator = Coordinator(llm_config=llm_config)
    
    ctx = context or Context()
    subagents = await coordinator.spawn_subagents(tasks, ctx)
    results = await coordinator.run_parallel(subagents)
    
    await coordinator.cleanup()
    
    return [
        r.result or r.error or "No output"
        for r in results
    ]


async def coordinated_execute(
    task: str,
    context: Optional[Context] = None,
    llm_config: Optional[LLMConfig] = None,
    decompose: bool = True,
) -> str:
    """
    Execute a task with automatic decomposition and aggregation.
    
    Args:
        task: Task to execute
        context: Optional context
        llm_config: Optional LLM configuration
        decompose: Whether to decompose the task
        
    Returns:
        Final result
    """
    async with Coordinator(llm_config=llm_config) as coordinator:
        return await coordinator.execute(task, context or Context(), decompose)


__all__ = [
    "Coordinator",
    "SubAgent",
    "TaskDecomposer",
    "ResultAggregator",
    "parallel_execute",
    "coordinated_execute",
]
