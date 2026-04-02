"""
Tests for Claude Code Terminal UI
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ui import (
    # Themes
    Theme, ThemeType, ThemeColors, theme_manager, set_theme, get_current_theme,
    
    # Styles
    UIStyles, get_styles, refresh_styles,
    
    # Status
    StatusManager, SessionInfo, SessionState, ConnectionStatus, TokenUsage, ToolExecution,
    
    # Chat
    Message, MessageRole, MessageType, ChatHistory, CodeBlockExtractor,
    
    # Commands
    Command, CommandCategory, CommandResult, CommandRegistry,
    
    # File Browser
    FileBrowser, FileInfo, FileType,
    
    # Config
    AppConfig, APIConfig, ModelConfig, UIConfig, PermissionConfig, ConfigManager,
    
    # Main UI
    ClaudeUI, UIMode, UIState,
)


# ==================== Theme Tests ====================

class TestThemes:
    """Test theme system"""
    
    def test_theme_creation(self):
        """Test theme creation"""
        theme = Theme(
            name="test",
            theme_type=ThemeType.CUSTOM,
            colors=ThemeColors(),
        )
        assert theme.name == "test"
        assert theme.theme_type == ThemeType.CUSTOM
    
    def test_default_themes_exist(self):
        """Test default themes are initialized"""
        themes = theme_manager.list_themes()
        assert "dark" in themes
        assert "light" in themes
        assert "high_contrast" in themes
    
    def test_theme_switching(self):
        """Test theme switching"""
        original_theme = theme_manager.current_theme_name
        
        # Switch to light theme
        result = set_theme("light")
        assert result is True
        assert theme_manager.current_theme_name == "light"
        
        # Switch back
        set_theme(original_theme)
    
    def test_custom_theme_creation(self):
        """Test custom theme creation"""
        custom = theme_manager.create_custom_theme(
            name="test_custom",
            base_theme="dark",
            color_overrides={"accent_primary": "#ff0000"},
        )
        
        assert custom.name == "test_custom"
        assert custom.colors.accent_primary == "#ff0000"
        assert "test_custom" in theme_manager.list_themes()


# ==================== Style Tests ====================

class TestStyles:
    """Test styles system"""
    
    def test_styles_initialization(self):
        """Test styles initialization"""
        styles = get_styles()
        assert isinstance(styles, UIStyles)
        assert styles.theme is not None
    
    def test_style_attributes(self):
        """Test style attributes exist"""
        styles = get_styles()
        
        # Check main styles exist
        assert hasattr(styles, 'base')
        assert hasattr(styles, 'primary')
        assert hasattr(styles, 'success')
        assert hasattr(styles, 'warning')
        assert hasattr(styles, 'error')
        assert hasattr(styles, 'info')
        assert hasattr(styles, 'muted')


# ==================== Status Tests ====================

class TestStatus:
    """Test status system"""
    
    def test_token_usage(self):
        """Test token usage tracking"""
        usage = TokenUsage()
        assert usage.input_tokens == 0
        assert usage.output_tokens == 0
        
        usage.add(input_tokens=100, output_tokens=200)
        assert usage.input_tokens == 100
        assert usage.output_tokens == 200
        assert usage.total_tokens == 300
    
    def test_tool_execution(self):
        """Test tool execution tracking"""
        tool = ToolExecution(tool_name="test_tool")
        assert tool.tool_name == "test_tool"
        assert tool.status == "running"
        
        tool.complete(result={"data": "test"})
        assert tool.status == "completed"
        assert tool.result == {"data": "test"}
        assert tool.duration >= 0
    
    def test_session_info(self):
        """Test session info"""
        session = SessionInfo(
            session_id="test-123",
            model="claude-3-test",
        )
        assert session.session_id == "test-123"
        assert session.model == "claude-3-test"
        assert session.duration.total_seconds() >= 0


# ==================== Chat Tests ====================

class TestChat:
    """Test chat system"""
    
    def test_message_creation(self):
        """Test message creation"""
        msg = Message(
            content="Hello",
            role=MessageRole.USER,
            message_type=MessageType.TEXT,
        )
        assert msg.content == "Hello"
        assert msg.role == MessageRole.USER
        assert msg.role_name == "You"
        assert msg.role_icon == "👤"
    
    def test_chat_history(self):
        """Test chat history"""
        history = ChatHistory(max_messages=10)
        
        # Add messages
        for i in range(5):
            msg = Message(content=f"Message {i}", role=MessageRole.USER)
            history.add_message(msg)
        
        assert len(history.messages) == 5
        
        # Test limit
        for i in range(10):
            msg = Message(content=f"Extra {i}", role=MessageRole.USER)
            history.add_message(msg)
        
        assert len(history.messages) == 10
    
    def test_code_block_extraction(self):
        """Test code block extraction"""
        extractor = CodeBlockExtractor()
        
        text = """
Some text
```python
print("hello")
```
More text
```javascript
console.log("hi");
```
"""
        
        blocks = extractor.extract_code_blocks(text)
        assert len(blocks) == 2
        assert blocks[0]['language'] == 'python'
        assert blocks[1]['language'] == 'javascript'


# ==================== Command Tests ====================

class TestCommands:
    """Test command system"""
    
    def test_command_creation(self):
        """Test command creation"""
        async def handler(args, context):
            return CommandResult.ok("Success")
        
        cmd = Command(
            name="test",
            description="Test command",
            category=CommandCategory.GENERAL,
            handler=handler,
        )
        
        assert cmd.name == "test"
        assert cmd.full_name == "/test"
        assert cmd.description == "Test command"
    
    def test_command_result(self):
        """Test command result"""
        result = CommandResult.ok("Success", data={"key": "value"})
        assert result.success is True
        assert result.message == "Success"
        assert result.data == {"key": "value"}
        
        error_result = CommandResult.error("Failed")
        assert error_result.success is False
        assert error_result.message == "Failed"
    
    @pytest.mark.asyncio
    async def test_command_registry(self):
        """Test command registry"""
        registry = CommandRegistry()
        
        # Check default commands exist
        assert registry.get_command("help") is not None
        assert registry.get_command("exit") is not None
        assert registry.get_command("clear") is not None
        
        # Test completions
        completions = registry.get_completions("/he")
        assert "/help" in completions


# ==================== File Browser Tests ====================

class TestFileBrowser:
    """Test file browser"""
    
    def test_file_info(self):
        """Test file info"""
        # Test with current directory
        info = FileInfo(Path("."))
        assert info.file_type == FileType.DIRECTORY
        assert info.icon == "📁"
        assert info.formatted_size == "<DIR>"
    
    def test_file_browser_creation(self):
        """Test file browser creation"""
        browser = FileBrowser(".")
        assert browser.current_path == Path(".").resolve()
        assert len(browser.files) > 0
    
    def test_file_browser_navigation(self):
        """Test file browser navigation"""
        browser = FileBrowser(".")
        original_path = browser.current_path
        
        # Navigate up
        if browser.navigate_up():
            assert browser.current_path != original_path
        
        # Navigate back
        browser.navigate_to(str(original_path))
        assert browser.current_path == original_path


# ==================== Config Tests ====================

class TestConfig:
    """Test configuration system"""
    
    def test_api_config(self):
        """Test API config"""
        config = APIConfig()
        assert config.api_base == "https://api.anthropic.com"
        assert config.timeout == 60
        assert config.is_configured() is False
        
        config.api_key = "test-key"
        assert config.is_configured() is True
    
    def test_model_config(self):
        """Test model config"""
        config = ModelConfig()
        assert config.default_model == "claude-3-sonnet-20240229"
        assert config.max_tokens == 4096
        assert len(config.available_models) == 3
    
    def test_permission_config(self):
        """Test permission config"""
        config = PermissionConfig()
        assert config.allow_file_read is True
        assert config.allow_file_write is False
        
        perms = config.get_permission_status()
        assert "File Read" in perms
        assert "File Write" in perms
    
    def test_app_config_serialization(self):
        """Test app config serialization"""
        config = AppConfig()
        config.api.api_key = "test-key"
        config.ui.theme = "light"
        
        # Convert to dict
        data = config.to_dict()
        assert data["api"]["api_key"] == "test-key"
        assert data["ui"]["theme"] == "light"
        
        # Convert back
        restored = AppConfig.from_dict(data)
        assert restored.api.api_key == "test-key"
        assert restored.ui.theme == "light"


# ==================== Main UI Tests ====================

class TestMainUI:
    """Test main UI"""
    
    def test_ui_state(self):
        """Test UI state"""
        state = UIState()
        assert state.mode == UIMode.CHAT
        assert state.is_running is False
        assert state.show_status_bar is True
    
    def test_ui_creation(self):
        """Test UI creation"""
        ui = ClaudeUI()
        assert ui.state is not None
        assert ui.chat is not None
        assert ui.commands is not None
        assert ui.status is not None
    
    def test_ui_context(self):
        """Test UI context"""
        ui = ClaudeUI()
        
        # Set context
        ui.update_context("test_key", "test_value")
        assert ui.get_context("test_key") == "test_value"
        
        # Get with default
        assert ui.get_context("missing", "default") == "default"


# ==================== Integration Tests ====================

class TestIntegration:
    """Integration tests"""
    
    def test_full_ui_stack(self):
        """Test full UI stack initialization"""
        from ui import (
            get_ui, get_chat_interface, get_status_manager,
            get_command_registry, get_file_browser, get_config_ui,
        )
        
        # Get all singletons
        ui = get_ui()
        chat = get_chat_interface()
        status = get_status_manager()
        commands = get_command_registry()
        browser = get_file_browser()
        config = get_config_ui()
        
        # Verify all are initialized
        assert ui is not None
        assert chat is not None
        assert status is not None
        assert commands is not None
        assert browser is not None
        assert config is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
