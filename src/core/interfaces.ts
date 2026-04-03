/**
 * Core Module Interfaces
 * 
 * This module defines the fundamental interfaces and abstractions
 * that all other modules implement. These interfaces ensure
 * loose coupling and high cohesion across the codebase.
 */

import type { z } from 'zod';
import type {
  // Agent types
  AgentConfig,
  AgentInfo,
  AgentState,
  AgentEvent,
  AgentType,
  AgentCapability,
  // Task types
  Task,
  TaskResult,
  // Message types
  Message,
  MessageContent,
  // Tool types
  ToolDefinition,
  ToolContext,
  ToolResult,
  // Command types
  CommandDefinition,
  // Context types
  ConversationContext,
  CompressedContext,
  CompressionStrategy,
  // Session types
  Session,
  SessionState,
  // Plugin types
  PluginManifest,
  PluginContext,
  HookPoint,
  HookRegistration,
  // Skill types
  SkillDefinition,
  // MCP types
  MCPResource,
  MCPServerConfig,
  // Config types
  AppConfig,
  ModelConfig,
  // Telemetry types
  TelemetryEvent,
  TelemetryEventType,
  // Error types
  ErrorCode,
  ErrorDetails,
  // Utility types
  EventHandler,
  ValidationResult,
  AsyncResult,
  UUID,
  JSONValue,
} from '@types/index';

// ============================================================================
// Disposable Interface
// ============================================================================

/**
 * Interface for resources that need cleanup
 */
export interface IDisposable {
  /**
   * Dispose of resources and perform cleanup
   */
  dispose(): Promise<void> | void;
  
  /**
   * Check if the resource has been disposed
   */
  readonly isDisposed: boolean;
}

// ============================================================================
// Event Emitter Interface
// ============================================================================

/**
 * Interface for event emitters
 */
export interface IEventEmitter {
  /**
   * Register an event handler
   */
  on<T>(event: string, handler: EventHandler<T>): void;
  
  /**
   * Register a one-time event handler
   */
  once<T>(event: string, handler: EventHandler<T>): void;
  
  /**
   * Remove an event handler
   */
  off<T>(event: string, handler: EventHandler<T>): void;
  
  /**
   * Emit an event
   */
  emit<T>(event: string, data: T): void;
  
  /**
   * Remove all handlers for an event
   */
  removeAllListeners(event?: string): void;
}

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Interface for logging
 */
export interface ILogger extends IDisposable {
  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void;
  
  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, unknown>): void;
  
  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void;
  
  /**
   * Log an error message
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  
  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error, meta?: Record<string, unknown>): void;
  
  /**
   * Create a child logger with additional context
   */
  child(meta: Record<string, unknown>): ILogger;
  
  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void;
  
  /**
   * Get the current log level
   */
  getLevel(): LogLevel;
}

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Interface for configuration management
 */
export interface IConfigManager extends IDisposable {
  /**
   * Get the current configuration
   */
  getConfig(): AppConfig;
  
  /**
   * Get a specific configuration value
   */
  get<T>(path: string): T | undefined;
  
  /**
   * Set a configuration value
   */
  set<T>(path: string, value: T): void;
  
  /**
   * Load configuration from a file
   */
  loadFile(path: string): Promise<void>;
  
  /**
   * Save configuration to a file
   */
  saveFile(path: string): Promise<void>;
  
  /**
   * Reset configuration to defaults
   */
  reset(): void;
  
  /**
   * Validate the current configuration
   */
  validate(): ValidationResult<AppConfig>;
  
  /**
   * Watch for configuration changes
   */
  onChange(handler: (config: AppConfig) => void): void;
  
  /**
   * Get configuration schema
   */
  getSchema(): z.ZodSchema<AppConfig>;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Interface for AI agents
 */
export interface IAgent extends IEventEmitter, IDisposable {
  /**
   * Unique identifier for the agent
   */
  readonly id: UUID;
  
  /**
   * Agent name
   */
  readonly name: string;
  
  /**
   * Agent type
   */
  readonly type: AgentType;
  
  /**
   * Current agent state
   */
  readonly state: AgentState;
  
  /**
   * Agent capabilities
   */
  readonly capabilities: AgentCapability[];
  
  /**
   * Parent agent ID (if sub-agent)
   */
  readonly parentId?: UUID;
  
  /**
   * Initialize the agent with configuration
   */
  initialize(config: AgentConfig): Promise<void>;
  
  /**
   * Execute a task
   */
  execute(task: Task): Promise<TaskResult>;
  
  /**
   * Delegate a task to another agent
   */
  delegate(task: Task, toAgent: IAgent): Promise<TaskResult>;
  
  /**
   * Send a message to the agent
   */
  sendMessage(message: Message): Promise<void>;
  
  /**
   * Receive a message from the agent
   */
  receiveMessage(): Promise<Message | null>;
  
  /**
   * Get agent information
   */
  getInfo(): AgentInfo;
  
  /**
   * Pause agent execution
   */
  pause(): Promise<void>;
  
  /**
   * Resume agent execution
   */
  resume(): Promise<void>;
  
  /**
   * Terminate the agent
   */
  terminate(reason?: string): Promise<void>;
}

// ============================================================================
// Agent Orchestrator Interface
// ============================================================================

/**
 * Interface for multi-agent orchestration
 */
export interface IAgentOrchestrator extends IEventEmitter, IDisposable {
  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: IAgent): void;
  
  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: UUID): Promise<void>;
  
  /**
   * Get an agent by ID
   */
  getAgent(agentId: UUID): IAgent | undefined;
  
  /**
   * Get all registered agents
   */
  getAllAgents(): IAgent[];
  
  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): IAgent[];
  
  /**
   * Create a sub-agent
   */
  createSubAgent(
    parentId: UUID,
    config: Partial<AgentConfig>
  ): Promise<IAgent>;
  
  /**
   * Execute a task with the best available agent
   */
  executeTask(task: Task): Promise<TaskResult>;
  
  /**
   * Distribute tasks among available agents
   */
  distributeTasks(tasks: Task[]): Promise<TaskResult[]>;
  
  /**
   * Coordinate agent communication
   */
  coordinateCommunication(
    fromAgentId: UUID,
    toAgentId: UUID,
    message: Message
  ): Promise<void>;
}

// ============================================================================
// Tool Interface
// ============================================================================

/**
 * Interface for tools
 */
export interface ITool extends IDisposable {
  /**
   * Tool name (unique identifier)
   */
  readonly name: string;
  
  /**
   * Tool description
   */
  readonly description: string;
  
  /**
   * Tool definition including parameters schema
   */
  readonly definition: ToolDefinition;
  
  /**
   * Parameter schema for validation
   */
  readonly parameters: z.ZodSchema;
  
  /**
   * Execute the tool with given parameters
   */
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
  
  /**
   * Validate parameters without executing
   */
  validate(params: unknown): ValidationResult<unknown>;
  
  /**
   * Get usage examples
   */
  getExamples(): Array<{
    description: string;
    parameters: Record<string, unknown>;
    expectedOutput: string;
  }>;
  
  /**
   * Check if tool requires user confirmation
   */
  requiresConfirmation(params: unknown): boolean;
}

// ============================================================================
// Tool Registry Interface
// ============================================================================

/**
 * Interface for tool registry
 */
export interface IToolRegistry extends IEventEmitter, IDisposable {
  /**
   * Register a tool
   */
  register(tool: ITool): void;
  
  /**
   * Unregister a tool
   */
  unregister(toolName: string): void;
  
  /**
   * Get a tool by name
   */
  get(toolName: string): ITool | undefined;
  
  /**
   * Check if a tool exists
   */
  has(toolName: string): boolean;
  
  /**
   * Get all registered tools
   */
  getAll(): ITool[];
  
  /**
   * Get tools by category
   */
  getByCategory(category: string): ITool[];
  
  /**
   * Get tool names
   */
  getNames(): string[];
  
  /**
   * Clear all tools
   */
  clear(): void;
}

// ============================================================================
// Command Interface
// ============================================================================

/**
 * Interface for commands
 */
export interface ICommand extends IDisposable {
  /**
   * Command definition
   */
  readonly definition: CommandDefinition;
  
  /**
   * Execute the command with arguments
   */
  execute(args: Record<string, unknown>, context: CommandContext): Promise<CommandResult>;
  
  /**
   * Get command help text
   */
  getHelp(): string;
  
  /**
   * Validate command arguments
   */
  validateArgs(args: Record<string, unknown>): ValidationResult<unknown>;
}

/**
 * Command execution context
 */
export interface CommandContext {
  sessionId: UUID;
  agentId: UUID;
  workingDirectory: string;
  config: IConfigManager;
  logger: ILogger;
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Command Registry Interface
// ============================================================================

/**
 * Interface for command registry
 */
export interface ICommandRegistry extends IEventEmitter, IDisposable {
  /**
   * Register a command
   */
  register(command: ICommand): void;
  
  /**
   * Unregister a command
   */
  unregister(commandName: string): void;
  
  /**
   * Get a command by name
   */
  get(commandName: string): ICommand | undefined;
  
  /**
   * Get a command by alias
   */
  getByAlias(alias: string): ICommand | undefined;
  
  /**
   * Check if a command exists
   */
  has(commandName: string): boolean;
  
  /**
   * Get all registered commands
   */
  getAll(): ICommand[];
  
  /**
   * Parse and execute a command string
   */
  execute(commandString: string, context: CommandContext): Promise<CommandResult>;
  
  /**
   * Get command suggestions
   */
  getSuggestions(partial: string): string[];
}

// ============================================================================
// Context Compressor Interface
// ============================================================================

/**
 * Interface for context compression
 */
export interface IContextCompressor extends IDisposable {
  /**
   * Compression strategy type
   */
  readonly strategy: CompressionStrategy;
  
  /**
   * Compress conversation context
   */
  compress(context: ConversationContext): CompressedContext;
  
  /**
   * Decompress compressed context (if possible)
   */
  decompress(compressed: CompressedContext): ConversationContext;
  
  /**
   * Estimate token count for context
   */
  estimateTokens(context: ConversationContext): number;
  
  /**
   * Check if compression should be applied
   */
  shouldCompress(context: ConversationContext): boolean;
  
  /**
   * Get compression ratio
   */
  getCompressionRatio(original: number, compressed: number): number;
}

// ============================================================================
// Context Manager Interface
// ============================================================================

/**
 * Interface for context management
 */
export interface IContextManager extends IEventEmitter, IDisposable {
  /**
   * Get current context
   */
  getContext(): ConversationContext;
  
  /**
   * Add a message to context
   */
  addMessage(message: Message): void;
  
  /**
   * Add multiple messages to context
   */
  addMessages(messages: Message[]): void;
  
  /**
   * Remove a message from context
   */
  removeMessage(messageId: UUID): void;
  
  /**
   * Clear all messages
   */
  clearMessages(): void;
  
  /**
   * Get message count
   */
  getMessageCount(): number;
  
  /**
   * Get token count estimate
   */
  getTokenCount(): number;
  
  /**
   * Compress context if needed
   */
  compressIfNeeded(): void;
  
  /**
   * Force compression
   */
  forceCompress(strategy: CompressionStrategy): void;
  
  /**
   * Set compression strategy
   */
  setCompressionStrategy(strategy: CompressionStrategy): void;
  
  /**
   * Summarize context
   */
  summarize(): string;
  
  /**
   * Export context to JSON
   */
  export(): JSONValue;
  
  /**
   * Import context from JSON
   */
  import(data: JSONValue): void;
}

// ============================================================================
// Session Manager Interface
// ============================================================================

/**
 * Interface for session management
 */
export interface ISessionManager extends IEventEmitter, IDisposable {
  /**
   * Create a new session
   */
  createSession(name: string, workingDirectory?: string): Promise<Session>;
  
  /**
   * Get current session
   */
  getCurrentSession(): Session | null;
  
  /**
   * Set current session
   */
  setCurrentSession(sessionId: UUID): Promise<void>;
  
  /**
   * Get a session by ID
   */
  getSession(sessionId: UUID): Session | null;
  
  /**
   * Get all sessions
   */
  getAllSessions(): Session[];
  
  /**
   * Save a session
   */
  saveSession(session: Session): Promise<void>;
  
  /**
   * Load a session
   */
  loadSession(sessionId: UUID): Promise<Session | null>;
  
  /**
   * Delete a session
   */
  deleteSession(sessionId: UUID): Promise<void>;
  
  /**
   * Rename a session
   */
  renameSession(sessionId: UUID, newName: string): Promise<void>;
  
  /**
   * End a session
   */
  endSession(sessionId: UUID): Promise<void>;
  
  /**
   * Export session to file
   */
  exportSession(sessionId: UUID, filePath: string): Promise<void>;
  
  /**
   * Import session from file
   */
  importSession(filePath: string): Promise<Session>;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Interface for plugins
 */
export interface IPlugin extends IDisposable {
  /**
   * Plugin manifest
   */
  readonly manifest: PluginManifest;
  
  /**
   * Plugin state
   */
  readonly isActive: boolean;
  
  /**
   * Activate the plugin
   */
  activate(context: PluginContext): Promise<void>;
  
  /**
   * Deactivate the plugin
   */
  deactivate(): Promise<void>;
  
  /**
   * Register tools with the registry
   */
  registerTools(registry: IToolRegistry): void;
  
  /**
   * Register commands with the registry
   */
  registerCommands(registry: ICommandRegistry): void;
  
  /**
   * Register hooks with the registry
   */
  registerHooks(registry: IHookRegistry): void;
  
  /**
   * Get plugin configuration schema
   */
  getConfigSchema(): z.ZodSchema | null;
  
  /**
   * Update plugin configuration
   */
  updateConfig(config: Record<string, unknown>): void;
}

// ============================================================================
// Plugin Registry Interface
// ============================================================================

/**
 * Interface for plugin registry
 */
export interface IPluginRegistry extends IEventEmitter, IDisposable {
  /**
   * Load a plugin from path
   */
  loadPlugin(path: string): Promise<IPlugin>;
  
  /**
   * Register a plugin
   */
  register(plugin: IPlugin): void;
  
  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): Promise<void>;
  
  /**
   * Get a plugin by name
   */
  get(pluginName: string): IPlugin | undefined;
  
  /**
   * Check if a plugin is registered
   */
  has(pluginName: string): boolean;
  
  /**
   * Get all registered plugins
   */
  getAll(): IPlugin[];
  
  /**
   * Get all active plugins
   */
  getActivePlugins(): IPlugin[];
  
  /**
   * Activate a plugin
   */
  activatePlugin(pluginName: string, context: PluginContext): Promise<void>;
  
  /**
   * Deactivate a plugin
   */
  deactivatePlugin(pluginName: string): Promise<void>;
  
  /**
   * Discover plugins in a directory
   */
  discoverPlugins(directory: string): Promise<string[]>;
}

// ============================================================================
// Hook Registry Interface
// ============================================================================

/**
 * Interface for hook registry
 */
export interface IHookRegistry extends IDisposable {
  /**
   * Register a hook
   */
  register(point: HookPoint, handler: HookHandler, priority?: number): void;
  
  /**
   * Unregister a hook
   */
  unregister(point: HookPoint, handler: HookHandler): void;
  
  /**
   * Execute hooks for a point
   */
  execute<T>(point: HookPoint, data: T): Promise<T>;
  
  /**
   * Get hooks for a point
   */
  getHooks(point: HookPoint): Array<{ handler: HookHandler; priority: number }>;
  
  /**
   * Clear all hooks for a point
   */
  clear(point?: HookPoint): void;
}

/**
 * Hook handler type
 */
export type HookHandler<T = unknown> = (
  data: T,
  context: HookExecutionContext
) => T | Promise<T>;

/**
 * Hook execution context
 */
export interface HookExecutionContext {
  point: HookPoint;
  timestamp: number;
  abort: () => void;
  readonly isAborted: boolean;
}

// ============================================================================
// Skill Interface
// ============================================================================

/**
 * Interface for skills
 */
export interface ISkill extends IDisposable {
  /**
   * Skill definition
   */
  readonly definition: SkillDefinition;
  
  /**
   * Check if this skill can handle a task
   */
  canHandle(task: Task): boolean;
  
  /**
   * Execute the skill
   */
  execute(task: Task, context: SkillContext): Promise<TaskResult>;
  
  /**
   * Get skill prompt
   */
  getPrompt(): string;
  
  /**
   * Get required tools
   */
  getRequiredTools(): string[];
}

/**
 * Skill execution context
 */
export interface SkillContext {
  agentId: UUID;
  sessionId: UUID;
  toolRegistry: IToolRegistry;
  logger: ILogger;
}

// ============================================================================
// Skill Registry Interface
// ============================================================================

/**
 * Interface for skill registry
 */
export interface ISkillRegistry extends IDisposable {
  /**
   * Register a skill
   */
  register(skill: ISkill): void;
  
  /**
   * Unregister a skill
   */
  unregister(skillName: string): void;
  
  /**
   * Get a skill by name
   */
  get(skillName: string): ISkill | undefined;
  
  /**
   * Find skills that can handle a task
   */
  findSkillsForTask(task: Task): ISkill[];
  
  /**
   * Get all registered skills
   */
  getAll(): ISkill[];
}

// ============================================================================
// Query Engine Interface
// ============================================================================

/**
 * Interface for LLM query engine
 */
export interface IQueryEngine extends IEventEmitter, IDisposable {
  /**
   * Initialize the query engine
   */
  initialize(config: ModelConfig): Promise<void>;
  
  /**
   * Send a query and get response
   */
  query(messages: Message[], options?: QueryOptions): Promise<QueryResult>;
  
  /**
   * Send a query with streaming response
   */
  queryStream(
    messages: Message[],
    options?: QueryOptions,
    onChunk?: (chunk: MessageContent) => void
  ): Promise<QueryResult>;
  
  /**
   * Count tokens in messages
   */
  countTokens(messages: Message[]): Promise<number>;
  
  /**
   * Check if engine is ready
   */
  isReady(): boolean;
  
  /**
   * Get model information
   */
  getModelInfo(): ModelInfo;
}

/**
 * Query options
 */
export interface QueryOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
}

/**
 * Query result
 */
export interface QueryResult {
  message: Message;
  usage: TokenUsage;
  finishReason: string;
  duration: number;
}

/**
 * Token usage
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Model information
 */
export interface ModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

// ============================================================================
// MCP Client Interface
// ============================================================================

/**
 * Interface for MCP client
 */
export interface IMCPClient extends IDisposable {
  /**
   * Connect to an MCP server
   */
  connect(config: MCPServerConfig): Promise<void>;
  
  /**
   * Disconnect from server
   */
  disconnect(): Promise<void>;
  
  /**
   * List available resources
   */
  listResources(): Promise<MCPResource[]>;
  
  /**
   * Read a resource
   */
  readResource(uri: string): Promise<unknown>;
  
  /**
   * List available tools
   */
  listTools(): Promise<ToolDefinition[]>;
  
  /**
   * Call a tool
   */
  callTool(name: string, params: unknown): Promise<ToolResult>;
  
  /**
   * Check if connected
   */
  isConnected(): boolean;
  
  /**
   * Get server info
   */
  getServerInfo(): { name: string; version: string } | null;
}

// ============================================================================
// Telemetry Interface
// ============================================================================

/**
 * Interface for telemetry service
 */
export interface ITelemetryService extends IDisposable {
  /**
   * Track an event
   */
  track(event: TelemetryEvent): void;
  
  /**
   * Track a typed event
   */
  trackEvent(type: TelemetryEventType, data: Record<string, unknown>): void;
  
  /**
   * Flush pending events
   */
  flush(): Promise<void>;
  
  /**
   * Enable/disable telemetry
   */
  setEnabled(enabled: boolean): void;
  
  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean;
  
  /**
   * Set sample rate
   */
  setSampleRate(rate: number): void;
}

// ============================================================================
// Permission Manager Interface
// ============================================================================

/**
 * Interface for permission management
 */
export interface IPermissionManager extends IDisposable {
  /**
   * Check if a tool can be executed
   */
  canExecute(toolName: string, params?: unknown): boolean;
  
  /**
   * Request permission for a tool
   */
  requestPermission(
    toolName: string,
    params?: unknown,
    reason?: string
  ): Promise<boolean>;
  
  /**
   * Set permission level for a tool
   */
  setPermission(toolName: string, level: import('@types/index').PermissionLevel): void;
  
  /**
   * Get permission level for a tool
   */
  getPermission(toolName: string): import('@types/index').PermissionLevel;
  
  /**
   * Set default permission level
   */
  setDefaultPermission(level: import('@types/index').PermissionLevel): void;
  
  /**
   * Reset all permissions to defaults
   */
  resetPermissions(): void;
}

// ============================================================================
// Cache Interface
// ============================================================================

/**
 * Interface for caching
 */
export interface ICache<T> extends IDisposable {
  /**
   * Get a value from cache
   */
  get(key: string): T | undefined;
  
  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void;
  
  /**
   * Check if key exists in cache
   */
  has(key: string): boolean;
  
  /**
   * Delete a value from cache
   */
  delete(key: string): boolean;
  
  /**
   * Clear all cached values
   */
  clear(): void;
  
  /**
   * Get cache size
   */
  size(): number;
  
  /**
   * Get cache keys
   */
  keys(): string[];
}

// ============================================================================
// Error Handler Interface
// ============================================================================

/**
 * Interface for error handling
 */
export interface IErrorHandler {
  /**
   * Handle an error
   */
  handle(error: Error, context?: Record<string, unknown>): ErrorDetails;
  
  /**
   * Check if error is recoverable
   */
  isRecoverable(error: Error): boolean;
  
  /**
   * Get recovery suggestion
   */
  getRecoverySuggestion(error: Error): string | null;
  
  /**
   * Register error handler for specific code
   */
  registerHandler(code: ErrorCode, handler: ErrorHandlerFn): void;
}

/**
 * Error handler function type
 */
export type ErrorHandlerFn = (
  error: Error,
  context?: Record<string, unknown>
) => ErrorDetails | Promise<ErrorDetails>;

// ============================================================================
// Feature Flags Interface
// ============================================================================

/**
 * Interface for feature flags
 */
export interface IFeatureFlags extends IDisposable {
  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: string): boolean;
  
  /**
   * Enable a feature
   */
  enable(feature: string): void;
  
  /**
   * Disable a feature
   */
  disable(feature: string): void;
  
  /**
   * Toggle a feature
   */
  toggle(feature: string): boolean;
  
  /**
   * Set feature state
   */
  set(feature: string, enabled: boolean): void;
  
  /**
   * Get all feature states
   */
  getAll(): Record<string, boolean>;
  
  /**
   * Load feature flags from config
   */
  loadFromConfig(config: Record<string, boolean>): void;
  
  /**
   * Watch for feature changes
   */
  onChange(feature: string, handler: (enabled: boolean) => void): void;
}

// ============================================================================
// UI Components Interface
// ============================================================================

/**
 * Interface for UI components
 */
export interface IUIComponent {
  /**
   * Render the component
   */
  render(): ReactNode;
  
  /**
   * Update component props
   */
  updateProps(props: Record<string, unknown>): void;
  
  /**
   * Focus the component
   */
  focus(): void;
  
  /**
   * Blur the component
   */
  blur(): void;
}

// ============================================================================
// File System Interface
// ============================================================================

/**
 * Interface for file system operations
 */
export interface IFileSystem extends IDisposable {
  /**
   * Read a file
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  
  /**
   * Write a file
   */
  writeFile(path: string, content: string, encoding?: BufferEncoding): Promise<void>;
  
  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * Create a directory
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * List directory contents
   */
  readdir(path: string): Promise<string[]>;
  
  /**
   * Get file stats
   */
  stat(path: string): Promise<{
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    mtime: Date;
  }>;
  
  /**
   * Delete a file or directory
   */
  delete(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * Watch a file or directory
   */
  watch(
    path: string,
    handler: (event: 'change' | 'rename', filename: string) => void
  ): Promise<() => void>;
}

// ============================================================================
// Git Interface
// ============================================================================

/**
 * Interface for Git operations
 */
export interface IGitClient extends IDisposable {
  /**
   * Check if directory is a git repository
   */
  isRepo(path: string): Promise<boolean>;
  
  /**
   * Get repository status
   */
  status(path: string): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    modified: string[];
    staged: string[];
    untracked: string[];
  }>;
  
  /**
   * Get commit history
   */
  log(path: string, options?: { maxCount?: number }): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: Date;
  }>>;
  
  /**
   * Stage files
   */
  add(path: string, files: string[]): Promise<void>;
  
  /**
   * Commit changes
   */
  commit(path: string, message: string): Promise<void>;
  
  /**
   * Get diff
   */
  diff(path: string, options?: { staged?: boolean }): Promise<string>;
  
  /**
   * Get current branch
   */
  getBranch(path: string): Promise<string>;
  
  /**
   * List branches
   */
  getBranches(path: string): Promise<string[]>;
}
