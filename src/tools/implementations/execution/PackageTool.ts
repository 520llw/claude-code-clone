/**
 * @fileoverview Package Tool for Claude Code Clone
 * 
 * This tool manages package dependencies:
 * - npm, yarn, pnpm support
 * - pip support
 * - Install, remove, update
 * - List dependencies
 * 
 * @module PackageTool
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

export const PackageInputSchema = z.object({
  manager: z.enum(['npm', 'yarn', 'pnpm', 'pip', 'poetry']).default('npm').describe('Package manager'),
  action: z.enum(['install', 'add', 'remove', 'update', 'list', 'outdated', 'audit']).default('install').describe('Package action'),
  packages: z.array(z.string()).default([]).describe('Package names'),
  dev: z.boolean().default(false).describe('Install as dev dependency'),
  global: z.boolean().default(false).describe('Install globally'),
  working_dir: z.string().optional().describe('Working directory'),
  timeout: z.number().int().min(1000).max(600000).default(120000).describe('Timeout in milliseconds'),
}).describe('Input for package management');

export type PackageInput = z.infer<typeof PackageInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const PackageOutputSchema = z.object({
  manager: z.string().describe('Package manager used'),
  action: z.string().describe('Action performed'),
  packages: z.array(z.string()).describe('Packages affected'),
  exit_code: z.number().int().describe('Exit code'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  duration: z.number().int().describe('Duration in milliseconds'),
}).describe('Result of package operation');

export type PackageOutput = z.infer<typeof PackageOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class PackageTool extends Tool {
  public readonly name = 'package';
  public readonly description = 'Manage package dependencies with npm, yarn, pip, and more';
  public readonly documentation = `
## Package Tool

Manages package dependencies:
- npm, yarn, pnpm for Node.js
- pip, poetry for Python
- Install, remove, update packages
- List and audit dependencies

### Input Parameters

- **manager** (optional): Package manager (npm, yarn, pnpm, pip, poetry)
- **action** (optional): Action (install, add, remove, update, list, outdated, audit)
- **packages** (optional): Package names
- **dev** (optional): Install as dev dependency
- **global** (optional): Install globally
- **working_dir** (optional): Working directory
- **timeout** (optional): Timeout in ms (default: 120000)

### Output

Returns operation results:
- manager: Package manager used
- action: Action performed
- packages: Packages affected
- exit_code: Exit code
- stdout/stderr: Output
- duration: Execution time

### Examples

Install dependencies:
\`\`\`json
{
  "manager": "npm",
  "action": "install"
}
\`\`\`

Add package:
\`\`\`json
{
  "manager": "npm",
  "action": "add",
  "packages": ["lodash"]
}
\`\`\`

Add dev dependency:
\`\`\`json
{
  "manager": "npm",
  "action": "add",
  "packages": ["jest"],
  "dev": true
}
\`\`\`

Update packages:
\`\`\`json
{
  "manager": "npm",
  "action": "update"
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = PackageInputSchema;
  public readonly outputSchema = PackageOutputSchema;
  public readonly tags = ['package', 'npm', 'pip', 'dependency', 'install'];
  public readonly examples = [
    { description: 'Install dependencies', input: { manager: 'npm', action: 'install' } },
    { description: 'Add package', input: { manager: 'npm', action: 'add', packages: ['lodash'] } },
    { description: 'Add dev dependency', input: { manager: 'npm', action: 'add', packages: ['jest'], dev: true } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as PackageInput;

    return new Promise((resolve) => {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      // Build command
      let command: string;
      let args: string[] = [];

      switch (params.manager) {
        case 'npm':
          command = 'npm';
          switch (params.action) {
            case 'install':
              args = ['install'];
              break;
            case 'add':
              args = ['install', ...params.packages];
              if (params.dev) args.push('--save-dev');
              break;
            case 'remove':
              args = ['uninstall', ...params.packages];
              break;
            case 'update':
              args = ['update'];
              break;
            case 'list':
              args = ['list'];
              break;
            case 'outdated':
              args = ['outdated'];
              break;
            case 'audit':
              args = ['audit'];
              break;
          }
          break;
        case 'yarn':
          command = 'yarn';
          switch (params.action) {
            case 'install':
              args = ['install'];
              break;
            case 'add':
              args = ['add', ...params.packages];
              if (params.dev) args.push('--dev');
              break;
            case 'remove':
              args = ['remove', ...params.packages];
              break;
            case 'update':
              args = ['upgrade'];
              break;
            case 'list':
              args = ['list'];
              break;
            case 'outdated':
              args = ['outdated'];
              break;
            case 'audit':
              args = ['audit'];
              break;
          }
          break;
        case 'pnpm':
          command = 'pnpm';
          switch (params.action) {
            case 'install':
              args = ['install'];
              break;
            case 'add':
              args = ['add', ...params.packages];
              if (params.dev) args.push('--save-dev');
              break;
            case 'remove':
              args = ['remove', ...params.packages];
              break;
            case 'update':
              args = ['update'];
              break;
            case 'list':
              args = ['list'];
              break;
            case 'outdated':
              args = ['outdated'];
              break;
            case 'audit':
              args = ['audit'];
              break;
          }
          break;
        case 'pip':
          command = 'pip';
          switch (params.action) {
            case 'install':
              args = ['install', '-r', 'requirements.txt'];
              break;
            case 'add':
              args = ['install', ...params.packages];
              break;
            case 'remove':
              args = ['uninstall', '-y', ...params.packages];
              break;
            case 'update':
              args = ['install', '--upgrade', ...params.packages];
              break;
            case 'list':
              args = ['list'];
              break;
            case 'outdated':
              args = ['list', '--outdated'];
              break;
            case 'audit':
              args = ['check'];
              break;
          }
          break;
        case 'poetry':
          command = 'poetry';
          switch (params.action) {
            case 'install':
              args = ['install'];
              break;
            case 'add':
              args = ['add', ...params.packages];
              if (params.dev) args.push('--group', 'dev');
              break;
            case 'remove':
              args = ['remove', ...params.packages];
              break;
            case 'update':
              args = ['update'];
              break;
            case 'list':
              args = ['show'];
              break;
            case 'outdated':
              args = ['show', '--outdated'];
              break;
            case 'audit':
              args = ['check'];
              break;
          }
          break;
      }

      if (params.global) {
        args.push('-g');
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

        const output: PackageOutput = {
          manager: params.manager,
          action: params.action,
          packages: params.packages,
          exit_code: code ?? -1,
          stdout: stdout.slice(0, 100000),
          stderr: stderr.slice(0, 100000),
          duration,
        };

        resolve(this.createSuccessResult(startedAt, output, this.formatOutput(output)));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.createErrorResult(startedAt, createToolError('PACKAGE_ERROR', error.message)));
      });
    });
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: PackageOutput): string {
    const parts: string[] = [];
    parts.push(`📦 ${output.manager} ${output.action}`);
    if (output.packages.length > 0) {
      parts.push(`Packages: ${output.packages.join(', ')}`);
    }
    parts.push(`Exit code: ${output.exit_code} | Duration: ${output.duration}ms`);
    
    if (output.stdout) {
      parts.push('');
      parts.push(output.stdout);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: PackageOutput, output: string): ToolResult {
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

export default PackageTool;
