"""
Claude Code Tool System - Bash/Shell Execution

This module provides bash and shell command execution tools with
comprehensive security controls, timeout handling, and output management.
"""

import os
import re
import shlex
import asyncio
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass
from datetime import datetime
import tempfile

from .base import Tool, ToolResult, ToolParameter, ToolStatus
from .permission import PermissionManager, PermissionType, get_permission_manager


@dataclass
class ProcessResult:
    """Result of a process execution."""
    returncode: int
    stdout: str
    stderr: str
    execution_time_ms: float
    command: str
    
    @property
    def success(self) -> bool:
        """Check if the process exited successfully."""
        return self.returncode == 0


class BashTool(Tool):
    """
    Tool for executing bash/shell commands.
    
    Features:
    - Timeout control
    - Working directory setting
    - Environment variable control
    - Output size limits
    - Security restrictions
    """
    
    # Default settings
    DEFAULT_TIMEOUT = 60
    MAX_OUTPUT_SIZE = 1024 * 1024  # 1MB
    
    # Commands that are always blocked
    BLOCKED_COMMANDS = [
        r"^\s*rm\s+-rf\s+/\s*",
        r"^\s*dd\s+if=.*\s+of=/dev/",
        r":\(\)\s*\{\s*:\|\:&\s*\};",
        r"mkfs\.",
        r"fdisk\s+/dev/[sh]d[a-z]",
    ]
    
    def __init__(
        self, 
        permission_manager: Optional[PermissionManager] = None,
        default_timeout: int = DEFAULT_TIMEOUT,
        allowed_commands: Optional[List[str]] = None,
        blocked_commands: Optional[List[str]] = None
    ):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
        self._default_timeout = default_timeout
        self._allowed_commands = set(allowed_commands or [])
        self._blocked_patterns = blocked_commands or self.BLOCKED_COMMANDS
        self._execution_history: List[Dict[str, Any]] = []
        self._max_history = 100
    
    @property
    def name(self) -> str:
        return "bash"
    
    @property
    def description(self) -> str:
        return "Execute a bash command."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("command", str, "Command to execute", required=True),
            ToolParameter("timeout", int, "Timeout in seconds", required=False, default=self._default_timeout),
            ToolParameter("cwd", str, "Working directory for command execution", required=False),
            ToolParameter("env", dict, "Environment variables", required=False),
            ToolParameter("capture_output", bool, "Capture command output", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["execute"]
    
    def _is_command_blocked(self, command: str) -> Optional[str]:
        """Check if a command is blocked. Returns reason if blocked."""
        # Check blocked patterns
        for pattern in self._blocked_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return f"Command matches blocked pattern: {pattern}"
        
        # Check allowed commands whitelist (if configured)
        if self._allowed_commands:
            cmd_parts = shlex.split(command)
            if cmd_parts and cmd_parts[0] not in self._allowed_commands:
                return f"Command not in allowed list: {cmd_parts[0]}"
        
        return None
    
    def _sanitize_command(self, command: str) -> str:
        """Sanitize command input."""
        # Remove null bytes
        command = command.replace('\x00', '')
        
        # Trim whitespace
        command = command.strip()
        
        return command
    
    async def _execute_with_timeout(
        self,
        command: str,
        timeout: int,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        capture_output: bool = True
    ) -> ProcessResult:
        """Execute command with timeout."""
        import time
        start_time = time.time()
        
        # Prepare environment
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        
        # Prepare working directory
        working_dir = Path(cwd) if cwd else Path.cwd()
        
        try:
            # Create subprocess
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE if capture_output else None,
                stderr=asyncio.subprocess.PIPE if capture_output else None,
                cwd=str(working_dir),
                env=process_env
            )
            
            # Wait for completion with timeout
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                # Kill the process
                try:
                    process.kill()
                    await process.wait()
                except ProcessLookupError:
                    pass
                raise
            
            execution_time = (time.time() - start_time) * 1000
            
            # Decode output
            stdout = stdout_data.decode('utf-8', errors='replace') if stdout_data else ""
            stderr = stderr_data.decode('utf-8', errors='replace') if stderr_data else ""
            
            # Truncate if too large
            if len(stdout) > self.MAX_OUTPUT_SIZE:
                stdout = stdout[:self.MAX_OUTPUT_SIZE] + "\n... (output truncated)"
            if len(stderr) > self.MAX_OUTPUT_SIZE:
                stderr = stderr[:self.MAX_OUTPUT_SIZE] + "\n... (stderr truncated)"
            
            return ProcessResult(
                returncode=process.returncode,
                stdout=stdout,
                stderr=stderr,
                execution_time_ms=execution_time,
                command=command
            )
            
        except asyncio.TimeoutError:
            raise
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return ProcessResult(
                returncode=-1,
                stdout="",
                stderr=str(e),
                execution_time_ms=execution_time,
                command=command
            )
    
    async def execute(
        self,
        command: str,
        timeout: Optional[int] = None,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        capture_output: bool = True
    ) -> ToolResult:
        """Execute a bash command."""
        # Sanitize command
        command = self._sanitize_command(command)
        
        if not command:
            return ToolResult.error("Empty command")
        
        # Check execute permission
        if not self._pm.check_execute_permission(command):
            # Try to get permission
            has_permission = await self._pm.request_permission(
                PermissionType.EXECUTE, 
                command
            )
            if not has_permission:
                return ToolResult.permission_denied("execute", command)
        
        # Check if command is blocked
        block_reason = self._is_command_blocked(command)
        if block_reason:
            return ToolResult.error(f"Command blocked: {block_reason}")
        
        # Check working directory permission
        if cwd:
            cwd_path = Path(cwd)
            if not self._pm.check_read_permission(cwd_path):
                return ToolResult.permission_denied("read", str(cwd_path))
        
        # Use default timeout if not specified
        if timeout is None:
            timeout = self._default_timeout
        
        try:
            # Execute command
            result = await self._execute_with_timeout(
                command=command,
                timeout=timeout,
                cwd=cwd,
                env=env,
                capture_output=capture_output
            )
            
            # Log execution
            self._log_execution(command, result)
            
            # Format output
            output_parts = []
            if result.stdout:
                output_parts.append(result.stdout)
            if result.stderr:
                output_parts.append(f"[stderr]\n{result.stderr}")
            
            output = "\n".join(output_parts) if output_parts else ""
            
            # Determine status
            if result.returncode == 0:
                status = ToolStatus.SUCCESS
            else:
                status = ToolStatus.ERROR
            
            return ToolResult(
                status=status,
                output=output or f"Command exited with code {result.returncode}",
                metadata={
                    "command": command,
                    "returncode": result.returncode,
                    "cwd": cwd or str(Path.cwd()),
                    "execution_time_ms": result.execution_time_ms,
                    "stdout_length": len(result.stdout),
                    "stderr_length": len(result.stderr)
                }
            )
            
        except asyncio.TimeoutError:
            self._log_execution(command, None, timed_out=True)
            return ToolResult.timeout(timeout, metadata={"command": command})
        except Exception as e:
            self._log_execution(command, None, error=str(e))
            return ToolResult.error(f"Error executing command: {str(e)}")
    
    def _log_execution(
        self, 
        command: str, 
        result: Optional[ProcessResult] = None,
        timed_out: bool = False,
        error: Optional[str] = None
    ) -> None:
        """Log command execution."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "command": command,
            "timed_out": timed_out,
            "error": error
        }
        
        if result:
            entry["returncode"] = result.returncode
            entry["execution_time_ms"] = result.execution_time_ms
        
        self._execution_history.append(entry)
        
        # Trim history if needed
        if len(self._execution_history) > self._max_history:
            self._execution_history = self._execution_history[-self._max_history:]
    
    def get_execution_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get command execution history."""
        if limit:
            return self._execution_history[-limit:]
        return list(self._execution_history)
    
    def clear_history(self) -> None:
        """Clear execution history."""
        self._execution_history.clear()


class ShellTool(Tool):
    """
    Tool for executing shell commands with more control.
    
    Similar to BashTool but with additional features for
    interactive commands and streaming output.
    """
    
    DEFAULT_TIMEOUT = 120
    
    def __init__(
        self, 
        permission_manager: Optional[PermissionManager] = None,
        default_timeout: int = DEFAULT_TIMEOUT
    ):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
        self._default_timeout = default_timeout
        self._active_processes: Dict[str, asyncio.subprocess.Process] = {}
    
    @property
    def name(self) -> str:
        return "shell"
    
    @property
    def description(self) -> str:
        return "Execute a shell command with advanced options."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("command", str, "Command to execute", required=True),
            ToolParameter("timeout", int, "Timeout in seconds", required=False, default=self._default_timeout),
            ToolParameter("cwd", str, "Working directory", required=False),
            ToolParameter("env", dict, "Environment variables", required=False),
            ToolParameter("input_data", str, "Input to provide to command", required=False),
            ToolParameter("shell", str, "Shell to use (e.g., /bin/bash)", required=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["execute"]
    
    async def execute(
        self,
        command: str,
        timeout: Optional[int] = None,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        input_data: Optional[str] = None,
        shell: Optional[str] = None
    ) -> ToolResult:
        """Execute a shell command."""
        # Check execute permission
        if not self._pm.check_execute_permission(command):
            has_permission = await self._pm.request_permission(
                PermissionType.EXECUTE, 
                command
            )
            if not has_permission:
                return ToolResult.permission_denied("execute", command)
        
        # Check working directory permission
        if cwd:
            cwd_path = Path(cwd)
            if not self._pm.check_read_permission(cwd_path):
                return ToolResult.permission_denied("read", str(cwd_path))
        
        if timeout is None:
            timeout = self._default_timeout
        
        import time
        start_time = time.time()
        
        try:
            # Prepare shell
            executable = shell or "/bin/bash"
            
            # Prepare environment
            process_env = os.environ.copy()
            if env:
                process_env.update(env)
            
            # Prepare working directory
            working_dir = Path(cwd) if cwd else Path.cwd()
            
            # Create subprocess
            process = await asyncio.create_subprocess_shell(
                command,
                executable=executable,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE if input_data else None,
                cwd=str(working_dir),
                env=process_env
            )
            
            # Prepare input
            input_bytes = input_data.encode('utf-8') if input_data else None
            
            # Execute with timeout
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(input=input_bytes),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return ToolResult.timeout(timeout, metadata={"command": command})
            
            execution_time = (time.time() - start_time) * 1000
            
            # Decode output
            stdout = stdout_data.decode('utf-8', errors='replace') if stdout_data else ""
            stderr = stderr_data.decode('utf-8', errors='replace') if stderr_data else ""
            
            # Format output
            output_parts = []
            if stdout:
                output_parts.append(stdout)
            if stderr:
                output_parts.append(f"[stderr]\n{stderr}")
            
            output = "\n".join(output_parts) if output_parts else ""
            
            status = ToolStatus.SUCCESS if process.returncode == 0 else ToolStatus.ERROR
            
            return ToolResult(
                status=status,
                output=output or f"Command exited with code {process.returncode}",
                metadata={
                    "command": command,
                    "returncode": process.returncode,
                    "cwd": str(working_dir),
                    "shell": executable,
                    "execution_time_ms": execution_time
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error executing shell command: {str(e)}")


class PipelineTool(Tool):
    """Tool for executing command pipelines."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "pipeline"
    
    @property
    def description(self) -> str:
        return "Execute a pipeline of commands."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("commands", list, "List of commands to pipe together", required=True),
            ToolParameter("timeout", int, "Timeout in seconds", required=False, default=60),
            ToolParameter("cwd", str, "Working directory", required=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["execute"]
    
    async def execute(
        self,
        commands: List[str],
        timeout: int = 60,
        cwd: Optional[str] = None
    ) -> ToolResult:
        """Execute a command pipeline."""
        if not commands:
            return ToolResult.error("No commands provided")
        
        # Check permissions for all commands
        for cmd in commands:
            if not self._pm.check_execute_permission(cmd):
                has_permission = await self._pm.request_permission(
                    PermissionType.EXECUTE, 
                    cmd
                )
                if not has_permission:
                    return ToolResult.permission_denied("execute", cmd)
        
        # Check working directory
        if cwd:
            cwd_path = Path(cwd)
            if not self._pm.check_read_permission(cwd_path):
                return ToolResult.permission_denied("read", str(cwd_path))
        
        working_dir = Path(cwd) if cwd else Path.cwd()
        
        try:
            # Build pipeline
            pipeline = " | ".join(commands)
            
            import time
            start_time = time.time()
            
            process = await asyncio.create_subprocess_shell(
                pipeline,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(working_dir)
            )
            
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return ToolResult.timeout(timeout, metadata={"pipeline": pipeline})
            
            execution_time = (time.time() - start_time) * 1000
            
            stdout = stdout_data.decode('utf-8', errors='replace') if stdout_data else ""
            stderr = stderr_data.decode('utf-8', errors='replace') if stderr_data else ""
            
            output_parts = []
            if stdout:
                output_parts.append(stdout)
            if stderr:
                output_parts.append(f"[stderr]\n{stderr}")
            
            output = "\n".join(output_parts) if output_parts else ""
            
            status = ToolStatus.SUCCESS if process.returncode == 0 else ToolStatus.ERROR
            
            return ToolResult(
                status=status,
                output=output or f"Pipeline exited with code {process.returncode}",
                metadata={
                    "pipeline": pipeline,
                    "commands": commands,
                    "returncode": process.returncode,
                    "cwd": str(working_dir),
                    "execution_time_ms": execution_time
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error executing pipeline: {str(e)}")
