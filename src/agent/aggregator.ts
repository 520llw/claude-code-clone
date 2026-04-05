/**
 * Result Aggregator
 * 
 * 聚合多个Agent的执行结果。
 * 支持多种聚合策略:
 * - Sequential: 顺序合并
 * - Weighted: 加权合并
 * - Voting: 投票决策
 * - Best: 选择最佳结果
 * 
 * @module ResultAggregator
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TaskResult,
  UUID,
} from '../types/index';
import { ExecutionPlan } from './orchestrator';

// ============================================================================
// Types
// ============================================================================

/**
 * 聚合策略
 */
export type AggregationStrategy = 
  | 'sequential' 
  | 'weighted' 
  | 'voting' 
  | 'best' 
  | 'merge' 
  | 'hierarchical';

/**
 * 聚合配置
 */
export interface AggregatorConfig {
  strategy: AggregationStrategy;
  weights?: Map<UUID, number>;
  votingThreshold?: number;
  mergeConflicts?: 'overwrite' | 'append' | 'fail';
  enableDeduplication: boolean;
  enableValidation: boolean;
}

/**
 * 聚合结果
 */
export interface AggregatedResult extends TaskResult {
  aggregated: true;
  componentResults: TaskResult[];
  aggregationStrategy: AggregationStrategy;
  conflicts?: Conflict[];
  metadata: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalExecutionTime: number;
    averageConfidence: number;
  };
}

/**
 * 冲突信息
 */
export interface Conflict {
  type: 'value' | 'structure' | 'logic';
  field: string;
  values: unknown[];
  sources: UUID[];
  resolution?: 'merged' | 'ignored' | 'manual';
}

/**
 * 结果评分
 */
export interface ResultScore {
  resultId: UUID;
  score: number;
  confidence: number;
  factors: {
    completeness: number;
    accuracy: number;
    relevance: number;
    timeliness: number;
  };
}

// ============================================================================
// Result Aggregator Class
// ============================================================================

export class ResultAggregator {
  private config: AggregatorConfig;
  private resultHistory: Map<UUID, TaskResult[]> = new Map();

  constructor(
    strategy: AggregationStrategy = 'sequential',
    config?: Partial<AggregatorConfig>
  ) {
    this.config = {
      strategy,
      weights: new Map(),
      votingThreshold: 0.5,
      mergeConflicts: 'append',
      enableDeduplication: true,
      enableValidation: true,
      ...config,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 聚合多个任务结果
   */
  async aggregate(
    results: TaskResult[],
    plan: ExecutionPlan
  ): Promise<AggregatedResult> {
    if (results.length === 0) {
      return this.createEmptyResult(plan);
    }

    if (results.length === 1) {
      return this.wrapSingleResult(results[0], plan);
    }

    // 根据策略选择聚合方法
    switch (this.config.strategy) {
      case 'sequential':
        return this.aggregateSequential(results, plan);
      case 'weighted':
        return this.aggregateWeighted(results, plan);
      case 'voting':
        return this.aggregateByVoting(results, plan);
      case 'best':
        return this.aggregateBestResult(results, plan);
      case 'merge':
        return this.aggregateByMerging(results, plan);
      case 'hierarchical':
        return this.aggregateHierarchical(results, plan);
      default:
        return this.aggregateSequential(results, plan);
    }
  }

  /**
   * 添加结果到历史
   */
  addToHistory(planId: UUID, result: TaskResult): void {
    if (!this.resultHistory.has(planId)) {
      this.resultHistory.set(planId, []);
    }
    this.resultHistory.get(planId)!.push(result);
  }

  /**
   * 获取历史结果
   */
  getHistory(planId: UUID): TaskResult[] {
    return this.resultHistory.get(planId) || [];
  }

  /**
   * 清除历史
   */
  clearHistory(planId?: UUID): void {
    if (planId) {
      this.resultHistory.delete(planId);
    } else {
      this.resultHistory.clear();
    }
  }

  /**
   * 评估单个结果质量
   */
  evaluateResult(result: TaskResult): ResultScore {
    const factors = {
      completeness: this.calculateCompleteness(result),
      accuracy: this.calculateAccuracy(result),
      relevance: this.calculateRelevance(result),
      timeliness: this.calculateTimeliness(result),
    };

    const score = (
      factors.completeness * 0.3 +
      factors.accuracy * 0.3 +
      factors.relevance * 0.25 +
      factors.timeliness * 0.15
    );

    const confidence = this.calculateConfidence(result);

    return {
      resultId: result.taskId,
      score,
      confidence,
      factors,
    };
  }

  /**
   * 比较两个结果
   */
  compareResults(result1: TaskResult, result2: TaskResult): number {
    const score1 = this.evaluateResult(result1);
    const score2 = this.evaluateResult(result2);

    if (score1.score !== score2.score) {
      return score2.score - score1.score; // 降序
    }

    return score2.confidence - score1.confidence;
  }

  /**
   * 检测冲突
   */
  detectConflicts(results: TaskResult[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // 收集所有字段
    const fieldValues = new Map<string, { value: unknown; source: UUID }[]>();

    for (const result of results) {
      this.extractFields(result, '', fieldValues, result.taskId);
    }

    // 检测冲突
    for (const [field, values] of fieldValues) {
      if (values.length > 1) {
        const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
        if (uniqueValues.size > 1) {
          conflicts.push({
            type: this.classifyConflictType(values.map(v => v.value)),
            field,
            values: values.map(v => v.value),
            sources: values.map(v => v.source),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 解决冲突
   */
  resolveConflicts(
    conflicts: Conflict[],
    strategy: 'majority' | 'priority' | 'merge' | 'manual' = 'majority'
  ): Map<string, unknown> {
    const resolutions = new Map<string, unknown>();

    for (const conflict of conflicts) {
      let resolved: unknown;

      switch (strategy) {
        case 'majority':
          resolved = this.resolveByMajority(conflict);
          break;
        case 'priority':
          resolved = this.resolveByPriority(conflict);
          break;
        case 'merge':
          resolved = this.resolveByMerge(conflict);
          break;
        case 'manual':
          resolved = this.resolveManual(conflict);
          break;
      }

      resolutions.set(conflict.field, resolved);
      conflict.resolution = strategy === 'manual' ? 'manual' : 'merged';
    }

    return resolutions;
  }

  // ============================================================================
  // Private Aggregation Methods
  // ============================================================================

  /**
   * 顺序聚合
   */
  private aggregateSequential(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    // 按任务顺序排序
    const orderedResults = this.orderResultsByExecution(results, plan);

    // 合并输出
    let combinedOutput = '';
    const allArtifacts: TaskResult['artifacts'] = [];
    let totalExecutionTime = 0;
    let hasErrors = false;
    const errorMessages: string[] = [];

    for (const result of orderedResults) {
      if (result.output) {
        combinedOutput += result.output + '\n\n';
      }
      if (result.artifacts) {
        allArtifacts.push(...result.artifacts);
      }
      totalExecutionTime += result.executionTime || 0;
      
      if (!result.success) {
        hasErrors = true;
        if (result.error) {
          errorMessages.push(result.error);
        }
      }
    }

    const successfulCount = orderedResults.filter(r => r.success).length;
    const averageConfidence = this.calculateAverageConfidence(orderedResults);

    return {
      taskId: plan.id,
      success: !hasErrors || successfulCount > orderedResults.length / 2,
      output: combinedOutput.trim(),
      error: hasErrors ? errorMessages.join('\n') : undefined,
      artifacts: this.deduplicateArtifacts(allArtifacts),
      executionTime: totalExecutionTime,
      aggregated: true,
      componentResults: orderedResults,
      aggregationStrategy: 'sequential',
      metadata: {
        totalTasks: orderedResults.length,
        successfulTasks: successfulCount,
        failedTasks: orderedResults.length - successfulCount,
        totalExecutionTime,
        averageConfidence,
      },
    };
  }

  /**
   * 加权聚合
   */
  private aggregateWeighted(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    // 获取权重
    const weights = this.config.weights || new Map();
    
    // 如果没有设置权重，基于结果质量计算
    if (weights.size === 0) {
      for (const result of results) {
        const score = this.evaluateResult(result);
        weights.set(result.taskId, score.score);
      }
    }

    // 归一化权重
    const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
    const normalizedWeights = new Map(
      Array.from(weights.entries()).map(([id, w]) => [id, w / totalWeight])
    );

    // 加权合并
    let weightedOutput = '';
    const allArtifacts: TaskResult['artifacts'] = [];
    let totalExecutionTime = 0;
    let weightedSuccess = 0;

    for (const result of results) {
      const weight = normalizedWeights.get(result.taskId) || 1 / results.length;
      
      if (result.output) {
        weightedOutput += `[Weight: ${(weight * 100).toFixed(1)}%]\n${result.output}\n\n`;
      }
      if (result.artifacts) {
        for (const artifact of result.artifacts) {
          allArtifacts.push({
            ...artifact,
            metadata: {
              ...artifact.metadata,
              weight,
            },
          });
        }
      }
      totalExecutionTime += result.executionTime || 0;
      if (result.success) {
        weightedSuccess += weight;
      }
    }

    const successfulCount = results.filter(r => r.success).length;
    const averageConfidence = this.calculateAverageConfidence(results);

    return {
      taskId: plan.id,
      success: weightedSuccess >= 0.5,
      output: weightedOutput.trim(),
      artifacts: this.deduplicateArtifacts(allArtifacts),
      executionTime: totalExecutionTime,
      aggregated: true,
      componentResults: results,
      aggregationStrategy: 'weighted',
      metadata: {
        totalTasks: results.length,
        successfulTasks: successfulCount,
        failedTasks: results.length - successfulCount,
        totalExecutionTime,
        averageConfidence,
      },
    };
  }

  /**
   * 投票聚合
   */
  private aggregateByVoting(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    const threshold = this.config.votingThreshold || 0.5;
    
    // 统计投票
    const votes = new Map<string, number>();
    for (const result of results) {
      const key = JSON.stringify({
        success: result.success,
        output: result.output?.substring(0, 100),
      });
      votes.set(key, (votes.get(key) || 0) + 1);
    }

    // 找出获胜者
    let winner: string | undefined;
    let maxVotes = 0;
    for (const [key, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = key;
      }
    }

    const voteRatio = winner ? maxVotes / results.length : 0;
    const success = voteRatio >= threshold;

    // 找到获胜结果
    const winnerResult = winner 
      ? results.find(r => 
          JSON.stringify({
            success: r.success,
            output: r.output?.substring(0, 100),
          }) === winner
        )
      : undefined;

    const successfulCount = results.filter(r => r.success).length;
    const averageConfidence = this.calculateAverageConfidence(results);

    return {
      taskId: plan.id,
      success,
      output: winnerResult?.output || 'No consensus reached',
      artifacts: winnerResult?.artifacts || [],
      executionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      aggregated: true,
      componentResults: results,
      aggregationStrategy: 'voting',
      metadata: {
        totalTasks: results.length,
        successfulTasks: successfulCount,
        failedTasks: results.length - successfulCount,
        totalExecutionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
        averageConfidence: voteRatio,
      },
    };
  }

  /**
   * 选择最佳结果
   */
  private aggregateBestResult(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    // 评分并排序
    const scoredResults = results.map(r => ({
      result: r,
      score: this.evaluateResult(r),
    }));

    scoredResults.sort((a, b) => b.score.score - a.score.score);

    const best = scoredResults[0];
    const successfulCount = results.filter(r => r.success).length;

    return {
      taskId: plan.id,
      success: best.result.success,
      output: best.result.output,
      error: best.result.error,
      artifacts: best.result.artifacts,
      executionTime: best.result.executionTime,
      aggregated: true,
      componentResults: results,
      aggregationStrategy: 'best',
      metadata: {
        totalTasks: results.length,
        successfulTasks: successfulCount,
        failedTasks: results.length - successfulCount,
        totalExecutionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
        averageConfidence: best.score.confidence,
      },
    };
  }

  /**
   * 合并聚合
   */
  private aggregateByMerging(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    // 检测并解决冲突
    const conflicts = this.detectConflicts(results);
    const resolutions = this.resolveConflicts(
      conflicts,
      this.config.mergeConflicts === 'fail' ? 'manual' : 'merge'
    );

    // 合并输出
    const mergedOutputs: string[] = [];
    const allArtifacts: TaskResult['artifacts'] = [];

    for (const result of results) {
      if (result.output) {
        mergedOutputs.push(result.output);
      }
      if (result.artifacts) {
        allArtifacts.push(...result.artifacts);
      }
    }

    // 应用冲突解决方案
    let mergedOutput = mergedOutputs.join('\n\n---\n\n');
    for (const [field, value] of resolutions) {
      mergedOutput += `\n\n[Resolved ${field}]: ${JSON.stringify(value)}`;
    }

    const successfulCount = results.filter(r => r.success).length;
    const averageConfidence = this.calculateAverageConfidence(results);

    return {
      taskId: plan.id,
      success: successfulCount > results.length / 2,
      output: mergedOutput.trim(),
      artifacts: this.deduplicateArtifacts(allArtifacts),
      executionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      aggregated: true,
      componentResults: results,
      aggregationStrategy: 'merge',
      conflicts,
      metadata: {
        totalTasks: results.length,
        successfulTasks: successfulCount,
        failedTasks: results.length - successfulCount,
        totalExecutionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
        averageConfidence,
      },
    };
  }

  /**
   * 分层聚合
   */
  private aggregateHierarchical(
    results: TaskResult[],
    plan: ExecutionPlan
  ): AggregatedResult {
    // 按任务类型分组
    const groups = new Map<string, TaskResult[]>();
    
    for (const result of results) {
      const type = result.metadata?.taskType as string || 'default';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(result);
    }

    // 每组内聚合
    const groupResults: AggregatedResult[] = [];
    for (const [type, groupResults_list] of groups) {
      const aggregated = this.aggregateSequential(groupResults_list, plan);
      groupResults.push(aggregated);
    }

    // 最终聚合
    const finalResult = this.aggregateSequential(groupResults, plan);
    
    return {
      ...finalResult,
      aggregationStrategy: 'hierarchical',
      metadata: {
        ...finalResult.metadata,
        groupCount: groups.size,
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private createEmptyResult(plan: ExecutionPlan): AggregatedResult {
    return {
      taskId: plan.id,
      success: false,
      output: 'No results to aggregate',
      executionTime: 0,
      aggregated: true,
      componentResults: [],
      aggregationStrategy: this.config.strategy,
      metadata: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        totalExecutionTime: 0,
        averageConfidence: 0,
      },
    };
  }

  private wrapSingleResult(result: TaskResult, plan: ExecutionPlan): AggregatedResult {
    return {
      ...result,
      aggregated: true,
      componentResults: [result],
      aggregationStrategy: this.config.strategy,
      metadata: {
        totalTasks: 1,
        successfulTasks: result.success ? 1 : 0,
        failedTasks: result.success ? 0 : 1,
        totalExecutionTime: result.executionTime || 0,
        averageConfidence: this.calculateConfidence(result),
      },
    };
  }

  private orderResultsByExecution(
    results: TaskResult[],
    plan: ExecutionPlan
  ): TaskResult[] {
    // 基于计划的执行顺序排序结果
    const taskOrder = new Map<UUID, number>();
    
    let orderIndex = 0;
    for (const group of plan.parallelGroups) {
      for (const taskId of group) {
        taskOrder.set(taskId, orderIndex++);
      }
    }

    return [...results].sort((a, b) => {
      const orderA = taskOrder.get(a.taskId) || Infinity;
      const orderB = taskOrder.get(b.taskId) || Infinity;
      return orderA - orderB;
    });
  }

  private calculateCompleteness(result: TaskResult): number {
    let score = 0;
    if (result.output) score += 0.4;
    if (result.artifacts && result.artifacts.length > 0) score += 0.3;
    if (result.metadata) score += 0.3;
    return score;
  }

  private calculateAccuracy(result: TaskResult): number {
    // 基于成功状态和错误信息评估准确性
    if (!result.success) return 0;
    if (result.error) return 0.5;
    return 1;
  }

  private calculateRelevance(result: TaskResult): number {
    // 基于输出长度和内容评估相关性
    if (!result.output) return 0;
    const length = result.output.length;
    if (length < 10) return 0.3;
    if (length > 10000) return 0.8; // 可能过于冗长
    return 1;
  }

  private calculateTimeliness(result: TaskResult): number {
    const time = result.executionTime || 0;
    if (time < 1000) return 1;
    if (time < 10000) return 0.8;
    if (time < 60000) return 0.6;
    if (time < 300000) return 0.4;
    return 0.2;
  }

  private calculateConfidence(result: TaskResult): number {
    // 基于多个因素计算置信度
    const factors = [
      result.success ? 1 : 0,
      result.output ? 1 : 0,
      result.artifacts && result.artifacts.length > 0 ? 1 : 0,
      !result.error ? 1 : 0,
    ];
    
    return factors.reduce((a, b) => a + b, 0) / factors.length;
  }

  private calculateAverageConfidence(results: TaskResult[]): number {
    if (results.length === 0) return 0;
    const total = results.reduce((sum, r) => sum + this.calculateConfidence(r), 0);
    return total / results.length;
  }

  private deduplicateArtifacts(artifacts: TaskResult['artifacts']): TaskResult['artifacts'] {
    if (!this.config.enableDeduplication) return artifacts;
    
    const seen = new Set<string>();
    return artifacts.filter(artifact => {
      const key = `${artifact.type}-${JSON.stringify(artifact.content).slice(0, 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private extractFields(
    obj: unknown,
    prefix: string,
    fieldValues: Map<string, { value: unknown; source: UUID }[]>,
    sourceId: UUID
  ): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object') {
        this.extractFields(value, fieldPath, fieldValues, sourceId);
      } else {
        if (!fieldValues.has(fieldPath)) {
          fieldValues.set(fieldPath, []);
        }
        fieldValues.get(fieldPath)!.push({ value, source: sourceId });
      }
    }
  }

  private classifyConflictType(values: unknown[]): 'value' | 'structure' | 'logic' {
    const types = new Set(values.map(v => typeof v));
    if (types.size > 1) return 'structure';
    if (Array.isArray(values[0])) return 'structure';
    return 'value';
  }

  private resolveByMajority(conflict: Conflict): unknown {
    // 统计出现次数
    const counts = new Map<string, number>();
    for (const value of conflict.values) {
      const key = JSON.stringify(value);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // 找出最常见的值
    let maxCount = 0;
    let majority: unknown;
    for (const [key, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        majority = JSON.parse(key);
      }
    }

    return majority;
  }

  private resolveByPriority(conflict: Conflict): unknown {
    // 选择第一个值（假设按优先级排序）
    return conflict.values[0];
  }

  private resolveByMerge(conflict: Conflict): unknown {
    // 尝试合并值
    if (conflict.values.every(v => Array.isArray(v))) {
      return [...new Set(conflict.values.flat())];
    }
    
    if (conflict.values.every(v => typeof v === 'string')) {
      return conflict.values.join(' | ');
    }

    return conflict.values[0];
  }

  private resolveManual(conflict: Conflict): unknown {
    // 返回一个标记，表示需要手动解决
    return `[MANUAL_RESOLUTION_NEEDED: ${conflict.field}]`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createResultAggregator(
  strategy: AggregationStrategy = 'sequential',
  config?: Partial<AggregatorConfig>
): ResultAggregator {
  return new ResultAggregator(strategy, config);
}

export default ResultAggregator;
