/**
 * GitHub MCP Server
 * 
 * This file contains a built-in MCP server for GitHub operations.
 */

import { createMCPServer, createToolResult } from '../MCPServer';
import {
  Tool,
  CallToolResult,
  ServerCapabilities,
} from '../types';

/**
 * GitHub server options
 */
export interface GitHubServerOptions {
  /**
   * GitHub API token
   */
  token?: string;

  /**
   * GitHub API base URL (for GitHub Enterprise)
   */
  baseUrl?: string;

  /**
   * Server name
   */
  name?: string;

  /**
   * Server version
   */
  version?: string;
}

/**
 * Create a GitHub MCP server
 */
export function createGitHubServer(options: GitHubServerOptions = {}) {
  const token = options.token || process.env.GITHUB_TOKEN;
  const baseUrl = options.baseUrl || 'https://api.github.com';

  const server = createMCPServer({
    name: options.name || 'github',
    version: options.version || '1.0.0',
    capabilities: {
      tools: { listChanged: true },
    },
  });

  // Helper for GitHub API requests
  const githubRequest = async (endpoint: string, method = 'GET', body?: unknown) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'MCP-GitHub-Server',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    return response.json();
  };

  // Register search_repositories tool
  server.registerTool(
    {
      name: 'search_repositories',
      description: 'Search for GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          sort: {
            type: 'string',
            description: 'Sort field (stars, forks, updated)',
          },
          order: {
            type: 'string',
            description: 'Sort order (asc, desc)',
          },
          per_page: {
            type: 'number',
            description: 'Results per page (max 100)',
          },
        },
        required: ['query'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const query = encodeURIComponent(args.query as string);
        const sort = args.sort || 'stars';
        const order = args.order || 'desc';
        const perPage = Math.min((args.per_page as number) || 30, 100);

        const data = await githubRequest(
          `/search/repositories?q=${query}&sort=${sort}&order=${order}&per_page=${perPage}`
        );

        const repos = data.items.map((repo: any) => ({
          name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          updated: repo.updated_at,
        }));

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(repos, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error searching repositories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register get_repository tool
  server.registerTool(
    {
      name: 'get_repository',
      description: 'Get information about a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const data = await githubRequest(`/repos/${args.owner}/${args.repo}`);

        const repo = {
          name: data.full_name,
          description: data.description,
          url: data.html_url,
          stars: data.stargazers_count,
          forks: data.forks_count,
          open_issues: data.open_issues_count,
          language: data.language,
          license: data.license?.name,
          default_branch: data.default_branch,
          created: data.created_at,
          updated: data.updated_at,
        };

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(repo, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error getting repository: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register list_issues tool
  server.registerTool(
    {
      name: 'list_issues',
      description: 'List issues in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            description: 'Issue state (open, closed, all)',
          },
          per_page: {
            type: 'number',
            description: 'Results per page',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const state = args.state || 'open';
        const perPage = Math.min((args.per_page as number) || 30, 100);

        const data = await githubRequest(
          `/repos/${args.owner}/${args.repo}/issues?state=${state}&per_page=${perPage}`
        );

        const issues = data.map((issue: any) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user.login,
          created: issue.created_at,
          updated: issue.updated_at,
          url: issue.html_url,
          labels: issue.labels.map((l: any) => l.name),
        }));

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(issues, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error listing issues: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register create_issue tool
  server.registerTool(
    {
      name: 'create_issue',
      description: 'Create a new issue in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue body',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue labels',
          },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const body: Record<string, unknown> = {
          title: args.title,
        };

        if (args.body) body.body = args.body;
        if (args.labels) body.labels = args.labels;

        const data = await githubRequest(
          `/repos/${args.owner}/${args.repo}/issues`,
          'POST',
          body
        );

        return createToolResult([
          {
            type: 'text',
            text: `Issue created successfully: ${data.html_url}`,
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error creating issue: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register get_file_contents tool
  server.registerTool(
    {
      name: 'get_file_contents',
      description: 'Get the contents of a file in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          path: {
            type: 'string',
            description: 'File path',
          },
          ref: {
            type: 'string',
            description: 'Git reference (branch, tag, commit)',
          },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const ref = args.ref ? `?ref=${args.ref}` : '';
        const data = await githubRequest(
          `/repos/${args.owner}/${args.repo}/contents/${args.path}${ref}`
        );

        if (data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return createToolResult([
            {
              type: 'text',
              text: content,
            },
          ]);
        } else {
          return createToolResult([
            {
              type: 'text',
              text: 'File is empty or is a directory',
            },
          ]);
        }
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error getting file contents: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register list_commits tool
  server.registerTool(
    {
      name: 'list_commits',
      description: 'List commits in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          sha: {
            type: 'string',
            description: 'Branch name or commit SHA',
          },
          per_page: {
            type: 'number',
            description: 'Results per page',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const sha = args.sha ? `?sha=${args.sha}` : '';
        const perPage = args.per_page ? `&per_page=${Math.min(args.per_page as number, 100)}` : '';

        const data = await githubRequest(
          `/repos/${args.owner}/${args.repo}/commits${sha}${perPage}`
        );

        const commits = data.map((commit: any) => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author.name,
          date: commit.commit.author.date,
          url: commit.html_url,
        }));

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(commits, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error listing commits: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register search_code tool
  server.registerTool(
    {
      name: 'search_code',
      description: 'Search for code on GitHub',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          per_page: {
            type: 'number',
            description: 'Results per page',
          },
        },
        required: ['query'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const query = encodeURIComponent(args.query as string);
        const perPage = Math.min((args.per_page as number) || 30, 100);

        const data = await githubRequest(
          `/search/code?q=${query}&per_page=${perPage}`
        );

        const results = data.items.map((item: any) => ({
          name: item.name,
          path: item.path,
          repository: item.repository.full_name,
          url: item.html_url,
        }));

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error searching code: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  // Register get_user tool
  server.registerTool(
    {
      name: 'get_user',
      description: 'Get information about a GitHub user',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'GitHub username',
          },
        },
        required: ['username'],
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const data = await githubRequest(`/users/${args.username}`);

        const user = {
          login: data.login,
          name: data.name,
          bio: data.bio,
          company: data.company,
          location: data.location,
          email: data.email,
          blog: data.blog,
          followers: data.followers,
          following: data.following,
          public_repos: data.public_repos,
          created: data.created_at,
          url: data.html_url,
        };

        return createToolResult([
          {
            type: 'text',
            text: JSON.stringify(user, null, 2),
          },
        ]);
      } catch (error) {
        return createToolResult(
          [
            {
              type: 'text',
              text: `Error getting user: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          true
        );
      }
    }
  );

  server.initialize();

  return server;
}

export default createGitHubServer;
