# Claude Code Clone

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue.svg" alt="Python 3.8+">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Build-Passing-brightgreen.svg" alt="Build Status">
  <img src="https://img.shields.io/badge/Code%20Style-Black-black.svg" alt="Code Style: Black">
  <img src="https://img.shields.io/badge/Tests-Pytest-yellow.svg" alt="Tests: Pytest">
</p>

<p align="center">
  <b>A comprehensive AI agent tool system inspired by Claude Code</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

Claude Code Clone is a powerful Python framework that replicates and extends the capabilities of Anthropic's Claude Code. It provides a comprehensive tool system for AI agents, featuring file operations, command execution, code analysis, and MCP (Model Context Protocol) support with robust security and permission management.

## Features

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **File Operations** | Read, write, edit, glob, grep, find, ls | ✅ Complete |
| **Command Execution** | Bash, shell, pipeline with timeout controls | ✅ Complete |
| **Code Analysis** | AST parsing, dependency analysis, code search | ✅ Complete |
| **Permission System** | Granular access control with directory trust | ✅ Complete |
| **MCP Support** | Model Context Protocol client/server | ✅ Complete |
| **Terminal UI** | Rich interactive interface | ✅ Complete |
| **Agent System** | Multi-agent orchestration | ✅ Complete |

### Security Features

- 🔒 **Permission-based access control** - Fine-grained permissions for read/write/execute
- 🛡️ **Directory trust mechanism** - Whitelist-based directory access
- 🚫 **Dangerous command blocking** - Automatic blocking of harmful commands
- ✅ **Auto-approval configuration** - Configurable auto-approval for trusted operations
- 📋 **Audit logging** - Complete operation logging for security review

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Claude Code Clone                                  │
│                    AI Agent Tool System Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        User Interface Layer                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │  Terminal   │  │   Streamlit │  │    API      │  │   CLI     │  │   │
│  │  │    UI       │  │    Web UI   │  │   Server    │  │  Client   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Agent Core Layer                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Agent     │  │   Memory    │  │   Planner   │  │  Context  │  │   │
│  │  │   System    │  │   Manager   │  │   Engine    │  │  Manager  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Tool System Layer                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Tool      │  │  Permission │  │   Tool      │  │   Bash    │  │   │
│  │  │  Registry   │  │   Manager   │  │  Registry   │  │   Tools   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   File      │  │    Code     │  │    MCP      │  │  Browser  │  │   │
│  │  │   Tools     │  │   Tools     │  │   Support   │  │   Tools   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      External Integration Layer                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │    LLM      │  │    MCP      │  │    Git      │  │   Web     │  │   │
│  │  │   APIs      │  │   Servers   │  │   Tools     │  │  Search   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
claude_code_clone/
├── src/
│   ├── core/              # Core Agent System
│   │   ├── agent.py       # Agent implementation
│   │   ├── memory.py      # Memory management
│   │   ├── planner.py     # Task planning
│   │   └── context.py     # Context management
│   ├── tools/             # Tool System
│   │   ├── base.py        # Tool base classes
│   │   ├── registry.py    # Tool registry
│   │   ├── permission.py  # Permission system
│   │   ├── file_tools.py  # File operations
│   │   ├── bash_tool.py   # Command execution
│   │   ├── code_tools.py  # Code analysis
│   │   └── mcp/           # MCP support
│   ├── ui/                # Terminal UI
│   │   ├── terminal.py    # Terminal interface
│   │   ├── components.py  # UI components
│   │   └── themes.py      # Color themes
│   ├── innovations/       # Innovation Features
│   │   ├── multi_agent.py # Multi-agent system
│   │   ├── git_tools.py   # Git integration
│   │   └── web_search.py  # Web search
│   └── main.py            # Main entry point
├── tests/                 # Test suite
├── docs/                  # Documentation
├── examples/              # Example code
└── .github/workflows/     # CI/CD configuration
```

## Installation

### Prerequisites

- Python 3.8 or higher
- pip or conda package manager

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-code-clone.git
cd claude-code-clone

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install in development mode
pip install -e .
```

### Using pip

```bash
pip install claude-code-tools
```

## Quick Start

### Basic Usage

```python
import asyncio
from claude_code_clone.src.tools import (
    get_permission_manager,
    register_default_tools,
    PermissionType
)

async def main():
    # Setup permissions
    pm = get_permission_manager()
    pm.add_trusted_directory("/path/to/project", read_allowed=True, write_allowed=True)
    pm.set_auto_approve(PermissionType.READ, True)
    
    # Create tool registry
    registry = register_default_tools()
    
    # Use tools
    result = await registry.execute("read", file_path="example.py")
    print(result.output)
    
    result = await registry.execute("bash", command="ls -la")
    print(result.output)

asyncio.run(main())
```

### Running the Terminal UI

```bash
python -m claude_code_clone.src.main
```

## Feature Comparison

| Feature | Claude Code Clone | Original Claude Code |
|---------|------------------|---------------------|
| File Operations | ✅ Full Support | ✅ Full Support |
| Bash Execution | ✅ Full Support | ✅ Full Support |
| Code Analysis | ✅ Extended | ✅ Basic |
| MCP Support | ✅ Client + Server | ✅ Client Only |
| Multi-Agent | ✅ Supported | ❌ Not Available |
| Web Search | ✅ Integrated | ❌ Not Available |
| Git Integration | ✅ Advanced | ✅ Basic |
| Terminal UI | ✅ Rich UI | ✅ Rich UI |
| Open Source | ✅ MIT License | ❌ Proprietary |
| Customizable | ✅ Fully Extensible | ❌ Limited |

## Tool Reference

### File Tools

#### ReadTool
Read file contents with line numbers.

```python
result = await registry.execute("read", 
    file_path="example.py",
    offset=1,      # Start line (1-based)
    limit=100      # Max lines to read
)
```

#### WriteTool
Write content to a file.

```python
result = await registry.execute("write",
    file_path="output.txt",
    content="Hello, World!",
    append=False   # Append mode
)
```

#### EditTool
Edit file by replacing text.

```python
result = await registry.execute("edit",
    file_path="example.py",
    old_string="def old_func():",
    new_string="def new_func():",
    replace_all=False  # Replace all occurrences
)
```

#### GlobTool
Find files matching a pattern.

```python
result = await registry.execute("glob",
    pattern="*.py",
    path=".",
    recursive=True
)
```

#### GrepTool
Search file contents.

```python
result = await registry.execute("grep",
    pattern="def ",
    path=".",
    file_pattern="*.py",
    case_sensitive=False,
    regex=False
)
```

### Bash Tools

#### BashTool
Execute bash commands with security controls.

```python
result = await registry.execute("bash",
    command="echo 'Hello'",
    timeout=60,
    cwd="/path/to/dir",
    env={"KEY": "value"}
)
```

### Code Analysis Tools

#### ViewTool
View Python file structure.

```python
result = await registry.execute("view",
    file_path="example.py",
    show_source=False
)
```

#### AnalyzeTool
Analyze code metrics and issues.

```python
result = await registry.execute("analyze",
    path="src/",
    recursive=True
)
```

## Documentation

- [Architecture Documentation](docs/architecture.md) - System architecture and design
- [Test Report](docs/test_report.md) - Test coverage and results
- [API Reference](docs/api_reference.md) - Complete API documentation
- [Examples](examples/) - Usage examples and tutorials

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Run linting
black src/ tests/
pylint src/
mypy src/
```

## Roadmap

- [ ] Enhanced multi-agent orchestration
- [ ] Plugin system for custom tools
- [ ] Web-based IDE integration
- [ ] Advanced code refactoring tools
- [ ] AI-powered code generation
- [ ] Integration with more LLM providers

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Anthropic's Claude Code](https://www.anthropic.com)
- Built with [Rich](https://github.com/Textualize/rich) for terminal UI
- Uses [MCP](https://modelcontextprotocol.io) for tool protocol

## Support

- 📧 Email: support@claude-code-clone.dev
- 💬 Discord: [Join our community](https://discord.gg/claude-code-clone)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/claude-code-clone/issues)

---

<p align="center">
  Made with ❤️ by the Claude Code Clone Team
</p>
