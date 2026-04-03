/**
 * @fileoverview Git Checkout Command - /git-checkout
 * @module commands/git/git-checkout
 * @description Switch branches or restore working tree files.
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
 * Checkout result information
 * @interface CheckoutResult
 */
interface CheckoutResult {
  /** Previous branch/commit */
  previous: string;
  /** New branch/commit */
  current: string;
  /** Whether new branch was created */
  created: boolean;
  /** Files affected */
  filesAffected: number;
}

/**
 * Git Checkout Command Implementation
 * @class GitCheckoutCommand
 * @extends Command
 * @description Switches branches or restores working tree files.
 * Supports creating new branches, checking out specific commits, and restoring files.
 * 
 * @example
 * ```typescript
 * const cmd = new GitCheckoutCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-checkout',
 *   args: { branch: 'feature-branch' },
 *   options: { create: true },
 *   raw: '/git-checkout feature-branch --create'
 * });
 * ```
 */
export class GitCheckoutCommand extends Command {
  constructor() {
    super({
      name: 'git-checkout',
      description: 'Switch branches or restore working tree files',
      category: 'git',
      aliases: ['gco', 'checkout', 'co'],
      arguments: [
        {
          name: 'branch',
          description: 'Branch, commit, or file to checkout',
          required: false,
          type: 'string'
        },
        {
          name: 'paths',
          description: 'Paths to restore (when checking out files)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'b',
          long: 'create',
          description: 'Create and checkout a new branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'B',
          long: 'force-create',
          description: 'Create/reset and checkout a branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'detach',
          description: 'Checkout commit as detached HEAD',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'force',
          description: 'Force checkout (discard local changes)',
          type: 'boolean',
          default: false
        },
        {
          short: 'm',
          long: 'merge',
          description: 'Perform 3-way merge with local changes',
          type: 'boolean',
          default: false
        },
        {
          short: 'p',
          long: 'patch',
          description: 'Interactively select hunks',
          type: 'boolean',
          default: false
        },
        {
          short: 'q',
          long: 'quiet',
          description: 'Suppress progress reporting',
          type: 'boolean',
          default: false
        },
        {
          short: 't',
          long: 'track',
          description: 'Set up tracking mode',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-track',
          description: 'Do not set up tracking',
          type: 'boolean',
          default: false
        },
        {
          long: 'orphan',
          description: 'Create a new orphan branch',
          type: 'boolean',
          default: false
        },
        {
          long: 'ours',
          description: 'Checkout our version for unmerged files',
          type: 'boolean',
          default: false
        },
        {
          long: 'theirs',
          description: 'Checkout their version for unmerged files',
          type: 'boolean',
          default: false
        },
        {
          long: 'recurse-submodules',
          description: 'Update submodules',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-recurse-submodules',
          description: 'Do not update submodules',
          type: 'boolean',
          default: false
        },
        {
          long: 'progress',
          description: 'Force progress reporting',
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
          description: 'Switch to existing branch',
          command: '/git-checkout feature-branch'
        },
        {
          description: 'Create and switch to new branch',
          command: '/git-checkout -b new-feature'
        },
        {
          description: 'Switch to specific commit',
          command: '/git-checkout abc123'
        },
        {
          description: 'Checkout file from another branch',
          command: '/git-checkout main -- src/file.ts'
        },
        {
          description: 'Discard changes to file',
          command: '/git-checkout -- src/file.ts'
        },
        {
          description: 'Create branch from specific commit',
          command: '/git-checkout -b hotfix HEAD~3'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-branch', 'git-switch', 'git-restore'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        create?: boolean;
        'force-create'?: boolean;
        detach?: boolean;
        force?: boolean;
        merge?: boolean;
        patch?: boolean;
        quiet?: boolean;
        track?: boolean;
        'no-track'?: boolean;
        orphan?: boolean;
        ours?: boolean;
        theirs?: boolean;
        'recurse-submodules'?: boolean;
        'no-recurse-submodules'?: boolean;
        progress?: boolean;
        json?: boolean;
      };

      const branch = args.args.branch as string | undefined;
      const paths = args.args.paths as string | undefined;

      // Get current branch before checkout
      const previousBranch = await this.getCurrentBranch(context.cwd);

      // Validate arguments
      if (!branch && !paths) {
        return CommandResultBuilder.failure(
          'Branch name or paths required.\n' +
          'Use /git-branch to list available branches.',
          1
        );
      }

      // Warn about uncommitted changes
      if (!options.force && branch && !paths) {
        const hasUncommitted = await this.hasUncommittedChanges(context.cwd);
        if (hasUncommitted) {
          const proceed = await context.input.confirm(
            'You have uncommitted changes. Continue checkout?',
            false
          );
          if (!proceed) {
            return CommandResultBuilder.failure('Checkout cancelled');
          }
        }
      }

      // Build git checkout command
      const gitArgs = this.buildGitArgs(options, branch, paths);

      // Execute git checkout
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Get new branch
      const currentBranch = await this.getCurrentBranch(context.cwd);

      // Parse result
      const result: CheckoutResult = {
        previous: previousBranch,
        current: currentBranch,
        created: options.create || options['force-create'] || false,
        filesAffected: this.countFilesAffected(output)
      };

      if (options.json) {
        return CommandResultBuilder.success(result);
      }

      this.displayResult(context, result, branch || '');

      return CommandResultBuilder.success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure('Not a git repository', 128);
      }
      
      if (errorMessage.includes('pathspec')) {
        return CommandResultBuilder.failure(
          `Path not found: ${errorMessage}`,
          1
        );
      }
      
      if (errorMessage.includes('did not match')) {
        return CommandResultBuilder.failure(
          `Branch or commit not found: ${errorMessage}\n` +
          'Use /git-branch to list available branches.',
          1
        );
      }
      
      if (errorMessage.includes('local changes')) {
        return CommandResultBuilder.failure(
          `${errorMessage}\n` +
          'Stash changes with /git-stash or use --force to discard.',
          1
        );
      }
      
      return CommandResultBuilder.failure(`Checkout failed: ${errorMessage}`, 1);
    }
  }

  private async getCurrentBranch(cwd: string): Promise<string> {
    try {
      const output = await this.executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      return output.trim();
    } catch {
      return 'HEAD';
    }
  }

  private async hasUncommittedChanges(cwd: string): Promise<boolean> {
    try {
      await this.executeGitCommand(['diff-index', '--quiet', 'HEAD', '--'], cwd);
      return false;
    } catch {
      return true;
    }
  }

  private buildGitArgs(
    options: Record<string, unknown>,
    branch?: string,
    paths?: string
  ): string[] {
    const args: string[] = ['checkout'];

    if (options.create) args.push('-b');
    if (options['force-create']) args.push('-B');
    if (options.detach) args.push('--detach');
    if (options.force) args.push('-f');
    if (options.merge) args.push('-m');
    if (options.patch) args.push('-p');
    if (options.quiet) args.push('-q');
    if (options.track) args.push('--track');
    if (options['no-track']) args.push('--no-track');
    if (options.orphan) args.push('--orphan');
    if (options.ours) args.push('--ours');
    if (options.theirs) args.push('--theirs');
    if (options['recurse-submodules']) args.push('--recurse-submodules');
    if (options['no-recurse-submodules']) args.push('--no-recurse-submodules');
    if (options.progress) args.push('--progress');

    if (branch) {
      args.push(branch);
    }

    if (paths) {
      args.push('--');
      args.push(paths);
    }

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

  private countFilesAffected(output: string): number {
    const matches = output.match(/M\s+\S+/g);
    return matches ? matches.length : 0;
  }

  private displayResult(context: CommandContext, result: CheckoutResult, target: string): void {
    if (result.created) {
      context.output.success(`Created and switched to branch '${result.current}'`);
    } else if (result.previous !== result.current) {
      context.output.success(`Switched to '${result.current}'`);
      if (result.previous) {
        context.output.info(`  (from '${result.previous}')`);
      }
    } else if (target.includes('/') || target.includes('.')) {
      context.output.success(`Restored '${target}'`);
    } else {
      context.output.info(`Already on '${result.current}'`);
    }

    if (result.filesAffected > 0) {
      context.output.info(`  ${result.filesAffected} file(s) affected`);
    }
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mDETACHED HEAD STATE\x1b[0m

  When checking out a commit (not a branch), you enter "detached HEAD" state.
  Changes made here won't belong to any branch. Create a branch to save work:
    /git-checkout -b new-branch

\x1b[1m\x1b[36mRESTORING FILES\x1b[0m

  Restore file from another branch:
    /git-checkout main -- path/to/file

  Discard local changes:
    /git-checkout -- path/to/file

  Restore all files:
    /git-checkout -- .

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  Switch to feature branch:
    /git-checkout feature-name

  Create and switch to new branch:
    /git-checkout -b new-feature

  Quick fix on main:
    /git-checkout -b hotfix/fix-bug main

`;
  }
}

export default GitCheckoutCommand;
