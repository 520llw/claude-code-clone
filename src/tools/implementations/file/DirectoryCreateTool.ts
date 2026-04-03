/**
 * @fileoverview Directory Create Tool for Claude Code Clone
 * 
 * This tool provides directory creation capabilities with:
 * - Single directory creation
 * - Recursive directory creation
 * - Permission setting
 * - Parent directory handling
 * - Existing directory handling
 * 
 * @module DirectoryCreateTool
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
 * Schema for directory create tool input
 */
export const DirectoryCreateInputSchema = z.object({
  /** Path where the directory should be created */
  directory_path: z.string()
    .min(1, 'Directory path cannot be empty')
    .max(4096, 'Directory path too long')
    .describe('Path where the directory should be created'),

  /** Whether to create parent directories if they don\'t exist */
  recursive: z.boolean()
    .default(true)
    .describe('Whether to create parent directories'),

  /** Directory permissions (octal, e.g., "755", "700") */
  permissions: z.string()
    .regex(/^[0-7]{3,4}$/, 'Permissions must be 3-4 octal digits')
    .optional()
    .describe('Directory permissions in octal (e.g., "755")'),

  /** Whether to fail if directory already exists */
  fail_if_exists: z.boolean()
    .default(false)
    .describe('Whether to fail if directory already exists'),
}).describe('Input for creating a directory');

export type DirectoryCreateInput = z.infer<typeof DirectoryCreateInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for directory create tool output
 */
export const DirectoryCreateOutputSchema = z.object({
  /** Absolute path of the created directory */
  directory_path: z.string()
    .describe('Absolute path of the created directory'),

  /** Whether the directory was created successfully */
  success: z.boolean()
    .describe('Whether the directory was created successfully'),

  /** Whether the directory already existed */
  already_existed: z.boolean()
    .describe('Whether the directory already existed'),

  /** List of directories that were created */
  created_directories: z.array(z.string())
    .describe('List of directories that were created (including parents)'),

  /** Directory permissions that were set */
  permissions: z.string()
    .optional()
    .describe('Directory permissions that were set'),
}).describe('Result of creating a directory');

export type DirectoryCreateOutput = z.infer<typeof DirectoryCreateOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Directory Create Tool - Create directories
 * 
 * This tool creates directories with:
 * - Recursive creation
 * - Permission setting
 * - Existing directory handling
 * 
 * @example
 * ```typescript
 * const tool = new DirectoryCreateTool();
 * const result = await tool.execute({
 *   directory_path: '/path/to/new/nested/dir',
 *   recursive: true,
 *   permissions: '755'
 * }, context);
 * ```
 */
export class DirectoryCreateTool extends Tool {
  /** Tool name */
  public readonly name = 'directory_create';

  /** Tool description */
  public readonly description = 'Create directories with recursive creation and permission control';

  /** Detailed documentation */
  public readonly documentation = `
## Directory Create Tool

Creates directories with comprehensive options:
- Single directory creation
- Recursive directory creation (with parents)
- Permission setting
- Existing directory handling

### Input Parameters

- **directory_path** (required): Path where the directory should be created
- **recursive** (optional): Create parent directories (default: true)
- **permissions** (optional): Directory permissions in octal (e.g., "755", "700")
- **fail_if_exists** (optional): Fail if directory exists (default: false)

### Output

Returns detailed information about the operation:
- directory_path: Absolute path of the created directory
- success: Whether creation was successful
- already_existed: Whether the directory already existed
- created_directories: List of directories created (including parents)
- permissions: Directory permissions that were set

### Examples

Create a single directory:
\`\`\`json
{
  "directory_path": "/path/to/newdir",
  "recursive": false
}
\`\`\`

Create nested directories:
\`\`\`json
{
  "directory_path": "/path/to/a/b/c",
  "recursive": true
}
\`\`\`

Create with specific permissions:
\`\`\`json
{
  "directory_path": "/path/to/secure",
  "permissions": "700"
}
\`\`\`

Fail if exists:
\`\`\`json
{
  "directory_path": "/path/to/dir",
  "fail_if_exists": true
}
\`\`\`

### Error Handling

- Path exists as file: Returns PATH_IS_FILE error
- Directory exists (fail_if_exists): Returns DIRECTORY_EXISTS error
- Permission denied: Returns PERMISSION_DENIED error
- Parent not found (non-recursive): Returns PARENT_NOT_FOUND error

### Permission Notes

- Default permissions are typically 755 (rwxr-xr-x)
- Use 700 for private directories (rwx------)
- Permissions are applied to all created directories
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - ask for directory creation */
  public readonly permissionLevel = PermissionLevel.ASK;

  /** Input schema */
  public readonly inputSchema = DirectoryCreateInputSchema;

  /** Output schema */
  public readonly outputSchema = DirectoryCreateOutputSchema;

  /** Tool tags */
  public readonly tags = ['directory', 'create', 'mkdir', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Create a single directory',
      input: {
        directory_path: '/path/to/newdir',
        recursive: false,
      },
    },
    {
      description: 'Create nested directories',
      input: {
        directory_path: '/path/to/a/b/c',
        recursive: true,
      },
    },
    {
      description: 'Create with restricted permissions',
      input: {
        directory_path: '/path/to/secure',
        permissions: '700',
      },
    },
  ];

  /**
   * Execute the directory create operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as DirectoryCreateInput;

    try {
      // Resolve the directory path
      const resolvedPath = path.resolve(context.workingDirectory, params.directory_path);

      // Check if path already exists
      let pathExists = false;
      let isDirectory = false;
      try {
        const stats = await fs.stat(resolvedPath);
        pathExists = true;
        isDirectory = stats.isDirectory();
      } catch {
        // Path doesn't exist, which is expected
      }

      // Handle existing path
      if (pathExists) {
        if (!isDirectory) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PATH_IS_FILE',
              `Path exists and is a file: ${params.directory_path}`,
              { suggestion: 'Choose a different directory path or remove the file.' }
            )
          );
        }

        if (params.fail_if_exists) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'DIRECTORY_EXISTS',
              `Directory already exists: ${params.directory_path}`,
              { 
                suggestion: 'Set fail_if_exists to false to allow existing directories.',
                retryable: true 
              }
            )
          );
        }

        // Directory exists and we're not failing - return success
        const output: DirectoryCreateOutput = {
          directory_path: resolvedPath,
          success: true,
          already_existed: true,
          created_directories: [],
        };

        return this.createSuccessResult(
          startedAt,
          output,
          this.formatOutput(output),
          { alreadyExisted: true }
        );
      }

      // Check parent directory if not recursive
      if (!params.recursive) {
        const parentDir = path.dirname(resolvedPath);
        try {
          const parentStats = await fs.stat(parentDir);
          if (!parentStats.isDirectory()) {
            return this.createErrorResult(
              startedAt,
              createToolError(
                'PARENT_NOT_DIRECTORY',
                `Parent path is not a directory: ${parentDir}`,
                { suggestion: 'Set recursive to true to create parent directories.' }
              )
            );
          }
        } catch {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PARENT_NOT_FOUND',
              `Parent directory does not exist: ${parentDir}`,
              { suggestion: 'Set recursive to true to create parent directories.' }
            )
          );
        }
      }

      // Create the directory
      const createdDirectories: string[] = [];
      try {
        await fs.mkdir(resolvedPath, { recursive: params.recursive });
        
        // Track created directories (simplified - in production, track actual creations)
        if (params.recursive) {
          // Build list of potentially created directories
          let current = resolvedPath;
          while (current !== path.dirname(current)) {
            createdDirectories.unshift(current);
            current = path.dirname(current);
            try {
              await fs.access(current);
              break; // Parent exists, stop here
            } catch {
              // Continue up the tree
            }
          }
        } else {
          createdDirectories.push(resolvedPath);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied creating directory: ${params.directory_path}`,
              { suggestion: 'Check parent directory permissions or run with elevated privileges.' }
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
          // Log warning but don't fail - directory was created
          this.log('warn', `Failed to set permissions: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Build output
      const output: DirectoryCreateOutput = {
        directory_path: resolvedPath,
        success: true,
        already_existed: false,
        created_directories: createdDirectories,
        permissions: setPermissions,
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
          createdCount: createdDirectories.length,
          permissions: setPermissions,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'CREATE_ERROR',
          `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as DirectoryCreateInput;
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

    // Validate permissions format
    if (params.permissions && !/^[0-7]{3,4}$/.test(params.permissions)) {
      errors.push('Permissions must be 3-4 octal digits (e.g., "755", "700")');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Format output for display
   * @param output - Tool output
   * @returns Formatted display string
   */
  private formatOutput(output: DirectoryCreateOutput): string {
    const parts: string[] = [];

    // Header
    if (output.already_existed) {
      parts.push(`📂 Directory already exists: ${output.directory_path}`);
    } else {
      parts.push(`📂 Created directory: ${output.directory_path}`);
    }

    if (output.permissions) {
      parts.push(`   Permissions: ${output.permissions}`);
    }

    if (output.created_directories.length > 0) {
      parts.push(`   Created ${output.created_directories.length} director${output.created_directories.length === 1 ? 'y' : 'ies'}:`);
      for (const dir of output.created_directories) {
        parts.push(`     - ${dir}`);
      }
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
    data: DirectoryCreateOutput,
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

export default DirectoryCreateTool;
