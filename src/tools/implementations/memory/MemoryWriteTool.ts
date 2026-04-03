/**
 * @fileoverview Memory Write Tool for Claude Code Clone
 * 
 * This tool writes to memory:
 * - Store information
 * - Save context
 * 
 * @module MemoryWriteTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const MemoryWriteInputSchema = z.object({
  key: z.string().min(1).max(256).describe('Memory key'),
  value: z.string().min(0).max(10000).describe('Value to store'),
  overwrite: z.boolean().default(true).describe('Allow overwriting existing value'),
}).describe('Input for writing to memory');

export type MemoryWriteInput = z.infer<typeof MemoryWriteInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const MemoryWriteOutputSchema = z.object({
  key: z.string().describe('Memory key'),
  value: z.string().describe('Stored value'),
  overwritten: z.boolean().describe('Whether existing value was overwritten'),
  timestamp: z.string().describe('When value was stored'),
}).describe('Result of memory write');

export type MemoryWriteOutput = z.infer<typeof MemoryWriteOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

// Simple in-memory store (in production, use persistent storage)
const memoryStore = new Map<string, { value: string; timestamp: string }>();

export class MemoryWriteTool extends Tool {
  public readonly name = 'memory_write';
  public readonly description = 'Write a value to memory';
  public readonly documentation = `
## Memory Write Tool

Writes values to memory:
- Store information
- Save context

### Input Parameters

- **key** (required): Memory key
- **value** (required): Value to store
- **overwrite** (optional): Allow overwriting (default: true)

### Output

Returns write result:
- key: Memory key
- value: Stored value
- overwritten: Whether existing was overwritten
- timestamp: When stored

### Examples

Store value:
\`\`\`json
{
  "key": "user_name",
  "value": "John"
}
\`\`\`

Don't overwrite:
\`\`\`json
{
  "key": "user_name",
  "value": "John",
  "overwrite": false
}
\`\`\`
  `;
  public readonly category = ToolCategory.MEMORY;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = MemoryWriteInputSchema;
  public readonly outputSchema = MemoryWriteOutputSchema;
  public readonly tags = ['memory', 'write', 'store', 'save'];
  public readonly examples = [
    { description: 'Store value', input: { key: 'user_name', value: 'John' } },
    { description: 'Don\'t overwrite', input: { key: 'user_name', value: 'John', overwrite: false } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as MemoryWriteInput;

    try {
      const existed = memoryStore.has(params.key);
      
      if (existed && !params.overwrite) {
        return this.createErrorResult(
          startedAt,
          createToolError('KEY_EXISTS', `Key "${params.key}" already exists. Set overwrite to true to replace.`)
        );
      }

      const timestamp = new Date().toISOString();
      memoryStore.set(params.key, { value: params.value, timestamp });

      const output: MemoryWriteOutput = {
        key: params.key,
        value: params.value,
        overwritten: existed,
        timestamp,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('MEMORY_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: MemoryWriteOutput): string {
    const action = output.overwritten ? 'updated' : 'stored';
    return `🧠 Memory ${action}: ${output.key} = "${output.value}"`;
  }

  private createSuccessResult(startedAt: Date, data: MemoryWriteOutput, output: string): ToolResult {
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

export default MemoryWriteTool;
