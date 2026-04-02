"""
Core - Plugin management system.
"""

import importlib
import importlib.util
import sys
from typing import Dict, List, Optional, Any, Callable, Type
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
import logging
import asyncio


logger = logging.getLogger(__name__)


class PluginStatus(Enum):
    """Plugin lifecycle status."""
    UNLOADED = auto()
    LOADING = auto()
    LOADED = auto()
    INITIALIZING = auto()
    ACTIVE = auto()
    ERROR = auto()
    DISABLED = auto()
    UNLOADING = auto()


@dataclass
class PluginMetadata:
    """Plugin metadata."""
    name: str
    version: str
    description: str = ""
    author: str = ""
    license: str = ""
    homepage: str = ""
    dependencies: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    min_api_version: str = "1.0"
    max_api_version: str = ""


@dataclass
class PluginCapabilities:
    """Plugin capabilities."""
    hooks: List[str] = field(default_factory=list)
    commands: List[str] = field(default_factory=list)
    tools: List[str] = field(default_factory=list)
    file_extensions: List[str] = field(default_factory=list)
    languages: List[str] = field(default_factory=list)


class Plugin:
    """
    Base class for plugins.
    
    All plugins must inherit from this class.
    """
    
    # Plugin metadata (override in subclass)
    METADATA: PluginMetadata = PluginMetadata(
        name="unnamed_plugin",
        version="0.0.1"
    )
    
    CAPABILITIES: PluginCapabilities = PluginCapabilities()
    
    def __init__(self):
        self.status = PluginStatus.UNLOADED
        self._manager: Optional['PluginManager'] = None
        self._config: Dict[str, Any] = {}
        self._initialized_at: Optional[datetime] = None
        
    @property
    def name(self) -> str:
        """Get plugin name."""
        return self.METADATA.name
        
    @property
    def version(self) -> str:
        """Get plugin version."""
        return self.METADATA.version
        
    def initialize(self, manager: 'PluginManager', config: Dict[str, Any]) -> bool:
        """
        Initialize the plugin.
        
        Args:
            manager: Plugin manager instance
            config: Plugin configuration
            
        Returns:
            True if initialization successful
        """
        self._manager = manager
        self._config = config
        self.status = PluginStatus.INITIALIZING
        
        try:
            result = self.on_initialize()
            if result:
                self.status = PluginStatus.ACTIVE
                self._initialized_at = datetime.now()
                logger.info(f"Plugin {self.name} initialized")
            else:
                self.status = PluginStatus.ERROR
            return result
        except Exception as e:
            logger.error(f"Plugin {self.name} initialization failed: {e}")
            self.status = PluginStatus.ERROR
            return False
            
    def shutdown(self) -> bool:
        """
        Shutdown the plugin.
        
        Returns:
            True if shutdown successful
        """
        self.status = PluginStatus.UNLOADING
        
        try:
            result = self.on_shutdown()
            self.status = PluginStatus.UNLOADED
            logger.info(f"Plugin {self.name} shutdown")
            return result
        except Exception as e:
            logger.error(f"Plugin {self.name} shutdown error: {e}")
            self.status = PluginStatus.ERROR
            return False
            
    def on_initialize(self) -> bool:
        """
        Override this method to perform initialization.
        
        Returns:
            True if successful
        """
        return True
        
    def on_shutdown(self) -> bool:
        """
        Override this method to perform cleanup.
        
        Returns:
            True if successful
        """
        return True
        
    def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        return self._config.get(key, default)
        
    def set_config(self, key: str, value: Any) -> None:
        """Set configuration value."""
        self._config[key] = value
        
    def register_hook(self, hook_name: str, handler: Callable) -> None:
        """Register a hook handler."""
        if self._manager:
            self._manager.register_hook(hook_name, handler, self.name)
            
    def unregister_hook(self, hook_name: str) -> None:
        """Unregister a hook handler."""
        if self._manager:
            self._manager.unregister_hook(hook_name, self.name)
            
    def emit_event(self, event_name: str, data: Any) -> None:
        """Emit an event."""
        if self._manager:
            self._manager.emit_event(event_name, data)


class PluginManager:
    """
    Manages plugin lifecycle and interactions.
    
    Features:
    - Plugin loading/unloading
    - Dependency resolution
    - Hook management
    - Event routing
    """
    
    def __init__(self, plugin_dirs: Optional[List[str]] = None):
        self.plugin_dirs = plugin_dirs or ["./plugins"]
        self._plugins: Dict[str, Plugin] = {}
        self._hooks: Dict[str, List[Tuple[str, Callable]]] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}
        self._configs: Dict[str, Dict[str, Any]] = {}
        
    def discover_plugins(self) -> List[str]:
        """Discover available plugins in plugin directories."""
        discovered = []
        
        for plugin_dir in self.plugin_dirs:
            path = Path(plugin_dir)
            if not path.exists():
                continue
                
            # Look for plugin directories
            for item in path.iterdir():
                if item.is_dir():
                    # Check for __init__.py or plugin.py
                    if (item / "__init__.py").exists() or (item / "plugin.py").exists():
                        discovered.append(str(item))
                elif item.suffix == ".py" and item.stem != "__init__":
                    discovered.append(str(item))
                    
        return discovered
        
    def load_plugin(self, plugin_path: str, config: Optional[Dict] = None) -> Optional[Plugin]:
        """
        Load a plugin from path.
        
        Args:
            plugin_path: Path to plugin file or directory
            config: Plugin configuration
            
        Returns:
            Loaded plugin or None
        """
        try:
            path = Path(plugin_path)
            
            # Determine module name
            if path.is_dir():
                module_name = path.name
                spec = importlib.util.spec_from_file_location(
                    module_name,
                    path / "__init__.py" if (path / "__init__.py").exists() else path / "plugin.py"
                )
            else:
                module_name = path.stem
                spec = importlib.util.spec_from_file_location(module_name, path)
                
            if not spec or not spec.loader:
                logger.error(f"Cannot load plugin from {plugin_path}")
                return None
                
            # Load module
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            
            # Find plugin class
            plugin_class = None
            for name in dir(module):
                obj = getattr(module, name)
                if (isinstance(obj, type) and 
                    issubclass(obj, Plugin) and 
                    obj is not Plugin):
                    plugin_class = obj
                    break
                    
            if not plugin_class:
                logger.error(f"No Plugin subclass found in {plugin_path}")
                return None
                
            # Instantiate and initialize
            plugin = plugin_class()
            plugin.status = PluginStatus.LOADED
            
            # Check dependencies
            if not self._check_dependencies(plugin):
                logger.error(f"Plugin {plugin.name} has unmet dependencies")
                plugin.status = PluginStatus.ERROR
                return None
                
            # Initialize
            plugin_config = config or self._configs.get(plugin.name, {})
            if plugin.initialize(self, plugin_config):
                self._plugins[plugin.name] = plugin
                return plugin
            else:
                return None
                
        except Exception as e:
            logger.exception(f"Failed to load plugin from {plugin_path}: {e}")
            return None
            
    def unload_plugin(self, plugin_name: str) -> bool:
        """
        Unload a plugin.
        
        Args:
            plugin_name: Name of plugin to unload
            
        Returns:
            True if successful
        """
        plugin = self._plugins.get(plugin_name)
        if not plugin:
            return False
            
        # Shutdown plugin
        plugin.shutdown()
        
        # Remove hooks
        for hook_name in list(self._hooks.keys()):
            self._hooks[hook_name] = [
                (p, h) for p, h in self._hooks[hook_name]
                if p != plugin_name
            ]
            
        # Remove from registry
        del self._plugins[plugin_name]
        
        return True
        
    def reload_plugin(self, plugin_name: str) -> Optional[Plugin]:
        """Reload a plugin."""
        plugin = self._plugins.get(plugin_name)
        if not plugin:
            return None
            
        config = plugin._config
        plugin_path = plugin.__class__.__module__
        
        # Unload
        self.unload_plugin(plugin_name)
        
        # Reload module
        if plugin_path in sys.modules:
            importlib.reload(sys.modules[plugin_path])
            
        # Reload plugin
        return self.load_plugin(plugin_path, config)
        
    def get_plugin(self, name: str) -> Optional[Plugin]:
        """Get a loaded plugin."""
        return self._plugins.get(name)
        
    def list_plugins(self) -> List[Dict[str, Any]]:
        """List all loaded plugins."""
        return [
            {
                "name": p.name,
                "version": p.version,
                "status": p.status.name,
                "description": p.METADATA.description,
            }
            for p in self._plugins.values()
        ]
        
    def register_hook(self, hook_name: str, handler: Callable, plugin_name: str) -> None:
        """Register a hook handler."""
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
        self._hooks[hook_name].append((plugin_name, handler))
        
    def unregister_hook(self, hook_name: str, plugin_name: str) -> None:
        """Unregister a hook handler."""
        if hook_name in self._hooks:
            self._hooks[hook_name] = [
                (p, h) for p, h in self._hooks[hook_name]
                if p != plugin_name
            ]
            
    async def execute_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """
        Execute all handlers for a hook.
        
        Returns:
            List of handler results
        """
        results = []
        handlers = self._hooks.get(hook_name, [])
        
        for plugin_name, handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    result = await handler(*args, **kwargs)
                else:
                    result = handler(*args, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"Hook handler error in {plugin_name}: {e}")
                
        return results
        
    def emit_event(self, event_name: str, data: Any) -> None:
        """Emit an event to all listeners."""
        handlers = self._event_handlers.get(event_name, [])
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    asyncio.create_task(handler(data))
                else:
                    handler(data)
            except Exception as e:
                logger.error(f"Event handler error: {e}")
                
    def register_event_handler(self, event_name: str, handler: Callable) -> None:
        """Register an event handler."""
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        self._event_handlers[event_name].append(handler)
        
    def _check_dependencies(self, plugin: Plugin) -> bool:
        """Check if plugin dependencies are met."""
        for dep in plugin.METADATA.dependencies:
            if dep not in self._plugins:
                return False
        return True
        
    def get_stats(self) -> Dict[str, Any]:
        """Get plugin manager statistics."""
        return {
            "loaded_plugins": len(self._plugins),
            "active_plugins": sum(
                1 for p in self._plugins.values()
                if p.status == PluginStatus.ACTIVE
            ),
            "registered_hooks": len(self._hooks),
            "event_types": len(self._event_handlers),
        }
