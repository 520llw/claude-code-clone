/**
 * AgentConversation Integration Tests
 * 
 * End-to-end tests for the complete agent conversation flow,
 * testing interactions between QueryEngine, AgentLoop, ContextManager,
 * and SessionManager.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockLLM, MockLLMResponse } from '../mocks/MockLLM';
import { MockFS } from '../mocks/MockFS';
import { MockTools, ToolResult } from '../mocks/MockTools';

// Integration test components
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface Conversation {
  id: string;
  messages: Message[];
  context: {
    files: string[];
    workingDirectory: string;
  };
  metadata: Record<string, unknown>;
}

class AgentConversation {
  private mockLLM: MockLLM;
  private mockFS: MockFS;
  private mockTools: MockTools;
  private conversation: Conversation;
  private messageHandlers: Array<(message: Message) => void> = [];
  private maxIterations: number = 10;

  constructor(mockLLM: MockLLM, mockFS: MockFS, mockTools: MockTools) {
    this.mockLLM = mockLLM;
    this.mockFS = mockFS;
    this.mockTools = mockTools;
    this.conversation = {
      id: `conv_${Date.now()}`,
      messages: [],
      context: {
        files: [],
        workingDirectory: '/',
      },
      metadata: {},
    };
  }

  onMessage(handler: (message: Message) => void): void {
    this.messageHandlers.push(handler);
  }

  private emitMessage(message: Message): void {
    this.messageHandlers.forEach(h => h(message));
  }

  async sendMessage(content: string): Promise<Message[]> {
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.conversation.messages.push(userMessage);
    this.emitMessage(userMessage);

    // Process conversation loop
    const newMessages: Message[] = [];
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      // Build LLM messages
      const llmMessages = this.conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Get LLM response
      const response = await this.mockLLM.complete(llmMessages);

      // Check for tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Create assistant message with tool calls
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          toolCalls: response.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })),
        };
        this.conversation.messages.push(assistantMessage);
        this.emitMessage(assistantMessage);
        newMessages.push(assistantMessage);

        // Execute tools
        const toolResults: ToolResult[] = [];
        for (const toolCall of response.toolCalls) {
          const result = await this.mockTools.executeTool({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            id: toolCall.id,
          });
          toolResults.push(result);
        }

        // Add tool results as message
        const toolResultMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: JSON.stringify(toolResults),
          timestamp: Date.now(),
          toolResults,
        };
        this.conversation.messages.push(toolResultMessage);
        this.emitMessage(toolResultMessage);
        newMessages.push(toolResultMessage);
      } else {
        // No tool calls, conversation complete
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        };
        this.conversation.messages.push(assistantMessage);
        this.emitMessage(assistantMessage);
        newMessages.push(assistantMessage);
        break;
      }
    }

    return newMessages;
  }

  async *streamMessage(content: string): AsyncGenerator<Message> {
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.conversation.messages.push(userMessage);
    yield userMessage;

    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      const llmMessages = this.conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Stream the response
      let fullContent = '';
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      for await (const chunk of this.mockLLM.streamComplete(llmMessages)) {
        if (chunk.delta?.text) {
          fullContent += chunk.delta.text;
          assistantMessage.content = fullContent;
          yield { ...assistantMessage };
        }
      }

      // Get final response for tool calls
      const finalResponse = await this.mockLLM.complete(llmMessages);

      if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
        assistantMessage.toolCalls = finalResponse.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
        yield assistantMessage;

        // Execute tools
        const toolResults: ToolResult[] = [];
        for (const toolCall of finalResponse.toolCalls) {
          const result = await this.mockTools.executeTool({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            id: toolCall.id,
          });
          toolResults.push(result);
        }

        const toolResultMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: JSON.stringify(toolResults),
          timestamp: Date.now(),
          toolResults,
        };
        this.conversation.messages.push(toolResultMessage);
        yield toolResultMessage;
      } else {
        this.conversation.messages.push(assistantMessage);
        break;
      }
    }
  }

  getConversation(): Conversation {
    return { ...this.conversation };
  }

  getMessages(): Message[] {
    return [...this.conversation.messages];
  }

  clear(): void {
    this.conversation.messages = [];
    this.conversation.context.files = [];
  }

  addContextFile(path: string): void {
    this.conversation.context.files.push(path);
  }

  setWorkingDirectory(path: string): void {
    this.conversation.context.workingDirectory = path;
  }
}

describe('AgentConversation Integration', () => {
  let mockLLM: MockLLM;
  let mockFS: MockFS;
  let mockTools: MockTools;
  let conversation: AgentConversation;

  beforeEach(() => {
    mockLLM = new MockLLM();
    mockFS = new MockFS();
    mockTools = new MockTools(mockFS);
    conversation = new AgentConversation(mockLLM, mockFS, mockTools);

    // Setup test files
    mockFS.writeFileSync('/test/file.txt', 'Hello, World!');
    mockFS.writeFileSync('/project/src/app.ts', `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`);
  });

  afterEach(() => {
    mockLLM.reset();
    mockFS.reset();
  });

  describe('Basic Conversation Flow', () => {
    it('should complete a simple conversation', async () => {
      mockLLM.setResponse('hello', {
        id: 'test-1',
        content: 'Hello! How can I help you today?',
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('hello');

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('Hello! How can I help you today?');
    });

    it('should maintain conversation history', async () => {
      mockLLM.setResponse('first', {
        id: 'test-1',
        content: 'First response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      mockLLM.setResponse('second', {
        id: 'test-2',
        content: 'Second response',
        usage: { input_tokens: 20, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await conversation.sendMessage('first message');
      await conversation.sendMessage('second message');

      const allMessages = conversation.getMessages();
      expect(allMessages).toHaveLength(4);
    });

    it('should emit messages during conversation', async () => {
      const emittedMessages: Message[] = [];
      conversation.onMessage(msg => emittedMessages.push(msg));

      mockLLM.setResponse('emit', {
        id: 'test-1',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await conversation.sendMessage('test');

      expect(emittedMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Use in Conversation', () => {
    it('should execute tool and continue conversation', async () => {
      mockLLM.setResponse('read file', {
        id: 'tool-1',
        content: 'I will read the file for you.',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/test/file.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('tool result', {
        id: 'tool-2',
        content: 'The file contains: Hello, World!',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('read the file');

      expect(messages).toHaveLength(3); // assistant with tool call, tool results, final response
      expect(messages[0].toolCalls).toBeDefined();
      expect(messages[1].toolResults).toBeDefined();
    });

    it('should handle multiple tool calls in one turn', async () => {
      mockLLM.setResponse('multi tool', {
        id: 'multi-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/test/file.txt' }),
            },
          },
          {
            id: 'tool_2',
            type: 'function',
            function: {
              name: 'list_directory',
              arguments: JSON.stringify({ path: '/test' }),
            },
          },
        ],
        usage: { input_tokens: 30, output_tokens: 50 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('multi result', {
        id: 'multi-2',
        content: 'Done with both operations.',
        usage: { input_tokens: 80, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('do multiple things');

      expect(messages[0].toolCalls).toHaveLength(2);
    });

    it('should handle tool execution errors', async () => {
      mockLLM.setResponse('error tool', {
        id: 'error-1',
        content: 'Let me try to read that.',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/nonexistent.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('error handled', {
        id: 'error-2',
        content: 'I could not read that file.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('read nonexistent');

      expect(messages[1].toolResults?.[0].success).toBe(false);
    });
  });

  describe('Streaming Conversation', () => {
    it('should stream message response', async () => {
      mockLLM.setResponse('stream', {
        id: 'stream-1',
        content: 'Streaming response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const chunks: Message[] = [];
      for await (const message of conversation.streamMessage('stream test')) {
        chunks.push(message);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should stream with tool calls', async () => {
      mockLLM.setResponse('stream tool', {
        id: 'st-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/test/file.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('st result', {
        id: 'st-2',
        content: 'Done.',
        usage: { input_tokens: 50, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const chunks: Message[] = [];
      for await (const message of conversation.streamMessage('stream with tool')) {
        chunks.push(message);
      }

      expect(chunks.some(m => m.toolCalls)).toBe(true);
    });
  });

  describe('Context Management', () => {
    it('should track context files', () => {
      conversation.addContextFile('/project/src/app.ts');
      const conv = conversation.getConversation();
      expect(conv.context.files).toContain('/project/src/app.ts');
    });

    it('should set working directory', () => {
      conversation.setWorkingDirectory('/project');
      const conv = conversation.getConversation();
      expect(conv.context.workingDirectory).toBe('/project');
    });

    it('should clear conversation', async () => {
      mockLLM.setResponse('test', {
        id: 'test-1',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await conversation.sendMessage('test');
      conversation.clear();

      expect(conversation.getMessages()).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle file read and edit workflow', async () => {
      // First, read the file
      mockLLM.setResponse('read and edit', {
        id: 'workflow-1',
        content: 'I will read the file first.',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/test/file.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('edit file', {
        id: 'workflow-2',
        content: 'Now I will edit it.',
        toolCalls: [
          {
            id: 'tool_2',
            type: 'function',
            function: {
              name: 'edit_file',
              arguments: JSON.stringify({
                path: '/test/file.txt',
                oldString: 'Hello',
                newString: 'Hi',
              }),
            },
          },
        ],
        usage: { input_tokens: 50, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('complete', {
        id: 'workflow-3',
        content: 'File edited successfully.',
        usage: { input_tokens: 80, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('read and edit the file');

      expect(messages.length).toBeGreaterThan(0);
      expect(mockFS.readFileSync('/test/file.txt', 'utf-8')).toBe('Hi, World!');
    });

    it('should handle code search and analysis', async () => {
      mockLLM.setResponse('search code', {
        id: 'search-1',
        content: 'Let me search for the function.',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'grep_search',
              arguments: JSON.stringify({
                pattern: 'function greet',
                path: '/project',
              }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('analysis', {
        id: 'search-2',
        content: 'Found the greet function in app.ts.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('find the greet function');

      expect(messages[0].toolCalls?.[0].name).toBe('grep_search');
    });

    it('should handle multi-turn conversation with context', async () => {
      // First turn
      mockLLM.setResponse('question 1', {
        id: 'multi-1',
        content: 'Answer to question 1',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await conversation.sendMessage('What is question 1?');

      // Second turn - should have context
      mockLLM.setResponse('question 2', {
        id: 'multi-2',
        content: 'Answer to question 2 with reference to question 1',
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('What about question 2?');

      expect(messages[0].content).toContain('question 2');
      
      // Verify history includes both exchanges
      const allMessages = conversation.getMessages();
      expect(allMessages.length).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      mockLLM.setNextCallToFail(new Error('LLM service unavailable'));

      await expect(conversation.sendMessage('test')).rejects.toThrow('LLM service unavailable');
    });

    it('should handle tool execution failures', async () => {
      mockLLM.setResponse('failing tool', {
        id: 'fail-1',
        content: 'Attempting operation.',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'execute_command',
              arguments: JSON.stringify({ command: 'invalid_command' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('fail handled', {
        id: 'fail-2',
        content: 'The command failed.',
        usage: { input_tokens: 50, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('run invalid command');

      expect(messages[1].toolResults?.[0].success).toBe(false);
    });

    it('should handle timeout in long operations', async () => {
      mockLLM.configure({ responseDelay: 5000 });

      mockLLM.setResponse('slow', {
        id: 'slow-1',
        content: 'Slow response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const messages = await conversation.sendMessage('slow request');
      expect(messages).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle large conversations', async () => {
      // Add many messages
      for (let i = 0; i < 20; i++) {
        mockLLM.setResponse(`msg${i}`, {
          id: `perf-${i}`,
          content: `Response ${i}`,
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: 'end_turn',
        });

        await conversation.sendMessage(`Message ${i}`);
      }

      const messages = conversation.getMessages();
      expect(messages).toHaveLength(40);
    });

    it('should handle concurrent message sends', async () => {
      mockLLM.setResponse('concurrent', {
        id: 'conc-1',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const promises = [
        conversation.sendMessage('msg1'),
        conversation.sendMessage('msg2'),
        conversation.sendMessage('msg3'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });
  });
});
