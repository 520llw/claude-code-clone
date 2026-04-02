"""
MCP Transport Layer

Provides transport mechanisms for MCP communication.
"""

import asyncio
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Callable, AsyncIterator
from dataclasses import dataclass

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    aiohttp = None


@dataclass
class MCPMessage:
    """An MCP message."""
    id: str
    method: str
    params: Dict[str, Any]
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps({
            "jsonrpc": "2.0",
            "id": self.id,
            "method": self.method,
            "params": self.params
        })
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MCPMessage":
        """Create from dictionary."""
        return cls(
            id=data.get("id", ""),
            method=data.get("method", ""),
            params=data.get("params", {})
        )


@dataclass
class MCPResponse:
    """An MCP response."""
    id: str
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        data = {
            "jsonrpc": "2.0",
            "id": self.id
        }
        if self.error:
            data["error"] = self.error
        else:
            data["result"] = self.result
        return json.dumps(data)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MCPResponse":
        """Create from dictionary."""
        return cls(
            id=data.get("id", ""),
            result=data.get("result"),
            error=data.get("error")
        )
    
    @property
    def is_error(self) -> bool:
        """Check if response is an error."""
        return self.error is not None


class MCPTransport(ABC):
    """Abstract base class for MCP transports."""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the transport."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the transport."""
        pass
    
    @abstractmethod
    async def send(self, message: MCPMessage) -> None:
        """Send a message."""
        pass
    
    @abstractmethod
    async def receive(self) -> Optional[MCPResponse]:
        """Receive a response."""
        pass
    
    @abstractmethod
    async def is_connected(self) -> bool:
        """Check if transport is connected."""
        pass


class StdioTransport(MCPTransport):
    """Transport using stdin/stdout."""
    
    def __init__(
        self, 
        command: str,
        args: Optional[list] = None,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None
    ):
        self.command = command
        self.args = args or []
        self.env = env
        self.cwd = cwd
        self._process: Optional[asyncio.subprocess.Process] = None
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
    
    async def connect(self) -> bool:
        """Start the subprocess and connect to it."""
        try:
            self._process = await asyncio.create_subprocess_exec(
                self.command,
                *self.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self.env,
                cwd=self.cwd
            )
            self._reader = self._process.stdout
            return True
        except Exception as e:
            print(f"Failed to start subprocess: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Terminate the subprocess."""
        if self._process:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()
                await self._process.wait()
            self._process = None
    
    async def send(self, message: MCPMessage) -> None:
        """Send a message to the subprocess."""
        if not self._process or not self._process.stdin:
            raise ConnectionError("Not connected")
        
        data = message.to_json() + "\n"
        self._process.stdin.write(data.encode())
        await self._process.stdin.drain()
    
    async def receive(self) -> Optional[MCPResponse]:
        """Receive a response from the subprocess."""
        if not self._process or not self._process.stdout:
            raise ConnectionError("Not connected")
        
        try:
            line = await asyncio.wait_for(
                self._process.stdout.readline(),
                timeout=30.0
            )
            
            if not line:
                return None
            
            data = json.loads(line.decode().strip())
            return MCPResponse.from_dict(data)
            
        except asyncio.TimeoutError:
            return None
        except json.JSONDecodeError as e:
            return MCPResponse(
                id="",
                error={"code": -32700, "message": f"Parse error: {e}"}
            )
    
    async def is_connected(self) -> bool:
        """Check if subprocess is running."""
        return self._process is not None and self._process.returncode is None
    
    async def read_stderr(self) -> str:
        """Read from stderr."""
        if self._process and self._process.stderr:
            data = await self._process.stderr.read()
            return data.decode()
        return ""


class HttpTransport(MCPTransport):
    """Transport using HTTP/WebSocket."""
    
    def __init__(
        self, 
        base_url: str,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0
    ):
        if not HAS_AIOHTTP:
            raise ImportError("aiohttp is required for HttpTransport. Install with: pip install aiohttp")
        
        self.base_url = base_url.rstrip('/')
        self.headers = headers or {}
        self.timeout = timeout
        self._session: Optional['aiohttp.ClientSession'] = None
        self._websocket: Optional['aiohttp.ClientWebSocketResponse'] = None
    
    async def connect(self) -> bool:
        """Connect to HTTP endpoint."""
        try:
            self._session = aiohttp.ClientSession(headers=self.headers)
            
            # Try WebSocket first
            ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
            try:
                self._websocket = await self._session.ws_connect(
                    f"{ws_url}/ws",
                    timeout=self.timeout
                )
            except Exception:
                # Fall back to HTTP
                self._websocket = None
            
            return True
        except Exception as e:
            print(f"Failed to connect: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from HTTP endpoint."""
        if self._websocket:
            await self._websocket.close()
            self._websocket = None
        
        if self._session:
            await self._session.close()
            self._session = None
    
    async def send(self, message: MCPMessage) -> None:
        """Send a message."""
        if self._websocket:
            await self._websocket.send_str(message.to_json())
        else:
            # HTTP POST
            async with self._session.post(
                f"{self.base_url}/rpc",
                json={
                    "jsonrpc": "2.0",
                    "id": message.id,
                    "method": message.method,
                    "params": message.params
                },
                timeout=self.timeout
            ) as response:
                # Response will be handled separately
                pass
    
    async def receive(self) -> Optional[MCPResponse]:
        """Receive a response."""
        if self._websocket:
            msg = await self._websocket.receive()
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                return MCPResponse.from_dict(data)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                return MCPResponse(
                    id="",
                    error={"code": -32000, "message": "WebSocket error"}
                )
        return None
    
    async def is_connected(self) -> bool:
        """Check if connected."""
        if self._websocket:
            return not self._websocket.closed
        return self._session is not None and not self._session.closed
    
    async def post_request(self, message: MCPMessage) -> MCPResponse:
        """Send request via HTTP POST and wait for response."""
        if not self._session:
            raise ConnectionError("Not connected")
        
        async with self._session.post(
            f"{self.base_url}/rpc",
            json={
                "jsonrpc": "2.0",
                "id": message.id,
                "method": message.method,
                "params": message.params
            },
            timeout=self.timeout
        ) as response:
            data = await response.json()
            return MCPResponse.from_dict(data)


class InMemoryTransport(MCPTransport):
    """In-memory transport for testing."""
    
    def __init__(self, handler: Optional[Callable[[MCPMessage], MCPResponse]] = None):
        self.handler = handler
        self._connected = False
        self._message_queue: asyncio.Queue[MCPMessage] = asyncio.Queue()
        self._response_queue: asyncio.Queue[MCPResponse] = asyncio.Queue()
    
    async def connect(self) -> bool:
        """Connect (no-op for in-memory)."""
        self._connected = True
        return True
    
    async def disconnect(self) -> None:
        """Disconnect (no-op for in-memory)."""
        self._connected = False
    
    async def send(self, message: MCPMessage) -> None:
        """Send a message."""
        if self.handler:
            response = self.handler(message)
            await self._response_queue.put(response)
        else:
            await self._message_queue.put(message)
    
    async def receive(self) -> Optional[MCPResponse]:
        """Receive a response."""
        try:
            return await asyncio.wait_for(
                self._response_queue.get(),
                timeout=1.0
            )
        except asyncio.TimeoutError:
            return None
    
    async def is_connected(self) -> bool:
        """Check if connected."""
        return self._connected
    
    async def inject_response(self, response: MCPResponse) -> None:
        """Inject a response (for testing)."""
        await self._response_queue.put(response)
    
    async def get_next_message(self) -> Optional[MCPMessage]:
        """Get next message (for testing)."""
        try:
            return await asyncio.wait_for(
                self._message_queue.get(),
                timeout=1.0
            )
        except asyncio.TimeoutError:
            return None
