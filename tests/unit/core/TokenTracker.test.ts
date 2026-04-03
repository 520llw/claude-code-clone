/**
 * TokenTracker Unit Tests
 * Tests for token usage tracking, budgeting, and analytics
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext } from '../../setup';

// ============================================================================
// Type Definitions
// ============================================================================

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface TokenEvent {
  timestamp: number;
  usage: TokenUsage;
  model: string;
  operation: string;
}

interface TokenBudget {
  dailyLimit: number;
  perRequestLimit: number;
  warningThreshold: number;
}

interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  averagePerRequest: number;
  modelBreakdown: Record<string, TokenUsage>;
}

// ============================================================================
// Mock TokenTracker Implementation
// ============================================================================

class TestTokenTracker {
  private events: TokenEvent[] = [];
  private budget: TokenBudget;
  private warnings: string[] = [];
  private listeners: Array<(event: string, data: unknown) => void> = [];

  constructor(budget: Partial<TokenBudget> = {}) {
    this.budget = {
      dailyLimit: 100000,
      perRequestLimit: 10000,
      warningThreshold: 0.8,
      ...budget,
    };
  }

  // ============================================================================
  // Token Tracking
  // ============================================================================

  track(usage: Partial<TokenUsage>, model: string = 'default', operation: string = 'unknown'): TokenEvent {
    const fullUsage: TokenUsage = {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    };

    const event: TokenEvent = {
      timestamp: Date.now(),
      usage: fullUsage,
      model,
      operation,
    };

    this.events.push(event);
    this.emit('tokenUsed', event);

    // Check budget
    this.checkBudget(event);

    return event;
  }

  trackInput(tokens: number, model: string = 'default', operation: string = 'unknown'): TokenEvent {
    return this.track({ inputTokens: tokens }, model, operation);
  }

  trackOutput(tokens: number, model: string = 'default', operation: string = 'unknown'): TokenEvent {
    return this.track({ outputTokens: tokens }, model, operation);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): TokenStats {
    const stats: TokenStats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      requestCount: this.events.length,
      averagePerRequest: 0,
      modelBreakdown: {},
    };

    for (const event of this.events) {
      stats.totalInputTokens += event.usage.inputTokens;
      stats.totalOutputTokens += event.usage.outputTokens;
      stats.totalTokens += event.usage.totalTokens;

      // Model breakdown
      if (!stats.modelBreakdown[event.model]) {
        stats.modelBreakdown[event.model] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        };
      }
      stats.modelBreakdown[event.model].inputTokens += event.usage.inputTokens;
      stats.modelBreakdown[event.model].outputTokens += event.usage.outputTokens;
      stats.modelBreakdown[event.model].totalTokens += event.usage.totalTokens;
    }

    if (stats.requestCount > 0) {
      stats.averagePerRequest = stats.totalTokens / stats.requestCount;
    }

    return stats;
  }

  getDailyUsage(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.events
      .filter(e => e.timestamp >= today)
      .reduce((sum, e) => sum + e.usage.totalTokens, 0);
  }

  getUsageByModel(model: string): TokenUsage {
    return this.events
      .filter(e => e.model === model)
      .reduce(
        (acc, e) => ({
          inputTokens: acc.inputTokens + e.usage.inputTokens,
          outputTokens: acc.outputTokens + e.usage.outputTokens,
          totalTokens: acc.totalTokens + e.usage.totalTokens,
        }),
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      );
  }

  getUsageByOperation(operation: string): TokenUsage {
    return this.events
      .filter(e => e.operation === operation)
      .reduce(
        (acc, e) => ({
          inputTokens: acc.inputTokens + e.usage.inputTokens,
          outputTokens: acc.outputTokens + e.usage.outputTokens,
          totalTokens: acc.totalTokens + e.usage.totalTokens,
        }),
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      );
  }

  // ============================================================================
  // Budget Management
  // ============================================================================

  private checkBudget(event: TokenEvent): void {
    const dailyUsage = this.getDailyUsage();
    const dailyRatio = dailyUsage / this.budget.dailyLimit;

    if (dailyRatio >= 1) {
      this.warn('Daily token budget exceeded');
    } else if (dailyRatio >= this.budget.warningThreshold) {
      this.warn(`Daily token usage at ${(dailyRatio * 100).toFixed(1)}%`);
    }

    if (event.usage.totalTokens > this.budget.perRequestLimit) {
      this.warn(`Per-request token limit exceeded: ${event.usage.totalTokens} > ${this.budget.perRequestLimit}`);
    }
  }

  setBudget(budget: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...budget };
    this.emit('budgetUpdated', this.budget);
  }

  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  getRemainingBudget(): number {
    return Math.max(0, this.budget.dailyLimit - this.getDailyUsage());
  }

  isOverBudget(): boolean {
    return this.getDailyUsage() > this.budget.dailyLimit;
  }

  // ============================================================================
  // Warnings
  // ============================================================================

  private warn(message: string): void {
    this.warnings.push(message);
    this.emit('warning', message);
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  clearWarnings(): void {
    this.warnings = [];
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on(event: string, listener: (data: unknown) => void): () => void {
    const wrappedListener = (e: string, d: unknown) => {
      if (e === event) listener(d);
    };
    this.listeners.push(wrappedListener);
    
    return () => {
      const index = this.listeners.indexOf(wrappedListener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  // ============================================================================
  // Data Management
  // ============================================================================

  getEvents(): TokenEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    this.warnings = [];
    this.emit('cleared', null);
  }

  export(): string {
    return JSON.stringify({
      events: this.events,
      budget: this.budget,
      stats: this.getStats(),
    }, null, 2);
  }

  import(data: string): void {
    const parsed = JSON.parse(data);
    this.events = parsed.events || [];
    if (parsed.budget) {
      this.budget = parsed.budget;
    }
  }

  // ============================================================================
  // Estimation
  // ============================================================================

  estimateTokens(text: string, model: string = 'default'): number {
    // Simple estimation: ~4 characters per token
    // More accurate models can be added
    const estimations: Record<string, (text: string) => number> = {
      default: (t) => Math.ceil(t.length / 4),
      gpt4: (t) => Math.ceil(t.length / 3.5),
      claude: (t) => Math.ceil(t.length / 3.8),
    };

    const estimator = estimations[model] || estimations.default;
    return estimator(text);
  }

  estimateCost(usage: TokenUsage, model: string = 'default'): number {
    // Cost per 1K tokens (example rates)
    const rates: Record<string, { input: number; output: number }> = {
      default: { input: 0.0015, output: 0.002 },
      gpt4: { input: 0.03, output: 0.06 },
      claude: { input: 0.008, output: 0.024 },
    };

    const rate = rates[model] || rates.default;
    const inputCost = (usage.inputTokens / 1000) * rate.input;
    const outputCost = (usage.outputTokens / 1000) * rate.output;

    return inputCost + outputCost;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TokenTracker', () => {
  let tokenTracker: TestTokenTracker;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    tokenTracker = new TestTokenTracker();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Token Tracking Tests
  // ============================================================================

  describe('Token Tracking', () => {
    test('should track token usage', () => {
      const event = tokenTracker.track({
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(event.usage.inputTokens).toBe(100);
      expect(event.usage.outputTokens).toBe(50);
      expect(event.usage.totalTokens).toBe(150);
    });

    test('should calculate total tokens automatically', () => {
      const event = tokenTracker.track({
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(event.usage.totalTokens).toBe(150);
    });

    test('should track input tokens only', () => {
      const event = tokenTracker.trackInput(200, 'gpt4', 'completion');

      expect(event.usage.inputTokens).toBe(200);
      expect(event.usage.outputTokens).toBe(0);
    });

    test('should track output tokens only', () => {
      const event = tokenTracker.trackOutput(150, 'claude', 'streaming');

      expect(event.usage.inputTokens).toBe(0);
      expect(event.usage.outputTokens).toBe(150);
    });

    test('should include model and operation info', () => {
      const event = tokenTracker.track(
        { inputTokens: 100, outputTokens: 50 },
        'gpt4',
        'chat_completion'
      );

      expect(event.model).toBe('gpt4');
      expect(event.operation).toBe('chat_completion');
    });

    test('should emit token used event', () => {
      let eventData: unknown;
      tokenTracker.on('tokenUsed', (data) => { eventData = data; });

      const event = tokenTracker.track({ inputTokens: 100 });

      expect(eventData).toBeDefined();
      expect((eventData as TokenEvent).usage.inputTokens).toBe(100);
    });

    test('should track multiple events', () => {
      tokenTracker.track({ inputTokens: 100, outputTokens: 50 });
      tokenTracker.track({ inputTokens: 200, outputTokens: 100 });
      tokenTracker.track({ inputTokens: 300, outputTokens: 150 });

      const events = tokenTracker.getEvents();
      expect(events).toHaveLength(3);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    test('should calculate total stats', () => {
      tokenTracker.track({ inputTokens: 100, outputTokens: 50 });
      tokenTracker.track({ inputTokens: 200, outputTokens: 100 });

      const stats = tokenTracker.getStats();

      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
      expect(stats.totalTokens).toBe(450);
    });

    test('should calculate request count', () => {
      tokenTracker.track({ inputTokens: 100 });
      tokenTracker.track({ inputTokens: 200 });
      tokenTracker.track({ inputTokens: 300 });

      const stats = tokenTracker.getStats();
      expect(stats.requestCount).toBe(3);
    });

    test('should calculate average per request', () => {
      tokenTracker.track({ totalTokens: 100 });
      tokenTracker.track({ totalTokens: 200 });
      tokenTracker.track({ totalTokens: 300 });

      const stats = tokenTracker.getStats();
      expect(stats.averagePerRequest).toBe(200);
    });

    test('should provide model breakdown', () => {
      tokenTracker.track({ inputTokens: 100 }, 'gpt4');
      tokenTracker.track({ inputTokens: 200 }, 'claude');
      tokenTracker.track({ inputTokens: 300 }, 'gpt4');

      const stats = tokenTracker.getStats();
      expect(stats.modelBreakdown.gpt4.totalTokens).toBe(400);
      expect(stats.modelBreakdown.claude.totalTokens).toBe(200);
    });

    test('should get usage by model', () => {
      tokenTracker.track({ inputTokens: 100, outputTokens: 50 }, 'gpt4');
      tokenTracker.track({ inputTokens: 200, outputTokens: 100 }, 'gpt4');

      const usage = tokenTracker.getUsageByModel('gpt4');
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(150);
    });

    test('should get usage by operation', () => {
      tokenTracker.track({ inputTokens: 100 }, 'default', 'completion');
      tokenTracker.track({ inputTokens: 200 }, 'default', 'completion');
      tokenTracker.track({ inputTokens: 300 }, 'default', 'embedding');

      const usage = tokenTracker.getUsageByOperation('completion');
      expect(usage.inputTokens).toBe(300);
    });

    test('should handle empty stats', () => {
      const stats = tokenTracker.getStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.averagePerRequest).toBe(0);
    });
  });

  // ============================================================================
  // Budget Management Tests
  // ============================================================================

  describe('Budget Management', () => {
    test('should track daily usage', () => {
      tokenTracker.track({ totalTokens: 1000 });
      tokenTracker.track({ totalTokens: 2000 });

      expect(tokenTracker.getDailyUsage()).toBe(3000);
    });

    test('should get remaining budget', () => {
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 10000 });
      budgetedTracker.track({ totalTokens: 3000 });

      expect(budgetedTracker.getRemainingBudget()).toBe(7000);
    });

    test('should detect over budget', () => {
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 1000 });
      budgetedTracker.track({ totalTokens: 1500 });

      expect(budgetedTracker.isOverBudget()).toBe(true);
    });

    test('should warn at threshold', () => {
      const budgetedTracker = new TestTokenTracker({ 
        dailyLimit: 1000, 
        warningThreshold: 0.5 
      });
      
      budgetedTracker.track({ totalTokens: 600 });

      expect(budgetedTracker.getWarnings().length).toBeGreaterThan(0);
    });

    test('should warn when exceeding daily limit', () => {
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 1000 });
      budgetedTracker.track({ totalTokens: 1200 });

      const warnings = budgetedTracker.getWarnings();
      expect(warnings.some(w => w.includes('exceeded'))).toBe(true);
    });

    test('should warn when exceeding per-request limit', () => {
      const budgetedTracker = new TestTokenTracker({ perRequestLimit: 1000 });
      budgetedTracker.track({ totalTokens: 1500 });

      const warnings = budgetedTracker.getWarnings();
      expect(warnings.some(w => w.includes('Per-request'))).toBe(true);
    });

    test('should update budget', () => {
      tokenTracker.setBudget({ dailyLimit: 50000 });

      expect(tokenTracker.getBudget().dailyLimit).toBe(50000);
    });

    test('should emit budget updated event', () => {
      let eventData: unknown;
      tokenTracker.on('budgetUpdated', (data) => { eventData = data; });

      tokenTracker.setBudget({ dailyLimit: 50000 });

      expect(eventData).toBeDefined();
    });
  });

  // ============================================================================
  // Warning Tests
  // ============================================================================

  describe('Warnings', () => {
    test('should get warnings', () => {
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 1000 });
      budgetedTracker.track({ totalTokens: 1500 });

      expect(budgetedTracker.getWarnings().length).toBeGreaterThan(0);
    });

    test('should clear warnings', () => {
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 1000 });
      budgetedTracker.track({ totalTokens: 1500 });
      budgetedTracker.clearWarnings();

      expect(budgetedTracker.getWarnings()).toHaveLength(0);
    });

    test('should emit warning event', () => {
      let warningMessage: unknown;
      const budgetedTracker = new TestTokenTracker({ dailyLimit: 1000 });
      budgetedTracker.on('warning', (data) => { warningMessage = data; });

      budgetedTracker.track({ totalTokens: 1500 });

      expect(warningMessage).toBeDefined();
    });
  });

  // ============================================================================
  // Data Management Tests
  // ============================================================================

  describe('Data Management', () => {
    test('should get all events', () => {
      tokenTracker.track({ totalTokens: 100 });
      tokenTracker.track({ totalTokens: 200 });

      const events = tokenTracker.getEvents();
      expect(events).toHaveLength(2);
    });

    test('should clear all data', () => {
      tokenTracker.track({ totalTokens: 100 });
      tokenTracker.track({ totalTokens: 200 });
      tokenTracker.clear();

      expect(tokenTracker.getEvents()).toHaveLength(0);
      expect(tokenTracker.getStats().totalTokens).toBe(0);
    });

    test('should emit cleared event', () => {
      let emitted = false;
      tokenTracker.on('cleared', () => { emitted = true; });

      tokenTracker.clear();

      expect(emitted).toBe(true);
    });

    test('should export data', () => {
      tokenTracker.track({ totalTokens: 100 }, 'gpt4');
      
      const exported = tokenTracker.export();
      const parsed = JSON.parse(exported);

      expect(parsed.events).toHaveLength(1);
      expect(parsed.stats.totalTokens).toBe(100);
    });

    test('should import data', () => {
      const data = JSON.stringify({
        events: [
          { timestamp: 1, usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, model: 'gpt4', operation: 'test' },
        ],
        budget: { dailyLimit: 50000, perRequestLimit: 5000, warningThreshold: 0.9 },
      });

      tokenTracker.import(data);

      expect(tokenTracker.getEvents()).toHaveLength(1);
      expect(tokenTracker.getBudget().dailyLimit).toBe(50000);
    });
  });

  // ============================================================================
  // Estimation Tests
  // ============================================================================

  describe('Estimation', () => {
    test('should estimate tokens from text', () => {
      const tokens = tokenTracker.estimateTokens('Hello world');
      expect(tokens).toBe(3); // 11 chars / 4 = 3
    });

    test('should estimate tokens for different models', () => {
      const text = 'Hello world test';
      
      const defaultTokens = tokenTracker.estimateTokens(text, 'default');
      const gpt4Tokens = tokenTracker.estimateTokens(text, 'gpt4');
      const claudeTokens = tokenTracker.estimateTokens(text, 'claude');

      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(claudeTokens).toBeGreaterThan(0);
      expect(defaultTokens).not.toEqual(gpt4Tokens);
    });

    test('should estimate cost', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const cost = tokenTracker.estimateCost(usage, 'gpt4');
      expect(cost).toBeGreaterThan(0);
    });

    test('should estimate cost for different models', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const defaultCost = tokenTracker.estimateCost(usage, 'default');
      const gpt4Cost = tokenTracker.estimateCost(usage, 'gpt4');

      expect(gpt4Cost).toBeGreaterThan(defaultCost);
    });
  });

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('Event Handling', () => {
    test('should subscribe to events', () => {
      const events: string[] = [];
      tokenTracker.on('tokenUsed', () => events.push('used'));

      tokenTracker.track({ totalTokens: 100 });

      expect(events).toContain('used');
    });

    test('should unsubscribe from events', () => {
      const events: string[] = [];
      const unsubscribe = tokenTracker.on('tokenUsed', () => events.push('used'));

      unsubscribe();
      tokenTracker.track({ totalTokens: 100 });

      expect(events).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle zero tokens', () => {
      const event = tokenTracker.track({ totalTokens: 0 });
      expect(event.usage.totalTokens).toBe(0);
    });

    test('should handle very large token counts', () => {
      const event = tokenTracker.track({ totalTokens: 1000000000 });
      expect(event.usage.totalTokens).toBe(1000000000);
    });

    test('should handle negative tokens gracefully', () => {
      const event = tokenTracker.track({ totalTokens: -100 });
      expect(event.usage.totalTokens).toBe(-100);
    });

    test('should handle rapid tracking', () => {
      for (let i = 0; i < 1000; i++) {
        tokenTracker.track({ totalTokens: i });
      }

      expect(tokenTracker.getEvents()).toHaveLength(1000);
    });

    test('should handle empty text estimation', () => {
      const tokens = tokenTracker.estimateTokens('');
      expect(tokens).toBe(0);
    });

    test('should handle unknown model gracefully', () => {
      const tokens = tokenTracker.estimateTokens('test', 'unknown-model');
      expect(tokens).toBeGreaterThanOrEqual(0);
    });
  });
});
