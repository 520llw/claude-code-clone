/**
 * @fileoverview Web Search Tool for Claude Code Clone
 * 
 * This tool provides web search capabilities:
 * - Search the web for information
 * - Return search results with titles, URLs, and snippets
 * 
 * @module WebSearchTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const WebSearchInputSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query'),
  num_results: z.number().int().min(1).max(20).default(10).describe('Number of results to return'),
  safe_search: z.boolean().default(true).describe('Enable safe search'),
}).describe('Input for web search');

export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const WebSearchResultItemSchema = z.object({
  title: z.string().describe('Result title'),
  url: z.string().describe('Result URL'),
  snippet: z.string().describe('Result snippet/description'),
  source: z.string().optional().describe('Source of the result'),
}).describe('Web search result item');

export const WebSearchOutputSchema = z.object({
  query: z.string().describe('Search query'),
  results: z.array(WebSearchResultItemSchema).describe('Search results'),
  total: z.number().int().describe('Total number of results found'),
}).describe('Result of web search');

export type WebSearchOutput = z.infer<typeof WebSearchOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class WebSearchTool extends Tool {
  public readonly name = 'web_search';
  public readonly description = 'Search the web for information';
  public readonly documentation = `
## Web Search Tool

Searches the web for information:
- Returns search results with titles, URLs, and snippets
- Configurable number of results
- Safe search option

### Input Parameters

- **query** (required): Search query
- **num_results** (optional): Number of results (default: 10, max: 20)
- **safe_search** (optional): Enable safe search (default: true)

### Output

Returns search results:
- query: Search query used
- results: Array of search results
- total: Total number of results

### Result Item

Each result contains:
- title: Page title
- url: Page URL
- snippet: Description/snippet
- source: Search source

### Examples

Search for documentation:
\`\`\`json
{
  "query": "TypeScript handbook decorators",
  "num_results": 5
}
\`\`\`

Search for tutorials:
\`\`\`json
{
  "query": "React hooks tutorial",
  "num_results": 10
}
\`\`\`
  `;
  public readonly category = ToolCategory.WEB;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = WebSearchInputSchema;
  public readonly outputSchema = WebSearchOutputSchema;
  public readonly tags = ['web', 'search', 'internet', 'google'];
  public readonly examples = [
    { description: 'Search docs', input: { query: 'TypeScript handbook', num_results: 5 } },
    { description: 'Search tutorials', input: { query: 'React hooks tutorial', num_results: 10 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as WebSearchInput;

    try {
      // This is a placeholder implementation
      // In a real implementation, this would call a search API
      
      const results: z.infer<typeof WebSearchResultItemSchema>[] = [
        {
          title: `Results for "${params.query}"`,
          url: 'https://example.com/search',
          snippet: 'This is a placeholder search result. In a real implementation, this would return actual search results from a search API.',
          source: 'placeholder',
        },
      ];

      const output: WebSearchOutput = {
        query: params.query,
        results: results.slice(0, params.num_results),
        total: results.length,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('SEARCH_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: WebSearchOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 Web Search: "${output.query}"`);
    parts.push(`Found ${output.total} results`);
    parts.push('');

    for (let i = 0; i < output.results.length; i++) {
      const result = output.results[i];
      parts.push(`${i + 1}. ${result.title}`);
      parts.push(`   ${result.url}`);
      parts.push(`   ${result.snippet}`);
      parts.push('');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: WebSearchOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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

export default WebSearchTool;
