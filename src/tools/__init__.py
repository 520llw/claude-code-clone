"""
Claude Code Tool System

A comprehensive tool system for AI agents, providing:
- File operations (read, write, edit, glob, grep, find)
- Command execution (bash, shell)
- Code analysis (AST parsing, dependency analysis)
- Permission management
- MCP (Model Context Protocol) support
"""

from typing import Optional, List

"""
Example Usage:
    ```python
    from claude_code_clone.src.tools import get_registry, register_default_tools
    from claude_code_clone.src.tools.permission import get_permission_manager
    
    # Setup permissions
    pm = get_permission_manager()
    pm.add_trusted_directory("/path/to/project", read=True, write=True)
    
    # Create and register tools
    registry = register_default_tools()
    
    # Execute tools
    result = await registry.execute("read", file_path="example.py")
    print(result.output)
    ```
"""

# Base classes
from .base import (
    Tool,
    ToolResult,
    ToolStatus,
    ToolParameter,
    BatchTool,
    ToolError,
    PermissionError,
    ValidationError,
    TimeoutError,
)

# Permission management
from .permission import (
    PermissionManager,
    PermissionType,
    PermissionLevel,
    PermissionRequest,
    PermissionRule,
    TrustedDirectory,
    get_permission_manager,
    set_permission_manager,
)

# File tools
from .file_tools import (
    ReadTool,
    WriteTool,
    EditTool,
    GlobTool,
    GrepTool,
    FindTool,
    LSTool,
)

# Bash tools
from .bash_tool import (
    BashTool,
    ShellTool,
    PipelineTool,
    ProcessResult,
)

# Code analysis tools
from .code_tools import (
    ViewTool,
    AnalyzeTool,
    DependencyTool,
    CodeSearchTool,
    ASTAnalyzer,
    CodeSymbol,
)

# Registry
from .registry import (
    ToolRegistry,
    RegisteredTool,
    get_registry,
    set_registry,
    register_default_tools,
)

# MCP support
from .mcp import (
    MCPClient,
    MCPConfig,
    MCPTool,
    MCPServer,
    MCPRequest,
    MCPResponse,
    MCPTransport,
    StdioTransport,
    HttpTransport,
)

__version__ = "1.0.0"

__all__ = [
    # Base
    "Tool",
    "ToolResult",
    "ToolStatus",
    "ToolParameter",
    "BatchTool",
    "ToolError",
    "PermissionError",
    "ValidationError",
    "TimeoutError",
    
    # Permission
    "PermissionManager",
    "PermissionType",
    "PermissionLevel",
    "PermissionRequest",
    "PermissionRule",
    "TrustedDirectory",
    "get_permission_manager",
    "set_permission_manager",
    
    # File tools
    "ReadTool",
    "WriteTool",
    "EditTool",
    "GlobTool",
    "GrepTool",
    "FindTool",
    "LSTool",
    
    # Bash tools
    "BashTool",
    "ShellTool",
    "PipelineTool",
    "ProcessResult",
    
    # Code tools
    "ViewTool",
    "AnalyzeTool",
    "DependencyTool",
    "CodeSearchTool",
    "ASTAnalyzer",
    "CodeSymbol",
    
    # Registry
    "ToolRegistry",
    "RegisteredTool",
    "get_registry",
    "set_registry",
    "register_default_tools",
    
    # MCP
    "MCPClient",
    "MCPConfig",
    "MCPTool",
    "MCPServer",
    "MCPRequest",
    "MCPResponse",
    "MCPTransport",
    "StdioTransport",
    "HttpTransport",
]


def create_default_toolkit(
    trusted_paths: Optional[list] = None,
    auto_approve_read: bool = True,
    auto_approve_write: bool = False
) -> ToolRegistry:
    """
    Create a default toolkit with common configuration.
    
    Args:
        trusted_paths: List of paths to trust
        auto_approve_read: Auto-approve read operations
        auto_approve_write: Auto-approve write operations
    
    Returns:
        Configured ToolRegistry
    """
    # Setup permission manager
    pm = get_permission_manager()
    
    # Add trusted paths
    if trusted_paths:
        for path in trusted_paths:
            pm.add_trusted_directory(
                path, 
                read_allowed=True, 
                write_allowed=True
            )
    
    # Set auto-approve
    if auto_approve_read:
        pm.set_auto_approve(PermissionType.READ, True)
    if auto_approve_write:
        pm.set_auto_approve(PermissionType.WRITE, True)
    
    # Create and return registry
    return register_default_tools()
