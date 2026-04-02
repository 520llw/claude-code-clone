"""
Command Processing for Claude Code Terminal UI
Handles slash commands and command palette
"""

import re
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Callable, Any, Awaitable
from enum import Enum, auto
from abc import ABC, abstractmethod

from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.console import Console, Group
from rich.tree import Tree
from rich.syntax import Syntax

from .styles import get_styles, UIStyles, format_key_binding
from .themes import get_current_theme, theme_manager
from .chat import MessageRole, MessageType, Message


class CommandCategory(Enum):
    """Command category enumeration"""
    GENERAL = auto()
    CONTEXT = auto()
    TOOLS = auto()
    CONFIG = auto()
    SESSION = auto()
    NAVIGATION = auto()


@dataclass
class Command:
    """Slash command definition"""
    name: str
    description: str
    category: CommandCategory
    handler: Callable[..., Awaitable[Any]]
    aliases: List[str] = field(default_factory=list)
    args: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    hidden: bool = False
    requires_args: bool = False
    
    @property
    def full_name(self) -> str:
        """Get full command name with slash"""
        return f"/{self.name}"
    
    def get_usage(self) -> str:
        """Get command usage string"""
        usage = self.full_name
        for arg in self.args:
            usage += f" <{arg}>"
        return usage
    
    def get_help_text(self) -> Text:
        """Get formatted help text"""
        styles = get_styles()
        
        lines = [
            Text.assemble(
                Text("Command: ", style=styles.muted),
                Text(self.full_name, style=styles.syntax_keyword),
            ),
            Text.assemble(
                Text("Description: ", style=styles.muted),
                Text(self.description, style=styles.base),
            ),
        ]
        
        if self.aliases:
            lines.append(Text.assemble(
                Text("Aliases: ", style=styles.muted),
                Text(", ".join(f"/{a}" for a in self.aliases), style=styles.secondary),
            ))
        
        if self.args:
            lines.append(Text.assemble(
                Text("Arguments: ", style=styles.muted),
                Text(", ".join(f"<{a}>" for a in self.args), style=styles.info),
            ))
        
        if self.examples:
            lines.append(Text("Examples:", style=styles.muted))
            for example in self.examples:
                lines.append(Text(f"  {example}", style=styles.code_inline))
        
        return Text("\n").join(lines)


class CommandResult:
    """Result of command execution"""
    
    def __init__(
        self,
        success: bool = True,
        message: Optional[str] = None,
        data: Any = None,
        should_exit: bool = False,
        should_clear: bool = False,
    ):
        self.success = success
        self.message = message
        self.data = data
        self.should_exit = should_exit
        self.should_clear = should_clear
    
    @classmethod
    def ok(cls, message: str, data: Any = None) -> "CommandResult":
        """Create successful result"""
        return cls(success=True, message=message, data=data)
    
    @classmethod
    def error(cls, message: str) -> "CommandResult":
        """Create error result"""
        return cls(success=False, message=message)
    
    @classmethod
    def exit(cls, message: Optional[str] = None) -> "CommandResult":
        """Create exit result"""
        return cls(success=True, message=message, should_exit=True)
    
    @classmethod
    def clear(cls, message: Optional[str] = None) -> "CommandResult":
        """Create clear result"""
        return cls(success=True, message=message, should_clear=True)


class CommandHandler(ABC):
    """Abstract base class for command handlers"""
    
    @abstractmethod
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Handle the command"""
        pass


class HelpCommandHandler(CommandHandler):
    """Handler for /help command"""
    
    def __init__(self, registry: "CommandRegistry"):
        self.registry = registry
        self.styles = get_styles()
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Show help information"""
        if args:
            # Show help for specific command
            command_name = args[0].lstrip('/')
            command = self.registry.get_command(command_name)
            if command:
                return CommandResult.ok(
                    message=None,
                    data=command.get_help_text(),
                )
            else:
                return CommandResult.error(f"Unknown command: /{command_name}")
        
        # Show general help
        help_panel = self._create_help_panel()
        return CommandResult.ok(message=None, data=help_panel)
    
    def _create_help_panel(self) -> Panel:
        """Create help panel with all commands"""
        # Group commands by category
        categories: Dict[CommandCategory, List[Command]] = {}
        for cmd in self.registry.get_all_commands():
            if not cmd.hidden:
                if cmd.category not in categories:
                    categories[cmd.category] = []
                categories[cmd.category].append(cmd)
        
        # Create content
        content_groups = []
        
        for category in CommandCategory:
            if category in categories:
                category_title = self.styles.create_header(category.name.title(), level=2)
                content_groups.append(category_title)
                
                table = Table(show_header=False, box=None, padding=(0, 2))
                table.add_column(style=self.styles.syntax_keyword, width=20)
                table.add_column(style=self.styles.base)
                
                for cmd in sorted(categories[category], key=lambda c: c.name):
                    table.add_row(cmd.full_name, cmd.description)
                
                content_groups.append(table)
                content_groups.append(Text(""))
        
        # Add tips
        tips = Text.assemble(
            Text("\nTips:\n", style=self.styles.subheader),
            Text("• Use ", style=self.styles.base),
            Text("/help <command>", style=self.styles.code_inline),
            Text(" for detailed command help\n", style=self.styles.base),
            Text("• Press ", style=self.styles.base),
            format_key_binding("Tab", "for command completion"),
            Text("\n", style=self.styles.base),
            Text("• Commands are case-insensitive", style=self.styles.muted),
        )
        content_groups.append(tips)
        
        return Panel(
            Group(*content_groups),
            title="Claude Code - Help",
            border_style=self.styles.theme.colors.accent_info,
            padding=(1, 2),
        )


class ContextCommandHandler(CommandHandler):
    """Handler for /context command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Show current context"""
        styles = get_styles()
        
        # Get context information
        session_info = context.get("session_info", {})
        current_file = context.get("current_file", None)
        current_dir = context.get("current_dir", ".")
        
        # Build context tree
        tree = Tree("📁 Context", style=styles.syntax_keyword)
        
        # Session info
        session_branch = tree.add("Session")
        for key, value in session_info.items():
            session_branch.add(f"{key}: {value}")
        
        # File context
        file_branch = tree.add("Files")
        file_branch.add(f"Current directory: {current_dir}")
        if current_file:
            file_branch.add(f"Current file: {current_file}")
        
        # Environment
        env_branch = tree.add("Environment")
        env_branch.add(f"Theme: {get_current_theme().name}")
        
        panel = Panel(
            tree,
            title="Current Context",
            border_style=styles.theme.colors.accent_info,
        )
        
        return CommandResult.ok(message=None, data=panel)


class ToolsCommandHandler(CommandHandler):
    """Handler for /tools command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """List available tools"""
        styles = get_styles()
        
        # Get tools from context
        tools = context.get("tools", [])
        
        if not tools:
            return CommandResult.ok(message="No tools available")
        
        table = Table(show_header=True)
        table.add_column("Tool", style=styles.syntax_keyword)
        table.add_column("Description", style=styles.base)
        table.add_column("Status", style=styles.muted)
        
        for tool in tools:
            table.add_row(
                tool.get("name", "Unknown"),
                tool.get("description", "No description"),
                "✓ Available" if tool.get("available", True) else "✗ Unavailable",
            )
        
        panel = Panel(
            table,
            title="Available Tools",
            border_style=styles.theme.colors.accent_secondary,
        )
        
        return CommandResult.ok(message=None, data=panel)


class MemoryCommandHandler(CommandHandler):
    """Handler for /memory command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Manage memory"""
        styles = get_styles()
        
        if not args:
            # Show memory info
            memory = context.get("memory", {})
            
            table = Table(show_header=False, box=None)
            table.add_column(style=styles.muted)
            table.add_column(style=styles.base)
            
            table.add_row("Items:", str(len(memory)))
            table.add_row("Size:", f"{len(str(memory))} bytes")
            
            panel = Panel(
                table,
                title="Memory",
                border_style=styles.theme.colors.accent_info,
            )
            
            return CommandResult.ok(message=None, data=panel)
        
        subcommand = args[0].lower()
        
        if subcommand == "clear":
            return CommandResult.ok(message="Memory cleared", data={"action": "clear"})
        elif subcommand == "show":
            memory = context.get("memory", {})
            return CommandResult.ok(message=None, data=memory)
        else:
            return CommandResult.error(f"Unknown subcommand: {subcommand}")


class StatusCommandHandler(CommandHandler):
    """Handler for /status command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Show system status"""
        from .status import get_status_manager
        
        status_manager = get_status_manager()
        layout = status_manager.get_full_status()
        
        return CommandResult.ok(message=None, data=layout)


class ModelCommandHandler(CommandHandler):
    """Handler for /model command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Switch or show model"""
        styles = get_styles()
        
        available_models = [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
        ]
        
        if not args:
            # Show current model
            current_model = context.get("model", "claude-3-sonnet-20240229")
            
            table = Table(show_header=False, box=None)
            table.add_column(style=styles.muted)
            table.add_column(style=styles.base)
            
            table.add_row("Current model:", current_model)
            table.add_row("", "")
            table.add_row("Available models:", "")
            
            for model in available_models:
                marker = "● " if model == current_model else "○ "
                table.add_row("", f"{marker}{model}")
            
            panel = Panel(
                table,
                title="Model",
                border_style=styles.theme.colors.accent_info,
            )
            
            return CommandResult.ok(message=None, data=panel)
        
        model_name = args[0]
        if model_name in available_models:
            return CommandResult.ok(
                message=f"Switched to model: {model_name}",
                data={"model": model_name},
            )
        else:
            return CommandResult.error(f"Unknown model: {model_name}")


class ClearCommandHandler(CommandHandler):
    """Handler for /clear command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Clear screen"""
        return CommandResult.clear(message="Screen cleared")


class ExitCommandHandler(CommandHandler):
    """Handler for /exit command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Exit the application"""
        return CommandResult.exit(message="Goodbye! 👋")


class ThemeCommandHandler(CommandHandler):
    """Handler for /theme command"""
    
    async def handle(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        """Switch or list themes"""
        styles = get_styles()
        
        if not args:
            # List available themes
            themes = theme_manager.list_themes()
            current = theme_manager.current_theme_name
            
            table = Table(show_header=False, box=None)
            table.add_column(style=styles.syntax_keyword)
            table.add_column(style=styles.base)
            
            for theme_name in themes:
                marker = "● " if theme_name == current else "○ "
                table.add_row(f"{marker}{theme_name}", "")
            
            panel = Panel(
                table,
                title="Themes",
                border_style=styles.theme.colors.accent_info,
            )
            
            return CommandResult.ok(message=None, data=panel)
        
        theme_name = args[0]
        if theme_manager.set_theme(theme_name):
            return CommandResult.ok(message=f"Switched to theme: {theme_name}")
        else:
            return CommandResult.error(f"Unknown theme: {theme_name}")


class CommandRegistry:
    """Registry for all commands"""
    
    def __init__(self):
        self._commands: Dict[str, Command] = {}
        self._handlers: Dict[str, CommandHandler] = {}
        self._register_default_commands()
    
    def _register_default_commands(self):
        """Register default commands"""
        # Help command
        self.register(
            Command(
                name="help",
                description="Show help information",
                category=CommandCategory.GENERAL,
                handler=self._handle_help,
                aliases=["h", "?"],
                args=["command"],
                examples=["/help", "/help context"],
            ),
            HelpCommandHandler(self),
        )
        
        # Context command
        self.register(
            Command(
                name="context",
                description="Show current context",
                category=CommandCategory.CONTEXT,
                handler=self._handle_context,
                aliases=["ctx"],
            ),
            ContextCommandHandler(),
        )
        
        # Tools command
        self.register(
            Command(
                name="tools",
                description="List available tools",
                category=CommandCategory.TOOLS,
                handler=self._handle_tools,
                aliases=["t"],
            ),
            ToolsCommandHandler(),
        )
        
        # Memory command
        self.register(
            Command(
                name="memory",
                description="Manage memory",
                category=CommandCategory.CONTEXT,
                handler=self._handle_memory,
                aliases=["mem"],
                args=["action"],
                examples=["/memory", "/memory clear", "/memory show"],
            ),
            MemoryCommandHandler(),
        )
        
        # Status command
        self.register(
            Command(
                name="status",
                description="Show system status",
                category=CommandCategory.GENERAL,
                handler=self._handle_status,
                aliases=["st"],
            ),
            StatusCommandHandler(),
        )
        
        # Model command
        self.register(
            Command(
                name="model",
                description="Switch or show model",
                category=CommandCategory.CONFIG,
                handler=self._handle_model,
                aliases=["m"],
                args=["model_name"],
                examples=["/model", "/model claude-3-opus-20240229"],
            ),
            ModelCommandHandler(),
        )
        
        # Theme command
        self.register(
            Command(
                name="theme",
                description="Switch or list themes",
                category=CommandCategory.CONFIG,
                handler=self._handle_theme,
                aliases=["th"],
                args=["theme_name"],
                examples=["/theme", "/theme dark"],
            ),
            ThemeCommandHandler(),
        )
        
        # Clear command
        self.register(
            Command(
                name="clear",
                description="Clear the screen",
                category=CommandCategory.SESSION,
                handler=self._handle_clear,
                aliases=["cls"],
            ),
            ClearCommandHandler(),
        )
        
        # Exit command
        self.register(
            Command(
                name="exit",
                description="Exit Claude Code",
                category=CommandCategory.SESSION,
                handler=self._handle_exit,
                aliases=["quit", "q"],
            ),
            ExitCommandHandler(),
        )
    
    def register(self, command: Command, handler: CommandHandler) -> None:
        """Register a command"""
        self._commands[command.name] = command
        self._handlers[command.name] = handler
        
        # Register aliases
        for alias in command.aliases:
            self._commands[alias] = command
    
    def get_command(self, name: str) -> Optional[Command]:
        """Get a command by name"""
        return self._commands.get(name.lower())
    
    def get_all_commands(self) -> List[Command]:
        """Get all unique commands"""
        seen = set()
        commands = []
        for cmd in self._commands.values():
            if cmd.name not in seen:
                seen.add(cmd.name)
                commands.append(cmd)
        return commands
    
    def get_commands_by_category(self, category: CommandCategory) -> List[Command]:
        """Get commands by category"""
        return [cmd for cmd in self.get_all_commands() if cmd.category == category]
    
    def is_command(self, text: str) -> bool:
        """Check if text is a command"""
        if not text.startswith('/'):
            return False
        
        parts = text[1:].split()
        if not parts:
            return False
        
        command_name = parts[0].lower()
        return command_name in self._commands
    
    async def execute(
        self,
        text: str,
        context: Dict[str, Any],
    ) -> CommandResult:
        """Execute a command"""
        if not self.is_command(text):
            return CommandResult.error(f"Not a command: {text}")
        
        parts = text[1:].split()
        command_name = parts[0].lower()
        args = parts[1:]
        
        command = self._commands.get(command_name)
        if not command:
            return CommandResult.error(f"Unknown command: /{command_name}")
        
        # Get the handler for the main command name
        handler = self._handlers.get(command.name)
        if not handler:
            return CommandResult.error(f"No handler for command: /{command_name}")
        
        try:
            return await handler.handle(args, context)
        except Exception as e:
            return CommandResult.error(f"Error executing command: {str(e)}")
    
    def get_completions(self, prefix: str) -> List[str]:
        """Get command completions for a prefix"""
        if not prefix.startswith('/'):
            return []
        
        command_part = prefix[1:].lower()
        completions = []
        
        for cmd in self.get_all_commands():
            if cmd.name.startswith(command_part):
                completions.append(f"/{cmd.name}")
            for alias in cmd.aliases:
                if alias.startswith(command_part):
                    completions.append(f"/{alias}")
        
        return sorted(set(completions))
    
    # Handler wrappers
    async def _handle_help(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["help"].handle(args, context)
    
    async def _handle_context(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["context"].handle(args, context)
    
    async def _handle_tools(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["tools"].handle(args, context)
    
    async def _handle_memory(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["memory"].handle(args, context)
    
    async def _handle_status(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["status"].handle(args, context)
    
    async def _handle_model(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["model"].handle(args, context)
    
    async def _handle_theme(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["theme"].handle(args, context)
    
    async def _handle_clear(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["clear"].handle(args, context)
    
    async def _handle_exit(self, args: List[str], context: Dict[str, Any]) -> CommandResult:
        return await self._handlers["exit"].handle(args, context)


# Global command registry instance
_command_registry: Optional[CommandRegistry] = None


def get_command_registry() -> CommandRegistry:
    """Get the global command registry instance"""
    global _command_registry
    if _command_registry is None:
        _command_registry = CommandRegistry()
    return _command_registry


def is_command(text: str) -> bool:
    """Check if text is a command"""
    return get_command_registry().is_command(text)


async def execute_command(text: str, context: Dict[str, Any]) -> CommandResult:
    """Execute a command"""
    return await get_command_registry().execute(text, context)


def get_command_completions(prefix: str) -> List[str]:
    """Get command completions"""
    return get_command_registry().get_completions(prefix)
