/**
 * GitPlugin.ts
 * 
 * Git Integration Plugin for Claude Code Clone
 * 
 * This plugin provides Git integration capabilities including:
 * - Repository status monitoring
 * - Branch management
 * - Commit automation
 * - Diff viewing
 * - Git command execution
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, PluginConfig, ConfigSchemaEntry } from '../Plugin';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Git status information
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  clean: boolean;
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  files: string[];
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead: number;
  behind: number;
}

/**
 * Git diff information
 */
export interface GitDiff {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
}

/**
 * GitPlugin - Provides Git integration for Claude Code Clone.
 * 
 * This plugin enables Git operations within the application, allowing
 * users to interact with Git repositories through hooks and commands.
 * 
 * @example
 * ```typescript
 * const gitPlugin = new GitPlugin();
 * await pluginManager.loadPlugin(gitPlugin);
 * 
 * // Get repository status
 * const status = await gitPlugin.getStatus();
 * console.log(status.branch);
 * ```
 */
export class GitPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.git',
    name: 'Git Integration',
    version: '1.0.0',
    description: 'Provides Git integration including status monitoring, branch management, and commit automation',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.INTEGRATION,
    keywords: ['git', 'version-control', 'scm', 'repository'],
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'autoCommit',
      type: 'boolean',
      label: 'Auto-commit changes',
      description: 'Automatically commit changes after file modifications',
      default: false,
      required: false
    },
    {
      key: 'commitMessageTemplate',
      type: 'string',
      label: 'Commit message template',
      description: 'Template for auto-generated commit messages',
      default: 'Update {filename}',
      required: false
    },
    {
      key: 'showStatusInPrompt',
      type: 'boolean',
      label: 'Show Git status in prompt',
      description: 'Display current branch and status in the command prompt',
      default: true,
      required: false
    },
    {
      key: 'enableDiffView',
      type: 'boolean',
      label: 'Enable diff view',
      description: 'Show file diffs when viewing changes',
      default: true,
      required: false
    },
    {
      key: 'defaultBranch',
      type: 'string',
      label: 'Default branch name',
      description: 'Default branch to use when creating new repositories',
      default: 'main',
      required: false
    },
    {
      key: 'signCommits',
      type: 'boolean',
      label: 'Sign commits',
      description: 'GPG sign all commits',
      default: false,
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onFileChange', 'onCommand'],
    providesCommands: ['git.status', 'git.commit', 'git.branch', 'git.diff', 'git.log'],
    requiresShell: true,
    requiresFileSystem: true
  };

  /**
   * Current repository path
   */
  private repoPath: string = '';

  /**
   * Whether we're in a Git repository
   */
  private isRepo: boolean = false;

  /**
   * File watchers
   */
  private fileWatchers: Map<string, any> = new Map();

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('GitPlugin activated');

    // Detect Git repository
    await this.detectRepository();

    // Register hooks
    this.registerHook('onFileChange', this.handleFileChange.bind(this));
    this.registerHook('onCommand', this.handleCommand.bind(this));

    // Register commands
    this.registerCommand('git.status', this.getStatus.bind(this));
    this.registerCommand('git.commit', this.commit.bind(this));
    this.registerCommand('git.branch', this.getBranches.bind(this));
    this.registerCommand('git.diff', this.getDiff.bind(this));
    this.registerCommand('git.log', this.getLog.bind(this));
    this.registerCommand('git.add', this.add.bind(this));
    this.registerCommand('git.push', this.push.bind(this));
    this.registerCommand('git.pull', this.pull.bind(this));
    this.registerCommand('git.checkout', this.checkout.bind(this));
    this.registerCommand('git.merge', this.merge.bind(this));
    this.registerCommand('git.stash', this.stash.bind(this));

    // Show status in UI if enabled
    if (this.context.config.showStatusInPrompt && this.isRepo) {
      const status = await this.getStatus();
      this.ui.showNotification(`Git: ${status.branch} ${status.clean ? '✓' : '*'}`);
    }
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('GitPlugin deactivated');

    // Close file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();
  }

  /**
   * Detects if we're in a Git repository.
   */
  private async detectRepository(): Promise<void> {
    try {
      const cwd = process.cwd();
      await execAsync('git rev-parse --git-dir', { cwd });
      this.repoPath = cwd;
      this.isRepo = true;
      this.logger.info(`Git repository detected: ${cwd}`);
    } catch {
      this.isRepo = false;
      this.logger.info('No Git repository detected');
    }
  }

  /**
   * Handles file change events.
   */
  private async handleFileChange(context: any): Promise<void> {
    if (!this.isRepo || !this.context.config.autoCommit) {
      return;
    }

    const { path: filePath, changeType } = context.data;

    // Only handle modifications
    if (changeType !== 'modified' && changeType !== 'created') {
      return;
    }

    // Auto-add the file
    await this.add(filePath);

    // Auto-commit if enabled
    const filename = path.basename(filePath);
    const message = this.context.config.commitMessageTemplate.replace('{filename}', filename);
    
    try {
      await this.commit(message);
      this.logger.info(`Auto-committed: ${message}`);
    } catch (error) {
      this.logger.error('Auto-commit failed:', error);
    }
  }

  /**
   * Handles command events.
   */
  private async handleCommand(context: any): Promise<void> {
    const { command } = context.data;

    // Intercept git commands
    if (command.startsWith('git ')) {
      this.logger.debug(`Intercepted git command: ${command}`);
    }
  }

  // ============================================================================
  // Git Operations
  // ============================================================================

  /**
   * Gets the repository status.
   * 
   * @returns Git status information
   */
  public async getStatus(): Promise<GitStatus> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      // Get branch info
      const { stdout: branchOutput } = await execAsync(
        'git branch --show-current',
        { cwd: this.repoPath }
      );
      const branch = branchOutput.trim();

      // Get ahead/behind
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: abOutput } = await execAsync(
          'git rev-list --left-right --count HEAD...@{upstream}',
          { cwd: this.repoPath }
        );
        const [a, b] = abOutput.trim().split('\t').map(Number);
        ahead = a || 0;
        behind = b || 0;
      } catch {
        // No upstream
      }

      // Get status
      const { stdout: statusOutput } = await execAsync(
        'git status --porcelain',
        { cwd: this.repoPath }
      );

      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];
      const conflicted: string[] = [];

      for (const line of statusOutput.split('\n')) {
        if (!line) continue;

        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status[0] === 'U' || status[1] === 'U' || status === 'AA' || status === 'DD') {
          conflicted.push(file);
        } else if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file);
        } else if (status[1] === 'M') {
          modified.push(file);
        } else if (status === '??') {
          untracked.push(file);
        }
      }

      return {
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
        conflicted,
        clean: staged.length === 0 && modified.length === 0 && untracked.length === 0 && conflicted.length === 0
      };
    } catch (error) {
      this.logger.error('Failed to get Git status:', error);
      throw error;
    }
  }

  /**
   * Adds files to the staging area.
   * 
   * @param files - Files to add
   */
  public async add(files: string | string[]): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    const fileList = Array.isArray(files) ? files.join(' ') : files;
    
    try {
      await execAsync(`git add "${fileList}"`, { cwd: this.repoPath });
      this.logger.info(`Added files: ${fileList}`);
    } catch (error) {
      this.logger.error('Failed to add files:', error);
      throw error;
    }
  }

  /**
   * Creates a commit.
   * 
   * @param message - Commit message
   * @param options - Commit options
   */
  public async commit(
    message: string,
    options: { addAll?: boolean; sign?: boolean } = {}
  ): Promise<string> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git commit';

      if (options.addAll) {
        cmd += ' -a';
      }

      if (options.sign || this.context.config.signCommits) {
        cmd += ' -S';
      }

      cmd += ` -m "${message.replace(/"/g, '\\"')}"`;

      const { stdout } = await execAsync(cmd, { cwd: this.repoPath });
      
      // Extract commit hash
      const match = stdout.match(/\[.+\s+([a-f0-9]+)\]/);
      const hash = match ? match[1] : '';

      this.logger.info(`Created commit: ${hash}`);
      
      return hash;
    } catch (error) {
      this.logger.error('Failed to create commit:', error);
      throw error;
    }
  }

  /**
   * Gets the list of branches.
   * 
   * @returns Array of branches
   */
  public async getBranches(): Promise<GitBranch[]> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      const { stdout } = await execAsync(
        'git branch -vv',
        { cwd: this.repoPath }
      );

      const branches: GitBranch[] = [];

      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;

        const current = line.startsWith('*');
        const name = line.substring(2).split(/\s+/)[0];
        
        // Parse ahead/behind if present
        let ahead = 0;
        let behind = 0;
        const abMatch = line.match(/\[([^\]]+)\]/);
        if (abMatch) {
          const ab = abMatch[1];
          const aheadMatch = ab.match(/ahead\s+(\d+)/);
          const behindMatch = ab.match(/behind\s+(\d+)/);
          if (aheadMatch) ahead = parseInt(aheadMatch[1]);
          if (behindMatch) behind = parseInt(behindMatch[1]);
        }

        branches.push({
          name,
          current,
          ahead,
          behind
        });
      }

      return branches;
    } catch (error) {
      this.logger.error('Failed to get branches:', error);
      throw error;
    }
  }

  /**
   * Gets the diff for files.
   * 
   * @param files - Files to diff (optional)
   * @returns Array of diffs
   */
  public async getDiff(files?: string | string[]): Promise<GitDiff[]> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git diff --stat';
      if (files) {
        const fileList = Array.isArray(files) ? files.join(' ') : files;
        cmd += ` -- "${fileList}"`;
      }

      const { stdout: statOutput } = await execAsync(cmd, { cwd: this.repoPath });

      const diffs: GitDiff[] = [];

      for (const line of statOutput.split('\n')) {
        const match = line.match(/(.+)\s+\|\s+(\d+)\s+([\-+]+)/);
        if (!match) continue;

        const file = match[1].trim();
        const changes = match[3];
        const additions = (changes.match(/\+/g) || []).length;
        const deletions = (changes.match(/-/g) || []).length;

        // Get the actual diff
        const { stdout: diffOutput } = await execAsync(
          `git diff -- "${file}"`,
          { cwd: this.repoPath }
        );

        diffs.push({
          file,
          status: 'modified',
          additions,
          deletions,
          diff: diffOutput
        });
      }

      return diffs;
    } catch (error) {
      this.logger.error('Failed to get diff:', error);
      throw error;
    }
  }

  /**
   * Gets the commit log.
   * 
   * @param options - Log options
   * @returns Array of commits
   */
  public async getLog(options: { limit?: number; file?: string } = {}): Promise<GitCommit[]> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git log --pretty=format:"%H|%h|%s|%an|%ae|%ad" --date=iso';
      
      if (options.limit) {
        cmd += ` -n ${options.limit}`;
      }

      if (options.file) {
        cmd += ` -- "${options.file}"`;
      }

      const { stdout } = await execAsync(cmd, { cwd: this.repoPath });

      const commits: GitCommit[] = [];

      for (const line of stdout.split('\n')) {
        if (!line) continue;

        const [hash, shortHash, message, author, email, dateStr] = line.split('|');

        commits.push({
          hash,
          shortHash,
          message,
          author,
          email,
          date: new Date(dateStr),
          files: []
        });
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to get log:', error);
      throw error;
    }
  }

  /**
   * Pushes changes to remote.
   * 
   * @param options - Push options
   */
  public async push(options: { remote?: string; branch?: string; force?: boolean } = {}): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git push';

      if (options.remote) {
        cmd += ` ${options.remote}`;
      }

      if (options.branch) {
        cmd += ` ${options.branch}`;
      }

      if (options.force) {
        cmd += ' --force';
      }

      await execAsync(cmd, { cwd: this.repoPath });
      this.logger.info('Pushed to remote');
    } catch (error) {
      this.logger.error('Failed to push:', error);
      throw error;
    }
  }

  /**
   * Pulls changes from remote.
   * 
   * @param options - Pull options
   */
  public async pull(options: { remote?: string; branch?: string; rebase?: boolean } = {}): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git pull';

      if (options.rebase) {
        cmd += ' --rebase';
      }

      if (options.remote) {
        cmd += ` ${options.remote}`;
      }

      if (options.branch) {
        cmd += ` ${options.branch}`;
      }

      await execAsync(cmd, { cwd: this.repoPath });
      this.logger.info('Pulled from remote');
    } catch (error) {
      this.logger.error('Failed to pull:', error);
      throw error;
    }
  }

  /**
   * Checks out a branch or commit.
   * 
   * @param target - Branch or commit to checkout
   * @param options - Checkout options
   */
  public async checkout(target: string, options: { create?: boolean } = {}): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git checkout';

      if (options.create) {
        cmd += ' -b';
      }

      cmd += ` "${target}"`;

      await execAsync(cmd, { cwd: this.repoPath });
      this.logger.info(`Checked out: ${target}`);
    } catch (error) {
      this.logger.error('Failed to checkout:', error);
      throw error;
    }
  }

  /**
   * Merges a branch.
   * 
   * @param branch - Branch to merge
   * @param options - Merge options
   */
  public async merge(branch: string, options: { squash?: boolean; noCommit?: boolean } = {}): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git merge';

      if (options.squash) {
        cmd += ' --squash';
      }

      if (options.noCommit) {
        cmd += ' --no-commit';
      }

      cmd += ` "${branch}"`;

      await execAsync(cmd, { cwd: this.repoPath });
      this.logger.info(`Merged: ${branch}`);
    } catch (error) {
      this.logger.error('Failed to merge:', error);
      throw error;
    }
  }

  /**
   * Stashes changes.
   * 
   * @param options - Stash options
   */
  public async stash(options: { message?: string; includeUntracked?: boolean } = {}): Promise<void> {
    if (!this.isRepo) {
      throw new Error('Not in a Git repository');
    }

    try {
      let cmd = 'git stash push';

      if (options.message) {
        cmd += ` -m "${options.message}"`;
      }

      if (options.includeUntracked) {
        cmd += ' -u';
      }

      await execAsync(cmd, { cwd: this.repoPath });
      this.logger.info('Changes stashed');
    } catch (error) {
      this.logger.error('Failed to stash:', error);
      throw error;
    }
  }

  /**
   * Checks if we're in a Git repository.
   * 
   * @returns True if in a Git repository
   */
  public isRepository(): boolean {
    return this.isRepo;
  }

  /**
   * Gets the repository path.
   * 
   * @returns Repository path
   */
  public getRepositoryPath(): string {
    return this.repoPath;
  }
}

export default GitPlugin;
