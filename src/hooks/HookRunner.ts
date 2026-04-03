/**
 * Hook Runner
 * 
 * Executes hooks with support for parallel execution, middleware,
 * caching, and result transformation.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  HookId,
  HookDefinition,
  AnyHookDefinition,
  HookContext,
  HookExecutionOptions,
  HookExecutionResult,
  HookRunnerConfig,
  HookBatchResult,
  HookMiddleware,
  HookPriority,
  HookLifecycleState,
  HookRegistration,
  PreCommandContext,
  PostCommandContext,
  PreToolContext,
  PostToolContext,
  ErrorContext,
  ResponseContext,
  HookEventType,
  BuiltInHookType
} from './types';
import { HookRegistry } from './HookRegistry';

/**
 * Default runner configuration
 */
const DEFAULT_CONFIG: HookRunnerConfig = {
  parallelExecution: false,
  maxParallelHooks: 5,
  enableCaching: false,
  cacheTtlMs: 60000
};

/**
 * Cache entry for hook results
 */
interface CacheEntry {
  result: unknown;
  timestamp: number;
  contextHash: string;
}

/**
 * Hook Runner class
 * 
 * Executes hooks with advanced features like parallel execution,
 * middleware chains, and result caching.
 */
export class HookRunner extends EventEmitter {
  /** Runner configuration */
  private config: HookRunnerConfig;
  
  /** Hook registry */
  private registry: HookRegistry;
  
  /** Middleware chain */
  private middleware: HookMiddleware[] = [];
  
  /** Result cache */
  private cache: Map<HookId, CacheEntry> = new Map();
  
  /** Cache cleanup interval */
  private cacheCleanupInterval?: NodeJS.Timeout;
  
  /** Active executions */
  private activeExecutions: Map<string, AbortController> = new Map();
  
  /** Execution history */
  private executionHistory: Array<{
    executionId: string;
    hookId: HookId;
    timestamp: Date;
    durationMs: number;
    success: boolean;
  }> = [];
  
  /** Maximum history size */
  private maxHistorySize: number = 1000;

  /**
   * Create a new HookRunner instance
   */
  constructor(registry: HookRegistry, config: Partial<HookRunnerConfig> = {}) {
    super();
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableCaching) {
      this.startCacheCleanup();
    }
  }

  // ============================================================================
  // Core Execution Methods
  // ============================================================================

  /**
   * Execute a single hook
   */
  async execute<TContext extends HookContext>(
    hookId: HookId,
    context: TContext,
    options: HookExecutionOptions = {}
  ): Promise<HookExecutionResult<TContext>> {
    const hook = this.registry.get(hookId);
    if (!hook) {
      throw new Error(`Hook not found: ${hookId}`);
    }

    return this.executeHook(hook, context, options);
  }

  /**
   * Execute multiple hooks sequentially
   */
  async executeSequential<TContext extends HookContext>(
    hookIds: HookId[],
    initialContext: TContext,
    options: HookExecutionOptions = {}
  ): Promise<HookExecutionResult<TContext>> {
    let context = initialContext;
    const executedHooks: HookId[] = [];
    const skippedHooks: HookId[] = [];
    const failedHooks: Array<{ hookId: HookId; error: Error }> = [];
    const hookResults = new Map<HookId, unknown>();
    const startTime = Date.now();

    for (const hookId of hookIds) {
      // Check for cancellation
      if (context.cancel) {
        break;
      }

      const hook = this.registry.get(hookId);
      if (!hook) {
        skippedHooks.push(hookId);
        continue;
      }

      // Check if should skip
      if (options.skipHooks?.includes(hookId)) {
        skippedHooks.push(hookId);
        continue;
      }

      try {
        const result = await this.execute(hookId, context, options);
        context = result.context;
        executedHooks.push(hookId);
        
        if (result.context.result !== undefined) {
          hookResults.set(hookId, result.context.result);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failedHooks.push({ hookId, error: err });
        
        // Continue on error based on configuration
        if (!options.contextData?.continueOnError) {
          break;
        }
      }
    }

    return {
      context,
      cancelled: context.cancel,
      cancelReason: context.cancelReason,
      executedHooks,
      skippedHooks,
      failedHooks,
      totalExecutionTimeMs: Date.now() - startTime,
      hookResults
    };
  }

  /**
   * Execute multiple hooks in parallel (same priority only)
   */
  async executeParallel<TContext extends HookContext>(
    hookIds: HookId[],
    initialContext: TContext,
    options: HookExecutionOptions = {}
  ): Promise<HookBatchResult> {
    const batchId = uuidv4();
    const startTime = Date.now();
    const results = new Map<HookId, unknown>();
    const errors = new Map<HookId, Error>();

    // Group hooks by priority
    const hooksByPriority = this.groupHooksByPriority(hookIds);
    const sortedPriorities = Array.from(hooksByPriority.keys()).sort((a, b) => a - b);

    for (const priority of sortedPriorities) {
      const priorityHookIds = hooksByPriority.get(priority) || [];
      
      // Execute hooks at this priority level in parallel
      const batch = priorityHookIds.map(hookId => 
        this.executeSingleHook(hookId, initialContext, options)
          .then(result => {
            results.set(hookId, result);
          })
          .catch(error => {
            const err = error instanceof Error ? error : new Error(String(error));
            errors.set(hookId, err);
          })
      );

      // Wait for all hooks at this priority level
      await Promise.all(batch);
    }

    return {
      batchId,
      results,
      errors,
      totalTimeMs: Date.now() - startTime,
      allSucceeded: errors.size === 0
    };
  }

  /**
   * Execute hooks by type
   */
  async executeByType<TContext extends HookContext>(
    type: string,
    context: TContext,
    options: HookExecutionOptions = {}
  ): Promise<HookExecutionResult<TContext>> {
    const hooks = this.registry.getByType(type);
    const enabledHooks = hooks.filter(h => h.enabled);
    const sortedHooks = this.sortHooksByPriority(enabledHooks);
    const hookIds = sortedHooks.map(h => h.id);

    if (this.config.parallelExecution && this.shouldExecuteInParallel(sortedHooks)) {
      const batchResult = await this.executeParallel(hookIds, context, options);
      return this.convertBatchResult(batchResult, context);
    }

    return this.executeSequential(hookIds, context, options);
  }

  // ============================================================================
  // Specialized Execution Methods
  // ============================================================================

  /**
   * Execute pre-command hooks
   */
  async runPreCommand(
    context: PreCommandContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PreCommandContext>> {
    return this.executeByType(BuiltInHookType.PRE_COMMAND, context, options);
  }

  /**
   * Execute post-command hooks
   */
  async runPostCommand(
    context: PostCommandContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PostCommandContext>> {
    return this.executeByType(BuiltInHookType.POST_COMMAND, context, options);
  }

  /**
   * Execute pre-tool hooks
   */
  async runPreTool(
    context: PreToolContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PreToolContext>> {
    return this.executeByType(BuiltInHookType.PRE_TOOL, context, options);
  }

  /**
   * Execute post-tool hooks
   */
  async runPostTool(
    context: PostToolContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<PostToolContext>> {
    return this.executeByType(BuiltInHookType.POST_TOOL, context, options);
  }

  /**
   * Execute error hooks
   */
  async runOnError(
    context: ErrorContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<ErrorContext>> {
    return this.executeByType(BuiltInHookType.ON_ERROR, context, options);
  }

  /**
   * Execute response hooks
   */
  async runOnResponse(
    context: ResponseContext,
    options?: HookExecutionOptions
  ): Promise<HookExecutionResult<ResponseContext>> {
    return this.executeByType(BuiltInHookType.ON_RESPONSE, context, options);
  }

  // ============================================================================
  // Middleware Support
  // ============================================================================

  /**
   * Add middleware to the chain
   */
  use(middleware: HookMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware from the chain
   */
  removeMiddleware(middleware: HookMiddleware): boolean {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all middleware
   */
  clearMiddleware(): void {
    this.middleware = [];
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddleware<TContext extends HookContext>(
    context: TContext,
    finalHandler: () => Promise<TContext>
  ): Promise<TContext> {
    let index = 0;

    const next = async (): Promise<TContext> => {
      if (index >= this.middleware.length) {
        return finalHandler();
      }

      const middleware = this.middleware[index++];
      return middleware(context, next);
    };

    return next();
  }

  // ============================================================================
  // Caching Support
  // ============================================================================

  /**
   * Enable caching
   */
  enableCaching(ttlMs?: number): void {
    this.config.enableCaching = true;
    if (ttlMs) {
      this.config.cacheTtlMs = ttlMs;
    }
    this.startCacheCleanup();
  }

  /**
   * Disable caching
   */
  disableCaching(): void {
    this.config.enableCaching = false;
    this.stopCacheCleanup();
    this.cache.clear();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would track hits/misses in full implementation
    };
  }

  /**
   * Get cached result
   */
  private getCachedResult(hookId: HookId, contextHash: string): unknown | undefined {
    if (!this.config.enableCaching) return undefined;

    const entry = this.cache.get(hookId);
    if (!entry) return undefined;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(hookId);
      return undefined;
    }

    // Check if context matches
    if (entry.contextHash !== contextHash) {
      return undefined;
    }

    return entry.result;
  }

  /**
   * Set cached result
   */
  private setCachedResult(hookId: HookId, contextHash: string, result: unknown): void {
    if (!this.config.enableCaching) return;

    this.cache.set(hookId, {
      result,
      timestamp: Date.now(),
      contextHash
    });
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    if (this.cacheCleanupInterval) return;

    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [hookId, entry] of this.cache) {
        if (now - entry.timestamp > this.config.cacheTtlMs) {
          this.cache.delete(hookId);
        }
      }
    }, this.config.cacheTtlMs);
  }

  /**
   * Stop cache cleanup interval
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
  }

  /**
   * Hash context for cache key
   */
  private hashContext(context: HookContext): string {
    // Simple hash for demo - would use proper hashing in production
    return JSON.stringify({
      executionId: context.executionId,
      cancel: context.cancel,
      metadata: context.metadata
    });
  }

  // ============================================================================
  // Private Execution Methods
  // ============================================================================

  /**
   * Execute a single hook with full lifecycle
   */
  private async executeHook<TContext extends HookContext>(
    hook: AnyHookDefinition,
    context: TContext,
    options: HookExecutionOptions
  ): Promise<HookExecutionResult<TContext>> {
    const executionId = uuidv4();
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    // Merge signals
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        abortController.abort(options.signal?.reason);
      });
    }

    try {
      // Check cache
      const contextHash = this.hashContext(context);
      const cached = this.getCachedResult(hook.id, contextHash);
      if (cached !== undefined) {
        context.result = cached;
        return {
          context,
          cancelled: false,
          executedHooks: [hook.id],
          skippedHooks: [],
          failedHooks: [],
          totalExecutionTimeMs: 0,
          hookResults: new Map([[hook.id, cached]])
        };
      }

      // Emit start event
      this.emit(HookEventType.EXECUTION_START, { hookId: hook.id, executionId });

      // Execute with middleware
      const result = await this.executeMiddleware(context, async () => {
        return this.executeWithTimeout(
          () => hook.handler(context) as Promise<TContext>,
          options.timeoutMs || hook.timeoutMs || 30000,
          abortController.signal
        );
      });

      // Apply result transformer if configured
      const transformedResult = this.config.resultTransformer 
        ? this.config.resultTransformer(result) 
        : result;

      // Cache result
      this.setCachedResult(hook.id, contextHash, transformedResult);

      // Update history
      this.addToHistory({
        executionId,
        hookId: hook.id,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        success: true
      });

      // Emit success event
      this.emit(HookEventType.EXECUTION_SUCCESS, { 
        hookId: hook.id, 
        executionId,
        durationMs: Date.now() - startTime 
      });

      return {
        context: transformedResult as TContext,
        cancelled: false,
        executedHooks: [hook.id],
        skippedHooks: [],
        failedHooks: [],
        totalExecutionTimeMs: Date.now() - startTime,
        hookResults: new Map([[hook.id, transformedResult]])
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Update history
      this.addToHistory({
        executionId,
        hookId: hook.id,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        success: false
      });

      // Emit error event
      this.emit(HookEventType.EXECUTION_ERROR, { 
        hookId: hook.id, 
        executionId,
        error: err.message 
      });

      throw err;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single hook (for parallel execution)
   */
  private async executeSingleHook<TContext extends HookContext>(
    hookId: HookId,
    context: TContext,
    options: HookExecutionOptions
  ): Promise<unknown> {
    const hook = this.registry.get(hookId);
    if (!hook) {
      throw new Error(`Hook not found: ${hookId}`);
    }

    const result = await hook.handler(context);
    return result;
  }

  /**
   * Execute with timeout
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

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Group hooks by priority
   */
  private groupHooksByPriority(hookIds: HookId[]): Map<number, HookId[]> {
    const groups = new Map<number, HookId[]>();

    for (const hookId of hookIds) {
      const hook = this.registry.get(hookId);
      if (!hook) continue;

      const priority = hook.priority as number;
      if (!groups.has(priority)) {
        groups.set(priority, []);
      }
      groups.get(priority)!.push(hookId);
    }

    return groups;
  }

  /**
   * Sort hooks by priority
   */
  private sortHooksByPriority(hooks: AnyHookDefinition[]): AnyHookDefinition[] {
    return [...hooks].sort((a, b) => (a.priority as number) - (b.priority as number));
  }

  /**
   * Check if hooks should execute in parallel
   */
  private shouldExecuteInParallel(hooks: AnyHookDefinition[]): boolean {
    if (!this.config.parallelExecution) return false;
    if (hooks.length <= 1) return false;

    // Check if all hooks have the same priority
    const priorities = new Set(hooks.map(h => h.priority));
    return priorities.size === 1 && hooks.length <= this.config.maxParallelHooks;
  }

  /**
   * Convert batch result to execution result
   */
  private convertBatchResult<TContext extends HookContext>(
    batchResult: HookBatchResult,
    initialContext: TContext
  ): HookExecutionResult<TContext> {
    const executedHooks: HookId[] = [];
    const failedHooks: Array<{ hookId: HookId; error: Error }> = [];

    for (const [hookId] of batchResult.results) {
      executedHooks.push(hookId);
    }

    for (const [hookId, error] of batchResult.errors) {
      failedHooks.push({ hookId, error });
    }

    return {
      context: initialContext,
      cancelled: false,
      executedHooks,
      skippedHooks: [],
      failedHooks,
      totalExecutionTimeMs: batchResult.totalTimeMs,
      hookResults: batchResult.results
    };
  }

  /**
   * Add entry to execution history
   */
  private addToHistory(entry: {
    executionId: string;
    hookId: HookId;
    timestamp: Date;
    durationMs: number;
    success: boolean;
  }): void {
    this.executionHistory.push(entry);
    
    // Trim history if needed
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
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
    return true;
  }

  // ============================================================================
  // Getters and Setters
  // ============================================================================

  /**
   * Get execution history
   */
  getExecutionHistory(): Array<{
    executionId: string;
    hookId: HookId;
    timestamp: Date;
    durationMs: number;
    success: boolean;
  }> {
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Get configuration
   */
  getConfig(): HookRunnerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HookRunnerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enableCaching && !this.cacheCleanupInterval) {
      this.startCacheCleanup();
    } else if (!this.config.enableCaching && this.cacheCleanupInterval) {
      this.stopCacheCleanup();
    }
  }

  /**
   * Dispose of the runner
   */
  dispose(): void {
    this.stopCacheCleanup();
    
    // Cancel all active executions
    for (const [executionId, controller] of this.activeExecutions) {
      controller.abort('Runner disposed');
    }
    this.activeExecutions.clear();
    
    this.removeAllListeners();
  }
}

/**
 * Create a new HookRunner instance
 */
export function createHookRunner(
  registry: HookRegistry,
  config?: Partial<HookRunnerConfig>
): HookRunner {
  return new HookRunner(registry, config);
}
