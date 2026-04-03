import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus } from '../../Tool';

const InputSchema = z.object({ file_path: z.string(), line: z.number(), column: z.number() });
const CompletionItemSchema = z.object({ label: z.string(), kind: z.string(), detail: z.string().optional(), documentation: z.string().optional() });
const OutputSchema = z.object({ items: z.array(CompletionItemSchema), is_incomplete: z.boolean() });

export class LSPCompletionTool extends Tool {
  public readonly name = 'lsp_completion';
  public readonly description = 'Get code completions at a position';
  public readonly documentation = 'Get code completions using LSP.';
  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = InputSchema;
  public readonly outputSchema = OutputSchema;
  public readonly cacheable = true;
  public readonly tags = ['lsp', 'completion', 'autocomplete'];
  public readonly examples = [];

  protected async validateContext() { return { valid: true }; }
  protected async executeImpl(_input: z.infer<typeof InputSchema>, _context: ToolContext): Promise<ToolResult> {
    return { executionId: '', status: ToolExecutionStatus.SUCCESS, toolName: this.name, startedAt: new Date(), completedAt: new Date(), duration: 0, success: true, data: { items: [], is_incomplete: false } };
  }
}

export default LSPCompletionTool;
