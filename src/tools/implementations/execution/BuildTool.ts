/**
 * @fileoverview Build Tool for Claude Code Clone
 * 
 * This tool runs build commands:
 * - npm run build
 * - make
 * - cargo build
 * - Custom build scripts
 * 
 * @module BuildTool
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

export const BuildInputSchema = z.object({
  command: z.enum(['npm', 'yarn', 'pnpm', 'make', 'cargo', 'gradle', 'maven', 'custom']).default('npm').describe('Build system'),
  script: z.string().default('build').describe('Build script/command'),
  args: z.array(z.string()).default([]).describe('Additional arguments'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  timeout: z.number().int().min(1000).max(600000).default(300000).describe('Timeout in milliseconds'),
  working_dir: z.string().optional().describe('Working directory'),
}).describe('Input for build command');

export type BuildInput = z.infer<typeof BuildInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const BuildOutputSchema = z.object({
  command: z.string().describe('Command executed'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Duration in milliseconds'),
  success: z.boolean().describe('Whether build succeeded'),
}).describe('Result of build command');

export type BuildOutput = z.infer<typeof BuildOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class BuildTool extends Tool {
  public readonly name = 'build';
  public readonly description = 'Run build commands for various build systems';
  public readonly documentation = `
## Build Tool

Runs build commands for various build systems:
- npm/yarn/pnpm run build
- make
- cargo build
- gradle/maven
- Custom commands

### Input Parameters

- **command** (optional): Build system (npm, yarn, make, cargo, etc.)
- **script** (optional): Build script name (default: 'build')
- **args** (optional): Additional arguments
- **env** (optional): Environment variables
- **timeout** (optional): Timeout in ms (default: 300000)
- **working_dir** (optional): Working directory

### Output

Returns build results:
- command: Command executed
- exit_code: Exit code
- stdout/stderr: Output
- duration: Execution time
- success: Whether build succeeded

### Examples

npm build:
\`\`\`json
{
  "command": "npm",
  "script": "build"
}
\`\`\`

Make:
\`\`\`json
{
  "command": "make",
  "script": "all"
}
\`\`\`

Cargo:
\`\`\`json
{
  "command": "cargo",
  "script": "build --release"
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = BuildInputSchema;
  public readonly outputSchema = BuildOutputSchema;
  public readonly tags = ['build', 'compile', 'npm', 'make', 'cargo'];
  public readonly examples = [
    { description: 'npm build', input: { command: 'npm', script: 'build' } },
    { description: 'Make', input: { command: 'make', script: 'all' } },
    { description: 'Cargo release', input: { command: 'cargo', script: 'build --release' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as BuildInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      // Build command
      let fullCommand: string;
      
      switch (params.command) {
        case 'npm':
        case 'yarn':
        case 'pnpm':
          fullCommand = `${params.command} run ${params.script}`;
          break;
        case 'make':
          fullCommand = `make ${params.script}`;
          break;
        case 'cargo':
          fullCommand = `cargo ${params.script}`;
          break;
        case 'gradle':
          fullCommand = `./gradlew ${params.script}`;
          break;
        case 'maven':
          fullCommand = `mvn ${params.script}`;
          break;
        case 'custom':
          fullCommand = params.script;
          break;
      }

      if (params.args.length > 0) {
        fullCommand += ' ' + params.args.join(' ');
      }

      const env = { ...process.env, ...params.env };

      let stdout = '';
      let stderr = '';

      const child = spawn(fullCommand, [], {
        cwd: workingDir,
        shell: true,
        env,
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

        const output: BuildOutput = {
          command: fullCommand,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 100000),
          stderr: stderr.slice(0, 100000),
          duration,
          success: code === 0,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('BUILD_ERROR', error.message)));
      });
    });
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: BuildOutput): string {
    const parts: string[] = [];
    parts.push(`🔨 Build: ${output.command}`);
    parts.push(`Exit code: ${output.exit_code} | Duration: ${output.duration}ms | ${output.success ? '✅ Success' : '❌ Failed'}`);
    
    if (output.stdout) {
      parts.push('');
      parts.push('Output:');
      parts.push(output.stdout);
    }

    if (output.stderr) {
      parts.push('');
      parts.push('Errors:');
      parts.push(output.stderr);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: BuildOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: data.success,
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

export default BuildTool;
