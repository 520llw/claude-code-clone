"""
Custom tools example for Claude Code Agent System.

This example demonstrates:
1. Creating custom tools
2. Registering tools with the agent
3. Tool execution
"""

import asyncio
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core import Agent, ToolDefinition, ToolResult, ToolResultStatus
from core.types import ToolParameter


# Define a calculator tool
class CalculatorTool:
    """Calculator tool for mathematical operations."""
    
    definition = ToolDefinition(
        name="calculator",
        description="Perform mathematical calculations safely",
        parameters=[
            ToolParameter(
                name="expression",
                type="string",
                description="Mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)')",
                required=True,
            )
        ]
    )
    
    async def execute(self, expression: str) -> ToolResult:
        """Execute the calculator tool."""
        try:
            # Safe evaluation - only allow basic math operations
            allowed_names = {
                "abs": abs,
                "max": max,
                "min": min,
                "pow": pow,
                "round": round,
                "sum": sum,
            }
            
            # For this example, we'll use a simple eval with limited scope
            # In production, use a proper math parser like ast.literal_eval or numexpr
            import math
            allowed_names["sqrt"] = math.sqrt
            allowed_names["sin"] = math.sin
            allowed_names["cos"] = math.cos
            allowed_names["tan"] = math.tan
            allowed_names["log"] = math.log
            allowed_names["log10"] = math.log10
            allowed_names["pi"] = math.pi
            allowed_names["e"] = math.e
            
            result = eval(expression, {"__builtins__": {}}, allowed_names)
            
            return ToolResult(
                tool_call_id="",
                status=ToolResultStatus.SUCCESS,
                content=str(result),
            )
        except Exception as e:
            return ToolResult(
                tool_call_id="",
                status=ToolResultStatus.ERROR,
                content="",
                error_message=f"Calculation error: {str(e)}",
            )


# Define a file info tool
class FileInfoTool:
    """Tool to get file information."""
    
    definition = ToolDefinition(
        name="file_info",
        description="Get information about a file",
        parameters=[
            ToolParameter(
                name="path",
                type="string",
                description="Path to the file",
                required=True,
            )
        ]
    )
    
    async def execute(self, path: str) -> ToolResult:
        """Execute the file info tool."""
        try:
            file_path = Path(path)
            
            if not file_path.exists():
                return ToolResult(
                    tool_call_id="",
                    status=ToolResultStatus.ERROR,
                    content="",
                    error_message=f"File not found: {path}",
                )
            
            info = {
                "exists": True,
                "is_file": file_path.is_file(),
                "is_directory": file_path.is_dir(),
                "size_bytes": file_path.stat().st_size if file_path.is_file() else None,
                "modified": file_path.stat().st_mtime,
                "absolute_path": str(file_path.absolute()),
            }
            
            return ToolResult(
                tool_call_id="",
                status=ToolResultStatus.SUCCESS,
                content=info,
            )
        except Exception as e:
            return ToolResult(
                tool_call_id="",
                status=ToolResultStatus.ERROR,
                content="",
                error_message=str(e),
            )


async def main():
    """Run custom tools example."""
    print("=" * 60)
    print("Claude Code Agent - Custom Tools Example")
    print("=" * 60)
    print()
    
    # Create agent
    agent = Agent()
    
    # Register custom tools
    agent.register_tool(CalculatorTool())
    agent.register_tool(FileInfoTool())
    
    print("Registered tools:")
    for tool_name in agent.tool_registry.list_tools():
        tool_def = agent.tool_registry.get_definition(tool_name)
        print(f"  - {tool_name}: {tool_def.description}")
    print()
    
    # Example 1: Calculator tool
    print("-" * 60)
    print("Example 1: Calculator Tool")
    print("-" * 60)
    
    user_input = "Calculate 15 * 23 + 7"
    print(f"User: {user_input}")
    print()
    
    async for event in agent.run(user_input):
        if event.type == EventType.MESSAGE:
            if event.message.content:
                print(event.message.content, end="")
        elif event.type == EventType.TOOL_CALL:
            print(f"\n[Calling tool: {event.tool_call.name}]")
        elif event.type == EventType.TOOL_RESULT:
            print(f"\n[Result: {event.result.content}]")
        elif event.type == EventType.COMPLETE:
            print("\n[Complete]")
    
    print()
    
    # Example 2: File info tool
    print("-" * 60)
    print("Example 2: File Info Tool")
    print("-" * 60)
    
    # Create a test file
    test_file = Path("test_file.txt")
    test_file.write_text("Hello, World!")
    
    user_input = f"Get information about the file: {test_file.absolute()}"
    print(f"User: {user_input}")
    print()
    
    async for event in agent.run(user_input):
        if event.type == EventType.MESSAGE:
            if event.message.content:
                print(event.message.content, end="")
        elif event.type == EventType.TOOL_CALL:
            print(f"\n[Calling tool: {event.tool_call.name}]")
        elif event.type == EventType.TOOL_RESULT:
            print(f"\n[Result: {event.result.content}]")
        elif event.type == EventType.COMPLETE:
            print("\n[Complete]")
    
    # Cleanup
    test_file.unlink()
    await agent.close()


if __name__ == "__main__":
    from core import EventType
    asyncio.run(main())
