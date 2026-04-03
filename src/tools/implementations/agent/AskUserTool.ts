/**
 * @fileoverview Ask User Tool for Claude Code Clone
 * 
 * This tool asks the user for input:
 * - Prompt user for information
 * - Get user confirmation
 * 
 * @module AskUserTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const AskUserInputSchema = z.object({
  question: z.string().min(1).max(2000).describe('Question to ask the user'),
  type: z.enum(['text', 'confirm', 'choice', 'multiline']).default('text').describe('Type of input expected'),
  choices: z.array(z.string()).optional().describe('Choices for choice type'),
  default_value: z.string().optional().describe('Default value'),
  placeholder: z.string().optional().describe('Placeholder text'),
}).describe('Input for asking user');

export type AskUserInput = z.infer<typeof AskUserInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const AskUserOutputSchema = z.object({
  question: z.string().describe('Question asked'),
  type: z.string().describe('Input type'),
  response: z.string().describe('User response'),
  confirmed: z.boolean().optional().describe('For confirm type'),
}).describe('Result of asking user');

export type AskUserOutput = z.infer<typeof AskUserOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class AskUserTool extends Tool {
  public readonly name = 'ask_user';
  public readonly description = 'Ask the user for input or confirmation';
  public readonly documentation = `
## Ask User Tool

Asks the user for input:
- Text input
- Yes/no confirmation
- Multiple choice
- Multi-line text

### Input Parameters

- **question** (required): Question to ask
- **type** (optional): Input type ('text', 'confirm', 'choice', 'multiline')
- **choices** (optional): Choices for 'choice' type
- **default_value** (optional): Default value
- **placeholder** (optional): Placeholder text

### Output

Returns user response:
- question: Question asked
- type: Input type
- response: User response
- confirmed: For confirm type

### Examples

Ask for text:
\`\`\`json
{
  "question": "What is your name?",
  "type": "text"
}
\`\`\`

Ask for confirmation:
\`\`\`json
{
  "question": "Do you want to proceed?",
  "type": "confirm"
}
\`\`\`

Multiple choice:
\`\`\`json
{
  "question": "Select an option:",
  "type": "choice",
  "choices": ["Option A", "Option B", "Option C"]
}
\`\`\`
  `;
  public readonly category = ToolCategory.AGENT;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = AskUserInputSchema;
  public readonly outputSchema = AskUserOutputSchema;
  public readonly tags = ['user', 'input', 'prompt', 'confirm', 'question'];
  public readonly examples = [
    { description: 'Ask for text', input: { question: 'What is your name?', type: 'text' } },
    { description: 'Ask for confirmation', input: { question: 'Proceed?', type: 'confirm' } },
    { description: 'Multiple choice', input: { question: 'Select option', type: 'choice', choices: ['A', 'B', 'C'] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as AskUserInput;

    try {
      // Placeholder implementation
      // In real implementation, prompt user through UI
      
      let response = 'user-response';
      let confirmed: boolean | undefined;

      if (params.type === 'confirm') {
        confirmed = true;
        response = confirmed ? 'yes' : 'no';
      } else if (params.type === 'choice' && params.choices) {
        response = params.choices[0];
      }

      const output: AskUserOutput = {
        question: params.question,
        type: params.type,
        response,
        confirmed,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('ASK_ERROR', String(error)));
    }
  }

  protected async validateContext(input: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    const params = input as AskUserInput;
    const errors: string[] = [];

    if (params.type === 'choice' && (!params.choices || params.choices.length === 0)) {
      errors.push('choices required for choice type');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private formatOutput(output: AskUserOutput): string {
    const parts: string[] = [];
    parts.push(`❓ ${output.question}`);
    parts.push(`Type: ${output.type}`);
    parts.push(`Response: ${output.response}`);
    if (output.confirmed !== undefined) {
      parts.push(`Confirmed: ${output.confirmed}`);
    }
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: AskUserOutput, output: string): ToolResult {
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

export default AskUserTool;
