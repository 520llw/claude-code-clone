/**
 * JSON-RPC Serialization Utilities
 * 
 * This file contains utilities for serializing and deserializing JSON-RPC messages.
 */

import {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCSuccessResponse,
  JSONRPCErrorResponse,
  RequestId,
} from '../types';
import { MCPParseError, MCPInvalidRequestError } from './errors';

// ============================================================================
// Message Serialization
// ============================================================================

/**
 * Serialize a JSON-RPC message to a string
 */
export function serializeMessage(message: JSONRPCMessage): string {
  try {
    return JSON.stringify(message);
  } catch (error) {
    throw new MCPParseError(
      'Failed to serialize message',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Serialize multiple JSON-RPC messages to a string (batch)
 */
export function serializeMessages(messages: JSONRPCMessage[]): string {
  try {
    return JSON.stringify(messages);
  } catch (error) {
    throw new MCPParseError(
      'Failed to serialize messages',
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// Message Deserialization
// ============================================================================

/**
 * Deserialize a JSON-RPC message from a string
 */
export function deserializeMessage(data: string): JSONRPCMessage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch (error) {
    throw new MCPParseError(
      'Invalid JSON',
      error instanceof Error ? error.message : String(error)
    );
  }

  return validateMessage(parsed);
}

/**
 * Deserialize multiple JSON-RPC messages from a string (batch)
 */
export function deserializeMessages(data: string): JSONRPCMessage[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch (error) {
    throw new MCPParseError(
      'Invalid JSON',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!Array.isArray(parsed)) {
    throw new MCPInvalidRequestError('Expected array of messages');
  }

  return parsed.map(validateMessage);
}

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Validate and cast an unknown value to a JSON-RPC message
 */
export function validateMessage(message: unknown): JSONRPCMessage {
  if (typeof message !== 'object' || message === null) {
    throw new MCPInvalidRequestError('Message must be an object');
  }

  const msg = message as Record<string, unknown>;

  // Check jsonrpc version
  if (msg.jsonrpc !== '2.0') {
    throw new MCPInvalidRequestError('Invalid or missing jsonrpc version');
  }

  // Check for error
  if ('error' in msg) {
    return validateErrorResponse(msg);
  }

  // Check for result (success response)
  if ('result' in msg) {
    return validateSuccessResponse(msg);
  }

  // Check for method (request or notification)
  if ('method' in msg) {
    if ('id' in msg) {
      return validateRequest(msg);
    } else {
      return validateNotification(msg);
    }
  }

  throw new MCPInvalidRequestError('Invalid message structure');
}

function validateRequest(message: Record<string, unknown>): JSONRPCRequest {
  if (typeof message.method !== 'string') {
    throw new MCPInvalidRequestError('Method must be a string');
  }

  if (!isValidRequestId(message.id)) {
    throw new MCPInvalidRequestError('Invalid request ID');
  }

  return {
    jsonrpc: '2.0',
    id: message.id,
    method: message.method,
    params: message.params,
  };
}

function validateNotification(message: Record<string, unknown>): JSONRPCNotification {
  if (typeof message.method !== 'string') {
    throw new MCPInvalidRequestError('Method must be a string');
  }

  return {
    jsonrpc: '2.0',
    method: message.method,
    params: message.params,
  };
}

function validateSuccessResponse(message: Record<string, unknown>): JSONRPCSuccessResponse {
  if (!isValidRequestId(message.id)) {
    throw new MCPInvalidRequestError('Invalid response ID');
  }

  return {
    jsonrpc: '2.0',
    id: message.id,
    result: message.result,
  };
}

function validateErrorResponse(message: Record<string, unknown>): JSONRPCErrorResponse {
  const error = message.error;

  if (typeof error !== 'object' || error === null) {
    throw new MCPInvalidRequestError('Error must be an object');
  }

  const err = error as Record<string, unknown>;

  if (typeof err.code !== 'number') {
    throw new MCPInvalidRequestError('Error code must be a number');
  }

  if (typeof err.message !== 'string') {
    throw new MCPInvalidRequestError('Error message must be a string');
  }

  return {
    jsonrpc: '2.0',
    id: isValidRequestId(message.id) ? message.id : null,
    error: {
      code: err.code,
      message: err.message,
      data: err.data,
    },
  };
}

function isValidRequestId(id: unknown): id is RequestId {
  return typeof id === 'string' || typeof id === 'number';
}

// ============================================================================
// Message Creation Helpers
// ============================================================================

let requestIdCounter = 0;

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

/**
 * Create a JSON-RPC request
 */
export function createRequest(
  method: string,
  params?: unknown,
  id?: RequestId
): JSONRPCRequest {
  return {
    jsonrpc: '2.0',
    id: id ?? generateRequestId(),
    method,
    params,
  };
}

/**
 * Create a JSON-RPC notification
 */
export function createNotification(
  method: string,
  params?: unknown
): JSONRPCNotification {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(
  id: RequestId,
  result: unknown
): JSONRPCSuccessResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
  id: RequestId | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

// ============================================================================
// Message Type Guards
// ============================================================================

/**
 * Check if a message is a request
 */
export function isRequest(message: JSONRPCMessage): message is JSONRPCRequest {
  return 'method' in message && 'id' in message;
}

/**
 * Check if a message is a notification
 */
export function isNotification(message: JSONRPCMessage): message is JSONRPCNotification {
  return 'method' in message && !('id' in message);
}

/**
 * Check if a message is a success response
 */
export function isSuccessResponse(
  message: JSONRPCMessage
): message is JSONRPCSuccessResponse {
  return 'result' in message;
}

/**
 * Check if a message is an error response
 */
export function isErrorResponse(
  message: JSONRPCMessage
): message is JSONRPCErrorResponse {
  return 'error' in message;
}

/**
 * Check if a message is a response (success or error)
 */
export function isResponse(
  message: JSONRPCMessage
): message is JSONRPCSuccessResponse | JSONRPCErrorResponse {
  return isSuccessResponse(message) || isErrorResponse(message);
}

// ============================================================================
// Message Inspection
// ============================================================================

/**
 * Get the method name from a message (if it's a request or notification)
 */
export function getMessageMethod(message: JSONRPCMessage): string | undefined {
  if (isRequest(message) || isNotification(message)) {
    return message.method;
  }
  return undefined;
}

/**
 * Get the request ID from a message (if it's a request or response)
 */
export function getMessageId(message: JSONRPCMessage): RequestId | undefined {
  if (isRequest(message) || isResponse(message)) {
    return message.id;
  }
  return undefined;
}

// ============================================================================
// Line-delimited JSON (LDJSON) Helpers
// ============================================================================

/**
 * Serialize a message for line-delimited JSON transport
 */
export function serializeLDJSON(message: JSONRPCMessage): string {
  return serializeMessage(message) + '\n';
}

/**
 * Deserialize line-delimited JSON messages
 */
export function deserializeLDJSON(data: string): JSONRPCMessage[] {
  const lines = data.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => deserializeMessage(line));
}

// ============================================================================
// Message Size Utilities
// ============================================================================

/**
 * Calculate the size of a serialized message in bytes
 */
export function getMessageSize(message: JSONRPCMessage): number {
  return Buffer.byteLength(serializeMessage(message), 'utf8');
}

/**
 * Check if a message exceeds the maximum size
 */
export function isMessageTooLarge(
  message: JSONRPCMessage,
  maxSize: number
): boolean {
  return getMessageSize(message) > maxSize;
}

// ============================================================================
// Message Truncation (for logging)
// ============================================================================

/**
 * Truncate a message for logging purposes
 */
export function truncateMessage(
  message: JSONRPCMessage,
  maxLength: number = 500
): string {
  const serialized = serializeMessage(message);
  if (serialized.length <= maxLength) {
    return serialized;
  }
  return serialized.substring(0, maxLength) + '... [truncated]';
}
