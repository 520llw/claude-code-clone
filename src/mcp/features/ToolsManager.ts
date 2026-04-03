/**
 * Model Context Protocol (MCP) Tools Manager
 * 
 * This module provides tool registration, management, and execution
 * capabilities for MCP servers.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  Tool,
  ToolInputSchema,
  CallToolResult,
  TextContent,
  ImageContent,
  EmbeddedResource,
  ToolDefinition,
  MCP_ERROR_CODES,
  JSONRPC_ERROR_CODES,
} from '../types';

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  signal?: AbortSignal;
  clientId?: string;
}

/**
 * Tool registration options
 */
export interface ToolRegistration {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  handler: (args: unknown, context: ToolExecutionContext) => Promise<CallToolResult>;
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Tool validation error
 */
export class ToolValidationError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly validationErrors: z.ZodError<unknown>
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Tools Manager
 * 
 * Manages tool registration, validation, and execution for MCP servers.
 */
export class ToolsManager extends EventEmitter {
  private _tools = new Map<string, ToolRegistration>();
  private _isDisposed = false;

  /**
   * Get all registered tools
   */
  get tools(): Tool[] {
    return this.listTools();
  }

  /**
   * Get number of registered tools
   */
  get toolCount(): number {
    return this._tools.size;
  }

  /**
   * Get registered tool names
   */
  get toolNames(): string[] {
    return Array.from(this._tools.keys());
  }

  /**
   * Check if the manager has any tools
   */
  hasTools(): boolean {
    return this._tools.size > 0;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this._tools.has(name);
  }

  /**
   * Register a tool
   */
  registerTool(tool: ToolRegistration): void {
    this.ensureNotDisposed();

    if (this._tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    // Validate tool name
    if (!this.isValidToolName(tool.name)) {
      throw new Error(`Invalid tool name: '${tool.name}'. Names must match ^[a-zA-Z0-9_-]+$`);
    }

    this._tools.set(tool.name, tool);
    this.emit('toolRegistered', tool.name);
    this.emit('toolsChanged');
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    this.ensureNotDisposed();

    const deleted = this._tools.delete(name);
    if (deleted) {
      this.emit('toolUnregistered', name);
      this.emit('toolsChanged');
    }
    return deleted;
  }

  /**
   * Get a tool registration
   */
  getTool(name: string): ToolRegistration | undefined {
    return this._tools.get(name);
  }

  /**
   * List all registered tools in MCP format
   */
  listTools(): Tool[] {
    const tools: Tool[] = [];

    for (const [name, tool] of this._tools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: this.zodToJsonSchema(tool.parameters),
      });
    }

    return tools;
  }

  /**
   * Call a tool with validation
   */
  async callTool(
    name: string,
    args: unknown,
    context: ToolExecutionContext = {}
  ): Promise<CallToolResult> {
    this.ensureNotDisposed();

    const tool = this._tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // Validate arguments
    let validatedArgs: unknown;
    try {
      validatedArgs = tool.parameters.parse(args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ToolValidationError(
          `Invalid arguments for tool '${name}': ${error.message}`,
          name,
          error
        );
      }
      throw error;
    }

    // Execute tool
    try {
      const result = await tool.handler(validatedArgs, context);
      return result;
    } catch (error) {
      // Return error as tool result
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Validate tool arguments without executing
   */
  validateToolArgs(name: string, args: unknown): { valid: boolean; errors?: z.ZodError<unknown> } {
    const tool = this._tools.get(name);
    if (!tool) {
      return { valid: false, errors: undefined };
    }

    const result = tool.parameters.safeParse(args);
    return {
      valid: result.success,
      errors: result.success ? undefined : result.error,
    };
  }

  /**
   * Get tool schema
   */
  getToolSchema(name: string): ToolInputSchema | undefined {
    const tool = this._tools.get(name);
    if (!tool) {
      return undefined;
    }

    return this.zodToJsonSchema(tool.parameters);
  }

  /**
   * Convert Zod schema to JSON Schema
   */
  private zodToJsonSchema(schema: z.ZodType<unknown>): ToolInputSchema {
    // This is a simplified conversion - in production, use zod-to-json-schema
    const jsonSchema: ToolInputSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    try {
      // Try to get the shape if it's an object schema
      const shape = (schema as z.ZodObject<Record<string, z.ZodType<unknown>>>).shape;
      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          jsonSchema.properties![key] = this.zodTypeToJsonSchema(value);

          // Check if field is required
          if (!(value instanceof z.ZodOptional)) {
            jsonSchema.required!.push(key);
          }
        }
      }
    } catch {
      // If we can't get the shape, return a generic object schema
    }

    return jsonSchema;
  }

  /**
   * Convert a Zod type to JSON Schema
   */
  private zodTypeToJsonSchema(type: z.ZodType<unknown>): unknown {
    // Handle different Zod types
    if (type instanceof z.ZodString) {
      const schema: Record<string, unknown> = { type: 'string' };
      const description = (type as z.ZodString & { description?: string }).description;
      if (description) schema.description = description;
      return schema;
    }

    if (type instanceof z.ZodNumber) {
      return { type: 'number' };
    }

    if (type instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    if (type instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(type.element),
      };
    }

    if (type instanceof z.ZodObject) {
      const shape = type.shape as Record<string, z.ZodType<unknown>>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJsonSchema(value);
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
      };
    }

    if (type instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(type.unwrap());
    }

    if (type instanceof z.ZodNullable) {
      const inner = this.zodTypeToJsonSchema(type.unwrap());
      if (typeof inner === 'object' && inner !== null) {
        return { ...inner, nullable: true };
      }
      return inner;
    }

    if (type instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: type.options,
      };
    }

    if (type instanceof z.ZodUnion) {
      return {
        anyOf: type.options.map((opt: z.ZodType<unknown>) => this.zodTypeToJsonSchema(opt)),
      };
    }

    if (type instanceof z.ZodRecord) {
      return {
        type: 'object',
        additionalProperties: this.zodTypeToJsonSchema(type.valueSchema),
      };
    }

    if (type instanceof z.ZodAny || type instanceof z.ZodUnknown) {
      return {};
    }

    // Default fallback
    return {};
  }

  /**
   * Validate tool name format
   */
  private isValidToolName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Create a text content result
   */
  static createTextResult(text: string): CallToolResult {
    return {
      content: [{ type: 'text', text }],
    };
  }

  /**
   * Create an image content result
   */
  static createImageResult(data: string, mimeType: string): CallToolResult {
    return {
      content: [{ type: 'image', data, mimeType }],
    };
  }

  /**
   * Create an error result
   */
  static createErrorResult(error: string): CallToolResult {
    return {
      content: [{ type: 'text', text: error }],
      isError: true,
    };
  }

  /**
   * Create a resource result
   */
  static createResourceResult(
    resource: TextContent | ImageContent | EmbeddedResource
  ): CallToolResult {
    return {
      content: [resource],
    };
  }

  /**
   * Create a combined result
   */
  static createCombinedResult(
    ...contents: Array<TextContent | ImageContent | EmbeddedResource>
  ): CallToolResult {
    return {
      content: contents,
    };
  }

  /**
   * Ensure manager is not disposed
   */
  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('ToolsManager has been disposed');
    }
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._tools.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a tools manager instance
 */
export function createToolsManager(): ToolsManager {
  return new ToolsManager();
}

/**
 * Helper function to create a tool definition
 */
export function defineTool<T extends z.ZodObject<Record<string, z.ZodType<unknown>>>>(
  name: string,
  description: string,
  parameters: T,
  handler: (args: z.infer<T>) => Promise<CallToolResult>
): ToolRegistration {
  return {
    name,
    description,
    parameters,
    handler: handler as (args: unknown, context: ToolExecutionContext) => Promise<CallToolResult>,
  };
}

/**
 * Common tool parameter schemas
 */
export const ToolSchemas = {
  string: (description?: string) => z.string().describe(description ?? ''),
  number: (description?: string) => z.number().describe(description ?? ''),
  boolean: (description?: string) => z.boolean().describe(description ?? ''),
  array: <T extends z.ZodType<unknown>>(itemType: T, description?: string) =>
    z.array(itemType).describe(description ?? ''),
  object: <T extends Record<string, z.ZodType<unknown>>>(shape: T, description?: string) =>
    z.object(shape).describe(description ?? ''),
  optional: <T extends z.ZodType<unknown>>(type: T) => type.optional(),
  enum: <T extends [string, ...string[]]>(values: T, description?: string) =>
    z.enum(values).describe(description ?? ''),
};

/**
 * Built-in tool helpers
 */
export const ToolHelpers = {
  /**
   * Create a file reading tool
   */
  createReadFileTool(readFile: (path: string) => Promise<string>): ToolRegistration {
    return defineTool(
      'read_file',
      'Read the contents of a file',
      z.object({
        path: z.string().describe('The path to the file to read'),
      }),
      async ({ path }) => {
        try {
          const content = await readFile(path);
          return ToolsManager.createTextResult(content);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  },

  /**
   * Create a file writing tool
   */
  createWriteFileTool(writeFile: (path: string, content: string) => Promise<void>): ToolRegistration {
    return defineTool(
      'write_file',
      'Write content to a file',
      z.object({
        path: z.string().describe('The path to the file to write'),
        content: z.string().describe('The content to write'),
      }),
      async ({ path, content }) => {
        try {
          await writeFile(path, content);
          return ToolsManager.createTextResult(`File written successfully: ${path}`);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  },

  /**
   * Create an execute command tool
   */
  createExecuteCommandTool(execute: (command: string, args?: string[]) => Promise<string>): ToolRegistration {
    return defineTool(
      'execute_command',
      'Execute a shell command',
      z.object({
        command: z.string().describe('The command to execute'),
        args: z.array(z.string()).optional().describe('Arguments for the command'),
      }),
      async ({ command, args }) => {
        try {
          const output = await execute(command, args);
          return ToolsManager.createTextResult(output);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Command failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  },

  /**
   * Create a search tool
   */
  createSearchTool(search: (query: string) => Promise<Array<{ title: string; url: string; snippet: string }>>): ToolRegistration {
    return defineTool(
      'search',
      'Search for information',
      z.object({
        query: z.string().describe('The search query'),
      }),
      async ({ query }) => {
        try {
          const results = await search(query);
          const formatted = results
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
            .join('\n\n');
          return ToolsManager.createTextResult(formatted || 'No results found');
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Search failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  },
};
