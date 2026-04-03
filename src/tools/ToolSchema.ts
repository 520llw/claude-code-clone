/**
 * @fileoverview Tool Schema Definitions for Claude Code Clone
 * 
 * This module provides shared Zod schemas used across multiple tools
 * for consistent input/output validation and type safety.
 * 
 * @module ToolSchema
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Schema for file paths with validation
 */
export const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .max(4096, 'File path too long')
  .refine(
    (path) => !path.includes('\0'),
    'File path cannot contain null characters'
  )
  .refine(
    (path) => {
      const normalized = path.replace(/\\/g, '/');
      return !normalized.split('/').includes('..');
    },
    'Path traversal (..) not allowed'
  )
  .describe('Absolute or relative file path');

/**
 * Schema for directory paths
 */
export const DirectoryPathSchema = z.string()
  .min(1, 'Directory path cannot be empty')
  .max(4096, 'Directory path too long')
  .describe('Absolute or relative directory path');

/**
 * Schema for file content
 */
export const FileContentSchema = z.string()
  .describe('Content to write to a file');

/**
 * Schema for line numbers
 */
export const LineNumberSchema = z.number()
  .int()
  .min(1, 'Line number must be at least 1')
  .describe('1-based line number');

/**
 * Schema for line ranges
 */
export const LineRangeSchema = z.object({
  start: LineNumberSchema.describe('Start line (inclusive)'),
  end: LineNumberSchema.describe('End line (inclusive)'),
}).refine(
  (range) => range.start <= range.end,
  'Start line must be less than or equal to end line'
);

/**
 * Schema for file offsets
 */
export const OffsetSchema = z.number()
  .int()
  .min(0, 'Offset must be non-negative')
  .describe('Byte offset in file');

/**
 * Schema for limit values
 */
export const LimitSchema = z.number()
  .int()
  .min(1, 'Limit must be at least 1')
  .max(10000, 'Limit cannot exceed 10000')
  .default(100)
  .describe('Maximum number of results to return');

/**
 * Schema for regex patterns
 */
export const RegexPatternSchema = z.string()
  .min(1, 'Pattern cannot be empty')
  .refine(
    (pattern) => {
      try {
        new RegExp(pattern);
        return true;
      } catch {
        return false;
      }
    },
    'Invalid regular expression pattern'
  )
  .describe('Regular expression pattern');

/**
 * Schema for glob patterns
 */
export const GlobPatternSchema = z.string()
  .min(1, 'Pattern cannot be empty')
  .describe('Glob pattern for file matching (e.g., "*.ts", "**/*.json")');

/**
 * Schema for search queries
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query cannot be empty')
  .max(1000, 'Search query too long')
  .describe('Search query string');

/**
 * Schema for shell commands
 */
export const ShellCommandSchema = z.string()
  .min(1, 'Command cannot be empty')
  .max(10000, 'Command too long')
  .describe('Shell command to execute');

/**
 * Schema for environment variables
 */
export const EnvironmentVariablesSchema = z.record(z.string())
  .describe('Environment variables for command execution');

/**
 * Schema for URLs
 */
export const URLSchema = z.string()
  .url()
  .max(2048, 'URL too long')
  .describe('Valid URL');

/**
 * Schema for HTTP methods
 */
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
  .default('GET')
  .describe('HTTP method');

/**
 * Schema for HTTP headers
 */
export const HTTPHeadersSchema = z.record(z.string())
  .describe('HTTP headers');

/**
 * Schema for timeout values
 */
export const TimeoutSchema = z.number()
  .int()
  .min(1000, 'Timeout must be at least 1000ms')
  .max(300000, 'Timeout cannot exceed 300000ms (5 minutes)')
  .default(30000)
  .describe('Timeout in milliseconds');

/**
 * Schema for boolean flags
 */
export const BooleanFlagSchema = z.boolean()
  .default(false)
  .describe('Boolean flag');

/**
 * Schema for encoding options
 */
export const EncodingSchema = z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'hex', 'latin1'])
  .default('utf8')
  .describe('File encoding');

// ============================================================================
// File Operation Schemas
// ============================================================================

/**
 * Schema for file read options
 */
export const FileReadOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to read'),
  offset: OffsetSchema.optional().describe('Byte offset to start reading from'),
  limit: z.number().int().min(1).max(1000).optional().describe('Maximum number of lines to read'),
  encoding: EncodingSchema.optional(),
}).describe('Options for reading a file');

/**
 * Schema for file read result
 */
export const FileReadResultSchema = z.object({
  content: z.string().describe('File content'),
  file_path: z.string().describe('Absolute path of the file'),
  size: z.number().describe('File size in bytes'),
  lines: z.number().describe('Number of lines in the file'),
  encoding: z.string().describe('File encoding'),
}).describe('Result of reading a file');

/**
 * Schema for file edit options
 */
export const FileEditOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to edit'),
  old_string: z.string().describe('String to replace (must match exactly)'),
  new_string: z.string().describe('String to replace with'),
}).describe('Options for editing a file');

/**
 * Schema for file edit result
 */
export const FileEditResultSchema = z.object({
  file_path: z.string().describe('Absolute path of the file'),
  success: z.boolean().describe('Whether the edit was successful'),
  replacements: z.number().describe('Number of replacements made'),
  diff: z.string().optional().describe('Diff of the changes'),
}).describe('Result of editing a file');

/**
 * Schema for file create options
 */
export const FileCreateOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to create the file at'),
  content: FileContentSchema.describe('Initial content for the file'),
  overwrite: BooleanFlagSchema.describe('Whether to overwrite existing file'),
}).describe('Options for creating a file');

/**
 * Schema for file create result
 */
export const FileCreateResultSchema = z.object({
  file_path: z.string().describe('Absolute path of the created file'),
  success: z.boolean().describe('Whether the file was created'),
  size: z.number().describe('File size in bytes'),
}).describe('Result of creating a file');

/**
 * Schema for file delete options
 */
export const FileDeleteOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to delete'),
  confirm: z.boolean().default(true).describe('Confirmation flag (must be true)'),
}).describe('Options for deleting a file');

/**
 * Schema for file delete result
 */
export const FileDeleteResultSchema = z.object({
  file_path: z.string().describe('Absolute path of the deleted file'),
  success: z.boolean().describe('Whether the file was deleted'),
}).describe('Result of deleting a file');

/**
 * Schema for file rename options
 */
export const FileRenameOptionsSchema = z.object({
  source_path: FilePathSchema.describe('Current path of the file'),
  target_path: FilePathSchema.describe('New path for the file'),
  overwrite: BooleanFlagSchema.describe('Whether to overwrite if target exists'),
}).describe('Options for renaming a file');

/**
 * Schema for file rename result
 */
export const FileRenameResultSchema = z.object({
  source_path: z.string().describe('Original path'),
  target_path: z.string().describe('New path'),
  success: z.boolean().describe('Whether the rename was successful'),
}).describe('Result of renaming a file');

// ============================================================================
// Directory Operation Schemas
// ============================================================================

/**
 * Schema for directory list options
 */
export const DirectoryListOptionsSchema = z.object({
  directory_path: DirectoryPathSchema.describe('Path to the directory to list'),
  recursive: BooleanFlagSchema.describe('Whether to list recursively'),
  include_hidden: BooleanFlagSchema.describe('Whether to include hidden files'),
  pattern: GlobPatternSchema.optional().describe('Pattern to filter files'),
}).describe('Options for listing a directory');

/**
 * Schema for file/directory entry
 */
export const FileEntrySchema = z.object({
  name: z.string().describe('Entry name'),
  path: z.string().describe('Full path'),
  type: z.enum(['file', 'directory', 'symlink', 'other']).describe('Entry type'),
  size: z.number().optional().describe('Size in bytes (for files)'),
  modified: z.string().optional().describe('Last modification time (ISO 8601)'),
  created: z.string().optional().describe('Creation time (ISO 8601)'),
}).describe('File or directory entry');

/**
 * Schema for directory list result
 */
export const DirectoryListResultSchema = z.object({
  directory_path: z.string().describe('Absolute path of the directory'),
  entries: z.array(FileEntrySchema).describe('List of entries'),
  total: z.number().describe('Total number of entries'),
}).describe('Result of listing a directory');

/**
 * Schema for directory create options
 */
export const DirectoryCreateOptionsSchema = z.object({
  directory_path: DirectoryPathSchema.describe('Path to create the directory at'),
  recursive: z.boolean().default(true).describe('Whether to create parent directories'),
}).describe('Options for creating a directory');

/**
 * Schema for directory create result
 */
export const DirectoryCreateResultSchema = z.object({
  directory_path: z.string().describe('Absolute path of the created directory'),
  success: z.boolean().describe('Whether the directory was created'),
  created: z.array(z.string()).describe('List of created directories'),
}).describe('Result of creating a directory');

/**
 * Schema for directory delete options
 */
export const DirectoryDeleteOptionsSchema = z.object({
  directory_path: DirectoryPathSchema.describe('Path to the directory to delete'),
  recursive: z.boolean().default(false).describe('Whether to delete recursively'),
  confirm: z.boolean().default(true).describe('Confirmation flag (must be true for recursive delete)'),
}).describe('Options for deleting a directory');

/**
 * Schema for directory delete result
 */
export const DirectoryDeleteResultSchema = z.object({
  directory_path: z.string().describe('Absolute path of the deleted directory'),
  success: z.boolean().describe('Whether the directory was deleted'),
  deleted_count: z.number().describe('Number of items deleted'),
}).describe('Result of deleting a directory');

// ============================================================================
// Search Schemas
// ============================================================================

/**
 * Schema for grep search options
 */
export const GrepOptionsSchema = z.object({
  pattern: RegexPatternSchema.describe('Regular expression pattern to search for'),
  path: DirectoryPathSchema.optional().describe('Directory or file to search in'),
  include: GlobPatternSchema.optional().describe('Pattern for files to include'),
  exclude: GlobPatternSchema.optional().describe('Pattern for files to exclude'),
  case_sensitive: BooleanFlagSchema.describe('Whether search is case-sensitive'),
  whole_word: BooleanFlagSchema.describe('Whether to match whole words only'),
  context_lines: z.number().int().min(0).max(10).default(2).describe('Lines of context to show'),
}).describe('Options for grep search');

/**
 * Schema for a grep match
 */
export const GrepMatchSchema = z.object({
  file_path: z.string().describe('Path to the file containing the match'),
  line_number: z.number().describe('Line number of the match'),
  column: z.number().optional().describe('Column number of the match'),
  match: z.string().describe('The matched text'),
  line: z.string().describe('The full line containing the match'),
  context_before: z.array(z.string()).describe('Lines before the match'),
  context_after: z.array(z.string()).describe('Lines after the match'),
}).describe('A grep match');

/**
 * Schema for grep result
 */
export const GrepResultSchema = z.object({
  pattern: z.string().describe('Search pattern'),
  matches: z.array(GrepMatchSchema).describe('List of matches'),
  total_files: z.number().describe('Total number of files searched'),
  total_matches: z.number().describe('Total number of matches'),
}).describe('Result of grep search');

/**
 * Schema for find options
 */
export const FindOptionsSchema = z.object({
  path: DirectoryPathSchema.describe('Directory to search in'),
  name: GlobPatternSchema.optional().describe('Pattern for file names'),
  type: z.enum(['file', 'directory', 'any']).default('any').describe('Type of entries to find'),
  modified_within: z.string().optional().describe('Find files modified within time (e.g., "1h", "1d")'),
  size_greater: z.number().optional().describe('Find files larger than size in bytes'),
  size_less: z.number().optional().describe('Find files smaller than size in bytes'),
  max_depth: z.number().int().min(1).optional().describe('Maximum depth to search'),
}).describe('Options for finding files');

/**
 * Schema for find result
 */
export const FindResultSchema = z.object({
  files: z.array(z.string()).describe('List of matching file paths'),
  total: z.number().describe('Total number of matches'),
}).describe('Result of find operation');

// ============================================================================
// Execution Schemas
// ============================================================================

/**
 * Schema for bash command options
 */
export const BashOptionsSchema = z.object({
  command: ShellCommandSchema.describe('Shell command to execute'),
  working_dir: DirectoryPathSchema.optional().describe('Working directory for the command'),
  env: EnvironmentVariablesSchema.optional(),
  timeout: TimeoutSchema,
  capture_output: BooleanFlagSchema.describe('Whether to capture command output'),
}).describe('Options for executing a bash command');

/**
 * Schema for bash result
 */
export const BashResultSchema = z.object({
  command: z.string().describe('Executed command'),
  exit_code: z.number().describe('Exit code of the command'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().describe('Execution duration in milliseconds'),
}).describe('Result of bash command execution');

/**
 * Schema for git command options
 */
export const GitOptionsSchema = z.object({
  command: z.string().min(1).describe('Git subcommand to execute (e.g., "status", "log")'),
  args: z.array(z.string()).default([]).describe('Arguments for the git command'),
  working_dir: DirectoryPathSchema.optional().describe('Working directory (must be a git repository)'),
}).describe('Options for executing a git command');

/**
 * Schema for git result
 */
export const GitResultSchema = z.object({
  command: z.string().describe('Full git command executed'),
  exit_code: z.number().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
}).describe('Result of git command execution');

// ============================================================================
// Web Schemas
// ============================================================================

/**
 * Schema for web search options
 */
export const WebSearchOptionsSchema = z.object({
  query: SearchQuerySchema.describe('Search query'),
  num_results: z.number().int().min(1).max(50).default(10).describe('Number of results to return'),
  safe_search: z.boolean().default(true).describe('Whether to enable safe search'),
}).describe('Options for web search');

/**
 * Schema for web search result item
 */
export const WebSearchResultItemSchema = z.object({
  title: z.string().describe('Result title'),
  url: z.string().describe('Result URL'),
  snippet: z.string().describe('Result snippet/description'),
  source: z.string().optional().describe('Source of the result'),
}).describe('Web search result item');

/**
 * Schema for web search result
 */
export const WebSearchResultSchema = z.object({
  query: z.string().describe('Search query'),
  results: z.array(WebSearchResultItemSchema).describe('Search results'),
  total: z.number().describe('Total number of results found'),
}).describe('Result of web search');

/**
 * Schema for web fetch options
 */
export const WebFetchOptionsSchema = z.object({
  url: URLSchema.describe('URL to fetch'),
  method: HTTPMethodSchema,
  headers: HTTPHeadersSchema.optional(),
  body: z.string().optional().describe('Request body'),
  timeout: TimeoutSchema,
  follow_redirects: BooleanFlagSchema.describe('Whether to follow redirects'),
}).describe('Options for fetching a web page');

/**
 * Schema for web fetch result
 */
export const WebFetchResultSchema = z.object({
  url: z.string().describe('Final URL after redirects'),
  status: z.number().describe('HTTP status code'),
  status_text: z.string().describe('HTTP status text'),
  headers: z.record(z.string()).describe('Response headers'),
  content: z.string().describe('Response content'),
  content_type: z.string().optional().describe('Content-Type header'),
}).describe('Result of web fetch');

// ============================================================================
// LSP Schemas
// ============================================================================

/**
 * Schema for file position (line and column)
 */
export const FilePositionSchema = z.object({
  line: z.number().int().min(0).describe('0-based line number'),
  character: z.number().int().min(0).describe('0-based character/ column number'),
}).describe('Position in a file');

/**
 * Schema for file range
 */
export const FileRangeSchema = z.object({
  start: FilePositionSchema.describe('Start position'),
  end: FilePositionSchema.describe('End position'),
}).describe('Range in a file');

/**
 * Schema for LSP location
 */
export const LSPLocationSchema = z.object({
  uri: z.string().describe('File URI'),
  range: FileRangeSchema.describe('Location range'),
}).describe('LSP location');

/**
 * Schema for LSP diagnostics options
 */
export const LSPDiagnosticsOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to get diagnostics for'),
}).describe('Options for getting LSP diagnostics');

/**
 * Schema for LSP diagnostic
 */
export const LSPDiagnosticSchema = z.object({
  message: z.string().describe('Diagnostic message'),
  severity: z.enum(['error', 'warning', 'information', 'hint']).describe('Diagnostic severity'),
  code: z.string().optional().describe('Diagnostic code'),
  source: z.string().optional().describe('Source of the diagnostic'),
  range: FileRangeSchema.describe('Location of the diagnostic'),
}).describe('LSP diagnostic');

/**
 * Schema for LSP diagnostics result
 */
export const LSPDiagnosticsResultSchema = z.object({
  file_path: z.string().describe('File path'),
  diagnostics: z.array(LSPDiagnosticSchema).describe('List of diagnostics'),
  error_count: z.number().describe('Number of errors'),
  warning_count: z.number().describe('Number of warnings'),
}).describe('Result of LSP diagnostics');

// ============================================================================
// Agent Schemas
// ============================================================================

/**
 * Schema for agent spawn options
 */
export const AgentOptionsSchema = z.object({
  task: z.string().min(1).max(10000).describe('Task description for the agent'),
  context: z.record(z.unknown()).optional().describe('Additional context for the agent'),
  tools: z.array(z.string()).optional().describe('List of tools the agent can use'),
  max_iterations: z.number().int().min(1).max(100).default(10).describe('Maximum iterations'),
}).describe('Options for spawning an agent');

/**
 * Schema for agent result
 */
export const AgentResultSchema = z.object({
  agent_id: z.string().describe('Unique agent ID'),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).describe('Agent status'),
  result: z.unknown().optional().describe('Agent result'),
  iterations: z.number().describe('Number of iterations performed'),
}).describe('Result of agent execution');

/**
 * Schema for ask user options
 */
export const AskUserOptionsSchema = z.object({
  question: z.string().min(1).max(1000).describe('Question to ask the user'),
  options: z.array(z.string()).optional().describe('Predefined options for the user to choose from'),
  default_value: z.string().optional().describe('Default value if user provides no input'),
}).describe('Options for asking the user');

/**
 * Schema for ask user result
 */
export const AskUserResultSchema = z.object({
  question: z.string().describe('Question that was asked'),
  response: z.string().describe('User response'),
}).describe('Result of asking the user');

// ============================================================================
// Memory Schemas
// ============================================================================

/**
 * Schema for memory key
 */
export const MemoryKeySchema = z.string()
  .min(1, 'Memory key cannot be empty')
  .max(256, 'Memory key too long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Memory key must be alphanumeric with dots, underscores, and hyphens')
  .describe('Unique key for memory entry');

/**
 * Schema for memory read options
 */
export const MemoryReadOptionsSchema = z.object({
  key: MemoryKeySchema.describe('Key of the memory entry to read'),
}).describe('Options for reading from memory');

/**
 * Schema for memory write options
 */
export const MemoryWriteOptionsSchema = z.object({
  key: MemoryKeySchema.describe('Key for the memory entry'),
  value: z.unknown().describe('Value to store'),
  ttl: z.number().int().min(0).optional().describe('Time to live in seconds (0 = forever)'),
}).describe('Options for writing to memory');

/**
 * Schema for memory search options
 */
export const MemorySearchOptionsSchema = z.object({
  query: SearchQuerySchema.describe('Search query'),
  limit: LimitSchema,
}).describe('Options for searching memory');

// ============================================================================
// IDE Schemas
// ============================================================================

/**
 * Schema for IDE navigate options
 */
export const IDENavigateOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to navigate to'),
  line: z.number().int().min(1).optional().describe('Line number to navigate to'),
  column: z.number().int().min(1).optional().describe('Column number to navigate to'),
}).describe('Options for IDE navigation');

/**
 * Schema for IDE edit options
 */
export const IDEEditOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to edit'),
  content: z.string().describe('New content for the file'),
}).describe('Options for IDE editing');

/**
 * Schema for IDE run options
 */
export const IDERunOptionsSchema = z.object({
  command: z.string().describe('Command to run'),
  args: z.array(z.string()).default([]).describe('Command arguments'),
}).describe('Options for running in IDE');

/**
 * Schema for IDE debug options
 */
export const IDEDebugOptionsSchema = z.object({
  file_path: FilePathSchema.describe('Path to the file to debug'),
  breakpoints: z.array(z.number().int().min(1)).optional().describe('Line numbers for breakpoints'),
}).describe('Options for debugging in IDE');

// ============================================================================
// Type Exports
// ============================================================================

export type FilePath = z.infer<typeof FilePathSchema>;
export type DirectoryPath = z.infer<typeof DirectoryPathSchema>;
export type LineRange = z.infer<typeof LineRangeSchema>;
export type FileEntry = z.infer<typeof FileEntrySchema>;
export type GrepMatch = z.infer<typeof GrepMatchSchema>;
export type BashResult = z.infer<typeof BashResultSchema>;
export type WebSearchResultItem = z.infer<typeof WebSearchResultItemSchema>;
export type LSPDiagnostic = z.infer<typeof LSPDiagnosticSchema>;
export type LSPLocation = z.infer<typeof LSPLocationSchema>;
export type FilePosition = z.infer<typeof FilePositionSchema>;
export type FileRange = z.infer<typeof FileRangeSchema>;
export type MemoryKey = z.infer<typeof MemoryKeySchema>;
