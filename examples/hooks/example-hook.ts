/**
 * Example Hook
 * 
 * This file demonstrates how to create custom hooks for the Claude Code
 * hooks system. It includes examples of all hook types with various
 * configurations and use cases.
 */

import {
  // Core types
  HookDefinition,
  HookPriority,
  HookPhase,
  
  // Context types
  PreCommandContext,
  PostCommandContext,
  PreToolContext,
  PostToolContext,
  ErrorContext,
  ResponseContext,
  
  // Built-in hook creators
  createPreCommandHook,
  createPostCommandHook,
  createPreToolHook,
  createPostToolHook,
  createErrorHook,
  createResponseHook,
  
  // Utilities
  createHook,
  composeHooks,
  conditionalHook,
  withRetry,
  withTimeout,
  withLogging,
  
  // Registry and Engine
  HookRegistry,
  HookEngine,
  HookRunner,
  getHooksManager
} from '../../src/hooks';

// ============================================================================
// Example 1: Simple Pre-Command Hook
// ============================================================================

/**
 * A simple hook that logs commands before they execute
 */
export const simplePreCommandHook = createPreCommandHook(
  'example.simple-pre-command',
  'Simple Pre-Command Logger',
  async (context: PreCommandContext): Promise<PreCommandContext> => {
    console.log(`[Example] About to execute command: ${context.command.name}`);
    console.log(`[Example] Arguments:`, context.command.args);
    return context;
  },
  {
    logCommands: true,
    validateCommands: false
  }
);

// ============================================================================
// Example 2: Permission Check Hook
// ============================================================================

/**
 * A hook that checks user permissions before executing commands
 */
export const permissionCheckHook = createPreCommandHook(
  'example.permission-check',
  'Permission Checker',
  async (context: PreCommandContext): Promise<PreCommandContext> => {
    const allowedCommands = ['read', 'search', 'help'];
    
    if (!allowedCommands.includes(context.command.name)) {
      console.warn(`[Example] Permission denied for command: ${context.command.name}`);
      context.cancel = true;
      context.cancelReason = 'Insufficient permissions';
    }
    
    return context;
  },
  {
    priority: HookPriority.HIGH
  }
);

// ============================================================================
// Example 3: Command Transformation Hook
// ============================================================================

/**
 * A hook that transforms commands before execution
 */
export const commandTransformHook = createPreCommandHook(
  'example.command-transformer',
  'Command Transformer',
  async (context: PreCommandContext): Promise<PreCommandContext> => {
    // Add default timeout to all commands
    context.modifiedCommand = {
      ...context.command,
      options: {
        ...context.command.options,
        timeout: context.command.options?.timeout || 30000
      }
    };
    
    console.log(`[Example] Transformed command with default timeout`);
    return context;
  },
  {
    enableTransformation: true
  }
);

// ============================================================================
// Example 4: Post-Command Metrics Hook
// ============================================================================

/**
 * A hook that collects metrics after command execution
 */
export const postCommandMetricsHook = createPostCommandHook(
  'example.post-command-metrics',
  'Command Metrics Collector',
  async (context: PostCommandContext): Promise<PostCommandContext> => {
    const metrics = {
      command: context.command.name,
      durationMs: context.durationMs,
      success: context.success,
      timestamp: new Date().toISOString()
    };
    
    // In a real implementation, send to metrics service
    console.log(`[Example] Command metrics:`, metrics);
    
    return context;
  }
);

// ============================================================================
// Example 5: Pre-Tool Rate Limiter
// ============================================================================

/**
 * A hook that rate limits tool calls
 */
export const toolRateLimiterHook = createPreToolHook(
  'example.tool-rate-limiter',
  'Tool Rate Limiter',
  async (context: PreToolContext): Promise<PreToolContext> => {
    const callCounts = new Map<string, number>();
    const toolName = context.toolCall.name;
    const currentCount = callCounts.get(toolName) || 0;
    
    if (currentCount >= 10) {
      console.warn(`[Example] Rate limit exceeded for tool: ${toolName}`);
      context.skipTool = true;
      context.validationErrors.push('Rate limit exceeded');
    } else {
      callCounts.set(toolName, currentCount + 1);
    }
    
    return context;
  },
  {
    rateLimiting: true,
    maxCallsPerMinute: 10
  }
);

// ============================================================================
// Example 6: Post-Tool Result Cache
// ============================================================================

/**
 * A hook that caches tool results
 */
const toolCache = new Map<string, { result: unknown; timestamp: number }>();

export const toolCacheHook = createPostToolHook(
  'example.tool-cache',
  'Tool Result Cache',
  async (context: PostToolContext): Promise<PostToolContext> => {
    if (context.success) {
      const cacheKey = `${context.toolCall.name}:${JSON.stringify(context.toolCall.parameters)}`;
      
      toolCache.set(cacheKey, {
        result: context.result,
        timestamp: Date.now()
      });
      
      console.log(`[Example] Cached result for: ${cacheKey}`);
    }
    
    return context;
  },
  {
    cacheResults: true,
    cacheTtlSeconds: 300
  }
);

// ============================================================================
// Example 7: Error Handler with Retry
// ============================================================================

/**
 * A hook that handles errors with automatic retry
 */
export const errorRetryHook = createErrorHook(
  'example.error-retry',
  'Error Retry Handler',
  async (context: ErrorContext): Promise<ErrorContext> => {
    const retryableErrors = ['NetworkError', 'TimeoutError'];
    const errorType = context.error.constructor.name;
    
    if (retryableErrors.includes(errorType) && context.retryCount < context.maxRetries) {
      console.log(`[Example] Retrying after error: ${context.error.message}`);
      context.recoveryAction = 'retry';
      context.handled = true;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (context.retryCount + 1)));
    }
    
    return context;
  },
  ['NetworkError', 'TimeoutError', 'ServiceUnavailableError'],
  {
    enableRetry: true,
    maxRetries: 3,
    retryDelayMs: 1000
  }
);

// ============================================================================
// Example 8: Response Parser Hook
// ============================================================================

/**
 * A hook that parses JSON responses
 */
export const responseParserHook = createResponseHook(
  'example.response-parser',
  'JSON Response Parser',
  async (context: ResponseContext): Promise<ResponseContext> => {
    if (context.response.content) {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(context.response.content);
        context.parsedContent = parsed;
        console.log(`[Example] Parsed response as JSON`);
      } catch {
        // Not JSON, keep as string
        context.parsedContent = context.response.content;
      }
    }
    
    return context;
  },
  {
    parseResponses: true,
    validateResponses: true
  }
);

// ============================================================================
// Example 9: Custom Hook with createHook
// ============================================================================

/**
 * A completely custom hook using the base createHook function
 */
export const customAuditHook = createHook(
  'example.custom-audit',
  'Custom Audit Hook',
  'pre-command',
  async (context: PreCommandContext): Promise<PreCommandContext> => {
    // Log audit information
    const auditEntry = {
      command: context.command.name,
      args: context.command.args,
      user: context.agentContext.userId,
      timestamp: new Date().toISOString(),
      sessionId: context.agentContext.sessionId
    };
    
    console.log(`[Example] Audit entry:`, auditEntry);
    
    return context;
  },
  {
    priority: HookPriority.LOW,
    phase: HookPhase.BEFORE,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['audit', 'security'],
      dependencies: [],
      dependents: []
    }
  }
);

// ============================================================================
// Example 10: Composed Hook
// ============================================================================

/**
 * Example of composing multiple hook handlers
 */
const logHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
  console.log(`[Composed] Logging: ${context.command.name}`);
  return context;
};

const validateHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
  if (!context.command.name) {
    context.cancel = true;
    context.cancelReason = 'Command name is required';
  }
  return context;
};

const transformHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
  context.modifiedCommand = {
    ...context.command,
    metadata: {
      ...context.command.metadata,
      processed: true
    }
  };
  return context;
};

export const composedHook = createPreCommandHook(
  'example.composed-hook',
  'Composed Hook',
  composeHooks([logHandler, validateHandler, transformHandler])
);

// ============================================================================
// Example 11: Conditional Hook
// ============================================================================

/**
 * A hook that only executes under certain conditions
 */
export const conditionalDebugHook = createPreCommandHook(
  'example.conditional-debug',
  'Conditional Debug Hook',
  conditionalHook(
    (context: PreCommandContext) => {
      // Only execute in debug mode
      return context.agentContext.debug === true;
    },
    async (context: PreCommandContext): Promise<PreCommandContext> => {
      console.log(`[Debug] Command details:`, JSON.stringify(context.command, null, 2));
      return context;
    }
  )
);

// ============================================================================
// Example 12: Hook with Retry Wrapper
// ============================================================================

/**
 * A hook with automatic retry logic
 */
export const retryableHook = createPreToolHook(
  'example.retryable-hook',
  'Retryable Tool Hook',
  withRetry(
    async (context: PreToolContext): Promise<PreToolContext> => {
      // Simulate an operation that might fail
      if (Math.random() < 0.5) {
        throw new Error('Random failure');
      }
      
      console.log(`[Example] Retryable hook succeeded`);
      return context;
    },
    3, // max retries
    500 // initial delay
  )
);

// ============================================================================
// Example 13: Hook with Timeout
// ============================================================================

/**
 * A hook with a timeout
 */
export const timeoutHook = createPreCommandHook(
  'example.timeout-hook',
  'Timeout Hook',
  withTimeout(
    async (context: PreCommandContext): Promise<PreCommandContext> => {
      // Simulate a slow operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`[Example] Timeout hook completed`);
      return context;
    },
    5000 // 5 second timeout
  )
);

// ============================================================================
// Example 14: Hook with Logging Wrapper
// ============================================================================

/**
 * A hook with detailed logging
 */
export const loggedHook = createPostCommandHook(
  'example.logged-hook',
  'Logged Hook',
  withLogging(
    async (context: PostCommandContext): Promise<PostCommandContext> => {
      // Process the result
      if (context.result.output) {
        console.log(`[Example] Output length: ${context.result.output.length}`);
      }
      
      return context;
    },
    'PostCommandProcessor'
  )
);

// ============================================================================
// Example 15: Complete Hook Registration Example
// ============================================================================

/**
 * Example of registering and using hooks
 */
export async function exampleHookRegistration(): Promise<void> {
  // Get the hooks manager
  const manager = getHooksManager();
  
  // Initialize
  await manager.initialize();
  
  // Register hooks
  manager.register(simplePreCommandHook);
  manager.register(permissionCheckHook);
  manager.register(commandTransformHook);
  manager.register(postCommandMetricsHook);
  manager.register(toolRateLimiterHook);
  manager.register(toolCacheHook);
  manager.register(errorRetryHook);
  manager.register(responseParserHook);
  
  console.log('[Example] All hooks registered successfully');
  
  // Get registry info
  const registry = manager.getRegistry();
  console.log(`[Example] Registered hooks: ${registry.size}`);
  
  // Shutdown
  await manager.shutdown();
}

// ============================================================================
// Example 16: Custom Hook Factory
// ============================================================================

/**
 * Factory function for creating notification hooks
 */
export function createNotificationHook(
  id: string,
  name: string,
  notifyFn: (message: string) => void | Promise<void>
): HookDefinition<PostCommandContext> {
  return createPostCommandHook(
    id,
    name,
    async (context: PostCommandContext): Promise<PostCommandContext> => {
      const message = context.success
        ? `Command ${context.command.name} completed successfully`
        : `Command ${context.command.name} failed: ${context.error?.message}`;
      
      await notifyFn(message);
      return context;
    }
  );
}

// ============================================================================
// Example 17: Metrics Aggregation Hook
// ============================================================================

/**
 * Hook that aggregates metrics over time
 */
class MetricsAggregator {
  private metrics: Array<{
    tool: string;
    durationMs: number;
    success: boolean;
    timestamp: Date;
  }> = [];

  add(metric: { tool: string; durationMs: number; success: boolean }): void {
    this.metrics.push({ ...metric, timestamp: new Date() });
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  getAverageDuration(tool: string): number {
    const toolMetrics = this.metrics.filter(m => m.tool === tool);
    if (toolMetrics.length === 0) return 0;
    
    const total = toolMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    return total / toolMetrics.length;
  }

  getSuccessRate(tool: string): number {
    const toolMetrics = this.metrics.filter(m => m.tool === tool);
    if (toolMetrics.length === 0) return 0;
    
    const successes = toolMetrics.filter(m => m.success).length;
    return (successes / toolMetrics.length) * 100;
  }
}

const aggregator = new MetricsAggregator();

export const metricsAggregationHook = createPostToolHook(
  'example.metrics-aggregation',
  'Metrics Aggregation Hook',
  async (context: PostToolContext): Promise<PostToolContext> => {
    aggregator.add({
      tool: context.toolCall.name,
      durationMs: context.durationMs,
      success: context.success
    });
    
    console.log(`[Example] Average duration for ${context.toolCall.name}: ${
      aggregator.getAverageDuration(context.toolCall.name)
    }ms`);
    
    return context;
  }
);

// ============================================================================
// Export all example hooks
// ============================================================================

export const allExampleHooks = [
  simplePreCommandHook,
  permissionCheckHook,
  commandTransformHook,
  postCommandMetricsHook,
  toolRateLimiterHook,
  toolCacheHook,
  errorRetryHook,
  responseParserHook,
  customAuditHook,
  composedHook,
  conditionalDebugHook,
  retryableHook,
  timeoutHook,
  loggedHook,
  metricsAggregationHook
];
