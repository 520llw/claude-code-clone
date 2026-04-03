/**
 * Sub-Agent Implementation
 *
 * A specialized agent that runs a scoped task delegated from a parent agent.
 * Sub-agents have their own AgentLoop but share the parent's tool registry.
 */

import { BaseAgent } from '@core/base-classes';
import { AgentLoop } from '@core/AgentLoop';
import type { AgentEvents } from '@core/AgentLoop';
import type {
  AgentConfig,
  AgentState,
  Task,
  TaskResult,
  Message,
  LLMConfig,
  Tool,
  Logger,
  UUID,
} from '@types/index';

export interface SubAgentOptions {
  parentId: UUID;
  llmConfig: LLMConfig;
  tools: Tool[];
  systemPrompt?: string;
  logger?: Logger;
  workingDirectory?: string;
  events?: AgentEvents;
}

export class SubAgent extends BaseAgent {
  private agentLoop: AgentLoop | null = null;
  private options: SubAgentOptions;

  constructor(options: SubAgentOptions) {
    super('sub-agent');
    this.options = options;
  }

  protected async onInitialize(config: AgentConfig): Promise<void> {
    this.agentLoop = new AgentLoop({
      llmConfig: this.options.llmConfig,
      tools: this.options.tools,
      systemPrompt: this.options.systemPrompt || config.systemPrompt || '',
      agentConfig: {
        maxIterations: config.maxIterations || 20,
        timeout: config.timeout || 120000,
        autoApprove: false,
        streamResponses: true,
      },
      events: this.options.events || {},
      logger: this.options.logger,
      workingDirectory: this.options.workingDirectory,
    });

    await this.agentLoop.initialize();
  }

  protected async onExecute(task: Task): Promise<TaskResult> {
    if (!this.agentLoop) {
      return {
        taskId: task.id,
        success: false,
        output: 'Sub-agent not initialized',
        executionTime: 0,
      };
    }

    const result = await this.agentLoop.run(task.description || task.input || '');

    // Extract assistant content from result messages
    const output = result.messages
      .filter((m: Message) => 'role' in m && m.role === 'assistant' && 'content' in m)
      .map((m: Message) => ('content' in m && typeof m.content === 'string') ? m.content : '')
      .join('\n');

    return {
      taskId: task.id,
      success: result.success,
      output,
      executionTime: result.totalDuration,
      metadata: {
        iterations: result.iterations.length,
        tokenUsage: result.totalTokenUsage,
      },
    };
  }

  protected async onSendMessage(message: Message): Promise<void> {
    if (this.agentLoop) {
      await this.agentLoop.run(
        'content' in message && typeof message.content === 'string'
          ? message.content
          : ''
      );
    }
  }

  protected async onReceiveMessage(): Promise<Message | null> {
    return null;
  }

  protected async onDispose(): Promise<void> {
    if (this.agentLoop) {
      await this.agentLoop.dispose();
      this.agentLoop = null;
    }
  }
}
