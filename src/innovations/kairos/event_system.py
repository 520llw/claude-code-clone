"""
Event System - Event-driven task triggering and handling.
"""

import asyncio
from typing import Dict, Any, List, Callable, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
import fnmatch


class EventType(Enum):
    """Types of events that can trigger tasks."""
    # File system events
    FILE_CREATED = auto()
    FILE_MODIFIED = auto()
    FILE_DELETED = auto()
    FILE_MOVED = auto()
    
    # Time-based events
    SCHEDULED = auto()
    INTERVAL = auto()
    CRON = auto()
    
    # System events
    MEMORY_THRESHOLD = auto()
    CPU_THRESHOLD = auto()
    DISK_THRESHOLD = auto()
    
    # Custom events
    CUSTOM = auto()
    WEBHOOK = auto()
    MESSAGE = auto()


@dataclass
class Event:
    """Represents an event."""
    type: EventType
    timestamp: datetime = field(default_factory=datetime.now)
    source: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: f"evt_{datetime.now().timestamp()}")


@dataclass
class FileWatch:
    """File system watch configuration."""
    path: Path
    pattern: str = "*"
    recursive: bool = True
    event_types: List[EventType] = field(default_factory=lambda: [
        EventType.FILE_CREATED,
        EventType.FILE_MODIFIED,
        EventType.FILE_DELETED
    ])


@dataclass
class ScheduledTask:
    """Scheduled task configuration."""
    name: str
    cron: Optional[str] = None  # Cron expression
    interval_seconds: Optional[float] = None
    next_run: Optional[datetime] = None
    handler: Optional[Callable] = None
    enabled: bool = True


class EventSystem:
    """
    Event-driven task triggering system.
    
    Features:
    - File system watching
    - Scheduled tasks (cron/interval)
    - System threshold monitoring
    - Custom event handling
    """
    
    def __init__(self):
        self._handlers: Dict[EventType, List[Callable[[Event], None]]] = {
            et: [] for et in EventType
        }
        self._file_watches: List[FileWatch] = []
        self._scheduled_tasks: Dict[str, ScheduledTask] = {}
        self._event_queue: asyncio.Queue[Event] = asyncio.Queue()
        self._file_states: Dict[Path, float] = {}
        self._running = False
        
    def register_handler(
        self,
        event_type: EventType,
        handler: Callable[[Event], None]
    ) -> None:
        """Register an event handler."""
        self._handlers[event_type].append(handler)
        
    def unregister_handler(
        self,
        event_type: EventType,
        handler: Callable[[Event], None]
    ) -> None:
        """Unregister an event handler."""
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)
            
    def add_file_watch(self, watch: FileWatch) -> None:
        """Add a file system watch."""
        self._file_watches.append(watch)
        # Initialize file states
        self._scan_watch(watch)
        
    def remove_file_watch(self, path: Path) -> None:
        """Remove a file system watch."""
        self._file_watches = [
            w for w in self._file_watches if w.path != path
        ]
        
    def schedule_task(self, task: ScheduledTask) -> None:
        """Add a scheduled task."""
        self._scheduled_tasks[task.name] = task
        
    def unschedule_task(self, name: str) -> None:
        """Remove a scheduled task."""
        if name in self._scheduled_tasks:
            del self._scheduled_tasks[name]
            
    async def emit(self, event: Event) -> None:
        """Emit a custom event."""
        await self._event_queue.put(event)
        
    async def process_events(self) -> None:
        """Process pending events."""
        # Process queued events
        while not self._event_queue.empty():
            try:
                event = self._event_queue.get_nowait()
                await self._dispatch_event(event)
            except asyncio.QueueEmpty:
                break
                
        # Check file watches
        await self._check_file_watches()
        
        # Check scheduled tasks
        await self._check_scheduled_tasks()
        
    async def _dispatch_event(self, event: Event) -> None:
        """Dispatch event to handlers."""
        handlers = self._handlers.get(event.type, [])
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                # Log error but continue processing
                print(f"Event handler error: {e}")
                
    def _scan_watch(self, watch: FileWatch) -> None:
        """Initialize file state for a watch."""
        if not watch.path.exists():
            return
            
        paths = [watch.path]
        if watch.recursive:
            paths = list(watch.path.rglob("*"))
            
        for p in paths:
            if p.is_file() and fnmatch.fnmatch(p.name, watch.pattern):
                self._file_states[p] = p.stat().st_mtime
                
    async def _check_file_watches(self) -> None:
        """Check file watches for changes."""
        for watch in self._file_watches:
            if not watch.path.exists():
                continue
                
            current_files = set()
            paths = [watch.path]
            
            if watch.recursive:
                paths = list(watch.path.rglob("*"))
                
            for p in paths:
                if not p.is_file():
                    continue
                    
                if not fnmatch.fnmatch(p.name, watch.pattern):
                    continue
                    
                current_files.add(p)
                current_mtime = p.stat().st_mtime
                
                if p not in self._file_states:
                    # New file
                    if EventType.FILE_CREATED in watch.event_types:
                        await self.emit(Event(
                            type=EventType.FILE_CREATED,
                            source=str(p),
                            data={"path": str(p)}
                        ))
                elif self._file_states[p] != current_mtime:
                    # Modified file
                    if EventType.FILE_MODIFIED in watch.event_types:
                        await self.emit(Event(
                            type=EventType.FILE_MODIFIED,
                            source=str(p),
                            data={"path": str(p)}
                        ))
                        
                self._file_states[p] = current_mtime
                
            # Check for deleted files
            watched_files = {
                p for p in self._file_states.keys()
                if p.is_relative_to(watch.path)
            }
            for p in watched_files - current_files:
                if EventType.FILE_DELETED in watch.event_types:
                    await self.emit(Event(
                        type=EventType.FILE_DELETED,
                        source=str(p),
                        data={"path": str(p)}
                    ))
                del self._file_states[p]
                
    async def _check_scheduled_tasks(self) -> None:
        """Check and execute scheduled tasks."""
        now = datetime.now()
        
        for task in self._scheduled_tasks.values():
            if not task.enabled:
                continue
                
            if task.next_run and now >= task.next_run:
                # Execute task
                if task.handler:
                    try:
                        if asyncio.iscoroutinefunction(task.handler):
                            await task.handler()
                        else:
                            task.handler()
                    except Exception as e:
                        print(f"Scheduled task error: {e}")
                        
                # Schedule next run
                if task.interval_seconds:
                    task.next_run = now + timedelta(seconds=task.interval_seconds)
                elif task.cron:
                    task.next_run = self._next_cron_run(task.cron)
                    
    def _next_cron_run(self, cron: str) -> datetime:
        """Calculate next run time from cron expression."""
        # Simplified - would use croniter in production
        return datetime.now() + timedelta(hours=1)
