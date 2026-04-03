/**
 * Remove Strategy - Content removal strategies for micro compression
 * 
 * Provides intelligent content removal:
 * - Redundant content removal
 * - Low-priority content removal
 * - Duplicate detection and removal
 * - Pattern-based removal
 * - Selective removal based on relevance
 */

import type { ContextMessage } from '../../types/index.js';
import { countTokens } from '../../utils/tokenCounter.js';

// ============================================================================
// Remove Configuration
// ============================================================================

export interface RemoveConfig {
  removeRedundant: boolean;
  removeDuplicates: boolean;
  removeLowPriority: boolean;
  removePatterns: RegExp[];
  preserveCheckpoints: boolean;
  preserveSystem: boolean;
  minMessageTokens: number;
  similarityThreshold: number;
}

export const DEFAULT_REMOVE_CONFIG: RemoveConfig = {
  removeRedundant: true,
  removeDuplicates: true,
  removeLowPriority: true,
  removePatterns: [
    /^\s*\[?\s*Note\s*:?\s*\]?/i,
    /^\s*\[?\s*Important\s*:?\s*\]?/i,
    /^\s*\[?\s*Tip\s*:?\s*\]?/i,
  ],
  preserveCheckpoints: true,
  preserveSystem: true,
  minMessageTokens: 10,
  similarityThreshold: 0.85,
};

// ============================================================================
// Remove Result
// ============================================================================

export interface RemoveResult {
  messages: ContextMessage[];
  removedCount: number;
  tokensSaved: number;
  removedIds: string[];
  reasons: Map<string, string>;
}

// ============================================================================
// Base Remove Strategy
// ============================================================================

export interface RemoveStrategy {
  name: string;
  process(messages: ContextMessage[]): RemoveResult;
  canProcess(messages: ContextMessage[]): boolean;
  estimateSavings(messages: ContextMessage[]): number;
}

// ============================================================================
// Duplicate Remover
// ============================================================================

export class DuplicateRemover implements RemoveStrategy {
  name = 'duplicate';
  private config: RemoveConfig;

  constructor(config: Partial<RemoveConfig> = {}) {
    this.config = { ...DEFAULT_REMOVE_CONFIG, ...config };
  }

  process(messages: ContextMessage[]): RemoveResult {
    const result: RemoveResult = {
      messages: [],
      removedCount: 0,
      tokensSaved: 0,
      removedIds: [],
      reasons: new Map(),
    };

    const seen = new Map<string, string>(); // content hash -> message id
    const duplicates = new Set<string>();

    for (const message of messages) {
      // Skip protected messages
      if (this.isProtected(message)) {
        result.messages.push(message);
        continue;
      }

      const hash = this.hashContent(message.content);
      
      if (seen.has(hash)) {
        // Check similarity for near-duplicates
        const originalId = seen.get(hash)!;
        const original = messages.find(m => m.id === originalId)!;
        
        if (this.isDuplicate(message, original)) {
          duplicates.add(message.id);
          result.removedIds.push(message.id);
          result.tokensSaved += message.tokenCount || countTokens(message.content);
          result.reasons.set(message.id, 'duplicate content');
          continue;
        }
      }

      seen.set(hash, message.id);
      result.messages.push(message);
    }

    result.removedCount = duplicates.size;
    return result;
  }

  canProcess(messages: ContextMessage[]): boolean {
    const contentHashes = new Set<string>();
    
    for (const message of messages) {
      if (this.isProtected(message)) continue;
      
      const hash = this.hashContent(message.content);
      if (contentHashes.has(hash)) {
        return true;
      }
      contentHashes.add(hash);
    }

    return false;
  }

  estimateSavings(messages: ContextMessage[]): number {
    const seen = new Set<string>();
    let savings = 0;

    for (const message of messages) {
      if (this.isProtected(message)) continue;

      const hash = this.hashContent(message.content);
      if (seen.has(hash)) {
        savings += message.tokenCount || countTokens(message.content);
      } else {
        seen.add(hash);
      }
    }

    return savings;
  }

  private hashContent(content: string): string {
    // Simple hash: normalized content
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200); // First 200 chars for comparison
  }

  private isDuplicate(a: ContextMessage, b: ContextMessage): boolean {
    const similarity = this.calculateSimilarity(a.content, b.content);
    return similarity >= this.config.similarityThreshold;
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(this.tokenize(a));
    const wordsB = new Set(this.tokenize(b));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
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

  private isProtected(message: ContextMessage): boolean {
    if (this.config.preserveSystem && message.role === 'system') {
      return true;
    }
    if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
      return true;
    }
    return false;
  }
}

// ============================================================================
// Redundant Content Remover
// ============================================================================

export class RedundantRemover implements RemoveStrategy {
  name = 'redundant';
  private config: RemoveConfig;
  private redundantPatterns: RegExp[];

  constructor(config: Partial<RemoveConfig> = {}) {
    this.config = { ...DEFAULT_REMOVE_CONFIG, ...config };
    this.redundantPatterns = [
      /\b(thank you|thanks|appreciate it)\b/gi,
      /\b(you're welcome|no problem|anytime)\b/gi,
      /\b(let me know if you need|feel free to ask)\b/gi,
      /\b(does that help|is that clear|make sense)\b/gi,
      /\b(got it|understood|roger that)\b/gi,
    ];
  }

  process(messages: ContextMessage[]): RemoveResult {
    const result: RemoveResult = {
      messages: [],
      removedCount: 0,
      tokensSaved: 0,
      removedIds: [],
      reasons: new Map(),
    };

    for (const message of messages) {
      // Skip protected messages
      if (this.isProtected(message)) {
        result.messages.push(message);
        continue;
      }

      const cleaned = this.removeRedundantPhrases(message.content);
      
      if (cleaned.length < message.content.length * 0.5) {
        // Too much removed, consider removing entire message
        if (countTokens(cleaned) < this.config.minMessageTokens) {
          result.removedIds.push(message.id);
          result.tokensSaved += message.tokenCount || countTokens(message.content);
          result.reasons.set(message.id, 'redundant content');
          result.removedCount++;
          continue;
        }
      }

      if (cleaned !== message.content) {
        result.messages.push({
          ...message,
          content: cleaned,
          tokenCount: countTokens(cleaned),
        });
        result.tokensSaved += (message.tokenCount || countTokens(message.content)) - countTokens(cleaned);
      } else {
        result.messages.push(message);
      }
    }

    return result;
  }

  canProcess(messages: ContextMessage[]): boolean {
    for (const message of messages) {
      if (this.isProtected(message)) continue;
      
      for (const pattern of this.redundantPatterns) {
        if (pattern.test(message.content)) {
          return true;
        }
      }
    }
    return false;
  }

  estimateSavings(messages: ContextMessage[]): number {
    let savings = 0;

    for (const message of messages) {
      if (this.isProtected(message)) continue;

      const cleaned = this.removeRedundantPhrases(message.content);
      if (cleaned.length < message.content.length) {
        savings += (message.tokenCount || countTokens(message.content)) - countTokens(cleaned);
      }
    }

    return savings;
  }

  private removeRedundantPhrases(content: string): string {
    let cleaned = content;

    for (const pattern of this.redundantPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  private isProtected(message: ContextMessage): boolean {
    if (this.config.preserveSystem && message.role === 'system') {
      return true;
    }
    if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
      return true;
    }
    return false;
  }
}

// ============================================================================
// Low Priority Remover
// ============================================================================

export class LowPriorityRemover implements RemoveStrategy {
  name = 'low-priority';
  private config: RemoveConfig;

  constructor(config: Partial<RemoveConfig> = {}) {
    this.config = { ...DEFAULT_REMOVE_CONFIG, ...config };
  }

  process(messages: ContextMessage[]): RemoveResult {
    const result: RemoveResult = {
      messages: [],
      removedCount: 0,
      tokensSaved: 0,
      removedIds: [],
      reasons: new Map(),
    };

    // Score each message by priority
    const scored = messages.map(m => ({
      message: m,
      priority: this.calculatePriority(m),
    }));

    // Sort by priority (highest first)
    scored.sort((a, b) => b.priority - a.priority);

    // Keep messages above threshold
    const threshold = 0.3;

    for (const { message, priority } of scored) {
      if (this.isProtected(message)) {
        result.messages.push(message);
        continue;
      }

      if (priority < threshold) {
        result.removedIds.push(message.id);
        result.tokensSaved += message.tokenCount || countTokens(message.content);
        result.reasons.set(message.id, `low priority (${priority.toFixed(2)})`);
        result.removedCount++;
      } else {
        result.messages.push(message);
      }
    }

    // Restore original order
    const keptIds = new Set(result.messages.map(m => m.id));
    result.messages = messages.filter(m => keptIds.has(m.id));

    return result;
  }

  canProcess(messages: ContextMessage[]): boolean {
    let hasLowPriority = false;

    for (const message of messages) {
      if (this.isProtected(message)) continue;
      
      const priority = this.calculatePriority(message);
      if (priority < 0.3) {
        hasLowPriority = true;
        break;
      }
    }

    return hasLowPriority;
  }

  estimateSavings(messages: ContextMessage[]): number {
    let savings = 0;

    for (const message of messages) {
      if (this.isProtected(message)) continue;

      const priority = this.calculatePriority(message);
      if (priority < 0.3) {
        savings += message.tokenCount || countTokens(message.content);
      }
    }

    return savings;
  }

  private calculatePriority(message: ContextMessage): number {
    let priority = message.metadata?.importance || 0.5;

    // Boost for system messages
    if (message.role === 'system') {
      priority += 0.3;
    }

    // Boost for user messages
    if (message.role === 'user') {
      priority += 0.1;
    }

    // Boost for checkpoints
    if (message.metadata?.isCheckpoint) {
      priority += 0.4;
    }

    // Boost for messages with code
    if (message.metadata?.codeBlocks && message.metadata.codeBlocks.length > 0) {
      priority += 0.2;
    }

    // Boost for messages with file references
    if (message.metadata?.filePaths && message.metadata.filePaths.length > 0) {
      priority += 0.15;
    }

    // Penalty for very short messages
    const tokens = message.tokenCount || countTokens(message.content);
    if (tokens < 20) {
      priority -= 0.2;
    }

    return Math.max(0, Math.min(1, priority));
  }

  private isProtected(message: ContextMessage): boolean {
    if (this.config.preserveSystem && message.role === 'system') {
      return true;
    }
    if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
      return true;
    }
    return false;
  }
}

// ============================================================================
// Pattern-Based Remover
// ============================================================================

export class PatternRemover implements RemoveStrategy {
  name = 'pattern';
  private config: RemoveConfig;

  constructor(config: Partial<RemoveConfig> = {}) {
    this.config = { ...DEFAULT_REMOVE_CONFIG, ...config };
  }

  process(messages: ContextMessage[]): RemoveResult {
    const result: RemoveResult = {
      messages: [],
      removedCount: 0,
      tokensSaved: 0,
      removedIds: [],
      reasons: new Map(),
    };

    for (const message of messages) {
      // Skip protected messages
      if (this.isProtected(message)) {
        result.messages.push(message);
        continue;
      }

      const matches = this.findMatches(message.content);
      
      if (matches.length > 0) {
        // Remove matched content
        let cleaned = message.content;
        for (const match of matches) {
          cleaned = cleaned.replace(match, '');
        }
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        if (cleaned.length === 0 || countTokens(cleaned) < this.config.minMessageTokens) {
          // Remove entire message
          result.removedIds.push(message.id);
          result.tokensSaved += message.tokenCount || countTokens(message.content);
          result.reasons.set(message.id, 'matched removal pattern');
          result.removedCount++;
        } else {
          result.tokensSaved += (message.tokenCount || countTokens(message.content)) - countTokens(cleaned);
          result.messages.push({
            ...message,
            content: cleaned,
            tokenCount: countTokens(cleaned),
          });
        }
      } else {
        result.messages.push(message);
      }
    }

    return result;
  }

  canProcess(messages: ContextMessage[]): boolean {
    for (const message of messages) {
      if (this.isProtected(message)) continue;
      
      if (this.findMatches(message.content).length > 0) {
        return true;
      }
    }
    return false;
  }

  estimateSavings(messages: ContextMessage[]): number {
    let savings = 0;

    for (const message of messages) {
      if (this.isProtected(message)) continue;

      const matches = this.findMatches(message.content);
      if (matches.length > 0) {
        // Rough estimate
        savings += (message.tokenCount || countTokens(message.content)) * 0.2;
      }
    }

    return Math.floor(savings);
  }

  private findMatches(content: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];

    for (const pattern of this.config.removePatterns) {
      const match = content.match(pattern);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  private isProtected(message: ContextMessage): boolean {
    if (this.config.preserveSystem && message.role === 'system') {
      return true;
    }
    if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
      return true;
    }
    return false;
  }
}

// ============================================================================
// Composite Remover (applies multiple strategies)
// ============================================================================

export class CompositeRemover implements RemoveStrategy {
  name = 'composite';
  private config: RemoveConfig;
  private strategies: RemoveStrategy[];

  constructor(config: Partial<RemoveConfig> = {}) {
    this.config = { ...DEFAULT_REMOVE_CONFIG, ...config };
    this.strategies = [
      new DuplicateRemover(this.config),
      new RedundantRemover(this.config),
      new PatternRemover(this.config),
      new LowPriorityRemover(this.config),
    ];
  }

  process(messages: ContextMessage[]): RemoveResult {
    let currentMessages = [...messages];
    const allRemovedIds: string[] = [];
    const allReasons = new Map<string, string>();
    let totalTokensSaved = 0;

    for (const strategy of this.strategies) {
      const result = strategy.process(currentMessages);
      currentMessages = result.messages;
      allRemovedIds.push(...result.removedIds);
      
      for (const [id, reason] of result.reasons) {
        allReasons.set(id, `${strategy.name}: ${reason}`);
      }
      
      totalTokensSaved += result.tokensSaved;
    }

    return {
      messages: currentMessages,
      removedCount: allRemovedIds.length,
      tokensSaved: totalTokensSaved,
      removedIds: allRemovedIds,
      reasons: allReasons,
    };
  }

  canProcess(messages: ContextMessage[]): boolean {
    return this.strategies.some(s => s.canProcess(messages));
  }

  estimateSavings(messages: ContextMessage[]): number {
    return this.strategies.reduce(
      (sum, s) => sum + s.estimateSavings(messages),
      0
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createRemover(
  type: 'duplicate' | 'redundant' | 'low-priority' | 'pattern' | 'composite',
  config?: Partial<RemoveConfig>
): RemoveStrategy {
  switch (type) {
    case 'duplicate':
      return new DuplicateRemover(config);
    case 'redundant':
      return new RedundantRemover(config);
    case 'low-priority':
      return new LowPriorityRemover(config);
    case 'pattern':
      return new PatternRemover(config);
    case 'composite':
    default:
      return new CompositeRemover(config);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function removeDuplicates(messages: ContextMessage[]): RemoveResult {
  const remover = new DuplicateRemover();
  return remover.process(messages);
}

export function removeRedundant(messages: ContextMessage[]): RemoveResult {
  const remover = new RedundantRemover();
  return remover.process(messages);
}

export function removeLowPriority(messages: ContextMessage[]): RemoveResult {
  const remover = new LowPriorityRemover();
  return remover.process(messages);
}

export function cleanupMessages(messages: ContextMessage[]): RemoveResult {
  const remover = new CompositeRemover();
  return remover.process(messages);
}
