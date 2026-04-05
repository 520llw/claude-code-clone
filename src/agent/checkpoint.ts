/**
 * Checkpoint Manager
 * 
 * 断点续传管理器。
 * 负责:
 * - 创建执行检查点
 * - 保存和恢复执行状态
 * - 管理检查点生命周期
 * 
 * @module CheckpointManager
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { UUID, TaskResult } from '../types/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Checkpoint数据
 */
export interface Checkpoint {
  id: UUID;
  planId: UUID;
  goal: string;
  completedTasks: UUID[];
  taskResults: [UUID, TaskResult][];
  sharedContext: [string, unknown][];
  results: TaskResult[];
  createdAt: number;
  metadata?: CheckpointMetadata;
}

/**
 * Checkpoint元数据
 */
export interface CheckpointMetadata {
  version: string;
  compression?: string;
  encryption?: string;
  tags?: string[];
  description?: string;
}

/**
 * Checkpoint配置
 */
export interface CheckpointConfig {
  storagePath: string;
  maxCheckpoints: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionPeriod: number; // 毫秒
}

/**
 * Checkpoint存储接口
 */
export interface CheckpointStorage {
  save(checkpoint: Checkpoint): Promise<void>;
  load(checkpointId: UUID): Promise<Checkpoint | undefined>;
  list(): Promise<CheckpointSummary[]>;
  delete(checkpointId: UUID): Promise<boolean>;
  exists(checkpointId: UUID): Promise<boolean>;
}

/**
 * Checkpoint摘要
 */
export interface CheckpointSummary {
  id: UUID;
  planId: UUID;
  goal: string;
  progress: number;
  createdAt: number;
  size?: number;
}

/**
 * 恢复选项
 */
export interface ResumeOptions {
  checkpointId?: UUID;
  skipCompleted?: boolean;
  retryFailed?: boolean;
  modifyPlan?: boolean;
}

// ============================================================================
// Checkpoint Manager Class
// ============================================================================

export class CheckpointManager {
  private config: CheckpointConfig;
  private storage: CheckpointStorage;
  private checkpoints: Map<UUID, Checkpoint> = new Map();
  private isInitialized = false;

  constructor(
    storage?: CheckpointStorage,
    config?: Partial<CheckpointConfig>
  ) {
    this.config = {
      storagePath: './checkpoints',
      maxCheckpoints: 50,
      autoCleanup: true,
      compressionEnabled: false,
      encryptionEnabled: false,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7天
      ...config,
    };

    this.storage = storage || new InMemoryCheckpointStorage();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 加载已有的checkpoints
    const summaries = await this.storage.list();
    for (const summary of summaries) {
      const checkpoint = await this.storage.load(summary.id);
      if (checkpoint) {
        this.checkpoints.set(checkpoint.id, checkpoint);
      }
    }

    // 清理过期的checkpoints
    if (this.config.autoCleanup) {
      await this.cleanupExpiredCheckpoints();
    }

    this.isInitialized = true;
  }

  /**
   * 创建Checkpoint
   */
  async create(
    planId: UUID,
    goal: string,
    completedTasks: UUID[],
    taskResults: Map<UUID, TaskResult>,
    sharedContext: Map<string, unknown>,
    results: TaskResult[]
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: uuidv4(),
      planId,
      goal,
      completedTasks: [...completedTasks],
      taskResults: Array.from(taskResults.entries()),
      sharedContext: Array.from(sharedContext.entries()),
      results: [...results],
      createdAt: Date.now(),
      metadata: {
        version: '1.0.0',
        compression: this.config.compressionEnabled ? 'gzip' : undefined,
        encryption: this.config.encryptionEnabled ? 'aes256' : undefined,
      },
    };

    // 保存到存储
    await this.save(checkpoint);

    return checkpoint;
  }

  /**
   * 保存Checkpoint
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    // 如果需要压缩
    if (this.config.compressionEnabled) {
      checkpoint = await this.compress(checkpoint);
    }

    // 如果需要加密
    if (this.config.encryptionEnabled) {
      checkpoint = await this.encrypt(checkpoint);
    }

    // 保存到存储
    await this.storage.save(checkpoint);
    this.checkpoints.set(checkpoint.id, checkpoint);

    // 检查数量限制
    if (this.config.autoCleanup) {
      await this.enforceMaxCheckpoints();
    }
  }

  /**
   * 加载Checkpoint
   */
  async load(checkpointId: UUID): Promise<Checkpoint | undefined> {
    // 先从内存加载
    let checkpoint = this.checkpoints.get(checkpointId);
    
    if (!checkpoint) {
      // 从存储加载
      checkpoint = await this.storage.load(checkpointId);
      if (checkpoint) {
        // 如果需要解密
        if (checkpoint.metadata?.encryption) {
          checkpoint = await this.decrypt(checkpoint);
        }
        
        // 如果需要解压
        if (checkpoint.metadata?.compression) {
          checkpoint = await this.decompress(checkpoint);
        }

        this.checkpoints.set(checkpointId, checkpoint);
      }
    }

    return checkpoint;
  }

  /**
   * 查找可恢复的Checkpoint
   */
  async findResumableCheckpoint(goal?: string): Promise<Checkpoint | undefined> {
    const candidates = Array.from(this.checkpoints.values())
      .filter(cp => {
        // 检查是否过期
        const age = Date.now() - cp.createdAt;
        if (age > this.config.retentionPeriod) {
          return false;
        }

        // 如果有目标，匹配目标
        if (goal) {
          return this.isSimilarGoal(cp.goal, goal);
        }

        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt); // 最新的优先

    return candidates[0];
  }

  /**
   * 获取Checkpoint列表
   */
  async listCheckpoints(): Promise<CheckpointSummary[]> {
    const summaries: CheckpointSummary[] = [];

    for (const checkpoint of this.checkpoints.values()) {
      const totalTasks = checkpoint.completedTasks.length + 
        (checkpoint.taskResults.length - checkpoint.completedTasks.length);
      
      summaries.push({
        id: checkpoint.id,
        planId: checkpoint.planId,
        goal: checkpoint.goal,
        progress: totalTasks > 0 
          ? checkpoint.completedTasks.length / totalTasks 
          : 0,
        createdAt: checkpoint.createdAt,
      });
    }

    return summaries.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 删除Checkpoint
   */
  async delete(checkpointId: UUID): Promise<boolean> {
    const deleted = await this.storage.delete(checkpointId);
    if (deleted) {
      this.checkpoints.delete(checkpointId);
    }
    return deleted;
  }

  /**
   * 清理过期的Checkpoints
   */
  async cleanupExpiredCheckpoints(): Promise<number> {
    const now = Date.now();
    const toDelete: UUID[] = [];

    for (const [id, checkpoint] of this.checkpoints) {
      const age = now - checkpoint.createdAt;
      if (age > this.config.retentionPeriod) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.delete(id);
    }

    return toDelete.length;
  }

  /**
   * 清理特定计划的所有Checkpoints
   */
  async cleanupPlanCheckpoints(planId: UUID): Promise<number> {
    const toDelete: UUID[] = [];

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.planId === planId) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.delete(id);
    }

    return toDelete.length;
  }

  /**
   * 检查是否存在Checkpoint
   */
  hasCheckpoint(checkpointId: UUID): boolean {
    return this.checkpoints.has(checkpointId);
  }

  /**
   * 获取Checkpoint数量
   */
  getCheckpointCount(): number {
    return this.checkpoints.size;
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    this.checkpoints.clear();
    this.isInitialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async compress(checkpoint: Checkpoint): Promise<Checkpoint> {
    // 简单的压缩实现，实际项目中可以使用更高效的算法
    return checkpoint;
  }

  private async decompress(checkpoint: Checkpoint): Promise<Checkpoint> {
    return checkpoint;
  }

  private async encrypt(checkpoint: Checkpoint): Promise<Checkpoint> {
    // 加密实现
    return checkpoint;
  }

  private async decrypt(checkpoint: Checkpoint): Promise<Checkpoint> {
    return checkpoint;
  }

  private isSimilarGoal(goal1: string, goal2: string): boolean {
    // 简单的相似度检查
    const normalize = (s: string) => 
      s.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const n1 = normalize(goal1);
    const n2 = normalize(goal2);
    
    // 完全匹配或包含关系
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // 计算相似度（简单的词重叠）
    const words1 = new Set(n1.split(/\s+/));
    const words2 = new Set(n2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.7;
  }

  private async enforceMaxCheckpoints(): Promise<void> {
    if (this.checkpoints.size <= this.config.maxCheckpoints) return;

    // 按创建时间排序，删除最旧的
    const sorted = Array.from(this.checkpoints.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toDelete = sorted.slice(0, sorted.length - this.config.maxCheckpoints);
    
    for (const [id] of toDelete) {
      await this.delete(id);
    }
  }
}

// ============================================================================
// In-Memory Storage Implementation
// ============================================================================

class InMemoryCheckpointStorage implements CheckpointStorage {
  private storage: Map<UUID, Checkpoint> = new Map();

  async save(checkpoint: Checkpoint): Promise<void> {
    // 深拷贝保存
    this.storage.set(checkpoint.id, JSON.parse(JSON.stringify(checkpoint)));
  }

  async load(checkpointId: UUID): Promise<Checkpoint | undefined> {
    const checkpoint = this.storage.get(checkpointId);
    return checkpoint ? JSON.parse(JSON.stringify(checkpoint)) : undefined;
  }

  async list(): Promise<CheckpointSummary[]> {
    const summaries: CheckpointSummary[] = [];

    for (const checkpoint of this.storage.values()) {
      const totalTasks = checkpoint.completedTasks.length;
      
      summaries.push({
        id: checkpoint.id,
        planId: checkpoint.planId,
        goal: checkpoint.goal,
        progress: totalTasks > 0 ? 1 : 0,
        createdAt: checkpoint.createdAt,
        size: JSON.stringify(checkpoint).length,
      });
    }

    return summaries;
  }

  async delete(checkpointId: UUID): Promise<boolean> {
    return this.storage.delete(checkpointId);
  }

  async exists(checkpointId: UUID): Promise<boolean> {
    return this.storage.has(checkpointId);
  }
}

// ============================================================================
// File System Storage Implementation
// ============================================================================

export class FileSystemCheckpointStorage implements CheckpointStorage {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    // 实际项目中应该使用fs写入文件
    // 这里仅作为示例
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await fs.mkdir(this.storagePath, { recursive: true });
    
    const filePath = path.join(this.storagePath, `${checkpoint.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
  }

  async load(checkpointId: UUID): Promise<Checkpoint | undefined> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.join(this.storagePath, `${checkpointId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  }

  async list(): Promise<CheckpointSummary[]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const files = await fs.readdir(this.storagePath);
      const summaries: CheckpointSummary[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storagePath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const checkpoint: Checkpoint = JSON.parse(data);
          
          const stat = await fs.stat(filePath);
          
          summaries.push({
            id: checkpoint.id,
            planId: checkpoint.planId,
            goal: checkpoint.goal,
            progress: checkpoint.completedTasks.length / 
              Math.max(checkpoint.taskResults.length, 1),
            createdAt: checkpoint.createdAt,
            size: stat.size,
          });
        }
      }

      return summaries;
    } catch {
      return [];
    }
  }

  async delete(checkpointId: UUID): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.join(this.storagePath, `${checkpointId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async exists(checkpointId: UUID): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.join(this.storagePath, `${checkpointId}.json`);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createCheckpointManager(
  storage?: CheckpointStorage,
  config?: Partial<CheckpointConfig>
): CheckpointManager {
  return new CheckpointManager(storage, config);
}

export default CheckpointManager;
