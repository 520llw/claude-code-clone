"""
Configuration UI for Claude Code Terminal UI
Manages settings and configuration interface
"""

import os
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Callable
from enum import Enum, auto
from pathlib import Path

from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.console import Console, Group
from rich.layout import Layout
from rich.prompt import Prompt, Confirm
from rich.syntax import Syntax
from rich.tree import Tree

from .styles import get_styles, UIStyles, create_info_box, create_success_box, create_error_box
from .themes import get_current_theme, theme_manager, Theme, ThemeType


class ConfigCategory(Enum):
    """Configuration category enumeration"""
    GENERAL = "general"
    API = "api"
    UI = "ui"
    MODEL = "model"
    PERMISSIONS = "permissions"
    ADVANCED = "advanced"


@dataclass
class APIConfig:
    """API configuration"""
    api_key: str = ""
    api_base: str = "https://api.anthropic.com"
    api_version: str = "2023-06-01"
    timeout: int = 60
    max_retries: int = 3
    
    def is_configured(self) -> bool:
        """Check if API is configured"""
        return bool(self.api_key)


@dataclass
class ModelConfig:
    """Model configuration"""
    default_model: str = "claude-3-sonnet-20240229"
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 0
    
    available_models: List[str] = field(default_factory=lambda: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ])


@dataclass
class UIConfig:
    """UI configuration"""
    theme: str = "dark"
    show_borders: bool = True
    rounded_corners: bool = True
    compact_mode: bool = False
    font_size: int = 14
    line_height: float = 1.5
    enable_animations: bool = True
    animation_speed: float = 1.0
    show_timestamps: bool = True
    show_token_count: bool = True
    message_limit: int = 100


@dataclass
class PermissionConfig:
    """Permission configuration"""
    allow_file_read: bool = True
    allow_file_write: bool = False
    allow_file_delete: bool = False
    allow_shell_commands: bool = False
    allow_network_requests: bool = False
    allow_code_execution: bool = False
    confirm_destructive_actions: bool = True
    
    def get_permission_status(self) -> Dict[str, bool]:
        """Get permission status dictionary"""
        return {
            "File Read": self.allow_file_read,
            "File Write": self.allow_file_write,
            "File Delete": self.allow_file_delete,
            "Shell Commands": self.allow_shell_commands,
            "Network Requests": self.allow_network_requests,
            "Code Execution": self.allow_code_execution,
        }


@dataclass
class GeneralConfig:
    """General configuration"""
    auto_save: bool = True
    save_history: bool = True
    history_limit: int = 1000
    startup_message: bool = True
    sound_enabled: bool = False
    language: str = "en"
    timezone: str = "UTC"


@dataclass
class AdvancedConfig:
    """Advanced configuration"""
    debug_mode: bool = False
    verbose_logging: bool = False
    log_level: str = "INFO"
    log_file: str = ""
    custom_plugins: List[str] = field(default_factory=list)
    experimental_features: Dict[str, bool] = field(default_factory=dict)


@dataclass
class AppConfig:
    """Complete application configuration"""
    general: GeneralConfig = field(default_factory=GeneralConfig)
    api: APIConfig = field(default_factory=APIConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    ui: UIConfig = field(default_factory=UIConfig)
    permissions: PermissionConfig = field(default_factory=PermissionConfig)
    advanced: AdvancedConfig = field(default_factory=AdvancedConfig)
    
    # Custom settings
    custom: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AppConfig":
        """Create from dictionary"""
        return cls(
            general=GeneralConfig(**data.get("general", {})),
            api=APIConfig(**data.get("api", {})),
            model=ModelConfig(**data.get("model", {})),
            ui=UIConfig(**data.get("ui", {})),
            permissions=PermissionConfig(**data.get("permissions", {})),
            advanced=AdvancedConfig(**data.get("advanced", {})),
            custom=data.get("custom", {}),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "general": asdict(self.general),
            "api": asdict(self.api),
            "model": asdict(self.model),
            "ui": asdict(self.ui),
            "permissions": asdict(self.permissions),
            "advanced": asdict(self.advanced),
            "custom": self.custom,
        }


class ConfigManager:
    """Manages application configuration"""
    
    DEFAULT_CONFIG_PATH = Path.home() / ".config" / "claude_code" / "config.json"
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or self.DEFAULT_CONFIG_PATH
        self.config = AppConfig()
        self._load_config()
    
    def _load_config(self):
        """Load configuration from file"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    data = json.load(f)
                    self.config = AppConfig.from_dict(data)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load config: {e}")
    
    def save_config(self):
        """Save configuration to file"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(self.config.to_dict(), f, indent=2)
            return True
        except IOError as e:
            print(f"Error saving config: {e}")
            return False
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value by key"""
        parts = key.split('.')
        value = self.config
        
        for part in parts:
            if hasattr(value, part):
                value = getattr(value, part)
            elif isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any) -> bool:
        """Set a configuration value by key"""
        parts = key.split('.')
        target = self.config
        
        for part in parts[:-1]:
            if hasattr(target, part):
                target = getattr(target, part)
            elif isinstance(target, dict) and part in target:
                target = target[part]
            else:
                return False
        
        last_part = parts[-1]
        if hasattr(target, last_part):
            setattr(target, last_part, value)
            return True
        elif isinstance(target, dict):
            target[last_part] = value
            return True
        
        return False
    
    def reset_to_defaults(self):
        """Reset configuration to defaults"""
        self.config = AppConfig()
        self.save_config()


class ConfigUI:
    """Configuration UI component"""
    
    def __init__(self, config_manager: Optional[ConfigManager] = None):
        self.styles = get_styles()
        self.config_manager = config_manager or ConfigManager()
        self.console = Console()
    
    def render_config_menu(self) -> Panel:
        """Render configuration menu"""
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.syntax_keyword, width=20)
        table.add_column(style=styles.base)
        
        categories = [
            (ConfigCategory.GENERAL, "General settings"),
            (ConfigCategory.API, "API configuration"),
            (ConfigCategory.MODEL, "Model settings"),
            (ConfigCategory.UI, "UI preferences"),
            (ConfigCategory.PERMISSIONS, "Permission settings"),
            (ConfigCategory.ADVANCED, "Advanced options"),
        ]
        
        for cat, desc in categories:
            table.add_row(cat.value.title(), desc)
        
        return Panel(
            table,
            title="Configuration Menu",
            border_style=styles.theme.colors.accent_info,
            padding=(1, 2),
        )
    
    def render_general_config(self) -> Panel:
        """Render general configuration"""
        config = self.config_manager.config.general
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=25)
        table.add_column(style=styles.base)
        
        table.add_row("Auto Save", "✓" if config.auto_save else "✗")
        table.add_row("Save History", "✓" if config.save_history else "✗")
        table.add_row("History Limit", str(config.history_limit))
        table.add_row("Startup Message", "✓" if config.startup_message else "✗")
        table.add_row("Sound Enabled", "✓" if config.sound_enabled else "✗")
        table.add_row("Language", config.language)
        table.add_row("Timezone", config.timezone)
        
        return Panel(
            table,
            title="General Settings",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_api_config(self, mask_key: bool = True) -> Panel:
        """Render API configuration"""
        config = self.config_manager.config.api
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=20)
        table.add_column(style=styles.base)
        
        # Mask API key for security
        api_key_display = "*" * 20 if mask_key and config.api_key else config.api_key
        if not config.api_key:
            api_key_display = Text("Not configured", style=styles.warning)
        
        table.add_row("API Key", api_key_display)
        table.add_row("API Base", config.api_base)
        table.add_row("API Version", config.api_version)
        table.add_row("Timeout", f"{config.timeout}s")
        table.add_row("Max Retries", str(config.max_retries))
        
        status = Text("✓ Configured", style=styles.success) if config.is_configured() else Text("✗ Not configured", style=styles.error)
        table.add_row("Status", status)
        
        return Panel(
            table,
            title="API Configuration",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_model_config(self) -> Panel:
        """Render model configuration"""
        config = self.config_manager.config.model
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=20)
        table.add_column(style=styles.base)
        
        table.add_row("Default Model", config.default_model)
        table.add_row("Max Tokens", str(config.max_tokens))
        table.add_row("Temperature", f"{config.temperature:.2f}")
        table.add_row("Top P", f"{config.top_p:.2f}")
        table.add_row("Top K", str(config.top_k))
        
        return Panel(
            table,
            title="Model Settings",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_ui_config(self) -> Panel:
        """Render UI configuration"""
        config = self.config_manager.config.ui
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=25)
        table.add_column(style=styles.base)
        
        table.add_row("Theme", config.theme)
        table.add_row("Show Borders", "✓" if config.show_borders else "✗")
        table.add_row("Rounded Corners", "✓" if config.rounded_corners else "✗")
        table.add_row("Compact Mode", "✓" if config.compact_mode else "✗")
        table.add_row("Font Size", str(config.font_size))
        table.add_row("Line Height", str(config.line_height))
        table.add_row("Animations", "✓" if config.enable_animations else "✗")
        table.add_row("Animation Speed", f"{config.animation_speed}x")
        table.add_row("Show Timestamps", "✓" if config.show_timestamps else "✗")
        table.add_row("Show Token Count", "✓" if config.show_token_count else "✗")
        table.add_row("Message Limit", str(config.message_limit))
        
        return Panel(
            table,
            title="UI Preferences",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_permissions_config(self) -> Panel:
        """Render permissions configuration"""
        config = self.config_manager.config.permissions
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=25)
        table.add_column(style=styles.base)
        
        permissions = config.get_permission_status()
        
        for name, enabled in permissions.items():
            status = Text("✓ Allowed", style=styles.success) if enabled else Text("✗ Denied", style=styles.error)
            table.add_row(name, status)
        
        table.add_row(
            "Confirm Destructive",
            Text("✓ Enabled", style=styles.success) if config.confirm_destructive_actions else Text("✗ Disabled", style=styles.error),
        )
        
        return Panel(
            table,
            title="Permission Settings",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_advanced_config(self) -> Panel:
        """Render advanced configuration"""
        config = self.config_manager.config.advanced
        styles = self.styles
        
        table = Table(show_header=False, box=None)
        table.add_column(style=styles.muted, width=25)
        table.add_column(style=styles.base)
        
        table.add_row("Debug Mode", "✓" if config.debug_mode else "✗")
        table.add_row("Verbose Logging", "✓" if config.verbose_logging else "✗")
        table.add_row("Log Level", config.log_level)
        table.add_row("Log File", config.log_file or "Default")
        table.add_row("Custom Plugins", str(len(config.custom_plugins)))
        
        return Panel(
            table,
            title="Advanced Options",
            border_style=styles.theme.colors.accent_info,
        )
    
    def render_full_config(self) -> Layout:
        """Render full configuration layout"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="content"),
        )
        
        layout["content"].split_row(
            Layout(name="menu", ratio=1),
            Layout(name="settings", ratio=2),
        )
        
        # Header
        header_text = Text.assemble(
            Text("Configuration", style=self.styles.header),
            Text("  ", style=self.styles.base),
            Text(str(self.config_manager.config_path), style=self.styles.muted),
        )
        layout["header"].update(Panel(header_text, border_style=self.styles.theme.colors.border))
        
        # Menu
        layout["menu"].update(self.render_config_menu())
        
        # Settings (show all)
        settings_group = Group(
            self.render_general_config(),
            self.render_api_config(),
            self.render_model_config(),
            self.render_ui_config(),
            self.render_permissions_config(),
            self.render_advanced_config(),
        )
        layout["settings"].update(Panel(settings_group, border_style=self.styles.theme.colors.border))
        
        return layout
    
    def prompt_for_api_key(self) -> bool:
        """Prompt user for API key"""
        styles = self.styles
        
        self.console.print(Panel(
            Text("Please enter your Anthropic API key", style=styles.info),
            title="API Key Setup",
            border_style=styles.theme.colors.accent_info,
        ))
        
        api_key = Prompt.ask("API Key", password=True)
        
        if api_key:
            self.config_manager.config.api.api_key = api_key
            self.config_manager.save_config()
            self.console.print(create_success_box("API key saved successfully"))
            return True
        else:
            self.console.print(create_error_box("API key cannot be empty"))
            return False
    
    def prompt_for_setting(self, category: str, setting: str, current_value: Any, description: str = "") -> Any:
        """Prompt user for a setting value"""
        styles = self.styles
        
        prompt_text = f"{category}.{setting}"
        if description:
            prompt_text += f" ({description})"
        
        if isinstance(current_value, bool):
            new_value = Confirm.ask(prompt_text, default=current_value)
        elif isinstance(current_value, int):
            new_value = Prompt.ask(prompt_text, default=str(current_value))
            try:
                new_value = int(new_value)
            except ValueError:
                new_value = current_value
        elif isinstance(current_value, float):
            new_value = Prompt.ask(prompt_text, default=str(current_value))
            try:
                new_value = float(new_value)
            except ValueError:
                new_value = current_value
        else:
            new_value = Prompt.ask(prompt_text, default=str(current_value))
        
        return new_value
    
    def interactive_config(self):
        """Interactive configuration wizard"""
        styles = self.styles
        
        self.console.print(Panel(
            Text("Welcome to the configuration wizard!", style=styles.header),
            subtitle="Follow the prompts to configure Claude Code",
            border_style=styles.theme.colors.accent_info,
        ))
        
        # API Configuration
        self.console.print("\n[bold]API Configuration[/bold]")
        if not self.config_manager.config.api.is_configured():
            self.prompt_for_api_key()
        
        # Model Configuration
        self.console.print("\n[bold]Model Configuration[/bold]")
        config = self.config_manager.config.model
        
        # Show available models
        self.console.print("Available models:")
        for i, model in enumerate(config.available_models, 1):
            marker = "●" if model == config.default_model else "○"
            self.console.print(f"  {marker} {model}")
        
        new_model = Prompt.ask(
            "Select default model",
            choices=config.available_models,
            default=config.default_model,
        )
        config.default_model = new_model
        
        # Temperature
        new_temp = Prompt.ask(
            "Temperature (0.0 - 1.0)",
            default=str(config.temperature),
        )
        try:
            config.temperature = max(0.0, min(1.0, float(new_temp)))
        except ValueError:
            pass
        
        # UI Configuration
        self.console.print("\n[bold]UI Configuration[/bold]")
        ui_config = self.config_manager.config.ui
        
        # Theme selection
        themes = theme_manager.list_themes()
        new_theme = Prompt.ask(
            "Select theme",
            choices=themes,
            default=ui_config.theme,
        )
        ui_config.theme = new_theme
        theme_manager.set_theme(new_theme)
        
        # Save configuration
        self.config_manager.save_config()
        self.console.print(create_success_box("Configuration saved!"))
    
    def display_config(self):
        """Display current configuration"""
        self.console.print(self.render_full_config())
    
    def export_config(self, path: str) -> bool:
        """Export configuration to file"""
        try:
            export_path = Path(path)
            export_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(export_path, 'w') as f:
                json.dump(self.config_manager.config.to_dict(), f, indent=2)
            
            return True
        except IOError:
            return False
    
    def import_config(self, path: str) -> bool:
        """Import configuration from file"""
        try:
            import_path = Path(path)
            
            with open(import_path, 'r') as f:
                data = json.load(f)
            
            self.config_manager.config = AppConfig.from_dict(data)
            self.config_manager.save_config()
            
            return True
        except (IOError, json.JSONDecodeError):
            return False


# Global config UI instance
_config_ui: Optional[ConfigUI] = None


def get_config_ui(config_manager: Optional[ConfigManager] = None) -> ConfigUI:
    """Get the global config UI instance"""
    global _config_ui
    if _config_ui is None:
        _config_ui = ConfigUI(config_manager)
    return _config_ui


def get_config_manager() -> ConfigManager:
    """Get the global config manager"""
    return ConfigManager()
