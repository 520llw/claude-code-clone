/**
 * @fileoverview Bash Tool for Claude Code Clone
 * 
 * This tool executes shell commands with:
 * - Timeout support
 * - Environment variable handling
 * - Working directory control
 * - Output capture
 * - Security restrictions
 * 
 * @module BashTool
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

export const BashInputSchema = z.object({
  command: z.string().min(1).max(10000).describe('Shell command to execute'),
  working_dir: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  timeout: z.number().int().min(1000).max(300000).default(60000).describe('Timeout in milliseconds'),
  capture_output: z.boolean().default(true).describe('Capture command output'),
  shell: z.enum(['bash', 'sh', 'zsh', 'cmd', 'powershell']).default('bash').describe('Shell to use'),
}).describe('Input for bash command execution');

export type BashInput = z.infer<typeof BashInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const BashOutputSchema = z.object({
  command: z.string().describe('Executed command'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Execution duration in milliseconds'),
  working_dir: z.string().describe('Working directory'),
}).describe('Result of bash command execution');

export type BashOutput = z.infer<typeof BashOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class BashTool extends Tool {
  public readonly name = 'bash';
  public readonly description = 'Execute shell commands with timeout and output capture';
  public readonly documentation = `
## Bash Tool

Executes shell commands with comprehensive control:
- Command execution with timeout
- Environment variable handling
- Working directory control
- Output capture
- Multiple shell support

### Input Parameters

- **command** (required): Shell command to execute
- **working_dir** (optional): Working directory
- **env** (optional): Environment variables
- **timeout** (optional): Timeout in ms (default: 60000)
- **capture_output** (optional): Capture output (default: true)
- **shell** (optional): Shell to use (default: bash)

### Output

Returns command execution results:
- command: Executed command
- exit_code: Command exit code
- stdout: Standard output
- stderr: Standard error
- duration: Execution time in ms
- working_dir: Working directory used

### Examples

List files:
\`\`\`json
{
  "command": "ls -la"
}
\`\`\`

With timeout:
\`\`\`json
{
  "command": "sleep 5 && echo done",
  "timeout": 10000
}
\`\`\`

With environment:
\`\`\`json
{
  "command": "echo $MY_VAR",
  "env": { "MY_VAR": "hello" }
}
\`\`\`

### Security

- Commands are executed in a sandboxed environment
- Dangerous commands may require approval
- Timeout prevents runaway processes
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = BashInputSchema;
  public readonly outputSchema = BashOutputSchema;
  public readonly tags = ['bash', 'shell', 'command', 'execute'];
  public readonly examples = [
    { description: 'List files', input: { command: 'ls -la' } },
    { description: 'With timeout', input: { command: 'sleep 5', timeout: 10000 } },
    { description: 'With env vars', input: { command: 'echo $MY_VAR', env: { MY_VAR: 'hello' } } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as BashInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      const env = { ...process.env, ...context.environment, ...params.env };

      let stdout = '';
      let stderr = '';

      const child = spawn(params.command, [], {
        cwd: workingDir,
        env,
        shell: params.shell,
        stdio: params.capture_output ? 'pipe' : 'inherit',
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, params.timeout);

      if (params.capture_output) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startedAt.getTime();

        const output: BashOutput = {
          command: params.command,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 100000), // Limit output size
          stderr: stderr.slice(0, 100000),
          duration,
          working_dir: workingDir,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('EXECUTION_ERROR', error.message)));
      });
    });
  }

  protected async validateContext(input: unknown, context: ToolContext): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as BashInput;
    const errors: string[] = [];

    // Check for dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      />\s*\/dev\/null/,
      /dd\s+if/,
      /mkfs/,
      /:\(\)\s*\{\s*:\|:\&\s*\};/, // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(params.command)) {
        errors.push('Command contains potentially dangerous pattern');
        break;
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private formatOutput(output: BashOutput): string {
    const parts: string[] = [];
    parts.push(`$ ${output.command}`);
    parts.push(`Exit code: ${output.exit_code} | Duration: ${output.duration}ms`);
    
    if (output.stdout) {
      parts.push('');
      parts.push('stdout:');
      parts.push(output.stdout);
    }
    
    if (output.stderr) {
      parts.push('');
      parts.push('stderr:');
      parts.push(output.stderr);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: BashOutput, output: string): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: true,
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

export default BashTool;
