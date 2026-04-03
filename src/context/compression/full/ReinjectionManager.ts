/**
 * Reinjection Manager - Context reinjection for full compression
 * 
 * Manages the reinjection of critical context after compression:
 * - Extracts critical information from removed messages
 * - Generates topic summaries
 * - Preserves file references
 * - Maintains code context
 * 
 * Features:
 * - Critical context extraction
 * - Topic-based summaries
 * - File reference tracking
 * - Code element preservation
 */

import type { ContextMessage } from '../../types/index.js';
import { countTokens } from '../../utils/tokenCounter.js';
import { EventEmitter } from 'events';

// ============================================================================
// Reinjection Configuration
// ============================================================================

export interface ReinjectionConfig {
  maxItems: number;
  maxItemLength: number;
  preserveFileReferences: boolean;
  preserveCodeContext: boolean;
  preserveDecisions: boolean;
  preserveActionItems: boolean;
  format: 'markdown' | 'plain' | 'structured';
}

export const DEFAULT_REINJECTION_CONFIG: ReinjectionConfig = {
  maxItems: 5,
  maxItemLength: 500,
  preserveFileReferences: true,
  preserveCodeContext: true,
  preserveDecisions: true,
  preserveActionItems: true,
  format: 'markdown',
};

// ============================================================================
// Critical Context Item
// ============================================================================

export interface CriticalContextItem {
  type: 'summary' | 'topic' | 'file' | 'code' | 'decision' | 'action';
  content: string;
  priority: number;
  sourceMessageIds: string[];
  timestamp: number;
}

// ============================================================================
// Reinjection Events
// ============================================================================

export interface ReinjectionManagerEvents {
  'item:extracted': { item: CriticalContextItem };
  'items:prepared': { count: number; totalTokens: number };
  'format:complete': { format: string; content: string };
}

// ============================================================================
// Reinjection Manager Class
// ============================================================================

export class ReinjectionManager extends EventEmitter {
  private config: ReinjectionConfig;
  private extractedItems: CriticalContextItem[];
  private stats: {
    itemsExtracted: number;
    filesPreserved: number;
    codeElementsPreserved: number;
    decisionsPreserved: number;
    actionItemsPreserved: number;
  };

  constructor(config: Partial<ReinjectionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REINJECTION_CONFIG, ...config };
    this.extractedItems = [];
    this.stats = {
      itemsExtracted: 0,
      filesPreserved: 0,
      codeElementsPreserved: 0,
      decisionsPreserved: 0,
      actionItemsPreserved: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Extraction Entry
  // --------------------------------------------------------------------------

  /**
   * Extract critical context from messages
   */
  extractCriticalContext(messages: ContextMessage[]): string[] {
    this.extractedItems = [];

    // Extract different types of context
    if (this.config.preserveDecisions) {
      this.extractDecisions(messages);
    }

    if (this.config.preserveActionItems) {
      this.extractActionItems(messages);
    }

    if (this.config.preserveFileReferences) {
      this.extractFileReferences(messages);
    }

    if (this.config.preserveCodeContext) {
      this.extractCodeContext(messages);
    }

    // Sort by priority and limit
    this.extractedItems.sort((a, b) => b.priority - a.priority);
    const limited = this.extractedItems.slice(0, this.config.maxItems);

    this.stats.itemsExtracted += limited.length;

    this.emit('items:prepared', {
      count: limited.length,
      totalTokens: limited.reduce((sum, item) => sum + countTokens(item.content), 0),
    });

    // Format and return
    return this.formatItems(limited);
  }

  /**
   * Generate topic summaries from messages
   */
  generateTopicSummaries(messages: ContextMessage[]): string[] {
    const topics = this.clusterByTopic(messages);
    const summaries: string[] = [];

    for (const [topic, topicMessages] of topics) {
      if (topicMessages.length < 2) continue;

      const summary = this.summarizeTopic(topic, topicMessages);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries.slice(0, Math.floor(this.config.maxItems / 2));
  }

  // --------------------------------------------------------------------------
  // Extraction Methods
  // --------------------------------------------------------------------------

  private extractDecisions(messages: ContextMessage[]): void {
    const decisionPatterns = [
      /(?:decided?|decision)\s*:?\s*([^\n.]+)/gi,
      /(?:agreed?|agreement)\s*:?\s*([^\n.]+)/gi,
      /(?:concluded?|conclusion)\s*:?\s*([^\n.]+)/gi,
      /(?:resolved?|resolution)\s*:?\s*([^\n.]+)/gi,
      /(?:determined?)\s*:?\s*([^\n.]+)/gi,
    ];

    for (const message of messages) {
      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(message.content)) !== null) {
          const decision = match[1].trim();
          if (decision.length > 10 && decision.length < this.config.maxItemLength) {
            this.extractedItems.push({
              type: 'decision',
              content: `Decision: ${decision}`,
              priority: 0.9,
              sourceMessageIds: [message.id],
              timestamp: message.timestamp,
            });
            this.stats.decisionsPreserved++;
          }
        }
      }
    }
  }

  private extractActionItems(messages: ContextMessage[]): void {
    const actionPatterns = [
      /(?:action item|todo|task)\s*:?\s*([^\n.]+)/gi,
      /(?:need to|should|must)\s+([^\n.]+)/gi,
      /(?:will|going to)\s+([^\n.]+)/gi,
    ];

    for (const message of messages) {
      for (const pattern of actionPatterns) {
        let match;
        while ((match = pattern.exec(message.content)) !== null) {
          const action = match[1].trim();
          if (action.length > 10 && action.length < this.config.maxItemLength) {
            this.extractedItems.push({
              type: 'action',
              content: `Action: ${action}`,
              priority: 0.85,
              sourceMessageIds: [message.id],
              timestamp: message.timestamp,
            });
            this.stats.actionItemsPreserved++;
          }
        }
      }
    }
  }

  private extractFileReferences(messages: ContextMessage[]): void {
    const fileRefs = new Map<string, Set<string>>();

    for (const message of messages) {
      // From metadata
      if (message.metadata?.filePaths) {
        for (const file of message.metadata.filePaths) {
          if (!fileRefs.has(file)) {
            fileRefs.set(file, new Set());
          }
          fileRefs.get(file)!.add(message.id);
        }
      }

      // From content
      const fileMatches = message.content.match(
        /[\w\/-]+\.(ts|js|tsx|jsx|py|java|go|rs|json|md|yaml|yml)/gi
      );
      if (fileMatches) {
        for (const file of fileMatches) {
          if (!fileRefs.has(file)) {
            fileRefs.set(file, new Set());
          }
          fileRefs.get(file)!.add(message.id);
        }
      }
    }

    // Convert to items
    for (const [file, messageIds] of fileRefs) {
      this.extractedItems.push({
        type: 'file',
        content: `File: ${file}`,
        priority: 0.7,
        sourceMessageIds: Array.from(messageIds),
        timestamp: Date.now(),
      });
      this.stats.filesPreserved++;
    }
  }

  private extractCodeContext(messages: ContextMessage[]): void {
    const codeElements = new Map<string, { type: string; messages: Set<string> }>();

    for (const message of messages) {
      if (message.metadata?.codeBlocks) {
        for (const block of message.metadata.codeBlocks) {
          // Extract function names
          const funcMatches = block.content.match(
            /function\s+(\w+)/g
          );
          if (funcMatches) {
            for (const match of funcMatches) {
              const name = match.replace('function ', '');
              if (!codeElements.has(name)) {
                codeElements.set(name, { type: 'function', messages: new Set() });
              }
              codeElements.get(name)!.messages.add(message.id);
            }
          }

          // Extract class names
          const classMatches = block.content.match(
            /class\s+(\w+)/g
          );
          if (classMatches) {
            for (const match of classMatches) {
              const name = match.replace('class ', '');
              if (!codeElements.has(name)) {
                codeElements.set(name, { type: 'class', messages: new Set() });
              }
              codeElements.get(name)!.messages.add(message.id);
            }
          }

          // Extract interface names
          const interfaceMatches = block.content.match(
            /interface\s+(\w+)/g
          );
          if (interfaceMatches) {
            for (const match of interfaceMatches) {
              const name = match.replace('interface ', '');
              if (!codeElements.has(name)) {
                codeElements.set(name, { type: 'interface', messages: new Set() });
              }
              codeElements.get(name)!.messages.add(message.id);
            }
          }
        }
      }
    }

    // Convert to items
    for (const [name, data] of codeElements) {
      this.extractedItems.push({
        type: 'code',
        content: `${data.type}: ${name}`,
        priority: 0.6,
        sourceMessageIds: Array.from(data.messages),
        timestamp: Date.now(),
      });
      this.stats.codeElementsPreserved++;
    }
  }

  // --------------------------------------------------------------------------
  // Topic Clustering
  // --------------------------------------------------------------------------

  private clusterByTopic(messages: ContextMessage[]): Map<string, ContextMessage[]> {
    const topics = new Map<string, ContextMessage[]>();

    for (const message of messages) {
      const topic = this.identifyTopic(message);
      
      if (!topics.has(topic)) {
        topics.set(topic, []);
      }
      
      topics.get(topic)!.push(message);
    }

    return topics;
  }

  private identifyTopic(message: ContextMessage): string {
    // Check metadata tags first
    if (message.metadata?.tags && message.metadata.tags.length > 0) {
      return message.metadata.tags[0];
    }

    // Extract from headers
    const headerMatch = message.content.match(/^#{1,6}\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }

    // Extract from first sentence
    const firstSentence = message.content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      const words = firstSentence[0]
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4);
      
      if (words.length > 0) {
        return words[0];
      }
    }

    return 'general';
  }

  private summarizeTopic(topic: string, messages: ContextMessage[]): string | null {
    if (messages.length === 0) return null;

    const messageCount = messages.length;
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    let summary = `**Topic: ${topic}**\n`;
    summary += `- ${messageCount} messages\n`;
    summary += `- Started: ${new Date(firstMessage.timestamp).toLocaleString()}\n`;
    summary += `- Last: ${new Date(lastMessage.timestamp).toLocaleString()}\n`;

    // Add key points
    const keyPoints = this.extractKeyPointsForTopic(messages);
    if (keyPoints.length > 0) {
      summary += `- Key points: ${keyPoints.slice(0, 3).join('; ')}\n`;
    }

    return summary;
  }

  private extractKeyPointsForTopic(messages: ContextMessage[]): string[] {
    const points: string[] = [];
    
    for (const message of messages) {
      const sentences = message.content.match(/[^.!?]+[.!?]+/g) || [];
      
      for (const sentence of sentences) {
        if (/\b(important|key|note|significant|critical)\b/i.test(sentence)) {
          points.push(sentence.trim());
        }
      }
    }

    return [...new Set(points)].slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // Formatting
  // --------------------------------------------------------------------------

  private formatItems(items: CriticalContextItem[]): string[] {
    switch (this.config.format) {
      case 'markdown':
        return this.formatAsMarkdown(items);
      case 'structured':
        return this.formatAsStructured(items);
      case 'plain':
      default:
        return this.formatAsPlain(items);
    }
  }

  private formatAsMarkdown(items: CriticalContextItem[]): string[] {
    const sections: Map<string, CriticalContextItem[]> = new Map();

    // Group by type
    for (const item of items) {
      if (!sections.has(item.type)) {
        sections.set(item.type, []);
      }
      sections.get(item.type)!.push(item);
    }

    const result: string[] = [];

    // Format each section
    for (const [type, typeItems] of sections) {
      let section = `## ${this.capitalize(type)}s\n\n`;
      
      for (const item of typeItems) {
        section += `- ${item.content}\n`;
      }

      result.push(section);
    }

    this.emit('format:complete', { format: 'markdown', content: result.join('\n') });

    return result;
  }

  private formatAsStructured(items: CriticalContextItem[]): string[] {
    return items.map(item => JSON.stringify({
      type: item.type,
      content: item.content,
      priority: item.priority,
      timestamp: item.timestamp,
    }));
  }

  private formatAsPlain(items: CriticalContextItem[]): string[] {
    return items.map(item => `[${item.type.toUpperCase()}] ${item.content}`);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    itemsExtracted: number;
    filesPreserved: number;
    codeElementsPreserved: number;
    decisionsPreserved: number;
    actionItemsPreserved: number;
  } {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      itemsExtracted: 0,
      filesPreserved: 0,
      codeElementsPreserved: 0,
      decisionsPreserved: 0,
      actionItemsPreserved: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<ReinjectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ReinjectionConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.extractedItems = [];
    this.resetStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createReinjectionManager(
  config?: Partial<ReinjectionConfig>
): ReinjectionManager {
  return new ReinjectionManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function extractCriticalContext(
  messages: ContextMessage[],
  config?: Partial<ReinjectionConfig>
): string[] {
  const manager = new ReinjectionManager(config);
  return manager.extractCriticalContext(messages);
}

export function generateTopicSummaries(
  messages: ContextMessage[],
  config?: Partial<ReinjectionConfig>
): string[] {
  const manager = new ReinjectionManager(config);
  return manager.generateTopicSummaries(messages);
}
