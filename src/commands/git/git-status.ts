/**
 * @fileoverview Git Status Command - /git-status
 * @module commands/git/git-status
 * @description Shows the working tree status of the current git repository.
 * Displays staged, unstaged, and untracked files with detailed information.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Git file status entry
 * @interface FileStatus
 */
interface FileStatus {
  /** Status code (XY format from git status --porcelain) */
  status: string;
  /** File path */
  path: string;
  /** Original path for renamed files */
  originalPath?: string;
  /** Human-readable status description */
  description: string;
}

/**
 * Branch information
 * @interface BranchInfo
 */
interface BranchInfo {
  /** Current branch name */
  name: string;
  /** Upstream branch */
  upstream?: string;
  /** Commits ahead of upstream */
  ahead: number;
  /** Commits behind upstream */
  behind: number;
  /** Last commit hash */
  lastCommit?: string;
  /** Last commit message */
  lastCommitMessage?: string;
}

/**
 * Complete git status result
 * @interface GitStatusResult
 */
interface GitStatusResult {
  /** Branch information */
  branch: BranchInfo;
  /** Staged files */
  staged: FileStatus[];
  /** Unstaged files */
  unstaged: FileStatus[];
  /** Untracked files */
  untracked: string[];
  /** Conflict files */
  conflicts: FileStatus[];
  /** Ignored files count */
  ignoredCount: number;
  /** Is repository clean */
  isClean: boolean;
}

/**
 * Status code to description mapping
 * @const STATUS_DESCRIPTIONS
 */
const STATUS_DESCRIPTIONS: Record<string, string> = {
  ' M': 'Modified (not staged)',
  'M ': 'Modified (staged)',
  'MM': 'Modified (staged and unstaged)',
  ' A': 'Added (not staged)',
  'A ': 'Added (staged)',
  'AM': 'Added (staged, modified)',
  ' D': 'Deleted (not staged)',
  'D ': 'Deleted (staged)',
  'DM': 'Deleted (staged, modified)',
  ' R': 'Renamed (not staged)',
  'R ': 'Renamed (staged)',
  'RM': 'Renamed (staged, modified)',
  ' C': 'Copied (not staged)',
  'C ': 'Copied (staged)',
  'CM': 'Copied (staged, modified)',
  'U ': 'Updated but unmerged',
  'UU': 'Both modified',
  'UD': 'Deleted by them',
  'UA': 'Added by them',
  'DU': 'Deleted by us',
  'AA': 'Both added',
  'AU': 'Added by us',
  '??': 'Untracked',
  '!!': 'Ignored'
};

/**
 * Git Status Command Implementation
 * @class GitStatusCommand
 * @extends Command
 * @description Shows the working tree status including staged, unstaged, and untracked files.
 * Supports various output formats and filtering options.
 * 
 * @example
 * ```typescript
 * const cmd = new GitStatusCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-status',
 *   args: {},
 *   options: { short: false, porcelain: false },
 *   raw: '/git-status'
 * });
 * ```
 */
export class GitStatusCommand extends Command {
  /**
   * Creates a new git-status command instance
   */
  constructor() {
    super({
      name: 'git-status',
      description: 'Show the working tree status of the current git repository',
      category: 'git',
      aliases: ['gst', 'status'],
      arguments: [],
      options: [
        {
          short: 's',
          long: 'short',
          description: 'Give the output in the short-format',
          type: 'boolean',
          default: false
        },
        {
          short: 'b',
          long: 'branch',
          description: 'Show branch and tracking info even in short-format',
          type: 'boolean',
          default: false
        },
        {
          long: 'porcelain',
          description: 'Give the output in an easy-to-parse format for scripts',
          type: 'boolean',
          default: false
        },
        {
          long: 'long',
          description: 'Give the output in the long-format (default)',
          type: 'boolean',
          default: false
        },
        {
          short: 'u',
          long: 'untracked-files',
          description: 'Show untracked files',
          type: 'string',
          choices: ['all', 'normal', 'no'],
          default: 'normal'
        },
        {
          long: 'ignored',
          description: 'Show ignored files as well',
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
          description: 'Show full status',
          command: '/git-status'
        },
        {
          description: 'Show short status',
          command: '/git-status --short'
        },
        {
          description: 'Show status with branch info',
          command: '/git-status --short --branch'
        },
        {
          description: 'Show all untracked files',
          command: '/git-status --untracked-files=all'
        },
        {
          description: 'Get JSON output for scripting',
          command: '/git-status --json'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-diff', 'git-log', 'git-branch'],
      version: '1.0.0'
    });
  }

  /**
   * Execute the git-status command
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  public async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const options = args.options as {
        short?: boolean;
        branch?: boolean;
        porcelain?: boolean;
        long?: boolean;
        'untracked-files'?: string;
        ignored?: boolean;
        json?: boolean;
      };

      // Determine output format
      const isShort = options.short || false;
      const showBranch = options.branch || false;
      const isPorcelain = options.porcelain || false;
      const isJson = options.json || false;

      // Build git status command
      let gitArgs = ['status'];
      
      if (isPorcelain) {
        gitArgs.push('--porcelain');
      } else if (isShort) {
        gitArgs.push('-s');
        if (showBranch) {
          gitArgs.push('-b');
        }
      }

      // Handle untracked files option
      const untrackedMode = options['untracked-files'] || 'normal';
      if (untrackedMode !== 'normal') {
        gitArgs.push(`--untracked-files=${untrackedMode}`);
      }

      // Handle ignored files
      if (options.ignored) {
        gitArgs.push('--ignored');
      }

      // Execute git status
      const output = await this.executeGitCommand(gitArgs, context.cwd);
      
      // Parse status output
      const status = this.parseStatusOutput(output);

      // Format and return output
      if (isJson) {
        return CommandResultBuilder.success(status);
      } else if (isPorcelain) {
        return CommandResultBuilder.success(output);
      } else {
        const formatted = this.formatStatus(status, isShort);
        context.output.write(formatted);
        return CommandResultBuilder.success({
          isClean: status.isClean,
          stagedCount: status.staged.length,
          unstagedCount: status.unstaged.length,
          untrackedCount: status.untracked.length
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure(
          'Not a git repository. Run "git init" to create one.',
          128
        );
      }
      
      return CommandResultBuilder.failure(
        `Failed to get git status: ${errorMessage}`,
        1
      );
    }
  }

  /**
   * Execute a git command
   * @private
   * @param args - Git command arguments
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
   * Parse git status output
   * @private
   * @param output - Raw git status output
   * @returns Parsed status result
   */
  private parseStatusOutput(output: string): GitStatusResult {
    const lines = output.split('\n').filter(line => line.length > 0);
    
    const result: GitStatusResult = {
      branch: {
        name: '',
        ahead: 0,
        behind: 0
      },
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: [],
      ignoredCount: 0,
      isClean: true
    };

    for (const line of lines) {
      // Parse branch info line (## branch...upstream [ahead X, behind Y])
      if (line.startsWith('##')) {
        this.parseBranchLine(line, result.branch);
        continue;
      }

      // Parse file status line (XY path or XY "path" for paths with spaces)
      const statusCode = line.substring(0, 2);
      const pathMatch = line.substring(2).trim().match(/^"?(.+?)"?(?:\s+->\s+"?(.+?)"?)?$/);
      
      if (!pathMatch) continue;

      const path = pathMatch[1];
      const originalPath = pathMatch[2];

      // Skip ignored files for now
      if (statusCode === '!!') {
        result.ignoredCount++;
        continue;
      }

      result.isClean = false;

      const fileStatus: FileStatus = {
        status: statusCode,
        path,
        originalPath,
        description: STATUS_DESCRIPTIONS[statusCode] || 'Unknown'
      };

      // Categorize file
      if (statusCode === '??') {
        result.untracked.push(path);
      } else if (statusCode.includes('U') || 
                 (statusCode[0] === 'A' && statusCode[1] === 'A') ||
                 (statusCode[0] === 'D' && statusCode[1] === 'D')) {
        result.conflicts.push(fileStatus);
      } else if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
        result.staged.push(fileStatus);
      }
      
      if (statusCode[1] !== ' ') {
        result.unstaged.push(fileStatus);
      }
    }

    return result;
  }

  /**
   * Parse branch information line
   * @private
   * @param line - Branch line from git status
   * @param branch - Branch info object to populate
   */
  private parseBranchLine(line: string, branch: BranchInfo): void {
    // Remove ## prefix
    const content = line.substring(2).trim();
    
    // Parse branch name and upstream info
    // Format: branch.name...upstream [ahead X, behind Y]
    const match = content.match(/^(.+?)(?:\.\.\.(.+?))?(?:\s*\[([^\]]+)\])?$/);
    
    if (match) {
      branch.name = match[1];
      branch.upstream = match[2];
      
      if (match[3]) {
        const aheadMatch = match[3].match(/ahead\s+(\d+)/);
        const behindMatch = match[3].match(/behind\s+(\d+)/);
        
        if (aheadMatch) {
          branch.ahead = parseInt(aheadMatch[1], 10);
        }
        if (behindMatch) {
          branch.behind = parseInt(behindMatch[1], 10);
        }
      }
    }
  }

  /**
   * Format status result for display
   * @private
   * @param status - Parsed status result
   * @param isShort - Use short format
   * @returns Formatted output string
   */
  private formatStatus(status: GitStatusResult, isShort: boolean): string {
    const lines: string[] = [];

    // Branch info
    lines.push(this.formatBranchInfo(status.branch));
    lines.push('');

    if (status.isClean) {
      lines.push('\x1b[32mnothing to commit, working tree clean\x1b[0m');
      return lines.join('\n');
    }

    // Staged changes
    if (status.staged.length > 0) {
      lines.push('\x1b[32mChanges to be committed:\x1b[0m');
      lines.push('  (use "/git-reset" to unstage)');
      lines.push('');
      
      for (const file of status.staged) {
        const symbol = this.getStatusSymbol(file.status[0]);
        lines.push(`\t\x1b[32m${symbol} ${file.path}\x1b[0m`);
      }
      lines.push('');
    }

    // Unstaged changes
    if (status.unstaged.length > 0) {
      lines.push('\x1b[31mChanges not staged for commit:\x1b[0m');
      lines.push('  (use "/git-add <file>..." to update what will be committed)');
      lines.push('  (use "/git-checkout -- <file>..." to discard changes in working directory)');
      lines.push('');
      
      for (const file of status.unstaged) {
        const symbol = this.getStatusSymbol(file.status[1]);
        lines.push(`\t\x1b[31m${symbol} ${file.path}\x1b[0m`);
      }
      lines.push('');
    }

    // Untracked files
    if (status.untracked.length > 0) {
      lines.push('\x1b[31mUntracked files:\x1b[0m');
      lines.push('  (use "/git-add <file>..." to include in what will be committed)');
      lines.push('');
      
      for (const file of status.untracked) {
        lines.push(`\t\x1b[31m${file}\x1b[0m`);
      }
      lines.push('');
    }

    // Conflicts
    if (status.conflicts.length > 0) {
      lines.push('\x1b[35mUnmerged paths:\x1b[0m');
      lines.push('  (use "/git-add <file>..." to mark resolution)');
      lines.push('');
      
      for (const file of status.conflicts) {
        lines.push(`\t\x1b[35m${file.status} ${file.path}\x1b[0m`);
      }
      lines.push('');
    }

    // Ignored files
    if (status.ignoredCount > 0) {
      lines.push(`\x1b[90m${status.ignoredCount} ignored file(s)\x1b[0m`);
    }

    return lines.join('\n');
  }

  /**
   * Format branch information
   * @private
   * @param branch - Branch info
   * @returns Formatted branch string
   */
  private formatBranchInfo(branch: BranchInfo): string {
    let result = `On branch \x1b[1m${branch.name}\x1b[0m`;
    
    if (branch.upstream) {
      result += ` (tracking \x1b[36m${branch.upstream}\x1b[0m)`;
    }
    
    if (branch.ahead > 0 || branch.behind > 0) {
      const parts: string[] = [];
      if (branch.ahead > 0) parts.push(`ahead by ${branch.ahead}`);
      if (branch.behind > 0) parts.push(`behind by ${branch.behind}`);
      result += ` [${parts.join(', ')}]`;
    }
    
    return result;
  }

  /**
   * Get visual symbol for status code
   * @private
   * @param code - Status code character
   * @returns Visual symbol
   */
  private getStatusSymbol(code: string): string {
    switch (code) {
      case 'M': return 'modified:';
      case 'A': return 'new file:';
      case 'D': return 'deleted:';
      case 'R': return 'renamed:';
      case 'C': return 'copied:';
      case 'U': return 'updated:';
      case '?': return '??';
      default: return code;
    }
  }

  /**
   * Get help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mSTATUS CODES\x1b[0m

  XY format (from git status --porcelain):
  X = index status (staged)
  Y = working tree status (unstaged)

  M = modified    A = added    D = deleted
  R = renamed     C = copied   U = updated
  ? = untracked   ! = ignored

\x1b[1m\x1b[36mOUTPUT FORMATS\x1b[0m

  Long format (default): Human-readable with colors and descriptions
  Short format (-s): Compact two-column output
  Porcelain (--porcelain): Machine-parseable format
  JSON (--json): Structured data for scripting

`;
  }
}

export default GitStatusCommand;
