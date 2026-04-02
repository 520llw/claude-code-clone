"""
Main UI for Claude Code Terminal UI
Main interface integrating all components
"""

import asyncio
import sys
from typing import Optional, Dict, Any, AsyncIterator, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto

from rich.console import Console, Group
from rich.text import Text
from rich.panel import Panel
from rich.layout import Layout
from rich.live import Live
from rich.prompt import Prompt
from rich.align import Align
from rich.padding import Padding
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from .themes import get_current_theme, theme_manager, set_theme
from .styles import get_styles, refresh_styles, create_info_box, create_error_box, create_success_box
from .chat import (
    ChatInterface, Message, MessageRole, MessageType,
    get_chat_interface, StreamingResponseHandler
)
from .commands import (
    CommandRegistry, CommandResult, get_command_registry,
    is_command, execute_command, get_command_completions
)
from .status import (
    StatusManager, SessionInfo, SessionState, ConnectionStatus,
    get_status_manager, TokenUsage
)
from .file_browser import FileBrowser, get_file_browser
from .config_ui import ConfigUI, get_config_ui, get_config_manager


class UIMode(Enum):
    """UI mode enumeration"""
    CHAT = auto()
    FILE_BROWSER = auto()
    CONFIG = auto()
    HELP = auto()


@dataclass
class UIState:
    """UI state"""
    mode: UIMode = UIMode.CHAT
    is_running: bool = False
    session_id: str = ""
    current_input: str = ""
    show_status_bar: bool = True
    show_help: bool = False
    last_error: Optional[str] = None


class InputHandler:
    """Handles user input with command completion"""
    
    def __init__(self, console: Console):
        self.console = console
        self.styles = get_styles()
        self.history: list[str] = []
        self.history_index = 0
        self.current_input = ""
        self.completion_index = 0
        self.completions: list[str] = []
    
    def get_input(self, prompt: str = "❯ ") -> str:
        """Get user input with history and completion support"""
        try:
            # Use rich prompt for better styling
            user_input = Prompt.ask(
                Text(prompt, style=self.styles.input_prompt),
                console=self.console,
            )
            
            if user_input:
                self.history.append(user_input)
                self.history_index = len(self.history)
            
            return user_input
        
        except (KeyboardInterrupt, EOFError):
            return "/exit"
    
    def get_completions(self, prefix: str) -> list[str]:
        """Get completions for prefix"""
        return get_command_completions(prefix)


class ClaudeUI:
    """
    Main Claude Code Terminal UI
    
    Integrates all UI components:
    - Chat interface for messages
    - Command palette for slash commands
    - File browser for file navigation
    - Status bar for session info
    - Configuration UI for settings
    """
    
    def __init__(self, console: Optional[Console] = None):
        self.console = console or Console()
        self.styles = get_styles()
        
        # Initialize components
        self.chat = get_chat_interface(self.console)
        self.commands = get_command_registry()
        self.status = get_status_manager()
        self.file_browser = get_file_browser()
        self.config_ui = get_config_ui()
        self.input_handler = InputHandler(self.console)
        
        # UI state
        self.state = UIState()
        self.context: Dict[str, Any] = {}
        
        # Event handlers
        self.on_message: Optional[Callable[[str], None]] = None
        self.on_command: Optional[Callable[[str, CommandResult], None]] = None
        
        # Initialize session
        self._init_session()
    
    def _init_session(self):
        """Initialize a new session"""
        import uuid
        
        self.state.session_id = str(uuid.uuid4())[:8]
        self.status.create_session(
            session_id=self.state.session_id,
            model="claude-3-sonnet-20240229",
        )
        
        # Update context
        self.context = {
            "session_info": {
                "id": self.state.session_id,
                "start_time": datetime.now().isoformat(),
            },
            "current_file": None,
            "current_dir": ".",
            "model": "claude-3-sonnet-20240229",
            "memory": {},
            "tools": [
                {"name": "file_read", "description": "Read file contents", "available": True},
                {"name": "file_write", "description": "Write to files", "available": True},
                {"name": "shell", "description": "Execute shell commands", "available": False},
                {"name": "web_search", "description": "Search the web", "available": False},
            ],
        }
    
    async def run(self):
        """Run the main UI loop"""
        self.state.is_running = True
        
        # Show welcome message
        self._show_welcome()
        
        # Main loop
        while self.state.is_running:
            try:
                # Display status bar
                if self.state.show_status_bar:
                    self._show_status_bar()
                
                # Get user input
                user_input = self.input_handler.get_input()
                
                # Handle empty input
                if not user_input.strip():
                    continue
                
                # Process input
                await self._process_input(user_input)
            
            except KeyboardInterrupt:
                self.console.print("\n")
                continue
            except Exception as e:
                self._show_error(f"Error: {str(e)}")
        
        # Cleanup
        self._cleanup()
    
    async def _process_input(self, user_input: str):
        """Process user input"""
        # Check if it's a command
        if is_command(user_input):
            await self._handle_command(user_input)
        else:
            await self._handle_message(user_input)
    
    async def _handle_command(self, command_text: str):
        """Handle a slash command"""
        self.status.set_state(SessionState.PROCESSING)
        
        # Execute command
        result = await execute_command(command_text, self.context)
        
        # Handle result
        if result.success:
            if result.message:
                self.chat.display_info(result.message)
            
            if result.data:
                self.console.print(result.data)
            
            if result.should_exit:
                self.state.is_running = False
            
            if result.should_clear:
                self.console.clear()
                self._show_welcome()
        else:
            self._show_error(result.message or "Command failed")
        
        # Update context
        if result.data and isinstance(result.data, dict):
            self.context.update(result.data)
        
        # Call handler
        if self.on_command:
            self.on_command(command_text, result)
        
        self.status.set_state(SessionState.IDLE)
    
    async def _handle_message(self, message: str):
        """Handle a user message"""
        # Display user message
        self.chat.display_user_message(message)
        self.status.increment_message_count()
        
        # Update state
        self.status.set_state(SessionState.PROCESSING)
        
        # Call handler if set
        if self.on_message:
            self.on_message(message)
        
        self.status.set_state(SessionState.IDLE)
    
    async def display_message(self, message: Message):
        """Display a message"""
        self.chat.display_message(message)
    
    async def stream_response(self, response: AsyncIterator[str]) -> str:
        """
        Stream a response from the AI
        
        Args:
            response: Async iterator of response chunks
        
        Returns:
            Complete response text
        """
        self.status.set_state(SessionState.STREAMING)
        
        result = await self.chat.stream_response(response)
        
        self.status.increment_message_count()
        self.status.set_state(SessionState.IDLE)
        
        return result
    
    def display_streaming_text(self, text: str):
        """Display streaming text directly"""
        self.chat.stream_handler.display_streaming_text(text)
    
    def get_input(self) -> str:
        """Get user input"""
        return self.input_handler.get_input()
    
    def show_status(self, status: str):
        """Show a status message"""
        self.status.status_bar.session_info = self.status.session_info
        self._show_status_bar()
    
    def _show_welcome(self):
        """Show welcome message"""
        styles = self.styles
        
        # Create welcome banner
        banner = Text.assemble(
            Text("╔══════════════════════════════════════╗\n", style=styles.accent_primary),
            Text("║     ", style=styles.accent_primary),
            Text("Welcome to Claude Code", style=styles.header),
            Text("      ║\n", style=styles.accent_primary),
            Text("╚══════════════════════════════════════╝", style=styles.accent_primary),
        )
        
        self.console.print(banner)
        
        # Show quick help
        help_text = Text.assemble(
            Text("\nQuick Start:\n", style=styles.subheader),
            Text("• Type ", style=styles.base),
            Text("/help", style=styles.code_inline),
            Text(" to see available commands\n", style=styles.base),
            Text("• Type ", style=styles.base),
            Text("your message", style=styles.code_inline),
            Text(" to chat with Claude\n", style=styles.base),
            Text("• Press ", style=styles.base),
            Text("Ctrl+C", style=styles.code_inline),
            Text(" to exit\n", style=styles.base),
        )
        
        self.console.print(help_text)
    
    def _show_status_bar(self):
        """Show status bar"""
        status_panel = self.status.get_status_bar()
        self.console.print(status_panel)
    
    def _show_error(self, error: str):
        """Show error message"""
        self.state.last_error = error
        self.chat.display_error(error)
    
    def _cleanup(self):
        """Cleanup before exit"""
        # Save configuration
        self.config_ui.config_manager.save_config()
        
        # Show goodbye message
        self.console.print("\n" + "─" * 40)
        self.console.print(Text("Goodbye! 👋", style=self.styles.header))
        self.console.print("─" * 40 + "\n")
    
    # Public API for external integration
    
    def set_message_handler(self, handler: Callable[[str], None]):
        """Set message handler callback"""
        self.on_message = handler
    
    def set_command_handler(self, handler: Callable[[str, CommandResult], None]):
        """Set command handler callback"""
        self.on_command = handler
    
    def add_system_message(self, content: str, msg_type: MessageType = MessageType.INFO):
        """Add a system message"""
        self.chat.display_system_message(content, msg_type)
    
    def add_assistant_message(self, content: str):
        """Add an assistant message"""
        self.chat.display_assistant_message(content)
    
    def clear_chat(self):
        """Clear chat history"""
        self.chat.clear_history()
    
    def show_chat_history(self, count: Optional[int] = None):
        """Show chat history"""
        self.chat.show_history(count)
    
    def switch_mode(self, mode: UIMode):
        """Switch UI mode"""
        self.state.mode = mode
        
        if mode == UIMode.FILE_BROWSER:
            self.console.print(self.file_browser.get_layout())
        elif mode == UIMode.CONFIG:
            self.config_ui.display_config()
        elif mode == UIMode.HELP:
            asyncio.create_task(self._handle_command("/help"))
    
    def get_layout(self) -> Layout:
        """Get the full UI layout"""
        layout = Layout()
        
        # Split into main areas
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main", ratio=1),
            Layout(name="status", size=3),
            Layout(name="input", size=3),
        )
        
        # Header
        header_text = Text.assemble(
            Text("Claude Code", style=self.styles.header),
            Text("  ", style=self.styles.base),
            Text(f"Session: {self.state.session_id}", style=self.styles.muted),
        )
        layout["header"].update(Panel(header_text, border_style=self.styles.theme.colors.border))
        
        # Main content (chat history)
        chat_layout = self.chat.get_layout()
        layout["main"].update(chat_layout["history"])
        
        # Status bar
        layout["status"].update(self.status.get_status_bar())
        
        # Input area
        input_panel = Panel(
            Text("❯ ", style=self.styles.input_prompt),
            border_style=self.styles.theme.colors.border,
        )
        layout["input"].update(input_panel)
        
        return layout
    
    def show_file_browser(self, path: Optional[str] = None):
        """Show file browser"""
        if path:
            self.file_browser.navigate_to(path)
        self.console.print(self.file_browser.get_layout())
    
    def show_config(self):
        """Show configuration UI"""
        self.config_ui.display_config()
    
    def run_config_wizard(self):
        """Run configuration wizard"""
        self.config_ui.interactive_config()
    
    def update_context(self, key: str, value: Any):
        """Update context data"""
        self.context[key] = value
    
    def get_context(self, key: str, default: Any = None) -> Any:
        """Get context data"""
        return self.context.get(key, default)
    
    def set_theme(self, theme_name: str) -> bool:
        """Set UI theme"""
        if set_theme(theme_name):
            refresh_styles()
            self.styles = get_styles()
            return True
        return False
    
    def exit(self):
        """Exit the UI"""
        self.state.is_running = False


# Global UI instance
_ui_instance: Optional[ClaudeUI] = None


def get_ui(console: Optional[Console] = None) -> ClaudeUI:
    """Get the global UI instance"""
    global _ui_instance
    if _ui_instance is None:
        _ui_instance = ClaudeUI(console)
    return _ui_instance


def create_ui(console: Optional[Console] = None) -> ClaudeUI:
    """Create a new UI instance"""
    return ClaudeUI(console)


# Convenience functions for quick usage
async def run_ui():
    """Run the UI (convenience function)"""
    ui = get_ui()
    await ui.run()


def display_message(content: str, role: str = "assistant"):
    """Display a message (convenience function)"""
    ui = get_ui()
    
    role_map = {
        "user": MessageRole.USER,
        "assistant": MessageRole.ASSISTANT,
        "system": MessageRole.SYSTEM,
    }
    
    message = Message(
        content=content,
        role=role_map.get(role, MessageRole.ASSISTANT),
    )
    
    asyncio.create_task(ui.display_message(message))


def show_status(status: str):
    """Show status (convenience function)"""
    ui = get_ui()
    ui.show_status(status)


def clear_screen():
    """Clear the screen"""
    ui = get_ui()
    ui.console.clear()


def print_help():
    """Print help information"""
    ui = get_ui()
    asyncio.create_task(ui._handle_command("/help"))
