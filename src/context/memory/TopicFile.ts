/**
 * Topic File - Topic file management for memory system
 * 
 * Manages individual topic files:
 * - File parsing and serialization
 * - Entry management
 * - Metadata tracking
 * - Content organization
 * 
 * Each topic is stored in its own markdown file.
 */

import type { TopicFile, TopicEntry, TopicMetadata } from '../types/index.js';
import { countTokens } from '../utils/tokenCounter.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Topic File Configuration
// ============================================================================

export interface TopicFileConfig {
  maxEntries: number;
  enablePruning: boolean;
  pruneStrategy: 'oldest' | 'least-accessed' | 'lowest-importance';
  format: 'markdown' | 'json';
}

export const DEFAULT_TOPIC_CONFIG: TopicFileConfig = {
  maxEntries: 100,
  enablePruning: true,
  pruneStrategy: 'oldest',
  format: 'markdown',
};

// ============================================================================
// Topic File Manager
// ============================================================================

export class TopicFileManager {
  private config: TopicFileConfig;

  constructor(config: Partial<TopicFileConfig> = {}) {
    this.config = { ...DEFAULT_TOPIC_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Creation
  // --------------------------------------------------------------------------

  create(name: string, description?: string): TopicFile {
    const now = Date.now();
    
    return {
      id: uuidv4(),
      name,
      description: description || '',
      content: '',
      entries: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        lastAccessed: now,
        importance: 0.5,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Parsing
  // --------------------------------------------------------------------------

  parse(content: string): TopicFile {
    const topic = this.create('');
    const lines = content.split('\n');
    let currentSection: 'header' | 'entries' | 'content' = 'header';
    let currentEntry: Partial<TopicEntry> | null = null;
    let entryContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse header
      if (trimmed.startsWith('# ')) {
        topic.name = trimmed.slice(2).trim();
        continue;
      }

      if (trimmed.startsWith('**Description:**')) {
        topic.description = trimmed.split(':').slice(1).join(':').trim();
        continue;
      }

      if (trimmed.startsWith('**ID:**')) {
        topic.id = trimmed.split(':')[1].trim();
        continue;
      }

      // Parse metadata
      if (trimmed.startsWith('**Created:**')) {
        const dateStr = trimmed.split(':').slice(1).join(':').trim();
        topic.metadata.createdAt = new Date(dateStr).getTime() || Date.now();
        continue;
      }

      if (trimmed.startsWith('**Updated:**')) {
        const dateStr = trimmed.split(':').slice(1).join(':').trim();
        topic.metadata.updatedAt = new Date(dateStr).getTime() || Date.now();
        continue;
      }

      if (trimmed.startsWith('**Access Count:**')) {
        topic.metadata.accessCount = parseInt(trimmed.split(':')[1].trim(), 10) || 0;
        continue;
      }

      if (trimmed.startsWith('**Importance:**')) {
        topic.metadata.importance = parseFloat(trimmed.split(':')[1].trim()) || 0.5;
        continue;
      }

      // Detect entry start
      if (trimmed.startsWith('## Entry:')) {
        // Save previous entry if exists
        if (currentEntry && entryContent.length > 0) {
          currentEntry.content = entryContent.join('\n').trim();
          topic.entries.push(currentEntry as TopicEntry);
        }

        // Start new entry
        currentSection = 'entries';
        currentEntry = {
          id: trimmed.split(':')[1].trim(),
          timestamp: Date.now(),
          tags: [],
          references: [],
        };
        entryContent = [];
        continue;
      }

      // Parse entry metadata
      if (currentEntry && trimmed.startsWith('**Timestamp:**')) {
        const dateStr = trimmed.split(':').slice(1).join(':').trim();
        currentEntry.timestamp = new Date(dateStr).getTime() || Date.now();
        continue;
      }

      if (currentEntry && trimmed.startsWith('**Tags:**')) {
        const tagsStr = trimmed.split(':').slice(1).join(':').trim();
        currentEntry.tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        continue;
      }

      if (currentEntry && trimmed.startsWith('**References:**')) {
        const refsStr = trimmed.split(':').slice(1).join(':').trim();
        currentEntry.references = refsStr.split(',').map(r => r.trim()).filter(r => r);
        continue;
      }

      if (currentEntry && trimmed.startsWith('**Summary:**')) {
        currentEntry.summary = trimmed.split(':').slice(1).join(':').trim();
        continue;
      }

      // Collect entry content
      if (currentEntry && trimmed.startsWith('**Content:**')) {
        continue; // Skip the content header
      }

      if (currentEntry && currentSection === 'entries') {
        entryContent.push(line);
      }
    }

    // Save last entry
    if (currentEntry && entryContent.length > 0) {
      currentEntry.content = entryContent.join('\n').trim();
      topic.entries.push(currentEntry as TopicEntry);
    }

    return topic;
  }

  // --------------------------------------------------------------------------
  // Serialization
  // --------------------------------------------------------------------------

  serialize(topic: TopicFile): string {
    if (this.config.format === 'json') {
      return JSON.stringify(topic, null, 2);
    }

    const lines: string[] = [];

    // Header
    lines.push(`# ${topic.name}`);
    lines.push('');
    lines.push(`**Description:** ${topic.description}`);
    lines.push(`**ID:** ${topic.id}`);
    lines.push('');

    // Metadata
    lines.push('## Metadata');
    lines.push('');
    lines.push(`**Created:** ${new Date(topic.metadata.createdAt).toISOString()}`);
    lines.push(`**Updated:** ${new Date(topic.metadata.updatedAt).toISOString()}`);
    lines.push(`**Access Count:** ${topic.metadata.accessCount}`);
    lines.push(`**Last Accessed:** ${new Date(topic.metadata.lastAccessed).toISOString()}`);
    lines.push(`**Importance:** ${topic.metadata.importance}`);
    lines.push('');

    // Entries
    lines.push(`## Entries (${topic.entries.length})`);
    lines.push('');

    for (const entry of topic.entries) {
      lines.push(`## Entry: ${entry.id}`);
      lines.push('');
      lines.push(`**Timestamp:** ${new Date(entry.timestamp).toISOString()}`);
      lines.push(`**Tags:** ${entry.tags.join(', ')}`);
      lines.push(`**References:** ${entry.references.join(', ')}`);
      lines.push(`**Summary:** ${entry.summary || 'N/A'}`);
      lines.push('');
      lines.push('**Content:**');
      lines.push('');
      lines.push(entry.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  // --------------------------------------------------------------------------
  // Entry Management
  // --------------------------------------------------------------------------

  addEntry(
    topic: TopicFile,
    content: string,
    options?: {
      summary?: string;
      tags?: string[];
      references?: string[];
    }
  ): TopicEntry {
    const entry: TopicEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      content,
      summary: options?.summary || '',
      tags: options?.tags || [],
      references: options?.references || [],
    };

    topic.entries.push(entry);
    topic.metadata.updatedAt = Date.now();

    // Prune if needed
    if (this.config.enablePruning && 
        topic.entries.length > this.config.maxEntries) {
      this.prune(topic);
    }

    return entry;
  }

  removeEntry(topic: TopicFile, entryId: string): boolean {
    const index = topic.entries.findIndex(e => e.id === entryId);
    
    if (index < 0) {
      return false;
    }

    topic.entries.splice(index, 1);
    topic.metadata.updatedAt = Date.now();
    
    return true;
  }

  updateEntry(
    topic: TopicFile,
    entryId: string,
    updates: Partial<TopicEntry>
  ): boolean {
    const entry = topic.entries.find(e => e.id === entryId);
    
    if (!entry) {
      return false;
    }

    Object.assign(entry, updates);
    topic.metadata.updatedAt = Date.now();
    
    return true;
  }

  getEntry(topic: TopicFile, entryId: string): TopicEntry | undefined {
    return topic.entries.find(e => e.id === entryId);
  }

  findEntriesByTag(topic: TopicFile, tag: string): TopicEntry[] {
    return topic.entries.filter(e => e.tags.includes(tag));
  }

  findEntriesByReference(topic: TopicFile, reference: string): TopicEntry[] {
    return topic.entries.filter(e => e.references.includes(reference));
  }

  // --------------------------------------------------------------------------
  // Pruning
  // --------------------------------------------------------------------------

  prune(topic: TopicFile, maxEntries?: number): number {
    const limit = maxEntries || this.config.maxEntries;
    
    if (topic.entries.length <= limit) {
      return 0;
    }

    const toRemove = topic.entries.length - limit;

    switch (this.config.pruneStrategy) {
      case 'least-accessed':
        this.pruneByAccess(topic, toRemove);
        break;
      case 'lowest-importance':
        this.pruneByImportance(topic, toRemove);
        break;
      case 'oldest':
      default:
        this.pruneByAge(topic, toRemove);
        break;
    }

    topic.metadata.updatedAt = Date.now();
    return toRemove;
  }

  private pruneByAge(topic: TopicFile, count: number): void {
    // Sort by timestamp (oldest first)
    topic.entries.sort((a, b) => a.timestamp - b.timestamp);
    topic.entries = topic.entries.slice(count);
  }

  private pruneByAccess(topic: TopicFile, count: number): void {
    // This would require tracking individual entry access
    // For now, fall back to age-based pruning
    this.pruneByAge(topic, count);
  }

  private pruneByImportance(topic: TopicFile, count: number): void {
    // Sort by content length as a proxy for importance
    topic.entries.sort((a, b) => a.content.length - b.content.length);
    topic.entries = topic.entries.slice(count);
  }

  // --------------------------------------------------------------------------
  // Access Tracking
  // --------------------------------------------------------------------------

  recordAccess(topic: TopicFile): void {
    topic.metadata.accessCount++;
    topic.metadata.lastAccessed = Date.now();
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  search(topic: TopicFile, query: string): TopicEntry[] {
    const lowerQuery = query.toLowerCase();
    
    return topic.entries.filter(e => 
      e.content.toLowerCase().includes(lowerQuery) ||
      e.summary.toLowerCase().includes(lowerQuery) ||
      e.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStatistics(topic: TopicFile): {
    entryCount: number;
    totalContentTokens: number;
    averageEntryLength: number;
    tagCount: number;
    uniqueTags: string[];
    oldestEntry: number;
    newestEntry: number;
  } {
    const totalTokens = topic.entries.reduce(
      (sum, e) => sum + countTokens(e.content),
      0
    );
    
    const avgLength = topic.entries.length > 0
      ? topic.entries.reduce((sum, e) => sum + e.content.length, 0) / topic.entries.length
      : 0;

    const allTags = topic.entries.flatMap(e => e.tags);
    const uniqueTags = [...new Set(allTags)];

    const timestamps = topic.entries.map(e => e.timestamp);

    return {
      entryCount: topic.entries.length,
      totalContentTokens: totalTokens,
      averageEntryLength: avgLength,
      tagCount: allTags.length,
      uniqueTags,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Import/Export
  // --------------------------------------------------------------------------

  exportToJSON(topic: TopicFile): string {
    return JSON.stringify(topic, null, 2);
  }

  importFromJSON(json: string): TopicFile | null {
    try {
      return JSON.parse(json) as TopicFile;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<TopicFileConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTopicFileManager(
  config?: Partial<TopicFileConfig>
): TopicFileManager {
  return new TopicFileManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function parseTopicFile(content: string): TopicFile {
  const manager = new TopicFileManager();
  return manager.parse(content);
}

export function serializeTopicFile(topic: TopicFile): string {
  const manager = new TopicFileManager();
  return manager.serialize(topic);
}

export function createTopic(name: string, description?: string): TopicFile {
  const manager = new TopicFileManager();
  return manager.create(name, description);
}
