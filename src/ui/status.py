"""
Status Display for Claude Code Terminal UI
Shows current status, progress, and session information
"""

import time
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum, auto

from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.layout import Layout
from rich.live import Live
from rich.console import Console, Group
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
    TimeRemainingColumn,
)

from .styles import get_styles, UIStyles
from .themes import get_current_theme


class ConnectionStatus(Enum):
    """Connection status enumeration"""
    CONNECTED = auto()
    CONNECTING = auto()
    DISCONNECTED = auto()
    ERROR = auto()


class SessionState(Enum):
    """Session state enumeration"""
    IDLE = auto()
    PROCESSING = auto()
    STREAMING = auto()
    WAITING = auto()
    ERROR = auto()


@dataclass
class TokenUsage:
    """Token usage statistics"""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    
    def add(self, input_tokens: int = 0, output_tokens: int = 0):
        """Add token usage"""
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.total_tokens = self.input_tokens + self.output_tokens
    
    def reset(self):
        """Reset token usage"""
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0
    
    def format(self) -> str:
        """Format token usage for display"""
        return f"In: {self.input_tokens:,} | Out: {self.output_tokens:,} | Total: {self.total_tokens:,}"


@dataclass
class ToolExecution:
    """Tool execution information"""
    tool_name: str
    status: str = "running"
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    
    @property
    def duration(self) -> float:
        """Get execution duration"""
        end = self.end_time or time.time()
        return end - self.start_time
    
    def complete(self, result: Any = None):
        """Mark execution as complete"""
        self.status = "completed"
        self.end_time = time.time()
        self.result = result
    
    def fail(self, error: str):
        """Mark execution as failed"""
        self.status = "failed"
        self.end_time = time.time()
        self.error = error
    
    def format(self) -> Text:
        """Format for display"""
        styles = get_styles()
        
        if self.status == "running":
            status_text = Text("● ", style=styles.status_busy)
        elif self.status == "completed":
            status_text = Text("✓ ", style=styles.status_online)
        else:
            status_text = Text("✗ ", style=styles.status_offline)
        
        name_text = Text(self.tool_name, style=styles.base)
        duration_text = Text(f" ({self.duration:.2f}s)", style=styles.muted)
        
        return Text.assemble(status_text, name_text, duration_text)


@dataclass
class SessionInfo:
    """Session information"""
    session_id: str
    start_time: datetime = field(default_factory=datetime.now)
    model: str = "claude-3-sonnet-20240229"
    connection_status: ConnectionStatus = ConnectionStatus.CONNECTED
    state: SessionState = SessionState.IDLE
    token_usage: TokenUsage = field(default_factory=TokenUsage)
    message_count: int = 0
    
    @property
    def duration(self) -> timedelta:
        """Get session duration"""
        return datetime.now() - self.start_time
    
    @property
    def duration_formatted(self) -> str:
        """Get formatted session duration"""
        duration = self.duration
        hours, remainder = divmod(int(duration.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
    
    def format(self) -> Text:
        """Format session info for display"""
        styles = get_styles()
        
        parts = [
            Text(f"Session: ", style=styles.muted),
            Text(self.session_id[:8], style=styles.secondary),
            Text(" | ", style=styles.muted),
            Text(f"Model: ", style=styles.muted),
            Text(self.model, style=styles.info),
            Text(" | ", style=styles.muted),
            Text(f"Duration: ", style=styles.muted),
            Text(self.duration_formatted, style=styles.base),
        ]
        
        return Text.assemble(*parts)


class StatusBar:
    """Status bar component"""
    
    def __init__(self):
        self.styles = get_styles()
        self.session_info: Optional[SessionInfo] = None
        self.current_tool: Optional[ToolExecution] = None
        self.spinner_frame: int = 0
    
    def set_session_info(self, info: SessionInfo):
        """Set session information"""
        self.session_info = info
    
    def set_current_tool(self, tool: Optional[ToolExecution]):
        """Set current tool execution"""
        self.current_tool = tool
    
    def update_spinner(self):
        """Update spinner frame"""
        self.spinner_frame = (self.spinner_frame + 1) % 10
    
    def render(self) -> Panel:
        """Render status bar"""
        if not self.session_info:
            return Panel(Text("No active session", style=self.styles.muted))
        
        # Build status line
        status_parts = []
        
        # Connection status
        if self.session_info.connection_status == ConnectionStatus.CONNECTED:
            status_parts.append(Text("●", style=self.styles.status_online))
        elif self.session_info.connection_status == ConnectionStatus.CONNECTING:
            status_parts.append(self.styles.create_spinner_frame(self.spinner_frame))
        else:
            status_parts.append(Text("●", style=self.styles.status_offline))
        
        status_parts.append(Text(" ", style=self.styles.base))
        
        # Session state
        state_text = self.session_info.state.name.lower()
        if self.session_info.state == SessionState.PROCESSING:
            status_parts.append(Text(f"{state_text}", style=self.styles.status_busy))
        elif self.session_info.state == SessionState.ERROR:
            status_parts.append(Text(f"{state_text}", style=self.styles.status_offline))
        else:
            status_parts.append(Text(f"{state_text}", style=self.styles.base))
        
        status_parts.append(Text(" | ", style=self.styles.muted))
        
        # Token usage
        status_parts.append(Text(self.session_info.token_usage.format(), style=self.styles.base))
        
        status_parts.append(Text(" | ", style=self.styles.muted))
        
        # Message count
        status_parts.append(Text(f"Msgs: {self.session_info.message_count}", style=self.styles.base))
        
        status_parts.append(Text(" | ", style=self.styles.muted))
        
        # Duration
        status_parts.append(Text(self.session_info.duration_formatted, style=self.styles.base))
        
        # Current tool
        if self.current_tool:
            status_parts.append(Text(" | ", style=self.styles.muted))
            status_parts.append(self.current_tool.format())
        
        content = Text.assemble(*status_parts)
        
        return Panel(
            content,
            box=self.styles.get_box_style(),
            border_style=self.styles.theme.colors.border,
            padding=(0, 1),
            height=3,
        )


class ProgressIndicator:
    """Progress indicator for long-running operations"""
    
    def __init__(self, description: str = "Processing..."):
        self.styles = get_styles()
        self.description = description
        self.progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=Console(),
            transient=True,
        )
        self.task_id: Optional[int] = None
    
    def start(self, total: Optional[int] = None):
        """Start progress indicator"""
        self.task_id = self.progress.add_task(self.description, total=total)
        return self
    
    def update(self, advance: float = 1):
        """Update progress"""
        if self.task_id is not None:
            self.progress.update(self.task_id, advance=advance)
    
    def complete(self):
        """Complete progress"""
        if self.task_id is not None:
            self.progress.update(self.task_id, completed=True)
    
    def __enter__(self):
        self.progress.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.progress.stop()


class StatusManager:
    """Manages all status information"""
    
    def __init__(self):
        self.styles = get_styles()
        self.session_info: Optional[SessionInfo] = None
        self.tool_history: List[ToolExecution] = []
        self.current_tool: Optional[ToolExecution] = None
        self.status_bar = StatusBar()
        self._console = Console()
    
    def create_session(self, session_id: str, model: str = "claude-3-sonnet-20240229"):
        """Create a new session"""
        self.session_info = SessionInfo(
            session_id=session_id,
            model=model,
        )
        self.status_bar.set_session_info(self.session_info)
        self.tool_history = []
        self.current_tool = None
    
    def set_state(self, state: SessionState):
        """Set session state"""
        if self.session_info:
            self.session_info.state = state
    
    def set_connection_status(self, status: ConnectionStatus):
        """Set connection status"""
        if self.session_info:
            self.session_info.connection_status = status
    
    def add_tokens(self, input_tokens: int = 0, output_tokens: int = 0):
        """Add token usage"""
        if self.session_info:
            self.session_info.token_usage.add(input_tokens, output_tokens)
    
    def increment_message_count(self):
        """Increment message count"""
        if self.session_info:
            self.session_info.message_count += 1
    
    def start_tool(self, tool_name: str) -> ToolExecution:
        """Start a tool execution"""
        tool = ToolExecution(tool_name=tool_name)
        self.current_tool = tool
        self.status_bar.set_current_tool(tool)
        return tool
    
    def complete_tool(self, result: Any = None):
        """Complete current tool execution"""
        if self.current_tool:
            self.current_tool.complete(result)
            self.tool_history.append(self.current_tool)
            self.current_tool = None
            self.status_bar.set_current_tool(None)
    
    def fail_tool(self, error: str):
        """Fail current tool execution"""
        if self.current_tool:
            self.current_tool.fail(error)
            self.tool_history.append(self.current_tool)
            self.current_tool = None
            self.status_bar.set_current_tool(None)
    
    def get_status_bar(self) -> Panel:
        """Get status bar panel"""
        return self.status_bar.render()
    
    def get_session_panel(self) -> Panel:
        """Get session information panel"""
        if not self.session_info:
            return Panel(Text("No active session", style=self.styles.muted), title="Session")
        
        table = Table(show_header=False, box=None)
        table.add_column(style=self.styles.muted)
        table.add_column(style=self.styles.base)
        
        table.add_row("Session ID:", self.session_info.session_id)
        table.add_row("Model:", self.session_info.model)
        table.add_row("Status:", self.session_info.connection_status.name)
        table.add_row("State:", self.session_info.state.name)
        table.add_row("Duration:", self.session_info.duration_formatted)
        table.add_row("Messages:", str(self.session_info.message_count))
        table.add_row("Tokens:", self.session_info.token_usage.format())
        
        return Panel(table, title="Session Info", border_style=self.styles.theme.colors.border)
    
    def get_tools_panel(self) -> Panel:
        """Get tool execution history panel"""
        if not self.tool_history:
            return Panel(Text("No tool executions", style=self.styles.muted), title="Tool History")
        
        # Show last 10 tools
        recent_tools = self.tool_history[-10:]
        
        table = Table(show_header=True, box=None)
        table.add_column("Tool", style=self.styles.syntax_keyword)
        table.add_column("Status", style=self.styles.base)
        table.add_column("Duration", style=self.styles.muted)
        
        for tool in reversed(recent_tools):
            status_style = (
                self.styles.status_online if tool.status == "completed"
                else self.styles.status_offline if tool.status == "failed"
                else self.styles.status_busy
            )
            table.add_row(
                tool.tool_name,
                Text(tool.status, style=status_style),
                f"{tool.duration:.2f}s"
            )
        
        return Panel(table, title="Tool History", border_style=self.styles.theme.colors.border)
    
    def get_full_status(self) -> Layout:
        """Get full status layout"""
        layout = Layout()
        
        # Split into sections
        layout.split_column(
            Layout(name="status_bar", size=3),
            Layout(name="content"),
        )
        
        # Split content into columns
        layout["content"].split_row(
            Layout(name="session", ratio=1),
            Layout(name="tools", ratio=1),
        )
        
        # Set content
        layout["status_bar"].update(self.get_status_bar())
        layout["session"].update(self.get_session_panel())
        layout["tools"].update(self.get_tools_panel())
        
        return layout
    
    def display_status(self):
        """Display full status"""
        self._console.print(self.get_full_status())
    
    def create_progress(self, description: str = "Processing...") -> ProgressIndicator:
        """Create a progress indicator"""
        return ProgressIndicator(description)


# Global status manager instance
_status_manager: Optional[StatusManager] = None


def get_status_manager() -> StatusManager:
    """Get the global status manager instance"""
    global _status_manager
    if _status_manager is None:
        _status_manager = StatusManager()
    return _status_manager


def reset_status_manager():
    """Reset the global status manager"""
    global _status_manager
    _status_manager = StatusManager()
