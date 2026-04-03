/**
 * @fileoverview Directory Delete Tool for Claude Code Clone
 * 
 * This tool provides directory deletion capabilities with:
 * - Empty directory deletion
 * - Recursive directory deletion
 * - Confirmation requirement
 * - Content listing before deletion
 * - Safety checks
 * 
 * @module DirectoryDeleteTool
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
 * Schema for directory delete tool input
 */
export const DirectoryDeleteInputSchema = z.object({
  /** Path to the directory to delete */
  directory_path: z.string()
    .min(1, 'Directory path cannot be empty')
    .max(4096, 'Directory path too long')
    .describe('Path to the directory to delete'),

  /** Whether to delete recursively (required for non-empty directories) */
  recursive: z.boolean()
    .default(false)
    .describe('Whether to delete recursively (required for non-empty directories)'),

  /** Confirmation flag - must be true to delete */
  confirm: z.boolean()
    .refine((val) => val === true, {
      message: 'confirm must be true to delete the directory',
    })
    .describe('Confirmation flag - must be true to delete'),

  /** Whether to follow symbolic links */
  follow_symlinks: z.boolean()
    .default(false)
    .describe('Whether to follow symbolic links'),
}).describe('Input for deleting a directory');

export type DirectoryDeleteInput = z.infer<typeof DirectoryDeleteInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for directory delete tool output
 */
export const DirectoryDeleteOutputSchema = z.object({
  /** Absolute path of the deleted directory */
  directory_path: z.string()
    .describe('Absolute path of the deleted directory'),

  /** Whether the deletion was successful */
  success: z.boolean()
    .describe('Whether the deletion was successful'),

  /** Whether recursive deletion was used */
  was_recursive: z.boolean()
    .describe('Whether recursive deletion was used'),

  /** Number of files deleted */
  files_deleted: z.number()
    .int()
    .min(0)
    .describe('Number of files deleted'),

  /** Number of directories deleted */
  directories_deleted: z.number()
    .int()
    .min(0)
    .describe('Number of directories deleted'),

  /** Total size of deleted content */
  total_size: z.number()
    .int()
    .min(0)
    .describe('Total size of deleted content in bytes'),

  /** Time of deletion */
  deleted_at: z.string()
    .describe('Time of deletion (ISO 8601)'),
}).describe('Result of deleting a directory');

export type DirectoryDeleteOutput = z.infer<typeof DirectoryDeleteOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Directory Delete Tool - Delete directories
 * 
 * This tool deletes directories with:
 * - Recursive deletion option
 * - Confirmation requirement
 * - Detailed reporting
 * - Safety checks
 * 
 * @example
 * ```typescript
 * const tool = new DirectoryDeleteTool();
 * const result = await tool.execute({
 *   directory_path: '/path/to/dir',
 *   recursive: true,
 *   confirm: true
 * }, context);
 * ```
 */
export class DirectoryDeleteTool extends Tool {
  /** Tool name */
  public readonly name = 'directory_delete';

  /** Tool description */
  public readonly description = 'Delete directories with recursive option and confirmation requirement';

  /** Detailed documentation */
  public readonly documentation = `
## Directory Delete Tool

Deletes directories with comprehensive options:
- Empty directory deletion
- Recursive directory deletion
- Confirmation requirement
- Detailed deletion reporting

### Input Parameters

- **directory_path** (required): Path to the directory to delete
- **recursive** (optional): Delete recursively (default: false)
- **confirm** (required): Must be true to proceed with deletion
- **follow_symlinks** (optional): Follow symbolic links (default: false)

### Output

Returns detailed information about the deletion:
- directory_path: Absolute path of the deleted directory
- success: Whether deletion was successful
- was_recursive: Whether recursive deletion was used
- files_deleted: Number of files deleted
- directories_deleted: Number of directories deleted
- total_size: Total size of deleted content
- deleted_at: Time of deletion (ISO 8601)

### Examples

Delete empty directory:
\`\`\`json
{
  "directory_path": "/path/to/emptydir",
  "confirm": true
}
\`\`\`

Delete recursively:
\`\`\`json
{
  "directory_path": "/path/to/dir",
  "recursive": true,
  "confirm": true
}
\`\`\`

### Error Handling

- Directory not found: Returns DIRECTORY_NOT_FOUND error
- Confirmation not provided: Returns CONFIRMATION_REQUIRED error
- Directory not empty (non-recursive): Returns DIRECTORY_NOT_EMPTY error
- Path is file: Returns PATH_IS_FILE error
- Permission denied: Returns PERMISSION_DENIED error

### Safety Features

1. **Confirmation Required**: Must explicitly set confirm to true
2. **Recursive Flag**: Must explicitly set recursive for non-empty directories
3. **Type Verification**: Ensures path is a directory
4. **Permanent Deletion**: Content is permanently deleted

### Important Notes

- This tool performs **permanent deletion** - content is not moved to trash
- Deleted content cannot be recovered through this tool
- Use with extreme caution, especially with recursive deletion
- Always verify the directory_path before deletion
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - elevated for delete operations */
  public readonly permissionLevel = PermissionLevel.ELEVATED;

  /** Input schema */
  public readonly inputSchema = DirectoryDeleteInputSchema;

  /** Output schema */
  public readonly outputSchema = DirectoryDeleteOutputSchema;

  /** Tool tags */
  public readonly tags = ['directory', 'delete', 'remove', 'rmdir', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Delete empty directory',
      input: {
        directory_path: '/path/to/emptydir',
        confirm: true,
      },
    },
    {
      description: 'Delete recursively',
      input: {
        directory_path: '/path/to/dir',
        recursive: true,
        confirm: true,
      },
    },
  ];

  /**
   * Execute the directory delete operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as DirectoryDeleteInput;

    try {
      // Resolve the directory path
      const resolvedPath = path.resolve(context.workingDirectory, params.directory_path);

      // Check confirmation
      if (!params.confirm) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'CONFIRMATION_REQUIRED',
            'Deletion not confirmed. Set confirm to true to delete the directory.',
            { 
              suggestion: 'Set confirm: true to proceed with deletion.',
              retryable: true 
            }
          )
        );
      }

      // Check if directory exists
      let stats: { 
        isDirectory: () => boolean; 
        isFile: () => boolean;
        isSymbolicLink: () => boolean;
      };

      try {
        const fsStats = params.follow_symlinks
          ? await fs.stat(resolvedPath)
          : await fs.lstat(resolvedPath);
        
        stats = {
          isDirectory: () => fsStats.isDirectory(),
          isFile: () => fsStats.isFile(),
          isSymbolicLink: () => fsStats.isSymbolicLink(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_NOT_FOUND',
              `Directory not found: ${params.directory_path}`,
              { suggestion: 'Check that the directory path is correct.' }
            )
          );
        }
        throw error;
      }

      // Check if it's a file
      if (stats.isFile()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'PATH_IS_FILE',
            `Path is a file, not a directory: ${params.directory_path}`,
            { suggestion: 'Use file_delete to delete files.' }
          )
        );
      }

      // Validate it's a directory
      if (!stats.isDirectory()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'NOT_A_DIRECTORY',
            `Path is not a directory: ${params.directory_path}`,
            { suggestion: 'Verify the path points to a directory.' }
          )
        );
      }

      // Count contents before deletion
      let filesDeleted = 0;
      let directoriesDeleted = 0;
      let totalSize = 0;

      if (params.recursive) {
        // Count files and directories recursively
        const countContents = async (dirPath: string) => {
          const items = await fs.readdir(dirPath);
          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const itemStats = await fs.lstat(itemPath);
            
            if (itemStats.isDirectory()) {
              await countContents(itemPath);
              directoriesDeleted++;
            } else {
              filesDeleted++;
              totalSize += itemStats.size;
            }
          }
        };

        try {
          await countContents(resolvedPath);
        } catch {
          // Continue even if we can't count some items
        }
        directoriesDeleted++; // Count the root directory
      } else {
        // Check if directory is empty
        const items = await fs.readdir(resolvedPath);
        if (items.length > 0) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_NOT_EMPTY',
              `Directory is not empty: ${params.directory_path}`,
              { 
                suggestion: 'Set recursive to true to delete non-empty directories.',
                retryable: true 
              }
            )
          );
        }
        directoriesDeleted = 1;
      }

      // Delete the directory
      try {
        if (params.recursive) {
          await fs.rm(resolvedPath, { recursive: true, force: false });
        } else {
          await fs.rmdir(resolvedPath);
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        
        if (err.code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied deleting directory: ${params.directory_path}`,
              { suggestion: 'Check directory permissions or run with elevated privileges.' }
            )
          );
        }
        if (err.code === 'ENOTEMPTY') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_NOT_EMPTY',
              `Directory is not empty: ${params.directory_path}`,
              { 
                suggestion: 'Set recursive to true to delete non-empty directories.',
                retryable: true 
              }
            )
          );
        }
        if (err.code === 'EBUSY') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_BUSY',
              `Directory is in use: ${params.directory_path}`,
              { suggestion: 'Close any files or processes using this directory.' }
            )
          );
        }
        throw error;
      }

      // Build output
      const output: DirectoryDeleteOutput = {
        directory_path: resolvedPath,
        success: true,
        was_recursive: params.recursive,
        files_deleted: filesDeleted,
        directories_deleted: directoriesDeleted,
        total_size: totalSize,
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
          filesDeleted,
          directoriesDeleted,
          totalSize,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'DELETE_ERROR',
          `Failed to delete directory: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as DirectoryDeleteInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate directory path doesn't contain null bytes
    if (params.directory_path.includes('\0')) {
      errors.push('Directory path cannot contain null bytes');
    }

    // Validate confirm is true
    if (!params.confirm) {
      errors.push('confirm must be true to delete the directory');
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
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format output for display
   * @param output - Tool output
   * @returns Formatted display string
   */
  private formatOutput(output: DirectoryDeleteOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`🗑️  Deleted directory: ${output.directory_path}`);
    
    if (output.was_recursive) {
      parts.push(`   Files deleted: ${output.files_deleted}`);
      parts.push(`   Directories deleted: ${output.directories_deleted}`);
      parts.push(`   Total size: ${this.formatBytes(output.total_size)}`);
    } else {
      parts.push(`   (empty directory)`);
    }
    
    parts.push(`   Time: ${output.deleted_at}`);
    parts.push('');
    parts.push('⚠️  Note: This directory and its contents have been permanently deleted.');

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
    data: DirectoryDeleteOutput,
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

export default DirectoryDeleteTool;
