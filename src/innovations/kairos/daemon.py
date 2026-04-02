"""
Kairos Daemon - Core daemon implementation for persistent background operations.
"""

import asyncio
import signal
import logging
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
import json
import os
import pickle

from .task_queue import TaskQueue, Task, TaskStatus, TaskPriority
from .memory_integrator import MemoryIntegrator
from .event_system import EventSystem, EventType
from .state_manager import StateManager


logger = logging.getLogger(__name__)


class DaemonState(Enum):
    """Daemon operational states."""
    STOPPED = auto()
    STARTING = auto()
    RUNNING = auto()
    PAUSED = auto()
    SHUTTING_DOWN = auto()


@dataclass
class DaemonConfig:
    """Configuration for Kairos Daemon."""
    state_dir: str = ".kairos"
    max_concurrent_tasks: int = 5
    task_timeout: float = 300.0  # 5 minutes
    memory_sync_interval: float = 60.0  # 1 minute
    event_poll_interval: float = 0.1
    enable_persistence: bool = True
    auto_restart: bool = True


class KairosDaemon:
    """
    Persistent autonomous daemon for background task execution.
    
    Features:
    - Background session management
    - Task queue with priorities
    - Event-driven execution
    - State persistence and recovery
    """
    
    def __init__(self, config: Optional[DaemonConfig] = None):
        self.config = config or DaemonConfig()
        self.state = DaemonState.STOPPED
        self._task_queue = TaskQueue()
        self._memory_integrator = MemoryIntegrator()
        self._event_system = EventSystem()
        self._state_manager = StateManager(self.config.state_dir)
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()
        self._workers: List[asyncio.Task] = []
        self._start_time: Optional[datetime] = None
        
    async def start(self) -> None:
        """Start the Kairos daemon."""
        if self.state != DaemonState.STOPPED:
            logger.warning(f"Cannot start daemon in state: {self.state}")
            return
            
        logger.info("Starting Kairos daemon...")
        self.state = DaemonState.STARTING
        
        # Setup signal handlers
        self._setup_signal_handlers()
        
        # Restore state if persistence enabled
        if self.config.enable_persistence:
            await self._restore_state()
        
        # Start worker tasks
        self._start_time = datetime.now()
        self.state = DaemonState.RUNNING
        self._shutdown_event.clear()
        
        # Start task workers
        for i in range(self.config.max_concurrent_tasks):
            worker = asyncio.create_task(
                self._task_worker(f"worker-{i}"),
                name=f"kairos-worker-{i}"
            )
            self._workers.append(worker)
        
        # Start event processor
        self._event_processor = asyncio.create_task(
            self._process_events(),
            name="kairos-event-processor"
        )
        
        # Start memory sync
        self._memory_sync = asyncio.create_task(
            self._sync_memory_loop(),
            name="kairos-memory-sync"
        )
        
        logger.info("Kairos daemon started successfully")
        
    async def stop(self, graceful: bool = True) -> None:
        """Stop the Kairos daemon."""
        if self.state in (DaemonState.STOPPED, DaemonState.SHUTTING_DOWN):
            return
            
        logger.info("Stopping Kairos daemon...")
        self.state = DaemonState.SHUTTING_DOWN
        self._shutdown_event.set()
        
        if graceful:
            # Wait for running tasks to complete
            if self._running_tasks:
                logger.info(f"Waiting for {len(self._running_tasks)} tasks to complete...")
                await asyncio.gather(*self._running_tasks.values(), return_exceptions=True)
        
        # Cancel all workers
        for worker in self._workers:
            worker.cancel()
        
        self._event_processor.cancel()
        self._memory_sync.cancel()
        
        try:
            await asyncio.gather(*self._workers, return_exceptions=True)
        except asyncio.CancelledError:
            pass
        
        # Save state
        if self.config.enable_persistence:
            await self._save_state()
        
        self.state = DaemonState.STOPPED
        self._workers.clear()
        self._running_tasks.clear()
        logger.info("Kairos daemon stopped")
        
    async def pause(self) -> None:
        """Pause daemon execution temporarily."""
        if self.state == DaemonState.RUNNING:
            self.state = DaemonState.PAUSED
            logger.info("Kairos daemon paused")
            
    async def resume(self) -> None:
        """Resume daemon execution."""
        if self.state == DaemonState.PAUSED:
            self.state = DaemonState.RUNNING
            logger.info("Kairos daemon resumed")
            
    async def submit_task(
        self,
        task: Task,
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """Submit a task to the daemon queue."""
        task_id = await self._task_queue.enqueue(task, priority)
        logger.debug(f"Task {task_id} submitted with priority {priority}")
        return task_id
        
    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get the status of a task."""
        return await self._task_queue.get_status(task_id)
        
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending or running task."""
        # Cancel from queue
        if await self._task_queue.cancel(task_id):
            return True
            
        # Cancel if running
        if task_id in self._running_tasks:
            self._running_tasks[task_id].cancel()
            return True
            
        return False
        
    async def integrate_session_memory(self, session_id: str) -> None:
        """Integrate memory from a session."""
        await self._memory_integrator.integrate_session(session_id)
        
    def register_event_handler(
        self,
        event_type: EventType,
        handler: Callable[[Any], None]
    ) -> None:
        """Register an event handler."""
        self._event_system.register_handler(event_type, handler)
        
    def get_stats(self) -> Dict[str, Any]:
        """Get daemon statistics."""
        uptime = None
        if self._start_time:
            uptime = (datetime.now() - self._start_time).total_seconds()
            
        return {
            "state": self.state.name,
            "uptime_seconds": uptime,
            "queued_tasks": self._task_queue.size(),
            "running_tasks": len(self._running_tasks),
            "total_workers": len(self._workers),
        }
        
    def _setup_signal_handlers(self) -> None:
        """Setup OS signal handlers."""
        try:
            loop = asyncio.get_event_loop()
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            pass
            
    async def _task_worker(self, worker_id: str) -> None:
        """Worker that processes tasks from the queue."""
        logger.debug(f"Task worker {worker_id} started")
        
        while not self._shutdown_event.is_set():
            try:
                if self.state != DaemonState.RUNNING:
                    await asyncio.sleep(0.1)
                    continue
                    
                # Get next task
                task = await self._task_queue.dequeue(timeout=1.0)
                if task is None:
                    continue
                    
                # Execute task
                self._running_tasks[task.id] = asyncio.current_task()
                await self._execute_task(task)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Worker {worker_id} error: {e}")
                
        logger.debug(f"Task worker {worker_id} stopped")
        
    async def _execute_task(self, task: Task) -> None:
        """Execute a single task."""
        logger.debug(f"Executing task {task.id}")
        
        try:
            await self._task_queue.update_status(task.id, TaskStatus.RUNNING)
            
            # Execute with timeout
            result = await asyncio.wait_for(
                self._run_task_handler(task),
                timeout=self.config.task_timeout
            )
            
            await self._task_queue.complete(task.id, result)
            
        except asyncio.TimeoutError:
            logger.warning(f"Task {task.id} timed out")
            await self._task_queue.fail(task.id, "Task timed out")
        except Exception as e:
            logger.exception(f"Task {task.id} failed: {e}")
            await self._task_queue.fail(task.id, str(e))
        finally:
            self._running_tasks.pop(task.id, None)
            
    async def _run_task_handler(self, task: Task) -> Any:
        """Run the actual task handler."""
        if asyncio.iscoroutinefunction(task.handler):
            return await task.handler(*task.args, **task.kwargs)
        else:
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                task.handler,
                *task.args,
                **task.kwargs
            )
            
    async def _process_events(self) -> None:
        """Process system events."""
        while not self._shutdown_event.is_set():
            try:
                await self._event_system.process_events()
                await asyncio.sleep(self.config.event_poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Event processing error: {e}")
                
    async def _sync_memory_loop(self) -> None:
        """Periodic memory synchronization."""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(),
                    timeout=self.config.memory_sync_interval
                )
            except asyncio.TimeoutError:
                await self._memory_integrator.sync()
                
    async def _save_state(self) -> None:
        """Save daemon state to disk."""
        state = {
            "task_queue": self._task_queue.serialize(),
            "memory": self._memory_integrator.serialize(),
            "start_time": self._start_time.isoformat() if self._start_time else None,
        }
        await self._state_manager.save(state)
        
    async def _restore_state(self) -> None:
        """Restore daemon state from disk."""
        state = await self._state_manager.load()
        if state:
            await self._task_queue.deserialize(state.get("task_queue", {}))
            await self._memory_integrator.deserialize(state.get("memory", {}))
            logger.info("Daemon state restored")


class KairosMode:
    """
    High-level interface for Kairos daemon operations.
    
    This is the main entry point for users to interact with
    the Kairos persistent daemon system.
    """
    
    _instance: Optional['KairosMode'] = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
        
    def __init__(self):
        if self._initialized:
            return
        self._daemon: Optional[KairosDaemon] = None
        self._initialized = True
        
    async def start_daemon(self, config: Optional[DaemonConfig] = None) -> None:
        """Start the Kairos daemon."""
        async with self._lock:
            if self._daemon is None:
                self._daemon = KairosDaemon(config)
            await self._daemon.start()
            
    async def stop_daemon(self) -> None:
        """Stop the Kairos daemon."""
        async with self._lock:
            if self._daemon:
                await self._daemon.stop()
                self._daemon = None
                
    async def queue_task(
        self,
        task: Task,
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """Queue a task for background execution."""
        if self._daemon is None or self._daemon.state != DaemonState.RUNNING:
            raise RuntimeError("Daemon not running. Call start_daemon() first.")
        return await self._daemon.submit_task(task, priority)
        
    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get the status of a queued task."""
        if self._daemon is None:
            raise RuntimeError("Daemon not running.")
        return await self._daemon.get_task_status(task_id)
        
    async def integrate_memory(self, session_id: str) -> None:
        """Integrate memory from a session."""
        if self._daemon is None:
            raise RuntimeError("Daemon not running.")
        await self._daemon.integrate_session_memory(session_id)
        
    def get_daemon_stats(self) -> Dict[str, Any]:
        """Get daemon statistics."""
        if self._daemon is None:
            return {"state": "NOT_INITIALIZED"}
        return self._daemon.get_stats()
        
    @property
    def is_running(self) -> bool:
        """Check if daemon is running."""
        return self._daemon is not None and self._daemon.state == DaemonState.RUNNING
