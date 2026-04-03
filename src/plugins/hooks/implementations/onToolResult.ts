/**
 * onToolResult.ts
 * 
 * Tool Result Hook Implementation
 * 
 * This hook is triggered when a tool execution is completed. It allows
 * plugins to process, analyze, or modify tool results before they are
 * sent to the LLM.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnToolResultData, HookContext } from '../types';

/**
 * onToolResult hook definition
 */
export const onToolResultDefinition: HookDefinition<OnToolResultData> = {
  name: 'onToolResult',
  description: 'Called when a tool execution is completed. Plugins can process, analyze, or modify tool results.',
  category: HookCategory.TOOL,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 5000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log tool results
plugin.registerHook('onToolResult', async (context) => {
  const { toolName, success, duration } = context.data;
  console.log(\`Tool \${toolName} completed in \${duration}ms (success: \${success})\`);
});`,
    `// Format result for display
plugin.registerHook('onToolResult', async (context) => {
  const { toolName, result } = context.data;
  
  if (toolName === 'readFile' && typeof result === 'string') {
    // Truncate long files
    if (result.length > 10000) {
      context.set('result', result.substring(0, 10000) + '... [truncated]');
    }
  }
});`,
    `// Cache successful results
plugin.registerHook('onToolResult', async (context) => {
  const { callId, toolName, result, success } = context.data;
  
  if (success && shouldCache(toolName)) {
    await cache.set(\`tool:\${callId}\`, result, { ttl: 60000 });
  }
});`
  ],
  relatedHooks: ['onToolCall', 'onResponse'],
  schema: {
    input: {
      type: 'object',
      properties: {
        callId: { type: 'string', description: 'Unique call ID' },
        toolName: { type: 'string', description: 'Tool name' },
        result: { description: 'Tool result (any type)' },
        duration: { type: 'number', description: 'Execution duration in ms' },
        success: { type: 'boolean', description: 'Whether execution succeeded' },
        error: { type: 'string', description: 'Error message if failed' },
        timestamp: { type: 'string', format: 'date-time', description: 'Result timestamp' }
      },
      required: ['callId', 'toolName', 'result', 'duration', 'success', 'timestamp']
    }
  }
};

/**
 * onToolResult hook context
 */
export interface OnToolResultContext extends HookContext<OnToolResultData> {
  /** Set the result value */
  setResult(result: any): void;
  /** Get the result value */
  getResult(): any;
  /** Format the result */
  format(formatter: (result: any) => any): void;
  /** Truncate result if too large */
  truncate(maxLength: number, suffix?: string): void;
  /** Add metadata about the result */
  addResultMetadata(metadata: Record<string, any>): void;
  /** Check if result matches pattern */
  matches(pattern: string | RegExp): boolean;
  /** Log the result */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  /** Get execution statistics */
  getStats(): { duration: number; success: boolean; size: number };
}

/**
 * Creates an onToolResult hook context
 */
export function createOnToolResultContext(
  data: OnToolResultData,
  executionId: string
): OnToolResultContext {
  return {
    hookName: 'onToolResult',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnToolResultData>(key: K): OnToolResultData[K] {
      return data[key];
    },

    set<K extends keyof OnToolResultData>(key: K, value: OnToolResultData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    setResult(result: any): void {
      data.result = result;
    },

    getResult(): any {
      return data.result;
    },

    format(formatter: (result: any) => any): void {
      data.result = formatter(data.result);
    },

    truncate(maxLength: number, suffix: string = '... [truncated]'): void {
      const resultStr = typeof data.result === 'string' 
        ? data.result 
        : JSON.stringify(data.result);
      
      if (resultStr.length > maxLength) {
        data.result = resultStr.substring(0, maxLength - suffix.length) + suffix;
      }
    },

    addResultMetadata(metadata: Record<string, any>): void {
      if (!data.metadata) {
        (data as any).metadata = {};
      }
      Object.assign((data as any).metadata, metadata);
    },

    matches(pattern: string | RegExp): boolean {
      const resultStr = typeof data.result === 'string' 
        ? data.result 
        : JSON.stringify(data.result);
      
      if (typeof pattern === 'string') {
        return resultStr.includes(pattern);
      }
      return pattern.test(resultStr);
    },

    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
      console[level](`[onToolResult] ${message}`);
    },

    getStats(): { duration: number; success: boolean; size: number } {
      const resultStr = typeof data.result === 'string' 
        ? data.result 
        : JSON.stringify(data.result);
      
      return {
        duration: data.duration,
        success: data.success,
        size: resultStr.length
      };
    }
  };
}

/**
 * Default onToolResult handler
 */
export async function defaultOnToolResultHandler(context: OnToolResultContext): Promise<void> {
  const { callId, toolName, success, duration, error } = context.data;
  
  const stats = context.getStats();
  
  if (success) {
    console.log(`[onToolResult] ${toolName} (${callId}) completed in ${duration}ms, size: ${stats.size} bytes`);
  } else {
    console.error(`[onToolResult] ${toolName} (${callId}) failed: ${error}`);
  }
  
  // Add performance metadata
  context.addResultMetadata({
    processedAt: new Date().toISOString(),
    resultSize: stats.size,
    performance: {
      duration,
      bytesPerMs: stats.size / (duration || 1)
    }
  });
}

/**
 * Determines if a tool result should be cached
 */
export function shouldCache(toolName: string): boolean {
  const cacheableTools = [
    'readFile',
    'getFileInfo',
    'searchFiles',
    'listDirectory'
  ];
  
  return cacheableTools.includes(toolName);
}

export default onToolResultDefinition;
