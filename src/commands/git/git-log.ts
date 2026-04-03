/**
 * @fileoverview Git Log Command - /git-log
 * @module commands/git/git-log
 * @description Shows commit logs with various formatting and filtering options.
 * Supports custom formats, graph visualization, and search capabilities.
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
 * Commit information
 * @interface CommitInfo
 */
interface CommitInfo {
  /** Commit hash */
  hash: string;
  /** Short hash */
  shortHash: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit date */
  date: Date;
  /** Commit message */
  message: string;
  /** Commit subject (first line) */
  subject: string;
  /** Parent commits */
  parents: string[];
  /** Changed files count */
  filesChanged?: number;
  /** Insertions count */
  insertions?: number;
  /** Deletions count */
  deletions?: number;
}

/**
 * Git Log Command Implementation
 * @class GitLogCommand
 * @extends Command
 * @description Shows commit logs with various formatting options including
 * custom formats, graph visualization, and filtering by author, date, etc.
 * 
 * @example
 * ```typescript
 * const cmd = new GitLogCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-log',
 *   args: {},
 *   options: { oneline: true, graph: true, n: 10 },
 *   raw: '/git-log --oneline --graph -n 10'
 * });
 * ```
 */
export class GitLogCommand extends Command {
  /**
   * Creates a new git-log command instance
   */
  constructor() {
    super({
      name: 'git-log',
      description: 'Show commit logs with various formatting options',
      category: 'git',
      aliases: ['gl', 'log'],
      arguments: [
        {
          name: 'revision-range',
          description: 'Revision range to show (e.g., HEAD~10..HEAD)',
          required: false,
          type: 'string'
        },
        {
          name: 'path',
          description: 'Path to filter commits by',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'n',
          long: 'max-count',
          description: 'Limit the number of commits to output',
          type: 'number',
          default: 20
        },
        {
          short: 'o',
          long: 'oneline',
          description: 'Show each commit on a single line',
          type: 'boolean',
          default: false
        },
        {
          short: 'g',
          long: 'graph',
          description: 'Draw a text-based graphical representation of the commit history',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'decorate',
          description: 'Print out the ref names of any commits that are shown',
          type: 'boolean',
          default: true
        },
        {
          short: 'a',
          long: 'all',
          description: 'Pretend as if all the refs in refs/ are listed on the command line',
          type: 'boolean',
          default: false
        },
        {
          short: 'A',
          long: 'author',
          description: 'Limit commits by author pattern',
          type: 'string'
        },
        {
          short: 's',
          long: 'since',
          description: 'Show commits more recent than a specific date',
          type: 'string'
        },
        {
          short: 'u',
          long: 'until',
          description: 'Show commits older than a specific date',
          type: 'string'
        },
        {
          short: 'S',
          long: 'grep',
          description: 'Limit the commits output to ones with log message matching pattern',
          type: 'string'
        },
        {
          short: 'p',
          long: 'patch',
          description: 'Generate patch (see the diff)',
          type: 'boolean',
          default: false
        },
        {
          short: 'N',
          long: 'name-only',
          description: 'Show only names of changed files',
          type: 'boolean',
          default: false
        },
        {
          short: 't',
          long: 'stat',
          description: 'Generate a diffstat',
          type: 'boolean',
          default: false
        },
        {
          long: 'reverse',
          description: 'Output the commits in reverse order',
          type: 'boolean',
          default: false
        },
        {
          long: 'first-parent',
          description: 'Follow only the first parent commit upon seeing a merge commit',
          type: 'boolean',
          default: false
        },
        {
          long: 'no-merges',
          description: 'Do not print commits with more than one parent',
          type: 'boolean',
          default: false
        },
        {
          long: 'merges',
          description: 'Print only merge commits',
          type: 'boolean',
          default: false
        },
        {
          long: 'format',
          description: 'Pretty-print the contents of the commit logs in a given format',
          type: 'string'
        },
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        },
        {
          long: 'follow',
          description: 'Continue listing the history of a file beyond renames',
          type: 'boolean',
          default: false
        },
        {
          long: 'full-history',
          description: 'Show full history including file renames',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Show recent commits',
          command: '/git-log'
        },
        {
          description: 'Show commits in one line format',
          command: '/git-log --oneline'
        },
        {
          description: 'Show commit graph',
          command: '/git-log --graph --oneline'
        },
        {
          description: 'Show last 5 commits',
          command: '/git-log -n 5'
        },
        {
          description: 'Show commits by author',
          command: '/git-log --author="John Doe"'
        },
        {
          description: 'Show commits since last week',
          command: '/git-log --since="1 week ago"'
        },
        {
          description: 'Show commits with changes to a file',
          command: '/git-log --follow -- src/index.ts'
        },
        {
          description: 'Search commit messages',
          command: '/git-log --grep="fix bug"'
        },
        {
          description: 'Show commits with diff stats',
          command: '/git-log --stat'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-diff', 'git-show', 'git-branch'],
      version: '1.0.0'
    });
  }

  /**
   * Execute the git-log command
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  public async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        'max-count'?: number;
        oneline?: boolean;
        graph?: boolean;
        decorate?: boolean;
        all?: boolean;
        author?: string;
        since?: string;
        until?: string;
        grep?: string;
        patch?: boolean;
        'name-only'?: boolean;
        stat?: boolean;
        reverse?: boolean;
        'first-parent'?: boolean;
        'no-merges'?: boolean;
        merges?: boolean;
        format?: string;
        json?: boolean;
        follow?: boolean;
        'full-history'?: boolean;
      };

      const revisionRange = args.args['revision-range'] as string | undefined;
      const path = args.args.path as string | undefined;

      // Build git log command
      const gitArgs = this.buildGitArgs(options, revisionRange, path);

      // Execute git log
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Handle empty output
      if (!output.trim()) {
        context.output.info('No commits found matching the criteria.');
        return CommandResultBuilder.success({ empty: true });
      }

      // Parse and format output
      if (options.json) {
        const commits = this.parseJsonOutput(output);
        return CommandResultBuilder.success({ commits });
      }

      // Display output
      context.output.write(output);

      // Return summary
      const commitCount = output.split('\n').filter(l => l.startsWith('commit ')).length;
      
      return CommandResultBuilder.success({
        commitCount,
        hasMore: commitCount >= (options['max-count'] || 20)
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure(
          'Not a git repository. Run "git init" to create one.',
          128
        );
      }
      
      if (errorMessage.includes('unknown revision')) {
        return CommandResultBuilder.failure(
          'Invalid revision range specified.',
          128
        );
      }
      
      return CommandResultBuilder.failure(
        `Failed to get log: ${errorMessage}`,
        1
      );
    }
  }

  /**
   * Build git log command arguments
   * @private
   * @param options - Parsed options
   * @param revisionRange - Optional revision range
   * @param path - Optional path filter
   * @returns Array of git arguments
   */
  private buildGitArgs(
    options: Record<string, unknown>,
    revisionRange?: string,
    path?: string
  ): string[] {
    const args: string[] = ['log'];

    // Handle JSON output format
    if (options.json) {
      args.push('--pretty=format:{"hash":"%H","shortHash":"%h","author":"%an","authorEmail":"%ae","date":"%aI","subject":"%s","message":"%b","parents":"%P"}');
      args.push('--no-decorate');
    } else if (options.format) {
      args.push(`--pretty=format:${options.format}`);
    } else if (options.oneline) {
      args.push('--oneline');
    }

    // Graph
    if (options.graph) {
      args.push('--graph');
    }

    // Decorate
    if (options.decorate !== false && !options.json) {
      args.push('--decorate');
    }

    // All branches
    if (options.all) {
      args.push('--all');
    }

    // Max count
    const maxCount = options['max-count'] || (options.json ? 50 : 20);
    args.push(`--max-count=${maxCount}`);

    // Author filter
    if (options.author) {
      args.push(`--author=${options.author}`);
    }

    // Date filters
    if (options.since) {
      args.push(`--since=${options.since}`);
    }
    if (options.until) {
      args.push(`--until=${options.until}`);
    }

    // Message grep
    if (options.grep) {
      args.push(`--grep=${options.grep}`);
    }

    // Patch
    if (options.patch) {
      args.push('--patch');
    }

    // Name only
    if (options['name-only']) {
      args.push('--name-only');
    }

    // Stat
    if (options.stat) {
      args.push('--stat');
    }

    // Reverse
    if (options.reverse) {
      args.push('--reverse');
    }

    // First parent
    if (options['first-parent']) {
      args.push('--first-parent');
    }

    // No merges
    if (options['no-merges']) {
      args.push('--no-merges');
    }

    // Only merges
    if (options.merges) {
      args.push('--merges');
    }

    // Follow
    if (options.follow && path) {
      args.push('--follow');
    }

    // Full history
    if (options['full-history']) {
      args.push('--full-history');
    }

    // Add revision range
    if (revisionRange) {
      args.push(revisionRange);
    }

    // Add path filter
    if (path) {
      args.push('--');
      args.push(path);
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
        env: { ...process.env, PAGER: 'cat' }
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
          reject(new Error(stderr || `Git exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse JSON formatted output
   * @private
   * @param output - Raw output
   * @returns Array of commit info
   */
  private parseJsonOutput(output: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        // Parse the JSON line, handling escaped characters
        const parsed = JSON.parse(line);
        
        commits.push({
          hash: parsed.hash,
          shortHash: parsed.shortHash,
          author: parsed.author,
          authorEmail: parsed.authorEmail,
          date: new Date(parsed.date),
          message: parsed.message,
          subject: parsed.subject,
          parents: parsed.parents ? parsed.parents.split(' ') : []
        });
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return commits;
  }

  /**
   * Get help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mPRETTY FORMATS\x1b[0m

  Use --format with placeholders:
  %H   - Commit hash
  %h   - Abbreviated commit hash
  %an  - Author name
  %ae  - Author email
  %ad  - Author date
  %s   - Subject (first line of message)
  %b   - Body (remaining lines)
  %P   - Parent hashes
  %D   - Ref names

  Example:
    /git-log --format="%h - %an, %ar : %s"

\x1b[1m\x1b[36mDATE SPECIFICATIONS\x1b[0m

  --since and --until accept various formats:
    "2 weeks ago"
    "3 days ago"
    "2024-01-01"
    "yesterday"
    "last Monday"

\x1b[1m\x1b[36mCOMMON USE CASES\x1b[0m

  View recent activity:
    /git-log --oneline -n 20

  See what you've been working on:
    /git-log --author="Your Name" --since="1 week ago"

  Find commits by message:
    /git-log --grep="bug fix" -i

  View file history:
    /git-log --follow -- src/file.ts

  See branch structure:
    /git-log --graph --oneline --all

`;
  }
}

export default GitLogCommand;
