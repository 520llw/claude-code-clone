# Core API Documentation

API reference for Claude Code Clone core modules.

## Table of Contents

1. [Core Module](#core-module)
2. [Session API](#session-api)
3. [Context API](#context-api)
4. [Command API](#command-api)
5. [Config API](#config-api)
6. [Event API](#event-api)
7. [Error Handling](#error-handling)
8. [Type Definitions](#type-definitions)

## Core Module

### Core Class

The main entry point for Claude Code Clone.

```typescript
class Core {
  constructor(options?: CoreOptions);
  
  // Initialize the core
  initialize(): Promise<void>;
  
  // Process user input
  process(input: string): Promise<Output>;
  
  // Start interactive session
  startInteractive(): Promise<void>;
  
  // Execute single command
  execute(command: string): Promise<Output>;
  
  // Shutdown
  shutdown(): Promise<void>;
}
```

### Core Options

```typescript
interface CoreOptions {
  // Configuration
  config?: Config | string;
  configPath?: string;
  
  // Working directory
  cwd?: string;
  
  // Session
  session?: Session | string;
  
  // Mode
  mode?: 'interactive' | 'command' | 'batch' | 'daemon';
  
  // Logging
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  logFile?: string;
  
  // Plugins
  plugins?: string[];
  
  // Tools
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
}
```

### Usage Example

```typescript
import { Core } from 'claude-code-clone';

const core = new Core({
  configPath: './config.json',
  mode: 'interactive',
  logLevel: 'info'
});

await core.initialize();

// Process a query
const result = await core.process('What files are in this project?');
console.log(result.content);

await core.shutdown();
```

## Session API

### SessionManager

Manages user sessions.

```typescript
class SessionManager {
  // Create new session
  createSession(config?: SessionConfig): Promise<Session>;
  
  // Get session by ID
  getSession(id: string): Session | undefined;
  
  // Get all sessions
  getAllSessions(): Session[];
  
  // Save session
  saveSession(id: string, path?: string): Promise<void>;
  
  // Load session
  loadSession(id: string): Promise<Session>;
  
  // Delete session
  deleteSession(id: string): Promise<void>;
  
  // Set active session
  setActiveSession(id: string): void;
  
  // Get active session
  getActiveSession(): Session | undefined;
  
  // Close session
  closeSession(id: string): Promise<void>;
  
  // List saved sessions
  listSavedSessions(): Promise<SessionInfo[]>;
}
```

### Session Types

```typescript
interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Messages
  messages: Message[];
  
  // Context
  contextFiles: string[];
  projectPath: string;
  
  // Configuration
  config: SessionConfig;
  
  // State
  state: SessionState;
  
  // Metadata
  metadata: SessionMetadata;
}

interface SessionConfig {
  name?: string;
  description?: string;
  tags?: string[];
  maxHistory?: number;
  autoSave?: boolean;
}

interface SessionState {
  lastCommand?: string;
  variables: Record<string, any>;
}

interface SessionMetadata {
  totalTokens: number;
  toolCalls: number;
  filesModified: number;
  commandsExecuted: number;
}

interface SessionInfo {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  size: number;
}
```

### Session Usage

```typescript
import { SessionManager } from 'claude-code-clone';

const manager = new SessionManager();

// Create session
const session = await manager.createSession({
  name: 'my-session',
  description: 'Working on feature X'
});

// Save session
await manager.saveSession(session.id);

// Load session later
const loaded = await manager.loadSession(session.id);

// List all saved sessions
const sessions = await manager.listSavedSessions();
```

## Context API

### ContextManager

Manages context for AI interactions.

```typescript
class ContextManager {
  constructor(session: Session);
  
  // Build context for request
  buildContext(request: Request): Promise<Context>;
  
  // Add file to context
  addFile(filePath: string): Promise<void>;
  
  // Remove file from context
  removeFile(filePath: string): void;
  
  // Get context files
  getContextFiles(): string[];
  
  // Clear context
  clearContext(): void;
  
  // Get file content
  getFileContent(filePath: string): Promise<string>;
  
  // Parse file imports
  parseImports(filePath: string): Promise<string[]>;
  
  // Get related files
  getRelatedFiles(filePath: string): Promise<string[]>;
  
  // Set project path
  setProjectPath(path: string): void;
  
  // Get project info
  getProjectInfo(): ProjectInfo;
}
```

### Context Types

```typescript
interface Context {
  // Project information
  project: ProjectContext;
  
  // File context
  files: FileContext[];
  
  // Conversation context
  conversation: ConversationContext;
  
  // Tool context
  tools: ToolContext[];
  
  // Additional context
  metadata: ContextMetadata;
}

interface ProjectContext {
  path: string;
  name: string;
  type: string;
  structure: DirectoryNode;
  config: ProjectConfig;
}

interface FileContext {
  path: string;
  content: string;
  language: string;
  imports: string[];
  exports: string[];
  size: number;
}

interface ConversationContext {
  messages: Message[];
  summary?: string;
}

interface ToolContext {
  name: string;
  description: string;
  parameters: object;
  enabled: boolean;
}

interface ContextMetadata {
  totalTokens: number;
  maxTokens: number;
  timestamp: Date;
}
```

### Context Usage

```typescript
import { ContextManager } from 'claude-code-clone';

const contextManager = new ContextManager(session);

// Add files to context
await contextManager.addFile('src/main.js');
await contextManager.addFile('src/utils.js');

// Build context for request
const context = await contextManager.buildContext({
  query: 'Explain this code'
});

console.log(context.files);
console.log(context.project);
```

## Command API

### CommandProcessor

Processes user commands.

```typescript
class CommandProcessor {
  // Parse input into command
  parse(input: string): Command;
  
  // Execute command
  execute(command: Command): Promise<CommandResult>;
  
  // Register command handler
  register(name: string, handler: CommandHandler): void;
  
  // Unregister command handler
  unregister(name: string): void;
  
  // Get available commands
  getCommands(): Command[];
  
  // Get command by name
  getCommand(name: string): Command | undefined;
  
  // Check if input is command
  isCommand(input: string): boolean;
  
  // Get command help
  getHelp(command?: string): string;
}
```

### Command Types

```typescript
interface Command {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  args?: CommandArg[];
  options?: CommandOption[];
  handler: CommandHandler;
}

interface CommandArg {
  name: string;
  description: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
}

interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type?: 'string' | 'number' | 'boolean';
  default?: any;
}

type CommandHandler = (
  args: Record<string, any>,
  options: Record<string, any>
) => Promise<CommandResult>;

interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}
```

### Command Usage

```typescript
import { CommandProcessor } from 'claude-code-clone';

const processor = new CommandProcessor();

// Register custom command
processor.register('greet', {
  name: 'greet',
  description: 'Greet a user',
  args: [
    { name: 'name', description: 'Name to greet', required: true }
  ],
  handler: async (args) => {
    return {
      success: true,
      output: `Hello, ${args.name}!`
    };
  }
});

// Execute command
const result = await processor.execute({
  name: 'greet',
  args: { name: 'World' }
});
```

## Config API

### ConfigManager

Manages configuration.

```typescript
class ConfigManager {
  constructor(options?: ConfigManagerOptions);
  
  // Load configuration
  load(path?: string): Promise<Config>;
  
  // Save configuration
  save(path?: string): Promise<void>;
  
  // Get configuration value
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  
  // Set configuration value
  set<T>(key: string, value: T): void;
  
  // Delete configuration value
  delete(key: string): void;
  
  // Check if key exists
  has(key: string): boolean;
  
  // Get all configuration
  getAll(): Config;
  
  // Reset to defaults
  reset(): void;
  
  // Validate configuration
  validate(): ValidationResult;
  
  // Merge configuration
  merge(config: Partial<Config>): void;
  
  // Watch for changes
  watch(key: string, callback: ConfigCallback): void;
  
  // Unwatch
  unwatch(key: string, callback: ConfigCallback): void;
}
```

### Configuration Types

```typescript
interface Config {
  // API configuration
  api: APIConfig;
  
  // UI configuration
  ui: UIConfig;
  
  // Editor configuration
  editor: EditorConfig;
  
  // Tool configuration
  tools: ToolsConfig;
  
  // Security configuration
  security: SecurityConfig;
  
  // Plugin configuration
  plugins: PluginsConfig;
  
  // Logging configuration
  logging: LoggingConfig;
  
  // Performance configuration
  performance: PerformanceConfig;
}

interface APIConfig {
  provider: string;
  key?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  timeout: number;
  context: APIContextConfig;
}

interface APIContextConfig {
  maxFiles: number;
  maxTokens: number;
  includeProjectStructure: boolean;
  includeGitInfo: boolean;
}

interface UIConfig {
  theme: string;
  syntaxHighlighting: boolean;
  lineNumbers: boolean;
  wrapLines: boolean;
  confirmDestructive: boolean;
  notifications: NotificationConfig;
}

interface ToolsConfig {
  enabled: string[];
  disabled: string[];
  file: FileToolConfig;
  shell: ShellToolConfig;
  search: SearchToolConfig;
}

interface FileToolConfig {
  maxSize: number;
  encoding: string;
  backup: boolean;
  backupSuffix: string;
}

interface ShellToolConfig {
  enabled: boolean;
  shell: string;
  timeout: number;
  allowedCommands: string[];
  blockedCommands: string[];
  requireConfirmation: boolean;
}

interface SearchToolConfig {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  maxResults: number;
  excludePatterns: string[];
}
```

### Config Usage

```typescript
import { ConfigManager } from 'claude-code-clone';

const config = new ConfigManager();

// Load configuration
await config.load('./config.json');

// Get values
const apiKey = config.get<string>('api.key');
const theme = config.get('ui.theme', 'dark');

// Set values
config.set('api.model', 'claude-3-opus');
config.set('ui.theme', 'light');

// Save configuration
await config.save();

// Watch for changes
config.watch('api.model', (newValue, oldValue) => {
  console.log(`Model changed from ${oldValue} to ${newValue}`);
});
```

## Event API

### EventEmitter

Event system for Claude Code Clone.

```typescript
class EventEmitter {
  // Add event listener
  on(event: string, listener: EventListener): void;
  
  // Add one-time listener
  once(event: string, listener: EventListener): void;
  
  // Remove listener
  off(event: string, listener: EventListener): void;
  
  // Emit event
  emit(event: string, ...args: any[]): void;
  
  // Get listeners
  listeners(event: string): EventListener[];
  
  // Check if has listeners
  hasListeners(event: string): boolean;
  
  // Remove all listeners
  removeAllListeners(event?: string): void;
}
```

### Event Types

```typescript
// Core events
interface CoreEvents {
  'initialized': () => void;
  'shutdown': () => void;
  'error': (error: Error) => void;
}

// Session events
interface SessionEvents {
  'session:created': (session: Session) => void;
  'session:loaded': (session: Session) => void;
  'session:saved': (session: Session) => void;
  'session:closed': (session: Session) => void;
  'session:message': (message: Message) => void;
}

// Tool events
interface ToolEvents {
  'tool:before': (tool: Tool, params: object) => void;
  'tool:after': (tool: Tool, result: ToolResult) => void;
  'tool:error': (tool: Tool, error: Error) => void;
}

// File events
interface FileEvents {
  'file:before-read': (file: string) => void;
  'file:after-read': (file: string, content: string) => void;
  'file:before-write': (file: string, content: string) => void;
  'file:after-write': (file: string) => void;
}
```

### Event Usage

```typescript
import { EventEmitter } from 'claude-code-clone';

const events = new EventEmitter();

// Listen for events
events.on('session:message', (message) => {
  console.log('New message:', message.content);
});

// Listen once
events.once('initialized', () => {
  console.log('System initialized!');
});

// Emit event
events.emit('custom:event', { data: 'value' });

// Remove listener
const handler = (msg: Message) => console.log(msg);
events.on('session:message', handler);
events.off('session:message', handler);
```

## Error Handling

### Error Types

```typescript
// Base error
class ClaudeCodeError extends Error {
  code: string;
  details?: object;
  
  constructor(message: string, code: string, details?: object) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Specific errors
class ConfigError extends ClaudeCodeError {
  constructor(message: string, details?: object) {
    super(message, 'CONFIG_ERROR', details);
  }
}

class APIError extends ClaudeCodeError {
  statusCode?: number;
  
  constructor(message: string, statusCode?: number) {
    super(message, 'API_ERROR', { statusCode });
    this.statusCode = statusCode;
  }
}

class ToolError extends ClaudeCodeError {
  toolName: string;
  
  constructor(message: string, toolName: string) {
    super(message, 'TOOL_ERROR', { toolName });
    this.toolName = toolName;
  }
}

class ValidationError extends ClaudeCodeError {
  field: string;
  
  constructor(message: string, field: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.field = field;
  }
}

class PermissionError extends ClaudeCodeError {
  resource: string;
  action: string;
  
  constructor(resource: string, action: string) {
    super(
      `Permission denied: ${action} on ${resource}`,
      'PERMISSION_ERROR',
      { resource, action }
    );
    this.resource = resource;
    this.action = action;
  }
}
```

### Error Handling Usage

```typescript
import { 
  ClaudeCodeError, 
  ConfigError, 
  APIError 
} from 'claude-code-clone';

try {
  await core.initialize();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message);
    console.error('Details:', error.details);
  } else if (error instanceof APIError) {
    console.error('API error:', error.message);
    console.error('Status code:', error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Type Definitions

### Message Types

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  tokens?: number;
  model?: string;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  id: string;
  name: string;
  parameters: object;
  result?: ToolResult;
}
```

### Tool Types

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: object): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: ToolResultMetadata;
}

interface ToolResultMetadata {
  duration: number;
  timestamp: Date;
}
```

### Request/Response Types

```typescript
interface Request {
  query: string;
  context?: Context;
  options?: RequestOptions;
}

interface RequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

interface Response {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  metadata?: ResponseMetadata;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ResponseMetadata {
  model: string;
  duration: number;
  timestamp: Date;
}
```

### Output Types

```typescript
interface Output {
  type: 'text' | 'code' | 'file' | 'command' | 'error';
  content: string;
  metadata?: OutputMetadata;
}

interface OutputMetadata {
  language?: string;
  filePath?: string;
  lineNumbers?: boolean;
}
```

---

**Core API Quick Reference**

```
Core:
  new Core(options)
  initialize()
  process(input)
  startInteractive()
  shutdown()

Session:
  createSession(config)
  saveSession(id)
  loadSession(id)
  getActiveSession()

Context:
  buildContext(request)
  addFile(path)
  getContextFiles()

Command:
  parse(input)
  execute(command)
  register(name, handler)

Config:
  get(key)
  set(key, value)
  save()

Events:
  on(event, listener)
  emit(event, data)
```
