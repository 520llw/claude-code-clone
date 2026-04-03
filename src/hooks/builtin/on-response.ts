/**
 * On-Response Hook
 * 
 * Built-in hook for processing LLM responses.
 * Provides parsing, validation, and logging capabilities.
 */

import {
  ResponseContext,
  ResponseHook,
  ResponseHookConfig,
  HookPriority,
  HookPhase,
  ResponseHandler
} from '../types';
import { Response } from '../../llm/types';

/**
 * Default configuration for response hooks
 */
const DEFAULT_CONFIG: ResponseHookConfig = {
  parseResponses: true,
  validateResponses: true,
  logResponses: true,
  responseSizeLimit: 100000 // 100KB
};

/**
 * Response Hook Implementation
 */
export class ResponseHookImpl {
  private config: ResponseHookConfig;

  constructor(config: Partial<ResponseHookConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main handler for response hook
   */
  async handler(context: ResponseContext): Promise<ResponseContext> {
    const { response } = context;

    // Log response if enabled
    if (this.config.logResponses) {
      this.logResponse(response, context.responseMeta);
    }

    // Check size limit
    if (this.isResponseOversized(response)) {
      console.warn('[OnResponse] Response exceeds size limit');
      context.processResponse = false;
      return context;
    }

    // Parse response if enabled
    if (this.config.parseResponses) {
      try {
        context.parsedContent = this.parseResponse(response);
      } catch (error) {
        console.warn('[OnResponse] Failed to parse response:', error);
      }
    }

    // Validate response if enabled
    if (this.config.validateResponses) {
      const validationResult = this.validateResponse(response);
      if (!validationResult.valid) {
        console.warn('[OnResponse] Response validation failed:', validationResult.errors);
        context.processResponse = false;
      }
    }

    return context;
  }

  /**
   * Log response details
   */
  private logResponse(response: Response, meta: ResponseContext['responseMeta']): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [OnResponse] Received response from ${meta.model}`);
    console.log(`  Tokens used: ${meta.tokensUsed}`);
    console.log(`  Finish reason: ${meta.finishReason}`);
    console.log(`  Latency: ${meta.latencyMs}ms`);
    
    if (response.content) {
      const preview = this.truncateString(response.content, 200);
      console.log(`  Content preview: ${preview}`);
    }
  }

  /**
   * Check if response exceeds size limit
   */
  private isResponseOversized(response: Response): boolean {
    const size = this.estimateSize(response);
    return size > this.config.responseSizeLimit;
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: unknown): number {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  }

  /**
   * Parse response content
   */
  private parseResponse(response: Response): unknown {
    if (!response.content) {
      return null;
    }

    // Try to parse as JSON
    try {
      return JSON.parse(response.content);
    } catch {
      // Not JSON, return as-is
      return response.content;
    }
  }

  /**
   * Validate response
   */
  private validateResponse(response: Response): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!response.id) {
      errors.push('Response ID is required');
    }

    if (!response.model) {
      errors.push('Response model is required');
    }

    // Check for empty content
    if (!response.content && !response.toolCalls) {
      errors.push('Response must have content or tool calls');
    }

    // Validate tool calls if present
    if (response.toolCalls) {
      if (!Array.isArray(response.toolCalls)) {
        errors.push('Tool calls must be an array');
      }
    }

    return {
      valid: errors.length === 0,
      errors
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
   * Update configuration
   */
  updateConfig(config: Partial<ResponseHookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ResponseHookConfig {
    return { ...this.config };
  }
}

/**
 * Create a response hook
 */
export function createResponseHook(
  id: string,
  name: string,
  handler: ResponseHandler,
  config?: Partial<ResponseHookConfig>
): ResponseHook {
  const impl = new ResponseHookImpl(config);

  return {
    id,
    name,
    type: 'on-response',
    description: 'Hook executed when responses are received',
    phase: HookPhase.AFTER,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler: async (context: ResponseContext): Promise<ResponseContext> => {
      // Run built-in handler first
      const modifiedContext = await impl.handler(context);
      
      // Run custom handler if response should be processed
      if (modifiedContext.processResponse) {
        return handler(modifiedContext);
      }
      
      return modifiedContext;
    },
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['response', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a response parser hook
 */
export function createResponseParser(
  parser: (content: string) => unknown
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    if (context.response.content) {
      try {
        context.parsedContent = parser(context.response.content);
      } catch (error) {
        console.warn('[OnResponse] Parser failed:', error);
      }
    }
    return context;
  };

  return {
    id: 'response-parser',
    name: 'Response Parser',
    type: 'on-response',
    description: 'Parses response content',
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
      tags: ['parser', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a response validator hook
 */
export function createResponseValidator(
  validator: (response: Response) => { valid: boolean; error?: string }
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    const validation = validator(context.response);
    
    if (!validation.valid) {
      console.warn('[OnResponse] Validation failed:', validation.error);
      context.processResponse = false;
    }

    return context;
  };

  return {
    id: 'response-validator',
    name: 'Response Validator',
    type: 'on-response',
    description: 'Validates responses',
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
      tags: ['validator', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a response logger hook
 */
export function createResponseLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
  includeContent: boolean = true,
  maxContentLength: number = 500
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    const { response, responseMeta } = context;
    const timestamp = new Date().toISOString();

    const logMessage = `[${timestamp}] [OnResponse] ${responseMeta.model} (${responseMeta.latencyMs}ms)`;
    
    const logData: Record<string, unknown> = {
      tokensUsed: responseMeta.tokensUsed,
      finishReason: responseMeta.finishReason
    };

    if (includeContent && response.content) {
      logData.content = response.content.length > maxContentLength
        ? response.content.substring(0, maxContentLength) + '...'
        : response.content;
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
    id: 'response-logger',
    name: 'Response Logger',
    type: 'on-response',
    description: 'Logs responses',
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
      tags: ['logger', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a response transformer hook
 */
export function createResponseTransformer(
  transformFn: (response: Response) => Response
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    try {
      context.modifiedResponse = transformFn(context.response);
    } catch (error) {
      console.warn('[OnResponse] Transform failed:', error);
    }
    return context;
  };

  return {
    id: 'response-transformer',
    name: 'Response Transformer',
    type: 'on-response',
    description: 'Transforms responses',
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
      tags: ['transformer', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a content filter hook
 */
export function createResponseContentFilter(
  filterFn: (content: string) => { allowed: boolean; reason?: string }
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    if (context.response.content) {
      const filterResult = filterFn(context.response.content);
      
      if (!filterResult.allowed) {
        console.warn('[OnResponse] Content filtered:', filterResult.reason);
        context.processResponse = false;
      }
    }

    return context;
  };

  return {
    id: 'response-content-filter',
    name: 'Response Content Filter',
    type: 'on-response',
    description: 'Filters response content',
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
      tags: ['filter', 'content', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a metrics collector hook
 */
export function createResponseMetricsCollector(
  metricsCollector: (metrics: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
    finishReason: string;
    timestamp: Date;
  }) => void | Promise<void>
): ResponseHook {
  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    try {
      await metricsCollector({
        model: context.responseMeta.model,
        tokensUsed: context.responseMeta.tokensUsed,
        latencyMs: context.responseMeta.latencyMs,
        finishReason: context.responseMeta.finishReason,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('[OnResponse] Metrics collection failed:', error);
    }

    return context;
  };

  return {
    id: 'response-metrics-collector',
    name: 'Response Metrics Collector',
    type: 'on-response',
    description: 'Collects response metrics',
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
      tags: ['metrics', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a response cache hook
 */
export function createResponseCache(
  ttlSeconds: number = 300,
  keyGenerator?: (response: Response) => string
): ResponseHook {
  const cache: Map<string, { response: Response; timestamp: number }> = new Map();

  const handler: ResponseHandler = async (context: ResponseContext): Promise<ResponseContext> => {
    const key = keyGenerator 
      ? keyGenerator(context.response)
      : context.response.id;

    // Store in cache
    cache.set(key, {
      response: context.response,
      timestamp: Date.now()
    });

    // Clean up expired entries
    const ttlMs = ttlSeconds * 1000;
    const now = Date.now();
    for (const [k, entry] of cache) {
      if (now - entry.timestamp > ttlMs) {
        cache.delete(k);
      }
    }

    return context;
  };

  return {
    id: 'response-cache',
    name: 'Response Cache',
    type: 'on-response',
    description: 'Caches responses',
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
      tags: ['cache', 'response'],
      dependencies: [],
      dependents: []
    }
  };
}
