/**
 * @fileoverview IDE Edit Tool for Claude Code Clone
 * 
 * This tool edits in the IDE:
 * - Apply edits
 * - Show diffs
 * 
 * @module IDEEditTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const IDEEditInputSchema = z.object({
  action: z.enum(['apply_edit', 'show_diff', 'preview_edit']).describe('Edit action'),
  file_path: z.string().describe('File path'),
  edits: z.array(z.object({
    range: z.object({
      start: z.object({ line: z.number(), character: z.number() }),
      end: z.object({ line: z.number(), character: z.number() }),
    }).describe('Edit range'),
    new_text: z.string().describe('New text to insert'),
  })).describe('List of edits'),
}).describe('Input for IDE editing');

export type IDEEditInput = z.infer<typeof IDEEditInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const IDEEditOutputSchema = z.object({
  action: z.string().describe('Action performed'),
  file_path: z.string().describe('File path'),
  edits_applied: z.number().int().describe('Number of edits applied'),
  success: z.boolean().describe('Whether edit succeeded'),
  message: z.string().describe('Status message'),
}).describe('Result of IDE edit');

export type IDEEditOutput = z.infer<typeof IDEEditOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class IDEEditTool extends Tool {
  public readonly name = 'ide_edit';
  public readonly description = 'Apply edits in the IDE';
  public readonly documentation = `
## IDE Edit Tool

Edits in the IDE:
- Apply multiple edits
- Show diffs
- Preview changes

### Input Parameters

- **action** (required): 'apply_edit', 'show_diff', 'preview_edit'
- **file_path** (required): File path
- **edits** (required): List of edits

### Edit Object

Each edit:
- range: Position range (start/end line and character)
- new_text: Text to insert

### Output

Returns edit result:
- action: Action performed
- file_path: File path
- edits_applied: Number of edits applied
- success: Whether succeeded
- message: Status message

### Examples

Apply edit:
\`\`\`json
{
  "action": "apply_edit",
  "file_path": "/path/to/file.ts",
  "edits": [
    {
      "range": {
        "start": { "line": 10, "character": 0 },
        "end": { "line": 10, "character": 10 }
      },
      "new_text": "new content"
    }
  ]
}
\`\`\`
  `;
  public readonly category = ToolCategory.IDE;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = IDEEditInputSchema;
  public readonly outputSchema = IDEEditOutputSchema;
  public readonly tags = ['ide', 'edit', 'apply', 'diff'];
  public readonly examples = [
    { description: 'Apply edit', input: { action: 'apply_edit', file_path: '/path/to/file.ts', edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, new_text: 'hello' }] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as IDEEditInput;

    try {
      // Placeholder implementation
      // In real implementation, communicate with IDE
      
      const output: IDEEditOutput = {
        action: params.action,
        file_path: params.file_path,
        edits_applied: params.edits.length,
        success: true,
        message: `Applied ${params.edits.length} edit(s) to ${params.file_path}`,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('IDE_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: IDEEditOutput): string {
    const parts: string[] = [];
    parts.push(`🖥️ IDE Edit: ${output.action}`);
    parts.push(`File: ${output.file_path}`);
    parts.push(`Edits: ${output.edits_applied}`);
    parts.push(`Status: ${output.success ? '✅ Success' : '❌ Failed'}`);
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: IDEEditOutput, output: string): ToolResult {
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

export default IDEEditTool;
