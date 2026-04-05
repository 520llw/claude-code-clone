/**
 * Agent Orchestrator
 * 
 * 重构后的Agent协调器，实现真正的多Agent并行协调。
 * 类似Claude Code的Agent编排能力。
 * 
 * 核心组件:
 * - PlanningAgent: 分析任务并制定计划
 * - TaskDecomposer: 将复杂任务分解为子任务
 * - AgentPool: 管理多个子Agent并行执行
 * - ResultAggregator: 聚合多个Agent的结果
 * 
 * 特性:
 * - 任务依赖管理
 * - Agent间通信
 * - 任务恢复能力(断点续传)
 * 
 * @module Orchestrator
 * @version 2.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../core/events';
import {
  AgentConfig,
  AgentInfo,
  AgentState,
  AgentType,
  AgentCapability,
  AgentEvent,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  Message,
  UUID,
} from '../types/index';
import { IAgent, IAgentOrchestrator } from '../core/interfaces';
import { AgentError } from '../core/errors';
import { TaskGraph, TaskNode, DependencyType } from './task-graph';
import { AgentPool, PoolAgent } from './pool';
import { ResultAggregator, AggregationStrategy } from './aggregator';
import { CheckpointManager, Checkpoint } from './checkpoint';
import { AgentMessageBus, AgentMessage } from './message-bus';

// ============================================================================
// Types
// ============================================================================

/**
 * 执行计划
 */
export interface ExecutionPlan {
  id: UUID;
  goal: string;
  tasks: TaskNode[];
  dependencies: Map<UUID, UUID[]>;
  parallelGroups: UUID[][];
  estimatedDuration: number;
  createdAt: number;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  planId: UUID;
  taskResults: Map<UUID, TaskResult>;
  sharedContext: Map<string, unknown>;
  checkpointId?: UUID;
}

/**
 * 协调器配置
 */
export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  defaultTimeout: number;
  enableCheckpoints: boolean;
  checkpointInterval: number;
  retryAttempts: number;
  retryDelay: number;
  aggregationStrategy: AggregationStrategy;
}

/**
 * 协调器事件
 */
export interface OrchestratorEvents {
  onPlanCreated?: (plan: ExecutionPlan) => void;
  onExecutionStarted?: (planId: UUID) => void;
  onTaskStarted?: (taskId: UUID, agentId: UUID) => void;
  onTaskCompleted?: (taskId: UUID, result: TaskResult) => void;
  onTaskFailed?: (taskId: UUID, error: Error) => void;
  onCheckpointCreated?: (checkpoint: Checkpoint) => void;
  onExecutionCompleted?: (planId: UUID, results: TaskResult[]) => void;
  onExecutionFailed?: (planId: UUID, error: Error) => void;
  onAgentSpawned?: (agent: PoolAgent) => void;
  onAgentTerminated?: (agentId: UUID) => void;
}

// ============================================================================
// Orchestrator Class
// ============================================================================

export class AgentOrchestrator extends EventEmitter implements IAgentOrchestrator {
  readonly id: UUID;
  readonly type = 'orchestrator' as AgentType;
  
  private config: OrchestratorConfig;
  private state: AgentState = 'idle';
  private agentPool: AgentPool;
  private taskGraph: TaskGraph;
  private resultAggregator: ResultAggregator;
  private checkpointManager: CheckpointManager;
  private messageBus: AgentMessageBus;
  private executionContext: Map<UUID, ExecutionContext> = new Map();
  private activePlans: Map<UUID, ExecutionPlan> = new Map();
  private events: OrchestratorEvents;
  private logger: Console;

  constructor(
    config: Partial<OrchestratorConfig> = {},
    events: OrchestratorEvents = {},
    logger: Console = console
  ) {
    super();
    this.id = uuidv4();
    this.logger = logger;
    this.events = events;
    
    this.config = {
      maxConcurrentAgents: 5,
      defaultTimeout: 300000,
      enableCheckpoints: true,
      checkpointInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      aggregationStrategy: 'sequential',
      ...config,
    };

    // 初始化组件
    this.agentPool = new AgentPool({
      maxAgents: this.config.maxConcurrentAgents,
      defaultTimeout: this.config.defaultTimeout,
    });
    
    this.taskGraph = new TaskGraph();
    this.resultAggregator = new ResultAggregator(this.config.aggregationStrategy);
    this.checkpointManager = new CheckpointManager();
    this.messageBus = new AgentMessageBus();

    this.setupEventHandlers();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 初始化协调器
   */
  async initialize(): Promise<void> {
    this.setState('initializing');
    
    await this.agentPool.initialize();
    await this.checkpointManager.initialize();
    await this.messageBus.initialize();
    
    this.setState('ready');
    this.logger.info(`[Orchestrator] Initialized with ID: ${this.id}`);
  }

  /**
   * 执行复杂任务（主入口）
   * 
   * @param goal - 任务目标
   * @param context - 额外上下文
   * @returns 执行结果
   */
  async execute(goal: string, context?: Record<string, unknown>): Promise<TaskResult> {
    if (this.state !== 'ready') {
      throw new AgentError('Orchestrator not ready', 'ORCHESTRATOR_NOT_READY');
    }

    try {
      this.setState('executing');

      // 1. 检查是否有可恢复的checkpoint
      const checkpoint = await this.checkpointManager.findResumableCheckpoint(goal);
      if (checkpoint) {
        this.logger.info(`[Orchestrator] Resuming from checkpoint: ${checkpoint.id}`);
        return this.resumeFromCheckpoint(checkpoint);
      }

      // 2. 创建执行计划
      const plan = await this.createExecutionPlan(goal, context);
      this.activePlans.set(plan.id, plan);
      this.events.onPlanCreated?.(plan);

      // 3. 执行计划
      const results = await this.executePlan(plan);

      // 4. 聚合结果
      const aggregatedResult = await this.resultAggregator.aggregate(results, plan);

      this.setState('ready');
      this.events.onExecutionCompleted?.(plan.id, results);

      return aggregatedResult;
    } catch (error) {
      this.setState('error');
      this.events.onExecutionFailed?.(this.id, error as Error);
      throw error;
    }
  }

  /**
   * 从checkpoint恢复执行
   */
  async resumeFromCheckpoint(checkpoint: Checkpoint): Promise<TaskResult> {
    this.logger.info(`[Orchestrator] Resuming execution from checkpoint: ${checkpoint.id}`);
    
    // 恢复执行上下文
    const context: ExecutionContext = {
      planId: checkpoint.planId,
      taskResults: new Map(checkpoint.taskResults),
      sharedContext: new Map(checkpoint.sharedContext),
      checkpointId: checkpoint.id,
    };

    // 获取计划
    const plan = this.activePlans.get(checkpoint.planId);
    if (!plan) {
      throw new AgentError('Plan not found for checkpoint', 'PLAN_NOT_FOUND');
    }

    // 找出未完成的任务
    const completedTasks = new Set(checkpoint.completedTasks);
    const remainingTasks = plan.tasks.filter(t => !completedTasks.has(t.id));

    // 执行剩余任务
    const results = await this.executeRemainingTasks(plan, remainingTasks, context);

    // 合并结果
    const allResults = [...checkpoint.results, ...results];
    return this.resultAggregator.aggregate(allResults, plan);
  }

  /**
   * 暂停执行
   */
  async pause(): Promise<void> {
    this.setState('waiting');
    await this.agentPool.pauseAll();
    
    // 创建checkpoint
    if (this.config.enableCheckpoints) {
      for (const [planId, context] of this.executionContext) {
        await this.createCheckpoint(planId, context);
      }
    }
  }

  /**
   * 恢复执行
   */
  async resume(): Promise<void> {
    await this.agentPool.resumeAll();
    this.setState('executing');
  }

  /**
   * 取消执行
   */
  async cancel(planId?: UUID): Promise<void> {
    if (planId) {
      await this.agentPool.terminateAgentsForPlan(planId);
    } else {
      await this.agentPool.terminateAll();
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * 获取执行统计
   */
  getStats(): {
    activePlans: number;
    activeAgents: number;
    completedTasks: number;
    failedTasks: number;
  } {
    return {
      activePlans: this.activePlans.size,
      activeAgents: this.agentPool.getActiveCount(),
      completedTasks: this.agentPool.getCompletedCount(),
      failedTasks: this.agentPool.getFailedCount(),
    };
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    this.setState('terminated');
    
    await this.agentPool.dispose();
    await this.checkpointManager.dispose();
    await this.messageBus.dispose();
    
    this.removeAllListeners();
    this.executionContext.clear();
    this.activePlans.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 创建执行计划
   */
  private async createExecutionPlan(
    goal: string,
    context?: Record<string, unknown>
  ): Promise<ExecutionPlan> {
    // 使用PlanningAgent分析任务
    const planningAgent = await this.agentPool.spawnPlanningAgent();
    
    try {
      // 分析任务并分解
      const analysis = await planningAgent.analyze(goal, context);
      
      // 构建任务图
      const tasks = analysis.subtasks.map(subtask => ({
        id: uuidv4(),
        description: subtask.description,
        type: subtask.type,
        priority: subtask.priority as TaskPriority,
        dependencies: subtask.dependencies,
        estimatedDuration: subtask.estimatedDuration,
        requiredCapabilities: subtask.requiredCapabilities,
      }));

      // 构建依赖图
      const taskNodes = this.taskGraph.build(tasks);
      
      // 计算并行组
      const parallelGroups = this.taskGraph.computeParallelGroups(taskNodes);

      const plan: ExecutionPlan = {
        id: uuidv4(),
        goal,
        tasks: taskNodes,
        dependencies: this.taskGraph.getDependencyMap(),
        parallelGroups,
        estimatedDuration: analysis.estimatedTotalDuration,
        createdAt: Date.now(),
      };

      return plan;
    } finally {
      await this.agentPool.releaseAgent(planningAgent.id);
    }
  }

  /**
   * 执行计划
   */
  private async executePlan(plan: ExecutionPlan): Promise<TaskResult[]> {
    this.events.onExecutionStarted?.(plan.id);
    
    const context: ExecutionContext = {
      planId: plan.id,
      taskResults: new Map(),
      sharedContext: new Map(),
    };
    
    this.executionContext.set(plan.id, context);

    const results: TaskResult[] = [];

    // 按并行组执行
    for (const group of plan.parallelGroups) {
      // 检查依赖是否满足
      const readyTasks = group.filter(taskId => 
        this.areDependenciesMet(taskId, plan, context)
      );

      if (readyTasks.length === 0) {
        this.logger.warn(`[Orchestrator] No ready tasks in group, skipping`);
        continue;
      }

      // 并行执行任务
      const groupResults = await this.executeTasksInParallel(readyTasks, plan, context);
      results.push(...groupResults);

      // 创建checkpoint
      if (this.config.enableCheckpoints) {
        await this.createCheckpoint(plan.id, context);
      }
    }

    return results;
  }

  /**
   * 并行执行多个任务
   */
  private async executeTasksInParallel(
    taskIds: UUID[],
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<TaskResult[]> {
    const executions = taskIds.map(async taskId => {
      const taskNode = plan.tasks.find(t => t.id === taskId);
      if (!taskNode) {
        throw new AgentError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
      }

      return this.executeTaskWithRetry(taskNode, plan, context);
    });

    return Promise.all(executions);
  }

  /**
   * 执行任务（带重试）
   */
  private async executeTaskWithRetry(
    taskNode: TaskNode,
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<TaskResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const result = await this.executeTask(taskNode, plan, context);
        
        if (result.success) {
          context.taskResults.set(taskNode.id, result);
          this.events.onTaskCompleted?.(taskNode.id, result);
          return result;
        }
        
        lastError = new Error(result.error || 'Task failed');
      } catch (error) {
        lastError = error as Error;
        this.logger.error(`[Orchestrator] Task ${taskNode.id} failed (attempt ${attempt + 1}):`, error);
      }

      if (attempt < this.config.retryAttempts - 1) {
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }

    const failedResult: TaskResult = {
      taskId: taskNode.id,
      success: false,
      output: '',
      error: lastError?.message || 'Task failed after all retries',
      executionTime: 0,
    };

    this.events.onTaskFailed?.(taskNode.id, lastError || new Error('Unknown error'));
    return failedResult;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    taskNode: TaskNode,
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<TaskResult> {
    // 获取或创建Agent
    const agent = await this.agentPool.acquireAgent({
      capabilities: taskNode.requiredCapabilities,
      planId: plan.id,
    });

    this.events.onAgentSpawned?.(agent);
    this.events.onTaskStarted?.(taskNode.id, agent.id);

    try {
      // 准备任务上下文
      const taskContext = this.buildTaskContext(taskNode, plan, context);

      // 执行任务
      const task: Task = {
        id: taskNode.id,
        description: taskNode.description,
        type: taskNode.type,
        priority: taskNode.priority,
        context: taskContext,
      };

      const result = await agent.execute(task);

      // 更新共享上下文
      this.updateSharedContext(context, result);

      return result;
    } finally {
      await this.agentPool.releaseAgent(agent.id);
      this.events.onAgentTerminated?.(agent.id);
    }
  }

  /**
   * 检查依赖是否满足
   */
  private areDependenciesMet(
    taskId: UUID,
    plan: ExecutionPlan,
    context: ExecutionContext
  ): boolean {
    const dependencies = plan.dependencies.get(taskId) || [];
    return dependencies.every(depId => 
      context.taskResults.has(depId) && 
      context.taskResults.get(depId)!.success
    );
  }

  /**
   * 构建任务上下文
   */
  private buildTaskContext(
    taskNode: TaskNode,
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Record<string, unknown> {
    const taskContext: Record<string, unknown> = {
      planId: plan.id,
      goal: plan.goal,
      taskId: taskNode.id,
      ...Object.fromEntries(context.sharedContext),
    };

    // 添加依赖任务的结果
    const dependencies = plan.dependencies.get(taskNode.id) || [];
    for (const depId of dependencies) {
      const depResult = context.taskResults.get(depId);
      if (depResult) {
        taskContext[`dep_${depId}`] = depResult.output;
      }
    }

    return taskContext;
  }

  /**
   * 更新共享上下文
   */
  private updateSharedContext(
    context: ExecutionContext,
    result: TaskResult
  ): void {
    // 提取关键信息到共享上下文
    if (result.artifacts) {
      for (const artifact of result.artifacts) {
        if (artifact.metadata?.shared) {
          context.sharedContext.set(artifact.type, artifact.content);
        }
      }
    }
  }

  /**
   * 执行剩余任务（用于断点续传）
   */
  private async executeRemainingTasks(
    plan: ExecutionPlan,
    remainingTasks: TaskNode[],
    context: ExecutionContext
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const taskNode of remainingTasks) {
      if (!this.areDependenciesMet(taskNode.id, plan, context)) {
        this.logger.warn(`[Orchestrator] Dependencies not met for task: ${taskNode.id}`);
        continue;
      }

      const result = await this.executeTaskWithRetry(taskNode, plan, context);
      results.push(result);

      if (this.config.enableCheckpoints) {
        await this.createCheckpoint(plan.id, context);
      }
    }

    return results;
  }

  /**
   * 创建Checkpoint
   */
  private async createCheckpoint(
    planId: UUID,
    context: ExecutionContext
  ): Promise<Checkpoint> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new AgentError('Plan not found', 'PLAN_NOT_FOUND');
    }

    const checkpoint: Checkpoint = {
      id: uuidv4(),
      planId,
      goal: plan.goal,
      completedTasks: Array.from(context.taskResults.keys()),
      taskResults: Array.from(context.taskResults.entries()),
      sharedContext: Array.from(context.sharedContext.entries()),
      results: Array.from(context.taskResults.values()),
      createdAt: Date.now(),
    };

    await this.checkpointManager.save(checkpoint);
    this.events.onCheckpointCreated?.(checkpoint);

    return checkpoint;
  }

  /**
   * 设置状态
   */
  private setState(state: AgentState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // Agent池事件
    this.agentPool.on('agentSpawned', (agent) => {
      this.emit('agentSpawned', agent);
    });

    this.agentPool.on('agentTerminated', (agentId) => {
      this.emit('agentTerminated', agentId);
    });

    // 消息总线事件
    this.messageBus.on('message', (message: AgentMessage) => {
      this.handleAgentMessage(message);
    });
  }

  /**
   * 处理Agent间消息
   */
  private handleAgentMessage(message: AgentMessage): void {
    // 根据消息类型处理
    switch (message.type) {
      case 'request_help':
        this.handleHelpRequest(message);
        break;
      case 'share_result':
        this.handleResultShare(message);
        break;
      case 'coordination':
        this.handleCoordinationMessage(message);
        break;
    }
  }

  private handleHelpRequest(message: AgentMessage): void {
    // 找到可以协助的Agent
    // 实现协作逻辑
  }

  private handleResultShare(message: AgentMessage): void {
    // 更新共享上下文
    const context = this.executionContext.get(message.planId!);
    if (context) {
      context.sharedContext.set(message.payload.key, message.payload.value);
    }
  }

  private handleCoordinationMessage(message: AgentMessage): void {
    // 处理协调消息
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createOrchestrator(
  config?: Partial<OrchestratorConfig>,
  events?: OrchestratorEvents,
  logger?: Console
): AgentOrchestrator {
  return new AgentOrchestrator(config, events, logger);
}

export default AgentOrchestrator;
