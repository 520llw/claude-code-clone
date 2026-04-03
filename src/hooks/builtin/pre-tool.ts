/**
 * Pre-Tool Hook
 * 
 * Built-in hook for executing actions before tool calls.
 * Provides validation, logging, and rate limiting capabilities.
 */

import {
  PreToolContext,
  PreToolHook,
  PreToolConfig,
  HookPriority,
  HookPhase,
  PreToolHandler
} from '../types';
import { ToolCall } from '../../tools/types';

/**
 * Default configuration for pre-tool hooks
 */
const DEFAULT_CONFIG: PreToolConfig = {
  validateToolCalls: true,
  logToolCalls: true,
  rateLimiting: false,
  maxCallsPerMinute: 60
};

/**
 * Rate limiter state
 */
interface RateLimitState {
  calls: number[];
  windowStart: number;
}

/**
 * Pre-Tool Hook Implementation
 */
export class PreToolHookImpl {
  private config: PreToolConfig;
  private rateLimits: Map<string, RateLimitState> = new Map();

  constructor(config: Partial<PreToolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main handler for pre-tool hook
   */
  async handler(context: PreToolContext): Promise<PreToolContext> {
    const { toolCall } = context;

    // Log tool call if enabled
    if (this.config.logToolCalls) {
      this.logToolCall(toolCall);
    }

    // Validate tool call if enabled
    if (this.config.validateToolCalls) {
      const validationResult = this.validateToolCall(toolCall);
      if (!validationResult.valid) {
        context.validationErrors.push(...validationResult.errors);
        context.skipTool = true;
        return context;
      }
    }

    // Check rate limit if enabled
    if (this.config.rateLimiting) {
      const rateLimitResult = this.checkRateLimit(toolCall);
      if (!rateLimitResult.allowed) {
        context.validationErrors.push(rateLimitResult.reason!);
        context.skipTool = true;
        return context;
      }
    }

    return context;
  }

  /**
   * Log tool call details
   */
  private logToolCall(toolCall: ToolCall): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PreTool] Calling tool: ${toolCall.name}`);
    console.log(`  Tool ID: ${toolCall.id}`);
    if (toolCall.parameters) {
      console.log(`  Parameters: ${JSON.stringify(toolCall.parameters, null, 2)}`);
    }
  }

  /**
   * Validate a tool call
   */
  private validateToolCall(toolCall: ToolCall): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!toolCall.id) {
      errors.push('Tool call ID is required');
    }

    if (!toolCall.name) {
      errors.push('Tool name is required');
    }

    // Validate parameters
    if (toolCall.parameters) {
      if (typeof toolCall.parameters !== 'object') {
        errors.push('Tool parameters must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check rate limit for tool
   */
  private checkRateLimit(toolCall: ToolCall): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const toolName = toolCall.name;

    // Get or initialize rate limit state
    let state = this.rateLimits.get(toolName);
    if (!state || now - state.windowStart > windowMs) {
      state = { calls: [], windowStart: now };
    }

    // Remove old calls outside the window
    state.calls = state.calls.filter(time => now - time < windowMs);

    // Check if limit exceeded
    if (state.calls.length >= this.config.maxCallsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxCallsPerMinute} calls per minute for tool '${toolName}'`
      };
    }

    // Record this call
    state.calls.push(now);
    this.rateLimits.set(toolName, state);

    return { allowed: true };
  }

  /**
   * Reset rate limit for a tool
   */
  resetRateLimit(toolName: string): void {
    this.rateLimits.delete(toolName);
  }

  /**
   * Reset all rate limits
   */
  resetAllRateLimits(): void {
    this.rateLimits.clear();
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(toolName: string): { current: number; limit: number; remaining: number } {
    const state = this.rateLimits.get(toolName);
    const current = state ? state.calls.length : 0;
    
    return {
      current,
      limit: this.config.maxCallsPerMinute,
      remaining: Math.max(0, this.config.maxCallsPerMinute - current)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PreToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PreToolConfig {
    return { ...this.config };
  }
}

/**
 * Create a pre-tool hook
 */
export function createPreToolHook(
  id: string,
  name: string,
  handler: PreToolHandler,
  config?: Partial<PreToolConfig>
): PreToolHook {
  const impl = new PreToolHookImpl(config);

  return {
    id,
    name,
    type: 'pre-tool',
    description: 'Hook executed before tool calls',
    phase: HookPhase.BEFORE,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler: async (context: PreToolContext): Promise<PreToolContext> => {
      // Run built-in handler first
      const modifiedContext = await impl.handler(context);
      
      // Run custom handler if tool wasn't skipped
      if (!modifiedContext.skipTool) {
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
      tags: ['pre-tool', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool validator hook
 */
export function createPreToolValidator(
  customValidators?: Array<(toolCall: ToolCall) => { valid: boolean; error?: string }>
): PreToolHook {
  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    const { toolCall } = context;

    // Run custom validators
    if (customValidators) {
      for (const validator of customValidators) {
        const result = validator(toolCall);
        if (!result.valid) {
          context.validationErrors.push(result.error || 'Validation failed');
          context.skipTool = true;
          break;
        }
      }
    }

    return context;
  };

  return {
    id: 'pre-tool-validator',
    name: 'Pre-Tool Validator',
    type: 'pre-tool',
    description: 'Validates tool calls before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['validator', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool logger hook
 */
export function createPreToolLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
  logParameters: boolean = true
): PreToolHook {
  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    const { toolCall } = context;
    const timestamp = new Date().toISOString();

    const logMessage = `[${timestamp}] [PreTool] ${toolCall.name}`;
    const logData = logParameters ? { parameters: toolCall.parameters } : {};

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
    id: 'pre-tool-logger',
    name: 'Pre-Tool Logger',
    type: 'pre-tool',
    description: 'Logs tool calls before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.CRITICAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['logger', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool rate limiter hook
 */
export function createPreToolRateLimiter(
  maxCallsPerMinute: number,
  perTool: boolean = true
): PreToolHook {
  const rateLimits: Map<string, RateLimitState> = new Map();

  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    const now = Date.now();
    const windowMs = 60000;
    const key = perTool ? context.toolCall.name : 'global';

    // Get or initialize rate limit state
    let state = rateLimits.get(key);
    if (!state || now - state.windowStart > windowMs) {
      state = { calls: [], windowStart: now };
    }

    // Remove old calls
    state.calls = state.calls.filter(time => now - time < windowMs);

    // Check limit
    if (state.calls.length >= maxCallsPerMinute) {
      context.validationErrors.push(
        `Rate limit exceeded: ${maxCallsPerMinute} calls per minute${perTool ? ` for tool '${key}'` : ''}`
      );
      context.skipTool = true;
      return context;
    }

    // Record call
    state.calls.push(now);
    rateLimits.set(key, state);

    return context;
  };

  return {
    id: 'pre-tool-rate-limiter',
    name: 'Pre-Tool Rate Limiter',
    type: 'pre-tool',
    description: 'Rate limits tool calls',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['rate-limiter', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool transformer hook
 */
export function createPreToolTransformer(
  transformFn: (toolCall: ToolCall) => ToolCall
): PreToolHook {
  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    try {
      context.modifiedToolCall = transformFn(context.toolCall);
    } catch (error) {
      context.validationErrors.push(`Transform failed: ${error}`);
      context.skipTool = true;
    }
    return context;
  };

  return {
    id: 'pre-tool-transformer',
    name: 'Pre-Tool Transformer',
    type: 'pre-tool',
    description: 'Transforms tool calls before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['transformer', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool whitelist/blacklist hook
 */
export function createPreToolAccessControl(
  allowedTools?: string[],
  blockedTools?: string[]
): PreToolHook {
  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    const toolName = context.toolCall.name;

    // Check whitelist
    if (allowedTools && allowedTools.length > 0) {
      if (!allowedTools.includes(toolName)) {
        context.validationErrors.push(`Tool '${toolName}' is not in the allowed list`);
        context.skipTool = true;
        return context;
      }
    }

    // Check blacklist
    if (blockedTools && blockedTools.length > 0) {
      if (blockedTools.includes(toolName)) {
        context.validationErrors.push(`Tool '${toolName}' is blocked`);
        context.skipTool = true;
        return context;
      }
    }

    return context;
  };

  return {
    id: 'pre-tool-access-control',
    name: 'Pre-Tool Access Control',
    type: 'pre-tool',
    description: 'Controls access to tools via whitelist/blacklist',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['access-control', 'security', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a tool parameter sanitizer hook
 */
export function createPreToolParameterSanitizer(
  sanitizer: (parameters: Record<string, unknown>) => Record<string, unknown>
): PreToolHook {
  const handler: PreToolHandler = async (context: PreToolContext): Promise<PreToolContext> => {
    if (context.toolCall.parameters) {
      context.modifiedToolCall = {
        ...context.toolCall,
        parameters: sanitizer(context.toolCall.parameters)
      };
    }
    return context;
  };

  return {
    id: 'pre-tool-parameter-sanitizer',
    name: 'Pre-Tool Parameter Sanitizer',
    type: 'pre-tool',
    description: 'Sanitizes tool parameters before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['sanitizer', 'security', 'pre-tool'],
      dependencies: [],
      dependents: []
    }
  };
}
