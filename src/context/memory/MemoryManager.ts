/**
 * Memory Manager - Persistent memory management for context
 * 
 * Manages long-term memory storage:
 * - MEMORY.md index management
 * - Topic file organization
 * - Memory synchronization
 * - Memory search integration
 * 
 * Features:
 * - Automatic memory updates
 * - Topic-based organization
 * - Memory pruning
 * - Importance scoring
 */

import type {
  MemoryState,
  MemoryIndex,
  TopicFile,
  ContextMessage,
} from '../types/index.js';
import { MemoryIndex as MemoryIndexManager } from './MemoryIndex.js';
import { TopicFileManager } from './TopicFile.js';
import { MemorySearch } from './MemorySearch.js';
import { MemorySync } from './MemorySync.js';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// Memory Manager Configuration
// ============================================================================

export interface MemoryManagerConfig {
  memoryPath: string;
  indexFileName: string;
  autoSync: boolean;
  syncInterval: number;
  maxTopics: number;
  maxEntriesPerTopic: number;
  enablePruning: boolean;
  pruneThreshold: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  memoryPath: './memory',
  indexFileName: 'MEMORY.md',
  autoSync: true,
  syncInterval: 60000, // 1 minute
  maxTopics: 50,
  maxEntriesPerTopic: 100,
  enablePruning: true,
  pruneThreshold: 0.3,
};

// ============================================================================
// Memory Manager Events
// ============================================================================

export interface MemoryManagerEvents {
  'memory:loaded': { index: MemoryIndex };
  'memory:saved': { path: string };
  'topic:created': { topicId: string; name: string };
  'topic:updated': { topicId: string; entryCount: number };
  'topic:pruned': { topicId: string; removedCount: number };
  'sync:complete': { topicsSynced: number };
  'error': { error: Error; operation: string };
}

// ============================================================================
// Memory Manager Class
// ============================================================================

export class MemoryManager extends EventEmitter {
  private config: MemoryManagerConfig;
  private state: MemoryState;
  private indexManager: MemoryIndexManager;
  private topicManager: TopicFileManager;
  private search: MemorySearch;
  private sync: MemorySync;
  private syncTimer: NodeJS.Timeout | null = null;
  private stats: {
    loads: number;
    saves: number;
    topicsCreated: number;
    entriesAdded: number;
    lastSyncTime: number;
  };

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    
    this.state = this.createInitialState();
    this.indexManager = new MemoryIndexManager();
    this.topicManager = new TopicFileManager();
    this.search = new MemorySearch();
    this.sync = new MemorySync();
    
    this.stats = {
      loads: 0,
      saves: 0,
      topicsCreated: 0,
      entriesAdded: 0,
      lastSyncTime: 0,
    };

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private createInitialState(): MemoryState {
    return {
      index: {
        version: 1,
        entries: [],
        topics: [],
        tags: [],
        lastUpdated: Date.now(),
      },
      topics: new Map(),
      lastSync: Date.now(),
      dirty: false,
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDirectory();
      await this.loadMemory();
    } catch (error) {
      this.emit('error', { error: error as Error, operation: 'initialize' });
      // Continue with empty memory
    }
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.memoryPath, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  // --------------------------------------------------------------------------
  // Memory Loading and Saving
  // --------------------------------------------------------------------------

  async loadMemory(): Promise<MemoryIndex> {
    try {
      const indexPath = join(this.config.memoryPath, this.config.indexFileName);
      const content = await fs.readFile(indexPath, 'utf-8');
      
      this.state.index = this.indexManager.parse(content);
      this.stats.loads++;

      // Load topic files
      for (const entry of this.state.index.entries) {
        const topicPath = join(this.config.memoryPath, entry.filePath);
        try {
          const topicContent = await fs.readFile(topicPath, 'utf-8');
          const topic = this.topicManager.parse(topicContent);
          this.state.topics.set(entry.topic, topic);
        } catch {
          // Topic file may not exist
        }
      }

      this.emit('memory:loaded', { index: this.state.index });
      return this.state.index;
    } catch {
      // Memory file doesn't exist yet, start fresh
      return this.state.index;
    }
  }

  async saveMemory(): Promise<void> {
    try {
      // Save index
      const indexPath = join(this.config.memoryPath, this.config.indexFileName);
      const indexContent = this.indexManager.serialize(this.state.index);
      await fs.writeFile(indexPath, indexContent, 'utf-8');

      // Save topic files
      for (const [topicName, topic] of this.state.topics) {
        const topicPath = join(this.config.memoryPath, `${topicName}.md`);
        const topicContent = this.topicManager.serialize(topic);
        await fs.writeFile(topicPath, topicContent, 'utf-8');
      }

      this.state.dirty = false;
      this.state.lastSync = Date.now();
      this.stats.saves++;

      this.emit('memory:saved', { path: this.config.memoryPath });
    } catch (error) {
      this.emit('error', { error: error as Error, operation: 'save' });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Topic Management
  // --------------------------------------------------------------------------

  createTopic(name: string, description?: string): TopicFile {
    const topic = this.topicManager.create(name, description);
    this.state.topics.set(name, topic);
    
    // Update index
    this.indexManager.addTopic(this.state.index, name);
    
    this.state.dirty = true;
    this.stats.topicsCreated++;

    this.emit('topic:created', { topicId: topic.id, name });

    return topic;
  }

  getTopic(name: string): TopicFile | undefined {
    return this.state.topics.get(name);
  }

  updateTopic(name: string, updates: Partial<TopicFile>): boolean {
    const topic = this.state.topics.get(name);
    if (!topic) {
      return false;
    }

    Object.assign(topic, updates);
    topic.metadata.updatedAt = Date.now();
    
    this.state.dirty = true;

    this.emit('topic:updated', { 
      topicId: topic.id, 
      entryCount: topic.entries.length 
    });

    return true;
  }

  deleteTopic(name: string): boolean {
    const deleted = this.state.topics.delete(name);
    
    if (deleted) {
      this.indexManager.removeTopic(this.state.index, name);
      this.state.dirty = true;
    }

    return deleted;
  }

  getAllTopics(): Map<string, TopicFile> {
    return new Map(this.state.topics);
  }

  // --------------------------------------------------------------------------
  // Entry Management
  // --------------------------------------------------------------------------

  addEntry(
    topicName: string,
    content: string,
    options?: {
      summary?: string;
      tags?: string[];
      references?: string[];
    }
  ): boolean {
    let topic = this.state.topics.get(topicName);
    
    if (!topic) {
      topic = this.createTopic(topicName);
    }

    // Check if we need to prune
    if (this.config.enablePruning && 
        topic.entries.length >= this.config.maxEntriesPerTopic) {
      this.pruneTopic(topicName);
    }

    const entry = this.topicManager.addEntry(topic, content, options);
    
    // Update index
    this.indexManager.addEntry(this.state.index, {
      id: entry.id,
      topic: topicName,
      title: options?.summary?.slice(0, 50) || content.slice(0, 50),
      summary: options?.summary || content.slice(0, 200),
      tags: options?.tags || [],
      createdAt: entry.timestamp,
      updatedAt: entry.timestamp,
      tokenCount: 0,
      filePath: `${topicName}.md`,
      relevanceScore: 0.5,
    });

    this.state.dirty = true;
    this.stats.entriesAdded++;

    this.emit('topic:updated', { 
      topicId: topic.id, 
      entryCount: topic.entries.length 
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // Pruning
  // --------------------------------------------------------------------------

  pruneTopic(topicName: string): number {
    const topic = this.state.topics.get(topicName);
    if (!topic) {
      return 0;
    }

    const beforeCount = topic.entries.length;
    this.topicManager.prune(topic, this.config.maxEntriesPerTopic);
    const removedCount = beforeCount - topic.entries.length;

    if (removedCount > 0) {
      this.state.dirty = true;
      this.emit('topic:pruned', { topicId: topic.id, removedCount });
    }

    return removedCount;
  }

  pruneAll(): Map<string, number> {
    const results = new Map<string, number>();

    for (const topicName of this.state.topics.keys()) {
      const removed = this.pruneTopic(topicName);
      if (removed > 0) {
        results.set(topicName, removed);
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  search(query: string, options?: {
    topics?: string[];
    tags?: string[];
    limit?: number;
  }): Array<{ topic: string; entry: any; score: number }> {
    return this.search.search(this.state, query, options);
  }

  searchByTag(tag: string): Array<{ topic: string; entries: any[] }> {
    return this.search.searchByTag(this.state, tag);
  }

  findRelated(topicName: string, entryId: string): Array<{ topic: string; entry: any }> {
    return this.search.findRelated(this.state, topicName, entryId);
  }

  // --------------------------------------------------------------------------
  // Synchronization
  // --------------------------------------------------------------------------

  private startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(async () => {
      if (this.state.dirty) {
        await this.saveMemory();
      }
    }, this.config.syncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async sync(): Promise<void> {
    if (this.state.dirty) {
      await this.saveMemory();
    }

    this.stats.lastSyncTime = Date.now();

    this.emit('sync:complete', { topicsSynced: this.state.topics.size });
  }

  forceSync(): Promise<void> {
    this.state.dirty = true;
    return this.sync();
  }

  // --------------------------------------------------------------------------
  // Import from Messages
  // --------------------------------------------------------------------------

  importFromMessages(
    messages: ContextMessage[],
    options?: {
      topicExtractor?: (message: ContextMessage) => string;
      importanceThreshold?: number;
    }
  ): number {
    let imported = 0;

    for (const message of messages) {
      // Skip low-importance messages
      if ((message.metadata?.importance || 0.5) < (options?.importanceThreshold || 0.5)) {
        continue;
      }

      // Extract topic
      const topic = options?.topicExtractor 
        ? options.topicExtractor(message)
        : this.extractTopicFromMessage(message);

      // Add entry
      this.addEntry(topic, message.content, {
        summary: message.metadata?.tags?.join(', '),
        tags: message.metadata?.tags,
        references: message.metadata?.references,
      });

      imported++;
    }

    return imported;
  }

  private extractTopicFromMessage(message: ContextMessage): string {
    // Check for topic in metadata
    if (message.metadata?.tags && message.metadata.tags.length > 0) {
      return message.metadata.tags[0];
    }

    // Extract from content
    const topicMatch = message.content.match(/^#{1,6}\s+(.+)$/m);
    if (topicMatch) {
      return topicMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
    }

    // Default topic based on role
    return message.role === 'user' ? 'user-queries' : 'assistant-responses';
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    loads: number;
    saves: number;
    topicsCreated: number;
    entriesAdded: number;
    lastSyncTime: number;
    topicCount: number;
    totalEntries: number;
    isDirty: boolean;
  } {
    const totalEntries = Array.from(this.state.topics.values())
      .reduce((sum, t) => sum + t.entries.length, 0);

    return {
      loads: this.stats.loads,
      saves: this.stats.saves,
      topicsCreated: this.stats.topicsCreated,
      entriesAdded: this.stats.entriesAdded,
      lastSyncTime: this.stats.lastSyncTime,
      topicCount: this.state.topics.size,
      totalEntries,
      isDirty: this.state.dirty,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<MemoryManagerConfig>): void {
    const wasAutoSync = this.config.autoSync;
    this.config = { ...this.config, ...config };

    // Handle auto-sync change
    if (wasAutoSync && !this.config.autoSync) {
      this.stopAutoSync();
    } else if (!wasAutoSync && this.config.autoSync) {
      this.startAutoSync();
    }
  }

  getConfig(): MemoryManagerConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async dispose(): Promise<void> {
    this.stopAutoSync();
    
    if (this.state.dirty) {
      await this.saveMemory();
    }

    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemoryManager(
  config?: Partial<MemoryManagerConfig>
): MemoryManager {
  return new MemoryManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function withMemoryManager<T>(
  config: Partial<MemoryManagerConfig>,
  operation: (manager: MemoryManager) => Promise<T>
): Promise<T> {
  const manager = new MemoryManager(config);
  await manager.initialize();
  
  try {
    return await operation(manager);
  } finally {
    await manager.dispose();
  }
}
