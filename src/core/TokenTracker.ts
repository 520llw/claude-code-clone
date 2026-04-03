/**
 * TokenTracker - Token Budgeting and Usage Tracking
 * 
 * This module provides comprehensive token tracking and budget management
 * for LLM interactions. It supports:
 * - Real-time token usage tracking
 * - Budget enforcement with configurable thresholds
 * - Usage history and analytics
 * - Warning and limit notifications
 * 
 * @module TokenTracker
 */

import {
  TokenUsage,
  TokenBudget,
  TokenTrackerState,
  Logger,
  AgentError,
} from '../types/index.js';

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  maxInputTokens: 100000,
  maxOutputTokens: 16000,
  maxTotalTokens: 200000,
  warningThreshold: 0.8,
};

/**
 * Token estimates for different content types
 */
const TOKEN_ESTIMATES = {
  // Average tokens per character for different languages
  charsPerToken: {
    english: 4,
    code: 3.5,
    chinese: 2,
    mixed: 3.5,
  },
  // Overhead tokens for message structure
  messageOverhead: 4,
  // Tool use overhead
  toolUseOverhead: 20,
  // System message overhead
  systemMessageOverhead: 10,
};

/**
 * Events emitted by TokenTracker
 */
export interface TokenTrackerEvents {
  onBudgetWarning?: (usage: TokenUsage, remaining: number) => void;
  onBudgetExceeded?: (usage: TokenUsage, budget: TokenBudget) => void;
  onTokenUpdate?: (usage: TokenUsage) => void;
}

/**
 * Configuration options for TokenTracker
 */
export interface TokenTrackerConfig {
  sessionId: string;
  budget?: Partial<TokenBudget>;
  events?: TokenTrackerEvents;
  logger?: Logger;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

/**
 * TokenTracker class for managing token usage and budgets
 */
export class TokenTracker {
  private sessionId: string;
  private budget: TokenBudget;
  private totalUsage: TokenUsage;
  private history: TokenUsage[];
  private events: TokenTrackerEvents;
  private logger: Logger;
  private enableHistory: boolean;
  private maxHistorySize: number;
  private warningEmitted: boolean;

  /**
   * Creates a new TokenTracker instance
   * 
   * @param config - Configuration options
   */
  constructor(config: TokenTrackerConfig) {
    this.sessionId = config.sessionId;
    this.budget = { ...DEFAULT_TOKEN_BUDGET, ...config.budget };
    this.events = config.events || {};
    this.logger = config.logger || this.createDefaultLogger();
    this.enableHistory = config.enableHistory ?? true;
    this.maxHistorySize = config.maxHistorySize || 1000;
    
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    
    this.history = [];
    this.warningEmitted = false;

    this.logger.info(
      `[TokenTracker] Initialized for session ${this.sessionId} with budget:`,
      this.budget
    );
  }

  /**
   * Creates a default logger if none provided
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
   * Records token usage from an LLM response
   * 
   * @param usage - Token usage from the API
   * @returns The updated total usage
   */
  recordUsage(usage: Partial<TokenUsage>): TokenUsage {
    const normalizedUsage: TokenUsage = {
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      totalTokens: usage.totalTokens || 
        (usage.inputTokens || 0) + (usage.outputTokens || 0),
      cacheReadTokens: usage.cacheReadTokens || 0,
      cacheWriteTokens: usage.cacheWriteTokens || 0,
    };

    // Update total usage
    this.totalUsage.inputTokens += normalizedUsage.inputTokens;
    this.totalUsage.outputTokens += normalizedUsage.outputTokens;
    this.totalUsage.totalTokens += normalizedUsage.totalTokens;
    
    if (normalizedUsage.cacheReadTokens) {
      this.totalUsage.cacheReadTokens = 
        (this.totalUsage.cacheReadTokens || 0) + normalizedUsage.cacheReadTokens;
    }
    
    if (normalizedUsage.cacheWriteTokens) {
      this.totalUsage.cacheWriteTokens = 
        (this.totalUsage.cacheWriteTokens || 0) + normalizedUsage.cacheWriteTokens;
    }

    // Add to history
    if (this.enableHistory) {
      this.history.push({ ...normalizedUsage });
      this.trimHistory();
    }

    // Emit update event
    this.events.onTokenUpdate?.(this.getTotalUsage());

    // Check budget thresholds
    this.checkBudgetThresholds();

    this.logger.debug(
      `[TokenTracker] Recorded usage:`,
      normalizedUsage,
      `Total:`,
      this.totalUsage
    );

    return this.getTotalUsage();
  }

  /**
   * Records estimated token usage for content
   * 
   * @param content - The content to estimate
   * @param type - Content type for estimation
   * @returns Estimated token count
   */
  recordEstimatedUsage(content: string, type: 'input' | 'output' = 'input'): number {
    const estimatedTokens = this.estimateTokens(content);
    
    const usage: TokenUsage = type === 'input'
      ? { inputTokens: estimatedTokens, outputTokens: 0, totalTokens: estimatedTokens }
      : { inputTokens: 0, outputTokens: estimatedTokens, totalTokens: estimatedTokens };

    this.recordUsage(usage);
    return estimatedTokens;
  }

  /**
   * Estimates token count for given content
   * 
   * @param content - Content to estimate
   * @param contentType - Type of content (english, code, chinese, mixed)
   * @returns Estimated token count
   */
  estimateTokens(content: string, contentType: keyof typeof TOKEN_ESTIMATES.charsPerToken = 'mixed'): number {
    if (!content || content.length === 0) {
      return 0;
    }

    const charsPerToken = TOKEN_ESTIMATES.charsPerToken[contentType];
    const baseEstimate = Math.ceil(content.length / charsPerToken);
    
    // Add overhead for message structure
    return baseEstimate + TOKEN_ESTIMATES.messageOverhead;
  }

  /**
   * Estimates tokens for a tool use message
   * 
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @returns Estimated token count
   */
  estimateToolUseTokens(
    toolName: string,
    toolInput: Record<string, unknown>
  ): number {
    const inputJson = JSON.stringify(toolInput);
    const baseEstimate = this.estimateTokens(`${toolName}${inputJson}`, 'code');
    return baseEstimate + TOKEN_ESTIMATES.toolUseOverhead;
  }

  /**
   * Estimates tokens for a tool result
   * 
   * @param result - Tool result content
   * @returns Estimated token count
   */
  estimateToolResultTokens(result: string): number {
    return this.estimateTokens(result, 'mixed') + TOKEN_ESTIMATES.messageOverhead;
  }

  /**
   * Checks if the current usage is within budget
   * 
   * @returns True if within budget
   */
  isWithinBudget(): boolean {
    return this.totalUsage.totalTokens < this.budget.maxTotalTokens;
  }

  /**
   * Gets remaining token budget
   * 
   * @returns Remaining tokens
   */
  getRemainingBudget(): number {
    return Math.max(0, this.budget.maxTotalTokens - this.totalUsage.totalTokens);
  }

  /**
   * Gets current token usage percentage
   * 
   * @returns Usage percentage (0-1)
   */
  getUsagePercentage(): number {
    return this.totalUsage.totalTokens / this.budget.maxTotalTokens;
  }

  /**
   * Gets total token usage
   * 
   * @returns Total usage
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Gets token budget
   * 
   * @returns Current budget
   */
  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  /**
   * Updates token budget
   * 
   * @param budget - New budget (partial)
   */
  updateBudget(budget: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...budget };
    this.logger.info(`[TokenTracker] Budget updated:`, this.budget);
    
    // Reset warning flag to allow new warnings
    this.warningEmitted = false;
    
    // Re-check thresholds
    this.checkBudgetThresholds();
  }

  /**
   * Gets usage history
   * 
   * @returns Array of token usages
   */
  getHistory(): TokenUsage[] {
    return [...this.history];
  }

  /**
   * Gets usage statistics
   * 
   * @returns Usage statistics
   */
  getStatistics(): {
    totalCalls: number;
    averageUsage: TokenUsage;
    maxUsage: TokenUsage;
    minUsage: TokenUsage;
  } {
    if (this.history.length === 0) {
      return {
        totalCalls: 0,
        averageUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        maxUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        minUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const totalCalls = this.history.length;
    
    const sum = this.history.reduce(
      (acc, usage) => ({
        inputTokens: acc.inputTokens + usage.inputTokens,
        outputTokens: acc.outputTokens + usage.outputTokens,
        totalTokens: acc.totalTokens + usage.totalTokens,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    );

    const max = this.history.reduce(
      (acc, usage) => ({
        inputTokens: Math.max(acc.inputTokens, usage.inputTokens),
        outputTokens: Math.max(acc.outputTokens, usage.outputTokens),
        totalTokens: Math.max(acc.totalTokens, usage.totalTokens),
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    );

    const min = this.history.reduce(
      (acc, usage) => ({
        inputTokens: Math.min(acc.inputTokens, usage.inputTokens || Infinity),
        outputTokens: Math.min(acc.outputTokens, usage.outputTokens || Infinity),
        totalTokens: Math.min(acc.totalTokens, usage.totalTokens || Infinity),
      }),
      { inputTokens: Infinity, outputTokens: Infinity, totalTokens: Infinity }
    );

    return {
      totalCalls,
      averageUsage: {
        inputTokens: Math.round(sum.inputTokens / totalCalls),
        outputTokens: Math.round(sum.outputTokens / totalCalls),
        totalTokens: Math.round(sum.totalTokens / totalCalls),
      },
      maxUsage: max,
      minUsage: {
        inputTokens: min.inputTokens === Infinity ? 0 : min.inputTokens,
        outputTokens: min.outputTokens === Infinity ? 0 : min.outputTokens,
        totalTokens: min.totalTokens === Infinity ? 0 : min.totalTokens,
      },
    };
  }

  /**
   * Gets tracker state for persistence
   * 
   * @returns Current state
   */
  getState(): TokenTrackerState {
    return {
      sessionId: this.sessionId,
      totalUsage: this.getTotalUsage(),
      budget: this.getBudget(),
      remainingBudget: this.getRemainingBudget(),
      history: this.enableHistory ? this.getHistory() : [],
    };
  }

  /**
   * Restores tracker state from persisted data
   * 
   * @param state - State to restore
   */
  restoreState(state: TokenTrackerState): void {
    this.totalUsage = { ...state.totalUsage };
    this.budget = { ...state.budget };
    this.history = state.history ? [...state.history] : [];
    
    this.logger.info(`[TokenTracker] State restored for session ${this.sessionId}`);
  }

  /**
   * Resets all tracking data
   */
  reset(): void {
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    this.history = [];
    this.warningEmitted = false;
    
    this.logger.info(`[TokenTracker] Reset for session ${this.sessionId}`);
  }

  /**
   * Validates if a proposed usage would exceed budget
   * 
   * @param estimatedTokens - Estimated tokens to use
   * @returns True if usage would be within budget
   */
  validateProposedUsage(estimatedTokens: number): boolean {
    const projectedTotal = this.totalUsage.totalTokens + estimatedTokens;
    return projectedTotal <= this.budget.maxTotalTokens;
  }

  /**
   * Throws if proposed usage would exceed budget
   * 
   * @param estimatedTokens - Estimated tokens to use
   * @throws AgentError if budget would be exceeded
   */
  assertWithinBudget(estimatedTokens: number): void {
    if (!this.validateProposedUsage(estimatedTokens)) {
      const remaining = this.getRemainingBudget();
      throw new AgentError(
        `Token budget would be exceeded. Required: ${estimatedTokens}, Remaining: ${remaining}`,
        'TOKEN_BUDGET_EXCEEDED',
        false,
        { required: estimatedTokens, remaining, budget: this.budget }
      );
    }
  }

  /**
   * Checks budget thresholds and emits events
   */
  private checkBudgetThresholds(): void {
    const usagePercentage = this.getUsagePercentage();
    const warningThreshold = this.budget.warningThreshold;

    // Check if budget exceeded
    if (this.totalUsage.totalTokens >= this.budget.maxTotalTokens) {
      this.logger.error(
        `[TokenTracker] Budget exceeded: ${this.totalUsage.totalTokens}/${this.budget.maxTotalTokens}`
      );
      this.events.onBudgetExceeded?.(this.getTotalUsage(), this.budget);
      return;
    }

    // Check warning threshold
    if (usagePercentage >= warningThreshold && !this.warningEmitted) {
      this.logger.warn(
        `[TokenTracker] Budget warning: ${Math.round(usagePercentage * 100)}% used`
      );
      this.events.onBudgetWarning?.(this.getTotalUsage(), this.getRemainingBudget());
      this.warningEmitted = true;
    }
  }

  /**
   * Trims history to max size
   */
  private trimHistory(): void {
    if (this.history.length > this.maxHistorySize) {
      const excess = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(excess);
    }
  }

  /**
   * Creates a snapshot of current state
   * 
   * @returns State snapshot
   */
  createSnapshot(): TokenTrackerState {
    return this.getState();
  }

  /**
   * Formats token usage for display
   * 
   * @param usage - Token usage to format
   * @returns Formatted string
   */
  static formatUsage(usage: TokenUsage): string {
    const parts = [
      `Input: ${usage.inputTokens.toLocaleString()}`,
      `Output: ${usage.outputTokens.toLocaleString()}`,
      `Total: ${usage.totalTokens.toLocaleString()}`,
    ];
    
    if (usage.cacheReadTokens) {
      parts.push(`Cache Read: ${usage.cacheReadTokens.toLocaleString()}`);
    }
    
    if (usage.cacheWriteTokens) {
      parts.push(`Cache Write: ${usage.cacheWriteTokens.toLocaleString()}`);
    }
    
    return parts.join(' | ');
  }

  /**
   * Calculates cost based on token usage and pricing
   * 
   * @param usage - Token usage
   * @param inputPrice - Price per 1M input tokens
   * @param outputPrice - Price per 1M output tokens
   * @returns Total cost in USD
   */
  static calculateCost(
    usage: TokenUsage,
    inputPrice: number,
    outputPrice: number
  ): number {
    const inputCost = (usage.inputTokens / 1_000_000) * inputPrice;
    const outputCost = (usage.outputTokens / 1_000_000) * outputPrice;
    return inputCost + outputCost;
  }
}

/**
 * Factory function to create TokenTracker instances
 */
export function createTokenTracker(config: TokenTrackerConfig): TokenTracker {
  return new TokenTracker(config);
}

/**
 * Default pricing for different models
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

export default TokenTracker;
