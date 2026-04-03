/**
 * @fileoverview Memory Read Tool for Claude Code Clone
 * 
 * This tool reads from memory:
 * - Retrieve stored information
 * - Access conversation context
 * 
 * @module MemoryReadTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const MemoryReadInputSchema = z.object({
  key: z.string().min(1).describe('Memory key to read'),
  default_value: z.string().optional().describe('Default value if key not found'),
}).describe('Input for reading from memory');

export type MemoryReadInput = z.infer<typeof MemoryReadInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const MemoryReadOutputSchema = z.object({
  key: z.string().describe('Memory key'),
  value: z.string().optional().describe('Stored value'),
  found: z.boolean().describe('Whether key was found'),
  timestamp: z.string().optional().describe('When value was stored'),
}).describe('Result of memory read');

export type MemoryReadOutput = z.infer<typeof MemoryReadOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

// Simple in-memory store (in production, use persistent storage)
const memoryStore = new Map<string, { value: string; timestamp: string }>();

export class MemoryReadTool extends Tool {
  public readonly name = 'memory_read';
  public readonly description = 'Read a value from memory';
  public readonly documentation = `
## Memory Read Tool

Reads values from memory:
- Retrieve stored information
- Access conversation context

### Input Parameters

- **key** (required): Memory key to read
- **default_value** (optional): Default if key not found

### Output

Returns stored value:
- key: Memory key
- value: Stored value
- found: Whether key was found
- timestamp: When value was stored

### Examples

Read value:
\`\`\`json
{
  "key": "user_name"
}
\`\`\`

With default:
\`\`\`json
{
  "key": "user_name",
  "default_value": "Anonymous"
}
\`\`\`
  `;
  public readonly category = ToolCategory.MEMORY;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = MemoryReadInputSchema;
  public readonly outputSchema = MemoryReadOutputSchema;
  public readonly tags = ['memory', 'read', 'retrieve', 'context'];
  public readonly examples = [
    { description: 'Read value', input: { key: 'user_name' } },
    { description: 'With default', input: { key: 'user_name', default_value: 'Anonymous' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as MemoryReadInput;

    try {
      const stored = memoryStore.get(params.key);
      
      const output: MemoryReadOutput = {
        key: params.key,
        value: stored?.value || params.default_value,
        found: !!stored,
        timestamp: stored?.timestamp,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('MEMORY_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: MemoryReadOutput): string {
    if (output.found) {
      return `🧠 Memory: ${output.key} = "${output.value}" (stored: ${output.timestamp})`;
    } else if (output.value) {
      return `🧠 Memory: ${output.key} not found, using default: "${output.value}"`;
    } else {
      return `🧠 Memory: ${output.key} not found`;
    }
  }

  private createSuccessResult(startedAt: Date, data: MemoryReadOutput, output: string): ToolResult {
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

export default MemoryReadTool;
