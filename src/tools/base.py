"""
Claude Code Tool System - Base Classes

This module defines the base classes for all tools in the system.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Type, Union
from pathlib import Path
import json
import asyncio
from datetime import datetime


class ToolStatus(Enum):
    """Status of tool execution."""
    SUCCESS = auto()
    ERROR = auto()
    PERMISSION_DENIED = auto()
    TIMEOUT = auto()
    CANCELLED = auto()


@dataclass
class ToolResult:
    """Result of a tool execution."""
    status: ToolStatus
    output: Any = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time_ms: Optional[float] = None
    
    def is_success(self) -> bool:
        """Check if the tool execution was successful."""
        return self.status == ToolStatus.SUCCESS
    
    def is_error(self) -> bool:
        """Check if the tool execution resulted in an error."""
        return self.status == ToolStatus.ERROR
    
    def is_permission_denied(self) -> bool:
        """Check if the tool execution was denied due to permissions."""
        return self.status == ToolStatus.PERMISSION_DENIED
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "status": self.status.name,
            "output": self.output,
            "error_message": self.error_message,
            "metadata": self.metadata,
            "execution_time_ms": self.execution_time_ms
        }
    
    def to_json(self) -> str:
        """Convert result to JSON string."""
        return json.dumps(self.to_dict(), indent=2, default=str)
    
    @classmethod
    def success(
        cls, 
        output: Any = None, 
        metadata: Optional[Dict[str, Any]] = None,
        execution_time_ms: Optional[float] = None
    ) -> "ToolResult":
        """Create a successful result."""
        return cls(
            status=ToolStatus.SUCCESS,
            output=output,
            metadata=metadata or {},
            execution_time_ms=execution_time_ms
        )
    
    @classmethod
    def error(
        cls, 
        message: str, 
        output: Any = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "ToolResult":
        """Create an error result."""
        return cls(
            status=ToolStatus.ERROR,
            output=output,
            error_message=message,
            metadata=metadata or {}
        )
    
    @classmethod
    def permission_denied(
        cls, 
        action: str, 
        target: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "ToolResult":
        """Create a permission denied result."""
        return cls(
            status=ToolStatus.PERMISSION_DENIED,
            error_message=f"Permission denied: {action} on {target}",
            metadata={"action": action, "target": target, **(metadata or {})}
        )
    
    @classmethod
    def timeout(
        cls, 
        timeout_seconds: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "ToolResult":
        """Create a timeout result."""
        return cls(
            status=ToolStatus.TIMEOUT,
            error_message=f"Operation timed out after {timeout_seconds} seconds",
            metadata={"timeout_seconds": timeout_seconds, **(metadata or {})}
        )


@dataclass
class ToolParameter:
    """Definition of a tool parameter."""
    name: str
    type: Type
    description: str
    required: bool = True
    default: Any = None
    enum_values: Optional[List[str]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert parameter definition to dictionary."""
        result = {
            "name": self.name,
            "type": self.type.__name__,
            "description": self.description,
            "required": self.required
        }
        if self.default is not None:
            result["default"] = self.default
        if self.enum_values is not None:
            result["enum"] = self.enum_values
        return result


class Tool(ABC):
    """Abstract base class for all tools."""
    
    def __init__(self, permission_manager: Optional[Any] = None):
        """Initialize the tool with optional permission manager."""
        self.permission_manager = permission_manager
        self._execution_count = 0
        self._last_execution_time: Optional[datetime] = None
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the name of the tool."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Return a description of what the tool does."""
        pass
    
    @property
    def parameters(self) -> List[ToolParameter]:
        """Return the parameters this tool accepts."""
        return []
    
    @property
    def required_permissions(self) -> List[str]:
        """Return the permissions required to use this tool."""
        return []
    
    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool with the given parameters."""
        pass
    
    async def execute_with_timing(self, **kwargs) -> ToolResult:
        """Execute the tool and measure execution time."""
        import time
        start_time = time.time()
        
        try:
            result = await self.execute(**kwargs)
        except asyncio.TimeoutError:
            timeout = kwargs.get('timeout', 30)
            return ToolResult.timeout(timeout)
        except Exception as e:
            result = ToolResult.error(str(e))
        
        execution_time = (time.time() - start_time) * 1000
        result.execution_time_ms = execution_time
        
        self._execution_count += 1
        self._last_execution_time = datetime.now()
        
        return result
    
    def validate_parameters(self, **kwargs) -> Optional[str]:
        """Validate the provided parameters."""
        for param in self.parameters:
            if param.required and param.name not in kwargs:
                return f"Missing required parameter: {param.name}"
            
            if param.name in kwargs:
                value = kwargs[param.name]
                if param.enum_values and value not in param.enum_values:
                    return f"Invalid value for {param.name}: {value}. Must be one of {param.enum_values}"
                
                # Type checking (with some flexibility)
                if param.type == int and not isinstance(value, int):
                    try:
                        int(value)
                    except (ValueError, TypeError):
                        return f"Parameter {param.name} must be an integer"
                elif param.type == float and not isinstance(value, (int, float)):
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        return f"Parameter {param.name} must be a number"
                elif param.type == str and not isinstance(value, str):
                    pass  # Allow conversion to string
                elif param.type == bool and not isinstance(value, bool):
                    if value not in (True, False, 0, 1, "true", "false", "True", "False"):
                        return f"Parameter {param.name} must be a boolean"
        
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool definition to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": [p.to_dict() for p in self.parameters],
            "required_permissions": self.required_permissions,
            "execution_count": self._execution_count,
            "last_execution_time": self._last_execution_time.isoformat() if self._last_execution_time else None
        }
    
    def to_json(self) -> str:
        """Convert tool definition to JSON string."""
        return json.dumps(self.to_dict(), indent=2, default=str)


class BatchTool(Tool):
    """Base class for tools that can be executed in batch."""
    
    @abstractmethod
    async def execute_batch(self, items: List[Dict[str, Any]]) -> List[ToolResult]:
        """Execute the tool on multiple items."""
        pass


class ToolError(Exception):
    """Exception raised by tools."""
    pass


class PermissionError(ToolError):
    """Exception raised when permission is denied."""
    pass


class ValidationError(ToolError):
    """Exception raised when parameter validation fails."""
    pass


class TimeoutError(ToolError):
    """Exception raised when tool execution times out."""
    pass
