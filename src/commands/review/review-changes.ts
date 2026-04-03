/**
 * @fileoverview Review Changes Command - /review-changes
 * @module commands/review/review-changes
 * @description Review uncommitted changes in the working directory.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { spawn } from 'child_process';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Review Changes Command Implementation
 * @class ReviewChangesCommand
 * @extends Command
 * @description Reviews uncommitted changes in the working directory,
 * including staged and unstaged modifications.
 * 
 * @example
 * ```typescript
 * const cmd = new ReviewChangesCommand();
 * const result = await cmd.run(context, {
 *   command: 'review-changes',
 *   args: {},
 *   options: { staged: true },
 *   raw: '/review-changes --staged'
 * });
 * ```
 */
export class ReviewChangesCommand extends Command {
  constructor() {
    super({
      name: 'review-changes',
      description: 'Review uncommitted changes in the working directory',
      category: 'review',
      aliases: ['rc', 'review-uncommitted'],
      arguments: [
        {
          name: 'path',
          description: 'Specific path to review',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 's',
          long: 'staged',
          description: 'Review staged changes only',
          type: 'boolean',
          default: false
        },
        {
          short: 'u',
          long: 'unstaged',
          description: 'Review unstaged changes only',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'detailed',
          description: 'Show detailed review with suggestions',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'focus',
          description: 'Focus on specific areas',
          type: 'array',
          choices: ['security', 'performance', 'style']
        },
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Review all changes',
          command: '/review-changes'
        },
        {
          description: 'Review staged changes',
          command: '/review-changes --staged'
        },
        {
          description: 'Review specific file',
          command: '/review-changes src/index.ts'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['review-file', 'review-pr', 'git-diff'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        staged?: boolean;
        unstaged?: boolean;
        detailed?: boolean;
        focus?: string[];
        json?: boolean;
      };

      const path = args.args.path as string | undefined;

      // Get changed files
      let diffArgs = ['diff', '--name-only'];
      if (options.staged) diffArgs.push('--cached');
      if (path) {
        diffArgs.push('--');
        diffArgs.push(path);
      }

      const changedFiles = await this.executeGitCommand(diffArgs, context.cwd);
      const files = changedFiles.split('\n').filter(f => f.trim());

      if (files.length === 0) {
        context.output.info('No changes to review');
        return CommandResultBuilder.success({ empty: true });
      }

      // Get diff content
      diffArgs = ['diff'];
      if (options.staged) diffArgs.push('--cached');
      diffArgs.push('-p');
      if (path) {
        diffArgs.push('--');
        diffArgs.push(path);
      }

      const diffOutput = await this.executeGitCommand(diffArgs, context.cwd);

      // Analyze changes
      const analysis = this.analyzeDiff(diffOutput);

      if (options.json) {
        return CommandResultBuilder.success({
          filesChanged: files.length,
          insertions: analysis.insertions,
          deletions: analysis.deletions,
          issues: analysis.issues,
          files
        });
      }

      // Display results
      context.output.write('\n\x1b[1mReview: Uncommitted Changes\x1b[0m\n\n');
      context.output.write(`Files changed: ${files.length}\n`);
      context.output.write(`Insertions: \x1b[32m+${analysis.insertions}\x1b[0m\n`);
      context.output.write(`Deletions: \x1b[31m-${analysis.deletions}\x1b[0m\n\n`);

      context.output.write('\x1b[1mChanged Files:\x1b[0m\n');
      for (const file of files) {
        context.output.write(`  • ${file}\n`);
      }

      if (analysis.issues.length > 0) {
        context.output.write(`\n\x1b[1mIssues Found (${analysis.issues.length}):\x1b[0m\n`);
        for (const issue of analysis.issues) {
          context.output.write(`  ⚠ ${issue}\n`);
        }
      }

      context.output.write('\n');

      return CommandResultBuilder.success({
        filesChanged: files.length,
        insertions: analysis.insertions,
        deletions: analysis.deletions
      });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Review failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private analyzeDiff(diff: string): {
    insertions: number;
    deletions: number;
    issues: string[];
  } {
    const lines = diff.split('\n');
    let insertions = 0;
    let deletions = 0;
    const issues: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) insertions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;

      // Check for common issues
      if (line.includes('console.log') || line.includes('console.warn')) {
        issues.push('Console statement found');
      }
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push('TODO/FIXME comment found');
      }
      if (line.includes('debugger')) {
        issues.push('Debugger statement found');
      }
    }

    return { insertions, deletions, issues: [...new Set(issues)] };
  }

  private async executeGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd, env: process.env });
      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => stdout += data.toString());
      git.stderr.on('data', (data) => stderr += data.toString());
      git.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(stderr || `Git exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });
      git.on('error', reject);
    });
  }
}

export default ReviewChangesCommand;
