"""
File Browser for Claude Code Terminal UI
Provides file system navigation and preview
"""

import os
import stat
from dataclasses import dataclass, field
from typing import Optional, List, Callable, Dict, Any
from datetime import datetime
from enum import Enum, auto
from pathlib import Path

from rich.text import Text
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree
from rich.console import Console, Group
from rich.layout import Layout
from rich.syntax import Syntax
from rich.align import Align
from rich.padding import Padding

from .styles import get_styles, UIStyles
from .themes import get_current_theme


class FileType(Enum):
    """File type enumeration"""
    DIRECTORY = auto()
    FILE = auto()
    SYMLINK = auto()
    UNKNOWN = auto()


@dataclass
class FileInfo:
    """File information"""
    path: Path
    name: str = ""
    file_type: FileType = FileType.UNKNOWN
    size: int = 0
    modified_time: datetime = field(default_factory=datetime.now)
    permissions: str = ""
    is_hidden: bool = False
    
    def __post_init__(self):
        if not self.name:
            self.name = self.path.name
        
        # Determine file type
        if self.path.is_symlink():
            self.file_type = FileType.SYMLINK
        elif self.path.is_dir():
            self.file_type = FileType.DIRECTORY
        elif self.path.is_file():
            self.file_type = FileType.FILE
        else:
            self.file_type = FileType.UNKNOWN
        
        # Get file stats
        try:
            stat_info = self.path.stat()
            self.size = stat_info.st_size
            self.modified_time = datetime.fromtimestamp(stat_info.st_mtime)
            self.permissions = stat.filemode(stat_info.st_mode)
        except (OSError, IOError):
            pass
        
        # Check if hidden
        self.is_hidden = self.name.startswith('.')
    
    @property
    def icon(self) -> str:
        """Get file icon"""
        icons = {
            FileType.DIRECTORY: "📁",
            FileType.FILE: self._get_file_icon(),
            FileType.SYMLINK: "🔗",
            FileType.UNKNOWN: "❓",
        }
        return icons.get(self.file_type, "📄")
    
    def _get_file_icon(self) -> str:
        """Get icon based on file extension"""
        ext = self.path.suffix.lower()
        
        icon_map = {
            '.py': '🐍',
            '.js': '📜',
            '.ts': '📘',
            '.jsx': '⚛️',
            '.tsx': '⚛️',
            '.html': '🌐',
            '.css': '🎨',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.toml': '⚙️',
            '.ini': '⚙️',
            '.cfg': '⚙️',
            '.sh': '🔧',
            '.bash': '🔧',
            '.zsh': '🔧',
            '.fish': '🔧',
            '.rs': '🦀',
            '.go': '🔵',
            '.java': '☕',
            '.cpp': '⚙️',
            '.c': '⚙️',
            '.h': '⚙️',
            '.hpp': '⚙️',
            '.rb': '💎',
            '.php': '🐘',
            '.swift': '🦉',
            '.kt': '🟣',
            '.scala': '🔴',
            '.r': '📊',
            '.sql': '🗄️',
            '.db': '🗄️',
            '.sqlite': '🗄️',
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.png': '🖼️',
            '.gif': '🖼️',
            '.svg': '🖼️',
            '.mp3': '🎵',
            '.mp4': '🎬',
            '.wav': '🎵',
            '.zip': '📦',
            '.tar': '📦',
            '.gz': '📦',
            '.rar': '📦',
            '.7z': '📦',
            '.pdf': '📕',
            '.doc': '📘',
            '.docx': '📘',
            '.xls': '📗',
            '.xlsx': '📗',
            '.ppt': '📙',
            '.pptx': '📙',
            '.gitignore': '🚫',
            '.dockerignore': '🐳',
            'dockerfile': '🐳',
            'makefile': '🔨',
            'readme': '📖',
            'license': '⚖️',
        }
        
        # Check exact filename match (case-insensitive)
        name_lower = self.name.lower()
        if name_lower in icon_map:
            return icon_map[name_lower]
        
        # Check extension
        return icon_map.get(ext, '📄')
    
    @property
    def formatted_size(self) -> str:
        """Get formatted file size"""
        if self.file_type == FileType.DIRECTORY:
            return "<DIR>"
        
        size = self.size
        
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        
        return f"{size:.1f} PB"
    
    def format_for_list(self, styles: UIStyles) -> tuple:
        """Format for file list display"""
        name_style = styles.muted if self.is_hidden else styles.base
        
        if self.file_type == FileType.DIRECTORY:
            name_style = styles.syntax_keyword
        
        return (
            self.icon,
            Text(self.name, style=name_style),
            Text(self.formatted_size, style=styles.muted),
            Text(self.modified_time.strftime("%Y-%m-%d %H:%M"), style=styles.muted),
        )


class FileBrowser:
    """File browser component"""
    
    def __init__(self, start_path: str = "."):
        self.styles = get_styles()
        self.current_path = Path(start_path).resolve()
        self.selected_index = 0
        self.files: List[FileInfo] = []
        self.show_hidden = False
        self._refresh_files()
    
    def _refresh_files(self):
        """Refresh file list"""
        self.files = []
        
        try:
            # Add parent directory entry
            if self.current_path.parent != self.current_path:
                parent = FileInfo(self.current_path.parent, "..")
                parent.file_type = FileType.DIRECTORY
                self.files.append(parent)
            
            # List directory contents
            for item in sorted(self.current_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                file_info = FileInfo(item)
                
                # Skip hidden files unless show_hidden is True
                if file_info.is_hidden and not self.show_hidden:
                    continue
                
                self.files.append(file_info)
        
        except PermissionError:
            pass
        except OSError:
            pass
        
        # Ensure selected index is valid
        if self.files:
            self.selected_index = max(0, min(self.selected_index, len(self.files) - 1))
        else:
            self.selected_index = 0
    
    def navigate_to(self, path: str) -> bool:
        """Navigate to a path"""
        try:
            new_path = Path(path).resolve()
            if new_path.exists() and new_path.is_dir():
                self.current_path = new_path
                self.selected_index = 0
                self._refresh_files()
                return True
        except (OSError, ValueError):
            pass
        return False
    
    def navigate_up(self) -> bool:
        """Navigate to parent directory"""
        parent = self.current_path.parent
        if parent != self.current_path:
            self.current_path = parent
            self.selected_index = 0
            self._refresh_files()
            return True
        return False
    
    def navigate_down(self) -> bool:
        """Navigate into selected directory"""
        if not self.files:
            return False
        
        selected = self.files[self.selected_index]
        if selected.file_type == FileType.DIRECTORY:
            return self.navigate_to(str(selected.path))
        return False
    
    def select_next(self):
        """Select next file"""
        if self.files:
            self.selected_index = (self.selected_index + 1) % len(self.files)
    
    def select_previous(self):
        """Select previous file"""
        if self.files:
            self.selected_index = (self.selected_index - 1) % len(self.files)
    
    def get_selected(self) -> Optional[FileInfo]:
        """Get selected file info"""
        if self.files and 0 <= self.selected_index < len(self.files):
            return self.files[self.selected_index]
        return None
    
    def toggle_hidden(self):
        """Toggle hidden files visibility"""
        self.show_hidden = not self.show_hidden
        self._refresh_files()
    
    def render_file_list(self) -> Panel:
        """Render file list panel"""
        if not self.files:
            return Panel(
                Text("Empty directory", style=self.styles.muted),
                title=str(self.current_path),
                border_style=self.styles.theme.colors.border,
            )
        
        table = Table(show_header=True, box=None)
        table.add_column("", width=3)  # Icon
        table.add_column("Name", style=self.styles.base)
        table.add_column("Size", style=self.styles.muted, width=12)
        table.add_column("Modified", style=self.styles.muted, width=16)
        
        for i, file_info in enumerate(self.files):
            icon, name, size, modified = file_info.format_for_list(self.styles)
            
            # Highlight selected row
            if i == self.selected_index:
                name = Text(name.plain, style=self.styles.selection)
                size = Text(size.plain, style=self.styles.selection)
                modified = Text(modified.plain, style=self.styles.selection)
                icon = f">{icon}"
            else:
                icon = f" {icon}"
            
            table.add_row(icon, name, size, modified)
        
        return Panel(
            table,
            title=str(self.current_path),
            border_style=self.styles.theme.colors.border_focused,
            padding=(0, 1),
        )
    
    def render_file_preview(self, max_lines: int = 50) -> Panel:
        """Render file preview panel"""
        selected = self.get_selected()
        
        if not selected:
            return Panel(
                Text("No file selected", style=self.styles.muted),
                title="Preview",
                border_style=self.styles.theme.colors.border,
            )
        
        if selected.file_type == FileType.DIRECTORY:
            # Show directory info
            try:
                count = len(list(selected.path.iterdir()))
                content = Group(
                    Text(f"📁 Directory: {selected.name}", style=self.styles.syntax_keyword),
                    Text(f"Items: {count}", style=self.styles.base),
                    Text(f"Path: {selected.path}", style=self.styles.muted),
                )
            except OSError:
                content = Text("Cannot read directory", style=self.styles.error)
            
            return Panel(
                content,
                title=f"Directory: {selected.name}",
                border_style=self.styles.theme.colors.accent_info,
            )
        
        if selected.file_type == FileType.SYMLINK:
            try:
                target = selected.path.readlink()
                content = Group(
                    Text(f"🔗 Symbolic Link: {selected.name}", style=self.styles.syntax_keyword),
                    Text(f"Target: {target}", style=self.styles.base),
                    Text(f"Path: {selected.path}", style=self.styles.muted),
                )
            except OSError:
                content = Text("Cannot read symlink", style=self.styles.error)
            
            return Panel(
                content,
                title=f"Symlink: {selected.name}",
                border_style=self.styles.theme.colors.accent_info,
            )
        
        # Try to preview file
        try:
            # Check file size
            if selected.size > 1024 * 1024:  # 1MB
                content = Text(
                    f"File too large to preview ({selected.formatted_size})",
                    style=self.styles.warning,
                )
            else:
                # Read file content
                content_bytes = selected.path.read_bytes()
                
                # Try to decode as text
                try:
                    content_text = content_bytes.decode('utf-8')
                    
                    # Limit lines
                    lines = content_text.split('\n')[:max_lines]
                    content_text = '\n'.join(lines)
                    
                    # Get language for syntax highlighting
                    language = self._get_language(selected.path.suffix)
                    
                    if language:
                        theme = "monokai" if "dark" in get_current_theme().name else "default"
                        content = Syntax(
                            content_text,
                            language,
                            theme=theme,
                            line_numbers=True,
                            word_wrap=True,
                        )
                    else:
                        content = Text(content_text)
                
                except UnicodeDecodeError:
                    # Binary file
                    content = Text("Binary file - cannot preview", style=self.styles.warning)
        
        except PermissionError:
            content = Text("Permission denied", style=self.styles.error)
        except OSError as e:
            content = Text(f"Error reading file: {e}", style=self.styles.error)
        
        return Panel(
            content,
            title=f"{selected.icon} {selected.name} ({selected.formatted_size})",
            border_style=self.styles.theme.colors.accent_secondary,
        )
    
    def _get_language(self, extension: str) -> Optional[str]:
        """Get language from file extension"""
        language_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'jsx',
            '.tsx': 'tsx',
            '.html': 'html',
            '.htm': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
            '.ini': 'ini',
            '.cfg': 'ini',
            '.md': 'markdown',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'zsh',
            '.fish': 'fish',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.r': 'r',
            '.sql': 'sql',
        }
        return language_map.get(extension.lower())
    
    def render_tree_view(self, max_depth: int = 3) -> Panel:
        """Render tree view of current directory"""
        styles = self.styles
        
        def build_tree(path: Path, tree: Tree, depth: int = 0):
            if depth >= max_depth:
                return
            
            try:
                items = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
                
                for item in items:
                    file_info = FileInfo(item)
                    
                    if file_info.is_hidden and not self.show_hidden:
                        continue
                    
                    branch = tree.add(f"{file_info.icon} {file_info.name}")
                    
                    if item.is_dir() and depth < max_depth - 1:
                        build_tree(item, branch, depth + 1)
            
            except PermissionError:
                tree.add("[Permission denied]")
            except OSError:
                tree.add("[Error reading directory]")
        
        root_tree = Tree(
            f"📁 {self.current_path.name or str(self.current_path)}",
            style=styles.syntax_keyword,
        )
        
        build_tree(self.current_path, root_tree)
        
        return Panel(
            root_tree,
            title=f"Tree View (max depth: {max_depth})",
            border_style=styles.theme.colors.border,
        )
    
    def get_layout(self) -> Layout:
        """Get file browser layout"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="content"),
        )
        
        layout["content"].split_row(
            Layout(name="file_list", ratio=1),
            Layout(name="preview", ratio=2),
        )
        
        # Header
        header_text = Text.assemble(
            Text("File Browser", style=self.styles.header),
            Text("  ", style=self.styles.base),
            Text(str(self.current_path), style=self.styles.muted),
            Text("  ", style=self.styles.base),
            Text(f"[{len(self.files)} items]", style=self.styles.info),
        )
        
        layout["header"].update(Panel(header_text, border_style=self.styles.theme.colors.border))
        
        # File list
        layout["file_list"].update(self.render_file_list())
        
        # Preview
        layout["preview"].update(self.render_file_preview())
        
        return layout
    
    def get_quick_info(self) -> Text:
        """Get quick file info for status bar"""
        selected = self.get_selected()
        
        if not selected:
            return Text(str(self.current_path), style=self.styles.muted)
        
        return Text.assemble(
            Text(str(self.current_path), style=self.styles.muted),
            Text(" / ", style=self.styles.muted),
            Text(f"{selected.icon} {selected.name}", style=self.styles.base),
            Text(f" ({selected.formatted_size})", style=self.styles.muted),
        )


# Global file browser instance
_file_browser: Optional[FileBrowser] = None


def get_file_browser(start_path: str = ".") -> FileBrowser:
    """Get the global file browser instance"""
    global _file_browser
    if _file_browser is None:
        _file_browser = FileBrowser(start_path)
    return _file_browser


def reset_file_browser(start_path: str = "."):
    """Reset the global file browser"""
    global _file_browser
    _file_browser = FileBrowser(start_path)
