/**
 * Post-Command Hook
 * 
 * Built-in hook for executing actions after command execution.
 * Provides logging, history tracking, and notification capabilities.
 */

import {
  PostCommandContext,
  PostCommandHook,
  PostCommandConfig,
  HookPriority,
  HookPhase,
  PostCommandHandler
} from '../types';
import { Command, CommandResult } from '../../commands/types';

/**
 * Default configuration for post-command hooks
 */
const DEFAULT_CONFIG: PostCommandConfig = {
  logResults: true,
  storeHistory: true,
  enableTransformation: false,
  notifyOnSuccess: false,
  notifyOnFailure: true
};

/**
 * Command history entry
 */
interface CommandHistoryEntry {
  command: Command;
  result: CommandResult;
  timestamp: Date;
  durationMs: number;
  success: boolean;
}

/**
 * Post-Command Hook Implementation
 */
export class PostCommandHookImpl {
  private config: PostCommandConfig;
  private history: CommandHistoryEntry[] = [];
  private maxHistorySize: number = 1000;

  constructor(config: Partial<PostCommandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main handler for post-command hook
   */
  async handler(context: PostCommandContext): Promise<PostCommandContext> {
    const { command, result, durationMs, success } = context;

    // Log results if enabled
    if (this.config.logResults) {
      this.logResult(command, result, durationMs, success);
    }

    // Store history if enabled
    if (this.config.storeHistory) {
      this.addToHistory({
        command,
        result,
        timestamp: new Date(),
        durationMs,
        success
      });
    }

    // Send notifications if enabled
    if (success && this.config.notifyOnSuccess) {
      this.notifySuccess(command, result);
    }

    if (!success && this.config.notifyOnFailure) {
      this.notifyFailure(command, context.error);
    }

    // Apply transformation if enabled
    if (this.config.enableTransformation) {
      context.modifiedResult = this.transformResult(result);
    }

    return context;
  }

  /**
   * Log command result
   */
  private logResult(
    command: Command,
    result: CommandResult,
    durationMs: number,
    success: boolean
  ): void {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILURE';
    
    console.log(`[${timestamp}] [PostCommand] ${command.name} - ${status}`);
    console.log(`  Duration: ${durationMs}ms`);
    
    if (result.output) {
      console.log(`  Output: ${result.output}`);
    }
    
    if (result.exitCode !== undefined) {
      console.log(`  Exit Code: ${result.exitCode}`);
    }
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: CommandHistoryEntry): void {
    this.history.push(entry);
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Notify on success
   */
  private notifySuccess(command: Command, result: CommandResult): void {
    console.log(`[PostCommand] Command '${command.name}' executed successfully`);
  }

  /**
   * Notify on failure
   */
  private notifyFailure(command: Command, error?: Error): void {
    console.error(`[PostCommand] Command '${command.name}' failed:`, error?.message);
  }

  /**
   * Transform result
   */
  private transformResult(result: CommandResult): CommandResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        transformedAt: new Date().toISOString(),
        transformVersion: '1.0.0'
      }
    };
  }

  /**
   * Get command history
   */
  getHistory(): CommandHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get history for a specific command
   */
  getHistoryForCommand(commandName: string): CommandHistoryEntry[] {
    return this.history.filter(entry => entry.command.name === commandName);
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.history.length === 0) return 0;
    const successes = this.history.filter(entry => entry.success).length;
    return (successes / this.history.length) * 100;
  }

  /**
   * Get average execution time
   */
  getAverageExecutionTime(): number {
    if (this.history.length === 0) return 0;
    const total = this.history.reduce((sum, entry) => sum + entry.durationMs, 0);
    return total / this.history.length;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PostCommandConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PostCommandConfig {
    return { ...this.config };
  }
}

/**
 * Create a post-command hook
 */
export function createPostCommandHook(
  id: string,
  name: string,
  handler: PostCommandHandler,
  config?: Partial<PostCommandConfig>
): PostCommandHook {
  const impl = new PostCommandHookImpl(config);

  return {
    id,
    name,
    type: 'post-command',
    description: 'Hook executed after command execution',
    phase: HookPhase.AFTER,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler: async (context: PostCommandContext): Promise<PostCommandContext> => {
      // Run built-in handler first
      const modifiedContext = await impl.handler(context);
      
      // Run custom handler
      return handler(modifiedContext);
    },
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['post-command', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a post-command logger hook
 */
export function createPostCommandLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
  includeOutput: boolean = true
): PostCommandHook {
  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    const { command, result, durationMs, success } = context;
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILURE';

    const logMessage = `[${timestamp}] [PostCommand] ${command.name} - ${status} (${durationMs}ms)`;
    const logData = includeOutput ? { output: result.output, exitCode: result.exitCode } : {};

    switch (logLevel) {
      case 'debug':
        console.debug(logMessage, logData);
        break;
      case 'info':
        console.info(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'error':
        console.error(logMessage, logData);
        break;
    }

    return context;
  };

  return {
    id: 'post-command-logger',
    name: 'Post-Command Logger',
    type: 'post-command',
    description: 'Logs command results after execution',
    phase: HookPhase.AFTER,
    priority: HookPriority.CRITICAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['logger', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a command history tracker hook
 */
export function createPostCommandHistoryTracker(
  maxEntries: number = 1000,
  filter?: (entry: CommandHistoryEntry) => boolean
): PostCommandHook {
  const history: CommandHistoryEntry[] = [];

  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    const entry: CommandHistoryEntry = {
      command: context.command,
      result: context.result,
      timestamp: new Date(),
      durationMs: context.durationMs,
      success: context.success
    };

    // Apply filter if provided
    if (filter && !filter(entry)) {
      return context;
    }

    history.push(entry);

    // Trim history if needed
    if (history.length > maxEntries) {
      history.shift();
    }

    return context;
  };

  return {
    id: 'post-command-history-tracker',
    name: 'Post-Command History Tracker',
    type: 'post-command',
    description: 'Tracks command execution history',
    phase: HookPhase.AFTER,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['history', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a post-command notifier hook
 */
export function createPostCommandNotifier(
  onSuccess?: (command: Command, result: CommandResult) => void | Promise<void>,
  onFailure?: (command: Command, error?: Error) => void | Promise<void>
): PostCommandHook {
  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    if (context.success && onSuccess) {
      await onSuccess(context.command, context.result);
    }

    if (!context.success && onFailure) {
      await onFailure(context.command, context.error);
    }

    return context;
  };

  return {
    id: 'post-command-notifier',
    name: 'Post-Command Notifier',
    type: 'post-command',
    description: 'Notifies on command completion',
    phase: HookPhase.AFTER,
    priority: HookPriority.LOW,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['notifier', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a metrics collector hook
 */
export function createPostCommandMetricsCollector(
  metricsCollector: (metrics: {
    command: string;
    durationMs: number;
    success: boolean;
    timestamp: Date;
  }) => void | Promise<void>
): PostCommandHook {
  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    try {
      await metricsCollector({
        command: context.command.name,
        durationMs: context.durationMs,
        success: context.success,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('Metrics collection failed:', error);
    }
    return context;
  };

  return {
    id: 'post-command-metrics-collector',
    name: 'Post-Command Metrics Collector',
    type: 'post-command',
    description: 'Collects metrics on command execution',
    phase: HookPhase.AFTER,
    priority: HookPriority.BACKGROUND,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['metrics', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a result processor hook
 */
export function createPostCommandResultProcessor(
  processor: (result: CommandResult, context: PostCommandContext) => CommandResult | Promise<CommandResult>
): PostCommandHook {
  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    try {
      context.modifiedResult = await processor(context.result, context);
    } catch (error) {
      console.warn('Result processing failed:', error);
    }
    return context;
  };

  return {
    id: 'post-command-result-processor',
    name: 'Post-Command Result Processor',
    type: 'post-command',
    description: 'Processes command results',
    phase: HookPhase.AFTER,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['processor', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a cleanup hook
 */
export function createPostCommandCleanup(
  cleanupFn: (command: Command, result: CommandResult) => void | Promise<void>
): PostCommandHook {
  const handler: PostCommandHandler = async (context: PostCommandContext): Promise<PostCommandContext> => {
    try {
      await cleanupFn(context.command, context.result);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    return context;
  };

  return {
    id: 'post-command-cleanup',
    name: 'Post-Command Cleanup',
    type: 'post-command',
    description: 'Performs cleanup after command execution',
    phase: HookPhase.AFTER,
    priority: HookPriority.LOW,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['cleanup', 'post-command'],
      dependencies: [],
      dependents: []
    }
  };
}
