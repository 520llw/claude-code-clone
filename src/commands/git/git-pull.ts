/**
 * @fileoverview Git Pull Command - /git-pull
 * @module commands/git/git-pull
 * @description Fetch from and integrate with another repository or local branch.
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
 * Pull result information
 * @interface PullResult
 */
interface PullResult {
  /** Remote fetched from */
  remote: string;
  /** Branch pulled */
  branch: string;
  /** Commits fetched */
  commitsFetched: number;
  /** Files changed */
  filesChanged: number;
  /** Insertions */
  insertions: number;
  /** Deletions */
  deletions: number;
  /** Whether fast-forward */
  fastForward: boolean;
  /** Whether merge was needed */
  mergeNeeded: boolean;
}

/**
 * Git Pull Command Implementation
 * @class GitPullCommand
 * @extends Command
 * @description Fetches from and integrates with another repository or local branch.
 * Supports rebase, fast-forward only, and various merge strategies.
 * 
 * @example
 * ```typescript
 * const cmd = new GitPullCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-pull',
 *   args: {},
 *   options: { rebase: true },
 *   raw: '/git-pull --rebase'
 * });
 * ```
 */
export class GitPullCommand extends Command {
  constructor() {
    super({
      name: 'git-pull',
      description: 'Fetch from and integrate with another repository or local branch',
      category: 'git',
      aliases: ['gpl', 'pull'],
      arguments: [
        {
          name: 'repository',
          description: 'Remote repository to pull from',
          required: false,
          type: 'string',
          default: 'origin'
        },
        {
          name: 'refspec',
          description: 'Ref spec to pull',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'r',
          long: 'rebase',
          description: 'Rebase current branch on top of upstream',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'ff-only',
          description: 'Refuse to merge and exit with non-zero status unless fast-forward',
          type: 'boolean',
          default: false
        },
        {
          short: 'n',
          long: 'no-commit',
          description: 'Perform merge but do not autocommit',
          type: 'boolean',
          default: false
        },
        {
          short: 's',
          long: 'squash',
          description: 'Squash commits into a single commit',
          type: 'boolean',
          default: false
        },
        {
          short: 'v',
          long: 'verbose',
          description: 'Be more verbose',
          type: 'boolean',
          default: false
        },
        {
          short: 'q',
          long: 'quiet',
          description: 'Be more quiet',
          type: 'boolean',
          default: false
        },
        {
          long: 'all',
          description: 'Fetch all remotes',
          type: 'boolean',
          default: false
        },
        {
          long: 'append',
          description: 'Append ref names and object names to .git/FETCH_HEAD',
          type: 'boolean',
          default: false
        },
        {
          long: 'depth',
          description: 'Limit fetching to n commits from tip',
          type: 'number'
        },
        {
          long: 'unshallow',
          description: 'Convert shallow repository to complete one',
          type: 'boolean',
          default: false
        },
        {
          long: 'update-shallow',
          description: 'Update .git/shallow to accept new refs',
          type: 'boolean',
          default: false
        },
        {
          long: 'tags',
          description: 'Fetch all tags from remote',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-tags',
          description: 'Do not fetch tags from remote',
          type: 'boolean',
          default: false
        },
        {
          long: 'prune',
          description: 'Remove remote-tracking references that no longer exist',
          type: 'boolean',
          default: false
        },
        {
          long: 'dry-run',
          description: 'Show what would be done without making changes',
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
          description: 'Pull from default remote',
          command: '/git-pull'
        },
        {
          description: 'Pull with rebase',
          command: '/git-pull --rebase'
        },
        {
          description: 'Pull specific branch',
          command: '/git-pull origin main'
        },
        {
          description: 'Fast-forward only',
          command: '/git-pull --ff-only'
        },
        {
          description: 'Fetch all remotes',
          command: '/git-pull --all'
        },
        {
          description: 'Dry run pull',
          command: '/git-pull --dry-run'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-fetch', 'git-push', 'git-merge'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        rebase?: boolean;
        'ff-only'?: boolean;
        'no-commit'?: boolean;
        squash?: boolean;
        verbose?: boolean;
        quiet?: boolean;
        all?: boolean;
        append?: boolean;
        depth?: number;
        unshallow?: boolean;
        'update-shallow'?: boolean;
        tags?: boolean;
        'no-tags'?: boolean;
        prune?: boolean;
        'dry-run'?: boolean;
        json?: boolean;
      };

      const repository = (args.args.repository as string) || 'origin';
      const refspec = args.args.refspec as string | undefined;

      // Check for uncommitted changes
      const hasUncommitted = await this.hasUncommittedChanges(context.cwd);
      if (hasUncommitted && !options['dry-run']) {
        const proceed = await context.input.confirm(
          'You have uncommitted changes. Pull may cause conflicts. Continue?',
          false
        );
        if (!proceed) {
          return CommandResultBuilder.failure('Pull cancelled');
        }
      }

      // Build git pull command
      const gitArgs = this.buildGitArgs(options, repository, refspec);

      // Execute git pull
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Parse result
      const result = this.parsePullOutput(output, repository);

      // Handle dry run
      if (options['dry-run']) {
        context.output.info('Dry run - nothing was pulled');
        context.output.write(output);
        return CommandResultBuilder.success({ dryRun: true });
      }

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
      
      if (errorMessage.includes('conflict')) {
        return CommandResultBuilder.failure(
          `Merge conflict: ${errorMessage}\n` +
          'Resolve conflicts and commit, or use /git-merge --abort to cancel.',
          1
        );
      }
      
      if (errorMessage.includes('ff-only')) {
        return CommandResultBuilder.failure(
          'Not possible to fast-forward, aborting.\n' +
          'Remove --ff-only to merge or use --rebase.',
          1
        );
      }
      
      return CommandResultBuilder.failure(`Pull failed: ${errorMessage}`, 1);
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
    repository: string,
    refspec?: string
  ): string[] {
    const args: string[] = ['pull'];

    if (options.rebase) args.push('--rebase');
    if (options['ff-only']) args.push('--ff-only');
    if (options['no-commit']) args.push('--no-commit');
    if (options.squash) args.push('--squash');
    if (options.verbose) args.push('--verbose');
    if (options.quiet) args.push('--quiet');
    if (options.all) args.push('--all');
    if (options.append) args.push('--append');
    if (options.depth) args.push(`--depth=${options.depth}`);
    if (options.unshallow) args.push('--unshallow');
    if (options['update-shallow']) args.push('--update-shallow');
    if (options.tags) args.push('--tags');
    if (options['no-tags']) args.push('--no-tags');
    if (options.prune) args.push('--prune');
    if (options['dry-run']) args.push('--dry-run');

    args.push(repository);

    if (refspec) {
      args.push(refspec);
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

  private parsePullOutput(output: string, remote: string): PullResult {
    const alreadyUpToDate = output.includes('Already up to date') || 
                            output.includes('Already up-to-date');
    
    const fastForward = output.includes('Fast-forward');
    const merge = output.includes('Merge made');
    const rebase = output.includes('Successfully rebased');

    // Parse stats
    const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    const filesChanged = statsMatch ? parseInt(statsMatch[1], 10) : 0;
    const insertions = statsMatch && statsMatch[2] ? parseInt(statsMatch[2], 10) : 0;
    const deletions = statsMatch && statsMatch[3] ? parseInt(statsMatch[3], 10) : 0;

    // Parse commits fetched
    const commitsMatch = output.match(/(\d+) commits?/);
    const commitsFetched = commitsMatch ? parseInt(commitsMatch[1], 10) : 0;

    return {
      remote,
      branch: '',
      commitsFetched: alreadyUpToDate ? 0 : commitsFetched,
      filesChanged,
      insertions,
      deletions,
      fastForward: fastForward || alreadyUpToDate,
      mergeNeeded: merge || rebase
    };
  }

  private displayResult(context: CommandContext, result: PullResult): void {
    if (result.commitsFetched === 0 && result.filesChanged === 0) {
      context.output.info('Already up to date.');
      return;
    }

    context.output.success(`Pulled from ${result.remote}`);
    
    if (result.commitsFetched > 0) {
      context.output.info(`  ${result.commitsFetched} commit(s) fetched`);
    }
    
    if (result.filesChanged > 0) {
      const stats: string[] = [`${result.filesChanged} file(s) changed`];
      if (result.insertions > 0) stats.push(`\x1b[32m+${result.insertions}\x1b[0m`);
      if (result.deletions > 0) stats.push(`\x1b[31m-${result.deletions}\x1b[0m`);
      context.output.info(`  ${stats.join(', ')}`);
    }

    if (result.fastForward) {
      context.output.info('  Fast-forward merge');
    } else if (result.mergeNeeded) {
      context.output.info('  Merge/rebase performed');
    }
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mMERGE VS REBASE\x1b[0m

  Merge (default): Creates a merge commit, preserves history.
  Rebase (--rebase): Rewrites history, linear commit graph.

  Use merge for: shared branches, preserving context
  Use rebase for: feature branches, clean history

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  Standard pull:
    /git-pull

  Pull with rebase (cleaner history):
    /git-pull --rebase

  Pull only if fast-forward possible:
    /git-pull --ff-only

  Pull and clean up deleted remote branches:
    /git-pull --prune

`;
  }
}

export default GitPullCommand;
