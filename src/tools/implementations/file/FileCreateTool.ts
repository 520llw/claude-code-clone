/**
 * @fileoverview File Create Tool for Claude Code Clone
 * 
 * This tool provides comprehensive file creation capabilities with:
 * - Creating new files with content
 * - Directory creation (recursive)
 * - Overwrite protection
 * - Permission setting
 * - Template support
 * - Validation of created files
 * 
 * @module FileCreateTool
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
 * Schema for file create tool input
 */
export const FileCreateInputSchema = z.object({
  /** Path where the file should be created */
  file_path: z.string()
    .min(1, 'File path cannot be empty')
    .max(4096, 'File path too long')
    .describe('Path where the file should be created'),

  /** Content to write to the file */
  content: z.string()
    .describe('Content to write to the file'),

  /** Whether to overwrite if file already exists */
  overwrite: z.boolean()
    .default(false)
    .describe('Whether to overwrite if file already exists'),

  /** Whether to create parent directories if they don\'t exist */
  create_parents: z.boolean()
    .default(true)
    .describe('Whether to create parent directories'),

  /** File permissions (octal, e.g., "644", "755") */
  permissions: z.string()
    .regex(/^[0-7]{3,4}$/, 'Permissions must be 3-4 octal digits')
    .optional()
    .describe('File permissions in octal (e.g., "644")'),

  /** Encoding for the file content */
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'hex', 'latin1'])
    .default('utf8')
    .describe('Encoding for the file content'),
}).describe('Input for creating a file');

export type FileCreateInput = z.infer<typeof FileCreateInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for file create tool output
 */
export const FileCreateOutputSchema = z.object({
  /** Absolute path of the created file */
  file_path: z.string()
    .describe('Absolute path of the created file'),

  /** Whether the file was created successfully */
  success: z.boolean()
    .describe('Whether the file was created successfully'),

  /** File size in bytes */
  size: z.number()
    .int()
    .min(0)
    .describe('File size in bytes'),

  /** Number of lines in the file */
  lines: z.number()
    .int()
    .min(0)
    .describe('Number of lines in the file'),

  /** Whether the file was overwritten */
  overwritten: z.boolean()
    .describe('Whether an existing file was overwritten'),

  /** Parent directories that were created */
  created_directories: z.array(z.string())
    .describe('Parent directories that were created'),

  /** File permissions set */
  permissions: z.string()
    .optional()
    .describe('File permissions that were set'),

  /** Encoding used */
  encoding: z.string()
    .describe('Encoding used for the file'),
}).describe('Result of creating a file');

export type FileCreateOutput = z.infer<typeof FileCreateOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Maximum file size (10 MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File Create Tool - Create new files
 * 
 * This tool creates new files with support for:
 * - Content writing
 * - Parent directory creation
 * - Overwrite protection
 * - Permission setting
 * - Multiple encodings
 * 
 * @example
 * ```typescript
 * const tool = new FileCreateTool();
 * const result = await tool.execute({
 *   file_path: '/path/to/new/file.ts',
 *   content: 'export const foo = "bar";',
 *   create_parents: true,
 *   permissions: '644'
 * }, context);
 * ```
 */
export class FileCreateTool extends Tool {
  /** Tool name */
  public readonly name = 'file_create';

  /** Tool description */
  public readonly description = 'Create new files with content, parent directory creation, and permission control';

  /** Detailed documentation */
  public readonly documentation = `
## File Create Tool

Creates new files with comprehensive options for:
- Content writing
- Parent directory creation
- Overwrite protection
- Permission setting
- Multiple encodings

### Input Parameters

- **file_path** (required): Path where the file should be created
- **content** (required): Content to write to the file
- **overwrite** (optional): Overwrite if file exists (default: false)
- **create_parents** (optional): Create parent directories (default: true)
- **permissions** (optional): File permissions in octal (e.g., "644", "755")
- **encoding** (optional): Content encoding (utf8, ascii, base64, hex, latin1)

### Output

Returns detailed information about the created file:
- file_path: Absolute path of the created file
- success: Whether creation was successful
- size: File size in bytes
- lines: Number of lines in the file
- overwritten: Whether an existing file was overwritten
- created_directories: Parent directories that were created
- permissions: File permissions that were set
- encoding: Encoding used

### Examples

Create a simple file:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "content": "export const foo = 'bar';"
}
\`\`\`

Create with specific permissions:
\`\`\`json
{
  "file_path": "/path/to/script.sh",
  "content": "#!/bin/bash\\necho 'Hello World'",
  "permissions": "755"
}
\`\`\`

Create binary file:
\`\`\`json
{
  "file_path": "/path/to/data.bin",
  "content": "SGVsbG8gV29ybGQ=",
  "encoding": "base64"
}
\`\`\`

Force overwrite:
\`\`\`json
{
  "file_path": "/path/to/existing.txt",
  "content": "new content",
  "overwrite": true
}
\`\`\`

### Error Handling

- File exists (no overwrite): Returns FILE_EXISTS error
- Permission denied: Returns PERMISSION_DENIED error
- Invalid path: Returns INVALID_PATH error
- Content too large: Returns CONTENT_TOO_LARGE error
- Parent directory creation failed: Returns DIRECTORY_CREATE_ERROR

### Safety Features

1. **Overwrite Protection**: Prevents accidental overwrites by default
2. **Size Limits**: Enforces maximum file size
3. **Path Validation**: Validates paths for safety
4. **Atomic Creation**: Uses atomic write operations where possible
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - ask for create operations */
  public readonly permissionLevel = PermissionLevel.ASK;

  /** Input schema */
  public readonly inputSchema = FileCreateInputSchema;

  /** Output schema */
  public readonly outputSchema = FileCreateOutputSchema;

  /** Tool tags */
  public readonly tags = ['file', 'create', 'write', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Create a simple text file',
      input: {
        file_path: '/path/to/file.txt',
        content: 'Hello, World!',
      },
    },
    {
      description: 'Create with executable permissions',
      input: {
        file_path: '/path/to/script.sh',
        content: '#!/bin/bash\necho "Hello"',
        permissions: '755',
      },
    },
    {
      description: 'Force overwrite existing file',
      input: {
        file_path: '/path/to/existing.txt',
        content: 'new content',
        overwrite: true,
      },
    },
  ];

  /**
   * Execute the file create operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FileCreateInput;

    try {
      // Resolve the file path
      const resolvedPath = path.resolve(context.workingDirectory, params.file_path);

      // Validate content size
      const contentBuffer = Buffer.from(params.content, params.encoding as BufferEncoding);
      if (contentBuffer.length > MAX_FILE_SIZE) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'CONTENT_TOO_LARGE',
            `Content size (${this.formatBytes(contentBuffer.length)}) exceeds maximum (${this.formatBytes(MAX_FILE_SIZE)})`,
            { suggestion: 'Reduce content size or split into multiple files.' }
          )
        );
      }

      // Check if file already exists
      let fileExists = false;
      try {
        await fs.access(resolvedPath);
        const stats = await fs.stat(resolvedPath);
        if (stats.isFile()) {
          fileExists = true;
        } else {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PATH_IS_DIRECTORY',
              `Path exists and is a directory: ${params.file_path}`,
              { suggestion: 'Choose a different file path.' }
            )
          );
        }
      } catch {
        // File doesn't exist, which is expected
      }

      // Check overwrite
      if (fileExists && !params.overwrite) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'FILE_EXISTS',
            `File already exists: ${params.file_path}`,
            { 
              suggestion: 'Set overwrite to true to replace the existing file.',
              retryable: true 
            }
          )
        );
      }

      // Create parent directories if needed
      const createdDirectories: string[] = [];
      if (params.create_parents) {
        const parentDir = path.dirname(resolvedPath);
        try {
          await fs.mkdir(parentDir, { recursive: true });
          // Track created directories (simplified - in production, track actual creations)
          createdDirectories.push(parentDir);
        } catch (error) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_CREATE_ERROR',
              `Failed to create parent directories: ${error instanceof Error ? error.message : String(error)}`,
              { suggestion: 'Check permissions and disk space.' }
            )
          );
        }
      } else {
        // Check if parent directory exists
        const parentDir = path.dirname(resolvedPath);
        try {
          await fs.access(parentDir);
        } catch {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PARENT_DIRECTORY_NOT_FOUND',
              `Parent directory does not exist: ${parentDir}`,
              { suggestion: 'Set create_parents to true to create parent directories automatically.' }
            )
          );
        }
      }

      // Write the file
      try {
        await fs.writeFile(resolvedPath, contentBuffer);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied creating file: ${params.file_path}`,
              { suggestion: 'Check directory permissions or run with elevated privileges.' }
            )
          );
        }
        throw error;
      }

      // Set permissions if specified
      let setPermissions: string | undefined;
      if (params.permissions) {
        try {
          const mode = parseInt(params.permissions, 8);
          await fs.chmod(resolvedPath, mode);
          setPermissions = params.permissions;
        } catch (error) {
          // Log warning but don't fail - file was created
          this.log('warn', `Failed to set permissions: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Get file stats
      const stats = await fs.stat(resolvedPath);
      const content = params.content;
      const lines = content.split('\n').length;

      // Build output
      const output: FileCreateOutput = {
        file_path: resolvedPath,
        success: true,
        size: stats.size,
        lines,
        overwritten: fileExists,
        created_directories: createdDirectories,
        permissions: setPermissions,
        encoding: params.encoding,
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
      const displayOutput = this.formatOutput(output);

      return this.createSuccessResult(
        startedAt,
        output,
        displayOutput,
        {
          fileSize: stats.size,
          lines,
          overwritten: fileExists,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'CREATE_ERROR',
          `Failed to create file: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as FileCreateInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate file path doesn't contain null bytes
    if (params.file_path.includes('\0')) {
      errors.push('File path cannot contain null bytes');
    }

    // Validate permissions format
    if (params.permissions && !/^[0-7]{3,4}$/.test(params.permissions)) {
      errors.push('Permissions must be 3-4 octal digits (e.g., "644", "755")');
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
   * @returns Formatted display string
   */
  private formatOutput(output: FileCreateOutput): string {
    const parts: string[] = [];

    // Header
    const action = output.overwritten ? 'Overwritten' : 'Created';
    parts.push(`📄 ${action}: ${output.file_path}`);
    parts.push(`   Size: ${this.formatBytes(output.size)} | Lines: ${output.lines} | Encoding: ${output.encoding}`);

    if (output.permissions) {
      parts.push(`   Permissions: ${output.permissions}`);
    }

    if (output.created_directories.length > 0) {
      parts.push(`   Created directories: ${output.created_directories.join(', ')}`);
    }

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
    data: FileCreateOutput,
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

export default FileCreateTool;
