"""
Shared Styles for Claude Code Terminal UI
Provides consistent styling across all UI components
"""

from typing import Optional, Dict, Any
from rich.style import Style
from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.box import Box, ROUNDED, SQUARE, DOUBLE, HEAVY, MINIMAL
from rich.align import Align
from rich.padding import Padding

from .themes import get_current_theme, Theme


class UIStyles:
    """Centralized style definitions for UI components"""
    
    def __init__(self, theme: Optional[Theme] = None):
        self.theme = theme or get_current_theme()
        self._init_styles()
    
    def _init_styles(self):
        """Initialize all style definitions"""
        colors = self.theme.colors
        
        # Base styles
        self.base = Style(color=colors.foreground, bgcolor=colors.background)
        self.muted = Style(color=colors.foreground_muted)
        self.secondary = Style(color=colors.foreground_secondary)
        
        # Accent styles
        self.primary = Style(color=colors.accent_primary, bold=True)
        self.success = Style(color=colors.accent_success, bold=True)
        self.warning = Style(color=colors.accent_warning, bold=True)
        self.error = Style(color=colors.accent_error, bold=True)
        self.info = Style(color=colors.accent_info)
        
        # Message styles
        self.user_message = Style(color=colors.foreground, bgcolor=colors.user_message_bg)
        self.assistant_message = Style(color=colors.foreground, bgcolor=colors.assistant_message_bg)
        self.system_message = Style(color=colors.foreground_muted, bgcolor=colors.system_message_bg)
        
        # Border styles
        self.border = Style(color=colors.border)
        self.border_focused = Style(color=colors.border_focused, bold=True)
        
        # Selection styles
        self.selection = Style(color=colors.foreground, bgcolor=colors.selection, bold=True)
        self.selection_inactive = Style(color=colors.foreground, bgcolor=colors.selection_inactive)
        
        # Status styles
        self.status_online = Style(color=colors.status_online, bold=True)
        self.status_busy = Style(color=colors.status_busy, bold=True)
        self.status_offline = Style(color=colors.status_offline, bold=True)
        self.status_idle = Style(color=colors.status_idle)
        
        # Syntax highlighting styles
        self.syntax_keyword = Style(color=colors.syntax_keyword, bold=True)
        self.syntax_string = Style(color=colors.syntax_string)
        self.syntax_comment = Style(color=colors.syntax_comment, italic=True)
        self.syntax_function = Style(color=colors.syntax_function)
        self.syntax_number = Style(color=colors.syntax_number)
        self.syntax_operator = Style(color=colors.syntax_operator)
        self.syntax_class = Style(color=colors.syntax_class, bold=True)
        
        # Header styles
        self.header = Style(color=colors.accent_primary, bold=True, underline=True)
        self.subheader = Style(color=colors.foreground_secondary, bold=True)
        
        # Input styles
        self.input_prompt = Style(color=colors.accent_primary, bold=True)
        self.input_text = Style(color=colors.foreground)
        self.input_placeholder = Style(color=colors.foreground_muted, italic=True)
        
        # Code block styles
        self.code_block = Style(color=colors.foreground, bgcolor=colors.background_secondary)
        self.code_inline = Style(color=colors.syntax_string, bgcolor=colors.background_secondary)
        
        # Link styles
        self.link = Style(color=colors.accent_info, underline=True)
        self.link_hover = Style(color=colors.accent_primary, underline=True, bold=True)
        
        # Progress styles
        self.progress_bar = Style(color=colors.accent_primary, bgcolor=colors.background_secondary)
        self.progress_complete = Style(color=colors.accent_success)
        
        # Table styles
        self.table_header = Style(color=colors.accent_primary, bold=True, underline=True)
        self.table_row_even = Style(color=colors.foreground, bgcolor=colors.background)
        self.table_row_odd = Style(color=colors.foreground, bgcolor=colors.background_secondary)
        self.table_border = Style(color=colors.border)
    
    def update_theme(self, theme: Theme):
        """Update styles with new theme"""
        self.theme = theme
        self._init_styles()
    
    def get_box_style(self) -> Box:
        """Get the appropriate box style based on theme settings"""
        if not self.theme.show_borders:
            return MINIMAL
        if self.theme.rounded_corners:
            return ROUNDED
        return SQUARE
    
    def get_panel(
        self,
        content: Any,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        border_style: Optional[str] = None,
        padding: tuple = (1, 2),
        highlight: bool = False,
    ) -> Panel:
        """Create a styled panel"""
        border_color = border_style or self.theme.colors.border
        if highlight:
            border_color = self.theme.colors.border_focused
        
        return Panel(
            content,
            title=title,
            subtitle=subtitle,
            box=self.get_box_style(),
            border_style=border_color,
            padding=padding,
            title_align="left",
            subtitle_align="right",
        )
    
    def get_table(
        self,
        title: Optional[str] = None,
        show_header: bool = True,
        show_lines: bool = False,
        border_style: Optional[str] = None,
    ) -> Table:
        """Create a styled table"""
        border_color = border_style or self.theme.colors.border
        
        table = Table(
            title=title,
            show_header=show_header,
            show_lines=show_lines,
            box=self.get_box_style(),
            border_style=border_color,
            header_style=self.table_header,
            row_styles=[self.table_row_even, self.table_row_odd],
            padding=(0, 1),
        )
        return table
    
    def styled_text(self, text: str, style_name: str = "base") -> Text:
        """Create styled text"""
        style = getattr(self, style_name, self.base)
        return Text(text, style=style)
    
    def format_status(self, status: str, state: str = "idle") -> Text:
        """Format status text with appropriate styling"""
        style_map = {
            "online": self.status_online,
            "busy": self.status_busy,
            "offline": self.status_offline,
            "idle": self.status_idle,
            "success": self.success,
            "warning": self.warning,
            "error": self.error,
            "info": self.info,
        }
        style = style_map.get(state, self.base)
        return Text(status, style=style)
    
    def format_code(self, code: str, language: Optional[str] = None) -> Panel:
        """Format code block with syntax highlighting"""
        from rich.syntax import Syntax
        
        syntax = Syntax(
            code,
            language or "text",
            theme="monokai" if "dark" in self.theme.name else "default",
            line_numbers=True,
            word_wrap=True,
        )
        
        return Panel(
            syntax,
            title=f" {language or 'text'} " if language else None,
            box=self.get_box_style(),
            border_style=self.theme.colors.border,
            padding=(1, 1),
        )
    
    def format_inline_code(self, code: str) -> Text:
        """Format inline code"""
        return Text(f" `{code}` ", style=self.code_inline)
    
    def create_header(self, text: str, level: int = 1) -> Text:
        """Create a styled header"""
        if level == 1:
            return Text(f"# {text}", style=self.header)
        elif level == 2:
            return Text(f"## {text}", style=self.subheader)
        else:
            return Text(f"{'#' * level} {text}", style=self.muted)
    
    def create_separator(self, char: str = "─", width: int = 80) -> Text:
        """Create a separator line"""
        return Text(char * width, style=self.border)
    
    def create_badge(self, text: str, style_name: str = "primary") -> Text:
        """Create a styled badge"""
        style = getattr(self, style_name, self.primary)
        return Text(f" [{text}] ", style=style)
    
    def create_spinner_frame(self, frame: int) -> Text:
        """Create a spinner animation frame"""
        frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        return Text(frames[frame % len(frames)], style=self.primary)


# Global styles instance
_styles_instance: Optional[UIStyles] = None


def get_styles() -> UIStyles:
    """Get the global styles instance"""
    global _styles_instance
    if _styles_instance is None:
        _styles_instance = UIStyles()
    return _styles_instance


def refresh_styles():
    """Refresh styles with current theme"""
    global _styles_instance
    _styles_instance = UIStyles()


# Common UI patterns
def create_info_box(message: str, title: str = "Info") -> Panel:
    """Create an info message box"""
    styles = get_styles()
    return styles.get_panel(
        Text(message, style=styles.info),
        title=title,
        border_style=styles.theme.colors.accent_info,
    )


def create_success_box(message: str, title: str = "Success") -> Panel:
    """Create a success message box"""
    styles = get_styles()
    return styles.get_panel(
        Text(message, style=styles.success),
        title=title,
        border_style=styles.theme.colors.accent_success,
    )


def create_warning_box(message: str, title: str = "Warning") -> Panel:
    """Create a warning message box"""
    styles = get_styles()
    return styles.get_panel(
        Text(message, style=styles.warning),
        title=title,
        border_style=styles.theme.colors.accent_warning,
    )


def create_error_box(message: str, title: str = "Error") -> Panel:
    """Create an error message box"""
    styles = get_styles()
    return styles.get_panel(
        Text(message, style=styles.error),
        title=title,
        border_style=styles.theme.colors.accent_error,
    )


def create_help_item(command: str, description: str, example: Optional[str] = None) -> Table:
    """Create a help item row"""
    styles = get_styles()
    
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style=styles.syntax_keyword)
    table.add_column(style=styles.base)
    
    if example:
        desc = f"{description}\n[dim]Example: {example}[/dim]"
    else:
        desc = description
    
    table.add_row(command, desc)
    return table


def format_key_binding(key: str, action: str) -> Text:
    """Format a keyboard binding"""
    styles = get_styles()
    return Text.assemble(
        Text(f"[{key}]", style=styles.primary),
        Text(f" {action}", style=styles.base),
    )


def create_progress_bar(
    completed: int,
    total: int,
    width: int = 40,
    show_percentage: bool = True,
) -> Text:
    """Create a text-based progress bar"""
    styles = get_styles()
    
    if total == 0:
        percentage = 0
    else:
        percentage = min(100, int(completed / total * 100))
    
    filled = int(width * percentage / 100)
    empty = width - filled
    
    bar = Text()
    bar.append("█" * filled, style=styles.progress_bar)
    bar.append("░" * empty, style=styles.muted)
    
    if show_percentage:
        bar.append(f" {percentage}%", style=styles.base)
    
    return bar
