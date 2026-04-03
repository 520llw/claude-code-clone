/**
 * @fileoverview LSP Diagnostics Tool for Claude Code Clone
 * 
 * This tool gets diagnostics from LSP servers:
 * - Error and warning detection
 * - Code quality issues
 * 
 * @module LSPDiagnosticsTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const LSPDiagnosticsInputSchema = z.object({
  file_path: z.string().min(1).describe('Path to the file'),
  severity: z.enum(['error', 'warning', 'information', 'hint', 'all']).default('all').describe('Minimum severity level'),
}).describe('Input for getting LSP diagnostics');

export type LSPDiagnosticsInput = z.infer<typeof LSPDiagnosticsInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const LSPDiagnosticSchema = z.object({
  message: z.string().describe('Diagnostic message'),
  severity: z.enum(['error', 'warning', 'information', 'hint']).describe('Diagnostic severity'),
  code: z.string().optional().describe('Diagnostic code'),
  source: z.string().optional().describe('Source of diagnostic'),
  range: z.object({
    start: z.object({ line: z.number(), character: z.number() }),
    end: z.object({ line: z.number(), character: z.number() }),
  }).describe('Location range'),
}).describe('LSP diagnostic');

export const LSPDiagnosticsOutputSchema = z.object({
  file_path: z.string().describe('File path'),
  diagnostics: z.array(LSPDiagnosticSchema).describe('List of diagnostics'),
  error_count: z.number().int().describe('Number of errors'),
  warning_count: z.number().int().describe('Number of warnings'),
  info_count: z.number().int().describe('Number of info messages'),
  hint_count: z.number().int().describe('Number of hints'),
}).describe('Result of LSP diagnostics');

export type LSPDiagnosticsOutput = z.infer<typeof LSPDiagnosticsOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class LSPDiagnosticsTool extends Tool {
  public readonly name = 'lsp_diagnostics';
  public readonly description = 'Get diagnostics (errors, warnings) from LSP server';
  public readonly documentation = `
## LSP Diagnostics Tool

Gets diagnostics from LSP servers:
- Errors and warnings
- Code quality issues
- Type checking results

### Input Parameters

- **file_path** (required): Path to the file
- **severity** (optional): Minimum severity ('error', 'warning', 'information', 'hint', 'all')

### Output

Returns diagnostics:
- file_path: File path
- diagnostics: List of diagnostics
- error_count: Number of errors
- warning_count: Number of warnings
- info_count: Number of info messages
- hint_count: Number of hints

### Diagnostic Object

Each diagnostic contains:
- message: Diagnostic message
- severity: 'error', 'warning', 'information', 'hint'
- code: Diagnostic code
- source: Source of diagnostic
- range: Location in file

### Examples

Get all diagnostics:
\`\`\`json
{
  "file_path": "/path/to/file.ts"
}
\`\`\`

Get only errors:
\`\`\`json
{
  "file_path": "/path/to/file.ts",
  "severity": "error"
}
\`\`\`
  `;
  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = LSPDiagnosticsInputSchema;
  public readonly outputSchema = LSPDiagnosticsOutputSchema;
  public readonly tags = ['lsp', 'diagnostics', 'errors', 'warnings', 'type-check'];
  public readonly examples = [
    { description: 'Get all diagnostics', input: { file_path: '/path/to/file.ts' } },
    { description: 'Get only errors', input: { file_path: '/path/to/file.ts', severity: 'error' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as LSPDiagnosticsInput;

    try {
      // Placeholder implementation
      // In real implementation, connect to LSP server
      
      const diagnostics: z.infer<typeof LSPDiagnosticSchema>[] = [
        {
          message: 'Cannot find name "foo"',
          severity: 'error',
          code: 'TS2304',
          source: 'typescript',
          range: {
            start: { line: 10, character: 5 },
            end: { line: 10, character: 8 },
          },
        },
      ];

      const filteredDiagnostics = params.severity === 'all' 
        ? diagnostics 
        : diagnostics.filter(d => {
            const severities = ['error', 'warning', 'information', 'hint'];
            const minIndex = severities.indexOf(params.severity);
            const dIndex = severities.indexOf(d.severity);
            return dIndex <= minIndex;
          });

      const output: LSPDiagnosticsOutput = {
        file_path: params.file_path,
        diagnostics: filteredDiagnostics,
        error_count: filteredDiagnostics.filter(d => d.severity === 'error').length,
        warning_count: filteredDiagnostics.filter(d => d.severity === 'warning').length,
        info_count: filteredDiagnostics.filter(d => d.severity === 'information').length,
        hint_count: filteredDiagnostics.filter(d => d.severity === 'hint').length,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: LSPDiagnosticsOutput): string {
    const parts: string[] = [];
    parts.push(`🔍 LSP Diagnostics: ${output.file_path}`);
    parts.push(`Errors: ${output.error_count} | Warnings: ${output.warning_count} | Info: ${output.info_count} | Hints: ${output.hint_count}`);
    parts.push('');

    for (const diag of output.diagnostics) {
      const icon = diag.severity === 'error' ? '❌' : diag.severity === 'warning' ? '⚠️' : 'ℹ️';
      parts.push(`${icon} [${diag.code}] ${diag.message}`);
      parts.push(`   at line ${diag.range.start.line + 1}, col ${diag.range.start.character}`);
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: LSPDiagnosticsOutput, output: string): ToolResult {
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

export default LSPDiagnosticsTool;
