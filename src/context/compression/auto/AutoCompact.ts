/**
 * AutoCompact - Triggered compression for context management
 * 
 * AutoCompact is automatically triggered when context approaches limits:
 * - Triggered at configurable threshold (default 80%)
 * - Generates summaries for removed content
 * - Preserves recent and important messages
 * - Uses intelligent message selection
 * 
 * Features:
 * - Automatic threshold monitoring
 * - Summary generation
 * - Message prioritization
 * - Token budget awareness
 */

import type {
  ContextMessage,
  CompressionResult,
  CompressionOptions,
} from '../../types/index.js';
import { countMessageTokens, countTokens } from '../../utils/tokenCounter.js';
import { ContextRelevance } from '../../ContextRelevance.js';
import { SummaryGenerator } from './SummaryGenerator.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { EventEmitter } from 'events';

// ============================================================================
// AutoCompact Configuration
// ============================================================================

export interface AutoCompactConfig {
  triggerThreshold: number;
  targetReduction: number;
  preserveRecent: number;
  preserveCheckpoints: boolean;
  generateSummaries: boolean;
  maxSummaryLength: number;
  enableCircuitBreaker: boolean;
  compressionStrategy: 'remove' | 'summarize' | 'hybrid';
}

export const DEFAULT_AUTO_CONFIG: AutoCompactConfig = {
  triggerThreshold: 0.8,
  targetReduction: 0.3,
  preserveRecent: 10,
  preserveCheckpoints: true,
  generateSummaries: true,
  maxSummaryLength: 500,
  enableCircuitBreaker: true,
  compressionStrategy: 'hybrid',
};

// ============================================================================
// AutoCompact Events
// ============================================================================

export interface AutoCompactEvents {
  'triggered': { utilization: number; threshold: number };
  'compression:start': { messagesToProcess: number };
  'compression:complete': CompressionResult;
  'messages:removed': { count: number; summary?: string };
  'messages:summarized': { count: number; summaryLength: number };
  'circuit:open': { reason: string };
  'circuit:close': {};
}

// ============================================================================
// AutoCompact Class
// ============================================================================

export class AutoCompact extends EventEmitter {
  private config: AutoCompactConfig;
  private relevance: ContextRelevance;
  private summaryGenerator: SummaryGenerator;
  private circuitBreaker: CircuitBreaker;
  private stats: {
    timesTriggered: number;
    messagesRemoved: number;
    messagesSummarized: number;
    tokensSaved: number;
    lastTriggerTime: number;
  };

  constructor(config: Partial<AutoCompactConfig> = {}) {
    super();
    this.config = { ...DEFAULT_AUTO_CONFIG, ...config };
    this.relevance = new ContextRelevance();
    this.summaryGenerator = new SummaryGenerator({
      maxSummaryLength: this.config.maxSummaryLength,
    });
    this.circuitBreaker = new CircuitBreaker({
      enabled: this.config.enableCircuitBreaker,
    });
    
    this.stats = {
      timesTriggered: 0,
      messagesRemoved: 0,
      messagesSummarized: 0,
      tokensSaved: 0,
      lastTriggerTime: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Compression Entry
  // --------------------------------------------------------------------------

  /**
   * Check if compression should be triggered and execute if needed
   */
  checkAndCompact(
    messages: ContextMessage[],
    currentUtilization: number
  ): CompressionResult | null {
    if (!this.shouldTrigger(currentUtilization)) {
      return null;
    }

    return this.compact(messages);
  }

  /**
   * Force compression regardless of threshold
   */
  compact(messages: ContextMessage[], options?: CompressionOptions): CompressionResult {
    // Check circuit breaker
    if (this.config.enableCircuitBreaker && !this.circuitBreaker.canExecute()) {
      this.emit('circuit:open', { reason: 'too many failures' });
      return {
        success: false,
        strategy: 'auto',
        messagesRemoved: 0,
        messagesCompressed: 0,
        tokensBefore: countMessageTokens(messages),
        tokensAfter: countMessageTokens(messages),
        errors: ['circuit breaker open'],
      };
    }

    this.stats.timesTriggered++;
    this.stats.lastTriggerTime = Date.now();

    this.emit('triggered', { 
      utilization: this.stats.timesTriggered, 
      threshold: this.config.triggerThreshold 
    });

    try {
      const result = this.executeCompression(messages, options);
      
      if (this.config.enableCircuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }

      this.emit('compression:complete', result);
      return result;
    } catch (error) {
      if (this.config.enableCircuitBreaker) {
        this.circuitBreaker.recordFailure();
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        strategy: 'auto',
        messagesRemoved: 0,
        messagesCompressed: 0,
        tokensBefore: countMessageTokens(messages),
        tokensAfter: countMessageTokens(messages),
        errors: [errorMessage],
      };
    }
  }

  // --------------------------------------------------------------------------
  // Trigger Logic
  // --------------------------------------------------------------------------

  shouldTrigger(utilization: number): boolean {
    // Don't trigger if circuit breaker is open
    if (this.config.enableCircuitBreaker && !this.circuitBreaker.canExecute()) {
      return false;
    }

    // Don't trigger too frequently (cooldown)
    const cooldownPeriod = 5000; // 5 seconds
    if (Date.now() - this.stats.lastTriggerTime < cooldownPeriod) {
      return false;
    }

    return utilization >= this.config.triggerThreshold;
  }

  getTriggerThreshold(): number {
    return this.config.triggerThreshold;
  }

  setTriggerThreshold(threshold: number): void {
    this.config.triggerThreshold = Math.max(0, Math.min(1, threshold));
  }

  // --------------------------------------------------------------------------
  // Compression Execution
  // --------------------------------------------------------------------------

  private executeCompression(
    messages: ContextMessage[],
    options?: CompressionOptions
  ): CompressionResult {
    const tokensBefore = countMessageTokens(messages);
    
    // Calculate target tokens
    const targetTokens = options?.targetTokens || 
      Math.floor(tokensBefore * (1 - this.config.targetReduction));

    // Preserve recent messages
    const preserveCount = options?.preserveRecent || this.config.preserveRecent;
    const recentMessages = messages.slice(-preserveCount);
    const olderMessages = messages.slice(0, -preserveCount);

    this.emit('compression:start', { messagesToProcess: olderMessages.length });

    // Filter out protected messages
    const protectedMessages = olderMessages.filter(m => this.isProtected(m));
    const compressibleMessages = olderMessages.filter(m => !this.isProtected(m));

    // Calculate relevance scores
    this.relevance.calculateScores(compressibleMessages);

    // Sort by relevance (lowest first - these will be compressed/removed)
    const sortedMessages = [...compressibleMessages].sort(
      (a, b) => (this.relevance.getScore(a.id)?.score || 0.5) - 
                (this.relevance.getScore(b.id)?.score || 0.5)
    );

    let processedMessages: ContextMessage[] = [];
    let messagesRemoved = 0;
    let messagesSummarized = 0;
    let currentTokens = countMessageTokens(recentMessages) + 
                        countMessageTokens(protectedMessages);
    const removedMessages: ContextMessage[] = [];

    // Process messages based on strategy
    for (const message of sortedMessages) {
      if (currentTokens <= targetTokens) {
        processedMessages.push(message);
        currentTokens += message.tokenCount || countTokens(message.content);
        continue;
      }

      const messageTokens = message.tokenCount || countTokens(message.content);

      switch (this.config.compressionStrategy) {
        case 'remove':
          // Simply remove low-relevance messages
          removedMessages.push(message);
          messagesRemoved++;
          break;

        case 'summarize':
          // Summarize messages
          const summary = this.summarizeMessage(message);
          if (summary) {
            processedMessages.push(summary);
            currentTokens += summary.tokenCount || 0;
            messagesSummarized++;
          } else {
            removedMessages.push(message);
            messagesRemoved++;
          }
          break;

        case 'hybrid':
        default:
          // Hybrid: remove very low relevance, summarize others
          const relevance = this.relevance.getScore(message.id)?.score || 0.5;
          
          if (relevance < 0.3) {
            // Very low relevance - remove
            removedMessages.push(message);
            messagesRemoved++;
          } else {
            // Summarize
            const summary = this.summarizeMessage(message);
            if (summary) {
              processedMessages.push(summary);
              currentTokens += summary.tokenCount || 0;
              messagesSummarized++;
            } else {
              removedMessages.push(message);
              messagesRemoved++;
            }
          }
          break;
      }
    }

    // Generate overall summary if messages were removed
    let summary: string | undefined;
    if (this.config.generateSummaries && removedMessages.length > 0) {
      summary = this.generateOverallSummary(removedMessages);
    }

    // Combine all messages
    const resultMessages = [
      ...protectedMessages,
      ...processedMessages,
      ...recentMessages,
    ];

    const tokensAfter = countMessageTokens(resultMessages);
    const tokensSaved = tokensBefore - tokensAfter;

    // Update stats
    this.stats.messagesRemoved += messagesRemoved;
    this.stats.messagesSummarized += messagesSummarized;
    this.stats.tokensSaved += tokensSaved;

    // Emit events
    if (messagesRemoved > 0) {
      this.emit('messages:removed', { count: messagesRemoved, summary });
    }
    if (messagesSummarized > 0) {
      this.emit('messages:summarized', { 
        count: messagesSummarized, 
        summaryLength: summary?.length || 0 
      });
    }

    return {
      success: true,
      strategy: 'auto',
      messagesRemoved,
      messagesCompressed: messagesSummarized,
      tokensBefore,
      tokensAfter,
      summary,
      reinjectedContent: summary ? [summary] : undefined,
    };
  }

  // --------------------------------------------------------------------------
  // Message Processing
  // --------------------------------------------------------------------------

  private isProtected(message: ContextMessage): boolean {
    // System messages
    if (message.role === 'system') {
      return true;
    }

    // Checkpoints
    if (this.config.preserveCheckpoints && message.metadata?.isCheckpoint) {
      return true;
    }

    // High importance messages
    if ((message.metadata?.importance || 0) > 0.9) {
      return true;
    }

    return false;
  }

  private summarizeMessage(message: ContextMessage): ContextMessage | null {
    const summary = this.summaryGenerator.generate(message.content);
    
    if (!summary || summary.length < 20) {
      return null;
    }

    return {
      ...message,
      content: `[Summary] ${summary}`,
      compressionLevel: 'medium',
      originalContent: message.content,
      tokenCount: countTokens(summary) + 2, // +2 for "[Summary] "
    };
  }

  private generateOverallSummary(removedMessages: ContextMessage[]): string {
    const contents = removedMessages.map(m => m.content);
    return this.summaryGenerator.generateBatch(contents);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    timesTriggered: number;
    messagesRemoved: number;
    messagesSummarized: number;
    tokensSaved: number;
    lastTriggerTime: number;
    circuitBreakerStatus: string;
  } {
    return {
      ...this.stats,
      circuitBreakerStatus: this.circuitBreaker.getState().state,
    };
  }

  resetStats(): void {
    this.stats = {
      timesTriggered: 0,
      messagesRemoved: 0,
      messagesSummarized: 0,
      tokensSaved: 0,
      lastTriggerTime: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<AutoCompactConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update sub-components
    if (config.maxSummaryLength) {
      this.summaryGenerator.updateConfig({ maxSummaryLength: config.maxSummaryLength });
    }
    
    if (config.enableCircuitBreaker !== undefined) {
      this.circuitBreaker.updateConfig({ enabled: config.enableCircuitBreaker });
    }
  }

  getConfig(): AutoCompactConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Circuit Breaker Control
  // --------------------------------------------------------------------------

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    this.emit('circuit:close', {});
  }

  forceCircuitOpen(): void {
    this.circuitBreaker.forceOpen();
    this.emit('circuit:open', { reason: 'manual' });
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.relevance.dispose();
    this.summaryGenerator.dispose();
    this.resetStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAutoCompact(config?: Partial<AutoCompactConfig>): AutoCompact {
  return new AutoCompact(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function autoCompact(
  messages: ContextMessage[],
  utilization: number,
  config?: Partial<AutoCompactConfig>
): CompressionResult | null {
  const compactor = new AutoCompact(config);
  return compactor.checkAndCompact(messages, utilization);
}

export function shouldTriggerAutoCompact(
  utilization: number,
  threshold: number = DEFAULT_AUTO_CONFIG.triggerThreshold
): boolean {
  return utilization >= threshold;
}
