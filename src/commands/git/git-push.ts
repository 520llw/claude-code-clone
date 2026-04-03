/**
 * @fileoverview Git Push Command - /git-push
 * @module commands/git/git-push
 * @description Update remote refs along with associated objects.
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
 * Push result information
 * @interface PushResult
 */
interface PushResult {
  /** Remote name */
  remote: string;
  /** Branch pushed */
  branch: string;
  /** Old revision */
  oldRev?: string;
  /** New revision */
  newRev?: string;
  /** Whether created new branch */
  created: boolean;
  /** Whether deleted branch */
  deleted: boolean;
  /** Whether forced */
  forced: boolean;
}

/**
 * Git Push Command Implementation
 * @class GitPushCommand
 * @extends Command
 * @description Updates remote refs using local refs, sending objects necessary
 * to complete the given refs. Supports force push, tags, and delete operations.
 * 
 * @example
 * ```typescript
 * const cmd = new GitPushCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-push',
 *   args: {},
 *   options: { setUpstream: true },
 *   raw: '/git-push --set-upstream'
 * });
 * ```
 */
export class GitPushCommand extends Command {
  constructor() {
    super({
      name: 'git-push',
      description: 'Update remote refs along with associated objects',
      category: 'git',
      aliases: ['gp', 'push'],
      arguments: [
        {
          name: 'repository',
          description: 'Remote repository to push to',
          required: false,
          type: 'string',
          default: 'origin'
        },
        {
          name: 'refspec',
          description: 'Ref spec to push (e.g., main:main)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'u',
          long: 'set-upstream',
          description: 'Add upstream tracking reference',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'force',
          description: 'Force push (use with caution)',
          type: 'boolean',
          default: false
        },
        {
          short: 'F',
          long: 'force-with-lease',
          description: 'Force push only if remote matches',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'delete',
          description: 'Delete remote branch',
          type: 'boolean',
          default: false
        },
        {
          short: 't',
          long: 'tags',
          description: 'Push all tags',
          type: 'boolean',
          default: false
        },
        {
          short: 'n',
          long: 'dry-run',
          description: 'Do everything except actually send updates',
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
          long: 'porcelain',
          description: 'Produce machine-readable output',
          type: 'boolean',
          default: false
        },
        {
          long: 'follow-tags',
          description: 'Push annotated tags that are missing',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-verify',
          description: 'Bypass pre-push hook',
          type: 'boolean',
          default: false
        },
        {
          long: 'atomic',
          description: 'Request atomic transaction on remote',
          type: 'boolean',
          default: false
        },
        {
          long: 'prune',
          description: 'Remove remote branches that don\'t have local counterpart',
          type: 'boolean',
          default: false
        },
        {
          long: 'mirror',
          description: 'Push all refs under refs/',
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
          description: 'Push current branch to origin',
          command: '/git-push'
        },
        {
          description: 'Push and set upstream',
          command: '/git-push --set-upstream'
        },
        {
          description: 'Push specific branch',
          command: '/git-push origin feature-branch'
        },
        {
          description: 'Force push (dangerous)',
          command: '/git-push --force'
        },
        {
          description: 'Delete remote branch',
          command: '/git-push origin --delete old-branch'
        },
        {
          description: 'Push all tags',
          command: '/git-push --tags'
        },
        {
          description: 'Dry run push',
          command: '/git-push --dry-run'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-pull', 'git-fetch', 'git-branch'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        'set-upstream'?: boolean;
        force?: boolean;
        'force-with-lease'?: boolean;
        delete?: boolean;
        tags?: boolean;
        'dry-run'?: boolean;
        verbose?: boolean;
        quiet?: boolean;
        porcelain?: boolean;
        'follow-tags'?: boolean;
        'no-verify'?: boolean;
        atomic?: boolean;
        prune?: boolean;
        mirror?: boolean;
        json?: boolean;
      };

      const repository = (args.args.repository as string) || 'origin';
      const refspec = args.args.refspec as string | undefined;

      // Get current branch
      const currentBranch = await this.getCurrentBranch(context.cwd);

      // Safety check for force push
      if (options.force && !options['dry-run']) {
        const confirmed = await context.input.confirm(
          `⚠️  Force push to ${repository}/${currentBranch}? This can overwrite remote changes!`,
          false
        );
        if (!confirmed) {
          return CommandResultBuilder.failure('Force push cancelled');
        }
      }

      // Build git push command
      const gitArgs = this.buildGitArgs(options, repository, refspec, currentBranch);

      // Execute git push
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Parse result
      const result = this.parsePushOutput(output, repository, currentBranch);

      // Handle dry run
      if (options['dry-run']) {
        context.output.info('Dry run - nothing was pushed');
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
      
      if (errorMessage.includes('rejected')) {
        return CommandResultBuilder.failure(
          `Push rejected: ${errorMessage}\n` +
          'Pull latest changes first with /git-pull',
          1
        );
      }
      
      if (errorMessage.includes('could not resolve')) {
        return CommandResultBuilder.failure(
          'Remote repository not found. Check your remote configuration.',
          128
        );
      }
      
      return CommandResultBuilder.failure(`Push failed: ${errorMessage}`, 1);
    }
  }

  private async getCurrentBranch(cwd: string): Promise<string> {
    const output = await this.executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    return output.trim();
  }

  private buildGitArgs(
    options: Record<string, unknown>,
    repository: string,
    refspec: string | undefined,
    currentBranch: string
  ): string[] {
    const args: string[] = ['push'];

    if (options['set-upstream']) args.push('-u');
    if (options.force) args.push('--force');
    if (options['force-with-lease']) args.push('--force-with-lease');
    if (options.delete) args.push('--delete');
    if (options.tags) args.push('--tags');
    if (options['dry-run']) args.push('--dry-run');
    if (options.verbose) args.push('--verbose');
    if (options.quiet) args.push('--quiet');
    if (options.porcelain) args.push('--porcelain');
    if (options['follow-tags']) args.push('--follow-tags');
    if (options['no-verify']) args.push('--no-verify');
    if (options.atomic) args.push('--atomic');
    if (options.prune) args.push('--prune');
    if (options.mirror) args.push('--mirror');

    args.push(repository);

    if (refspec) {
      args.push(refspec);
    } else if (!options.tags && !options.delete) {
      args.push(currentBranch);
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

  private parsePushOutput(output: string, remote: string, branch: string): PushResult {
    const created = output.includes('new branch');
    const deleted = output.includes('deleted');
    const forced = output.includes('+') || output.includes('forced update');

    const revMatch = output.match(/([a-f0-9]+)\.\.\.([a-f0-9]+)/);

    return {
      remote,
      branch,
      oldRev: revMatch ? revMatch[1] : undefined,
      newRev: revMatch ? revMatch[2] : undefined,
      created,
      deleted,
      forced
    };
  }

  private displayResult(context: CommandContext, result: PushResult): void {
    if (result.created) {
      context.output.success(`Created branch '${result.branch}' on ${result.remote}`);
    } else if (result.deleted) {
      context.output.success(`Deleted branch '${result.branch}' from ${result.remote}`);
    } else if (result.forced) {
      context.output.warning(`Force pushed '${result.branch}' to ${result.remote}`);
    } else {
      context.output.success(`Pushed '${result.branch}' to ${result.remote}`);
    }
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mSAFETY NOTES\x1b[0m

  --force: Dangerous! Can overwrite others' work.
  Use --force-with-lease instead when possible.

  --force-with-lease: Safer force push that fails if
  remote has changes you haven't seen.

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  First push of new branch:
    /git-push --set-upstream

  Push to specific remote:
    /git-push upstream main

  Push tags:
    /git-push --tags

  Clean up remote branches:
    /git-push --prune

`;
  }
}

export default GitPushCommand;
