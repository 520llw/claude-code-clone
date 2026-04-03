/**
 * @fileoverview File Read Tool for Claude Code Clone
 * 
 * This tool provides comprehensive file reading capabilities with support for:
 * - Reading entire files or specific line ranges
 * - Byte offset-based reading for large files
 * - Multiple encoding support (UTF-8, ASCII, Base64, etc.)
 * - Automatic line number annotation
 * - File metadata retrieval
 * - Size limits and safety checks
 * 
 * @module FileReadTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

/**
 * Schema for file read tool input
 */
export const FileReadInputSchema = z.object({
  /** Absolute or relative path to the file to read */
  file_path: z.string()
    .min(1, 'File path cannot be empty')
    .max(4096, 'File path too long')
    .describe('Absolute or relative path to the file to read'),

  /** Starting line number (1-based, inclusive) */
  offset: z.number()
    .int()
    .min(1, 'Offset must be at least 1')
    .optional()
    .describe('Starting line number (1-based, inclusive)'),

  /** Maximum number of lines to read */
  limit: z.number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000 lines')
    .optional()
    .describe('Maximum number of lines to read'),

  /** File encoding */
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'hex', 'latin1'])
    .default('utf8')
    .describe('File encoding'),

  /** Whether to include line numbers in output */
  show_line_numbers: z.boolean()
    .default(true)
    .describe('Whether to include line numbers in output'),

  /** Whether to follow symbolic links */
  follow_symlinks: z.boolean()
    .default(false)
    .describe('Whether to follow symbolic links'),
}).describe('Input for reading a file');

export type FileReadInput = z.infer<typeof FileReadInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for file read tool output
 */
export const FileReadOutputSchema = z.object({
  /** File content (or requested portion) */
  content: z.string()
    .describe('File content (or requested portion)'),

  /** Absolute path of the file */
  file_path: z.string()
    .describe('Absolute path of the file'),

  /** File size in bytes */
  size: z.number()
    .int()
    .min(0)
    .describe('File size in bytes'),

  /** Total number of lines in the file */
  total_lines: z.number()
    .int()
    .min(0)
    .describe('Total number of lines in the file'),

  /** Number of lines read */
  lines_read: z.number()
    .int()
    .min(0)
    .describe('Number of lines read'),

  /** Starting line number (1-based) */
  start_line: z.number()
    .int()
    .min(1)
    .describe('Starting line number (1-based)'),

  /** Ending line number (1-based) */
  end_line: z.number()
    .int()
    .min(1)
    .describe('Ending line number (1-based)'),

  /** File encoding used */
  encoding: z.string()
    .describe('File encoding used'),

  /** Last modification time */
  modified_at: z.string()
    .optional()
    .describe('Last modification time (ISO 8601)'),

  /** File permissions */
  permissions: z.string()
    .optional()
    .describe('File permissions (e.g., "644", "755")'),
}).describe('Result of reading a file');

export type FileReadOutput = z.infer<typeof FileReadOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Maximum file size to read (10 MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File Read Tool - Read file contents with line range support
 * 
 * This tool allows reading files with fine-grained control over:
 * - Which lines to read (offset and limit)
 * - Character encoding
 * - Line number display
 * - Symbolic link handling
 * 
 * @example
 * ```typescript
 * const tool = new FileReadTool();
 * const result = await tool.execute({
 *   file_path: '/path/to/file.ts',
 *   offset: 1,
 *   limit: 50,
 *   show_line_numbers: true
 * }, context);
 * ```
 */
export class FileReadTool extends Tool {
  /** Tool name */
  public readonly name = 'file_read';

  /** Tool description */
  public readonly description = 'Read file contents with optional line range support, encoding selection, and line number annotation';

  /** Detailed documentation */
  public readonly documentation = `
## File Read Tool

Reads the contents of a file from the filesystem with support for:
- Partial reading (line ranges)
- Multiple encodings
- Line number annotation
- Large file handling

### Input Parameters

- **file_path** (required): Path to the file to read
- **offset** (optional): Starting line number (1-based, default: 1)
- **limit** (optional): Maximum lines to read (default: all lines)
- **encoding** (optional): File encoding (utf8, ascii, base64, hex, latin1)
- **show_line_numbers** (optional): Include line numbers in output
- **follow_symlinks** (optional): Follow symbolic links

### Output

Returns the file content along with metadata:
- content: The file content (or requested portion)
- file_path: Absolute path to the file
- size: File size in bytes
- total_lines: Total number of lines in the file
- lines_read: Number of lines actually read
- start_line: Starting line number
- end_line: Ending line number
- encoding: Encoding used
- modified_at: Last modification time
- permissions: File permissions

### Examples

Read entire file:
\`\`\`json
{
  "file_path": "/path/to/file.ts"
}
\`\`\`

Read specific lines:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "offset": 10,
  "limit": 20
}
\`\`\`

Read with base64 encoding:
\`\`\`json
{
  "file_path": "/path/to/image.png",
  "encoding": "base64"
}
\`\`\`

### Error Handling

- File not found: Returns FILE_NOT_FOUND error
- Permission denied: Returns PERMISSION_DENIED error
- File too large: Returns FILE_TOO_LARGE error
- Invalid encoding: Returns INVALID_ENCODING error
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - auto-approve for read operations */
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;

  /** Input schema */
  public readonly inputSchema = FileReadInputSchema;

  /** Output schema */
  public readonly outputSchema = FileReadOutputSchema;

  /** Tool tags */
  public readonly tags = ['file', 'read', 'filesystem', 'content'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Read entire file',
      input: {
        file_path: '/path/to/file.ts',
      },
      output: {
        content: 'export const foo = "bar";',
        file_path: '/path/to/file.ts',
        size: 25,
        total_lines: 1,
        lines_read: 1,
        start_line: 1,
        end_line: 1,
        encoding: 'utf8',
      },
    },
    {
      description: 'Read specific line range',
      input: {
        file_path: '/path/to/file.ts',
        offset: 10,
        limit: 20,
        show_line_numbers: true,
      },
    },
    {
      description: 'Read binary file as base64',
      input: {
        file_path: '/path/to/image.png',
        encoding: 'base64',
      },
    },
  ];

  /**
   * Execute the file read operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FileReadInput;

    try {
      // Resolve the file path
      const resolvedPath = path.resolve(context.workingDirectory, params.file_path);

      // Check if file exists and get stats
      let stats: { size: number; mtime: Date; mode: number; isFile: () => boolean; isSymbolicLink: () => boolean };
      try {
        const fsStats = params.follow_symlinks
          ? await fs.stat(resolvedPath)
          : await fs.lstat(resolvedPath);
        
        stats = {
          size: fsStats.size,
          mtime: fsStats.mtime,
          mode: fsStats.mode,
          isFile: () => fsStats.isFile(),
          isSymbolicLink: () => fsStats.isSymbolicLink(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'FILE_NOT_FOUND',
              `File not found: ${params.file_path}`,
              { suggestion: 'Check that the file path is correct and the file exists.' }
            )
          );
        }
        throw error;
      }

      // Validate it's a file
      if (!stats.isFile()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'NOT_A_FILE',
            `Path is not a file: ${params.file_path}`,
            { suggestion: 'Use directory_list to explore directories.' }
          )
        );
      }

      // Check file size
      if (stats.size > MAX_FILE_SIZE) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'FILE_TOO_LARGE',
            `File is too large (${this.formatBytes(stats.size)}). Maximum size is ${this.formatBytes(MAX_FILE_SIZE)}.`,
            { 
              suggestion: 'Use offset and limit parameters to read specific portions of the file.',
              retryable: false 
            }
          )
        );
      }

      // Read file content
      const encoding = params.encoding === 'utf-8' ? 'utf8' : params.encoding;
      let content: string;
      
      try {
        content = await fs.readFile(resolvedPath, encoding as BufferEncoding);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied reading file: ${params.file_path}`,
              { suggestion: 'Check file permissions or run with elevated privileges.' }
            )
          );
        }
        throw error;
      }

      // Process content based on parameters
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Calculate line range
      const startLine = params.offset || 1;
      const maxLines = params.limit || totalLines;
      const endLine = Math.min(startLine + maxLines - 1, totalLines);

      // Extract requested lines
      const selectedLines = lines.slice(startLine - 1, endLine);

      // Add line numbers if requested
      let processedContent: string;
      if (params.show_line_numbers && encoding !== 'base64' && encoding !== 'hex') {
        const lineNumberWidth = String(endLine).length;
        processedContent = selectedLines
          .map((line, index) => {
            const lineNum = startLine + index;
            return `${String(lineNum).padStart(lineNumberWidth, ' ')}  ${line}`;
          })
          .join('\n');
      } else {
        processedContent = selectedLines.join('\n');
      }

      // Build output
      const output: FileReadOutput = {
        content: processedContent,
        file_path: resolvedPath,
        size: stats.size,
        total_lines: totalLines,
        lines_read: selectedLines.length,
        start_line: startLine,
        end_line: endLine,
        encoding: params.encoding,
        modified_at: stats.mtime.toISOString(),
        permissions: (stats.mode & 0o777).toString(8).padStart(3, '0'),
      };

      // Validate output
      const outputValidation = this.outputSchema.safeParse(output);
      if (!outputValidation.success) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'OUTPUT_VALIDATION_ERROR',
            `Output validation failed: ${outputValidation.error.message}`
          )
        );
      }

      // Create display output
      const displayOutput = this.formatOutput(output, params.show_line_numbers);

      return this.createSuccessResult(
        startedAt,
        output,
        displayOutput,
        { 
          fileSize: stats.size,
          linesRead: selectedLines.length,
          encoding: params.encoding 
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'READ_ERROR',
          `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          { retryable: true }
        )
      );
    }
  }

  /**
   * Validate execution context
   * @param input - Input data
   * @param context - Execution context
   * @returns Validation result
   */
  protected async validateContext(
    input: unknown,
    context: ToolContext
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as FileReadInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate offset and limit combination
    if (params.offset !== undefined && params.limit !== undefined) {
      if (params.offset < 1) {
        errors.push('Offset must be at least 1');
      }
      if (params.limit < 1) {
        errors.push('Limit must be at least 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Format bytes to human-readable string
   * @param bytes - Number of bytes
   * @returns Formatted string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format output for display
   * @param output - Tool output
   * @param showLineNumbers - Whether line numbers were shown
   * @returns Formatted display string
   */
  private formatOutput(output: FileReadOutput, showLineNumbers: boolean): string {
    const parts: string[] = [];

    // Header
    parts.push(`📄 ${output.file_path}`);
    parts.push(`   Size: ${this.formatBytes(output.size)} | Lines: ${output.start_line}-${output.end_line} of ${output.total_lines} | Encoding: ${output.encoding}`);
    parts.push('');

    // Content
    if (output.content) {
      parts.push(output.content);
    } else {
      parts.push('(empty file)');
    }

    // Footer
    parts.push('');
    parts.push(`--- End of file (${output.lines_read} lines read) ---`);

    return parts.join('\n');
  }

  /**
   * Create a success result
   * @param startedAt - Start timestamp
   * @param data - Result data
   * @param output - Display output
   * @param metadata - Additional metadata
   * @returns Tool result
   */
  private createSuccessResult(
    startedAt: Date,
    data: FileReadOutput,
    output: string,
    metadata?: Record<string, unknown>
  ): ToolResult {
    const completedAt = new Date();
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
   * @param startedAt - Start timestamp
   * @param error - Error information
   * @returns Tool result
   */
  private createErrorResult(
    startedAt: Date,
    error: ReturnType<typeof createToolError>
  ): ToolResult {
    const completedAt = new Date();
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default FileReadTool;
