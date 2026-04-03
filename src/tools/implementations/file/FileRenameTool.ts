/**
 * @fileoverview File Rename Tool for Claude Code Clone
 * 
 * This tool provides file renaming and moving capabilities with:
 * - Rename files within the same directory
 * - Move files between directories
 * - Overwrite protection
 * - Cross-device move support
 * - Atomic operations where possible
 * - Detailed reporting
 * 
 * @module FileRenameTool
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
 * Schema for file rename tool input
 */
export const FileRenameInputSchema = z.object({
  /** Current path of the file */
  source_path: z.string()
    .min(1, 'Source path cannot be empty')
    .max(4096, 'Source path too long')
    .describe('Current path of the file'),

  /** New path for the file */
  target_path: z.string()
    .min(1, 'Target path cannot be empty')
    .max(4096, 'Target path too long')
    .describe('New path for the file'),

  /** Whether to overwrite if target exists */
  overwrite: z.boolean()
    .default(false)
    .describe('Whether to overwrite if target exists'),

  /** Whether to create parent directories */
  create_parents: z.boolean()
    .default(true)
    .describe('Whether to create parent directories for target'),

  /** Whether to follow symlinks at source */
  follow_symlinks: z.boolean()
    .default(false)
    .describe('Whether to follow symlinks at source'),
}).describe('Input for renaming/moving a file');

export type FileRenameInput = z.infer<typeof FileRenameInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for file rename tool output
 */
export const FileRenameOutputSchema = z.object({
  /** Original file path */
  source_path: z.string()
    .describe('Original file path'),

  /** New file path */
  target_path: z.string()
    .describe('New file path'),

  /** Whether the operation was successful */
  success: z.boolean()
    .describe('Whether the operation was successful'),

  /** Whether this was a rename (same directory) or move (different directory) */
  operation_type: z.enum(['rename', 'move'])
    .describe('Type of operation performed'),

  /** Whether an existing file was overwritten */
  overwritten: z.boolean()
    .describe('Whether an existing file was overwritten'),

  /** Parent directories that were created */
  created_directories: z.array(z.string())
    .describe('Parent directories that were created'),

  /** File size */
  size: z.number()
    .int()
    .min(0)
    .describe('File size in bytes'),
}).describe('Result of renaming/moving a file');

export type FileRenameOutput = z.infer<typeof FileRenameOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * File Rename Tool - Rename/move files
 * 
 * This tool renames or moves files with:
 * - Same-directory rename
 * - Cross-directory move
 * - Overwrite protection
 * - Parent directory creation
 * 
 * @example
 * ```typescript
 * const tool = new FileRenameTool();
 * const result = await tool.execute({
 *   source_path: '/path/to/old.txt',
 *   target_path: '/path/to/new.txt',
 *   overwrite: false
 * }, context);
 * ```
 */
export class FileRenameTool extends Tool {
  /** Tool name */
  public readonly name = 'file_rename';

  /** Tool description */
  public readonly description = 'Rename or move files with overwrite protection and parent directory creation';

  /** Detailed documentation */
  public readonly documentation = `
## File Rename Tool

Renames or moves files with comprehensive options:
- Rename within the same directory
- Move to different directories
- Overwrite protection
- Parent directory creation
- Cross-device move support

### Input Parameters

- **source_path** (required): Current path of the file
- **target_path** (required): New path for the file
- **overwrite** (optional): Overwrite if target exists (default: false)
- **create_parents** (optional): Create parent directories (default: true)
- **follow_symlinks** (optional): Follow symlinks at source (default: false)

### Output

Returns detailed information about the operation:
- source_path: Original file path
- target_path: New file path
- success: Whether operation was successful
- operation_type: 'rename' (same dir) or 'move' (different dir)
- overwritten: Whether an existing file was overwritten
- created_directories: Parent directories that were created
- size: File size in bytes

### Examples

Rename a file:
\`\`\`json
{
  "source_path": "/path/to/old.txt",
  "target_path": "/path/to/new.txt"
}
\`\`\`

Move to different directory:
\`\`\`json
{
  "source_path": "/path/a/file.txt",
  "target_path": "/path/b/file.txt"
}
\`\`\`

Force overwrite:
\`\`\`json
{
  "source_path": "/path/to/source.txt",
  "target_path": "/path/to/target.txt",
  "overwrite": true
}
\`\`\`

### Error Handling

- Source not found: Returns SOURCE_NOT_FOUND error
- Target exists (no overwrite): Returns TARGET_EXISTS error
- Permission denied: Returns PERMISSION_DENIED error
- Source is directory: Returns SOURCE_IS_DIRECTORY error
- Cross-device move failed: Returns CROSS_DEVICE_ERROR

### Safety Features

1. **Overwrite Protection**: Prevents accidental overwrites
2. **Type Verification**: Ensures source is a file
3. **Atomic Operations**: Uses atomic rename when possible
4. **Validation**: Validates paths before operation
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - ask for rename operations */
  public readonly permissionLevel = PermissionLevel.ASK;

  /** Input schema */
  public readonly inputSchema = FileRenameInputSchema;

  /** Output schema */
  public readonly outputSchema = FileRenameOutputSchema;

  /** Tool tags */
  public readonly tags = ['file', 'rename', 'move', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Rename a file',
      input: {
        source_path: '/path/to/old.txt',
        target_path: '/path/to/new.txt',
      },
    },
    {
      description: 'Move to different directory',
      input: {
        source_path: '/path/a/file.txt',
        target_path: '/path/b/file.txt',
      },
    },
    {
      description: 'Force overwrite',
      input: {
        source_path: '/path/to/source.txt',
        target_path: '/path/to/target.txt',
        overwrite: true,
      },
    },
  ];

  /**
   * Execute the file rename operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FileRenameInput;

    try {
      // Resolve paths
      const resolvedSource = path.resolve(context.workingDirectory, params.source_path);
      const resolvedTarget = path.resolve(context.workingDirectory, params.target_path);

      // Check if source and target are the same
      if (resolvedSource === resolvedTarget) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'SAME_PATH',
            'Source and target paths are the same',
            { suggestion: 'Provide different paths for source and target.' }
          )
        );
      }

      // Check if source exists and get stats
      let sourceStats: { 
        size: number; 
        isFile: () => boolean; 
        isDirectory: () => boolean;
        isSymbolicLink: () => boolean;
      };

      try {
        const fsStats = params.follow_symlinks
          ? await fs.stat(resolvedSource)
          : await fs.lstat(resolvedSource);
        
        sourceStats = {
          size: fsStats.size,
          isFile: () => fsStats.isFile(),
          isDirectory: () => fsStats.isDirectory(),
          isSymbolicLink: () => fsStats.isSymbolicLink(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'SOURCE_NOT_FOUND',
              `Source file not found: ${params.source_path}`,
              { suggestion: 'Check that the source file exists.' }
            )
          );
        }
        throw error;
      }

      // Validate source is a file
      if (!sourceStats.isFile() && !sourceStats.isSymbolicLink()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'SOURCE_IS_DIRECTORY',
            `Source is a directory: ${params.source_path}`,
            { suggestion: 'Use directory operations for directories.' }
          )
        );
      }

      // Check if target exists
      let targetExists = false;
      try {
        const targetStats = await fs.stat(resolvedTarget);
        if (targetStats.isFile()) {
          targetExists = true;
        } else if (targetStats.isDirectory()) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'TARGET_IS_DIRECTORY',
              `Target path is a directory: ${params.target_path}`,
              { suggestion: 'Choose a different target path or remove the directory.' }
            )
          );
        }
      } catch {
        // Target doesn't exist, which is fine
      }

      // Check overwrite
      if (targetExists && !params.overwrite) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'TARGET_EXISTS',
            `Target file already exists: ${params.target_path}`,
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
        const parentDir = path.dirname(resolvedTarget);
        try {
          await fs.mkdir(parentDir, { recursive: true });
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
      }

      // Perform the rename/move
      try {
        await fs.rename(resolvedSource, resolvedTarget);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        
        if (err.code === 'EXDEV') {
          // Cross-device move - need to copy and delete
          try {
            await fs.copyFile(resolvedSource, resolvedTarget);
            await fs.unlink(resolvedSource);
          } catch (copyError) {
            // Clean up partial copy if it exists
            try {
              await fs.unlink(resolvedTarget);
            } catch {
              // Ignore cleanup error
            }
            return this.createErrorResult(
              startedAt,
              createToolError(
                'CROSS_DEVICE_ERROR',
                `Cross-device move failed: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
                { suggestion: 'Try using a copy and delete operation manually.' }
              )
            );
          }
        } else if (err.code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied: ${err.message}`,
              { suggestion: 'Check file permissions or run with elevated privileges.' }
            )
          );
        } else {
          throw error;
        }
      }

      // Determine operation type
      const sourceDir = path.dirname(resolvedSource);
      const targetDir = path.dirname(resolvedTarget);
      const operationType = sourceDir === targetDir ? 'rename' : 'move';

      // Build output
      const output: FileRenameOutput = {
        source_path: resolvedSource,
        target_path: resolvedTarget,
        success: true,
        operation_type: operationType,
        overwritten: targetExists,
        created_directories: createdDirectories,
        size: sourceStats.size,
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
          operationType,
          overwritten: targetExists,
          fileSize: sourceStats.size,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'RENAME_ERROR',
          `Failed to rename/move file: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as FileRenameInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate paths don't contain null bytes
    if (params.source_path.includes('\0')) {
      errors.push('Source path cannot contain null bytes');
    }
    if (params.target_path.includes('\0')) {
      errors.push('Target path cannot contain null bytes');
    }

    // Validate source and target are different
    if (params.source_path === params.target_path) {
      errors.push('Source and target paths must be different');
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
  private formatOutput(output: FileRenameOutput): string {
    const parts: string[] = [];

    // Header
    const action = output.operation_type === 'rename' ? 'Renamed' : 'Moved';
    parts.push(`📂 ${action} file`);
    parts.push(`   From: ${output.source_path}`);
    parts.push(`   To: ${output.target_path}`);
    parts.push(`   Size: ${this.formatBytes(output.size)}`);

    if (output.overwritten) {
      parts.push(`   ⚠️  Existing file was overwritten`);
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
    data: FileRenameOutput,
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

export default FileRenameTool;
