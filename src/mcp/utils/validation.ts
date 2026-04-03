/**
 * Request/Response Validation Utilities
 * 
 * This file contains utilities for validating MCP requests and responses.
 */

import { z } from 'zod';
import {
  JSONRPCMessage,
  JSONRPCRequest,
  RequestId,
  Tool,
  Resource,
  Prompt,
  ServerCapabilities,
  MCP_PROTOCOL_VERSION,
} from '../types';
import {
  MethodRequestSchemas,
  MethodResponseSchemas,
  JSONRPCRequestSchema,
  JSONRPCMessageSchema,
} from '../types/schema';
import {
  MCPInvalidRequestError,
  MCPInvalidParamsError,
  MCPMethodNotFoundError,
} from './errors';

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Validate a JSON-RPC message
 */
export function validateMessage(message: unknown): JSONRPCMessage {
  try {
    return JSONRPCMessageSchema.parse(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidRequestError(
        'Message validation failed',
        formatZodError(error)
      );
    }
    throw error;
  }
}

/**
 * Validate a JSON-RPC request
 */
export function validateRequest(message: unknown): JSONRPCRequest {
  try {
    return JSONRPCRequestSchema.parse(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidRequestError(
        'Request validation failed',
        formatZodError(error)
      );
    }
    throw error;
  }
}

// ============================================================================
// Method Validation
// ============================================================================

/**
 * Validate request parameters for a specific method
 */
export function validateMethodParams(
  method: string,
  params: unknown
): unknown {
  const schema = MethodRequestSchemas[method];
  if (!schema) {
    throw new MCPMethodNotFoundError(method);
  }

  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        `Invalid params for method ${method}`,
        formatZodError(error)
      );
    }
    throw error;
  }
}

/**
 * Validate response result for a specific method
 */
export function validateMethodResult(
  method: string,
  result: unknown
): unknown {
  const schema = MethodResponseSchemas[method];
  if (!schema) {
    // No schema defined, allow any result
    return result;
  }

  try {
    return schema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        `Invalid result for method ${method}`,
        formatZodError(error)
      );
    }
    throw error;
  }
}

// ============================================================================
// Tool Validation
// ============================================================================

/**
 * Validate tool arguments against the tool's input schema
 */
export function validateToolArguments(
  tool: Tool,
  args: Record<string, unknown>
): { valid: boolean; errors?: string[] } {
  if (!tool.inputSchema) {
    return { valid: true };
  }

  const errors: string[] = [];

  // Check required fields
  const required = tool.inputSchema.required || [];
  for (const field of required) {
    if (!(field in args)) {
      errors.push(`Missing required argument: ${field}`);
    }
  }

  // Check property types (basic validation)
  const properties = tool.inputSchema.properties || {};
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key];
    if (propSchema && typeof propSchema === 'object') {
      const schema = propSchema as { type?: string; enum?: unknown[] };
      
      if (schema.type) {
        const expectedType = schema.type;
        const actualType = getJsonType(value);
        
        if (expectedType !== actualType && !(expectedType === 'integer' && actualType === 'number')) {
          errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
        }
      }

      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${schema.enum.join(', ')}`);
      }
    }
  }

  // Check additionalProperties
  if (tool.inputSchema.additionalProperties === false) {
    const allowedProps = Object.keys(properties);
    for (const key of Object.keys(args)) {
      if (!allowedProps.includes(key)) {
        errors.push(`Unexpected argument: ${key}`);
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate a tool definition
 */
export function validateTool(tool: unknown): Tool {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    inputSchema: z.object({
      type: z.string(),
      properties: z.record(z.unknown()).optional(),
      required: z.array(z.string()).optional(),
      additionalProperties: z.boolean().optional(),
    }),
  });

  try {
    return schema.parse(tool) as Tool;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        'Invalid tool definition',
        formatZodError(error)
      );
    }
    throw error;
  }
}

// ============================================================================
// Resource Validation
// ============================================================================

/**
 * Validate a resource URI
 */
export function validateResourceUri(uri: string): boolean {
  try {
    new URL(uri);
    return true;
  } catch {
    // Try as relative URI
    return uri.startsWith('/') || uri.includes('://') === false;
  }
}

/**
 * Validate a resource definition
 */
export function validateResource(resource: unknown): Resource {
  const schema = z.object({
    uri: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    mimeType: z.string().optional(),
  });

  try {
    return schema.parse(resource) as Resource;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        'Invalid resource definition',
        formatZodError(error)
      );
    }
    throw error;
  }
}

/**
 * Match a URI against a resource template
 */
export function matchUriTemplate(
  uri: string,
  template: string
): { matches: boolean; params?: Record<string, string> } {
  // Convert template to regex
  // Replace {param} with capture groups
  const paramNames: string[] = [];
  const regexPattern = template.replace(/\{([^}]+)\}/g, (match, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  const regex = new RegExp(`^${regexPattern}$`);
  const match = uri.match(regex);

  if (!match) {
    return { matches: false };
  }

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return { matches: true, params };
}

// ============================================================================
// Prompt Validation
// ============================================================================

/**
 * Validate a prompt definition
 */
export function validatePrompt(prompt: unknown): Prompt {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    arguments: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean().optional(),
      })
    ).optional(),
  });

  try {
    return schema.parse(prompt) as Prompt;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        'Invalid prompt definition',
        formatZodError(error)
      );
    }
    throw error;
  }
}

/**
 * Validate prompt arguments
 */
export function validatePromptArguments(
  prompt: Prompt,
  args: Record<string, string>
): { valid: boolean; errors?: string[] } {
  if (!prompt.arguments || prompt.arguments.length === 0) {
    return { valid: true };
  }

  const errors: string[] = [];

  for (const arg of prompt.arguments) {
    if (arg.required && !(arg.name in args)) {
      errors.push(`Missing required argument: ${arg.name}`);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ============================================================================
// Capability Validation
// ============================================================================

/**
 * Validate server capabilities
 */
export function validateServerCapabilities(
  capabilities: unknown
): ServerCapabilities {
  const schema = z.object({
    experimental: z.record(z.unknown()).optional(),
    logging: z.record(z.unknown()).optional(),
    prompts: z.object({
      listChanged: z.boolean().optional(),
    }).optional(),
    resources: z.object({
      subscribe: z.boolean().optional(),
      listChanged: z.boolean().optional(),
    }).optional(),
    tools: z.object({
      listChanged: z.boolean().optional(),
    }).optional(),
  });

  try {
    return schema.parse(capabilities) as ServerCapabilities;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPInvalidParamsError(
        'Invalid server capabilities',
        formatZodError(error)
      );
    }
    throw error;
  }
}

// ============================================================================
// Protocol Version Validation
// ============================================================================

/**
 * Validate protocol version compatibility
 */
export function validateProtocolVersion(
  version: string
): { compatible: boolean; message?: string } {
  const supportedVersions = ['2024-11-05'];
  
  if (supportedVersions.includes(version)) {
    return { compatible: true };
  }

  return {
    compatible: false,
    message: `Unsupported protocol version: ${version}. Supported versions: ${supportedVersions.join(', ')}`,
  };
}

/**
 * Check if two protocol versions are compatible
 */
export function areVersionsCompatible(
  version1: string,
  version2: string
): boolean {
  // For now, require exact match
  return version1 === version2;
}

// ============================================================================
// Request ID Validation
// ============================================================================

/**
 * Validate a request ID
 */
export function validateRequestId(id: unknown): id is RequestId {
  return typeof id === 'string' || typeof id === 'number';
}

/**
 * Compare two request IDs
 */
export function compareRequestIds(
  id1: RequestId,
  id2: RequestId
): boolean {
  return id1 === id2;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the JSON type of a value
 */
function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

/**
 * Format a Zod error for display
 */
function formatZodError(error: z.ZodError): string[] {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate a batch of messages
 */
export function validateMessageBatch(
  messages: unknown[]
): { valid: JSONRPCMessage[]; invalid: { index: number; error: Error }[] } {
  const valid: JSONRPCMessage[] = [];
  const invalid: { index: number; error: Error }[] = [];

  for (let i = 0; i < messages.length; i++) {
    try {
      const message = validateMessage(messages[i]);
      valid.push(message);
    } catch (error) {
      invalid.push({
        index: i,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return { valid, invalid };
}

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Validate text content
 */
export function validateTextContent(content: unknown): { valid: boolean; error?: string } {
  if (typeof content !== 'object' || content === null) {
    return { valid: false, error: 'Content must be an object' };
  }

  const c = content as Record<string, unknown>;

  if (c.type !== 'text') {
    return { valid: false, error: 'Type must be "text"' };
  }

  if (typeof c.text !== 'string') {
    return { valid: false, error: 'Text must be a string' };
  }

  return { valid: true };
}

/**
 * Validate image content
 */
export function validateImageContent(content: unknown): { valid: boolean; error?: string } {
  if (typeof content !== 'object' || content === null) {
    return { valid: false, error: 'Content must be an object' };
  }

  const c = content as Record<string, unknown>;

  if (c.type !== 'image') {
    return { valid: false, error: 'Type must be "image"' };
  }

  if (typeof c.data !== 'string') {
    return { valid: false, error: 'Data must be a string' };
  }

  if (typeof c.mimeType !== 'string') {
    return { valid: false, error: 'MimeType must be a string' };
  }

  // Validate base64 data
  try {
    Buffer.from(c.data, 'base64');
  } catch {
    return { valid: false, error: 'Data must be valid base64' };
  }

  return { valid: true };
}

// ============================================================================
// Sampling Validation
// ============================================================================

/**
 * Validate sampling parameters
 */
export function validateSamplingParams(
  params: unknown
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (typeof params !== 'object' || params === null) {
    return { valid: false, errors: ['Params must be an object'] };
  }

  const p = params as Record<string, unknown>;

  if (!Array.isArray(p.messages) || p.messages.length === 0) {
    errors.push('Messages must be a non-empty array');
  }

  if (typeof p.maxTokens !== 'number' || p.maxTokens <= 0) {
    errors.push('maxTokens must be a positive number');
  }

  if (p.temperature !== undefined) {
    if (typeof p.temperature !== 'number' || p.temperature < 0 || p.temperature > 1) {
      errors.push('temperature must be between 0 and 1');
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
