/**
 * @fileoverview Directory List Tool for Claude Code Clone
 * 
 * This tool provides comprehensive directory listing capabilities with:
 * - Recursive listing
 * - Pattern filtering
 * - Hidden file handling
 * - File type filtering
 * - Sorting options
 * - Size and date information
 * 
 * @module DirectoryListTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

/**
 * Schema for directory list tool input
 */
export const DirectoryListInputSchema = z.object({
  /** Path to the directory to list */
  directory_path: z.string()
    .min(1, 'Directory path cannot be empty')
    .max(4096, 'Directory path too long')
    .describe('Path to the directory to list'),

  /** Whether to list recursively */
  recursive: z.boolean()
    .default(false)
    .describe('Whether to list recursively'),

  /** Whether to include hidden files */
  include_hidden: z.boolean()
    .default(false)
    .describe('Whether to include hidden files (starting with .)'),

  /** Pattern to filter files (glob pattern) */
  pattern: z.string()
    .optional()
    .describe('Glob pattern to filter files (e.g., "*.ts", "**/*.json")'),

  /** Maximum depth for recursive listing */
  max_depth: z.number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Maximum depth for recursive listing'),

  /** Maximum number of entries to return */
  limit: z.number()
    .int()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Maximum number of entries to return'),

  /** Sort by field */
  sort_by: z.enum(['name', 'size', 'modified', 'type'])
    .default('name')
    .describe('Field to sort by'),

  /** Sort order */
  sort_order: z.enum(['asc', 'desc'])
    .default('asc')
    .describe('Sort order'),
}).describe('Input for listing a directory');

export type DirectoryListInput = z.infer<typeof DirectoryListInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for a directory entry
 */
export const DirectoryEntrySchema = z.object({
  /** Entry name */
  name: z.string()
    .describe('Entry name'),

  /** Full path */
  path: z.string()
    .describe('Full path'),

  /** Relative path from the listed directory */
  relative_path: z.string()
    .describe('Relative path from the listed directory'),

  /** Entry type */
  type: z.enum(['file', 'directory', 'symlink', 'other'])
    .describe('Entry type'),

  /** Size in bytes (for files) */
  size: z.number()
    .int()
    .min(0)
    .optional()
    .describe('Size in bytes (for files)'),

  /** Last modification time */
  modified_at: z.string()
    .optional()
    .describe('Last modification time (ISO 8601)'),

  /** Creation time */
  created_at: z.string()
    .optional()
    .describe('Creation time (ISO 8601)'),

  /** File permissions */
  permissions: z.string()
    .optional()
    .describe('File permissions (e.g., "644")'),

  /** Depth level (for recursive listing) */
  depth: z.number()
    .int()
    .min(0)
    .describe('Depth level from root'),
}).describe('Directory entry');

export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;

/**
 * Schema for directory list tool output
 */
export const DirectoryListOutputSchema = z.object({
  /** Absolute path of the listed directory */
  directory_path: z.string()
    .describe('Absolute path of the listed directory'),

  /** List of entries */
  entries: z.array(DirectoryEntrySchema)
    .describe('List of entries'),

  /** Total number of entries */
  total: z.number()
    .int()
    .min(0)
    .describe('Total number of entries'),

  /** Number of files */
  file_count: z.number()
    .int()
    .min(0)
    .describe('Number of files'),

  /** Number of directories */
  directory_count: z.number()
    .int()
    .min(0)
    .describe('Number of directories'),

  /** Number of symlinks */
  symlink_count: z.number()
    .int()
    .min(0)
    .describe('Number of symlinks'),

  /** Total size of all files */
  total_size: z.number()
    .int()
    .min(0)
    .describe('Total size of all files in bytes'),

  /** Whether results were truncated */
  truncated: z.boolean()
    .describe('Whether results were truncated due to limit'),
}).describe('Result of listing a directory');

export type DirectoryListOutput = z.infer<typeof DirectoryListOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Directory List Tool - List directory contents
 * 
 * This tool lists directory contents with:
 * - Recursive listing
 * - Pattern filtering
 * - Hidden file handling
 * - Sorting options
 * 
 * @example
 * ```typescript
 * const tool = new DirectoryListTool();
 * const result = await tool.execute({
 *   directory_path: '/path/to/dir',
 *   recursive: true,
 *   pattern: '*.ts',
 *   include_hidden: false
 * }, context);
 * ```
 */
export class DirectoryListTool extends Tool {
  /** Tool name */
  public readonly name = 'directory_list';

  /** Tool description */
  public readonly description = 'List directory contents with recursive, filtering, and sorting options';

  /** Detailed documentation */
  public readonly documentation = `
## Directory List Tool

Lists directory contents with comprehensive options:
- Recursive listing
- Pattern filtering (glob patterns)
- Hidden file handling
- File type filtering
- Sorting by name, size, date, or type
- Detailed file information

### Input Parameters

- **directory_path** (required): Path to the directory to list
- **recursive** (optional): List recursively (default: false)
- **include_hidden** (optional): Include hidden files (default: false)
- **pattern** (optional): Glob pattern to filter files (e.g., "*.ts")
- **max_depth** (optional): Maximum depth for recursive listing
- **limit** (optional): Maximum entries to return (default: 1000)
- **sort_by** (optional): Sort by 'name', 'size', 'modified', 'type' (default: 'name')
- **sort_order** (optional): Sort order 'asc' or 'desc' (default: 'asc')

### Output

Returns detailed directory listing:
- directory_path: Absolute path of the listed directory
- entries: List of directory entries with metadata
- total: Total number of entries
- file_count: Number of files
- directory_count: Number of directories
- symlink_count: Number of symlinks
- total_size: Total size of all files
- truncated: Whether results were truncated

### Examples

Basic listing:
\`\`\`json
{
  "directory_path": "/path/to/dir"
}
\`\`\`

Recursive with pattern:
\`\`\`json
{
  "directory_path": "/path/to/project",
  "recursive": true,
  "pattern": "*.ts",
  "include_hidden": false
}
\`\`\`

Sorted by size:
\`\`\`json
{
  "directory_path": "/path/to/dir",
  "sort_by": "size",
  "sort_order": "desc"
}
\`\`\`

### Error Handling

- Directory not found: Returns DIRECTORY_NOT_FOUND error
- Path is file: Returns PATH_IS_FILE error
- Permission denied: Returns PERMISSION_DENIED error
- Max depth exceeded: Results are truncated

### Entry Types

- **file**: Regular file
- **directory**: Directory
- **symlink**: Symbolic link
- **other**: Other special files
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - auto-approve for list operations */
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;

  /** Input schema */
  public readonly inputSchema = DirectoryListInputSchema;

  /** Output schema */
  public readonly outputSchema = DirectoryListOutputSchema;

  /** Tool tags */
  public readonly tags = ['directory', 'list', 'filesystem', 'explore'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Basic directory listing',
      input: {
        directory_path: '/path/to/dir',
      },
    },
    {
      description: 'Recursive TypeScript files',
      input: {
        directory_path: '/path/to/project',
        recursive: true,
        pattern: '*.ts',
      },
    },
    {
      description: 'Sorted by size descending',
      input: {
        directory_path: '/path/to/dir',
        sort_by: 'size',
        sort_order: 'desc',
      },
    },
  ];

  /**
   * Execute the directory list operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as DirectoryListInput;

    try {
      // Resolve the directory path
      const resolvedPath = path.resolve(context.workingDirectory, params.directory_path);

      // Check if directory exists and is a directory
      let stats: { isDirectory: () => boolean; isFile: () => boolean };
      try {
        const fsStats = await fs.stat(resolvedPath);
        stats = {
          isDirectory: () => fsStats.isDirectory(),
          isFile: () => fsStats.isFile(),
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

      if (stats.isFile()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'PATH_IS_FILE',
            `Path is a file, not a directory: ${params.directory_path}`,
            { suggestion: 'Use file_read to read file contents.' }
          )
        );
      }

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

      // Collect entries
      const entries: DirectoryEntry[] = [];
      let fileCount = 0;
      let directoryCount = 0;
      let symlinkCount = 0;
      let totalSize = 0;
      let truncated = false;

      // Recursive listing function
      const listDirectory = async (dirPath: string, relativePath: string, depth: number) => {
        // Check max depth
        if (params.max_depth !== undefined && depth > params.max_depth) {
          return;
        }

        // Check limit
        if (entries.length >= params.limit) {
          truncated = true;
          return;
        }

        let items: string[];
        try {
          items = await fs.readdir(dirPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EACCES') {
            // Skip directories we can't read
            return;
          }
          throw error;
        }

        // Sort items
        items.sort();

        for (const item of items) {
          // Check limit
          if (entries.length >= params.limit) {
            truncated = true;
            return;
          }

          // Skip hidden files if not included
          if (!params.include_hidden && item.startsWith('.')) {
            continue;
          }

          const itemPath = path.join(dirPath, item);
          const itemRelativePath = path.join(relativePath, item);

          let itemStats: {
            isFile: () => boolean;
            isDirectory: () => boolean;
            isSymbolicLink: () => boolean;
            size: number;
            mtime: Date;
            birthtime: Date;
            mode: number;
          };

          try {
            const fsStats = await fs.lstat(itemPath);
            itemStats = {
              isFile: () => fsStats.isFile(),
              isDirectory: () => fsStats.isDirectory(),
              isSymbolicLink: () => fsStats.isSymbolicLink(),
              size: fsStats.size,
              mtime: fsStats.mtime,
              birthtime: fsStats.birthtime,
              mode: fsStats.mode,
            };
          } catch {
            // Skip items we can't stat
            continue;
          }

          // Determine entry type
          let entryType: 'file' | 'directory' | 'symlink' | 'other';
          if (itemStats.isSymbolicLink()) {
            entryType = 'symlink';
            symlinkCount++;
          } else if (itemStats.isDirectory()) {
            entryType = 'directory';
            directoryCount++;
          } else if (itemStats.isFile()) {
            entryType = 'file';
            fileCount++;
            totalSize += itemStats.size;
          } else {
            entryType = 'other';
          }

          // Check pattern filter (only for files)
          if (params.pattern && entryType === 'file') {
            if (!minimatch(item, params.pattern) && !minimatch(itemRelativePath, params.pattern)) {
              continue;
            }
          }

          // Create entry
          const entry: DirectoryEntry = {
            name: item,
            path: itemPath,
            relative_path: itemRelativePath,
            type: entryType,
            depth,
          };

          // Add optional fields
          if (entryType === 'file') {
            entry.size = itemStats.size;
          }
          entry.modified_at = itemStats.mtime.toISOString();
          entry.created_at = itemStats.birthtime.toISOString();
          entry.permissions = (itemStats.mode & 0o777).toString(8).padStart(3, '0');

          entries.push(entry);

          // Recurse into directories
          if (entryType === 'directory' && params.recursive) {
            await listDirectory(itemPath, itemRelativePath, depth + 1);
          }
        }
      };

      // Start listing
      await listDirectory(resolvedPath, '', 0);

      // Sort entries
      entries.sort((a, b) => {
        let comparison = 0;
        switch (params.sort_by) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case 'modified':
            comparison = new Date(a.modified_at || 0).getTime() - new Date(b.modified_at || 0).getTime();
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
        }
        return params.sort_order === 'desc' ? -comparison : comparison;
      });

      // Build output
      const output: DirectoryListOutput = {
        directory_path: resolvedPath,
        entries,
        total: entries.length,
        file_count: fileCount,
        directory_count: directoryCount,
        symlink_count: symlinkCount,
        total_size: totalSize,
        truncated,
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
          totalEntries: entries.length,
          fileCount,
          directoryCount,
          truncated,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'LIST_ERROR',
          `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as DirectoryListInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate limit
    if (params.limit < 1 || params.limit > 10000) {
      errors.push('Limit must be between 1 and 10000');
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
  private formatOutput(output: DirectoryListOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`📁 ${output.directory_path}`);
    parts.push(`   Entries: ${output.total} | Files: ${output.file_count} | Directories: ${output.directory_count} | Symlinks: ${output.symlink_count}`);
    parts.push(`   Total size: ${this.formatBytes(output.total_size)}`);
    if (output.truncated) {
      parts.push(`   ⚠️  Results truncated - showing first ${output.total} entries`);
    }
    parts.push('');

    // Entries
    if (output.entries.length === 0) {
      parts.push('(empty directory)');
    } else {
      for (const entry of output.entries) {
        const icon = entry.type === 'directory' ? '📂' : entry.type === 'symlink' ? '🔗' : '📄';
        const size = entry.size !== undefined ? ` (${this.formatBytes(entry.size)})` : '';
        const indent = '  '.repeat(entry.depth);
        parts.push(`${indent}${icon} ${entry.name}${size}`);
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
    data: DirectoryListOutput,
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

export default DirectoryListTool;
