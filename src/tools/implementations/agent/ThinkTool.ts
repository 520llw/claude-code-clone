/**
 * @fileoverview Think Tool for Claude Code Clone
 * 
 * This tool allows the agent to think and plan:
 * - Reasoning step
 * - Planning
 * 
 * @module ThinkTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const ThinkInputSchema = z.object({
  thought: z.string().min(1).max(5000).describe('Thought or reasoning'),
  context: z.string().optional().describe('Additional context'),
}).describe('Input for thinking');

export type ThinkInput = z.infer<typeof ThinkInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const ThinkOutputSchema = z.object({
  thought: z.string().describe('The thought'),
  timestamp: z.string().describe('Timestamp of the thought'),
}).describe('Result of thinking');

export type ThinkOutput = z.infer<typeof ThinkOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class ThinkTool extends Tool {
  public readonly name = 'think';
  public readonly description = 'Allow the agent to think and reason through a problem';
  public readonly documentation = `
## Think Tool

Allows the agent to think and reason:
- Step through reasoning
- Plan approach
- Document thought process

### Input Parameters

- **thought** (required): Thought or reasoning
- **context** (optional): Additional context

### Output

Returns the thought:
- thought: The thought
- timestamp: When thought occurred

### Examples

Think through problem:
\`\`\`json
{
  "thought": "I need to first understand the codebase structure, then find the relevant files..."
}
\`\`\`

With context:
\`\`\`json
{
  "thought": "The user wants to refactor the auth module",
  "context": "The auth module uses JWT tokens and is located in src/auth/"
}
\`\`\`
  `;
  public readonly category = ToolCategory.AGENT;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = ThinkInputSchema;
  public readonly outputSchema = ThinkOutputSchema;
  public readonly tags = ['think', 'reason', 'plan', 'analyze'];
  public readonly examples = [
    { description: 'Think', input: { thought: 'I need to understand the problem first...' } },
    { description: 'With context', input: { thought: 'Plan the refactoring', context: 'Auth module in src/auth/' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as ThinkInput;

    try {
      const output: ThinkOutput = {
        thought: params.thought,
        timestamp: new Date().toISOString(),
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('THINK_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: ThinkOutput): string {
    const parts: string[] = [];
    parts.push(`💭 Thinking...`);
    parts.push('');
    parts.push(output.thought);
    parts.push('');
    parts.push(`— ${output.timestamp}`);
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: ThinkOutput, output: string): ToolResult {
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

export default ThinkTool;
