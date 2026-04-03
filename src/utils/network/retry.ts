/**
 * Retry Utilities Module
 * 
 * Provides comprehensive retry logic with various backoff strategies,
 * circuit breaker patterns, and timeout handling.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'decorrelated';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffStrategy?: BackoffStrategy;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  onSuccess?: (attempt: number) => void;
  onFailure?: (error: Error, attempts: number) => void;
  timeout?: number;
  jitter?: boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxCalls?: number;
  successThreshold?: number;
}

export interface TimeoutOptions {
  timeout: number;
  message?: string;
}

export interface RetryState {
  attempts: number;
  totalDelay: number;
  lastError?: Error;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

// ============================================================================
// Retry Function
// ============================================================================

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffStrategy = 'exponential',
    backoffMultiplier = 2,
    shouldRetry,
    onRetry,
    onSuccess,
    onFailure,
    timeout,
    jitter = true,
  } = options;

  let lastError: Error;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let result: T;

      if (timeout) {
        result = await withTimeout(operation, { timeout });
      } else {
        result = await operation();
      }

      if (onSuccess) {
        onSuccess(attempt);
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt === maxAttempts) {
        break;
      }

      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffStrategy,
        backoffMultiplier,
        jitter
      );

      totalDelay += delay;

      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  if (onFailure) {
    onFailure(lastError!, maxAttempts);
  }

  throw lastError!;
}

export async function retryWithResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffStrategy = 'exponential',
    backoffMultiplier = 2,
    shouldRetry,
    onRetry,
    onSuccess,
    onFailure,
    timeout,
    jitter = true,
  } = options;

  let lastError: Error | undefined;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let result: T;

      if (timeout) {
        result = await withTimeout(operation, { timeout });
      } else {
        result = await operation();
      }

      if (onSuccess) {
        onSuccess(attempt);
      }

      return {
        success: true,
        result,
        attempts: attempt,
        totalDelay,
      };
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelay,
        };
      }

      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffStrategy,
        backoffMultiplier,
        jitter
      );

      totalDelay += delay;

      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  if (onFailure) {
    onFailure(lastError!, maxAttempts);
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts,
    totalDelay,
  };
}

// ============================================================================
// Delay Calculation
// ============================================================================

function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  strategy: BackoffStrategy,
  multiplier: number,
  jitter: boolean
): number {
  let delay: number;

  switch (strategy) {
    case 'fixed':
      delay = initialDelay;
      break;

    case 'linear':
      delay = initialDelay * attempt;
      break;

    case 'exponential':
      delay = initialDelay * Math.pow(multiplier, attempt - 1);
      break;

    case 'decorrelated':
      // Decorrelated jitter
      delay = Math.random() * Math.min(maxDelay, initialDelay * Math.pow(multiplier, attempt));
      break;

    default:
      delay = initialDelay;
  }

  // Apply jitter
  if (jitter && strategy !== 'decorrelated') {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  return Math.floor(delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Timeout
// ============================================================================

export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeout, message = `Operation timed out after ${timeout}ms` } = options;

  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(message, timeout));
      }, timeout);
    }),
  ]);
}

export class TimeoutError extends Error {
  public readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private halfOpenCalls = 0;
  private lastFailureTime?: number;

  private failureThreshold: number;
  private resetTimeout: number;
  private halfOpenMaxCalls: number;
  private successThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 3;
    this.successThreshold = options.successThreshold ?? 2;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      }
    }

    if (this.state === 'half-open' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError('Circuit breaker half-open call limit reached');
    }

    if (this.state === 'half-open') {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo('closed');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private transitionTo(state: CircuitState): void {
    this.state = state;

    if (state === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenCalls = 0;
    } else if (state === 'half-open') {
      this.halfOpenCalls = 0;
      this.successCount = 0;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    halfOpenCalls: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenCalls: this.halfOpenCalls,
    };
  }

  reset(): void {
    this.transitionTo('closed');
    this.lastFailureTime = undefined;
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================================================
// Bulkhead Pattern
// ============================================================================

export class Bulkhead {
  private maxConcurrent: number;
  private maxQueue: number;
  private running = 0;
  private queue: Array<{
    operation: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(maxConcurrent: number = 10, maxQueue: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrent) {
      return this.run(operation);
    }

    if (this.queue.length >= this.maxQueue) {
      throw new BulkheadFullError('Bulkhead queue is full');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        operation: operation as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    this.running++;

    try {
      return await operation();
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.maxConcurrent) {
      return;
    }

    const next = this.queue.shift();
    if (next) {
      this.run(next.operation)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  getMetrics(): {
    running: number;
    queued: number;
    availableSlots: number;
  } {
    return {
      running: this.running,
      queued: this.queue.length,
      availableSlots: this.maxConcurrent - this.running,
    };
  }
}

export class BulkheadFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadFullError';
  }
}

// ============================================================================
// Retry Decorator
// ============================================================================

export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions
): T {
  return (async (...args: unknown[]) => {
    return retry(() => fn(...args), options);
  }) as T;
}

export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  circuitBreaker: CircuitBreaker
): T {
  return (async (...args: unknown[]) => {
    return circuitBreaker.execute(() => fn(...args));
  }) as T;
}

export function withBulkhead<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  bulkhead: Bulkhead
): T {
  return (async (...args: unknown[]) => {
    return bulkhead.execute(() => fn(...args));
  }) as T;
}

// ============================================================================
// Retryable Error Classification
// ============================================================================

export const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
];

export const DEFAULT_RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

export function isRetryableError(
  error: Error,
  retryableErrors: string[] = DEFAULT_RETRYABLE_ERRORS
): boolean {
  const code = (error as { code?: string }).code;
  return code !== undefined && retryableErrors.includes(code);
}

export function isRetryableStatusCode(
  statusCode: number,
  retryableStatusCodes: number[] = DEFAULT_RETRYABLE_STATUS_CODES
): boolean {
  return retryableStatusCodes.includes(statusCode);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  retry,
  retryWithResult,
  withTimeout,
  TimeoutError,
  CircuitBreaker,
  CircuitBreakerOpenError,
  Bulkhead,
  BulkheadFullError,
  withRetry,
  withCircuitBreaker,
  withBulkhead,
  isRetryableError,
  isRetryableStatusCode,
  DEFAULT_RETRYABLE_ERRORS,
  DEFAULT_RETRYABLE_STATUS_CODES,
};
