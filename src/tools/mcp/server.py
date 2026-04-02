"""
MCP Server

Server implementation for hosting MCP tools.
"""

import json
import asyncio
from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass
from abc import ABC, abstractmethod

from .transport import MCPTransport, MCPMessage, MCPResponse


@dataclass
class MCPRequest:
    """An MCP request."""
    id: str
    method: str
    params: Dict[str, Any]
    
    @classmethod
    def from_message(cls, message: MCPMessage) -> "MCPRequest":
        """Create from MCP message."""
        return cls(
            id=message.id,
            method=message.method,
            params=message.params
        )


class MCPToolHandler(ABC):
    """Abstract base class for MCP tool handlers."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name."""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Tool description."""
        pass
    
    @property
    def parameters(self) -> Dict[str, Any]:
        """Tool parameters schema."""
        return {
            "type": "object",
            "properties": {}
        }
    
    @abstractmethod
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool."""
        pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to tool definition."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters
        }


class MCPServer:
    """
    MCP Server for hosting tools.
    
    Features:
    - Register tool handlers
    - Handle incoming requests
    - Support multiple transports
    """
    
    def __init__(self, name: str = "mcp-server"):
        """Initialize the MCP server."""
        self.name = name
        self._handlers: Dict[str, MCPToolHandler] = {}
        self._transports: List[MCPTransport] = []
        self._running = False
        self._request_handlers: Dict[str, Callable[[MCPRequest], Awaitable[MCPResponse]]] = {
            "tools/list": self._handle_tools_list,
            "tools/call": self._handle_tools_call,
        }
    
    def register_handler(self, handler: MCPToolHandler) -> None:
        """Register a tool handler."""
        self._handlers[handler.name] = handler
    
    def unregister_handler(self, name: str) -> bool:
        """Unregister a tool handler."""
        if name in self._handlers:
            del self._handlers[name]
            return True
        return False
    
    def add_transport(self, transport: MCPTransport) -> None:
        """Add a transport."""
        self._transports.append(transport)
    
    def register_method_handler(
        self, 
        method: str, 
        handler: Callable[[MCPRequest], Awaitable[MCPResponse]]
    ) -> None:
        """Register a custom method handler."""
        self._request_handlers[method] = handler
    
    async def start(self) -> None:
        """Start the server."""
        self._running = True
        
        # Connect all transports
        for transport in self._transports:
            await transport.connect()
        
        # Start handling requests
        tasks = [
            asyncio.create_task(self._handle_transport(transport))
            for transport in self._transports
        ]
        
        await asyncio.gather(*tasks)
    
    async def stop(self) -> None:
        """Stop the server."""
        self._running = False
        
        for transport in self._transports:
            await transport.disconnect()
    
    async def _handle_transport(self, transport: MCPTransport) -> None:
        """Handle requests from a transport."""
        while self._running and await transport.is_connected():
            try:
                response = await transport.receive()
                if response:
                    # This shouldn't happen for requests
                    pass
            except Exception:
                # Handle request
                pass
    
    async def handle_message(self, message: MCPMessage) -> MCPResponse:
        """Handle an incoming message."""
        request = MCPRequest.from_message(message)
        
        handler = self._request_handlers.get(request.method)
        if not handler:
            return MCPResponse(
                id=request.id,
                error={
                    "code": -32601,
                    "message": f"Method not found: {request.method}"
                }
            )
        
        try:
            return await handler(request)
        except Exception as e:
            return MCPResponse(
                id=request.id,
                error={
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            )
    
    async def _handle_tools_list(self, request: MCPRequest) -> MCPResponse:
        """Handle tools/list request."""
        tools = [handler.to_dict() for handler in self._handlers.values()]
        
        return MCPResponse(
            id=request.id,
            result={"tools": tools}
        )
    
    async def _handle_tools_call(self, request: MCPRequest) -> MCPResponse:
        """Handle tools/call request."""
        tool_name = request.params.get("name")
        arguments = request.params.get("arguments", {})
        
        handler = self._handlers.get(tool_name)
        if not handler:
            return MCPResponse(
                id=request.id,
                error={
                    "code": -32602,
                    "message": f"Tool not found: {tool_name}"
                }
            )
        
        try:
            result = await handler.execute(arguments)
            return MCPResponse(
                id=request.id,
                result=result
            )
        except Exception as e:
            return MCPResponse(
                id=request.id,
                error={
                    "code": -32603,
                    "message": f"Tool execution error: {str(e)}"
                }
            )


class SimpleMCPHandler(MCPToolHandler):
    """Simple handler that wraps a function."""
    
    def __init__(
        self, 
        name: str, 
        description: str,
        func: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]],
        parameters: Optional[Dict[str, Any]] = None
    ):
        self._name = name
        self._description = description
        self._func = func
        self._parameters = parameters or {"type": "object", "properties": {}}
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return self._parameters
    
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return await self._func(params)


class FileReadHandler(MCPToolHandler):
    """Handler for reading files."""
    
    @property
    def name(self) -> str:
        return "read_file"
    
    @property
    def description(self) -> str:
        return "Read the contents of a file"
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to read"
                },
                "offset": {
                    "type": "integer",
                    "description": "Line number to start from"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum lines to read"
                }
            },
            "required": ["file_path"]
        }
    
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        from pathlib import Path
        
        file_path = params.get("file_path")
        offset = params.get("offset", 1)
        limit = params.get("limit", 1000)
        
        try:
            path = Path(file_path)
            
            if not path.exists():
                return {"error": f"File not found: {file_path}"}
            
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
            
            start_idx = max(0, offset - 1)
            end_idx = min(len(lines), start_idx + limit)
            
            selected_lines = lines[start_idx:end_idx]
            content = "".join(selected_lines)
            
            return {
                "content": content,
                "total_lines": len(lines),
                "start_line": start_idx + 1,
                "end_line": end_idx
            }
            
        except Exception as e:
            return {"error": str(e)}


class FileWriteHandler(MCPToolHandler):
    """Handler for writing files."""
    
    @property
    def name(self) -> str:
        return "write_file"
    
    @property
    def description(self) -> str:
        return "Write content to a file"
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write"
                }
            },
            "required": ["file_path", "content"]
        }
    
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        from pathlib import Path
        
        file_path = params.get("file_path")
        content = params.get("content", "")
        
        try:
            path = Path(file_path)
            
            # Create parent directories
            path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return {
                "success": True,
                "bytes_written": len(content.encode('utf-8'))
            }
            
        except Exception as e:
            return {"error": str(e)}


class BashHandler(MCPToolHandler):
    """Handler for executing bash commands."""
    
    @property
    def name(self) -> str:
        return "execute_command"
    
    @property
    def description(self) -> str:
        return "Execute a bash command"
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Command to execute"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds"
                },
                "cwd": {
                    "type": "string",
                    "description": "Working directory"
                }
            },
            "required": ["command"]
        }
    
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        import asyncio
        
        command = params.get("command")
        timeout = params.get("timeout", 60)
        cwd = params.get("cwd")
        
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
                
                return {
                    "stdout": stdout.decode('utf-8', errors='replace'),
                    "stderr": stderr.decode('utf-8', errors='replace'),
                    "returncode": process.returncode
                }
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return {"error": "Command timed out"}
                
        except Exception as e:
            return {"error": str(e)}


def create_default_server() -> MCPServer:
    """Create a server with default handlers."""
    server = MCPServer("claude-code-mcp")
    
    # Register default handlers
    server.register_handler(FileReadHandler())
    server.register_handler(FileWriteHandler())
    server.register_handler(BashHandler())
    
    return server
