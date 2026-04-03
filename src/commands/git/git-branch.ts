/**
 * @fileoverview Git Branch Command - /git-branch
 * @module commands/git/git-branch
 * @description List, create, or delete branches with comprehensive branch management.
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
 * Branch information
 * @interface BranchInfo
 */
interface BranchInfo {
  /** Branch name */
  name: string;
  /** Is current branch */
  isCurrent: boolean;
  /** Is remote branch */
  isRemote: boolean;
  /** Remote tracking branch */
  upstream?: string;
  /** Last commit hash */
  lastCommit?: string;
  /** Last commit message */
  lastCommitMessage?: string;
  /** Author of last commit */
  lastAuthor?: string;
  /** Date of last commit */
  lastCommitDate?: Date;
  /** Ahead count */
  ahead?: number;
  /** Behind count */
  behind?: number;
  /** Is merged into current */
  isMerged?: boolean;
}

/**
 * Git Branch Command Implementation
 * @class GitBranchCommand
 * @extends Command
 * @description List, create, or delete branches. Supports listing with verbose
 * information, creating new branches, deleting branches, and renaming branches.
 * 
 * @example
 * ```typescript
 * const cmd = new GitBranchCommand();
 * const result = await cmd.run(context, {
 *   command: 'git-branch',
 *   args: { branchName: 'feature/new-feature' },
 *   options: { create: true },
 *   raw: '/git-branch feature/new-feature --create'
 * });
 * ```
 */
export class GitBranchCommand extends Command {
  /**
   * Creates a new git-branch command instance
   */
  constructor() {
    super({
      name: 'git-branch',
      description: 'List, create, or delete branches',
      category: 'git',
      aliases: ['gb', 'branch'],
      arguments: [
        {
          name: 'branchName',
          description: 'Branch name to create, delete, or operate on',
          required: false,
          type: 'string'
        },
        {
          name: 'startPoint',
          description: 'Revision to start the new branch from',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'a',
          long: 'all',
          description: 'List both remote-tracking and local branches',
          type: 'boolean',
          default: false
        },
        {
          short: 'r',
          long: 'remotes',
          description: 'List or delete remote-tracking branches',
          type: 'boolean',
          default: false
        },
        {
          short: 'c',
          long: 'create',
          description: 'Create a new branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'C',
          long: 'force-create',
          description: 'Create a new branch, resetting if it exists',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'delete',
          description: 'Delete a branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'D',
          long: 'force-delete',
          description: 'Force delete a branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'm',
          long: 'move',
          description: 'Move/rename a branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'M',
          long: 'force-move',
          description: 'Force move/rename a branch',
          type: 'boolean',
          default: false
        },
        {
          short: 'v',
          long: 'verbose',
          description: 'Show hash and subject for each head',
          type: 'boolean',
          default: false
        },
        {
          short: 'V',
          long: 'very-verbose',
          description: 'Show upstream and tracking info',
          type: 'boolean',
          default: false
        },
        {
          short: 'l',
          long: 'list',
          description: 'List branches (default when no operation specified)',
          type: 'boolean',
          default: true
        },
        {
          short: 's',
          long: 'sort',
          description: 'Sort branches by field',
          type: 'string',
          choices: ['name', '-name', 'committerdate', '-committerdate', 'authordate', '-authordate'],
          default: 'name'
        },
        {
          long: 'merged',
          description: 'List branches that have been merged',
          type: 'string'
        },
        {
          long: 'no-merged',
          description: 'List branches that have not been merged',
          type: 'string'
        },
        {
          long: 'contains',
          description: 'List branches containing the specified commit',
          type: 'string'
        },
        {
          long: 'no-contains',
          description: 'List branches not containing the specified commit',
          type: 'string'
        },
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        },
        {
          long: 'format',
          description: 'Format to use for listing branches',
          type: 'string'
        }
      ],
      examples: [
        {
          description: 'List all local branches',
          command: '/git-branch'
        },
        {
          description: 'List all branches including remotes',
          command: '/git-branch --all'
        },
        {
          description: 'Create a new branch',
          command: '/git-branch feature/new-feature --create'
        },
        {
          description: 'Create branch from specific commit',
          command: '/git-branch hotfix/bug-fix --create HEAD~3'
        },
        {
          description: 'Delete a branch',
          command: '/git-branch old-branch --delete'
        },
        {
          description: 'Force delete a branch',
          command: '/git-branch old-branch --force-delete'
        },
        {
          description: 'Rename current branch',
          command: '/git-branch new-name --move'
        },
        {
          description: 'Show verbose branch info',
          command: '/git-branch --verbose'
        },
        {
          description: 'List merged branches',
          command: '/git-branch --merged'
        },
        {
          description: 'List unmerged branches',
          command: '/git-branch --no-merged'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['git-checkout', 'git-merge', 'git-push'],
      version: '1.0.0'
    });
  }

  /**
   * Execute the git-branch command
   * @param context - Command execution context
   * @param args - Parsed command arguments
   * @returns Promise resolving to command result
   */
  public async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        all?: boolean;
        remotes?: boolean;
        create?: boolean;
        'force-create'?: boolean;
        delete?: boolean;
        'force-delete'?: boolean;
        move?: boolean;
        'force-move'?: boolean;
        verbose?: boolean;
        'very-verbose'?: boolean;
        list?: boolean;
        sort?: string;
        merged?: string;
        'no-merged'?: string;
        contains?: string;
        'no-contains'?: string;
        json?: boolean;
        format?: string;
      };

      const branchName = args.args.branchName as string | undefined;
      const startPoint = args.args.startPoint as string | undefined;

      // Determine operation
      const operation = this.determineOperation(options, branchName);

      // Execute appropriate operation
      switch (operation) {
        case 'list':
          return await this.listBranches(context, options, branchName);
        case 'create':
          if (!branchName) {
            return CommandResultBuilder.failure('Branch name is required for create operation');
          }
          return await this.createBranch(context, branchName, startPoint, options['force-create']);
        case 'delete':
          if (!branchName) {
            return CommandResultBuilder.failure('Branch name is required for delete operation');
          }
          return await this.deleteBranch(context, branchName, options['force-delete']);
        case 'move':
          if (!branchName) {
            return CommandResultBuilder.failure('New branch name is required for rename operation');
          }
          return await this.moveBranch(context, branchName, options['force-move']);
        default:
          return CommandResultBuilder.failure('Unknown operation');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not a git repository')) {
        return CommandResultBuilder.failure(
          'Not a git repository. Run "git init" to create one.',
          128
        );
      }
      
      if (errorMessage.includes('already exists')) {
        return CommandResultBuilder.failure(
          'Branch already exists. Use --force-create to reset it.',
          128
        );
      }
      
      if (errorMessage.includes('not found')) {
        return CommandResultBuilder.failure(
          'Branch not found.',
          128
        );
      }
      
      return CommandResultBuilder.failure(
        `Branch operation failed: ${errorMessage}`,
        1
      );
    }
  }

  /**
   * Determine the operation to perform
   * @private
   * @param options - Parsed options
   * @param branchName - Branch name argument
   * @returns Operation type
   */
  private determineOperation(
    options: Record<string, unknown>,
    branchName?: string
  ): 'list' | 'create' | 'delete' | 'move' {
    if (options.create || options['force-create']) return 'create';
    if (options.delete || options['force-delete']) return 'delete';
    if (options.move || options['force-move']) return 'move';
    return 'list';
  }

  /**
   * List branches
   * @private
   * @param context - Command context
   * @param options - Parsed options
   * @param pattern - Optional pattern filter
   * @returns Command result
   */
  private async listBranches(
    context: CommandContext,
    options: Record<string, unknown>,
    pattern?: string
  ): Promise<CommandResult> {
    const args: string[] = ['branch'];

    // Build list options
    if (options.all) args.push('-a');
    if (options.remotes) args.push('-r');
    if (options.verbose) args.push('-v');
    if (options['very-verbose']) args.push('-vv');
    if (options.sort) args.push(`--sort=${options.sort}`);
    if (options.merged) args.push(`--merged=${options.merged}`);
    if (options['no-merged']) args.push(`--no-merged=${options['no-merged']}`);
    if (options.contains) args.push(`--contains=${options.contains}`);
    if (options['no-contains']) args.push(`--no-contains=${options['no-contains']}`);
    if (options.format) args.push(`--format=${options.format}`);

    // Add pattern if specified
    if (pattern) {
      args.push('--list');
      args.push(pattern);
    }

    const output = await this.executeGitCommand(args, context.cwd);

    if (options.json) {
      const branches = this.parseBranchOutput(output);
      return CommandResultBuilder.success({ branches });
    }

    context.output.write(output);
    
    const branchCount = output.split('\n').filter(l => l.trim()).length;
    return CommandResultBuilder.success({ branchCount });
  }

  /**
   * Create a new branch
   * @private
   * @param context - Command context
   * @param branchName - Name for the new branch
   * @param startPoint - Starting point (commit/branch)
   * @param force - Force creation if exists
   * @returns Command result
   */
  private async createBranch(
    context: CommandContext,
    branchName: string,
    startPoint?: string,
    force?: boolean
  ): Promise<CommandResult> {
    const args: string[] = ['branch'];
    
    if (force) {
      args.push('-C');
    }
    
    args.push(branchName);
    
    if (startPoint) {
      args.push(startPoint);
    }

    await this.executeGitCommand(args, context.cwd);

    const message = force 
      ? `Branch '${branchName}' reset${startPoint ? ` to ${startPoint}` : ''}`
      : `Created branch '${branchName}'${startPoint ? ` from ${startPoint}` : ''}`;
    
    context.output.success(message);
    
    return CommandResultBuilder.success({ 
      branch: branchName,
      startPoint: startPoint || 'HEAD',
      created: true 
    });
  }

  /**
   * Delete a branch
   * @private
   * @param context - Command context
   * @param branchName - Branch to delete
   * @param force - Force deletion
   * @returns Command result
   */
  private async deleteBranch(
    context: CommandContext,
    branchName: string,
    force?: boolean
  ): Promise<CommandResult> {
    // Check if trying to delete current branch
    const currentBranch = await this.getCurrentBranch(context.cwd);
    if (branchName === currentBranch) {
      return CommandResultBuilder.failure(
        `Cannot delete the branch '${branchName}' which you are currently on.\n` +
        `Switch to another branch first using /git-checkout.`,
        1
      );
    }

    const args: string[] = ['branch'];
    args.push(force ? '-D' : '-d');
    args.push(branchName);

    try {
      await this.executeGitCommand(args, context.cwd);
      
      context.output.success(`Deleted branch '${branchName}'`);
      return CommandResultBuilder.success({ 
        branch: branchName,
        deleted: true 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('not fully merged')) {
        return CommandResultBuilder.failure(
          `The branch '${branchName}' is not fully merged.\n` +
          `If you are sure you want to delete it, use --force-delete.`,
          1
        );
      }
      
      throw error;
    }
  }

  /**
   * Rename/move a branch
   * @private
   * @param context - Command context
   * @param newName - New branch name
   * @param force - Force rename
   * @returns Command result
   */
  private async moveBranch(
    context: CommandContext,
    newName: string,
    force?: boolean
  ): Promise<CommandResult> {
    const args: string[] = ['branch'];
    args.push(force ? '-M' : '-m');
    args.push(newName);

    const oldName = await this.getCurrentBranch(context.cwd);
    await this.executeGitCommand(args, context.cwd);

    context.output.success(`Renamed branch '${oldName}' to '${newName}'`);
    
    return CommandResultBuilder.success({ 
      oldName,
      newName,
      renamed: true 
    });
  }

  /**
   * Get current branch name
   * @private
   * @param cwd - Working directory
   * @returns Current branch name
   */
  private async getCurrentBranch(cwd: string): Promise<string> {
    const output = await this.executeGitCommand(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      cwd
    );
    return output.trim();
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
   * Parse branch output into structured format
   * @private
   * @param output - Raw branch output
   * @returns Array of branch info
   */
  private parseBranchOutput(output: string): BranchInfo[] {
    const branches: BranchInfo[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/^(\*|\s)\s+(\S+)\s*(.*)$/);
      if (match) {
        const isCurrent = match[1] === '*';
        const name = match[2];
        const rest = match[3];

        const branch: BranchInfo = {
          name,
          isCurrent,
          isRemote: name.startsWith('remotes/')
        };

        // Parse verbose info if present
        const verboseMatch = rest.match(/(\S+)\s+(.+)/);
        if (verboseMatch) {
          branch.lastCommit = verboseMatch[1];
          branch.lastCommitMessage = verboseMatch[2];
        }

        branches.push(branch);
      }
    }

    return branches;
  }

  /**
   * Get help text for the command
   * @returns Formatted help text
   */
  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mBRANCH NAMING CONVENTIONS\x1b[0m

  Common prefixes for branch names:
    feature/   - New features
    bugfix/    - Bug fixes
    hotfix/    - Urgent production fixes
    release/   - Release preparation
    docs/      - Documentation updates
    refactor/  - Code refactoring
    test/      - Test-related changes

\x1b[1m\x1b[36mWORKFLOW TIPS\x1b[0m

  Create a feature branch:
    /git-branch feature/my-feature --create

  List remote branches:
    /git-branch --remotes

  Clean up merged branches:
    /git-branch --merged | xargs /git-branch --delete

  Find branches containing a commit:
    /git-branch --contains abc123

\x1b[1m\x1b[36mSAFETY NOTES\x1b[0m

  - Cannot delete the current branch
  - Use --force-delete only when sure
  - Check /git-branch --merged before cleanup

`;
  }
}

export default GitBranchCommand;
