/**
 * Task Graph
 * 
 * 任务依赖图管理。
 * 负责:
 * - 构建任务依赖关系
 * - 计算并行执行组
 * - 检测循环依赖
 * - 拓扑排序
 * 
 * @module TaskGraph
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
  UUID,
  TaskPriority,
} from '../types/index';

// ============================================================================
// Types
// ============================================================================

/**
 * 任务节点
 */
export interface TaskNode {
  id: UUID;
  description: string;
  type: string;
  priority: TaskPriority;
  dependencies: UUID[];
  estimatedDuration: number;
  requiredCapabilities: string[];
  expectedOutput?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 依赖类型
 */
export type DependencyType = 'hard' | 'soft' | 'optional';

/**
 * 依赖边
 */
export interface DependencyEdge {
  from: UUID;
  to: UUID;
  type: DependencyType;
  reason?: string;
}

/**
 * 任务图
 */
export interface Graph {
  nodes: Map<UUID, TaskNode>;
  edges: DependencyEdge[];
  adjacencyList: Map<UUID, UUID[]>; // 从任务到其依赖
}

// ============================================================================
// Task Graph Class
// ============================================================================

export class TaskGraph {
  private graph: Graph;
  private dependencyMap: Map<UUID, UUID[]> = new Map();

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: [],
      adjacencyList: new Map(),
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 构建任务图
   */
  build(tasks: TaskNode[]): TaskNode[] {
    // 清空现有图
    this.graph.nodes.clear();
    this.graph.edges = [];
    this.graph.adjacencyList.clear();
    this.dependencyMap.clear();

    // 添加节点
    for (const task of tasks) {
      this.graph.nodes.set(task.id, task);
      this.graph.adjacencyList.set(task.id, [...task.dependencies]);
      this.dependencyMap.set(task.id, [...task.dependencies]);
    }

    // 构建边
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (this.graph.nodes.has(depId)) {
          this.graph.edges.push({
            from: task.id,
            to: depId,
            type: 'hard',
          });
        }
      }
    }

    // 检测循环依赖
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    return tasks;
  }

  /**
   * 计算并行执行组
   */
  computeParallelGroups(tasks: TaskNode[]): UUID[][] {
    const levels = this.computeLevels(tasks);
    const groups = new Map<number, UUID[]>();

    for (const [taskId, level] of levels) {
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(taskId);
    }

    // 按层级排序
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, taskIds]) => taskIds);
  }

  /**
   * 检测循环依赖
   */
  detectCycles(): UUID[][] {
    const cycles: UUID[][] = [];
    const visited = new Set<UUID>();
    const recursionStack = new Set<UUID>();

    const dfs = (nodeId: UUID, path: UUID[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependencies = this.graph.adjacencyList.get(nodeId) || [];
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          dfs(depId, path);
        } else if (recursionStack.has(depId)) {
          // 发现循环
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, depId]);
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * 拓扑排序
   */
  topologicalSort(): UUID[] {
    const inDegree = new Map<UUID, number>();
    
    // 计算入度
    for (const nodeId of this.graph.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }
    
    for (const [nodeId, deps] of this.graph.adjacencyList) {
      for (const depId of deps) {
        inDegree.set(nodeId, (inDegree.get(nodeId) || 0) + 1);
      }
    }

    // Kahn算法
    const queue: UUID[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: UUID[] = [];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      // 找到依赖于当前节点的任务
      for (const [taskId, deps] of this.graph.adjacencyList) {
        if (deps.includes(nodeId)) {
          const newDegree = (inDegree.get(taskId) || 0) - 1;
          inDegree.set(taskId, newDegree);
          if (newDegree === 0) {
            queue.push(taskId);
          }
        }
      }
    }

    if (result.length !== this.graph.nodes.size) {
      throw new Error('Graph contains cycles');
    }

    return result;
  }

  /**
   * 获取依赖映射
   */
  getDependencyMap(): Map<UUID, UUID[]> {
    return new Map(this.dependencyMap);
  }

  /**
   * 获取任务的所有依赖（包括间接依赖）
   */
  getAllDependencies(taskId: UUID): UUID[] {
    const allDeps = new Set<UUID>();
    const visited = new Set<UUID>();

    const collect = (id: UUID): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const deps = this.graph.adjacencyList.get(id) || [];
      for (const depId of deps) {
        allDeps.add(depId);
        collect(depId);
      }
    };

    collect(taskId);
    return Array.from(allDeps);
  }

  /**
   * 获取依赖于某个任务的所有任务
   */
  getDependents(taskId: UUID): UUID[] {
    const dependents: UUID[] = [];

    for (const [taskId_, deps] of this.graph.adjacencyList) {
      if (deps.includes(taskId)) {
        dependents.push(taskId_);
      }
    }

    return dependents;
  }

  /**
   * 检查添加依赖是否会形成循环
   */
  wouldCreateCycle(from: UUID, to: UUID): boolean {
    // 检查to是否依赖于from
    const allDeps = this.getAllDependencies(to);
    return allDeps.includes(from) || from === to;
  }

  /**
   * 添加依赖
   */
  addDependency(from: UUID, to: UUID, type: DependencyType = 'hard'): boolean {
    if (this.wouldCreateCycle(from, to)) {
      return false;
    }

    const task = this.graph.nodes.get(from);
    if (!task) return false;

    if (!task.dependencies.includes(to)) {
      task.dependencies.push(to);
      this.graph.adjacencyList.get(from)!.push(to);
      this.graph.edges.push({ from, to, type });
      this.dependencyMap.get(from)!.push(to);
    }

    return true;
  }

  /**
   * 移除依赖
   */
  removeDependency(from: UUID, to: UUID): boolean {
    const task = this.graph.nodes.get(from);
    if (!task) return false;

    const index = task.dependencies.indexOf(to);
    if (index >= 0) {
      task.dependencies.splice(index, 1);
      
      const adjList = this.graph.adjacencyList.get(from);
      if (adjList) {
        const adjIndex = adjList.indexOf(to);
        if (adjIndex >= 0) {
          adjList.splice(adjIndex, 1);
        }
      }

      const depIndex = this.graph.edges.findIndex(
        e => e.from === from && e.to === to
      );
      if (depIndex >= 0) {
        this.graph.edges.splice(depIndex, 1);
      }

      const mapDeps = this.dependencyMap.get(from);
      if (mapDeps) {
        const mapIndex = mapDeps.indexOf(to);
        if (mapIndex >= 0) {
          mapDeps.splice(mapIndex, 1);
        }
      }

      return true;
    }

    return false;
  }

  /**
   * 获取关键路径
   */
  getCriticalPath(): UUID[] {
    // 使用动态规划找到最长路径
    const distances = new Map<UUID, number>();
    const predecessors = new Map<UUID, UUID | null>();

    // 初始化
    for (const nodeId of this.graph.nodes.keys()) {
      distances.set(nodeId, 0);
      predecessors.set(nodeId, null);
    }

    // 拓扑排序
    const sorted = this.topologicalSort();

    // 计算最长路径
    for (const nodeId of sorted) {
      const deps = this.graph.adjacencyList.get(nodeId) || [];
      for (const depId of deps) {
        const node = this.graph.nodes.get(nodeId);
        const duration = node?.estimatedDuration || 0;
        const newDistance = (distances.get(depId) || 0) + duration;
        
        if (newDistance > (distances.get(nodeId) || 0)) {
          distances.set(nodeId, newDistance);
          predecessors.set(nodeId, depId);
        }
      }
    }

    // 找到最长路径的终点
    let maxDistance = 0;
    let endNode: UUID | null = null;
    for (const [nodeId, distance] of distances) {
      if (distance > maxDistance) {
        maxDistance = distance;
        endNode = nodeId;
      }
    }

    // 回溯构建路径
    const path: UUID[] = [];
    let current: UUID | null = endNode;
    while (current !== null) {
      path.unshift(current);
      current = predecessors.get(current) || null;
    }

    return path;
  }

  /**
   * 获取可以并行执行的任务组
   */
  getParallelizableTasks(): UUID[][] {
    const levels = new Map<UUID, number>();
    const sorted = this.topologicalSort();

    // 计算每个任务的层级
    for (const nodeId of sorted) {
      const deps = this.graph.adjacencyList.get(nodeId) || [];
      let maxLevel = 0;
      for (const depId of deps) {
        maxLevel = Math.max(maxLevel, (levels.get(depId) || 0) + 1);
      }
      levels.set(nodeId, maxLevel);
    }

    // 按层级分组
    const groups = new Map<number, UUID[]>();
    for (const [nodeId, level] of levels) {
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(nodeId);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, taskIds]) => taskIds);
  }

  /**
   * 估计总执行时间（考虑并行）
   */
  estimateTotalDuration(): number {
    const groups = this.getParallelizableTasks();
    let totalDuration = 0;

    for (const group of groups) {
      // 每组的执行时间是组内最长的任务
      const maxDuration = Math.max(
        ...group.map(id => this.graph.nodes.get(id)?.estimatedDuration || 0)
      );
      totalDuration += maxDuration;
    }

    return totalDuration;
  }

  /**
   * 序列化图
   */
  serialize(): object {
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: this.graph.edges,
    };
  }

  /**
   * 反序列化图
   */
  deserialize(data: { nodes: TaskNode[]; edges: DependencyEdge[] }): void {
    this.graph.nodes.clear();
    this.graph.edges = [];
    this.graph.adjacencyList.clear();
    this.dependencyMap.clear();

    for (const node of data.nodes) {
      this.graph.nodes.set(node.id, node);
      this.graph.adjacencyList.set(node.id, [...node.dependencies]);
      this.dependencyMap.set(node.id, [...node.dependencies]);
    }

    for (const edge of data.edges) {
      this.graph.edges.push(edge);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private computeLevels(tasks: TaskNode[]): Map<UUID, number> {
    const levels = new Map<UUID, number>();

    // 计算每个任务的层级（最大依赖深度）
    const computeLevel = (taskId: UUID, visited = new Set<UUID>()): number => {
      if (levels.has(taskId)) {
        return levels.get(taskId)!;
      }

      if (visited.has(taskId)) {
        return 0; // 循环依赖，不应该发生
      }

      visited.add(taskId);
      const deps = this.graph.adjacencyList.get(taskId) || [];
      
      if (deps.length === 0) {
        levels.set(taskId, 0);
        return 0;
      }

      const maxDepLevel = Math.max(...deps.map(depId => computeLevel(depId, visited)));
      const level = maxDepLevel + 1;
      levels.set(taskId, level);
      return level;
    };

    for (const task of tasks) {
      computeLevel(task.id);
    }

    return levels;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createTaskGraph(): TaskGraph {
  return new TaskGraph();
}

export default TaskGraph;
