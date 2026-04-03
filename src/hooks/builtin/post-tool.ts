/**
 * Post-Tool Hook
 * 
 * Built-in hook for executing actions after tool calls.
 * Provides logging, caching, and result processing capabilities.
 */

import {
  PostToolContext,
  PostToolHook,
  PostToolConfig,
  HookPriority,
  HookPhase,
  PostToolHandler
} from '../types';
import { ToolCall, ToolResult } from '../../tools/types';

/**
 * Default configuration for post-tool hooks
 */
const DEFAULT_CONFIG: PostToolConfig = {
  logResults: true,
  cacheResults: false,
  cacheTtlSeconds: 300,
  resultSizeLimit: 1024 * 1024 // 1MB
};

/**
 * Cache entry
 */
interface CacheEntry {
  result: ToolResult;
  timestamp: number;
  toolCallId: string;
}

/**
 * Post-Tool Hook Implementation
 */
export class PostToolHookImpl {
  private config: PostToolConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<PostToolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.cacheResults) {
      this.startCacheCleanup();
    }
  }

  /**
   * Main handler for post-tool hook
   */
  async handler(context: PostToolContext): Promise<PostToolContext> {
    const { toolCall, result, durationMs, success } = context;

    // Log results if enabled
    if (this.config.logResults) {
      this.logResult(toolCall, result, durationMs, success);
    }

    // Cache result if enabled
    if (this.config.cacheResults && success) {
      this.cacheResult(toolCall, result);
    }

    // Check result size
    if (this.isResultOversized(result)) {
      console.warn(`[PostTool] Result for '${toolCall.name}' exceeds size limit`);
      context.modifiedResult = this.truncateResult(result);
    }

    return context;
  }

  /**
   * Log tool result
   */
  private logResult(
    toolCall: ToolCall,
    result: ToolResult,
    durationMs: number,
    success: boolean
  ): void {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILURE';
    
    console.log(`[${timestamp}] [PostTool] ${toolCall.name} - ${status}`);
    console.log(`  Duration: ${durationMs}ms`);
    
    if (result.content) {
      const contentPreview = this.truncateString(result.content, 200);
      console.log(`  Content: ${contentPreview}`);
    }
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  /**
   * Cache a result
   */
  private cacheResult(toolCall: ToolCall, result: ToolResult): void {
    const cacheKey = this.generateCacheKey(toolCall);
    
    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now(),
      toolCallId: toolCall.id
    });
  }

  /**
   * Get cached result
   */
  getCachedResult(toolCall: ToolCall): ToolResult | undefined {
    const cacheKey = this.generateCacheKey(toolCall);
    const entry = this.cache.get(cacheKey);

    if (!entry) return undefined;

    // Check if expired
    const ttlMs = this.config.cacheTtlSeconds * 1000;
    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Generate cache key for tool call
   */
  private generateCacheKey(toolCall: ToolCall): string {
    return `${toolCall.name}:${JSON.stringify(toolCall.parameters)}`;
  }

  /**
   * Check if result exceeds size limit
   */
  private isResultOversized(result: ToolResult): boolean {
    const size = this.estimateSize(result);
    return size > this.config.resultSizeLimit;
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: unknown): number {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  }

  /**
   * Truncate result to size limit
   */
  private truncateResult(result: ToolResult): ToolResult {
    return {
      ...result,
      content: this.truncateString(result.content, 1000),
      metadata: {
        ...result.metadata,
        truncated: true,
        originalSize: this.estimateSize(result)
      }
    };
  }

  /**
   * Truncate string
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    const intervalMs = this.config.cacheTtlSeconds * 1000;
    
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      const ttlMs = this.config.cacheTtlSeconds * 1000;

      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > ttlMs) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }

  /**
   * Stop cache cleanup
   */
  stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would track in full implementation
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PostToolConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.cacheResults && !this.cacheCleanupInterval) {
      this.startCacheCleanup();
    } else if (!this.config.cacheResults && this.cacheCleanupInterval) {
      this.stopCacheCleanup();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PostToolConfig {
    return { ...this.config };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopCacheCleanup();
    this.cache.clear();
  }
}

/**
 * Create a post-tool hook
 */
export function createPostToolHook(
  id: string,
  name: string,
  handler: PostToolHandler,
  config?: Partial<PostToolConfig>
): PostToolHook {
  const impl = new PostToolHookImpl(config);

  return {
    id,
    name,
    type: 'post-tool',
    description: 'Hook executed after tool calls',
    phase: HookPhase.AFTER,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler: async (context: PostToolContext): Promise<PostToolContext> => {
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
      tags: ['post-tool', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool result logger hook
 */
export function createPostToolLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
  includeContent: boolean = true,
  maxContentLength: number = 500
): PostToolHook {
  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    const { toolCall, result, durationMs, success } = context;
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILURE';

    const logMessage = `[${timestamp}] [PostTool] ${toolCall.name} - ${status} (${durationMs}ms)`;
    
    const logData: Record<string, unknown> = {};
    if (includeContent && result.content) {
      logData.content = result.content.length > maxContentLength 
        ? result.content.substring(0, maxContentLength) + '...'
        : result.content;
    }
    if (result.error) {
      logData.error = result.error;
    }

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
    id: 'post-tool-logger',
    name: 'Post-Tool Logger',
    type: 'post-tool',
    description: 'Logs tool results after execution',
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
      tags: ['logger', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool result cache hook
 */
export function createPostToolCache(
  ttlSeconds: number = 300,
  keyGenerator?: (toolCall: ToolCall) => string
): PostToolHook {
  const cache: Map<string, CacheEntry> = new Map();

  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    if (!context.success) return context;

    const key = keyGenerator 
      ? keyGenerator(context.toolCall)
      : `${context.toolCall.name}:${JSON.stringify(context.toolCall.parameters)}`;

    cache.set(key, {
      result: context.result,
      timestamp: Date.now(),
      toolCallId: context.toolCall.id
    });

    return context;
  };

  return {
    id: 'post-tool-cache',
    name: 'Post-Tool Cache',
    type: 'post-tool',
    description: 'Caches tool results',
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
      tags: ['cache', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a result processor hook
 */
export function createPostToolResultProcessor(
  processor: (result: ToolResult, toolCall: ToolCall) => ToolResult | Promise<ToolResult>
): PostToolHook {
  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    try {
      context.modifiedResult = await processor(context.result, context.toolCall);
    } catch (error) {
      console.warn('Result processing failed:', error);
    }
    return context;
  };

  return {
    id: 'post-tool-result-processor',
    name: 'Post-Tool Result Processor',
    type: 'post-tool',
    description: 'Processes tool results',
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
      tags: ['processor', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a metrics collector hook
 */
export function createPostToolMetricsCollector(
  metricsCollector: (metrics: {
    tool: string;
    durationMs: number;
    success: boolean;
    timestamp: Date;
  }) => void | Promise<void>
): PostToolHook {
  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    try {
      await metricsCollector({
        tool: context.toolCall.name,
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
    id: 'post-tool-metrics-collector',
    name: 'Post-Tool Metrics Collector',
    type: 'post-tool',
    description: 'Collects metrics on tool execution',
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
      tags: ['metrics', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a result validator hook
 */
export function createPostToolResultValidator(
  validator: (result: ToolResult) => { valid: boolean; error?: string }
): PostToolHook {
  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    const validation = validator(context.result);
    
    if (!validation.valid) {
      console.warn(`[PostTool] Result validation failed for '${context.toolCall.name}':`, validation.error);
    }

    return context;
  };

  return {
    id: 'post-tool-result-validator',
    name: 'Post-Tool Result Validator',
    type: 'post-tool',
    description: 'Validates tool results',
    phase: HookPhase.AFTER,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['validator', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a cleanup hook
 */
export function createPostToolCleanup(
  cleanupFn: (toolCall: ToolCall, result: ToolResult) => void | Promise<void>
): PostToolHook {
  const handler: PostToolHandler = async (context: PostToolContext): Promise<PostToolContext> => {
    try {
      await cleanupFn(context.toolCall, context.result);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    return context;
  };

  return {
    id: 'post-tool-cleanup',
    name: 'Post-Tool Cleanup',
    type: 'post-tool',
    description: 'Performs cleanup after tool execution',
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
      tags: ['cleanup', 'post-tool'],
      dependencies: [],
      dependents: []
    }
  };
}
