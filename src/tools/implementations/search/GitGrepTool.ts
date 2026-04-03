/**
 * @fileoverview Git Grep Tool for Claude Code Clone
 * 
 * This tool searches git history for patterns:
 * - Search commit messages
 * - Search code in commits
 * - Find when code was added/removed
 * 
 * @module GitGrepTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

const execAsync = promisify(exec);

// ============================================================================
// Input Schema
// ============================================================================

export const GitGrepInputSchema = z.object({
  pattern: z.string().min(1).describe('Pattern to search for'),
  path: z.string().optional().describe('Repository path'),
  search_in: z.enum(['commits', 'diffs', 'messages']).default('diffs').describe('Where to search'),
  since: z.string().optional().describe('Search commits since date (e.g., "1 week ago")'),
  author: z.string().optional().describe('Filter by author'),
  max_results: z.number().int().min(1).max(100).default(20).describe('Maximum results'),
}).describe('Input for git grep search');

export type GitGrepInput = z.infer<typeof GitGrepInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const GitMatchSchema = z.object({
  commit_hash: z.string().describe('Commit hash'),
  commit_message: z.string().describe('Commit message'),
  author: z.string().describe('Author name'),
  date: z.string().describe('Commit date'),
  file_path: z.string().optional().describe('File path (for diffs)'),
  line_content: z.string().optional().describe('Matching line content'),
}).describe('Git search match');

export const GitGrepOutputSchema = z.object({
  pattern: z.string().describe('Search pattern'),
  search_in: z.string().describe('Search scope'),
  matches: z.array(GitMatchSchema).describe('Matching commits'),
  total_commits_searched: z.number().int().describe('Commits searched'),
}).describe('Result of git grep');

export type GitGrepOutput = z.infer<typeof GitGrepOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class GitGrepTool extends Tool {
  public readonly name = 'git_grep';
  public readonly description = 'Search git history for patterns in commits, diffs, or messages';
  public readonly documentation = `
## Git Grep Tool

Searches git repository history:
- Search commit messages
- Search code changes in commits
- Find when code was added/removed

### Input Parameters

- **pattern** (required): Pattern to search for
- **path** (optional): Repository path
- **search_in** (optional): 'commits', 'diffs', or 'messages'
- **since** (optional): Date filter (e.g., "1 week ago")
- **author** (optional): Filter by author
- **max_results** (optional): Maximum results

### Output

Returns matching commits with:
- commit_hash: Commit identifier
- commit_message: Commit message
- author: Commit author
- date: Commit date
- file_path: Affected file (for diffs)
- line_content: Matching content

### Examples

Search commit messages:
\`\`\`json
{
  "pattern": "fix bug",
  "search_in": "messages"
}
\`\`\`

Search code changes:
\`\`\`json
{
  "pattern": "function login",
  "search_in": "diffs",
  "since": "1 month ago"
}
\`\`\`
  `;
  public readonly category = ToolCategory.SEARCH;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = GitGrepInputSchema;
  public readonly outputSchema = GitGrepOutputSchema;
  public readonly tags = ['git', 'search', 'history', 'commits'];
  public readonly examples = [
    { description: 'Search commit messages', input: { pattern: 'fix bug', search_in: 'messages' } },
    { description: 'Search code changes', input: { pattern: 'function login', search_in: 'diffs', since: '1 month ago' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as GitGrepInput;

    try {
      const repoPath = params.path ? path.resolve(context.workingDirectory, params.path) : context.workingDirectory;

      // Build git command based on search type
      let gitCommand: string;
      
      switch (params.search_in) {
        case 'messages':
          gitCommand = `git log --all --grep="${params.pattern}" --format="%H|%an|%ad|%s" --date=iso`;
          break;
        case 'commits':
          gitCommand = `git log --all -S "${params.pattern}" --format="%H|%an|%ad|%s" --date=iso`;
          break;
        case 'diffs':
          gitCommand = `git log --all -p -S "${params.pattern}" --format="%H|%an|%ad|%s" --date=iso`;
          break;
      }

      if (params.since) {
        gitCommand += ` --since="${params.since}"`;
      }

      if (params.author) {
        gitCommand += ` --author="${params.author}"`;
      }

      gitCommand += ` -n ${params.max_results}`;

      const { stdout, stderr } = await execAsync(gitCommand, { cwd: repoPath });

      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }

      // Parse results
      const matches: z.infer<typeof GitMatchSchema>[] = [];
      const lines = stdout.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          matches.push({
            commit_hash: parts[0],
            author: parts[1],
            date: parts[2],
            commit_message: parts[3],
          });
        }
      }

      const output: GitGrepOutput = {
        pattern: params.pattern,
        search_in: params.search_in,
        matches,
        total_commits_searched: matches.length,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('not a git repository')) {
        return this.createErrorResult(startedAt, createToolError('NOT_A_GIT_REPO', 'Path is not a git repository'));
      }
      return this.createErrorResult(startedAt, createToolError('GIT_GREP_ERROR', errorMsg));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: GitGrepOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 Git Grep: "${output.pattern}" in ${output.search_in}`);
    parts.push(`   Found ${output.matches.length} matches`);
    parts.push('');

    for (const match of output.matches) {
      parts.push(`commit ${match.commit_hash.substring(0, 8)}`);
      parts.push(`Author: ${match.author}`);
      parts.push(`Date: ${match.date}`);
      parts.push(`    ${match.commit_message}`);
      if (match.file_path) {
        parts.push(`    File: ${match.file_path}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: GitGrepOutput, output: string): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: true,
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default GitGrepTool;
