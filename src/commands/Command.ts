/**
 * @fileoverview Base Command Class for Claude Code Clone
 * @module commands/Command
 * @description Provides the abstract base class that all slash commands must extend.
 * Implements the command pattern with comprehensive support for argument parsing,
 * validation, help documentation, error handling, and permission management.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Command execution context containing all information needed for command execution
 * @interface CommandContext
 */
export interface CommandContext {
  /** Current working directory */
  cwd: string;
  /** User ID executing the command */
  userId: string;
  /** Session ID for tracking */
  sessionId: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Git repository information */
  gitInfo?: GitInfo;
  /** Current project configuration */
  projectConfig?: ProjectConfig;
  /** Terminal output interface */
  output: OutputInterface;
  /** Input interface for user interaction */
  input: InputInterface;
  /** Memory storage interface */
  memory: MemoryInterface;
  /** Agent manager interface */
  agentManager: AgentManagerInterface;
  /** Settings manager */
  settings: SettingsInterface;
}

/**
 * Git repository information
 * @interface GitInfo
 */
export interface GitInfo {
  /** Whether current directory is a git repository */
  isRepo: boolean;
  /** Current branch name */
  branch: string;
  /** Remote URL */
  remoteUrl?: string;
  /** Last commit hash */
  lastCommit?: string;
  /** Whether working directory is clean */
  isClean: boolean;
}

/**
 * Project configuration
 * @interface ProjectConfig
 */
export interface ProjectConfig {
  /** Project name */
  name: string;
  /** Project root directory */
  root: string;
  /** Programming language */
  language?: string;
  /** Framework being used */
  framework?: string;
  /** Custom configuration */
  config: Record<string, unknown>;
}

/**
 * Output interface for command results
 * @interface OutputInterface
 */
export interface OutputInterface {
  /** Write text output */
  write(text: string): void;
  /** Write error output */
  error(text: string): void;
  /** Write success output */
  success(text: string): void;
  /** Write warning output */
  warning(text: string): void;
  /** Write info output */
  info(text: string): void;
  /** Write JSON data */
  json(data: unknown): void;
  /** Clear the screen */
  clear(): void;
  /** Start a spinner */
  startSpinner(text: string): SpinnerHandle;
  /** Create a progress bar */
  progressBar(total: number, options?: ProgressBarOptions): ProgressBarHandle;
  /** Create a table */
  table(data: TableData): void;
}

/**
 * Spinner handle for loading indicators
 * @interface SpinnerHandle
 */
export interface SpinnerHandle {
  /** Update spinner text */
  update(text: string): void;
  /** Stop spinner with success */
  succeed(text?: string): void;
  /** Stop spinner with failure */
  fail(text?: string): void;
  /** Stop spinner with warning */
  warn(text?: string): void;
  /** Stop spinner with info */
  info(text?: string): void;
}

/**
 * Progress bar options
 * @interface ProgressBarOptions
 */
export interface ProgressBarOptions {
  /** Progress bar format */
  format?: string;
  /** Bar width */
  width?: number;
  /** Clear on complete */
  clearOnComplete?: boolean;
}

/**
 * Progress bar handle
 * @interface ProgressBarHandle
 */
export interface ProgressBarHandle {
  /** Update progress */
  update(current: number): void;
  /** Increment progress */
  increment(amount?: number): void;
  /** Stop progress bar */
  stop(): void;
}

/**
 * Table data structure
 * @interface TableData
 */
export interface TableData {
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: (string | number | boolean)[][];
  /** Column alignments */
  align?: ('left' | 'right' | 'center')[];
}

/**
 * Input interface for user interaction
 * @interface InputInterface
 */
export interface InputInterface {
  /** Ask a yes/no question */
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
  /** Ask for text input */
  prompt(message: string, defaultValue?: string): Promise<string>;
  /** Ask for password input (hidden) */
  password(message: string): Promise<string>;
  /** Select from multiple options */
  select<T>(message: string, choices: { name: string; value: T }[]): Promise<T>;
  /** Multi-select from options */
  multiSelect<T>(message: string, choices: { name: string; value: T }[]): Promise<T[]>;
  /** Autocomplete input */
  autocomplete(message: string, choices: string[]): Promise<string>;
}

/**
 * Memory interface for persistent storage
 * @interface MemoryInterface
 */
export interface MemoryInterface {
  /** Read a memory entry */
  read(key: string): Promise<unknown | null>;
  /** Write a memory entry */
  write(key: string, value: unknown): Promise<void>;
  /** Search memory entries */
  search(query: string): Promise<MemoryEntry[]>;
  /** List all memory keys */
  list(): Promise<string[]>;
  /** Delete a memory entry */
  delete(key: string): Promise<void>;
  /** Clear all memory */
  clear(): Promise<void>;
}

/**
 * Memory entry structure
 * @interface MemoryEntry
 */
export interface MemoryEntry {
  /** Memory key */
  key: string;
  /** Memory value */
  value: unknown;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Agent manager interface
 * @interface AgentManagerInterface
 */
export interface AgentManagerInterface {
  /** Spawn a new agent */
  spawn(config: AgentConfig): Promise<AgentHandle>;
  /** List active agents */
  list(): AgentHandle[];
  /** Get agent by ID */
  get(id: string): AgentHandle | null;
  /** Kill an agent */
  kill(id: string): Promise<boolean>;
  /** Get agent status */
  status(id: string): AgentStatus | null;
}

/**
 * Agent configuration
 * @interface AgentConfig
 */
export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Agent role/purpose */
  role: string;
  /** Initial instructions */
  instructions: string;
  /** Working directory */
  cwd?: string;
  /** Maximum tokens */
  maxTokens?: number;
  /** Model to use */
  model?: string;
}

/**
 * Agent handle for interacting with spawned agents
 * @interface AgentHandle
 */
export interface AgentHandle {
  /** Agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Send message to agent */
  send(message: string): Promise<string>;
  /** Get agent status */
  getStatus(): AgentStatus;
  /** Terminate the agent */
  terminate(): Promise<void>;
}

/**
 * Agent status information
 * @interface AgentStatus
 */
export interface AgentStatus {
  /** Agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Current state */
  state: 'idle' | 'working' | 'error' | 'terminated';
  /** Tasks completed */
  tasksCompleted: number;
  /** Current task if any */
  currentTask?: string;
  /** Uptime in seconds */
  uptime: number;
}

/**
 * Settings interface
 * @interface SettingsInterface
 */
export interface SettingsInterface {
  /** Get a setting value */
  get<T>(key: string, defaultValue?: T): T;
  /** Set a setting value */
  set<T>(key: string, value: T): void;
  /** List all settings */
  list(): Record<string, unknown>;
  /** Reset a setting to default */
  reset(key: string): void;
  /** Reset all settings */
  resetAll(): void;
  /** Save settings to disk */
  save(): Promise<void>;
  /** Load settings from disk */
  load(): Promise<void>;
}

/**
 * Command argument definition
 * @interface CommandArgument
 */
export interface CommandArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description: string;
  /** Whether argument is required */
  required: boolean;
  /** Default value */
  default?: unknown;
  /** Zod schema for validation */
  schema?: z.ZodType<unknown>;
  /** Argument type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Valid choices for the argument */
  choices?: string[];
}

/**
 * Command option definition
 * @interface CommandOption
 */
export interface CommandOption {
  /** Option name (short) */
  short?: string;
  /** Option name (long) */
  long: string;
  /** Option description */
  description: string;
  /** Whether option is required */
  required?: boolean;
  /** Default value */
  default?: unknown;
  /** Zod schema for validation */
  schema?: z.ZodType<unknown>;
  /** Option type */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Valid choices for the option */
  choices?: string[];
}

/**
 * Command example
 * @interface CommandExample
 */
export interface CommandExample {
  /** Example description */
  description: string;
  /** Example command */
  command: string;
  /** Expected output */
  output?: string;
}

/**
 * Command permission requirements
 * @interface CommandPermissions
 */
export interface CommandPermissions {
  /** Require git repository */
  requireGit?: boolean;
  /** Require clean working directory */
  requireCleanWorkingDir?: boolean;
  /** Minimum permission level */
  minLevel?: 'user' | 'admin' | 'system';
  /** Required environment variables */
  requiredEnv?: string[];
  /** Custom permission check */
  customCheck?: (context: CommandContext) => boolean | Promise<boolean>;
}

/**
 * Command execution result
 * @interface CommandResult
 */
export interface CommandResult {
  /** Whether execution was successful */
  success: boolean;
  /** Exit code */
  exitCode: number;
  /** Result data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parsed command arguments
 * @interface ParsedArguments
 */
export interface ParsedArguments {
  /** Positional arguments */
  args: Record<string, unknown>;
  /** Named options */
  options: Record<string, unknown>;
  /** Raw command string */
  raw: string;
  /** Command name */
  command: string;
}

/**
 * Command metadata for registration
 * @interface CommandMetadata
 */
export interface CommandMetadata {
  /** Command name (e.g., 'git-status') */
  name: string;
  /** Command description */
  description: string;
  /** Command category */
  category: string;
  /** Command aliases */
  aliases?: string[];
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Command options */
  options?: CommandOption[];
  /** Usage examples */
  examples?: CommandExample[];
  /** Permission requirements */
  permissions?: CommandPermissions;
  /** Whether command is hidden from help */
  hidden?: boolean;
  /** Whether command is deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Command version */
  version?: string;
  /** Related commands */
  relatedCommands?: string[];
  /** Documentation URL */
  docsUrl?: string;
}

/**
 * Abstract base class for all slash commands
 * @abstract
 * @class Command
 * @extends EventEmitter
 * @description All slash commands must extend this class. Provides comprehensive
 * infrastructure for argument parsing, validation, help generation, error handling,
 * and permission management.
 * 
 * @example
 * ```typescript
 * class GitStatusCommand extends Command {
 *   constructor() {
 *     super({
 *       name: 'git-status',
 *       description: 'Show git repository status',
 *       category: 'git',
 *       options: [
 *         {
 *           long: 'short',
 *           short: 's',
 *           description: 'Show short format',
 *           type: 'boolean',
 *           default: false
 *         }
 *       ]
 *     });
 *   }
 * 
 *   async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
 *     // Implementation here
 *   }
 * }
 * ```
 */
export abstract class Command extends EventEmitter {
  /** Command metadata */
  protected readonly metadata: CommandMetadata;
  
  /** Argument schema compiled from metadata */
  private argumentSchema: z.ZodObject<Record<string, z.ZodType<unknown>>> | null = null;
  
  /** Option schema compiled from metadata */
  private optionSchema: z.ZodObject<Record<string, z.ZodType<unknown>>> | null = null;

  /**
   * Creates a new command instance
   * @param metadata - Command metadata defining the command's properties
   */
  constructor(metadata: CommandMetadata) {
    super();
    this.metadata = {
      aliases: [],
      arguments: [],
      options: [],
      examples: [],
      permissions: {},
      hidden: false,
      deprecated: false,
      version: '1.0.0',
      relatedCommands: [],
      ...metadata
    };
    
    this.compileSchemas();
  }

  /**
   * Compile Zod schemas from metadata
   * @private
   */
  private compileSchemas(): void {
    // Compile argument schema
    const argShape: Record<string, z.ZodType<unknown>> = {};
    for (const arg of this.metadata.arguments || []) {
      let schema = this.createZodSchema(arg.type, arg.schema);
      if (!arg.required) {
        schema = schema.optional();
      }
      argShape[arg.name] = schema;
    }
    this.argumentSchema = z.object(argShape);

    // Compile option schema
    const optShape: Record<string, z.ZodType<unknown>> = {};
    for (const opt of this.metadata.options || []) {
      let schema = this.createZodSchema(opt.type, opt.schema);
      if (!opt.required) {
        schema = schema.optional();
      }
      optShape[opt.long] = schema;
    }
    this.optionSchema = z.object(optShape);
  }

  /**
   * Create Zod schema from type
   * @private
   * @param type - The argument/option type
   * @param customSchema - Optional custom schema
   * @returns Zod schema
   */
  private createZodSchema(
    type: string,
    customSchema?: z.ZodType<unknown>
  ): z.ZodType<unknown> {
    if (customSchema) {
      return customSchema;
    }

    switch (type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.string());
      case 'object':
        return z.record(z.unknown());
      default:
        return z.string();
    }
  }

  /**
   * Execute the command
   * @abstract
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  abstract execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult>;

  /**
   * Validate parsed arguments against schemas
   * @param args - Parsed arguments to validate
   * @returns Validation result with errors if any
   */
  public validate(args: ParsedArguments): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate arguments
    if (this.argumentSchema) {
      const argResult = this.argumentSchema.safeParse(args.args);
      if (!argResult.success) {
        errors.push(...argResult.error.errors.map(e => `Argument "${e.path.join('.')}": ${e.message}`));
      }
    }

    // Validate options
    if (this.optionSchema) {
      const optResult = this.optionSchema.safeParse(args.options);
      if (!optResult.success) {
        errors.push(...optResult.error.errors.map(e => `Option "${e.path.join('.')}": ${e.message}`));
      }
    }

    // Validate choices
    for (const arg of this.metadata.arguments || []) {
      if (arg.choices && args.args[arg.name] !== undefined) {
        const value = args.args[arg.name] as string;
        if (!arg.choices.includes(value)) {
          errors.push(`Argument "${arg.name}" must be one of: ${arg.choices.join(', ')}`);
        }
      }
    }

    for (const opt of this.metadata.options || []) {
      if (opt.choices && args.options[opt.long] !== undefined) {
        const value = args.options[opt.long] as string;
        if (!opt.choices.includes(value)) {
          errors.push(`Option "${opt.long}" must be one of: ${opt.choices.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check permissions for command execution
   * @param context - Command execution context
   * @returns Permission check result
   */
  public async checkPermissions(context: CommandContext): Promise<{ allowed: boolean; reason?: string }> {
    const perms = this.metadata.permissions || {};

    // Check git repository requirement
    if (perms.requireGit && (!context.gitInfo || !context.gitInfo.isRepo)) {
      return { allowed: false, reason: 'This command requires a git repository' };
    }

    // Check clean working directory requirement
    if (perms.requireCleanWorkingDir && context.gitInfo && !context.gitInfo.isClean) {
      return { allowed: false, reason: 'This command requires a clean working directory' };
    }

    // Check required environment variables
    if (perms.requiredEnv) {
      for (const envVar of perms.requiredEnv) {
        if (!context.env[envVar]) {
          return { allowed: false, reason: `Required environment variable "${envVar}" is not set` };
        }
      }
    }

    // Run custom permission check
    if (perms.customCheck) {
      const result = await perms.customCheck(context);
      if (!result) {
        return { allowed: false, reason: 'Custom permission check failed' };
      }
    }

    return { allowed: true };
  }

  /**
   * Get command name
   * @returns Command name
   */
  public getName(): string {
    return this.metadata.name;
  }

  /**
   * Get command description
   * @returns Command description
   */
  public getDescription(): string {
    return this.metadata.description;
  }

  /**
   * Get command category
   * @returns Command category
   */
  public getCategory(): string {
    return this.metadata.category;
  }

  /**
   * Get command aliases
   * @returns Array of aliases
   */
  public getAliases(): string[] {
    return this.metadata.aliases || [];
  }

  /**
   * Get command metadata
   * @returns Full command metadata
   */
  public getMetadata(): CommandMetadata {
    return { ...this.metadata };
  }

  /**
   * Check if command has an alias
   * @param alias - Alias to check
   * @returns Whether the command has this alias
   */
  public hasAlias(alias: string): boolean {
    return this.metadata.aliases?.includes(alias) || false;
  }

  /**
   * Check if command is deprecated
   * @returns Whether the command is deprecated
   */
  public isDeprecated(): boolean {
    return this.metadata.deprecated || false;
  }

  /**
   * Check if command is hidden
   * @returns Whether the command is hidden
   */
  public isHidden(): boolean {
    return this.metadata.hidden || false;
  }

  /**
   * Generate help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    const lines: string[] = [];

    // Command name and description
    lines.push(`\n${this.formatHeader(this.metadata.name)}`);
    lines.push(`\n${this.metadata.description}\n`);

    // Deprecation warning
    if (this.metadata.deprecated) {
      lines.push(this.formatWarning('DEPRECATED'));
      if (this.metadata.deprecationMessage) {
        lines.push(`  ${this.metadata.deprecationMessage}\n`);
      }
    }

    // Usage
    lines.push(this.formatHeader('USAGE'));
    let usage = `  /${this.metadata.name}`;
    
    for (const arg of this.metadata.arguments || []) {
      const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      usage += ` ${argStr}`;
    }
    
    if (this.metadata.options && this.metadata.options.length > 0) {
      usage += ' [options]';
    }
    
    lines.push(`${usage}\n`);

    // Arguments
    if (this.metadata.arguments && this.metadata.arguments.length > 0) {
      lines.push(this.formatHeader('ARGUMENTS'));
      for (const arg of this.metadata.arguments) {
        const required = arg.required ? '(required)' : '(optional)';
        const defaultVal = arg.default !== undefined ? ` [default: ${arg.default}]` : '';
        lines.push(`  ${arg.name}`);
        lines.push(`    ${arg.description} ${required}${defaultVal}`);
        if (arg.choices) {
          lines.push(`    Choices: ${arg.choices.join(', ')}`);
        }
        lines.push('');
      }
    }

    // Options
    if (this.metadata.options && this.metadata.options.length > 0) {
      lines.push(this.formatHeader('OPTIONS'));
      for (const opt of this.metadata.options) {
        const shortFlag = opt.short ? `-${opt.short}, ` : '    ';
        const required = opt.required ? '(required)' : '(optional)';
        const defaultVal = opt.default !== undefined ? ` [default: ${opt.default}]` : '';
        lines.push(`  ${shortFlag}--${opt.long}`);
        lines.push(`    ${opt.description} ${required}${defaultVal}`);
        if (opt.choices) {
          lines.push(`    Choices: ${opt.choices.join(', ')}`);
        }
        lines.push('');
      }
    }

    // Aliases
    if (this.metadata.aliases && this.metadata.aliases.length > 0) {
      lines.push(this.formatHeader('ALIASES'));
      lines.push(`  ${this.metadata.aliases.join(', ')}\n`);
    }

    // Examples
    if (this.metadata.examples && this.metadata.examples.length > 0) {
      lines.push(this.formatHeader('EXAMPLES'));
      for (const example of this.metadata.examples) {
        lines.push(`  # ${example.description}`);
        lines.push(`  ${example.command}`);
        if (example.output) {
          lines.push(`  # Output:`);
          lines.push(`  ${example.output.split('\n').join('\n  ')}`);
        }
        lines.push('');
      }
    }

    // Related commands
    if (this.metadata.relatedCommands && this.metadata.relatedCommands.length > 0) {
      lines.push(this.formatHeader('SEE ALSO'));
      lines.push(`  ${this.metadata.relatedCommands.map(c => `/${c}`).join(', ')}\n`);
    }

    // Documentation URL
    if (this.metadata.docsUrl) {
      lines.push(this.formatHeader('DOCUMENTATION'));
      lines.push(`  ${this.metadata.docsUrl}\n`);
    }

    return lines.join('\n');
  }

  /**
   * Format header text
   * @private
   * @param text - Header text
   * @returns Formatted header
   */
  private formatHeader(text: string): string {
    return `\x1b[1m\x1b[36m${text}\x1b[0m`;
  }

  /**
   * Format warning text
   * @private
   * @param text - Warning text
   * @returns Formatted warning
   */
  private formatWarning(text: string): string {
    return `\x1b[1m\x1b[33m⚠ ${text}\x1b[0m`;
  }

  /**
   * Pre-execution hook
   * @param context - Command execution context
   * @param args - Parsed arguments
   * @returns Whether to proceed with execution
   */
  protected async beforeExecute(context: CommandContext, args: ParsedArguments): Promise<boolean> {
    this.emit('beforeExecute', { context, args });
    return true;
  }

  /**
   * Post-execution hook
   * @param context - Command execution context
   * @param result - Execution result
   */
  protected async afterExecute(context: CommandContext, result: CommandResult): Promise<void> {
    this.emit('afterExecute', { context, result });
  }

  /**
   * Run the command with full lifecycle
   * @param context - Command execution context
   * @param args - Parsed arguments
   * @returns Command result
   */
  public async run(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      // Check permissions
      const permCheck = await this.checkPermissions(context);
      if (!permCheck.allowed) {
        return {
          success: false,
          exitCode: 1,
          error: `Permission denied: ${permCheck.reason}`
        };
      }

      // Validate arguments
      const validation = this.validate(args);
      if (!validation.valid) {
        return {
          success: false,
          exitCode: 1,
          error: `Validation failed:\n${validation.errors.join('\n')}`
        };
      }

      // Pre-execution hook
      const shouldProceed = await this.beforeExecute(context, args);
      if (!shouldProceed) {
        return {
          success: false,
          exitCode: 1,
          error: 'Execution cancelled by pre-execution hook'
        };
      }

      // Execute command
      this.emit('execute', { context, args });
      const result = await this.execute(context, args);

      // Post-execution hook
      await this.afterExecute(context, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('error', { error, context, args });
      return {
        success: false,
        exitCode: 1,
        error: errorMessage
      };
    }
  }

  /**
   * Get command signature for completion
   * @returns Command signature string
   */
  public getSignature(): string {
    const parts: string[] = [`/${this.metadata.name}`];
    
    for (const arg of this.metadata.arguments || []) {
      parts.push(arg.required ? `<${arg.name}>` : `[${arg.name}]`);
    }
    
    return parts.join(' ');
  }

  /**
   * Get completion suggestions for the command
   * @param partial - Partial input
   * @returns Array of completion suggestions
   */
  public getCompletions(partial: string): string[] {
    const suggestions: string[] = [];
    
    // Add option completions
    for (const opt of this.metadata.options || []) {
      if (opt.long.startsWith(partial.replace(/^-+/, ''))) {
        suggestions.push(`--${opt.long}`);
      }
      if (opt.short && `-${opt.short}`.startsWith(partial)) {
        suggestions.push(`-${opt.short}`);
      }
    }
    
    return suggestions;
  }
}

/**
 * Command result builder for fluent result creation
 * @class CommandResultBuilder
 */
export class CommandResultBuilder {
  private result: CommandResult = {
    success: true,
    exitCode: 0
  };

  /**
   * Set success status
   * @param success - Whether successful
   * @returns Builder instance
   */
  public setSuccess(success: boolean): this {
    this.result.success = success;
    this.result.exitCode = success ? 0 : 1;
    return this;
  }

  /**
   * Set exit code
   * @param code - Exit code
   * @returns Builder instance
   */
  public setExitCode(code: number): this {
    this.result.exitCode = code;
    return this;
  }

  /**
   * Set result data
   * @param data - Result data
   * @returns Builder instance
   */
  public setData(data: unknown): this {
    this.result.data = data;
    return this;
  }

  /**
   * Set error message
   * @param error - Error message
   * @returns Builder instance
   */
  public setError(error: string): this {
    this.result.error = error;
    this.result.success = false;
    this.result.exitCode = 1;
    return this;
  }

  /**
   * Set metadata
   * @param metadata - Metadata object
   * @returns Builder instance
   */
  public setMetadata(metadata: Record<string, unknown>): this {
    this.result.metadata = metadata;
    return this;
  }

  /**
   * Build the result
   * @returns Command result
   */
  public build(): CommandResult {
    return { ...this.result };
  }

  /**
   * Create a success result
   * @param data - Optional result data
   * @returns Command result
   */
  public static success(data?: unknown): CommandResult {
    return {
      success: true,
      exitCode: 0,
      data
    };
  }

  /**
   * Create a failure result
   * @param error - Error message
   * @param exitCode - Optional exit code
   * @returns Command result
   */
  public static failure(error: string, exitCode: number = 1): CommandResult {
    return {
      success: false,
      exitCode,
      error
    };
  }
}

export default Command;
