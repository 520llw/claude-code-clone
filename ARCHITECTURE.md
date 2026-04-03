# Claude Code Clone - Architecture Documentation

## Overview

This document describes the complete architecture of the Claude Code Clone project, a full-featured AI coding assistant CLI tool built with TypeScript and Bun runtime.

## Architecture Principles

1. **Clean Architecture**: Clear separation of concerns with domain, application, and infrastructure layers
2. **Modularity**: Each module has a single responsibility and well-defined interfaces
3. **Extensibility**: Plugin system allows custom tools, commands, and behaviors
4. **Scalability**: Supports 100k+ lines of code with clear module boundaries
5. **Type Safety**: Full TypeScript coverage with strict type checking

## System Architecture

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
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Infrastructure Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   LLM        │  │   File       │  │   Git        │  │   Telemetry  │   │
│  │   Client     │  │   System     │  │   Client     │  │   Service    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Cache      │  │   Logger     │  │   Config     │  │   Feature    │   │
│  │   Manager    │  │   Service    │  │   Store      │  │   Flags      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/
├── types/                    # Global type definitions
│   ├── index.ts             # Main type exports
│   ├── agent.ts             # Agent-related types
│   ├── tool.ts              # Tool-related types
│   ├── context.ts           # Context-related types
│   ├── session.ts           # Session-related types
│   └── mcp.ts               # MCP-related types
│
├── config/                   # Configuration system
│   ├── index.ts             # Config manager
│   ├── schema.ts            # Config schema (Zod)
│   ├── defaults.ts          # Default configurations
│   └── loaders.ts           # Config loaders
│
├── core/                     # Core interfaces and abstractions
│   ├── interfaces.ts        # Core interfaces
│   ├── base-classes.ts      # Abstract base classes
│   ├── events.ts            # Event system
│   └── errors.ts            # Custom error classes
│
├── agent/                    # Agent system
│   ├── index.ts             # Agent exports
│   ├── base-agent.ts        # Base agent implementation
│   ├── parent-agent.ts      # Parent/coordinator agent
│   ├── sub-agent.ts         # Sub-agent implementation
│   ├── orchestrator.ts      # Multi-agent orchestrator
│   ├── registry.ts          # Agent registry
│   └── strategies/          # Agent strategies
│       ├── planning.ts
│       ├── execution.ts
│       └── delegation.ts
│
├── tools/                    # Tool system
│   ├── index.ts             # Tool exports
│   ├── registry.ts          # Tool registry
│   ├── base-tool.ts         # Base tool class
│   ├── definitions/         # Tool definitions
│   │   ├── filesystem.ts
│   │   ├── search.ts
│   │   ├── bash.ts
│   │   ├── edit.ts
│   │   └── ...
│   ├── permissions.ts       # Permission gating
│   └── validators.ts        # Tool validators
│
├── commands/                 # Slash commands
│   ├── index.ts             # Command exports
│   ├── registry.ts          # Command registry
│   ├── base-command.ts      # Base command class
│   ├── definitions/         # Command definitions
│   │   ├── clear.ts
│   │   ├── help.ts
│   │   ├── config.ts
│   │   └── ...
│   └── parser.ts            # Command parser
│
├── ui/                       # Terminal UI (Ink/React)
│   ├── index.ts             # UI exports
│   ├── app.tsx              # Main app component
│   ├── components/          # UI components
│   │   ├── chat.tsx
│   │   ├── input.tsx
│   │   ├── messages.tsx
│   │   ├── tools.tsx
│   │   └── status.tsx
│   ├── hooks/               # UI hooks
│   │   ├── use-input.ts
│   │   ├── use-messages.ts
│   │   └── use-theme.ts
│   └── themes/              # UI themes
│       ├── default.ts
│       └── dark.ts
│
├── plugins/                  # Plugin system
│   ├── index.ts             # Plugin exports
│   ├── registry.ts          # Plugin registry
│   ├── base-plugin.ts       # Base plugin class
│   ├── loader.ts            # Plugin loader
│   ├── hooks.ts             # Hook definitions
│   └── api.ts               # Plugin API surface
│
├── hooks/                    # Hook system
│   ├── index.ts             # Hook exports
│   ├── registry.ts          # Hook registry
│   ├── executor.ts          # Hook executor
│   └── types.ts             # Hook type definitions
│
├── skills/                   # Skills system
│   ├── index.ts             # Skill exports
│   ├── registry.ts          # Skill registry
│   ├── base-skill.ts        # Base skill class
│   ├── loader.ts            # Skill loader
│   └── definitions/         # Skill definitions
│       ├── code-analysis.ts
│       ├── refactoring.ts
│       └── testing.ts
│
├── context/                  # Context compression
│   ├── index.ts             # Context exports
│   ├── manager.ts           # Context manager
│   ├── compression.ts       # Compression algorithms
│   ├── strategies/          # Compression strategies
│   │   ├── micro-compact.ts
│   │   ├── auto-compact.ts
│   │   └── full-compact.ts
│   └── summarizer.ts        # Context summarizer
│
├── query-engine/             # LLM query engine
│   ├── index.ts             # Query engine exports
│   ├── engine.ts            # Main query engine
│   ├── client.ts            # LLM client
│   ├── streaming.ts         # Streaming handler
│   ├── caching.ts           # Response cache
│   ├── retry.ts             # Retry logic
│   └── parsers.ts           # Response parsers
│
├── session/                  # Session management
│   ├── index.ts             # Session exports
│   ├── manager.ts           # Session manager
│   ├── persistence.ts       # Session persistence
│   ├── state.ts             # Session state
│   └── recovery.ts          # Session recovery
│
├── telemetry/                # Telemetry & analytics
│   ├── index.ts             # Telemetry exports
│   ├── service.ts           # Telemetry service
│   ├── events.ts            # Telemetry events
│   ├── metrics.ts           # Metrics collection
│   └── exporters.ts         # Data exporters
│
├── mcp/                      # Model Context Protocol
│   ├── index.ts             # MCP exports
│   ├── client.ts            # MCP client
│   ├── server.ts            # MCP server
│   ├── transport.ts         # MCP transport
│   └── resources.ts         # MCP resources
│
├── utils/                    # Utilities
│   ├── index.ts             # Utility exports
│   ├── async.ts             # Async utilities
│   ├── file.ts              # File utilities
│   ├── string.ts            # String utilities
│   ├── validation.ts        # Validation utilities
│   └── logger.ts            # Logger utilities
│
└── lib/                      # External library wrappers
    ├── index.ts             # Library exports
    ├── anthropic.ts         # Anthropic SDK wrapper
    ├── git.ts               # Git wrapper
    └── fs.ts                # File system wrapper
```

## Core Interfaces

### Agent Interface

```typescript
interface IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly state: AgentState;
  
  initialize(config: AgentConfig): Promise<void>;
  execute(task: Task): Promise<TaskResult>;
  delegate(task: Task, toAgent: IAgent): Promise<TaskResult>;
  communicate(message: Message): Promise<void>;
  terminate(reason: string): Promise<void>;
  
  on(event: AgentEvent, handler: EventHandler): void;
  off(event: AgentEvent, handler: EventHandler): void;
}
```

### Tool Interface

```typescript
interface ITool {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodSchema;
  readonly permissions: Permission[];
  readonly category: ToolCategory;
  
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
  validate(params: unknown): ValidationResult;
  getExamples(): ToolExample[];
}
```

### Plugin Interface

```typescript
interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly hooks: HookRegistration[];
  
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  
  registerTools(registry: IToolRegistry): void;
  registerCommands(registry: ICommandRegistry): void;
  registerHooks(registry: IHookRegistry): void;
}
```

### Context Compression Interface

```typescript
interface IContextCompressor {
  readonly strategy: CompressionStrategy;
  
  compress(context: ConversationContext): CompressedContext;
  decompress(compressed: CompressedContext): ConversationContext;
  estimateTokens(context: ConversationContext): number;
  shouldCompress(context: ConversationContext): boolean;
}
```

## Data Flow

### Message Processing Flow

```
User Input
    │
    ▼
┌─────────────┐
│   Parser    │──> Command? ──Yes──> Execute Command
└─────────────┘
    │ No
    ▼
┌─────────────┐
│   Context   │──> Build context with history
│   Builder   │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Compression │──> Apply compression if needed
│   Check     │
└─────────────┘
    │
    ▼
┌─────────────┐
│   Query     │──> Send to LLM
│   Engine    │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Response   │──> Parse response
│   Parser    │
└─────────────┘
    │
    ├──> Text ──> Display to user
    │
    ├──> Tool Call ──> Execute tool ──> Return result
    │
    └──> Multi-step ──> Iterate
```

### Multi-Agent Orchestration Flow

```
Task Received
    │
    ▼
┌─────────────┐
│  Planning   │──> Analyze and decompose task
│   Agent     │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Task       │──> Create sub-tasks
│ Decomposer  │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Sub-Agent  │──> Delegate to specialized agents
│  Delegator  │
└─────────────┘
    │
    ├──> Code Agent ──> Execute code task
    │
    ├──> Search Agent ──> Execute search task
    │
    └──> Analysis Agent ──> Execute analysis task
    │
    ▼
┌─────────────┐
│  Result     │──> Aggregate and synthesize
│ Aggregator  │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Response   │──> Return final result
│  Formatter  │
└─────────────┘
```

## Context Compression Strategies

### Three-Layer Compression System

1. **MicroCompact** (Lightweight)
   - Removes redundant whitespace
   - Truncates long code blocks
   - Summarizes distant messages
   - Preserves recent context fully

2. **AutoCompact** (Balanced)
   - Summarizes message groups
   - Compresses code with structure preservation
   - Maintains key decision points
   - Uses semantic compression

3. **Full Compact** (Aggressive)
   - Full conversation summarization
   - Extracts only essential information
   - Rebuilds context from summary
   - May lose some details

```
┌─────────────────────────────────────────────────────────┐
│                    Context Window                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Recent Messages (Full)              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │ Msg N-2 │ │ Msg N-1 │ │  Msg N  │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘           │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Middle Messages (Compressed)          │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Summarized Group 1              │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Summarized Group 2              │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Old Messages (Highly Compressed)       │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Global Summary + Key Facts      │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Permission System

### Permission Gating Architecture

```
Tool Execution Request
    │
    ▼
┌─────────────────┐
│ Permission      │──> Check required permissions
│ Requirements    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Permission      │──> Check user settings
│ Settings        │
└─────────────────┘
    │
    ├──> Auto-allow ──> Execute immediately
    │
    ├──> Ask ──> Prompt user ──> Execute if approved
    │
    └──> Deny ──> Return permission error
```

### Permission Levels

- `auto`: Automatically execute without prompt
- `ask`: Always ask for permission
- `deny`: Never allow execution

### Tool Categories

- `safe`: Read-only operations (file read, search)
- `caution`: Potentially destructive (file edit, delete)
- `dangerous`: High-risk operations (bash, git push)

## Plugin System

### Plugin Lifecycle

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Discover│───>│  Load    │───>│Activate │───>│ Register │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
    │
    ▼
┌─────────┐    ┌──────────┐    ┌─────────┐
│ Unload  │<───│Deactivate│<───│  Error  │
└─────────┘    └──────────┘    └─────────┘
```

### Hook System

Plugins can register hooks at various extension points:

- `before:tool:execute`: Before tool execution
- `after:tool:execute`: After tool execution
- `before:message:send`: Before sending message to LLM
- `after:message:receive`: After receiving LLM response
- `on:session:start`: When session starts
- `on:session:end`: When session ends

## MCP (Model Context Protocol) Integration

### MCP Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Resources   │  │    Tools     │  │   Prompts    │  │
│  │   Manager    │  │   Manager    │  │   Manager    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ MCP Server │  │ MCP Server │  │ MCP Server │
    │  (Local)   │  │ (Remote)   │  │ (Remote)   │
    └────────────┘  └────────────┘  └────────────┘
```

## Configuration System

### Configuration Hierarchy

1. Default configuration (built-in)
2. Global configuration (~/.config/claude-code/config.yaml)
3. Project configuration (.claude-code/config.yaml)
4. Environment variables
5. CLI arguments (highest priority)

### Configuration Schema

```yaml
# Core settings
model:
  provider: anthropic
  name: claude-3-5-sonnet-20241022
  max_tokens: 8192
  temperature: 0.7

# Context settings
context:
  max_tokens: 200000
  compression:
    enabled: true
    strategy: auto-compact
    threshold: 0.8

# Permission settings
permissions:
  default: ask
  tools:
    Bash: ask
    Edit: ask
    View: auto

# Plugin settings
plugins:
  enabled: []
  directory: ~/.claude-code/plugins

# MCP settings
mcp:
  servers: []
  
# Telemetry settings
telemetry:
  enabled: true
  anonymized: true
```

## Error Handling

### Error Hierarchy

```
ClaudeCodeError (base)
├── ConfigError
│   ├── ConfigParseError
│   └── ConfigValidationError
├── AgentError
│   ├── AgentInitializationError
│   ├── AgentExecutionError
│   └── AgentCommunicationError
├── ToolError
│   ├── ToolNotFoundError
│   ├── ToolValidationError
│   ├── ToolExecutionError
│   └── ToolPermissionError
├── QueryEngineError
│   ├── LLMError
│   ├── StreamingError
│   └── RateLimitError
├── ContextError
│   ├── ContextOverflowError
│   └── CompressionError
├── PluginError
│   ├── PluginLoadError
│   ├── PluginActivationError
│   └── PluginHookError
└── SessionError
    ├── SessionNotFoundError
    └── SessionCorruptedError
```

## Testing Strategy

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── agent/
│   ├── tools/
│   ├── context/
│   └── ...
├── integration/             # Integration tests
│   ├── query-engine/
│   ├── plugin-system/
│   └── ...
├── e2e/                     # End-to-end tests
│   └── cli/
└── fixtures/                # Test fixtures
```

## Performance Considerations

1. **Lazy Loading**: Modules loaded on demand
2. **Caching**: Multi-level caching (LLM responses, file reads)
3. **Streaming**: Real-time response streaming
4. **Compression**: Context compression to reduce token usage
5. **Parallelization**: Parallel tool execution where safe

## Security Considerations

1. **Permission Gating**: All tools require explicit permission
2. **Sandboxing**: Tool execution in controlled environment
3. **Input Validation**: All inputs validated with Zod schemas
4. **Secrets Management**: API keys stored securely
5. **Audit Logging**: All actions logged for review

## Deployment

### Distribution

- npm package for global installation
- Binary releases for major platforms
- Docker image for containerized deployment

### Requirements

- Bun >= 1.1.0
- Node.js >= 20.0.0 (for compatibility)
- Git (for version control features)
