/**
 * @fileoverview Git Stash Command - /git-stash
 * @module commands/git/git-stash
 * @description Stash changes in a dirty working directory away.
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
 * Stash entry information
 * @interface StashEntry
 */
interface StashEntry {
  /** Stash index */
  index: number;
  /** Stash reference */
  ref: string;
  /** Commit message */
  message: string;
  /** Branch when stashed */
  branch?: string;
  /** Commit hash */
  commit?: string;
}

/**
 * Git Stash Command Implementation
 * @class GitStashCommand
 * @extends Command
 * @description Stashes changes in a dirty working directory away.
 * Supports push, pop, apply, list, show, drop, and clear operations.
 * 
 * @example
 * ```typescript
 * const cmd = new GitStashCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-stash',
 *   args: {},
 *   options: { push: true, message: 'WIP' },
 *   raw: '/git-stash push -m "WIP"'
 * });
 * ```
 */
export class GitStashCommand extends Command {
  constructor() {
    super({
      name: 'git-stash',
      description: 'Stash changes in a dirty working directory away',
      category: 'git',
      aliases: ['gstsh', 'stash'],
      arguments: [
        {
          name: 'command',
          description: 'Stash command (push, pop, apply, list, show, drop, clear)',
          required: false,
          type: 'string',
          choices: ['push', 'pop', 'apply', 'list', 'show', 'drop', 'clear', 'branch'],
          default: 'push'
        },
        {
          name: 'stash',
          description: 'Stash reference (e.g., stash@{0})',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'p',
          long: 'patch',
          description: 'Interactively select hunks',
          type: 'boolean',
          default: false
        },
        {
          short: 'k',
          long: 'keep-index',
          description: 'Keep changes in index after stash',
          type: 'boolean',
          default: false
        },
        {
          short: 'u',
          long: 'include-untracked',
          description: 'Include untracked files in stash',
          type: 'boolean',
          default: false
        },
        {
          short: 'a',
          long: 'all',
          description: 'Include ignored files in stash',
          type: 'boolean',
          default: false
        },
        {
          short: 'm',
          long: 'message',
          description: 'Stash message',
          type: 'string'
        },
        {
          short: 'q',
          long: 'quiet',
          description: 'Suppress feedback messages',
          type: 'boolean',
          default: false
        },
        {
          short: 'i',
          long: 'index',
          description: 'Try to restore index state',
          type: 'boolean',
          default: false
        },
        {
          long: 'hard',
          description: 'Reset index and working tree',
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
          description: 'Stash current changes',
          command: '/git-stash'
        },
        {
          description: 'Stash with message',
          command: '/git-stash push -m "WIP: feature work"'
        },
        {
          description: 'Stash including untracked',
          command: '/git-stash push -u'
        },
        {
          description: 'List stashes',
          command: '/git-stash list'
        },
        {
          description: 'Apply most recent stash',
          command: '/git-stash pop'
        },
        {
          description: 'Apply specific stash',
          command: '/git-stash apply stash@{1}'
        },
        {
          description: 'Drop a stash',
          command: '/git-stash drop stash@{0}'
        },
        {
          description: 'Clear all stashes',
          command: '/git-stash clear'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-checkout', 'git-reset', 'git-status'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        patch?: boolean;
        'keep-index'?: boolean;
        'include-untracked'?: boolean;
        all?: boolean;
        message?: string;
        quiet?: boolean;
        index?: boolean;
        hard?: boolean;
        json?: boolean;
      };

      const command = (args.args.command as string) || 'push';
      const stashRef = args.args.stash as string | undefined;

      // Execute appropriate subcommand
      switch (command) {
        case 'push':
          return await this.stashPush(context, options);
        case 'pop':
          return await this.stashPop(context, stashRef, options);
        case 'apply':
          return await this.stashApply(context, stashRef, options);
        case 'list':
          return await this.stashList(context, options);
        case 'show':
          return await this.stashShow(context, stashRef, options);
        case 'drop':
          return await this.stashDrop(context, stashRef);
        case 'clear':
          return await this.stashClear(context);
        default:
          return CommandResultBuilder.failure(`Unknown stash command: ${command}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure('Not a git repository', 128);
      }
      
      if (errorMessage.includes('No stash entries')) {
        return CommandResultBuilder.failure('No stash entries found', 1);
      }
      
      if (errorMessage.includes('conflict')) {
        return CommandResultBuilder.failure(
          `Stash application conflicted: ${errorMessage}\n` +
          'Resolve conflicts manually.',
          1
        );
      }
      
      return CommandResultBuilder.failure(`Stash operation failed: ${errorMessage}`, 1);
    }
  }

  private async stashPush(
    context: CommandContext,
    options: Record<string, unknown>
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'push'];

    if (options.patch) args.push('-p');
    if (options['keep-index']) args.push('-k');
    if (options['include-untracked']) args.push('-u');
    if (options.all) args.push('-a');
    if (options.message) args.push('-m', options.message as string);
    if (options.quiet) args.push('-q');

    const output = await this.executeGitCommand(args, context.cwd);

    if (options.json) {
      return CommandResultBuilder.success({ pushed: true, output });
    }

    if (output.includes('No local changes')) {
      context.output.info('No local changes to save');
      return CommandResultBuilder.success({ pushed: false });
    }

    const message = options.message ? `"${options.message}"` : 'changes';
    context.output.success(`Stashed ${message}`);
    return CommandResultBuilder.success({ pushed: true });
  }

  private async stashPop(
    context: CommandContext,
    stashRef: string | undefined,
    options: Record<string, unknown>
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'pop'];

    if (options.index) args.push('--index');
    if (options.quiet) args.push('-q');
    if (stashRef) args.push(stashRef);

    const output = await this.executeGitCommand(args, context.cwd);

    if (options.json) {
      return CommandResultBuilder.success({ popped: true, output });
    }

    context.output.success(`Applied and dropped stash`);
    return CommandResultBuilder.success({ popped: true });
  }

  private async stashApply(
    context: CommandContext,
    stashRef: string | undefined,
    options: Record<string, unknown>
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'apply'];

    if (options.index) args.push('--index');
    if (options.quiet) args.push('-q');
    if (stashRef) args.push(stashRef);

    const output = await this.executeGitCommand(args, context.cwd);

    if (options.json) {
      return CommandResultBuilder.success({ applied: true, output });
    }

    context.output.success(`Applied stash`);
    return CommandResultBuilder.success({ applied: true });
  }

  private async stashList(
    context: CommandContext,
    options: Record<string, unknown>
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'list'];

    const output = await this.executeGitCommand(args, context.cwd);
    const stashes = this.parseStashList(output);

    if (options.json) {
      return CommandResultBuilder.success({ stashes });
    }

    if (stashes.length === 0) {
      context.output.info('No stashes found');
      return CommandResultBuilder.success({ count: 0 });
    }

    context.output.write('\n\x1b[1mStash List:\x1b[0m\n');
    for (const stash of stashes) {
      context.output.write(`  \x1b[36m${stash.ref}\x1b[0m: ${stash.message}\n`);
    }
    context.output.write('');

    return CommandResultBuilder.success({ count: stashes.length });
  }

  private async stashShow(
    context: CommandContext,
    stashRef: string | undefined,
    options: Record<string, unknown>
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'show'];

    if (options.patch !== false) args.push('-p');
    if (stashRef) args.push(stashRef);

    const output = await this.executeGitCommand(args, context.cwd);

    context.output.write(output);
    return CommandResultBuilder.success({ shown: true });
  }

  private async stashDrop(
    context: CommandContext,
    stashRef: string | undefined
  ): Promise<CommandResult> {
    const args: string[] = ['stash', 'drop'];
    if (stashRef) args.push(stashRef);

    await this.executeGitCommand(args, context.cwd);

    context.output.success(`Dropped ${stashRef || 'stash@{0}'}`);
    return CommandResultBuilder.success({ dropped: true });
  }

  private async stashClear(context: CommandContext): Promise<CommandResult> {
    const confirmed = await context.input.confirm(
      'Clear all stashes? This cannot be undone.',
      false
    );

    if (!confirmed) {
      return CommandResultBuilder.failure('Clear cancelled');
    }

    await this.executeGitCommand(['stash', 'clear'], context.cwd);

    context.output.success('All stashes cleared');
    return CommandResultBuilder.success({ cleared: true });
  }

  private parseStashList(output: string): StashEntry[] {
    const stashes: StashEntry[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/^(stash@\{(\d+)\}):\s+(.+)$/);
      if (match) {
        stashes.push({
          ref: match[1],
          index: parseInt(match[2], 10),
          message: match[3]
        });
      }
    }

    return stashes;
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

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mSTASH WORKFLOW\x1b[0m

  1. Save current work:
     /git-stash push -m "WIP: refactoring"

  2. Switch branches and do other work

  3. Return and restore:
     /git-stash pop

\x1b[1m\x1b[36mSTASH COMMANDS\x1b[0m

  push    - Save changes to stash (default)
  pop     - Apply and remove most recent stash
  apply   - Apply stash but keep it
  list    - Show all stashes
  show    - Show stash contents
  drop    - Remove a stash
  clear   - Remove all stashes

\x1b[1m\x1b[36mTIPS\x1b[0m

  - Use descriptive messages: /git-stash push -m "before refactor"
  - Include untracked: /git-stash push -u
  - Apply without removing: /git-stash apply
  - Create branch from stash: /git-stash branch new-branch stash@{0}

`;
  }
}

export default GitStashCommand;
