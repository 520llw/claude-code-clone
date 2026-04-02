"""
Basic Usage Examples for Claude Code Tool System

This file demonstrates how to use the tool system.
"""

import asyncio
import tempfile
from pathlib import Path

# Import the tool system
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tools import (
    get_permission_manager,
    get_registry,
    register_default_tools,
    PermissionType,
)


async def example_file_operations():
    """Example: File operations."""
    print("=" * 50)
    print("Example: File Operations")
    print("=" * 50)
    
    # Setup permission manager
    pm = get_permission_manager()
    
    # Create a temporary directory for testing
    with tempfile.TemporaryDirectory() as tmpdir:
        # Add the directory as trusted
        pm.add_trusted_directory(tmpdir, read_allowed=True, write_allowed=True)
        pm.set_auto_approve(PermissionType.READ, True)
        pm.set_auto_approve(PermissionType.WRITE, True)
        
        # Get the registry
        registry = register_default_tools()
        
        # Write a file
        test_file = Path(tmpdir) / "example.txt"
        result = await registry.execute(
            "write",
            file_path=str(test_file),
            content="Hello, World!\nThis is a test file.\nLine 3\n"
        )
        print(f"Write result: {result.output}")
        
        # Read the file
        result = await registry.execute(
            "read",
            file_path=str(test_file)
        )
        print(f"Read result:\n{result.output}")
        
        # Edit the file
        result = await registry.execute(
            "edit",
            file_path=str(test_file),
            old_string="Hello, World!",
            new_string="Hello, Universe!"
        )
        print(f"Edit result: {result.output}")
        
        # Read again to verify
        result = await registry.execute(
            "read",
            file_path=str(test_file)
        )
        print(f"After edit:\n{result.output}")
        
        # List directory
        result = await registry.execute(
            "ls",
            path=tmpdir
        )
        print(f"Directory listing:\n{result.output}")


async def example_bash_operations():
    """Example: Bash command execution."""
    print("\n" + "=" * 50)
    print("Example: Bash Operations")
    print("=" * 50)
    
    pm = get_permission_manager()
    pm.set_auto_approve(PermissionType.EXECUTE, True)
    
    registry = register_default_tools()
    
    # Simple command
    result = await registry.execute(
        "bash",
        command="echo 'Hello from bash!'"
    )
    print(f"Echo result:\n{result.output}")
    
    # Command with output
    result = await registry.execute(
        "bash",
        command="ls -la"
    )
    print(f"ls result:\n{result.output[:500]}...")


async def example_code_analysis():
    """Example: Code analysis."""
    print("\n" + "=" * 50)
    print("Example: Code Analysis")
    print("=" * 50)
    
    pm = get_permission_manager()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        pm.add_trusted_directory(tmpdir, read_allowed=True)
        
        # Create a sample Python file
        test_file = Path(tmpdir) / "sample.py"
        test_file.write_text('''
"""Sample module for testing."""
import os
import json
from typing import Dict, List

def process_data(data: Dict) -> List:
    """Process input data."""
    result = []
    for key, value in data.items():
        if isinstance(value, str):
            result.append(f"{key}: {value}")
    return result

class DataProcessor:
    """A data processor class."""
    
    def __init__(self, config: Dict):
        self.config = config
    
    def process(self, data: Dict) -> List:
        return process_data(data)
''')
        
        registry = register_default_tools()
        
        # View the file structure
        result = await registry.execute(
            "view",
            file_path=str(test_file)
        )
        print(f"View result:\n{result.output}")
        
        # Analyze the file
        result = await registry.execute(
            "analyze",
            path=str(test_file)
        )
        print(f"Analyze result:\n{result.output}")
        
        # Check dependencies
        result = await registry.execute(
            "dependencies",
            path=str(test_file)
        )
        print(f"Dependencies result:\n{result.output}")


async def example_search():
    """Example: Search operations."""
    print("\n" + "=" * 50)
    print("Example: Search Operations")
    print("=" * 50)
    
    pm = get_permission_manager()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        pm.add_trusted_directory(tmpdir, read_allowed=True)
        
        # Create test files
        (Path(tmpdir) / "file1.py").write_text("def hello(): pass\ndef world(): pass")
        (Path(tmpdir) / "file2.py").write_text("def foo(): pass\nclass Bar: pass")
        (Path(tmpdir) / "readme.txt").write_text("This is a readme file")
        
        registry = register_default_tools()
        
        # Glob search
        result = await registry.execute(
            "glob",
            pattern="*.py",
            path=tmpdir
        )
        print(f"Glob result: {result.output}")
        
        # Grep search
        result = await registry.execute(
            "grep",
            pattern="def ",
            path=tmpdir
        )
        print(f"Grep result:\n{result.output}")
        
        # Code search
        result = await registry.execute(
            "code_search",
            query="hello",
            path=tmpdir
        )
        print(f"Code search result:\n{result.output}")


async def example_batch_execution():
    """Example: Batch tool execution."""
    print("\n" + "=" * 50)
    print("Example: Batch Execution")
    print("=" * 50)
    
    pm = get_permission_manager()
    pm.set_auto_approve(PermissionType.EXECUTE, True)
    
    registry = register_default_tools()
    
    # Execute multiple commands
    calls = [
        {"tool": "bash", "params": {"command": "echo 'Command 1'"}},
        {"tool": "bash", "params": {"command": "echo 'Command 2'"}},
        {"tool": "bash", "params": {"command": "echo 'Command 3'"}},
    ]
    
    results = await registry.execute_batch(calls)
    
    for i, result in enumerate(results):
        print(f"Result {i+1}: {result.output.strip()}")


async def example_tool_info():
    """Example: Getting tool information."""
    print("\n" + "=" * 50)
    print("Example: Tool Information")
    print("=" * 50)
    
    registry = register_default_tools()
    
    # List all tools
    tools = registry.list_tools()
    print(f"Available tools: {', '.join(tools)}")
    
    # Get tool categories
    categories = registry.get_categories()
    print(f"Categories: {', '.join(categories)}")
    
    # Get info for a specific tool
    info = registry.get_tool_info("read")
    print(f"\nRead tool info:")
    print(f"  Description: {info['description']}")
    print(f"  Category: {info['category']}")
    print(f"  Parameters: {[p['name'] for p in info['parameters']]}")


async def main():
    """Run all examples."""
    print("Claude Code Tool System - Examples")
    print("=" * 50)
    
    await example_file_operations()
    await example_bash_operations()
    await example_code_analysis()
    await example_search()
    await example_batch_execution()
    await example_tool_info()
    
    print("\n" + "=" * 50)
    print("All examples completed!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
