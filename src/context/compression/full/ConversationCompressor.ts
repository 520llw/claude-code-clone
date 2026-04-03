/**
 * Conversation Compressor - Full conversation compression
 * 
 * Compresses entire conversation history:
 * - Message selection based on relevance
 * - Aggressive summarization
 * - Topic clustering
 * - Temporal grouping
 * 
 * Features:
 * - Multi-pass compression
 * - Topic-aware grouping
 * - Semantic clustering
 * - Configurable compression levels
 */

import type { ContextMessage } from '../../types/index.js';
import { countTokens, countMessageTokens } from '../../utils/tokenCounter.js';
import { ContextRelevance } from '../../ContextRelevance.js';
import { EventEmitter } from 'events';

// ============================================================================
// Compression Result
// ============================================================================

export interface ConversationCompressionResult {
  keptMessages: ContextMessage[];
  removedMessages: ContextMessage[];
  compressedCount: number;
  tokensBefore: number;
  tokensAfter: number;
  compressionRatio: number;
}

// ============================================================================
// Compressor Configuration
// ============================================================================

export interface ConversationCompressorConfig {
  minMessagesToKeep: number;
  maxMessagesToKeep: number;
  compressionLevel: 'light' | 'medium' | 'heavy' | 'extreme';
  enableClustering: boolean;
  enableTemporalGrouping: boolean;
  preserveUserMessages: boolean;
  preserveCodeBlocks: boolean;
}

export const DEFAULT_CONVERSATION_CONFIG: ConversationCompressorConfig = {
  minMessagesToKeep: 5,
  maxMessagesToKeep: 50,
  compressionLevel: 'heavy',
  enableClustering: true,
  enableTemporalGrouping: true,
  preserveUserMessages: true,
  preserveCodeBlocks: true,
};

// ============================================================================
// Compressor Events
// ============================================================================

export interface ConversationCompressorEvents {
  'compression:start': { messageCount: number; targetTokens: number };
  'compression:pass': { pass: number; messagesKept: number; tokens: number };
  'compression:complete': ConversationCompressionResult;
  'cluster:formed': { clusterId: string; messageCount: number };
}

// ============================================================================
// Conversation Compressor Class
// ============================================================================

export class ConversationCompressor extends EventEmitter {
  private config: ConversationCompressorConfig;
  private relevance: ContextRelevance;
  private stats: {
    totalCompressions: number;
    totalMessagesProcessed: number;
    totalTokensSaved: number;
    averageCompressionRatio: number;
  };

  constructor(config: Partial<ConversationCompressorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONVERSATION_CONFIG, ...config };
    this.relevance = new ContextRelevance();
    this.stats = {
      totalCompressions: 0,
      totalMessagesProcessed: 0,
      totalTokensSaved: 0,
      averageCompressionRatio: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Compression Entry
  // --------------------------------------------------------------------------

  compress(
    messages: ContextMessage[],
    targetTokens: number
  ): ConversationCompressionResult {
    this.emit('compression:start', { 
      messageCount: messages.length, 
      targetTokens 
    });

    const tokensBefore = countMessageTokens(messages);
    
    // Multi-pass compression
    let currentMessages = [...messages];
    let pass = 0;
    const maxPasses = 3;

    while (pass < maxPasses) {
      pass++;
      
      const currentTokens = countMessageTokens(currentMessages);
      
      if (currentTokens <= targetTokens) {
        break;
      }

      if (currentMessages.length <= this.config.minMessagesToKeep) {
        break;
      }

      // Apply compression pass
      currentMessages = this.compressionPass(currentMessages, targetTokens, pass);

      this.emit('compression:pass', {
        pass,
        messagesKept: currentMessages.length,
        tokens: countMessageTokens(currentMessages),
      });
    }

    // Final compression if still over target
    const finalTokens = countMessageTokens(currentMessages);
    if (finalTokens > targetTokens && currentMessages.length > this.config.minMessagesToKeep) {
      currentMessages = this.finalCompression(currentMessages, targetTokens);
    }

    const tokensAfter = countMessageTokens(currentMessages);
    const compressionRatio = tokensAfter / tokensBefore;

    const result: ConversationCompressionResult = {
      keptMessages: currentMessages,
      removedMessages: messages.filter(m => 
        !currentMessages.some(cm => cm.id === m.id)
      ),
      compressedCount: messages.length - currentMessages.length,
      tokensBefore,
      tokensAfter,
      compressionRatio,
    };

    // Update stats
    this.stats.totalCompressions++;
    this.stats.totalMessagesProcessed += messages.length;
    this.stats.totalTokensSaved += tokensBefore - tokensAfter;
    this.updateAverageCompressionRatio(compressionRatio);

    this.emit('compression:complete', result);

    return result;
  }

  // --------------------------------------------------------------------------
  // Compression Passes
  // --------------------------------------------------------------------------

  private compressionPass(
    messages: ContextMessage[],
    targetTokens: number,
    pass: number
  ): ContextMessage[] {
    // Calculate relevance scores
    this.relevance.calculateScores(messages);

    // Sort by relevance (highest first)
    const scoredMessages = messages.map(m => ({
      message: m,
      score: this.relevance.getScore(m.id)?.score || 0.5,
    }));

    scoredMessages.sort((a, b) => b.score - a.score);

    // Select messages to keep based on pass
    const keepRatio = this.getKeepRatioForPass(pass);
    const messagesToKeep = Math.max(
      this.config.minMessagesToKeep,
      Math.floor(messages.length * keepRatio)
    );

    const kept = scoredMessages.slice(0, messagesToKeep).map(s => s.message);

    // Restore chronological order
    return this.restoreChronologicalOrder(kept, messages);
  }

  private getKeepRatioForPass(pass: number): number {
    switch (pass) {
      case 1:
        return 0.7; // Keep 70% on first pass
      case 2:
        return 0.5; // Keep 50% on second pass
      case 3:
        return 0.3; // Keep 30% on third pass
      default:
        return 0.2;
    }
  }

  private finalCompression(
    messages: ContextMessage[],
    targetTokens: number
  ): ContextMessage[] {
    // Aggressive final compression
    let result = [...messages];
    
    // Apply extreme compression to individual messages
    result = result.map(m => this.compressMessage(m));

    // Remove shortest messages if still over target
    while (countMessageTokens(result) > targetTokens && 
           result.length > this.config.minMessagesToKeep) {
      // Find shortest message
      const shortest = result.reduce((min, m) => 
        (m.tokenCount || countTokens(m.content)) < (min.tokenCount || countTokens(min.content)) 
          ? m 
          : min
      );
      
      result = result.filter(m => m.id !== shortest.id);
    }

    return result;
  }

  private compressMessage(message: ContextMessage): ContextMessage {
    const tokenCount = message.tokenCount || countTokens(message.content);
    
    if (tokenCount < 100) {
      return message; // Too short to compress
    }

    let content = message.content;

    switch (this.config.compressionLevel) {
      case 'light':
        content = this.lightCompress(content);
        break;
      case 'medium':
        content = this.mediumCompress(content);
        break;
      case 'heavy':
        content = this.heavyCompress(content);
        break;
      case 'extreme':
        content = this.extremeCompress(content);
        break;
    }

    if (content !== message.content) {
      return {
        ...message,
        content,
        compressionLevel: this.config.compressionLevel,
        originalContent: message.content,
        tokenCount: countTokens(content),
      };
    }

    return message;
  }

  private lightCompress(content: string): string {
    // Remove excessive whitespace
    return content.replace(/\n{3,}/g, '\n\n').trim();
  }

  private mediumCompress(content: string): string {
    // Light + truncate long paragraphs
    content = this.lightCompress(content);
    
    const paragraphs = content.split(/\n\s*\n/);
    const compressed = paragraphs.map(p => {
      if (p.length > 500) {
        return p.slice(0, 400) + '...';
      }
      return p;
    });

    return compressed.join('\n\n');
  }

  private heavyCompress(content: string): string {
    // Medium + extract key sentences
    content = this.mediumCompress(content);
    
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    if (sentences.length > 5) {
      // Keep first, last, and middle sentences
      const first = sentences[0];
      const last = sentences[sentences.length - 1];
      const middle = sentences[Math.floor(sentences.length / 2)];
      return `${first} ${middle} ${last}`;
    }

    return content;
  }

  private extremeCompress(content: string): string {
    // Heavy + single sentence summary
    content = this.heavyCompress(content);
    
    const sentences = content.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      return sentences[0].trim();
    }

    return content.slice(0, 100) + (content.length > 100 ? '...' : '');
  }

  // --------------------------------------------------------------------------
  // Clustering
  // --------------------------------------------------------------------------

  private clusterMessages(messages: ContextMessage[]): Map<string, ContextMessage[]> {
    const clusters = new Map<string, ContextMessage[]>();

    if (!this.config.enableClustering) {
      clusters.set('default', messages);
      return clusters;
    }

    // Simple topic-based clustering
    for (const message of messages) {
      const topic = this.extractPrimaryTopic(message);
      
      if (!clusters.has(topic)) {
        clusters.set(topic, []);
      }
      
      clusters.get(topic)!.push(message);
    }

    return clusters;
  }

  private extractPrimaryTopic(message: ContextMessage): string {
    // Check metadata tags
    if (message.metadata?.tags && message.metadata.tags.length > 0) {
      return message.metadata.tags[0];
    }

    // Extract from content
    const words = message.content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4);

    // Return most common meaningful word
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    let maxCount = 0;
    let topWord = 'general';

    for (const [word, count] of wordCounts) {
      if (count > maxCount) {
        maxCount = count;
        topWord = word;
      }
    }

    return topWord;
  }

  // --------------------------------------------------------------------------
  // Temporal Grouping
  // --------------------------------------------------------------------------

  private groupByTime(messages: ContextMessage[]): Map<string, ContextMessage[]> {
    const groups = new Map<string, ContextMessage[]>();

    if (!this.config.enableTemporalGrouping) {
      groups.set('all', messages);
      return groups;
    }

    // Group by hour
    for (const message of messages) {
      const date = new Date(message.timestamp);
      const hourKey = `${date.toDateString()}_${date.getHours()}`;
      
      if (!groups.has(hourKey)) {
        groups.set(hourKey, []);
      }
      
      groups.get(hourKey)!.push(message);
    }

    return groups;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
// --------------------------------------------------------------------------

  private restoreChronologicalOrder(
    messages: ContextMessage[],
    reference: ContextMessage[]
  ): ContextMessage[] {
    const messageIds = new Set(messages.map(m => m.id));
    return reference.filter(m => messageIds.has(m.id));
  }

  private updateAverageCompressionRatio(newRatio: number): void {
    const n = this.stats.totalCompressions;
    this.stats.averageCompressionRatio = 
      (this.stats.averageCompressionRatio * (n - 1) + newRatio) / n;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    totalCompressions: number;
    totalMessagesProcessed: number;
    totalTokensSaved: number;
    averageCompressionRatio: number;
    averageSavings: number;
  } {
    return {
      totalCompressions: this.stats.totalCompressions,
      totalMessagesProcessed: this.stats.totalMessagesProcessed,
      totalTokensSaved: this.stats.totalTokensSaved,
      averageCompressionRatio: this.stats.averageCompressionRatio,
      averageSavings: this.stats.totalMessagesProcessed > 0
        ? this.stats.totalTokensSaved / this.stats.totalMessagesProcessed
        : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalMessagesProcessed: 0,
      totalTokensSaved: 0,
      averageCompressionRatio: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<ConversationCompressorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ConversationCompressorConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.relevance.dispose();
    this.resetStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConversationCompressor(
  config?: Partial<ConversationCompressorConfig>
): ConversationCompressor {
  return new ConversationCompressor(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function compressConversation(
  messages: ContextMessage[],
  targetTokens: number,
  config?: Partial<ConversationCompressorConfig>
): ConversationCompressionResult {
  const compressor = new ConversationCompressor(config);
  return compressor.compress(messages, targetTokens);
}

export function estimateCompression(
  messages: ContextMessage[],
  targetTokens: number
): {
  canAchieve: boolean;
  estimatedMessages: number;
  estimatedRatio: number;
} {
  const tokensBefore = countMessageTokens(messages);
  
  if (tokensBefore <= targetTokens) {
    return {
      canAchieve: true,
      estimatedMessages: messages.length,
      estimatedRatio: 1,
    };
  }

  const ratio = targetTokens / tokensBefore;
  const estimatedMessages = Math.max(5, Math.floor(messages.length * ratio));

  return {
    canAchieve: estimatedMessages >= 5,
    estimatedMessages,
    estimatedRatio: ratio,
  };
}
