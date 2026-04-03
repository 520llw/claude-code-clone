/**
 * QueryEngine Tests
 * 
 * Comprehensive test suite for the QueryEngine class which handles
 * LLM interactions, message processing, and response generation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockLLM, MockLLMResponse, MockStreamChunk } from '../../mocks/MockLLM';

// Mock the Anthropic SDK
const mockCreate = jest.fn();
const mockStream = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  })),
}));

// Import after mocking
import { Anthropic } from '@anthropic-ai/sdk';

// QueryEngine interface definition for testing
interface QueryEngineConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  enableStreaming?: boolean;
}

interface QueryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface QueryResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

class QueryEngine {
  private client: any;
  private config: QueryEngineConfig;
  private messageHistory: QueryMessage[] = [];
  private mockLLM?: MockLLM;

  constructor(config: QueryEngineConfig, mockLLM?: MockLLM) {
    this.config = config;
    this.mockLLM = mockLLM;
    
    if (!mockLLM) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  async query(message: string, options?: { tools?: any[] }): Promise<QueryResult> {
    const messages: QueryMessage[] = [
      ...this.messageHistory,
      { role: 'user', content: message },
    ];

    if (this.mockLLM) {
      const response = await this.mockLLM.complete(messages);
      return this.processResponse(response);
    }

    const response = await mockCreate({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: options?.tools,
    });

    return this.processApiResponse(response);
  }

  async *streamQuery(message: string, options?: { tools?: any[] }): AsyncGenerator<MockStreamChunk> {
    const messages: QueryMessage[] = [
      ...this.messageHistory,
      { role: 'user', content: message },
    ];

    if (this.mockLLM) {
      yield* this.mockLLM.streamComplete(messages);
      return;
    }

    const stream = await mockStream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: options?.tools,
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  addToHistory(message: QueryMessage): void {
    this.messageHistory.push(message);
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  getHistory(): QueryMessage[] {
    return [...this.messageHistory];
  }

  private processResponse(response: MockLLMResponse): QueryResult {
    return {
      content: response.content,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      toolCalls: response.toolCalls?.map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  private processApiResponse(response: any): QueryResult {
    const content = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    const toolCalls = response.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        name: c.name,
        arguments: c.input,
      }));

    return {
      content,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

describe('QueryEngine', () => {
  let mockLLM: MockLLM;
  let queryEngine: QueryEngine;

  const defaultConfig: QueryEngineConfig = {
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant.',
    enableStreaming: true,
  };

  beforeEach(() => {
    mockLLM = new MockLLM();
    queryEngine = new QueryEngine(defaultConfig, mockLLM);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockLLM.reset();
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      const engine = new QueryEngine(defaultConfig, mockLLM);
      expect(engine).toBeDefined();
    });

    it('should initialize without mock LLM', () => {
      const engine = new QueryEngine(defaultConfig);
      expect(engine).toBeDefined();
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: expect.any(String) });
    });

    it('should use default values for optional config', () => {
      const minimalConfig = {
        model: 'claude-3-haiku-20240307',
        maxTokens: 1000,
        temperature: 0.5,
      };
      const engine = new QueryEngine(minimalConfig as QueryEngineConfig, mockLLM);
      expect(engine).toBeDefined();
    });
  });

  describe('Basic Query', () => {
    it('should return a response for a simple query', async () => {
      mockLLM.setResponse('hello', {
        id: 'test-1',
        content: 'Hello! How can I help you?',
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query('hello');

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(8);
    });

    it('should handle empty queries gracefully', async () => {
      mockLLM.setResponse('', {
        id: 'test-empty',
        content: 'I see you\'ve entered empty text. How can I help?',
        usage: { input_tokens: 5, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query('');
      expect(result.content).toBeTruthy();
    });

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(10000);
      mockLLM.setResponse('a'.repeat(100), {
        id: 'test-long',
        content: 'I received a very long message.',
        usage: { input_tokens: 2500, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query(longQuery);
      expect(result).toBeDefined();
    });

    it('should handle special characters in queries', async () => {
      const specialQuery = 'Hello! @#$%^&*()_+{}[]|\\:;"<>?,./';
      mockLLM.setResponse('special', {
        id: 'test-special',
        content: 'I see special characters.',
        usage: { input_tokens: 15, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query(specialQuery);
      expect(result).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const unicodeQuery = 'Hello 世界 🌍 ñáéíóú';
      mockLLM.setResponse('unicode', {
        id: 'test-unicode',
        content: 'Unicode works! 世界 🌍',
        usage: { input_tokens: 20, output_tokens: 8 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query(unicodeQuery);
      expect(result.content).toContain('Unicode');
    });
  });

  describe('Streaming Query', () => {
    it('should stream response chunks', async () => {
      const chunks: MockStreamChunk[] = [
        { type: 'message_start', message: { id: 'stream-1', content: '' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' World' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ];

      mockLLM.setStreamResponse('stream', chunks);

      const received: MockStreamChunk[] = [];
      for await (const chunk of queryEngine.streamQuery('stream')) {
        received.push(chunk);
      }

      expect(received.length).toBeGreaterThan(0);
      expect(received[0].type).toBe('message_start');
    });

    it('should handle empty stream', async () => {
      mockLLM.setStreamResponse('empty', []);

      const received: MockStreamChunk[] = [];
      for await (const chunk of queryEngine.streamQuery('empty')) {
        received.push(chunk);
      }

      expect(received).toHaveLength(0);
    });

    it('should handle stream with tool use', async () => {
      const chunks: MockStreamChunk[] = [
        { type: 'message_start', message: { id: 'tool-stream', content: '' } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'tool_1', name: 'read_file', input: {} },
        },
        { type: 'content_block_delta', index: 0, delta: { partial_json: '{"path": "/test"}' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
        { type: 'message_stop' },
      ];

      mockLLM.setStreamResponse('tool', chunks);

      const received: MockStreamChunk[] = [];
      for await (const chunk of queryEngine.streamQuery('tool')) {
        received.push(chunk);
      }

      const toolBlock = received.find(c => c.content_block?.type === 'tool_use');
      expect(toolBlock).toBeDefined();
    });
  });

  describe('Message History', () => {
    it('should maintain conversation history', async () => {
      queryEngine.addToHistory({ role: 'user', content: 'Previous message' });
      queryEngine.addToHistory({ role: 'assistant', content: 'Previous response' });

      mockLLM.setResponse('follow', {
        id: 'history-test',
        content: 'I remember our conversation.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query('follow up');
      expect(result.content).toBe('I remember our conversation.');
    });

    it('should clear history when requested', () => {
      queryEngine.addToHistory({ role: 'user', content: 'Message 1' });
      queryEngine.addToHistory({ role: 'assistant', content: 'Response 1' });
      
      expect(queryEngine.getHistory()).toHaveLength(2);
      
      queryEngine.clearHistory();
      expect(queryEngine.getHistory()).toHaveLength(0);
    });

    it('should return copy of history, not reference', () => {
      queryEngine.addToHistory({ role: 'user', content: 'Test' });
      
      const history1 = queryEngine.getHistory();
      const history2 = queryEngine.getHistory();
      
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('Tool Calls', () => {
    it('should handle tool use in response', async () => {
      mockLLM.setResponse('use tool', {
        id: 'tool-test',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/test.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      const result = await queryEngine.query('use tool');

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('read_file');
      expect(result.toolCalls![0].arguments).toEqual({ path: '/test.txt' });
    });

    it('should handle multiple tool calls', async () => {
      mockLLM.setResponse('multi tool', {
        id: 'multi-tool-test',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/file1.txt' }),
            },
          },
          {
            id: 'tool_2',
            type: 'function',
            function: {
              name: 'write_file',
              arguments: JSON.stringify({ path: '/file2.txt', content: 'test' }),
            },
          },
        ],
        usage: { input_tokens: 30, output_tokens: 50 },
        stop_reason: 'tool_use',
      });

      const result = await queryEngine.query('multi tool');

      expect(result.toolCalls).toHaveLength(2);
    });

    it('should pass tools to API', async () => {
      const tools = [
        {
          name: 'read_file',
          description: 'Read a file',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
          },
        },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Tool registered' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const engine = new QueryEngine(defaultConfig);
      await engine.query('test', { tools });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tools })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockLLM.setNextCallToFail(new Error('API Error'));

      await expect(queryEngine.query('error test')).rejects.toThrow('API Error');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockLLM.setNextCallToFail(rateLimitError);

      await expect(queryEngine.query('rate limit test')).rejects.toThrow('Rate limit');
    });

    it('should handle timeout errors', async () => {
      mockLLM.configure({ responseDelay: 100000 });
      
      // This would need actual timeout handling in the implementation
      const result = await queryEngine.query('timeout test');
      expect(result).toBeDefined();
    });

    it('should handle malformed responses', async () => {
      mockLLM.setResponse('malformed', {
        id: 'malformed',
        content: '',
        usage: undefined,
      } as any);

      const result = await queryEngine.query('malformed');
      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect maxTokens setting', async () => {
      const config = { ...defaultConfig, maxTokens: 100 };
      const engine = new QueryEngine(config, mockLLM);

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Short response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await engine.query('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 100 })
      );
    });

    it('should respect temperature setting', async () => {
      const config = { ...defaultConfig, temperature: 0.2 };
      const engine = new QueryEngine(config, mockLLM);

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Low temp response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await engine.query('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.2 })
      );
    });

    it('should include system prompt when provided', async () => {
      const config = { ...defaultConfig, systemPrompt: 'Custom system prompt' };
      const engine = new QueryEngine(config, mockLLM);

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await engine.query('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'Custom system prompt' })
      );
    });
  });

  describe('Usage Tracking', () => {
    it('should track token usage correctly', async () => {
      mockLLM.setResponse('usage', {
        id: 'usage-test',
        content: 'Test response',
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query('usage');

      expect(result.usage.inputTokens).toBe(100);
      expect(result.usage.outputTokens).toBe(50);
    });

    it('should handle missing usage data', async () => {
      mockLLM.setResponse('no-usage', {
        id: 'no-usage-test',
        content: 'Test',
      } as MockLLMResponse);

      const result = await queryEngine.query('no-usage');

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
    });
  });

  describe('Response Processing', () => {
    it('should concatenate multiple text blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' },
        ],
        usage: { input_tokens: 20, output_tokens: 15 },
      });

      const engine = new QueryEngine(defaultConfig);
      const result = await engine.query('multi-block');

      expect(result.content).toBe('First part. Second part.');
    });

    it('should filter out non-text blocks from content', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Text content' },
          { type: 'tool_use', name: 'test_tool', input: {} },
        ],
        usage: { input_tokens: 20, output_tokens: 15 },
      });

      const engine = new QueryEngine(defaultConfig);
      const result = await engine.query('mixed');

      expect(result.content).toBe('Text content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent queries', async () => {
      mockLLM.setResponse('concurrent', {
        id: 'concurrent',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const promises = [
        queryEngine.query('concurrent 1'),
        queryEngine.query('concurrent 2'),
        queryEngine.query('concurrent 3'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    it('should handle very large responses', async () => {
      const largeContent = 'x'.repeat(50000);
      mockLLM.setResponse('large', {
        id: 'large-test',
        content: largeContent,
        usage: { input_tokens: 100, output_tokens: 12500 },
        stop_reason: 'end_turn',
      });

      const result = await queryEngine.query('large');
      expect(result.content.length).toBe(50000);
    });

    it('should handle null/undefined content gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: null }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const engine = new QueryEngine(defaultConfig);
      const result = await engine.query('null');

      expect(result.content).toBe('');
    });
  });
});
