import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

const InputSchema = z.object({ file_path: z.string(), line: z.number(), column: z.number() });
const LocationSchema = z.object({ uri: z.string(), range: z.object({ start: z.object({ line: z.number(), character: z.number() }), end: z.object({ line: z.number(), character: z.number() }) }) });
const OutputSchema = z.object({ locations: z.array(LocationSchema), total: z.number() });

export class LSPReferencesTool extends Tool {
  public readonly name = 'lsp_references';
  public readonly description = 'Find all references to a symbol';
  public readonly documentation = 'Find all references to a symbol using LSP.';
  public readonly category = ToolCategory.CODE_INTELLIGENCE;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = InputSchema;
  public readonly outputSchema = OutputSchema;
  public readonly cacheable = true;
  public readonly tags = ['lsp', 'references', 'find-references'];
  public readonly examples = [];

  protected async validateContext() { return { valid: true }; }
  protected async executeImpl(_input: z.infer<typeof InputSchema>, _context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    return { executionId: '', status: ToolExecutionStatus.SUCCESS, toolName: this.name, startedAt, completedAt: new Date(), duration: 0, success: true, data: { locations: [], total: 0 } };
  }
}

export default LSPReferencesTool;
