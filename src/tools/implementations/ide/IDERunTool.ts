/**
 * @fileoverview IDE Run Tool for Claude Code Clone
 * 
 * This tool runs code in the IDE:
 * - Run tasks
 * - Run debug configurations
 * 
 * @module IDERunTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const IDERunInputSchema = z.object({
  action: z.enum(['run_task', 'run_debug', 'stop', 'restart']).describe('Run action'),
  task_name: z.string().optional().describe('Task name to run'),
  debug_config: z.string().optional().describe('Debug configuration name'),
  args: z.array(z.string()).default([]).describe('Arguments'),
}).describe('Input for IDE run');

export type IDERunInput = z.infer<typeof IDERunInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const IDERunOutputSchema = z.object({
  action: z.string().describe('Action performed'),
  task_name: z.string().optional().describe('Task name'),
  success: z.boolean().describe('Whether run succeeded'),
  message: z.string().describe('Status message'),
  output: z.string().optional().describe('Task output'),
}).describe('Result of IDE run');

export type IDERunOutput = z.infer<typeof IDERunOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class IDERunTool extends Tool {
  public readonly name = 'ide_run';
  public readonly description = 'Run tasks or debug configurations in the IDE';
  public readonly documentation = `
## IDE Run Tool

Runs code in the IDE:
- Run tasks
- Run debug configurations
- Stop/restart

### Input Parameters

- **action** (required): 'run_task', 'run_debug', 'stop', 'restart'
- **task_name** (optional): Task name
- **debug_config** (optional): Debug configuration name
- **args** (optional): Arguments

### Output

Returns run result:
- action: Action performed
- task_name: Task name
- success: Whether succeeded
- message: Status message
- output: Task output

### Examples

Run task:
\`\`\`json
{
  "action": "run_task",
  "task_name": "build"
}
\`\`\`

Run debug:
\`\`\`json
{
  "action": "run_debug",
  "debug_config": "Launch Program"
}
\`\`\`
  `;
  public readonly category = ToolCategory.IDE;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = IDERunInputSchema;
  public readonly outputSchema = IDERunOutputSchema;
  public readonly tags = ['ide', 'run', 'task', 'debug'];
  public readonly examples = [
    { description: 'Run task', input: { action: 'run_task', task_name: 'build' } },
    { description: 'Run debug', input: { action: 'run_debug', debug_config: 'Launch' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as IDERunInput;

    try {
      // Placeholder implementation
      // In real implementation, communicate with IDE
      
      const output: IDERunOutput = {
        action: params.action,
        task_name: params.task_name,
        success: true,
        message: `${params.action} executed`,
        output: 'Task output would appear here',
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('IDE_ERROR', String(error)));
    }
  }

  protected async validateContext(input: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as IDERunInput;
    const errors: string[] = [];

    if (params.action === 'run_task' && !params.task_name) {
      errors.push('task_name required for run_task action');
    }

    if (params.action === 'run_debug' && !params.debug_config) {
      errors.push('debug_config required for run_debug action');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private formatOutput(output: IDERunOutput): string {
    const parts: string[] = [];
    parts.push(`🖥️ IDE Run: ${output.action}`);
    if (output.task_name) {
      parts.push(`Task: ${output.task_name}`);
    }
    parts.push(`Status: ${output.success ? '✅ Success' : '❌ Failed'}`);
    if (output.output) {
      parts.push('');
      parts.push('Output:');
      parts.push(output.output);
    }
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: IDERunOutput, output: string): ToolResult {
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

export default IDERunTool;
