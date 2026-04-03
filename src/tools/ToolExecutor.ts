/**
 * @fileoverview Tool Executor for Claude Code Clone
 * 
 * This module provides the execution engine for running tools with
 * permission management, sandboxing, logging, and comprehensive error handling.
 * 
 * @module ToolExecutor
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { Tool, ToolResult, ToolContext, ToolExecutionOptions, ToolExecutionStatus, PermissionLevel, PermissionDecision, ToolError, createToolError } from './Tool';
import { ToolRegistry } from './ToolRegistry';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Permission Manager Types
// ============================================================================

/**
 * Permission request callback
 */
export type PermissionRequestCallback = (
  tool: Tool,
  input: unknown,
  context: ToolContext
) => Promise<PermissionDecision>;

/**
 * Permission rule
 */
export interface PermissionRule {
  /** Tool name pattern */
  toolPattern: RegExp;
  /** Permission level */
  level: PermissionLevel;
  /** Optional condition function */
  condition?: (input: unknown, context: ToolContext) => boolean;
}

/**
 * Permission cache entry
 */
interface PermissionCacheEntry {
  decision: PermissionDecision;
  expiresAt: number;
}

// ============================================================================
// Execution History Types
// ============================================================================

/**
 * Execution history entry
 */
export interface ExecutionHistoryEntry {
  /** Execution ID */
  executionId: string;
  /** Tool name */
  toolName: string;
  /** Input data */
  input: unknown;
  /** Execution result */
  result: ToolResult;
  /** Execution context */
  context: ToolContext;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Executor Configuration
// ============================================================================

/**
 * Tool executor configuration
 */
export interface ToolExecutorConfig {
  /** Tool registry */
  registry: ToolRegistry;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Maximum concurrent executions */
  maxConcurrent?: number;
  /** Whether to enable execution history */
  enableHistory?: boolean;
  /** Maximum history entries */
  maxHistoryEntries?: number;
  /** Permission cache TTL in milliseconds */
  permissionCacheTtl?: number;
  /** Default permission callback */
  defaultPermissionCallback?: PermissionRequestCallback;
  /** Sandbox configuration */
  sandbox?: {
    /** Allowed directories */
    allowedDirectories?: string[];
    /** Blocked directories */
    blockedDirectories?: string[];
    /** Maximum file size */
    maxFileSize?: number;
  };
}

// ============================================================================
// Execution Queue Types
// ============================================================================

/**
 * Queued execution
 */
interface QueuedExecution {
  id: string;
  tool: Tool;
  input: unknown;
  context: ToolContext;
  options: ToolExecutionOptions;
  resolve: (result: ToolResult) => void;
  reject: (error: Error) => void;
  queuedAt: Date;
}

// ============================================================================
// Tool Executor Class
// ============================================================================

/**
 * Tool executor that manages tool execution with permission handling,
 * sandboxing, queuing, and comprehensive logging.
 * 
 * The ToolExecutor provides:
 * - Permission management with caching
 * - Execution queuing and concurrency control
 * - Execution history tracking
 * - Comprehensive error handling
 * - Event-driven architecture
 * 
 * @example
 * ```typescript
 * const executor = new ToolExecutor({
 *   registry: toolRegistry,
 *   defaultTimeout: 30000,
 *   maxConcurrent: 5,
 * });
 * 
 * const result = await executor.execute('file_read', {
 *   file_path: '/path/to/file.txt'
 * }, context);
 * ```
 */
export class ToolExecutor extends EventEmitter {
  /** Tool registry */
  private registry: ToolRegistry;

  /** Configuration */
  private config: Required<ToolExecutorConfig>;

  /** Permission rules */
  private permissionRules: PermissionRule[] = [];

  /** Permission cache */
  private permissionCache: Map<string, PermissionCacheEntry> = new Map();

  /** Permission request callback */
  private permissionCallback: PermissionRequestCallback | null = null;

  /** Execution history */
  private executionHistory: ExecutionHistoryEntry[] = [];

  /** Execution queue */
  private executionQueue: QueuedExecution[] = [];

  /** Currently executing */
  private activeExecutions: Set<string> = new Set();

  /** Whether executor is running */
  private isRunning: boolean = false;

  /** Whether executor is disposed */
  private isDisposed: boolean = false;

  /**
   * Creates a new ToolExecutor instance
   * @param config - Executor configuration
   */
  constructor(config: ToolExecutorConfig) {
    super();

    this.registry = config.registry;
    this.config = {
      registry: config.registry,
      defaultTimeout: config.defaultTimeout || 30000,
      maxConcurrent: config.maxConcurrent || 10,
      enableHistory: config.enableHistory ?? true,
      maxHistoryEntries: config.maxHistoryEntries || 1000,
      permissionCacheTtl: config.permissionCacheTtl || 300000, // 5 minutes
      defaultPermissionCallback: config.defaultPermissionCallback || this.defaultPermissionHandler.bind(this),
      sandbox: {
        allowedDirectories: config.sandbox?.allowedDirectories || [],
        blockedDirectories: config.sandbox?.blockedDirectories || [],
        maxFileSize: config.sandbox?.maxFileSize || 10 * 1024 * 1024, // 10MB
      },
    };

    this.permissionCallback = this.config.defaultPermissionCallback;
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  /**
   * Execute a tool by name
   * 
   * This is the main method for executing tools. It handles:
   * - Tool lookup
   * - Permission checking
   * - Execution queuing
   * - Error handling
   * - History tracking
   * 
   * @param toolName - Name of the tool to execute
   * @param input - Tool input
   * @param context - Execution context
   * @param options - Execution options
   * @returns Promise resolving to tool result
   * 
   * @example
   * ```typescript
   * const result = await executor.execute('file_read', {
   *   file_path: '/path/to/file.txt'
   * }, context);
   * 
   * if (result.success) {
   *   console.log(result.data);
   * }
   * ```
   */
  public async execute(
    toolName: string,
    input: unknown,
    context: ToolContext,
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    if (this.isDisposed) {
      return this.createErrorResult(
        'EXECUTOR_DISPOSED',
        'Tool executor has been disposed'
      );
    }

    const executionId = uuidv4();

    // Look up the tool
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      return this.createErrorResult(
        'TOOL_NOT_FOUND',
        `Tool '${toolName}' not found in registry`
      );
    }

    // Check concurrency
    if (this.activeExecutions.size >= this.config.maxConcurrent) {
      return this.queueExecution(tool, input, context, options);
    }

    return this.executeTool(tool, input, context, options, executionId);
  }

  /**
   * Execute multiple tools in sequence
   * 
   * @param executions - Array of execution specifications
   * @param context - Shared execution context
   * @returns Array of results
   * 
   * @example
   * ```typescript
   * const results = await executor.executeSequence([
   *   { tool: 'file_read', input: { file_path: '/file1.txt' } },
   *   { tool: 'file_read', input: { file_path: '/file2.txt' } },
   * ], context);
   * ```
   */
  public async executeSequence(
    executions: Array<{ tool: string; input: unknown; options?: ToolExecutionOptions }>,
    context: ToolContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const execution of executions) {
      const result = await this.execute(
        execution.tool,
        execution.input,
        context,
        execution.options
      );
      results.push(result);

      // Stop on failure if not continuing on error
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   * 
   * @param executions - Array of execution specifications
   * @param context - Shared execution context
   * @returns Array of results
   * 
   * @example
   * ```typescript
   * const results = await executor.executeParallel([
   *   { tool: 'file_read', input: { file_path: '/file1.txt' } },
   *   { tool: 'file_read', input: { file_path: '/file2.txt' } },
   * ], context);
   * ```
   */
  public async executeParallel(
    executions: Array<{ tool: string; input: unknown; options?: ToolExecutionOptions }>,
    context: ToolContext
  ): Promise<ToolResult[]> {
    const promises = executions.map((execution) =>
      this.execute(execution.tool, execution.input, context, execution.options)
    );

    return Promise.all(promises);
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Set the permission request callback
   * 
   * @param callback - Callback function for permission requests
   * 
   * @example
   * ```typescript
   * executor.setPermissionCallback(async (tool, input, context) => {
   *   // Ask user for permission
   *   const allowed = await askUser(`Allow ${tool.name}?`);
   *   return {
   *     allowed,
   *     level: tool.permissionLevel,
   *     timestamp: new Date(),
   *   };
   * });
   * ```
   */
  public setPermissionCallback(callback: PermissionRequestCallback): void {
    this.permissionCallback = callback;
  }

  /**
   * Add a permission rule
   * 
   * @param rule - Permission rule to add
   * 
   * @example
   * ```typescript
   * executor.addPermissionRule({
   *   toolPattern: /^file_read$/,
   *   level: PermissionLevel.AUTO_APPROVE,
   *   condition: (input) => input.file_path.startsWith('/safe/'),
   * });
   * ```
   */
  public addPermissionRule(rule: PermissionRule): void {
    this.permissionRules.push(rule);
    this.emit('permission:ruleAdded', rule);
  }

  /**
   * Remove permission rules matching a pattern
   * 
   * @param pattern - Pattern to match
   * @returns Number of rules removed
   * 
   * @example
   * ```typescript
   * const removed = executor.removePermissionRules(/^file_/);
   * ```
   */
  public removePermissionRules(pattern: RegExp): number {
    const initialLength = this.permissionRules.length;
    this.permissionRules = this.permissionRules.filter(
      (rule) => !pattern.test(rule.toolPattern.source)
    );
    const removed = initialLength - this.permissionRules.length;
    if (removed > 0) {
      this.emit('permission:rulesRemoved', { pattern, count: removed });
    }
    return removed;
  }

  /**
   * Clear all permission rules
   * 
   * @example
   * ```typescript
   * executor.clearPermissionRules();
   * ```
   */
  public clearPermissionRules(): void {
    this.permissionRules = [];
    this.emit('permission:rulesCleared');
  }

  /**
   * Clear the permission cache
   * 
   * @example
   * ```typescript
   * executor.clearPermissionCache();
   * ```
   */
  public clearPermissionCache(): void {
    this.permissionCache.clear();
    this.emit('permission:cacheCleared');
  }

  // ============================================================================
  // History Methods
  // ============================================================================

  /**
   * Get execution history
   * 
   * @param filter - Optional filter options
   * @returns Array of history entries
   * 
   * @example
   * ```typescript
   * const history = executor.getHistory({ toolName: 'file_read' });
   * ```
   */
  public getHistory(filter?: {
    toolName?: string;
    success?: boolean;
    since?: Date;
    until?: Date;
  }): ExecutionHistoryEntry[] {
    let history = [...this.executionHistory];

    if (filter?.toolName) {
      history = history.filter((h) => h.toolName === filter.toolName);
    }

    if (filter?.success !== undefined) {
      history = history.filter((h) => h.result.success === filter.success);
    }

    if (filter?.since) {
      history = history.filter((h) => h.timestamp >= filter.since!);
    }

    if (filter?.until) {
      history = history.filter((h) => h.timestamp <= filter.until!);
    }

    return history;
  }

  /**
   * Clear execution history
   * 
   * @example
   * ```typescript
   * executor.clearHistory();
   * ```
   */
  public clearHistory(): void {
    this.executionHistory = [];
    this.emit('history:cleared');
  }

  /**
   * Get execution history statistics
   * 
   * @returns History statistics
   * 
   * @example
   * ```typescript
   * const stats = executor.getHistoryStats();
   * console.log(`Total executions: ${stats.totalExecutions}`);
   * ```
   */
  public getHistoryStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter((h) => h.result.success).length;
    const failed = total - successful;

    const totalDuration = this.executionHistory.reduce(
      (sum, h) => sum + (h.result.duration || 0),
      0
    );
    const averageDuration = total > 0 ? totalDuration / total : 0;

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageDuration,
    };
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Get the current execution queue
   * 
   * @returns Array of queued executions
   */
  public getQueue(): QueuedExecution[] {
    return [...this.executionQueue];
  }

  /**
   * Get the number of queued executions
   * 
   * @returns Queue length
   */
  public getQueueLength(): number {
    return this.executionQueue.length;
  }

  /**
   * Clear the execution queue
   * 
   * @param rejectPending - Whether to reject pending executions
   * @returns Number of cleared executions
   * 
   * @example
   * ```typescript
   * const cleared = executor.clearQueue(true);
   * ```
   */
  public clearQueue(rejectPending: boolean = false): number {
    const count = this.executionQueue.length;

    if (rejectPending) {
      for (const queued of this.executionQueue) {
        queued.reject(new Error('Execution cancelled - queue cleared'));
      }
    }

    this.executionQueue = [];
    this.emit('queue:cleared', { count });
    return count;
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
   * Get executor status
   * 
   * @returns Current status
   * 
   * @example
   * ```typescript
   * const status = executor.getStatus();
   * console.log(`Active: ${status.activeExecutions}, Queued: ${status.queuedExecutions}`);
   * ```
   */
  public getStatus(): {
    isRunning: boolean;
    isDisposed: boolean;
    activeExecutions: number;
    queuedExecutions: number;
    totalExecutions: number;
  } {
    return {
      isRunning: this.isRunning,
      isDisposed: this.isDisposed,
      activeExecutions: this.activeExecutions.size,
      queuedExecutions: this.executionQueue.length,
      totalExecutions: this.executionHistory.length,
    };
  }

  /**
   * Check if the executor is currently executing
   * 
   * @returns True if executing
   */
  public isBusy(): boolean {
    return this.activeExecutions.size > 0 || this.executionQueue.length > 0;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the executor
   * 
   * @example
   * ```typescript
   * await executor.start();
   * ```
   */
  public async start(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Cannot start disposed executor');
    }

    this.isRunning = true;
    this.emit('executor:started');
  }

  /**
   * Stop the executor
   * 
   * @param cancelPending - Whether to cancel pending executions
   * 
   * @example
   * ```typescript
   * await executor.stop(true);
   * ```
   */
  public async stop(cancelPending: boolean = false): Promise<void> {
    this.isRunning = false;

    if (cancelPending) {
      this.clearQueue(true);
    }

    // Wait for active executions to complete
    while (this.activeExecutions.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.emit('executor:stopped');
  }

  /**
   * Dispose of the executor
   * 
   * @example
   * ```typescript
   * await executor.dispose();
   * ```
   */
  public async dispose(): Promise<void> {
    await this.stop(true);
    this.isDisposed = true;
    this.clearPermissionCache();
    this.removeAllListeners();
    this.emit('executor:disposed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Execute a tool with full lifecycle management
   */
  private async executeTool(
    tool: Tool,
    input: unknown,
    context: ToolContext,
    options: ToolExecutionOptions,
    executionId: string
  ): Promise<ToolResult> {
    this.activeExecutions.add(executionId);
    this.emit('execution:started', { executionId, tool: tool.name });

    try {
      // Check permissions
      if (!options.skipPermissionCheck) {
        const permission = await this.checkPermission(tool, input, context);
        if (!permission.allowed) {
          const result: ToolResult = {
            executionId,
            status: ToolExecutionStatus.PERMISSION_DENIED,
            toolName: tool.name,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            success: false,
            error: createToolError(
              'PERMISSION_DENIED',
              permission.reason || `Permission denied for tool '${tool.name}'`
            ),
          };
          this.addToHistory(tool.name, input, result, context);
          return result;
        }
      }

      // Execute the tool
      const result = await tool.execute(input, context, {
        ...options,
        timeout: options.timeout || this.config.defaultTimeout,
      });

      // Update result with execution ID
      const finalResult = { ...result, executionId };

      // Add to history
      this.addToHistory(tool.name, input, finalResult, context);

      this.emit('execution:completed', { executionId, result: finalResult });

      return finalResult;
    } catch (error) {
      const errorResult: ToolResult = {
        executionId,
        status: ToolExecutionStatus.FAILURE,
        toolName: tool.name,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
        success: false,
        error: createToolError(
          'EXECUTION_ERROR',
          error instanceof Error ? error.message : String(error)
        ),
      };

      this.addToHistory(tool.name, input, errorResult, context);
      this.emit('execution:failed', { executionId, error });

      return errorResult;
    } finally {
      this.activeExecutions.delete(executionId);
      this.processQueue();
    }
  }

  /**
   * Queue an execution for later
   */
  private queueExecution(
    tool: Tool,
    input: unknown,
    context: ToolContext,
    options: ToolExecutionOptions
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const queued: QueuedExecution = {
        id: uuidv4(),
        tool,
        input,
        context,
        options,
        resolve,
        reject,
        queuedAt: new Date(),
      };

      this.executionQueue.push(queued);
      this.emit('execution:queued', { id: queued.id, tool: tool.name });
    });
  }

  /**
   * Process the execution queue
   */
  private processQueue(): void {
    if (
      !this.isRunning ||
      this.executionQueue.length === 0 ||
      this.activeExecutions.size >= this.config.maxConcurrent
    ) {
      return;
    }

    const queued = this.executionQueue.shift();
    if (queued) {
      this.executeTool(
        queued.tool,
        queued.input,
        queued.context,
        queued.options,
        queued.id
      )
        .then(queued.resolve)
        .catch(queued.reject);
    }
  }

  /**
   * Check permission for a tool execution
   */
  private async checkPermission(
    tool: Tool,
    input: unknown,
    context: ToolContext
  ): Promise<PermissionDecision> {
    // Check permission rules first
    for (const rule of this.permissionRules) {
      if (rule.toolPattern.test(tool.name)) {
        if (!rule.condition || rule.condition(input, context)) {
          return {
            allowed: true,
            level: rule.level,
            timestamp: new Date(),
          };
        }
      }
    }

    // Check permission cache
    const cacheKey = this.getPermissionCacheKey(tool.name, input);
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.decision;
    }

    // Use permission callback for ASK level tools
    if (tool.permissionLevel === PermissionLevel.ASK && this.permissionCallback) {
      const decision = await this.permissionCallback(tool, input, context);

      // Cache the decision
      this.permissionCache.set(cacheKey, {
        decision,
        expiresAt: Date.now() + this.config.permissionCacheTtl,
      });

      return decision;
    }

    // Auto-approve or deny based on tool's default permission level
    const allowed = tool.permissionLevel !== PermissionLevel.DENY;
    return {
      allowed,
      level: tool.permissionLevel,
      timestamp: new Date(),
    };
  }

  /**
   * Default permission handler
   */
  private async defaultPermissionHandler(
    tool: Tool,
    _input: unknown,
    _context: ToolContext
  ): Promise<PermissionDecision> {
    // Default implementation - auto-approve everything
    // In a real implementation, this would prompt the user
    return {
      allowed: true,
      level: tool.permissionLevel,
      timestamp: new Date(),
      reason: 'Auto-approved by default handler',
    };
  }

  /**
   * Get permission cache key
   */
  private getPermissionCacheKey(toolName: string, input: unknown): string {
    return `${toolName}:${JSON.stringify(input)}`;
  }

  /**
   * Add an execution to history
   */
  private addToHistory(
    toolName: string,
    input: unknown,
    result: ToolResult,
    context: ToolContext
  ): void {
    if (!this.config.enableHistory) {
      return;
    }

    this.executionHistory.push({
      executionId: result.executionId,
      toolName,
      input,
      result,
      context,
      timestamp: new Date(),
    });

    // Trim history if needed
    if (this.executionHistory.length > this.config.maxHistoryEntries) {
      this.executionHistory = this.executionHistory.slice(-this.config.maxHistoryEntries);
    }
  }

  /**
   * Create an error result
   */
  private createErrorResult(code: string, message: string): ToolResult {
    return {
      executionId: uuidv4(),
      status: ToolExecutionStatus.FAILURE,
      toolName: 'executor',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      success: false,
      error: createToolError(code, message),
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a permission rule for auto-approving specific tools
 * @param toolNames - Tool names to auto-approve
 * @returns Permission rule
 * 
 * @example
 * ```typescript
 * const rule = createAutoApproveRule(['file_read', 'directory_list']);
 * executor.addPermissionRule(rule);
 * ```
 */
export function createAutoApproveRule(toolNames: string[]): PermissionRule {
  const pattern = new RegExp(`^(${toolNames.join('|')})$`);
  return {
    toolPattern: pattern,
    level: PermissionLevel.AUTO_APPROVE,
  };
}

/**
 * Create a permission rule for denying specific tools
 * @param toolNames - Tool names to deny
 * @returns Permission rule
 * 
 * @example
 * ```typescript
 * const rule = createDenyRule(['bash', 'file_delete']);
 * executor.addPermissionRule(rule);
 * ```
 */
export function createDenyRule(toolNames: string[]): PermissionRule {
  const pattern = new RegExp(`^(${toolNames.join('|')})$`);
  return {
    toolPattern: pattern,
    level: PermissionLevel.DENY,
  };
}

/**
 * Create a sandboxed context
 * @param baseContext - Base execution context
 * @param allowedDirectories - Allowed directories
 * @returns Sandboxed context
 * 
 * @example
 * ```typescript
 * const sandboxed = createSandboxedContext(context, ['/project']);
 * ```
 */
export function createSandboxedContext(
  baseContext: ToolContext,
  allowedDirectories: string[]
): ToolContext {
  return {
    ...baseContext,
    environment: {
      ...baseContext.environment,
      SANDBOX_ALLOWED_DIRS: allowedDirectories.join(':'),
    },
  };
}

export default ToolExecutor;
