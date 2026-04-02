"""
Claude Code Tool System - Tool Registry

This module provides the tool registry for managing and discovering tools.
"""

import json
import importlib
from typing import Any, Dict, List, Optional, Type, Callable
from dataclasses import dataclass, field
from collections import defaultdict

from .base import Tool, ToolResult, ToolParameter
from .permission import PermissionManager, get_permission_manager


@dataclass
class RegisteredTool:
    """A registered tool with metadata."""
    tool_class: Type[Tool]
    instance: Optional[Tool] = None
    category: str = "general"
    tags: List[str] = field(default_factory=list)
    enabled: bool = True
    
    def get_instance(self, permission_manager: Optional[PermissionManager] = None) -> Tool:
        """Get or create tool instance."""
        if self.instance is None:
            self.instance = self.tool_class(permission_manager)
        return self.instance


class ToolRegistry:
    """
    Registry for managing tools.
    
    Features:
    - Tool registration and discovery
    - Category-based organization
    - Tool instantiation with dependency injection
    - Batch tool execution
    """
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        """Initialize the tool registry."""
        self._tools: Dict[str, RegisteredTool] = {}
        self._categories: Dict[str, List[str]] = defaultdict(list)
        self._tags: Dict[str, List[str]] = defaultdict(list)
        self._permission_manager = permission_manager or get_permission_manager()
        self._execution_hooks: List[Callable[[str, Dict, ToolResult], None]] = []
    
    def register(
        self, 
        tool_class: Type[Tool],
        category: str = "general",
        tags: Optional[List[str]] = None,
        enabled: bool = True
    ) -> "ToolRegistry":
        """
        Register a tool class.
        
        Args:
            tool_class: The tool class to register
            category: Category for organizing tools
            tags: Tags for filtering tools
            enabled: Whether the tool is enabled
        
        Returns:
            Self for method chaining
        """
        # Create instance to get name
        temp_instance = tool_class()
        name = temp_instance.name
        
        registered = RegisteredTool(
            tool_class=tool_class,
            category=category,
            tags=tags or [],
            enabled=enabled
        )
        
        self._tools[name] = registered
        self._categories[category].append(name)
        
        for tag in (tags or []):
            self._tags[tag].append(name)
        
        return self
    
    def unregister(self, name: str) -> bool:
        """Unregister a tool."""
        if name not in self._tools:
            return False
        
        tool = self._tools[name]
        
        # Remove from categories
        if tool.category in self._categories:
            self._categories[tool.category] = [
                n for n in self._categories[tool.category] if n != name
            ]
        
        # Remove from tags
        for tag in tool.tags:
            if tag in self._tags:
                self._tags[tag] = [n for n in self._tags[tag] if n != name]
        
        del self._tools[name]
        return True
    
    def get(self, name: str) -> Optional[Tool]:
        """Get a tool instance by name."""
        if name not in self._tools:
            return None
        
        registered = self._tools[name]
        if not registered.enabled:
            return None
        
        return registered.get_instance(self._permission_manager)
    
    def get_tool_class(self, name: str) -> Optional[Type[Tool]]:
        """Get a tool class by name."""
        if name not in self._tools:
            return None
        return self._tools[name].tool_class
    
    def has_tool(self, name: str) -> bool:
        """Check if a tool is registered."""
        return name in self._tools and self._tools[name].enabled
    
    def list_tools(
        self, 
        category: Optional[str] = None,
        tag: Optional[str] = None,
        enabled_only: bool = True
    ) -> List[str]:
        """List registered tool names."""
        if category:
            names = self._categories.get(category, [])
        elif tag:
            names = self._tags.get(tag, [])
        else:
            names = list(self._tools.keys())
        
        if enabled_only:
            names = [n for n in names if self._tools[n].enabled]
        
        return sorted(names)
    
    def get_categories(self) -> List[str]:
        """Get all categories."""
        return sorted(self._categories.keys())
    
    def get_tags(self) -> List[str]:
        """Get all tags."""
        return sorted(self._tags.keys())
    
    def get_tools_by_category(self, category: str) -> List[Tool]:
        """Get all tools in a category."""
        names = self._categories.get(category, [])
        return [self.get(n) for n in names if self.get(n) is not None]
    
    def get_tools_by_tag(self, tag: str) -> List[Tool]:
        """Get all tools with a tag."""
        names = self._tags.get(tag, [])
        return [self.get(n) for n in names if self.get(n) is not None]
    
    def enable_tool(self, name: str) -> bool:
        """Enable a tool."""
        if name in self._tools:
            self._tools[name].enabled = True
            return True
        return False
    
    def disable_tool(self, name: str) -> bool:
        """Disable a tool."""
        if name in self._tools:
            self._tools[name].enabled = False
            return True
        return False
    
    def is_enabled(self, name: str) -> bool:
        """Check if a tool is enabled."""
        return name in self._tools and self._tools[name].enabled
    
    def register_execution_hook(
        self, 
        hook: Callable[[str, Dict, ToolResult], None]
    ) -> None:
        """Register a hook to be called after tool execution."""
        self._execution_hooks.append(hook)
    
    async def execute(
        self, 
        name: str, 
        **kwargs
    ) -> ToolResult:
        """
        Execute a tool by name.
        
        Args:
            name: Tool name
            **kwargs: Tool parameters
        
        Returns:
            Tool execution result
        """
        tool = self.get(name)
        if tool is None:
            return ToolResult.error(f"Tool not found: {name}")
        
        # Validate parameters
        validation_error = tool.validate_parameters(**kwargs)
        if validation_error:
            return ToolResult.error(f"Parameter validation failed: {validation_error}")
        
        # Execute tool
        result = await tool.execute_with_timing(**kwargs)
        
        # Call execution hooks
        for hook in self._execution_hooks:
            try:
                hook(name, kwargs, result)
            except Exception:
                pass
        
        return result
    
    async def execute_batch(
        self, 
        calls: List[Dict[str, Any]]
    ) -> List[ToolResult]:
        """
        Execute multiple tools.
        
        Args:
            calls: List of {"tool": name, "params": {}}
        
        Returns:
            List of results
        """
        results = []
        for call in calls:
            name = call.get("tool")
            params = call.get("params", {})
            result = await self.execute(name, **params)
            results.append(result)
        return results
    
    async def execute_parallel(
        self, 
        calls: List[Dict[str, Any]],
        max_concurrency: int = 5
    ) -> List[ToolResult]:
        """
        Execute multiple tools in parallel.
        
        Args:
            calls: List of {"tool": name, "params": {}}
            max_concurrency: Maximum concurrent executions
        
        Returns:
            List of results
        """
        import asyncio
        
        semaphore = asyncio.Semaphore(max_concurrency)
        
        async def execute_with_limit(call):
            async with semaphore:
                name = call.get("tool")
                params = call.get("params", {})
                return await self.execute(name, **params)
        
        tasks = [execute_with_limit(call) for call in calls]
        return await asyncio.gather(*tasks)
    
    def get_tool_info(self, name: str) -> Optional[Dict[str, Any]]:
        """Get information about a tool."""
        tool = self.get(name)
        if tool is None:
            return None
        
        registered = self._tools[name]
        
        return {
            "name": tool.name,
            "description": tool.description,
            "parameters": [p.to_dict() for p in tool.parameters],
            "required_permissions": tool.required_permissions,
            "category": registered.category,
            "tags": registered.tags,
            "enabled": registered.enabled
        }
    
    def get_all_tool_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all tools."""
        return {
            name: self.get_tool_info(name)
            for name in self.list_tools()
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert registry to dictionary."""
        return {
            "tools": {
                name: {
                    "category": rt.category,
                    "tags": rt.tags,
                    "enabled": rt.enabled
                }
                for name, rt in self._tools.items()
            },
            "categories": dict(self._categories),
            "tags": dict(self._tags)
        }
    
    def to_json(self) -> str:
        """Convert registry to JSON string."""
        return json.dumps(self.to_dict(), indent=2)
    
    def create_schema(self) -> Dict[str, Any]:
        """Create JSON schema for all tools."""
        return {
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            p.name: {
                                "type": "string" if p.type == str else 
                                      "integer" if p.type == int else
                                      "number" if p.type == float else
                                      "boolean" if p.type == bool else
                                      "object",
                                "description": p.description
                            }
                            for p in tool.parameters
                        },
                        "required": [
                            p.name for p in tool.parameters if p.required
                        ]
                    }
                }
                for name in self.list_tools()
                for tool in [self.get(name)]
                if tool is not None
            ]
        }


# Global registry instance
_default_registry: Optional[ToolRegistry] = None


def get_registry(permission_manager: Optional[PermissionManager] = None) -> ToolRegistry:
    """Get the global tool registry instance."""
    global _default_registry
    if _default_registry is None:
        _default_registry = ToolRegistry(permission_manager)
    return _default_registry


def set_registry(registry: ToolRegistry) -> None:
    """Set the global tool registry instance."""
    global _default_registry
    _default_registry = registry


def register_default_tools(registry: Optional[ToolRegistry] = None) -> ToolRegistry:
    """
    Register all default tools.
    
    Args:
        registry: Registry to register tools in (creates new if None)
    
    Returns:
        The registry with tools registered
    """
    if registry is None:
        registry = ToolRegistry()
    
    # Import tools
    from .file_tools import (
        ReadTool, WriteTool, EditTool, 
        GlobTool, GrepTool, FindTool, LSTool
    )
    from .bash_tool import BashTool, ShellTool, PipelineTool
    from .code_tools import ViewTool, AnalyzeTool, DependencyTool, CodeSearchTool
    
    # Register file tools
    registry.register(ReadTool, category="file", tags=["read", "file"])
    registry.register(WriteTool, category="file", tags=["write", "file"])
    registry.register(EditTool, category="file", tags=["edit", "file"])
    registry.register(GlobTool, category="file", tags=["search", "file"])
    registry.register(GrepTool, category="file", tags=["search", "content"])
    registry.register(FindTool, category="file", tags=["search", "file"])
    registry.register(LSTool, category="file", tags=["list", "directory"])
    
    # Register bash tools
    registry.register(BashTool, category="shell", tags=["execute", "bash"])
    registry.register(ShellTool, category="shell", tags=["execute", "shell"])
    registry.register(PipelineTool, category="shell", tags=["execute", "pipeline"])
    
    # Register code analysis tools
    registry.register(ViewTool, category="code", tags=["analyze", "view"])
    registry.register(AnalyzeTool, category="code", tags=["analyze", "metrics"])
    registry.register(DependencyTool, category="code", tags=["analyze", "dependencies"])
    registry.register(CodeSearchTool, category="code", tags=["search", "symbols"])
    
    return registry
