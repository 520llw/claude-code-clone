/**
 * @fileoverview File Delete Tool for Claude Code Clone
 * 
 * This tool provides safe file deletion capabilities with:
 * - File existence verification
 * - Confirmation requirement
 * - Safe deletion (not to trash)
 * - Permission checks
 * - Symlink handling
 * - Detailed reporting
 * 
 * @module FileDeleteTool
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
 * Schema for file delete tool input
 */
export const FileDeleteInputSchema = z.object({
  /** Path to the file to delete */
  file_path: z.string()
    .min(1, 'File path cannot be empty')
    .max(4096, 'File path too long')
    .describe('Path to the file to delete'),

  /** Confirmation flag - must be true to delete */
  confirm: z.boolean()
    .refine((val) => val === true, {
      message: 'confirm must be true to delete the file',
    })
    .describe('Confirmation flag - must be true to delete'),

  /** Whether to follow symbolic links */
  follow_symlinks: z.boolean()
    .default(false)
    .describe('Whether to follow symbolic links'),

  /** Whether to delete symlinks themselves (not targets) */
  delete_symlink_only: z.boolean()
    .default(true)
    .describe('Delete symlinks themselves, not their targets'),
}).describe('Input for deleting a file');

export type FileDeleteInput = z.infer<typeof FileDeleteInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for file delete tool output
 */
export const FileDeleteOutputSchema = z.object({
  /** Absolute path of the deleted file */
  file_path: z.string()
    .describe('Absolute path of the deleted file'),

  /** Whether the deletion was successful */
  success: z.boolean()
    .describe('Whether the deletion was successful'),

  /** Whether the path was a symbolic link */
  was_symlink: z.boolean()
    .describe('Whether the path was a symbolic link'),

  /** Target of the symlink (if it was a symlink) */
  symlink_target: z.string()
    .optional()
    .describe('Target of the symlink (if applicable)'),

  /** Size of the deleted file */
  size: z.number()
    .int()
    .min(0)
    .describe('Size of the deleted file in bytes'),

  /** Time of deletion */
  deleted_at: z.string()
    .describe('Time of deletion (ISO 8601)'),
}).describe('Result of deleting a file');

export type FileDeleteOutput = z.infer<typeof FileDeleteOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * File Delete Tool - Delete files
 * 
 * This tool safely deletes files with:
 * - Confirmation requirement
 * - Symlink handling
 * - Detailed reporting
 * - Permission checks
 * 
 * @example
 * ```typescript
 * const tool = new FileDeleteTool();
 * const result = await tool.execute({
 *   file_path: '/path/to/file.txt',
 *   confirm: true
 * }, context);
 * ```
 */
export class FileDeleteTool extends Tool {
  /** Tool name */
  public readonly name = 'file_delete';

  /** Tool description */
  public readonly description = 'Delete files with confirmation requirement and symlink handling';

  /** Detailed documentation */
  public readonly documentation = `
## File Delete Tool

Safely deletes files from the filesystem with:
- Confirmation requirement (safety feature)
- Symlink handling options
- Detailed deletion reporting
- Permission validation
- File type verification

### Input Parameters

- **file_path** (required): Path to the file to delete
- **confirm** (required): Must be true to proceed with deletion
- **follow_symlinks** (optional): Follow symbolic links (default: false)
- **delete_symlink_only** (optional): Delete symlinks, not their targets (default: true)

### Output

Returns detailed information about the deletion:
- file_path: Absolute path of the deleted file
- success: Whether deletion was successful
- was_symlink: Whether the path was a symbolic link
- symlink_target: Target of the symlink (if applicable)
- size: Size of the deleted file in bytes
- deleted_at: Time of deletion (ISO 8601)

### Examples

Delete a file:
\`\`\`json
{
  "file_path": "/path/to/file.txt",
  "confirm": true
}
\`\`\`

Delete a symlink (not its target):
\`\`\`json
{
  "file_path": "/path/to/symlink",
  "confirm": true,
  "delete_symlink_only": true
}
\`\`\`

### Error Handling

- File not found: Returns FILE_NOT_FOUND error
- Confirmation not provided: Returns CONFIRMATION_REQUIRED error
- Path is directory: Returns PATH_IS_DIRECTORY error (use directory_delete)
- Permission denied: Returns PERMISSION_DENIED error
- Symlink target protection: Returns SYMLINK_TARGET_PROTECTED error

### Safety Features

1. **Confirmation Required**: Must explicitly set confirm to true
2. **Type Verification**: Ensures path is a file, not directory
3. **Symlink Handling**: Options for handling symbolic links
4. **Permanent Deletion**: Files are permanently deleted (not moved to trash)

### Important Notes

- This tool performs **permanent deletion** - files are not moved to trash
- Deleted files cannot be recovered through this tool
- Use with caution and always verify the file_path
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - elevated for delete operations */
  public readonly permissionLevel = PermissionLevel.ELEVATED;

  /** Input schema */
  public readonly inputSchema = FileDeleteInputSchema;

  /** Output schema */
  public readonly outputSchema = FileDeleteOutputSchema;

  /** Tool tags */
  public readonly tags = ['file', 'delete', 'remove', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Delete a file',
      input: {
        file_path: '/path/to/file.txt',
        confirm: true,
      },
    },
    {
      description: 'Delete a symlink',
      input: {
        file_path: '/path/to/symlink',
        confirm: true,
        delete_symlink_only: true,
      },
    },
  ];

  /**
   * Execute the file delete operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FileDeleteInput;

    try {
      // Resolve the file path
      const resolvedPath = path.resolve(context.workingDirectory, params.file_path);

      // Check confirmation
      if (!params.confirm) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'CONFIRMATION_REQUIRED',
            'Deletion not confirmed. Set confirm to true to delete the file.',
            { 
              suggestion: 'Set confirm: true to proceed with deletion.',
              retryable: true 
            }
          )
        );
      }

      // Check if file exists and get stats
      let stats: { 
        size: number; 
        isFile: () => boolean; 
        isDirectory: () => boolean;
        isSymbolicLink: () => boolean;
      };
      let symlinkTarget: string | undefined;

      try {
        const fsStats = params.follow_symlinks 
          ? await fs.stat(resolvedPath)
          : await fs.lstat(resolvedPath);
        
        stats = {
          size: fsStats.size,
          isFile: () => fsStats.isFile(),
          isDirectory: () => fsStats.isDirectory(),
          isSymbolicLink: () => fsStats.isSymbolicLink(),
        };

        // If it's a symlink, get the target
        if (fsStats.isSymbolicLink()) {
          symlinkTarget = await fs.readlink(resolvedPath);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'FILE_NOT_FOUND',
              `File not found: ${params.file_path}`,
              { suggestion: 'Check that the file path is correct.' }
            )
          );
        }
        throw error;
      }

      // Check if it's a directory
      if (stats.isDirectory()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'PATH_IS_DIRECTORY',
            `Path is a directory, not a file: ${params.file_path}`,
            { suggestion: 'Use directory_delete tool to delete directories.' }
          )
        );
      }

      // Validate it's a file (or symlink to file)
      if (!stats.isFile() && !stats.isSymbolicLink()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'NOT_A_FILE',
            `Path is not a file: ${params.file_path}`,
            { suggestion: 'Verify the path points to a file.' }
          )
        );
      }

      // If it's a symlink and we're not following symlinks, verify delete_symlink_only
      if (stats.isSymbolicLink() && !params.follow_symlinks && !params.delete_symlink_only) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'SYMLINK_TARGET_PROTECTED',
            'Path is a symbolic link. Set delete_symlink_only to true to delete the symlink itself.',
            { suggestion: 'Set delete_symlink_only: true to delete the symlink, or follow_symlinks: true to delete the target.' }
          )
        );
      }

      // Get file size before deletion
      const fileSize = stats.size;

      // Delete the file
      try {
        await fs.unlink(resolvedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied deleting file: ${params.file_path}`,
              { suggestion: 'Check file permissions or run with elevated privileges.' }
            )
          );
        }
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'OPERATION_NOT_PERMITTED',
              `Operation not permitted: ${params.file_path}`,
              { suggestion: 'The file may be protected or in use by another process.' }
            )
          );
        }
        throw error;
      }

      // Build output
      const output: FileDeleteOutput = {
        file_path: resolvedPath,
        success: true,
        was_symlink: stats.isSymbolicLink(),
        symlink_target: symlinkTarget,
        size: fileSize,
        deleted_at: new Date().toISOString(),
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
          wasSymlink: stats.isSymbolicLink(),
          fileSize,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'DELETE_ERROR',
          `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as FileDeleteInput;
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

    // Validate confirm is true
    if (!params.confirm) {
      errors.push('confirm must be true to delete the file');
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
  private formatOutput(output: FileDeleteOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`🗑️  Deleted: ${output.file_path}`);
    parts.push(`   Size: ${this.formatBytes(output.size)}`);
    parts.push(`   Time: ${output.deleted_at}`);

    if (output.was_symlink) {
      parts.push(`   Type: Symbolic link`);
      if (output.symlink_target) {
        parts.push(`   Target: ${output.symlink_target}`);
      }
    }

    parts.push('');
    parts.push('⚠️  Note: This file has been permanently deleted.');

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
    data: FileDeleteOutput,
    output: string,
    metadata?: Record<string, unknown>
  ): ToolResult {
    const completedAt = new Date();
    return {
      executionId: this.id,
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
      executionId: this.id,
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

export default FileDeleteTool;
