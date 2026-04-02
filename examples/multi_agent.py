"""
Multi-agent coordination example for Claude Code Agent System.

This example demonstrates:
1. Creating a coordinator
2. Spawning subagents
3. Parallel execution
4. Result aggregation
"""

import asyncio
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core import Coordinator, Context, parallel_execute, coordinated_execute


async def basic_coordinator_example():
    """Basic coordinator usage."""
    print("-" * 60)
    print("Example 1: Basic Coordinator Usage")
    print("-" * 60)
    print()
    
    coordinator = Coordinator()
    context = Context()
    
    # Spawn subagents for different tasks
    tasks = [
        "Explain what Python is in 2 sentences",
        "Explain what JavaScript is in 2 sentences",
        "Explain what Rust is in 2 sentences",
    ]
    
    print(f"Spawning {len(tasks)} subagents...")
    subagents = await coordinator.spawn_subagents(tasks, context)
    
    print("Running subagents in parallel...")
    results = await coordinator.run_parallel(subagents)
    
    print("\nResults:")
    for i, result in enumerate(results, 1):
        print(f"\nSubAgent {i} ({result.status.value}):")
        print(f"  {result.result or result.error}")
    
    await coordinator.cleanup()


async def decomposition_example():
    """Task decomposition example."""
    print()
    print("-" * 60)
    print("Example 2: Task Decomposition")
    print("-" * 60)
    print()
    
    coordinator = Coordinator()
    context = Context()
    
    # Complex task that should be decomposed
    task = """
    Create a simple web application with:
    1. A frontend using HTML/CSS/JavaScript
    2. A backend API
    3. Database integration
    Provide a high-level overview of each component.
    """
    
    print(f"Task: {task.strip()}")
    print()
    print("Decomposing and executing...")
    print()
    
    # Execute with decomposition
    result = await coordinator.execute(task, context, decompose=True)
    
    print("Final aggregated result:")
    print(result)
    
    await coordinator.cleanup()


async def parallel_execute_example():
    """Parallel execution convenience function."""
    print()
    print("-" * 60)
    print("Example 3: Parallel Execute Convenience Function")
    print("-" * 60)
    print()
    
    tasks = [
        "What is 2 + 2?",
        "What is 10 * 5?",
        "What is 100 / 4?",
    ]
    
    print(f"Executing {len(tasks)} tasks in parallel...")
    
    results = await parallel_execute(tasks)
    
    print("\nResults:")
    for i, result in enumerate(results, 1):
        print(f"  Task {i}: {result}")


async def coordinated_execute_example():
    """Coordinated execute convenience function."""
    print()
    print("-" * 60)
    print("Example 4: Coordinated Execute Convenience Function")
    print("-" * 60)
    print()
    
    task = "Compare Python, JavaScript, and Rust for backend development"
    
    print(f"Task: {task}")
    print()
    print("Executing with coordination...")
    print()
    
    result = await coordinated_execute(task, decompose=True)
    
    print("Result:")
    print(result)


async def subagent_management_example():
    """Subagent management example."""
    print()
    print("-" * 60)
    print("Example 5: SubAgent Management")
    print("-" * 60)
    print()
    
    coordinator = Coordinator()
    context = Context()
    
    # Spawn some subagents
    subagent1 = await coordinator.spawn_subagent("Task 1", context)
    subagent2 = await coordinator.spawn_subagent("Task 2", context)
    subagent3 = await coordinator.spawn_subagent("Task 3", context)
    
    print(f"Spawned subagents: {coordinator.list_subagents()}")
    
    # Get a specific subagent
    sa = coordinator.get_subagent(subagent1.subagent_id)
    print(f"Retrieved subagent: {sa.subagent_id if sa else 'None'}")
    print(f"Subagent task: {sa.task if sa else 'N/A'}")
    print(f"Subagent status: {sa.status.value if sa else 'N/A'}")
    
    await coordinator.cleanup()


async def main():
    """Run all multi-agent examples."""
    print("=" * 60)
    print("Claude Code Agent - Multi-Agent Coordination Example")
    print("=" * 60)
    print()
    
    # Run examples
    await basic_coordinator_example()
    # Note: The following examples require API keys and make actual LLM calls
    # Uncomment to run:
    # await decomposition_example()
    # await parallel_execute_example()
    # await coordinated_execute_example()
    await subagent_management_example()
    
    print()
    print("=" * 60)
    print("Multi-agent coordination example complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
