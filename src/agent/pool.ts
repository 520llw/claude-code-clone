/**
 * Agent Pool
 * 
 * 管理多个子Agent的并行执行。
 * - Agent生命周期管理
 * - 资源分配和回收
 * - 负载均衡
 * - 故障恢复
 * 
 * @module AgentPool
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../core/events';
import {
  Task,
  TaskResult,
  TaskStatus,
  AgentConfig,
  AgentState,
  AgentType,
  AgentCapability,
  UUID,
} from '../types/index';
import { IAgent } from '../core/interfaces';
import { AgentError } from '../core/errors';
import { PlanningAgent } from './planner';

// ============================================================================
// Types
// ============================================================================

/**
 * 池中的Agent
 */
export interface PoolAgent extends IAgent {
  poolId: UUID;
  planId?: UUID;
  acquiredAt?: number;
  tasksCompleted: number;
  tasksFailed: number;
  capabilities: string[];
}

/**
 * Agent池配置
 */
export interface AgentPoolConfig {
  maxAgents: number;
  minAgents: number;
  defaultTimeout: number;
  idleTimeout: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

/**
 * Agent获取选项
 */
export interface AcquireAgentOptions {
  capabilities?: string[];
  planId?: UUID;
  timeout?: number;
  priority?: number;
}

/**
 * Agent池统计
 */
export interface AgentPoolStats {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  waitingRequests: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  averageTaskDuration: number;
}

/**
 * Agent工厂函数
 */
export type AgentFactory = (config: AgentConfig) => Promise<PoolAgent>;

// ============================================================================
// Agent Pool Class
// ============================================================================

export class AgentPool extends EventEmitter {
  private config: AgentPoolConfig;
  private agents: Map<UUID, PoolAgent> = new Map();
  private idleAgents: Set<UUID> = new Set();
  private activeAgents: Map<UUID, { agent: PoolAgent; taskStartTime: number }> = new Map();
  private waitingQueue: Array<{
    id: UUID;
    resolve: (agent: PoolAgent) => void;
    reject: (error: Error) => void;
    options: AcquireAgentOptions;
    timeout: NodeJS.Timeout;
  }> = [];
  private planningAgent?: PlanningAgent;
  private agentFactory: AgentFactory;
  private stats = {
    totalCompleted: 0,
    totalFailed: 0,
    totalDuration: 0,
  };
  private maintenanceInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    config: Partial<AgentPoolConfig> = {},
    agentFactory?: AgentFactory
  ) {
    super();
    
    this.config = {
      maxAgents: 5,
      minAgents: 1,
      defaultTimeout: 300000,
      idleTimeout: 60000,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      ...config,
    };

    // 默认Agent工厂
    this.agentFactory = agentFactory || this.defaultAgentFactory.bind(this);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 初始化Agent池
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 创建最小数量的Agent
    for (let i = 0; i < this.config.minAgents; i++) {
      await this.spawnAgent();
    }

    // 启动维护循环
    this.startMaintenanceLoop();

    this.isInitialized = true;
    this.emit('initialized', { agentCount: this.agents.size });
  }

  /**
   * 获取Agent
   */
  async acquireAgent(options: AcquireAgentOptions = {}): Promise<PoolAgent> {
    if (!this.isInitialized) {
      throw new AgentError('Pool not initialized', 'POOL_NOT_INITIALIZED');
    }

    // 尝试获取匹配的Agent
    const matchingAgent = this.findMatchingAgent(options);
    if (matchingAgent) {
      return this.acquireMatchingAgent(matchingAgent, options);
    }

    // 如果没有匹配的Agent，尝试创建新的
    if (this.agents.size < this.config.maxAgents) {
      const newAgent = await this.spawnAgent(options.capabilities);
      return this.acquireMatchingAgent(newAgent, options);
    }

    // 加入等待队列
    return this.enqueueForAgent(options);
  }

  /**
   * 释放Agent回池中
   */
  async releaseAgent(agentId: UUID): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentError(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND');
    }

    // 从活跃列表移除
    const activeInfo = this.activeAgents.get(agentId);
    if (activeInfo) {
      const duration = Date.now() - activeInfo.taskStartTime;
      this.stats.totalDuration += duration;
      this.activeAgents.delete(agentId);
    }

    // 重置Agent状态
    agent.planId = undefined;
    agent.acquiredAt = undefined;

    // 加入空闲列表
    this.idleAgents.add(agentId);

    // 处理等待队列
    this.processWaitingQueue();

    this.emit('agentReleased', agent);
  }

  /**
   * 生成Planning Agent
   */
  async spawnPlanningAgent(): Promise<PlanningAgent> {
    if (!this.planningAgent) {
      this.planningAgent = new PlanningAgent({
        model: 'gpt-4',
      });
    }
    return this.planningAgent;
  }

  /**
   * 终止指定Agent
   */
  async terminateAgent(agentId: UUID): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // 如果Agent正在执行任务，标记为失败
    if (this.activeAgents.has(agentId)) {
      this.stats.totalFailed++;
      this.activeAgents.delete(agentId);
    }

    // 从所有集合中移除
    this.agents.delete(agentId);
    this.idleAgents.delete(agentId);

    // 释放资源
    try {
      await agent.dispose();
    } catch (error) {
      this.emit('error', { agentId, error });
    }

    this.emit('agentTerminated', agentId);
  }

  /**
   * 终止指定计划的所有Agent
   */
  async terminateAgentsForPlan(planId: UUID): Promise<void> {
    const agentsToTerminate: UUID[] = [];

    for (const [id, agent] of this.agents) {
      if (agent.planId === planId) {
        agentsToTerminate.push(id);
      }
    }

    await Promise.all(agentsToTerminate.map(id => this.terminateAgent(id)));
  }

  /**
   * 终止所有Agent
   */
  async terminateAll(): Promise<void> {
    const agentIds = Array.from(this.agents.keys());
    await Promise.all(agentIds.map(id => this.terminateAgent(id)));
  }

  /**
   * 暂停所有Agent
   */
  async pauseAll(): Promise<void> {
    for (const [id, { agent }] of this.activeAgents) {
      await agent.pause();
    }
    this.emit('paused');
  }

  /**
   * 恢复所有Agent
   */
  async resumeAll(): Promise<void> {
    for (const [id, { agent }] of this.activeAgents) {
      await agent.resume();
    }
    this.emit('resumed');
  }

  /**
   * 获取池中Agent数量
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * 获取活跃Agent数量
   */
  getActiveCount(): number {
    return this.activeAgents.size;
  }

  /**
   * 获取空闲Agent数量
   */
  getIdleCount(): number {
    return this.idleAgents.size;
  }

  /**
   * 获取已完成任务数
   */
  getCompletedCount(): number {
    return this.stats.totalCompleted;
  }

  /**
   * 获取失败任务数
   */
  getFailedCount(): number {
    return this.stats.totalFailed;
  }

  /**
   * 获取统计信息
   */
  getStats(): AgentPoolStats {
    const activeCount = this.activeAgents.size;
    const idleCount = this.idleAgents.size;
    const totalTasks = this.stats.totalCompleted + this.stats.totalFailed;
    
    return {
      totalAgents: this.agents.size,
      activeAgents: activeCount,
      idleAgents: idleCount,
      waitingRequests: this.waitingQueue.length,
      totalTasksCompleted: this.stats.totalCompleted,
      totalTasksFailed: this.stats.totalFailed,
      averageTaskDuration: totalTasks > 0 
        ? this.stats.totalDuration / totalTasks 
        : 0,
    };
  }

  /**
   * 获取Agent信息
   */
  getAgentInfo(agentId: UUID): Partial<PoolAgent> | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    return {
      id: agent.id,
      poolId: agent.poolId,
      planId: agent.planId,
      state: agent.state,
      capabilities: agent.capabilities,
      tasksCompleted: agent.tasksCompleted,
      tasksFailed: agent.tasksFailed,
      acquiredAt: agent.acquiredAt,
    };
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    this.stopMaintenanceLoop();
    await this.terminateAll();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 生成新Agent
   */
  private async spawnAgent(capabilities?: string[]): Promise<PoolAgent> {
    const config: AgentConfig = {
      name: `PoolAgent-${this.agents.size + 1}`,
      type: 'sub' as AgentType,
      capabilities: capabilities?.map(cap => ({
        name: cap,
        description: `Capability: ${cap}`,
        tools: [],
      })) || [],
    };

    const agent = await this.agentFactory(config);
    agent.poolId = uuidv4();
    agent.capabilities = capabilities || ['general'];
    agent.tasksCompleted = 0;
    agent.tasksFailed = 0;

    this.agents.set(agent.id, agent);
    this.idleAgents.add(agent.id);

    this.emit('agentSpawned', agent);

    return agent;
  }

  /**
   * 默认Agent工厂
   */
  private async defaultAgentFactory(config: AgentConfig): Promise<PoolAgent> {
    // 这里应该创建实际的Agent实例
    // 现在使用模拟实现
    const agent: PoolAgent = {
      id: uuidv4(),
      poolId: '',
      name: config.name || 'Agent',
      type: config.type || 'sub',
      state: 'idle',
      capabilities: config.capabilities?.map(c => c.name) || [],
      tasksCompleted: 0,
      tasksFailed: 0,

      async initialize(cfg: AgentConfig): Promise<void> {
        this.state = 'ready';
      },

      async execute(task: Task): Promise<TaskResult> {
        this.state = 'executing';
        const startTime = Date.now();
        
        try {
          // 模拟执行
          await this.simulateExecution(task);
          
          this.tasksCompleted++;
          this.state = 'ready';
          
          return {
            taskId: task.id || uuidv4(),
            success: true,
            output: `Task completed: ${task.description}`,
            executionTime: Date.now() - startTime,
          };
        } catch (error) {
          this.tasksFailed++;
          this.state = 'error';
          
          return {
            taskId: task.id || uuidv4(),
            success: false,
            output: '',
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          };
        }
      },

      async delegate(task: Task, toAgent: IAgent): Promise<TaskResult> {
        return toAgent.execute(task);
      },

      async sendMessage(message: any): Promise<void> {
        // 实现消息发送
      },

      async receiveMessage(): Promise<any> {
        return null;
      },

      getInfo() {
        return {
          id: this.id,
          name: this.name,
          type: this.type,
          state: this.state,
          capabilities: config.capabilities || [],
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          taskCount: this.tasksCompleted + this.tasksFailed,
          metadata: {},
        };
      },

      async pause(): Promise<void> {
        this.state = 'waiting';
      },

      async resume(): Promise<void> {
        this.state = 'ready';
      },

      async dispose(): Promise<void> {
        this.state = 'terminated';
      },

      on: () => {},
      off: () => {},
      once: () => {},
      emit: () => {},
      removeAllListeners: () => {},
    };

    // 模拟执行方法（内部使用）
    const simulateExecution = async (task: Task): Promise<void> => {
      const duration = Math.random() * 5000 + 1000;
      await new Promise(resolve => setTimeout(resolve, duration));
      
      if (Math.random() < 0.05) { // 5% 失败率
        throw new Error('Simulated execution error');
      }
    };

    await agent.initialize(config);
    return agent;
  }

  /**
   * 查找匹配的Agent
   */
  private findMatchingAgent(options: AcquireAgentOptions): PoolAgent | undefined {
    for (const agentId of this.idleAgents) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      if (this.agentMatchesRequirements(agent, options)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * 检查Agent是否满足要求
   */
  private agentMatchesRequirements(
    agent: PoolAgent,
    options: AcquireAgentOptions
  ): boolean {
    if (!options.capabilities || options.capabilities.length === 0) {
      return true;
    }

    return options.capabilities.every(cap => 
      agent.capabilities.includes(cap)
    );
  }

  /**
   * 获取匹配的Agent
   */
  private acquireMatchingAgent(
    agent: PoolAgent,
    options: AcquireAgentOptions
  ): PoolAgent {
    // 从空闲列表移除
    this.idleAgents.delete(agent.id);

    // 设置Agent状态
    agent.planId = options.planId;
    agent.acquiredAt = Date.now();

    // 添加到活跃列表
    this.activeAgents.set(agent.id, {
      agent,
      taskStartTime: Date.now(),
    });

    this.emit('agentAcquired', agent);

    return agent;
  }

  /**
   * 加入等待队列
   */
  private enqueueForAgent(options: AcquireAgentOptions): Promise<PoolAgent> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      const timeout = setTimeout(() => {
        // 从队列中移除
        const index = this.waitingQueue.findIndex(r => r.id === requestId);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new AgentError('Timeout waiting for agent', 'AGENT_ACQUIRE_TIMEOUT'));
      }, options.timeout || this.config.defaultTimeout);

      this.waitingQueue.push({
        id: requestId,
        resolve,
        reject,
        options,
        timeout,
      });

      this.emit('requestQueued', { requestId, options });
    });
  }

  /**
   * 处理等待队列
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) return;
    if (this.idleAgents.size === 0) return;

    // 按优先级排序
    this.waitingQueue.sort((a, b) => 
      (b.options.priority || 0) - (a.options.priority || 0)
    );

    // 尝试为等待的请求分配Agent
    const toRemove: typeof this.waitingQueue = [];

    for (const request of this.waitingQueue) {
      const agent = this.findMatchingAgent(request.options);
      if (agent) {
        clearTimeout(request.timeout);
        toRemove.push(request);
        
        // 异步resolve，避免阻塞
        setImmediate(() => {
          request.resolve(this.acquireMatchingAgent(agent, request.options));
        });
      }
    }

    // 移除已处理的请求
    for (const request of toRemove) {
      const index = this.waitingQueue.indexOf(request);
      if (index >= 0) {
        this.waitingQueue.splice(index, 1);
      }
    }
  }

  /**
   * 启动维护循环
   */
  private startMaintenanceLoop(): void {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 10000); // 每10秒
  }

  /**
   * 停止维护循环
   */
  private stopMaintenanceLoop(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }
  }

  /**
   * 执行维护任务
   */
  private performMaintenance(): void {
    const now = Date.now();
    const agentsToTerminate: UUID[] = [];

    // 清理超时空闲Agent
    for (const agentId of this.idleAgents) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      // 如果超过最小数量且空闲时间过长
      if (this.agents.size > this.config.minAgents) {
        const idleTime = now - (agent.acquiredAt || now);
        if (idleTime > this.config.idleTimeout) {
          agentsToTerminate.push(agentId);
        }
      }
    }

    // 终止超时空闲Agent
    for (const agentId of agentsToTerminate) {
      this.terminateAgent(agentId);
    }

    // 动态扩容
    const utilization = this.activeAgents.size / this.config.maxAgents;
    if (utilization > this.config.scaleUpThreshold && 
        this.agents.size < this.config.maxAgents) {
      this.spawnAgent();
    }

    this.emit('maintenance', this.getStats());
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAgentPool(
  config?: Partial<AgentPoolConfig>,
  agentFactory?: AgentFactory
): AgentPool {
  return new AgentPool(config, agentFactory);
}

export default AgentPool;
