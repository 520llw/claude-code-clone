# Example CLAUDE.md

This is an example CLAUDE.md file demonstrating the format for automatic context injection.

## Instructions

- Use Python 3.10+ with full type annotations
- Follow PEP 8 style guidelines
- Use async/await for all I/O operations
- Prefer Pydantic models over raw dictionaries
- Write comprehensive docstrings for all public APIs

## Code Conventions

### Type Hints
- Use `from __future__ import annotations` for forward references
- Use `Optional[T]` instead of `T | None` for compatibility
- Use `List[T]` and `Dict[K, V]` from typing module

### Error Handling
- Use custom exception classes for domain errors
- Always handle exceptions at appropriate levels
- Log errors with context before re-raising

### Documentation
- Use Google-style docstrings
- Include type information in docstrings
- Provide usage examples for complex functions

## Available Tools

- `read_file`: Read file contents with optional offset/limit
- `write_file`: Write or append to files
- `shell`: Execute shell commands safely
- `search`: Search for files and content
- `python`: Execute Python code in isolated environment

## Project Structure

```
project/
├── src/
│   └── core/
│       ├── agent.py          # Main Agent class
│       ├── llm_client.py     # LLM API clients
│       ├── context.py        # Context management
│       ├── session.py        # Session persistence
│       ├── coordinator.py    # Multi-agent coordination
│       └── types.py          # Shared type definitions
├── examples/                  # Usage examples
├── tests/                     # Test suite
└── README.md                  # Documentation
```

## Testing

- Run tests with: `pytest`
- Check types with: `mypy src/`
- Format code with: `black src/`
