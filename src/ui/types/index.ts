/**
 * Shared type definitions for Claude Code Clone UI
 * @module types
 */

import type { ReactNode } from 'react';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'error';

/**
 * Base message interface
 */
export interface BaseMessage {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message timestamp */
  timestamp: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User message
 */
export interface UserMessage extends BaseMessage {
  role: 'user';
  /** Message content */
  content: string;
  /** Attached files */
  attachments?: FileAttachment[];
}

/**
 * Assistant message
 */
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  /** Message content (may be partial during streaming) */
  content: string;
  /** Whether content is still streaming */
  isStreaming?: boolean;
  /** Tool calls in this message */
  toolCalls?: ToolCall[];
  /** Thinking/reasoning content */
  thinking?: string;
  /** Token usage for this response */
  tokenUsage?: TokenUsage;
}

/**
 * System message
 */
export interface SystemMessage extends BaseMessage {
  role: 'system';
  /** Message content */
  content: string;
  /** System message type */
  type: 'info' | 'warning' | 'success' | 'notification';
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  role: 'error';
  /** Error message */
  content: string;
  /** Error code */
  code?: string;
  /** Error details/stack trace */
  details?: string;
  /** Whether error is recoverable */
  recoverable?: boolean;
  /** Retry callback */
  onRetry?: () => void;
}

/**
 * Tool message (tool execution result)
 */
export interface ToolMessage extends BaseMessage {
  role: 'tool';
  /** Tool name */
  toolName: string;
  /** Tool call ID */
  toolCallId: string;
  /** Tool result content */
  content: string;
  /** Tool execution status */
  status: 'pending' | 'running' | 'success' | 'error';
  /** Execution duration in ms */
  duration?: number;
  /** Tool-specific output */
  output?: ToolOutput;
}

/**
 * Union type for all messages
 */
export type Message = UserMessage | AssistantMessage | SystemMessage | ErrorMessage | ToolMessage;

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Tool call from assistant
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Tool output types
 */
export type ToolOutputType = 'bash' | 'file_read' | 'file_write' | 'file_edit' | 'search' | 'generic';

/**
 * Base tool output
 */
export interface BaseToolOutput {
  type: ToolOutputType;
}

/**
 * Bash command output
 */
export interface BashOutput extends BaseToolOutput {
  type: 'bash';
  /** Command executed */
  command: string;
  /** Exit code */
  exitCode: number;
  /** stdout */
  stdout: string;
  /** stderr */
  stderr: string;
  /** Working directory */
  cwd?: string;
}

/**
 * File read output
 */
export interface FileReadOutput extends BaseToolOutput {
  type: 'file_read';
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** File size in bytes */
  size: number;
  /** Line count */
  lineCount: number;
}

/**
 * File write output
 */
export interface FileWriteOutput extends BaseToolOutput {
  type: 'file_write';
  /** File path */
  path: string;
  /** Bytes written */
  bytesWritten: number;
  /** Whether file was created or overwritten */
  created: boolean;
}

/**
 * File edit output
 */
export interface FileEditOutput extends BaseToolOutput {
  type: 'file_edit';
  /** File path */
  path: string;
  /** Diff of changes */
  diff: FileDiff;
  /** Lines changed */
  linesChanged: number;
}

/**
 * Search results output
 */
export interface SearchOutput extends BaseToolOutput {
  type: 'search';
  /** Search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Total matches */
  totalMatches: number;
  /** Files searched */
  filesSearched: number;
}

/**
 * Generic tool output
 */
export interface GenericToolOutput extends BaseToolOutput {
  type: 'generic';
  /** Raw output data */
  data: unknown;
}

/**
 * Union type for all tool outputs
 */
export type ToolOutput = BashOutput | FileReadOutput | FileWriteOutput | FileEditOutput | SearchOutput | GenericToolOutput;

// ============================================================================
// File Types
// ============================================================================

/**
 * File attachment
 */
export interface FileAttachment {
  /** File name */
  name: string;
  /** File path */
  path: string;
  /** File size */
  size: number;
  /** MIME type */
  mimeType: string;
  /** File content (if loaded) */
  content?: string;
}

/**
 * File diff entry
 */
export interface FileDiff {
  /** Original file path */
  oldPath: string;
  /** New file path */
  newPath: string;
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Old file mode */
  oldMode?: string;
  /** New file mode */
  newMode?: string;
}

/**
 * Diff hunk
 */
export interface DiffHunk {
  /** Old start line */
  oldStart: number;
  /** Old line count */
  oldLines: number;
  /** New start line */
  newStart: number;
  /** New line count */
  newLines: number;
  /** Hunk header */
  header: string;
  /** Diff lines */
  lines: DiffLine[];
}

/**
 * Diff line
 */
export interface DiffLine {
  /** Line type */
  type: 'added' | 'removed' | 'unchanged' | 'header';
  /** Line content */
  content: string;
  /** Old line number */
  oldLineNumber?: number;
  /** New line number */
  newLineNumber?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber: number;
  /** Column number */
  column?: number;
  /** Match content */
  content: string;
  /** Context lines before */
  contextBefore?: string[];
  /** Context lines after */
  contextAfter?: string[];
  /** Match score */
  score?: number;
}

/**
 * File tree node
 */
export interface FileTreeNode {
  /** Node name */
  name: string;
  /** Node path */
  path: string;
  /** Node type */
  type: 'file' | 'directory';
  /** Children (for directories) */
  children?: FileTreeNode[];
  /** Whether node is expanded */
  expanded?: boolean;
  /** File size (for files) */
  size?: number;
  /** Last modified timestamp */
  modified?: Date;
  /** Whether node is selected */
  selected?: boolean;
}

// ============================================================================
// Token Usage Types
// ============================================================================

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Input tokens used */
  input: number;
  /** Output tokens used */
  output: number;
  /** Total tokens */
  total: number;
  /** Cost estimate (if available) */
  cost?: {
    input: number;
    output: number;
    total: number;
    currency: string;
  };
  /** Context window limit */
  contextLimit?: number;
  /** Percentage of context used */
  contextPercentage?: number;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session information
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Message count */
  messageCount: number;
  /** Total token usage */
  totalTokens: number;
  /** Working directory */
  cwd: string;
  /** Active tools */
  activeTools: string[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Connection information
 */
export interface ConnectionInfo {
  /** Current status */
  status: ConnectionStatus;
  /** Provider name */
  provider: string;
  /** Model name */
  model: string;
  /** Last ping timestamp */
  lastPing?: Date;
  /** Error message (if any) */
  error?: string;
  /** Latency in ms */
  latency?: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input history entry
 */
export interface InputHistoryEntry {
  /** Input content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Entry type */
  type: 'command' | 'message';
}

/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
  /** Display text */
  label: string;
  /** Insert value */
  value: string;
  /** Suggestion type */
  type: 'command' | 'file' | 'directory' | 'variable' | 'history';
  /** Description */
  description?: string;
  /** Icon/indicator */
  icon?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Common component props
 */
export interface CommonProps {
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: Record<string, unknown>;
  /** Data attributes */
  'data-testid'?: string;
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  /** Children to render */
  children: ReactNode;
  /** Fallback UI on error */
  fallback?: ReactNode;
  /** Error callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  /** Whether an error occurred */
  hasError: boolean;
  /** The error object */
  error?: Error;
}

// ============================================================================
// Keyboard Types
// ============================================================================

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Shortcut key combination */
  key: string;
  /** Modifier keys */
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  /** Action description */
  description: string;
  /** Handler function */
  handler: () => void;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Shortcut category */
  category?: string;
}

/**
 * Key press event
 */
export interface KeyPressEvent {
  /** Key name */
  key: string;
  /** Ctrl pressed */
  ctrl: boolean;
  /** Alt pressed */
  alt: boolean;
  /** Shift pressed */
  shift: boolean;
  /** Meta/Cmd pressed */
  meta: boolean;
  /** Raw input */
  input: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming state
 */
export interface StreamingState {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current content */
  content: string;
  /** Streaming speed (chars/sec) */
  speed: number;
  /** Estimated time remaining */
  estimatedTimeRemaining?: number;
  /** Stream progress (0-1) */
  progress?: number;
}

/**
 * Streaming options
 */
export interface StreamingOptions {
  /** Chunk size per update */
  chunkSize?: number;
  /** Delay between chunks in ms */
  delay?: number;
  /** Whether to smooth streaming */
  smooth?: boolean;
  /** On chunk callback */
  onChunk?: (chunk: string) => void;
  /** On complete callback */
  onComplete?: () => void;
  /** On error callback */
  onError?: (error: Error) => void;
}

// ============================================================================
// Terminal Types
// ============================================================================

/**
 * Terminal size information
 */
export interface TerminalSize {
  /** Terminal width in columns */
  columns: number;
  /** Terminal height in rows */
  rows: number;
  /** Terminal width in pixels (if available) */
  widthPixels?: number;
  /** Terminal height in pixels (if available) */
  heightPixels?: number;
}

/**
 * Terminal capabilities
 */
export interface TerminalCapabilities {
  /** Supports true color */
  trueColor: boolean;
  /** Supports 256 colors */
  color256: boolean;
  /** Supports hyperlinks */
  hyperlinks: boolean;
  /** Supports images */
  images: boolean;
  /** Supports mouse events */
  mouse: boolean;
  /** Supports bracketed paste */
  bracketedPaste: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;

/**
 * Async function type
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Event handler type
 */
export type EventHandler<T = void> = (event: T) => void;

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
