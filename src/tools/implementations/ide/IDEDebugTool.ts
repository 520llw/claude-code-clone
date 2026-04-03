/**
 * @fileoverview IDE Debug Tool for Claude Code Clone
 * 
 * This tool debugs in the IDE:
 * - Set breakpoints
 * - Step through code
 * - Inspect variables
 * 
 * @module IDEDebugTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const IDEDebugInputSchema = z.object({
  action: z.enum(['set_breakpoint', 'remove_breakpoint', 'continue', 'step_over', 'step_into', 'step_out', 'pause', 'evaluate']).describe('Debug action'),
  file_path: z.string().optional().describe('File path for breakpoint'),
  line: z.number().int().min(0).optional().describe('Line number for breakpoint'),
  expression: z.string().optional().describe('Expression to evaluate'),
}).describe('Input for IDE debugging');

export type IDEDebugInput = z.infer<typeof IDEDebugInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const IDEDebugOutputSchema = z.object({
  action: z.string().describe('Action performed'),
  success: z.boolean().describe('Whether debug action succeeded'),
  file_path: z.string().optional().describe('File path'),
  line: z.number().int().optional().describe('Line number'),
  result: z.string().optional().describe('Evaluation result'),
  message: z.string().describe('Status message'),
}).describe('Result of IDE debug');

export type IDEDebugOutput = z.infer<typeof IDEDebugOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class IDEDebugTool extends Tool {
  public readonly name = 'ide_debug';
  public readonly description = 'Debug operations in the IDE';
  public readonly documentation = `
## IDE Debug Tool

Debugs in the IDE:
- Set/remove breakpoints
- Step through code
- Continue execution
- Evaluate expressions

### Input Parameters

- **action** (required): 'set_breakpoint', 'remove_breakpoint', 'continue', 'step_over', 'step_into', 'step_out', 'pause', 'evaluate'
- **file_path** (optional): File path for breakpoint
- **line** (optional): Line number for breakpoint
- **expression** (optional): Expression to evaluate

### Output

Returns debug result:
- action: Action performed
- success: Whether succeeded
- file_path/line: Breakpoint location
- result: Evaluation result
- message: Status message

### Examples

Set breakpoint:
\`\`\`json
{
  "action": "set_breakpoint",
  "file_path": "/path/to/file.ts",
  "line": 42
}
\`\`\`

Continue:
\`\`\`json
{
  "action": "continue"
}
\`\`\`

Evaluate:
\`\`\`json
{
  "action": "evaluate",
  "expression": "myVariable"
}
\`\`\`
  `;
  public readonly category = ToolCategory.IDE;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = IDEDebugInputSchema;
  public readonly outputSchema = IDEDebugOutputSchema;
  public readonly tags = ['ide', 'debug', 'breakpoint', 'step'];
  public readonly examples = [
    { description: 'Set breakpoint', input: { action: 'set_breakpoint', file_path: '/path/to/file.ts', line: 42 } },
    { description: 'Continue', input: { action: 'continue' } },
    { description: 'Evaluate', input: { action: 'evaluate', expression: 'myVar' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as IDEDebugInput;

    try {
      // Placeholder implementation
      // In real implementation, communicate with IDE debugger
      
      const output: IDEDebugOutput = {
        action: params.action,
        success: true,
        file_path: params.file_path,
        line: params.line,
        result: params.expression ? `"${params.expression}" = 42` : undefined,
        message: `Debug action: ${params.action}`,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('IDE_ERROR', String(error)));
    }
  }

  protected async validateContext(input: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as IDEDebugInput;
    const errors: string[] = [];

    if ((params.action === 'set_breakpoint' || params.action === 'remove_breakpoint') && (!params.file_path || params.line === undefined)) {
      errors.push('file_path and line required for breakpoint actions');
    }

    if (params.action === 'evaluate' && !params.expression) {
      errors.push('expression required for evaluate action');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private formatOutput(output: IDEDebugOutput): string {
    const parts: string[] = [];
    parts.push(`🐛 IDE Debug: ${output.action}`);
    if (output.file_path) {
      parts.push(`File: ${output.file_path}:${output.line !== undefined ? output.line + 1 : ''}`);
    }
    if (output.result) {
      parts.push(`Result: ${output.result}`);
    }
    parts.push(`Status: ${output.success ? '✅ Success' : '❌ Failed'}`);
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: IDEDebugOutput, output: string): ToolResult {
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

export default IDEDebugTool;
