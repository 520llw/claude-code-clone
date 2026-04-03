/**
 * @fileoverview Linter Tool for Claude Code Clone
 * 
 * This tool runs linters:
 * - ESLint for JavaScript/TypeScript
 * - Pylint for Python
 * - Clippy for Rust
 * - golangci-lint for Go
 * 
 * @module LinterTool
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

export const LinterInputSchema = z.object({
  linter: z.enum(['eslint', 'pylint', 'clippy', 'golangci-lint', 'flake8', 'tsc']).default('eslint').describe('Linter to use'),
  files: z.array(z.string()).default(['.']).describe('Files/patterns to lint'),
  fix: z.boolean().default(false).describe('Auto-fix issues'),
  config: z.string().optional().describe('Config file path'),
  working_dir: z.string().optional().describe('Working directory'),
  timeout: z.number().int().min(1000).max(300000).default(60000).describe('Timeout in milliseconds'),
}).describe('Input for linting');

export type LinterInput = z.infer<typeof LinterInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LintIssueSchema = z.object({
  file: z.string().describe('File path'),
  line: z.number().int().describe('Line number'),
  column: z.number().int().describe('Column number'),
  severity: z.enum(['error', 'warning', 'info']).describe('Issue severity'),
  message: z.string().describe('Issue message'),
  rule: z.string().optional().describe('Rule ID'),
}).describe('Lint issue');

export const LinterOutputSchema = z.object({
  linter: z.string().describe('Linter used'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Duration in milliseconds'),
  issues: z.array(LintIssueSchema).describe('Lint issues found'),
  error_count: z.number().int().describe('Number of errors'),
  warning_count: z.number().int().describe('Number of warnings'),
  fixable_count: z.number().int().describe('Number of fixable issues'),
}).describe('Result of linting');

export type LinterOutput = z.infer<typeof LinterOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LinterTool extends Tool {
  public readonly name = 'linter';
  public readonly description = 'Run linters to check code quality';
  public readonly documentation = `
## Linter Tool

Runs linters to check code quality:
- ESLint for JavaScript/TypeScript
- Pylint/Flake8 for Python
- Clippy for Rust
- golangci-lint for Go
- TypeScript compiler

### Input Parameters

- **linter** (optional): Linter to use (eslint, pylint, clippy, etc.)
- **files** (optional): Files/patterns to lint (default: '.')
- **fix** (optional): Auto-fix issues (default: false)
- **config** (optional): Config file path
- **working_dir** (optional): Working directory
- **timeout** (optional): Timeout in ms (default: 60000)

### Output

Returns lint results:
- linter: Linter used
- exit_code: Exit code
- stdout/stderr: Output
- duration: Execution time
- issues: List of issues found
- error_count: Number of errors
- warning_count: Number of warnings
- fixable_count: Number of fixable issues

### Examples

Lint all files:
\`\`\`json
{
  "linter": "eslint"
}
\`\`\`

Lint specific files:
\`\`\`json
{
  "linter": "eslint",
  "files": ["src/**/*.ts"]
}
\`\`\`

Auto-fix issues:
\`\`\`json
{
  "linter": "eslint",
  "fix": true
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = LinterInputSchema;
  public readonly outputSchema = LinterOutputSchema;
  public readonly tags = ['lint', 'eslint', 'quality', 'check'];
  public readonly examples = [
    { description: 'Lint all files', input: { linter: 'eslint' } },
    { description: 'Lint specific files', input: { linter: 'eslint', files: ['src/**/*.ts'] } },
    { description: 'Auto-fix', input: { linter: 'eslint', fix: true } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LinterInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      // Build command
      let command: string;
      let args: string[] = [];

      switch (params.linter) {
        case 'eslint':
          command = 'npx eslint';
          args = [...params.files];
          if (params.fix) args.push('--fix');
          if (params.config) args.push('--config', params.config);
          args.push('--format', 'json');
          break;
        case 'pylint':
          command = 'pylint';
          args = [...params.files];
          if (params.config) args.push('--rcfile', params.config);
          break;
        case 'flake8':
          command = 'flake8';
          args = [...params.files];
          if (params.config) args.push('--config', params.config);
          break;
        case 'clippy':
          command = 'cargo clippy';
          args = ['--', '-D', 'warnings'];
          break;
        case 'golangci-lint':
          command = 'golangci-lint run';
          args = [...params.files];
          if (params.fix) args.push('--fix');
          break;
        case 'tsc':
          command = 'npx tsc';
          args = ['--noEmit'];
          if (params.config) args.push('-p', params.config);
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

        // Parse issues from output
        const issues = this.parseIssues(params.linter, stdout, stderr);

        const output: LinterOutput = {
          linter: params.linter,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 50000),
          stderr: stderr.slice(0, 50000),
          duration,
          issues,
          error_count: issues.filter(i => i.severity === 'error').length,
          warning_count: issues.filter(i => i.severity === 'warning').length,
          fixable_count: params.fix ? issues.length : 0,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('LINTER_ERROR', error.message)));
      });
    });
  }

  private parseIssues(linter: string, stdout: string, stderr: string): z.infer<typeof LintIssueSchema>[] {
    const issues: z.infer<typeof LintIssueSchema>[] = [];

    try {
      if (linter === 'eslint') {
        const results = JSON.parse(stdout);
        for (const result of results) {
          for (const message of result.messages) {
            issues.push({
              file: result.filePath,
              line: message.line,
              column: message.column,
              severity: message.severity === 2 ? 'error' : 'warning',
              message: message.message,
              rule: message.ruleId,
            });
          }
        }
      }
    } catch {
      // Fallback: couldn't parse structured output
    }

    return issues;
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LinterOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 ${output.linter}`);
    parts.push(`Issues: ${output.error_count} errors, ${output.warning_count} warnings`);
    parts.push(`Duration: ${output.duration}ms`);
    
    if (output.issues.length > 0) {
      parts.push('');
      for (const issue of output.issues.slice(0, 20)) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        parts.push(`${icon} ${issue.file}:${issue.line}:${issue.column} - ${issue.message}`);
        if (issue.rule) {
          parts.push(`   Rule: ${issue.rule}`);
        }
      }
      if (output.issues.length > 20) {
        parts.push(`... and ${output.issues.length - 20} more issues`);
      }
    } else {
      parts.push('✅ No issues found');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: LinterOutput, output: string): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: data.error_count === 0,
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

export default LinterTool;
