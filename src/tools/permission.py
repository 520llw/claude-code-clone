"""
Claude Code Tool System - Permission Management

This module provides comprehensive permission management for the tool system,
including read/write/execute permissions, directory trust mechanisms, and
approval workflows.
"""

import os
import re
import fnmatch
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Dict, List, Optional, Set, Callable, Any, Union
from datetime import datetime
import json
import asyncio
from collections import defaultdict


class PermissionType(Enum):
    """Types of permissions."""
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    DELETE = "delete"
    NETWORK = "network"


class PermissionLevel(Enum):
    """Permission approval levels."""
    DENY = auto()
    ASK = auto()
    ALLOW = auto()


@dataclass
class PermissionRequest:
    """A request for permission."""
    permission_type: PermissionType
    target: str
    context: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    
    def __str__(self) -> str:
        return f"{self.permission_type.value}: {self.target}"


@dataclass
class PermissionRule:
    """A permission rule for paths or commands."""
    pattern: str
    permission_type: PermissionType
    level: PermissionLevel
    description: Optional[str] = None
    
    def matches(self, target: str) -> bool:
        """Check if the target matches this rule's pattern."""
        if self.pattern.endswith("/**"):
            # Recursive directory match
            base = self.pattern[:-3]
            return target.startswith(base) or fnmatch.fnmatch(target, self.pattern)
        elif self.pattern.endswith("/*"):
            # Single level directory match
            base = self.pattern[:-2]
            if target.startswith(base):
                remainder = target[len(base):]
                return "/" not in remainder or remainder.count("/") == 1
            return fnmatch.fnmatch(target, self.pattern)
        elif "*" in self.pattern or "?" in self.pattern:
            return fnmatch.fnmatch(target, self.pattern)
        else:
            # Exact match or prefix match for directories
            return target == self.pattern or target.startswith(self.pattern + "/")


@dataclass
class TrustedDirectory:
    """A trusted directory with associated permissions."""
    path: Path
    read_allowed: bool = True
    write_allowed: bool = False
    execute_allowed: bool = False
    recursive: bool = True
    added_at: datetime = field(default_factory=datetime.now)
    
    def contains(self, path: Path) -> bool:
        """Check if the given path is within this trusted directory."""
        try:
            path = Path(path).resolve()
            trusted = self.path.resolve()
            if self.recursive:
                return str(path).startswith(str(trusted))
            else:
                return path.parent == trusted
        except (ValueError, OSError):
            return False


class PermissionManager:
    """
    Manages permissions for the tool system.
    
    Features:
    - Read/Write/Execute permission checking
    - Directory trust mechanism
    - Pattern-based rules
    - Automatic approval mode
    - Permission caching
    """
    
    # Default safe paths that are always readable
    DEFAULT_SAFE_PATHS = [
        "/tmp",
        "/var/tmp",
        str(Path.home()),
    ]
    
    # Dangerous commands that should never be executed
    DANGEROUS_PATTERNS = [
        r"rm\s+-rf\s+/",
        r"dd\s+if=.*\s+of=/dev/",
        r">\s*/dev/",
        r":\(\)\s*\{\s*:\|\:&\s*\};",
        r"mkfs\.",
        r"fdisk\s+/dev/",
    ]
    
    def __init__(self):
        """Initialize the permission manager."""
        self._trusted_directories: List[TrustedDirectory] = []
        self._rules: List[PermissionRule] = []
        self._permission_cache: Dict[str, PermissionLevel] = {}
        self._auto_approve: Dict[PermissionType, bool] = defaultdict(bool)
        self._approval_callbacks: List[Callable[[PermissionRequest], bool]] = []
        self._audit_log: List[Dict[str, Any]] = []
        self._max_audit_entries = 1000
        
        # Initialize with default safe paths
        self._init_default_paths()
    
    def _init_default_paths(self):
        """Initialize with default safe paths."""
        for path_str in self.DEFAULT_SAFE_PATHS:
            path = Path(path_str)
            if path.exists():
                self.add_trusted_directory(path, read_allowed=True, write_allowed=True)
    
    def add_trusted_directory(
        self, 
        path: Union[str, Path], 
        read_allowed: bool = True,
        write_allowed: bool = False,
        execute_allowed: bool = False,
        recursive: bool = True
    ) -> None:
        """Add a trusted directory."""
        trusted = TrustedDirectory(
            path=Path(path),
            read_allowed=read_allowed,
            write_allowed=write_allowed,
            execute_allowed=execute_allowed,
            recursive=recursive
        )
        self._trusted_directories.append(trusted)
        self._log_audit("add_trusted_directory", str(path), {
            "read": read_allowed,
            "write": write_allowed,
            "execute": execute_allowed
        })
    
    def remove_trusted_directory(self, path: Union[str, Path]) -> bool:
        """Remove a trusted directory."""
        path = Path(path).resolve()
        for i, trusted in enumerate(self._trusted_directories):
            if trusted.path.resolve() == path:
                del self._trusted_directories[i]
                self._log_audit("remove_trusted_directory", str(path))
                return True
        return False
    
    def add_rule(
        self, 
        pattern: str, 
        permission_type: PermissionType,
        level: PermissionLevel,
        description: Optional[str] = None
    ) -> None:
        """Add a permission rule."""
        rule = PermissionRule(
            pattern=pattern,
            permission_type=permission_type,
            level=level,
            description=description
        )
        self._rules.append(rule)
        self._log_audit("add_rule", pattern, {"type": permission_type.value, "level": level.name})
    
    def set_auto_approve(self, permission_type: PermissionType, enabled: bool) -> None:
        """Enable or disable auto-approval for a permission type."""
        self._auto_approve[permission_type] = enabled
        self._log_audit("set_auto_approve", permission_type.value, {"enabled": enabled})
    
    def register_approval_callback(self, callback: Callable[[PermissionRequest], bool]) -> None:
        """Register a callback for permission requests."""
        self._approval_callbacks.append(callback)
    
    def _check_rules(self, target: str, permission_type: PermissionType) -> Optional[PermissionLevel]:
        """Check if any rules apply to the target."""
        for rule in self._rules:
            if rule.permission_type == permission_type and rule.matches(target):
                return rule.level
        return None
    
    def _check_trusted_directory(
        self, 
        path: Path, 
        permission_type: PermissionType
    ) -> bool:
        """Check if path is in a trusted directory with appropriate permissions."""
        for trusted in self._trusted_directories:
            if trusted.contains(path):
                if permission_type == PermissionType.READ and trusted.read_allowed:
                    return True
                elif permission_type == PermissionType.WRITE and trusted.write_allowed:
                    return True
                elif permission_type == PermissionType.EXECUTE and trusted.execute_allowed:
                    return True
        return False
    
    def _is_dangerous_command(self, command: str) -> bool:
        """Check if a command is potentially dangerous."""
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return True
        return False
    
    def _get_cache_key(self, permission_type: PermissionType, target: str) -> str:
        """Generate a cache key for permission lookup."""
        return f"{permission_type.value}:{target}"
    
    def _log_audit(self, action: str, target: str, details: Optional[Dict] = None) -> None:
        """Log an audit entry."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "target": target,
            "details": details or {}
        }
        self._audit_log.append(entry)
        
        # Trim audit log if it gets too large
        if len(self._audit_log) > self._max_audit_entries:
            self._audit_log = self._audit_log[-self._max_audit_entries:]
    
    async def request_permission(
        self, 
        permission_type: PermissionType, 
        target: str,
        context: Optional[str] = None
    ) -> bool:
        """
        Request permission for an action.
        
        Returns True if permission is granted, False otherwise.
        """
        request = PermissionRequest(
            permission_type=permission_type,
            target=target,
            context=context
        )
        
        # Check auto-approve
        if self._auto_approve.get(permission_type, False):
            self._log_audit("auto_approved", str(request))
            return True
        
        # Call approval callbacks
        for callback in self._approval_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    result = await callback(request)
                else:
                    result = callback(request)
                if result:
                    self._log_audit("callback_approved", str(request))
                    return True
            except Exception as e:
                # Log error but continue
                self._log_audit("callback_error", str(request), {"error": str(e)})
        
        self._log_audit("permission_denied", str(request))
        return False
    
    def check_read_permission(self, path: Union[str, Path]) -> bool:
        """Check if read permission is granted for a path."""
        path = Path(path)
        target = str(path.resolve()) if path.exists() else str(path)
        
        # Check cache
        cache_key = self._get_cache_key(PermissionType.READ, target)
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key] == PermissionLevel.ALLOW
        
        # Check rules first
        rule_level = self._check_rules(target, PermissionType.READ)
        if rule_level == PermissionLevel.DENY:
            self._permission_cache[cache_key] = PermissionLevel.DENY
            return False
        if rule_level == PermissionLevel.ALLOW:
            self._permission_cache[cache_key] = PermissionLevel.ALLOW
            return True
        
        # Check trusted directories
        if self._check_trusted_directory(path, PermissionType.READ):
            self._permission_cache[cache_key] = PermissionLevel.ALLOW
            return True
        
        # Check if path exists and is readable
        try:
            if path.exists() and os.access(path, os.R_OK):
                self._permission_cache[cache_key] = PermissionLevel.ALLOW
                return True
        except OSError:
            pass
        
        self._permission_cache[cache_key] = PermissionLevel.ASK
        return False
    
    def check_write_permission(self, path: Union[str, Path]) -> bool:
        """Check if write permission is granted for a path."""
        path = Path(path)
        target = str(path.resolve()) if path.exists() else str(path)
        
        # Check cache
        cache_key = self._get_cache_key(PermissionType.WRITE, target)
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key] == PermissionLevel.ALLOW
        
        # Check rules first
        rule_level = self._check_rules(target, PermissionType.WRITE)
        if rule_level == PermissionLevel.DENY:
            self._permission_cache[cache_key] = PermissionLevel.DENY
            return False
        if rule_level == PermissionLevel.ALLOW:
            self._permission_cache[cache_key] = PermissionLevel.ALLOW
            return True
        
        # Check trusted directories
        if self._check_trusted_directory(path, PermissionType.WRITE):
            self._permission_cache[cache_key] = PermissionLevel.ALLOW
            return True
        
        # Check if parent directory is writable
        try:
            parent = path.parent
            if parent.exists() and os.access(parent, os.W_OK):
                self._permission_cache[cache_key] = PermissionLevel.ALLOW
                return True
        except OSError:
            pass
        
        self._permission_cache[cache_key] = PermissionLevel.ASK
        return False
    
    def check_execute_permission(self, command: str) -> bool:
        """Check if execute permission is granted for a command."""
        # Check for dangerous commands
        if self._is_dangerous_command(command):
            return False
        
        # Check cache
        cache_key = self._get_cache_key(PermissionType.EXECUTE, command)
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key] == PermissionLevel.ALLOW
        
        # Check rules
        rule_level = self._check_rules(command, PermissionType.EXECUTE)
        if rule_level == PermissionLevel.DENY:
            self._permission_cache[cache_key] = PermissionLevel.DENY
            return False
        if rule_level == PermissionLevel.ALLOW:
            self._permission_cache[cache_key] = PermissionLevel.ALLOW
            return True
        
        self._permission_cache[cache_key] = PermissionLevel.ASK
        return False
    
    def check_delete_permission(self, path: Union[str, Path]) -> bool:
        """Check if delete permission is granted for a path."""
        # Delete permission is more restrictive than write
        path = Path(path)
        target = str(path.resolve()) if path.exists() else str(path)
        
        # Check rules
        rule_level = self._check_rules(target, PermissionType.DELETE)
        if rule_level == PermissionLevel.DENY:
            return False
        if rule_level == PermissionLevel.ALLOW:
            return True
        
        # Require explicit write permission
        return self.check_write_permission(path)
    
    def check_network_permission(self, url: str) -> bool:
        """Check if network access is permitted for a URL."""
        # Check rules
        rule_level = self._check_rules(url, PermissionType.NETWORK)
        if rule_level == PermissionLevel.DENY:
            return False
        if rule_level == PermissionLevel.ALLOW:
            return True
        
        # Default: allow (can be restricted with rules)
        return True
    
    def invalidate_cache(self) -> None:
        """Invalidate the permission cache."""
        self._permission_cache.clear()
    
    def get_trusted_directories(self) -> List[TrustedDirectory]:
        """Get all trusted directories."""
        return list(self._trusted_directories)
    
    def get_rules(self) -> List[PermissionRule]:
        """Get all permission rules."""
        return list(self._rules)
    
    def get_audit_log(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get the audit log."""
        if limit:
            return self._audit_log[-limit:]
        return list(self._audit_log)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert permission manager state to dictionary."""
        return {
            "trusted_directories": [
                {
                    "path": str(td.path),
                    "read_allowed": td.read_allowed,
                    "write_allowed": td.write_allowed,
                    "execute_allowed": td.execute_allowed,
                    "recursive": td.recursive,
                    "added_at": td.added_at.isoformat()
                }
                for td in self._trusted_directories
            ],
            "rules": [
                {
                    "pattern": r.pattern,
                    "type": r.permission_type.value,
                    "level": r.level.name,
                    "description": r.description
                }
                for r in self._rules
            ],
            "auto_approve": {
                pt.value: enabled 
                for pt, enabled in self._auto_approve.items()
            },
            "cache_size": len(self._permission_cache),
            "audit_log_entries": len(self._audit_log)
        }
    
    def to_json(self) -> str:
        """Convert permission manager state to JSON string."""
        return json.dumps(self.to_dict(), indent=2, default=str)


# Global permission manager instance
_default_permission_manager: Optional[PermissionManager] = None


def get_permission_manager() -> PermissionManager:
    """Get the global permission manager instance."""
    global _default_permission_manager
    if _default_permission_manager is None:
        _default_permission_manager = PermissionManager()
    return _default_permission_manager


def set_permission_manager(pm: PermissionManager) -> None:
    """Set the global permission manager instance."""
    global _default_permission_manager
    _default_permission_manager = pm
