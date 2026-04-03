/**
 * Context Compression Integration Tests
 * Tests for context window compression with real message flows
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestContext, cleanupTestContext } from '../setup';
import { MockLLMClient, createMockLLM } from '../mocks/MockLLM';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens: number;
  timestamp: number;
}

interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  removedMessages: number;
  summaryAdded: boolean;
}

// ============================================================================
// Mock Context Compression Implementation
// ============================================================================

class ContextCompressor {
  private maxTokens: number;
  private messages: Message[] = [];
  private compressionHistory: CompressionResult[] = [];

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
    this.enforceLimit();

    return fullMessage;
  }

  compress(): CompressionResult {
    const originalTokens = this.getTotalTokens();
    const originalCount = this.messages.length;

    // Keep system message
    const systemMessage = this.messages.find(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');

    // Calculate target: leave room for system + summary + recent messages
    const targetTokens = this.maxTokens * 0.8;
    let currentTokens = systemMessage?.tokens ?? 0;

    // Keep recent messages that fit
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

    // Build compressed message list
    const compressed: Message[] = [];
    if (systemMessage) compressed.push(systemMessage);

    const removedCount = nonSystemMessages.length - keptMessages.length;
    if (removedCount > 0) {
      const summaryMessage: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: `[${removedCount} earlier messages summarized for brevity]`,
        tokens: this.estimateTokens(`[${removedCount} earlier messages summarized for brevity]`),
        timestamp: Date.now(),
      };
      compressed.push(summaryMessage);
    }

    compressed.push(...keptMessages);
    this.messages = compressed;

    const result: CompressionResult = {
      originalTokens,
      compressedTokens: this.getTotalTokens(),
      removedMessages: removedCount,
      summaryAdded: removedCount > 0,
    };

    this.compressionHistory.push(result);
    return result;
  }

  private enforceLimit(): void {
    if (this.getTotalTokens() > this.maxTokens) {
      this.compress();
    }
  }

  getTotalTokens(): number {
    return this.messages.reduce((sum, m) => sum + m.tokens, 0);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getCompressionHistory(): CompressionResult[] {
    return [...this.compressionHistory];
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Integration Test Setup
// ============================================================================

class CompressionIntegration {
  private compressor: ContextCompressor;
  private llm: MockLLMClient;

  constructor(llm: MockLLMClient, maxTokens: number = 4000) {
    this.llm = llm;
    this.compressor = new ContextCompressor(maxTokens);
  }

  async simulateConversation(turns: number): Promise<{
    finalMessageCount: number;
    finalTokenCount: number;
    compressions: CompressionResult[];
  }> {
    for (let i = 0; i < turns; i++) {
      // Add user message
      this.compressor.addMessage({
        role: 'user',
        content: `User message ${i} with some content that takes up tokens`,
      });

      // Add assistant response
      this.compressor.addMessage({
        role: 'assistant',
        content: `Assistant response ${i} with detailed explanation and suggestions for the user`,
      });
    }

    return {
      finalMessageCount: this.compressor.getMessages().length,
      finalTokenCount: this.compressor.getTotalTokens(),
      compressions: this.compressor.getCompressionHistory(),
    };
  }

  async sendToLLM(): Promise<unknown> {
    const messages = this.compressor.getMessages().map(m => ({
      role: m.role,
      content: m.content,
    }));

    return this.llm.complete(messages);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Context Compression Integration', () => {
  let compressor: ContextCompressor;
  let llm: MockLLMClient;
  let integration: CompressionIntegration;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    llm = createMockLLM();
    compressor = new ContextCompressor(1000);
    integration = new CompressionIntegration(llm, 1000);
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Basic Compression Tests
  // ============================================================================

  describe('Basic Compression', () => {
    test('should compress when over limit', () => {
      const smallCompressor = new ContextCompressor(100);
      
      // Add messages that exceed limit
      for (let i = 0; i < 10; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with enough content to use tokens`,
        });
      }

      const messages = smallCompressor.getMessages();
      const totalTokens = smallCompressor.getTotalTokens();

      expect(totalTokens).toBeLessThanOrEqual(100);
      expect(messages.some(m => m.content.includes('summarized'))).toBe(true);
    });

    test('should preserve system message during compression', () => {
      const smallCompressor = new ContextCompressor(100);
      
      smallCompressor.addMessage({
        role: 'system',
        content: 'Important system prompt that must be preserved',
      });

      for (let i = 0; i < 10; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `User message ${i}`,
        });
      }

      const messages = smallCompressor.getMessages();
      const systemMessages = messages.filter(m => m.role === 'system');

      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toContain('system prompt');
    });

    test('should keep recent messages', () => {
      const smallCompressor = new ContextCompressor(150);
      
      for (let i = 0; i < 5; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const messages = smallCompressor.getMessages();
      const lastMessage = messages[messages.length - 1];

      expect(lastMessage.content).toContain('Message 4');
    });

    test('should add summary message', () => {
      const smallCompressor = new ContextCompressor(100);
      
      for (let i = 0; i < 10; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with content`,
        });
      }

      const messages = smallCompressor.getMessages();
      const summaryMessages = messages.filter(m => m.content.includes('summarized'));

      expect(summaryMessages.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Compression Statistics Tests
  // ============================================================================

  describe('Compression Statistics', () => {
    test('should track compression results', () => {
      const smallCompressor = new ContextCompressor(100);
      
      for (let i = 0; i < 10; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with content that uses tokens`,
        });
      }

      const history = smallCompressor.getCompressionHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].originalTokens).toBeGreaterThan(0);
      expect(history[0].compressedTokens).toBeGreaterThan(0);
      expect(history[0].removedMessages).toBeGreaterThan(0);
    });

    test('should report token reduction', () => {
      const smallCompressor = new ContextCompressor(100);
      
      for (let i = 0; i < 10; i++) {
        smallCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with lots of content to fill tokens`,
        });
      }

      const history = smallCompressor.getCompressionHistory();
      const reduction = history[0].originalTokens - history[0].compressedTokens;

      expect(reduction).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Conversation Simulation Tests
  // ============================================================================

  describe('Conversation Simulation', () => {
    test('should simulate multi-turn conversation', async () => {
      const result = await integration.simulateConversation(20);

      expect(result.finalMessageCount).toBeGreaterThan(0);
      expect(result.finalTokenCount).toBeLessThanOrEqual(1000);
    });

    test('should trigger compression during conversation', async () => {
      const result = await integration.simulateConversation(50);

      expect(result.compressions.length).toBeGreaterThan(0);
    });

    test('should maintain conversation flow after compression', async () => {
      const result = await integration.simulateConversation(30);

      // Should have recent messages
      expect(result.finalMessageCount).toBeGreaterThan(2);
    });
  });

  // ============================================================================
  // LLM Integration Tests
  // ============================================================================

  describe('LLM Integration', () => {
    test('should send compressed context to LLM', async () => {
      // Build up context
      await integration.simulateConversation(20);

      // Send to LLM
      const response = await integration.sendToLLM();

      expect(response).toBeDefined();
    });

    test('should handle LLM response after compression', async () => {
      llm.addTextResponse('any', 'Response after compression');

      await integration.simulateConversation(20);
      const response = await integration.sendToLLM();

      expect((response as { content: string }).content).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty context', () => {
      expect(compressor.getTotalTokens()).toBe(0);
      expect(compressor.getMessages()).toHaveLength(0);
    });

    test('should handle single message', () => {
      compressor.addMessage({
        role: 'user',
        content: 'Single message',
      });

      expect(compressor.getMessages()).toHaveLength(1);
    });

    test('should handle messages under limit', () => {
      for (let i = 0; i < 3; i++) {
        compressor.addMessage({
          role: 'user',
          content: 'Short',
        });
      }

      expect(compressor.getCompressionHistory()).toHaveLength(0);
    });

    test('should handle very long messages', () => {
      const longContent = 'a'.repeat(10000);
      
      compressor.addMessage({
        role: 'user',
        content: longContent,
      });

      // Should compress immediately
      expect(compressor.getCompressionHistory().length).toBeGreaterThan(0);
    });

    test('should handle rapid message additions', () => {
      for (let i = 0; i < 100; i++) {
        compressor.addMessage({
          role: 'user',
          content: `Rapid message ${i}`,
        });
      }

      expect(compressor.getTotalTokens()).toBeLessThanOrEqual(1000);
    });

    test('should handle tool messages', () => {
      compressor.addMessage({
        role: 'tool',
        content: '{"result": "tool output"}',
      });

      expect(compressor.getMessages()[0].role).toBe('tool');
    });

    test('should handle assistant messages', () => {
      compressor.addMessage({
        role: 'assistant',
        content: 'Assistant response',
      });

      expect(compressor.getMessages()[0].role).toBe('assistant');
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    test('should compress large contexts efficiently', () => {
      const largeCompressor = new ContextCompressor(10000);
      
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        largeCompressor.addMessage({
          role: 'user',
          content: `Message ${i} with some content`,
        });
      }
      
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(largeCompressor.getTotalTokens()).toBeLessThanOrEqual(10000);
    });

    test('should handle concurrent compression', async () => {
      const compressors: ContextCompressor[] = [];
      
      for (let i = 0; i < 10; i++) {
        compressors.push(new ContextCompressor(500));
      }

      const promises = compressors.map((comp, idx) => {
        for (let j = 0; j < 20; j++) {
          comp.addMessage({
            role: 'user',
            content: `Compressor ${idx} message ${j}`,
          });
        }
        return comp.getTotalTokens();
      });

      const results = await Promise.all(promises);
      
      expect(results.every(tokens => tokens <= 500)).toBe(true);
    });
  });
});
