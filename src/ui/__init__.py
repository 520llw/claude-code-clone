"""
Claude Code Terminal UI Package

A comprehensive terminal UI framework for Claude Code clone.
Provides chat interface, file browser, command palette, and more.
"""

# Version
__version__ = "1.0.0"

# Theme system
from .themes import (
    Theme,
    ThemeType,
    ThemeColors,
    ThemeManager,
    get_theme_manager,
    get_current_theme,
    set_theme,
    theme_manager,
)

# Styles
from .styles import (
    UIStyles,
    get_styles,
    refresh_styles,
    create_info_box,
    create_success_box,
    create_warning_box,
    create_error_box,
    create_help_item,
    format_key_binding,
    create_progress_bar,
)

# Status display
from .status import (
    StatusManager,
    StatusBar,
    SessionInfo,
    SessionState,
    ConnectionStatus,
    TokenUsage,
    ToolExecution,
    ProgressIndicator,
    get_status_manager,
    reset_status_manager,
)

# Chat interface
from .chat import (
    ChatInterface,
    ChatHistory,
    Message,
    MessageRole,
    MessageType,
    MessageRenderer,
    StreamingResponseHandler,
    CodeBlockExtractor,
    get_chat_interface,
)

# Command processing
from .commands import (
    Command,
    CommandCategory,
    CommandResult,
    CommandHandler,
    CommandRegistry,
    get_command_registry,
    is_command,
    execute_command,
    get_command_completions,
)

# File browser
from .file_browser import (
    FileBrowser,
    FileInfo,
    FileType,
    get_file_browser,
    reset_file_browser,
)

# Configuration UI
from .config_ui import (
    ConfigUI,
    ConfigManager,
    AppConfig,
    APIConfig,
    ModelConfig,
    UIConfig,
    PermissionConfig,
    GeneralConfig,
    AdvancedConfig,
    ConfigCategory,
    get_config_ui,
    get_config_manager,
)

# Main UI
from .main_ui import (
    ClaudeUI,
    UIMode,
    UIState,
    InputHandler,
    get_ui,
    create_ui,
    run_ui,
    display_message,
    show_status,
    clear_screen,
    print_help,
)

__all__ = [
    # Version
    "__version__",
    
    # Themes
    "Theme",
    "ThemeType",
    "ThemeColors",
    "ThemeManager",
    "get_theme_manager",
    "get_current_theme",
    "set_theme",
    "theme_manager",
    
    # Styles
    "UIStyles",
    "get_styles",
    "refresh_styles",
    "create_info_box",
    "create_success_box",
    "create_warning_box",
    "create_error_box",
    "create_help_item",
    "format_key_binding",
    "create_progress_bar",
    
    # Status
    "StatusManager",
    "StatusBar",
    "SessionInfo",
    "SessionState",
    "ConnectionStatus",
    "TokenUsage",
    "ToolExecution",
    "ProgressIndicator",
    "get_status_manager",
    "reset_status_manager",
    
    # Chat
    "ChatInterface",
    "ChatHistory",
    "Message",
    "MessageRole",
    "MessageType",
    "MessageRenderer",
    "StreamingResponseHandler",
    "CodeBlockExtractor",
    "get_chat_interface",
    
    # Commands
    "Command",
    "CommandCategory",
    "CommandResult",
    "CommandHandler",
    "CommandRegistry",
    "get_command_registry",
    "is_command",
    "execute_command",
    "get_command_completions",
    
    # File Browser
    "FileBrowser",
    "FileInfo",
    "FileType",
    "get_file_browser",
    "reset_file_browser",
    
    # Config
    "ConfigUI",
    "ConfigManager",
    "AppConfig",
    "APIConfig",
    "ModelConfig",
    "UIConfig",
    "PermissionConfig",
    "GeneralConfig",
    "AdvancedConfig",
    "ConfigCategory",
    "get_config_ui",
    "get_config_manager",
    
    # Main UI
    "ClaudeUI",
    "UIMode",
    "UIState",
    "InputHandler",
    "get_ui",
    "create_ui",
    "run_ui",
    "display_message",
    "show_status",
    "clear_screen",
    "print_help",
]
