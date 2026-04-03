/**
 * types.ts
 * 
 * Hook Type Definitions for Claude Code Clone Plugin System
 * 
 * This file defines all the types, interfaces, and enums related to the
 * hook system including hook definitions, handler types, execution contexts,
 * and result types.
 * 
 * @module HookSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin } from '../Plugin';

// ============================================================================
// Hook Priority and Execution
// ============================================================================

/**
 * Hook priority levels
 * Higher priority hooks are executed first
 */
export enum HookPriority {
  CRITICAL = 1000,
  HIGH = 100,
  NORMAL = 0,
  LOW = -100,
  BACKGROUND = -1000
}

/**
 * Hook execution order
 */
export enum HookExecutionOrder {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  RACE = 'race'
}

/**
 * Hook execution phase
 */
export enum HookPhase {
  BEFORE = 'before',
  DURING = 'during',
  AFTER = 'after'
}

// ============================================================================
// Hook Handler Types
// ============================================================================

/**
 * Base hook handler function type
 */
export type HookHandler<T = any, R = any> = (
  context: HookContext<T>,
  ...args: any[]
) => Promise<R> | R;

/**
 * Async hook handler type
 */
export type AsyncHookHandler<T = any, R = any> = (
  context: HookContext<T>,
  ...args: any[]
) => Promise<R>;

/**
 * Sync hook handler type
 */
export type SyncHookHandler<T = any, R = any> = (
  context: HookContext<T>,
  ...args: any[]
) => R;

/**
 * Hook handler with metadata
 */
export interface HookHandlerInfo<T = any, R = any> {
  /** Handler function */
  handler: HookHandler<T, R>;
  /** Handler priority */
  priority: number;
  /** Plugin ID that registered this handler */
  pluginId: string;
  /** Handler ID */
  handlerId: string;
  /** Whether the handler is async */
  async: boolean;
  /** Handler timeout in milliseconds */
  timeout?: number;
  /** Whether the handler can be cancelled */
  cancellable?: boolean;
  /** Handler description */
  description?: string;
  /** Handler tags */
  tags?: string[];
}

// ============================================================================
// Hook Context Types
// ============================================================================

/**
 * Base hook context
 */
export interface HookContext<T = any> {
  /** Hook name */
  hookName: string;
  /** Hook data/payload */
  data: T;
  /** Hook execution timestamp */
  timestamp: Date;
  /** Hook execution ID */
  executionId: string;
  /** Plugin that triggered the hook (if any) */
  sourcePlugin?: string;
  /** Whether the hook execution was cancelled */
  cancelled: boolean;
  /** Cancellation reason */
  cancellationReason?: string;
  /** Execution metadata */
  metadata: Record<string, any>;
  /** Get a value from the context */
  get<K extends keyof T>(key: K): T[K];
  /** Set a value in the context */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** Cancel hook execution */
  cancel(reason?: string): void;
  /** Add metadata */
  addMeta(key: string, value: any): void;
}

/**
 * Hook context constructor
 */
export interface HookContextConstructor<T = any> {
  new (hookName: string, data: T, executionId: string): HookContext<T>;
}

// ============================================================================
// Hook Result Types
// ============================================================================

/**
 * Hook execution result
 */
export interface HookResult<T = any> {
  /** Whether execution was successful */
  success: boolean;
  /** Execution result data */
  data?: T;
  /** Execution error (if any) */
  error?: HookExecutionError;
  /** Handler results */
  handlerResults: HandlerResult<any>[];
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether execution was cancelled */
  cancelled: boolean;
  /** Number of handlers executed */
  handlersExecuted: number;
  /** Number of handlers that succeeded */
  handlersSucceeded: number;
  /** Number of handlers that failed */
  handlersFailed: number;
}

/**
 * Individual handler result
 */
export interface HandlerResult<T = any> {
  /** Handler ID */
  handlerId: string;
  /** Plugin ID */
  pluginId: string;
  /** Whether handler succeeded */
  success: boolean;
  /** Handler result */
  result?: T;
  /** Handler error */
  error?: Error;
  /** Execution duration */
  duration: number;
  /** Whether handler was skipped */
  skipped: boolean;
  /** Skip reason */
  skipReason?: string;
}

/**
 * Hook execution error
 */
export interface HookExecutionError {
  /** Error code */
  code: HookErrorCode;
  /** Error message */
  message: string;
  /** Error details */
  details?: any;
  /** Stack trace */
  stack?: string;
  /** Handler that caused the error */
  handlerId?: string;
  /** Plugin that caused the error */
  pluginId?: string;
}

/**
 * Hook error codes
 */
export enum HookErrorCode {
  UNKNOWN = 'UNKNOWN',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  HANDLER_ERROR = 'HANDLER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  INVALID_CONTEXT = 'INVALID_CONTEXT',
  INVALID_DATA = 'INVALID_DATA'
}

// ============================================================================
// Hook Definition Types
// ============================================================================

/**
 * Hook definition
 */
export interface HookDefinition<T = any, R = any> {
  /** Hook name */
  name: string;
  /** Hook description */
  description: string;
  /** Hook category */
  category: HookCategory;
  /** Input data type */
  inputType?: string;
  /** Output result type */
  outputType?: string;
  /** Default execution order */
  executionOrder: HookExecutionOrder;
  /** Whether the hook can be cancelled */
  cancellable: boolean;
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Whether multiple handlers can modify the result */
  allowModification: boolean;
  /** Whether to stop on first error */
  stopOnError: boolean;
  /** Whether to stop on first successful result */
  stopOnSuccess: boolean;
  /** Hook schema for validation */
  schema?: HookSchema;
  /** Example usage */
  examples?: string[];
  /** Related hooks */
  relatedHooks?: string[];
}

/**
 * Hook category
 */
export enum HookCategory {
  LIFECYCLE = 'lifecycle',
  MESSAGE = 'message',
  TOOL = 'tool',
  SESSION = 'session',
  FILE = 'file',
  COMMAND = 'command',
  CONTEXT = 'context',
  PERMISSION = 'permission',
  LLM = 'llm',
  SYSTEM = 'system'
}

/**
 * Hook schema for validation
 */
export interface HookSchema {
  /** Input schema */
  input?: object;
  /** Output schema */
  output?: object;
  /** Required fields */
  required?: string[];
}

/**
 * Hook registration options
 */
export interface HookRegistrationOptions {
  /** Handler priority */
  priority?: number;
  /** Plugin ID */
  pluginId?: string;
  /** Handler timeout */
  timeout?: number;
  /** Whether handler is cancellable */
  cancellable?: boolean;
  /** Handler description */
  description?: string;
  /** Handler tags */
  tags?: string[];
}

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  /** Execution order */
  order?: HookExecutionOrder;
  /** Execution timeout */
  timeout?: number;
  /** Whether to stop on error */
  stopOnError?: boolean;
  /** Whether to stop on success */
  stopOnSuccess?: boolean;
  /** Source plugin */
  sourcePlugin?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Hook Registry Types
// ============================================================================

/**
 * Registered hook information
 */
export interface RegisteredHook {
  /** Hook definition */
  definition: HookDefinition;
  /** Registered handlers */
  handlers: HookHandlerInfo[];
  /** Registration timestamp */
  registeredAt: Date;
  /** Total executions */
  totalExecutions: number;
  /** Total errors */
  totalErrors: number;
  /** Average execution time */
  averageExecutionTime: number;
}

/**
 * Hook statistics
 */
export interface HookStatistics {
  /** Total hooks registered */
  totalHooks: number;
  /** Total handlers registered */
  totalHandlers: number;
  /** Total executions */
  totalExecutions: number;
  /** Total errors */
  totalErrors: number;
  /** Average execution time */
  averageExecutionTime: number;
  /** Most used hooks */
  mostUsedHooks: Array<{ name: string; executions: number }>;
  /** Slowest hooks */
  slowestHooks: Array<{ name: string; avgTime: number }>;
  /** Error rate by hook */
  errorRates: Record<string, number>;
}

// ============================================================================
// Specific Hook Data Types
// ============================================================================

/**
 * onInit hook data
 */
export interface OnInitData {
  /** Application version */
  appVersion: string;
  /** Application configuration */
  appConfig: Record<string, any>;
  /** Environment variables */
  env: Record<string, string>;
  /** Command line arguments */
  args: string[];
  /** Working directory */
  cwd: string;
}

/**
 * onMessage hook data
 */
export interface OnMessageData {
  /** Message ID */
  messageId: string;
  /** Message content */
  content: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message timestamp */
  timestamp: Date;
  /** Message metadata */
  metadata?: Record<string, any>;
  /** Whether the message was modified */
  modified?: boolean;
  /** Original content (if modified) */
  originalContent?: string;
}

/**
 * onToolCall hook data
 */
export interface OnToolCallData {
  /** Tool call ID */
  callId: string;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  arguments: Record<string, any>;
  /** Tool call timestamp */
  timestamp: Date;
  /** Whether to allow the call */
  allow: boolean;
  /** Block reason (if not allowed) */
  blockReason?: string;
}

/**
 * onToolResult hook data
 */
export interface OnToolResultData {
  /** Tool call ID */
  callId: string;
  /** Tool name */
  toolName: string;
  /** Tool result */
  result: any;
  /** Execution duration */
  duration: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Result timestamp */
  timestamp: Date;
}

/**
 * onResponse hook data
 */
export interface OnResponseData {
  /** Response ID */
  responseId: string;
  /** Response content */
  content: string;
  /** Response model */
  model: string;
  /** Token usage */
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Generation duration */
  duration: number;
  /** Response timestamp */
  timestamp: Date;
  /** Whether response was modified */
  modified?: boolean;
  /** Original content (if modified) */
  originalContent?: string;
}

/**
 * onError hook data
 */
export interface OnErrorData {
  /** Error ID */
  errorId: string;
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error timestamp */
  timestamp: Date;
  /** Component that threw the error */
  component?: string;
  /** Whether the error was handled */
  handled: boolean;
}

/**
 * onSessionStart hook data
 */
export interface OnSessionStartData {
  /** Session ID */
  sessionId: string;
  /** Session name */
  name?: string;
  /** Session metadata */
  metadata?: Record<string, any>;
  /** Start timestamp */
  timestamp: Date;
  /** Working directory */
  cwd: string;
}

/**
 * onSessionEnd hook data
 */
export interface OnSessionEndData {
  /** Session ID */
  sessionId: string;
  /** Session duration */
  duration: number;
  /** Number of messages */
  messageCount: number;
  /** Number of tool calls */
  toolCallCount: number;
  /** End timestamp */
  timestamp: Date;
  /** Session summary */
  summary?: string;
}

/**
 * onFileChange hook data
 */
export interface OnFileChangeData {
  /** File path */
  path: string;
  /** Change type */
  changeType: 'created' | 'modified' | 'deleted' | 'renamed';
  /** Old path (for rename) */
  oldPath?: string;
  /** File content (if available) */
  content?: string;
  /** Change timestamp */
  timestamp: Date;
}

/**
 * onCommand hook data
 */
export interface OnCommandData {
  /** Command ID */
  commandId: string;
  /** Command name */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Command timestamp */
  timestamp: Date;
  /** Whether to allow execution */
  allow: boolean;
  /** Block reason (if not allowed) */
  blockReason?: string;
}

/**
 * onContextCompact hook data
 */
export interface OnContextCompactData {
  /** Context ID */
  contextId: string;
  /** Original token count */
  originalTokenCount: number;
  /** Target token count */
  targetTokenCount: number;
  /** Messages to be removed */
  messagesToRemove: string[];
  /** Summary of removed content */
  summary?: string;
  /** Compact timestamp */
  timestamp: Date;
}

/**
 * onPermissionRequest hook data
 */
export interface OnPermissionRequestData {
  /** Request ID */
  requestId: string;
  /** Permission type */
  permissionType: string;
  /** Permission resource */
  resource: string;
  /** Permission action */
  action: string;
  /** Request reason */
  reason?: string;
  /** Whether permission is granted */
  granted: boolean;
  /** Grant duration (if temporary) */
  grantDuration?: number;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * onLLMCall hook data
 */
export interface OnLLMCallData {
  /** Call ID */
  callId: string;
  /** Model name */
  model: string;
  /** Prompt/messages */
  prompt: string | any[];
  /** Call options */
  options: Record<string, any>;
  /** Call timestamp */
  timestamp: Date;
  /** Whether to allow the call */
  allow: boolean;
  /** Block reason (if not allowed) */
  blockReason?: string;
}

/**
 * onStreamToken hook data
 */
export interface OnStreamTokenData {
  /** Stream ID */
  streamId: string;
  /** Token content */
  token: string;
  /** Token index */
  index: number;
  /** Model name */
  model: string;
  /** Whether to include token in output */
  include: boolean;
  /** Token timestamp */
  timestamp: Date;
}

/**
 * onExit hook data
 */
export interface OnExitData {
  /** Exit code */
  code: number;
  /** Exit reason */
  reason?: string;
  /** Session duration */
  sessionDuration: number;
  /** Exit timestamp */
  timestamp: Date;
  /** Whether to prevent exit */
  preventExit: boolean;
  /** Prevent reason */
  preventReason?: string;
}

// ============================================================================
// Hook Event Types
// ============================================================================

/**
 * Hook event types for event emitter
 */
export interface HookEvents {
  'hookRegistered': { hookName: string; handlerId: string; pluginId: string };
  'hookUnregistered': { hookName: string; handlerId: string; pluginId: string };
  'hookExecuted': { hookName: string; executionId: string; duration: number };
  'hookError': { hookName: string; executionId: string; error: HookExecutionError };
  'hookCancelled': { hookName: string; executionId: string; reason?: string };
  'handlerExecuted': { hookName: string; handlerId: string; duration: number };
  'handlerError': { hookName: string; handlerId: string; error: Error };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract hook data type from hook name
 */
export type HookDataType<H extends string> = 
  H extends 'onInit' ? OnInitData :
  H extends 'onMessage' ? OnMessageData :
  H extends 'onToolCall' ? OnToolCallData :
  H extends 'onToolResult' ? OnToolResultData :
  H extends 'onResponse' ? OnResponseData :
  H extends 'onError' ? OnErrorData :
  H extends 'onSessionStart' ? OnSessionStartData :
  H extends 'onSessionEnd' ? OnSessionEndData :
  H extends 'onFileChange' ? OnFileChangeData :
  H extends 'onCommand' ? OnCommandData :
  H extends 'onContextCompact' ? OnContextCompactData :
  H extends 'onPermissionRequest' ? OnPermissionRequestData :
  H extends 'onLLMCall' ? OnLLMCallData :
  H extends 'onStreamToken' ? OnStreamTokenData :
  H extends 'onExit' ? OnExitData :
  any;

/**
 * Hook names type
 */
export type HookName = 
  | 'onInit'
  | 'onMessage'
  | 'onToolCall'
  | 'onToolResult'
  | 'onResponse'
  | 'onError'
  | 'onSessionStart'
  | 'onSessionEnd'
  | 'onFileChange'
  | 'onCommand'
  | 'onContextCompact'
  | 'onPermissionRequest'
  | 'onLLMCall'
  | 'onStreamToken'
  | 'onExit';

export default {};
