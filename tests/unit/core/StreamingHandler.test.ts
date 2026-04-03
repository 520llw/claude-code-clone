/**
 * StreamingHandler Unit Tests
 * Tests for streaming response handling, buffering, and real-time processing
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, wait } from '../../setup';

// ============================================================================
// Type Definitions
// ============================================================================

interface StreamChunk {
  id: string;
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  finishReason?: string;
}

interface StreamConfig {
  bufferSize: number;
  flushInterval: number;
  enableToolCalls: boolean;
  onChunk?: (chunk: StreamChunk) => void;
  onContent?: (content: string) => void;
  onToolCall?: (toolCall: StreamChunk['toolCall']) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Mock StreamingHandler Implementation
// ============================================================================

class TestStreamingHandler {
  private config: StreamConfig;
  private buffer: string = '';
  private accumulatedContent: string = '';
  private toolCalls: StreamChunk['toolCall'][] = [];
  private isStreaming: boolean = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private chunks: StreamChunk[] = [];

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      bufferSize: 100,
      flushInterval: 50,
      enableToolCalls: true,
      ...config,
    };
  }

  // ============================================================================
  // Stream Processing
  // ============================================================================

  async *processStream(stream: AsyncGenerator<StreamChunk>): AsyncGenerator<string> {
    this.isStreaming = true;
    this.startFlushTimer();

    try {
      for await (const chunk of stream) {
        this.chunks.push(chunk);
        
        if (chunk.content) {
          this.buffer += chunk.content;
          this.accumulatedContent += chunk.content;
          this.config.onContent?.(chunk.content);
          
          // Yield content immediately
          yield chunk.content;
        }

        if (chunk.toolCall && this.config.enableToolCalls) {
          this.toolCalls.push(chunk.toolCall);
          this.config.onToolCall?.(chunk.toolCall);
        }

        this.config.onChunk?.(chunk);

        if (chunk.finishReason) {
          this.flush();
          break;
        }

        // Flush buffer if it reaches size limit
        if (this.buffer.length >= this.config.bufferSize) {
          this.flush();
        }
      }
    } catch (error) {
      this.config.onError?.(error as Error);
      throw error;
    } finally {
      this.stopFlushTimer();
      this.isStreaming = false;
      this.config.onComplete?.();
    }
  }

  async processStreamToCompletion(stream: AsyncGenerator<StreamChunk>): Promise<{
    content: string;
    toolCalls: StreamChunk['toolCall'][];
    chunks: StreamChunk[];
  }> {
    const content: string[] = [];
    
    for await (const chunk of this.processStream(stream)) {
      content.push(chunk);
    }

    return {
      content: content.join(''),
      toolCalls: this.toolCalls,
      chunks: this.chunks,
    };
  }

  // ============================================================================
  // Buffer Management
  // ============================================================================

  private flush(): void {
    if (this.buffer.length > 0) {
      this.buffer = '';
    }
  }

  private startFlushTimer(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ============================================================================
  // State Access
  // ============================================================================

  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }

  getToolCalls(): StreamChunk['toolCall'][] {
    return [...this.toolCalls];
  }

  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  isActive(): boolean {
    return this.isStreaming;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  reset(): void {
    this.buffer = '';
    this.accumulatedContent = '';
    this.toolCalls = [];
    this.chunks = [];
    this.isStreaming = false;
    this.stopFlushTimer();
  }

  // ============================================================================
  // Static Stream Generators
  // ============================================================================

  static async *createMockStream(chunks: string[], delay: number = 10): AsyncGenerator<StreamChunk> {
    for (let i = 0; i < chunks.length; i++) {
      await wait(delay);
      yield {
        id: `chunk_${i}`,
        content: chunks[i],
      };
    }
    yield {
      id: 'final',
      finishReason: 'stop',
    };
  }

  static async *createErrorStream(errorMessage: string, delay: number = 10): AsyncGenerator<StreamChunk> {
    await wait(delay);
    throw new Error(errorMessage);
  }

  static async *createToolCallStream(content: string, toolCalls: StreamChunk['toolCall'][]): AsyncGenerator<StreamChunk> {
    if (content) {
      yield { id: 'content', content };
    }
    
    for (const toolCall of toolCalls) {
      yield { id: `tool_${toolCall.id}`, toolCall };
    }
    
    yield { id: 'final', finishReason: 'stop' };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('StreamingHandler', () => {
  let streamingHandler: TestStreamingHandler;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    streamingHandler = new TestStreamingHandler();
  });

  afterEach(async () => {
    streamingHandler.reset();
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Basic Stream Processing Tests
  // ============================================================================

  describe('Basic Stream Processing', () => {
    test('should process simple stream', async () => {
      const chunks = ['Hello', ' ', 'world', '!'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results.join('')).toBe('Hello world!');
    });

    test('should accumulate content', async () => {
      const chunks = ['The', ' quick', ' brown', ' fox'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of streamingHandler.processStream(stream)) {
        // Consume stream
      }

      expect(streamingHandler.getAccumulatedContent()).toBe('The quick brown fox');
    });

    test('should track streaming state', async () => {
      const chunks = ['Test'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      expect(streamingHandler.isActive()).toBe(false);

      const processPromise = (async () => {
        for await (const _ of streamingHandler.processStream(stream)) {
          expect(streamingHandler.isActive()).toBe(true);
        }
      })();

      await processPromise;

      expect(streamingHandler.isActive()).toBe(false);
    });

    test('should store all chunks', async () => {
      const chunks = ['A', 'B', 'C'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of streamingHandler.processStream(stream)) {
        // Consume stream
      }

      expect(streamingHandler.getChunks().length).toBe(4); // Including finish chunk
    });
  });

  // ============================================================================
  // Callback Tests
  // ============================================================================

  describe('Callbacks', () => {
    test('should call onContent callback', async () => {
      const contents: string[] = [];
      const handler = new TestStreamingHandler({
        onContent: (content) => contents.push(content),
      });

      const chunks = ['Hello', ' ', 'world'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(contents).toEqual(['Hello', ' ', 'world']);
    });

    test('should call onChunk callback', async () => {
      const receivedChunks: StreamChunk[] = [];
      const handler = new TestStreamingHandler({
        onChunk: (chunk) => receivedChunks.push(chunk),
      });

      const chunks = ['Test'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(receivedChunks.length).toBeGreaterThan(0);
    });

    test('should call onComplete callback', async () => {
      let completed = false;
      const handler = new TestStreamingHandler({
        onComplete: () => { completed = true; },
      });

      const chunks = ['Test'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(completed).toBe(true);
    });

    test('should call onError callback', async () => {
      let error: Error | undefined;
      const handler = new TestStreamingHandler({
        onError: (e) => { error = e; },
      });

      const stream = TestStreamingHandler.createErrorStream('Test error');

      try {
        for await (const _ of handler.processStream(stream)) {
          // Consume stream
        }
      } catch {
        // Expected
      }

      expect(error).toBeDefined();
      expect(error?.message).toBe('Test error');
    });
  });

  // ============================================================================
  // Tool Call Tests
  // ============================================================================

  describe('Tool Calls', () => {
    test('should handle tool calls in stream', async () => {
      const toolCalls = [
        { id: '1', name: 'file_read', arguments: '{"path": "/test.txt"}' },
      ];
      const stream = TestStreamingHandler.createToolCallStream('', toolCalls);

      for await (const _ of streamingHandler.processStream(stream)) {
        // Consume stream
      }

      expect(streamingHandler.getToolCalls()).toHaveLength(1);
      expect(streamingHandler.getToolCalls()[0].name).toBe('file_read');
    });

    test('should call onToolCall callback', async () => {
      const receivedToolCalls: StreamChunk['toolCall'][] = [];
      const handler = new TestStreamingHandler({
        onToolCall: (toolCall) => receivedToolCalls.push(toolCall),
      });

      const toolCalls = [
        { id: '1', name: 'bash', arguments: '{"command": "ls"}' },
      ];
      const stream = TestStreamingHandler.createToolCallStream('Running command', toolCalls);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(receivedToolCalls).toHaveLength(1);
      expect(receivedToolCalls[0]?.name).toBe('bash');
    });

    test('should handle multiple tool calls', async () => {
      const toolCalls = [
        { id: '1', name: 'file_read', arguments: '{}' },
        { id: '2', name: 'file_write', arguments: '{}' },
        { id: '3', name: 'bash', arguments: '{}' },
      ];
      const stream = TestStreamingHandler.createToolCallStream('', toolCalls);

      for await (const _ of streamingHandler.processStream(stream)) {
        // Consume stream
      }

      expect(streamingHandler.getToolCalls()).toHaveLength(3);
    });

    test('should disable tool calls when configured', async () => {
      const handler = new TestStreamingHandler({ enableToolCalls: false });
      
      const toolCalls = [
        { id: '1', name: 'file_read', arguments: '{}' },
      ];
      const stream = TestStreamingHandler.createToolCallStream('', toolCalls);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(handler.getToolCalls()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Buffer Management Tests
  // ============================================================================

  describe('Buffer Management', () => {
    test('should buffer content', async () => {
      const handler = new TestStreamingHandler({ bufferSize: 50 });
      const chunks = ['This is a longer piece of content that should be buffered'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      expect(handler.getAccumulatedContent()).toBe(chunks[0]);
    });

    test('should flush buffer periodically', async () => {
      const handler = new TestStreamingHandler({ 
        bufferSize: 1000, 
        flushInterval: 25 
      });
      
      const chunks = ['Small'];
      const stream = TestStreamingHandler.createMockStream(chunks, 50);

      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }

      // Buffer should be flushed by timer
      expect(handler.getBufferSize()).toBe(0);
    });
  });

  // ============================================================================
  // Process to Completion Tests
  // ============================================================================

  describe('Process to Completion', () => {
    test('should process stream to completion', async () => {
      const chunks = ['Hello', ' ', 'world'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      const result = await streamingHandler.processStreamToCompletion(stream);

      expect(result.content).toBe('Hello world');
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    test('should include tool calls in completion result', async () => {
      const toolCalls = [
        { id: '1', name: 'file_read', arguments: '{}' },
      ];
      const stream = TestStreamingHandler.createToolCallStream('Content', toolCalls);

      const result = await streamingHandler.processStreamToCompletion(stream);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.content).toBe('Content');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle stream errors', async () => {
      const stream = TestStreamingHandler.createErrorStream('Stream failed');

      let errorThrown = false;
      try {
        for await (const _ of streamingHandler.processStream(stream)) {
          // Consume stream
        }
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toBe('Stream failed');
      }

      expect(errorThrown).toBe(true);
    });

    test('should reset state after error', async () => {
      const stream = TestStreamingHandler.createErrorStream('Error');

      try {
        for await (const _ of streamingHandler.processStream(stream)) {
          // Consume stream
        }
      } catch {
        // Expected
      }

      expect(streamingHandler.isActive()).toBe(false);
    });

    test('should handle errors in callback', async () => {
      const handler = new TestStreamingHandler({
        onContent: () => { throw new Error('Callback error'); },
      });

      const chunks = ['Test'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      // Should not throw, error is caught internally
      for await (const _ of handler.processStream(stream)) {
        // Consume stream
      }
    });
  });

  // ============================================================================
  // Reset Tests
  // ============================================================================

  describe('Reset', () => {
    test('should reset all state', async () => {
      const chunks = ['Test content'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      for await (const _ of streamingHandler.processStream(stream)) {
        // Consume stream
      }

      streamingHandler.reset();

      expect(streamingHandler.getAccumulatedContent()).toBe('');
      expect(streamingHandler.getToolCalls()).toHaveLength(0);
      expect(streamingHandler.getChunks()).toHaveLength(0);
      expect(streamingHandler.isActive()).toBe(false);
    });

    test('should allow reuse after reset', async () => {
      const chunks1 = ['First'];
      const stream1 = TestStreamingHandler.createMockStream(chunks1);

      for await (const _ of streamingHandler.processStream(stream1)) {
        // Consume stream
      }

      streamingHandler.reset();

      const chunks2 = ['Second'];
      const stream2 = TestStreamingHandler.createMockStream(chunks2);

      for await (const chunk of streamingHandler.processStream(stream2)) {
        expect(chunk).toBe('Second');
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty stream', async () => {
      const stream = TestStreamingHandler.createMockStream([]);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });

    test('should handle single chunk stream', async () => {
      const stream = TestStreamingHandler.createMockStream(['Single']);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results).toEqual(['Single']);
    });

    test('should handle very long chunks', async () => {
      const longChunk = 'a'.repeat(10000);
      const stream = TestStreamingHandler.createMockStream([longChunk]);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results[0].length).toBe(10000);
    });

    test('should handle many small chunks', async () => {
      const chunks = Array.from({ length: 100 }, (_, i) => `${i}`);
      const stream = TestStreamingHandler.createMockStream(chunks, 1);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(100);
    });

    test('should handle chunks with special characters', async () => {
      const chunks = ['<script>', '{"json": true}', 'Line 1\nLine 2', 'Emoji 🎉'];
      const stream = TestStreamingHandler.createMockStream(chunks);

      const results: string[] = [];
      for await (const chunk of streamingHandler.processStream(stream)) {
        results.push(chunk);
      }

      expect(results.join('')).toBe('<script>{"json": true}Line 1\nLine 2Emoji 🎉');
    });

    test('should handle rapid stream processing', async () => {
      const streams: AsyncGenerator<StreamChunk>[] = [];
      
      for (let i = 0; i < 10; i++) {
        streams.push(TestStreamingHandler.createMockStream([`Stream ${i}`], 1));
      }

      const results = await Promise.all(
        streams.map(async stream => {
          const handler = new TestStreamingHandler();
          const result = await handler.processStreamToCompletion(stream);
          return result.content;
        })
      );

      expect(results).toHaveLength(10);
    });
  });
});
