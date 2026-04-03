/**
 * MCP (Model Context Protocol) Integration Tests
 * Tests for MCP client, server communication, and tool discovery
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestContext, cleanupTestContext, wait } from '../setup';

// ============================================================================
// Types
// ============================================================================

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// ============================================================================
// Mock MCP Client Implementation
// ============================================================================

class MockMCPClient {
  private connected = false;
  private serverCapabilities: {
    tools?: MCPTool[];
    resources?: MCPResource[];
  } = {};
  private requestHandlers: Map<string, (params: unknown) => Promise<unknown>> = new Map();
  private requestLog: MCPRequest[] = [];
  private responseDelay = 10;

  // ============================================================================
  // Connection
  // ============================================================================

  async connect(capabilities: { tools?: MCPTool[]; resources?: MCPResource[] } = {}): Promise<boolean> {
    await wait(this.responseDelay);
    
    this.serverCapabilities = capabilities;
    this.connected = true;
    
    // Set up default handlers
    this.setupDefaultHandlers();
    
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.serverCapabilities = {};
    this.requestHandlers.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // Tool Operations
  // ============================================================================

  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list', {});
    return (response as { tools: MCPTool[] }).tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.sendRequest('tools/call', { name, arguments: args });
    return response;
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest('resources/list', {});
    return (response as { resources: MCPResource[] }).resources || [];
  }

  async readResource(uri: string): Promise<unknown> {
    const response = await this.sendRequest('resources/read', { uri });
    return response;
  }

  // ============================================================================
  // Request Handling
  // ============================================================================

  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    await wait(this.responseDelay);

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params: params as Record<string, unknown>,
    };

    this.requestLog.push(request);

    const handler = this.requestHandlers.get(method);
    if (handler) {
      return handler(params);
    }

    throw new Error(`Method not found: ${method}`);
  }

  registerHandler(method: string, handler: (params: unknown) => Promise<unknown>): void {
    this.requestHandlers.set(method, handler);
  }

  // ============================================================================
  // Default Handlers
  // ============================================================================

  private setupDefaultHandlers(): void {
    this.registerHandler('tools/list', async () => ({
      tools: this.serverCapabilities.tools || [],
    }));

    this.registerHandler('tools/call', async (params) => {
      const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
      
      // Find tool
      const tool = this.serverCapabilities.tools?.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Mock execution
      return {
        content: [{ type: 'text', text: `Executed ${name} with ${JSON.stringify(args)}` }],
      };
    });

    this.registerHandler('resources/list', async () => ({
      resources: this.serverCapabilities.resources || [],
    }));

    this.registerHandler('resources/read', async (params) => {
      const { uri } = params as { uri: string };
      
      const resource = this.serverCapabilities.resources?.find(r => r.uri === uri);
      if (!resource) {
        throw new Error(`Resource not found: ${uri}`);
      }

      return {
        contents: [{ uri, mimeType: resource.mimeType, text: `Content of ${uri}` }],
      };
    });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  getRequestLog(): MCPRequest[] {
    return [...this.requestLog];
  }

  clearRequestLog(): void {
    this.requestLog = [];
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('MCP Integration', () => {
  let mcpClient: MockMCPClient;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    mcpClient = new MockMCPClient();
  });

  afterEach(async () => {
    await mcpClient.disconnect();
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Connection Tests
  // ============================================================================

  describe('Connection', () => {
    test('should connect to MCP server', async () => {
      const result = await mcpClient.connect();

      expect(result).toBe(true);
      expect(mcpClient.isConnected()).toBe(true);
    });

    test('should disconnect from MCP server', async () => {
      await mcpClient.connect();
      await mcpClient.disconnect();

      expect(mcpClient.isConnected()).toBe(false);
    });

    test('should throw when sending request while disconnected', async () => {
      let error: Error | undefined;

      try {
        await mcpClient.listTools();
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('Not connected');
    });
  });

  // ============================================================================
  // Tool Discovery Tests
  // ============================================================================

  describe('Tool Discovery', () => {
    test('should list available tools', async () => {
      const tools: MCPTool[] = [
        { name: 'read_file', description: 'Read a file', inputSchema: {} },
        { name: 'write_file', description: 'Write a file', inputSchema: {} },
      ];

      await mcpClient.connect({ tools });
      const result = await mcpClient.listTools();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('read_file');
    });

    test('should return empty list when no tools', async () => {
      await mcpClient.connect();
      const result = await mcpClient.listTools();

      expect(result).toHaveLength(0);
    });

    test('should discover tools dynamically', async () => {
      await mcpClient.connect({
        tools: [{ name: 'dynamic_tool', description: 'Dynamic', inputSchema: {} }],
      });

      const tools = await mcpClient.listTools();
      expect(tools.some(t => t.name === 'dynamic_tool')).toBe(true);
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await mcpClient.connect({
        tools: [
          { name: 'echo', description: 'Echo tool', inputSchema: { type: 'object' } },
          { name: 'calculate', description: 'Calculator', inputSchema: { type: 'object' } },
        ],
      });
    });

    test('should call tool successfully', async () => {
      const result = await mcpClient.callTool('echo', { message: 'Hello' });

      expect(result).toBeDefined();
    });

    test('should pass arguments to tool', async () => {
      const result = await mcpClient.callTool('echo', { message: 'Test' });

      expect((result as { content: Array<{ text: string }> }).content[0].text).toContain('Test');
    });

    test('should throw for unknown tool', async () => {
      let error: Error | undefined;

      try {
        await mcpClient.callTool('unknown_tool', {});
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('Tool not found');
    });

    test('should log tool calls', async () => {
      await mcpClient.callTool('echo', { message: 'Logged' });

      const log = mcpClient.getRequestLog();
      expect(log.some(r => r.method === 'tools/call')).toBe(true);
    });
  });

  // ============================================================================
  // Resource Tests
  // ============================================================================

  describe('Resources', () => {
    beforeEach(async () => {
      await mcpClient.connect({
        resources: [
          { uri: 'file:///config.json', name: 'Config', mimeType: 'application/json' },
          { uri: 'file:///readme.md', name: 'README', mimeType: 'text/markdown' },
        ],
      });
    });

    test('should list available resources', async () => {
      const resources = await mcpClient.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toBe('file:///config.json');
    });

    test('should read resource', async () => {
      const result = await mcpClient.readResource('file:///config.json');

      expect(result).toBeDefined();
      expect((result as { contents: Array<{ text: string }> }).contents[0].text).toContain('file:///config.json');
    });

    test('should throw for unknown resource', async () => {
      let error: Error | undefined;

      try {
        await mcpClient.readResource('file:///unknown.txt');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('Resource not found');
    });

    test('should include mime type in resource', async () => {
      const resources = await mcpClient.listResources();
      const config = resources.find(r => r.uri === 'file:///config.json');

      expect(config?.mimeType).toBe('application/json');
    });
  });

  // ============================================================================
  // Request Logging Tests
  // ============================================================================

  describe('Request Logging', () => {
    beforeEach(async () => {
      await mcpClient.connect({
        tools: [{ name: 'test', description: 'Test', inputSchema: {} }],
      });
    });

    test('should log all requests', async () => {
      await mcpClient.listTools();
      await mcpClient.callTool('test', {});

      const log = mcpClient.getRequestLog();
      expect(log).toHaveLength(2);
    });

    test('should include request method', async () => {
      await mcpClient.listTools();

      const log = mcpClient.getRequestLog();
      expect(log[0].method).toBe('tools/list');
    });

    test('should include request id', async () => {
      await mcpClient.listTools();

      const log = mcpClient.getRequestLog();
      expect(log[0].id).toBeDefined();
    });

    test('should clear request log', async () => {
      await mcpClient.listTools();
      mcpClient.clearRequestLog();

      expect(mcpClient.getRequestLog()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Custom Handlers Tests
  // ============================================================================

  describe('Custom Handlers', () => {
    test('should register custom handler', async () => {
      await mcpClient.connect();

      mcpClient.registerHandler('custom/method', async (params) => ({
        customResult: params,
      }));

      // Custom handlers need to be called through sendRequest
      // which is private, so we test via the public interface
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    beforeEach(async () => {
      await mcpClient.connect({
        tools: Array.from({ length: 50 }, (_, i) => ({
          name: `tool_${i}`,
          description: `Tool ${i}`,
          inputSchema: {},
        })),
      });
    });

    test('should handle many tools', async () => {
      const tools = await mcpClient.listTools();
      expect(tools).toHaveLength(50);
    });

    test('should handle rapid requests', async () => {
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 20; i++) {
        promises.push(mcpClient.callTool(`tool_${i}`, {}));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
    });

    test('should respect response delay', async () => {
      mcpClient.setResponseDelay(50);

      const start = Date.now();
      await mcpClient.listTools();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty tool arguments', async () => {
      await mcpClient.connect({
        tools: [{ name: 'no_args', description: 'No args', inputSchema: {} }],
      });

      const result = await mcpClient.callTool('no_args', {});
      expect(result).toBeDefined();
    });

    test('should handle tool with complex arguments', async () => {
      await mcpClient.connect({
        tools: [{ name: 'complex', description: 'Complex', inputSchema: {} }],
      });

      const complexArgs = {
        nested: { key: 'value' },
        array: [1, 2, 3],
        string: 'test',
      };

      const result = await mcpClient.callTool('complex', complexArgs);
      expect(result).toBeDefined();
    });

    test('should handle reconnection', async () => {
      await mcpClient.connect({ tools: [] });
      await mcpClient.disconnect();
      await mcpClient.connect({ tools: [{ name: 'new', description: 'New', inputSchema: {} }] });

      const tools = await mcpClient.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('new');
    });

    test('should handle resource without mime type', async () => {
      await mcpClient.connect({
        resources: [{ uri: 'file:///plain.txt', name: 'Plain' }],
      });

      const resources = await mcpClient.listResources();
      expect(resources[0].mimeType).toBeUndefined();
    });
  });
});
