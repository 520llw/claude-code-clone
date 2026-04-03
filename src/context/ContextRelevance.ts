/**
 * Context Relevance - Relevance scoring for context messages
 * 
 * Provides multi-factor relevance scoring:
 * - Recency: More recent messages are more relevant
 * - Importance: User-marked or system-identified important messages
 * - Semantic: Similarity to current query/conversation
 * - Reference: Messages referenced by other messages
 * - User emphasis: Explicitly highlighted content
 * 
 * Also includes:
 * - Priority queue integration
 * - Dynamic score updates
 * - Query-based scoring
 */

import type {
  ContextMessage,
  RelevanceScore,
  RelevanceFactors,
  RelevanceQuery,
} from './types/index.js';
import { EventEmitter } from 'events';

// ============================================================================
// Relevance Configuration
// ============================================================================

export interface RelevanceConfig {
  factorWeights: RelevanceFactors;
  decayRate: number;
  boostFactors: {
    checkpoint: number;
    userEmphasis: number;
    codeBlock: number;
    fileReference: number;
  };
  minScore: number;
  maxScore: number;
  recencyWindow: number;
}

export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  factorWeights: {
    recency: 0.25,
    importance: 0.25,
    semantic: 0.25,
    reference: 0.15,
    userEmphasis: 0.10,
  },
  decayRate: 0.95,
  boostFactors: {
    checkpoint: 1.5,
    userEmphasis: 1.3,
    codeBlock: 1.2,
    fileReference: 1.15,
  },
  minScore: 0,
  maxScore: 1,
  recencyWindow: 3600000, // 1 hour
};

// ============================================================================
// Relevance Events
// ============================================================================

export interface RelevanceEvents {
  'score-updated': { messageId: string; oldScore: number; newScore: number };
  'scores-recalculated': { count: number };
  'high-relevance-found': { messageId: string; score: number };
}

// ============================================================================
// Context Relevance Scorer
// ============================================================================

export class ContextRelevance extends EventEmitter {
  private config: RelevanceConfig;
  private scores: Map<string, RelevanceScore> = new Map();
  private referenceGraph: Map<string, Set<string>> = new Map();
  private lastRecalculation: number = 0;
  private recalculationInterval: number = 30000; // 30 seconds

  constructor(config: Partial<RelevanceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RELEVANCE_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Score Calculation
  // --------------------------------------------------------------------------

  calculateScore(
    message: ContextMessage,
    query?: RelevanceQuery,
    allMessages: ContextMessage[] = []
  ): RelevanceScore {
    const factors = this.calculateFactors(message, query, allMessages);
    const weightedScore = this.applyWeights(factors);
    const boostedScore = this.applyBoosts(message, weightedScore);
    const finalScore = this.clampScore(boostedScore);

    const score: RelevanceScore = {
      messageId: message.id,
      score: finalScore,
      factors,
      computedAt: Date.now(),
    };

    // Store and emit update
    const oldScore = this.scores.get(message.id)?.score;
    this.scores.set(message.id, score);

    if (oldScore !== undefined && oldScore !== finalScore) {
      this.emit('score-updated', { messageId: message.id, oldScore, newScore: finalScore });
    }

    if (finalScore > 0.9) {
      this.emit('high-relevance-found', { messageId: message.id, score: finalScore });
    }

    return score;
  }

  calculateScores(
    messages: ContextMessage[],
    query?: RelevanceQuery
  ): RelevanceScore[] {
    const scores: RelevanceScore[] = [];

    for (const message of messages) {
      const score = this.calculateScore(message, query, messages);
      scores.push(score);
    }

    this.emit('scores-recalculated', { count: scores.length });
    return scores;
  }

  // --------------------------------------------------------------------------
  // Factor Calculation
  // --------------------------------------------------------------------------

  private calculateFactors(
    message: ContextMessage,
    query?: RelevanceQuery,
    allMessages: ContextMessage[] = []
  ): RelevanceFactors {
    return {
      recency: this.calculateRecency(message),
      importance: this.calculateImportance(message),
      semantic: this.calculateSemantic(message, query),
      reference: this.calculateReference(message, allMessages),
      userEmphasis: this.calculateUserEmphasis(message),
    };
  }

  private calculateRecency(message: ContextMessage): number {
    const now = Date.now();
    const age = now - message.timestamp;
    const window = this.config.recencyWindow;

    if (age < 0) {
      return 1; // Future messages (shouldn't happen)
    }

    if (age > window * 10) {
      return 0.1; // Very old messages
    }

    // Exponential decay
    const decay = Math.pow(this.config.decayRate, age / window);
    return Math.max(0.1, decay);
  }

  private calculateImportance(message: ContextMessage): number {
    let importance = message.metadata?.importance || 0.5;

    // Boost for system messages
    if (message.role === 'system') {
      importance = Math.max(importance, 0.8);
    }

    // Boost for checkpoints
    if (message.metadata?.isCheckpoint) {
      importance *= this.config.boostFactors.checkpoint;
    }

    // Boost for messages with code blocks
    if (message.metadata?.codeBlocks && message.metadata.codeBlocks.length > 0) {
      importance *= this.config.boostFactors.codeBlock;
    }

    // Boost for messages with file references
    if (message.metadata?.filePaths && message.metadata.filePaths.length > 0) {
      importance *= this.config.boostFactors.fileReference;
    }

    return Math.min(1, importance);
  }

  private calculateSemantic(message: ContextMessage, query?: RelevanceQuery): number {
    if (!query) {
      return 0.5; // Neutral when no query
    }

    let score = 0.5;

    // Text-based similarity
    if (query.text) {
      score = this.calculateTextSimilarity(message.content, query.text);
    }

    // Message ID matching
    if (query.messageIds?.includes(message.id)) {
      score = Math.max(score, 0.9);
    }

    // Tag matching
    if (query.tags && message.metadata?.tags) {
      const matchingTags = query.tags.filter(tag => 
        message.metadata!.tags!.includes(tag)
      );
      if (matchingTags.length > 0) {
        score = Math.max(score, 0.7 + (matchingTags.length / query.tags.length) * 0.2);
      }
    }

    // Time range matching
    if (query.timeRange) {
      const inRange = message.timestamp >= query.timeRange.start && 
                      message.timestamp <= query.timeRange.end;
      if (inRange) {
        score = Math.max(score, 0.6);
      }
    }

    return score;
  }

  private calculateReference(message: ContextMessage, allMessages: ContextMessage[]): number {
    // Build reference graph
    this.buildReferenceGraph(allMessages);

    const references = this.referenceGraph.get(message.id);
    if (!references || references.size === 0) {
      return 0.3; // Low score for unreferenced messages
    }

    // Score based on number of references
    const refCount = references.size;
    const maxRefs = 10;
    const score = Math.min(1, 0.3 + (refCount / maxRefs) * 0.7);

    return score;
  }

  private calculateUserEmphasis(message: ContextMessage): number {
    let emphasis = 0.5;

    // Check for explicit emphasis markers
    const emphasisPatterns = [
      /!important/i,
      /!emphasis/i,
      /!remember/i,
      /!note/i,
    ];

    for (const pattern of emphasisPatterns) {
      if (pattern.test(message.content)) {
        emphasis = Math.max(emphasis, 0.8);
        break;
      }
    }

    // Check metadata for user emphasis
    if (message.metadata?.importance && message.metadata.importance > 0.8) {
      emphasis *= this.config.boostFactors.userEmphasis;
    }

    return Math.min(1, emphasis);
  }

  // --------------------------------------------------------------------------
  // Reference Graph
  // --------------------------------------------------------------------------

  private buildReferenceGraph(messages: ContextMessage[]): void {
    this.referenceGraph.clear();

    for (const message of messages) {
      const refs = new Set<string>();

      // Check for explicit references
      if (message.metadata?.references) {
        for (const ref of message.metadata.references) {
          refs.add(ref);
        }
      }

      // Check content for message ID references
      for (const other of messages) {
        if (other.id !== message.id) {
          const idPattern = new RegExp(`\\b${other.id}\\b`);
          if (idPattern.test(message.content)) {
            refs.add(other.id);
          }
        }
      }

      this.referenceGraph.set(message.id, refs);
    }
  }

  getReferencedMessages(messageId: string): string[] {
    const refs = this.referenceGraph.get(messageId);
    return refs ? Array.from(refs) : [];
  }

  getMessagesReferencing(messageId: string): string[] {
    const referencing: string[] = [];
    
    for (const [id, refs] of this.referenceGraph) {
      if (refs.has(messageId)) {
        referencing.push(id);
      }
    }

    return referencing;
  }

  // --------------------------------------------------------------------------
  // Similarity Calculation
  // --------------------------------------------------------------------------

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = this.tokenize(text1);
    const words2 = this.tokenize(text2);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    const intersection = new Set(words1.filter(w => words2.includes(w)));
    const union = new Set([...words1, ...words2]);

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
  // Weight Application
  // --------------------------------------------------------------------------

  private applyWeights(factors: RelevanceFactors): number {
    const weights = this.config.factorWeights;
    
    return (
      factors.recency * weights.recency +
      factors.importance * weights.importance +
      factors.semantic * weights.semantic +
      factors.reference * weights.reference +
      factors.userEmphasis * weights.userEmphasis
    );
  }

  private applyBoosts(message: ContextMessage, score: number): number {
    let boosted = score;

    // Role-based boosts
    if (message.role === 'system') {
      boosted *= 1.2;
    } else if (message.role === 'user') {
      boosted *= 1.1;
    }

    // Compression level penalty
    if (message.compressionLevel) {
      const penalties: Record<string, number> = {
        light: 0.95,
        medium: 0.85,
        heavy: 0.7,
        extreme: 0.5,
      };
      boosted *= penalties[message.compressionLevel] || 1;
    }

    return boosted;
  }

  private clampScore(score: number): number {
    return Math.max(
      this.config.minScore,
      Math.min(this.config.maxScore, score)
    );
  }

  // --------------------------------------------------------------------------
  // Score Management
  // --------------------------------------------------------------------------

  getScore(messageId: string): RelevanceScore | undefined {
    return this.scores.get(messageId);
  }

  getAllScores(): RelevanceScore[] {
    return Array.from(this.scores.values());
  }

  getTopK(k: number): RelevanceScore[] {
    return this.getAllScores()
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  getAboveThreshold(threshold: number): RelevanceScore[] {
    return this.getAllScores()
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  updateScore(messageId: string, newScore: Partial<RelevanceFactors>): boolean {
    const existing = this.scores.get(messageId);
    if (!existing) {
      return false;
    }

    const updatedFactors = { ...existing.factors, ...newScore };
    const newWeightedScore = this.applyWeights(updatedFactors);
    const clampedScore = this.clampScore(newWeightedScore);

    const updated: RelevanceScore = {
      ...existing,
      score: clampedScore,
      factors: updatedFactors,
      computedAt: Date.now(),
    };

    this.scores.set(messageId, updated);
    this.emit('score-updated', { 
      messageId, 
      oldScore: existing.score, 
      newScore: clampedScore 
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  recalculateAllScores(messages: ContextMessage[], query?: RelevanceQuery): void {
    const now = Date.now();
    if (now - this.lastRecalculation < this.recalculationInterval) {
      return;
    }

    this.calculateScores(messages, query);
    this.lastRecalculation = now;
  }

  removeScore(messageId: string): boolean {
    return this.scores.delete(messageId);
  }

  clearScores(): void {
    this.scores.clear();
    this.referenceGraph.clear();
  }

  // --------------------------------------------------------------------------
  // Priority Queue Integration
  // --------------------------------------------------------------------------

  toPriorityQueueItems(): Array<{
    id: string;
    priority: number;
    data: ContextMessage;
  }> {
    const items: Array<{ id: string; priority: number; data: ContextMessage }> = [];

    for (const [messageId, score] of this.scores) {
      items.push({
        id: messageId,
        priority: score.score * 100, // Scale to 0-100
        data: score as unknown as ContextMessage,
      });
    }

    return items.sort((a, b) => b.priority - a.priority);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStatistics(): {
    totalScores: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
    topScorers: string[];
  } {
    const allScores = this.getAllScores();
    
    if (allScores.length === 0) {
      return {
        totalScores: 0,
        averageScore: 0,
        scoreDistribution: {},
        topScorers: [],
      };
    }

    const scores = allScores.map(s => s.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Distribution buckets
    const distribution: Record<string, number> = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0,
    };

    for (const score of scores) {
      if (score < 0.2) distribution['0.0-0.2']++;
      else if (score < 0.4) distribution['0.2-0.4']++;
      else if (score < 0.6) distribution['0.4-0.6']++;
      else if (score < 0.8) distribution['0.6-0.8']++;
      else distribution['0.8-1.0']++;
    }

    const topScorers = this.getTopK(10).map(s => s.messageId);

    return {
      totalScores: allScores.length,
      averageScore,
      scoreDistribution: distribution,
      topScorers,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<RelevanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RelevanceConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.clearScores();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createContextRelevance(
  config?: Partial<RelevanceConfig>
): ContextRelevance {
  return new ContextRelevance(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function scoreMessages(
  messages: ContextMessage[],
  query?: RelevanceQuery,
  config?: Partial<RelevanceConfig>
): RelevanceScore[] {
  const scorer = new ContextRelevance(config);
  return scorer.calculateScores(messages, query);
}

export function getMostRelevant(
  messages: ContextMessage[],
  k: number,
  query?: RelevanceQuery
): ContextMessage[] {
  const scores = scoreMessages(messages, query);
  const topIds = new Set(
    scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.messageId)
  );
  
  return messages.filter(m => topIds.has(m.id));
}
