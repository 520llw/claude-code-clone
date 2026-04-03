/**
 * HookManager.ts
 * 
 * Hook Registration and Execution for Claude Code Clone Plugin System
 * 
 * This file implements the HookManager class which is responsible for:
 * - Hook registration and deregistration
 * - Hook execution with proper context
 * - Hook priority management
 * - Hook error handling
 * - Hook timeout handling
 * - Hook cancellation support
 * - Hook performance monitoring
 * - Hook result aggregation
 * 
 * The HookManager provides a robust system for extending application
 * functionality through hooks with proper isolation and error handling.
 * 
 * @module HookSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { HookRegistry } from './HookRegistry';
import {
  HookHandler,
  HookHandlerInfo,
  HookContext,
  HookContextConstructor,
  HookResult,
  HandlerResult,
  HookExecutionError,
  HookErrorCode,
  HookExecutionOptions,
  HookRegistrationOptions,
  HookExecutionOrder,
  HookPriority,
  HookDefinition,
  HookDataType,
  HookName,
  HookEvents
} from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Hook manager options
 */
export interface HookManagerOptions {
  /** Default execution timeout */
  defaultTimeout?: number;
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum concurrent hook executions */
  maxConcurrentExecutions?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Whether to stop on first success */
  stopOnSuccess?: boolean;
}

/**
 * Execution state
 */
interface ExecutionState {
  executionId: string;
  hookName: string;
  startTime: number;
  cancelled: boolean;
  cancellationReason?: string;
  handlersExecuted: number;
  results: HandlerResult[];
}

// ============================================================================
// Default Hook Context Implementation
// ============================================================================

/**
 * Default hook context implementation
 */
class DefaultHookContext<T = any> implements HookContext<T> {
  public cancelled: boolean = false;
  public cancellationReason?: string;
  public metadata: Record<string, any> = {};

  constructor(
    public hookName: string,
    public data: T,
    public executionId: string,
    public timestamp: Date = new Date(),
    public sourcePlugin?: string
  ) {}

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    (this.data as any)[key] = value;
  }

  cancel(reason?: string): void {
    this.cancelled = true;
    this.cancellationReason = reason;
  }

  addMeta(key: string, value: any): void {
    this.metadata[key] = value;
  }
}

// ============================================================================
// Hook Manager Class
// ============================================================================

/**
 * HookManager - Central manager for hook registration and execution.
 * 
 * The HookManager coordinates all hook-related operations including
 * registration, execution, error handling, and performance monitoring.
 * 
 * @example
 * ```typescript
 * const hookManager = new HookManager();
 * await hookManager.initialize();
 * 
 * // Register a hook handler
 * await hookManager.registerHook('onMessage', async (context) => {
 *   console.log('Message received:', context.data.content);
 * });
 * 
 * // Execute a hook
 * const result = await hookManager.execute('onMessage', {
 *   messageId: '123',
 *   content: 'Hello',
 *   role: 'user',
 *   timestamp: new Date()
 * });
 * ```
 */
export class HookManager extends EventEmitter {
  /**
   * Hook registry
   */
  private registry: HookRegistry;

  /**
   * Manager options
   */
  private options: HookManagerOptions;

  /**
   * Active executions
   */
  private activeExecutions: Map<string, ExecutionState> = new Map();

  /**
   * Execution counter for monitoring
   */
  private executionCounter: number = 0;

  /**
   * Error counter for monitoring
   */
  private errorCounter: number = 0;

  /**
   * Total execution time for monitoring
   */
  private totalExecutionTime: number = 0;

  /**
   * Whether the manager is initialized
   */
  private initialized: boolean = false;

  /**
   * Creates a new HookManager instance.
   * 
   * @param options - Manager options
   */
  constructor(options: HookManagerOptions = {}) {
    super();
    this.setMaxListeners(200);

    this.options = {
      defaultTimeout: 30000,
      enableMonitoring: true,
      debug: false,
      maxConcurrentExecutions: 100,
      stopOnError: false,
      stopOnSuccess: false,
      ...options
    };

    this.registry = new HookRegistry();
  }

  /**
   * Initializes the hook manager.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.registry.initialize();
    this.initialized = true;

    this.log('debug', 'HookManager initialized');
    this.emit('initialized');
  }

  /**
   * Disposes the hook manager.
   */
  public async dispose(): Promise<void> {
    // Cancel all active executions
    for (const [executionId, state] of this.activeExecutions) {
      this.cancelExecution(executionId, 'HookManager disposal');
    }

    this.registry.dispose();
    this.activeExecutions.clear();
    this.initialized = false;

    this.log('debug', 'HookManager disposed');
    this.emit('disposed');
  }

  // ============================================================================
  // Hook Registration
  // ============================================================================

  /**
   * Registers a hook handler.
   * 
   * @param hookName - Name of the hook
   * @param handler - Handler function
   * @param options - Registration options
   * @returns Handler ID
   */
  public async registerHook<T = any, R = any>(
    hookName: HookName | string,
    handler: HookHandler<T, R>,
    options: HookRegistrationOptions = {}
  ): Promise<string> {
    this.ensureInitialized();

    // Check if hook exists
    if (!this.registry.has(hookName)) {
      throw new Error(`Hook ${hookName} is not registered`);
    }

    const handlerId = uuidv4();
    const handlerInfo: HookHandlerInfo<T, R> = {
      handler,
      priority: options.priority ?? HookPriority.NORMAL,
      pluginId: options.pluginId || 'anonymous',
      handlerId,
      async: this.isAsyncHandler(handler),
      timeout: options.timeout,
      cancellable: options.cancellable ?? true,
      description: options.description,
      tags: options.tags
    };

    this.registry.addHandler(hookName, handlerInfo);

    this.log('debug', `Registered handler ${handlerId} for hook ${hookName}`);
    this.emit('hookRegistered', { hookName, handlerId, pluginId: handlerInfo.pluginId });

    return handlerId;
  }

  /**
   * Unregisters a hook handler.
   * 
   * @param hookName - Name of the hook
   * @param handlerId - Handler ID
   * @returns True if the handler was unregistered
   */
  public async unregisterHook(hookName: string, handlerId: string): Promise<boolean> {
    this.ensureInitialized();

    const result = this.registry.removeHandler(hookName, handlerId);

    if (result) {
      this.log('debug', `Unregistered handler ${handlerId} from hook ${hookName}`);
      this.emit('hookUnregistered', { hookName, handlerId });
    }

    return result;
  }

  /**
   * Unregisters all handlers for a plugin.
   * 
   * @param pluginId - Plugin ID
   * @returns Number of handlers unregistered
   */
  public async unregisterPluginHooks(pluginId: string): Promise<number> {
    this.ensureInitialized();

    const count = this.registry.removePluginHandlers(pluginId);

    if (count > 0) {
      this.log('debug', `Unregistered ${count} handlers for plugin ${pluginId}`);
    }

    return count;
  }

  // ============================================================================
  // Hook Execution
  // ============================================================================

  /**
   * Executes a hook.
   * 
   * @param hookName - Name of the hook
   * @param data - Hook data
   * @param options - Execution options
   * @returns Hook execution result
   */
  public async execute<T = any, R = any>(
    hookName: HookName | string,
    data: T,
    options: HookExecutionOptions = {}
  ): Promise<HookResult<R>> {
    this.ensureInitialized();

    const startTime = Date.now();
    const executionId = uuidv4();

    this.log('debug', `Executing hook ${hookName} (execution: ${executionId})`);

    // Get hook definition
    const hookDef = this.registry.get(hookName);
    if (!hookDef) {
      const error: HookExecutionError = {
        code: HookErrorCode.UNKNOWN,
        message: `Hook ${hookName} is not registered`
      };

      return {
        success: false,
        error,
        handlerResults: [],
        duration: Date.now() - startTime,
        cancelled: false,
        handlersExecuted: 0,
        handlersSucceeded: 0,
        handlersFailed: 0
      };
    }

    // Create execution context
    const context = this.createContext(hookName, data, executionId, options.sourcePlugin);

    // Create execution state
    const executionState: ExecutionState = {
      executionId,
      hookName,
      startTime,
      cancelled: false,
      handlersExecuted: 0,
      results: []
    };

    this.activeExecutions.set(executionId, executionState);

    try {
      // Get handlers
      const handlers = this.registry.getHandlers(hookName);

      if (handlers.length === 0) {
        this.log('debug', `No handlers registered for hook ${hookName}`);
        
        return {
          success: true,
          data: undefined as any,
          handlerResults: [],
          duration: Date.now() - startTime,
          cancelled: false,
          handlersExecuted: 0,
          handlersSucceeded: 0,
          handlersFailed: 0
        };
      }

      // Determine execution order
      const executionOrder = options.order || hookDef.executionOrder;

      // Execute handlers
      let results: HandlerResult<R>[];

      switch (executionOrder) {
        case HookExecutionOrder.PARALLEL:
          results = await this.executeParallel(handlers, context, hookDef, options, executionState);
          break;
        case HookExecutionOrder.RACE:
          results = await this.executeRace(handlers, context, hookDef, options, executionState);
          break;
        case HookExecutionOrder.SEQUENTIAL:
        default:
          results = await this.executeSequential(handlers, context, hookDef, options, executionState);
          break;
      }

      // Calculate final result
      const duration = Date.now() - startTime;
      const handlersSucceeded = results.filter(r => r.success).length;
      const handlersFailed = results.filter(r => !r.success && !r.skipped).length;
      const success = handlersFailed === 0 || !options.stopOnError;

      // Aggregate results
      const finalData = this.aggregateResults(results);

      // Update statistics
      this.registry.updateStatistics(hookName, duration, handlersFailed > 0);
      this.updateMonitoringStats(duration, handlersFailed > 0);

      // Clean up
      this.activeExecutions.delete(executionId);

      const result: HookResult<R> = {
        success,
        data: finalData,
        handlerResults: results,
        duration,
        cancelled: context.cancelled,
        handlersExecuted: results.length,
        handlersSucceeded,
        handlersFailed
      };

      this.log('debug', `Hook ${hookName} executed in ${duration}ms`);
      this.emit('hookExecuted', { hookName, executionId, duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Clean up
      this.activeExecutions.delete(executionId);

      const hookError: HookExecutionError = {
        code: HookErrorCode.EXECUTION_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };

      this.log('error', `Hook ${hookName} execution failed:`, hookError);
      this.emit('hookError', { hookName, executionId, error: hookError });

      return {
        success: false,
        error: hookError,
        handlerResults: [],
        duration,
        cancelled: context.cancelled,
        handlersExecuted: 0,
        handlersSucceeded: 0,
        handlersFailed: 0
      };
    }
  }

  /**
   * Executes handlers sequentially.
   */
  private async executeSequential<T, R>(
    handlers: HookHandlerInfo[],
    context: HookContext<T>,
    hookDef: HookDefinition,
    options: HookExecutionOptions,
    executionState: ExecutionState
  ): Promise<HandlerResult<R>[]> {
    const results: HandlerResult<R>[] = [];

    for (const handlerInfo of handlers) {
      // Check if cancelled
      if (context.cancelled) {
        results.push({
          handlerId: handlerInfo.handlerId,
          pluginId: handlerInfo.pluginId,
          success: false,
          duration: 0,
          skipped: true,
          skipReason: 'Execution cancelled'
        });
        continue;
      }

      // Execute handler
      const result = await this.executeHandler(handlerInfo, context, hookDef, options);
      results.push(result);

      executionState.handlersExecuted++;
      executionState.results.push(result);

      // Check stop conditions
      if (options.stopOnError && !result.success && !result.skipped) {
        break;
      }

      if (options.stopOnSuccess && result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Executes handlers in parallel.
   */
  private async executeParallel<T, R>(
    handlers: HookHandlerInfo[],
    context: HookContext<T>,
    hookDef: HookDefinition,
    options: HookExecutionOptions,
    executionState: ExecutionState
  ): Promise<HandlerResult<R>[]> {
    const promises = handlers.map(async handlerInfo => {
      const result = await this.executeHandler(handlerInfo, context, hookDef, options);
      executionState.handlersExecuted++;
      executionState.results.push(result);
      return result;
    });

    return Promise.all(promises);
  }

  /**
   * Executes handlers as a race (first to complete wins).
   */
  private async executeRace<T, R>(
    handlers: HookHandlerInfo[],
    context: HookContext<T>,
    hookDef: HookDefinition,
    options: HookExecutionOptions,
    executionState: ExecutionState
  ): Promise<HandlerResult<R>[]> {
    const promises = handlers.map(async handlerInfo => {
      const result = await this.executeHandler(handlerInfo, context, hookDef, options);
      executionState.handlersExecuted++;
      executionState.results.push(result);
      return result;
    });

    const result = await Promise.race(promises);
    return [result];
  }

  /**
   * Executes a single handler.
   */
  private async executeHandler<T, R>(
    handlerInfo: HookHandlerInfo,
    context: HookContext<T>,
    hookDef: HookDefinition,
    options: HookExecutionOptions
  ): Promise<HandlerResult<R>> {
    const startTime = Date.now();
    const timeout = handlerInfo.timeout || options.timeout || hookDef.defaultTimeout;

    try {
      this.log('debug', `Executing handler ${handlerInfo.handlerId} for hook ${hookDef.name}`);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => handlerInfo.handler(context),
        timeout
      );

      const duration = Date.now() - startTime;

      this.log('debug', `Handler ${handlerInfo.handlerId} completed in ${duration}ms`);
      this.emit('handlerExecuted', {
        hookName: hookDef.name,
        handlerId: handlerInfo.handlerId,
        duration
      });

      return {
        handlerId: handlerInfo.handlerId,
        pluginId: handlerInfo.pluginId,
        success: true,
        result,
        duration,
        skipped: false
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.log('error', `Handler ${handlerInfo.handlerId} failed:`, error);
      this.emit('handlerError', {
        hookName: hookDef.name,
        handlerId: handlerInfo.handlerId,
        error: error instanceof Error ? error : new Error(String(error))
      });

      return {
        handlerId: handlerInfo.handlerId,
        pluginId: handlerInfo.pluginId,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
        skipped: false
      };
    }
  }

  /**
   * Executes a function with timeout.
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Handler timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // ============================================================================
  // Hook Cancellation
  // ============================================================================

  /**
   * Cancels a hook execution.
   * 
   * @param executionId - Execution ID
   * @param reason - Cancellation reason
   * @returns True if the execution was cancelled
   */
  public cancelExecution(executionId: string, reason?: string): boolean {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return false;
    }

    state.cancelled = true;
    state.cancellationReason = reason;

    this.log('debug', `Cancelled execution ${executionId}: ${reason}`);
    this.emit('hookCancelled', { hookName: state.hookName, executionId, reason });

    return true;
  }

  /**
   * Cancels all executions of a hook.
   * 
   * @param hookName - Hook name
   * @param reason - Cancellation reason
   * @returns Number of executions cancelled
   */
  public cancelHookExecutions(hookName: string, reason?: string): number {
    let count = 0;

    for (const [executionId, state] of this.activeExecutions) {
      if (state.hookName === hookName) {
        this.cancelExecution(executionId, reason);
        count++;
      }
    }

    return count;
  }

  // ============================================================================
  // Hook Information
  // ============================================================================

  /**
   * Gets the hook registry.
   * 
   * @returns The hook registry
   */
  public getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Gets hook definitions.
   * 
   * @returns Array of hook definitions
   */
  public getHooks(): HookDefinition[] {
    return this.registry.getAll();
  }

  /**
   * Gets the count of registered hooks.
   * 
   * @returns Number of hooks
   */
  public getHookCount(): number {
    return this.registry.getAll().length;
  }

  /**
   * Gets the count of registered handlers.
   * 
   * @returns Number of handlers
   */
  public getHandlerCount(): number {
    return this.registry.getTotalHandlerCount();
  }

  /**
   * Gets active executions.
   * 
   * @returns Array of active execution IDs
   */
  public getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Checks if an execution is active.
   * 
   * @param executionId - Execution ID
   * @returns True if the execution is active
   */
  public isExecutionActive(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Gets hook statistics.
   * 
   * @returns Hook statistics
   */
  public getStatistics() {
    const registryStats = this.registry.getStatistics();
    
    return {
      ...registryStats,
      activeExecutions: this.activeExecutions.size,
      totalExecutions: this.executionCounter,
      totalErrors: this.errorCounter,
      averageExecutionTime: this.executionCounter > 0 
        ? this.totalExecutionTime / this.executionCounter 
        : 0
    };
  }

  /**
   * Updates monitoring statistics.
   */
  private updateMonitoringStats(duration: number, error: boolean): void {
    if (!this.options.enableMonitoring) {
      return;
    }

    this.executionCounter++;
    this.totalExecutionTime += duration;

    if (error) {
      this.errorCounter++;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Ensures the manager is initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('HookManager is not initialized');
    }
  }

  /**
   * Creates a hook context.
   */
  private createContext<T>(
    hookName: string,
    data: T,
    executionId: string,
    sourcePlugin?: string
  ): HookContext<T> {
    return new DefaultHookContext(hookName, data, executionId, new Date(), sourcePlugin);
  }

  /**
   * Checks if a handler is async.
   */
  private isAsyncHandler(handler: HookHandler): boolean {
    return handler.constructor.name === 'AsyncFunction';
  }

  /**
   * Aggregates handler results.
   */
  private aggregateResults<R>(results: HandlerResult<R>[]): R | undefined {
    // Find the last successful result
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].success && results[i].result !== undefined) {
        return results[i].result;
      }
    }

    return undefined;
  }

  /**
   * Logs a message.
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.options.debug && level === 'debug') {
      return;
    }

    const prefix = `[HookManager]`;
    
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...args);
        break;
      case 'info':
        console.info(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
        console.error(prefix, message, ...args);
        break;
    }
  }
}

export default HookManager;
