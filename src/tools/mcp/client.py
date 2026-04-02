"""
MCP Client

Client for connecting to MCP servers and using external tools.
"""

import json
import uuid
import asyncio
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from pathlib import Path

from .transport import (
    MCPTransport, MCPMessage, MCPResponse,
    StdioTransport, HttpTransport, InMemoryTransport
)


@dataclass
class MCPConfig:
    """Configuration for an MCP server connection."""
    name: str
    transport_type: str  # "stdio", "http", "websocket"
    command: Optional[str] = None
    args: List[str] = field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = field(default_factory=dict)
    cwd: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    timeout: float = 30.0
    enabled: bool = True
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MCPConfig":
        """Create config from dictionary."""
        return cls(
            name=data.get("name", "unnamed"),
            transport_type=data.get("transport_type", "stdio"),
            command=data.get("command"),
            args=data.get("args", []),
            url=data.get("url"),
            env=data.get("env", {}),
            cwd=data.get("cwd"),
            headers=data.get("headers", {}),
            timeout=data.get("timeout", 30.0),
            enabled=data.get("enabled", True)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "transport_type": self.transport_type,
            "command": self.command,
            "args": self.args,
            "url": self.url,
            "env": self.env,
            "cwd": self.cwd,
            "headers": self.headers,
            "timeout": self.timeout,
            "enabled": self.enabled
        }
    
    @classmethod
    def from_json_file(cls, path: Path) -> "MCPConfig":
        """Load config from JSON file."""
        with open(path, 'r') as f:
            data = json.load(f)
        return cls.from_dict(data)


@dataclass
class MCPTool:
    """Represents an MCP tool."""
    name: str
    description: str
    parameters: Dict[str, Any]
    server_name: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "server_name": self.server_name
        }


class MCPClient:
    """
    Client for connecting to MCP servers.
    
    Features:
    - Connect to multiple MCP servers
    - Discover available tools
    - Execute remote tools
    - Handle connection lifecycle
    """
    
    def __init__(self):
        """Initialize the MCP client."""
        self._transports: Dict[str, MCPTransport] = {}
        self._configs: Dict[str, MCPConfig] = {}
        self._tools: Dict[str, MCPTool] = {}
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._message_handlers: List[Callable[[str, MCPMessage], None]] = []
        self._connected: Dict[str, bool] = {}
    
    def add_server(self, config: MCPConfig) -> None:
        """Add an MCP server configuration."""
        self._configs[config.name] = config
    
    def remove_server(self, name: str) -> bool:
        """Remove an MCP server."""
        if name in self._configs:
            del self._configs[name]
            if name in self._transports:
                del self._transports[name]
            if name in self._connected:
                del self._connected[name]
            return True
        return False
    
    async def connect(self, server_name: Optional[str] = None) -> bool:
        """
        Connect to MCP server(s).
        
        Args:
            server_name: Specific server to connect (None = all)
        
        Returns:
            True if all connections successful
        """
        configs = [self._configs[server_name]] if server_name else list(self._configs.values())
        
        all_success = True
        for config in configs:
            if not config.enabled:
                continue
            
            # Create transport
            transport = self._create_transport(config)
            if not transport:
                all_success = False
                continue
            
            self._transports[config.name] = transport
            
            # Connect
            success = await transport.connect()
            self._connected[config.name] = success
            
            if success:
                # Start listening for responses
                asyncio.create_task(self._listen_for_responses(config.name))
                
                # Discover tools
                await self._discover_tools(config.name)
            else:
                all_success = False
        
        return all_success
    
    def _create_transport(self, config: MCPConfig) -> Optional[MCPTransport]:
        """Create transport from config."""
        if config.transport_type == "stdio":
            if not config.command:
                print(f"Command required for stdio transport")
                return None
            return StdioTransport(
                command=config.command,
                args=config.args,
                env=config.env,
                cwd=config.cwd
            )
        elif config.transport_type in ("http", "websocket"):
            if not config.url:
                print(f"URL required for {config.transport_type} transport")
                return None
            return HttpTransport(
                base_url=config.url,
                headers=config.headers,
                timeout=config.timeout
            )
        else:
            print(f"Unknown transport type: {config.transport_type}")
            return None
    
    async def disconnect(self, server_name: Optional[str] = None) -> None:
        """Disconnect from MCP server(s)."""
        names = [server_name] if server_name else list(self._transports.keys())
        
        for name in names:
            if name in self._transports:
                await self._transports[name].disconnect()
                self._connected[name] = False
    
    async def _listen_for_responses(self, server_name: str) -> None:
        """Listen for responses from a server."""
        transport = self._transports.get(server_name)
        if not transport:
            return
        
        while await transport.is_connected():
            try:
                response = await transport.receive()
                if response:
                    # Resolve pending request
                    if response.id in self._pending_requests:
                        future = self._pending_requests.pop(response.id)
                        if not future.done():
                            future.set_result(response)
            except Exception as e:
                print(f"Error receiving from {server_name}: {e}")
                break
    
    async def _discover_tools(self, server_name: str) -> None:
        """Discover tools from a server."""
        response = await self._call_method(server_name, "tools/list", {})
        
        if response and not response.is_error and response.result:
            tools_data = response.result.get("tools", [])
            for tool_data in tools_data:
                tool = MCPTool(
                    name=tool_data.get("name", ""),
                    description=tool_data.get("description", ""),
                    parameters=tool_data.get("parameters", {}),
                    server_name=server_name
                )
                self._tools[tool.name] = tool
    
    async def _call_method(
        self, 
        server_name: str, 
        method: str, 
        params: Dict[str, Any],
        timeout: float = 30.0
    ) -> Optional[MCPResponse]:
        """Call a method on a server."""
        transport = self._transports.get(server_name)
        if not transport:
            return None
        
        message_id = str(uuid.uuid4())
        message = MCPMessage(
            id=message_id,
            method=method,
            params=params
        )
        
        # Create future for response
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[message_id] = future
        
        # Send message
        try:
            await transport.send(message)
        except Exception as e:
            print(f"Error sending message: {e}")
            self._pending_requests.pop(message_id, None)
            return None
        
        # Wait for response
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            self._pending_requests.pop(message_id, None)
            return None
    
    async def call_tool(
        self, 
        tool_name: str, 
        params: Dict[str, Any],
        timeout: float = 60.0
    ) -> Optional[MCPResponse]:
        """
        Call an MCP tool.
        
        Args:
            tool_name: Name of the tool to call
            params: Tool parameters
            timeout: Timeout in seconds
        
        Returns:
            Tool response or None if failed
        """
        tool = self._tools.get(tool_name)
        if not tool:
            print(f"Tool not found: {tool_name}")
            return None
        
        return await self._call_method(
            tool.server_name,
            "tools/call",
            {"name": tool_name, "arguments": params},
            timeout=timeout
        )
    
    def get_tools(self, server_name: Optional[str] = None) -> List[MCPTool]:
        """Get available tools."""
        if server_name:
            return [t for t in self._tools.values() if t.server_name == server_name]
        return list(self._tools.values())
    
    def get_tool(self, name: str) -> Optional[MCPTool]:
        """Get a specific tool."""
        return self._tools.get(name)
    
    def list_servers(self) -> List[str]:
        """List configured server names."""
        return list(self._configs.keys())
    
    def is_connected(self, server_name: str) -> bool:
        """Check if a server is connected."""
        return self._connected.get(server_name, False)
    
    def register_message_handler(
        self, 
        handler: Callable[[str, MCPMessage], None]
    ) -> None:
        """Register a handler for incoming messages."""
        self._message_handlers.append(handler)
    
    def load_config_file(self, path: Path) -> None:
        """Load server configurations from a file."""
        with open(path, 'r') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            for item in data:
                config = MCPConfig.from_dict(item)
                self.add_server(config)
        elif isinstance(data, dict):
            config = MCPConfig.from_dict(data)
            self.add_server(config)
    
    def save_config_file(self, path: Path) -> None:
        """Save server configurations to a file."""
        data = [config.to_dict() for config in self._configs.values()]
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)


class MCPAdapter:
    """
    Adapter to use MCP tools as regular tools.
    
    This allows MCP tools to be registered in the tool registry.
    """
    
    def __init__(self, client: MCPClient):
        self.client = client
    
    async def execute_mcp_tool(
        self, 
        tool_name: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """Execute an MCP tool and return result as dict."""
        response = await self.client.call_tool(tool_name, kwargs)
        
        if not response:
            return {"error": "No response from MCP server"}
        
        if response.is_error:
            return {"error": response.error}
        
        return response.result or {}
    
    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Get tool definitions for all MCP tools."""
        tools = []
        for tool in self.client.get_tools():
            tools.append({
                "name": f"mcp_{tool.name}",
                "description": f"[MCP] {tool.description}",
                "original_name": tool.name,
                "server": tool.server_name,
                "parameters": tool.parameters
            })
        return tools
