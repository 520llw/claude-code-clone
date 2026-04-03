/**
 * ContextManager - Context Compression and Management
 * 
 * This module provides intelligent context management for LLM conversations:
 * - Three-layer compression (MicroCompact, AutoCompact, Full Compact)
 * - Token budget management
 * - Conversation history management
 * - File context tracking
 * - Semantic relevance scoring
 * 
 * @module ContextManager
 */

import {
  Message,
  TextMessage,
  ToolUseMessage,
  ToolResultMessage,
  ContextConfig,
  CompressedContext,
  FileContext,
  CompressionStrategy,
  CompressionLevel,
  Logger,
  AgentError,
  ContextError,
  TokenUsage,
} from '../types/index.js';

import { TokenTracker } from './TokenTracker.js';

/**
 * Events emitted by ContextManager
 */
export interface ContextManagerEvents {
  onCompression?: (result: CompressedContext) => void;
  onContextUpdated?: (messages: Message[]) => void;
  onFileContextAdded?: (fileContext: FileContext) => void;
  onBudgetWarning?: (current: number, max: number) => void;
}

/**
 * Configuration for ContextManager
 */
export interface ContextManagerConfig {
  sessionId: string;
  maxTokens?: number;
  compressionStrategy?: CompressionStrategy;
  preserveRecentMessages?: number;
  preserveSystemMessages?: boolean;
  preserveToolResults?: boolean;
  events?: ContextManagerEvents;
  logger?: Logger;
  enableSemanticCompression?: boolean;
  relevanceThreshold?: number;
}

/**
 * Default context configuration
 */
const DEFAULT_CONFIG: Partial<ContextManagerConfig> = {
  maxTokens: 100000,
  compressionStrategy: 'auto',
  preserveRecentMessages: 10,
  preserveSystemMessages: true,
  preserveToolResults: true,
  enableSemanticCompression: true,
  relevanceThreshold: 0.5,
};

/**
 * Message importance score
 */
interface MessageScore {
  message: Message;
  score: number;
  tokens: number;
}

/**
 * ContextManager class for managing conversation context
 */
export class ContextManager {
  private sessionId: string;
  private config: Required<ContextManagerConfig>;
  private events: ContextManagerEvents;
  private logger: Logger;
  private messages: Message[];
  private fileContexts: FileContext[];
  private tokenTracker: TokenTracker;
  private compressionHistory: CompressedContext[];

  /**
   * Creates a new ContextManager instance
   * 
   * @param config - Configuration options
   */
  constructor(config: ContextManagerConfig) {
    this.sessionId = config.sessionId;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ContextManagerConfig>;
    this.events = config.events || {};
    this.logger = config.logger || this.createDefaultLogger();
    
    this.messages = [];
    this.fileContexts = [];
    this.compressionHistory = [];

    // Initialize token tracker
    this.tokenTracker = new TokenTracker({
      sessionId: this.sessionId,
      budget: {
        maxTotalTokens: this.config.maxTokens,
        maxInputTokens: this.config.maxTokens,
        maxOutputTokens: 16000,
        warningThreshold: 0.9,
      },
      logger: this.logger,
    });

    this.logger.info(`[ContextManager] Initialized for session ${this.sessionId}`);
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: () => {},
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Adds a message to the context
   * 
   * @param message - Message to add
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    
    // Estimate and track tokens
    const content = this.extractMessageContent(message);
    this.tokenTracker.recordEstimatedUsage(content, 'input');

    this.logger.debug(`[ContextManager] Added message: ${message.type}`);

    // Check if compression is needed
    this.checkAndCompress();

    this.events.onContextUpdated?.(this.getMessages());
  }

  /**
   * Adds multiple messages to the context
   * 
   * @param messages - Messages to add
   */
  addMessages(messages: Message[]): void {
    for (const message of messages) {
      this.addMessage(message);
    }
  }

  /**
   * Gets all messages in the context
   * 
   * @returns Array of messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Gets messages within token budget
   * 
   * @param maxTokens - Maximum tokens (defaults to config)
   * @returns Messages that fit within budget
   */
  getMessagesWithinBudget(maxTokens?: number): Message[] {
    const budget = maxTokens || this.config.maxTokens;
    const messages = this.getMessages();
    
    let totalTokens = 0;
    const result: Message[] = [];

    // Start from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const content = this.extractMessageContent(message);
      const tokens = this.tokenTracker.estimateTokens(content);

      if (totalTokens + tokens > budget) {
        break;
      }

      result.unshift(message);
      totalTokens += tokens;
    }

    return result;
  }

  /**
   * Adds a file context
   * 
   * @param fileContext - File context to add
   */
  addFileContext(fileContext: FileContext): void {
    // Check if file already exists
    const existingIndex = this.fileContexts.findIndex(
      fc => fc.path === fileContext.path
    );

    if (existingIndex >= 0) {
      // Update existing
      this.fileContexts[existingIndex] = fileContext;
    } else {
      this.fileContexts.push(fileContext);
    }

    this.logger.debug(`[ContextManager] Added file context: ${fileContext.path}`);
    this.events.onFileContextAdded?.(fileContext);
  }

  /**
   * Gets all file contexts
   * 
   * @returns Array of file contexts
   */
  getFileContexts(): FileContext[] {
    return [...this.fileContexts];
  }

  /**
   * Removes a file context
   * 
   * @param path - File path
   */
  removeFileContext(path: string): void {
    this.fileContexts = this.fileContexts.filter(fc => fc.path !== path);
    this.logger.debug(`[ContextManager] Removed file context: ${path}`);
  }

  /**
   * Compresses context using configured strategy
   * 
   * @param strategy - Compression strategy (overrides config)
   * @returns Compression result
   */
  compress(strategy?: CompressionStrategy): CompressedContext {
    const useStrategy = strategy || this.config.compressionStrategy;
    
    this.logger.info(`[ContextManager] Compressing with strategy: ${useStrategy}`);

    switch (useStrategy) {
      case 'micro':
        return this.microCompact();
      case 'auto':
        return this.autoCompact();
      case 'full':
        return this.fullCompact();
      default:
        return this.autoCompact();
    }
  }

  /**
   * MicroCompact - Light compression preserving recent messages
   * 
   * Removes oldest non-essential messages while preserving:
   * - Recent messages (config.preserveRecentMessages)
   * - System messages (if configured)
   * - Tool results (if configured)
   * 
   * @returns Compression result
   */
  microCompact(): CompressedContext {
    const originalTokens = this.estimateTotalTokens();
    const messagesToPreserve = new Set<number>();

    // Always preserve recent messages
    const recentCount = this.config.preserveRecentMessages;
    for (let i = Math.max(0, this.messages.length - recentCount); i < this.messages.length; i++) {
      messagesToPreserve.add(i);
    }

    // Preserve system messages if configured
    if (this.config.preserveSystemMessages) {
      for (let i = 0; i < this.messages.length; i++) {
        if (this.messages[i].role === 'system') {
          messagesToPreserve.add(i);
        }
      }
    }

    // Preserve tool results if configured
    if (this.config.preserveToolResults) {
      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        if (msg.type === 'tool_result') {
          messagesToPreserve.add(i);
          // Also preserve the corresponding tool use
          const toolResult = msg as ToolResultMessage;
          for (let j = 0; j < i; j++) {
            const prevMsg = this.messages[j];
            if (prevMsg.type === 'tool_use' && 
                (prevMsg as ToolUseMessage).toolUseId === toolResult.toolUseId) {
              messagesToPreserve.add(j);
              break;
            }
          }
        }
      }
    }

    // Filter messages
    const preservedMessages: Message[] = [];
    const removedIndices: number[] = [];

    for (let i = 0; i < this.messages.length; i++) {
      if (messagesToPreserve.has(i)) {
        preservedMessages.push(this.messages[i]);
      } else {
        removedIndices.push(i);
      }
    }

    const result: CompressedContext = {
      originalTokens,
      compressedTokens: this.estimateTokensForMessages(preservedMessages),
      compressionRatio: preservedMessages.length / this.messages.length,
      messages: preservedMessages,
      metadata: {
        strategy: 'micro',
        timestamp: new Date(),
        messagesRemoved: removedIndices.length,
      },
    };

    this.applyCompression(result);
    return result;
  }

  /**
   * AutoCompact - Intelligent compression based on relevance
   * 
   * Uses semantic relevance scoring to determine which messages to keep
   * 
   * @returns Compression result
   */
  autoCompact(): CompressedContext {
    const originalTokens = this.estimateTotalTokens();
    const targetTokens = this.config.maxTokens * 0.8; // Target 80% of max

    // Score all messages
    const scoredMessages = this.scoreMessages();

    // Sort by score (higher = more important)
    scoredMessages.sort((a, b) => b.score - a.score);

    // Select messages to keep within token budget
    const selected: Message[] = [];
    let currentTokens = 0;

    for (const scored of scoredMessages) {
      if (currentTokens + scored.tokens <= targetTokens) {
        selected.push(scored.message);
        currentTokens += scored.tokens;
      }
    }

    // Restore original order
    selected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const result: CompressedContext = {
      originalTokens,
      compressedTokens: currentTokens,
      compressionRatio: selected.length / this.messages.length,
      messages: selected,
      metadata: {
        strategy: 'auto',
        timestamp: new Date(),
        messagesRemoved: this.messages.length - selected.length,
      },
    };

    this.applyCompression(result);
    return result;
  }

  /**
   * FullCompact - Aggressive compression with summarization
   * 
   * Summarizes old messages into a single summary message
   * 
   * @returns Compression result
   */
  fullCompact(): CompressedContext {
    const originalTokens = this.estimateTotalTokens();
    const recentCount = this.config.preserveRecentMessages;

    // Split into old and recent messages
    const oldMessages = this.messages.slice(0, -recentCount);
    const recentMessages = this.messages.slice(-recentCount);

    // Generate summary of old messages
    const summary = this.generateSummary(oldMessages);

    // Create summary message
    const summaryMessage: TextMessage = {
      id: `summary_${Date.now()}`,
      type: 'text',
      role: 'system',
      content: `[Context Summary]\n\n${summary}`,
      timestamp: new Date(),
    };

    // Combine summary with recent messages
    const compressedMessages = [summaryMessage, ...recentMessages];

    const result: CompressedContext = {
      originalTokens,
      compressedTokens: this.estimateTokensForMessages(compressedMessages),
      compressionRatio: compressedMessages.length / this.messages.length,
      messages: compressedMessages,
      summary,
      metadata: {
        strategy: 'full',
        timestamp: new Date(),
        messagesRemoved: oldMessages.length,
      },
    };

    this.applyCompression(result);
    return result;
  }

  /**
   * Scores messages by importance
   * 
   * @returns Array of scored messages
   */
  private scoreMessages(): MessageScore[] {
    const scored: MessageScore[] = [];

    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      let score = 0;

      // Base score by message type
      switch (message.type) {
        case 'text':
          score = message.role === 'system' ? 100 : 50;
          break;
        case 'tool_use':
          score = 80;
          break;
        case 'tool_result':
          score = this.config.preserveToolResults ? 70 : 40;
          break;
        default:
          score = 30;
      }

      // Recency bonus (more recent = higher score)
      const recencyBonus = (i / this.messages.length) * 20;
      score += recencyBonus;

      // Content length factor (moderate length preferred)
      const content = this.extractMessageContent(message);
      const length = content.length;
      if (length > 100 && length < 2000) {
        score += 10;
      }

      // Calculate tokens
      const tokens = this.tokenTracker.estimateTokens(content);

      scored.push({ message, score, tokens });
    }

    return scored;
  }

  /**
   * Generates a summary of messages
   * 
   * @param messages - Messages to summarize
   * @returns Summary string
   */
  private generateSummary(messages: Message[]): string {
    // This is a simplified summary generation
    // In production, you'd use an LLM for better summaries
    const parts: string[] = [];

    // Group by conversation topic
    let currentTopic = '';
    let topicMessages: Message[] = [];

    for (const message of messages) {
      const content = this.extractMessageContent(message);
      
      if (message.type === 'tool_use') {
        // Tool use indicates a new topic
        if (topicMessages.length > 0) {
          parts.push(this.summarizeTopic(currentTopic, topicMessages));
        }
        currentTopic = `Used tool: ${(message as ToolUseMessage).toolName}`;
        topicMessages = [message];
      } else if (message.type === 'tool_result') {
        topicMessages.push(message);
      } else {
        topicMessages.push(message);
      }
    }

    if (topicMessages.length > 0) {
      parts.push(this.summarizeTopic(currentTopic, topicMessages));
    }

    return parts.join('\n\n') || 'Previous conversation context';
  }

  /**
   * Summarizes a topic
   * 
   * @param topic - Topic name
   * @param messages - Messages in topic
   * @returns Topic summary
   */
  private summarizeTopic(topic: string, messages: Message[]): string {
    const keyPoints = messages
      .filter(m => m.type === 'text')
      .map(m => this.extractMessageContent(m))
      .filter(c => c.length > 20)
      .slice(0, 3);

    if (topic) {
      return `- ${topic}${keyPoints.length > 0 ? ': ' + keyPoints[0].substring(0, 100) + '...' : ''}`;
    }

    return keyPoints.map(p => `- ${p.substring(0, 100)}...`).join('\n');
  }

  /**
   * Checks if compression is needed and performs it
   */
  private checkAndCompress(): void {
    const totalTokens = this.estimateTotalTokens();
    const usageRatio = totalTokens / this.config.maxTokens;

    if (usageRatio > 0.9) {
      this.logger.warn(`[ContextManager] Token usage at ${Math.round(usageRatio * 100)}%, compressing...`);
      this.events.onBudgetWarning?.(totalTokens, this.config.maxTokens);
      this.compress();
    }
  }

  /**
   * Applies compression result
   * 
   * @param result - Compression result
   */
  private applyCompression(result: CompressedContext): void {
    this.messages = result.messages;
    this.compressionHistory.push(result);

    this.logger.info(
      `[ContextManager] Compressed: ${result.originalTokens} -> ${result.compressedTokens} tokens ` +
      `(${Math.round(result.compressionRatio * 100)}% retained)`
    );

    this.events.onCompression?.(result);
  }

  /**
   * Estimates total tokens for all messages
   * 
   * @returns Total estimated tokens
   */
  private estimateTotalTokens(): number {
    return this.estimateTokensForMessages(this.messages);
  }

  /**
   * Estimates tokens for a set of messages
   * 
   * @param messages - Messages to estimate
   * @returns Estimated tokens
   */
  private estimateTokensForMessages(messages: Message[]): number {
    let total = 0;
    for (const message of messages) {
      const content = this.extractMessageContent(message);
      total += this.tokenTracker.estimateTokens(content);
    }
    return total;
  }

  /**
   * Extracts content from a message
   * 
   * @param message - Message to extract from
   * @returns Content string
   */
  private extractMessageContent(message: Message): string {
    switch (message.type) {
      case 'text':
        return message.content;
      case 'tool_use':
        return `${message.toolName}: ${JSON.stringify(message.toolInput)}`;
      case 'tool_result':
        return message.content;
      case 'image':
        return '[Image]';
      default:
        return '';
    }
  }

  /**
   * Clears all messages
   */
  clearMessages(): void {
    this.messages = [];
    this.logger.info('[ContextManager] Messages cleared');
    this.events.onContextUpdated?.(this.getMessages());
  }

  /**
   * Clears all file contexts
   */
  clearFileContexts(): void {
    this.fileContexts = [];
    this.logger.info('[ContextManager] File contexts cleared');
  }

  /**
   * Gets compression history
   * 
   * @returns Array of compression results
   */
  getCompressionHistory(): CompressedContext[] {
    return [...this.compressionHistory];
  }

  /**
   * Gets current token usage
   * 
   * @returns Token usage
   */
  getTokenUsage(): TokenUsage {
    return this.tokenTracker.getTotalUsage();
  }

  /**
   * Gets context statistics
   * 
   * @returns Statistics
   */
  getStats(): {
    messageCount: number;
    fileContextCount: number;
    totalTokens: number;
    compressionCount: number;
  } {
    return {
      messageCount: this.messages.length,
      fileContextCount: this.fileContexts.length,
      totalTokens: this.estimateTotalTokens(),
      compressionCount: this.compressionHistory.length,
    };
  }

  /**
   * Creates a snapshot of current context
   * 
   * @returns Context snapshot
   */
  createSnapshot(): {
    messages: Message[];
    fileContexts: FileContext[];
    tokenUsage: TokenUsage;
    timestamp: Date;
  } {
    return {
      messages: this.getMessages(),
      fileContexts: this.getFileContexts(),
      tokenUsage: this.getTokenUsage(),
      timestamp: new Date(),
    };
  }

  /**
   * Restores context from snapshot
   * 
   * @param snapshot - Snapshot to restore
   */
  restoreSnapshot(snapshot: {
    messages: Message[];
    fileContexts: FileContext[];
    tokenUsage: TokenUsage;
    timestamp: Date;
  }): void {
    this.messages = [...snapshot.messages];
    this.fileContexts = [...snapshot.fileContexts];
    this.logger.info('[ContextManager] Restored from snapshot');
    this.events.onContextUpdated?.(this.getMessages());
  }

  /**
   * Updates configuration
   * 
   * @param config - Partial configuration update
   */
  updateConfig(config: Partial<ContextManagerConfig>): void {
    Object.assign(this.config, config);
    this.logger.info('[ContextManager] Configuration updated');
  }
}

/**
 * Factory function to create ContextManager instances
 */
export function createContextManager(config: ContextManagerConfig): ContextManager {
  return new ContextManager(config);
}

/**
 * Utility to calculate optimal context window
 * 
 * @param maxTokens - Maximum available tokens
 * @param reservedTokens - Tokens to reserve for output
 * @param safetyMargin - Safety margin percentage
 * @returns Optimal context window size
 */
export function calculateContextWindow(
  maxTokens: number,
  reservedTokens: number = 16000,
  safetyMargin: number = 0.1
): number {
  const available = maxTokens - reservedTokens;
  return Math.floor(available * (1 - safetyMargin));
}

/**
 * Utility to estimate message importance
 * 
 * @param message - Message to evaluate
   * @returns Importance score (0-1)
 */
export function estimateMessageImportance(message: Message): number {
  let score = 0.5;

  // System messages are important
  if (message.role === 'system') {
    score += 0.3;
  }

  // Tool results are moderately important
  if (message.type === 'tool_result') {
    score += 0.2;
  }

  // Recent messages are more important (handled by caller)

  return Math.min(1, score);
}

export default ContextManager;
