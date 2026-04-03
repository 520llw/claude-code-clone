/**
 * FullCompact - Aggressive compression for context management
 * 
 * FullCompact is the most aggressive compression strategy:
 * - Triggered at critical threshold (default 95%)
 * - Removes all but the most essential messages
 * - Generates comprehensive summaries
 * - Re-injects critical context
 * 
 * Features:
 * - Critical message preservation
 * - Comprehensive summarization
 * - Context reinjection
 * - Emergency recovery
 */

import type {
  ContextMessage,
  CompressionResult,
  CompressionOptions,
} from '../../types/index.js';
import { countMessageTokens, countTokens } from '../../utils/tokenCounter.js';
import { ContextRelevance } from '../../ContextRelevance.js';
import { ConversationCompressor } from './ConversationCompressor.js';
import { ReinjectionManager } from './ReinjectionManager.js';
import { EventEmitter } from 'events';

// ============================================================================
// FullCompact Configuration
// ============================================================================

export interface FullCompactConfig {
  triggerThreshold: number;
  targetReduction: number;
  preserveRecent: number;
  preserveSystem: boolean;
  preserveCheckpoints: boolean;
  generateComprehensiveSummary: boolean;
  enableReinjection: boolean;
  maxReinjectedItems: number;
  emergencyMode: boolean;
}

export const DEFAULT_FULL_CONFIG: FullCompactConfig = {
  triggerThreshold: 0.95,
  targetReduction: 0.7,
  preserveRecent: 3,
  preserveSystem: true,
  preserveCheckpoints: true,
  generateComprehensiveSummary: true,
  enableReinjection: true,
  maxReinjectedItems: 5,
  emergencyMode: false,
};

// ============================================================================
// FullCompact Events
// ============================================================================

export interface FullCompactEvents {
  'emergency:triggered': { utilization: number };
  'compression:start': { messagesToProcess: number };
  'compression:complete': CompressionResult;
  'messages:preserved': { count: number; ids: string[] };
  'messages:removed': { count: number; tokens: number };
  'summary:generated': { length: number };
  'context:reinjected': { items: string[] };
}

// ============================================================================
// FullCompact Class
// ============================================================================

export class FullCompact extends EventEmitter {
  private config: FullCompactConfig;
  private relevance: ContextRelevance;
  private conversationCompressor: ConversationCompressor;
  private reinjectionManager: ReinjectionManager;
  private stats: {
    timesTriggered: number;
    messagesPreserved: number;
    messagesRemoved: number;
    tokensSaved: number;
    summariesGenerated: number;
    lastTriggerTime: number;
  };

  constructor(config: Partial<FullCompactConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FULL_CONFIG, ...config };
    this.relevance = new ContextRelevance();
    this.conversationCompressor = new ConversationCompressor();
    this.reinjectionManager = new ReinjectionManager({
      maxItems: this.config.maxReinjectedItems,
    });
    
    this.stats = {
      timesTriggered: 0,
      messagesPreserved: 0,
      messagesRemoved: 0,
      tokensSaved: 0,
      summariesGenerated: 0,
      lastTriggerTime: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Compression Entry
  // --------------------------------------------------------------------------

  /**
   * Check if emergency compression should be triggered
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
   * Force full compression
   */
  compact(messages: ContextMessage[], options?: CompressionOptions): CompressionResult {
    this.stats.timesTriggered++;
    this.stats.lastTriggerTime = Date.now();

    this.emit('emergency:triggered', { utilization: this.stats.timesTriggered });

    try {
      const result = this.executeCompression(messages, options);
      this.emit('compression:complete', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        strategy: 'full',
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
    // Don't trigger too frequently
    const cooldownPeriod = 10000; // 10 seconds
    if (Date.now() - this.stats.lastTriggerTime < cooldownPeriod) {
      return false;
    }

    const threshold = this.config.emergencyMode 
      ? 0.99 
      : this.config.triggerThreshold;

    return utilization >= threshold;
  }

  enableEmergencyMode(): void {
    this.config.emergencyMode = true;
  }

  disableEmergencyMode(): void {
    this.config.emergencyMode = false;
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

    // Identify critical messages to preserve
    const preservedMessages = this.identifyCriticalMessages(messages);
    const preservedIds = new Set(preservedMessages.map(m => m.id));

    this.emit('messages:preserved', { 
      count: preservedMessages.length, 
      ids: preservedMessages.map(m => m.id) 
    });

    // Messages to compress/remove
    const compressibleMessages = messages.filter(m => !preservedIds.has(m.id));

    this.emit('compression:start', { messagesToProcess: compressibleMessages.length });

    // Calculate relevance for prioritization
    this.relevance.calculateScores(compressibleMessages);

    // Compress the conversation
    const compressionResult = this.conversationCompressor.compress(
      compressibleMessages,
      targetTokens
    );

    // Generate comprehensive summary
    let summary: string | undefined;
    let reinjectedContent: string[] | undefined;

    if (this.config.generateComprehensiveSummary) {
      summary = this.generateComprehensiveSummary(compressibleMessages);
      this.stats.summariesGenerated++;
      this.emit('summary:generated', { length: summary.length });
    }

    // Prepare reinjected content
    if (this.config.enableReinjection) {
      reinjectedContent = this.prepareReinjectedContent(
        compressibleMessages,
        summary
      );
      
      if (reinjectedContent.length > 0) {
        this.emit('context:reinjected', { items: reinjectedContent });
      }
    }

    // Calculate final result
    const resultMessages = [
      ...preservedMessages,
      ...compressionResult.keptMessages,
    ];

    const tokensAfter = countMessageTokens(resultMessages);
    const tokensSaved = tokensBefore - tokensAfter;
    const messagesRemoved = compressibleMessages.length - compressionResult.keptMessages.length;

    // Update stats
    this.stats.messagesPreserved += preservedMessages.length;
    this.stats.messagesRemoved += messagesRemoved;
    this.stats.tokensSaved += tokensSaved;

    this.emit('messages:removed', { count: messagesRemoved, tokens: tokensSaved });

    return {
      success: true,
      strategy: 'full',
      messagesRemoved,
      messagesCompressed: compressionResult.compressedCount,
      tokensBefore,
      tokensAfter,
      summary,
      reinjectedContent,
    };
  }

  // --------------------------------------------------------------------------
  // Critical Message Identification
  // --------------------------------------------------------------------------

  private identifyCriticalMessages(messages: ContextMessage[]): ContextMessage[] {
    const critical: ContextMessage[] = [];
    const preserveCount = this.config.preserveRecent;

    // Always preserve recent messages
    const recentMessages = messages.slice(-preserveCount);
    recentMessages.forEach(m => critical.push(m));

    // Preserve system messages
    if (this.config.preserveSystem) {
      const systemMessages = messages.filter(m => 
        m.role === 'system' && !critical.some(c => c.id === m.id)
      );
      systemMessages.forEach(m => critical.push(m));
    }

    // Preserve checkpoints
    if (this.config.preserveCheckpoints) {
      const checkpoints = messages.filter(m => 
        m.metadata?.isCheckpoint && !critical.some(c => c.id === m.id)
      );
      checkpoints.forEach(m => critical.push(m));
    }

    // Preserve high-importance messages
    const highImportance = messages.filter(m => 
      (m.metadata?.importance || 0) > 0.9 && 
      !critical.some(c => c.id === m.id)
    );
    highImportance.forEach(m => critical.push(m));

    return critical;
  }

  // --------------------------------------------------------------------------
  // Summary Generation
  // --------------------------------------------------------------------------

  private generateComprehensiveSummary(messages: ContextMessage[]): string {
    const sections: string[] = [];

    // Overview
    sections.push('# Conversation Summary\n');
    sections.push(`**Total Messages:** ${messages.length}\n`);
    sections.push(`**Total Tokens:** ${countMessageTokens(messages)}\n`);

    // Topics
    const topics = this.extractTopics(messages);
    if (topics.length > 0) {
      sections.push(`\n**Topics:** ${topics.join(', ')}\n`);
    }

    // Key Decisions/Actions
    const decisions = this.extractDecisions(messages);
    if (decisions.length > 0) {
      sections.push('\n**Key Decisions/Actions:**\n');
      decisions.forEach(d => sections.push(`- ${d}\n`));
    }

    // File References
    const files = this.extractFileReferences(messages);
    if (files.length > 0) {
      sections.push('\n**Files Referenced:**\n');
      files.slice(0, 10).forEach(f => sections.push(`- ${f}\n`));
    }

    // Code Elements
    const codeElements = this.extractCodeElements(messages);
    if (codeElements.length > 0) {
      sections.push('\n**Code Elements:**\n');
      codeElements.slice(0, 10).forEach(c => sections.push(`- ${c}\n`));
    }

    // Recent Context
    const recentContext = this.extractRecentContext(messages);
    if (recentContext.length > 0) {
      sections.push('\n**Recent Context:**\n');
      recentContext.forEach(c => sections.push(`- ${c}\n`));
    }

    return sections.join('');
  }

  private extractTopics(messages: ContextMessage[]): string[] {
    const topics = new Set<string>();

    for (const message of messages) {
      // From metadata tags
      if (message.metadata?.tags) {
        message.metadata.tags.forEach(t => topics.add(t));
      }

      // From headers
      const headerMatches = message.content.match(/^#{1,6}\s+(.+)$/gm);
      if (headerMatches) {
        headerMatches.forEach(h => {
          const topic = h.replace(/^#+\s+/, '').trim();
          if (topic.length > 3) {
            topics.add(topic);
          }
        });
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  private extractDecisions(messages: ContextMessage[]): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /(?:decided?|decision)\s*:?\s*([^\n.]+)/gi,
      /(?:agreed?|agreement)\s*:?\s*([^\n.]+)/gi,
      /(?:concluded?|conclusion)\s*:?\s*([^\n.]+)/gi,
      /(?:resolved?|resolution)\s*:?\s*([^\n.]+)/gi,
    ];

    for (const message of messages) {
      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(message.content)) !== null) {
          const decision = match[1].trim();
          if (decision.length > 10 && decision.length < 200) {
            decisions.push(decision);
          }
        }
      }
    }

    return [...new Set(decisions)].slice(0, 10);
  }

  private extractFileReferences(messages: ContextMessage[]): string[] {
    const files = new Set<string>();

    for (const message of messages) {
      // From metadata
      if (message.metadata?.filePaths) {
        message.metadata.filePaths.forEach(f => files.add(f));
      }

      // From content
      const fileMatches = message.content.match(
        /[\w\/-]+\.(ts|js|tsx|jsx|py|java|go|rs|json|md|yaml|yml)/gi
      );
      if (fileMatches) {
        fileMatches.forEach(f => files.add(f));
      }
    }

    return Array.from(files);
  }

  private extractCodeElements(messages: ContextMessage[]): string[] {
    const elements = new Set<string>();

    for (const message of messages) {
      if (message.metadata?.codeBlocks) {
        for (const block of message.metadata.codeBlocks) {
          // Extract function names
          const funcMatches = block.content.match(
            /(?:function|const|let|var|class|interface)\s+(\w+)/g
          );
          if (funcMatches) {
            funcMatches.forEach(f => elements.add(f));
          }
        }
      }
    }

    return Array.from(elements).slice(0, 15);
  }

  private extractRecentContext(messages: ContextMessage[]): string[] {
    // Get last few user messages for context
    const userMessages = messages
      .filter(m => m.role === 'user')
      .slice(-3);

    return userMessages.map(m => {
      const content = m.content.slice(0, 100);
      return content.length < m.content.length 
        ? content + '...' 
        : content;
    });
  }

  // --------------------------------------------------------------------------
  // Reinjection Preparation
  // --------------------------------------------------------------------------

  private prepareReinjectedContent(
    removedMessages: ContextMessage[],
    summary?: string
  ): string[] {
    const items: string[] = [];

    if (summary) {
      items.push(summary);
    }

    // Add critical context items
    const criticalContext = this.reinjectionManager.extractCriticalContext(
      removedMessages
    );
    items.push(...criticalContext);

    // Add topic summaries
    const topicSummaries = this.reinjectionManager.generateTopicSummaries(
      removedMessages
    );
    items.push(...topicSummaries);

    return items.slice(0, this.config.maxReinjectedItems);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    timesTriggered: number;
    messagesPreserved: number;
    messagesRemoved: number;
    tokensSaved: number;
    summariesGenerated: number;
    lastTriggerTime: number;
    emergencyMode: boolean;
  } {
    return {
      ...this.stats,
      emergencyMode: this.config.emergencyMode,
    };
  }

  resetStats(): void {
    this.stats = {
      timesTriggered: 0,
      messagesPreserved: 0,
      messagesRemoved: 0,
      tokensSaved: 0,
      summariesGenerated: 0,
      lastTriggerTime: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<FullCompactConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.maxReinjectedItems !== undefined) {
      this.reinjectionManager.updateConfig({ maxItems: config.maxReinjectedItems });
    }
  }

  getConfig(): FullCompactConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.relevance.dispose();
    this.conversationCompressor.dispose();
    this.reinjectionManager.dispose();
    this.resetStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createFullCompact(config?: Partial<FullCompactConfig>): FullCompact {
  return new FullCompact(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function emergencyCompact(
  messages: ContextMessage[],
  config?: Partial<FullCompactConfig>
): CompressionResult {
  const compactor = new FullCompact({ ...config, emergencyMode: true });
  return compactor.compact(messages);
}

export function shouldTriggerFullCompact(
  utilization: number,
  threshold: number = DEFAULT_FULL_CONFIG.triggerThreshold
): boolean {
  return utilization >= threshold;
}
