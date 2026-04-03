/**
 * Context Compressor - Compression algorithms for context management
 * 
 * Provides multiple compression strategies:
 * - Content truncation
 * - Summary generation
 * - Message removal
 * - Semantic compression
 * - Code block preservation
 * 
 * Also includes:
 * - Compression level management
 * - Content restoration
 * - Compression statistics
 */

import type {
  ContextMessage,
  CompressionLevel,
  CompressionResult,
  CompressionOptions,
  MessageMetadata,
  CodeBlock,
} from './types/index.js';
import { countTokens, countMessageTokens } from './utils/tokenCounter.js';
import { splitContent, ContentChunk } from './utils/contentSplitter.js';
import { EventEmitter } from 'events';

// ============================================================================
// Compression Events
// ============================================================================

export interface CompressionEvents {
  'compression-start': { strategy: string; messagesCount: number };
  'compression-complete': CompressionResult;
  'compression-error': { error: Error; messageId?: string };
  'message-compressed': { messageId: string; level: CompressionLevel };
  'message-removed': { messageId: string; reason: string };
}

// ============================================================================
// Compressor Configuration
// ============================================================================

export interface CompressorConfig {
  maxSummaryLength: number;
  preserveCodeBlocks: boolean;
  preserveCheckpoints: boolean;
  minCompressionRatio: number;
  compressionLevels: Record<CompressionLevel, number>;
  truncationMarker: string;
  summaryPrefix: string;
}

export const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
  maxSummaryLength: 500,
  preserveCodeBlocks: true,
  preserveCheckpoints: true,
  minCompressionRatio: 0.3,
  compressionLevels: {
    none: 1.0,
    light: 0.8,
    medium: 0.5,
    heavy: 0.3,
    extreme: 0.1,
  },
  truncationMarker: '\n...[truncated]',
  summaryPrefix: '[Summary] ',
};

// ============================================================================
// Compression Strategy Interface
// ============================================================================

export interface CompressionStrategy {
  name: string;
  compress(messages: ContextMessage[], options?: CompressionOptions): CompressionResult;
  canCompress(messages: ContextMessage[]): boolean;
  estimateSavings(messages: ContextMessage[]): number;
}

// ============================================================================
// Context Compressor
// ============================================================================

export class ContextCompressor extends EventEmitter {
  private config: CompressorConfig;
  private compressedMessages: Map<string, { original: string; level: CompressionLevel }> = new Map();
  private compressionHistory: CompressionResult[] = [];

  constructor(config: Partial<CompressorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COMPRESSOR_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Main Compression Entry Point
  // --------------------------------------------------------------------------

  compress(
    messages: ContextMessage[],
    options: CompressionOptions
  ): CompressionResult {
    this.emit('compression-start', { 
      strategy: options.strategy, 
      messagesCount: messages.length 
    });

    try {
      let result: CompressionResult;

      switch (options.strategy) {
        case 'micro':
          result = this.microCompress(messages, options);
          break;
        case 'auto':
          result = this.autoCompress(messages, options);
          break;
        case 'full':
          result = this.fullCompress(messages, options);
          break;
        case 'manual':
          result = this.manualCompress(messages, options);
          break;
        default:
          throw new Error(`Unknown compression strategy: ${options.strategy}`);
      }

      this.compressionHistory.push(result);
      this.emit('compression-complete', result);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('compression-error', { error: err });
      
      return {
        success: false,
        strategy: options.strategy,
        messagesRemoved: 0,
        messagesCompressed: 0,
        tokensBefore: countMessageTokens(messages),
        tokensAfter: countMessageTokens(messages),
        errors: [err.message],
      };
    }
  }

  // --------------------------------------------------------------------------
  // Micro Compression - Fast, local edits
  // --------------------------------------------------------------------------

  private microCompress(
    messages: ContextMessage[],
    options: CompressionOptions
  ): CompressionResult {
    const tokensBefore = countMessageTokens(messages);
    let compressedCount = 0;
    const errors: string[] = [];

    // Process only older messages (preserve recent)
    const preserveCount = options.preserveRecent || 5;
    const messagesToCompress = messages.slice(0, -preserveCount);
    const preservedMessages = messages.slice(-preserveCount);

    const compressedMessages: ContextMessage[] = [];

    for (const message of messagesToCompress) {
      // Skip checkpoints if configured
      if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
        compressedMessages.push(message);
        continue;
      }

      try {
        const compressed = this.applyMicroCompression(message);
        if (compressed.compressionLevel !== message.compressionLevel) {
          compressedCount++;
          this.emit('message-compressed', { 
            messageId: message.id, 
            level: compressed.compressionLevel || 'light' 
          });
        }
        compressedMessages.push(compressed);
      } catch (error) {
        errors.push(`Failed to compress message ${message.id}: ${error}`);
        compressedMessages.push(message);
      }
    }

    const resultMessages = [...compressedMessages, ...preservedMessages];
    const tokensAfter = countMessageTokens(resultMessages);

    return {
      success: errors.length === 0,
      strategy: 'micro',
      messagesRemoved: 0,
      messagesCompressed: compressedCount,
      tokensBefore,
      tokensAfter,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private applyMicroCompression(message: ContextMessage): ContextMessage {
    let content = message.content;
    let compressionLevel: CompressionLevel = message.compressionLevel || 'none';

    // Trim excessive whitespace
    const trimmed = content.replace(/\n{3,}/g, '\n\n');
    if (trimmed.length < content.length) {
      content = trimmed;
      compressionLevel = 'light';
    }

    // Compress code blocks if present
    if (this.config.preserveCodeBlocks && message.metadata?.codeBlocks) {
      content = this.compressCodeBlocks(content, message.metadata.codeBlocks);
      compressionLevel = 'medium';
    }

    // Truncate very long messages
    const tokenCount = countTokens(content);
    if (tokenCount > 1000) {
      content = this.truncateContent(content, 800);
      compressionLevel = 'medium';
    }

    // Store original if compressed
    if (compressionLevel !== 'none' && compressionLevel !== message.compressionLevel) {
      this.compressedMessages.set(message.id, {
        original: message.content,
        level: compressionLevel,
      });
    }

    return {
      ...message,
      content,
      compressionLevel,
      originalContent: compressionLevel !== 'none' ? message.content : undefined,
      tokenCount: countTokens(content),
    };
  }

  // --------------------------------------------------------------------------
  // Auto Compression - Triggered near limits
  // --------------------------------------------------------------------------

  private autoCompress(
    messages: ContextMessage[],
    options: CompressionOptions
  ): CompressionResult {
    const tokensBefore = countMessageTokens(messages);
    let messagesRemoved = 0;
    let messagesCompressed = 0;
    const errors: string[] = [];

    // Preserve recent messages
    const preserveCount = options.preserveRecent || 10;
    const candidates = messages.slice(0, -preserveCount);
    const preserved = messages.slice(-preserveCount);

    // Sort by relevance/importance
    const sortedCandidates = this.sortByImportance(candidates);

    // Target token count
    const targetTokens = options.targetTokens || Math.floor(tokensBefore * 0.7);
    let currentTokens = countMessageTokens([...sortedCandidates, ...preserved]);

    const processedMessages: ContextMessage[] = [];

    // First pass: Compress low-importance messages
    for (const message of sortedCandidates) {
      if (currentTokens <= targetTokens) {
        processedMessages.push(message);
        continue;
      }

      // Skip checkpoints
      if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
        processedMessages.push(message);
        continue;
      }

      try {
        const compressed = this.applyAutoCompression(message);
        messagesCompressed++;
        currentTokens = currentTokens - (message.tokenCount || 0) + (compressed.tokenCount || 0);
        processedMessages.push(compressed);

        this.emit('message-compressed', { 
          messageId: message.id, 
          level: compressed.compressionLevel || 'medium' 
        });
      } catch (error) {
        errors.push(`Auto-compression failed for ${message.id}: ${error}`);
        processedMessages.push(message);
      }
    }

    // Second pass: Remove oldest low-importance messages if still over target
    if (currentTokens > targetTokens) {
      const toRemove = this.selectMessagesToRemove(processedMessages, currentTokens - targetTokens);
      
      for (const messageId of toRemove) {
        const index = processedMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          const removed = processedMessages.splice(index, 1)[0];
          currentTokens -= removed.tokenCount || 0;
          messagesRemoved++;
          
          this.emit('message-removed', { 
            messageId: removed.id, 
            reason: 'token budget exceeded' 
          });
        }
      }
    }

    const resultMessages = [...processedMessages, ...preserved];
    const tokensAfter = countMessageTokens(resultMessages);

    // Generate summary if requested
    let summary: string | undefined;
    if (options.generateSummary && messagesRemoved > 0) {
      summary = this.generateSummary(messages.filter(m => toRemove.includes(m.id)));
    }

    return {
      success: errors.length === 0,
      strategy: 'auto',
      messagesRemoved,
      messagesCompressed,
      tokensBefore,
      tokensAfter,
      summary,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private applyAutoCompression(message: ContextMessage): ContextMessage {
    let content = message.content;
    let compressionLevel: CompressionLevel = 'medium';

    // Generate summary for long messages
    const tokenCount = countTokens(content);
    if (tokenCount > 500) {
      content = this.summarizeContent(content, 300);
      compressionLevel = 'heavy';
    }

    // Compress code blocks
    if (message.metadata?.codeBlocks) {
      content = this.compressCodeBlocksAggressively(content);
      compressionLevel = 'heavy';
    }

    // Store original
    this.compressedMessages.set(message.id, {
      original: message.content,
      level: compressionLevel,
    });

    return {
      ...message,
      content,
      compressionLevel,
      originalContent: message.content,
      tokenCount: countTokens(content),
    };
  }

  // --------------------------------------------------------------------------
  // Full Compression - Aggressive compression
  // --------------------------------------------------------------------------

  private fullCompress(
    messages: ContextMessage[],
    options: CompressionOptions
  ): CompressionResult {
    const tokensBefore = countMessageTokens(messages);
    const errors: string[] = [];

    // Preserve only the most critical messages
    const preserveCount = options.preserveRecent || 3;
    const criticalMessages = this.identifyCriticalMessages(messages);
    const recentMessages = messages.slice(-preserveCount);

    // Everything else gets heavily compressed or removed
    const otherMessages = messages.filter(
      m => !criticalMessages.some(c => c.id === m.id) && 
           !recentMessages.some(r => r.id === m.id)
    );

    // Generate comprehensive summary
    let summary = '';
    if (options.generateSummary) {
      summary = this.generateComprehensiveSummary(otherMessages);
    }

    // Compress remaining messages to extreme level
    const compressedOthers = otherMessages.map(m => this.applyExtremeCompression(m));

    // Combine results
    const resultMessages = [
      ...criticalMessages,
      ...compressedOthers.filter(m => m.content.length > 0),
      ...recentMessages,
    ];

    const tokensAfter = countMessageTokens(resultMessages);

    return {
      success: true,
      strategy: 'full',
      messagesRemoved: otherMessages.length - compressedOthers.filter(m => m.content.length > 0).length,
      messagesCompressed: compressedOthers.filter(m => m.compressionLevel === 'extreme').length,
      tokensBefore,
      tokensAfter,
      summary: summary || undefined,
      reinjectedContent: summary ? [summary] : undefined,
    };
  }

  private applyExtremeCompression(message: ContextMessage): ContextMessage {
    // Generate one-sentence summary
    const summary = this.generateOneSentenceSummary(message.content);

    this.compressedMessages.set(message.id, {
      original: message.content,
      level: 'extreme',
    });

    return {
      ...message,
      content: summary,
      compressionLevel: 'extreme',
      originalContent: message.content,
      tokenCount: countTokens(summary),
    };
  }

  // --------------------------------------------------------------------------
  // Manual Compression
  // --------------------------------------------------------------------------

  private manualCompress(
    messages: ContextMessage[],
    options: CompressionOptions
  ): CompressionResult {
    // Manual compression applies user-specified compression
    const tokensBefore = countMessageTokens(messages);
    let messagesCompressed = 0;

    const compressedMessages = messages.map(message => {
      if (options.aggressive) {
        messagesCompressed++;
        return this.applyExtremeCompression(message);
      }
      return this.applyMicroCompression(message);
    });

    const tokensAfter = countMessageTokens(compressedMessages);

    return {
      success: true,
      strategy: 'manual',
      messagesRemoved: 0,
      messagesCompressed,
      tokensBefore,
      tokensAfter,
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private sortByImportance(messages: ContextMessage[]): ContextMessage[] {
    return [...messages].sort((a, b) => {
      // System messages first
      if (a.role === 'system' && b.role !== 'system') return -1;
      if (b.role === 'system' && a.role !== 'system') return 1;

      // Checkpoints next
      const aCheckpoint = a.metadata?.isCheckpoint ? 1 : 0;
      const bCheckpoint = b.metadata?.isCheckpoint ? 1 : 0;
      if (aCheckpoint !== bCheckpoint) return bCheckpoint - aCheckpoint;

      // Then by importance
      const aImportance = a.metadata?.importance || 0.5;
      const bImportance = b.metadata?.importance || 0.5;
      if (aImportance !== bImportance) return bImportance - aImportance;

      // Finally by recency
      return b.timestamp - a.timestamp;
    });
  }

  private identifyCriticalMessages(messages: ContextMessage[]): ContextMessage[] {
    return messages.filter(m => 
      m.role === 'system' || 
      m.metadata?.isCheckpoint || 
      (m.metadata?.importance || 0) > 0.9
    );
  }

  private selectMessagesToRemove(
    messages: ContextMessage[],
    tokensToRemove: number
  ): string[] {
    const toRemove: string[] = [];
    let removedTokens = 0;

    // Sort by least important first
    const sorted = this.sortByImportance(messages).reverse();

    for (const message of sorted) {
      if (removedTokens >= tokensToRemove) break;
      
      // Never remove system messages or checkpoints
      if (message.role === 'system') continue;
      if (message.metadata?.isCheckpoint) continue;

      toRemove.push(message.id);
      removedTokens += message.tokenCount || countTokens(message.content);
    }

    return toRemove;
  }

  private compressCodeBlocks(content: string, codeBlocks: CodeBlock[]): string {
    let result = content;

    for (const block of codeBlocks) {
      const fullBlock = `\`\`\`${block.language}\n${block.content}\n\`\`\``;
      
      if (block.content.length > 500) {
        // Truncate long code blocks
        const truncated = block.content.slice(0, 400) + '\n// ... [truncated]';
        const newBlock = `\`\`\`${block.language}\n${truncated}\n\`\`\``;
        result = result.replace(fullBlock, newBlock);
      }
    }

    return result;
  }

  private compressCodeBlocksAggressively(content: string): string {
    // Replace code blocks with placeholders
    return content.replace(
      /```[\s\S]*?```/g,
      '[Code block omitted for brevity]'
    );
  }

  private truncateContent(content: string, maxTokens: number): string {
    const approxChars = maxTokens * 4; // Rough estimate
    
    if (content.length <= approxChars) {
      return content;
    }

    return content.slice(0, approxChars) + this.config.truncationMarker;
  }

  private summarizeContent(content: string, maxTokens: number): string {
    // Simple extraction-based summarization
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    if (sentences.length <= 3) {
      return content;
    }

    // Take first, last, and key middle sentences
    const firstSentence = sentences[0];
    const lastSentence = sentences[sentences.length - 1];
    const middleIndex = Math.floor(sentences.length / 2);
    const middleSentence = sentences[middleIndex];

    const summary = `${this.config.summaryPrefix}${firstSentence.trim()} ${middleSentence.trim()} ${lastSentence.trim()}`;
    
    if (countTokens(summary) > maxTokens) {
      return this.truncateContent(summary, maxTokens);
    }

    return summary;
  }

  private generateOneSentenceSummary(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    return sentences[0]?.trim() || content.slice(0, 100);
  }

  private generateSummary(messages: ContextMessage[]): string {
    const topics = this.extractTopics(messages);
    const keyPoints = this.extractKeyPoints(messages);

    let summary = '## Conversation Summary\n\n';
    
    if (topics.length > 0) {
      summary += `**Topics:** ${topics.join(', ')}\n\n`;
    }

    if (keyPoints.length > 0) {
      summary += '**Key Points:**\n';
      for (const point of keyPoints.slice(0, 5)) {
        summary += `- ${point}\n`;
      }
    }

    return summary;
  }

  private generateComprehensiveSummary(messages: ContextMessage[]): string {
    const summary = this.generateSummary(messages);
    const fileRefs = this.extractFileReferences(messages);
    const codeRefs = this.extractCodeReferences(messages);

    let comprehensive = summary + '\n';

    if (fileRefs.length > 0) {
      comprehensive += '**Files Referenced:**\n';
      for (const file of fileRefs.slice(0, 10)) {
        comprehensive += `- ${file}\n`;
      }
      comprehensive += '\n';
    }

    if (codeRefs.length > 0) {
      comprehensive += '**Code Elements:**\n';
      for (const code of codeRefs.slice(0, 10)) {
        comprehensive += `- ${code}\n`;
      }
    }

    return comprehensive;
  }

  private extractTopics(messages: ContextMessage[]): string[] {
    const topics = new Set<string>();
    
    for (const message of messages) {
      if (message.metadata?.tags) {
        message.metadata.tags.forEach(tag => topics.add(tag));
      }
    }

    return Array.from(topics);
  }

  private extractKeyPoints(messages: ContextMessage[]): string[] {
    const points: string[] = [];
    
    for (const message of messages) {
      const sentences = message.content.match(/[^.!?]+[.!?]+/g) || [];
      
      for (const sentence of sentences) {
        // Look for sentences with key indicators
        if (/important|key|note|remember|critical|essential/i.test(sentence)) {
          points.push(sentence.trim());
        }
      }
    }

    return points;
  }

  private extractFileReferences(messages: ContextMessage[]): string[] {
    const files = new Set<string>();
    
    for (const message of messages) {
      if (message.metadata?.filePaths) {
        message.metadata.filePaths.forEach(f => files.add(f));
      }
      
      // Extract from content
      const matches = message.content.match(/[\w\/\\.-]+\.(ts|js|tsx|jsx|py|java|go|rs|cpp|c|h|json|md|yaml|yml)/gi);
      if (matches) {
        matches.forEach(m => files.add(m));
      }
    }

    return Array.from(files);
  }

  private extractCodeReferences(messages: ContextMessage[]): string[] {
    const refs: string[] = [];
    
    for (const message of messages) {
      if (message.metadata?.codeBlocks) {
        for (const block of message.metadata.codeBlocks) {
          // Extract function/class names
          const funcMatches = block.content.match(/(?:function|class|const|let|var)\s+(\w+)/g);
          if (funcMatches) {
            refs.push(...funcMatches);
          }
        }
      }
    }

    return refs;
  }

  // --------------------------------------------------------------------------
  // Restoration
  // --------------------------------------------------------------------------

  restore(messageId: string): ContextMessage | undefined {
    const compressed = this.compressedMessages.get(messageId);
    if (!compressed) {
      return undefined;
    }

    // Return restoration info - actual restoration happens in ContextManager
    return {
      id: messageId,
      role: 'compressed',
      content: compressed.original,
      timestamp: Date.now(),
      compressionLevel: 'none',
    } as ContextMessage;
  }

  canRestore(messageId: string): boolean {
    return this.compressedMessages.has(messageId);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStatistics(): {
    totalCompressions: number;
    messagesCompressed: number;
    averageCompressionRatio: number;
    compressionHistory: CompressionResult[];
  } {
    if (this.compressionHistory.length === 0) {
      return {
        totalCompressions: 0,
        messagesCompressed: 0,
        averageCompressionRatio: 0,
        compressionHistory: [],
      };
    }

    const totalCompressed = this.compressionHistory.reduce(
      (sum, r) => sum + r.messagesCompressed, 
      0
    );

    const avgRatio = this.compressionHistory.reduce((sum, r) => {
      const ratio = r.tokensAfter / r.tokensBefore;
      return sum + ratio;
    }, 0) / this.compressionHistory.length;

    return {
      totalCompressions: this.compressionHistory.length,
      messagesCompressed: totalCompressed,
      averageCompressionRatio: avgRatio,
      compressionHistory: [...this.compressionHistory],
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<CompressorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.compressedMessages.clear();
    this.compressionHistory = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createContextCompressor(
  config?: Partial<CompressorConfig>
): ContextCompressor {
  return new ContextCompressor(config);
}
