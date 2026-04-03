/**
 * Context Compression Performance Tests
 * Performance benchmarks for context compression operations
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, benchmark, PerformanceTimer } from '../setup';

// ============================================================================
// Context Compressor Implementation for Performance Testing
// ============================================================================

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens: number;
  timestamp: number;
}

class PerformanceContextCompressor {
  private maxTokens: number;
  private messages: Message[] = [];

  constructor(maxTokens: number = 4000) {
    this.maxTokens = maxTokens;
  }

  addMessage(message: Omit<Message, 'id' | 'tokens' | 'timestamp'>): Message {
    const fullMessage: Message = {
      ...message,
      id: this.generateId(),
      tokens: this.estimateTokens(message.content),
      timestamp: Date.now(),
    };

    this.messages.push(fullMessage);
    
    if (this.getTotalTokens() > this.maxTokens) {
      this.compress();
    }

    return fullMessage;
  }

  compress(): { removed: number; remaining: number } {
    const systemMessage = this.messages.find(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');

    const targetTokens = this.maxTokens * 0.8;
    let currentTokens = systemMessage?.tokens ?? 0;

    const keptMessages: Message[] = [];
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i];
      if (currentTokens + msg.tokens <= targetTokens) {
        keptMessages.unshift(msg);
        currentTokens += msg.tokens;
      } else {
        break;
      }
    }

    const compressed: Message[] = [];
    if (systemMessage) compressed.push(systemMessage);
    compressed.push(...keptMessages);

    const removed = this.messages.length - compressed.length;
    this.messages = compressed;

    return { removed, remaining: this.messages.length };
  }

  getTotalTokens(): number {
    return this.messages.reduce((sum, m) => sum + m.tokens, 0);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Context Compression Performance', () => {
  let compressor: PerformanceContextCompressor;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    compressor = new PerformanceContextCompressor(10000);
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Message Addition Performance
  // ============================================================================

  describe('Message Addition Performance', () => {
    test('should add 1000 messages efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i} with some content to estimate tokens`,
        });
      }

      timer.mark('end');
      const duration = timer.measure('add', 'start', 'end');

      expect(compressor.getMessages().length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000);
    });

    test('should add 10000 messages efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 10000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      timer.mark('end');
      const duration = timer.measure('add', 'start', 'end');

      expect(duration).toBeLessThan(10000);
    });

    test('benchmark single message addition', async () => {
      const stats = await benchmark(() => {
        compressor.addMessage({
          role: 'user',
          content: 'Test message',
        });
      }, 1000);

      expect(stats.mean).toBeLessThan(2);
    });
  });

  // ============================================================================
  // Compression Performance
  // ============================================================================

  describe('Compression Performance', () => {
    beforeEach(() => {
      // Populate with messages that will trigger compression
      for (let i = 0; i < 5000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i} with content that takes up some tokens for compression testing`,
        });
      }
    });

    test('should compress efficiently', async () => {
      const newCompressor = new PerformanceContextCompressor(1000);
      
      // Add messages that exceed limit
      for (let i = 0; i < 100; i++) {
        newCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with enough content to trigger compression when limit is reached`,
        });
      }

      const timer = new PerformanceTimer();
      timer.mark('start');

      const result = newCompressor.compress();

      timer.mark('end');
      const duration = timer.measure('compress', 'start', 'end');

      expect(result.removed).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    test('benchmark compression operation', async () => {
      const stats = await benchmark(() => {
        const comp = new PerformanceContextCompressor(1000);
        for (let i = 0; i < 100; i++) {
          comp.addMessage({
            role: 'user',
            content: `Message ${i} with content that will need compression`,
          });
        }
        return comp.compress();
      }, 100);

      expect(stats.mean).toBeLessThan(50);
    });
  });

  // ============================================================================
  // Token Counting Performance
  // ============================================================================

  describe('Token Counting Performance', () => {
    beforeEach(() => {
      for (let i = 0; i < 10000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }
    });

    test('should count tokens efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      const tokens = compressor.getTotalTokens();

      timer.mark('end');
      const duration = timer.measure('count', 'start', 'end');

      expect(tokens).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50);
    });

    test('benchmark token counting', async () => {
      const stats = await benchmark(() => {
        return compressor.getTotalTokens();
      }, 1000);

      expect(stats.mean).toBeLessThan(1);
    });
  });

  // ============================================================================
  // Memory Usage
  // ============================================================================

  describe('Memory Usage', () => {
    test('should handle 50000 messages', () => {
      for (let i = 0; i < 50000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const messages = compressor.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(compressor.getTotalTokens()).toBeLessThanOrEqual(10000);
    });

    test('should handle very long messages', () => {
      const longContent = 'a'.repeat(100000);
      
      compressor.addMessage({
        role: 'user',
        content: longContent,
      });

      expect(compressor.getMessages().length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Concurrent Operations
  // ============================================================================

  describe('Concurrent Operations', () => {
    test('should handle concurrent message additions', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            for (let j = 0; j < 1000; j++) {
              compressor.addMessage({
                role: 'user',
                content: `Thread ${i} Message ${j}`,
              });
            }
            resolve();
          })
        );
      }

      await Promise.all(promises);

      expect(compressor.getMessages().length).toBeGreaterThan(0);
    });

    test('should handle concurrent token counting', async () => {
      for (let i = 0; i < 10000; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(compressor.getTotalTokens())
      );

      const results = await Promise.all(promises);
      expect(results.every(r => r > 0)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty messages', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        compressor.addMessage({
          role: 'user',
          content: '',
        });
      }

      timer.mark('end');
      const duration = timer.measure('empty', 'start', 'end');

      expect(duration).toBeLessThan(1000);
    });

    test('should handle rapid compression cycles', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let cycle = 0; cycle < 100; cycle++) {
        const comp = new PerformanceContextCompressor(1000);
        for (let i = 0; i < 50; i++) {
          comp.addMessage({
            role: 'user',
            content: `Cycle ${cycle} Message ${i} with content`,
          });
        }
        comp.compress();
      }

      timer.mark('end');
      const duration = timer.measure('cycles', 'start', 'end');

      expect(duration).toBeLessThan(5000);
    });
  });
});
