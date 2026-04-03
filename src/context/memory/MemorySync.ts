/**
 * Memory Sync - Memory synchronization for context system
 * 
 * Manages synchronization between context and persistent memory:
 * - Automatic sync scheduling
 * - Conflict resolution
 * - Incremental updates
 * - Batch operations
 * 
 * Features:
 * - Configurable sync intervals
 * - Dirty tracking
 * - Merge strategies
 * - Error recovery
 */

import type { MemoryState, MemoryIndex, TopicFile } from '../types/index.js';
import { EventEmitter } from 'events';

// ============================================================================
// Sync Configuration
// ============================================================================

export interface MemorySyncConfig {
  autoSync: boolean;
  syncInterval: number;
  retryAttempts: number;
  retryDelay: number;
  mergeStrategy: 'local-wins' | 'remote-wins' | 'merge';
  batchSize: number;
  enableCompression: boolean;
}

export const DEFAULT_SYNC_CONFIG: MemorySyncConfig = {
  autoSync: true,
  syncInterval: 60000, // 1 minute
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  mergeStrategy: 'merge',
  batchSize: 100,
  enableCompression: true,
};

// ============================================================================
// Sync Status
// ============================================================================

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error' | 'paused';
  lastSyncTime: number;
  nextSyncTime: number;
  pendingChanges: number;
  lastError?: string;
  retryCount: number;
}

// ============================================================================
// Sync Result
// ============================================================================

export interface SyncResult {
  success: boolean;
  timestamp: number;
  changesSynced: number;
  conflictsResolved: number;
  errors: string[];
}

// ============================================================================
// Memory Sync Events
// ============================================================================

export interface MemorySyncEvents {
  'sync:start': {};
  'sync:complete': SyncResult;
  'sync:error': { error: Error; willRetry: boolean };
  'sync:conflict': { topic: string; resolution: string };
  'state:change': { from: SyncStatus['state']; to: SyncStatus['state'] };
}

// ============================================================================
// Memory Sync Class
// ============================================================================

export class MemorySync extends EventEmitter {
  private config: MemorySyncConfig;
  private status: SyncStatus;
  private syncTimer: NodeJS.Timeout | null = null;
  private pendingOperations: Array<() => Promise<void>> = [];
  private stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalChanges: number;
    totalConflicts: number;
  };

  constructor(config: Partial<MemorySyncConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    
    this.status = {
      state: 'idle',
      lastSyncTime: 0,
      nextSyncTime: 0,
      pendingChanges: 0,
      retryCount: 0,
    };

    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalChanges: 0,
      totalConflicts: 0,
    };

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  // --------------------------------------------------------------------------
  // Auto Sync
  // --------------------------------------------------------------------------

  startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(async () => {
      if (this.status.pendingChanges > 0 && this.status.state === 'idle') {
        await this.sync();
      }
    }, this.config.syncInterval);

    this.updateNextSyncTime();
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private updateNextSyncTime(): void {
    this.status.nextSyncTime = Date.now() + this.config.syncInterval;
  }

  // --------------------------------------------------------------------------
  // Main Sync
  // --------------------------------------------------------------------------

  async sync(): Promise<SyncResult> {
    if (this.status.state === 'syncing') {
      return {
        success: false,
        timestamp: Date.now(),
        changesSynced: 0,
        conflictsResolved: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.setStatus('syncing');
    this.emit('sync:start', {});

    const result: SyncResult = {
      success: false,
      timestamp: Date.now(),
      changesSynced: 0,
      conflictsResolved: 0,
      errors: [],
    };

    try {
      // Execute pending operations
      for (const operation of this.pendingOperations) {
        await operation();
        result.changesSynced++;
      }

      this.pendingOperations = [];

      result.success = true;
      this.status.lastSyncTime = Date.now();
      this.status.pendingChanges = 0;
      this.status.retryCount = 0;

      this.stats.totalSyncs++;
      this.stats.successfulSyncs++;
      this.stats.totalChanges += result.changesSynced;

      this.setStatus('idle');
      this.emit('sync:complete', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      this.stats.totalSyncs++;
      this.stats.failedSyncs++;

      // Handle retry
      if (this.status.retryCount < this.config.retryAttempts) {
        this.status.retryCount++;
        this.setStatus('error');
        this.emit('sync:error', { error: error as Error, willRetry: true });

        // Schedule retry
        setTimeout(() => this.sync(), this.config.retryDelay);
      } else {
        this.setStatus('error');
        this.emit('sync:error', { error: error as Error, willRetry: false });
      }
    }

    this.updateNextSyncTime();
    return result;
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  queueOperation(operation: () => Promise<void>): void {
    this.pendingOperations.push(operation);
    this.status.pendingChanges++;
  }

  async syncBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>
  ): Promise<SyncResult> {
    const batches = this.createBatches(items, this.config.batchSize);
    const result: SyncResult = {
      success: true,
      timestamp: Date.now(),
      changesSynced: 0,
      conflictsResolved: 0,
      errors: [],
    };

    for (const batch of batches) {
      try {
        for (const item of batch) {
          await processor(item);
          result.changesSynced++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(errorMessage);
        result.success = false;
      }
    }

    return result;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  // --------------------------------------------------------------------------
  // Conflict Resolution
  // --------------------------------------------------------------------------

  resolveConflict<T>(
    local: T,
    remote: T,
    strategy?: MemorySyncConfig['mergeStrategy']
  ): T {
    const mergeStrategy = strategy || this.config.mergeStrategy;

    switch (mergeStrategy) {
      case 'local-wins':
        return local;
      
      case 'remote-wins':
        return remote;
      
      case 'merge':
      default:
        return this.mergeValues(local, remote);
    }
  }

  private mergeValues<T>(local: T, remote: T): T {
    // Simple merge for objects
    if (typeof local === 'object' && typeof remote === 'object') {
      return { ...remote, ...local } as T;
    }

    // Default to local for primitives
    return local;
  }

  // --------------------------------------------------------------------------
  // Index Sync
  // --------------------------------------------------------------------------

  syncIndex(local: MemoryIndex, remote: MemoryIndex): MemoryIndex {
    const merged: MemoryIndex = {
      version: Math.max(local.version, remote.version),
      entries: [],
      topics: [...new Set([...local.topics, ...remote.topics])],
      tags: [...new Set([...local.tags, ...remote.tags])],
      lastUpdated: Date.now(),
    };

    // Merge entries
    const entryMap = new Map<string, MemoryIndexEntry>();

    for (const entry of local.entries) {
      entryMap.set(entry.id, entry);
    }

    for (const entry of remote.entries) {
      const localEntry = entryMap.get(entry.id);
      
      if (localEntry) {
        // Conflict - resolve
        const resolved = this.resolveConflict(localEntry, entry);
        entryMap.set(entry.id, resolved);
        this.stats.totalConflicts++;
        this.emit('sync:conflict', { 
          topic: entry.topic, 
          resolution: this.config.mergeStrategy 
        });
      } else {
        entryMap.set(entry.id, entry);
      }
    }

    merged.entries = Array.from(entryMap.values());

    return merged;
  }

  // --------------------------------------------------------------------------
  // Topic Sync
  // --------------------------------------------------------------------------

  syncTopic(local: TopicFile, remote: TopicFile): TopicFile {
    const merged: TopicFile = {
      ...local,
      entries: [],
      metadata: {
        ...local.metadata,
        updatedAt: Date.now(),
      },
    };

    // Merge entries by ID
    const entryMap = new Map<string, typeof local.entries[0]>();

    for (const entry of local.entries) {
      entryMap.set(entry.id, entry);
    }

    for (const entry of remote.entries) {
      const localEntry = entryMap.get(entry.id);
      
      if (localEntry) {
        // Use newer entry
        if (entry.timestamp > localEntry.timestamp) {
          entryMap.set(entry.id, entry);
        }
      } else {
        entryMap.set(entry.id, entry);
      }
    }

    merged.entries = Array.from(entryMap.values());

    // Sort by timestamp
    merged.entries.sort((a, b) => b.timestamp - a.timestamp);

    return merged;
  }

  // --------------------------------------------------------------------------
  // Status Management
  // --------------------------------------------------------------------------

  private setStatus(newStatus: SyncStatus['state']): void {
    const oldStatus = this.status.state;
    this.status.state = newStatus;
    
    if (oldStatus !== newStatus) {
      this.emit('state:change', { from: oldStatus, to: newStatus });
    }
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  pause(): void {
    this.setStatus('paused');
    this.stopAutoSync();
  }

  resume(): void {
    this.setStatus('idle');
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalChanges: number;
    totalConflicts: number;
    successRate: number;
  } {
    return {
      ...this.stats,
      successRate: this.stats.totalSyncs > 0
        ? this.stats.successfulSyncs / this.stats.totalSyncs
        : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalChanges: 0,
      totalConflicts: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<MemorySyncConfig>): void {
    const wasAutoSync = this.config.autoSync;
    this.config = { ...this.config, ...config };

    // Handle auto-sync change
    if (wasAutoSync && !this.config.autoSync) {
      this.stopAutoSync();
    } else if (!wasAutoSync && this.config.autoSync) {
      this.startAutoSync();
    }
  }

  getConfig(): MemorySyncConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.stopAutoSync();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemorySync(config?: Partial<MemorySyncConfig>): MemorySync {
  return new MemorySync(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function syncMemory(
  sync: MemorySync,
  operation: () => Promise<void>
): Promise<SyncResult> {
  sync.queueOperation(operation);
  return sync.sync();
}

export function getSyncStatus(sync: MemorySync): SyncStatus {
  return sync.getStatus();
}
