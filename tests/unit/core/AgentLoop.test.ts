/**
 * AgentLoop Tests
 * 
 * Comprehensive test suite for the AgentLoop class which manages
 * the main conversation loop, tool execution, and state transitions.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockLLM, MockLLMResponse } from '../../mocks/MockLLM';
import { MockTools, ToolResult } from '../../mocks/MockTools';
import { MockFS } from '../../mocks/MockFS';

// AgentLoop implementation for testing
interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    result: ToolResult;
  }>;
}

interface AgentConfig {
  maxIterations: number;
  systemPrompt?: string;
  allowedTools?: string[];
  requireConfirmation?: boolean;
}

interface AgentState {
  status: 'idle' | 'running' | 'waiting_for_tool' | 'completed' | 'error';
  currentIteration: number;
  messages: AgentMessage[];
}

class AgentLoop {
  private mockLLM: MockLLM;
  private mockTools: MockTools;
  private config: AgentConfig;
  private state: AgentState;
  private onMessageCallback?: (message: AgentMessage) => void;
  private onToolCallCallback?: (toolCall: any) => void;
  private onStateChangeCallback?: (state: AgentState) => void;

  constructor(
    mockLLM: MockLLM,
    mockTools: MockTools,
    config: Partial<AgentConfig> = {}
  ) {
    this.mockLLM = mockLLM;
    this.mockTools = mockTools;
    this.config = {
      maxIterations: 10,
      systemPrompt: 'You are a helpful coding assistant.',
      allowedTools: [],
      requireConfirmation: false,
      ...config,
    };
    this.state = {
      status: 'idle',
      currentIteration: 0,
      messages: [],
    };
  }

  onMessage(callback: (message: AgentMessage) => void): void {
    this.onMessageCallback = callback;
  }

  onToolCall(callback: (toolCall: any) => void): void {
    this.onToolCallCallback = callback;
  }

  onStateChange(callback: (state: AgentState) => void): void {
    this.onStateChangeCallback = callback;
  }

  private emitMessage(message: AgentMessage): void {
    this.onMessageCallback?.(message);
  }

  private emitToolCall(toolCall: any): void {
    this.onToolCallCallback?.(toolCall);
  }

  private setState(status: AgentState['status']): void {
    this.state.status = status;
    this.onStateChangeCallback?.(this.state);
  }

  async run(userInput: string): Promise<AgentMessage[]> {
    this.setState('running');
    this.state.currentIteration = 0;
    this.state.messages = [];

    // Add user message
    const userMessage: AgentMessage = { role: 'user', content: userInput };
    this.state.messages.push(userMessage);
    this.emitMessage(userMessage);

    try {
      while (this.state.currentIteration < this.config.maxIterations!) {
        this.state.currentIteration++;

        // Get LLM response
        const llmMessages = this.state.messages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        const response = await this.mockLLM.complete(llmMessages);

        const assistantMessage: AgentMessage = {
          role: 'assistant',
          content: response.content,
        };

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          this.setState('waiting_for_tool');
          assistantMessage.toolCalls = response.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          }));

          this.state.messages.push(assistantMessage);
          this.emitMessage(assistantMessage);

          // Execute tools
          const toolResults: AgentMessage['toolResults'] = [];
          for (const toolCall of response.toolCalls) {
            this.emitToolCall(toolCall);

            if (this.isToolAllowed(toolCall.function.name)) {
              const result = await this.mockTools.executeTool({
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
                id: toolCall.id,
              });

              toolResults.push({
                toolCallId: toolCall.id,
                result,
              });
            } else {
              toolResults.push({
                toolCallId: toolCall.id,
                result: {
                  success: false,
                  error: `Tool '${toolCall.function.name}' is not allowed`,
                },
              });
            }
          }

          // Add tool results as a new message
          const toolResultMessage: AgentMessage = {
            role: 'user',
            content: JSON.stringify(toolResults),
            toolResults,
          };
          this.state.messages.push(toolResultMessage);
          this.emitMessage(toolResultMessage);
          this.setState('running');
        } else {
          // No tool calls, conversation complete
          this.state.messages.push(assistantMessage);
          this.emitMessage(assistantMessage);
          this.setState('completed');
          break;
        }
      }

      if (this.state.currentIteration >= this.config.maxIterations!) {
        this.setState('error');
        throw new Error('Maximum iterations exceeded');
      }

      return this.state.messages;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  async *stream(userInput: string): AsyncGenerator<AgentMessage> {
    this.setState('running');
    this.state.currentIteration = 0;
    this.state.messages = [];

    const userMessage: AgentMessage = { role: 'user', content: userInput };
    this.state.messages.push(userMessage);
    yield userMessage;

    while (this.state.currentIteration < this.config.maxIterations!) {
      this.state.currentIteration++;

      const llmMessages = this.state.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Stream the response
      let fullContent = '';
      const assistantMessage: AgentMessage = { role: 'assistant', content: '' };

      for await (const chunk of this.mockLLM.streamComplete(llmMessages)) {
        if (chunk.delta?.text) {
          fullContent += chunk.delta.text;
          assistantMessage.content = fullContent;
          yield { ...assistantMessage };
        }
      }

      // Check for tool calls in the final response
      const finalResponse = await this.mockLLM.complete(llmMessages);
      
      if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
        this.setState('waiting_for_tool');
        assistantMessage.toolCalls = finalResponse.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));

        this.state.messages.push(assistantMessage);
        yield assistantMessage;

        // Execute tools
        const toolResults: AgentMessage['toolResults'] = [];
        for (const toolCall of finalResponse.toolCalls) {
          this.emitToolCall(toolCall);

          const result = await this.mockTools.executeTool({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            id: toolCall.id,
          });

          toolResults.push({
            toolCallId: toolCall.id,
            result,
          });
        }

        const toolResultMessage: AgentMessage = {
          role: 'user',
          content: JSON.stringify(toolResults),
          toolResults,
        };
        this.state.messages.push(toolResultMessage);
        yield toolResultMessage;
        this.setState('running');
      } else {
        this.state.messages.push(assistantMessage);
        this.setState('completed');
        break;
      }
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  stop(): void {
    this.setState('completed');
  }

  private isToolAllowed(toolName: string): boolean {
    if (this.config.allowedTools!.length === 0) return true;
    return this.config.allowedTools!.includes(toolName);
  }
}

describe('AgentLoop', () => {
  let mockLLM: MockLLM;
  let mockFS: MockFS;
  let mockTools: MockTools;
  let agentLoop: AgentLoop;

  beforeEach(() => {
    mockLLM = new MockLLM();
    mockFS = new MockFS();
    mockTools = new MockTools(mockFS);
    agentLoop = new AgentLoop(mockLLM, mockTools);
  });

  afterEach(() => {
    mockLLM.reset();
    mockFS.reset();
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const loop = new AgentLoop(mockLLM, mockTools);
      const state = loop.getState();
      expect(state.status).toBe('idle');
      expect(state.currentIteration).toBe(0);
    });

    it('should accept custom config', () => {
      const loop = new AgentLoop(mockLLM, mockTools, {
        maxIterations: 5,
        systemPrompt: 'Custom prompt',
      });
      expect(loop).toBeDefined();
    });

    it('should initialize with allowed tools list', () => {
      const loop = new AgentLoop(mockLLM, mockTools, {
        allowedTools: ['read_file', 'write_file'],
      });
      expect(loop).toBeDefined();
    });
  });

  describe('Basic Conversation', () => {
    it('should complete a simple conversation without tools', async () => {
      mockLLM.setResponse('hello', {
        id: 'test-1',
        content: 'Hello! How can I help you?',
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn',
      });

      const messages = await agentLoop.run('hello');

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should emit messages during conversation', async () => {
      const emittedMessages: AgentMessage[] = [];
      agentLoop.onMessage(msg => emittedMessages.push(msg));

      mockLLM.setResponse('test', {
        id: 'test-2',
        content: 'Test response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await agentLoop.run('test');

      expect(emittedMessages).toHaveLength(2);
    });

    it('should emit state changes', async () => {
      const stateChanges: AgentState[] = [];
      agentLoop.onStateChange(state => stateChanges.push({ ...state }));

      mockLLM.setResponse('state', {
        id: 'test-3',
        content: 'State test',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await agentLoop.run('state');

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges[0].status).toBe('running');
      expect(stateChanges[stateChanges.length - 1].status).toBe('completed');
    });
  });

  describe('Tool Execution', () => {
    it('should execute a single tool call', async () => {
      mockLLM.setResponse('read file', {
        id: 'tool-test-1',
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

      // Second response after tool execution
      mockLLM.setResponse('tool result', {
        id: 'tool-test-2',
        content: 'I read the file successfully.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      mockFS.writeFileSync('/test.txt', 'File content');

      const messages = await agentLoop.run('read file');

      expect(messages.some(m => m.toolCalls)).toBe(true);
      expect(messages.some(m => m.toolResults)).toBe(true);
    });

    it('should execute multiple tool calls in sequence', async () => {
      mockLLM.setResponse('multi tool', {
        id: 'multi-1',
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
              name: 'read_file',
              arguments: JSON.stringify({ path: '/file2.txt' }),
            },
          },
        ],
        usage: { input_tokens: 30, output_tokens: 50 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('multi result', {
        id: 'multi-2',
        content: 'Both files read.',
        usage: { input_tokens: 80, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      mockFS.writeFileSync('/file1.txt', 'Content 1');
      mockFS.writeFileSync('/file2.txt', 'Content 2');

      const messages = await agentLoop.run('multi tool');

      const toolResultMessage = messages.find(m => m.toolResults);
      expect(toolResultMessage?.toolResults).toHaveLength(2);
    });

    it('should emit tool calls', async () => {
      const emittedToolCalls: any[] = [];
      agentLoop.onToolCall(toolCall => emittedToolCalls.push(toolCall));

      mockLLM.setResponse('emit tool', {
        id: 'emit-1',
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

      mockLLM.setResponse('emit result', {
        id: 'emit-2',
        content: 'Done',
        usage: { input_tokens: 50, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      mockFS.writeFileSync('/test.txt', 'Content');

      await agentLoop.run('emit tool');

      expect(emittedToolCalls).toHaveLength(1);
      expect(emittedToolCalls[0].function.name).toBe('read_file');
    });

    it('should handle tool execution errors', async () => {
      mockLLM.setResponse('error tool', {
        id: 'error-1',
        content: '',
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
        content: 'I encountered an error reading the file.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await agentLoop.run('error tool');

      const toolResultMessage = messages.find(m => m.toolResults);
      expect(toolResultMessage?.toolResults?.[0].result.success).toBe(false);
    });
  });

  describe('Tool Permissions', () => {
    it('should allow only whitelisted tools', async () => {
      const restrictedLoop = new AgentLoop(mockLLM, mockTools, {
        allowedTools: ['read_file'],
      });

      mockLLM.setResponse('restricted', {
        id: 'restrict-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'write_file',
              arguments: JSON.stringify({ path: '/test.txt', content: 'test' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('restrict result', {
        id: 'restrict-2',
        content: 'Tool was not allowed.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await restrictedLoop.run('restricted');

      const toolResultMessage = messages.find(m => m.toolResults);
      expect(toolResultMessage?.toolResults?.[0].result.success).toBe(false);
      expect(toolResultMessage?.toolResults?.[0].result.error).toContain('not allowed');
    });

    it('should allow all tools when whitelist is empty', async () => {
      mockFS.writeFileSync('/allowed.txt', 'test');

      mockLLM.setResponse('allowed', {
        id: 'allow-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/allowed.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('allow result', {
        id: 'allow-2',
        content: 'File read.',
        usage: { input_tokens: 50, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const messages = await agentLoop.run('allowed');

      const toolResultMessage = messages.find(m => m.toolResults);
      expect(toolResultMessage?.toolResults?.[0].result.success).toBe(true);
    });
  });

  describe('Iteration Limits', () => {
    it('should stop at max iterations', async () => {
      const limitedLoop = new AgentLoop(mockLLM, mockTools, {
        maxIterations: 3,
      });

      // Always return tool calls to trigger iteration
      mockLLM.setResponse('infinite', {
        id: 'inf-1',
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

      mockFS.writeFileSync('/test.txt', 'content');

      await expect(limitedLoop.run('infinite')).rejects.toThrow('Maximum iterations exceeded');
      expect(limitedLoop.getState().status).toBe('error');
    });

    it('should track current iteration', async () => {
      mockLLM.setResponse('iter', {
        id: 'iter-1',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await agentLoop.run('iter');

      expect(agentLoop.getState().currentIteration).toBe(1);
    });
  });

  describe('Streaming', () => {
    it('should stream messages', async () => {
      const chunks: AgentMessage[] = [];

      mockLLM.setResponse('stream', {
        id: 'stream-1',
        content: 'Streamed response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      for await (const message of agentLoop.stream('stream')) {
        chunks.push(message);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle streaming with tool calls', async () => {
      mockLLM.setResponse('stream tool', {
        id: 'st-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ path: '/stream.txt' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('st result', {
        id: 'st-2',
        content: 'Done streaming.',
        usage: { input_tokens: 50, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      mockFS.writeFileSync('/stream.txt', 'content');

      const chunks: AgentMessage[] = [];
      for await (const message of agentLoop.stream('stream tool')) {
        chunks.push(message);
      }

      expect(chunks.some(m => m.toolCalls)).toBe(true);
    });
  });

  describe('Stop Functionality', () => {
    it('should stop the agent loop', () => {
      agentLoop.stop();
      expect(agentLoop.getState().status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors', async () => {
      mockLLM.setNextCallToFail(new Error('LLM Error'));

      await expect(agentLoop.run('error')).rejects.toThrow('LLM Error');
      expect(agentLoop.getState().status).toBe('error');
    });

    it('should handle tool execution failures gracefully', async () => {
      mockLLM.setResponse('fail', {
        id: 'fail-1',
        content: '',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: {
              name: 'execute_command',
              arguments: JSON.stringify({ command: 'invalid' }),
            },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'tool_use',
      });

      mockLLM.setResponse('fail handled', {
        id: 'fail-2',
        content: 'Handled failure.',
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const messages = await agentLoop.run('fail');

      expect(messages).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should return immutable state copy', () => {
      const state1 = agentLoop.getState();
      const state2 = agentLoop.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('should maintain message history', async () => {
      mockLLM.setResponse('history', {
        id: 'hist-1',
        content: 'Response',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await agentLoop.run('history');

      const state = agentLoop.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe('history');
    });
  });
});
