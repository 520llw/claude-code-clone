"""
Chat Interface for Claude Code Terminal UI
Handles message display, streaming responses, and chat history
"""

import re
from dataclasses import dataclass, field
from typing import Optional, List, AsyncIterator, Callable, Any
from datetime import datetime
from enum import Enum, auto

from rich.text import Text
from rich.panel import Panel
from rich.console import Console, Group
from rich.markdown import Markdown
from rich.syntax import Syntax
from rich.live import Live
from rich.layout import Layout
from rich.align import Align
from rich.padding import Padding
from rich.box import ROUNDED

from .styles import get_styles, UIStyles, create_info_box, create_error_box
from .themes import get_current_theme


class MessageRole(Enum):
    """Message role enumeration"""
    USER = auto()
    ASSISTANT = auto()
    SYSTEM = auto()
    TOOL = auto()


class MessageType(Enum):
    """Message type enumeration"""
    TEXT = auto()
    CODE = auto()
    MARKDOWN = auto()
    ERROR = auto()
    WARNING = auto()
    INFO = auto()


@dataclass
class Message:
    """Chat message"""
    content: str
    role: MessageRole = MessageRole.USER
    message_type: MessageType = MessageType.TEXT
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict)
    
    @property
    def role_icon(self) -> str:
        """Get role icon"""
        icons = {
            MessageRole.USER: "👤",
            MessageRole.ASSISTANT: "🤖",
            MessageRole.SYSTEM: "⚙️",
            MessageRole.TOOL: "🔧",
        }
        return icons.get(self.role, "💬")
    
    @property
    def role_name(self) -> str:
        """Get role name"""
        names = {
            MessageRole.USER: "You",
            MessageRole.ASSISTANT: "Claude",
            MessageRole.SYSTEM: "System",
            MessageRole.TOOL: "Tool",
        }
        return names.get(self.role, "Unknown")
    
    def format_timestamp(self) -> str:
        """Format timestamp"""
        return self.timestamp.strftime("%H:%M:%S")


class CodeBlockExtractor:
    """Extract and format code blocks from markdown"""
    
    CODE_BLOCK_PATTERN = re.compile(
        r'```(\w+)?\n(.*?)```',
        re.DOTALL
    )
    INLINE_CODE_PATTERN = re.compile(r'`([^`]+)`')
    
    def __init__(self):
        self.styles = get_styles()
    
    def extract_code_blocks(self, text: str) -> List[dict]:
        """Extract code blocks from text"""
        blocks = []
        for match in self.CODE_BLOCK_PATTERN.finditer(text):
            blocks.append({
                'language': match.group(1) or 'text',
                'code': match.group(2).strip(),
                'start': match.start(),
                'end': match.end(),
            })
        return blocks
    
    def format_code_block(self, code: str, language: str = "text") -> Panel:
        """Format a code block"""
        theme = "monokai" if "dark" in get_current_theme().name else "default"
        
        syntax = Syntax(
            code,
            language,
            theme=theme,
            line_numbers=True,
            word_wrap=True,
            background_color="default",
        )
        
        return Panel(
            syntax,
            title=f" {language} ",
            title_align="left",
            border_style=self.styles.theme.colors.border,
            padding=(1, 1),
        )
    
    def format_inline_code(self, code: str) -> Text:
        """Format inline code"""
        return Text(f" `{code}` ", style=self.styles.code_inline)


class MessageRenderer:
    """Renders chat messages"""
    
    def __init__(self):
        self.styles = get_styles()
        self.code_extractor = CodeBlockExtractor()
    
    def render_message(self, message: Message, compact: bool = False) -> Panel:
        """Render a message as a panel"""
        # Get style based on role
        if message.role == MessageRole.USER:
            border_style = self.styles.theme.colors.accent_primary
            bg_style = self.styles.theme.colors.user_message_bg
        elif message.role == MessageRole.ASSISTANT:
            border_style = self.styles.theme.colors.accent_secondary
            bg_style = self.styles.theme.colors.assistant_message_bg
        elif message.role == MessageRole.SYSTEM:
            border_style = self.styles.theme.colors.border
            bg_style = self.styles.theme.colors.system_message_bg
        else:
            border_style = self.styles.theme.colors.border
            bg_style = self.styles.theme.colors.background
        
        # Create header
        header = Text.assemble(
            Text(message.role_icon, style="none"),
            Text(" ", style="none"),
            Text(message.role_name, style=self.styles.syntax_keyword if message.role == MessageRole.ASSISTANT else self.styles.base),
            Text(f"  {message.format_timestamp()}", style=self.styles.muted),
        )
        
        # Render content based on type
        if message.message_type == MessageType.CODE:
            content = self.code_extractor.format_code_block(
                message.content,
                message.metadata.get('language', 'text')
            )
        elif message.message_type == MessageType.MARKDOWN:
            content = self._render_markdown(message.content)
        elif message.message_type == MessageType.ERROR:
            content = Text(message.content, style=self.styles.error)
        elif message.message_type == MessageType.WARNING:
            content = Text(message.content, style=self.styles.warning)
        elif message.message_type == MessageType.INFO:
            content = Text(message.content, style=self.styles.info)
        else:
            content = self._render_text(message.content)
        
        # Create panel
        return Panel(
            content,
            title=header,
            title_align="left",
            border_style=border_style,
            padding=(1, 2),
        )
    
    def _render_text(self, text: str) -> Group:
        """Render text with code block support"""
        # Check for code blocks
        code_blocks = self.code_extractor.extract_code_blocks(text)
        
        if not code_blocks:
            # Simple text, no code blocks
            return Group(Text(text))
        
        # Split text and render code blocks
        parts = []
        last_end = 0
        
        for block in code_blocks:
            # Add text before code block
            if block['start'] > last_end:
                before_text = text[last_end:block['start']]
                parts.append(Text(before_text))
            
            # Add code block
            parts.append(self.code_extractor.format_code_block(
                block['code'],
                block['language']
            ))
            
            last_end = block['end']
        
        # Add remaining text
        if last_end < len(text):
            parts.append(Text(text[last_end:]))
        
        return Group(*parts)
    
    def _render_markdown(self, text: str) -> Markdown:
        """Render markdown content"""
        return Markdown(
            text,
            code_theme="monokai" if "dark" in get_current_theme().name else "default",
        )
    
    def render_stream_chunk(self, chunk: str, accumulated: str) -> Panel:
        """Render a streaming chunk"""
        full_text = accumulated + chunk
        
        # Create streaming indicator
        header = Text.assemble(
            Text("🤖 ", style="none"),
            Text("Claude", style=self.styles.syntax_keyword),
            Text("  ", style="none"),
            Text("●", style=self.styles.status_busy),
        )
        
        # Render content
        content = self._render_text(full_text)
        
        return Panel(
            content,
            title=header,
            title_align="left",
            border_style=self.styles.theme.colors.accent_secondary,
            padding=(1, 2),
        )
    
    def render_typing_indicator(self) -> Panel:
        """Render typing indicator"""
        header = Text.assemble(
            Text("🤖 ", style="none"),
            Text("Claude", style=self.styles.syntax_keyword),
            Text("  ", style="none"),
            Text("● ● ●", style=self.styles.status_busy),
        )
        
        return Panel(
            Text("", style=self.styles.muted),
            title=header,
            title_align="left",
            border_style=self.styles.theme.colors.accent_secondary,
            padding=(1, 2),
        )


class ChatHistory:
    """Manages chat history"""
    
    def __init__(self, max_messages: int = 100):
        self.messages: List[Message] = []
        self.max_messages = max_messages
        self.renderer = MessageRenderer()
    
    def add_message(self, message: Message) -> None:
        """Add a message to history"""
        self.messages.append(message)
        
        # Trim if exceeds max
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
    
    def get_messages(self, limit: Optional[int] = None) -> List[Message]:
        """Get messages, optionally limited"""
        if limit:
            return self.messages[-limit:]
        return self.messages
    
    def clear(self) -> None:
        """Clear all messages"""
        self.messages = []
    
    def render_recent(self, count: int = 10) -> List[Panel]:
        """Render recent messages"""
        recent = self.get_messages(count)
        return [self.renderer.render_message(msg) for msg in recent]
    
    def render_all(self) -> List[Panel]:
        """Render all messages"""
        return [self.renderer.render_message(msg) for msg in self.messages]
    
    def to_dict(self) -> List[dict]:
        """Convert to dictionary for serialization"""
        return [
            {
                "content": msg.content,
                "role": msg.role.name,
                "type": msg.message_type.name,
                "timestamp": msg.timestamp.isoformat(),
                "metadata": msg.metadata,
            }
            for msg in self.messages
        ]
    
    @classmethod
    def from_dict(cls, data: List[dict]) -> "ChatHistory":
        """Create from dictionary"""
        history = cls()
        for item in data:
            msg = Message(
                content=item["content"],
                role=MessageRole[item.get("role", "USER")],
                message_type=MessageType[item.get("type", "TEXT")],
                timestamp=datetime.fromisoformat(item["timestamp"]),
                metadata=item.get("metadata", {}),
            )
            history.add_message(msg)
        return history


class StreamingResponseHandler:
    """Handles streaming responses from the AI"""
    
    def __init__(self, console: Console):
        self.console = console
        self.styles = get_styles()
        self.renderer = MessageRenderer()
        self.accumulated_text = ""
        self.live: Optional[Live] = None
    
    async def stream_response(
        self,
        response: AsyncIterator[str],
        on_complete: Optional[Callable[[str], None]] = None,
    ) -> str:
        """Stream a response and display it in real-time"""
        self.accumulated_text = ""
        
        with Live(
            self.renderer.render_typing_indicator(),
            console=self.console,
            refresh_per_second=10,
            transient=False,
        ) as live:
            self.live = live
            
            async for chunk in response:
                self.accumulated_text += chunk
                
                # Update display
                live.update(self.renderer.render_stream_chunk(
                    chunk,
                    self.accumulated_text
                ))
            
            # Final update without typing indicator
            final_message = Message(
                content=self.accumulated_text,
                role=MessageRole.ASSISTANT,
                message_type=MessageType.TEXT,
            )
            live.update(self.renderer.render_message(final_message))
        
        self.live = None
        
        if on_complete:
            on_complete(self.accumulated_text)
        
        return self.accumulated_text
    
    def display_streaming_text(self, text: str):
        """Display streaming text directly"""
        self.accumulated_text = text
        if self.live:
            self.live.update(self.renderer.render_stream_chunk("", text))
    
    def complete_stream(self) -> str:
        """Complete the stream and return accumulated text"""
        result = self.accumulated_text
        self.accumulated_text = ""
        return result


class ChatInterface:
    """Main chat interface"""
    
    def __init__(self, console: Optional[Console] = None):
        self.console = console or Console()
        self.styles = get_styles()
        self.history = ChatHistory()
        self.renderer = MessageRenderer()
        self.stream_handler = StreamingResponseHandler(self.console)
    
    def display_message(self, message: Message) -> None:
        """Display a single message"""
        panel = self.renderer.render_message(message)
        self.console.print(panel)
        self.history.add_message(message)
    
    def display_user_message(self, content: str) -> None:
        """Display a user message"""
        message = Message(
            content=content,
            role=MessageRole.USER,
            message_type=MessageType.TEXT,
        )
        self.display_message(message)
    
    def display_assistant_message(self, content: str) -> None:
        """Display an assistant message"""
        message = Message(
            content=content,
            role=MessageRole.ASSISTANT,
            message_type=MessageType.TEXT,
        )
        self.display_message(message)
    
    def display_system_message(self, content: str, msg_type: MessageType = MessageType.INFO) -> None:
        """Display a system message"""
        message = Message(
            content=content,
            role=MessageRole.SYSTEM,
            message_type=msg_type,
        )
        self.display_message(message)
    
    async def stream_response(self, response: AsyncIterator[str]) -> str:
        """Stream a response"""
        return await self.stream_handler.stream_response(response)
    
    def display_code(self, code: str, language: str = "text") -> None:
        """Display a code block"""
        message = Message(
            content=code,
            role=MessageRole.ASSISTANT,
            message_type=MessageType.CODE,
            metadata={"language": language},
        )
        self.display_message(message)
    
    def display_markdown(self, content: str) -> None:
        """Display markdown content"""
        message = Message(
            content=content,
            role=MessageRole.ASSISTANT,
            message_type=MessageType.MARKDOWN,
        )
        self.display_message(message)
    
    def display_error(self, error: str) -> None:
        """Display an error message"""
        self.console.print(create_error_box(error))
        message = Message(
            content=error,
            role=MessageRole.SYSTEM,
            message_type=MessageType.ERROR,
        )
        self.history.add_message(message)
    
    def display_info(self, info: str) -> None:
        """Display an info message"""
        self.console.print(create_info_box(info))
        message = Message(
            content=info,
            role=MessageRole.SYSTEM,
            message_type=MessageType.INFO,
        )
        self.history.add_message(message)
    
    def clear_history(self) -> None:
        """Clear chat history"""
        self.history.clear()
    
    def show_history(self, count: Optional[int] = None) -> None:
        """Show chat history"""
        messages = self.history.get_messages(count)
        for msg in messages:
            self.console.print(self.renderer.render_message(msg))
    
    def get_layout(self, show_history: bool = True) -> Layout:
        """Get chat interface layout"""
        layout = Layout()
        
        if show_history:
            layout.split_column(
                Layout(name="history", ratio=4),
                Layout(name="input", size=3),
            )
            
            # Render history
            history_panels = self.history.render_recent(20)
            if history_panels:
                layout["history"].update(Group(*history_panels))
            else:
                layout["history"].update(
                    Panel(
                        Text("No messages yet. Start a conversation!", style=self.styles.muted),
                        border_style=self.styles.theme.colors.border,
                    )
                )
        
        return layout
    
    def create_input_prompt(self) -> Text:
        """Create input prompt"""
        return Text.assemble(
            Text("❯ ", style=self.styles.input_prompt),
        )


# Global chat interface instance
_chat_interface: Optional[ChatInterface] = None


def get_chat_interface(console: Optional[Console] = None) -> ChatInterface:
    """Get the global chat interface instance"""
    global _chat_interface
    if _chat_interface is None:
        _chat_interface = ChatInterface(console)
    return _chat_interface
