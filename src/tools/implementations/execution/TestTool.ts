/**
 * @fileoverview Test Tool for Claude Code Clone
 * 
 * This tool runs test suites:
 * - Jest, Mocha, Vitest support
 * - Test filtering
 * - Coverage reporting
 * - Watch mode
 * 
 * @module TestTool
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

export const TestInputSchema = z.object({
  framework: z.enum(['jest', 'mocha', 'vitest', 'pytest', 'cargo']).default('jest').describe('Test framework'),
  pattern: z.string().optional().describe('Test file pattern'),
  test_name: z.string().optional().describe('Specific test name to run'),
  coverage: z.boolean().default(false).describe('Generate coverage report'),
  watch: z.boolean().default(false).describe('Watch mode'),
  timeout: z.number().int().min(1000).max(600000).default(120000).describe('Timeout in milliseconds'),
  args: z.array(z.string()).default([]).describe('Additional arguments'),
  working_dir: z.string().optional().describe('Working directory'),
}).describe('Input for running tests');

export type TestInput = z.infer<typeof TestInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const TestOutputSchema = z.object({
  framework: z.string().describe('Test framework used'),
  command: z.string().describe('Command executed'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Duration in milliseconds'),
  tests_passed: z.number().int().optional().describe('Number of tests passed'),
  tests_failed: z.number().int().optional().describe('Number of tests failed'),
  tests_total: z.number().int().optional().describe('Total number of tests'),
}).describe('Result of test execution');

export type TestOutput = z.infer<typeof TestOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class TestTool extends Tool {
  public readonly name = 'test';
  public readonly description = 'Run test suites with various test frameworks';
  public readonly documentation = `
## Test Tool

Runs test suites with multiple framework support:
- Jest, Mocha, Vitest for JavaScript/TypeScript
- pytest for Python
- cargo test for Rust

### Input Parameters

- **framework** (optional): Test framework (jest, mocha, vitest, pytest, cargo)
- **pattern** (optional): Test file pattern
- **test_name** (optional): Specific test to run
- **coverage** (optional): Generate coverage report
- **watch** (optional): Watch mode
- **timeout** (optional): Timeout in ms (default: 120000)
- **args** (optional): Additional arguments
- **working_dir** (optional): Working directory

### Output

Returns test results:
- framework: Framework used
- command: Command executed
- exit_code: Exit code
- stdout/stderr: Output
- duration: Execution time
- tests_passed/failed/total: Test counts

### Examples

Run all tests:
\`\`\`json
{
  "framework": "jest"
}
\`\`\`

Run specific test:
\`\`\`json
{
  "framework": "jest",
  "test_name": "authentication"
}
\`\`\`

With coverage:
\`\`\`json
{
  "framework": "jest",
  "coverage": true
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = TestInputSchema;
  public readonly outputSchema = TestOutputSchema;
  public readonly tags = ['test', 'testing', 'jest', 'mocha', 'pytest'];
  public readonly examples = [
    { description: 'Run all tests', input: { framework: 'jest' } },
    { description: 'Run specific test', input: { framework: 'jest', test_name: 'auth' } },
    { description: 'With coverage', input: { framework: 'jest', coverage: true } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as TestInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      // Build command based on framework
      let command: string;
      let args: string[] = [];

      switch (params.framework) {
        case 'jest':
          command = 'npx jest';
          if (params.pattern) args.push(params.pattern);
          if (params.test_name) args.push('-t', params.test_name);
          if (params.coverage) args.push('--coverage');
          if (!params.watch) args.push('--watchAll=false');
          break;
        case 'mocha':
          command = 'npx mocha';
          if (params.pattern) args.push(params.pattern);
          if (params.test_name) args.push('-g', params.test_name);
          break;
        case 'vitest':
          command = 'npx vitest';
          if (params.pattern) args.push(params.pattern);
          if (params.test_name) args.push('-t', params.test_name);
          if (params.coverage) args.push('--coverage');
          if (!params.watch) args.push('--run');
          break;
        case 'pytest':
          command = 'pytest';
          if (params.pattern) args.push('-k', params.pattern);
          if (params.test_name) args.push('-k', params.test_name);
          break;
        case 'cargo':
          command = 'cargo test';
          if (params.test_name) args.push(params.test_name);
          break;
      }

      args.push(...params.args);

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

        // Parse test counts from output
        const passedMatch = stdout.match(/(\d+) passing|(\d+) passed/i);
        const failedMatch = stdout.match(/(\d+) failing|(\d+) failed/i);
        const totalMatch = stdout.match(/Tests:\s*(\d+) total/i);

        const output: TestOutput = {
          framework: params.framework,
          command: fullCommand,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 50000),
          stderr: stderr.slice(0, 50000),
          duration,
          tests_passed: passedMatch ? parseInt(passedMatch[1] || passedMatch[2]) : undefined,
          tests_failed: failedMatch ? parseInt(failedMatch[1] || failedMatch[2]) : undefined,
          tests_total: totalMatch ? parseInt(totalMatch[1]) : undefined,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('TEST_ERROR', error.message)));
      });
    });
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: TestOutput): string {
    const parts: string[] = [];
    parts.push(`🧪 ${output.framework}: ${output.command}`);
    
    if (output.tests_total !== undefined) {
      parts.push(`Tests: ${output.tests_total} total | ✅ ${output.tests_passed || 0} passed | ❌ ${output.tests_failed || 0} failed`);
    }
    
    parts.push(`Exit code: ${output.exit_code} | Duration: ${output.duration}ms`);
    
    if (output.stdout) {
      parts.push('');
      parts.push(output.stdout);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: TestOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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

export default TestTool;
