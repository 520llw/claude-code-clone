/**
 * Hook Engine
 * 
 * Core execution engine for the Claude Code hooks system.
 * Manages hook lifecycle, execution, and coordination.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  HookId,
  HookPriority,
  HookPhase,
  HookLifecycleState,
  HookContext,
  HookDefinition,
  AnyHookDefinition,
  HookExecutionOptions,
  HookExecutionResult,
  HookEngineConfig,
  HookEngineState,
  HookExecutionStats,
  HookEventType,
  HookEvent,
  HookCondition,
  HookRegistration,
  HookRegistrationOptions,
  HookRegistrationResult,
  PreCommandContext,
  PostCommandContext,
  PreToolContext,
  PostToolContext,
  ErrorContext,
  ResponseContext,
  BuiltInHookType
} from './types';

/**
 * Default hook engine configuration
 */
const DEFAULT_CONFIG: HookEngineConfig = {
  enabled: true,
  defaultTimeoutMs: 30000,
  maxHooksPerType: 100,
  enableMetrics: true,
  logExecution: true,
  continueOnError: true,
  hookDirectories: []
};

/**
 * Hook Engine class
 * 
 * Manages the complete lifecycle of hooks including registration,
 * execution, and monitoring.
 */
export class HookEngine extends EventEmitter {
  /** Hook registry - maps hook IDs to registrations */
  private hooks: Map<HookId, HookRegistration> = new Map();
  
  /** Hooks organized by type for efficient lookup */
  private hooksByType: Map<string, HookId[]> = new Map();
  
  /** Hooks organized by phase */
  private hooksByPhase: Map<HookPhase, HookId[]> = new Map();
  
  /** Engine configuration */
  private config: HookEngineConfig;
  
  /** Engine state */
  private state: HookEngineState;
  
  /** Global execution statistics */
  private globalStats: HookExecutionStats;
  
  /** Whether engine is initialized */
  private initialized: boolean = false;
  
  /** Execution counter for metrics */
  private executionCounter: number = 0;
  
  /** Active executions for cancellation support */
  private activeExecutions: Map<string, AbortController> = new Map();

  /**
   * Create a new HookEngine instance
   */
  constructor(config: Partial<HookEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalStats = this.createEmptyStats();
    this.state = {
      initialized: false,
      registeredHookCount: 0,
      hooksByType: new Map(),
      config: this.config,
      globalStats: this.globalStats
    };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the hook engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('info', 'Initializing HookEngine');

    // Initialize hook type maps
    Object.values(BuiltInHookType).forEach(type => {
      this.hooksByType.set(type, []);
    });

    // Initialize phase maps
    Object.values(HookPhase).forEach(phase => {
      this.hooksByPhase.set(phase, []);
    });

    // Load hooks from configured directories
    await this.loadHooksFromDirectories();

    this.initialized = true;
    this.state.initialized = true;

    this.log('info', 'HookEngine initialized successfully');
    this.emit('initialized', { timestamp: new Date() });
  }

  /**
   * Shutdown the hook engine
   */
  async shutdown(): Promise<void> {
    this.log('info', 'Shutting down HookEngine');

    // Cancel all active executions
    for (const [executionId, controller] of this.activeExecutions) {
      controller.abort('HookEngine shutting down');
      this.activeExecutions.delete(executionId);
    }

    // Unregister all hooks
    await this.unregisterAll();

    this.initialized = false;
    this.state.initialized = false;

    this.log('info', 'HookEngine shutdown complete');
    this.emit('shutdown', { timestamp: new Date() });
  }

  // ============================================================================
  // Hook Registration
  // ============================================================================

  /**
   * Register a hook
   */
  register<TContext extends HookContext>(
    hook: HookDefinition<TContext>,
    options: HookRegistrationOptions = {}
  ): HookRegistrationResult {
    // Validate hook
    const validation = this.validateHook(hook);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Check if hook already exists
    const existing = this.hooks.get(hook.id);
    if (existing && !options.override) {
      return {
        success: false,
        error: `Hook with ID '${hook.id}' already exists. Use override option to replace.`
      };
    }

    // Check max hooks per type
    const typeHooks = this.hooksByType.get(hook.type) || [];
    if (typeHooks.length >= this.config.maxHooksPerType) {
      return {
        success: false,
        error: `Maximum hooks (${this.config.maxHooksPerType}) reached for type '${hook.type}'`
      };
    }

    // Create registration
    const registration: HookRegistration = {
      hook: hook as AnyHookDefinition,
      registeredAt: new Date(),
      options,
      state: HookLifecycleState.REGISTERED,
      stats: this.createEmptyStats()
    };

    // Store previous hook if overriding
    const previousHook = existing?.hook;

    // Add to registry
    this.hooks.set(hook.id, registration);

    // Add to type index
    if (!this.hooksByType.has(hook.type)) {
      this.hooksByType.set(hook.type, []);
    }
    if (!typeHooks.includes(hook.id)) {
      typeHooks.push(hook.id);
    }

    // Add to phase index
    const phaseHooks = this.hooksByPhase.get(hook.phase) || [];
    if (!this.hooksByPhase.has(hook.phase)) {
      this.hooksByPhase.set(hook.phase, []);
    }
    if (!phaseHooks.includes(hook.id)) {
      phaseHooks.push(hook.id);
    }

    // Sort hooks by priority
    this.sortHooksByPriority();

    // Update state
    this.state.registeredHookCount = this.hooks.size;
    registration.state = HookLifecycleState.ENABLED;

    // Emit event
    this.emitHookEvent(HookEventType.REGISTERED, hook.id, { hook: hook.name });

    this.log('info', `Registered hook: ${hook.name} (${hook.id})`);

    return {
      success: true,
      hookId: hook.id,
      previousHook
    };
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    const hook = registration.hook;

    // Remove from type index
    const typeHooks = this.hooksByType.get(hook.type);
    if (typeHooks) {
      const index = typeHooks.indexOf(hookId);
      if (index > -1) {
        typeHooks.splice(index, 1);
      }
    }

    // Remove from phase index
    const phaseHooks = this.hooksByPhase.get(hook.phase);
    if (phaseHooks) {
      const index = phaseHooks.indexOf(hookId);
      if (index > -1) {
        phaseHooks.splice(index, 1);
      }
    }

    // Remove from registry
    this.hooks.delete(hookId);

    // Update state
    this.state.registeredHookCount = this.hooks.size;

    // Emit event
    this.emitHookEvent(HookEventType.UNREGISTERED, hookId, { hook: hook.name });

    this.log('info', `Unregistered hook: ${hook.name} (${hookId})`);

    return true;
  }

  /**
   * Unregister all hooks
   */
  async unregisterAll(): Promise<void> {
    const hookIds = Array.from(this.hooks.keys());
    for (const hookId of hookIds) {
      this.unregister(hookId);
    }
  }

  /**
   * Enable a hook
   */
  enable(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    registration.state = HookLifecycleState.ENABLED;
    this.emitHookEvent(HookEventType.ENABLED, hookId);
    this.log('info', `Enabled hook: ${registration.hook.name} (${hookId})`);
    return true;
  }

  /**
   * Disable a hook
   */
  disable(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    registration.state = HookLifecycleState.DISABLED;
    this.emitHookEvent(HookEventType.DISABLED, hookId);
    this.log('info', `Disabled hook: ${registration.hook.name} (${hookId})`);
    return true;
  }

  // ============================================================================
  // Hook Execution
  // ============================================================================

  /**
   * Execute hooks for a specific type
   */
  async executeHooks<TContext extends HookContext>(
    hookType: string,
    context: TContext,
    options: HookExecutionOptions = {}
  ): Promise<HookExecutionResult<TContext>> {
    if (!this.config.enabled) {
      return this.createEmptyResult(context);
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    this.log('debug', `Starting hook execution: ${executionId} for type: ${hookType}`);

    // Create abort controller for this execution
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    // Merge signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        abortController.abort(options.signal?.reason);
      });
    }

    try {
      // Get hooks for this type
      const hookIds = this.hooksByType.get(hookType) || [];
      const enabledHooks = hookIds
        .map(id => this.hooks.get(id))
        .filter((reg): reg is HookRegistration => 
          reg !== undefined && 
          reg.state === HookLifecycleState.ENABLED &&
          reg.hook.enabled
        )
        .sort((a, b) => (a.hook.priority as number) - (b.hook.priority as number));

      // Filter hooks based on options
      const filteredHooks = this.filterHooks(enabledHooks, options);

      const executedHooks: HookId[] = [];
      const skippedHooks: HookId[] = [];
      const failedHooks: Array<{ hookId: HookId; error: Error }> = [];
      const hookResults = new Map<HookId, unknown>();

      let currentContext = context;

      // Execute hooks in priority order
      for (const registration of filteredHooks) {
        // Check for cancellation
        if (abortController.signal.aborted || currentContext.cancel) {
          this.log('debug', `Hook execution cancelled: ${executionId}`);
          break;
        }

        const hook = registration.hook;

        // Check conditions
        if (hook.conditions && !this.evaluateConditions(hook.conditions, currentContext)) {
          skippedHooks.push(hook.id);
          continue;
        }

        // Check if hook should be skipped
        if (options.skipHooks?.includes(hook.id)) {
          skippedHooks.push(hook.id);
          continue;
        }

        try {
          this.emitHookEvent(HookEventType.EXECUTION_START, hook.id, { executionId });
          registration.state = HookLifecycleState.EXECUTING;

          const hookStartTime = Date.now();

          // Execute hook with timeout
          const timeoutMs = options.timeoutMs || hook.timeoutMs || this.config.defaultTimeoutMs;
          const result = await this.executeWithTimeout(
            () => hook.handler(currentContext),
            timeoutMs,
            abortController.signal
          );

          const hookDuration = Date.now() - hookStartTime;

          // Update context
          currentContext = result;
          currentContext.result = result;

          // Update statistics
          this.updateHookStats(registration, true, hookDuration);

          executedHooks.push(hook.id);
          hookResults.set(hook.id, result);

          this.emitHookEvent(HookEventType.EXECUTION_SUCCESS, hook.id, { 
            executionId, 
            durationMs: hookDuration 
          });

          this.log('debug', `Hook executed successfully: ${hook.name} (${hook.id}) in ${hookDuration}ms`);

        } catch (error) {
          const hookError = error instanceof Error ? error : new Error(String(error));
          
          failedHooks.push({ hookId: hook.id, error: hookError });
          this.updateHookStats(registration, false, 0, hookError);

          registration.state = HookLifecycleState.ERROR;

          this.emitHookEvent(HookEventType.EXECUTION_ERROR, hook.id, { 
            executionId, 
            error: hookError.message 
          });

          this.log('error', `Hook execution failed: ${hook.name} (${hook.id}): ${hookError.message}`);

          if (!this.config.continueOnError) {
            throw hookError;
          }
        } finally {
          registration.state = HookLifecycleState.ENABLED;
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      this.emitHookEvent(HookEventType.EXECUTION_COMPLETE, undefined, { 
        executionId, 
        totalTimeMs: totalExecutionTime 
      });

      this.log('debug', `Hook execution completed: ${executionId} in ${totalExecutionTime}ms`);

      return {
        context: currentContext,
        cancelled: currentContext.cancel,
        cancelReason: currentContext.cancelReason,
        executedHooks,
        skippedHooks,
        failedHooks,
        totalExecutionTimeMs: totalExecutionTime,
        hookResults
      };

    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Hook execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Hook execution aborted: ${signal.reason}`));
      };

      signal.addEventListener('abort', abortHandler, { once: true });

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', abortHandler);
          reject(error);
        });
    });
  }

  /**
   * Cancel an active execution
   */
  cancelExecution(executionId: string, reason?: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (!controller) {
      return false;
    }

    controller.abort(reason || 'Cancelled by user');
    this.activeExecutions.delete(executionId);

    this.emitHookEvent(HookEventType.CANCELLED, undefined, { executionId, reason });
    this.log('info', `Cancelled hook execution: ${executionId}`);

    return true;
  }

  // ============================================================================
  // Specialized Execution Methods
  // ============================================================================

  /**
   * Execute pre-command hooks
   */
  async executePreCommandHooks(
    context: PreCommandContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PreCommandContext>> {
    return this.executeHooks(BuiltInHookType.PRE_COMMAND, context, options);
  }

  /**
   * Execute post-command hooks
   */
  async executePostCommandHooks(
    context: PostCommandContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PostCommandContext>> {
    return this.executeHooks(BuiltInHookType.POST_COMMAND, context, options);
  }

  /**
   * Execute pre-tool hooks
   */
  async executePreToolHooks(
    context: PreToolContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PreToolContext>> {
    return this.executeHooks(BuiltInHookType.PRE_TOOL, context, options);
  }

  /**
   * Execute post-tool hooks
   */
  async executePostToolHooks(
    context: PostToolContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PostToolContext>> {
    return this.executeHooks(BuiltInHookType.POST_TOOL, context, options);
  }

  /**
   * Execute error hooks
   */
  async executeErrorHooks(
    context: ErrorContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<ErrorContext>> {
    return this.executeHooks(BuiltInHookType.ON_ERROR, context, options);
  }

  /**
   * Execute response hooks
   */
  async executeResponseHooks(
    context: ResponseContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<ResponseContext>> {
    return this.executeHooks(BuiltInHookType.ON_RESPONSE, context, options);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Validate a hook definition
   */
  private validateHook(hook: HookDefinition): { valid: boolean; error?: string } {
    if (!hook.id) {
      return { valid: false, error: 'Hook ID is required' };
    }

    if (!hook.name) {
      return { valid: false, error: 'Hook name is required' };
    }

    if (!hook.type) {
      return { valid: false, error: 'Hook type is required' };
    }

    if (!hook.handler || typeof hook.handler !== 'function') {
      return { valid: false, error: 'Hook handler must be a function' };
    }

    if (hook.priority === undefined) {
      return { valid: false, error: 'Hook priority is required' };
    }

    return { valid: true };
  }

  /**
   * Filter hooks based on execution options
   */
  private filterHooks(
    hooks: HookRegistration[],
    options: HookExecutionOptions
  ): HookRegistration[] {
    if (options.onlyHooks && options.onlyHooks.length > 0) {
      return hooks.filter(reg => options.onlyHooks?.includes(reg.hook.id));
    }
    return hooks;
  }

  /**
   * Evaluate hook conditions
   */
  private evaluateConditions(
    conditions: HookCondition[],
    context: HookContext
  ): boolean {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'always':
          return true;
        case 'custom':
          if (condition.evaluate) {
            const result = condition.evaluate(context);
            if (result === false || (result instanceof Promise && !result)) {
              return false;
            }
          }
          break;
        case 'command':
        case 'tool':
        case 'error':
          // Type-specific evaluation would go here
          break;
        default:
          return true;
      }
    }
    return true;
  }

  /**
   * Sort hooks by priority
   */
  private sortHooksByPriority(): void {
    for (const [type, hookIds] of this.hooksByType) {
      hookIds.sort((a, b) => {
        const hookA = this.hooks.get(a)?.hook;
        const hookB = this.hooks.get(b)?.hook;
        if (!hookA || !hookB) return 0;
        return (hookA.priority as number) - (hookB.priority as number);
      });
    }
  }

  /**
   * Update hook execution statistics
   */
  private updateHookStats(
    registration: HookRegistration,
    success: boolean,
    durationMs: number,
    error?: Error
  ): void {
    const stats = registration.stats;
    stats.totalExecutions++;
    stats.totalExecutionTimeMs += durationMs;
    stats.averageExecutionTimeMs = stats.totalExecutionTimeMs / stats.totalExecutions;
    stats.lastExecutedAt = new Date();

    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
      stats.lastErrorAt = new Date();
      stats.lastErrorMessage = error?.message;
    }

    // Update global stats
    this.globalStats.totalExecutions++;
    this.globalStats.totalExecutionTimeMs += durationMs;
    this.globalStats.averageExecutionTimeMs = 
      this.globalStats.totalExecutionTimeMs / this.globalStats.totalExecutions;
  }

  /**
   * Create empty execution result
   */
  private createEmptyResult<TContext extends HookContext>(
    context: TContext
  ): HookExecutionResult<TContext> {
    return {
      context,
      cancelled: false,
      executedHooks: [],
      skippedHooks: [],
      failedHooks: [],
      totalExecutionTimeMs: 0,
      hookResults: new Map()
    };
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): HookExecutionStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0
    };
  }

  /**
   * Emit a hook event
   */
  private emitHookEvent(
    type: HookEventType,
    hookId?: HookId,
    data?: Record<string, unknown>
  ): void {
    const event: HookEvent = {
      type,
      hookId,
      timestamp: new Date(),
      data
    };
    this.emit(type, event);
  }

  /**
   * Load hooks from configured directories
   */
  private async loadHooksFromDirectories(): Promise<void> {
    // Implementation would load hook files from directories
    this.log('debug', `Loading hooks from directories: ${this.config.hookDirectories.join(', ')}`);
  }

  /**
   * Log a message
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (this.config.logExecution) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [HookEngine] ${message}`);
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get all registered hooks
   */
  getAllHooks(): AnyHookDefinition[] {
    return Array.from(this.hooks.values()).map(reg => reg.hook);
  }

  /**
   * Get hooks by type
   */
  getHooksByType(type: string): AnyHookDefinition[] {
    const hookIds = this.hooksByType.get(type) || [];
    return hookIds
      .map(id => this.hooks.get(id)?.hook)
      .filter((hook): hook is AnyHookDefinition => hook !== undefined);
  }

  /**
   * Get a specific hook by ID
   */
  getHook(hookId: HookId): AnyHookDefinition | undefined {
    return this.hooks.get(hookId)?.hook;
  }

  /**
   * Get hook registration info
   */
  getHookRegistration(hookId: HookId): HookRegistration | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Check if a hook is registered
   */
  hasHook(hookId: HookId): boolean {
    return this.hooks.has(hookId);
  }

  /**
   * Get engine state
   */
  getState(): HookEngineState {
    return { ...this.state };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): HookExecutionStats {
    return { ...this.globalStats };
  }

  /**
   * Get configuration
   */
  getConfig(): HookEngineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HookEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.state.config = this.config;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Singleton instance of the HookEngine
 */
let globalHookEngine: HookEngine | null = null;

/**
 * Get or create the global hook engine instance
 */
export function getHookEngine(config?: Partial<HookEngineConfig>): HookEngine {
  if (!globalHookEngine) {
    globalHookEngine = new HookEngine(config);
  }
  return globalHookEngine;
}

/**
 * Set the global hook engine instance
 */
export function setHookEngine(engine: HookEngine): void {
  globalHookEngine = engine;
}

/**
 * Reset the global hook engine instance
 */
export function resetHookEngine(): void {
  globalHookEngine = null;
}
