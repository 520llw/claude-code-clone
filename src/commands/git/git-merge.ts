/**
 * @fileoverview Git Merge Command - /git-merge
 * @module commands/git/git-merge
 * @description Join two or more development histories together.
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
 * Merge result information
 * @interface MergeResult
 */
interface MergeResult {
  /** Source branch/commit */
  source: string;
  /** Target branch */
  target: string;
  /** Whether fast-forward */
  fastForward: boolean;
  /** Whether merge commit created */
  mergeCommit: boolean;
  /** Merge commit hash */
  commitHash?: string;
  /** Files changed */
  filesChanged: number;
  /** Conflicts */
  conflicts: number;
}

/**
 * Git Merge Command Implementation
 * @class GitMergeCommand
 * @extends Command
 * @description Joins two or more development histories together.
 * Supports various merge strategies and conflict resolution.
 * 
 * @example
 * ```typescript
 * const cmd = new GitMergeCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-merge',
 *   args: { commit: 'feature-branch' },
 *   options: { 'no-ff': true },
 *   raw: '/git-merge feature-branch --no-ff'
 * });
 * ```
 */
export class GitMergeCommand extends Command {
  constructor() {
    super({
      name: 'git-merge',
      description: 'Join two or more development histories together',
      category: 'git',
      aliases: ['gm', 'merge'],
      arguments: [
        {
          name: 'commit',
          description: 'Commit or branch to merge into current',
          required: true,
          type: 'string'
        },
        {
          name: 'commits',
          description: 'Additional commits to merge',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'n',
          long: 'no-commit',
          description: 'Perform merge but do not autocommit',
          type: 'boolean',
          default: false
        },
        {
          short: 'e',
          long: 'edit',
          description: 'Edit message before committing',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'no-ff',
          description: 'Create merge commit even if fast-forward possible',
          type: 'boolean',
          default: false
        },
        {
          short: 'F',
          long: 'ff-only',
          description: 'Refuse to merge unless fast-forward possible',
          type: 'boolean',
          default: false
        },
        {
          short: 's',
          long: 'strategy',
          description: 'Merge strategy to use',
          type: 'string',
          choices: ['resolve', 'recursive', 'octopus', 'ours', 'subtree']
        },
        {
          short: 'X',
          long: 'strategy-option',
          description: 'Strategy-specific option',
          type: 'string'
        },
        {
          short: 'm',
          long: 'message',
          description: 'Merge commit message',
          type: 'string'
        },
        {
          short: 'v',
          long: 'verbose',
          description: 'Be verbose',
          type: 'boolean',
          default: false
        },
        {
          short: 'q',
          long: 'quiet',
          description: 'Be quiet',
          type: 'boolean',
          default: false
        },
        {
          long: 'abort',
          description: 'Abort the current conflict resolution process',
          type: 'boolean',
          default: false
        },
        {
          long: 'continue',
          description: 'Continue the merge after resolving conflicts',
          type: 'boolean',
          default: false
        },
        {
          long: 'squash',
          description: 'Squash commits into a single commit',
          type: 'boolean',
          default: false
        },
        {
          long: 'stat',
          description: 'Show diffstat at end of merge',
          type: 'boolean',
          default: true
        },
        {
          long: 'no-stat',
          description: 'Do not show diffstat',
          type: 'boolean',
          default: false
        },
        {
          long: 'log',
          description: 'Add list of merged commits to message',
          type: 'boolean',
          default: false
        },
        {
          long: 'signoff',
          description: 'Add Signed-off-by line',
          type: 'boolean',
          default: false
        },
        {
          long: 'gpg-sign',
          description: 'GPG-sign the merge commit',
          type: 'boolean',
          default: false
        },
        {
          long: 'verify-signatures',
          description: 'Verify commit signatures',
          type: 'boolean',
          default: false
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
          description: 'Merge a branch',
          command: '/git-merge feature-branch'
        },
        {
          description: 'Merge without fast-forward',
          command: '/git-merge feature-branch --no-ff'
        },
        {
          description: 'Merge with message',
          command: '/git-merge feature-branch -m "Merge feature"'
        },
        {
          description: 'Squash merge',
          command: '/git-merge feature-branch --squash'
        },
        {
          description: 'Abort merge',
          command: '/git-merge --abort'
        },
        {
          description: 'Continue after resolving conflicts',
          command: '/git-merge --continue'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-branch', 'git-rebase', 'git-checkout'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        'no-commit'?: boolean;
        edit?: boolean;
        'no-ff'?: boolean;
        'ff-only'?: boolean;
        strategy?: string;
        'strategy-option'?: string;
        message?: string;
        verbose?: boolean;
        quiet?: boolean;
        abort?: boolean;
        continue?: boolean;
        squash?: boolean;
        stat?: boolean;
        'no-stat'?: boolean;
        log?: boolean;
        signoff?: boolean;
        'gpg-sign'?: boolean;
        'verify-signatures'?: boolean;
        json?: boolean;
      };

      const commit = args.args.commit as string;

      // Handle abort
      if (options.abort) {
        return await this.mergeAbort(context);
      }

      // Handle continue
      if (options.continue) {
        return await this.mergeContinue(context);
      }

      // Check for uncommitted changes
      const hasUncommitted = await this.hasUncommittedChanges(context.cwd);
      if (hasUncommitted && !options.squash) {
        const proceed = await context.input.confirm(
          'You have uncommitted changes. Continue merge?',
          false
        );
        if (!proceed) {
          return CommandResultBuilder.failure('Merge cancelled');
        }
      }

      // Get current branch
      const currentBranch = await this.getCurrentBranch(context.cwd);

      // Build git merge command
      const gitArgs = this.buildGitArgs(options, commit);

      // Execute git merge
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Parse result
      const result = this.parseMergeOutput(output, commit, currentBranch);

      if (options.json) {
        return CommandResultBuilder.success(result);
      }

      this.displayResult(context, result);

      return CommandResultBuilder.success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure('Not a git repository', 128);
      }
      
      if (errorMessage.includes('CONFLICT')) {
        return CommandResultBuilder.failure(
          `Merge conflict! Resolve conflicts and run:\n` +
          '  /git-merge --continue\n' +
          'Or abort with:\n' +
          '  /git-merge --abort',
          1
        );
      }
      
      if (errorMessage.includes('ff-only')) {
        return CommandResultBuilder.failure(
          'Fast-forward not possible with --ff-only',
          1
        );
      }
      
      if (errorMessage.includes('Already up to date')) {
        context.output.info('Already up to date');
        return CommandResultBuilder.success({ upToDate: true });
      }
      
      return CommandResultBuilder.failure(`Merge failed: ${errorMessage}`, 1);
    }
  }

  private async mergeAbort(context: CommandContext): Promise<CommandResult> {
    await this.executeGitCommand(['merge', '--abort'], context.cwd);
    context.output.success('Merge aborted');
    return CommandResultBuilder.success({ aborted: true });
  }

  private async mergeContinue(context: CommandContext): Promise<CommandResult> {
    await this.executeGitCommand(['merge', '--continue'], context.cwd);
    context.output.success('Merge completed');
    return CommandResultBuilder.success({ continued: true });
  }

  private async hasUncommittedChanges(cwd: string): Promise<boolean> {
    try {
      await this.executeGitCommand(['diff-index', '--quiet', 'HEAD', '--'], cwd);
      return false;
    } catch {
      return true;
    }
  }

  private async getCurrentBranch(cwd: string): Promise<string> {
    const output = await this.executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    return output.trim();
  }

  private buildGitArgs(options: Record<string, unknown>, commit: string): string[] {
    const args: string[] = ['merge'];

    if (options['no-commit']) args.push('--no-commit');
    if (options.edit) args.push('--edit');
    if (options['no-ff']) args.push('--no-ff');
    if (options['ff-only']) args.push('--ff-only');
    if (options.strategy) args.push('--strategy', options.strategy as string);
    if (options['strategy-option']) args.push('-X', options['strategy-option'] as string);
    if (options.message) args.push('-m', options.message as string);
    if (options.verbose) args.push('--verbose');
    if (options.quiet) args.push('--quiet');
    if (options.squash) args.push('--squash');
    if (options['no-stat']) args.push('--no-stat');
    if (options.log) args.push('--log');
    if (options.signoff) args.push('--signoff');
    if (options['gpg-sign']) args.push('--gpg-sign');
    if (options['verify-signatures']) args.push('--verify-signatures');

    args.push(commit);

    return args;
  }

  private async executeGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(stderr || stdout || `Git exited with code ${code}`));
        } else {
          resolve(stdout || stderr);
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseMergeOutput(output: string, source: string, target: string): MergeResult {
    const fastForward = output.includes('Fast-forward');
    const mergeCommit = output.includes('Merge made') || output.includes('Merge:');
    const conflicts = (output.match(/CONFLICT/g) || []).length;

    const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    const filesChanged = statsMatch ? parseInt(statsMatch[1], 10) : 0;

    const hashMatch = output.match(/Merge:\s+([a-f0-9]+)\s+([a-f0-9]+)/);

    return {
      source,
      target,
      fastForward,
      mergeCommit,
      commitHash: hashMatch ? hashMatch[2] : undefined,
      filesChanged,
      conflicts
    };
  }

  private displayResult(context: CommandContext, result: MergeResult): void {
    if (result.conflicts > 0) {
      context.output.error(`Merge has ${result.conflicts} conflict(s)`);
      context.output.info('Resolve conflicts and run: /git-merge --continue');
      return;
    }

    if (result.fastForward) {
      context.output.success(`Fast-forward merged ${result.source} into ${result.target}`);
    } else if (result.mergeCommit) {
      context.output.success(`Merged ${result.source} into ${result.target}`);
      if (result.commitHash) {
        context.output.info(`  Merge commit: ${result.commitHash.substring(0, 7)}`);
      }
    }

    if (result.filesChanged > 0) {
      context.output.info(`  ${result.filesChanged} file(s) changed`);
    }
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mMERGE STRATEGIES\x1b[0m

  recursive (default): Standard 3-way merge
  resolve:             Older algorithm, resolves conflicts
  octopus:             Merge multiple branches
  ours:                Use current branch's changes
  subtree:             Merge with subtree handling

\x1b[1m\x1b[36mFAST-FORWARD\x1b[0m

  When possible, git performs a fast-forward merge (no merge commit).
  Use --no-ff to always create a merge commit for history clarity.
  Use --ff-only to only allow fast-forward merges.

\x1b[1m\x1b[36mCONFLICT RESOLUTION\x1b[0m

  1. Edit conflicted files and resolve markers
  2. Stage resolved files: /git-add <file>
  3. Complete merge: /git-merge --continue

  Or abort the merge: /git-merge --abort

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  Standard merge:
    /git-merge feature-branch

  Create merge commit:
    /git-merge feature-branch --no-ff -m "Merge feature"

  Squash merge:
    /git-merge feature-branch --squash

`;
  }
}

export default GitMergeCommand;
