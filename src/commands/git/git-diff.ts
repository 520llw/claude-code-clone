/**
 * @fileoverview Git Diff Command - /git-diff
 * @module commands/git/git-diff
 * @description Shows changes between commits, commit and working tree, etc.
 * Supports various diff formats and filtering options.
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
 * Diff statistics
 * @interface DiffStats
 */
interface DiffStats {
  /** Files changed */
  filesChanged: number;
  /** Insertions count */
  insertions: number;
  /** Deletions count */
  deletions: number;
  /** Net change */
  netChange: number;
}

/**
 * File diff information
 * @interface FileDiff
 */
interface FileDiff {
  /** File path */
  path: string;
  /** Change type */
  changeType: 'added' | 'deleted' | 'modified' | 'renamed';
  /** Insertions */
  insertions: number;
  /** Deletions */
  deletions: number;
  /** Binary file */
  isBinary: boolean;
}

/**
 * Git Diff Command Implementation
 * @class GitDiffCommand
 * @extends Command
 * @description Shows changes between the working tree and the index or a tree,
 * changes between the index and a tree, changes between two trees, etc.
 * 
 * @example
 * ```typescript
 * const cmd = new GitDiffCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-diff',
 *   args: { path: 'src/index.ts' },
 *   options: { staged: false, stat: true },
 *   raw: '/git-diff src/index.ts --stat'
 * });
 * ```
 */
export class GitDiffCommand extends Command {
  /**
   * Creates a new git-diff command instance
   */
  constructor() {
    super({
      name: 'git-diff',
      description: 'Show changes between commits, commit and working tree, etc.',
      category: 'git',
      aliases: ['gd', 'diff'],
      arguments: [
        {
          name: 'path',
          description: 'Path to file or directory to diff (optional)',
          required: false,
          type: 'string'
        },
        {
          name: 'commit',
          description: 'Commit to compare against (optional)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 's',
          long: 'staged',
          description: 'Compare staged changes to HEAD',
          type: 'boolean',
          default: false
        },
        {
          short: 'c',
          long: 'cached',
          description: 'Synonym for --staged',
          type: 'boolean',
          default: false
        },
        {
          short: 'S',
          long: 'stat',
          description: 'Generate a diffstat',
          type: 'boolean',
          default: false
        },
        {
          short: 'n',
          long: 'numstat',
          description: 'Similar to --stat but more machine-friendly',
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
          long: 'name-status',
          description: 'Show names and status of changed files',
          type: 'boolean',
          default: false
        },
        {
          short: 'C',
          long: 'color',
          description: 'Show colored diff',
          type: 'boolean',
          default: true
        },
        {
          short: 'w',
          long: 'ignore-whitespace',
          description: 'Ignore whitespace when comparing lines',
          type: 'boolean',
          default: false
        },
        {
          short: 'U',
          long: 'unified',
          description: 'Generate diffs with <n> lines of context',
          type: 'number',
          default: 3
        },
        {
          short: 'p',
          long: 'patch',
          description: 'Generate patch',
          type: 'boolean',
          default: true
        },
        {
          long: 'no-patch',
          description: 'Suppress diff output',
          type: 'boolean',
          default: false
        },
        {
          short: 'R',
          long: 'reverse',
          description: 'Reverse the order of the diff',
          type: 'boolean',
          default: false
        },
        {
          long: 'check',
          description: 'Warn if changes introduce conflict markers or whitespace errors',
          type: 'boolean',
          default: false
        },
        {
          long: 'word-diff',
          description: 'Show word diff instead of line diff',
          type: 'boolean',
          default: false
        },
        {
          long: 'submodule',
          description: 'Specify how to handle submodules',
          type: 'string',
          choices: ['short', 'long', 'log'],
          default: 'short'
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
          description: 'Show unstaged changes',
          command: '/git-diff'
        },
        {
          description: 'Show staged changes',
          command: '/git-diff --staged'
        },
        {
          description: 'Show changes to a specific file',
          command: '/git-diff src/index.ts'
        },
        {
          description: 'Show diff statistics',
          command: '/git-diff --stat'
        },
        {
          description: 'Compare with a specific commit',
          command: '/git-diff HEAD~5'
        },
        {
          description: 'Show word diff',
          command: '/git-diff --word-diff'
        },
        {
          description: 'Show only changed file names',
          command: '/git-diff --name-only'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-status', 'git-log', 'git-show'],
      version: '1.0.0'
    });
  }

  /**
   * Execute the git-diff command
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  public async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        staged?: boolean;
        cached?: boolean;
        stat?: boolean;
        numstat?: boolean;
        'name-only'?: boolean;
        'name-status'?: boolean;
        color?: boolean;
        'ignore-whitespace'?: boolean;
        unified?: number;
        patch?: boolean;
        'no-patch'?: boolean;
        reverse?: boolean;
        check?: boolean;
        'word-diff'?: boolean;
        submodule?: string;
        json?: boolean;
      };

      const path = args.args.path as string | undefined;
      const commit = args.args.commit as string | undefined;

      // Build git diff command
      const gitArgs = this.buildGitArgs(options, path, commit);

      // Execute git diff
      const output = await this.executeGitCommand(gitArgs, context.cwd);

      // Handle empty diff
      if (!output.trim()) {
        if (options.json) {
          return CommandResultBuilder.success({
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
            changes: []
          });
        }
        context.output.info('No differences found.');
        return CommandResultBuilder.success({ empty: true });
      }

      // Parse and format output
      if (options.json) {
        const parsed = this.parseDiffOutput(output);
        return CommandResultBuilder.success(parsed);
      }

      // Display output
      if (options.color !== false) {
        context.output.write(this.colorizeDiff(output));
      } else {
        context.output.write(output);
      }

      // Parse stats for return value
      const stats = this.parseStats(output);
      
      return CommandResultBuilder.success({
        filesChanged: stats.filesChanged,
        insertions: stats.insertions,
        deletions: stats.deletions
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure(
          'Not a git repository. Run "git init" to create one.',
          128
        );
      }
      
      if (errorMessage.includes('bad object')) {
        return CommandResultBuilder.failure(
          'Invalid commit reference specified.',
          128
        );
      }
      
      return CommandResultBuilder.failure(
        `Failed to get diff: ${errorMessage}`,
        1
      );
    }
  }

  /**
   * Build git diff command arguments
   * @private
   * @param options - Parsed options
   * @param path - Optional path filter
   * @param commit - Optional commit reference
   * @returns Array of git arguments
   */
  private buildGitArgs(
    options: Record<string, unknown>,
    path?: string,
    commit?: string
  ): string[] {
    const args: string[] = ['diff'];

    // Output format options
    if (options.stat) {
      args.push('--stat');
    } else if (options.numstat) {
      args.push('--numstat');
    } else if (options['name-only']) {
      args.push('--name-only');
    } else if (options['name-status']) {
      args.push('--name-status');
    }

    // Staged/cached
    if (options.staged || options.cached) {
      args.push('--staged');
    }

    // Context lines
    if (options.unified !== undefined && options.unified !== 3) {
      args.push(`--unified=${options.unified}`);
    }

    // Whitespace handling
    if (options['ignore-whitespace']) {
      args.push('--ignore-all-space');
    }

    // Word diff
    if (options['word-diff']) {
      args.push('--word-diff');
    }

    // Reverse
    if (options.reverse) {
      args.push('--reverse');
    }

    // Check
    if (options.check) {
      args.push('--check');
    }

    // Submodule
    if (options.submodule && options.submodule !== 'short') {
      args.push(`--submodule=${options.submodule}`);
    }

    // Patch/no-patch
    if (options['no-patch']) {
      args.push('--no-patch');
    } else if (options.patch !== false && !options.stat && !options.numstat) {
      args.push('--patch');
    }

    // Color
    if (options.color === false) {
      args.push('--no-color');
    }

    // Add commit reference if specified
    if (commit) {
      args.push(commit);
    }

    // Add path if specified
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
   * Parse diff output into structured format
   * @private
   * @param output - Raw diff output
   * @returns Parsed diff data
   */
  private parseDiffOutput(output: string): {
    filesChanged: number;
    insertions: number;
    deletions: number;
    changes: FileDiff[];
  } {
    const lines = output.split('\n');
    const changes: FileDiff[] = [];
    let currentFile: Partial<FileDiff> | null = null;
    let insertions = 0;
    let deletions = 0;

    for (const line of lines) {
      // Parse diff header
      const diffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (diffMatch) {
        if (currentFile && currentFile.path) {
          changes.push(currentFile as FileDiff);
        }
        currentFile = {
          path: diffMatch[2],
          changeType: 'modified',
          insertions: 0,
          deletions: 0,
          isBinary: false
        };
        continue;
      }

      // Parse new file mode
      if (line.startsWith('new file mode')) {
        if (currentFile) currentFile.changeType = 'added';
        continue;
      }

      // Parse deleted file mode
      if (line.startsWith('deleted file mode')) {
        if (currentFile) currentFile.changeType = 'deleted';
        continue;
      }

      // Parse rename
      if (line.startsWith('rename from')) {
        if (currentFile) currentFile.changeType = 'renamed';
        continue;
      }

      // Parse binary diff
      if (line.match(/^Binary files .+ differ$/)) {
        if (currentFile) currentFile.isBinary = true;
        continue;
      }

      // Parse hunk headers for stats
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (hunkMatch && currentFile) {
        // Hunk header found
        continue;
      }

      // Count additions and deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
        if (currentFile) currentFile.insertions = (currentFile.insertions || 0) + 1;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        if (currentFile) currentFile.deletions = (currentFile.deletions || 0) + 1;
      }
    }

    // Add last file
    if (currentFile && currentFile.path) {
      changes.push(currentFile as FileDiff);
    }

    return {
      filesChanged: changes.length,
      insertions,
      deletions,
      changes
    };
  }

  /**
   * Parse statistics from diff output
   * @private
   * @param output - Diff output
   * @returns Statistics
   */
  private parseStats(output: string): DiffStats {
    // Try to parse from --stat output
    const statMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    if (statMatch) {
      return {
        filesChanged: parseInt(statMatch[1], 10),
        insertions: parseInt(statMatch[2] || '0', 10),
        deletions: parseInt(statMatch[3] || '0', 10),
        netChange: parseInt(statMatch[2] || '0', 10) - parseInt(statMatch[3] || '0', 10)
      };
    }

    // Parse from numstat output
    const numstatLines = output.split('\n').filter(l => /^\d+\t\d+\t/.test(l));
    if (numstatLines.length > 0) {
      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;

      for (const line of numstatLines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const ins = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
          const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
          insertions += ins;
          deletions += del;
          filesChanged++;
        }
      }

      return {
        filesChanged,
        insertions,
        deletions,
        netChange: insertions - deletions
      };
    }

    // Default: count from diff content
    const lines = output.split('\n');
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        filesChanged++;
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      filesChanged,
      insertions,
      deletions,
      netChange: insertions - deletions
    };
  }

  /**
   * Add color to diff output
   * @private
   * @param output - Raw diff output
   * @returns Colorized output
   */
  private colorizeDiff(output: string): string {
    const lines = output.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        result.push(`\x1b[32m${line}\x1b[0m`);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        result.push(`\x1b[31m${line}\x1b[0m`);
      } else if (line.startsWith('@@')) {
        result.push(`\x1b[36m${line}\x1b[0m`);
      } else if (line.startsWith('diff --git')) {
        result.push(`\x1b[1m${line}\x1b[0m`);
      } else if (line.startsWith('index ')) {
        result.push(`\x1b[90m${line}\x1b[0m`);
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Get help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mDIFF FORMATS\x1b[0m

  --patch (default):    Full unified diff format
  --stat:               Summary statistics per file
  --numstat:            Machine-readable line counts
  --name-only:          List of changed file names
  --name-status:        List with status codes (A/M/D/R/C)
  --word-diff:          Word-level differences

\x1b[1m\x1b[36mCOMMON USE CASES\x1b[0m

  Review unstaged changes:
    /git-diff

  Review staged changes (before commit):
    /git-diff --staged

  See what changed in last commit:
    /git-diff HEAD~1

  Compare specific file:
    /git-diff src/main.ts

  Get quick stats:
    /git-diff --stat

`;
  }
}

export default GitDiffCommand;
