"""
Coordinator Mode - Parallel Agent Orchestration

A system for decomposing tasks, dispatching parallel sub-agents,
aggregating results, and resolving conflicts.
"""

import asyncio
import uuid
from typing import Dict, List, Optional, Any, Callable, Coroutine
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
import logging


logger = logging.getLogger(__name__)


class SubTaskStatus(Enum):
    """Status of a sub-task."""
    PENDING = auto()
    ASSIGNED = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()


class TaskPriority(Enum):
    """Task priority levels."""
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


@dataclass
class SubTask:
    """A sub-task for parallel execution."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "unnamed"
    description: str = ""
    handler: Optional[Callable] = None
    args: tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    status: SubTaskStatus = SubTaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    agent_id: Optional[str] = None
    priority: TaskPriority = TaskPriority.NORMAL
    timeout: float = 300.0
    retry_count: int = 0
    max_retries: int = 2


@dataclass
class TaskResult:
    """Result of task execution."""
    task_id: str
    success: bool
    result: Any = None
    error: Optional[str] = None
    sub_results: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    conflicts: List[Dict] = field(default_factory=list)


@dataclass
class Agent:
    """A sub-agent for task execution."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "unnamed"
    capabilities: List[str] = field(default_factory=list)
    current_task: Optional[str] = None
    total_tasks_completed: int = 0
    is_active: bool = True
    handler: Optional[Callable] = None


class TaskDecomposer:
    """
    Decomposes large tasks into parallelizable sub-tasks.
    """
    
    def __init__(self):
        self._strategies: Dict[str, Callable] = {}
        
    def register_strategy(self, task_type: str, strategy: Callable) -> None:
        """Register a decomposition strategy."""
        self._strategies[task_type] = strategy
        
    def decompose(
        self,
        task_description: str,
        task_type: str,
        context: Optional[Dict] = None
    ) -> List[SubTask]:
        """
        Decompose a task into sub-tasks.
        
        Args:
            task_description: Description of the task
            task_type: Type of task for strategy selection
            context: Additional context
            
        Returns:
            List of SubTasks
        """
        if task_type in self._strategies:
            return self._strategies[task_type](task_description, context)
            
        # Default decomposition - single task
        return [SubTask(
            name="main_task",
            description=task_description,
            kwargs={"description": task_description, "context": context}
        )]
        
    def decompose_code_review(
        self,
        files: List[str],
        context: Optional[Dict] = None
    ) -> List[SubTask]:
        """Decompose code review into file reviews."""
        return [
            SubTask(
                name=f"review_{file}",
                description=f"Review {file}",
                kwargs={"file": file, "context": context},
                priority=TaskPriority.NORMAL
            )
            for file in files
        ]
        
    def decompose_refactor(
        self,
        target: str,
        changes: List[Dict],
        context: Optional[Dict] = None
    ) -> List[SubTask]:
        """Decompose refactoring into change groups."""
        # Group changes by file
        file_changes: Dict[str, List[Dict]] = {}
        for change in changes:
            file = change.get('file', 'unknown')
            if file not in file_changes:
                file_changes[file] = []
            file_changes[file].append(change)
            
        return [
            SubTask(
                name=f"refactor_{file}",
                description=f"Apply refactoring to {file}",
                kwargs={"file": file, "changes": changes, "context": context},
                dependencies=[],  # Could add dependencies between files
                priority=TaskPriority.HIGH
            )
            for file, changes in file_changes.items()
        ]


class ConflictResolver:
    """
    Resolves conflicts between sub-agent results.
    """
    
    def __init__(self):
        self._resolvers: Dict[str, Callable] = {}
        
    def register_resolver(self, conflict_type: str, resolver: Callable) -> None:
        """Register a conflict resolver."""
        self._resolvers[conflict_type] = resolver
        
    def resolve(
        self,
        results: List[TaskResult],
        conflict_type: str = "default"
    ) -> TaskResult:
        """
        Resolve conflicts in results.
        
        Args:
            results: List of sub-task results
            conflict_type: Type of conflict resolution
            
        Returns:
            Merged TaskResult
        """
        if conflict_type in self._resolvers:
            return self._resolvers[conflict_type](results)
            
        return self._default_resolve(results)
        
    def _default_resolve(self, results: List[TaskResult]) -> TaskResult:
        """Default conflict resolution - merge results."""
        merged_results = {}
        conflicts = []
        all_success = all(r.success for r in results)
        
        for result in results:
            merged_results.update(result.sub_results)
            conflicts.extend(result.conflicts)
            
        return TaskResult(
            task_id="merged",
            success=all_success,
            result=merged_results,
            sub_results=merged_results,
            conflicts=conflicts
        )
        
    def resolve_code_changes(self, results: List[TaskResult]) -> TaskResult:
        """Resolve code change conflicts."""
        merged_changes = {}
        conflicts = []
        
        for result in results:
            for file_path, changes in result.sub_results.items():
                if file_path in merged_changes:
                    # Check for overlapping changes
                    overlap = self._find_overlap(
                        merged_changes[file_path],
                        changes
                    )
                    if overlap:
                        conflicts.append({
                            'file': file_path,
                            'type': 'overlap',
                            'details': overlap
                        })
                    else:
                        # Merge non-overlapping changes
                        merged_changes[file_path].extend(changes)
                else:
                    merged_changes[file_path] = changes
                    
        return TaskResult(
            task_id="code_merge",
            success=len(conflicts) == 0,
            result=merged_changes,
            sub_results=merged_changes,
            conflicts=conflicts
        )
        
    def _find_overlap(self, changes1: List, changes2: List) -> Optional[List]:
        """Find overlapping changes."""
        overlaps = []
        for c1 in changes1:
            for c2 in changes2:
                if self._changes_overlap(c1, c2):
                    overlaps.append((c1, c2))
        return overlaps if overlaps else None
        
    def _changes_overlap(self, change1: Dict, change2: Dict) -> bool:
        """Check if two changes overlap."""
        # Simple line-based overlap check
        lines1 = set(range(
            change1.get('start_line', 0),
            change1.get('end_line', change1.get('start_line', 0)) + 1
        ))
        lines2 = set(range(
            change2.get('start_line', 0),
            change2.get('end_line', change2.get('start_line', 0)) + 1
        ))
        return bool(lines1 & lines2)


class ResultAggregator:
    """
    Aggregates results from multiple sub-agents.
    """
    
    def __init__(self):
        self._aggregators: Dict[str, Callable] = {}
        
    def register_aggregator(self, result_type: str, aggregator: Callable) -> None:
        """Register a result aggregator."""
        self._aggregators[result_type] = aggregator
        
    def aggregate(
        self,
        results: List[TaskResult],
        result_type: str = "default"
    ) -> Any:
        """
        Aggregate multiple results.
        
        Args:
            results: List of sub-task results
            result_type: Type of aggregation
            
        Returns:
            Aggregated result
        """
        if result_type in self._aggregators:
            return self._aggregators[result_type](results)
            
        return self._default_aggregate(results)
        
    def _default_aggregate(self, results: List[TaskResult]) -> Dict:
        """Default aggregation - collect all results."""
        return {
            "results": [r.result for r in results],
            "success_count": sum(1 for r in results if r.success),
            "failure_count": sum(1 for r in results if not r.success),
            "total_time": sum(r.execution_time for r in results),
        }
        
    def aggregate_votes(self, results: List[TaskResult]) -> Dict:
        """Aggregate by voting."""
        votes = {}
        for result in results:
            key = str(result.result)
            votes[key] = votes.get(key, 0) + 1
            
        # Find majority
        if votes:
            winner = max(votes.items(), key=lambda x: x[1])
            return {
                "winner": winner[0],
                "votes": winner[1],
                "total": len(results),
                "confidence": winner[1] / len(results)
            }
        return {"winner": None, "votes": 0, "total": 0, "confidence": 0}
        
    def aggregate_sum(self, results: List[TaskResult]) -> float:
        """Aggregate by summing numeric results."""
        return sum(
            float(r.result) for r in results
            if r.success and isinstance(r.result, (int, float))
        )


class CoordinatorMode:
    """
    Main coordinator for parallel agent orchestration.
    
    Features:
    - Task decomposition
    - Parallel sub-agent dispatch
    - Result aggregation
    - Conflict resolution
    """
    
    def __init__(self, max_parallel: int = 5):
        self.max_parallel = max_parallel
        self.decomposer = TaskDecomposer()
        self.conflict_resolver = ConflictResolver()
        self.aggregator = ResultAggregator()
        
        self._agents: Dict[str, Agent] = {}
        self._tasks: Dict[str, SubTask] = {}
        self._results: Dict[str, TaskResult] = {}
        self._semaphore = asyncio.Semaphore(max_parallel)
        
    def register_agent(self, agent: Agent) -> None:
        """Register a sub-agent."""
        self._agents[agent.id] = agent
        logger.info(f"Registered agent: {agent.name} ({agent.id})")
        
    def create_agent(
        self,
        name: str,
        handler: Callable,
        capabilities: Optional[List[str]] = None
    ) -> Agent:
        """Create and register a new agent."""
        agent = Agent(
            name=name,
            handler=handler,
            capabilities=capabilities or []
        )
        self.register_agent(agent)
        return agent
        
    async def execute_task(
        self,
        description: str,
        handler: Callable,
        task_type: str = "default",
        decompose: bool = True,
        context: Optional[Dict] = None
    ) -> TaskResult:
        """
        Execute a task, optionally decomposing it.
        
        Args:
            description: Task description
            handler: Task handler function
            task_type: Type for decomposition strategy
            decompose: Whether to decompose the task
            context: Additional context
            
        Returns:
            TaskResult
        """
        start_time = datetime.now()
        
        if decompose:
            # Decompose into sub-tasks
            sub_tasks = self.decomposer.decompose(description, task_type, context)
        else:
            # Single task
            sub_tasks = [SubTask(
                name="main",
                description=description,
                handler=handler,
                kwargs=context or {}
            )]
            
        # Execute sub-tasks in parallel
        results = await self._execute_parallel(sub_tasks)
        
        # Aggregate results
        aggregated = self.aggregator.aggregate(results)
        
        # Resolve any conflicts
        resolved = self.conflict_resolver.resolve(results)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return TaskResult(
            task_id=str(uuid.uuid4()),
            success=all(r.success for r in results),
            result=aggregated,
            sub_results={r.task_id: r.result for r in results},
            execution_time=execution_time,
            conflicts=resolved.conflicts
        )
        
    async def _execute_parallel(
        self,
        tasks: List[SubTask]
    ) -> List[TaskResult]:
        """Execute tasks in parallel with dependency handling."""
        # Build dependency graph
        pending = set(t.id for t in tasks)
        completed = set()
        results = {}
        task_map = {t.id: t for t in tasks}
        
        async def execute_with_deps(task: SubTask) -> TaskResult:
            """Execute task after dependencies complete."""
            # Wait for dependencies
            for dep_id in task.dependencies:
                while dep_id not in completed:
                    await asyncio.sleep(0.1)
                    
            # Execute task
            async with self._semaphore:
                return await self._execute_single(task)
                
        # Create execution coroutines
        coros = [execute_with_deps(t) for t in tasks]
        
        # Execute all
        task_results = await asyncio.gather(*coros, return_exceptions=True)
        
        # Convert exceptions to failed results
        processed_results = []
        for task, result in zip(tasks, task_results):
            if isinstance(result, Exception):
                processed_results.append(TaskResult(
                    task_id=task.id,
                    success=False,
                    error=str(result)
                ))
            else:
                processed_results.append(result)
                completed.add(task.id)
                results[task.id] = result
                
        return processed_results
        
    async def _execute_single(self, task: SubTask) -> TaskResult:
        """Execute a single sub-task."""
        task.status = SubTaskStatus.RUNNING
        task.started_at = datetime.now()
        
        handler = task.handler
        if not handler:
            # Find suitable agent
            agent = self._find_agent_for_task(task)
            if agent:
                handler = agent.handler
                task.agent_id = agent.id
                agent.current_task = task.id
                
        if not handler:
            task.status = SubTaskStatus.FAILED
            task.error = "No handler available"
            return TaskResult(
                task_id=task.id,
                success=False,
                error="No handler available"
            )
            
        try:
            # Execute with timeout
            if asyncio.iscoroutinefunction(handler):
                result = await asyncio.wait_for(
                    handler(*task.args, **task.kwargs),
                    timeout=task.timeout
                )
            else:
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, handler, *task.args, **task.kwargs),
                    timeout=task.timeout
                )
                
            task.status = SubTaskStatus.COMPLETED
            task.result = result
            task.completed_at = datetime.now()
            
            # Update agent stats
            if task.agent_id:
                agent = self._agents.get(task.agent_id)
                if agent:
                    agent.total_tasks_completed += 1
                    agent.current_task = None
                    
            execution_time = (
                task.completed_at - task.started_at
            ).total_seconds()
            
            return TaskResult(
                task_id=task.id,
                success=True,
                result=result,
                execution_time=execution_time
            )
            
        except asyncio.TimeoutError:
            task.status = SubTaskStatus.FAILED
            task.error = "Task timed out"
            
            # Retry if possible
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                return await self._execute_single(task)
                
            return TaskResult(
                task_id=task.id,
                success=False,
                error="Task timed out"
            )
            
        except Exception as e:
            task.status = SubTaskStatus.FAILED
            task.error = str(e)
            
            # Retry if possible
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                return await self._execute_single(task)
                
            return TaskResult(
                task_id=task.id,
                success=False,
                error=str(e)
            )
            
    def _find_agent_for_task(self, task: SubTask) -> Optional[Agent]:
        """Find a suitable agent for the task."""
        available = [
            a for a in self._agents.values()
            if a.is_active and a.current_task is None
        ]
        
        if not available:
            return None
            
        # Score agents by capability match
        def score_agent(agent: Agent) -> int:
            score = 0
            # Prefer agents with matching capabilities
            # This is simplified - could be more sophisticated
            return score
            
        available.sort(key=score_agent, reverse=True)
        return available[0]
        
    def get_stats(self) -> Dict[str, Any]:
        """Get coordinator statistics."""
        return {
            "agents": {
                "total": len(self._agents),
                "active": sum(1 for a in self._agents.values() if a.is_active),
                "busy": sum(1 for a in self._agents.values() if a.current_task),
            },
            "tasks": {
                "total": len(self._tasks),
                "completed": sum(
                    1 for t in self._tasks.values()
                    if t.status == SubTaskStatus.COMPLETED
                ),
                "failed": sum(
                    1 for t in self._tasks.values()
                    if t.status == SubTaskStatus.FAILED
                ),
            },
            "max_parallel": self.max_parallel,
        }
