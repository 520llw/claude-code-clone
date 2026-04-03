# Claude Code Clone - Agent Documentation

This document provides essential information for AI coding agents working on the Claude Code Clone project.

## Project Overview

Claude Code Clone is a full-featured AI-powered terminal coding assistant built with TypeScript. It provides an interactive CLI interface for coding tasks with multi-agent orchestration, 40+ permission-gated tools, and extensible plugin architecture.

### Key Features

- **Multi-Agent Orchestration**: Parent agents, sub-agents, and specialized agents working together
- **40+ Permission-Gated Tools**: Safe execution with explicit permission controls
- **Context Compression**: Three-layer system (MicroCompact, AutoCompact, Full Compact)
- **MCP Support**: Model Context Protocol integration for external tool servers
- **Plugin System**: Extensible architecture with hooks and custom tools
- **Skills System**: Pre-built skills for common development tasks
- **Session Management**: Persistent sessions with import/export capabilities
- **Terminal UI**: Beautiful React + Ink interface with streaming responses

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js >= 18.0.0 (Bun preferred for development) |
| Language | TypeScript 5.3+ (strict mode) |
| UI Framework | React 18 + Ink 4.4 |
| CLI Parser | Commander 12 |
| Validation | Zod schemas |
| LLM Client | Anthropic SDK (@anthropic-ai/sdk) |
| Build Tool | esbuild |
| Testing | Jest 29 |
| Linting | ESLint + TypeScript ESLint |
| Formatting | Prettier |

## Project Structure

```
claude-code-clone/
├── src/                          # Source code
│   ├── agent/                    # Agent system implementation
│   ├── cli.tsx                   # CLI entry point (main)
│   ├── commands/                 # Slash commands
│   │   ├── agent/                # Agent management commands
│   │   ├── debug/                # Debug commands
│   │   ├── git/                  # Git commands
│   │   ├── help/                 # Help commands
│   │   ├── memory/               # Memory commands
│   │   ├── review/               # Code review commands
│   │   ├── session/              # Session commands
│   │   ├── settings/             # Settings commands
│   │   └── utility/              # Utility commands
│   ├── config/                   # Configuration system
│   ├── context/                  # Context compression & management
│   │   ├── compression/          # Compression strategies
│   │   │   ├── auto/             # Auto-compact implementation
│   │   │   ├── full/             # Full-compact implementation
│   │   │   └── micro/            # Micro-compact implementation
│   │   ├── memory/               # Memory management
│   │   └── search/               # Semantic search
│   ├── core/                     # Core interfaces and classes
│   │   ├── interfaces.ts         # Core interface definitions
│   │   ├── base-classes.ts       # Abstract base classes
│   │   ├── AgentLoop.ts          # Main agent loop
│   │   ├── ContextManager.ts     # Context management
│   │   ├── PermissionManager.ts  # Permission system
│   │   ├── QueryEngine.ts        # LLM query engine
│   │   ├── SessionManager.ts     # Session management
│   │   ├── StreamingHandler.ts   # Response streaming
│   │   ├── TokenTracker.ts       # Token budgeting
│   │   ├── errors.ts             # Error classes
│   │   └── events.ts             # Event system
│   ├── hooks/                    # Hook system
│   │   └── builtin/              # Built-in hooks
│   ├── lib/                      # External library wrappers
│   ├── mcp/                      # MCP (Model Context Protocol)
│   │   ├── servers/              # Built-in MCP servers
│   │   └── transports/           # Transport implementations
│   ├── plugins/                  # Plugin system
│   │   ├── builtin/              # Built-in plugins
│   │   └── hooks/                # Hook implementations
│   ├── query-engine/             # Query engine module
│   ├── session/                  # Session persistence
│   ├── skills/                   # Skills system
│   │   └── builtin/              # Built-in skills
│   ├── telemetry/                # Telemetry & analytics
│   ├── tools/                    # Tool definitions and registry
│   │   └── implementations/      # Tool implementations
│   │       ├── agent/            # Agent tools
│   │       ├── code-intelligence/# LSP-based tools
│   │       ├── execution/        # Bash, build, test tools
│   │       ├── file/             # File system tools
│   │       ├── ide/              # IDE integration tools
│   │       ├── lsp/              # Language server tools
│   │       ├── memory/           # Memory tools
│   │       ├── search/           # Search tools
│   │       └── web/              # Web search/fetch tools
│   ├── types/                    # Global type definitions
│   │   └── index.ts              # All types with Zod schemas
│   ├── ui/                       # Terminal UI (Ink/React)
│   │   ├── app.tsx               # Main app component
│   │   ├── components/           # UI components
│   │   ├── hooks/                # React hooks
│   │   └── theme/                # Theme definitions
│   ├── update/                   # Auto-updater
│   └── utils/                    # Utility functions
│       └── security/             # Security utilities
├── tests/                        # Test suite
│   ├── e2e/                      # End-to-end tests
│   ├── fixtures/                 # Test fixtures
│   ├── integration/              # Integration tests
│   ├── mocks/                    # Test mocks
│   ├── performance/              # Performance tests
│   ├── setup.ts                  # Test setup
│   └── unit/                     # Unit tests
├── scripts/                      # Build scripts
│   ├── build.js                  # Main build script
│   ├── pack.js                   # Package script
│   ├── postinstall.js            # Post-install hook
│   ├── release.js                # Release script
│   └── version.js                # Version management
├── docs/                         # Documentation
├── examples/                     # Example configurations
├── .github/workflows/            # GitHub Actions
├── Dockerfile                    # Docker configuration
├── docker-compose.yml            # Docker Compose
├── package.json                  # Package manifest
├── tsconfig.json                 # TypeScript config
├── bunfig.toml                   # Bun configuration
├── .eslintrc.json                # ESLint config
├── .prettierrc                   # Prettier config
└── ARCHITECTURE.md               # Detailed architecture docs
```

## Build Commands

```bash
# Development build
npm run build

# Production build (minified)
npm run build:prod

# Type checking only
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Cleaning
npm run clean
```

### Using Bun (Preferred for Development)

```bash
# Install dependencies
bun install

# Development build with hot reload
bun run build

# Run in development mode
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage
```

## Test Commands

```bash
# Run all tests with coverage
npm run test

# Run tests in CI mode
npm run test:ci

# Run specific test suites
npx jest tests/unit
npx jest tests/integration
npx jest tests/e2e

# Run with coverage report
npm run test -- --coverage

# Run specific test file
npx jest tests/unit/core/AgentLoop.test.ts

# Run in watch mode
npx jest --watch
```

### Test Structure

- **Unit tests**: `tests/unit/` - Individual component testing
- **Integration tests**: `tests/integration/` - Module interaction testing
- **E2E tests**: `tests/e2e/` - Full workflow testing
- **Performance tests**: `tests/performance/` - Benchmark tests
- **Fixtures**: `tests/fixtures/` - Test data and sample files

## Code Style Guidelines

### TypeScript

- **Strict mode enabled**: All strict TypeScript options are on
- **Explicit types**: Prefer explicit return types on public functions
- **No `any`**: Avoid `any` type; use `unknown` with type guards
- **Zod validation**: All external inputs validated with Zod schemas

### Formatting (Prettier)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### ESLint Rules

- Explicit function return types not required (inferred allowed)
- No floating promises (must be awaited or handled)
- Unused vars must start with underscore
- React hooks rules enforced

### Naming Conventions

- **Files**: PascalCase for classes, camelCase for utilities
- **Interfaces**: Prefix with `I` (e.g., `ILogger`, `IAgent`)
- **Types**: PascalCase (e.g., `AgentConfig`, `ToolResult`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Private members**: Prefix with underscore

### Import Order

1. Node.js built-ins
2. External dependencies
3. Internal aliases (`@types/`, `@core/`, `@utils/`, etc.)
4. Relative imports

## Configuration System

### Configuration Hierarchy (Highest to Lowest Priority)

1. CLI arguments
2. Environment variables
3. Project configuration (`.claude-code/config.yaml`)
4. Global configuration (`~/.config/claude-code/config.yaml`)
5. Default configuration

### Environment Variables

| Variable | Config Path | Description |
|----------|-------------|-------------|
| `CLAUDE_API_KEY` | `model.apiKey` | Anthropic API key |
| `CLAUDE_MODEL` | `model.name` | Model name |
| `CLAUDE_MAX_TOKENS` | `model.maxTokens` | Max tokens |
| `CLAUDE_TEMPERATURE` | `model.temperature` | Temperature |
| `CLAUDE_CONTEXT_MAX_TOKENS` | `context.maxTokens` | Context limit |
| `CLAUDE_TELEMETRY_ENABLED` | `telemetry.enabled` | Enable telemetry |
| `CLAUDE_PLUGINS_DIR` | `plugins.directory` | Plugins directory |

### Configuration Schema Key Paths

```typescript
// Model settings
config.get('model.provider')      // 'anthropic' | 'openai' | 'google' | 'custom'
config.get('model.name')          // string
config.get('model.apiKey')        // string
config.get('model.maxTokens')     // number
config.get('model.temperature')   // number

// Context settings
config.get('context.maxTokens')   // number
config.get('context.compression.enabled')    // boolean
config.get('context.compression.strategy')   // 'none' | 'micro-compact' | 'auto-compact' | 'full-compact'

// Permissions
config.get('permissions.default') // 'auto' | 'ask' | 'deny'
config.get('permissions.tools')   // Record<string, PermissionLevel>
```

## Key Architecture Patterns

### Agent System

```
Parent Agent (Orchestrator)
    ├── Sub-Agent (Code)
    ├── Sub-Agent (Search)
    └── Sub-Agent (Analysis)
```

- **Parent Agent**: Coordinates tasks, delegates to sub-agents
- **Sub-Agents**: Specialized agents for specific tasks
- **Agent Orchestrator**: Manages agent lifecycle and communication

### Tool System

All tools implement the `ITool` interface:

```typescript
interface ITool {
  readonly name: string;
  readonly description: string;
  readonly definition: ToolDefinition;
  readonly parameters: z.ZodSchema;
  
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
  validate(params: unknown): ValidationResult<unknown>;
}
```

Tool categories:
- `filesystem`: File read, write, edit operations
- `search`: Grep, find, semantic search
- `code`: LSP-based code intelligence
- `git`: Git operations
- `bash`: Shell command execution
- `network`: Web search, API calls
- `mcp`: MCP server tools

### Permission System

Permission levels:
- `auto`: Execute without prompt
- `ask`: Always prompt user
- `deny`: Never allow

Tools declare their permission requirements in their definition.

### Context Compression

Three strategies:
1. **MicroCompact**: Lightweight (whitespace removal, truncation)
2. **AutoCompact**: Balanced (message summarization, structure preservation)
3. **FullCompact**: Aggressive (full conversation summarization)

### Hook System

Extension points for plugins:
- `before:tool:execute`
- `after:tool:execute`
- `before:message:send`
- `after:message:receive`
- `before:command:execute`
- `after:command:execute`
- `on:session:start`
- `on:session:end`

## Testing Guidelines

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestFixture, resetMocks } from '../setup';

describe('Feature', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should do something', async () => {
    const fixture = createTestFixture();
    // Test implementation
  });
});
```

### Mock Usage

- Use `global.mockFS` for file system mocking
- Use `MockLLM` for LLM client mocking
- Use `MockTools` for tool mocking

### Coverage Requirements

Minimum coverage thresholds (from `bunfig.toml`):
- Lines: 70%
- Functions: 70%
- Statements: 70%
- Branches: 60%

## Security Considerations

1. **Permission Gating**: All tools require explicit permission
2. **Input Validation**: All inputs validated with Zod schemas
3. **Secrets Management**: API keys never logged or exposed
4. **Sandboxing**: Bash commands run with user permissions
5. **Audit Logging**: All actions logged for review

### Dangerous Operations

These tools require explicit user confirmation:
- `BashTool`: Shell command execution
- `FileDeleteTool`: File deletion
- `FileEditTool`: File modification
- `GitPushTool`: Git push operations

## Common Tasks

### Adding a New Tool

1. Create tool class in `src/tools/implementations/<category>/`
2. Extend `BaseTool` and implement `ITool` interface
3. Define Zod schema for parameters
4. Register in `src/tools/implementations/index.ts`
5. Add tests in `tests/unit/tools/`

### Adding a New Command

1. Create command class in `src/commands/<category>/`
2. Extend `BaseCommand` and implement `ICommand` interface
3. Register in `src/commands/index.ts`
4. Add tests in `tests/unit/commands/`

### Adding a New Plugin

1. Create plugin class in `src/plugins/builtin/`
2. Extend `BasePlugin` and implement `IPlugin` interface
3. Define manifest with hooks, tools, commands
4. Register in `src/plugins/builtin/index.ts`

### Adding a New Skill

1. Create skill class in `src/skills/builtin/`
2. Extend `BaseSkill` and implement `ISkill` interface
3. Define triggers and required tools
4. Register in `src/skills/builtin/index.ts`

## Debugging

### Enable Debug Logging

```bash
# Via CLI flag
claude-code --debug

# Via environment
DEBUG=1 claude-code

# In code
LoggerFactory.getInstance().setDefaultLevel('debug');
```

### Log Locations

- Application logs: `~/.claude-code/logs/claude-code.log`
- Session logs: `~/.claude-code/logs/sessions/`
- Error reports: `~/.claude-code/logs/errors/`

### Built-in Debug Commands

- `/debug:log` - Show recent logs
- `/debug:context` - Show context information
- `/debug:tokens` - Show token usage
- `/debug:tools` - List available tools

## CI/CD Pipeline

GitHub Actions workflows:

1. **ci.yml**: Lint, type check, test on push/PR
2. **test.yml**: Full test suite
3. **build.yml**: Multi-platform builds
4. **release.yml**: Release automation (tags only)

### Release Process

1. Update version: `npm version [patch|minor|major]`
2. Update CHANGELOG.md
3. Commit and push: `git push origin main`
4. Create tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
5. Push tag: `git push origin v1.0.0`
6. GitHub Actions handles the rest

## Useful Resources

- **Architecture Details**: See `ARCHITECTURE.md`
- **Deployment Guide**: See `DEPLOY.md`
- **Type Definitions**: See `src/types/index.ts`
- **Core Interfaces**: See `src/core/interfaces.ts`
- **Configuration**: See `src/config/index.ts`

## Getting Help

If you're unsure about something:
1. Check existing implementations in similar modules
2. Review the interface definitions in `src/core/interfaces.ts`
3. Look at test files for usage examples
4. Check `ARCHITECTURE.md` for design patterns
