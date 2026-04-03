/**
 * TokenTracker Unit Tests
 * 
 * Tests for token tracking and budgeting functionality.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { TokenTracker, createTokenTracker, DEFAULT_TOKEN_BUDGET } from '../src/core/TokenTracker.js';
import type { TokenTrackerConfig } from '../src/core/TokenTracker.js';

describe('TokenTracker', () => {
  let tracker: TokenTracker;
  const sessionId = 'test-session';

  beforeEach(() => {
    tracker = createTokenTracker({
      sessionId,
      budget: {
        maxTotalTokens: 10000,
        maxInputTokens: 8000,
        maxOutputTokens: 2000,
        warningThreshold: 0.8,
      },
      enableHistory: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct session ID', () => {
      const state = tracker.getState();
      expect(state.sessionId).toBe(sessionId);
    });

    it('should start with zero usage', () => {
      const usage = tracker.getTotalUsage();
      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
    });

    it('should apply custom budget', () => {
      const budget = tracker.getBudget();
      expect(budget.maxTotalTokens).toBe(10000);
      expect(budget.warningThreshold).toBe(0.8);
    });
  });

  describe('Token Recording', () => {
    it('should record input tokens', () => {
      tracker.recordUsage({ inputTokens: 100 });
      const usage = tracker.getTotalUsage();
      expect(usage.inputTokens).toBe(100);
      expect(usage.totalTokens).toBe(100);
    });

    it('should record output tokens', () => {
      tracker.recordUsage({ outputTokens: 50 });
      const usage = tracker.getTotalUsage();
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(50);
    });

    it('should accumulate multiple usages', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
      tracker.recordUsage({ inputTokens: 200, outputTokens: 100 });
      
      const usage = tracker.getTotalUsage();
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(150);
      expect(usage.totalTokens).toBe(450);
    });

    it('should handle cache tokens', () => {
      tracker.recordUsage({
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 200,
        cacheWriteTokens: 100,
      });
      
      const usage = tracker.getTotalUsage();
      expect(usage.cacheReadTokens).toBe(200);
      expect(usage.cacheWriteTokens).toBe(100);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for English text', () => {
      const text = 'Hello world';
      const estimate = tracker.estimateTokens(text, 'english');
      expect(estimate).toBeGreaterThan(0);
    });

    it('should estimate tokens for code', () => {
      const code = 'const x = 1;';
      const estimate = tracker.estimateTokens(code, 'code');
      expect(estimate).toBeGreaterThan(0);
    });

    it('should return 0 for empty content', () => {
      const estimate = tracker.estimateTokens('');
      expect(estimate).toBe(0);
    });
  });

  describe('Budget Management', () => {
    it('should report within budget when under limit', () => {
      tracker.recordUsage({ totalTokens: 5000 });
      expect(tracker.isWithinBudget()).toBe(true);
    });

    it('should report exceeded budget when over limit', () => {
      tracker.recordUsage({ totalTokens: 15000 });
      expect(tracker.isWithinBudget()).toBe(false);
    });

    it('should calculate remaining budget correctly', () => {
      tracker.recordUsage({ totalTokens: 3000 });
      expect(tracker.getRemainingBudget()).toBe(7000);
    });

    it('should calculate usage percentage', () => {
      tracker.recordUsage({ totalTokens: 5000 });
      expect(tracker.getUsagePercentage()).toBe(0.5);
    });

    it('should validate proposed usage', () => {
      tracker.recordUsage({ totalTokens: 8000 });
      expect(tracker.validateProposedUsage(1000)).toBe(true);
      expect(tracker.validateProposedUsage(3000)).toBe(false);
    });
  });

  describe('History', () => {
    it('should track usage history', () => {
      tracker.recordUsage({ inputTokens: 100 });
      tracker.recordUsage({ inputTokens: 200 });
      
      const history = tracker.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].inputTokens).toBe(100);
      expect(history[1].inputTokens).toBe(200);
    });

    it('should calculate statistics', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
      tracker.recordUsage({ inputTokens: 200, outputTokens: 100 });
      tracker.recordUsage({ inputTokens: 300, outputTokens: 150 });
      
      const stats = tracker.getStatistics();
      expect(stats.totalCalls).toBe(3);
      expect(stats.averageUsage.inputTokens).toBe(200);
      expect(stats.maxUsage.inputTokens).toBe(300);
      expect(stats.minUsage.inputTokens).toBe(100);
    });
  });

  describe('Reset', () => {
    it('should reset all tracking data', () => {
      tracker.recordUsage({ inputTokens: 1000, outputTokens: 500 });
      tracker.reset();
      
      const usage = tracker.getTotalUsage();
      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(tracker.getHistory().length).toBe(0);
    });
  });

  describe('State Persistence', () => {
    it('should create snapshot of state', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 });
      const snapshot = tracker.createSnapshot();
      
      expect(snapshot.sessionId).toBe(sessionId);
      expect(snapshot.totalUsage.inputTokens).toBe(100);
      expect(snapshot.remainingBudget).toBe(9850);
    });

    it('should restore from state', () => {
      const state = {
        sessionId,
        totalUsage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 },
        budget: tracker.getBudget(),
        remainingBudget: 9250,
        history: [{ inputTokens: 500, outputTokens: 250, totalTokens: 750 }],
      };
      
      tracker.restoreState(state);
      
      const usage = tracker.getTotalUsage();
      expect(usage.inputTokens).toBe(500);
      expect(usage.outputTokens).toBe(250);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost correctly', () => {
      const usage = { inputTokens: 1000000, outputTokens: 500000, totalTokens: 1500000 };
      const cost = TokenTracker.calculateCost(usage, 3.0, 15.0);
      
      // Input: 1M * $3 = $3
      // Output: 0.5M * $15 = $7.5
      // Total: $10.5
      expect(cost).toBeCloseTo(10.5, 2);
    });
  });
});
