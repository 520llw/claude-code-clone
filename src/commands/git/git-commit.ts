/**
 * @fileoverview Git Commit Command - /git-commit
 * @module commands/git/git-commit
 * @description Record changes to the repository with comprehensive commit options.
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
 * Commit result information
 * @interface CommitResult
 */
interface CommitResult {
  /** Commit hash */
  hash: string;
  /** Short hash */
  shortHash: string;
  /** Branch name */
  branch: string;
  /** Files committed */
  filesCommitted: number;
  /** Insertions */
  insertions: number;
  /** Deletions */
  deletions: number;
  /** Commit message */
  message: string;
}

/**
 * Git Commit Command Implementation
 * @class GitCommitCommand
 * @extends Command
 * @description Records changes to the repository. Supports various commit options
 * including amend, sign-off, and custom message formatting.
 * 
 * @example
 * ```typescript
 * const cmd = new GitCommitCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-commit',
 *   args: {},
 *   options: { message: 'Initial commit', all: true },
 *   raw: '/git-commit -m "Initial commit" --all'
 * });
 * ```
 */
export class GitCommitCommand extends Command {
  /**
   * Creates a new git-commit command instance
   */
  constructor() {
    super({
      name: 'git-commit',
      description: 'Record changes to the repository',
      category: 'git',
      aliases: ['gc', 'commit'],
      arguments: [
        {
          name: 'message',
          description: 'Commit message (can also use -m option)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'm',
          long: 'message',
          description: 'Use the given message as the commit message',
          type: 'string'
        },
        {
          short: 'a',
          long: 'all',
          description: 'Automatically stage modified and deleted files',
          type: 'boolean',
          default: false
        },
        {
          short: 'v',
          long: 'verbose',
          description: 'Show unified diff between HEAD and what would be committed',
          type: 'boolean',
          default: false
        },
        {
          short: 'e',
          long: 'edit',
          description: 'Further edit the message taken from a file',
          type: 'boolean',
          default: false
        },
        {
          short: 's',
          long: 'signoff',
          description: 'Add a Signed-off-by line to the commit message',
          type: 'boolean',
          default: false
        },
        {
          short: 'n',
          long: 'no-verify',
          description: 'Bypass pre-commit and commit-msg hooks',
          type: 'boolean',
          default: false
        },
        {
          short: 'A',
          long: 'amend',
          description: 'Amend the tip of the current branch',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-edit',
          description: 'Use the selected commit message without launching an editor',
          type: 'boolean',
          default: false
        },
        {
          long: 'reset-author',
          description: 'When amending, reset author to the current user',
          type: 'boolean',
          default: false
        },
        {
          long: 'date',
          description: 'Override the author date',
          type: 'string'
        },
        {
          long: 'author',
          description: 'Override the commit author',
          type: 'string'
        },
        {
          long: 'gpg-sign',
          description: 'GPG-sign the commit',
          type: 'boolean',
          default: false
        },
        {
          short: 'S',
          long: 'gpg-key',
          description: 'GPG key ID to use for signing',
          type: 'string'
        },
        {
          long: 'dry-run',
          description: 'Do not actually create the commit',
          type: 'boolean',
          default: false
        },
        {
          long: 'status',
          description: 'Include status in commit message template',
          type: 'boolean',
          default: true
        },
        {
          long: 'no-status',
          description: 'Do not include status in commit message template',
          type: 'boolean',
          default: false
        },
        {
          long: 'json',
          description: 'Output commit info as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Commit with message',
          command: '/git-commit -m "Fix bug in authentication"'
        },
        {
          description: 'Commit all modified files',
          command: '/git-commit -am "Update documentation"'
        },
        {
          description: 'Amend last commit',
          command: '/git-commit --amend --no-edit'
        },
        {
          description: 'Amend commit message',
          command: '/git-commit --amend -m "New message"'
        },
        {
          description: 'Sign off commit',
          command: '/git-commit -m "Add feature" --signoff'
        },
        {
          description: 'Dry run to see what would be committed',
          command: '/git-commit --dry-run'
        },
        {
          description: 'Commit with verbose diff',
          command: '/git-commit -m "Changes" --verbose'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-add', 'git-status', 'git-log'],
      version: '1.0.0'
    });
  }

  /**
   * Execute the git-commit command
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  public async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        message?: string;
        all?: boolean;
        verbose?: boolean;
        edit?: boolean;
        signoff?: boolean;
        'no-verify'?: boolean;
        amend?: boolean;
        'no-edit'?: boolean;
        'reset-author'?: boolean;
        date?: string;
        author?: string;
        'gpg-sign'?: boolean;
        'gpg-key'?: string;
        'dry-run'?: boolean;
        status?: boolean;
        'no-status'?: boolean;
        json?: boolean;
      };

      // Get message from argument or option
      let message = (args.args.message as string) || options.message;

      // Check for staged changes
      const hasStagedChanges = await this.hasStagedChanges(context.cwd);
      
      if (!hasStagedChanges && !options.all && !options.amend) {
        return CommandResultBuilder.failure(
          'No changes staged for commit.\n' +
          'Use /git-add to stage files, or use --all to commit all modified files.',
          1
        );
      }

      // If no message provided and not amending, prompt for one
      if (!message && !options.amend) {
        const useEditor = await context.input.confirm(
          'No commit message provided. Open editor?',
          true
        );
        
        if (useEditor) {
          options.edit = true;
        } else {
          message = await context.input.prompt('Enter commit message:');
          if (!message) {
            return CommandResultBuilder.failure('Commit message is required');
          }
        }
      }

      // Build git commit command
      const gitArgs = this.buildGitArgs(options, message);

      // Execute git commit
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Parse result
      const result = this.parseCommitOutput(output, message || '');

      // Handle dry run
      if (options['dry-run']) {
        context.output.info('Dry run - no commit was created');
        context.output.write(output);
        return CommandResultBuilder.success({ dryRun: true });
      }

      // Display result
      if (options.json) {
        return CommandResultBuilder.success(result);
      }

      this.displayResult(context, result, options.amend || false);

      return CommandResultBuilder.success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure(
          'Not a git repository. Run "git init" to create one.',
          128
        );
      }
      
      if (errorMessage.includes('nothing to commit')) {
        return CommandResultBuilder.failure(
          'Nothing to commit, working tree clean',
          1
        );
      }
      
      if (errorMessage.includes('hook')) {
        return CommandResultBuilder.failure(
          `Commit hook failed: ${errorMessage}\n` +
          'Use --no-verify to bypass hooks.',
          1
        );
      }
      
      return CommandResultBuilder.failure(
        `Commit failed: ${errorMessage}`,
        1
      );
    }
  }

  /**
   * Check if there are staged changes
   * @private
   * @param cwd - Working directory
   * @returns Whether there are staged changes
   */
  private async hasStagedChanges(cwd: string): Promise<boolean> {
    try {
      const output = await this.executeGitCommand(
        ['diff', '--cached', '--quiet'],
        cwd
      );
      return false;
    } catch {
      // diff --cached returns exit code 1 if there are staged changes
      return true;
    }
  }

  /**
   * Build git commit command arguments
   * @private
   * @param options - Parsed options
   * @param message - Commit message
   * @returns Array of git arguments
   */
  private buildGitArgs(
    options: Record<string, unknown>,
    message?: string
  ): string[] {
    const args: string[] = ['commit'];

    // Message
    if (message && !options.edit) {
      args.push('-m', message);
    }

    // All
    if (options.all) {
      args.push('-a');
    }

    // Verbose
    if (options.verbose) {
      args.push('-v');
    }

    // Edit
    if (options.edit) {
      args.push('-e');
    }

    // Signoff
    if (options.signoff) {
      args.push('-s');
    }

    // No verify
    if (options['no-verify']) {
      args.push('-n');
    }

    // Amend
    if (options.amend) {
      args.push('--amend');
    }

    // No edit
    if (options['no-edit']) {
      args.push('--no-edit');
    }

    // Reset author
    if (options['reset-author']) {
      args.push('--reset-author');
    }

    // Date
    if (options.date) {
      args.push('--date', options.date as string);
    }

    // Author
    if (options.author) {
      args.push('--author', options.author as string);
    }

    // GPG sign
    if (options['gpg-sign']) {
      args.push('-S');
    }

    // GPG key
    if (options['gpg-key']) {
      args.push('-S', options['gpg-key'] as string);
    }

    // Dry run
    if (options['dry-run']) {
      args.push('--dry-run');
    }

    // Status
    if (options['no-status']) {
      args.push('--no-status');
    }

    return args;
  }

  /**
   * Execute git command
   * @private
   * @param args - Git arguments
   * @param cwd - Working directory
   * @returns Command output
   */
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

  /**
   * Parse commit output
   * @private
   * @param output - Git output
   * @param message - Commit message
   * @returns Commit result
   */
  private parseCommitOutput(output: string, message: string): CommitResult {
    // Parse commit hash
    const hashMatch = output.match(/\[([^\]]+)\s+([a-f0-9]+)\]/);
    const hash = hashMatch ? hashMatch[2] : '';
    const branch = hashMatch ? hashMatch[1] : '';

    // Parse stats
    const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    const filesCommitted = statsMatch ? parseInt(statsMatch[1], 10) : 0;
    const insertions = statsMatch && statsMatch[2] ? parseInt(statsMatch[2], 10) : 0;
    const deletions = statsMatch && statsMatch[3] ? parseInt(statsMatch[3], 10) : 0;

    return {
      hash,
      shortHash: hash.substring(0, 7),
      branch,
      filesCommitted,
      insertions,
      deletions,
      message
    };
  }

  /**
   * Display commit result
   * @private
   * @param context - Command context
   * @param result - Commit result
   * @param isAmend - Whether this was an amend
   */
  private displayResult(
    context: CommandContext,
    result: CommitResult,
    isAmend: boolean
  ): void {
    const action = isAmend ? 'Amended' : 'Created';
    
    context.output.success(
      `${action} commit \x1b[36m${result.shortHash}\x1b[0m on \x1b[33m${result.branch}\x1b[0m`
    );
    
    if (result.filesCommitted > 0) {
      const stats: string[] = [];
      if (result.filesCommitted) {
        stats.push(`${result.filesCommitted} file${result.filesCommitted !== 1 ? 's' : ''}`);
      }
      if (result.insertions) {
        stats.push(`\x1b[32m+${result.insertions}\x1b[0m`);
      }
      if (result.deletions) {
        stats.push(`\x1b[31m-${result.deletions}\x1b[0m`);
      }
      
      context.output.info(`  ${stats.join(', ')}`);
    }
    
    if (result.message) {
      context.output.info(`  "${result.message}"`);
    }
  }

  /**
   * Get help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mCOMMIT MESSAGE BEST PRACTICES\x1b[0m

  1. Use imperative mood ("Add feature" not "Added feature")
  2. First line should be 50 chars or less (summary)
  3. Leave blank line, then detailed explanation if needed
  4. Reference issues: "Fixes #123" or "Closes #456"

  Example:
    Add user authentication

    - Implement JWT token generation
    - Add login/logout endpoints
    - Add password hashing with bcrypt

    Fixes #42

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  Quick commit:
    /git-commit -m "Fix typo"

  Commit all modified files:
    /git-commit -am "Update docs"

  Fix last commit:
    /git-commit --amend --no-edit

  Change last commit message:
    /git-commit --amend -m "New message"

`;
  }
}

export default GitCommitCommand;
