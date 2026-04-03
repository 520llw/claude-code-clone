/**
 * @fileoverview File Edit Tool for Claude Code Clone
 * 
 * This tool provides safe file editing capabilities with:
 * - Exact string matching for replacements
 * - Multiple replacement support
 * - Automatic diff generation
 * - Backup creation
 * - Undo support
 * - Validation of changes
 * 
 * @module FileEditTool
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
 * Single edit operation schema
 */
export const EditOperationSchema = z.object({
  /** String to find and replace (must match exactly) */
  old_string: z.string()
    .describe('String to find and replace (must match exactly)'),

  /** String to replace with */
  new_string: z.string()
    .describe('String to replace with'),
});

export type EditOperation = z.infer<typeof EditOperationSchema>;

/**
 * Schema for file edit tool input
 */
export const FileEditInputSchema = z.object({
  /** Path to the file to edit */
  file_path: z.string()
    .min(1, 'File path cannot be empty')
    .max(4096, 'File path too long')
    .describe('Path to the file to edit'),

  /** String to find and replace (must match exactly) */
  old_string: z.string()
    .describe('String to find and replace (must match exactly)'),

  /** String to replace with */
  new_string: z.string()
    .describe('String to replace with'),

  /** Whether to replace all occurrences */
  replace_all: z.boolean()
    .default(false)
    .describe('Whether to replace all occurrences'),

  /** Whether to create a backup before editing */
  create_backup: z.boolean()
    .default(true)
    .describe('Whether to create a backup before editing'),

  /** Backup suffix (if create_backup is true) */
  backup_suffix: z.string()
    .default('.backup')
    .describe('Backup suffix'),
}).describe('Input for editing a file');

export type FileEditInput = z.infer<typeof FileEditInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Schema for a single replacement result
 */
export const ReplacementResultSchema = z.object({
  /** Line number where replacement occurred */
  line_number: z.number()
    .int()
    .describe('Line number where replacement occurred'),

  /** Column where replacement started */
  column: z.number()
    .int()
    .describe('Column where replacement started'),

  /** Length of old string */
  old_length: z.number()
    .int()
    .describe('Length of old string'),

  /** Length of new string */
  new_length: z.number()
    .int()
    .describe('Length of new string'),
});

export type ReplacementResult = z.infer<typeof ReplacementResultSchema>;

/**
 * Schema for file edit tool output
 */
export const FileEditOutputSchema = z.object({
  /** Absolute path of the edited file */
  file_path: z.string()
    .describe('Absolute path of the edited file'),

  /** Whether the edit was successful */
  success: z.boolean()
    .describe('Whether the edit was successful'),

  /** Number of replacements made */
  replacements: z.number()
    .int()
    .min(0)
    .describe('Number of replacements made'),

  /** Details of each replacement */
  replacement_details: z.array(ReplacementResultSchema)
    .describe('Details of each replacement'),

  /** Diff of the changes */
  diff: z.string()
    .optional()
    .describe('Unified diff of the changes'),

  /** Path to backup file (if created) */
  backup_path: z.string()
    .optional()
    .describe('Path to backup file'),

  /** Original file size */
  original_size: z.number()
    .int()
    .describe('Original file size in bytes'),

  /** New file size */
  new_size: z.number()
    .int()
    .describe('New file size in bytes'),

  /** Size difference */
  size_delta: z.number()
    .int()
    .describe('Size difference in bytes'),
}).describe('Result of editing a file');

export type FileEditOutput = z.infer<typeof FileEditOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * File Edit Tool - Edit files with diff-based changes
 * 
 * This tool performs safe file edits by:
 * 1. Finding exact string matches
 * 2. Creating backups before changes
 * 3. Generating diffs of changes
 * 4. Validating the result
 * 
 * @example
 * ```typescript
 * const tool = new FileEditTool();
 * const result = await tool.execute({
 *   file_path: '/path/to/file.ts',
 *   old_string: 'const foo = "bar";',
 *   new_string: 'const foo = "baz";',
 *   create_backup: true
 * }, context);
 * ```
 */
export class FileEditTool extends Tool {
  /** Tool name */
  public readonly name = 'file_edit';

  /** Tool description */
  public readonly description = 'Edit files by replacing exact string matches with automatic backup and diff generation';

  /** Detailed documentation */
  public readonly documentation = `
## File Edit Tool

Safely edits files by replacing exact string matches. This tool provides:
- Exact string matching (no regex)
- Automatic backup creation
- Diff generation
- Multiple replacement support
- Validation of changes

### Input Parameters

- **file_path** (required): Path to the file to edit
- **old_string** (required): String to find and replace (must match exactly)
- **new_string** (required): String to replace with
- **replace_all** (optional): Replace all occurrences (default: false)
- **create_backup** (optional): Create backup before editing (default: true)
- **backup_suffix** (optional): Backup file suffix (default: '.backup')

### Output

Returns detailed information about the edit:
- file_path: Absolute path of the edited file
- success: Whether the edit was successful
- replacements: Number of replacements made
- replacement_details: Details of each replacement (line, column, lengths)
- diff: Unified diff of the changes
- backup_path: Path to backup file (if created)
- original_size: Original file size
- new_size: New file size
- size_delta: Size difference

### Examples

Simple replacement:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "old_string": "const foo = 'bar';",
  "new_string": "const foo = 'baz';"
}
\`\`\`

Replace all occurrences:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "old_string": "TODO",
  "new_string": "DONE",
  "replace_all": true
}
\`\`\`

Without backup:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "old_string": "old code",
  "new_string": "new code",
  "create_backup": false
}
\`\`\`

### Error Handling

- File not found: Returns FILE_NOT_FOUND error
- String not found: Returns STRING_NOT_FOUND error
- Multiple matches (without replace_all): Returns MULTIPLE_MATCHES error
- Permission denied: Returns PERMISSION_DENIED error
- No changes made: Returns NO_CHANGES error

### Safety Features

1. **Exact Matching**: Only exact string matches are replaced
2. **Backups**: Automatic backup creation (can be disabled)
3. **Validation**: Post-edit validation to ensure file integrity
4. **Diff Generation**: Always generates a diff for review
  `;

  /** Tool category */
  public readonly category = ToolCategory.FILE;

  /** Permission level - ask for edit operations */
  public readonly permissionLevel = PermissionLevel.ASK;

  /** Input schema */
  public readonly inputSchema = FileEditInputSchema;

  /** Output schema */
  public readonly outputSchema = FileEditOutputSchema;

  /** Tool tags */
  public readonly tags = ['file', 'edit', 'modify', 'diff', 'backup'];

  /** Examples of tool usage */
  public readonly examples = [
    {
      description: 'Simple string replacement',
      input: {
        file_path: '/path/to/file.ts',
        old_string: 'const foo = "bar";',
        new_string: 'const foo = "baz";',
      },
    },
    {
      description: 'Replace all occurrences',
      input: {
        file_path: '/path/to/file.ts',
        old_string: 'TODO',
        new_string: 'DONE',
        replace_all: true,
      },
    },
    {
      description: 'Edit without backup',
      input: {
        file_path: '/path/to/file.ts',
        old_string: 'old code',
        new_string: 'new code',
        create_backup: false,
      },
    },
  ];

  /**
   * Execute the file edit operation
   * @param input - Validated input
   * @param context - Execution context
   * @returns Tool result
   */
  protected async executeImpl(
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FileEditInput;

    try {
      // Resolve the file path
      const resolvedPath = path.resolve(context.workingDirectory, params.file_path);

      // Check if file exists
      let stats: { size: number; isFile: () => boolean };
      try {
        const fsStats = await fs.stat(resolvedPath);
        stats = {
          size: fsStats.size,
          isFile: () => fsStats.isFile(),
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

      // Read file content
      let originalContent: string;
      try {
        originalContent = await fs.readFile(resolvedPath, 'utf8');
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

      const originalSize = Buffer.byteLength(originalContent, 'utf8');

      // Find occurrences of old_string
      const occurrences: number[] = [];
      let searchIndex = 0;
      while (true) {
        const index = originalContent.indexOf(params.old_string, searchIndex);
        if (index === -1) break;
        occurrences.push(index);
        searchIndex = index + 1;
      }

      // Check if string was found
      if (occurrences.length === 0) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'STRING_NOT_FOUND',
            `Could not find the specified string in file: "${this.truncateString(params.old_string, 50)}"`,
            { 
              suggestion: 'Ensure the old_string matches exactly (including whitespace and line endings).',
              retryable: false 
            }
          )
        );
      }

      // Check for multiple matches when replace_all is false
      if (occurrences.length > 1 && !params.replace_all) {
        return this.createErrorResult(
          startedAt,
          createToolError(
            'MULTIPLE_MATCHES',
            `Found ${occurrences.length} occurrences of the string. Use replace_all: true to replace all.`,
            { 
              suggestion: 'Set replace_all to true if you want to replace all occurrences.',
              retryable: true 
            }
          )
        );
      }

      // Create backup if requested
      let backupPath: string | undefined;
      if (params.create_backup) {
        backupPath = `${resolvedPath}${params.backup_suffix}`;
        try {
          await fs.copyFile(resolvedPath, backupPath);
        } catch (error) {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'BACKUP_FAILED',
              `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
              { suggestion: 'Check disk space and permissions, or set create_backup to false.' }
            )
          );
        }
      }

      // Perform replacements
      let newContent = originalContent;
      const replacementDetails: ReplacementResult[] = [];

      // Process replacements in reverse order to maintain indices
      const sortedOccurrences = [...occurrences].sort((a, b) => b - a);

      for (const index of sortedOccurrences) {
        // Calculate line and column
        const contentBefore = newContent.substring(0, index);
        const lines = contentBefore.split('\n');
        const lineNumber = lines.length;
        const column = lines[lines.length - 1].length + 1;

        // Record replacement details
        replacementDetails.unshift({
          line_number: lineNumber,
          column,
          old_length: params.old_string.length,
          new_length: params.new_string.length,
        });

        // Perform replacement
        newContent = newContent.substring(0, index) + params.new_string + newContent.substring(index + params.old_string.length);
      }

      // Write the modified content
      try {
        await fs.writeFile(resolvedPath, newContent, 'utf8');
      } catch (error) {
        // Try to restore from backup if available
        if (backupPath) {
          try {
            await fs.copyFile(backupPath, resolvedPath);
          } catch {
            // Ignore restore error
          }
        }

        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          return this.createErrorResult(
            startedAt,
            createToolError(
              'PERMISSION_DENIED',
              `Permission denied writing file: ${params.file_path}`,
              { suggestion: 'Check file permissions or run with elevated privileges.' }
            )
          );
        }
        throw error;
      }

      // Generate diff
      const diff = this.generateDiff(resolvedPath, originalContent, newContent, replacementDetails);

      // Calculate sizes
      const newSize = Buffer.byteLength(newContent, 'utf8');

      // Build output
      const output: FileEditOutput = {
        file_path: resolvedPath,
        success: true,
        replacements: occurrences.length,
        replacement_details: replacementDetails,
        diff,
        backup_path: backupPath,
        original_size: originalSize,
        new_size: newSize,
        size_delta: newSize - originalSize,
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
          replacements: occurrences.length,
          sizeDelta: newSize - originalSize,
          hasBackup: !!backupPath,
        }
      );

    } catch (error) {
      return this.createErrorResult(
        startedAt,
        createToolError(
          'EDIT_ERROR',
          `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
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
    const params = input as FileEditInput;
    const errors: string[] = [];

    // Validate working directory exists
    try {
      await fs.access(context.workingDirectory);
    } catch {
      errors.push(`Working directory does not exist: ${context.workingDirectory}`);
    }

    // Validate old_string is not empty
    if (params.old_string.length === 0) {
      errors.push('old_string cannot be empty');
    }

    // Validate backup suffix if creating backup
    if (params.create_backup && params.backup_suffix.length === 0) {
      errors.push('backup_suffix cannot be empty when create_backup is true');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate unified diff
   * @param filePath - File path for diff header
   * @param original - Original content
   * @param modified - Modified content
   * @param replacements - Replacement details
   * @returns Unified diff string
   */
  private generateDiff(
    filePath: string,
    original: string,
    modified: string,
    replacements: ReplacementResult[]
  ): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const fileName = path.basename(filePath);

    const diffLines: string[] = [
      `--- ${fileName}`,
      `+++ ${fileName}`,
    ];

    // Simple line-based diff for replacements
    // In a production implementation, you might use a proper diff library
    let i = 0;
    let j = 0;

    while (i < originalLines.length || j < modifiedLines.length) {
      if (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
        diffLines.push(` ${originalLines[i]}`);
        i++;
        j++;
      } else {
        // Find next matching line
        let foundMatch = false;
        for (let k = i + 1; k < Math.min(i + 5, originalLines.length); k++) {
          if (k < originalLines.length && j < modifiedLines.length && originalLines[k] === modifiedLines[j]) {
            // Output removed lines
            for (let r = i; r < k; r++) {
              diffLines.push(`-${originalLines[r]}`);
            }
            i = k;
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch && j < modifiedLines.length) {
          diffLines.push(`+${modifiedLines[j]}`);
          j++;
          if (i < originalLines.length) {
            diffLines.push(`-${originalLines[i]}`);
            i++;
          }
        }
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Truncate string for display
   * @param str - String to truncate
   * @param maxLength - Maximum length
   * @returns Truncated string
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format output for display
   * @param output - Tool output
   * @returns Formatted display string
   */
  private formatOutput(output: FileEditOutput): string {
    const parts: string[] = [];

    // Header
    parts.push(`✏️  Edited: ${output.file_path}`);
    parts.push(`   Replacements: ${output.replacements} | Size: ${output.original_size} → ${output.new_size} bytes (${output.size_delta >= 0 ? '+' : ''}${output.size_delta})`);
    if (output.backup_path) {
      parts.push(`   Backup: ${output.backup_path}`);
    }
    parts.push('');

    // Diff
    if (output.diff) {
      parts.push('Diff:');
      parts.push('```diff');
      parts.push(output.diff);
      parts.push('```');
    }

    // Replacement details
    if (output.replacement_details.length > 0) {
      parts.push('');
      parts.push('Replacements:');
      output.replacement_details.forEach((detail, index) => {
        parts.push(`  ${index + 1}. Line ${detail.line_number}, Col ${detail.column}: ${detail.old_length} → ${detail.new_length} chars`);
      });
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
    data: FileEditOutput,
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

export default FileEditTool;
