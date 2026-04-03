/**
 * @fileoverview LSP References Tool for Claude Code Clone
 * 
 * This tool finds all references to a symbol:
 * - Find usages
 * - Cross-reference navigation
 * 
 * @module LSPReferencesTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const LSPReferencesInputSchema = z.object({
  file_path: z.string().min(1).describe('Path to the file'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character position (0-based)'),
  include_declaration: z.boolean().default(true).describe('Include declaration in results'),
}).describe('Input for finding references');

export type LSPReferencesInput = z.infer<typeof LSPReferencesInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LSPReferenceSchema = z.object({
  uri: z.string().describe('File URI'),
  range: z.object({
    start: z.object({ line: z.number(), character: z.number() }),
    end: z.object({ line: z.number(), character: z.number() }),
  }).describe('Location range'),
  is_declaration: z.boolean().describe('Whether this is the declaration'),
}).describe('LSP reference');

export const LSPReferencesOutputSchema = z.object({
  file_path: z.string().describe('Original file path'),
  position: z.object({
    line: z.number(),
    character: z.number(),
  }).describe('Cursor position'),
  symbol_name: z.string().describe('Symbol name'),
  references: z.array(LSPReferenceSchema).describe('Reference locations'),
  total: z.number().int().describe('Total number of references'),
}).describe('Result of references lookup');

export type LSPReferencesOutput = z.infer<typeof LSPReferencesOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LSPReferencesTool extends Tool {
  public readonly name = 'lsp_references';
  public readonly description = 'Find all references to a symbol';
  public readonly documentation = `
## LSP References Tool

Finds all references to a symbol (Find Usages):
- Find all usages of a symbol
- Cross-reference navigation

### Input Parameters

- **file_path** (required): Path to the file
- **line** (required): Line number (0-based)
- **character** (required): Character position (0-based)
- **include_declaration** (optional): Include declaration (default: true)

### Output

Returns reference locations:
- file_path: Original file path
- position: Cursor position
- symbol_name: Symbol name
- references: Array of reference locations
- total: Total number of references

### Reference Object

Each reference contains:
- uri: File URI
- range: Position range
- is_declaration: Whether this is the declaration

### Examples

Find references:
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
  public readonly inputSchema = LSPReferencesInputSchema;
  public readonly outputSchema = LSPReferencesOutputSchema;
  public readonly tags = ['lsp', 'references', 'usages', 'find-usages'];
  public readonly examples = [
    { description: 'Find references', input: { file_path: '/path/to/file.ts', line: 10, character: 15 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LSPReferencesInput;

    try {
      // Placeholder implementation
      const references: z.infer<typeof LSPReferenceSchema>[] = [
        {
          uri: `file://${params.file_path}`,
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          },
          is_declaration: true,
        },
        {
          uri: `file://${params.file_path}`,
          range: {
            start: { line: 15, character: 5 },
            end: { line: 15, character: 15 },
          },
          is_declaration: false,
        },
      ];

      const output: LSPReferencesOutput = {
        file_path: params.file_path,
        position: { line: params.line, character: params.character },
        symbol_name: 'myFunction',
        references: params.include_declaration ? references : references.filter(r => !r.is_declaration),
        total: references.length,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LSPReferencesOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 References to "${output.symbol_name}" at ${output.file_path}:${output.position.line + 1}:${output.position.character}`);
    parts.push(`Found ${output.total} reference(s):`);
    parts.push('');

    for (const ref of output.references) {
      const type = ref.is_declaration ? '📍 Declaration' : '  Reference';
      parts.push(`${type}: ${ref.uri}:${ref.range.start.line + 1}:${ref.range.start.character}`);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: LSPReferencesOutput, output: string): ToolResult {
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

export default LSPReferencesTool;
