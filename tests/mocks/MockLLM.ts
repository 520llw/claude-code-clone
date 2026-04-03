/**
 * MockLLM - Mock implementation of LLM providers for testing
 * 
 * Provides configurable mock responses for Anthropic and OpenAI APIs,
 * including streaming responses, error simulation, and response delays.
 */

export interface MockMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MockToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MockLLMResponse {
  id: string;
  content: string;
  toolCalls?: MockToolCall[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model?: string;
  stop_reason?: string;
}

export interface MockStreamChunk {
  type: 'content_block_delta' | 'content_block_start' | 'content_block_stop' | 'message_delta' | 'message_start' | 'message_stop';
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  content_block?: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  message?: MockLLMResponse;
}

export interface MockLLMConfig {
  responseDelay?: number;
  errorRate?: number;
  tokenLimit?: number;
  streamingEnabled?: boolean;
  defaultModel?: string;
}

/**
 * Mock LLM implementation for testing
 */
export class MockLLM {
  private responses: Map<string, MockLLMResponse> = new Map();
  private streamResponses: Map<string, MockStreamChunk[]> = new Map();
  private config: MockLLMConfig;
  private callHistory: Array<{ prompt: string; response: MockLLMResponse; timestamp: number }> = [];
  private shouldFailNext: boolean = false;
  private failWithError?: Error;

  constructor(config: MockLLMConfig = {}) {
    this.config = {
      responseDelay: 0,
      errorRate: 0,
      tokenLimit: 100000,
      streamingEnabled: true,
      defaultModel: 'claude-3-opus-20240229',
      ...config,
    };
    this.setupDefaultResponses();
  }

  /**
   * Setup default mock responses
   */
  private setupDefaultResponses(): void {
    // Default greeting response
    this.setResponse('greeting', {
      id: 'msg_001',
      content: 'Hello! I\'m Claude, an AI assistant. How can I help you today?',
      usage: { input_tokens: 10, output_tokens: 15 },
      model: this.config.defaultModel,
      stop_reason: 'end_turn',
    });

    // Default code generation response
    this.setResponse('code', {
      id: 'msg_002',
      content: '```typescript\nfunction hello() {\n  console.log("Hello, World!");\n}\n```',
      usage: { input_tokens: 20, output_tokens: 25 },
      model: this.config.defaultModel,
      stop_reason: 'end_turn',
    });

    // Default tool use response
    this.setResponse('tool_use', {
      id: 'msg_003',
      content: '',
      toolCalls: [
        {
          id: 'tool_001',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/test/file.txt' }),
          },
        },
      ],
      usage: { input_tokens: 15, output_tokens: 30 },
      model: this.config.defaultModel,
      stop_reason: 'tool_use',
    });

    // Default error response
    this.setResponse('error', {
      id: 'msg_error',
      content: 'I apologize, but I encountered an error processing your request.',
      usage: { input_tokens: 10, output_tokens: 12 },
      model: this.config.defaultModel,
      stop_reason: 'end_turn',
    });
  }

  /**
   * Set a custom response for a specific prompt pattern
   */
  setResponse(pattern: string, response: MockLLMResponse): void {
    this.responses.set(pattern, response);
  }

  /**
   * Set streaming response chunks
   */
  setStreamResponse(pattern: string, chunks: MockStreamChunk[]): void {
    this.streamResponses.set(pattern, chunks);
  }

  /**
   * Configure the mock behavior
   */
  configure(config: Partial<MockLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Force the next call to fail
   */
  setNextCallToFail(error?: Error): void {
    this.shouldFailNext = true;
    this.failWithError = error;
  }

  /**
   * Reset the mock state
   */
  reset(): void {
    this.responses.clear();
    this.streamResponses.clear();
    this.callHistory = [];
    this.shouldFailNext = false;
    this.failWithError = undefined;
    this.setupDefaultResponses();
  }

  /**
   * Get call history
   */
  getCallHistory(): Array<{ prompt: string; response: MockLLMResponse; timestamp: number }> {
    return [...this.callHistory];
  }

  /**
   * Get the number of calls made
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Simulate a non-streaming completion request
   */
  async complete(messages: MockMessage[]): Promise<MockLLMResponse> {
    // Simulate delay
    if (this.config.responseDelay! > 0) {
      await this.delay(this.config.responseDelay!);
    }

    // Check for forced failure
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.failWithError || new Error('Mock LLM error');
    }

    // Simulate random errors
    if (Math.random() < (this.config.errorRate || 0)) {
      throw new Error('Random mock error');
    }

    const prompt = messages.map(m => m.content).join(' ');
    const response = this.findResponse(prompt);

    this.callHistory.push({
      prompt,
      response,
      timestamp: Date.now(),
    });

    return response;
  }

  /**
   * Simulate a streaming completion request
   */
  async *streamComplete(messages: MockMessage[]): AsyncGenerator<MockStreamChunk> {
    // Simulate delay
    if (this.config.responseDelay! > 0) {
      await this.delay(this.config.responseDelay!);
    }

    // Check for forced failure
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.failWithError || new Error('Mock LLM error');
    }

    const prompt = messages.map(m => m.content).join(' ');
    const chunks = this.findStreamResponse(prompt);

    for (const chunk of chunks) {
      if (this.config.responseDelay! > 0) {
        await this.delay(Math.max(10, this.config.responseDelay! / chunks.length));
      }
      yield chunk;
    }

    const response = this.findResponse(prompt);
    this.callHistory.push({
      prompt,
      response,
      timestamp: Date.now(),
    });
  }

  /**
   * Find appropriate response based on prompt content
   */
  private findResponse(prompt: string): MockLLMResponse {
    // Check for exact pattern matches
    for (const [pattern, response] of this.responses) {
      if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
        return { ...response, id: `msg_${Date.now()}` };
      }
    }

    // Default response
    return {
      id: `msg_${Date.now()}`,
      content: 'This is a default mock response.',
      usage: { input_tokens: 10, output_tokens: 10 },
      model: this.config.defaultModel,
      stop_reason: 'end_turn',
    };
  }

  /**
   * Find appropriate stream response
   */
  private findStreamResponse(prompt: string): MockStreamChunk[] {
    for (const [pattern, chunks] of this.streamResponses) {
      if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
        return chunks;
      }
    }

    // Default streaming response
    return this.createDefaultStreamChunks('This is a default mock streaming response.');
  }

  /**
   * Create default stream chunks from text
   */
  private createDefaultStreamChunks(text: string): MockStreamChunk[] {
    const chunks: MockStreamChunk[] = [
      {
        type: 'message_start',
        message: {
          id: `msg_${Date.now()}`,
          content: '',
          model: this.config.defaultModel,
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      },
    ];

    // Split text into word chunks
    const words = text.split(' ');
    words.forEach((word, index) => {
      chunks.push({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: (index === 0 ? '' : ' ') + word,
        },
      });
    });

    chunks.push(
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
      },
      { type: 'message_stop' }
    );

    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Pre-built Response Generators
  // ============================================================================

  /**
   * Generate a code review response
   */
  static generateCodeReviewResponse(code: string, issues: string[] = []): MockLLMResponse {
    const issueList = issues.length > 0
      ? issues.map(i => `- ${i}`).join('\n')
      : '- No issues found';

    return {
      id: `review_${Date.now()}`,
      content: `## Code Review\n\n\`\`\`\n${code}\n\`\`\`\n\n### Issues Found:\n${issueList}`,
      usage: { input_tokens: code.length / 4, output_tokens: 50 },
      stop_reason: 'end_turn',
    };
  }

  /**
   * Generate a refactoring suggestion response
   */
  static generateRefactoringResponse(original: string, refactored: string): MockLLMResponse {
    return {
      id: `refactor_${Date.now()}`,
      content: `Here's the refactored code:\n\n\`\`\`\n${refactored}\n\`\`\`\n\n### Changes Made:\n- Improved readability\n- Enhanced performance\n- Better error handling`,
      usage: { input_tokens: original.length / 4, output_tokens: refactored.length / 4 + 30 },
      stop_reason: 'end_turn',
    };
  }

  /**
   * Generate a multi-tool use response
   */
  static generateMultiToolResponse(tools: Array<{ name: string; args: Record<string, unknown> }>): MockLLMResponse {
    return {
      id: `multi_tool_${Date.now()}`,
      content: '',
      toolCalls: tools.map((tool, index) => ({
        id: `tool_${index}`,
        type: 'function',
        function: {
          name: tool.name,
          arguments: JSON.stringify(tool.args),
        },
      })),
      usage: { input_tokens: 50, output_tokens: tools.length * 20 },
      stop_reason: 'tool_use',
    };
  }

  /**
   * Generate an explanation response
   */
  static generateExplanationResponse(topic: string, explanation: string): MockLLMResponse {
    return {
      id: `explain_${Date.now()}`,
      content: `## ${topic}\n\n${explanation}\n\n### Key Points:\n1. First point\n2. Second point\n3. Third point`,
      usage: { input_tokens: topic.length / 4, output_tokens: explanation.length / 4 + 20 },
      stop_reason: 'end_turn',
    };
  }

  /**
   * Generate error response
   */
  static generateErrorResponse(errorMessage: string): MockLLMResponse {
    return {
      id: `error_${Date.now()}`,
      content: `I encountered an error: ${errorMessage}`,
      usage: { input_tokens: 10, output_tokens: 15 },
      stop_reason: 'end_turn',
    };
  }

  // ============================================================================
  // Stream Response Generators
  // ============================================================================

  /**
   * Generate streaming chunks for a thinking response
   */
  static generateThinkingStream(thoughts: string[]): MockStreamChunk[] {
    const chunks: MockStreamChunk[] = [
      { type: 'message_start', message: { id: `msg_${Date.now()}`, content: '' } },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', text: '' },
      },
    ];

    thoughts.forEach((thought, i) => {
      chunks.push({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', text: thought + '\n' },
      });
    });

    chunks.push(
      { type: 'content_block_stop', index: 0 },
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'text_delta', text: 'Based on my analysis...' },
      },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      { type: 'message_stop' }
    );

    return chunks;
  }

  /**
   * Generate streaming chunks with tool use
   */
  static generateToolUseStream(toolName: string, args: Record<string, unknown>): MockStreamChunk[] {
    return [
      { type: 'message_start', message: { id: `msg_${Date.now()}`, content: '' } },
      {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'tool_001',
          name: toolName,
          input: args,
        },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { partial_json: JSON.stringify(args) },
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
      { type: 'message_stop' },
    ];
  }
}

// Export singleton instance for convenience
export const mockLLM = new MockLLM();
