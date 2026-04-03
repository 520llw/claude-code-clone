/**
 * Hooks System Types
 * 
 * Type definitions for the Claude Code hooks system.
 * Provides comprehensive type safety for hook registration, execution,
 * and lifecycle management.
 */

import { ToolCall, ToolResult } from '../../tools/types';
import { Command, CommandResult } from '../../commands/types';
import { AgentContext } from '../../agent/types';
import { Response } from '../../llm/types';

// ============================================================================
// Core Hook Types
// ============================================================================

/**
 * Unique identifier for a hook
 */
export type HookId = string;

/**
 * Hook priority levels - lower numbers execute first
 */
export enum HookPriority {
  CRITICAL = 0,    // System-critical hooks (logging, monitoring)
  HIGH = 10,       // Important hooks (security, validation)
  NORMAL = 50,     // Standard hooks (default priority)
  LOW = 100,       // Optional hooks (analytics, metrics)
  BACKGROUND = 200 // Non-blocking background hooks
}

/**
 * Hook execution phases
 */
export enum HookPhase {
  BEFORE = 'before',
  AFTER = 'after',
  AROUND = 'around',
  ON_ERROR = 'on_error',
  ON_SUCCESS = 'on_success',
  ON_COMPLETE = 'on_complete'
}

/**
 * Hook lifecycle states
 */
export enum HookLifecycleState {
  REGISTERED = 'registered',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  EXECUTING = 'executing',
  ERROR = 'error',
  UNREGISTERED = 'unregistered'
}

// ============================================================================
// Hook Context Types
// ============================================================================

/**
 * Base context passed to all hooks
 */
export interface HookContext {
  /** Unique execution ID for this hook invocation */
  executionId: string;
  /** Timestamp when hook execution started */
  startedAt: Date;
  /** Agent context */
  agentContext: AgentContext;
  /** Hook-specific metadata */
  metadata: Record<string, unknown>;
  /** Cancel token - set to true to abort subsequent hooks */
  cancel: boolean;
  /** Reason for cancellation */
  cancelReason?: string;
  /** Hook execution result (set by hook) */
  result?: unknown;
  /** Any error that occurred during hook execution */
  error?: Error;
}

/**
 * Context for pre-command hooks
 */
export interface PreCommandContext extends HookContext {
  /** The command being executed */
  command: Command;
  /** Whether to skip command execution */
  skipCommand: boolean;
  /** Modified command (if hook modifies it) */
  modifiedCommand?: Command;
  /** Validation errors */
  validationErrors: string[];
  /** Additional context data */
  data: Record<string, unknown>;
}

/**
 * Context for post-command hooks
 */
export interface PostCommandContext extends HookContext {
  /** The command that was executed */
  command: Command;
  /** Result of command execution */
  result: CommandResult;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Any error that occurred */
  error?: Error;
  /** Modified result (if hook modifies it) */
  modifiedResult?: CommandResult;
}

/**
 * Context for pre-tool hooks
 */
export interface PreToolContext extends HookContext {
  /** The tool call being made */
  toolCall: ToolCall;
  /** Whether to skip tool execution */
  skipTool: boolean;
  /** Modified tool call (if hook modifies it) */
  modifiedToolCall?: ToolCall;
  /** Tool-specific options */
  options: Record<string, unknown>;
  /** Validation errors */
  validationErrors: string[];
}

/**
 * Context for post-tool hooks
 */
export interface PostToolContext extends HookContext {
  /** The tool call that was made */
  toolCall: ToolCall;
  /** Result of tool execution */
  result: ToolResult;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Any error that occurred */
  error?: Error;
  /** Modified result (if hook modifies it) */
  modifiedResult?: ToolResult;
  /** Raw tool output */
  rawOutput?: unknown;
}

/**
 * Context for error hooks
 */
export interface ErrorContext extends HookContext {
  /** The error that occurred */
  error: Error;
  /** Where the error occurred */
  source: 'command' | 'tool' | 'llm' | 'agent' | 'system';
  /** Whether the error was handled */
  handled: boolean;
  /** Recovery action taken */
  recoveryAction?: 'retry' | 'skip' | 'abort' | 'fallback';
  /** Number of retry attempts made */
  retryCount: number;
  /** Maximum retry attempts allowed */
  maxRetries: number;
  /** Additional error context */
  errorContext: Record<string, unknown>;
}

/**
 * Context for response hooks
 */
export interface ResponseContext extends HookContext {
  /** The LLM response */
  response: Response;
  /** Whether to process the response */
  processResponse: boolean;
  /** Modified response (if hook modifies it) */
  modifiedResponse?: Response;
  /** Response metadata */
  responseMeta: {
    model: string;
    tokensUsed: number;
    finishReason: string;
    latencyMs: number;
  };
  /** Parsed content from response */
  parsedContent?: unknown;
}

// ============================================================================
// Hook Handler Types
// ============================================================================

/**
 * Generic hook handler function type
 */
export type HookHandler<TContext extends HookContext = HookContext> = (
  context: TContext
) => Promise<TContext> | TContext;

/**
 * Synchronous hook handler
 */
export type SyncHookHandler<TContext extends HookContext = HookContext> = (
  context: TContext
) => TContext;

/**
 * Async hook handler
 */
export type AsyncHookHandler<TContext extends HookContext = HookContext> = (
  context: TContext
) => Promise<TContext>;

/**
 * Pre-command hook handler
 */
export type PreCommandHandler = HookHandler<PreCommandContext>;

/**
 * Post-command hook handler
 */
export type PostCommandHandler = HookHandler<PostCommandContext>;

/**
 * Pre-tool hook handler
 */
export type PreToolHandler = HookHandler<PreToolContext>;

/**
 * Post-tool hook handler
 */
export type PostToolHandler = HookHandler<PostToolContext>;

/**
 * Error hook handler
 */
export type ErrorHandler = HookHandler<ErrorContext>;

/**
 * Response hook handler
 */
export type ResponseHandler = HookHandler<ResponseContext>;

// ============================================================================
// Hook Definition Types
// ============================================================================

/**
 * Base hook definition
 */
export interface HookDefinition<TContext extends HookContext = HookContext> {
  /** Unique hook identifier */
  id: HookId;
  /** Human-readable name */
  name: string;
  /** Hook description */
  description: string;
  /** Hook type/category */
  type: string;
  /** Hook phase */
  phase: HookPhase;
  /** Execution priority */
  priority: HookPriority | number;
  /** Whether hook is enabled */
  enabled: boolean;
  /** Handler function */
  handler: HookHandler<TContext>;
  /** Conditions for hook execution */
  conditions?: HookCondition[];
  /** Maximum execution time in ms */
  timeoutMs?: number;
  /** Whether hook can be retried on failure */
  retryable: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Hook metadata */
  meta: HookMetadata;
}

/**
 * Hook metadata
 */
export interface HookMetadata {
  /** Hook version */
  version: string;
  /** Author information */
  author?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  modifiedAt: Date;
  /** Tags for categorization */
  tags: string[];
  /** Dependencies on other hooks */
  dependencies: HookId[];
  /** Hooks that must run after this one */
  dependents: HookId[];
  /** Configuration schema */
  configSchema?: Record<string, unknown>;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
}

/**
 * Condition for hook execution
 */
export interface HookCondition {
  /** Condition type */
  type: 'command' | 'tool' | 'error' | 'custom' | 'always';
  /** Condition value/pattern */
  value?: string | string[] | RegExp;
  /** Custom condition function */
  evaluate?: (context: HookContext) => boolean | Promise<boolean>;
}

/**
 * Pre-command hook definition
 */
export interface PreCommandHook extends HookDefinition<PreCommandContext> {
  type: 'pre-command';
}

/**
 * Post-command hook definition
 */
export interface PostCommandHook extends HookDefinition<PostCommandContext> {
  type: 'post-command';
}

/**
 * Pre-tool hook definition
 */
export interface PreToolHook extends HookDefinition<PreToolContext> {
  type: 'pre-tool';
}

/**
 * Post-tool hook definition
 */
export interface PostToolHook extends HookDefinition<PostToolContext> {
  type: 'post-tool';
}

/**
 * Error hook definition
 */
export interface ErrorHook extends HookDefinition<ErrorContext> {
  type: 'on-error';
  /** Error types this hook handles */
  errorTypes: string[];
}

/**
 * Response hook definition
 */
export interface ResponseHook extends HookDefinition<ResponseContext> {
  type: 'on-response';
}

/**
 * Union type for all hook definitions
 */
export type AnyHookDefinition =
  | PreCommandHook
  | PostCommandHook
  | PreToolHook
  | PostToolHook
  | ErrorHook
  | ResponseHook;

// ============================================================================
// Hook Registration Types
// ============================================================================

/**
 * Options for registering a hook
 */
export interface HookRegistrationOptions {
  /** Override existing hook with same ID */
  override?: boolean;
  /** Insert before specific hook */
  insertBefore?: HookId;
  /** Insert after specific hook */
  insertAfter?: HookId;
  /** Hook configuration */
  config?: Record<string, unknown>;
}

/**
 * Result of hook registration
 */
export interface HookRegistrationResult {
  /** Whether registration succeeded */
  success: boolean;
  /** Registered hook ID */
  hookId?: HookId;
  /** Error message if failed */
  error?: string;
  /** Previous hook if overridden */
  previousHook?: AnyHookDefinition;
}

/**
 * Hook registration entry
 */
export interface HookRegistration {
  /** Hook definition */
  hook: AnyHookDefinition;
  /** Registration timestamp */
  registeredAt: Date;
  /** Registration options */
  options: HookRegistrationOptions;
  /** Current state */
  state: HookLifecycleState;
  /** Execution statistics */
  stats: HookExecutionStats;
}

/**
 * Hook execution statistics
 */
export interface HookExecutionStats {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Total execution time in ms */
  totalExecutionTimeMs: number;
  /** Average execution time in ms */
  averageExecutionTimeMs: number;
  /** Last execution timestamp */
  lastExecutedAt?: Date;
  /** Last error timestamp */
  lastErrorAt?: Date;
  /** Last error message */
  lastErrorMessage?: string;
}

// ============================================================================
// Hook Engine Types
// ============================================================================

/**
 * Configuration for the hook engine
 */
export interface HookEngineConfig {
  /** Enable/disable hooks globally */
  enabled: boolean;
  /** Default hook timeout in ms */
  defaultTimeoutMs: number;
  /** Maximum hooks per type */
  maxHooksPerType: number;
  /** Enable execution metrics */
  enableMetrics: boolean;
  /** Log hook execution */
  logExecution: boolean;
  /** Continue on hook error */
  continueOnError: boolean;
  /** Hook directories to load */
  hookDirectories: string[];
}

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  /** Timeout for this execution */
  timeoutMs?: number;
  /** Skip specific hooks */
  skipHooks?: HookId[];
  /** Only run specific hooks */
  onlyHooks?: HookId[];
  /** Additional context data */
  contextData?: Record<string, unknown>;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Result of hook execution
 */
export interface HookExecutionResult<TContext extends HookContext = HookContext> {
  /** Final context after all hooks */
  context: TContext;
  /** Whether execution was cancelled */
  cancelled: boolean;
  /** Cancel reason if cancelled */
  cancelReason?: string;
  /** Hooks that were executed */
  executedHooks: HookId[];
  /** Hooks that were skipped */
  skippedHooks: HookId[];
  /** Hooks that failed */
  failedHooks: Array<{ hookId: HookId; error: Error }>;
  /** Total execution time in ms */
  totalExecutionTimeMs: number;
  /** Individual hook results */
  hookResults: Map<HookId, unknown>;
}

/**
 * Hook engine state
 */
export interface HookEngineState {
  /** Whether engine is initialized */
  initialized: boolean;
  /** Number of registered hooks */
  registeredHookCount: number;
  /** Hooks by type */
  hooksByType: Map<string, HookId[]>;
  /** Engine configuration */
  config: HookEngineConfig;
  /** Global execution statistics */
  globalStats: HookExecutionStats;
}

// ============================================================================
// Hook Runner Types
// ============================================================================

/**
 * Hook runner configuration
 */
export interface HookRunnerConfig {
  /** Parallel execution for same-priority hooks */
  parallelExecution: boolean;
  /** Maximum parallel hooks */
  maxParallelHooks: number;
  /** Enable hook caching */
  enableCaching: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
  /** Hook result transformer */
  resultTransformer?: (result: unknown) => unknown;
}

/**
 * Hook batch execution result
 */
export interface HookBatchResult {
  /** Batch ID */
  batchId: string;
  /** Results by hook ID */
  results: Map<HookId, unknown>;
  /** Errors by hook ID */
  errors: Map<HookId, Error>;
  /** Total execution time */
  totalTimeMs: number;
  /** Whether all hooks succeeded */
  allSucceeded: boolean;
}

/**
 * Hook middleware function
 */
export type HookMiddleware = (
  context: HookContext,
  next: () => Promise<HookContext>
) => Promise<HookContext>;

// ============================================================================
// Built-in Hook Types
// ============================================================================

/**
 * Built-in hook names
 */
export enum BuiltInHookType {
  PRE_COMMAND = 'pre-command',
  POST_COMMAND = 'post-command',
  PRE_TOOL = 'pre-tool',
  POST_TOOL = 'post-tool',
  ON_ERROR = 'on-error',
  ON_RESPONSE = 'on-response'
}

/**
 * Configuration for pre-command hook
 */
export interface PreCommandConfig {
  /** Validate commands before execution */
  validateCommands: boolean;
  /** Log commands */
  logCommands: boolean;
  /** Enable command transformation */
  enableTransformation: boolean;
  /** Command whitelist */
  commandWhitelist?: string[];
  /** Command blacklist */
  commandBlacklist?: string[];
}

/**
 * Configuration for post-command hook
 */
export interface PostCommandConfig {
  /** Log results */
  logResults: boolean;
  /** Store command history */
  storeHistory: boolean;
  /** Enable result transformation */
  enableTransformation: boolean;
  /** Success notification */
  notifyOnSuccess: boolean;
  /** Failure notification */
  notifyOnFailure: boolean;
}

/**
 * Configuration for pre-tool hook
 */
export interface PreToolConfig {
  /** Validate tool calls */
  validateToolCalls: boolean;
  /** Log tool calls */
  logToolCalls: boolean;
  /** Rate limiting */
  rateLimiting: boolean;
  /** Max calls per minute */
  maxCallsPerMinute: number;
}

/**
 * Configuration for post-tool hook
 */
export interface PostToolConfig {
  /** Log results */
  logResults: boolean;
  /** Cache results */
  cacheResults: boolean;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Result size limit in bytes */
  resultSizeLimit: number;
}

/**
 * Configuration for error hook
 */
export interface ErrorHookConfig {
  /** Log errors */
  logErrors: boolean;
  /** Enable auto-retry */
  enableRetry: boolean;
  /** Max retry attempts */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelayMs: number;
  /** Notify on error */
  notifyOnError: boolean;
}

/**
 * Configuration for response hook
 */
export interface ResponseHookConfig {
  /** Parse responses */
  parseResponses: boolean;
  /** Validate responses */
  validateResponses: boolean;
  /** Log responses */
  logResponses: boolean;
  /** Response size limit */
  responseSizeLimit: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard for hook context
 */
export function isHookContext(obj: unknown): obj is HookContext {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'executionId' in obj &&
    'startedAt' in obj &&
    'agentContext' in obj &&
    'metadata' in obj &&
    'cancel' in obj
  );
}

/**
 * Type guard for pre-command context
 */
export function isPreCommandContext(obj: unknown): obj is PreCommandContext {
  return isHookContext(obj) && 'command' in obj && 'skipCommand' in obj;
}

/**
 * Type guard for post-command context
 */
export function isPostCommandContext(obj: unknown): obj is PostCommandContext {
  return isHookContext(obj) && 'command' in obj && 'result' in obj && 'durationMs' in obj;
}

/**
 * Type guard for pre-tool context
 */
export function isPreToolContext(obj: unknown): obj is PreToolContext {
  return isHookContext(obj) && 'toolCall' in obj && 'skipTool' in obj;
}

/**
 * Type guard for post-tool context
 */
export function isPostToolContext(obj: unknown): obj is PostToolContext {
  return isHookContext(obj) && 'toolCall' in obj && 'result' in obj && 'durationMs' in obj;
}

/**
 * Type guard for error context
 */
export function isErrorContext(obj: unknown): obj is ErrorContext {
  return isHookContext(obj) && 'error' in obj && 'source' in obj && 'handled' in obj;
}

/**
 * Type guard for response context
 */
export function isResponseContext(obj: unknown): obj is ResponseContext {
  return isHookContext(obj) && 'response' in obj && 'processResponse' in obj;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Hook event types
 */
export enum HookEventType {
  REGISTERED = 'hook:registered',
  UNREGISTERED = 'hook:unregistered',
  ENABLED = 'hook:enabled',
  DISABLED = 'hook:disabled',
  EXECUTION_START = 'hook:execution:start',
  EXECUTION_SUCCESS = 'hook:execution:success',
  EXECUTION_ERROR = 'hook:execution:error',
  EXECUTION_COMPLETE = 'hook:execution:complete',
  CANCELLED = 'hook:cancelled'
}

/**
 * Hook event payload
 */
export interface HookEvent {
  type: HookEventType;
  hookId?: HookId;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Hook event listener
 */
export type HookEventListener = (event: HookEvent) => void | Promise<void>;
