# Architecture Overview

Technical architecture and design of Claude Code Clone.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Module Structure](#module-structure)
5. [Plugin Architecture](#plugin-architecture)
6. [State Management](#state-management)
7. [API Integration](#api-integration)
8. [Security Architecture](#security-architecture)
9. [Performance Design](#performance-design)
10. [Extension Points](#extension-points)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Terminal   │  │    Web UI    │  │   API/CLI    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Engine                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Session    │  │   Context    │  │   Command    │          │
│  │   Manager    │  │   Manager    │  │   Processor  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Tool System                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  File Tools  │  │  Shell Tool  │  │ Search Tool  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Git Tool   │  │ Browser Tool │  │ Custom Tools │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Model Integration                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Anthropic   │  │    OpenAI    │  │    Local     │          │
│  │    Claude    │  │     GPT      │  │   Models     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Modularity**: Components are loosely coupled and interchangeable
2. **Extensibility**: Plugin system for custom functionality
3. **Security**: Sandboxed execution and permission controls
4. **Performance**: Efficient caching and async operations
5. **Reliability**: Error handling and graceful degradation

## Core Components

### Session Manager

Manages user sessions and conversation state.

```typescript
interface SessionManager {
  // Create new session
  createSession(config: SessionConfig): Session;
  
  // Save session to disk
  saveSession(sessionId: string, path?: string): Promise<void>;
  
  // Load session from disk
  loadSession(sessionId: string): Promise<Session>;
  
  // Get active session
  getActiveSession(): Session;
  
  // Close session
  closeSession(sessionId: string): Promise<void>;
}
```

**Responsibilities:**
- Session lifecycle management
- Conversation history
- State persistence
- Multi-session support

### Context Manager

Manages context for AI interactions.

```typescript
interface ContextManager {
  // Build context for request
  buildContext(request: Request): Context;
  
  // Add file to context
  addFile(filePath: string): Promise<void>;
  
  // Remove file from context
  removeFile(filePath: string): void;
  
  // Get current context
  getContext(): Context;
  
  // Clear context
  clearContext(): void;
}
```

**Context Types:**
- **File Context**: Currently open/referenced files
- **Project Context**: Project structure and metadata
- **Conversation Context**: Previous messages
- **Tool Context**: Available tools and their state

### Command Processor

Processes user commands and queries.

```typescript
interface CommandProcessor {
  // Parse command input
  parse(input: string): Command;
  
  // Execute command
  execute(command: Command): Promise<Result>;
  
  // Register command handler
  register(name: string, handler: CommandHandler): void;
  
  // Get available commands
  getCommands(): Command[];
}
```

**Command Types:**
- Natural language queries
- Slash commands
- File references
- Tool invocations

### Tool Registry

Manages available tools and their execution.

```typescript
interface ToolRegistry {
  // Register tool
  register(tool: Tool): void;
  
  // Get tool by name
  getTool(name: string): Tool;
  
  // List all tools
  listTools(): Tool[];
  
  // Execute tool
  execute(name: string, params: object): Promise<Result>;
  
  // Enable/disable tool
  setEnabled(name: string, enabled: boolean): void;
}
```

## Data Flow

### Request Processing Flow

```
User Input
    │
    ▼
┌─────────────┐
│   Parser    │───► Parse into command/query
└─────────────┘
    │
    ▼
┌─────────────┐
│   Context   │───► Build context (files, history)
│   Builder   │
└─────────────┘
    │
    ▼
┌─────────────┐
│   AI Model  │───► Generate response/plan
│   Request   │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Response   │───► Parse tool calls
│   Parser    │
└─────────────┘
    │
    ▼
┌─────────────┐
│   Tool      │───► Execute tools
│  Executor   │
└─────────────┘
    │
    ▼
┌─────────────┐
│   Output    │───► Format and display
│  Formatter  │
└─────────────┘
    │
    ▼
User Output
```

### Context Building Flow

```
Request Received
    │
    ├──► Load Project Context
    │    ├──► Read project structure
    │    ├──► Parse config files
    │    └──► Identify project type
    │
    ├──► Load File Context
    │    ├──► Read referenced files
    │    ├──► Parse imports/exports
    │    └──► Build file relationships
    │
    ├──► Load Conversation Context
    │    ├──► Get recent messages
    │    ├──► Summarize older messages
    │    └──► Extract relevant history
    │
    └──► Load Tool Context
         ├──► List available tools
         ├──► Get tool descriptions
         └──► Check tool states
```

## Module Structure

### Directory Layout

```
src/
├── core/                       # Core engine
│   ├── session/               # Session management
│   │   ├── SessionManager.ts
│   │   ├── Session.ts
│   │   └── types.ts
│   ├── context/               # Context management
│   │   ├── ContextManager.ts
│   │   ├── ContextBuilder.ts
│   │   └── types.ts
│   ├── commands/              # Command processing
│   │   ├── CommandProcessor.ts
│   │   ├── CommandParser.ts
│   │   └── handlers/
│   └── config/                # Configuration
│       ├── ConfigManager.ts
│       └── types.ts
│
├── tools/                      # Tool implementations
│   ├── file/                  # File tools
│   │   ├── readFile.ts
│   │   ├── writeFile.ts
│   │   └── editFile.ts
│   ├── shell/                 # Shell tool
│   │   └── shell.ts
│   ├── search/                # Search tools
│   │   ├── search.ts
│   │   └── grep.ts
│   ├── git/                   # Git tools
│   │   └── git.ts
│   ├── browser/               # Browser tools
│   │   └── browser.ts
│   └── registry.ts            # Tool registry
│
├── ai/                         # AI integration
│   ├── providers/             # AI providers
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   └── local.ts
│   ├── models/                # Model management
│   │   └── ModelManager.ts
│   ├── prompts/               # Prompt templates
│   │   └── templates/
│   └── client.ts              # AI client
│
├── ui/                         # User interfaces
│   ├── terminal/              # Terminal UI
│   │   ├── TerminalUI.ts
│   │   ├── components/
│   │   └── styles/
│   ├── web/                   # Web UI
│   │   └── (future)
│   └── api/                   # API interface
│       └── (future)
│
├── plugins/                    # Plugin system
│   ├── PluginManager.ts
│   ├── types.ts
│   └── loader.ts
│
├── hooks/                      # Hook system
│   ├── HookManager.ts
│   └── types.ts
│
├── utils/                      # Utilities
│   ├── logger.ts
│   ├── cache.ts
│   ├── errors.ts
│   └── helpers.ts
│
└── types/                      # Type definitions
    ├── index.ts
    ├── tools.ts
    ├── config.ts
    └── session.ts
```

### Key Modules

#### Core Module

Central orchestration and coordination:

```typescript
// src/core/index.ts
export class Core {
  private sessionManager: SessionManager;
  private contextManager: ContextManager;
  private commandProcessor: CommandProcessor;
  private toolRegistry: ToolRegistry;
  private aiClient: AIClient;
  
  async initialize(): Promise<void> {
    // Initialize all components
  }
  
  async process(input: string): Promise<Output> {
    // Main processing loop
  }
}
```

#### Tool Module

Tool implementations and registry:

```typescript
// src/tools/registry.ts
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  
  async execute(name: string, params: object): Promise<Result> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.execute(params);
  }
}
```

#### AI Module

AI provider integration:

```typescript
// src/ai/client.ts
export class AIClient {
  private provider: AIProvider;
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    return this.provider.complete(request);
  }
  
  async stream(request: StreamRequest): Promise<StreamResponse> {
    return this.provider.stream(request);
  }
}
```

## Plugin Architecture

### Plugin Structure

```
plugins/
└── my-plugin/
    ├── package.json
    ├── index.js
    ├── tools/
    │   └── my-tool.js
    ├── hooks/
    │   └── my-hook.js
    └── skills/
        └── my-skill.js
```

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description?: string;
  
  // Lifecycle hooks
  initialize?(context: PluginContext): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
  
  // Components
  tools?: Tool[];
  hooks?: Hook[];
  skills?: Skill[];
  commands?: Command[];
}
```

### Plugin Loading

```typescript
class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  
  async loadPlugin(path: string): Promise<Plugin> {
    const plugin = require(path);
    await plugin.initialize(this.context);
    this.plugins.set(plugin.name, plugin);
    return plugin;
  }
  
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin?.deactivate) {
      await plugin.deactivate();
    }
    this.plugins.delete(name);
  }
}
```

## State Management

### Session State

```typescript
interface SessionState {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Conversation
  messages: Message[];
  messageCount: number;
  
  // Context
  contextFiles: string[];
  projectPath: string;
  
  // Configuration
  config: SessionConfig;
  
  // Metadata
  metadata: {
    totalTokens: number;
    toolCalls: number;
    filesModified: number;
  };
}
```

### State Persistence

```typescript
class StateManager {
  private storage: Storage;
  
  async saveSession(session: Session): Promise<void> {
    const data = this.serialize(session);
    await this.storage.write(
      `sessions/${session.id}.json`,
      JSON.stringify(data, null, 2)
    );
  }
  
  async loadSession(id: string): Promise<Session> {
    const data = await this.storage.read(`sessions/${id}.json`);
    return this.deserialize(JSON.parse(data));
  }
}
```

## API Integration

### Provider Interface

```typescript
interface AIProvider {
  name: string;
  
  // Completion
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  
  // Streaming
  stream(request: StreamRequest): AsyncIterable<StreamChunk>;
  
  // Embeddings (optional)
  embed?(text: string): Promise<number[]>;
  
  // Tool calling
  supportsTools: boolean;
  convertTools(tools: Tool[]): object[];
}
```

### Request/Response Types

```typescript
interface CompletionRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  context?: Context;
}

interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## Security Architecture

### Permission System

```typescript
interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

class PermissionManager {
  private permissions: Permission[] = [];
  
  check(resource: string, action: string): boolean {
    const perm = this.permissions.find(
      p => p.resource === resource && p.action === action
    );
    return perm?.allowed ?? false;
  }
  
  require(resource: string, action: string): void {
    if (!this.check(resource, action)) {
      throw new PermissionDeniedError(resource, action);
    }
  }
}
```

### Sandboxed Execution

```typescript
class Sandbox {
  private allowedPaths: string[];
  private blockedCommands: string[];
  
  validateFileAccess(path: string): void {
    if (!this.isPathAllowed(path)) {
      throw new SecurityError(`Access denied: ${path}`);
    }
  }
  
  validateCommand(command: string): void {
    if (this.isCommandBlocked(command)) {
      throw new SecurityError(`Command blocked: ${command}`);
    }
  }
}
```

### API Key Security

```typescript
class KeyManager {
  // Store in OS keychain
  async storeKey(name: string, key: string): Promise<void> {
    await keytar.setPassword('claude-code-clone', name, key);
  }
  
  // Retrieve from keychain
  async getKey(name: string): Promise<string | null> {
    return keytar.getPassword('claude-code-clone', name);
  }
}
```

## Performance Design

### Caching Strategy

```typescript
class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (entry && !this.isExpired(entry)) {
      return entry.value as T;
    }
    return undefined;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : undefined
    });
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return entry.expires ? Date.now() > entry.expires : false;
  }
}
```

### Async Operations

```typescript
class AsyncQueue {
  private queue: Promise<any>[] = [];
  private concurrency: number;
  
  async add<T>(task: () => Promise<T>): Promise<T> {
    while (this.queue.length >= this.concurrency) {
      await Promise.race(this.queue);
    }
    
    const promise = task();
    this.queue.push(promise);
    
    promise.finally(() => {
      const index = this.queue.indexOf(promise);
      if (index > -1) this.queue.splice(index, 1);
    });
    
    return promise;
  }
}
```

### Token Management

```typescript
class TokenManager {
  private maxTokens: number;
  private currentTokens: number = 0;
  
  track(tokens: number): void {
    this.currentTokens += tokens;
    if (this.currentTokens > this.maxTokens) {
      throw new TokenLimitError();
    }
  }
  
  optimizeContext(context: Context): Context {
    // Remove less relevant content
    // Summarize older messages
    // Prioritize recent and relevant files
  }
}
```

## Extension Points

### Tool Extension

```typescript
// Create custom tool
const myTool: Tool = {
  name: 'my-tool',
  description: 'My custom tool',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    }
  },
  async execute({ input }) {
    // Tool logic
    return { result: input.toUpperCase() };
  }
};

// Register
toolRegistry.register(myTool);
```

### Hook Extension

```typescript
// Create custom hook
const myHook: Hook = {
  name: 'my-hook',
  event: 'before-edit',
  async execute(context) {
    // Hook logic
    console.log('About to edit:', context.file);
  }
};

// Register
hookManager.register(myHook);
```

### Command Extension

```typescript
// Create custom command
const myCommand: Command = {
  name: 'my-command',
  description: 'My custom command',
  async execute(args) {
    // Command logic
    return { success: true };
  }
};

// Register
commandProcessor.register(myCommand);
```

---

**Architecture Quick Reference**

```
Core Components:
  - Session Manager
  - Context Manager
  - Command Processor
  - Tool Registry
  - AI Client

Data Flow:
  Input → Parser → Context Builder → AI → Tool Executor → Output

Extension Points:
  - Tools
  - Hooks
  - Plugins
  - Commands
  - Skills
```
