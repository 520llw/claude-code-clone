#!/usr/bin/env python3
"""
Claude Code Terminal UI Demo
Demonstrates the UI components and features
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from rich.console import Console
from rich.text import Text
from rich.panel import Panel

from ui import (
    # Themes
    get_current_theme,
    set_theme,
    theme_manager,
    
    # Styles
    get_styles,
    create_info_box,
    create_success_box,
    create_warning_box,
    create_error_box,
    
    # Chat
    ChatInterface,
    Message,
    MessageRole,
    MessageType,
    
    # Status
    get_status_manager,
    SessionState,
    ConnectionStatus,
    
    # Commands
    get_command_registry,
    execute_command,
    
    # File Browser
    get_file_browser,
    
    # Config
    get_config_ui,
    
    # Main UI
    ClaudeUI,
    UIMode,
)


console = Console()


def demo_themes():
    """Demo theme system"""
    console.print(Panel("Theme System Demo", style="bold blue"))
    
    # List available themes
    themes = theme_manager.list_themes()
    console.print(f"\nAvailable themes: {', '.join(themes)}")
    
    # Show current theme
    current = get_current_theme()
    console.print(f"Current theme: {current.name}")
    
    # Show theme colors
    console.print("\nTheme Colors:")
    colors = current.colors
    console.print(f"  Background: {colors.background}")
    console.print(f"  Foreground: {colors.foreground}")
    console.print(f"  Accent Primary: {colors.accent_primary}")
    console.print(f"  Accent Secondary: {colors.accent_secondary}")
    
    console.print("\n")


def demo_styles():
    """Demo styles system"""
    console.print(Panel("Styles System Demo", style="bold green"))
    
    styles = get_styles()
    
    # Show different text styles
    console.print("\nText Styles:")
    console.print(Text("Primary text", style=styles.primary))
    console.print(Text("Success text", style=styles.success))
    console.print(Text("Warning text", style=styles.warning))
    console.print(Text("Error text", style=styles.error))
    console.print(Text("Info text", style=styles.info))
    console.print(Text("Muted text", style=styles.muted))
    
    # Show message boxes
    console.print("\nMessage Boxes:")
    console.print(create_info_box("This is an info message"))
    console.print(create_success_box("This is a success message"))
    console.print(create_warning_box("This is a warning message"))
    console.print(create_error_box("This is an error message"))
    
    console.print("\n")


def demo_chat():
    """Demo chat interface"""
    console.print(Panel("Chat Interface Demo", style="bold magenta"))
    
    chat = ChatInterface(console)
    
    # Display messages
    console.print("\nDisplaying messages:")
    
    chat.display_user_message("Hello, can you help me with Python?")
    chat.display_assistant_message("Of course! I'd be happy to help you with Python. What would you like to know?")
    
    # Display code
    chat.display_code("""
def hello_world():
    print("Hello, World!")
    return True

if __name__ == "__main__":
    hello_world()
""", language="python")
    
    # Display system message
    chat.display_system_message("System notification: Configuration updated", MessageType.INFO)
    
    console.print("\n")


def demo_status():
    """Demo status display"""
    console.print(Panel("Status Display Demo", style="bold cyan"))
    
    status = get_status_manager()
    
    # Create session
    status.create_session("demo-session-123", "claude-3-sonnet-20240229")
    
    # Simulate activity
    status.set_state(SessionState.PROCESSING)
    status.add_tokens(150, 300)
    status.increment_message_count()
    
    # Simulate tool execution
    tool = status.start_tool("file_read")
    tool.complete({"content": "file contents"})
    status.complete_tool()
    
    # Display status
    console.print("\nStatus Bar:")
    console.print(status.get_status_bar())
    
    console.print("\nSession Panel:")
    console.print(status.get_session_panel())
    
    console.print("\nTools Panel:")
    console.print(status.get_tools_panel())
    
    console.print("\n")


def demo_file_browser():
    """Demo file browser"""
    console.print(Panel("File Browser Demo", style="bold yellow"))
    
    browser = get_file_browser(".")
    
    # Show file list
    console.print("\nFile List:")
    console.print(browser.render_file_list())
    
    # Show file preview
    console.print("\nFile Preview:")
    console.print(browser.render_file_preview())
    
    console.print("\n")


def demo_config():
    """Demo configuration UI"""
    console.print(Panel("Configuration UI Demo", style="bold red"))
    
    config_ui = get_config_ui()
    
    # Show config menu
    console.print("\nConfig Menu:")
    console.print(config_ui.render_config_menu())
    
    # Show API config (masked)
    console.print("\nAPI Config:")
    console.print(config_ui.render_api_config(mask_key=True))
    
    # Show model config
    console.print("\nModel Config:")
    console.print(config_ui.render_model_config())
    
    console.print("\n")


async def demo_commands():
    """Demo command processing"""
    console.print(Panel("Command Processing Demo", style="bold white"))
    
    registry = get_command_registry()
    
    # List commands
    console.print("\nAvailable Commands:")
    for cmd in registry.get_all_commands():
        console.print(f"  {cmd.full_name} - {cmd.description}")
    
    # Execute help command
    console.print("\nExecuting /help command:")
    context = {
        "session_info": {"id": "demo"},
        "current_file": None,
        "current_dir": ".",
        "model": "claude-3-sonnet-20240229",
        "memory": {},
        "tools": [],
    }
    
    result = await execute_command("/help", context)
    
    if result.success and result.data:
        console.print(result.data)
    
    console.print("\n")


def demo_main_ui():
    """Demo main UI layout"""
    console.print(Panel("Main UI Layout Demo", style="bold blue"))
    
    ui = ClaudeUI(console)
    
    # Show layout
    console.print("\nUI Layout:")
    layout = ui.get_layout()
    console.print(layout)
    
    console.print("\n")


async def main():
    """Main demo function"""
    console.print(Panel.fit(
        "Claude Code Terminal UI Demo",
        style="bold white on blue",
        padding=(1, 4),
    ))
    console.print("")
    
    # Run demos
    demo_themes()
    demo_styles()
    demo_chat()
    demo_status()
    demo_file_browser()
    demo_config()
    await demo_commands()
    demo_main_ui()
    
    console.print(Panel.fit(
        "Demo Complete!",
        style="bold white on green",
        padding=(1, 4),
    ))
    
    # Interactive demo option
    console.print("\nWould you like to run the interactive UI? (y/n)")
    response = input("> ").strip().lower()
    
    if response in ('y', 'yes'):
        ui = ClaudeUI(console)
        
        # Set up a simple message handler
        def on_message(msg: str):
            console.print(f"[Handler] Received message: {msg}")
            # Echo back
            ui.add_assistant_message(f"You said: {msg}")
        
        ui.set_message_handler(on_message)
        
        await ui.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n\nDemo interrupted by user.")
        sys.exit(0)
