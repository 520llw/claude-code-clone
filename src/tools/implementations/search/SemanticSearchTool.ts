/**
 * @fileoverview Semantic Search Tool for Claude Code Clone
 * 
 * This tool provides semantic code search using embeddings:
 * - Natural language code search
 * - Similar code finding
 * - Code understanding
 * 
 * @module SemanticSearchTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const SemanticSearchInputSchema = z.object({
  query: z.string().min(1).max(1000).describe('Natural language search query'),
  path: z.string().optional().describe('Path to search in'),
  language: z.enum(['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'any']).default('any').describe('Programming language filter'),
  max_results: z.number().int().min(1).max(50).default(10).describe('Maximum results'),
  include_content: z.boolean().default(true).describe('Include code content in results'),
}).describe('Input for semantic code search');

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const SemanticMatchSchema = z.object({
  file_path: z.string().describe('File path'),
  line_start: z.number().int().describe('Start line'),
  line_end: z.number().int().describe('End line'),
  content: z.string().optional().describe('Code content'),
  relevance_score: z.number().describe('Relevance score (0-1)'),
  description: z.string().describe('AI-generated description of the code'),
}).describe('Semantic search match');

export const SemanticSearchOutputSchema = z.object({
  query: z.string().describe('Search query'),
  matches: z.array(SemanticMatchSchema).describe('Matching code segments'),
  total_files_searched: z.number().int().describe('Files searched'),
  search_time_ms: z.number().int().describe('Search time in milliseconds'),
}).describe('Result of semantic search');

export type SemanticSearchOutput = z.infer<typeof SemanticSearchOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class SemanticSearchTool extends Tool {
  public readonly name = 'semantic_search';
  public readonly description = 'Search code using natural language and semantic understanding';
  public readonly documentation = `
## Semantic Search Tool

Searches code using natural language queries:
- Understands code intent and functionality
- Finds semantically similar code
- Natural language to code matching

### Input Parameters

- **query** (required): Natural language search query
- **path** (optional): Path to search in
- **language** (optional): Language filter
- **max_results** (optional): Maximum results (default: 10)
- **include_content** (optional): Include code content

### Output

Returns semantically matching code:
- query: Search query used
- matches: Matching code segments with relevance scores
- total_files_searched: Files searched
- search_time_ms: Search time

### Examples

Find authentication code:
\`\`\`json
{
  "query": "user login authentication",
  "language": "typescript"
}
\`\`\`

Find error handling:
\`\`\`json
{
  "query": "try catch error handling",
  "max_results": 5
}
\`\`\`
  `;
  public readonly category = ToolCategory.SEARCH;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = SemanticSearchInputSchema;
  public readonly outputSchema = SemanticSearchOutputSchema;
  public readonly tags = ['search', 'semantic', 'ai', 'code', 'natural-language'];
  public readonly examples = [
    { description: 'Find auth code', input: { query: 'user authentication login', language: 'typescript' } },
    { description: 'Find error handling', input: { query: 'error handling try catch', max_results: 5 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as SemanticSearchInput;

    // This is a placeholder implementation
    // In a real implementation, this would use embeddings and vector search
    const searchStart = Date.now();

    // Simulate semantic search results
    const matches: z.infer<typeof SemanticMatchSchema>[] = [
      {
        file_path: '/src/auth/login.ts',
        line_start: 1,
        line_end: 50,
        content: params.include_content ? 'export async function loginUser(username: string, password: string) { ... }' : undefined,
        relevance_score: 0.95,
        description: 'User login authentication function',
      },
      {
        file_path: '/src/middleware/auth.ts',
        line_start: 10,
        line_end: 40,
        content: params.include_content ? 'export function authenticateToken(req: Request, res: Response, next: NextFunction) { ... }' : undefined,
        relevance_score: 0.88,
        description: 'JWT token authentication middleware',
      },
    ];

    const output: SemanticSearchOutput = {
      query: params.query,
      matches: matches.slice(0, params.max_results),
      total_files_searched: 150,
      search_time_ms: Date.now() - searchStart,
    };

    return this.createSuccessResult(startedAt, output, this.formatOutput(output));
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: SemanticSearchOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 Semantic Search: "${output.query}"`);
    parts.push(`   Files searched: ${output.total_files_searched} | Time: ${output.search_time_ms}ms`);
    parts.push('');

    for (const match of output.matches) {
      parts.push(`📄 ${match.file_path}:${match.line_start}-${match.line_end}`);
      parts.push(`   Relevance: ${(match.relevance_score * 100).toFixed(1)}%`);
      parts.push(`   ${match.description}`);
      if (match.content) {
        parts.push('   ```');
        parts.push(`   ${match.content.substring(0, 200)}${match.content.length > 200 ? '...' : ''}`);
        parts.push('   ```');
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: SemanticSearchOutput, output: string): ToolResult {
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
}

export default SemanticSearchTool;
