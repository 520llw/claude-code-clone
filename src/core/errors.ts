/**
 * Error System
 * 
 * This module provides a comprehensive error handling system with
 * custom error classes, error codes, and recovery suggestions.
 */

import type { ErrorCode, ErrorDetails } from '@types/index';

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all Claude Code errors
 */
export class ClaudeCodeError extends Error {
  /**
   * Error code
   */
  readonly code: ErrorCode;
  
  /**
   * Additional context
   */
  readonly context: Record<string, unknown>;
  
  /**
   * Whether the error is recoverable
   */
  readonly recoverable: boolean;
  
  /**
   * Original cause of the error
   */
  readonly cause?: Error;

  constructor(
    message: string,
    code: ErrorCode = 'UNKNOWN_ERROR',
    options: {
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ClaudeCodeError';
    this.code = code;
    this.context = options.context ?? {};
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to error details
   */
  toDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause,
      context: this.context,
      recoverable: this.recoverable,
    };
  }

  /**
   * Get a user-friendly error message
   */
  toUserMessage(): string {
    return this.message;
  }

  /**
   * Get recovery suggestion
   */
  getRecoverySuggestion(): string | null {
    return ErrorRecoverySuggestions.get(this.code);
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Configuration error
 */
export class ConfigError extends ClaudeCodeError {
  constructor(
    message: string,
    code: ErrorCode = 'CONFIG_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, code, options);
    this.name = 'ConfigError';
  }
}

/**
 * Configuration parse error
 */
export class ConfigParseError extends ConfigError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, 'CONFIG_PARSE_ERROR', options);
    this.name = 'ConfigParseError';
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends ConfigError {
  readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ path: string; message: string }>,
    options: Omit<ConstructorParameters<typeof ClaudeCodeError>[2], 'context'> = {}
  ) {
    super(message, 'CONFIG_VALIDATION_ERROR', {
      ...options,
      context: { validationErrors },
    });
    this.name = 'ConfigValidationError';
    this.validationErrors = validationErrors;
  }
}

// ============================================================================
// Agent Errors
// ============================================================================

/**
 * Agent error
 */
export class AgentError extends ClaudeCodeError {
  readonly agentId?: string;

  constructor(
    message: string,
    code: ErrorCode = 'AGENT_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] & { agentId?: string } = {}
  ) {
    super(message, code, options);
    this.name = 'AgentError';
    this.agentId = options.agentId;
  }
}

/**
 * Agent initialization error
 */
export class AgentInitializationError extends AgentError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof AgentError>[2] = {}
  ) {
    super(message, 'AGENT_INITIALIZATION_ERROR', options);
    this.name = 'AgentInitializationError';
  }
}

/**
 * Agent execution error
 */
export class AgentExecutionError extends AgentError {
  readonly taskId?: string;

  constructor(
    message: string,
    options: ConstructorParameters<typeof AgentError>[2] & { taskId?: string } = {}
  ) {
    super(message, 'AGENT_EXECUTION_ERROR', options);
    this.name = 'AgentExecutionError';
    this.taskId = options.taskId;
  }
}

/**
 * Agent communication error
 */
export class AgentCommunicationError extends AgentError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof AgentError>[2] = {}
  ) {
    super(message, 'AGENT_COMMUNICATION_ERROR', options);
    this.name = 'AgentCommunicationError';
  }
}

// ============================================================================
// Tool Errors
// ============================================================================

/**
 * Tool error
 */
export class ToolError extends ClaudeCodeError {
  readonly toolName?: string;

  constructor(
    message: string,
    code: ErrorCode = 'TOOL_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] & { toolName?: string } = {}
  ) {
    super(message, code, options);
    this.name = 'ToolError';
    this.toolName = options.toolName;
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends ToolError {
  constructor(
    toolName: string,
    options: Omit<ConstructorParameters<typeof ToolError>[2], 'toolName'> = {}
  ) {
    super(`Tool not found: ${toolName}`, 'TOOL_NOT_FOUND', { ...options, toolName });
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Tool validation error
 */
export class ToolValidationError extends ToolError {
  readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    toolName: string,
    validationErrors: Array<{ path: string; message: string }>,
    options: Omit<ConstructorParameters<typeof ToolError>[2], 'toolName'> = {}
  ) {
    super(message, 'TOOL_VALIDATION_ERROR', { ...options, toolName });
    this.name = 'ToolValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends ToolError {
  constructor(
    message: string,
    toolName: string,
    options: Omit<ConstructorParameters<typeof ToolError>[2], 'toolName'> = {}
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', { ...options, toolName });
    this.name = 'ToolExecutionError';
  }
}

/**
 * Tool permission denied error
 */
export class ToolPermissionDeniedError extends ToolError {
  constructor(
    toolName: string,
    options: Omit<ConstructorParameters<typeof ToolError>[2], 'toolName'> = {}
  ) {
    super(`Permission denied for tool: ${toolName}`, 'TOOL_PERMISSION_DENIED', {
      ...options,
      toolName,
    });
    this.name = 'ToolPermissionDeniedError';
  }
}

// ============================================================================
// Query Engine Errors
// ============================================================================

/**
 * Query engine error
 */
export class QueryEngineError extends ClaudeCodeError {
  constructor(
    message: string,
    code: ErrorCode = 'QUERY_ENGINE_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, code, options);
    this.name = 'QueryEngineError';
  }
}

/**
 * LLM error
 */
export class LLMError extends QueryEngineError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, 'LLM_ERROR', options);
    this.name = 'LLMError';
  }
}

/**
 * Streaming error
 */
export class StreamingError extends QueryEngineError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, 'STREAMING_ERROR', options);
    this.name = 'StreamingError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends QueryEngineError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] & { retryAfter?: number } = {}
  ) {
    super(message, 'RATE_LIMIT_ERROR', { ...options, recoverable: true });
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
  }
}

// ============================================================================
// Context Errors
// ============================================================================

/**
 * Context error
 */
export class ContextError extends ClaudeCodeError {
  constructor(
    message: string,
    code: ErrorCode = 'CONTEXT_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, code, options);
    this.name = 'ContextError';
  }
}

/**
 * Context overflow error
 */
export class ContextOverflowError extends ContextError {
  readonly currentTokens: number;
  readonly maxTokens: number;

  constructor(
    currentTokens: number,
    maxTokens: number,
    options: Omit<ConstructorParameters<typeof ClaudeCodeError>[2], 'context'> = {}
  ) {
    super(
      `Context overflow: ${currentTokens} tokens exceeds maximum of ${maxTokens}`,
      'CONTEXT_OVERFLOW',
      {
        ...options,
        context: { currentTokens, maxTokens },
        recoverable: true,
      }
    );
    this.name = 'ContextOverflowError';
    this.currentTokens = currentTokens;
    this.maxTokens = maxTokens;
  }
}

/**
 * Compression error
 */
export class CompressionError extends ContextError {
  constructor(
    message: string,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, 'COMPRESSION_ERROR', options);
    this.name = 'CompressionError';
  }
}

// ============================================================================
// Plugin Errors
// ============================================================================

/**
 * Plugin error
 */
export class PluginError extends ClaudeCodeError {
  readonly pluginName?: string;

  constructor(
    message: string,
    code: ErrorCode = 'PLUGIN_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] & { pluginName?: string } = {}
  ) {
    super(message, code, options);
    this.name = 'PluginError';
    this.pluginName = options.pluginName;
  }
}

/**
 * Plugin load error
 */
export class PluginLoadError extends PluginError {
  constructor(
    pluginName: string,
    options: Omit<ConstructorParameters<typeof PluginError>[2], 'pluginName'> = {}
  ) {
    super(`Failed to load plugin: ${pluginName}`, 'PLUGIN_LOAD_ERROR', {
      ...options,
      pluginName,
    });
    this.name = 'PluginLoadError';
  }
}

/**
 * Plugin activation error
 */
export class PluginActivationError extends PluginError {
  constructor(
    pluginName: string,
    options: Omit<ConstructorParameters<typeof PluginError>[2], 'pluginName'> = {}
  ) {
    super(`Failed to activate plugin: ${pluginName}`, 'PLUGIN_ACTIVATION_ERROR', {
      ...options,
      pluginName,
    });
    this.name = 'PluginActivationError';
  }
}

/**
 * Plugin hook error
 */
export class PluginHookError extends PluginError {
  readonly hookPoint?: string;

  constructor(
    message: string,
    options: ConstructorParameters<typeof PluginError>[2] & { hookPoint?: string } = {}
  ) {
    super(message, 'PLUGIN_HOOK_ERROR', options);
    this.name = 'PluginHookError';
    this.hookPoint = options.hookPoint;
  }
}

// ============================================================================
// Session Errors
// ============================================================================

/**
 * Session error
 */
export class SessionError extends ClaudeCodeError {
  readonly sessionId?: string;

  constructor(
    message: string,
    code: ErrorCode = 'SESSION_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] & { sessionId?: string } = {}
  ) {
    super(message, code, options);
    this.name = 'SessionError';
    this.sessionId = options.sessionId;
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends SessionError {
  constructor(
    sessionId: string,
    options: Omit<ConstructorParameters<typeof SessionError>[2], 'sessionId'> = {}
  ) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', {
      ...options,
      sessionId,
    });
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Session corrupted error
 */
export class SessionCorruptedError extends SessionError {
  constructor(
    sessionId: string,
    options: Omit<ConstructorParameters<typeof SessionError>[2], 'sessionId'> = {}
  ) {
    super(`Session corrupted: ${sessionId}`, 'SESSION_CORRUPTED', {
      ...options,
      sessionId,
    });
    this.name = 'SessionCorruptedError';
  }
}

// ============================================================================
// MCP Errors
// ============================================================================

/**
 * MCP error
 */
export class MCPError extends ClaudeCodeError {
  constructor(
    message: string,
    code: ErrorCode = 'MCP_ERROR',
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, code, options);
    this.name = 'MCPError';
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Validation error
 */
export class ValidationError extends ClaudeCodeError {
  readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ path: string; message: string }>,
    options: ConstructorParameters<typeof ClaudeCodeError>[2] = {}
  ) {
    super(message, 'VALIDATION_ERROR', options);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

// ============================================================================
// Error Recovery Suggestions
// ============================================================================

/**
 * Map of error codes to recovery suggestions
 */
export const ErrorRecoverySuggestions: Map<ErrorCode, string> = new Map([
  ['CONFIG_ERROR', 'Check your configuration file for errors.'],
  ['CONFIG_PARSE_ERROR', 'Ensure your configuration file is valid JSON or YAML.'],
  ['CONFIG_VALIDATION_ERROR', 'Review the validation errors and fix the configuration.'],
  ['AGENT_ERROR', 'Try restarting the agent or check the agent configuration.'],
  ['AGENT_INITIALIZATION_ERROR', 'Check the agent configuration and dependencies.'],
  ['AGENT_EXECUTION_ERROR', 'Review the task and try again with different parameters.'],
  ['AGENT_COMMUNICATION_ERROR', 'Check network connectivity and agent status.'],
  ['TOOL_ERROR', 'Review the tool parameters and try again.'],
  ['TOOL_NOT_FOUND', 'Check the tool name or install the required plugin.'],
  ['TOOL_VALIDATION_ERROR', 'Review the tool parameters and ensure they match the schema.'],
  ['TOOL_EXECUTION_ERROR', 'Check the tool parameters and environment.'],
  ['TOOL_PERMISSION_DENIED', 'Grant permission for the tool or change permission settings.'],
  ['QUERY_ENGINE_ERROR', 'Check the LLM configuration and API key.'],
  ['LLM_ERROR', 'Check your API key and network connectivity.'],
  ['STREAMING_ERROR', 'Try again or disable streaming in settings.'],
  ['RATE_LIMIT_ERROR', 'Wait a moment and try again.'],
  ['CONTEXT_ERROR', 'Try clearing the context or enabling compression.'],
  ['CONTEXT_OVERFLOW', 'Enable context compression or start a new session.'],
  ['COMPRESSION_ERROR', 'Try a different compression strategy.'],
  ['PLUGIN_ERROR', 'Check the plugin configuration and dependencies.'],
  ['PLUGIN_LOAD_ERROR', 'Ensure the plugin is properly installed.'],
  ['PLUGIN_ACTIVATION_ERROR', 'Check the plugin dependencies and configuration.'],
  ['PLUGIN_HOOK_ERROR', 'Review the hook implementation.'],
  ['SESSION_ERROR', 'Try creating a new session.'],
  ['SESSION_NOT_FOUND', 'Check the session ID or create a new session.'],
  ['SESSION_CORRUPTED', 'Create a new session and restore from backup if available.'],
  ['MCP_ERROR', 'Check the MCP server configuration.'],
  ['VALIDATION_ERROR', 'Review the input data and fix validation errors.'],
  ['UNKNOWN_ERROR', 'An unexpected error occurred. Please try again.'],
]);

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error) => void | Promise<void>;

/**
 * Global error handler
 */
export class GlobalErrorHandler {
  private handlers: Map<ErrorCode, ErrorHandler[]> = new Map();
  private defaultHandlers: ErrorHandler[] = [];

  /**
   * Register an error handler for a specific code
   */
  on(code: ErrorCode, handler: ErrorHandler): void {
    if (!this.handlers.has(code)) {
      this.handlers.set(code, []);
    }
    this.handlers.get(code)!.push(handler);
  }

  /**
   * Register a default error handler
   */
  onDefault(handler: ErrorHandler): void {
    this.defaultHandlers.push(handler);
  }

  /**
   * Handle an error
   */
  async handle(error: Error): Promise<void> {
    let code: ErrorCode = 'UNKNOWN_ERROR';

    if (error instanceof ClaudeCodeError) {
      code = error.code;
    }

    const handlers = this.handlers.get(code) ?? [];
    const allHandlers = [...handlers, ...this.defaultHandlers];

    for (const handler of allHandlers) {
      try {
        await handler(error);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }
  }

  /**
   * Remove an error handler
   */
  off(code: ErrorCode, handler: ErrorHandler): void {
    const handlers = this.handlers.get(code);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove a default error handler
   */
  offDefault(handler: ErrorHandler): void {
    const index = this.defaultHandlers.indexOf(handler);
    if (index !== -1) {
      this.defaultHandlers.splice(index, 1);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.defaultHandlers = [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global error handler instance
 */
export const globalErrorHandler = new GlobalErrorHandler();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is a Claude Code error
 */
export function isClaudeCodeError(error: unknown): error is ClaudeCodeError {
  return error instanceof ClaudeCodeError;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof ClaudeCodeError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Get error details from any error
 */
export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof ClaudeCodeError) {
    return error.toDetails();
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      cause: error,
      context: {},
      recoverable: false,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    context: {},
    recoverable: false,
  };
}

/**
 * Create an error from error details
 */
export function createError(details: ErrorDetails): ClaudeCodeError {
  return new ClaudeCodeError(details.message, details.code, {
    context: details.context,
    recoverable: details.recoverable,
    cause: details.cause as Error,
  });
}
