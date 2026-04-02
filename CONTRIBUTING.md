# Contributing to Claude Code Clone

First off, thank you for considering contributing to Claude Code Clone! It's people like you that make this project a great tool for the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Python 3.8 or higher
- Git
- A GitHub account

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork locally**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-code-clone.git
   cd claude-code-clone
   ```

3. **Set up the upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-owner/claude-code-clone.git
   ```

4. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

5. **Install development dependencies**:
   ```bash
   pip install -e ".[dev]"
   ```

6. **Verify your setup**:
   ```bash
   pytest tests/ -v
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to see if the problem has already been reported.

When creating a bug report, please include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Python version, etc.)
- **Code samples** that demonstrate the issue

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear title**
- **Provide detailed description** of the proposed feature
- **Explain why** this enhancement would be useful
- **List possible alternatives** you've considered

### Contributing Code

#### Finding Issues to Work On

- Look for issues labeled `good first issue` or `help wanted`
- Check the [roadmap](README.md#roadmap) for planned features
- Comment on an issue to let others know you're working on it

#### Creating New Tools

To add a new tool to the system:

1. Create a new file in `src/tools/`
2. Inherit from `BaseTool` in `src/tools/base.py`
3. Implement required methods:
   - `name` property
   - `description` property
   - `parameters` property
   - `execute()` method
4. Register the tool in `src/tools/__init__.py`
5. Add tests in `tests/`
6. Update documentation

Example:

```python
from src.tools.base import BaseTool, ToolResult

class MyNewTool(BaseTool):
    @property
    def name(self) -> str:
        return "my_tool"
    
    @property
    def description(self) -> str:
        return "Description of what my tool does"
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "param1": {
                "type": "string",
                "description": "Description of param1",
                "required": True
            }
        }
    
    async def execute(self, param1: str) -> ToolResult:
        # Implementation here
        return ToolResult(output="Success!")
```

## Development Workflow

### Branching Strategy

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** following our style guidelines

3. **Run tests and linting**:
   ```bash
   pytest tests/ -v
   black src/ tests/ --check
   pylint src/
   mypy src/
   ```

4. **Commit your changes** with a descriptive message

5. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Create a Pull Request** on GitHub

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Style Guidelines

### Python Code Style

We follow [PEP 8](https://pep8.org/) with some modifications:

- **Line length**: 100 characters maximum
- **Quotes**: Use double quotes for strings
- **Imports**: Group imports (stdlib, third-party, local)
- **Type hints**: Use type hints for all function parameters and return values

### Code Formatting

We use automated tools to maintain code quality:

```bash
# Format code with Black
black src/ tests/

# Check with pylint
pylint src/

# Type checking with mypy
mypy src/
```

### Documentation

- Use docstrings for all public modules, classes, and functions
- Follow [Google docstring format](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- Keep README.md updated with new features

Example:

```python
def my_function(param1: str, param2: int) -> bool:
    """Short description of the function.
    
    Longer description if needed, explaining what the function does
    and any important details.
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        Description of the return value
    
    Raises:
        ValueError: When param2 is negative
    
    Example:
        >>> my_function("test", 5)
        True
    """
    return True
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

Examples:

```
feat(tools): add new web_search tool

Implement web search functionality using multiple search providers.
Includes support for Google, Bing, and DuckDuckGo.

Closes #123
```

```
fix(permission): resolve directory traversal vulnerability

Added proper path normalization to prevent directory traversal
attacks in file operations.

Fixes #456
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** with your changes
5. **Fill out the PR template** completely
6. **Link related issues** using keywords (Fixes #123, Closes #456)
7. **Request review** from maintainers

### PR Review Process

- Maintainers will review your PR within a few days
- Address any requested changes
- Once approved, a maintainer will merge your PR

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Discord**: Real-time chat with the community

### Recognition

Contributors will be:
- Listed in the CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Added to the project's contributor graph

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search closed issues
3. Ask in GitHub Discussions
4. Join our Discord community

Thank you for contributing to Claude Code Clone!
