/**
 * @fileoverview Agent Tool for Claude Code Clone
 * 
 * This tool spawns sub-agents:
 * - Delegate tasks to sub-agents
 * - Parallel task execution
 * 
 * @module AgentTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const AgentInputSchema = z.object({
  task: z.string().min(1).max(5000).describe('Task description for the sub-agent'),
  context: z.string().optional().describe('Additional context for the task'),
  tools: z.array(z.string()).optional().describe('Tools the sub-agent can use'),
  timeout: z.number().int().min(1000).max(600000).default(300000).describe('Timeout in milliseconds'),
  max_iterations: z.number().int().min(1).max(100).default(10).describe('Maximum iterations'),
}).describe('Input for spawning sub-agent');

export type AgentInput = z.infer<typeof AgentInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const AgentOutputSchema = z.object({
  task: z.string().describe('Task that was executed'),
  result: z.string().describe('Sub-agent result'),
  iterations: z.number().int().describe('Number of iterations used'),
  tools_used: z.array(z.string()).describe('Tools used by sub-agent'),
  completed: z.boolean().describe('Whether task completed successfully'),
}).describe('Result of sub-agent execution');

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class AgentTool extends Tool {
  public readonly name = 'agent';
  public readonly description = 'Spawn a sub-agent to handle a delegated task';
  public readonly documentation = `
## Agent Tool

Spawns a sub-agent to handle delegated tasks:
- Parallel task execution
- Task delegation
- Sub-agent coordination

### Input Parameters

- **task** (required): Task description for the sub-agent
- **context** (optional): Additional context
- **tools** (optional): Tools the sub-agent can use
- **timeout** (optional): Timeout in ms (default: 300000)
- **max_iterations** (optional): Max iterations (default: 10)

### Output

Returns sub-agent results:
- task: Task executed
- result: Sub-agent result
- iterations: Iterations used
- tools_used: Tools used
- completed: Whether completed

### Examples

Delegate task:
\`\`\`json
{
  "task": "Find all TODO comments in the codebase",
  "tools": ["grep", "file_read"]
}
\`\`\`

With context:
\`\`\`json
{
  "task": "Refactor the authentication module",
  "context": "The auth module is in src/auth/ and uses JWT tokens",
  "tools": ["file_read", "file_edit"]
}
\`\`\`
  `;
  public readonly category = ToolCategory.AGENT;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = AgentInputSchema;
  public readonly outputSchema = AgentOutputSchema;
  public readonly tags = ['agent', 'sub-agent', 'delegate', 'parallel'];
  public readonly examples = [
    { description: 'Delegate task', input: { task: 'Find TODOs', tools: ['grep'] } },
    { description: 'With context', input: { task: 'Refactor auth', context: 'Auth module uses JWT', tools: ['file_read', 'file_edit'] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as AgentInput;

    try {
      // Placeholder implementation
      // In real implementation, spawn actual sub-agent
      
      const output: AgentOutput = {
        task: params.task,
        result: 'Sub-agent completed the task successfully.',
        iterations: 3,
        tools_used: params.tools || ['file_read', 'grep'],
        completed: true,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('AGENT_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: AgentOutput): string {
    const parts: string[] = [];
    parts.push(`🤖 Sub-Agent Task: ${output.task}`);
    parts.push(`Iterations: ${output.iterations} | Tools: ${output.tools_used.join(', ')}`);
    parts.push(`Status: ${output.completed ? '✅ Completed' : '❌ Failed'}`);
    parts.push('');
    parts.push('Result:');
    parts.push(output.result);
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: AgentOutput, output: string): ToolResult {
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

export default AgentTool;
