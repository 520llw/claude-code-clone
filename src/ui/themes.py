"""
Theme System for Claude Code Terminal UI
Supports dark, light, and custom themes
"""

from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from enum import Enum, auto


class ThemeType(Enum):
    """Theme type enumeration"""
    DARK = auto()
    LIGHT = auto()
    CUSTOM = auto()


@dataclass
class ThemeColors:
    """Color palette for a theme"""
    # Background colors
    background: str = "#1e1e1e"
    background_secondary: str = "#252526"
    background_tertiary: str = "#2d2d30"
    
    # Foreground colors
    foreground: str = "#d4d4d4"
    foreground_secondary: str = "#9cdcfe"
    foreground_muted: str = "#808080"
    
    # Accent colors
    accent_primary: str = "#007acc"
    accent_secondary: str = "#4ec9b0"
    accent_success: str = "#4ec9b0"
    accent_warning: str = "#dcdcaa"
    accent_error: str = "#f44747"
    accent_info: str = "#569cd6"
    
    # Syntax highlighting
    syntax_keyword: str = "#569cd6"
    syntax_string: str = "#ce9178"
    syntax_comment: str = "#6a9955"
    syntax_function: str = "#dcdcaa"
    syntax_number: str = "#b5cea8"
    syntax_operator: str = "#d4d4d4"
    syntax_class: str = "#4ec9b0"
    
    # UI elements
    border: str = "#3e3e42"
    border_focused: str = "#007acc"
    selection: str = "#264f78"
    selection_inactive: str = "#3a3d41"
    
    # Message colors
    user_message_bg: str = "#2d2d30"
    assistant_message_bg: str = "#1e1e1e"
    system_message_bg: str = "#252526"
    
    # Status colors
    status_online: str = "#4ec9b0"
    status_busy: str = "#dcdcaa"
    status_offline: str = "#f44747"
    status_idle: str = "#808080"


@dataclass
class Theme:
    """Complete theme definition"""
    name: str
    theme_type: ThemeType
    colors: ThemeColors = field(default_factory=ThemeColors)
    
    # UI configuration
    show_borders: bool = True
    rounded_corners: bool = True
    compact_mode: bool = False
    
    # Typography
    font_size: int = 14
    line_height: float = 1.5
    
    # Animations
    enable_animations: bool = True
    animation_speed: float = 1.0
    
    # Custom properties
    custom_properties: Dict[str, Any] = field(default_factory=dict)


class ThemeManager:
    """Manages themes and theme switching"""
    
    def __init__(self):
        self._themes: Dict[str, Theme] = {}
        self._current_theme: Optional[str] = None
        self._initialize_default_themes()
    
    def _initialize_default_themes(self):
        """Initialize default dark and light themes"""
        # Dark theme (default)
        dark_theme = Theme(
            name="dark",
            theme_type=ThemeType.DARK,
            colors=ThemeColors(
                background="#1e1e1e",
                background_secondary="#252526",
                background_tertiary="#2d2d30",
                foreground="#d4d4d4",
                foreground_secondary="#9cdcfe",
                foreground_muted="#808080",
                accent_primary="#007acc",
                accent_secondary="#4ec9b0",
                accent_success="#4ec9b0",
                accent_warning="#dcdcaa",
                accent_error="#f44747",
                accent_info="#569cd6",
                syntax_keyword="#569cd6",
                syntax_string="#ce9178",
                syntax_comment="#6a9955",
                syntax_function="#dcdcaa",
                syntax_number="#b5cea8",
                syntax_operator="#d4d4d4",
                syntax_class="#4ec9b0",
                border="#3e3e42",
                border_focused="#007acc",
                selection="#264f78",
                selection_inactive="#3a3d41",
                user_message_bg="#2d2d30",
                assistant_message_bg="#1e1e1e",
                system_message_bg="#252526",
                status_online="#4ec9b0",
                status_busy="#dcdcaa",
                status_offline="#f44747",
                status_idle="#808080",
            ),
            show_borders=True,
            rounded_corners=True,
            compact_mode=False,
        )
        self._themes["dark"] = dark_theme
        
        # Light theme
        light_theme = Theme(
            name="light",
            theme_type=ThemeType.LIGHT,
            colors=ThemeColors(
                background="#ffffff",
                background_secondary="#f3f3f3",
                background_tertiary="#e8e8e8",
                foreground="#333333",
                foreground_secondary="#0078d4",
                foreground_muted="#666666",
                accent_primary="#0078d4",
                accent_secondary="#107c10",
                accent_success="#107c10",
                accent_warning="#ffc107",
                accent_error="#d32f2f",
                accent_info="#1976d2",
                syntax_keyword="#0000ff",
                syntax_string="#a31515",
                syntax_comment="#008000",
                syntax_function="#795e26",
                syntax_number="#098658",
                syntax_operator="#333333",
                syntax_class="#267f99",
                border="#e0e0e0",
                border_focused="#0078d4",
                selection="#add6ff",
                selection_inactive="#e5ebf1",
                user_message_bg="#f3f3f3",
                assistant_message_bg="#ffffff",
                system_message_bg="#e8e8e8",
                status_online="#107c10",
                status_busy="#ffc107",
                status_offline="#d32f2f",
                status_idle="#666666",
            ),
            show_borders=True,
            rounded_corners=True,
            compact_mode=False,
        )
        self._themes["light"] = light_theme
        
        # High contrast theme
        high_contrast_theme = Theme(
            name="high_contrast",
            theme_type=ThemeType.DARK,
            colors=ThemeColors(
                background="#000000",
                background_secondary="#000000",
                background_tertiary="#000000",
                foreground="#ffffff",
                foreground_secondary="#ffffff",
                foreground_muted="#ffffff",
                accent_primary="#ffff00",
                accent_secondary="#00ff00",
                accent_success="#00ff00",
                accent_warning="#ffff00",
                accent_error="#ff0000",
                accent_info="#00ffff",
                syntax_keyword="#00ffff",
                syntax_string="#ff8080",
                syntax_comment="#00ff00",
                syntax_function="#ffff00",
                syntax_number="#ff00ff",
                syntax_operator="#ffffff",
                syntax_class="#00ff00",
                border="#ffffff",
                border_focused="#ffff00",
                selection="#ffffff",
                selection_inactive="#808080",
                user_message_bg="#000000",
                assistant_message_bg="#000000",
                system_message_bg="#000000",
                status_online="#00ff00",
                status_busy="#ffff00",
                status_offline="#ff0000",
                status_idle="#808080",
            ),
            show_borders=True,
            rounded_corners=False,
            compact_mode=True,
        )
        self._themes["high_contrast"] = high_contrast_theme
        
        # Set default theme
        self._current_theme = "dark"
    
    @property
    def current_theme(self) -> Theme:
        """Get current theme"""
        if self._current_theme is None:
            raise RuntimeError("No theme selected")
        return self._themes[self._current_theme]
    
    @property
    def current_theme_name(self) -> str:
        """Get current theme name"""
        return self._current_theme or "dark"
    
    def set_theme(self, name: str) -> bool:
        """Set current theme by name"""
        if name in self._themes:
            self._current_theme = name
            return True
        return False
    
    def get_theme(self, name: str) -> Optional[Theme]:
        """Get theme by name"""
        return self._themes.get(name)
    
    def register_theme(self, theme: Theme) -> None:
        """Register a custom theme"""
        self._themes[theme.name] = theme
    
    def list_themes(self) -> list[str]:
        """List all available theme names"""
        return list(self._themes.keys())
    
    def create_custom_theme(
        self,
        name: str,
        base_theme: str = "dark",
        color_overrides: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Theme:
        """Create a custom theme based on an existing theme"""
        base = self._themes.get(base_theme, self._themes["dark"])
        
        # Create new colors with overrides
        colors = ThemeColors()
        for field_name in colors.__dataclass_fields__:
            base_value = getattr(base.colors, field_name)
            if color_overrides and field_name in color_overrides:
                setattr(colors, field_name, color_overrides[field_name])
            else:
                setattr(colors, field_name, base_value)
        
        # Create new theme
        theme = Theme(
            name=name,
            theme_type=ThemeType.CUSTOM,
            colors=colors,
            show_borders=kwargs.get("show_borders", base.show_borders),
            rounded_corners=kwargs.get("rounded_corners", base.rounded_corners),
            compact_mode=kwargs.get("compact_mode", base.compact_mode),
            font_size=kwargs.get("font_size", base.font_size),
            line_height=kwargs.get("line_height", base.line_height),
            enable_animations=kwargs.get("enable_animations", base.enable_animations),
            animation_speed=kwargs.get("animation_speed", base.animation_speed),
        )
        
        self.register_theme(theme)
        return theme
    
    def get_color(self, color_name: str, default: str = "#ffffff") -> str:
        """Get a color from the current theme"""
        theme = self.current_theme
        return getattr(theme.colors, color_name, default)
    
    def get_rich_style(self, style_name: str) -> str:
        """Get a Rich-compatible style string"""
        theme = self.current_theme
        color = getattr(theme.colors, style_name, None)
        if color:
            return color
        
        # Map common style names to colors
        style_map = {
            "info": theme.colors.accent_info,
            "success": theme.colors.accent_success,
            "warning": theme.colors.accent_warning,
            "error": theme.colors.accent_error,
            "primary": theme.colors.accent_primary,
            "secondary": theme.colors.accent_secondary,
            "muted": theme.colors.foreground_muted,
            "border": theme.colors.border,
            "border_focused": theme.colors.border_focused,
        }
        
        return style_map.get(style_name, default)


# Global theme manager instance
theme_manager = ThemeManager()


def get_theme_manager() -> ThemeManager:
    """Get the global theme manager instance"""
    return theme_manager


def get_current_theme() -> Theme:
    """Get the current theme"""
    return theme_manager.current_theme


def set_theme(name: str) -> bool:
    """Set the current theme"""
    return theme_manager.set_theme(name)
