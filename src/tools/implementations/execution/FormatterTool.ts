/**
 * @fileoverview Formatter Tool for Claude Code Clone
 * 
 * This tool runs code formatters:
 * - Prettier for JavaScript/TypeScript
 * - Black for Python
 * - rustfmt for Rust
 * - gofmt for Go
 * 
 * @module FormatterTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { spawn } from 'child_process';
import * as path from 'path';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const FormatterInputSchema = z.object({
  formatter: z.enum(['prettier', 'black', 'rustfmt', 'gofmt', 'clang-format']).default('prettier').describe('Formatter to use'),
  files: z.array(z.string()).default(['.']).describe('Files/patterns to format'),
  check: z.boolean().default(false).describe('Check formatting without writing'),
  config: z.string().optional().describe('Config file path'),
  working_dir: z.string().optional().describe('Working directory'),
  timeout: z.number().int().min(1000).max(300000).default(60000).describe('Timeout in milliseconds'),
}).describe('Input for formatting');

export type FormatterInput = z.infer<typeof FormatterInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const FormatIssueSchema = z.object({
  file: z.string().describe('File path'),
  message: z.string().describe('Issue message'),
}).describe('Format issue');

export const FormatterOutputSchema = z.object({
  formatter: z.string().describe('Formatter used'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Duration in milliseconds'),
  files_checked: z.number().int().describe('Number of files checked'),
  files_formatted: z.number().int().describe('Number of files formatted'),
  unchanged_count: z.number().int().describe('Number of unchanged files'),
}).describe('Result of formatting');

export type FormatterOutput = z.infer<typeof FormatterOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class FormatterTool extends Tool {
  public readonly name = 'formatter';
  public readonly description = 'Run code formatters to format code';
  public readonly documentation = `
## Formatter Tool

Runs code formatters:
- Prettier for JavaScript/TypeScript/CSS/HTML
- Black for Python
- rustfmt for Rust
- gofmt for Go
- clang-format for C/C++

### Input Parameters

- **formatter** (optional): Formatter to use (prettier, black, rustfmt, etc.)
- **files** (optional): Files/patterns to format (default: '.')
- **check** (optional): Check without writing (default: false)
- **config** (optional): Config file path
- **working_dir** (optional): Working directory
- **timeout** (optional): Timeout in ms (default: 60000)

### Output

Returns formatting results:
- formatter: Formatter used
- exit_code: Exit code
- stdout/stderr: Output
- duration: Execution time
- files_checked: Files checked
- files_formatted: Files formatted
- unchanged_count: Unchanged files

### Examples

Format all files:
\`\`\`json
{
  "formatter": "prettier"
}
\`\`\`

Check formatting:
\`\`\`json
{
  "formatter": "prettier",
  "check": true
}
\`\`\`

Format specific files:
\`\`\`json
{
  "formatter": "prettier",
  "files": ["src/**/*.ts"]
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = FormatterInputSchema;
  public readonly outputSchema = FormatterOutputSchema;
  public readonly tags = ['format', 'prettier', 'style', 'code-style'];
  public readonly examples = [
    { description: 'Format all files', input: { formatter: 'prettier' } },
    { description: 'Check formatting', input: { formatter: 'prettier', check: true } },
    { description: 'Format specific files', input: { formatter: 'prettier', files: ['src/**/*.ts'] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as FormatterInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      // Build command
      let command: string;
      let args: string[] = [];

      switch (params.formatter) {
        case 'prettier':
          command = 'npx prettier';
          args = [...params.files];
          if (params.check) args.push('--check');
          else args.push('--write');
          if (params.config) args.push('--config', params.config);
          break;
        case 'black':
          command = 'black';
          args = [...params.files];
          if (params.check) args.push('--check');
          if (params.config) args.push('--config', params.config);
          break;
        case 'rustfmt':
          command = 'cargo fmt';
          args = [];
          if (params.check) args.push('--', '--check');
          break;
        case 'gofmt':
          command = 'gofmt';
          args = params.check ? ['-l', ...params.files] : ['-w', ...params.files];
          break;
        case 'clang-format':
          command = 'clang-format';
          args = params.check ? ['--dry-run', ...params.files] : ['-i', ...params.files];
          break;
      }

      const fullCommand = `${command} ${args.join(' ')}`.trim();

      let stdout = '';
      let stderr = '';

      const child = spawn(fullCommand, [], {
        cwd: workingDir,
        shell: true,
        stdio: 'pipe',
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
      }, params.timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startedAt.getTime();

        // Parse output to count files
        const filesChecked = (stdout.match(/\n/g) || []).length;
        const filesFormatted = params.check ? 0 : filesChecked;

        const output: FormatterOutput = {
          formatter: params.formatter,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 50000),
          stderr: stderr.slice(0, 50000),
          duration,
          files_checked: filesChecked,
          files_formatted: filesFormatted,
          unchanged_count: 0,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('FORMATTER_ERROR', error.message)));
      });
    });
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: FormatterOutput): string {
    const parts: string[] = [];
    parts.push(`✨ ${output.formatter}`);
    parts.push(`Files checked: ${output.files_checked} | Formatted: ${output.files_formatted}`);
    parts.push(`Duration: ${output.duration}ms`);
    
    if (output.exit_code === 0) {
      parts.push(params.check ? '✅ All files are formatted' : '✅ Formatting complete');
    } else if (output.check) {
      parts.push('❌ Some files need formatting');
    }

    if (output.stdout) {
      parts.push('');
      parts.push(output.stdout);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: FormatterOutput, output: string): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: data.exit_code === 0,
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default FormatterTool;
