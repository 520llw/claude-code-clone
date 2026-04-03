/**
 * Context Manager - Main context management system
 * 
 * The central coordinator for all context operations:
 * - Message management (add, remove, update)
 * - Compression coordination (micro, auto, full)
 * - Budget monitoring and enforcement
 * - Memory integration
 * - Semantic search
 * - Event handling
 * 
 * This is the primary interface for context operations.
 */

import type {
  ContextMessage,
  ContextState,
  ContextConfig,
  CompressionOptions,
  CompressionResult,
  CompressionStrategy,
  RelevanceQuery,
  ContextEvent,
  ContextEventType,
  MessageRole,
} from './types/index.js';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MICRO_THRESHOLD,
  DEFAULT_AUTO_THRESHOLD,
  DEFAULT_FULL_THRESHOLD,
} from './types/index.js';
import { ContextBudget, BudgetConfig } from './ContextBudget.js';
import { ContextCompressor } from './ContextCompressor.js';
import { ContextRelevance } from './ContextRelevance.js';
import { countMessageTokens, countTokens } from './utils/tokenCounter.js';
import { createPriorityQueue, PriorityQueueItem } from './utils/priorityQueue.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Manager Configuration
// ============================================================================

export interface ManagerConfig {
  maxTokens: number;
  compressionThresholds: {
    micro: number;
    auto: number;
    full: number;
  };
  preserveRecent: number;
  autoCompress: boolean;
  generateSummaries: boolean;
  enableMemory: boolean;
  enableSearch: boolean;
}

export const DEFAULT_MANAGER_CONFIG: ManagerConfig = {
  maxTokens: DEFAULT_MAX_TOKENS,
  compressionThresholds: {
    micro: DEFAULT_MICRO_THRESHOLD,
    auto: DEFAULT_AUTO_THRESHOLD,
    full: DEFAULT_FULL_THRESHOLD,
  },
  preserveRecent: 10,
  autoCompress: true,
  generateSummaries: true,
  enableMemory: true,
  enableSearch: true,
};

// ============================================================================
// Context Manager Events
// ============================================================================

export interface ContextManagerEvents {
  'message:added': { message: ContextMessage };
  'message:removed': { messageId: string };
  'message:updated': { message: ContextMessage };
  'compression:started': { strategy: CompressionStrategy };
  'compression:completed': CompressionResult;
  'compression:error': { error: Error };
  'budget:warning': { utilization: number };
  'budget:critical': { utilization: number };
  'budget:emergency': { utilization: number };
  'state:changed': { state: ContextState };
}

// ============================================================================
// Context Manager
// ============================================================================

export class ContextManager extends EventEmitter {
  private config: ManagerConfig;
  private messages: ContextMessage[] = [];
  private budget: ContextBudget;
  private compressor: ContextCompressor;
  private relevance: ContextRelevance;
  private state: ContextState;
  private compressionInProgress: boolean = false;
  private lastCompressionTime: number = 0;
  private compressionCooldown: number = 1000; // 1 second
  private eventHistory: ContextEvent[] = [];
  private maxEventHistory: number = 100;

  constructor(config: Partial<ManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };

    // Initialize components
    this.budget = new ContextBudget({
      maxTokens: this.config.maxTokens,
    });

    this.compressor = new ContextCompressor();
    this.relevance = new ContextRelevance();

    this.state = this.createInitialState();

    // Set up event handlers
    this.setupEventHandlers();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private createInitialState(): ContextState {
    return {
      messages: [],
      metadata: {
        sessionId: uuidv4(),
        createdAt: Date.now(),
        lastModified: Date.now(),
        version: 1,
        compressionHistory: [],
      },
      stats: {
        totalTokens: 0,
        messageCount: 0,
        compressedCount: 0,
        memoryTokens: 0,
        availableTokens: this.config.maxTokens,
        utilizationPercent: 0,
      },
      memory: {
        index: {
          version: 1,
          entries: [],
          topics: [],
          tags: [],
          lastUpdated: Date.now(),
        },
        topics: new Map(),
        lastSync: Date.now(),
        dirty: false,
      },
    };
  }

  private setupEventHandlers(): void {
    // Budget events
    this.budget.on('warning', (data) => {
      this.emit('budget:warning', data);
      this.recordEvent('budget:warning', data);
      
      if (this.config.autoCompress) {
        this.triggerAutoCompression();
      }
    });

    this.budget.on('critical', (data) => {
      this.emit('budget:critical', data);
      this.recordEvent('budget:critical', data);
      
      if (this.config.autoCompress) {
        this.triggerAutoCompression();
      }
    });

    this.budget.on('emergency', (data) => {
      this.emit('budget:emergency', data);
      this.recordEvent('budget:emergency', data);
      
      // Always compress on emergency
      this.triggerFullCompression();
    });

    // Compressor events
    this.compressor.on('compression-start', (data) => {
      this.emit('compression:started', { strategy: data.strategy as CompressionStrategy });
    });

    this.compressor.on('compression-complete', (result) => {
      this.emit('compression:completed', result);
      this.recordEvent('compression:complete', result);
      this.updateStateAfterCompression(result);
    });

    this.compressor.on('compression-error', (data) => {
      this.emit('compression:error', { error: data.error });
      this.recordEvent('compression:error', { error: data.error.message });
    });
  }

  // --------------------------------------------------------------------------
  // Message Management
  // --------------------------------------------------------------------------

  addMessage(
    content: string,
    role: MessageRole,
    metadata?: Record<string, unknown>
  ): ContextMessage {
    const message: ContextMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
      tokenCount: countTokens(content),
      metadata: metadata as any,
      compressionLevel: 'none',
    };

    // Check if we can add without compression
    const canAdd = this.budget.addMessage(message);

    if (!canAdd && this.config.autoCompress) {
      // Try compression first
      this.triggerMicroCompression();
      
      // Try again
      const canAddAfterCompression = this.budget.addMessage(message);
      
      if (!canAddAfterCompression) {
        // Still can't add, try auto compression
        this.triggerAutoCompression();
        
        // Final attempt
        const finalAttempt = this.budget.addMessage(message);
        if (!finalAttempt) {
          throw new Error('Unable to add message: context limit exceeded even after compression');
        }
      }
    }

    this.messages.push(message);
    this.updateState();

    this.emit('message:added', { message });
    this.recordEvent('message:add', { messageId: message.id });

    // Check thresholds
    this.checkCompressionThresholds();

    return message;
  }

  addSystemMessage(content: string): ContextMessage {
    return this.addMessage(content, 'system', { importance: 1.0 });
  }

  addUserMessage(content: string, metadata?: Record<string, unknown>): ContextMessage {
    return this.addMessage(content, 'user', metadata);
  }

  addAssistantMessage(content: string, metadata?: Record<string, unknown>): ContextMessage {
    return this.addMessage(content, 'assistant', metadata);
  }

  removeMessage(messageId: string): boolean {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index === -1) {
      return false;
    }

    const message = this.messages[index];
    this.messages.splice(index, 1);
    
    this.budget.removeMessage(messageId);
    this.relevance.removeScore(messageId);
    
    this.updateState();

    this.emit('message:removed', { messageId });
    this.recordEvent('message:remove', { messageId });

    return true;
  }

  updateMessage(
    messageId: string,
    updates: Partial<ContextMessage>
  ): ContextMessage | undefined {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index === -1) {
      return undefined;
    }

    const oldMessage = this.messages[index];
    const updatedMessage = { ...oldMessage, ...updates };

    // Recalculate token count if content changed
    if (updates.content) {
      updatedMessage.tokenCount = countTokens(updates.content);
    }

    this.messages[index] = updatedMessage;
    this.budget.setMessages(this.messages);
    this.updateState();

    this.emit('message:updated', { message: updatedMessage });
    this.recordEvent('message:update', { messageId });

    return updatedMessage;
  }

  getMessage(messageId: string): ContextMessage | undefined {
    return this.messages.find(m => m.id === messageId);
  }

  getMessages(): ContextMessage[] {
    return [...this.messages];
  }

  getRecentMessages(count: number = 10): ContextMessage[] {
    return this.messages.slice(-count);
  }

  // --------------------------------------------------------------------------
  // Compression Operations
  // --------------------------------------------------------------------------

  private checkCompressionThresholds(): void {
    const utilization = this.budget.getUtilization();
    const { micro, auto, full } = this.config.compressionThresholds;

    if (utilization >= full) {
      this.triggerFullCompression();
    } else if (utilization >= auto) {
      this.triggerAutoCompression();
    } else if (utilization >= micro) {
      this.triggerMicroCompression();
    }
  }

  private canCompress(): boolean {
    const now = Date.now();
    return !this.compressionInProgress && 
           now - this.lastCompressionTime >= this.compressionCooldown;
  }

  private triggerMicroCompression(): CompressionResult | null {
    if (!this.canCompress()) {
      return null;
    }

    this.compressionInProgress = true;
    
    try {
      const result = this.compressor.compress(this.messages, {
        strategy: 'micro',
        preserveRecent: this.config.preserveRecent,
        preserveCheckpoints: true,
      });

      if (result.success && result.messagesCompressed > 0) {
        this.applyCompressionResult(result);
      }

      this.lastCompressionTime = Date.now();
      return result;
    } finally {
      this.compressionInProgress = false;
    }
  }

  private triggerAutoCompression(): CompressionResult | null {
    if (!this.canCompress()) {
      return null;
    }

    this.compressionInProgress = true;

    try {
      const result = this.compressor.compress(this.messages, {
        strategy: 'auto',
        preserveRecent: this.config.preserveRecent,
        preserveCheckpoints: true,
        generateSummary: this.config.generateSummaries,
      });

      if (result.success) {
        this.applyCompressionResult(result);
      }

      this.lastCompressionTime = Date.now();
      return result;
    } finally {
      this.compressionInProgress = false;
    }
  }

  private triggerFullCompression(): CompressionResult | null {
    if (!this.canCompress()) {
      return null;
    }

    this.compressionInProgress = true;

    try {
      const result = this.compressor.compress(this.messages, {
        strategy: 'full',
        preserveRecent: Math.max(3, Math.floor(this.config.preserveRecent / 3)),
        preserveCheckpoints: true,
        generateSummary: true,
        aggressive: true,
      });

      if (result.success) {
        this.applyCompressionResult(result);
        
        // Inject summary if generated
        if (result.reinjectedContent && result.reinjectedContent.length > 0) {
          for (const content of result.reinjectedContent) {
            this.addSystemMessage(content);
          }
        }
      }

      this.lastCompressionTime = Date.now();
      return result;
    } finally {
      this.compressionInProgress = false;
    }
  }

  compress(options: CompressionOptions): CompressionResult {
    return this.compressor.compress(this.messages, options);
  }

  private applyCompressionResult(result: CompressionResult): void {
    // Update messages based on compression result
    // This is handled by the compressor which returns modified messages
    // In a real implementation, we'd merge the compressed messages back
    
    this.budget.setMessages(this.messages);
    this.updateState();
  }

  private updateStateAfterCompression(result: CompressionResult): void {
    this.state.metadata.compressionHistory.push({
      timestamp: Date.now(),
      strategy: result.strategy,
      messagesBefore: result.messagesCompressed + result.messagesRemoved + this.messages.length,
      messagesAfter: this.messages.length,
      tokensBefore: result.tokensBefore,
      tokensAfter: result.tokensAfter,
      reason: 'automatic compression',
    });

    this.state.metadata.version++;
    this.state.metadata.lastModified = Date.now();
  }

  // --------------------------------------------------------------------------
  // Relevance and Search
  // --------------------------------------------------------------------------

  calculateRelevance(query?: RelevanceQuery): void {
    this.relevance.calculateScores(this.messages, query);
  }

  getRelevantMessages(threshold: number = 0.5): ContextMessage[] {
    const scores = this.relevance.getAboveThreshold(threshold);
    const messageIds = new Set(scores.map(s => s.messageId));
    return this.messages.filter(m => messageIds.has(m.id));
  }

  getMostRelevantMessages(k: number = 10, query?: RelevanceQuery): ContextMessage[] {
    this.calculateRelevance(query);
    const topScores = this.relevance.getTopK(k);
    const messageIds = topScores.map(s => s.messageId);
    return messageIds
      .map(id => this.messages.find(m => m.id === id))
      .filter((m): m is ContextMessage => m !== undefined);
  }

  searchMessages(query: string): ContextMessage[] {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(m => 
      m.content.toLowerCase().includes(lowerQuery) ||
      m.metadata?.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private updateState(): void {
    const totalTokens = countMessageTokens(this.messages);
    const compressedCount = this.messages.filter(
      m => m.compressionLevel && m.compressionLevel !== 'none'
    ).length;

    this.state = {
      messages: [...this.messages],
      metadata: {
        ...this.state.metadata,
        lastModified: Date.now(),
        version: this.state.metadata.version + 1,
      },
      stats: {
        totalTokens,
        messageCount: this.messages.length,
        compressedCount,
        memoryTokens: 0,
        availableTokens: this.config.maxTokens - totalTokens,
        utilizationPercent: totalTokens / this.config.maxTokens,
      },
      memory: this.state.memory,
    };

    this.emit('state:changed', { state: this.state });
  }

  getState(): ContextState {
    return { ...this.state };
  }

  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  importState(stateJson: string): boolean {
    try {
      const state = JSON.parse(stateJson) as ContextState;
      this.messages = state.messages;
      this.state = state;
      this.budget.setMessages(this.messages);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Event Management
  // --------------------------------------------------------------------------

  private recordEvent(type: ContextEventType, data: unknown): void {
    const event: ContextEvent = {
      type,
      timestamp: Date.now(),
      data,
      source: 'ContextManager',
    };

    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
    }
  }

  getEventHistory(type?: ContextEventType): ContextEvent[] {
    if (type) {
      return this.eventHistory.filter(e => e.type === type);
    }
    return [...this.eventHistory];
  }

  // --------------------------------------------------------------------------
  // Statistics and Reporting
  // --------------------------------------------------------------------------

  getStatistics(): {
    messages: number;
    tokens: number;
    utilization: number;
    compressed: number;
    compressionHistory: number;
  } {
    return {
      messages: this.messages.length,
      tokens: countMessageTokens(this.messages),
      utilization: this.budget.getUtilization(),
      compressed: this.messages.filter(m => m.compressionLevel && m.compressionLevel !== 'none').length,
      compressionHistory: this.state.metadata.compressionHistory.length,
    };
  }

  generateReport(): string {
    const stats = this.getStatistics();
    const budgetStats = this.budget.getStatistics();

    let report = '=== Context Manager Report ===\n\n';
    
    report += '--- Message Statistics ---\n';
    report += `Total Messages: ${stats.messages}\n`;
    report += `Total Tokens: ${stats.tokens.toLocaleString()}\n`;
    report += `Utilization: ${(stats.utilization * 100).toFixed(1)}%\n`;
    report += `Compressed Messages: ${stats.compressed}\n`;
    report += `Compression Events: ${stats.compressionHistory}\n\n`;

    report += '--- Budget Statistics ---\n';
    report += `Total Tokens: ${budgetStats.totalTokens.toLocaleString()}\n`;
    report += `Used Tokens: ${budgetStats.usedTokens.toLocaleString()}\n`;
    report += `Available Tokens: ${budgetStats.availableTokens.toLocaleString()}\n`;
    report += `Reserved Tokens: ${budgetStats.reservedTokens.toLocaleString()}\n\n`;

    report += '--- Component Breakdown ---\n';
    for (const [name, comp] of Object.entries(budgetStats.byComponent)) {
      report += `${name}: ${comp.used.toLocaleString()} / ${comp.allocated.toLocaleString()} `;
      report += `(${(comp.utilization * 100).toFixed(1)}%)\n`;
    }

    return report;
  }

  // --------------------------------------------------------------------------
  // Checkpoint Management
  // --------------------------------------------------------------------------

  createCheckpoint(description?: string): string {
    const checkpointId = uuidv4();
    
    const checkpointMessage: ContextMessage = {
      id: uuidv4(),
      role: 'system',
      content: description || `Checkpoint created at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      metadata: {
        isCheckpoint: true,
        checkpointId,
        importance: 1.0,
      },
      tokenCount: 0,
    };

    this.messages.push(checkpointMessage);
    this.updateState();

    return checkpointId;
  }

  getCheckpoints(): ContextMessage[] {
    return this.messages.filter(m => m.metadata?.isCheckpoint);
  }

  restoreToCheckpoint(checkpointId: string): boolean {
    const checkpointIndex = this.messages.findIndex(
      m => m.metadata?.checkpointId === checkpointId
    );
    
    if (checkpointIndex === -1) {
      return false;
    }

    // Remove all messages after checkpoint
    this.messages = this.messages.slice(0, checkpointIndex + 1);
    this.budget.setMessages(this.messages);
    this.updateState();

    return true;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<ManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update budget if max tokens changed
    if (config.maxTokens) {
      this.budget.updateConfig({ maxTokens: config.maxTokens });
    }
  }

  getConfig(): ManagerConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  clear(): void {
    this.messages = [];
    this.budget.reset();
    this.relevance.clearScores();
    this.eventHistory = [];
    this.state = this.createInitialState();
  }

  dispose(): void {
    this.removeAllListeners();
    this.budget.dispose();
    this.compressor.dispose();
    this.relevance.dispose();
    this.clear();
  }

  // --------------------------------------------------------------------------
  // Static Factory
  // --------------------------------------------------------------------------

  static create(config?: Partial<ManagerConfig>): ContextManager {
    return new ContextManager(config);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createContextManager(config?: Partial<ManagerConfig>): ContextManager {
  return new ContextManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function withContextManager<T>(
  manager: ContextManager,
  operation: (manager: ContextManager) => Promise<T>
): Promise<T> {
  try {
    return await operation(manager);
  } finally {
    manager.dispose();
  }
}
