/**
 * MCP Error Types
 * 
 * This file contains custom error classes for MCP operations.
 */

import { MCPErrorCode } from '../types';

/**
 * Base class for all MCP errors
 */
export class MCPError extends Error {
  public readonly code: MCPErrorCode;
  public readonly data?: unknown;

  constructor(code: MCPErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  toJSON(): { code: number; message: string; data?: unknown } {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }
}

/**
 * Error for JSON-RPC parse errors
 */
export class MCPParseError extends MCPError {
  constructor(message = 'Parse error', data?: unknown) {
    super(MCPErrorCode.ParseError, message, data);
    this.name = 'MCPParseError';
  }
}

/**
 * Error for invalid JSON-RPC requests
 */
export class MCPInvalidRequestError extends MCPError {
  constructor(message = 'Invalid request', data?: unknown) {
    super(MCPErrorCode.InvalidRequest, message, data);
    this.name = 'MCPInvalidRequestError';
  }
}

/**
 * Error for method not found
 */
export class MCPMethodNotFoundError extends MCPError {
  constructor(method: string) {
    super(MCPErrorCode.MethodNotFound, `Method not found: ${method}`);
    this.name = 'MCPMethodNotFoundError';
  }
}

/**
 * Error for invalid parameters
 */
export class MCPInvalidParamsError extends MCPError {
  constructor(message = 'Invalid params', data?: unknown) {
    super(MCPErrorCode.InvalidParams, message, data);
    this.name = 'MCPInvalidParamsError';
  }
}

/**
 * Error for internal server errors
 */
export class MCPInternalError extends MCPError {
  constructor(message = 'Internal error', data?: unknown) {
    super(MCPErrorCode.InternalError, message, data);
    this.name = 'MCPInternalError';
  }
}

/**
 * Error for server not initialized
 */
export class MCPServerNotInitializedError extends MCPError {
  constructor(message = 'Server not initialized') {
    super(MCPErrorCode.ServerNotInitialized, message);
    this.name = 'MCPServerNotInitializedError';
  }
}

/**
 * Error for invalid server state
 */
export class MCPInvalidServerStateError extends MCPError {
  constructor(message = 'Invalid server state') {
    super(MCPErrorCode.InvalidServerState, message);
    this.name = 'MCPInvalidServerStateError';
  }
}

/**
 * Error for request cancellation
 */
export class MCPRequestCancelledError extends MCPError {
  constructor(reason?: string) {
    super(
      MCPErrorCode.RequestCancelled,
      reason || 'Request was cancelled'
    );
    this.name = 'MCPRequestCancelledError';
  }
}

/**
 * Error for request timeout
 */
export class MCPRequestTimeoutError extends MCPError {
  constructor(timeoutMs: number) {
    super(
      MCPErrorCode.RequestTimeout,
      `Request timed out after ${timeoutMs}ms`
    );
    this.name = 'MCPRequestTimeoutError';
  }
}

/**
 * Error for resource not found
 */
export class MCPResourceNotFoundError extends MCPError {
  constructor(uri: string) {
    super(MCPErrorCode.ResourceNotFound, `Resource not found: ${uri}`);
    this.name = 'MCPResourceNotFoundError';
  }
}

/**
 * Error for tool not found
 */
export class MCPToolNotFoundError extends MCPError {
  constructor(name: string) {
    super(MCPErrorCode.ToolNotFound, `Tool not found: ${name}`);
    this.name = 'MCPToolNotFoundError';
  }
}

/**
 * Error for prompt not found
 */
export class MCPPromptNotFoundError extends MCPError {
  constructor(name: string) {
    super(MCPErrorCode.PromptNotFound, `Prompt not found: ${name}`);
    this.name = 'MCPPromptNotFoundError';
  }
}

/**
 * Error for invalid tool arguments
 */
export class MCPInvalidToolArgumentsError extends MCPError {
  constructor(toolName: string, details?: unknown) {
    super(
      MCPErrorCode.InvalidToolArguments,
      `Invalid arguments for tool: ${toolName}`,
      details
    );
    this.name = 'MCPInvalidToolArgumentsError';
  }
}

/**
 * Error for invalid resource URI
 */
export class MCPInvalidResourceUriError extends MCPError {
  constructor(uri: string) {
    super(MCPErrorCode.InvalidResourceUri, `Invalid resource URI: ${uri}`);
    this.name = 'MCPInvalidResourceUriError';
  }
}

/**
 * Error for resource access denied
 */
export class MCPResourceAccessDeniedError extends MCPError {
  constructor(uri: string) {
    super(
      MCPErrorCode.ResourceAccessDenied,
      `Access denied to resource: ${uri}`
    );
    this.name = 'MCPResourceAccessDeniedError';
  }
}

/**
 * Error for tool execution
 */
export class MCPToolExecutionError extends MCPError {
  constructor(toolName: string, details?: unknown) {
    super(
      MCPErrorCode.ToolExecutionError,
      `Error executing tool: ${toolName}`,
      details
    );
    this.name = 'MCPToolExecutionError';
  }
}

/**
 * Error for sampling operations
 */
export class MCPSamplingError extends MCPError {
  constructor(message = 'Sampling error', data?: unknown) {
    super(MCPErrorCode.SamplingError, message, data);
    this.name = 'MCPSamplingError';
  }
}

/**
 * Error for unsupported operations
 */
export class MCPUnsupportedOperationError extends MCPError {
  constructor(operation: string) {
    super(
      MCPErrorCode.UnsupportedOperation,
      `Unsupported operation: ${operation}`
    );
    this.name = 'MCPUnsupportedOperationError';
  }
}

/**
 * Error for rate limit exceeded
 */
export class MCPRateLimitExceededError extends MCPError {
  constructor(retryAfter?: number) {
    super(
      MCPErrorCode.RateLimitExceeded,
      retryAfter
        ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
        : 'Rate limit exceeded',
      retryAfter ? { retryAfter } : undefined
    );
    this.name = 'MCPRateLimitExceededError';
  }
}

/**
 * Error for authentication required
 */
export class MCPAuthenticationRequiredError extends MCPError {
  constructor(message = 'Authentication required') {
    super(MCPErrorCode.AuthenticationRequired, message);
    this.name = 'MCPAuthenticationRequiredError';
  }
}

/**
 * Error for authentication failure
 */
export class MCPAuthenticationFailedError extends MCPError {
  constructor(message = 'Authentication failed') {
    super(MCPErrorCode.AuthenticationFailed, message);
    this.name = 'MCPAuthenticationFailedError';
  }
}

/**
 * Error for transport-related issues
 */
export class MCPTransportError extends MCPError {
  constructor(message: string, data?: unknown) {
    super(MCPErrorCode.InternalError, `Transport error: ${message}`, data);
    this.name = 'MCPTransportError';
  }
}

/**
 * Error for connection issues
 */
export class MCPConnectionError extends MCPError {
  constructor(message: string, data?: unknown) {
    super(MCPErrorCode.InternalError, `Connection error: ${message}`, data);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Error for configuration issues
 */
export class MCPConfigurationError extends MCPError {
  constructor(message: string, data?: unknown) {
    super(MCPErrorCode.InvalidParams, `Configuration error: ${message}`, data);
    this.name = 'MCPConfigurationError';
  }
}

/**
 * Create an MCP error from an error code and message
 */
export function createMCPError(
  code: MCPErrorCode,
  message: string,
  data?: unknown
): MCPError {
  switch (code) {
    case MCPErrorCode.ParseError:
      return new MCPParseError(message, data);
    case MCPErrorCode.InvalidRequest:
      return new MCPInvalidRequestError(message, data);
    case MCPErrorCode.MethodNotFound:
      return new MCPMethodNotFoundError(message);
    case MCPErrorCode.InvalidParams:
      return new MCPInvalidParamsError(message, data);
    case MCPErrorCode.InternalError:
      return new MCPInternalError(message, data);
    case MCPErrorCode.ServerNotInitialized:
      return new MCPServerNotInitializedError(message);
    case MCPErrorCode.InvalidServerState:
      return new MCPInvalidServerStateError(message);
    case MCPErrorCode.RequestCancelled:
      return new MCPRequestCancelledError(message);
    case MCPErrorCode.RequestTimeout:
      return new MCPRequestTimeoutError(typeof data === 'number' ? data : 0);
    case MCPErrorCode.ResourceNotFound:
      return new MCPResourceNotFoundError(message);
    case MCPErrorCode.ToolNotFound:
      return new MCPToolNotFoundError(message);
    case MCPErrorCode.PromptNotFound:
      return new MCPPromptNotFoundError(message);
    case MCPErrorCode.InvalidToolArguments:
      return new MCPInvalidToolArgumentsError(message, data);
    case MCPErrorCode.InvalidResourceUri:
      return new MCPInvalidResourceUriError(message);
    case MCPErrorCode.ResourceAccessDenied:
      return new MCPResourceAccessDeniedError(message);
    case MCPErrorCode.ToolExecutionError:
      return new MCPToolExecutionError(message, data);
    case MCPErrorCode.SamplingError:
      return new MCPSamplingError(message, data);
    case MCPErrorCode.UnsupportedOperation:
      return new MCPUnsupportedOperationError(message);
    case MCPErrorCode.RateLimitExceeded:
      return new MCPRateLimitExceededError(typeof data === 'number' ? data : undefined);
    case MCPErrorCode.AuthenticationRequired:
      return new MCPAuthenticationRequiredError(message);
    case MCPErrorCode.AuthenticationFailed:
      return new MCPAuthenticationFailedError(message);
    default:
      return new MCPError(code, message, data);
  }
}

/**
 * Convert a standard Error to an MCPError
 */
export function toMCPError(error: Error): MCPError {
  if (error instanceof MCPError) {
    return error;
  }

  return new MCPInternalError(error.message, {
    originalError: error.name,
    stack: error.stack,
  });
}

/**
 * Get the HTTP status code for an MCP error
 */
export function getHTTPStatusCode(error: MCPError): number {
  switch (error.code) {
    case MCPErrorCode.ParseError:
    case MCPErrorCode.InvalidRequest:
    case MCPErrorCode.InvalidParams:
      return 400;
    case MCPErrorCode.AuthenticationRequired:
      return 401;
    case MCPErrorCode.AuthenticationFailed:
      return 403;
    case MCPErrorCode.ResourceNotFound:
    case MCPErrorCode.ToolNotFound:
    case MCPErrorCode.PromptNotFound:
    case MCPErrorCode.MethodNotFound:
      return 404;
    case MCPErrorCode.RequestTimeout:
      return 408;
    case MCPErrorCode.RateLimitExceeded:
      return 429;
    case MCPErrorCode.InternalError:
    case MCPErrorCode.ServerNotInitialized:
    case MCPErrorCode.InvalidServerState:
    case MCPErrorCode.ToolExecutionError:
    case MCPErrorCode.SamplingError:
      return 500;
    default:
      return 500;
  }
}
