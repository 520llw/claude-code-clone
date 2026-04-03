/**
 * GitHubPlugin.ts
 * 
 * GitHub Integration Plugin for Claude Code Clone
 * 
 * This plugin provides GitHub integration capabilities including:
 * - Repository management
 * - Issue tracking
 * - Pull request operations
 * - Workflow monitoring
 * - Release management
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, ConfigSchemaEntry } from '../Plugin';

/**
 * GitHub repository information
 */
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  issues: number;
  private: boolean;
  defaultBranch: string;
}

/**
 * GitHub issue information
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

/**
 * GitHub pull request information
 */
export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  branch: string;
  baseBranch: string;
  draft: boolean;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

/**
 * GitHub workflow information
 */
export interface GitHubWorkflow {
  id: number;
  name: string;
  state: 'active' | 'disabled';
  path: string;
  url: string;
}

/**
 * GitHubPlugin - Provides GitHub integration for Claude Code Clone.
 * 
 * This plugin enables GitHub operations within the application, allowing
 * users to interact with GitHub repositories, issues, and pull requests.
 * 
 * @example
 * ```typescript
 * const githubPlugin = new GitHubPlugin();
 * await pluginManager.loadPlugin(githubPlugin);
 * 
 * // List repositories
 * const repos = await githubPlugin.listRepositories();
 * ```
 */
export class GitHubPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.github',
    name: 'GitHub Integration',
    version: '1.0.0',
    description: 'Provides GitHub integration including repository management, issue tracking, and pull request operations',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.INTEGRATION,
    keywords: ['github', 'git', 'repository', 'issues', 'pull-requests'],
    enabledByDefault: false,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'token',
      type: 'string',
      label: 'GitHub Personal Access Token',
      description: 'Your GitHub personal access token for API authentication',
      required: true,
      sensitive: true
    },
    {
      key: 'apiUrl',
      type: 'string',
      label: 'GitHub API URL',
      description: 'GitHub API URL (use for GitHub Enterprise)',
      default: 'https://api.github.com',
      required: false
    },
    {
      key: 'defaultOwner',
      type: 'string',
      label: 'Default Repository Owner',
      description: 'Default GitHub username or organization',
      required: false
    },
    {
      key: 'autoSyncIssues',
      type: 'boolean',
      label: 'Auto-sync issues',
      description: 'Automatically sync issues to local storage',
      default: false,
      required: false
    },
    {
      key: 'showNotifications',
      type: 'boolean',
      label: 'Show notifications',
      description: 'Show notifications for GitHub events',
      default: true,
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onCommand'],
    providesCommands: [
      'github.repo.list',
      'github.repo.get',
      'github.issue.list',
      'github.issue.create',
      'github.pr.list',
      'github.pr.create',
      'github.workflow.list'
    ],
    requiresNetwork: true
  };

  /**
   * GitHub API token
   */
  private token: string = '';

  /**
   * GitHub API base URL
   */
  private apiUrl: string = 'https://api.github.com';

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('GitHubPlugin activated');

    // Get configuration
    this.token = this.context.config.token || '';
    this.apiUrl = this.context.config.apiUrl || 'https://api.github.com';

    if (!this.token) {
      this.logger.warn('GitHub token not configured');
      this.ui.showNotification('GitHub token not configured. Please set it in plugin settings.', 'warning');
    }

    // Register hooks
    this.registerHook('onCommand', this.handleCommand.bind(this));

    // Register commands
    this.registerCommand('github.repo.list', this.listRepositories.bind(this));
    this.registerCommand('github.repo.get', this.getRepository.bind(this));
    this.registerCommand('github.issue.list', this.listIssues.bind(this));
    this.registerCommand('github.issue.create', this.createIssue.bind(this));
    this.registerCommand('github.issue.update', this.updateIssue.bind(this));
    this.registerCommand('github.pr.list', this.listPullRequests.bind(this));
    this.registerCommand('github.pr.create', this.createPullRequest.bind(this));
    this.registerCommand('github.workflow.list', this.listWorkflows.bind(this));
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('GitHubPlugin deactivated');
  }

  /**
   * Handles command events.
   */
  private async handleCommand(context: any): Promise<void> {
    const { command } = context.data;

    if (command.startsWith('gh ') || command.startsWith('github ')) {
      this.logger.debug(`Intercepted GitHub command: ${command}`);
    }
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  /**
   * Makes an authenticated API request to GitHub.
   * 
   * @param endpoint - API endpoint
   * @param options - Request options
   * @returns API response
   */
  private async apiRequest<T>(
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
  ): Promise<T> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    const url = new URL(endpoint, this.apiUrl);
    
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.append(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Repository Operations
  // ============================================================================

  /**
   * Lists repositories for the authenticated user.
   * 
   * @param options - List options
   * @returns Array of repositories
   */
  public async listRepositories(options: { type?: 'all' | 'owner' | 'member'; sort?: string; limit?: number } = {}): Promise<GitHubRepo[]> {
    const params: Record<string, string> = {};
    
    if (options.type) {
      params.type = options.type;
    }
    if (options.sort) {
      params.sort = options.sort;
    }
    if (options.limit) {
      params.per_page = options.limit.toString();
    }

    const repos = await this.apiRequest<any[]>('/user/repos', { params });

    return repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      issues: repo.open_issues_count,
      private: repo.private,
      defaultBranch: repo.default_branch
    }));
  }

  /**
   * Gets a specific repository.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository information
   */
  public async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    const data = await this.apiRequest<any>(`/repos/${owner}/${repo}`);

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      url: data.html_url,
      stars: data.stargazers_count,
      forks: data.forks_count,
      issues: data.open_issues_count,
      private: data.private,
      defaultBranch: data.default_branch
    };
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Lists issues for a repository.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - List options
   * @returns Array of issues
   */
  public async listIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string[]; assignee?: string; limit?: number } = {}
  ): Promise<GitHubIssue[]> {
    const params: Record<string, string> = {};
    
    if (options.state) {
      params.state = options.state;
    }
    if (options.labels) {
      params.labels = options.labels.join(',');
    }
    if (options.assignee) {
      params.assignee = options.assignee;
    }
    if (options.limit) {
      params.per_page = options.limit.toString();
    }

    const issues = await this.apiRequest<any[]>(`/repos/${owner}/${repo}/issues`, { params });

    return issues.map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      author: issue.user.login,
      labels: issue.labels.map((l: any) => l.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      url: issue.html_url
    }));
  }

  /**
   * Creates a new issue.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param title - Issue title
   * @param options - Issue options
   * @returns Created issue
   */
  public async createIssue(
    owner: string,
    repo: string,
    title: string,
    options: { body?: string; labels?: string[]; assignees?: string[] } = {}
  ): Promise<GitHubIssue> {
    const body: any = { title };
    
    if (options.body) {
      body.body = options.body;
    }
    if (options.labels) {
      body.labels = options.labels;
    }
    if (options.assignees) {
      body.assignees = options.assignees;
    }

    const issue = await this.apiRequest<any>(
      `/repos/${owner}/${repo}/issues`,
      { method: 'POST', body }
    );

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      author: issue.user.login,
      labels: issue.labels.map((l: any) => l.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      url: issue.html_url
    };
  }

  /**
   * Updates an issue.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue number
   * @param updates - Updates to apply
   * @returns Updated issue
   */
  public async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[] }
  ): Promise<GitHubIssue> {
    const issue = await this.apiRequest<any>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      { method: 'PATCH', body: updates }
    );

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      author: issue.user.login,
      labels: issue.labels.map((l: any) => l.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      url: issue.html_url
    };
  }

  // ============================================================================
  // Pull Request Operations
  // ============================================================================

  /**
   * Lists pull requests for a repository.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - List options
   * @returns Array of pull requests
   */
  public async listPullRequests(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; limit?: number } = {}
  ): Promise<GitHubPR[]> {
    const params: Record<string, string> = {};
    
    if (options.state) {
      params.state = options.state;
    }
    if (options.limit) {
      params.per_page = options.limit.toString();
    }

    const prs = await this.apiRequest<any[]>(`/repos/${owner}/${repo}/pulls`, { params });

    return prs.map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      author: pr.user.login,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      draft: pr.draft,
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      url: pr.html_url
    }));
  }

  /**
   * Creates a new pull request.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param title - PR title
   * @param head - Head branch
   * @param base - Base branch
   * @param options - PR options
   * @returns Created pull request
   */
  public async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    options: { body?: string; draft?: boolean } = {}
  ): Promise<GitHubPR> {
    const body: any = { title, head, base };
    
    if (options.body) {
      body.body = options.body;
    }
    if (options.draft) {
      body.draft = options.draft;
    }

    const pr = await this.apiRequest<any>(
      `/repos/${owner}/${repo}/pulls`,
      { method: 'POST', body }
    );

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      author: pr.user.login,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      draft: pr.draft,
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      url: pr.html_url
    };
  }

  // ============================================================================
  // Workflow Operations
  // ============================================================================

  /**
   * Lists workflows for a repository.
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Array of workflows
   */
  public async listWorkflows(owner: string, repo: string): Promise<GitHubWorkflow[]> {
    const data = await this.apiRequest<any>(`/repos/${owner}/${repo}/actions/workflows`);

    return data.workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      state: workflow.state,
      path: workflow.path,
      url: workflow.html_url
    }));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Parses a GitHub repository URL or string.
   * 
   * @param input - Repository URL or "owner/repo" string
   * @returns Owner and repo name
   */
  public parseRepoString(input: string): { owner: string; repo: string } {
    // Handle full URLs
    if (input.includes('github.com')) {
      const match = input.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
      }
    }

    // Handle owner/repo format
    const parts = input.split('/');
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1] };
    }

    throw new Error(`Invalid repository format: ${input}`);
  }

  /**
   * Checks if the plugin is configured with a valid token.
   * 
   * @returns True if configured
   */
  public isConfigured(): boolean {
    return !!this.token;
  }
}

export default GitHubPlugin;
