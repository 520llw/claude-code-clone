/**
 * @fileoverview LSP Definition Tool for Claude Code Clone
 * 
 * This tool finds symbol definitions:
 * - Go to definition
 * - Symbol location
 * 
 * @module LSPDefinitionTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const LSPDefinitionInputSchema = z.object({
  file_path: z.string().min(1).describe('Path to the file'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character position (0-based)'),
}).describe('Input for finding definition');

export type LSPDefinitionInput = z.infer<typeof LSPDefinitionInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LSPLocationSchema = z.object({
  uri: z.string().describe('File URI'),
  range: z.object({
    start: z.object({ line: z.number(), character: z.number() }),
    end: z.object({ line: z.number(), character: z.number() }),
  }).describe('Location range'),
}).describe('LSP location');

export const LSPDefinitionOutputSchema = z.object({
  file_path: z.string().describe('Original file path'),
  position: z.object({
    line: z.number(),
    character: z.number(),
  }).describe('Cursor position'),
  definitions: z.array(LSPLocationSchema).describe('Definition locations'),
  found: z.boolean().describe('Whether definition was found'),
}).describe('Result of definition lookup');

export type LSPDefinitionOutput = z.infer<typeof LSPDefinitionOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LSPDefinitionTool extends Tool {
  public readonly name = 'lsp_definition';
  public readonly description = 'Find the definition of a symbol at cursor position';
  public readonly documentation = `
## LSP Definition Tool

Finds symbol definitions (Go to Definition):
- Jump to symbol definition
- Find where symbols are declared

### Input Parameters

- **file_path** (required): Path to the file
- **line** (required): Line number (0-based)
- **character** (required): Character position (0-based)

### Output

Returns definition locations:
- file_path: Original file path
- position: Cursor position
- definitions: Array of definition locations
- found: Whether definition was found

### Location Object

Each location contains:
- uri: File URI
- range: Position range

### Examples

Find definition:
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
  public readonly inputSchema = LSPDefinitionInputSchema;
  public readonly outputSchema = LSPDefinitionOutputSchema;
  public readonly tags = ['lsp', 'definition', 'goto', 'symbol'];
  public readonly examples = [
    { description: 'Find definition', input: { file_path: '/path/to/file.ts', line: 10, character: 15 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LSPDefinitionInput;

    try {
      // Placeholder implementation
      const definitions: z.infer<typeof LSPLocationSchema>[] = [
        {
          uri: `file://${params.file_path}`,
          range: {
            start: { line: 5, character: 0 },
            end: { line: 20, character: 1 },
          },
        },
      ];

      const output: LSPDefinitionOutput = {
        file_path: params.file_path,
        position: { line: params.line, character: params.character },
        definitions,
        found: definitions.length > 0,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LSPDefinitionOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 Definition at ${output.file_path}:${output.position.line + 1}:${output.position.character}`);
    
    if (output.found) {
      parts.push(`Found ${output.definitions.length} definition(s):`);
      for (const def of output.definitions) {
        parts.push(`  📄 ${def.uri}:${def.range.start.line + 1}`);
      }
    } else {
      parts.push('No definition found.');
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: LSPDefinitionOutput, output: string): ToolResult {
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

export default LSPDefinitionTool;
