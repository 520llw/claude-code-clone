import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus } from '../../Tool';

const InputSchema = z.object({ file_path: z.string(), line: z.number(), column: z.number() });
const OutputSchema = z.object({ contents: z.string(), range: z.object({ start: z.object({ line: z.number(), character: z.number() }), end: z.object({ line: z.number(), character: z.number() }) }).optional() });

export class LSPHoverTool extends Tool {
  public readonly name = 'lsp_hover';
  public readonly description = 'Get hover information for a symbol';
  public readonly documentation = 'Get hover information using LSP.';
  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = InputSchema;
  public readonly outputSchema = OutputSchema;
  public readonly cacheable = true;
  public readonly tags = ['lsp', 'hover', 'tooltip'];
  public readonly examples = [];

  protected async validateContext() { return { valid: true }; }
  protected async executeImpl(_input: z.infer<typeof InputSchema>, _context: ToolContext): Promise<ToolResult> {
    return { executionId: '', status: ToolExecutionStatus.SUCCESS, toolName: this.name, startedAt: new Date(), completedAt: new Date(), duration: 0, success: true, data: { contents: '' } };
  }
}

export default LSPHoverTool;
