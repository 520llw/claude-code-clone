# Claude Code Terminal UI

A comprehensive terminal UI framework for Claude Code clone, built with Python Rich library.

## Features

- **Beautiful Terminal Interface** - Modern, responsive design with Rich library
- **Theme System** - Dark, light, and custom theme support
- **Chat Interface** - Message display with markdown, code highlighting, and streaming
- **Command Palette** - Slash commands with auto-completion
- **File Browser** - Navigate and preview files with syntax highlighting
- **Status Display** - Real-time session, token, and tool execution status
- **Configuration UI** - Interactive settings management

## Quick Start

```python
import asyncio
from ui import ClaudeUI, get_ui

async def main():
    # Create UI instance
    ui = get_ui()
    
    # Set up message handler
    def on_message(message: str):
        print(f"Received: {message}")
        ui.add_assistant_message(f"Echo: {message}")
    
    ui.set_message_handler(on_message)
    
    # Run the UI
    await ui.run()

if __name__ == "__main__":
    asyncio.run(main())
```

## Components

### 1. Theme System (`themes.py`)

Manage visual themes for the UI.

```python
from ui import theme_manager, set_theme, get_current_theme

# List available themes
print(theme_manager.list_themes())  # ['dark', 'light', 'high_contrast']

# Switch theme
set_theme('light')

# Get current theme colors
theme = get_current_theme()
print(theme.colors.background)
print(theme.colors.accent_primary)
```

### 2. Styles (`styles.py`)

Centralized styling for consistent UI appearance.

```python
from ui import get_styles, create_info_box, create_error_box

styles = get_styles()

# Use predefined styles
print(Text("Success!", style=styles.success))
print(Text("Error!", style=styles.error))

# Create message boxes
console.print(create_info_box("Information message"))
console.print(create_error_box("Error message"))
```

### 3. Chat Interface (`chat.py`)

Display and manage chat messages.

```python
from ui import get_chat_interface, Message, MessageRole, MessageType

chat = get_chat_interface()

# Display messages
chat.display_user_message("Hello!")
chat.display_assistant_message("Hi there!")

# Display code with syntax highlighting
chat.display_code("print('Hello')", language="python")

# Stream responses
async def stream_example():
    async def response_generator():
        words = ["Hello", " ", "world", "!"]
        for word in words:
            yield word
            await asyncio.sleep(0.1)
    
    await chat.stream_response(response_generator())
```

### 4. Command Processing (`commands.py`)

Handle slash commands with auto-completion.

```python
from ui import get_command_registry, execute_command, is_command

# Check if text is a command
if is_command("/help"):
    # Execute command
    result = await execute_command("/help", context={})
    
    if result.success:
        print(result.message)
    else:
        print(f"Error: {result.message}")

# Get command completions
completions = get_command_registry().get_completions("/he")
print(completions)  # ['/help']
```

Available commands:
- `/help` - Show help information
- `/context` - Show current context
- `/tools` - List available tools
- `/memory` - Manage memory
- `/status` - Show system status
- `/model` - Switch or show model
- `/theme` - Switch or list themes
- `/clear` - Clear the screen
- `/exit` - Exit the application

### 5. Status Display (`status.py`)

Display session status, token usage, and tool execution.

```python
from ui import get_status_manager, SessionState, ConnectionStatus

status = get_status_manager()

# Create session
status.create_session("session-123", "claude-3-sonnet-20240229")

# Update state
status.set_state(SessionState.PROCESSING)
status.set_connection_status(ConnectionStatus.CONNECTED)

# Track tokens
status.add_tokens(input_tokens=100, output_tokens=200)

# Track tool execution
tool = status.start_tool("file_read")
tool.complete(result={"content": "..."})
status.complete_tool()

# Display status
console.print(status.get_status_bar())
console.print(status.get_full_status())
```

### 6. File Browser (`file_browser.py`)

Navigate and preview files.

```python
from ui import get_file_browser

browser = get_file_browser(".")

# Navigate
browser.navigate_to("/path/to/dir")
browser.navigate_up()
browser.navigate_down()

# Get file info
file_info = browser.get_selected()
print(file_info.name)
print(file_info.formatted_size)

# Render views
console.print(browser.render_file_list())
console.print(browser.render_file_preview())
console.print(browser.render_tree_view())

# Get full layout
console.print(browser.get_layout())
```

### 7. Configuration UI (`config_ui.py`)

Manage application settings.

```python
from ui import get_config_ui, get_config_manager

config_ui = get_config_ui()
config_manager = get_config_manager()

# Display config
config_ui.display_config()

# Interactive configuration
config_ui.interactive_config()

# Get/set config values
api_key = config_manager.get("api.api_key")
config_manager.set("ui.theme", "dark")
config_manager.save_config()
```

### 8. Main UI (`main_ui.py`)

Main interface integrating all components.

```python
from ui import ClaudeUI, UIMode

ui = ClaudeUI()

# Set handlers
ui.set_message_handler(on_message)
ui.set_command_handler(on_command)

# Display messages
ui.add_system_message("System started", MessageType.INFO)
ui.add_assistant_message("Hello!")

# Switch modes
ui.switch_mode(UIMode.FILE_BROWSER)
ui.switch_mode(UIMode.CONFIG)

# Show specific views
ui.show_file_browser("/path")
ui.show_config()
ui.run_config_wizard()

# Run the UI
await ui.run()
```

## Keyboard Shortcuts

- `Tab` - Command completion
- `Ctrl+C` - Interrupt/Exit
- `↑/↓` - Navigate command history

## Themes

### Built-in Themes

1. **Dark** (default) - VS Code-like dark theme
2. **Light** - Clean light theme
3. **High Contrast** - Accessibility-focused theme

### Custom Themes

```python
from ui import theme_manager, Theme, ThemeType, ThemeColors

# Create custom theme
custom_theme = theme_manager.create_custom_theme(
    name="my_theme",
    base_theme="dark",
    color_overrides={
        "accent_primary": "#ff6b6b",
        "accent_secondary": "#4ecdc4",
    },
    rounded_corners=True,
)

# Use the theme
theme_manager.set_theme("my_theme")
```

## Architecture

```
ui/
├── __init__.py       # Package exports
├── themes.py         # Theme system
├── styles.py         # Shared styles
├── status.py         # Status display
├── chat.py           # Chat interface
├── commands.py       # Command processing
├── file_browser.py   # File browser
├── config_ui.py      # Configuration UI
└── main_ui.py        # Main UI class
```

## Examples

See `/examples/ui_demo.py` for a comprehensive demonstration of all UI features.

```bash
python examples/ui_demo.py
```

## Requirements

- Python 3.8+
- Rich library
- Additional dependencies as specified in setup.py
