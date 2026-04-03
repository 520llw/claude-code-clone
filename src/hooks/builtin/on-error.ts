/**
 * On-Error Hook
 * 
 * Built-in hook for handling errors in the agent lifecycle.
 * Provides logging, retry, and notification capabilities.
 */

import {
  ErrorContext,
  ErrorHook,
  ErrorHookConfig,
  HookPriority,
  HookPhase,
  ErrorHandler
} from '../types';

/**
 * Default configuration for error hooks
 */
const DEFAULT_CONFIG: ErrorHookConfig = {
  logErrors: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  notifyOnError: true
};

/**
 * Retry state for tracking retry attempts
 */
interface RetryState {
  attempts: number;
  lastAttempt: number;
  errors: Error[];
}

/**
 * Error Hook Implementation
 */
export class ErrorHookImpl {
  private config: ErrorHookConfig;
  private retryStates: Map<string, RetryState> = new Map();

  constructor(config: Partial<ErrorHookConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main handler for error hook
   */
  async handler(context: ErrorContext): Promise<ErrorContext> {
    const { error, source, retryCount, maxRetries } = context;

    // Log error if enabled
    if (this.config.logErrors) {
      this.logError(error, source);
    }

    // Handle retry if enabled
    if (this.config.enableRetry && retryCount < maxRetries) {
      const shouldRetry = this.shouldRetry(error, source);
      if (shouldRetry) {
        context.recoveryAction = 'retry';
        context.handled = true;
        return context;
      }
    }

    // Notify if enabled
    if (this.config.notifyOnError) {
      this.notifyError(error, source);
    }

    return context;
  }

  /**
   * Log error details
   */
  private logError(error: Error, source: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [OnError] Error in ${source}:`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: Error, source: string): boolean {
    // Don't retry certain error types
    const nonRetryableErrors = [
      'ValidationError',
      'PermissionError',
      'NotFoundError',
      'ConfigurationError'
    ];

    const errorType = error.constructor.name;
    if (nonRetryableErrors.includes(errorType)) {
      return false;
    }

    // Don't retry certain sources
    if (source === 'system') {
      return false;
    }

    return true;
  }

  /**
   * Notify about error
   */
  private notifyError(error: Error, source: string): void {
    console.error(`[OnError] Alert: Error occurred in ${source}: ${error.message}`);
  }

  /**
   * Get retry state for an operation
   */
  getRetryState(operationId: string): RetryState | undefined {
    return this.retryStates.get(operationId);
  }

  /**
   * Record retry attempt
   */
  recordRetryAttempt(operationId: string, error: Error): void {
    let state = this.retryStates.get(operationId);
    if (!state) {
      state = { attempts: 0, lastAttempt: 0, errors: [] };
    }

    state.attempts++;
    state.lastAttempt = Date.now();
    state.errors.push(error);

    this.retryStates.set(operationId, state);
  }

  /**
   * Clear retry state
   */
  clearRetryState(operationId: string): void {
    this.retryStates.delete(operationId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHookConfig {
    return { ...this.config };
  }
}

/**
 * Create an error hook
 */
export function createErrorHook(
  id: string,
  name: string,
  handler: ErrorHandler,
  errorTypes: string[],
  config?: Partial<ErrorHookConfig>
): ErrorHook {
  const impl = new ErrorHookImpl(config);

  return {
    id,
    name,
    type: 'on-error',
    description: 'Hook executed when errors occur',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.HIGH,
    enabled: true,
    handler: async (context: ErrorContext): Promise<ErrorContext> => {
      // Run built-in handler first
      const modifiedContext = await impl.handler(context);
      
      // Run custom handler
      return handler(modifiedContext);
    },
    errorTypes,
    retryable: true,
    maxRetries: config?.maxRetries || 3,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['error', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create an error logger hook
 */
export function createErrorLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error',
  includeStack: boolean = true
): ErrorHook {
  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    const { error, source, retryCount, maxRetries } = context;
    const timestamp = new Date().toISOString();

    const logMessage = `[${timestamp}] [OnError] ${source}: ${error.message}`;
    const logData: Record<string, unknown> = {
      retryCount,
      maxRetries
    };

    if (includeStack && error.stack) {
      logData.stack = error.stack;
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
    id: 'error-logger',
    name: 'Error Logger',
    type: 'on-error',
    description: 'Logs errors when they occur',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.CRITICAL,
    enabled: true,
    handler,
    errorTypes: ['*'],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['logger', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create an error retry handler hook
 */
export function createErrorRetryHandler(
  retryableErrors: string[],
  maxRetries: number = 3,
  delayMs: number = 1000
): ErrorHook {
  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    const { error, retryCount } = context;
    const errorType = error.constructor.name;

    // Check if error type is retryable
    const isRetryable = retryableErrors.includes('*') || 
                        retryableErrors.includes(errorType) ||
                        retryableErrors.some(pattern => {
                          if (pattern.includes('*')) {
                            const regex = new RegExp(pattern.replace('*', '.*'));
                            return regex.test(errorType);
                          }
                          return false;
                        });

    if (isRetryable && retryCount < maxRetries) {
      context.recoveryAction = 'retry';
      context.handled = true;
      
      // Add delay before retry
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, retryCount)));
    }

    return context;
  };

  return {
    id: 'error-retry-handler',
    name: 'Error Retry Handler',
    type: 'on-error',
    description: 'Handles retry logic for errors',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    errorTypes: retryableErrors,
    retryable: true,
    maxRetries,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['retry', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create an error notifier hook
 */
export function createErrorNotifier(
  notifyFn: (error: Error, context: ErrorContext) => void | Promise<void>,
  filter?: (error: Error, context: ErrorContext) => boolean
): ErrorHook {
  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    // Apply filter if provided
    if (filter && !filter(context.error, context)) {
      return context;
    }

    try {
      await notifyFn(context.error, context);
    } catch (notifyError) {
      console.warn('Error notification failed:', notifyError);
    }

    return context;
  };

  return {
    id: 'error-notifier',
    name: 'Error Notifier',
    type: 'on-error',
    description: 'Notifies when errors occur',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    errorTypes: ['*'],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['notifier', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a fallback handler hook
 */
export function createErrorFallbackHandler(
  fallbackFn: (error: Error, context: ErrorContext) => unknown | Promise<unknown>
): ErrorHook {
  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    try {
      const fallbackResult = await fallbackFn(context.error, context);
      context.result = fallbackResult;
      context.recoveryAction = 'fallback';
      context.handled = true;
    } catch (fallbackError) {
      console.warn('Fallback handler failed:', fallbackError);
    }

    return context;
  };

  return {
    id: 'error-fallback-handler',
    name: 'Error Fallback Handler',
    type: 'on-error',
    description: 'Provides fallback behavior for errors',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    errorTypes: ['*'],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['fallback', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create an error metrics collector hook
 */
export function createErrorMetricsCollector(
  metricsCollector: (metrics: {
    errorType: string;
    source: string;
    message: string;
    timestamp: Date;
    handled: boolean;
  }) => void | Promise<void>
): ErrorHook {
  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    try {
      await metricsCollector({
        errorType: context.error.constructor.name,
        source: context.source,
        message: context.error.message,
        timestamp: new Date(),
        handled: context.handled
      });
    } catch (metricsError) {
      console.warn('Error metrics collection failed:', metricsError);
    }

    return context;
  };

  return {
    id: 'error-metrics-collector',
    name: 'Error Metrics Collector',
    type: 'on-error',
    description: 'Collects metrics on errors',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.BACKGROUND,
    enabled: true,
    handler,
    errorTypes: ['*'],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['metrics', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a circuit breaker hook
 */
export function createErrorCircuitBreaker(
  failureThreshold: number = 5,
  resetTimeoutMs: number = 60000
): ErrorHook {
  const failures: Map<string, { count: number; lastFailure: number }> = new Map();
  const openCircuits: Set<string> = new Set();

  const handler: ErrorHandler = async (context: ErrorContext): Promise<ErrorContext> => {
    const source = context.source;
    const now = Date.now();

    // Check if circuit is open
    if (openCircuits.has(source)) {
      const failureData = failures.get(source);
      if (failureData && now - failureData.lastFailure > resetTimeoutMs) {
        // Reset circuit
        openCircuits.delete(source);
        failures.delete(source);
      } else {
        // Circuit still open, skip
        context.handled = true;
        context.recoveryAction = 'skip';
        return context;
      }
    }

    // Record failure
    let failureData = failures.get(source);
    if (!failureData) {
      failureData = { count: 0, lastFailure: 0 };
    }
    failureData.count++;
    failureData.lastFailure = now;
    failures.set(source, failureData);

    // Check threshold
    if (failureData.count >= failureThreshold) {
      openCircuits.add(source);
      console.error(`[OnError] Circuit breaker opened for ${source}`);
    }

    return context;
  };

  return {
    id: 'error-circuit-breaker',
    name: 'Error Circuit Breaker',
    type: 'on-error',
    description: 'Implements circuit breaker pattern for errors',
    phase: HookPhase.ON_ERROR,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    errorTypes: ['*'],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['circuit-breaker', 'error'],
      dependencies: [],
      dependents: []
    }
  };
}
