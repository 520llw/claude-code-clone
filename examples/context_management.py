"""
Context management example for Claude Code Agent System.

This example demonstrates:
1. CLAUDE.md discovery and parsing
2. Context building
3. Context compaction
"""

import asyncio
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core import (
    CLAUDEMDParser,
    ContextBuilder,
    ContextCompactor,
    ContextManager,
    find_claude_md,
    parse_claude_md,
    build_system_prompt,
    Message,
)


def claude_md_example():
    """CLAUDE.md discovery and parsing example."""
    print("-" * 60)
    print("Example 1: CLAUDE.md Discovery and Parsing")
    print("-" * 60)
    print()
    
    # Find CLAUDE.md
    current_dir = Path(__file__).parent
    claude_md_path = find_claude_md(current_dir)
    
    if claude_md_path:
        print(f"Found CLAUDE.md at: {claude_md_path}")
        
        # Parse it
        content = parse_claude_md(claude_md_path)
        
        print(f"\nParsed content:")
        print(f"  Path: {content.path}")
        print(f"  Instructions sections: {len(content.instructions)}")
        print(f"  Conventions sections: {len(content.conventions)}")
        print(f"  Tool hints: {list(content.tools_hints.keys())}")
        print(f"  Metadata: {content.metadata}")
        
        if content.instructions:
            print(f"\n  First instruction section:")
            print(f"    {content.instructions[0][:200]}...")
    else:
        print("No CLAUDE.md found")


def context_builder_example():
    """Context builder example."""
    print()
    print("-" * 60)
    print("Example 2: Context Builder")
    print("-" * 60)
    print()
    
    # Create context builder
    current_dir = Path(__file__).parent
    builder = ContextBuilder(
        working_directory=current_dir,
        enable_claude_md=True,
    )
    
    # Build context
    context = builder.build_context()
    
    print(f"Built context with {len(context.items)} items:")
    for item in context.items:
        print(f"  - {item.source} (priority: {item.priority})")
    
    print(f"\nWorking directory: {context.working_directory}")
    print(f"CLAUDE.md path: {context.claude_md_path}")
    
    # Convert to text (truncated)
    context_text = context.to_text(max_tokens=500)
    print(f"\nContext text (first 500 chars):")
    print(context_text[:500])


def context_compactor_example():
    """Context compactor example."""
    print()
    print("-" * 60)
    print("Example 3: Context Compactor")
    print("-" * 60)
    print()
    
    compactor = ContextCompactor(model_max_tokens=4000)
    
    # Create some test messages
    messages = [
        Message.system("You are a helpful assistant."),
        Message.user("Hello!"),
        Message.assistant("Hi there! How can I help you?"),
        Message.user("Tell me about Python."),
        Message.assistant("Python is a versatile programming language..." * 50),  # Long message
        Message.user("What about JavaScript?"),
        Message.assistant("JavaScript is primarily used for web development..." * 50),
    ]
    
    print(f"Original message count: {len(messages)}")
    
    # Estimate tokens
    total_tokens = sum(
        compactor.estimate_tokens(msg.content or "")
        for msg in messages
    )
    print(f"Estimated tokens: {total_tokens}")
    
    # Compact messages
    compacted = compactor.compact_messages(messages, max_tokens=2000)
    print(f"Compacted message count: {len(compacted)}")
    
    # Show summary
    summary = compactor.summarize(messages[:4])
    print(f"\nSummary of first 4 messages:")
    print(summary)


def context_manager_example():
    """Context manager example."""
    print()
    print("-" * 60)
    print("Example 4: Context Manager")
    print("-" * 60)
    print()
    
    current_dir = Path(__file__).parent
    
    # Create context manager
    manager = ContextManager(
        working_directory=current_dir,
        enable_claude_md=True,
        max_context_tokens=4000,
    )
    
    # Initialize context
    context = manager.initialize()
    print(f"Initialized context with {len(context.items)} items")
    
    # Add custom context item
    from core.types import ContextItem
    manager.add_context_item(
        ContextItem(
            source="user_preference",
            content="User prefers concise responses.",
            priority=80,
        )
    )
    
    print(f"After adding item: {len(manager.get_context().items)} items")
    
    # Prepare for LLM
    messages = [
        Message.user("Hello!"),
        Message.assistant("Hi!"),
    ]
    
    system_prompt, prepared = manager.prepare_for_llm(messages)
    print(f"\nPrepared {len(prepared)} messages for LLM")
    print(f"System prompt length: {len(system_prompt)} chars")


def build_system_prompt_example():
    """Build system prompt example."""
    print()
    print("-" * 60)
    print("Example 5: Build System Prompt")
    print("-" * 60)
    print()
    
    current_dir = Path(__file__).parent
    
    # Build system prompt from context
    prompt = build_system_prompt(working_directory=current_dir)
    
    print("Generated system prompt (first 800 chars):")
    print("-" * 40)
    print(prompt[:800])
    print("-" * 40)
    print(f"\nTotal length: {len(prompt)} chars")


async def main():
    """Run all context management examples."""
    print("=" * 60)
    print("Claude Code Agent - Context Management Example")
    print("=" * 60)
    print()
    
    claude_md_example()
    context_builder_example()
    context_compactor_example()
    context_manager_example()
    build_system_prompt_example()
    
    print()
    print("=" * 60)
    print("Context management example complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
