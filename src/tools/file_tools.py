"""
Claude Code Tool System - File Operations

This module provides file operation tools including read, write, edit, glob, grep, and find.
"""

import os
import re
import fnmatch
import difflib
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
import asyncio
from datetime import datetime

from .base import Tool, ToolResult, ToolParameter, ToolStatus
from .permission import PermissionManager, PermissionType, get_permission_manager


class ReadTool(Tool):
    """Tool for reading file contents."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "read"
    
    @property
    def description(self) -> str:
        return "Read the contents of a file."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("file_path", str, "Path to the file to read", required=True),
            ToolParameter("offset", int, "Line number to start reading from (1-based)", required=False, default=1),
            ToolParameter("limit", int, "Maximum number of lines to read", required=False, default=1000),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        file_path: str, 
        offset: int = 1, 
        limit: int = 1000
    ) -> ToolResult:
        """Read a file with optional offset and limit."""
        path = Path(file_path)
        
        # Check read permission
        if not self._pm.check_read_permission(path):
            return ToolResult.permission_denied("read", str(path))
        
        try:
            if not path.exists():
                return ToolResult.error(f"File not found: {file_path}")
            
            if not path.is_file():
                return ToolResult.error(f"Path is not a file: {file_path}")
            
            # Read file content
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
            
            total_lines = len(lines)
            
            # Apply offset and limit
            start_idx = max(0, offset - 1)
            end_idx = min(total_lines, start_idx + limit)
            
            selected_lines = lines[start_idx:end_idx]
            
            # Format with line numbers
            result_lines = []
            for i, line in enumerate(selected_lines, start=start_idx + 1):
                result_lines.append(f"{i:6d}\t{line.rstrip()}")
            
            content = "\n".join(result_lines)
            
            # Add truncation notice if needed
            if end_idx < total_lines:
                content += f"\n\n... ({total_lines - end_idx} more lines)"
            
            return ToolResult.success(
                output=content,
                metadata={
                    "file_path": str(path.resolve()),
                    "total_lines": total_lines,
                    "start_line": start_idx + 1,
                    "end_line": end_idx,
                    "lines_read": end_idx - start_idx
                }
            )
            
        except PermissionError:
            return ToolResult.permission_denied("read", str(path))
        except Exception as e:
            return ToolResult.error(f"Error reading file: {str(e)}")


class WriteTool(Tool):
    """Tool for writing file contents."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "write"
    
    @property
    def description(self) -> str:
        return "Write content to a file. Creates the file if it doesn't exist."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("file_path", str, "Path to the file to write", required=True),
            ToolParameter("content", str, "Content to write to the file", required=True),
            ToolParameter("append", bool, "Append to file instead of overwriting", required=False, default=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["write"]
    
    async def execute(
        self, 
        file_path: str, 
        content: str, 
        append: bool = False
    ) -> ToolResult:
        """Write content to a file."""
        path = Path(file_path)
        
        # Check write permission
        if not self._pm.check_write_permission(path):
            return ToolResult.permission_denied("write", str(path))
        
        try:
            # Create parent directories if needed
            parent = path.parent
            if not parent.exists():
                parent.mkdir(parents=True, exist_ok=True)
            
            mode = 'a' if append else 'w'
            with open(path, mode, encoding='utf-8') as f:
                f.write(content)
            
            action = "appended to" if append else "wrote"
            return ToolResult.success(
                output=f"Successfully {action} {path}",
                metadata={
                    "file_path": str(path.resolve()),
                    "bytes_written": len(content.encode('utf-8')),
                    "action": action
                }
            )
            
        except PermissionError:
            return ToolResult.permission_denied("write", str(path))
        except Exception as e:
            return ToolResult.error(f"Error writing file: {str(e)}")


class EditTool(Tool):
    """Tool for editing file contents using diff-like operations."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "edit"
    
    @property
    def description(self) -> str:
        return "Edit a file by replacing old_string with new_string."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("file_path", str, "Path to the file to edit", required=True),
            ToolParameter("old_string", str, "String to replace", required=True),
            ToolParameter("new_string", str, "String to replace with", required=True),
            ToolParameter("replace_all", bool, "Replace all occurrences", required=False, default=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read", "write"]
    
    async def execute(
        self, 
        file_path: str, 
        old_string: str, 
        new_string: str,
        replace_all: bool = False
    ) -> ToolResult:
        """Edit a file by replacing text."""
        path = Path(file_path)
        
        # Check permissions
        if not self._pm.check_read_permission(path):
            return ToolResult.permission_denied("read", str(path))
        if not self._pm.check_write_permission(path):
            return ToolResult.permission_denied("write", str(path))
        
        try:
            if not path.exists():
                return ToolResult.error(f"File not found: {file_path}")
            
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            
            # Check if old_string exists
            if old_string not in content:
                return ToolResult.error(
                    f"old_string not found in file: {old_string[:50]}..."
                )
            
            # Count occurrences
            occurrences = content.count(old_string)
            
            if not replace_all and occurrences > 1:
                return ToolResult.error(
                    f"Multiple occurrences found ({occurrences}). "
                    f"Use replace_all=True to replace all."
                )
            
            # Perform replacement
            if replace_all:
                new_content = content.replace(old_string, new_string)
                replaced_count = occurrences
            else:
                new_content = content.replace(old_string, new_string, 1)
                replaced_count = 1
            
            # Write back
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            # Generate diff
            old_lines = content.splitlines(keepends=True)
            new_lines = new_content.splitlines(keepends=True)
            diff = list(difflib.unified_diff(
                old_lines, new_lines,
                fromfile=f"a/{path.name}",
                tofile=f"b/{path.name}",
                lineterm=""
            ))
            
            return ToolResult.success(
                output=f"Successfully replaced {replaced_count} occurrence(s)",
                metadata={
                    "file_path": str(path.resolve()),
                    "occurrences_replaced": replaced_count,
                    "total_occurrences": occurrences,
                    "diff": "".join(diff) if diff else "No diff generated"
                }
            )
            
        except PermissionError:
            return ToolResult.permission_denied("write", str(path))
        except Exception as e:
            return ToolResult.error(f"Error editing file: {str(e)}")


class GlobTool(Tool):
    """Tool for finding files using glob patterns."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "glob"
    
    @property
    def description(self) -> str:
        return "Find files matching a glob pattern."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("pattern", str, "Glob pattern to match", required=True),
            ToolParameter("path", str, "Directory to search in", required=False, default="."),
            ToolParameter("recursive", bool, "Search recursively", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        pattern: str, 
        path: str = ".",
        recursive: bool = True
    ) -> ToolResult:
        """Find files matching a glob pattern."""
        search_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(search_path):
            return ToolResult.permission_denied("read", str(search_path))
        
        try:
            if not search_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            matches = []
            
            if recursive:
                for root, dirs, files in os.walk(search_path):
                    root_path = Path(root)
                    for name in files + dirs:
                        full_path = root_path / name
                        relative_path = full_path.relative_to(search_path)
                        if fnmatch.fnmatch(str(relative_path), pattern) or \
                           fnmatch.fnmatch(name, pattern):
                            if self._pm.check_read_permission(full_path):
                                matches.append(str(full_path))
            else:
                for item in search_path.iterdir():
                    if fnmatch.fnmatch(item.name, pattern):
                        if self._pm.check_read_permission(item):
                            matches.append(str(item))
            
            # Sort matches
            matches.sort()
            
            return ToolResult.success(
                output=matches,
                metadata={
                    "pattern": pattern,
                    "search_path": str(search_path.resolve()),
                    "recursive": recursive,
                    "match_count": len(matches)
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error globbing: {str(e)}")


class GrepTool(Tool):
    """Tool for searching file contents."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "grep"
    
    @property
    def description(self) -> str:
        return "Search for a pattern in files."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("pattern", str, "Pattern to search for", required=True),
            ToolParameter("path", str, "Directory or file to search in", required=False, default="."),
            ToolParameter("file_pattern", str, "Glob pattern for files to include", required=False, default="*"),
            ToolParameter("recursive", bool, "Search recursively", required=False, default=True),
            ToolParameter("case_sensitive", bool, "Case-sensitive search", required=False, default=False),
            ToolParameter("regex", bool, "Treat pattern as regex", required=False, default=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        pattern: str, 
        path: str = ".",
        file_pattern: str = "*",
        recursive: bool = True,
        case_sensitive: bool = False,
        regex: bool = False
    ) -> ToolResult:
        """Search for a pattern in files."""
        search_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(search_path):
            return ToolResult.permission_denied("read", str(search_path))
        
        try:
            # Compile regex pattern
            flags = 0 if case_sensitive else re.IGNORECASE
            if regex:
                try:
                    compiled_pattern = re.compile(pattern, flags)
                except re.error as e:
                    return ToolResult.error(f"Invalid regex pattern: {e}")
            else:
                compiled_pattern = re.compile(re.escape(pattern), flags)
            
            matches = []
            files_searched = 0
            
            def search_file(file_path: Path) -> List[Dict]:
                """Search a single file."""
                file_matches = []
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        for line_num, line in enumerate(f, 1):
                            if compiled_pattern.search(line):
                                file_matches.append({
                                    "file": str(file_path),
                                    "line": line_num,
                                    "content": line.rstrip()
                                })
                except (IOError, OSError):
                    pass
                return file_matches
            
            if search_path.is_file():
                if self._pm.check_read_permission(search_path):
                    files_searched += 1
                    matches.extend(search_file(search_path))
            elif recursive:
                for root, dirs, files in os.walk(search_path):
                    root_path = Path(root)
                    for filename in files:
                        if fnmatch.fnmatch(filename, file_pattern):
                            file_path = root_path / filename
                            if self._pm.check_read_permission(file_path):
                                files_searched += 1
                                matches.extend(search_file(file_path))
            else:
                for item in search_path.iterdir():
                    if item.is_file() and fnmatch.fnmatch(item.name, file_pattern):
                        if self._pm.check_read_permission(item):
                            files_searched += 1
                            matches.extend(search_file(item))
            
            # Format output
            output_lines = []
            for match in matches:
                output_lines.append(f"{match['file']}:{match['line']}: {match['content']}")
            
            return ToolResult.success(
                output="\n".join(output_lines) if output_lines else "No matches found",
                metadata={
                    "pattern": pattern,
                    "search_path": str(search_path.resolve()),
                    "files_searched": files_searched,
                    "match_count": len(matches),
                    "matches": matches
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error searching: {str(e)}")


class FindTool(Tool):
    """Tool for finding files by various criteria."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "find"
    
    @property
    def description(self) -> str:
        return "Find files by name, type, or other criteria."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("path", str, "Directory to search in", required=False, default="."),
            ToolParameter("name", str, "File name pattern (supports wildcards)", required=False),
            ToolParameter("type", str, "File type: 'f' for file, 'd' for directory", required=False),
            ToolParameter("ext", str, "File extension", required=False),
            ToolParameter("min_size", int, "Minimum file size in bytes", required=False),
            ToolParameter("max_size", int, "Maximum file size in bytes", required=False),
            ToolParameter("max_depth", int, "Maximum directory depth", required=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        path: str = ".",
        name: Optional[str] = None,
        type: Optional[str] = None,
        ext: Optional[str] = None,
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        max_depth: Optional[int] = None
    ) -> ToolResult:
        """Find files matching criteria."""
        search_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(search_path):
            return ToolResult.permission_denied("read", str(search_path))
        
        try:
            if not search_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            matches = []
            files_checked = 0
            
            def check_criteria(item_path: Path, is_file: bool) -> bool:
                """Check if item matches all criteria."""
                # Type check
                if type == 'f' and not is_file:
                    return False
                if type == 'd' and is_file:
                    return False
                
                # Name check
                if name and not fnmatch.fnmatch(item_path.name, name):
                    return False
                
                # Extension check
                if ext:
                    item_ext = item_path.suffix.lstrip('.')
                    if item_ext != ext.lstrip('.'):
                        return False
                
                # Size check (only for files)
                if is_file:
                    try:
                        size = item_path.stat().st_size
                        if min_size is not None and size < min_size:
                            return False
                        if max_size is not None and size > max_size:
                            return False
                    except OSError:
                        pass
                
                return True
            
            def get_depth(current: Path) -> int:
                """Get depth relative to search path."""
                try:
                    return len(current.relative_to(search_path).parts)
                except ValueError:
                    return 0
            
            for root, dirs, files in os.walk(search_path):
                root_path = Path(root)
                current_depth = get_depth(root_path)
                
                # Check max_depth
                if max_depth is not None and current_depth > max_depth:
                    del dirs[:]
                    continue
                
                # Check directories
                for dirname in dirs:
                    dir_path = root_path / dirname
                    files_checked += 1
                    if self._pm.check_read_permission(dir_path):
                        if check_criteria(dir_path, is_file=False):
                            matches.append({
                                "path": str(dir_path),
                                "type": "directory",
                                "name": dirname
                            })
                
                # Check files
                for filename in files:
                    file_path = root_path / filename
                    files_checked += 1
                    if self._pm.check_read_permission(file_path):
                        if check_criteria(file_path, is_file=True):
                            try:
                                stat = file_path.stat()
                                matches.append({
                                    "path": str(file_path),
                                    "type": "file",
                                    "name": filename,
                                    "size": stat.st_size,
                                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                                })
                            except OSError:
                                matches.append({
                                    "path": str(file_path),
                                    "type": "file",
                                    "name": filename
                                })
            
            # Sort by path
            matches.sort(key=lambda x: x["path"])
            
            return ToolResult.success(
                output=[m["path"] for m in matches],
                metadata={
                    "search_path": str(search_path.resolve()),
                    "files_checked": files_checked,
                    "match_count": len(matches),
                    "matches": matches
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error finding files: {str(e)}")


class LSTool(Tool):
    """Tool for listing directory contents."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "ls"
    
    @property
    def description(self) -> str:
        return "List directory contents."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("path", str, "Directory to list", required=False, default="."),
            ToolParameter("show_hidden", bool, "Show hidden files", required=False, default=False),
            ToolParameter("details", bool, "Show detailed information", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        path: str = ".",
        show_hidden: bool = False,
        details: bool = True
    ) -> ToolResult:
        """List directory contents."""
        dir_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(dir_path):
            return ToolResult.permission_denied("read", str(dir_path))
        
        try:
            if not dir_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            if not dir_path.is_dir():
                return ToolResult.error(f"Path is not a directory: {path}")
            
            entries = []
            
            for item in sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                # Skip hidden files unless show_hidden is True
                if item.name.startswith('.') and not show_hidden:
                    continue
                
                if not self._pm.check_read_permission(item):
                    continue
                
                entry = {
                    "name": item.name,
                    "type": "directory" if item.is_dir() else "file",
                    "path": str(item)
                }
                
                if details:
                    try:
                        stat = item.stat()
                        entry["size"] = stat.st_size if item.is_file() else None
                        entry["modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
                        entry["permissions"] = oct(stat.st_mode)[-3:]
                    except OSError:
                        pass
                
                entries.append(entry)
            
            # Format output
            if details:
                output_lines = []
                for entry in entries:
                    type_char = "d" if entry["type"] == "directory" else "-"
                    size = entry.get("size", "")
                    size_str = f"{size:>10}" if size else "          "
                    modified = entry.get("modified", "")[:19] if entry.get("modified") else ""
                    output_lines.append(f"{type_char} {entry.get('permissions', '---')} {size_str} {modified} {entry['name']}")
                output = "\n".join(output_lines)
            else:
                output = [e["name"] for e in entries]
            
            return ToolResult.success(
                output=output,
                metadata={
                    "path": str(dir_path.resolve()),
                    "entry_count": len(entries),
                    "entries": entries
                }
            )
            
        except PermissionError:
            return ToolResult.permission_denied("read", str(dir_path))
        except Exception as e:
            return ToolResult.error(f"Error listing directory: {str(e)}")
