/**
 * @fileoverview LSP Hover Tool for Claude Code Clone
 * 
 * This tool gets hover information:
 * - Type information
 * - Documentation
 * 
 * @module LSPHoverTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const LSPHoverInputSchema = z.object({
  file_path: z.string().min(1).describe('Path to the file'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character position (0-based)'),
}).describe('Input for hover information');

export type LSPHoverInput = z.infer<typeof LSPHoverInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LSPHoverOutputSchema = z.object({
  file_path: z.string().describe('File path'),
  position: z.object({
    line: z.number(),
    character: z.number(),
  }).describe('Cursor position'),
  contents: z.array(z.object({
    language: z.string().optional(),
    value: z.string(),
  })).describe('Hover contents'),
  range: z.object({
    start: z.object({ line: z.number(), character: z.number() }),
    end: z.object({ line: z.number(), character: z.number() }),
  }).optional().describe('Hover range'),
}).describe('Result of hover lookup');

export type LSPHoverOutput = z.infer<typeof LSPHoverOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LSPHoverTool extends Tool {
  public readonly name = 'lsp_hover';
  public readonly description = 'Get hover information (type info, documentation) at cursor';
  public readonly documentation = `
## LSP Hover Tool

Gets hover information at cursor position:
- Type information
- Documentation
- Symbol details

### Input Parameters

- **file_path** (required): Path to the file
- **line** (required): Line number (0-based)
- **character** (required): Character position (0-based)

### Output

Returns hover information:
- file_path: File path
- position: Cursor position
- contents: Hover contents (markdown, code)
- range: Hover range

### Content Object

Each content item:
- language: Language for code blocks
- value: Content value

### Examples

Get hover info:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "line": 10,
  "character": 15
}
\`\`\`
  `;
  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = LSPHoverInputSchema;
  public readonly outputSchema = LSPHoverOutputSchema;
  public readonly tags = ['lsp', 'hover', 'type-info', 'documentation'];
  public readonly examples = [
    { description: 'Get hover info', input: { file_path: '/path/to/file.ts', line: 10, character: 15 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LSPHoverInput;

    try {
      // Placeholder implementation
      const output: LSPHoverOutput = {
        file_path: params.file_path,
        position: { line: params.line, character: params.character },
        contents: [
          { language: 'typescript', value: 'function myFunction(param: string): number' },
          { value: 'This is a sample function that returns a number.' },
        ],
        range: {
          start: { line: params.line, character: params.character },
          end: { line: params.line, character: params.character + 10 },
        },
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LSPHoverOutput): string {
    const parts: string[] = [];
    parts.push(`ℹ️ Hover at ${output.file_path}:${output.position.line + 1}:${output.position.character}`);
    parts.push('');

    for (const content of output.contents) {
      if (content.language) {
        parts.push(`\`\`\`${content.language}`);
        parts.push(content.value);
        parts.push('```');
      } else {
        parts.push(content.value);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: LSPHoverOutput, output: string): ToolResult {
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

export default LSPHoverTool;
