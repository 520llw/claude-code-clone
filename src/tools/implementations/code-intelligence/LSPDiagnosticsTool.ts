/**
 * @fileoverview LSP Diagnostics Tool for Claude Code Clone
 * 
 * Gets diagnostics (errors, warnings) from LSP servers.
 * 
 * @module LSPDiagnosticsTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

const LSPDiagnosticsInputSchema = z.object({
  file_path: z.string()
    .describe('Path to the file to get diagnostics for'),
}).strict();

const LSPDiagnosticSchema = z.object({
  message: z.string(),
  severity: z.enum(['error', 'warning', 'information', 'hint']),
  code: z.string().optional(),
  source: z.string().optional(),
  line: z.number(),
  column: z.number(),
}).strict();

const LSPDiagnosticsOutputSchema = z.object({
  file_path: z.string(),
  diagnostics: z.array(LSPDiagnosticSchema),
  error_count: z.number(),
  warning_count: z.number(),
}).strict();

/**
 * LSPDiagnosticsTool - Get LSP diagnostics
 */
export class LSPDiagnosticsTool extends Tool {
  public readonly name = 'lsp_diagnostics';
  public readonly description = 'Get diagnostics (errors, warnings) for a file';
  
  public readonly documentation = `
# LSP Diagnostics Tool

Get diagnostics (errors, warnings) from LSP servers for a file.

## Usage
\`\`\`typescript
{
  "file_path": "/project/src/index.ts"
}
\`\`\`

## Parameters
- **file_path**: Path to the file

## Returns
\`\`\`typescript
{
  "file_path": "/project/src/index.ts",
  "diagnostics": [
    {
      "message": "Cannot find name 'foo'",
      "severity": "error",
      "code": "TS2304",
      "source": "typescript",
      "line": 10,
      "column": 5
    }
  ],
  "error_count": 1,
  "warning_count": 0
}
\`\`\`

## Note
This is a mock implementation. In production, integrate with an LSP client.
`;

  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = LSPDiagnosticsInputSchema;
  public readonly outputSchema = LSPDiagnosticsOutputSchema;
  public readonly cacheable = true;
  public readonly tags = ['lsp', 'diagnostics', 'errors', 'warnings', 'typescript'];
  
  public readonly examples = [
    {
      description: 'Get diagnostics',
      input: { file_path: '/project/src/index.ts' },
      output: {
        file_path: '/project/src/index.ts',
        diagnostics: [],
        error_count: 0,
        warning_count: 0,
      },
    },
  ];

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  protected async executeImpl(
    input: z.infer<typeof LSPDiagnosticsInputSchema>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const startedAt = new Date();

    try {
      // Mock implementation - in production, connect to LSP server
      const diagnostics: z.infer<typeof LSPDiagnosticSchema>[] = [];

      const output = {
        file_path: input.file_path,
        diagnostics,
        error_count: diagnostics.filter((d) => d.severity === 'error').length,
        warning_count: diagnostics.filter((d) => d.severity === 'warning').length,
      };

      return this.createSuccessResult(startedAt, this.outputSchema.parse(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('LSP_ERROR', String(error)));
    }
  }

  private createSuccessResult(startedAt: Date, data: unknown, output?: string): ToolResult {
    const completedAt = new Date();
    return {
      executionId: '',
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      success: true,
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    const completedAt = new Date();
    return {
      executionId: '',
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default LSPDiagnosticsTool;
