"""
Task Queue - Priority-based task queue with persistence support.
"""

import asyncio
import uuid
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum, auto
import heapq
import json


class TaskPriority(Enum):
    """Task priority levels."""
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


class TaskStatus(Enum):
    """Task execution status."""
    PENDING = auto()
    QUEUED = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()
    TIMEOUT = auto()


@dataclass
class Task:
    """Represents an executable task."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "unnamed"
    handler: Callable = field(default=lambda: None)
    args: tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if isinstance(self.started_at, str):
            self.started_at = datetime.fromisoformat(self.started_at)
        if isinstance(self.completed_at, str):
            self.completed_at = datetime.fromisoformat(self.completed_at)


@dataclass(order=True)
class PrioritizedTask:
    """Wrapper for priority queue ordering."""
    priority: int
    sequence: int
    task: Task = field(compare=False)
    
    _counter = 0
    
    def __init__(self, priority: int, task: Task):
        self.priority = priority
        self.sequence = PrioritizedTask._counter
        PrioritizedTask._counter += 1
        self.task = task


class TaskQueue:
    """
    Priority-based task queue with async support.
    
    Features:
    - Priority ordering (critical, high, normal, low, background)
    - FIFO within same priority
    - Status tracking
    - Persistence support
    """
    
    def __init__(self):
        self._queue: List[PrioritizedTask] = []
        self._tasks: Dict[str, Task] = {}
        self._status: Dict[str, TaskStatus] = {}
        self._lock = asyncio.Lock()
        self._not_empty = asyncio.Condition(self._lock)
        self._sequence = 0
        
    async def enqueue(
        self,
        task: Task,
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """Add a task to the queue."""
        async with self._lock:
            self._tasks[task.id] = task
            self._status[task.id] = TaskStatus.QUEUED
            
            prioritized = PrioritizedTask(priority.value, task)
            heapq.heappush(self._queue, prioritized)
            
            self._not_empty.notify()
            return task.id
            
    async def dequeue(self, timeout: Optional[float] = None) -> Optional[Task]:
        """Remove and return the highest priority task."""
        async with self._not_empty:
            if not self._queue:
                try:
                    await asyncio.wait_for(
                        self._not_empty.wait(),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    return None
                    
            if not self._queue:
                return None
                
            prioritized = heapq.heappop(self._queue)
            task = prioritized.task
            task.started_at = datetime.now()
            self._status[task.id] = TaskStatus.RUNNING
            
            return task
            
    async def update_status(self, task_id: str, status: TaskStatus) -> None:
        """Update task status."""
        async with self._lock:
            self._status[task_id] = status
            
    async def complete(self, task_id: str, result: Any) -> None:
        """Mark a task as completed."""
        async with self._lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]
                task.completed_at = datetime.now()
                task.result = result
                self._status[task_id] = TaskStatus.COMPLETED
                
    async def fail(self, task_id: str, error: str) -> None:
        """Mark a task as failed."""
        async with self._lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]
                task.error = error
                
                # Retry logic
                if task.retry_count < task.max_retries:
                    task.retry_count += 1
                    task.completed_at = None
                    self._status[task_id] = TaskStatus.PENDING
                    
                    # Re-queue with same priority
                    prioritized = PrioritizedTask(
                        TaskPriority.NORMAL.value,
                        task
                    )
                    heapq.heappush(self._queue, prioritized)
                    self._not_empty.notify()
                else:
                    task.completed_at = datetime.now()
                    self._status[task_id] = TaskStatus.FAILED
                    
    async def cancel(self, task_id: str) -> bool:
        """Cancel a pending task."""
        async with self._lock:
            if task_id not in self._tasks:
                return False
                
            if self._status.get(task_id) != TaskStatus.QUEUED:
                return False
                
            # Remove from queue
            self._queue = [
                pt for pt in self._queue if pt.task.id != task_id
            ]
            heapq.heapify(self._queue)
            
            self._status[task_id] = TaskStatus.CANCELLED
            return True
            
    async def get_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get task status."""
        async with self._lock:
            return self._status.get(task_id)
            
    def size(self) -> int:
        """Get queue size."""
        return len(self._queue)
        
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        async with self._lock:
            return self._tasks.get(task_id)
            
    async def list_tasks(
        self,
        status: Optional[TaskStatus] = None
    ) -> List[Task]:
        """List tasks, optionally filtered by status."""
        async with self._lock:
            if status is None:
                return list(self._tasks.values())
            return [
                task for tid, task in self._tasks.items()
                if self._status.get(tid) == status
            ]
            
    def serialize(self) -> Dict[str, Any]:
        """Serialize queue state."""
        return {
            "tasks": {
                tid: {
                    **asdict(task),
                    "handler": None,  # Can't serialize functions
                }
                for tid, task in self._tasks.items()
            },
            "status": {tid: s.name for tid, s in self._status.items()},
            "queue": [
                {"priority": pt.priority, "task_id": pt.task.id}
                for pt in self._queue
            ],
        }
        
    async def deserialize(self, data: Dict[str, Any]) -> None:
        """Deserialize queue state."""
        # Note: handlers cannot be restored, tasks will need to be resubmitted
        self._status = {
            tid: TaskStatus[s] for tid, s in data.get("status", {}).items()
        }
