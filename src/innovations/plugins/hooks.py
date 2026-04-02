"""
Hooks - Hook system for plugin extensibility.
"""

from enum import Enum, auto
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass
import asyncio
import logging


logger = logging.getLogger(__name__)


class HookType(Enum):
    """Standard hook types."""
    # File operations
    FILE_READ = auto()
    FILE_WRITE = auto()
    FILE_DELETE = auto()
    
    # Code operations
    CODE_ANALYZE = auto()
    CODE_TRANSFORM = auto()
    CODE_GENERATE = auto()
    
    # UI operations
    UI_RENDER = auto()
    UI_COMMAND = auto()
    
    # System operations
    SYSTEM_START = auto()
    SYSTEM_SHUTDOWN = auto()
    SYSTEM_ERROR = auto()
    
    # User interactions
    USER_INPUT = auto()
    USER_OUTPUT = auto()
    
    # Custom
    CUSTOM = auto()


@dataclass
class HookInfo:
    """Information about a registered hook."""
    name: str
    handler: Callable
    priority: int
    plugin_name: Optional[str]


class HookManager:
    """
    Manages hooks for plugin extensibility.
    
    Hooks allow plugins to:
    - Intercept and modify operations
    - React to events
    - Extend functionality
    """
    
    def __init__(self):
        self._hooks: Dict[str, List[HookInfo]] = {}
        self._filters: Dict[str, List[HookInfo]] = {}
        
    def register(
        self,
        hook_name: str,
        handler: Callable,
        priority: int = 10,
        plugin_name: Optional[str] = None
    ) -> None:
        """
        Register a hook handler.
        
        Args:
            hook_name: Name of the hook
            handler: Handler function
            priority: Lower numbers execute first
            plugin_name: Optional plugin name
        """
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
            
        hook_info = HookInfo(
            name=hook_name,
            handler=handler,
            priority=priority,
            plugin_name=plugin_name
        )
        
        # Insert in priority order
        inserted = False
        for i, existing in enumerate(self._hooks[hook_name]):
            if priority < existing.priority:
                self._hooks[hook_name].insert(i, hook_info)
                inserted = True
                break
                
        if not inserted:
            self._hooks[hook_name].append(hook_info)
            
        logger.debug(f"Registered hook: {hook_name} (priority {priority})")
        
    def unregister(
        self,
        hook_name: str,
        handler: Optional[Callable] = None,
        plugin_name: Optional[str] = None
    ) -> bool:
        """
        Unregister a hook handler.
        
        Args:
            hook_name: Name of the hook
            handler: Specific handler to remove (or all if None)
            plugin_name: Remove all hooks from this plugin
            
        Returns:
            True if any hooks were removed
        """
        if hook_name not in self._hooks:
            return False
            
        original_count = len(self._hooks[hook_name])
        
        if handler:
            self._hooks[hook_name] = [
                h for h in self._hooks[hook_name]
                if h.handler != handler
            ]
        elif plugin_name:
            self._hooks[hook_name] = [
                h for h in self._hooks[hook_name]
                if h.plugin_name != plugin_name
            ]
        else:
            del self._hooks[hook_name]
            
        return len(self._hooks.get(hook_name, [])) < original_count
        
    async def execute(
        self,
        hook_name: str,
        *args,
        **kwargs
    ) -> List[Any]:
        """
        Execute all handlers for a hook.
        
        Args:
            hook_name: Name of the hook
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            List of handler results
        """
        results = []
        hooks = self._hooks.get(hook_name, [])
        
        for hook_info in hooks:
            try:
                if asyncio.iscoroutinefunction(hook_info.handler):
                    result = await hook_info.handler(*args, **kwargs)
                else:
                    result = hook_info.handler(*args, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"Hook handler error for {hook_name}: {e}")
                
        return results
        
    async def apply_filters(
        self,
        hook_name: str,
        value: Any,
        *args,
        **kwargs
    ) -> Any:
        """
        Apply filter hooks, passing value through each handler.
        
        Args:
            hook_name: Name of the filter hook
            value: Value to filter
            *args: Additional positional arguments
            **kwargs: Additional keyword arguments
            
        Returns:
            Filtered value
        """
        hooks = self._hooks.get(hook_name, [])
        
        for hook_info in hooks:
            try:
                if asyncio.iscoroutinefunction(hook_info.handler):
                    value = await hook_info.handler(value, *args, **kwargs)
                else:
                    value = hook_info.handler(value, *args, **kwargs)
            except Exception as e:
                logger.error(f"Filter hook error for {hook_name}: {e}")
                
        return value
        
    def has_handlers(self, hook_name: str) -> bool:
        """Check if a hook has registered handlers."""
        return hook_name in self._hooks and len(self._hooks[hook_name]) > 0
        
    def get_handlers(self, hook_name: str) -> List[HookInfo]:
        """Get all handlers for a hook."""
        return self._hooks.get(hook_name, []).copy()
        
    def list_hooks(self) -> Dict[str, int]:
        """List all hooks with handler counts."""
        return {
            name: len(handlers)
            for name, handlers in self._hooks.items()
        }
        
    def get_stats(self) -> Dict[str, Any]:
        """Get hook manager statistics."""
        return {
            "total_hooks": len(self._hooks),
            "total_handlers": sum(len(h) for h in self._hooks.values()),
            "hooks": self.list_hooks()
        }
