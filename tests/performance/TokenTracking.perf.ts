/**
 * Token Tracking Performance Tests
 * Performance benchmarks for token tracking operations
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, benchmark, PerformanceTimer } from '../setup';

// ============================================================================
// Token Tracker Implementation for Performance Testing
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

class PerformanceTokenTracker {
  private events: TokenEvent[] = [];
  private budget = { dailyLimit: 100000, perRequestLimit: 10000 };

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
    return event;
  }

  getStats(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    requestCount: number;
  } {
    return this.events.reduce(
      (acc, e) => ({
        totalInputTokens: acc.totalInputTokens + e.usage.inputTokens,
        totalOutputTokens: acc.totalOutputTokens + e.usage.outputTokens,
        totalTokens: acc.totalTokens + e.usage.totalTokens,
        requestCount: acc.requestCount + 1,
      }),
      { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, requestCount: 0 }
    );
  }

  getDailyUsage(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.events
      .filter(e => e.timestamp >= today)
      .reduce((sum, e) => sum + e.usage.totalTokens, 0);
  }

  clear(): void {
    this.events = [];
  }

  getEvents(): TokenEvent[] {
    return [...this.events];
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Token Tracking Performance', () => {
  let tracker: PerformanceTokenTracker;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    tracker = new PerformanceTokenTracker();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Tracking Performance
  // ============================================================================

  describe('Tracking Performance', () => {
    test('should track 1000 events efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        tracker.track({
          inputTokens: 100,
          outputTokens: 50,
        }, 'gpt4', 'completion');
      }

      timer.mark('end');
      const duration = timer.measure('tracking', 'start', 'end');

      expect(tracker.getEvents()).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should track 10000 events efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 10000; i++) {
        tracker.track({
          inputTokens: 100,
          outputTokens: 50,
        }, 'gpt4', 'completion');
      }

      timer.mark('end');
      const duration = timer.measure('tracking', 'start', 'end');

      expect(tracker.getEvents()).toHaveLength(10000);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('benchmark single track operation', async () => {
      const stats = await benchmark(() => {
        tracker.track({ inputTokens: 100, outputTokens: 50 });
      }, 1000);

      expect(stats.mean).toBeLessThan(1); // Less than 1ms per operation
    });
  });

  // ============================================================================
  // Statistics Calculation Performance
  // ============================================================================

  describe('Statistics Calculation Performance', () => {
    beforeEach(() => {
      // Populate with test data
      for (let i = 0; i < 10000; i++) {
        tracker.track({
          inputTokens: Math.floor(Math.random() * 1000),
          outputTokens: Math.floor(Math.random() * 500),
        }, 'gpt4', 'completion');
      }
    });

    test('should calculate stats efficiently for 10k events', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      const stats = tracker.getStats();

      timer.mark('end');
      const duration = timer.measure('stats', 'start', 'end');

      expect(stats.requestCount).toBe(10000);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should calculate daily usage efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      const usage = tracker.getDailyUsage();

      timer.mark('end');
      const duration = timer.measure('daily', 'start', 'end');

      expect(usage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    test('benchmark stats calculation', async () => {
      const stats = await benchmark(() => {
        tracker.getStats();
      }, 100);

      expect(stats.mean).toBeLessThan(10); // Less than 10ms per calculation
    });
  });

  // ============================================================================
  // Memory Usage
  // ============================================================================

  describe('Memory Usage', () => {
    test('should handle large event counts', () => {
      // Track 100k events
      for (let i = 0; i < 100000; i++) {
        tracker.track({
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      const events = tracker.getEvents();
      expect(events).toHaveLength(100000);
    });

    test('should clear efficiently', async () => {
      // Populate tracker
      for (let i = 0; i < 10000; i++) {
        tracker.track({ inputTokens: 100, outputTokens: 50 });
      }

      const timer = new PerformanceTimer();
      timer.mark('start');

      tracker.clear();

      timer.mark('end');
      const duration = timer.measure('clear', 'start', 'end');

      expect(tracker.getEvents()).toHaveLength(0);
      expect(duration).toBeLessThan(10);
    });
  });

  // ============================================================================
  // Concurrent Operations
  // ============================================================================

  describe('Concurrent Operations', () => {
    test('should handle concurrent tracking', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            for (let j = 0; j < 1000; j++) {
              tracker.track({ inputTokens: 100, outputTokens: 50 });
            }
            resolve();
          })
        );
      }

      await Promise.all(promises);

      expect(tracker.getEvents()).toHaveLength(10000);
    });

    test('should handle concurrent stats calculation', async () => {
      // Populate tracker
      for (let i = 0; i < 10000; i++) {
        tracker.track({ inputTokens: 100, outputTokens: 50 });
      }

      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(tracker.getStats())
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.requestCount === 10000)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle zero token events', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        tracker.track({ inputTokens: 0, outputTokens: 0 });
      }

      timer.mark('end');
      const duration = timer.measure('zero', 'start', 'end');

      expect(tracker.getStats().totalTokens).toBe(0);
      expect(duration).toBeLessThan(1000);
    });

    test('should handle very large token counts', () => {
      tracker.track({ inputTokens: 1000000, outputTokens: 500000 });

      const stats = tracker.getStats();
      expect(stats.totalTokens).toBe(1500000);
    });

    test('should handle rapid clear and repopulate', async () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 1000; i++) {
          tracker.track({ inputTokens: 100, outputTokens: 50 });
        }
        tracker.clear();
      }

      expect(tracker.getEvents()).toHaveLength(0);
    });
  });
});
