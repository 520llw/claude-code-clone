/**
 * Embedding Cache - Caching for text embeddings
 * 
 * Provides efficient caching of embeddings:
 * - LRU eviction
 * - TTL expiration
 * - Size limits
 * - Hit/miss tracking
 * 
 * Features:
 * - Memory-efficient storage
 * - Automatic cleanup
 * - Statistics tracking
 */

// ============================================================================
// Cache Configuration
// ============================================================================

export interface EmbeddingCacheConfig {
  maxSize: number;
  ttl: number;
  cleanupInterval: number;
}

export const DEFAULT_CACHE_CONFIG: EmbeddingCacheConfig = {
  maxSize: 1000,
  ttl: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

// ============================================================================
// Cache Statistics
// ============================================================================

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  expirations: number;
  averageEmbeddingSize: number;
  oldestEntry: number;
  newestEntry: number;
}

// ============================================================================
// Embedding Cache
// ============================================================================

export class EmbeddingCache {
  private config: EmbeddingCacheConfig;
  private cache: Map<string, CacheEntry>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };

    this.startCleanup();
  }

  // --------------------------------------------------------------------------
  // Core Operations
  // --------------------------------------------------------------------------

  get(id: string): number[] | undefined {
    const entry = this.cache.get(id);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(id);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.stats.hits++;
    return entry.embedding;
  }

  set(id: string, embedding: number[]): void {
    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize && !this.cache.has(id)) {
      this.evictLRU();
    }

    const now = Date.now();
    
    this.cache.set(id, {
      embedding,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    });
  }

  has(id: string): boolean {
    const entry = this.cache.get(id);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(id);
      return false;
    }

    return true;
  }

  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  getBatch(ids: string[]): Map<string, number[]> {
    const results = new Map<string, number[]>();

    for (const id of ids) {
      const embedding = this.get(id);
      if (embedding) {
        results.set(id, embedding);
      }
    }

    return results;
  }

  setBatch(entries: Map<string, number[]>): void {
    for (const [id, embedding] of entries) {
      this.set(id, embedding);
    }
  }

  // --------------------------------------------------------------------------
  // Eviction
  // --------------------------------------------------------------------------

  private evictLRU(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
      this.stats.evictions++;
    }
  }

  private evictExpired(): number {
    let evicted = 0;
    const now = Date.now();

    for (const [id, entry] of this.cache) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(id);
        this.stats.expirations++;
        evicted++;
      }
    }

    return evicted;
  }

  // --------------------------------------------------------------------------
  // Expiration
  // --------------------------------------------------------------------------

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  private startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.evictExpired();
    }, this.config.cleanupInterval);
  }

  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    const embeddingSizes = entries.map(e => e.embedding.length);
    const avgSize = embeddingSizes.length > 0
      ? embeddingSizes.reduce((a, b) => a + b, 0) / embeddingSizes.length
      : 0;

    const timestamps = entries.map(e => e.timestamp);

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      averageEmbeddingSize: avgSize,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<EmbeddingCacheConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart cleanup with new interval
    this.stopCleanup();
    this.startCleanup();
  }

  getConfig(): EmbeddingCacheConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Memory Management
  // --------------------------------------------------------------------------

  getMemoryUsage(): {
    entryCount: number;
    estimatedBytes: number;
  } {
    let totalBytes = 0;

    for (const entry of this.cache.values()) {
      // Each number is 8 bytes (float64)
      totalBytes += entry.embedding.length * 8;
      // Overhead for entry object
      totalBytes += 64;
    }

    return {
      entryCount: this.cache.size,
      estimatedBytes: totalBytes,
    };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.stopCleanup();
    this.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEmbeddingCache(
  config?: Partial<EmbeddingCacheConfig>
): EmbeddingCache {
  return new EmbeddingCache(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function getCachedEmbedding(
  cache: EmbeddingCache,
  id: string
): number[] | undefined {
  return cache.get(id);
}

export function cacheEmbedding(
  cache: EmbeddingCache,
  id: string,
  embedding: number[]
): void {
  cache.set(id, embedding);
}

export function getCacheStats(cache: EmbeddingCache): CacheStats {
  return cache.getStats();
}
