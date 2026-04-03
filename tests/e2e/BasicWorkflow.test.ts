/**
 * Basic Workflow End-to-End Tests
 * Tests for common user workflows from start to finish
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestContext, cleanupTestContext, wait } from '../setup';
import { MockLLMClient, createMockLLM } from '../mocks/MockLLM';
import { MockToolRegistry, createMockTools } from '../mocks/MockTools';
import { MockFS, createSampleProjectFS } from '../mocks/MockFS';

// ============================================================================
// E2E Test Application
// ============================================================================

class E2EApplication {
  llm: MockLLMClient;
  tools: MockToolRegistry;
  fs: MockFS;
  messages: Array<{ role: string; content: string }> = [];
  conversationLog: Array<{
    input: string;
    output: string;
    toolsUsed: string[];
    timestamp: number;
  }> = [];

  constructor() {
    this.llm = createMockLLM();
    this.tools = createMockTools();
    this.fs = createSampleProjectFS();
  }

  async initialize(): Promise<void> {
    // Set up default LLM responses
    this.llm.addTextResponse('hello', 'Hello! I\'m Claude Code. How can I help you today?');
    this.llm.addTextResponse('help', 'I can help you with:\n- Reading and writing files\n- Running commands\n- Searching code\n- Answering questions');
  }

  async sendMessage(input: string): Promise<{
    response: string;
    toolsUsed: string[];
  }> {
    this.messages.push({ role: 'user', content: input });

    const llmResponse = await this.llm.complete(this.messages);
    const toolsUsed: string[] = [];

    // Execute tool calls
    if (llmResponse.toolCalls) {
      for (const toolCall of llmResponse.toolCalls) {
        const toolName = (toolCall as { function: { name: string } }).function.name;
        const args = JSON.parse((toolCall as { function: { arguments: string } }).function.arguments);
        
        await this.tools.execute(toolName, args);
        toolsUsed.push(toolName);

        // Add tool result to messages
        this.messages.push({
          role: 'tool',
          content: JSON.stringify({ success: true }),
        });
      }
    }

    this.messages.push({ role: 'assistant', content: llmResponse.content });

    this.conversationLog.push({
      input,
      output: llmResponse.content,
      toolsUsed,
      timestamp: Date.now(),
    });

    return {
      response: llmResponse.content,
      toolsUsed,
    };
  }

  getConversationLog(): typeof this.conversationLog {
    return [...this.conversationLog];
  }

  reset(): void {
    this.messages = [];
    this.conversationLog = [];
    this.llm.reset();
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Basic Workflow E2E', () => {
  let app: E2EApplication;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(async () => {
    testContext = createTestContext();
    app = new E2EApplication();
    await app.initialize();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Greeting Workflow
  // ============================================================================

  describe('Greeting Workflow', () => {
    test('should greet user', async () => {
      const result = await app.sendMessage('hello');

      expect(result.response).toContain('Hello');
      expect(result.toolsUsed).toHaveLength(0);
    });

    test('should provide help', async () => {
      const result = await app.sendMessage('help');

      expect(result.response).toContain('help');
      expect(result.response).toContain('files');
    });

    test('should maintain conversation context', async () => {
      await app.sendMessage('My name is Alice');
      const result = await app.sendMessage('What is my name?');

      expect(result.response).toBeDefined();
    });
  });

  // ============================================================================
  // File Reading Workflow
  // ============================================================================

  describe('File Reading Workflow', () => {
    test('should read a file', async () => {
      // Set up file content
      const readTool = app.tools.get('file_read')!;
      readTool.setFileContent('/README.md', '# Project\n\nThis is the README.');

      // Set up LLM to request file read
      app.llm.addToolResponse('file_read', { path: '/README.md' }, 'File content');
      app.llm.addTextResponse('File content', 'I found the README. It says: "This is the README."');

      const result = await app.sendMessage('Read the README file');

      expect(result.toolsUsed).toContain('file_read');
      expect(result.response).toContain('README');
    });

    test('should handle file not found', async () => {
      app.llm.addToolResponse('file_read', { path: '/missing.txt' }, '');
      app.llm.addTextResponse('error', 'I could not find that file.');

      const result = await app.sendMessage('Read /missing.txt');

      expect(result.toolsUsed).toContain('file_read');
      expect(result.response).toBeDefined();
    });
  });

  // ============================================================================
  // File Writing Workflow
  // ============================================================================

  describe('File Writing Workflow', () => {
    test('should write a file', async () => {
      app.llm.addToolResponse('file_write', { path: '/new-file.txt', content: 'Hello World' }, '');
      app.llm.addTextResponse('written', 'I\'ve created the file for you.');

      const result = await app.sendMessage('Create a file at /new-file.txt with "Hello World"');

      expect(result.toolsUsed).toContain('file_write');

      // Verify file was written
      const writeTool = app.tools.get('file_write')!;
      expect(writeTool.getWrittenContent('/new-file.txt')).toBe('Hello World');
    });

    test('should edit a file', async () => {
      // Set up existing file
      const readTool = app.tools.get('file_read')!;
      readTool.setFileContent('/edit.txt', 'Hello World');

      const editTool = app.tools.get('file_edit')!;
      editTool.setFileContent('/edit.txt', 'Hello World');

      app.llm.addToolResponse('file_edit', { path: '/edit.txt', oldString: 'World', newString: 'Universe' }, '');
      app.llm.addTextResponse('edited', 'I\'ve updated the file.');

      const result = await app.sendMessage('Change "World" to "Universe" in /edit.txt');

      expect(result.toolsUsed).toContain('file_edit');
    });
  });

  // ============================================================================
  // Search Workflow
  // ============================================================================

  describe('Search Workflow', () => {
    test('should search for files', async () => {
      const grepTool = app.tools.get('grep')!;
      grepTool.addSearchableFile('/src/main.ts', 'export function main() {}');
      grepTool.addSearchableFile('/src/utils.ts', 'export function util() {}');

      app.llm.addToolResponse('grep', { pattern: 'export', path: '/src' }, 'Found exports');
      app.llm.addTextResponse('found', 'I found 2 files with exports.');

      const result = await app.sendMessage('Find all export statements in /src');

      expect(result.toolsUsed).toContain('grep');
    });

    test('should list directory contents', async () => {
      app.llm.addToolResponse('list', { path: '/src' }, 'Listed');
      app.llm.addTextResponse('listed', 'The /src directory contains: index.ts, utils.ts, components/');

      const result = await app.sendMessage('What files are in /src?');

      expect(result.toolsUsed).toContain('list');
    });
  });

  // ============================================================================
  // Command Execution Workflow
  // ============================================================================

  describe('Command Execution Workflow', () => {
    test('should execute a command', async () => {
      app.llm.addToolResponse('bash', { command: 'ls -la' }, 'Command output');
      app.llm.addTextResponse('output', 'Here are the files:\nfile1.txt\nfile2.txt');

      const result = await app.sendMessage('List all files');

      expect(result.toolsUsed).toContain('bash');
    });

    test('should run npm commands', async () => {
      app.llm.addToolResponse('bash', { command: 'npm test' }, 'Test output');
      app.llm.addTextResponse('tests', 'All tests passed!');

      const result = await app.sendMessage('Run the tests');

      expect(result.toolsUsed).toContain('bash');
    });
  });

  // ============================================================================
  // Multi-Step Workflow
  // ============================================================================

  describe('Multi-Step Workflow', () => {
    test('should complete code review workflow', async () => {
      // Step 1: Read the file
      const readTool = app.tools.get('file_read')!;
      readTool.setFileContent('/code.ts', 'function add(a, b) { return a + b; }');

      app.llm.addToolResponse('file_read', { path: '/code.ts' }, 'File content');
      app.llm.addTextResponse('review', 'I see the code. Here are my suggestions:\n1. Add type annotations\n2. Add JSDoc comments');

      const result = await app.sendMessage('Review /code.ts');

      expect(result.toolsUsed).toContain('file_read');
      expect(result.response).toContain('suggestions');
    });

    test('should complete refactoring workflow', async () => {
      // Set up file
      const readTool = app.tools.get('file_read')!;
      readTool.setFileContent('/old.ts', 'var x = 1;');

      const editTool = app.tools.get('file_edit')!;
      editTool.setFileContent('/old.ts', 'var x = 1;');

      // Step 1: Read
      app.llm.addToolResponse('file_read', { path: '/old.ts' }, 'File content');
      app.llm.addTextResponse('read', 'I see the file uses var. Let me update it to const.');

      await app.sendMessage('Read /old.ts');

      // Step 2: Edit
      app.llm.addToolResponse('file_edit', { path: '/old.ts', oldString: 'var', newString: 'const' }, '');
      app.llm.addTextResponse('done', 'I\'ve updated the file to use const.');

      const result = await app.sendMessage('Change var to const');

      expect(result.toolsUsed).toContain('file_edit');
    });
  });

  // ============================================================================
  // Conversation History
  // ============================================================================

  describe('Conversation History', () => {
    test('should log all interactions', async () => {
      await app.sendMessage('Hello');
      await app.sendMessage('How are you?');
      await app.sendMessage('Goodbye');

      const log = app.getConversationLog();

      expect(log).toHaveLength(3);
      expect(log[0].input).toBe('Hello');
      expect(log[1].input).toBe('How are you?');
      expect(log[2].input).toBe('Goodbye');
    });

    test('should track tools used', async () => {
      app.llm.addToolResponse('file_read', { path: '/test.txt' }, 'Content');
      app.llm.addTextResponse('done', 'Done');

      await app.sendMessage('Read /test.txt');

      const log = app.getConversationLog();
      expect(log[0].toolsUsed).toContain('file_read');
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle tool errors gracefully', async () => {
      app.llm.addToolResponse('file_read', { path: '/error' }, '');
      app.llm.addTextResponse('error', 'I encountered an error reading that file.');

      const result = await app.sendMessage('Read /error');

      expect(result.response).toBeDefined();
    });

    test('should continue after errors', async () => {
      // First message causes error
      app.llm.addToolResponse('file_read', { path: '/bad' }, '');
      app.llm.addTextResponse('error1', 'Error occurred');
      await app.sendMessage('Read /bad');

      // Second message succeeds
      app.llm.addTextResponse('success', 'Success!');
      const result = await app.sendMessage('Hello');

      expect(result.response).toContain('Success');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      app.llm.addTextResponse('', 'I received an empty message.');

      const result = await app.sendMessage('');

      expect(result.response).toBeDefined();
    });

    test('should handle very long input', async () => {
      const longInput = 'a'.repeat(10000);
      app.llm.addTextResponse(longInput, 'Received long message');

      const result = await app.sendMessage(longInput);

      expect(result.response).toBeDefined();
    });

    test('should handle special characters', async () => {
      const specialInput = 'Hello\nWorld! <>&"\' Special chars: 🎉';
      app.llm.addTextResponse(specialInput, 'Received');

      const result = await app.sendMessage(specialInput);

      expect(result.response).toBeDefined();
    });

    test('should handle rapid messages', async () => {
      app.llm.addTextResponse('rapid', 'Response');

      const promises: Promise<{ response: string; toolsUsed: string[] }>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(app.sendMessage(`Message ${i}`));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
    });
  });
});
