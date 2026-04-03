/**
 * @fileoverview Find Tool for Claude Code Clone
 * 
 * This tool provides file finding capabilities with:
 * - Name pattern matching (glob)
 * - File type filtering
 * - Size filtering
 * - Modification time filtering
 * - Depth limiting
 * - Result limiting
 * 
 * @module FindTool
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
 * Schema for find tool input
 */
export const FindInputSchema = z.object({
  /** Directory to search in */
  path: z.string()
    .min(1, 'Path cannot be empty')
    .describe('Directory to search in'),

  /** Pattern for file names (glob) */
  name: z.string()
    .optional()
    .describe('Glob pattern for file names (e.g., "*.ts")'),

  /** Type of entries to find */
  type: z.enum(['file', 'directory', 'any'])
    .default('any')
    .describe('Type of entries to find'),

  /** Find files modified within time (e.g., "1h", "1d", "7d") */
  modified_within: z.string()
    .regex(/^(\d+[smhd])$/, 'Must be in format like "1h", "30m", "7d"')
    .optional()
    .describe('Find files modified within time (e.g., "1h", "1d")'),

  /** Find files larger than size in bytes */
  size_greater: z.number()
    .int()
    .min(0)
    .optional()
    .describe('Find files larger than size in bytes'),

  /** Find files smaller than size in bytes */
  size_less: z.number()
    .int()
    .min(0)
    .optional()
    .describe('Find files smaller than size in bytes'),

  /** Maximum depth to search */
  max_depth: z.number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Maximum depth to search'),

  /** Maximum number of results */
  limit: z.number()
    .int()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Maximum number of results'),

  /** Pattern to exclude (glob) */
  exclude: z.string()
    .optional()
    .describe('Glob pattern to exclude'),
}).describe('Input for finding files');

export type FindInput = z.infer<typeof FindInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for a found file/directory
 */
export const FoundEntrySchema = z.object({
  /** Full path */
  path: z.string()
    .describe('Full path'),

  /** Entry type */
  type: z.enum(['file', 'directory', 'symlink'])
    .describe('Entry type'),

  /** Size in bytes (for files) */
  size: z.number()
    .int()
    .optional()
    .describe('Size in bytes'),

  /** Last modification time */
  modified_at: z.string()
    .optional()
    .describe('Last modification time (ISO 8601)'),

  /** Depth from search root */
  depth: z.number()
    .int()
    .describe('Depth from search root'),
}).describe('Found entry');

export type FoundEntry = z.infer<typeof FoundEntrySchema>;

/**
 * Schema for find tool output
 */
export const FindOutputSchema = z.object({
  /** Search path */
  search_path: z.string()
    .describe('Search path'),

  /** List of found entries */
  entries: z.array(FoundEntrySchema)
    .describe('List of found entries'),

  /** Total number of entries found */
  total: z.number()
    .int()
    .describe('Total number of entries found'),

  /** Number of files found */
  file_count: z.number()
    .int()
    .describe('Number of files found'),

  /** Number of directories found */
  directory_count: z.number()
    .int()
    .describe('Number of directories found'),

  /** Whether results were truncated */
  truncated: z.boolean()
    .describe('Whether results were truncated'),
}).describe('Result of find operation');

export type FindOutput = z.infer<typeof FindOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Find Tool - Find files by pattern
 * 
 * This tool finds files and directories matching specified criteria.
 * 
 * @example
 * ```typescript
 * const tool = new FindTool();
 * const result = await tool.execute({
 *   path: '/path/to/project',
 *   name: '*.ts',
 *   type: 'file',
 *   modified_within: '1d'
 * }, context);
 * ```
 */
export class FindTool extends Tool {
  /** Tool name */
  public readonly name = 'find';

  /** Tool description */
  public readonly description = 'Find files and directories by name pattern, type, size, and modification time';

  /** Detailed documentation */
  public readonly documentation = `
## Find Tool

Finds files and directories matching specified criteria:
- Name pattern matching (glob)
- File type filtering
- Size filtering
- Modification time filtering
- Depth limiting

### Input Parameters

- **path** (required): Directory to search in
- **name** (optional): Glob pattern for file names (e.g., "*.ts")
- **type** (optional): Type to find - 'file', 'directory', 'any' (default: 'any')
- **modified_within** (optional): Modified within time (e.g., "1h", "1d", "7d")
- **size_greater** (optional): Files larger than size in bytes
- **size_less** (optional): Files smaller than size in bytes
- **max_depth** (optional): Maximum search depth
- **limit** (optional): Maximum results (default: 1000)
- **exclude** (optional): Glob pattern to exclude

### Output

Returns found entries:
- search_path: Directory that was searched
- entries: List of matching entries
- total: Total number of entries
- file_count: Number of files
- directory_count: Number of directories
- truncated: Whether results were truncated

### Entry Object

Each entry contains:
- path: Full path to entry
- type: 'file', 'directory', or 'symlink'
- size: File size in bytes (files only)
- modified_at: Last modification time
- depth: Depth from search root

### Examples

Find all TypeScript files:
\`\`\`json
{
  "path": "/path/to/project",
  "name": "*.ts",
  "type": "file"
}
\`\`\`

Find recently modified files:
\`\`\`json
{
  "path": "/path/to/project",
  "modified_within": "1h",
  "type": "file"
}
\`\`\`

Find large files:
\`\`\`json
{
  "path": "/path/to/project",
  "size_greater": 1048576,
  "type": "file"
}
\`\`\`

Find directories:
\`\`\`json
{
  "path": "/path/to/project",
  "type": "directory",
  "max_depth": 3
}
\`\`\`

### Time Format

- s: seconds (e.g., "60s")
- m: minutes (e.g., "30m")
- h: hours (e.g., "1h")
- d: days (e.g., "7d")
  `;

  /** Tool category */
  public readonly category = ToolCategory.SEARCH;

  /** Permission level - auto-approve for search operations */
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;

  /** Input schema */
  public readonly inputSchema = FindInputSchema;

  /** Output schema */
  public readonly outputSchema = FindOutputSchema;

  /** Tool tags */
  public readonly tags = ['search', 'find', 'locate', 'filesystem'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Find TypeScript files',
      input: {
        path: '/path/to/project',
        name: '*.ts',
        type: 'file',
      },
    },
    {
      description: 'Find recently modified files',
      input: {
        path: '/path/to/project',
        modified_within: '1h',
        type: 'file',
      },
    },
    {
      description: 'Find large files',
      input: {
        path: '/path/to/project',
        size_greater: 1048576,
        type: 'file',
      },
    },
  ];

  /**
   * Execute the find operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FindInput;

    try {
      // Resolve search path
      const searchPath = path.resolve(context.workingDirectory, params.path);

      // Check if path exists and is a directory
      const stats = await fs.stat(searchPath);
      if (!stats.isDirectory()) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'NOT_A_DIRECTORY',
            `Path is not a directory: ${params.path}`,
            { suggestion: 'Provide a directory path to search in.' }
          )
        );
      }

      // Parse modified_within
      let modifiedAfter: Date | undefined;
      if (params.modified_within) {
        const match = params.modified_within.match(/^(\d+)([smhd])$/);
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multiplier: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
          };
          modifiedAfter = new Date(Date.now() - value * multiplier[unit]);
        }
      }

      // Collect entries
      const entries: FoundEntry[] = [];
      let truncated = false;

      const searchDirectory = async (dirPath: string, currentDepth: number) => {
        // Check depth limit
        if (params.max_depth !== undefined && currentDepth > params.max_depth) {
          return;
        }

        // Check result limit
        if (entries.length >= params.limit) {
          truncated = true;
          return;
        }

        let items: string[];
        try {
          items = await fs.readdir(dirPath);
        } catch {
          // Skip directories we can't read
          return;
        }

        for (const item of items) {
          // Skip hidden files
          if (item.startsWith('.')) continue;

          // Check exclude pattern
          if (params.exclude && minimatch(item, params.exclude)) continue;

          const itemPath = path.join(dirPath, item);
          
          let itemStats: {
            isFile: () => boolean;
            isDirectory: () => boolean;
            isSymbolicLink: () => boolean;
            size: number;
            mtime: Date;
          };

          try {
            const fsStats = await fs.stat(itemPath);
            itemStats = {
              isFile: () => fsStats.isFile(),
              isDirectory: () => fsStats.isDirectory(),
              isSymbolicLink: () => fsStats.isSymbolicLink(),
              size: fsStats.size,
              mtime: fsStats.mtime,
            };
          } catch {
            continue;
          }

          // Determine type
          let entryType: 'file' | 'directory' | 'symlink';
          if (itemStats.isSymbolicLink()) {
            entryType = 'symlink';
          } else if (itemStats.isDirectory()) {
            entryType = 'directory';
          } else {
            entryType = 'file';
          }

          // Check type filter
          if (params.type !== 'any') {
            if (params.type === 'file' && entryType !== 'file') continue;
            if (params.type === 'directory' && entryType !== 'directory') continue;
          }

          // Check name pattern
          if (params.name && !minimatch(item, params.name)) {
            // Also try matching against full path for ** patterns
            if (!minimatch(itemPath, params.name)) {
              // Recurse into directories even if they don't match
              if (entryType === 'directory') {
                await searchDirectory(itemPath, currentDepth + 1);
              }
              continue;
            }
          }

          // Check size filters (files only)
          if (entryType === 'file') {
            if (params.size_greater !== undefined && itemStats.size <= params.size_greater) continue;
            if (params.size_less !== undefined && itemStats.size >= params.size_less) continue;
          }

          // Check modification time
          if (modifiedAfter && itemStats.mtime < modifiedAfter) continue;

          // Create entry
          const entry: FoundEntry = {
            path: itemPath,
            type: entryType,
            depth: currentDepth,
          };

          if (entryType === 'file') {
            entry.size = itemStats.size;
          }
          entry.modified_at = itemStats.mtime.toISOString();

          entries.push(entry);

          // Check limit again
          if (entries.length >= params.limit) {
            truncated = true;
            return;
          }

          // Recurse into directories
          if (entryType === 'directory') {
            await searchDirectory(itemPath, currentDepth + 1);
          }
        }
      };

      await searchDirectory(searchPath, 0);

      // Count by type
      const fileCount = entries.filter(e => e.type === 'file').length;
      const directoryCount = entries.filter(e => e.type === 'directory').length;

      // Build output
      const output: FindOutput = {
        search_path: searchPath,
        entries,
        total: entries.length,
        file_count: fileCount,
        directory_count: directoryCount,
        truncated,
      };

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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'PATH_NOT_FOUND',
            `Path not found: ${(input as FindInput).path}`,
            { suggestion: 'Check that the path exists.' }
          )
        );
      }

      return this.createErrorResult(
        startedAt,
        createToolError(
          'FIND_ERROR',
          `Find operation failed: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as FindInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate size filters
    if (params.size_greater !== undefined && params.size_less !== undefined) {
      if (params.size_greater >= params.size_less) {
        errors.push('size_greater must be less than size_less');
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
   * @returns Formatted display string
   */
  private formatOutput(output: FindOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`🔍 Find in: ${output.search_path}`);
    parts.push(`   Found: ${output.total} entries (${output.file_count} files, ${output.directory_count} directories)`);
    if (output.truncated) {
      parts.push('   ⚠️  Results truncated');
    }
    parts.push('');

    // Entries
    if (output.entries.length === 0) {
      parts.push('No entries found.');
    } else {
      for (const entry of output.entries) {
        const icon = entry.type === 'directory' ? '📂' : entry.type === 'symlink' ? '🔗' : '📄';
        const size = entry.size !== undefined ? ` (${this.formatBytes(entry.size)})` : '';
        parts.push(`${icon} ${entry.path}${size}`);
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
    data: FindOutput,
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

export default FindTool;
