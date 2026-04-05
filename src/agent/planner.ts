/**
 * Planning Agent
 * 
 * 专门负责分析复杂任务并制定执行计划的Agent。
 * 使用LLM分析任务，分解为可执行的子任务。
 * 
 * @module PlanningAgent
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TaskPriority,
  Task,
  UUID,
} from '../types/index';

// ============================================================================
// Types
// ============================================================================

/**
 * 子任务定义
 */
export interface SubTask {
  id: UUID;
  description: string;
  type: string;
  priority: TaskPriority;
  dependencies: UUID[];
  estimatedDuration: number;
  requiredCapabilities: string[];
  expectedOutput?: string;
}

/**
 * 任务分析结果
 */
export interface TaskAnalysis {
  goal: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedTotalDuration: number;
  subtasks: SubTask[];
  parallelizationOpportunities: number;
  riskFactors: string[];
  recommendations: string[];
}

/**
 * 任务依赖关系
 */
export interface TaskDependency {
  taskId: UUID;
  dependsOn: UUID[];
  dependencyType: 'hard' | 'soft' | 'optional';
  reason?: string;
}

/**
 * Planning Agent配置
 */
export interface PlanningAgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  enableComplexityAnalysis: boolean;
  enableRiskAssessment: boolean;
}

// ============================================================================
// Planning Agent Class
// ============================================================================

export class PlanningAgent {
  readonly id: UUID;
  private config: PlanningAgentConfig;
  private llmConfig: {
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };

  constructor(
    llmConfig: { model: string; apiKey?: string; baseUrl?: string },
    config?: Partial<PlanningAgentConfig>
  ) {
    this.id = uuidv4();
    this.llmConfig = llmConfig;
    this.config = {
      model: llmConfig.model,
      maxTokens: 4096,
      temperature: 0.3,
      enableComplexityAnalysis: true,
      enableRiskAssessment: true,
      ...config,
    };
  }

  /**
   * 分析任务并生成执行计划
   */
  async analyze(
    goal: string,
    context?: Record<string, unknown>
  ): Promise<TaskAnalysis> {
    // 构建分析提示
    const prompt = this.buildAnalysisPrompt(goal, context);

    // 调用LLM进行分析
    const analysis = await this.callLLMForAnalysis(prompt);

    // 验证和优化分析结果
    const validatedAnalysis = this.validateAndOptimize(analysis);

    return validatedAnalysis;
  }

  /**
   * 分析任务复杂度
   */
  analyzeComplexity(goal: string): { complexity: 'low' | 'medium' | 'high'; score: number } {
    // 基于启发式规则分析复杂度
    const factors = [
      { pattern: /\b(refactor|redesign|rearchitect)\b/i, weight: 3 },
      { pattern: /\b(implement|create|build|develop)\b/i, weight: 2 },
      { pattern: /\b(fix|debug|optimize|improve)\b/i, weight: 1 },
      { pattern: /\b(multiple|several|various|many)\b/i, weight: 2 },
      { pattern: /\b(integrate|connect|migrate)\b/i, weight: 2 },
      { pattern: /\b(test|verify|validate)\b/i, weight: 1 },
    ];

    let score = 0;
    for (const factor of factors) {
      if (factor.pattern.test(goal)) {
        score += factor.weight;
      }
    }

    // 基于长度增加复杂度
    score += Math.floor(goal.length / 100);

    let complexity: 'low' | 'medium' | 'high';
    if (score <= 3) {
      complexity = 'low';
    } else if (score <= 7) {
      complexity = 'medium';
    } else {
      complexity = 'high';
    }

    return { complexity, score };
  }

  /**
   * 分解任务为子任务
   */
  async decompose(
    goal: string,
    complexity: 'low' | 'medium' | 'high',
    context?: Record<string, unknown>
  ): Promise<SubTask[]> {
    const decompositionStrategy = this.selectDecompositionStrategy(complexity);
    
    switch (decompositionStrategy) {
      case 'simple':
        return this.simpleDecomposition(goal);
      case 'functional':
        return this.functionalDecomposition(goal, context);
      case 'layered':
        return this.layeredDecomposition(goal, context);
      case 'modular':
        return this.modularDecomposition(goal, context);
      default:
        return this.functionalDecomposition(goal, context);
    }
  }

  /**
   * 识别任务依赖关系
   */
  identifyDependencies(subtasks: SubTask[]): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    for (const task of subtasks) {
      const taskDeps: TaskDependency = {
        taskId: task.id,
        dependsOn: [],
        dependencyType: 'hard',
      };

      // 基于任务描述识别隐式依赖
      for (const otherTask of subtasks) {
        if (task.id === otherTask.id) continue;

        // 检查文本相似性和关键词重叠
        const similarity = this.calculateTaskSimilarity(task, otherTask);
        
        if (similarity > 0.7) {
          // 高度相似的任务可能有依赖关系
          taskDeps.dependsOn.push(otherTask.id);
          taskDeps.reason = 'High semantic similarity';
        }

        // 检查明确的依赖关键词
        if (this.hasDependencyKeywords(task.description, otherTask.description)) {
          if (!taskDeps.dependsOn.includes(otherTask.id)) {
            taskDeps.dependsOn.push(otherTask.id);
          }
        }
      }

      if (taskDeps.dependsOn.length > 0) {
        dependencies.push(taskDeps);
      }
    }

    return dependencies;
  }

  /**
   * 优化执行顺序
   */
  optimizeExecutionOrder(subtasks: SubTask[], dependencies: TaskDependency[]): SubTask[] {
    // 拓扑排序实现
    const visited = new Set<UUID>();
    const visiting = new Set<UUID>();
    const order: SubTask[] = [];

    const visit = (task: SubTask): void => {
      if (visited.has(task.id)) return;
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected for task: ${task.id}`);
      }

      visiting.add(task.id);

      // 获取依赖
      const taskDeps = dependencies.find(d => d.taskId === task.id);
      if (taskDeps) {
        for (const depId of taskDeps.dependsOn) {
          const depTask = subtasks.find(t => t.id === depId);
          if (depTask) {
            visit(depTask);
          }
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      order.push(task);
    };

    // 按优先级排序
    const sortedByPriority = [...subtasks].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const task of sortedByPriority) {
      visit(task);
    }

    return order;
  }

  /**
   * 估计任务持续时间
   */
  estimateDuration(subtasks: SubTask[]): number {
    return subtasks.reduce((total, task) => {
      // 基于任务类型和复杂度估计
      let baseDuration = task.estimatedDuration;

      // 添加缓冲时间
      const bufferFactor = 1.2;
      
      return total + (baseDuration * bufferFactor);
    }, 0);
  }

  /**
   * 识别风险因素
   */
  identifyRiskFactors(goal: string, subtasks: SubTask[]): string[] {
    const risks: string[] = [];

    // 基于关键词识别风险
    const riskPatterns = [
      { pattern: /\b(legacy|old|outdated)\b/i, risk: 'Working with legacy code' },
      { pattern: /\b(third.party|external|api)\b/i, risk: 'External dependency' },
      { pattern: /\b(database|migration)\b/i, risk: 'Database operation' },
      { pattern: /\b(security|auth|authentication)\b/i, risk: 'Security-critical' },
      { pattern: /\b(concurrent|parallel|race)\b/i, risk: 'Concurrency concerns' },
    ];

    for (const { pattern, risk } of riskPatterns) {
      if (pattern.test(goal)) {
        risks.push(risk);
      }
    }

    // 基于子任务数量识别风险
    if (subtasks.length > 10) {
      risks.push('Large number of subtasks');
    }

    // 基于依赖复杂度识别风险
    const totalDeps = subtasks.reduce((sum, t) => sum + t.dependencies.length, 0);
    if (totalDeps > subtasks.length * 2) {
      risks.push('High dependency complexity');
    }

    return [...new Set(risks)]; // 去重
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildAnalysisPrompt(
    goal: string,
    context?: Record<string, unknown>
  ): string {
    let prompt = `Analyze the following task and create a detailed execution plan:\n\n`;
    prompt += `Goal: ${goal}\n\n`;

    if (context) {
      prompt += `Context:\n`;
      for (const [key, value] of Object.entries(context)) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Please provide:\n`;
    prompt += `1. Task complexity assessment (low/medium/high)\n`;
    prompt += `2. Breakdown into subtasks with:\n`;
    prompt += `   - Description\n`;
    prompt += `   - Type (research/implementation/testing/documentation)\n`;
    prompt += `   - Priority (critical/high/normal/low)\n`;
    prompt += `   - Estimated duration (minutes)\n`;
    prompt += `   - Required capabilities\n`;
    prompt += `3. Dependencies between subtasks\n`;
    prompt += `4. Potential risks and mitigation strategies\n`;
    prompt += `5. Parallelization opportunities\n`;

    return prompt;
  }

  private async callLLMForAnalysis(prompt: string): Promise<TaskAnalysis> {
    // 这里应该调用实际的LLM
    // 现在使用模拟实现
    const complexity = this.analyzeComplexity(prompt);
    
    // 模拟分解
    const subtasks = await this.decompose(
      prompt,
      complexity.complexity
    );

    const dependencies = this.identifyDependencies(subtasks);
    const optimizedTasks = this.optimizeExecutionOrder(subtasks, dependencies);
    const risks = this.identifyRiskFactors(prompt, subtasks);

    return {
      goal: prompt,
      complexity: complexity.complexity,
      estimatedTotalDuration: this.estimateDuration(optimizedTasks),
      subtasks: optimizedTasks,
      parallelizationOpportunities: this.countParallelGroups(optimizedTasks, dependencies),
      riskFactors: risks,
      recommendations: this.generateRecommendations(complexity.complexity, risks),
    };
  }

  private validateAndOptimize(analysis: TaskAnalysis): TaskAnalysis {
    // 确保每个子任务都有ID
    for (const task of analysis.subtasks) {
      if (!task.id) {
        task.id = uuidv4();
      }
    }

    // 验证依赖关系
    const taskIds = new Set(analysis.subtasks.map(t => t.id));
    for (const task of analysis.subtasks) {
      task.dependencies = task.dependencies.filter(depId => taskIds.has(depId));
    }

    return analysis;
  }

  private selectDecompositionStrategy(
    complexity: 'low' | 'medium' | 'high'
  ): 'simple' | 'functional' | 'layered' | 'modular' {
    switch (complexity) {
      case 'low':
        return 'simple';
      case 'medium':
        return 'functional';
      case 'high':
        return 'modular';
      default:
        return 'functional';
    }
  }

  private simpleDecomposition(goal: string): SubTask[] {
    // 简单任务直接返回单个子任务
    return [{
      id: uuidv4(),
      description: goal,
      type: 'implementation',
      priority: 'normal',
      dependencies: [],
      estimatedDuration: 30,
      requiredCapabilities: ['basic'],
    }];
  }

  private functionalDecomposition(
    goal: string,
    context?: Record<string, unknown>
  ): SubTask[] {
    // 基于功能分解
    const tasks: SubTask[] = [];

    // 分析阶段
    tasks.push({
      id: uuidv4(),
      description: `Analyze requirements for: ${goal}`,
      type: 'research',
      priority: 'high',
      dependencies: [],
      estimatedDuration: 15,
      requiredCapabilities: ['analysis'],
    });

    const analysisId = tasks[0].id;

    // 设计阶段
    tasks.push({
      id: uuidv4(),
      description: `Design solution for: ${goal}`,
      type: 'design',
      priority: 'high',
      dependencies: [analysisId],
      estimatedDuration: 20,
      requiredCapabilities: ['design'],
    });

    const designId = tasks[1].id;

    // 实现阶段
    tasks.push({
      id: uuidv4(),
      description: `Implement: ${goal}`,
      type: 'implementation',
      priority: 'normal',
      dependencies: [designId],
      estimatedDuration: 45,
      requiredCapabilities: ['coding'],
    });

    const implementationId = tasks[2].id;

    // 测试阶段
    tasks.push({
      id: uuidv4(),
      description: `Test implementation of: ${goal}`,
      type: 'testing',
      priority: 'normal',
      dependencies: [implementationId],
      estimatedDuration: 20,
      requiredCapabilities: ['testing'],
    });

    return tasks;
  }

  private layeredDecomposition(
    goal: string,
    context?: Record<string, unknown>
  ): SubTask[] {
    // 分层分解（适用于架构任务）
    const tasks: SubTask[] = [];
    const layers = ['data', 'service', 'api', 'ui'];
    let lastLayerId: UUID | undefined;

    for (const layer of layers) {
      const task: SubTask = {
        id: uuidv4(),
        description: `Implement ${layer} layer for: ${goal}`,
        type: 'implementation',
        priority: layer === 'data' ? 'high' : 'normal',
        dependencies: lastLayerId ? [lastLayerId] : [],
        estimatedDuration: 30,
        requiredCapabilities: ['coding', layer],
      };
      tasks.push(task);
      lastLayerId = task.id;
    }

    return tasks;
  }

  private modularDecomposition(
    goal: string,
    context?: Record<string, unknown>
  ): SubTask[] {
    // 模块化分解（适用于复杂任务）
    const tasks: SubTask[] = [];

    // 先进行模块化分析
    tasks.push({
      id: uuidv4(),
      description: `Identify modules for: ${goal}`,
      type: 'analysis',
      priority: 'critical',
      dependencies: [],
      estimatedDuration: 20,
      requiredCapabilities: ['architecture'],
    });

    const analysisId = tasks[0].id;

    // 核心模块
    tasks.push({
      id: uuidv4(),
      description: `Implement core module for: ${goal}`,
      type: 'implementation',
      priority: 'critical',
      dependencies: [analysisId],
      estimatedDuration: 40,
      requiredCapabilities: ['coding', 'architecture'],
    });

    const coreId = tasks[1].id;

    // 辅助模块（可以并行）
    const auxiliaryModules = ['utils', 'helpers', 'adapters'];
    for (const mod of auxiliaryModules) {
      tasks.push({
        id: uuidv4(),
        description: `Implement ${mod} for: ${goal}`,
        type: 'implementation',
        priority: 'normal',
        dependencies: [coreId],
        estimatedDuration: 25,
        requiredCapabilities: ['coding'],
      });
    }

    return tasks;
  }

  private calculateTaskSimilarity(task1: SubTask, task2: SubTask): number {
    const words1 = new Set(task1.description.toLowerCase().split(/\s+/));
    const words2 = new Set(task2.description.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private hasDependencyKeywords(desc1: string, desc2: string): boolean {
    const keywords = ['after', 'before', 'depends on', 'requires', 'prerequisite'];
    const combined = (desc1 + ' ' + desc2).toLowerCase();
    return keywords.some(kw => combined.includes(kw));
  }

  private countParallelGroups(tasks: SubTask[], dependencies: TaskDependency[]): number {
    let groups = 0;
    const visited = new Set<UUID>();

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        groups++;
        // 标记所有不依赖未访问任务的节点
        this.markParallelGroup(task, tasks, dependencies, visited);
      }
    }

    return groups;
  }

  private markParallelGroup(
    task: SubTask,
    allTasks: SubTask[],
    dependencies: TaskDependency[],
    visited: Set<UUID>
  ): void {
    if (visited.has(task.id)) return;

    visited.add(task.id);

    // 找到可以并行执行的任务
    for (const otherTask of allTasks) {
      if (otherTask.id === task.id || visited.has(otherTask.id)) continue;

      // 检查是否有依赖关系
      const hasDep = dependencies.some(d =>
        (d.taskId === task.id && d.dependsOn.includes(otherTask.id)) ||
        (d.taskId === otherTask.id && d.dependsOn.includes(task.id))
      );

      if (!hasDep) {
        this.markParallelGroup(otherTask, allTasks, dependencies, visited);
      }
    }
  }

  private generateRecommendations(
    complexity: 'low' | 'medium' | 'high',
    risks: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (complexity === 'high') {
      recommendations.push('Consider breaking down into smaller milestones');
      recommendations.push('Implement comprehensive logging and monitoring');
    }

    if (risks.includes('Working with legacy code')) {
      recommendations.push('Add comprehensive tests before refactoring');
    }

    if (risks.includes('External dependency')) {
      recommendations.push('Implement fallback mechanisms');
    }

    recommendations.push('Regular checkpoint creation for recovery');

    return recommendations;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createPlanningAgent(
  llmConfig: { model: string; apiKey?: string; baseUrl?: string },
  config?: Partial<PlanningAgentConfig>
): PlanningAgent {
  return new PlanningAgent(llmConfig, config);
}

export default PlanningAgent;
