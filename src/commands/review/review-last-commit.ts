/**
 * @fileoverview Review Last Commit Command - /review-last-commit
 * @module commands/review/review-last-commit
 * @description Review the most recent commit.
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
 * Review Last Commit Command Implementation
 * @class ReviewLastCommitCommand
 * @extends Command
 * @description Reviews the most recent commit with detailed analysis.
 * 
 * @example
 * ```typescript
 * const cmd = new ReviewLastCommitCommand();
 * const result = await cmd.run(context, {
 *   command: 'review-last-commit',
 *   args: {},
 *   options: { detailed: true },
 *   raw: '/review-last-commit --detailed'
 * });
 * ```
 */
export class ReviewLastCommitCommand extends Command {
  constructor() {
    super({
      name: 'review-last-commit',
      description: 'Review the most recent commit',
      category: 'review',
      aliases: ['rlc', 'review-commit'],
      arguments: [
        {
          name: 'commit',
          description: 'Commit hash to review (default: HEAD)',
          required: false,
          type: 'string',
          default: 'HEAD'
        }
      ],
      options: [
        {
          short: 'd',
          long: 'detailed',
          description: 'Show detailed review',
          type: 'boolean',
          default: false
        },
        {
          short: 'p',
          long: 'patch',
          description: 'Show the patch/diff',
          type: 'boolean',
          default: true
        },
        {
          short: 's',
          long: 'stat',
          description: 'Show diff statistics',
          type: 'boolean',
          default: true
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
          description: 'Review last commit',
          command: '/review-last-commit'
        },
        {
          description: 'Review specific commit',
          command: '/review-last-commit abc123'
        },
        {
          description: 'Detailed review',
          command: '/review-last-commit --detailed'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['review-file', 'review-changes', 'git-show'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        detailed?: boolean;
        patch?: boolean;
        stat?: boolean;
        json?: boolean;
      };

      const commit = (args.args.commit as string) || 'HEAD';

      // Get commit info
      const commitInfo = await this.getCommitInfo(context, commit);

      // Get diff
      const diffArgs = ['show'];
      if (options.stat) diffArgs.push('--stat');
      if (options.patch) diffArgs.push('-p');
      diffArgs.push(commit);

      const diffOutput = await this.executeGitCommand(diffArgs, context.cwd);

      // Analyze
      const analysis = this.analyzeCommit(commitInfo.message, diffOutput);

      if (options.json) {
        return CommandResultBuilder.success({
          commit: commitInfo,
          analysis,
          diff: options.patch ? diffOutput : undefined
        });
      }

      // Display
      context.output.write('\n\x1b[1mReview: Last Commit\x1b[0m\n\n');
      context.output.write(`\x1b[36mCommit:\x1b[0m ${commitInfo.hash}\n`);
      context.output.write(`\x1b[36mAuthor:\x1b[0m ${commitInfo.author} <${commitInfo.email}>\n`);
      context.output.write(`\x1b[36mDate:\x1b[0m ${commitInfo.date}\n`);
      context.output.write(`\x1b[36mMessage:\x1b[0m ${commitInfo.message}\n\n`);

      if (analysis.issues.length > 0) {
        context.output.write(`\x1b[1mIssues (${analysis.issues.length}):\x1b[0m\n`);
        for (const issue of analysis.issues) {
          context.output.write(`  ⚠ ${issue}\n`);
        }
        context.output.write('\n');
      }

      if (options.patch) {
        context.output.write('\x1b[1mChanges:\x1b[0m\n');
        context.output.write(diffOutput);
      }

      return CommandResultBuilder.success({
        hash: commitInfo.hash,
        issues: analysis.issues.length
      });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Review failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getCommitInfo(
    context: CommandContext,
    commit: string
  ): Promise<{
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
  }> {
    const format = '%H|%an|%ae|%ad|%s';
    const output = await this.executeGitCommand(
      ['log', '-1', '--format=' + format, commit],
      context.cwd
    );

    const parts = output.trim().split('|');
    return {
      hash: parts[0]?.substring(0, 12) || commit,
      author: parts[1] || 'Unknown',
      email: parts[2] || '',
      date: parts[3] || '',
      message: parts[4] || ''
    };
  }

  private analyzeCommit(message: string, diff: string): {
    issues: string[];
  } {
    const issues: string[] = [];

    // Check message
    if (message.length < 10) {
      issues.push('Commit message is very short');
    }
    if (message.length > 72 && !message.includes('\n')) {
      issues.push('Commit subject exceeds 72 characters');
    }

    // Check diff
    if (diff.includes('console.log')) {
      issues.push('Contains console.log statements');
    }
    if (diff.includes('debugger')) {
      issues.push('Contains debugger statements');
    }
    if (diff.includes('TODO') || diff.includes('FIXME')) {
      issues.push('Contains TODO/FIXME comments');
    }

    return { issues };
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

export default ReviewLastCommitCommand;
