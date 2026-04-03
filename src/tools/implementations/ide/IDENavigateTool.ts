/**
 * @fileoverview IDE Navigate Tool for Claude Code Clone
 * 
 * This tool navigates in the IDE:
 * - Open files
 * - Go to line/column
 * - Reveal symbols
 * 
 * @module IDENavigateTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const IDENavigateInputSchema = z.object({
  action: z.enum(['open_file', 'go_to_line', 'go_to_symbol', 'reveal_in_explorer']).describe('Navigation action'),
  file_path: z.string().optional().describe('File path'),
  line: z.number().int().min(0).optional().describe('Line number (0-based)'),
  column: z.number().int().min(0).optional().describe('Column number (0-based)'),
  symbol: z.string().optional().describe('Symbol name'),
}).describe('Input for IDE navigation');

export type IDENavigateInput = z.infer<typeof IDENavigateInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const IDENavigateOutputSchema = z.object({
  action: z.string().describe('Action performed'),
  success: z.boolean().describe('Whether navigation succeeded'),
  file_path: z.string().optional().describe('File path'),
  line: z.number().int().optional().describe('Line number'),
  column: z.number().int().optional().describe('Column number'),
  message: z.string().describe('Status message'),
}).describe('Result of IDE navigation');

export type IDENavigateOutput = z.infer<typeof IDENavigateOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class IDENavigateTool extends Tool {
  public readonly name = 'ide_navigate';
  public readonly description = 'Navigate in the IDE (open files, go to line, etc.)';
  public readonly documentation = `
## IDE Navigate Tool

Navigates in the IDE:
- Open files
- Go to line/column
- Reveal symbols
- Show in explorer

### Input Parameters

- **action** (required): 'open_file', 'go_to_line', 'go_to_symbol', 'reveal_in_explorer'
- **file_path** (optional): File path
- **line** (optional): Line number (0-based)
- **column** (optional): Column number (0-based)
- **symbol** (optional): Symbol name

### Output

Returns navigation result:
- action: Action performed
- success: Whether succeeded
- file_path: File path
- line/column: Position
- message: Status message

### Examples

Open file:
\`\`\`json
{
  "action": "open_file",
  "file_path": "/path/to/file.ts"
}
\`\`\`

Go to line:
\`\`\`json
{
  "action": "go_to_line",
  "file_path": "/path/to/file.ts",
  "line": 42
}
\`\`\`

Go to symbol:
\`\`\`json
{
  "action": "go_to_symbol",
  "symbol": "myFunction"
}
\`\`\`
  `;
  public readonly category = ToolCategory.IDE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = IDENavigateInputSchema;
  public readonly outputSchema = IDENavigateOutputSchema;
  public readonly tags = ['ide', 'navigate', 'open', 'goto'];
  public readonly examples = [
    { description: 'Open file', input: { action: 'open_file', file_path: '/path/to/file.ts' } },
    { description: 'Go to line', input: { action: 'go_to_line', file_path: '/path/to/file.ts', line: 42 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as IDENavigateInput;

    try {
      // Placeholder implementation
      // In real implementation, communicate with IDE
      
      const output: IDENavigateOutput = {
        action: params.action,
        success: true,
        file_path: params.file_path,
        line: params.line,
        column: params.column,
        message: `Navigated: ${params.action}`,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('IDE_ERROR', String(error)));
    }
  }

  protected async validateContext(input: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as IDENavigateInput;
    const errors: string[] = [];

    if ((params.action === 'open_file' || params.action === 'go_to_line') && !params.file_path) {
      errors.push('file_path required for this action');
    }

    if (params.action === 'go_to_symbol' && !params.symbol) {
      errors.push('symbol required for go_to_symbol action');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private formatOutput(output: IDENavigateOutput): string {
    const parts: string[] = [];
    parts.push(`🖥️ IDE Navigate: ${output.action}`);
    if (output.file_path) {
      parts.push(`File: ${output.file_path}`);
    }
    if (output.line !== undefined) {
      parts.push(`Line: ${output.line + 1}`);
    }
    if (output.column !== undefined) {
      parts.push(`Column: ${output.column}`);
    }
    parts.push(`Status: ${output.success ? '✅ Success' : '❌ Failed'}`);
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: IDENavigateOutput, output: string): ToolResult {
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

export default IDENavigateTool;
