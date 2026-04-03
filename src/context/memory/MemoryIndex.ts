/**
 * Memory Index - MEMORY.md index management
 * 
 * Manages the MEMORY.md index file:
 * - Index parsing and serialization
 * - Entry management
 * - Topic tracking
 * - Tag management
 * 
 * The MEMORY.md file serves as a table of contents for all memory topics.
 */

import type { MemoryIndex, MemoryIndexEntry } from '../types/index.js';
import { countTokens } from '../utils/tokenCounter.js';

// ============================================================================
// Memory Index Configuration
// ============================================================================

export interface MemoryIndexConfig {
  version: number;
  maxEntries: number;
  enableSorting: boolean;
  sortBy: 'relevance' | 'date' | 'title';
}

export const DEFAULT_MEMORY_INDEX_CONFIG: MemoryIndexConfig = {
  version: 1,
  maxEntries: 1000,
  enableSorting: true,
  sortBy: 'date',
};

// ============================================================================
// Memory Index Manager
// ============================================================================

export class MemoryIndexManager {
  private config: MemoryIndexConfig;

  constructor(config: Partial<MemoryIndexConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_INDEX_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Creation
  // --------------------------------------------------------------------------

  create(): MemoryIndex {
    return {
      version: this.config.version,
      entries: [],
      topics: [],
      tags: [],
      lastUpdated: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Parsing
  // --------------------------------------------------------------------------

  parse(content: string): MemoryIndex {
    const index: MemoryIndex = {
      version: 1,
      entries: [],
      topics: [],
      tags: [],
      lastUpdated: Date.now(),
    };

    const lines = content.split('\n');
    let currentSection: 'header' | 'topics' | 'entries' | 'tags' = 'header';

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse version
      if (trimmed.startsWith('Version:')) {
        index.version = parseInt(trimmed.split(':')[1].trim(), 10) || 1;
        continue;
      }

      // Parse last updated
      if (trimmed.startsWith('Last Updated:')) {
        const dateStr = trimmed.split(':').slice(1).join(':').trim();
        index.lastUpdated = new Date(dateStr).getTime() || Date.now();
        continue;
      }

      // Detect sections
      if (trimmed === '## Topics') {
        currentSection = 'topics';
        continue;
      }
      if (trimmed === '## Entries') {
        currentSection = 'entries';
        continue;
      }
      if (trimmed === '## Tags') {
        currentSection = 'tags';
        continue;
      }

      // Parse content based on section
      if (currentSection === 'topics' && trimmed.startsWith('- ')) {
        const topic = trimmed.slice(2).trim();
        if (topic && !index.topics.includes(topic)) {
          index.topics.push(topic);
        }
      }

      if (currentSection === 'tags' && trimmed.startsWith('- ')) {
        const tag = trimmed.slice(2).trim();
        if (tag && !index.tags.includes(tag)) {
          index.tags.push(tag);
        }
      }

      if (currentSection === 'entries' && trimmed.startsWith('|')) {
        const entry = this.parseEntryLine(trimmed);
        if (entry) {
          index.entries.push(entry);
        }
      }
    }

    return index;
  }

  private parseEntryLine(line: string): MemoryIndexEntry | null {
    const parts = line.split('|').map(p => p.trim()).filter(p => p);
    
    if (parts.length < 6) {
      return null;
    }

    try {
      return {
        id: parts[0],
        topic: parts[1],
        title: parts[2],
        summary: parts[3],
        tags: parts[4].split(',').map(t => t.trim()).filter(t => t),
        createdAt: new Date(parts[5]).getTime(),
        updatedAt: parts[6] ? new Date(parts[6]).getTime() : new Date(parts[5]).getTime(),
        tokenCount: parseInt(parts[7], 10) || 0,
        filePath: parts[8] || `${parts[1]}.md`,
        relevanceScore: parseFloat(parts[9]) || 0.5,
      };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Serialization
  // --------------------------------------------------------------------------

  serialize(index: MemoryIndex): string {
    const lines: string[] = [];

    // Header
    lines.push('# Memory Index');
    lines.push('');
    lines.push(`Version: ${index.version}`);
    lines.push(`Last Updated: ${new Date(index.lastUpdated).toISOString()}`);
    lines.push(`Total Entries: ${index.entries.length}`);
    lines.push(`Total Topics: ${index.topics.length}`);
    lines.push('');

    // Topics section
    lines.push('## Topics');
    lines.push('');
    for (const topic of index.topics.sort()) {
      lines.push(`- ${topic}`);
    }
    lines.push('');

    // Tags section
    lines.push('## Tags');
    lines.push('');
    for (const tag of index.tags.sort()) {
      lines.push(`- ${tag}`);
    }
    lines.push('');

    // Entries section
    lines.push('## Entries');
    lines.push('');
    lines.push('| ID | Topic | Title | Summary | Tags | Created | Updated | Tokens | File | Relevance |');
    lines.push('|------|-------|-------|---------|------|---------|---------|--------|------|-----------|');

    // Sort entries if enabled
    let entries = [...index.entries];
    if (this.config.enableSorting) {
      entries = this.sortEntries(entries);
    }

    for (const entry of entries) {
      lines.push(this.serializeEntry(entry));
    }

    lines.push('');

    return lines.join('\n');
  }

  private serializeEntry(entry: MemoryIndexEntry): string {
    const tags = entry.tags.join(', ');
    const created = new Date(entry.createdAt).toISOString();
    const updated = new Date(entry.updatedAt).toISOString();
    
    return `| ${entry.id} | ${entry.topic} | ${entry.title} | ${entry.summary} | ${tags} | ${created} | ${updated} | ${entry.tokenCount} | ${entry.filePath} | ${entry.relevanceScore.toFixed(2)} |`;
  }

  private sortEntries(entries: MemoryIndexEntry[]): MemoryIndexEntry[] {
    switch (this.config.sortBy) {
      case 'relevance':
        return entries.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'title':
        return entries.sort((a, b) => a.title.localeCompare(b.title));
      case 'date':
      default:
        return entries.sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }

  // --------------------------------------------------------------------------
  // Entry Management
  // --------------------------------------------------------------------------

  addEntry(index: MemoryIndex, entry: MemoryIndexEntry): void {
    // Check for existing entry
    const existingIndex = index.entries.findIndex(e => e.id === entry.id);
    
    if (existingIndex >= 0) {
      // Update existing
      index.entries[existingIndex] = {
        ...entry,
        updatedAt: Date.now(),
      };
    } else {
      // Add new
      index.entries.push(entry);
    }

    // Update topics
    if (!index.topics.includes(entry.topic)) {
      index.topics.push(entry.topic);
    }

    // Update tags
    for (const tag of entry.tags) {
      if (!index.tags.includes(tag)) {
        index.tags.push(tag);
      }
    }

    // Update timestamp
    index.lastUpdated = Date.now();

    // Prune if needed
    if (index.entries.length > this.config.maxEntries) {
      this.pruneEntries(index);
    }
  }

  removeEntry(index: MemoryIndex, entryId: string): boolean {
    const entryIndex = index.entries.findIndex(e => e.id === entryId);
    
    if (entryIndex < 0) {
      return false;
    }

    const entry = index.entries[entryIndex];
    index.entries.splice(entryIndex, 1);

    // Clean up topics if no more entries
    const hasMoreInTopic = index.entries.some(e => e.topic === entry.topic);
    if (!hasMoreInTopic) {
      index.topics = index.topics.filter(t => t !== entry.topic);
    }

    // Clean up tags if no more entries use them
    for (const tag of entry.tags) {
      const hasMoreWithTag = index.entries.some(e => e.tags.includes(tag));
      if (!hasMoreWithTag) {
        index.tags = index.tags.filter(t => t !== tag);
      }
    }

    index.lastUpdated = Date.now();
    return true;
  }

  updateEntry(
    index: MemoryIndex,
    entryId: string,
    updates: Partial<MemoryIndexEntry>
  ): boolean {
    const entry = index.entries.find(e => e.id === entryId);
    
    if (!entry) {
      return false;
    }

    Object.assign(entry, updates);
    entry.updatedAt = Date.now();
    index.lastUpdated = Date.now();

    return true;
  }

  getEntry(index: MemoryIndex, entryId: string): MemoryIndexEntry | undefined {
    return index.entries.find(e => e.id === entryId);
  }

  findEntriesByTopic(index: MemoryIndex, topic: string): MemoryIndexEntry[] {
    return index.entries.filter(e => e.topic === topic);
  }

  findEntriesByTag(index: MemoryIndex, tag: string): MemoryIndexEntry[] {
    return index.entries.filter(e => e.tags.includes(tag));
  }

  // --------------------------------------------------------------------------
  // Topic Management
  // --------------------------------------------------------------------------

  addTopic(index: MemoryIndex, topic: string): void {
    if (!index.topics.includes(topic)) {
      index.topics.push(topic);
      index.lastUpdated = Date.now();
    }
  }

  removeTopic(index: MemoryIndex, topic: string): void {
    index.topics = index.topics.filter(t => t !== topic);
    
    // Remove all entries for this topic
    index.entries = index.entries.filter(e => e.topic !== topic);
    
    index.lastUpdated = Date.now();
  }

  renameTopic(index: MemoryIndex, oldName: string, newName: string): boolean {
    if (!index.topics.includes(oldName)) {
      return false;
    }

    // Update topic name
    index.topics = index.topics.map(t => t === oldName ? newName : t);

    // Update entries
    for (const entry of index.entries) {
      if (entry.topic === oldName) {
        entry.topic = newName;
        entry.filePath = entry.filePath.replace(oldName, newName);
      }
    }

    index.lastUpdated = Date.now();
    return true;
  }

  // --------------------------------------------------------------------------
  // Tag Management
  // --------------------------------------------------------------------------

  addTag(index: MemoryIndex, tag: string): void {
    if (!index.tags.includes(tag)) {
      index.tags.push(tag);
      index.lastUpdated = Date.now();
    }
  }

  removeTag(index: MemoryIndex, tag: string): void {
    index.tags = index.tags.filter(t => t !== tag);
    
    // Remove tag from all entries
    for (const entry of index.entries) {
      entry.tags = entry.tags.filter(t => t !== tag);
    }
    
    index.lastUpdated = Date.now();
  }

  renameTag(index: MemoryIndex, oldName: string, newName: string): void {
    index.tags = index.tags.map(t => t === oldName ? newName : t);

    for (const entry of index.entries) {
      entry.tags = entry.tags.map(t => t === oldName ? newName : t);
    }

    index.lastUpdated = Date.now();
  }

  // --------------------------------------------------------------------------
  // Pruning
  // --------------------------------------------------------------------------

  pruneEntries(index: MemoryIndex, maxEntries?: number): number {
    const limit = maxEntries || this.config.maxEntries;
    
    if (index.entries.length <= limit) {
      return 0;
    }

    // Sort by relevance and date
    const sorted = [...index.entries].sort((a, b) => {
      const scoreA = a.relevanceScore * 0.5 + (a.updatedAt / Date.now()) * 0.5;
      const scoreB = b.relevanceScore * 0.5 + (b.updatedAt / Date.now()) * 0.5;
      return scoreB - scoreA;
    });

    // Keep top entries
    const toKeep = sorted.slice(0, limit);
    const toRemove = sorted.slice(limit);

    index.entries = toKeep;

    // Clean up topics and tags
    this.cleanupTopics(index);
    this.cleanupTags(index);

    index.lastUpdated = Date.now();

    return toRemove.length;
  }

  private cleanupTopics(index: MemoryIndex): void {
    const usedTopics = new Set(index.entries.map(e => e.topic));
    index.topics = index.topics.filter(t => usedTopics.has(t));
  }

  private cleanupTags(index: MemoryIndex): void {
    const usedTags = new Set(index.entries.flatMap(e => e.tags));
    index.tags = index.tags.filter(t => usedTags.has(t));
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStatistics(index: MemoryIndex): {
    totalEntries: number;
    totalTopics: number;
    totalTags: number;
    totalTokens: number;
    averageRelevance: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const totalTokens = index.entries.reduce((sum, e) => sum + e.tokenCount, 0);
    const avgRelevance = index.entries.length > 0
      ? index.entries.reduce((sum, e) => sum + e.relevanceScore, 0) / index.entries.length
      : 0;

    const timestamps = index.entries.map(e => e.createdAt);

    return {
      totalEntries: index.entries.length,
      totalTopics: index.topics.length,
      totalTags: index.tags.length,
      totalTokens,
      averageRelevance: avgRelevance,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<MemoryIndexConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemoryIndexManager(
  config?: Partial<MemoryIndexConfig>
): MemoryIndexManager {
  return new MemoryIndexManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function parseMemoryIndex(content: string): MemoryIndex {
  const manager = new MemoryIndexManager();
  return manager.parse(content);
}

export function serializeMemoryIndex(index: MemoryIndex): string {
  const manager = new MemoryIndexManager();
  return manager.serialize(index);
}
