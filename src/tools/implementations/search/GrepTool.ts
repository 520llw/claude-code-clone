/**
 * @fileoverview Grep Tool for Claude Code Clone
 * 
 * This tool provides regex-based file search capabilities with:
 * - Pattern matching with regular expressions
 * - Context line display
 * - File filtering (include/exclude patterns)
 * - Case sensitivity options
 * - Whole word matching
 * - Multi-file search
 * 
 * @module GrepTool
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
 * Schema for grep tool input
 */
export const GrepInputSchema = z.object({
  /** Regular expression pattern to search for */
  pattern: z.string()
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
    .describe('Regular expression pattern to search for'),

  /** Directory or file to search in */
  path: z.string()
    .optional()
    .describe('Directory or file to search in (default: working directory)'),

  /** Pattern for files to include (glob) */
  include: z.string()
    .optional()
    .describe('Glob pattern for files to include (e.g., "*.ts")'),

  /** Pattern for files to exclude (glob) */
  exclude: z.string()
    .optional()
    .describe('Glob pattern for files to exclude (e.g., "node_modules/**")'),

  /** Whether search is case-sensitive */
  case_sensitive: z.boolean()
    .default(false)
    .describe('Whether search is case-sensitive'),

  /** Whether to match whole words only */
  whole_word: z.boolean()
    .default(false)
    .describe('Whether to match whole words only'),

  /** Number of context lines to show before/after matches */
  context_lines: z.number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe('Number of context lines to show'),

  /** Maximum number of matches to return */
  max_matches: z.number()
    .int()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Maximum number of matches to return'),

  /** Maximum file size to search (in bytes) */
  max_file_size: z.number()
    .int()
    .min(1024)
    .default(10 * 1024 * 1024)
    .describe('Maximum file size to search in bytes'),
}).describe('Input for grep search');

export type GrepInput = z.infer<typeof GrepInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for a single match
 */
export const GrepMatchSchema = z.object({
  /** Path to the file containing the match */
  file_path: z.string()
    .describe('Path to the file containing the match'),

  /** Line number of the match (1-based) */
  line_number: z.number()
    .int()
    .min(1)
    .describe('Line number of the match (1-based)'),

  /** Column number of the match (1-based) */
  column: z.number()
    .int()
    .min(1)
    .describe('Column number of the match (1-based)'),

  /** The matched text */
  match: z.string()
    .describe('The matched text'),

  /** The full line containing the match */
  line: z.string()
    .describe('The full line containing the match'),

  /** Lines before the match (context) */
  context_before: z.array(z.string())
    .describe('Lines before the match'),

  /** Lines after the match (context) */
  context_after: z.array(z.string())
    .describe('Lines after the match'),
}).describe('A grep match');

export type GrepMatch = z.infer<typeof GrepMatchSchema>;

/**
 * Schema for grep tool output
 */
export const GrepOutputSchema = z.object({
  /** Search pattern used */
  pattern: z.string()
    .describe('Search pattern used'),

  /** List of matches */
  matches: z.array(GrepMatchSchema)
    .describe('List of matches'),

  /** Total number of files searched */
  files_searched: z.number()
    .int()
    .min(0)
    .describe('Total number of files searched'),

  /** Total number of matches found */
  total_matches: z.number()
    .int()
    .min(0)
    .describe('Total number of matches found'),

  /** Whether results were truncated */
  truncated: z.boolean()
    .describe('Whether results were truncated due to max_matches'),
}).describe('Result of grep search');

export type GrepOutput = z.infer<typeof GrepOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Grep Tool - Regex search in files
 * 
 * This tool searches for patterns in files using regular expressions.
 * 
 * @example
 * ```typescript
 * const tool = new GrepTool();
 * const result = await tool.execute({
 *   pattern: 'function\\s+\\w+',
 *   path: '/path/to/project',
 *   include: '*.ts',
 *   context_lines: 3
 * }, context);
 * ```
 */
export class GrepTool extends Tool {
  /** Tool name */
  public readonly name = 'grep';

  /** Tool description */
  public readonly description = 'Search for patterns in files using regular expressions';

  /** Detailed documentation */
  public readonly documentation = `
## Grep Tool

Searches for patterns in files using regular expressions with:
- Multi-file search
- Context line display
- File filtering
- Case sensitivity options
- Whole word matching

### Input Parameters

- **pattern** (required): Regular expression pattern to search for
- **path** (optional): Directory or file to search (default: working directory)
- **include** (optional): Glob pattern for files to include
- **exclude** (optional): Glob pattern for files to exclude
- **case_sensitive** (optional): Case-sensitive search (default: false)
- **whole_word** (optional): Match whole words only (default: false)
- **context_lines** (optional): Context lines to show (default: 2)
- **max_matches** (optional): Maximum matches to return (default: 1000)
- **max_file_size** (optional): Maximum file size to search (default: 10MB)

### Output

Returns search results:
- pattern: Search pattern used
- matches: List of matches with context
- files_searched: Number of files searched
- total_matches: Total number of matches
- truncated: Whether results were truncated

### Match Object

Each match contains:
- file_path: File containing the match
- line_number: Line number (1-based)
- column: Column number (1-based)
- match: The matched text
- line: Full line containing match
- context_before: Lines before match
- context_after: Lines after match

### Examples

Search for function definitions:
\`\`\`json
{
  "pattern": "function\\s+\\w+",
  "path": "/path/to/project",
  "include": "*.ts"
}
\`\`\`

Case-sensitive search:
\`\`\`json
{
  "pattern": "TODO",
  "case_sensitive": true
}
\`\`\`

Whole word search:
\`\`\`json
{
  "pattern": "class",
  "whole_word": true,
  "context_lines": 5
}
\`\`\`

### Regex Tips

- Use \\\\s for whitespace
- Use \\\\w for word characters
- Use .* for any characters
- Use ^ and $ for line start/end
- Use () for capture groups
  `;

  /** Tool category */
  public readonly category = ToolCategory.SEARCH;

  /** Permission level - auto-approve for search operations */
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;

  /** Input schema */
  public readonly inputSchema = GrepInputSchema;

  /** Output schema */
  public readonly outputSchema = GrepOutputSchema;

  /** Tool tags */
  public readonly tags = ['search', 'grep', 'regex', 'find', 'pattern'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Search for function definitions',
      input: {
        pattern: 'function\\s+\\w+',
        include: '*.ts',
      },
    },
    {
      description: 'Case-sensitive TODO search',
      input: {
        pattern: 'TODO',
        case_sensitive: true,
      },
    },
    {
      description: 'Whole word search with context',
      input: {
        pattern: 'class',
        whole_word: true,
        context_lines: 5,
      },
    },
  ];

  /**
   * Execute the grep search
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as GrepInput;

    try {
      // Resolve search path
      const searchPath = params.path 
        ? path.resolve(context.workingDirectory, params.path)
        : context.workingDirectory;

      // Compile regex pattern
      const flags = params.case_sensitive ? 'g' : 'gi';
      let patternStr = params.pattern;
      
      if (params.whole_word) {
        patternStr = `\\b${patternStr}\\b`;
      }
      
      const regex = new RegExp(patternStr, flags);

      // Collect files to search
      const filesToSearch: string[] = [];
      
      const stats = await fs.stat(searchPath);
      if (stats.isFile()) {
        filesToSearch.push(searchPath);
      } else if (stats.isDirectory()) {
        await this.collectFiles(searchPath, filesToSearch, params);
      }

      // Search files
      const matches: GrepMatch[] = [];
      let truncated = false;

      for (const filePath of filesToSearch) {
        if (matches.length >= params.max_matches) {
          truncated = true;
          break;
        }

        try {
          const fileMatches = await this.searchFile(filePath, regex, params);
          matches.push(...fileMatches);
        } catch (error) {
          // Skip files we can't read
          this.log('warn', `Could not search file ${filePath}: ${error}`);
        }
      }

      // Trim matches if over limit
      if (matches.length > params.max_matches) {
        matches.length = params.max_matches;
        truncated = true;
      }

      // Build output
      const output: GrepOutput = {
        pattern: params.pattern,
        matches,
        files_searched: filesToSearch.length,
        total_matches: matches.length,
        truncated,
      };

      // Create display output
      const displayOutput = this.formatOutput(output);

      return this.createSuccessResult(
        startedAt,
        output,
        displayOutput,
        {
          filesSearched: filesToSearch.length,
          totalMatches: matches.length,
          truncated,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'SEARCH_ERROR',
          `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          { retryable: true }
        )
      );
    }
  }

  /**
   * Collect files to search recursively
   * @param dirPath - Directory to search
   * @param files - Array to collect files
   * @param params - Search parameters
   */
  private async collectFiles(
    dirPath: string,
    files: string[],
    params: GrepInput
  ): Promise<void> {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      // Skip hidden files/directories
      if (item.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        // Check exclude pattern
        if (params.exclude && minimatch(item, params.exclude)) continue;
        
        await this.collectFiles(itemPath, files, params);
      } else if (stats.isFile()) {
        // Check file size
        if (stats.size > params.max_file_size) continue;

        // Check include pattern
        if (params.include && !minimatch(item, params.include)) continue;

        // Check exclude pattern
        if (params.exclude && minimatch(item, params.exclude)) continue;

        files.push(itemPath);
      }
    }
  }

  /**
   * Search a single file for matches
   * @param filePath - File to search
   * @param regex - Regex pattern
   * @param params - Search parameters
   * @returns Array of matches
   */
  private async searchFile(
    filePath: string,
    regex: RegExp,
    params: GrepInput
  ): Promise<GrepMatch[]> {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches: GrepMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      regex.lastIndex = 0; // Reset regex
      
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        // Get context lines
        const contextStart = Math.max(0, i - params.context_lines);
        const contextEnd = Math.min(lines.length, i + params.context_lines + 1);
        
        const contextBefore = lines.slice(contextStart, i);
        const contextAfter = lines.slice(i + 1, contextEnd);

        matches.push({
          file_path: filePath,
          line_number: i + 1,
          column: match.index + 1,
          match: match[0],
          line,
          context_before: contextBefore,
          context_after: contextAfter,
        });

        // Prevent infinite loop on zero-length matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    }

    return matches;
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
    const params = input as GrepInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate pattern is valid regex
    try {
      new RegExp(params.pattern);
    } catch {
      errors.push('Invalid regular expression pattern');
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
  private formatOutput(output: GrepOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`🔍 Grep: "${output.pattern}"`);
    parts.push(`   Files searched: ${output.files_searched} | Matches: ${output.total_matches}`);
    if (output.truncated) {
      parts.push('   ⚠️  Results truncated');
    }
    parts.push('');

    // Matches
    if (output.matches.length === 0) {
      parts.push('No matches found.');
    } else {
      let currentFile = '';
      for (const match of output.matches) {
        // Show file path when it changes
        if (match.file_path !== currentFile) {
          currentFile = match.file_path;
          parts.push(`\n📄 ${currentFile}`);
        }

        // Context before
        for (let i = 0; i < match.context_before.length; i++) {
          const lineNum = match.line_number - match.context_before.length + i;
          parts.push(`   ${lineNum}: ${match.context_before[i]}`);
        }

        // Match line
        parts.push(` ➜ ${match.line_number}: ${match.line}`);

        // Context after
        for (let i = 0; i < match.context_after.length; i++) {
          const lineNum = match.line_number + i + 1;
          parts.push(`   ${lineNum}: ${match.context_after[i]}`);
        }
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
    data: GrepOutput,
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

export default GrepTool;
