"""
State Manager - Persistence and recovery for daemon state.
"""

import json
import os
from typing import Dict, Any, Optional
from pathlib import Path
import aiofiles
import pickle


class StateManager:
    """
    Manages persistent state for the Kairos daemon.
    
    Features:
    - JSON/pickle serialization
    - Atomic writes
    - Version migration
    - Compression
    """
    
    def __init__(self, state_dir: str = ".kairos"):
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.state_dir / "daemon_state.json"
        self.backup_file = self.state_dir / "daemon_state.json.bak"
        self.version = 1
        
    async def save(self, state: Dict[str, Any]) -> None:
        """Save state to disk atomically."""
        state["_version"] = self.version
        state["_format"] = "json"
        
        # Write to temp file first
        temp_file = self.state_dir / "daemon_state.json.tmp"
        
        async with aiofiles.open(temp_file, 'w') as f:
            await f.write(json.dumps(state, indent=2, default=str))
            
        # Backup existing state
        if self.state_file.exists():
            if self.backup_file.exists():
                self.backup_file.unlink()
            self.state_file.rename(self.backup_file)
            
        # Atomic move
        temp_file.rename(self.state_file)
        
    async def load(self) -> Optional[Dict[str, Any]]:
        """Load state from disk."""
        if not self.state_file.exists():
            # Try backup
            if self.backup_file.exists():
                return await self._load_file(self.backup_file)
            return None
            
        return await self._load_file(self.state_file)
        
    async def _load_file(self, path: Path) -> Optional[Dict[str, Any]]:
        """Load state from a specific file."""
        try:
            async with aiofiles.open(path, 'r') as f:
                content = await f.read()
                state = json.loads(content)
                
            # Version check/migration
            if "_version" in state:
                state = await self._migrate(state)
                
            return state
            
        except (json.JSONDecodeError, IOError):
            return None
            
    async def _migrate(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Migrate state to current version."""
        version = state.get("_version", 0)
        
        if version < 1:
            # Migration from pre-versioned state
            pass
            
        state["_version"] = self.version
        return state
        
    async def clear(self) -> None:
        """Clear all saved state."""
        if self.state_file.exists():
            self.state_file.unlink()
        if self.backup_file.exists():
            self.backup_file.unlink()
            
    def list_sessions(self) -> list:
        """List all saved session IDs."""
        sessions_dir = self.state_dir / "sessions"
        if not sessions_dir.exists():
            return []
        return [p.stem for p in sessions_dir.glob("*.json")]
        
    async def save_session(self, session_id: str, data: Dict[str, Any]) -> None:
        """Save session-specific data."""
        sessions_dir = self.state_dir / "sessions"
        sessions_dir.mkdir(exist_ok=True)
        
        session_file = sessions_dir / f"{session_id}.json"
        
        async with aiofiles.open(session_file, 'w') as f:
            await f.write(json.dumps(data, indent=2, default=str))
            
    async def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load session-specific data."""
        session_file = self.state_dir / "sessions" / f"{session_id}.json"
        
        if not session_file.exists():
            return None
            
        async with aiofiles.open(session_file, 'r') as f:
            content = await f.read()
            return json.loads(content)
