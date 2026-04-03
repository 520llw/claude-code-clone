/**
 * onError.ts
 * 
 * Error Occurred Hook Implementation
 * 
 * This hook is triggered when an error occurs in the application.
 * It allows plugins to handle, log, or report errors.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnErrorData, HookContext } from '../types';

/**
 * onError hook definition
 */
export const onErrorDefinition: HookDefinition<OnErrorData> = {
  name: 'onError',
  description: 'Called when an error occurs. Plugins can handle, log, or report errors.',
  category: HookCategory.SYSTEM,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 10000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log errors
plugin.registerHook('onError', async (context) => {
  const { type, message, stack } = context.data;
  console.error(\`[\${type}] \${message}\`);
  if (stack) console.error(stack);
});`,
    `// Send error to monitoring service
plugin.registerHook('onError', async (context) => {
  const { type, message, component } = context.data;
  
  await monitoringService.report({
    type,
    message,
    component,
    timestamp: new Date().toISOString()
  });
});`,
    `// Handle specific error types
plugin.registerHook('onError', async (context) => {
  const { type, message } = context.data;
  
  if (type === 'NetworkError') {
    // Retry the operation
    context.set('handled', true);
    await retryOperation();
  }
});`
  ],
  relatedHooks: [],
  schema: {
    input: {
      type: 'object',
      properties: {
        errorId: { type: 'string', description: 'Unique error ID' },
        type: { type: 'string', description: 'Error type' },
        message: { type: 'string', description: 'Error message' },
        stack: { type: 'string', description: 'Stack trace' },
        timestamp: { type: 'string', format: 'date-time' },
        component: { type: 'string', description: 'Component that threw the error' },
        handled: { type: 'boolean', description: 'Whether the error was handled' }
      },
      required: ['errorId', 'type', 'message', 'timestamp', 'handled']
    }
  }
};

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * onError hook context
 */
export interface OnErrorContext extends HookContext<OnErrorData> {
  /** Mark the error as handled */
  markHandled(): void;
  /** Check if error is of specific type */
  isType(type: string): boolean;
  /** Get error severity */
  getSeverity(): ErrorSeverity;
  /** Add context to the error */
  addContext(context: Record<string, any>): void;
  /** Format error for display */
  format(includeStack?: boolean): string;
  /** Log the error */
  log(includeStack?: boolean): void;
  /** Send error to external service */
  report(service: string): Promise<void>;
  /** Get similar errors from history */
  getSimilarErrors(limit?: number): Promise<OnErrorData[]>;
}

/**
 * Creates an onError hook context
 */
export function createOnErrorContext(
  data: OnErrorData,
  executionId: string
): OnErrorContext {
  return {
    hookName: 'onError',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnErrorData>(key: K): OnErrorData[K] {
      return data[key];
    },

    set<K extends keyof OnErrorData>(key: K, value: OnErrorData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    markHandled(): void {
      data.handled = true;
    },

    isType(type: string): boolean {
      return data.type === type;
    },

    getSeverity(): ErrorSeverity {
      // Determine severity based on error type
      const criticalTypes = ['FatalError', 'CrashError', 'SecurityError'];
      const highTypes = ['NetworkError', 'DatabaseError', 'AuthError'];
      
      if (criticalTypes.includes(data.type)) {
        return ErrorSeverity.CRITICAL;
      }
      if (highTypes.includes(data.type)) {
        return ErrorSeverity.HIGH;
      }
      if (data.component === 'user') {
        return ErrorSeverity.LOW;
      }
      return ErrorSeverity.MEDIUM;
    },

    addContext(context: Record<string, any>): void {
      if (!data.metadata) {
        (data as any).metadata = {};
      }
      Object.assign((data as any).metadata, context);
    },

    format(includeStack: boolean = true): string {
      let formatted = `[${data.type}] ${data.message}`;
      if (data.component) {
        formatted = `[${data.component}] ${formatted}`;
      }
      if (includeStack && data.stack) {
        formatted += `\n${data.stack}`;
      }
      return formatted;
    },

    log(includeStack: boolean = true): void {
      const severity = this.getSeverity();
      const formatted = this.format(includeStack);
      
      switch (severity) {
        case ErrorSeverity.CRITICAL:
        case ErrorSeverity.HIGH:
          console.error(formatted);
          break;
        case ErrorSeverity.MEDIUM:
          console.warn(formatted);
          break;
        default:
          console.log(formatted);
      }
    },

    async report(service: string): Promise<void> {
      // Would send to external error reporting service
      console.log(`[onError] Reporting to ${service}: ${data.type}`);
    },

    async getSimilarErrors(limit: number = 5): Promise<OnErrorData[]> {
      // Would retrieve similar errors from error history
      return [];
    }
  };
}

/**
 * Default onError handler
 */
export async function defaultOnErrorHandler(context: OnErrorContext): Promise<void> {
  const { errorId, type, message, component, stack } = context.data;
  const severity = context.getSeverity();
  
  // Log the error
  console.error(`[onError] [${severity.toUpperCase()}] [${type}] ${message}`);
  
  if (component) {
    console.error(`  Component: ${component}`);
  }
  
  if (stack) {
    console.error('  Stack trace:');
    console.error(stack.split('\n').map(line => '    ' + line).join('\n'));
  }
  
  // Add metadata
  context.addContext({
    loggedAt: new Date().toISOString(),
    severity,
    processed: true
  });
  
  // Mark as handled for non-critical errors
  if (severity !== ErrorSeverity.CRITICAL) {
    context.markHandled();
  }
}

/**
 * Create error data from an Error object
 */
export function createErrorData(
  error: Error,
  component?: string,
  type: string = 'Error'
): OnErrorData {
  return {
    errorId: uuidv4(),
    type: error.name || type,
    message: error.message,
    stack: error.stack,
    timestamp: new Date(),
    component,
    handled: false
  };
}

import { v4 as uuidv4 } from 'uuid';

export default onErrorDefinition;
