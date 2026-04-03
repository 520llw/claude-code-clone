/**
 * @fileoverview LSP Completion Tool for Claude Code Clone
 * 
 * This tool gets code completions:
 * - Autocomplete suggestions
 * - IntelliSense
 * 
 * @module LSPCompletionTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const LSPCompletionInputSchema = z.object({
  file_path: z.string().min(1).describe('Path to the file'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character position (0-based)'),
  trigger_character: z.string().optional().describe('Trigger character'),
}).describe('Input for getting completions');

export type LSPCompletionInput = z.infer<typeof LSPCompletionInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LSPCompletionItemSchema = z.object({
  label: z.string().describe('Completion label'),
  kind: z.string().describe('Completion kind (function, variable, class, etc.)'),
  detail: z.string().optional().describe('Additional details'),
  documentation: z.string().optional().describe('Documentation'),
  insert_text: z.string().describe('Text to insert'),
  sort_text: z.string().optional().describe('Sort key'),
}).describe('Completion item');

export const LSPCompletionOutputSchema = z.object({
  file_path: z.string().describe('File path'),
  position: z.object({
    line: z.number(),
    character: z.number(),
  }).describe('Cursor position'),
  items: z.array(LSPCompletionItemSchema).describe('Completion items'),
  is_incomplete: z.boolean().describe('Whether results are incomplete'),
}).describe('Result of completion lookup');

export type LSPCompletionOutput = z.infer<typeof LSPCompletionOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LSPCompletionTool extends Tool {
  public readonly name = 'lsp_completion';
  public readonly description = 'Get code completion suggestions at cursor position';
  public readonly documentation = `
## LSP Completion Tool

Gets code completion suggestions (IntelliSense):
- Autocomplete suggestions
- Code completions

### Input Parameters

- **file_path** (required): Path to the file
- **line** (required): Line number (0-based)
- **character** (required): Character position (0-based)
- **trigger_character** (optional): Character that triggered completion

### Output

Returns completion items:
- file_path: File path
- position: Cursor position
- items: Array of completion items
- is_incomplete: Whether results are incomplete

### Completion Item

Each item contains:
- label: Display label
- kind: Item kind (function, variable, etc.)
- detail: Additional details
- documentation: Documentation
- insert_text: Text to insert
- sort_text: Sort key

### Examples

Get completions:
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
  public readonly inputSchema = LSPCompletionInputSchema;
  public readonly outputSchema = LSPCompletionOutputSchema;
  public readonly tags = ['lsp', 'completion', 'autocomplete', 'intellisense'];
  public readonly examples = [
    { description: 'Get completions', input: { file_path: '/path/to/file.ts', line: 10, character: 15 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LSPCompletionInput;

    try {
      // Placeholder implementation
      const items: z.infer<typeof LSPCompletionItemSchema>[] = [
        {
          label: 'myFunction',
          kind: 'function',
          detail: '(param: string): number',
          documentation: 'A sample function',
          insert_text: 'myFunction',
          sort_text: '1',
        },
        {
          label: 'myVariable',
          kind: 'variable',
          detail: 'string',
          documentation: 'A sample variable',
          insert_text: 'myVariable',
          sort_text: '2',
        },
      ];

      const output: LSPCompletionOutput = {
        file_path: params.file_path,
        position: { line: params.line, character: params.character },
        items,
        is_incomplete: false,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LSPCompletionOutput): string {
    const parts: string[] = [];
    parts.push(`💡 Completions at ${output.file_path}:${output.position.line + 1}:${output.position.character}`);
    parts.push(`Found ${output.items.length} suggestion(s):`);
    parts.push('');

    for (const item of output.items) {
      const icon = this.getKindIcon(item.kind);
      parts.push(`${icon} ${item.label}`);
      if (item.detail) {
        parts.push(`   ${item.detail}`);
      }
      if (item.documentation) {
        parts.push(`   ${item.documentation}`);
      }
    }

    return parts.join('\n');
  }

  private getKindIcon(kind: string): string {
    const icons: Record<string, string> = {
      function: '🔧',
      variable: '📦',
      class: '🏗️',
      interface: '🔌',
      module: '📚',
      property: '⚙️',
      method: '🔨',
    };
    return icons[kind] || '•';
  }

  private createSuccessResult(startedAt: Date, data: LSPCompletionOutput, output: string): ToolResult {
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

export default LSPCompletionTool;
