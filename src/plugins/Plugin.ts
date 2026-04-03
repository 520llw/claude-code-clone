/**
 * Plugin.ts
 * 
 * Base Plugin Class for Claude Code Clone Plugin System
 * 
 * This file defines the abstract base class that all plugins must extend.
 * It provides the foundation for plugin lifecycle management, configuration,
 * hook registration, and communication with the host application.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Plugin metadata interface defining plugin identification and information
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin (reverse domain notation recommended) */
  id: string;
  /** Human-readable name of the plugin */
  name: string;
  /** Plugin version following semantic versioning */
  version: string;
  /** Brief description of plugin functionality */
  description: string;
  /** Plugin author information */
  author: string | PluginAuthor;
  /** Plugin license (SPDX identifier or custom license text) */
  license?: string;
  /** Plugin homepage URL */
  homepage?: string;
  /** Plugin repository URL */
  repository?: string;
  /** Plugin bug tracker URL */
  bugs?: string;
  /** Keywords for plugin discovery */
  keywords?: string[];
  /** Plugin category for organization */
  category?: PluginCategory;
  /** Minimum required host application version */
  minHostVersion?: string;
  /** Maximum compatible host application version */
  maxHostVersion?: string;
  /** Plugin icon (URL or data URI) */
  icon?: string;
  /** Plugin screenshots for marketplace */
  screenshots?: string[];
  /** Whether plugin is enabled by default */
  enabledByDefault?: boolean;
  /** Whether plugin requires restart after installation */
  requiresRestart?: boolean;
}

/**
 * Plugin author information
 */
export interface PluginAuthor {
  /** Author name */
  name: string;
  /** Author email */
  email?: string;
  /** Author website */
  url?: string;
}

/**
 * Plugin categories for organization and discovery
 */
export enum PluginCategory {
  INTEGRATION = 'integration',
  PRODUCTIVITY = 'productivity',
  DEVELOPMENT = 'development',
  THEME = 'theme',
  UTILITY = 'utility',
  ANALYTICS = 'analytics',
  SECURITY = 'security',
  CUSTOM = 'custom'
}

/**
 * Plugin configuration schema entry
 */
export interface ConfigSchemaEntry {
  /** Configuration key */
  key: string;
  /** Configuration type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  /** Human-readable label */
  label: string;
  /** Configuration description */
  description?: string;
  /** Default value */
  default?: any;
  /** Whether configuration is required */
  required?: boolean;
  /** For enum type: allowed values */
  enumValues?: string[];
  /** For number type: minimum value */
  min?: number;
  /** For number type: maximum value */
  max?: number;
  /** For string type: validation pattern */
  pattern?: string;
  /** For array type: item schema */
  items?: ConfigSchemaEntry;
  /** For object type: property schemas */
  properties?: ConfigSchemaEntry[];
  /** Whether to encrypt this configuration value */
  sensitive?: boolean;
  /** Configuration category for grouping */
  category?: string;
  /** Order for display */
  order?: number;
}

/**
 * Plugin configuration object
 */
export interface PluginConfig {
  [key: string]: any;
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  /** Plugin ID that this plugin depends on */
  id: string;
  /** Required version range (semver) */
  version: string;
  /** Whether this dependency is optional */
  optional?: boolean;
  /** Reason for dependency */
  reason?: string;
}

/**
 * Plugin capabilities that can be declared
 */
export interface PluginCapabilities {
  /** Plugin provides hooks */
  providesHooks?: string[];
  /** Plugin provides commands */
  providesCommands?: string[];
  /** Plugin provides themes */
  providesThemes?: string[];
  /** Plugin provides file handlers */
  providesFileHandlers?: string[];
  /** Plugin provides language support */
  providesLanguages?: string[];
  /** Plugin requires network access */
  requiresNetwork?: boolean;
  /** Plugin requires file system access */
  requiresFileSystem?: boolean;
  /** Plugin requires shell access */
  requiresShell?: boolean;
  /** Plugin requires LLM access */
  requiresLLM?: boolean;
}

/**
 * Plugin context provided by the host application
 */
export interface PluginContext {
  /** Plugin instance ID */
  instanceId: string;
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin configuration */
  config: PluginConfig;
  /** Host application version */
  hostVersion: string;
  /** Host application API */
  api: any;
  /** Logger instance */
  logger: PluginLogger;
  /** Storage interface */
  storage: PluginStorage;
  /** UI interface */
  ui: PluginUI;
  /** Network interface (if permitted) */
  network?: PluginNetwork;
  /** File system interface (if permitted) */
  filesystem?: PluginFileSystem;
  /** Shell interface (if permitted) */
  shell?: PluginShell;
  /** LLM interface (if permitted) */
  llm?: PluginLLM;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  trace(message: string, ...args: any[]): void;
}

/**
 * Plugin storage interface
 */
export interface PluginStorage {
  /** Get value from storage */
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  /** Set value in storage */
  set<T>(key: string, value: T): Promise<void>;
  /** Delete value from storage */
  delete(key: string): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Get all keys */
  keys(): Promise<string[]>;
  /** Clear all storage */
  clear(): Promise<void>;
}

/**
 * Plugin UI interface
 */
export interface PluginUI {
  /** Show notification */
  showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  /** Show modal dialog */
  showModal(title: string, content: string, options?: ModalOptions): Promise<ModalResult>;
  /** Show input prompt */
  showInput(title: string, placeholder?: string, defaultValue?: string): Promise<string | null>;
  /** Show confirmation dialog */
  showConfirm(title: string, message: string): Promise<boolean>;
  /** Show progress indicator */
  showProgress(title: string, message?: string): ProgressHandle;
  /** Register status bar item */
  registerStatusBarItem(id: string, options: StatusBarItemOptions): void;
  /** Update status bar item */
  updateStatusBarItem(id: string, options: Partial<StatusBarItemOptions>): void;
  /** Remove status bar item */
  removeStatusBarItem(id: string): void;
  /** Register webview panel */
  registerWebviewPanel(id: string, options: WebviewPanelOptions): void;
}

/**
 * Modal dialog options
 */
export interface ModalOptions {
  buttons?: Array<{ id: string; label: string; primary?: boolean }>;
  cancelable?: boolean;
  width?: number;
  height?: number;
}

/**
 * Modal dialog result
 */
export interface ModalResult {
  buttonId: string;
  cancelled: boolean;
}

/**
 * Progress handle
 */
export interface ProgressHandle {
  update(progress: number, message?: string): void;
  complete(message?: string): void;
  error(message: string): void;
  dispose(): void;
}

/**
 * Status bar item options
 */
export interface StatusBarItemOptions {
  text: string;
  tooltip?: string;
  command?: string;
  priority?: number;
  alignment?: 'left' | 'right';
  color?: string;
  icon?: string;
}

/**
 * Webview panel options
 */
export interface WebviewPanelOptions {
  title: string;
  content: string;
  iconPath?: string;
  retainContextWhenHidden?: boolean;
  enableScripts?: boolean;
  enableCommandUris?: boolean;
  localResourceRoots?: string[];
}

/**
 * Plugin network interface
 */
export interface PluginNetwork {
  /** Make HTTP request */
  request(options: NetworkRequestOptions): Promise<NetworkResponse>;
  /** Fetch URL */
  fetch(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse>;
  /** Open WebSocket connection */
  websocket(url: string, options?: WebSocketOptions): Promise<WebSocketConnection>;
  /** Get allowed domains */
  getAllowedDomains(): string[];
}

/**
 * Network request options
 */
export interface NetworkRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateStatus?: (status: number) => boolean;
}

/**
 * Network response
 */
export interface NetworkResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: Buffer | string;
  url: string;
}

/**
 * WebSocket options
 */
export interface WebSocketOptions {
  protocols?: string[];
  headers?: Record<string, string>;
  perMessageDeflate?: boolean;
}

/**
 * WebSocket connection
 */
export interface WebSocketConnection {
  send(data: string | Buffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
  onMessage(callback: (data: string | Buffer) => void): void;
  onClose(callback: (code: number, reason: string) => void): void;
  onError(callback: (error: Error) => void): void;
  readyState: number;
}

/**
 * Plugin file system interface
 */
export interface PluginFileSystem {
  /** Read file */
  readFile(path: string, encoding?: BufferEncoding): Promise<Buffer | string>;
  /** Write file */
  writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  /** Check if file exists */
  exists(path: string): Promise<boolean>;
  /** Get file stats */
  stat(path: string): Promise<FileStats>;
  /** Create directory */
  mkdir(path: string, recursive?: boolean): Promise<void>;
  /** Read directory */
  readdir(path: string): Promise<string[]>;
  /** Delete file or directory */
  delete(path: string, recursive?: boolean): Promise<void>;
  /** Rename file or directory */
  rename(oldPath: string, newPath: string): Promise<void>;
  /** Copy file or directory */
  copy(src: string, dest: string, options?: CopyOptions): Promise<void>;
  /** Watch file or directory */
  watch(path: string, options?: WatchOptions): FileWatcher;
  /** Get allowed paths */
  getAllowedPaths(): string[];
}

/**
 * File stats
 */
export interface FileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  size: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}

/**
 * Copy options
 */
export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
  filter?: (src: string, dest: string) => boolean;
}

/**
 * Watch options
 */
export interface WatchOptions {
  recursive?: boolean;
  persistent?: boolean;
  encoding?: BufferEncoding;
}

/**
 * File watcher
 */
export interface FileWatcher {
  onChange(callback: (event: 'change' | 'rename', filename: string) => void): void;
  onError(callback: (error: Error) => void): void;
  close(): void;
}

/**
 * Plugin shell interface
 */
export interface PluginShell {
  /** Execute command */
  execute(command: string, options?: ShellExecuteOptions): Promise<ShellExecuteResult>;
  /** Execute command with streaming output */
  executeStream(command: string, options?: ShellExecuteOptions): ShellStream;
  /** Spawn process */
  spawn(command: string, args?: string[], options?: ShellSpawnOptions): ShellProcess;
  /** Get allowed commands */
  getAllowedCommands(): string[];
  /** Get allowed paths */
  getAllowedPaths(): string[];
}

/**
 * Shell execute options
 */
export interface ShellExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxBuffer?: number;
  encoding?: BufferEncoding;
  shell?: string;
  windowsHide?: boolean;
}

/**
 * Shell execute result
 */
export interface ShellExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
}

/**
 * Shell stream
 */
export interface ShellStream {
  onStdout(callback: (data: string) => void): void;
  onStderr(callback: (data: string) => void): void;
  onExit(callback: (code: number, signal?: string) => void): void;
  onError(callback: (error: Error) => void): void;
  kill(signal?: string): boolean;
}

/**
 * Shell spawn options
 */
export interface ShellSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  detached?: boolean;
  windowsHide?: boolean;
  windowsVerbatimArguments?: boolean;
  stdio?: 'pipe' | 'ignore' | 'inherit' | Array<'pipe' | 'ignore' | 'inherit'>;
}

/**
 * Shell process
 */
export interface ShellProcess {
  pid: number;
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: string): boolean;
  onExit(callback: (code: number, signal?: string) => void): void;
  onError(callback: (error: Error) => void): void;
}

/**
 * Plugin LLM interface
 */
export interface PluginLLM {
  /** Complete prompt */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  /** Stream completion */
  streamComplete(prompt: string, options?: LLMCompletionOptions): LLMStream;
  /** Get available models */
  getAvailableModels(): Promise<string[]>;
  /** Get model info */
  getModelInfo(model: string): Promise<LLMModelInfo>;
  /** Count tokens */
  countTokens(text: string, model?: string): Promise<number>;
}

/**
 * LLM completion options
 */
export interface LLMCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  systemPrompt?: string;
  tools?: LLMTool[];
}

/**
 * LLM completion result
 */
export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: LLMTokenUsage;
  finishReason: string;
  toolCalls?: LLMToolCall[];
}

/**
 * LLM token usage
 */
export interface LLMTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * LLM tool
 */
export interface LLMTool {
  name: string;
  description: string;
  parameters: object;
}

/**
 * LLM tool call
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: object;
}

/**
 * LLM stream
 */
export interface LLMStream {
  onToken(callback: (token: string) => void): void;
  onComplete(callback: (result: LLMCompletionResult) => void): void;
  onError(callback: (error: Error) => void): void;
  abort(): void;
}

/**
 * LLM model info
 */
export interface LLMModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  contextWindow: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities: string[];
}

/**
 * Plugin state
 */
export enum PluginState {
  UNREGISTERED = 'unregistered',
  REGISTERED = 'registered',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  UNLOADING = 'unloading',
  UNLOADED = 'unloaded',
  ERROR = 'error'
}

/**
 * Plugin lifecycle event
 */
export interface PluginLifecycleEvent {
  state: PluginState;
  previousState: PluginState;
  timestamp: Date;
  error?: Error;
}

// ============================================================================
// Abstract Plugin Class
// ============================================================================

/**
 * Abstract base class for all plugins.
 * 
 * All plugins must extend this class and implement the required methods.
 * The plugin lifecycle is managed by the PluginManager:
 * 
 * 1. Construction - Plugin instance is created
 * 2. Registration - Plugin is registered with the system
 * 3. Loading - Plugin resources are loaded
 * 4. Activation - Plugin is activated and hooks are registered
 * 5. Runtime - Plugin is active and processing events
 * 6. Deactivation - Plugin is being deactivated
 * 7. Unloading - Plugin resources are cleaned up
 * 
 * @abstract
 * @example
 * ```typescript
 * class MyPlugin extends Plugin {
 *   metadata = {
 *     id: 'com.example.myplugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'An example plugin',
 *     author: 'John Doe'
 *   };
 * 
 *   async onActivate(): Promise<void> {
 *     this.logger.info('MyPlugin activated!');
 *     this.registerHook('onMessage', this.handleMessage.bind(this));
 *   }
 * 
 *   private async handleMessage(message: Message): Promise<void> {
 *     // Handle message
 *   }
 * }
 * ```
 */
export abstract class Plugin extends EventEmitter {
  /**
   * Plugin metadata - must be defined by subclasses
   */
  public abstract readonly metadata: PluginMetadata;

  /**
   * Plugin configuration schema - optional
   */
  public readonly configSchema?: ConfigSchemaEntry[];

  /**
   * Plugin dependencies - optional
   */
  public readonly dependencies?: PluginDependency[];

  /**
   * Plugin capabilities - optional
   */
  public readonly capabilities?: PluginCapabilities;

  /**
   * Plugin instance ID (assigned by PluginManager)
   */
  public instanceId: string = '';

  /**
   * Current plugin state
   */
  public state: PluginState = PluginState.UNREGISTERED;

  /**
   * Plugin context (set by PluginManager)
   */
  protected context!: PluginContext;

  /**
   * Plugin logger (available after context is set)
   */
  protected logger!: PluginLogger;

  /**
   * Plugin storage (available after context is set)
   */
  protected storage!: PluginStorage;

  /**
   * Plugin UI interface (available after context is set)
   */
  protected ui!: PluginUI;

  /**
   * Registered hooks
   */
  private registeredHooks: Map<string, Set<Function>> = new Map();

  /**
   * Registered commands
   */
  private registeredCommands: Map<string, Function> = new Map();

  /**
   * Registered event handlers
   */
  private registeredEventHandlers: Map<string, Function[]> = new Map();

  /**
   * Disposable resources
   */
  private disposables: Array<() => void> = [];

  /**
   * Plugin start time
   */
  private startTime?: Date;

  /**
   * Plugin activation duration in milliseconds
   */
  private activationDuration?: number;

  /**
   * Creates a new Plugin instance.
   * Subclasses should not override this constructor.
   */
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Sets the plugin context.
   * This is called by the PluginManager and should not be called directly.
   * 
   * @param context - The plugin context
   * @internal
   */
  public setContext(context: PluginContext): void {
    this.context = context;
    this.instanceId = context.instanceId;
    this.logger = context.logger;
    this.storage = context.storage;
    this.ui = context.ui;
  }

  /**
   * Gets the plugin context.
   * 
   * @returns The plugin context
   */
  public getContext(): PluginContext {
    return this.context;
  }

  /**
   * Called when the plugin is being activated.
   * Subclasses must implement this method to perform initialization.
   * 
   * This is where you should:
   * - Register hooks
   * - Register commands
   * - Set up event listeners
   * - Initialize resources
   * 
   * @returns A promise that resolves when activation is complete
   * @throws Error if activation fails
   * @abstract
   */
  public abstract onActivate(): Promise<void>;

  /**
   * Called when the plugin is being deactivated.
   * Subclasses should override this method to perform cleanup.
   * 
   * This is where you should:
   * - Unregister hooks
   * - Unregister commands
   * - Remove event listeners
   * - Clean up resources
   * - Save state
   * 
   * @returns A promise that resolves when deactivation is complete
   */
  public async onDeactivate(): Promise<void> {
    // Default implementation - subclasses can override
    this.logger.debug(`${this.metadata.id} default onDeactivate called`);
  }

  /**
   * Called when the plugin configuration changes.
   * Subclasses can override this to react to configuration updates.
   * 
   * @param newConfig - The new configuration
   * @param oldConfig - The previous configuration
   * @returns A promise that resolves when the configuration has been applied
   */
  public async onConfigChange(newConfig: PluginConfig, oldConfig: PluginConfig): Promise<void> {
    // Default implementation - subclasses can override
    this.logger.debug(`${this.metadata.id} configuration changed`, { newConfig, oldConfig });
  }

  /**
   * Called when a dependency plugin is activated.
   * Subclasses can override this to react to dependency changes.
   * 
   * @param dependencyId - The ID of the dependency plugin
   */
  public onDependencyActivated(dependencyId: string): void {
    // Default implementation - subclasses can override
    this.logger.debug(`${this.metadata.id} dependency activated: ${dependencyId}`);
  }

  /**
   * Called when a dependency plugin is deactivated.
   * Subclasses can override this to react to dependency changes.
   * 
   * @param dependencyId - The ID of the dependency plugin
   */
  public onDependencyDeactivated(dependencyId: string): void {
    // Default implementation - subclasses can override
    this.logger.debug(`${this.metadata.id} dependency deactivated: ${dependencyId}`);
  }

  /**
   * Registers a hook handler.
   * 
   * @param hookName - The name of the hook to register
   * @param handler - The handler function
   * @param priority - Priority (higher = earlier execution, default: 0)
   * @returns A function to unregister the hook
   * 
   * @example
   * ```typescript
   * const unregister = this.registerHook('onMessage', async (message) => {
   *   // Handle message
   * });
   * 
   * // Later, to unregister:
   * unregister();
   * ```
   */
  protected registerHook(hookName: string, handler: Function, priority: number = 0): () => void {
    if (!this.registeredHooks.has(hookName)) {
      this.registeredHooks.set(hookName, new Set());
    }

    const hookInfo = { handler, priority, pluginId: this.metadata.id };
    this.registeredHooks.get(hookName)!.add(hookInfo);

    // Emit event for hook registration
    this.emit('hookRegistered', { hookName, handler, priority });

    // Return unregister function
    const unregister = () => {
      this.registeredHooks.get(hookName)?.delete(hookInfo);
      this.emit('hookUnregistered', { hookName, handler });
    };

    // Track for cleanup
    this.disposables.push(unregister);

    return unregister;
  }

  /**
   * Registers a command handler.
   * 
   * @param command - The command name
   * @param handler - The command handler
   * @returns A function to unregister the command
   */
  protected registerCommand(command: string, handler: Function): () => void {
    this.registeredCommands.set(command, handler);
    this.emit('commandRegistered', { command, handler });

    const unregister = () => {
      this.registeredCommands.delete(command);
      this.emit('commandUnregistered', { command });
    };

    this.disposables.push(unregister);
    return unregister;
  }

  /**
   * Registers an event handler.
   * 
   * @param event - The event name
   * @param handler - The event handler
   * @returns A function to unregister the handler
   */
  protected registerEventHandler(event: string, handler: Function): () => void {
    if (!this.registeredEventHandlers.has(event)) {
      this.registeredEventHandlers.set(event, []);
    }

    this.registeredEventHandlers.get(event)!.push(handler);
    this.on(event, handler as any);

    const unregister = () => {
      const handlers = this.registeredEventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      this.off(event, handler as any);
    };

    this.disposables.push(unregister);
    return unregister;
  }

  /**
   * Adds a disposable resource to be cleaned up on deactivation.
   * 
   * @param disposable - A function that disposes the resource
   */
  protected addDisposable(disposable: () => void): void {
    this.disposables.push(disposable);
  }

  /**
   * Gets all registered hooks.
   * 
   * @returns Map of hook names to handlers
   * @internal
   */
  public getRegisteredHooks(): Map<string, Set<Function>> {
    return this.registeredHooks;
  }

  /**
   * Gets all registered commands.
   * 
   * @returns Map of command names to handlers
   * @internal
   */
  public getRegisteredCommands(): Map<string, Function> {
    return this.registeredCommands;
  }

  /**
   * Updates the plugin state.
   * 
   * @param newState - The new state
   * @internal
   */
  public setState(newState: PluginState): void {
    const previousState = this.state;
    this.state = newState;

    const event: PluginLifecycleEvent = {
      state: newState,
      previousState,
      timestamp: new Date()
    };

    this.emit('stateChange', event);

    // Track activation duration
    if (newState === PluginState.ACTIVE) {
      this.startTime = new Date();
      if (this.activationDuration === undefined) {
        this.activationDuration = Date.now() - (this.startTime?.getTime() || Date.now());
      }
    }
  }

  /**
   * Gets the plugin state.
   * 
   * @returns The current state
   */
  public getState(): PluginState {
    return this.state;
  }

  /**
   * Gets the plugin uptime in milliseconds.
   * 
   * @returns Uptime in milliseconds, or 0 if not active
   */
  public getUptime(): number {
    if (this.state === PluginState.ACTIVE && this.startTime) {
      return Date.now() - this.startTime.getTime();
    }
    return 0;
  }

  /**
   * Gets the plugin activation duration.
   * 
   * @returns Activation duration in milliseconds, or undefined if not activated
   */
  public getActivationDuration(): number | undefined {
    return this.activationDuration;
  }

  /**
   * Cleans up all registered resources.
   * This is called automatically during deactivation.
   * 
   * @internal
   */
  public async cleanup(): Promise<void> {
    this.logger.debug(`${this.metadata.id} cleaning up resources`);

    // Run all disposables
    for (const disposable of this.disposables) {
      try {
        disposable();
      } catch (error) {
        this.logger.error(`Error during cleanup: ${error}`);
      }
    }

    // Clear collections
    this.registeredHooks.clear();
    this.registeredCommands.clear();
    this.registeredEventHandlers.clear();
    this.disposables = [];

    // Remove all event listeners
    this.removeAllListeners();

    this.logger.debug(`${this.metadata.id} cleanup complete`);
  }

  /**
   * Validates the plugin configuration against the schema.
   * 
   * @param config - The configuration to validate
   * @returns Validation result
   */
  public validateConfig(config: PluginConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.configSchema) {
      return { valid: true, errors };
    }

    for (const entry of this.configSchema) {
      const value = config[entry.key];

      // Check required
      if (entry.required && (value === undefined || value === null)) {
        errors.push(`Missing required configuration: ${entry.key}`);
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (entry.type !== actualType) {
        errors.push(`Invalid type for ${entry.key}: expected ${entry.type}, got ${actualType}`);
        continue;
      }

      // Validate number range
      if (entry.type === 'number') {
        if (entry.min !== undefined && value < entry.min) {
          errors.push(`${entry.key} must be at least ${entry.min}`);
        }
        if (entry.max !== undefined && value > entry.max) {
          errors.push(`${entry.key} must be at most ${entry.max}`);
        }
      }

      // Validate string pattern
      if (entry.type === 'string' && entry.pattern) {
        const regex = new RegExp(entry.pattern);
        if (!regex.test(value)) {
          errors.push(`${entry.key} does not match required pattern`);
        }
      }

      // Validate enum
      if (entry.type === 'enum' && entry.enumValues) {
        if (!entry.enumValues.includes(value)) {
          errors.push(`${entry.key} must be one of: ${entry.enumValues.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Gets the default configuration.
   * 
   * @returns Default configuration object
   */
  public getDefaultConfig(): PluginConfig {
    const defaults: PluginConfig = {};

    if (this.configSchema) {
      for (const entry of this.configSchema) {
        if (entry.default !== undefined) {
          defaults[entry.key] = entry.default;
        }
      }
    }

    return defaults;
  }

  /**
   * Checks if the plugin has a specific capability.
   * 
   * @param capability - The capability to check
   * @returns True if the plugin has the capability
   */
  public hasCapability(capability: keyof PluginCapabilities): boolean {
    return !!this.capabilities?.[capability];
  }

  /**
   * Gets the plugin's dependencies.
   * 
   * @returns Array of dependencies
   */
  public getDependencies(): PluginDependency[] {
    return this.dependencies || [];
  }

  /**
   * Checks if the plugin has optional dependencies.
   * 
   * @returns True if the plugin has optional dependencies
   */
  public hasOptionalDependencies(): boolean {
    return this.dependencies?.some(dep => dep.optional) || false;
  }

  /**
   * Gets required (non-optional) dependencies.
   * 
   * @returns Array of required dependencies
   */
  public getRequiredDependencies(): PluginDependency[] {
    return this.dependencies?.filter(dep => !dep.optional) || [];
  }

  /**
   * Emits a plugin event.
   * 
   * @param event - The event name
   * @param data - The event data
   * @returns True if the event had listeners
   */
  public emitPluginEvent(event: string, data?: any): boolean {
    return this.emit(event, data);
  }

  /**
   * Gets plugin statistics.
   * 
   * @returns Plugin statistics
   */
  public getStats(): PluginStats {
    return {
      id: this.metadata.id,
      instanceId: this.instanceId,
      state: this.state,
      uptime: this.getUptime(),
      activationDuration: this.getActivationDuration(),
      registeredHooks: this.registeredHooks.size,
      registeredCommands: this.registeredCommands.size,
      registeredEventHandlers: Array.from(this.registeredEventHandlers.values())
        .reduce((sum, handlers) => sum + handlers.length, 0)
    };
  }
}

/**
 * Plugin statistics interface
 */
export interface PluginStats {
  id: string;
  instanceId: string;
  state: PluginState;
  uptime: number;
  activationDuration: number | undefined;
  registeredHooks: number;
  registeredCommands: number;
  registeredEventHandlers: number;
}

/**
 * Plugin constructor type
 */
export type PluginConstructor = new () => Plugin;

/**
 * Checks if a value is a valid Plugin class.
 * 
 * @param value - The value to check
 * @returns True if the value is a Plugin constructor
 */
export function isPluginConstructor(value: any): value is PluginConstructor {
  return typeof value === 'function' && value.prototype instanceof Plugin;
}

export default Plugin;
