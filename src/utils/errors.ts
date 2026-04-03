/**
 * Error Utilities Module
 * 
 * Provides comprehensive error handling utilities including custom error classes,
 * error serialization, error aggregation, and error recovery strategies.
 */

// ============================================================================
// Custom Error Classes
// ============================================================================

export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.timestamp = new Date();
    this.context = context;
    this.cause = cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      cause: this.cause ? serializeError(this.cause) : undefined,
    };
  }
}

export class ValidationError extends BaseError {
  public readonly validationErrors: ValidationIssue[];

  constructor(
    message: string = 'Validation failed',
    validationErrors: ValidationIssue[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.validationErrors = validationErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export class NotFoundError extends BaseError {
  constructor(
    resource: string = 'Resource',
    identifier?: string,
    context?: Record<string, unknown>
  ) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, context);
  }
}

export class AuthenticationError extends BaseError {
  constructor(
    message: string = 'Authentication required',
    context?: Record<string, unknown>
  ) {
    super(message, 'UNAUTHORIZED', 401, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(
    message: string = 'Access denied',
    context?: Record<string, unknown>
  ) {
    super(message, 'FORBIDDEN', 403, context);
  }
}

export class ConflictError extends BaseError {
  constructor(
    message: string = 'Resource conflict',
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT', 409, context);
  }
}

export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT', 429, context);
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends BaseError {
  public readonly timeoutMs: number;

  constructor(
    message: string = 'Operation timed out',
    timeoutMs: number = 30000,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT', 408, context);
    this.timeoutMs = timeoutMs;
  }
}

export class ServiceUnavailableError extends BaseError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Service temporarily unavailable',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'SERVICE_UNAVAILABLE', 503, context);
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends BaseError {
  constructor(
    message: string = 'Database operation failed',
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, 'DATABASE_ERROR', 500, context, cause);
  }
}

export class NetworkError extends BaseError {
  public readonly url?: string;

  constructor(
    message: string = 'Network request failed',
    url?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, 'NETWORK_ERROR', 502, context, cause);
    this.url = url;
  }
}

export class ConfigurationError extends BaseError {
  constructor(
    message: string = 'Invalid configuration',
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', 500, context);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(
    message: string,
    code: string = 'BUSINESS_LOGIC_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message, code, 422, context);
  }
}

// ============================================================================
// Error Aggregation
// ============================================================================

export class AggregateError extends BaseError {
  public readonly errors: Error[];

  constructor(
    message: string = 'Multiple errors occurred',
    errors: Error[] = []
  ) {
    super(message, 'AGGREGATE_ERROR', 500);
    this.errors = errors;
  }

  addError(error: Error): void {
    this.errors.push(error);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): Error[] {
    return [...this.errors];
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errors: this.errors.map(e => serializeError(e)),
    };
  }
}

// ============================================================================
// Error Serialization
// ============================================================================

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  cause?: SerializedError;
  [key: string]: unknown;
}

export function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  // Include additional properties from custom errors
  if (error instanceof BaseError) {
    serialized.code = error.code;
    serialized.statusCode = error.statusCode;
    if (error.cause) {
      serialized.cause = serializeError(error.cause);
    }
  }

  // Include any custom properties
  const customProps = Object.getOwnPropertyNames(error).filter(
    key => !['name', 'message', 'stack'].includes(key)
  );

  for (const key of customProps) {
    try {
      serialized[key] = (error as Record<string, unknown>)[key];
    } catch {
      // Skip properties that can't be serialized
    }
  }

  return serialized;
}

export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  error.stack = serialized.stack;

  // Restore custom properties
  for (const [key, value] of Object.entries(serialized)) {
    if (!['name', 'message', 'stack'].includes(key)) {
      try {
        (error as Record<string, unknown>)[key] = value;
      } catch {
        // Skip properties that can't be restored
      }
    }
  }

  return error;
}

export function errorToString(error: Error): string {
  if (error instanceof BaseError) {
    return `[${error.code}] ${error.message}`;
  }
  return `${error.name}: ${error.message}`;
}

// ============================================================================
// Error Classification
// ============================================================================

export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

export function isProgrammingError(error: Error): boolean {
  return !isOperationalError(error);
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof BaseError) {
    return [
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMIT',
    ].includes(error.code);
  }
  return false;
}

export function getHttpStatusCode(error: Error): number {
  if (error instanceof BaseError) {
    return error.statusCode;
  }
  return 500;
}

// ============================================================================
// Error Recovery
// ============================================================================

export interface RecoveryStrategy<T> {
  shouldAttempt(error: Error): boolean;
  attempt(error: Error): Promise<T> | T;
}

export class ErrorRecovery<T> {
  private strategies: RecoveryStrategy<T>[] = [];

  addStrategy(strategy: RecoveryStrategy<T>): void {
    this.strategies.push(strategy);
  }

  async recover(error: Error): Promise<T> {
    for (const strategy of this.strategies) {
      if (strategy.shouldAttempt(error)) {
        try {
          return await strategy.attempt(error);
        } catch (recoveryError) {
          // Continue to next strategy
          continue;
        }
      }
    }
    throw error;
  }
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  shouldFallback?: (error: Error) => boolean
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (shouldFallback && !shouldFallback(error as Error)) {
      throw error;
    }
    return await fallback();
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    retryableErrorFilter = isRetryableError,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !retryableErrorFilter(lastError)) {
        throw lastError;
      }

      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError!;
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrorFilter?: (error: Error) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Error Handling Helpers
// ============================================================================

export function tryCatch<T>(
  fn: () => T,
  onError?: (error: Error) => T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (onError) {
      return onError(error as Error);
    }
    return undefined;
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => Promise<T> | T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      return await onError(error as Error);
    }
    return undefined;
  }
}

export function assertCondition(
  condition: boolean,
  message: string,
  code?: string
): asserts condition {
  if (!condition) {
    throw new BusinessLogicError(message, code || 'ASSERTION_FAILED');
  }
}

export function assertNotNull<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(message || 'Value', undefined, { value });
  }
}

export function assertType<T>(
  value: unknown,
  typeGuard: (v: unknown) => v is T,
  message?: string
): asserts value is T {
  if (!typeGuard(value)) {
    throw new ValidationError(message || 'Type assertion failed', [
      { field: 'value', message: 'Invalid type', code: 'INVALID_TYPE' },
    ]);
  }
}

// ============================================================================
// Error Middleware Helpers
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

export function createErrorResponse(error: Error): ErrorResponse {
  if (error instanceof BaseError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
        timestamp: error.timestamp.toISOString(),
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
  };
}

export function sanitizeErrorForClient(error: Error): ErrorResponse {
  const response = createErrorResponse(error);

  // Don't expose internal details for non-operational errors
  if (isProgrammingError(error)) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        timestamp: response.error.timestamp,
      },
    };
  }

  return response;
}

// ============================================================================
// Error Logging
// ============================================================================

export interface ErrorLogEntry {
  timestamp: Date;
  error: SerializedError;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
}

export class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs;
  }

  log(error: Error, context?: Omit<ErrorLogEntry, 'timestamp' | 'error'>): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      error: serializeError(error),
      ...context,
    };

    this.logs.push(entry);

    // Trim old logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 10): ErrorLogEntry[] {
    return this.logs.slice(-count);
  }

  getLogsByErrorCode(code: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.error.code === code);
  }

  clear(): void {
    this.logs = [];
  }

  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const log of this.logs) {
      const code = log.error.code || 'UNKNOWN';
      stats[code] = (stats[code] || 0) + 1;
    }

    return stats;
  }
}

// ============================================================================
// Global Error Handlers
// ============================================================================

export function setupGlobalErrorHandlers(
  onUncaughtException?: (error: Error) => void,
  onUnhandledRejection?: (reason: unknown) => void
): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    if (onUncaughtException) {
      onUncaughtException(error);
    } else {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('Unhandled Rejection:', reason);
    if (onUnhandledRejection) {
      onUnhandledRejection(reason);
    }
  });
}

// ============================================================================
// Type Guards
// ============================================================================

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isBaseError(value: unknown): value is BaseError {
  return value instanceof BaseError;
}

export function hasCode(value: unknown): value is { code: string } {
  return typeof value === 'object' && value !== null && 'code' in value;
}

export function hasMessage(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  BaseError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  TimeoutError,
  ServiceUnavailableError,
  DatabaseError,
  NetworkError,
  ConfigurationError,
  BusinessLogicError,
  AggregateError,
  serializeError,
  deserializeError,
  isOperationalError,
  isRetryableError,
  createErrorResponse,
};
