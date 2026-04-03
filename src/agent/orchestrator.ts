/**
 * Agent Orchestrator
 *
 * Manages the lifecycle of parent and sub-agents, handles delegation,
 * and coordinates multi-agent task execution.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '@core/events';
import { SubAgent } from './sub-agent';
import type { SubAgentOptions } from './sub-agent';
import type {
  IAgent,
  IAgentOrchestrator,
} from '@core/interfaces';
import type {
  AgentConfig,
  Task,
  TaskResult,
  UUID,
  Logger,
  LLMConfig,
  Tool,
} from '@types/index';

export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  llmConfig: LLMConfig;
  tools: Tool[];
  logger?: Logger;
  workingDirectory?: string;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<UUID, IAgent> = new Map();
  private config: OrchestratorConfig;
  private logger?: Logger;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.logger = config.logger;
  }

  /**
   * Spawn a new sub-agent for a specific task
   */
  async spawnSubAgent(
    parentId: UUID,
    taskDescription: string,
    options?: Partial<SubAgentOptions>
  ): Promise<SubAgent> {
    if (this.agents.size >= this.config.maxConcurrentAgents) {
      throw new Error(
        `Maximum concurrent agents (${this.config.maxConcurrentAgents}) reached`
      );
    }

    const subAgent = new SubAgent({
      parentId,
      llmConfig: options?.llmConfig || this.config.llmConfig,
      tools: options?.tools || this.config.tools,
      systemPrompt: options?.systemPrompt || `You are a sub-agent. Your task: ${taskDescription}`,
      logger: options?.logger || this.logger,
      workingDirectory: options?.workingDirectory || this.config.workingDirectory,
      events: options?.events,
    });

    const agentConfig: AgentConfig = {
      name: `sub-agent-${this.agents.size + 1}`,
      maxIterations: 20,
      timeout: 120000,
      autoApprove: false,
      streamResponses: true,
      capabilities: ['tool_use', 'code_generation'],
      parentId,
    };

    await subAgent.initialize(agentConfig);
    this.agents.set(subAgent.id, subAgent);

    this.logger?.info(`Spawned sub-agent ${subAgent.id} for parent ${parentId}`);
    this.emit('agent:spawned', { agentId: subAgent.id, parentId });

    return subAgent;
  }

  /**
   * Execute a task with a new sub-agent
   */
  async delegateTask(
    parentId: UUID,
    task: Task
  ): Promise<TaskResult> {
    const subAgent = await this.spawnSubAgent(
      parentId,
      task.description || task.input || ''
    );

    try {
      const result = await subAgent.execute(task);
      return result;
    } finally {
      await this.removeAgent(subAgent.id);
    }
  }

  /**
   * Remove and dispose an agent
   */
  async removeAgent(agentId: UUID): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.dispose();
      this.agents.delete(agentId);
      this.emit('agent:removed', { agentId });
    }
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent count
   */
  get agentCount(): number {
    return this.agents.size;
  }

  /**
   * Dispose all agents
   */
  async dispose(): Promise<void> {
    for (const [id, agent] of this.agents) {
      await agent.dispose();
    }
    this.agents.clear();
  }
}
