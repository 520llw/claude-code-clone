/**
 * @fileoverview Git Tool for Claude Code Clone
 * 
 * This tool provides git operations:
 * - Status, diff, log
 * - Add, commit, push
 * - Branch operations
 * - Clone, fetch, pull
 * 
 * @module GitTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

const execAsync = promisify(exec);

// ============================================================================
// Input Schema
// ============================================================================

export const GitInputSchema = z.object({
  command: z.enum([
    'status', 'diff', 'log', 'add', 'commit', 'push', 'pull', 'fetch',
    'branch', 'checkout', 'clone', 'reset', 'stash', 'merge', 'rebase'
  ]).describe('Git subcommand'),
  args: z.array(z.string()).default([]).describe('Command arguments'),
  working_dir: z.string().optional().describe('Working directory'),
}).describe('Input for git command');

export type GitInput = z.infer<typeof GitInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const GitOutputSchema = z.object({
  command: z.string().describe('Full git command executed'),
  stdout: z.string().describe('Standard output'),
  stderr: z.string().describe('Standard error'),
  exit_code: z.number().int().describe('Exit code'),
}).describe('Result of git command');

export type GitOutput = z.infer<typeof GitOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class GitTool extends Tool {
  public readonly name = 'git';
  public readonly description = 'Execute git commands for version control operations';
  public readonly documentation = `
## Git Tool

Executes git commands for version control:
- Repository status and history
- Code changes (diff)
- Commit operations
- Branch management
- Remote operations

### Input Parameters

- **command** (required): Git subcommand (status, diff, log, add, commit, etc.)
- **args** (optional): Command arguments as array
- **working_dir** (optional): Working directory (must be a git repo)

### Supported Commands

- status: Check repository status
- diff: Show changes
- log: View commit history
- add: Stage files
- commit: Create commit
- push: Push to remote
- pull: Pull from remote
- fetch: Fetch from remote
- branch: List/create branches
- checkout: Switch branches
- clone: Clone repository
- reset: Reset changes
- stash: Stash changes
- merge: Merge branches
- rebase: Rebase branch

### Examples

Check status:
\`\`\`json
{
  "command": "status"
}
\`\`\`

View diff:
\`\`\`json
{
  "command": "diff"
}
\`\`\`

Commit changes:
\`\`\`json
{
  "command": "commit",
  "args": ["-m", "Fix bug in authentication"]
}
\`\`\`

View log:
\`\`\`json
{
  "command": "log",
  "args": ["--oneline", "-10"]
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = GitInputSchema;
  public readonly outputSchema = GitOutputSchema;
  public readonly tags = ['git', 'version-control', 'vcs', 'scm'];
  public readonly examples = [
    { description: 'Check status', input: { command: 'status' } },
    { description: 'View diff', input: { command: 'diff' } },
    { description: 'Commit', input: { command: 'commit', args: ['-m', 'Fix bug'] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as GitInput;

    try {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      const fullCommand = `git ${params.command} ${params.args.map(a => `"${a}"`).join(' ')}`.trim();

      const { stdout, stderr } = await execAsync(fullCommand, { cwd: workingDir });

      const output: GitOutput = {
        command: fullCommand,
        stdout: stdout || '',
        stderr: stderr || '',
        exit_code: 0,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      
      if (execError.stderr?.includes('not a git repository')) {
        return this.createErrorResult(startedAt, createToolError('NOT_A_GIT_REPO', 'Directory is not a git repository'));
      }

      const output: GitOutput = {
        command: `git ${params.command}`,
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        exit_code: execError.code || 1,
      };

      return {
        executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        status: ToolExecutionStatus.SUCCESS,
        toolName: this.name,
        startedAt,
        completedAt: new Date(),
        duration: Date.now() - startedAt.getTime(),
        success: execError.code === 0,
        data: output,
        output: this.formatOutput(output),
      };
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: GitOutput): string {
    const parts: string[] = [];
    parts.push(`$ ${output.command}`);
    
    if (output.stdout) {
      parts.push(output.stdout);
    }
    
    if (output.stderr) {
      parts.push('stderr:');
      parts.push(output.stderr);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: GitOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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

export default GitTool;
