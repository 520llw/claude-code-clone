/**
 * Memory Search - Search functionality for memory system
 * 
 * Provides search capabilities:
 * - Full-text search
 * - Tag-based search
 * - Topic filtering
 * - Relevance scoring
 * - Related content finding
 */

import type { MemoryState, MemoryIndexEntry, TopicEntry } from '../types/index.js';

// ============================================================================
// Search Configuration
// ============================================================================

export interface MemorySearchConfig {
  caseSensitive: boolean;
  wholeWord: boolean;
  fuzzyMatch: boolean;
  maxResults: number;
  minScore: number;
}

export const DEFAULT_SEARCH_CONFIG: MemorySearchConfig = {
  caseSensitive: false,
  wholeWord: false,
  fuzzyMatch: true,
  maxResults: 50,
  minScore: 0.1,
};

// ============================================================================
// Search Result
// ============================================================================

export interface MemorySearchResult {
  topic: string;
  entry: TopicEntry;
  score: number;
  matches: Array<{
    field: 'content' | 'summary' | 'tags';
    text: string;
    indices: [number, number][];
  }>;
}

// ============================================================================
// Memory Search
// ============================================================================

export class MemorySearch {
  private config: MemorySearchConfig;

  constructor(config: Partial<MemorySearchConfig> = {}) {
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Main Search
  // --------------------------------------------------------------------------

  search(
    state: MemoryState,
    query: string,
    options?: {
      topics?: string[];
      tags?: string[];
      limit?: number;
    }
  ): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const limit = options?.limit || this.config.maxResults;

    // Search through all topics
    for (const [topicName, topic] of state.topics) {
      // Filter by topic if specified
      if (options?.topics && !options.topics.includes(topicName)) {
        continue;
      }

      // Search entries
      for (const entry of topic.entries) {
        // Filter by tags if specified
        if (options?.tags && !options.tags.some(t => entry.tags.includes(t))) {
          continue;
        }

        const score = this.calculateScore(entry, query);

        if (score >= this.config.minScore) {
          const matches = this.findMatches(entry, query);
          
          results.push({
            topic: topicName,
            entry,
            score,
            matches,
          });
        }
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Tag Search
  // --------------------------------------------------------------------------

  searchByTag(
    state: MemoryState,
    tag: string
  ): Array<{ topic: string; entries: TopicEntry[] }> {
    const results: Array<{ topic: string; entries: TopicEntry[] }> = [];

    for (const [topicName, topic] of state.topics) {
      const matchingEntries = topic.entries.filter(e => 
        e.tags.some(t => this.matchText(t, tag))
      );

      if (matchingEntries.length > 0) {
        results.push({
          topic: topicName,
          entries: matchingEntries,
        });
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Related Content
  // --------------------------------------------------------------------------

  findRelated(
    state: MemoryState,
    topicName: string,
    entryId: string
  ): Array<{ topic: string; entry: TopicEntry; relation: string }> {
    const results: Array<{ topic: string; entry: TopicEntry; relation: string }> = [];

    // Find the source entry
    const topic = state.topics.get(topicName);
    if (!topic) {
      return results;
    }

    const sourceEntry = topic.entries.find(e => e.id === entryId);
    if (!sourceEntry) {
      return results;
    }

    // Find by references
    for (const ref of sourceEntry.references) {
      for (const [tName, t] of state.topics) {
        for (const entry of t.entries) {
          if (entry.id === ref || entry.references.includes(entryId)) {
            results.push({
              topic: tName,
              entry,
              relation: 'reference',
            });
          }
        }
      }
    }

    // Find by tag similarity
    for (const [tName, t] of state.topics) {
      for (const entry of t.entries) {
        if (entry.id === entryId) continue;

        const sharedTags = entry.tags.filter(t => sourceEntry.tags.includes(t));
        if (sharedTags.length > 0) {
          results.push({
            topic: tName,
            entry,
            relation: `shared tags: ${sharedTags.join(', ')}`,
          });
        }
      }
    }

    // Find by content similarity
    for (const [tName, t] of state.topics) {
      for (const entry of t.entries) {
        if (entry.id === entryId) continue;

        const similarity = this.calculateSimilarity(
          sourceEntry.content,
          entry.content
        );

        if (similarity > 0.5) {
          results.push({
            topic: tName,
            entry,
            relation: `content similarity: ${(similarity * 100).toFixed(0)}%`,
          });
        }
      }
    }

    // Remove duplicates and sort by relevance
    const seen = new Set<string>();
    return results.filter(r => {
      const key = `${r.topic}:${r.entry.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // --------------------------------------------------------------------------
  // Advanced Search
  // --------------------------------------------------------------------------

  advancedSearch(
    state: MemoryState,
    criteria: {
      query?: string;
      topics?: string[];
      tags?: string[];
      dateRange?: { start: number; end: number };
      minRelevance?: number;
    }
  ): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];

    for (const [topicName, topic] of state.topics) {
      // Filter by topic
      if (criteria.topics && !criteria.topics.includes(topicName)) {
        continue;
      }

      for (const entry of topic.entries) {
        // Filter by date range
        if (criteria.dateRange) {
          if (entry.timestamp < criteria.dateRange.start ||
              entry.timestamp > criteria.dateRange.end) {
            continue;
          }
        }

        // Filter by tags
        if (criteria.tags && !criteria.tags.some(t => entry.tags.includes(t))) {
          continue;
        }

        // Calculate score
        let score = 0;

        if (criteria.query) {
          score = this.calculateScore(entry, criteria.query);
        } else {
          score = 1; // No query means match all
        }

        // Apply minimum relevance filter
        if (criteria.minRelevance && score < criteria.minRelevance) {
          continue;
        }

        const matches = criteria.query 
          ? this.findMatches(entry, criteria.query)
          : [];

        results.push({
          topic: topicName,
          entry,
          score,
          matches,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.config.maxResults);
  }

  // --------------------------------------------------------------------------
  // Scoring
  // --------------------------------------------------------------------------

  private calculateScore(entry: TopicEntry, query: string): number {
    let score = 0;

    // Content match
    const contentScore = this.scoreText(entry.content, query);
    score += contentScore * 1.0;

    // Summary match
    if (entry.summary) {
      const summaryScore = this.scoreText(entry.summary, query);
      score += summaryScore * 1.5; // Higher weight for summary
    }

    // Tag match
    for (const tag of entry.tags) {
      if (this.matchText(tag, query)) {
        score += 2.0; // Highest weight for tag matches
      }
    }

    return Math.min(1, score);
  }

  private scoreText(text: string, query: string): number {
    if (!this.config.caseSensitive) {
      text = text.toLowerCase();
      query = query.toLowerCase();
    }

    // Exact match
    if (text === query) {
      return 1;
    }

    // Contains match
    if (text.includes(query)) {
      // Score based on position (earlier is better)
      const position = text.indexOf(query);
      const normalizedPosition = position / text.length;
      return 0.7 + (1 - normalizedPosition) * 0.3;
    }

    // Word match
    if (this.config.wholeWord) {
      const words = text.split(/\s+/);
      const queryWords = query.split(/\s+/);
      
      const matches = queryWords.filter(qw => 
        words.some(w => w === qw)
      ).length;

      return matches / queryWords.length * 0.5;
    }

    // Fuzzy match
    if (this.config.fuzzyMatch) {
      return this.fuzzyScore(text, query);
    }

    return 0;
  }

  private fuzzyScore(text: string, query: string): number {
    // Simple fuzzy matching - check if query characters appear in order
    let textIndex = 0;
    let queryIndex = 0;
    let matches = 0;

    while (textIndex < text.length && queryIndex < query.length) {
      if (text[textIndex] === query[queryIndex]) {
        matches++;
        queryIndex++;
      }
      textIndex++;
    }

    return matches / query.length * 0.3;
  }

  // --------------------------------------------------------------------------
  // Matching
  // --------------------------------------------------------------------------

  private matchText(text: string, query: string): boolean {
    if (!this.config.caseSensitive) {
      text = text.toLowerCase();
      query = query.toLowerCase();
    }

    if (this.config.wholeWord) {
      const words = text.split(/\s+/);
      return words.some(w => w === query);
    }

    return text.includes(query);
  }

  private findMatches(
    entry: TopicEntry,
    query: string
  ): Array<{ field: 'content' | 'summary' | 'tags'; text: string; indices: [number, number][] }> {
    const matches: Array<{ field: 'content' | 'summary' | 'tags'; text: string; indices: [number, number][] }> = [];

    // Content matches
    const contentIndices = this.findIndices(entry.content, query);
    if (contentIndices.length > 0) {
      matches.push({
        field: 'content',
        text: this.extractContext(entry.content, contentIndices[0]),
        indices: contentIndices,
      });
    }

    // Summary matches
    if (entry.summary) {
      const summaryIndices = this.findIndices(entry.summary, query);
      if (summaryIndices.length > 0) {
        matches.push({
          field: 'summary',
          text: entry.summary,
          indices: summaryIndices,
        });
      }
    }

    // Tag matches
    for (const tag of entry.tags) {
      if (this.matchText(tag, query)) {
        matches.push({
          field: 'tags',
          text: tag,
          indices: [[0, tag.length]],
        });
      }
    }

    return matches;
  }

  private findIndices(text: string, query: string): [number, number][] {
    const indices: [number, number][] = [];
    
    if (!this.config.caseSensitive) {
      text = text.toLowerCase();
      query = query.toLowerCase();
    }

    let index = text.indexOf(query);
    while (index !== -1) {
      indices.push([index, index + query.length]);
      index = text.indexOf(query, index + 1);
    }

    return indices;
  }

  private extractContext(text: string, indices: [number, number], contextLength: number = 50): string {
    const [start, end] = indices;
    const contextStart = Math.max(0, start - contextLength);
    const contextEnd = Math.min(text.length, end + contextLength);
    
    let result = text.slice(contextStart, contextEnd);
    
    if (contextStart > 0) {
      result = '...' + result;
    }
    if (contextEnd < text.length) {
      result = result + '...';
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Similarity
  // --------------------------------------------------------------------------

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(this.tokenize(a));
    const wordsB = new Set(this.tokenize(b));

    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<MemorySearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MemorySearchConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemorySearch(
  config?: Partial<MemorySearchConfig>
): MemorySearch {
  return new MemorySearch(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function searchMemory(
  state: MemoryState,
  query: string,
  options?: {
    topics?: string[];
    tags?: string[];
    limit?: number;
  }
): MemorySearchResult[] {
  const search = new MemorySearch();
  return search.search(state, query, options);
}

export function findByTag(
  state: MemoryState,
  tag: string
): Array<{ topic: string; entries: TopicEntry[] }> {
  const search = new MemorySearch();
  return search.searchByTag(state, tag);
}

export function findRelatedContent(
  state: MemoryState,
  topicName: string,
  entryId: string
): Array<{ topic: string; entry: TopicEntry; relation: string }> {
  const search = new MemorySearch();
  return search.findRelated(state, topicName, entryId);
}
