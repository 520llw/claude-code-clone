/**
 * @fileoverview Base Tool Class for Claude Code Clone
 * 
 * This module defines the abstract base class that all tools must extend.
 * It provides the foundation for tool execution, schema validation,
 * permission handling, and lifecycle management.
 * 
 * @module Tool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Permission Levels
// ============================================================================

/**
 * Permission levels for tool execution
 */
export enum PermissionLevel {
  /** Tool can execute without user approval */
  AUTO_APPROVE = 'auto_approve',
  /** Tool requires explicit user approval before execution */
  ASK = 'ask',
  /** Tool is denied by default */
  DENY = 'deny',
  /** Tool requires elevated permissions */
  ELEVATED = 'elevated',
}

/**
 * Permission decision result
 */
export interface PermissionDecision {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** The permission level applied */
  level: PermissionLevel;
  /** Optional reason for the decision */
  reason?: string;
  /** Timestamp of the decision */
  timestamp: Date;
  /** User who made the decision (if applicable) */
  decidedBy?: string;
}

// ============================================================================
// Tool Categories
// ============================================================================

/**
 * Categories of tools for organization and filtering
 */
export enum ToolCategory {
  FILE = 'file',
  SEARCH = 'search',
  EXECUTION = 'execution',
  WEB = 'web',
  CODE_INTELLIGENCE = 'code_intelligence',
  AGENT = 'agent',
  MEMORY = 'memory',
  IDE = 'ide',
}

// ============================================================================
// Tool Status
// ============================================================================

/**
 * Status of a tool execution
 */
export enum ToolExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  PERMISSION_DENIED = 'permission_denied',
}

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Base result interface for all tool executions
 */
export interface ToolResult {
  /** Unique identifier for this execution */
  executionId: string;
  /** Status of the execution */
  status: ToolExecutionStatus;
  /** The tool that was executed */
  toolName: string;
  /** Timestamp when execution started */
  startedAt: Date;
  /** Timestamp when execution completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Whether the execution was successful */
  success: boolean;
  /** Result data (if successful) */
  data?: unknown;
  /** Error information (if failed) */
  error?: ToolError;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Output for display to user */
  output?: string;
}

/**
 * Tool error information
 */
export interface ToolError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error description */
  details?: string;
  /** Stack trace (in development mode) */
  stack?: string;
  /** Suggested fix or action */
  suggestion?: string;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Original error that caused this */
  cause?: unknown;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId?: string;
  /** Working directory */
  workingDirectory: string;
  /** Environment variables */
  environment: Record<string, string>;
  /** Project root */
  projectRoot?: string;
  /** Additional context */
  [key: string]: unknown;
}

// ============================================================================
// Tool Options
// ============================================================================

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to skip permission checks */
  skipPermissionCheck?: boolean;
  /** Whether to cache the result */
  cacheResult?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Additional options */
  [key: string]: unknown;
}

/**
 * Tool configuration options
 */
export interface ToolConfig {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Maximum timeout in milliseconds */
  maxTimeout?: number;
  /** Whether to enable caching by default */
  enableCache?: boolean;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
  /** Logging configuration */
  logging?: LoggingConfig;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Allowed directories */
  allowedDirectories?: string[];
  /** Blocked directories */
  blockedDirectories?: string[];
  /** Allowed commands */
  allowedCommands?: string[];
  /** Blocked commands */
  blockedCommands?: string[];
  /** Maximum file size to read */
  maxFileSize?: number;
  /** Maximum output size */
  maxOutputSize?: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to log to console */
  console: boolean;
  /** Whether to log to file */
  file?: string;
}

// ============================================================================
// Tool Events
// ============================================================================

/**
 * Events emitted by tools
 */
export interface ToolEvents {
  /** Emitted when execution starts */
  'execution:start': { executionId: string; toolName: string; input: unknown };
  /** Emitted when execution completes */
  'execution:complete': { executionId: string; result: ToolResult };
  /** Emitted when execution fails */
  'execution:error': { executionId: string; error: ToolError };
  /** Emitted when permission is requested */
  'permission:requested': { executionId: string; toolName: string; reason: string };
  /** Emitted when permission is granted */
  'permission:granted': { executionId: string; level: PermissionLevel };
  /** Emitted when permission is denied */
  'permission:denied': { executionId: string; reason: string };
}

// ============================================================================
// Abstract Tool Class
// ============================================================================

/**
 * Abstract base class for all tools in the Claude Code Clone system.
 * 
 * This class provides the foundation for implementing tools with:
 * - Schema-based input/output validation using Zod
 * - Permission-based execution control
 * - Event-driven architecture
 * - Comprehensive error handling
 * - Execution lifecycle management
 * 
 * @example
 * ```typescript
 * class MyTool extends Tool {
 *   name = 'my_tool';
 *   description = 'Does something useful';
 *   category = ToolCategory.FILE;
 *   permissionLevel = PermissionLevel.ASK;
 * 
 *   inputSchema = z.object({
 *     path: z.string().describe('File path')
 *   });
 * 
 *   outputSchema = z.object({
 *     content: z.string()
 *   });
 * 
 *   async execute(input: z.infer<typeof this.inputSchema>): Promise<ToolResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class Tool extends EventEmitter {
  /**
   * Unique identifier for this tool instance
   */
  public readonly id: string = uuidv4();

  /**
   * Tool name (must be unique across all tools)
   */
  public abstract readonly name: string;

  /**
   * Human-readable description of what the tool does
   */
  public abstract readonly description: string;

  /**
   * Detailed documentation for the tool
   */
  public abstract readonly documentation: string;

  /**
   * Category this tool belongs to
   */
  public abstract readonly category: ToolCategory;

  /**
   * Default permission level for this tool
   */
  public abstract readonly permissionLevel: PermissionLevel;

  /**
   * Zod schema for validating input
   */
  public abstract readonly inputSchema: z.ZodType<unknown>;

  /**
   * Zod schema for validating output
   */
  public abstract readonly outputSchema: z.ZodType<unknown>;

  /**
   * Examples of tool usage
   */
  public abstract readonly examples: Array<{
    description: string;
    input: unknown;
    output?: unknown;
  }>;

  /**
   * Whether this tool requires a sandboxed environment
   */
  public readonly requiresSandbox: boolean = false;

  /**
   * Whether this tool can be cached
   */
  public readonly cacheable: boolean = false;

  /**
   * Default cache TTL in milliseconds
   */
  public readonly defaultCacheTtl: number = 60000;

  /**
   * Tags for categorizing and filtering tools
   */
  public readonly tags: string[] = [];

  /**
   * Version of this tool
   */
  public readonly version: string = '1.0.0';

  /**
   * Author of this tool
   */
  public readonly author: string = 'Claude Code Clone';

  /**
   * Tool configuration
   */
  protected config: ToolConfig;

  /**
   * Cache for storing results
   */
  private resultCache: Map<string, { result: ToolResult; expiresAt: number }> = new Map();

  /**
   * Creates a new Tool instance
   * @param config - Tool configuration options
   */
  constructor(config: ToolConfig = {}) {
    super();
    this.config = {
      defaultTimeout: 30000,
      maxTimeout: 300000,
      enableCache: false,
      logging: { level: 'info', console: true },
      ...config,
    };
  }

  // ============================================================================
  // Abstract Methods
  // ============================================================================

  /**
   * Execute the tool with the given input
   * 
   * This method must be implemented by all concrete tool classes.
   * It contains the actual logic for the tool's functionality.
   * 
   * @param input - Validated input data
   * @param context - Execution context
   * @returns Promise resolving to the tool result
   */
  protected abstract executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult>;

  /**
   * Validate that the tool can be executed in the current context
   * 
   * Override this method to add custom validation logic.
   * 
   * @param input - Input data to validate
   * @param context - Execution context
   * @returns Validation result
   */
  protected abstract validateContext(
    input: unknown,
    context: ToolContext
  ): Promise<{ valid: boolean; errors?: string[] }>;

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Execute the tool with full lifecycle management
   * 
   * This method handles:
   * - Input validation
   * - Permission checking
   * - Execution with timeout
   * - Error handling
   * - Result caching
   * - Event emission
   * 
   * @param rawInput - Raw input data (will be validated)
   * @param context - Execution context
   * @param options - Execution options
   * @returns Promise resolving to the tool result
   */
  public async execute(
    rawInput: unknown,
    context: ToolContext,
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const executionId = uuidv4();
    const startedAt = new Date();

    // Emit start event
    this.emit('execution:start', { executionId, toolName: this.name, input: rawInput });
    this.log('debug', `Starting execution ${executionId} for tool ${this.name}`);

    try {
      // Step 1: Validate input
      const validationResult = await this.validateInput(rawInput);
      if (!validationResult.success) {
        const error: ToolError = {
          code: 'VALIDATION_ERROR',
          message: `Input validation failed: ${validationResult.errors?.join(', ')}`,
          details: validationResult.errors?.join('\n'),
          retryable: false,
        };
        return this.createErrorResult(executionId, startedAt, error);
      }

      const validatedInput = validationResult.data;

      // Step 2: Check permissions
      if (!options.skipPermissionCheck) {
        const permissionResult = await this.checkPermission(validatedInput, context);
        if (!permissionResult.allowed) {
          const error: ToolError = {
            code: 'PERMISSION_DENIED',
            message: `Permission denied: ${permissionResult.reason || 'Tool execution not allowed'}`,
            retryable: false,
          };
          this.emit('permission:denied', { executionId, reason: error.message });
          return this.createErrorResult(executionId, startedAt, error, ToolExecutionStatus.PERMISSION_DENIED);
        }
        this.emit('permission:granted', { executionId, level: permissionResult.level });
      }

      // Step 3: Validate context
      const contextValidation = await this.validateContext(validatedInput, context);
      if (!contextValidation.valid) {
        const error: ToolError = {
          code: 'CONTEXT_VALIDATION_ERROR',
          message: `Context validation failed: ${contextValidation.errors?.join(', ')}`,
          details: contextValidation.errors?.join('\n'),
          retryable: false,
        };
        return this.createErrorResult(executionId, startedAt, error);
      }

      // Step 4: Check cache
      if (options.cacheResult !== false && (this.cacheable || options.cacheResult)) {
        const cachedResult = this.getCachedResult(validatedInput);
        if (cachedResult) {
          this.log('debug', `Cache hit for execution ${executionId}`);
          return {
            ...cachedResult,
            executionId,
            startedAt,
            completedAt: new Date(),
            duration: 0,
          };
        }
      }

      // Step 5: Execute with timeout
      const timeout = Math.min(
        options.timeout || this.config.defaultTimeout || 30000,
        this.config.maxTimeout || 300000
      );

      const result = await this.executeWithTimeout(
        validatedInput,
        context,
        timeout,
        options.signal,
        executionId,
        startedAt
      );

      // Step 6: Cache result if successful
      if (result.success && (this.cacheable || options.cacheResult)) {
        this.cacheResult(validatedInput, result, options.cacheTtl);
      }

      // Emit completion event
      this.emit('execution:complete', { executionId, result });
      this.log('debug', `Completed execution ${executionId}`);

      return result;

    } catch (error) {
      const toolError = this.convertToToolError(error);
      this.emit('execution:error', { executionId, error: toolError });
      this.log('error', `Execution ${executionId} failed: ${toolError.message}`);
      return this.createErrorResult(executionId, startedAt, toolError);
    }
  }

  /**
   * Get the JSON schema for this tool's input
   * @returns JSON schema object
   */
  public getInputSchema(): Record<string, unknown> {
    return this.zodToJsonSchema(this.inputSchema);
  }

  /**
   * Get the JSON schema for this tool's output
   * @returns JSON schema object
   */
  public getOutputSchema(): Record<string, unknown> {
    return this.zodToJsonSchema(this.outputSchema);
  }

  /**
   * Get tool metadata
   * @returns Tool metadata object
   */
  public getMetadata(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      permissionLevel: this.permissionLevel,
      version: this.version,
      author: this.author,
      tags: this.tags,
      cacheable: this.cacheable,
      requiresSandbox: this.requiresSandbox,
      inputSchema: this.getInputSchema(),
      outputSchema: this.getOutputSchema(),
      examples: this.examples,
    };
  }

  /**
   * Clear the result cache
   */
  public clearCache(): void {
    this.resultCache.clear();
    this.log('debug', 'Cache cleared');
  }

  // ============================================================================
  // Protected Methods
  // ============================================================================

  /**
   * Log a message
   * @param level - Log level
   * @param message - Message to log
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const configLevel = this.config.logging?.level || 'info';
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    
    if (levels[level] >= levels[configLevel]) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}`;
      
      if (this.config.logging?.console) {
        console[level](logMessage);
      }
    }
  }

  /**
   * Create a success result
   * @param executionId - Execution ID
   * @param startedAt - Start timestamp
   * @param data - Result data
   * @param output - Output for display
   * @param metadata - Additional metadata
   * @returns Tool result
   */
  protected createSuccessResult(
    executionId: string,
    startedAt: Date,
    data: unknown,
    output?: string,
    metadata?: Record<string, unknown>
  ): ToolResult {
    const completedAt = new Date();
    return {
      executionId,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      success: true,
      data,
      output,
      metadata,
    };
  }

  /**
   * Create an error result
   * @param executionId - Execution ID
   * @param startedAt - Start timestamp
   * @param error - Error information
   * @param status - Execution status
   * @returns Tool result
   */
  protected createErrorResult(
    executionId: string,
    startedAt: Date,
    error: ToolError,
    status: ToolExecutionStatus = ToolExecutionStatus.FAILURE
  ): ToolResult {
    const completedAt = new Date();
    return {
      executionId,
      status,
      toolName: this.name,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      success: false,
      error,
    };
  }

  /**
   * Check if the tool has permission to execute
   * @param input - Validated input
   * @param context - Execution context
   * @returns Permission decision
   */
  protected async checkPermission(
    input: unknown,
    context: ToolContext
  ): Promise<PermissionDecision> {
    // Default implementation - can be overridden
    // In a real implementation, this would check with a permission manager
    return {
      allowed: true,
      level: this.permissionLevel,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate input against the schema
   * @param input - Input to validate
   * @returns Validation result
   */
  private async validateInput(input: unknown): Promise<
    | { success: true; data: unknown }
    | { success: false; errors: string[] }
  > {
    try {
      const validated = await this.inputSchema.parseAsync(input);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        return { success: false, errors };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Execute with timeout support
   * @param input - Validated input
   * @param context - Execution context
   * @param timeout - Timeout in milliseconds
   * @param signal - Abort signal
   * @returns Tool result
   */
  private async executeWithTimeout(
    input: unknown,
    context: ToolContext,
    timeout: number,
    signal?: AbortSignal,
    executionId?: string,
    startedAt?: Date
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const execId = executionId || uuidv4();
      const execStartedAt = startedAt || new Date();

      const timeoutId = setTimeout(() => {
        const error: ToolError = {
          code: 'TIMEOUT',
          message: `Tool execution timed out after ${timeout}ms`,
          retryable: true,
        };
        resolve(this.createErrorResult(execId, execStartedAt, error, ToolExecutionStatus.TIMEOUT));
      }, timeout);

      const handleAbort = () => {
        clearTimeout(timeoutId);
        const error: ToolError = {
          code: 'CANCELLED',
          message: 'Tool execution was cancelled',
          retryable: true,
        };
        resolve(this.createErrorResult(execId, execStartedAt, error, ToolExecutionStatus.CANCELLED));
      };

      if (signal) {
        signal.addEventListener('abort', handleAbort);
      }

      this.executeImpl(input, context)
        .then((result) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', handleAbort);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', handleAbort);
          }
          reject(error);
        });
    });
  }

  /**
   * Convert an error to ToolError format
   * @param error - Error to convert
   * @returns ToolError
   */
  private convertToToolError(error: unknown): ToolError {
    if (error instanceof Error) {
      return {
        code: 'EXECUTION_ERROR',
        message: error.message,
        stack: error.stack,
        retryable: false,
        cause: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retryable: false,
      cause: error,
    };
  }

  /**
   * Get a cached result if available
   * @param input - Input to check
   * @returns Cached result or undefined
   */
  private getCachedResult(input: unknown): ToolResult | undefined {
    const cacheKey = this.getCacheKey(input);
    const cached = this.resultCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    
    if (cached) {
      this.resultCache.delete(cacheKey);
    }
    
    return undefined;
  }

  /**
   * Cache a result
   * @param input - Input that produced the result
   * @param result - Result to cache
   * @param ttl - Time to live in milliseconds
   */
  private cacheResult(input: unknown, result: ToolResult, ttl?: number): void {
    const cacheKey = this.getCacheKey(input);
    const expiresAt = Date.now() + (ttl || this.defaultCacheTtl);
    this.resultCache.set(cacheKey, { result, expiresAt });
  }

  /**
   * Get a cache key for an input
   * @param input - Input to hash
   * @returns Cache key
   */
  private getCacheKey(input: unknown): string {
    // Simple JSON-based cache key - could be improved with proper hashing
    return `${this.name}:${JSON.stringify(input)}`;
  }

  /**
   * Convert Zod schema to JSON schema
   * @param schema - Zod schema
   * @returns JSON schema object
   */
  private zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
    // This is a simplified implementation
    // In production, you might use zod-to-json-schema package
    const description = schema.description;
    const jsonSchema: Record<string, unknown> = {
      type: 'object',
    };
    
    if (description) {
      jsonSchema.description = description;
    }

    // Try to extract properties from the schema
    // This is a basic implementation that works for simple object schemas
    if (schema instanceof z.ZodObject) {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodType<unknown>;
        properties[key] = this.zodTypeToJsonSchema(zodValue);
        
        if (!(zodValue instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      jsonSchema.properties = properties;
      if (required.length > 0) {
        jsonSchema.required = required;
      }
    }

    return jsonSchema;
  }

  /**
   * Convert a Zod type to JSON schema
   * @param type - Zod type
   * @returns JSON schema for the type
   */
  private zodTypeToJsonSchema(type: z.ZodType<unknown>): Record<string, unknown> {
    if (type instanceof z.ZodString) {
      return { type: 'string', description: type.description };
    }
    if (type instanceof z.ZodNumber) {
      return { type: 'number', description: type.description };
    }
    if (type instanceof z.ZodBoolean) {
      return { type: 'boolean', description: type.description };
    }
    if (type instanceof z.ZodArray) {
      const elementType = (type as z.ZodArray<z.ZodType<unknown>>).element;
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(elementType),
        description: type.description,
      };
    }
    if (type instanceof z.ZodOptional) {
      const innerType = (type as z.ZodOptional<z.ZodType<unknown>>).unwrap();
      return this.zodTypeToJsonSchema(innerType);
    }
    if (type instanceof z.ZodNullable) {
      const innerType = (type as z.ZodNullable<z.ZodType<unknown>>).unwrap();
      const schema = this.zodTypeToJsonSchema(innerType);
      return { ...schema, nullable: true };
    }
    if (type instanceof z.ZodEnum) {
      const values = (type as z.ZodEnum<[string, ...string[]]>).options;
      return { type: 'string', enum: values, description: type.description };
    }
    if (type instanceof z.ZodObject) {
      return this.zodToJsonSchema(type);
    }
    
    return { description: type.description };
  }
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Factory for creating tool instances
 */
export class ToolFactory {
  private static toolConstructors: Map<string, new (config?: ToolConfig) => Tool> = new Map();

  /**
   * Register a tool constructor
   * @param name - Tool name
   * @param constructor - Tool constructor
   */
  public static register(name: string, constructor: new (config?: ToolConfig) => Tool): void {
    this.toolConstructors.set(name, constructor);
  }

  /**
   * Create a tool instance
   * @param name - Tool name
   * @param config - Tool configuration
   * @returns Tool instance or undefined if not found
   */
  public static create(name: string, config?: ToolConfig): Tool | undefined {
    const constructor = this.toolConstructors.get(name);
    if (constructor) {
      return new constructor(config);
    }
    return undefined;
  }

  /**
   * Get all registered tool names
   * @returns Array of tool names
   */
  public static getRegisteredTools(): string[] {
    return Array.from(this.toolConstructors.keys());
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a standardized tool error
 * @param code - Error code
 * @param message - Error message
 * @param options - Additional options
 * @returns ToolError
 */
export function createToolError(
  code: string,
  message: string,
  options: Partial<Omit<ToolError, 'code' | 'message'>> = {}
): ToolError {
  return {
    code,
    message,
    retryable: false,
    ...options,
  };
}

/**
 * Check if a result is successful
 * @param result - Tool result
 * @returns True if successful
 */
export function isSuccess(result: ToolResult): boolean {
  return result.success;
}

/**
 * Check if a result is a failure
 * @param result - Tool result
 * @returns True if failed
 */
export function isFailure(result: ToolResult): boolean {
  return !result.success;
}

/**
 * Get data from a successful result
 * @param result - Tool result
 * @returns Data or undefined if failed
 */
export function getResultData<T>(result: ToolResult): T | undefined {
  return result.success ? (result.data as T) : undefined;
}

/**
 * Get error from a failed result
 * @param result - Tool result
 * @returns Error or undefined if successful
 */
export function getResultError(result: ToolResult): ToolError | undefined {
  return result.success ? undefined : result.error;
}

export default Tool;
