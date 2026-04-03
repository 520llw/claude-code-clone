/**
 * @fileoverview Memory Search Tool for Claude Code Clone
 * 
 * This tool searches memory:
 * - Find stored keys
 * - Search by value content
 * 
 * @module MemorySearchTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const MemorySearchInputSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  search_in: z.enum(['keys', 'values', 'both']).default('both').describe('Where to search'),
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum results'),
}).describe('Input for searching memory');

export type MemorySearchInput = z.infer<typeof MemorySearchInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const MemoryItemSchema = z.object({
  key: z.string().describe('Memory key'),
  value: z.string().describe('Stored value'),
  timestamp: z.string().describe('When stored'),
}).describe('Memory item');

export const MemorySearchOutputSchema = z.object({
  query: z.string().describe('Search query'),
  results: z.array(MemoryItemSchema).describe('Matching items'),
  total: z.number().int().describe('Total matches'),
}).describe('Result of memory search');

export type MemorySearchOutput = z.infer<typeof MemorySearchOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

// Simple in-memory store (in production, use persistent storage)
const memoryStore = new Map<string, { value: string; timestamp: string }>();

export class MemorySearchTool extends Tool {
  public readonly name = 'memory_search';
  public readonly description = 'Search memory for keys or values';
  public readonly documentation = `
## Memory Search Tool

Searches memory for stored items:
- Find keys matching pattern
- Search value content

### Input Parameters

- **query** (required): Search query
- **search_in** (optional): 'keys', 'values', or 'both'
- **limit** (optional): Max results (default: 20)

### Output

Returns matching items:
- query: Search query
- results: Matching items
- total: Total matches

### Examples

Search keys:
\`\`\`json
{
  "query": "user",
  "search_in": "keys"
}
\`\`\`

Search values:
\`\`\`json
{
  "query": "John",
  "search_in": "values"
}
\`\`\`
  `;
  public readonly category = ToolCategory.MEMORY;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = MemorySearchInputSchema;
  public readonly outputSchema = MemorySearchOutputSchema;
  public readonly tags = ['memory', 'search', 'find', 'query'];
  public readonly examples = [
    { description: 'Search keys', input: { query: 'user', search_in: 'keys' } },
    { description: 'Search values', input: { query: 'John', search_in: 'values' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as MemorySearchInput;

    try {
      const results: z.infer<typeof MemoryItemSchema>[] = [];
      const query = params.query.toLowerCase();

      for (const [key, data] of memoryStore.entries()) {
        let match = false;

        if (params.search_in === 'keys' || params.search_in === 'both') {
          if (key.toLowerCase().includes(query)) {
            match = true;
          }
        }

        if (params.search_in === 'values' || params.search_in === 'both') {
          if (data.value.toLowerCase().includes(query)) {
            match = true;
          }
        }

        if (match) {
          results.push({
            key,
            value: data.value,
            timestamp: data.timestamp,
          });

          if (results.length >= params.limit) {
            break;
          }
        }
      }

      const output: MemorySearchOutput = {
        query: params.query,
        results,
        total: results.length,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('MEMORY_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: MemorySearchOutput): string {
    const parts: string[] = [];
    parts.push(`🧠 Memory Search: "${output.query}"`);
    parts.push(`Found ${output.total} result(s):`);
    parts.push('');

    for (const item of output.results) {
      parts.push(`  ${item.key} = "${item.value.substring(0, 50)}${item.value.length > 50 ? '...' : ''}"`);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: MemorySearchOutput, output: string): ToolResult {
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

export default MemorySearchTool;
