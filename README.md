# Claude Code Clone

A full-featured Claude Code clone built with TypeScript, Bun runtime, React, and Ink for terminal UI.

## Features

- **Multi-Agent Orchestration**: Support for parent agents, sub-agents, and specialized agents
- **40+ Permission-Gated Tools**: Extensive tool system with safety controls
- **Context Compression**: Three-layer compression system (MicroCompact, AutoCompact, Full Compact)
- **MCP Support**: Model Context Protocol integration
- **Plugin System**: Extensible architecture with hooks and custom tools
- **Skills System**: Pre-built skills for common tasks
- **Session Management**: Persistent sessions with import/export
- **Terminal UI**: Beautiful React + Ink interface
- **Streaming Responses**: Real-time LLM response streaming
- **Telemetry & Analytics**: Built-in usage tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Interface Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Terminal   │  │   Commands   │  │   Arguments  │  │   Config     │   │
│  │     UI       │  │   Parser     │  │   Parser     │  │   Loader     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Application Layer                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Session Manager                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Context    │  │   Message    │  │   State      │              │   │
│  │  │   Manager    │  │   History    │  │   Manager    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Agent Orchestrator                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Parent     │  │   Sub-Agent  │  │   Agent      │              │   │
│  │  │   Agent      │  │   Manager    │  │   Registry   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Core Services Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Query      │  │    Tool      │  │   Context    │  │   Plugin     │   │
│  │   Engine     │  │   Registry   │  │ Compression  │  │   System     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Skill      │  │    Hook      │  │   MCP        │  │   Permission │   │
│  │   Manager    │  │   System     │  │   Client     │  │   Manager    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Clone the repository
git clone https://github.com/example/claude-code-clone.git
cd claude-code-clone

# Install dependencies
bun install

# Build the project
bun run build

# Run the CLI
bun run start
```

## Usage

### Basic Usage

```bash
# Start interactive mode
claude-code

# Start with an initial prompt
claude-code "Explain how React hooks work"

# Use a specific directory
claude-code -d /path/to/project

# Use a specific config file
claude-code -c /path/to/config.yaml
```

### Configuration

Configuration is loaded from multiple sources (in order of priority):

1. CLI arguments (highest priority)
2. Environment variables
3. Project configuration (`.claude-code/config.yaml`)
4. Global configuration (`~/.config/claude-code/config.yaml`)
5. Default configuration (lowest priority)

### Example Configuration

```yaml
# ~/.config/claude-code/config.yaml
model:
  provider: anthropic
  name: claude-3-5-sonnet-20241022
  apiKey: ${CLAUDE_API_KEY}
  maxTokens: 8192
  temperature: 0.7

context:
  maxTokens: 200000
  compression:
    enabled: true
    strategy: auto-compact
    threshold: 0.8

permissions:
  default: ask
  tools:
    View: auto
    Read: auto
    Edit: ask
    Bash: ask
    Delete: ask

plugins:
  enabled: []
  directory: ~/.claude-code/plugins

telemetry:
  enabled: true
  anonymized: true
```

## Commands

### Built-in Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help information |
| `/clear` | Clear the conversation |
| `/config` | Manage configuration |
| `/session` | Manage sessions |
| `/plugin` | Manage plugins |
| `/compact` | Force context compression |
| `/tokens` | Show token usage |
| `/exit` | Exit the application |

### CLI Commands

```bash
# Configuration management
claude-code config --list
claude-code config --edit
claude-code config --reset

# Session management
claude-code session --list
claude-code session --resume <id>
claude-code session --delete <id>
claude-code session --export <id>

# Plugin management
claude-code plugin --list
claude-code plugin --install <path>
claude-code plugin --uninstall <name>
```

## Project Structure

```
src/
├── types/           # Global type definitions
├── config/          # Configuration system
├── core/            # Core interfaces and base classes
├── agent/           # Agent system
├── tools/           # Tool definitions and registry
├── commands/        # Slash commands
├── ui/              # Terminal UI (Ink/React)
├── plugins/         # Plugin system
├── hooks/           # Hook system
├── skills/          # Skills system
├── context/         # Context compression
├── query-engine/    # LLM query engine
├── session/         # Session management
├── telemetry/       # Telemetry & analytics
├── mcp/             # MCP integration
├── utils/           # Utilities
└── lib/             # External library wrappers
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1.0
- Node.js >= 20.0.0 (for compatibility)

### Development Commands

```bash
# Run in development mode with hot reload
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Type check
bun run typecheck

# Lint
bun run lint

# Format code
bun run format
```

### Creating a Plugin

```typescript
import { BasePlugin } from '@core/base-classes';
import type { PluginContext } from '@types/index';

export class MyPlugin extends BasePlugin {
  readonly manifest = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    author: 'Your Name',
    license: 'MIT',
    entry: './index.ts',
    hooks: ['before:tool:execute', 'after:tool:execute'],
    tools: ['MyCustomTool'],
    commands: ['my-command'],
  };

  async onActivate(context: PluginContext): Promise<void> {
    // Plugin activation logic
  }

  async onDeactivate(): Promise<void> {
    // Plugin deactivation logic
  }
}

export default MyPlugin;
```

### Creating a Tool

```typescript
import { BaseTool } from '@core/base-classes';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@types/index';

const MyToolSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export class MyTool extends BaseTool {
  readonly name = 'MyTool';
  readonly description = 'Description of what my tool does';
  
  readonly definition = {
    name: this.name,
    description: this.description,
    category: 'custom',
    parameters: MyToolSchema,
    permissions: [],
    examples: [],
  };
  
  readonly parameters = MyToolSchema;

  protected async onExecute(
    params: z.infer<typeof MyToolSchema>,
    context: ToolContext
  ): Promise<ToolResult> {
    // Tool execution logic
    return {
      success: true,
      output: 'Success!',
    };
  }
}
```

## Context Compression

The system implements three-layer context compression:

1. **MicroCompact** (Lightweight)
   - Removes redundant whitespace
   - Truncates long code blocks
   - Summarizes distant messages

2. **AutoCompact** (Balanced)
   - Summarizes message groups
   - Compresses code with structure preservation
   - Maintains key decision points

3. **Full Compact** (Aggressive)
   - Full conversation summarization
   - Extracts only essential information

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Acknowledgments

- Inspired by [Claude Code](https://claude.ai/code) by Anthropic
- Built with [Bun](https://bun.sh/), [React](https://react.dev/), and [Ink](https://github.com/vadimdemedes/ink)
