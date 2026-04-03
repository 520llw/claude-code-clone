/**
 * Base Classes
 * 
 * This module provides abstract base classes that implement the core interfaces,
 * providing common functionality and reducing boilerplate in concrete implementations.
 */

import { v4 as uuidv4 } from 'uuid';
import type { z } from 'zod';
import {
  EventEmitter,
  EventPriority,
  type EventOptions,
} from '@core/events';
import type {
  IAgent,
  ITool,
  IPlugin,
  ICommand,
  ISkill,
  ILogger,
  IContextManager,
  IEventEmitter,
  IDisposable,
  EventHandler,
} from '@core/interfaces';
import type {
  AgentConfig,
  AgentInfo,
  AgentState,
  AgentType,
  AgentCapability,
  AgentEvent,
  Task,
  TaskResult,
  Message,
  ToolDefinition,
  ToolContext,
  ToolResult,
  CommandDefinition,
  CommandContext,
  CommandResult,
  PluginManifest,
  PluginContext,
  SkillDefinition,
  SkillContext,
  ConversationContext,
  CompressedContext,
  CompressionStrategy,
  UUID,
  ValidationResult,
} from '@types/index';
import {
  AgentError,
  ToolError,
  PluginError,
  ValidationError,
} from '@core/errors';

// ============================================================================
// Disposable Base Class
// ============================================================================

/**
 * Abstract base class for disposable resources
 */
export abstract class DisposableBase implements IDisposable {
  private disposed = false;

  /**
   * Check if the resource has been disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.onDispose();
    this.disposed = true;
  }

  /**
   * Override this method to implement custom disposal logic
   */
  protected abstract onDispose(): void;

  /**
   * Ensure the resource has not been disposed
   */
  protected ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error(`${this.constructor.name} has been disposed`);
    }
  }
}

// ============================================================================
// Event Emitter Base Class
// ============================================================================

/**
 * Abstract base class for event emitters
 */
export abstract class EventEmitterBase extends DisposableBase implements IEventEmitter {
  private emitter = new EventEmitter();

  on<T>(event: string, handler: EventHandler<T>, options?: EventOptions): void {
    this.ensureNotDisposed();
    this.emitter.on(event, handler, options);
  }

  once<T>(event: string, handler: EventHandler<T>, priority?: EventPriority): void {
    this.ensureNotDisposed();
    this.emitter.once(event, handler, priority);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.ensureNotDisposed();
    this.emitter.off(event, handler);
  }

  emit<T>(event: string, data: T): void {
    this.ensureNotDisposed();
    this.emitter.emit(event, data);
  }

  removeAllListeners(event?: string): void {
    this.ensureNotDisposed();
    this.emitter.removeAllListeners(event);
  }

  protected override onDispose(): void {
    this.emitter.dispose();
  }

  /**
   * Emit an event asynchronously
   */
  protected emitAsync<T>(event: string, data: T): Promise<void> {
    return this.emitter.emitAsync(event, data);
  }

  /**
   * Emit an event and wait for all handlers
   */
  protected emitAndWait<T, R = unknown>(event: string, data: T): Promise<R[]> {
    return this.emitter.emitAndWait(event, data);
  }
}

// ============================================================================
// Agent Base Class
// ============================================================================

/**
 * Abstract base class for agents
 */
export abstract class BaseAgent extends EventEmitterBase implements IAgent {
  readonly id: UUID;
  readonly type: AgentType;
  
  private _name = '';
  private _state: AgentState = 'idle';
  private _capabilities: AgentCapability[] = [];
  private _parentId?: UUID;
  private _config?: AgentConfig;
  private logger?: ILogger;

  constructor(type: AgentType, id?: UUID) {
    super();
    this.id = id ?? uuidv4();
    this.type = type;
  }

  // Getters
  get name(): string {
    return this._name;
  }

  get state(): AgentState {
    return this._state;
  }

  get capabilities(): AgentCapability[] {
    return [...this._capabilities];
  }

  get parentId(): UUID | undefined {
    return this._parentId;
  }

  /**
   * Set the agent state
   */
  protected setState(state: AgentState): void {
    const oldState = this._state;
    this._state = state;
    this.emit('state:changed', { oldState, newState: state });
  }

  /**
   * Initialize the agent
   */
  async initialize(config: AgentConfig): Promise<void> {
    this.ensureNotDisposed();
    
    try {
      this.setState('initializing');
      this._config = config;
      this._name = config.name;
      this._capabilities = [...config.capabilities];
      this._parentId = config.parentId;

      await this.onInitialize(config);

      this.setState('ready');
      this.emit('initialized', { agentId: this.id });
      this.logger?.info(`Agent ${this.name} initialized`);
    } catch (error) {
      this.setState('error');
      throw new AgentError(
        `Failed to initialize agent: ${error instanceof Error ? error.message : String(error)}`,
        'AGENT_INITIALIZATION_ERROR',
        { agentId: this.id, cause: error as Error }
      );
    }
  }

  /**
   * Execute a task
   */
  async execute(task: Task): Promise<TaskResult> {
    this.ensureNotDisposed();
    
    if (this._state !== 'ready') {
      throw new AgentError(
        `Agent is not ready (current state: ${this._state})`,
        'AGENT_EXECUTION_ERROR',
        { agentId: this.id }
      );
    }

    try {
      this.setState('executing');
      this.emit('task:started', { agentId: this.id, taskId: task.id });

      const startTime = Date.now();
      const result = await this.onExecute(task);
      const executionTime = Date.now() - startTime;

      this.setState('ready');
      this.emit('task:completed', { agentId: this.id, taskId: task.id, result });
      
      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      this.setState('error');
      this.emit('task:failed', { agentId: this.id, taskId: task.id, error });
      
      throw new AgentError(
        `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'AGENT_EXECUTION_ERROR',
        { agentId: this.id, taskId: task.id, cause: error as Error }
      );
    }
  }

  /**
   * Delegate a task to another agent
   */
  async delegate(task: Task, toAgent: IAgent): Promise<TaskResult> {
    this.ensureNotDisposed();
    this.emit('delegated', { fromAgentId: this.id, toAgentId: toAgent.id, taskId: task.id });
    return toAgent.execute(task);
  }

  /**
   * Send a message to the agent
   */
  async sendMessage(message: Message): Promise<void> {
    this.ensureNotDisposed();
    await this.onSendMessage(message);
    this.emit('message:received', { agentId: this.id, message });
  }

  /**
   * Receive a message from the agent
   */
  async receiveMessage(): Promise<Message | null> {
    this.ensureNotDisposed();
    const message = await this.onReceiveMessage();
    if (message) {
      this.emit('message:sent', { agentId: this.id, message });
    }
    return message;
  }

  /**
   * Get agent information
   */
  getInfo(): AgentInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      capabilities: this._capabilities,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      taskCount: 0,
      metadata: {},
    };
  }

  /**
   * Pause the agent
   */
  async pause(): Promise<void> {
    this.ensureNotDisposed();
    if (this._state === 'executing') {
      this.setState('waiting');
      await this.onPause();
      this.emit('paused', { agentId: this.id });
    }
  }

  /**
   * Resume the agent
   */
  async resume(): Promise<void> {
    this.ensureNotDisposed();
    if (this._state === 'waiting') {
      await this.onResume();
      this.setState('ready');
      this.emit('resumed', { agentId: this.id });
    }
  }

  /**
   * Terminate the agent
   */
  async terminate(reason?: string): Promise<void> {
    this.ensureNotDisposed();
    
    this.setState('terminated');
    await this.onTerminate(reason);
    this.emit('terminated', { agentId: this.id, reason });
    this.logger?.info(`Agent ${this.name} terminated: ${reason ?? 'no reason'}`);
    
    this.dispose();
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(config: AgentConfig): Promise<void>;
  protected abstract onExecute(task: Task): Promise<Omit<TaskResult, 'executionTime'>>;
  protected abstract onSendMessage(message: Message): Promise<void>;
  protected abstract onReceiveMessage(): Promise<Message | null>;
  protected abstract onPause(): Promise<void>;
  protected abstract onResume(): Promise<void>;
  protected abstract onTerminate(reason?: string): Promise<void>;

  protected override onDispose(): void {
    super.onDispose();
  }
}

// ============================================================================
// Tool Base Class
// ============================================================================

/**
 * Abstract base class for tools
 */
export abstract class BaseTool extends DisposableBase implements ITool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly definition: ToolDefinition;
  abstract readonly parameters: z.ZodSchema;

  private logger?: ILogger;

  /**
   * Execute the tool
   */
  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    this.ensureNotDisposed();

    // Validate parameters
    const validation = this.validate(params);
    if (!validation.success) {
      return {
        success: false,
        output: 'Validation failed',
        error: validation.errors.message,
      };
    }

    try {
      this.logger?.debug(`Executing tool: ${this.name}`, { params });
      const result = await this.onExecute(validation.data, context);
      this.logger?.debug(`Tool executed successfully: ${this.name}`);
      return result;
    } catch (error) {
      this.logger?.error(`Tool execution failed: ${this.name}`, error as Error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate parameters
   */
  validate(params: unknown): ValidationResult<unknown> {
    const result = this.parameters.safeParse(params);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, errors: result.error };
    }
  }

  /**
   * Get usage examples
   */
  getExamples(): Array<{
    description: string;
    parameters: Record<string, unknown>;
    expectedOutput: string;
  }> {
    return this.definition.examples ?? [];
  }

  /**
   * Check if tool requires confirmation
   */
  requiresConfirmation(params: unknown): boolean {
    return this.definition.requiresConfirmation ?? false;
  }

  // Abstract method to be implemented by subclasses
  protected abstract onExecute(
    params: unknown,
    context: ToolContext
  ): Promise<ToolResult>;

  protected override onDispose(): void {
    // Override in subclass if needed
  }
}

// ============================================================================
// Command Base Class
// ============================================================================

/**
 * Abstract base class for commands
 */
export abstract class BaseCommand extends DisposableBase implements ICommand {
  abstract readonly definition: CommandDefinition;

  private logger?: ILogger;

  /**
   * Execute the command
   */
  async execute(
    args: Record<string, unknown>,
    context: CommandContext
  ): Promise<CommandResult> {
    this.ensureNotDisposed();

    // Validate arguments
    const validation = this.validateArgs(args);
    if (!validation.success) {
      return {
        success: false,
        output: 'Validation failed',
        error: validation.errors.message,
      };
    }

    try {
      this.logger?.debug(`Executing command: ${this.definition.name}`, { args });
      const result = await this.onExecute(args, context);
      this.logger?.debug(`Command executed successfully: ${this.definition.name}`);
      return result;
    } catch (error) {
      this.logger?.error(`Command execution failed: ${this.definition.name}`, error as Error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    const def = this.definition;
    let help = `/${def.name} - ${def.description}\n\n`;

    if (def.aliases.length > 0) {
      help += `Aliases: ${def.aliases.join(', ')}\n\n`;
    }

    if (def.arguments.length > 0) {
      help += 'Arguments:\n';
      for (const arg of def.arguments) {
        const required = arg.required ? '(required)' : '(optional)';
        help += `  ${arg.name} ${required} - ${arg.description}\n`;
      }
      help += '\n';
    }

    if (def.options.length > 0) {
      help += 'Options:\n';
      for (const opt of def.options) {
        const alias = opt.alias ? `-${opt.alias}, ` : '';
        help += `  ${alias}--${opt.name} - ${opt.description}\n`;
      }
    }

    return help;
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: Record<string, unknown>): ValidationResult<unknown> {
    // Check required arguments
    for (const arg of this.definition.arguments) {
      if (arg.required && !(arg.name in args)) {
        return {
          success: false,
          errors: new z.ZodError([
            {
              code: 'custom',
              message: `Missing required argument: ${arg.name}`,
              path: [arg.name],
            },
          ]),
        };
      }
    }

    return { success: true, data: args };
  }

  // Abstract method to be implemented by subclasses
  protected abstract onExecute(
    args: Record<string, unknown>,
    context: CommandContext
  ): Promise<CommandResult>;

  protected override onDispose(): void {
    // Override in subclass if needed
  }
}

// ============================================================================
// Plugin Base Class
// ============================================================================

/**
 * Abstract base class for plugins
 */
export abstract class BasePlugin extends DisposableBase implements IPlugin {
  abstract readonly manifest: PluginManifest;

  private _isActive = false;
  private context?: PluginContext;
  private logger?: ILogger;

  /**
   * Check if the plugin is active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Activate the plugin
   */
  async activate(context: PluginContext): Promise<void> {
    this.ensureNotDisposed();

    if (this._isActive) {
      throw new PluginError(
        `Plugin ${this.manifest.name} is already active`,
        'PLUGIN_ACTIVATION_ERROR',
        { pluginName: this.manifest.name }
      );
    }

    try {
      this.context = context;
      await this.onActivate(context);
      this._isActive = true;
      this.logger?.info(`Plugin activated: ${this.manifest.name}`);
    } catch (error) {
      throw new PluginError(
        `Failed to activate plugin ${this.manifest.name}: ${error instanceof Error ? error.message : String(error)}`,
        'PLUGIN_ACTIVATION_ERROR',
        { pluginName: this.manifest.name, cause: error as Error }
      );
    }
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.ensureNotDisposed();

    if (!this._isActive) return;

    try {
      await this.onDeactivate();
      this._isActive = false;
      this.context = undefined;
      this.logger?.info(`Plugin deactivated: ${this.manifest.name}`);
    } catch (error) {
      throw new PluginError(
        `Failed to deactivate plugin ${this.manifest.name}: ${error instanceof Error ? error.message : String(error)}`,
        'PLUGIN_ERROR',
        { pluginName: this.manifest.name, cause: error as Error }
      );
    }
  }

  /**
   * Register tools with the registry
   */
  registerTools(registry: import('@core/interfaces').IToolRegistry): void {
    // Override in subclass if plugin provides tools
  }

  /**
   * Register commands with the registry
   */
  registerCommands(registry: import('@core/interfaces').ICommandRegistry): void {
    // Override in subclass if plugin provides commands
  }

  /**
   * Register hooks with the registry
   */
  registerHooks(registry: import('@core/interfaces').IHookRegistry): void {
    // Override in subclass if plugin provides hooks
  }

  /**
   * Get plugin configuration schema
   */
  getConfigSchema(): z.ZodSchema | null {
    return null;
  }

  /**
   * Update plugin configuration
   */
  updateConfig(config: Record<string, unknown>): void {
    // Override in subclass if plugin supports dynamic config updates
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onActivate(context: PluginContext): Promise<void>;
  protected abstract onDeactivate(): Promise<void>;

  protected override onDispose(): void {
    if (this._isActive) {
      this.deactivate().catch(() => {
        // Ignore errors during disposal
      });
    }
  }
}

// ============================================================================
// Skill Base Class
// ============================================================================

/**
 * Abstract base class for skills
 */
export abstract class BaseSkill extends DisposableBase implements ISkill {
  abstract readonly definition: SkillDefinition;

  private logger?: ILogger;

  /**
   * Check if this skill can handle a task
   */
  canHandle(task: Task): boolean {
    // Check if task type matches skill triggers
    return this.definition.triggers.some(trigger => 
      task.type.toLowerCase().includes(trigger.toLowerCase()) ||
      task.description.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  /**
   * Execute the skill
   */
  async execute(task: Task, context: SkillContext): Promise<TaskResult> {
    this.ensureNotDisposed();

    if (!this.canHandle(task)) {
      return {
        taskId: task.id ?? '',
        success: false,
        output: '',
        error: `Skill ${this.definition.name} cannot handle task: ${task.description}`,
        executionTime: 0,
      };
    }

    try {
      this.logger?.debug(`Executing skill: ${this.definition.name}`, { taskId: task.id });
      const startTime = Date.now();
      const result = await this.onExecute(task, context);
      const executionTime = Date.now() - startTime;
      
      this.logger?.debug(`Skill executed successfully: ${this.definition.name}`);
      return { ...result, executionTime };
    } catch (error) {
      this.logger?.error(`Skill execution failed: ${this.definition.name}`, error as Error);
      return {
        taskId: task.id ?? '',
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
      };
    }
  }

  /**
   * Get skill prompt
   */
  getPrompt(): string {
    return this.definition.prompt;
  }

  /**
   * Get required tools
   */
  getRequiredTools(): string[] {
    return this.definition.tools;
  }

  // Abstract method to be implemented by subclasses
  protected abstract onExecute(
    task: Task,
    context: SkillContext
  ): Promise<Omit<TaskResult, 'executionTime'>>;

  protected override onDispose(): void {
    // Override in subclass if needed
  }
}

// ============================================================================
// Context Compressor Base Class
// ============================================================================

/**
 * Abstract base class for context compressors
 */
export abstract class BaseContextCompressor extends DisposableBase implements IContextManager {
  abstract readonly strategy: CompressionStrategy;

  protected context: ConversationContext;
  private maxTokens: number;
  private compressionEnabled: boolean;
  private compressionThreshold: number;

  constructor(
    sessionId: UUID,
    workingDirectory: string,
    options: {
      maxTokens?: number;
      compressionEnabled?: boolean;
      compressionThreshold?: number;
    } = {}
  ) {
    super();
    
    this.context = {
      sessionId,
      messages: [],
      workingDirectory,
      files: [],
      metadata: {},
    };
    
    this.maxTokens = options.maxTokens ?? 200000;
    this.compressionEnabled = options.compressionEnabled ?? true;
    this.compressionThreshold = options.compressionThreshold ?? 0.8;
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Add a message to context
   */
  addMessage(message: Message): void {
    this.ensureNotDisposed();
    this.context.messages.push(message);
    this.compressIfNeeded();
  }

  /**
   * Add multiple messages to context
   */
  addMessages(messages: Message[]): void {
    this.ensureNotDisposed();
    this.context.messages.push(...messages);
    this.compressIfNeeded();
  }

  /**
   * Remove a message from context
   */
  removeMessage(messageId: UUID): void {
    this.ensureNotDisposed();
    this.context.messages = this.context.messages.filter(m => m.id !== messageId);
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.ensureNotDisposed();
    this.context.messages = [];
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.context.messages.length;
  }

  /**
   * Get token count estimate
   */
  getTokenCount(): number {
    return this.estimateTokens(this.context);
  }

  /**
   * Compress context if needed
   */
  compressIfNeeded(): void {
    if (!this.compressionEnabled) return;
    
    const tokenCount = this.getTokenCount();
    const threshold = this.maxTokens * this.compressionThreshold;
    
    if (tokenCount > threshold) {
      this.forceCompress(this.strategy);
    }
  }

  /**
   * Force compression
   */
  abstract forceCompress(strategy: CompressionStrategy): void;

  /**
   * Set compression strategy
   */
  setCompressionStrategy(strategy: CompressionStrategy): void {
    // Override in subclass if strategy can be changed
  }

  /**
   * Summarize context
   */
  abstract summarize(): string;

  /**
   * Export context to JSON
   */
  export(): import('@types/index').JSONValue {
    return JSON.parse(JSON.stringify(this.context));
  }

  /**
   * Import context from JSON
   */
  import(data: import('@types/index').JSONValue): void {
    this.ensureNotDisposed();
    this.context = data as ConversationContext;
  }

  /**
   * Estimate tokens for context
   */
  abstract estimateTokens(context: ConversationContext): number;

  /**
   * Check if compression should be applied
   */
  shouldCompress(context: ConversationContext): boolean {
    const tokenCount = this.estimateTokens(context);
    return tokenCount > this.maxTokens * this.compressionThreshold;
  }

  /**
   * Get compression ratio
   */
  getCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 1;
    return compressed / original;
  }

  // Abstract methods to be implemented by subclasses
  abstract compress(context: ConversationContext): CompressedContext;
  abstract decompress(compressed: CompressedContext): ConversationContext;

  protected override onDispose(): void {
    // Override in subclass if needed
  }
}
