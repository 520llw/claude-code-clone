/**
 * @fileoverview Plan Tool for Claude Code Clone
 * 
 * This tool creates execution plans:
 * - Task planning
 * - Step breakdown
 * 
 * @module PlanTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const PlanInputSchema = z.object({
  goal: z.string().min(1).max(2000).describe('Goal or objective'),
  steps: z.array(z.object({
    description: z.string().describe('Step description'),
    tools: z.array(z.string()).optional().describe('Tools needed for this step'),
    estimated_time: z.string().optional().describe('Estimated time for step'),
  })).optional().describe('Planned steps'),
  context: z.string().optional().describe('Additional context'),
}).describe('Input for creating plan');

export type PlanInput = z.infer<typeof PlanInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const PlanStepSchema = z.object({
  number: z.number().int().describe('Step number'),
  description: z.string().describe('Step description'),
  tools: z.array(z.string()).describe('Tools needed'),
  estimated_time: z.string().optional().describe('Estimated time'),
}).describe('Plan step');

export const PlanOutputSchema = z.object({
  goal: z.string().describe('Goal'),
  steps: z.array(PlanStepSchema).describe('Planned steps'),
  total_steps: z.number().int().describe('Total number of steps'),
  estimated_total_time: z.string().optional().describe('Estimated total time'),
}).describe('Result of planning');

export type PlanOutput = z.infer<typeof PlanOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class PlanTool extends Tool {
  public readonly name = 'plan';
  public readonly description = 'Create an execution plan for a complex task';
  public readonly documentation = `
## Plan Tool

Creates execution plans:
- Break down complex tasks
- Plan steps with tools
- Estimate time

### Input Parameters

- **goal** (required): Goal or objective
- **steps** (optional): Planned steps
- **context** (optional): Additional context

### Step Object

Each step:
- description: Step description
- tools: Tools needed
- estimated_time: Estimated time

### Output

Returns the plan:
- goal: Goal
- steps: Planned steps
- total_steps: Total steps
- estimated_total_time: Total estimated time

### Examples

Create plan:
\`\`\`json
{
  "goal": "Refactor the authentication module",
  "steps": [
    { "description": "Analyze current auth code", "tools": ["file_read", "grep"] },
    { "description": "Create new auth service", "tools": ["file_create"] }
  ]
}
\`\`\`
  `;
  public readonly category = ToolCategory.AGENT;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = PlanInputSchema;
  public readonly outputSchema = PlanOutputSchema;
  public readonly tags = ['plan', 'strategy', 'steps', 'organize'];
  public readonly examples = [
    { description: 'Create plan', input: { goal: 'Refactor auth', steps: [{ description: 'Analyze code', tools: ['file_read'] }] } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as PlanInput;

    try {
      const steps: z.infer<typeof PlanStepSchema>[] = (params.steps || []).map((step, index) => ({
        number: index + 1,
        description: step.description,
        tools: step.tools || [],
        estimated_time: step.estimated_time,
      }));

      const output: PlanOutput = {
        goal: params.goal,
        steps,
        total_steps: steps.length,
        estimated_total_time: steps.length > 0 ? 'Unknown' : undefined,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('PLAN_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: PlanOutput): string {
    const parts: string[] = [];
    parts.push(`📋 Plan: ${output.goal}`);
    parts.push(`Total Steps: ${output.total_steps}`);
    if (output.estimated_total_time) {
      parts.push(`Estimated Time: ${output.estimated_total_time}`);
    }
    parts.push('');

    for (const step of output.steps) {
      parts.push(`${step.number}. ${step.description}`);
      if (step.tools.length > 0) {
        parts.push(`   Tools: ${step.tools.join(', ')}`);
      }
      if (step.estimated_time) {
        parts.push(`   Time: ${step.estimated_time}`);
      }
    }

    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: PlanOutput, output: string): ToolResult {
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

export default PlanTool;
