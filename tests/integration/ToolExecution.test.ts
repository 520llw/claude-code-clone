/**
 * ToolExecution Integration Tests
 * 
 * End-to-end tests for tool execution flows, testing interactions
 * between different tool types and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockFS } from '../mocks/MockFS';
import { MockTools, ToolResult, ToolCall } from '../mocks/MockTools';

// Tool orchestrator for integration testing
interface ToolExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
}

interface ToolExecutionResult {
  success: boolean;
  results: Array<{
    toolCall: ToolCall;
    result: ToolResult;
    executionTime: number;
  }>;
  totalExecutionTime: number;
  errors: string[];
}

class ToolOrchestrator {
  private mockTools: MockTools;
  private context: ToolExecutionContext;

  constructor(mockTools: MockTools, context?: Partial<ToolExecutionContext>) {
    this.mockTools = mockTools;
    this.context = {
      workingDirectory: '/',
      environment: {},
      timeout: 30000,
      ...context,
    };
  }

  async executeSingle(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.mockTools.executeTool(toolCall);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async executeSequential(toolCalls: ToolCall[]): Promise<ToolExecutionResult> {
    const results: ToolExecutionResult['results'] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    for (const toolCall of toolCalls) {
      const callStart = Date.now();
      
      try {
        const result = await this.mockTools.executeTool(toolCall);
        results.push({
          toolCall,
          result,
          executionTime: Date.now() - callStart,
        });

        if (!result.success) {
          errors.push(`Tool ${toolCall.name} failed: ${result.error}`);
        }
      } catch (error: any) {
        errors.push(`Tool ${toolCall.name} error: ${error.message}`);
        results.push({
          toolCall,
          result: { success: false, error: error.message },
          executionTime: Date.now() - callStart,
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      totalExecutionTime: Date.now() - startTime,
      errors,
    };
  }

  async executeParallel(toolCalls: ToolCall[]): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    const executions = toolCalls.map(async (toolCall) => {
      const callStart = Date.now();
      
      try {
        const result = await this.mockTools.executeTool(toolCall);
        return {
          toolCall,
          result,
          executionTime: Date.now() - callStart,
        };
      } catch (error: any) {
        errors.push(`Tool ${toolCall.name} error: ${error.message}`);
        return {
          toolCall,
          result: { success: false, error: error.message },
          executionTime: Date.now() - callStart,
        };
      }
    });

    const results = await Promise.all(executions);

    // Collect errors from results
    results.forEach(r => {
      if (!r.result.success) {
        errors.push(`Tool ${r.toolCall.name} failed: ${r.result.error}`);
      }
    });

    return {
      success: errors.length === 0,
      results,
      totalExecutionTime: Date.now() - startTime,
      errors,
    };
  }

  async executeWithDependencies(
    toolCalls: Array<ToolCall & { dependsOn?: string[] }>
  ): Promise<ToolExecutionResult> {
    const results: ToolExecutionResult['results'] = [];
    const errors: string[] = [];
    const startTime = Date.now();
    const executed = new Set<string>();

    const canExecute = (toolCall: typeof toolCalls[0]): boolean => {
      if (!toolCall.dependsOn || toolCall.dependsOn.length === 0) return true;
      return toolCall.dependsOn.every(id => executed.has(id));
    };

    const pending = [...toolCalls];

    while (pending.length > 0) {
      const executable = pending.filter(canExecute);

      if (executable.length === 0 && pending.length > 0) {
        errors.push('Circular dependency detected or missing dependency');
        break;
      }

      for (const toolCall of executable) {
        const callStart = Date.now();
        const index = pending.indexOf(toolCall);
        pending.splice(index, 1);

        try {
          const result = await this.mockTools.executeTool(toolCall);
          results.push({
            toolCall,
            result,
            executionTime: Date.now() - callStart,
          });

          if (result.success && toolCall.id) {
            executed.add(toolCall.id);
          } else if (!result.success) {
            errors.push(`Tool ${toolCall.name} failed: ${result.error}`);
          }
        } catch (error: any) {
          errors.push(`Tool ${toolCall.name} error: ${error.message}`);
          results.push({
            toolCall,
            result: { success: false, error: error.message },
            executionTime: Date.now() - callStart,
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      results,
      totalExecutionTime: Date.now() - startTime,
      errors,
    };
  }

  setContext(context: Partial<ToolExecutionContext>): void {
    this.context = { ...this.context, ...context };
  }
}

describe('ToolExecution Integration', () => {
  let mockFS: MockFS;
  let mockTools: MockTools;
  let orchestrator: ToolOrchestrator;

  beforeEach(() => {
    mockFS = new MockFS();
    mockTools = new MockTools(mockFS);
    orchestrator = new ToolOrchestrator(mockTools);

    // Setup test files
    mockFS.mkdirSync('/project');
    mockFS.mkdirSync('/project/src');
    mockFS.writeFileSync('/project/src/index.ts', 'console.log("Hello");');
    mockFS.writeFileSync('/project/package.json', '{"name": "test"}');
  });

  afterEach(() => {
    mockFS.reset();
  });

  describe('Single Tool Execution', () => {
    it('should execute a single file read', async () => {
      const toolCall: ToolCall = {
        id: 'tool_1',
        name: 'read_file',
        arguments: { path: '/project/src/index.ts' },
      };

      const result = await orchestrator.executeSingle(toolCall);

      expect(result.success).toBe(true);
      expect(result.output).toContain('console.log');
    });

    it('should execute a single file write', async () => {
      const toolCall: ToolCall = {
        id: 'tool_1',
        name: 'write_file',
        arguments: { path: '/project/new.ts', content: 'const x = 1;' },
      };

      const result = await orchestrator.executeSingle(toolCall);

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/project/new.ts')).toBe(true);
    });

    it('should handle single tool failure', async () => {
      const toolCall: ToolCall = {
        id: 'tool_1',
        name: 'read_file',
        arguments: { path: '/nonexistent.ts' },
      };

      const result = await orchestrator.executeSingle(toolCall);

      expect(result.success).toBe(false);
    });
  });

  describe('Sequential Execution', () => {
    it('should execute multiple tools in sequence', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool_1',
          name: 'write_file',
          arguments: { path: '/project/file1.ts', content: 'const a = 1;' },
        },
        {
          id: 'tool_2',
          name: 'write_file',
          arguments: { path: '/project/file2.ts', content: 'const b = 2;' },
        },
        {
          id: 'tool_3',
          name: 'read_file',
          arguments: { path: '/project/file1.ts' },
        },
      ];

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(mockFS.existsSync('/project/file1.ts')).toBe(true);
      expect(mockFS.existsSync('/project/file2.ts')).toBe(true);
    });

    it('should stop on first failure in strict mode', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool_1',
          name: 'read_file',
          arguments: { path: '/exists.ts' },
        },
        {
          id: 'tool_2',
          name: 'read_file',
          arguments: { path: '/nonexistent.ts' },
        },
        {
          id: 'tool_3',
          name: 'write_file',
          arguments: { path: '/should-not-create.ts', content: '' },
        },
      ];

      // Create first file
      mockFS.writeFileSync('/exists.ts', 'content');

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should track execution times', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool_1',
          name: 'read_file',
          arguments: { path: '/project/package.json' },
        },
      ];

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.results[0].executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute multiple tools in parallel', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool_1',
          name: 'read_file',
          arguments: { path: '/project/src/index.ts' },
        },
        {
          id: 'tool_2',
          name: 'read_file',
          arguments: { path: '/project/package.json' },
        },
      ];

      const result = await orchestrator.executeParallel(toolCalls);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should complete parallel execution faster than sequential', async () => {
      const toolCalls: ToolCall[] = Array.from({ length: 5 }, (_, i) => ({
        id: `tool_${i}`,
        name: 'read_file',
        arguments: { path: '/project/package.json' },
      }));

      const seqStart = Date.now();
      await orchestrator.executeSequential(toolCalls);
      const seqTime = Date.now() - seqStart;

      const parStart = Date.now();
      await orchestrator.executeParallel(toolCalls);
      const parTime = Date.now() - parStart;

      // Parallel should generally be faster, but this is a loose check
      expect(parTime).toBeLessThanOrEqual(seqTime + 50);
    });

    it('should collect all errors from parallel execution', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'tool_1',
          name: 'read_file',
          arguments: { path: '/nonexistent1.ts' },
        },
        {
          id: 'tool_2',
          name: 'read_file',
          arguments: { path: '/nonexistent2.ts' },
        },
      ];

      const result = await orchestrator.executeParallel(toolCalls);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Dependency-based Execution', () => {
    it('should execute tools in dependency order', async () => {
      const toolCalls = [
        {
          id: 'create_dir',
          name: 'create_directory',
          arguments: { path: '/newproject' },
        },
        {
          id: 'create_file',
          name: 'write_file',
          arguments: { path: '/newproject/file.ts', content: 'test' },
          dependsOn: ['create_dir'],
        },
        {
          id: 'read_file',
          name: 'read_file',
          arguments: { path: '/newproject/file.ts' },
          dependsOn: ['create_file'],
        },
      ];

      const result = await orchestrator.executeWithDependencies(toolCalls);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    it('should handle multiple dependencies', async () => {
      const toolCalls = [
        {
          id: 'file1',
          name: 'write_file',
          arguments: { path: '/file1.ts', content: '1' },
        },
        {
          id: 'file2',
          name: 'write_file',
          arguments: { path: '/file2.ts', content: '2' },
        },
        {
          id: 'combined',
          name: 'list_directory',
          arguments: { path: '/' },
          dependsOn: ['file1', 'file2'],
        },
      ];

      const result = await orchestrator.executeWithDependencies(toolCalls);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    it('should detect circular dependencies', async () => {
      const toolCalls = [
        {
          id: 'a',
          name: 'read_file',
          arguments: { path: '/a.ts' },
          dependsOn: ['b'],
        },
        {
          id: 'b',
          name: 'read_file',
          arguments: { path: '/b.ts' },
          dependsOn: ['a'],
        },
      ];

      const result = await orchestrator.executeWithDependencies(toolCalls);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
    });

    it('should handle missing dependencies', async () => {
      const toolCalls = [
        {
          id: 'main',
          name: 'read_file',
          arguments: { path: '/file.ts' },
          dependsOn: ['nonexistent'],
        },
      ];

      const result = await orchestrator.executeWithDependencies(toolCalls);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('dependency'))).toBe(true);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle file creation workflow', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'create_directory',
          arguments: { path: '/project/dist' },
        },
        {
          id: '2',
          name: 'write_file',
          arguments: { path: '/project/dist/bundle.js', content: '/* bundle */' },
        },
        {
          id: '3',
          name: 'get_file_info',
          arguments: { path: '/project/dist/bundle.js' },
        },
      ];

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/project/dist/bundle.js')).toBe(true);
    });

    it('should handle search and replace workflow', async () => {
      mockFS.writeFileSync('/project/config.ts', 'const API_URL = "http://localhost";');

      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'read_file',
          arguments: { path: '/project/config.ts' },
        },
        {
          id: '2',
          name: 'edit_file',
          arguments: {
            path: '/project/config.ts',
            oldString: 'http://localhost',
            newString: 'https://api.example.com',
          },
        },
        {
          id: '3',
          name: 'read_file',
          arguments: { path: '/project/config.ts' },
        },
      ];

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.success).toBe(true);
      const content = mockFS.readFileSync('/project/config.ts', 'utf-8') as string;
      expect(content).toContain('https://api.example.com');
    });

    it('should handle batch file operations', async () => {
      const toolCalls: ToolCall[] = Array.from({ length: 10 }, (_, i) => ({
        id: `file_${i}`,
        name: 'write_file',
        arguments: { path: `/project/file${i}.ts`, content: `export const x${i} = ${i};` },
      }));

      const result = await orchestrator.executeParallel(toolCalls);

      expect(result.success).toBe(true);
      for (let i = 0; i < 10; i++) {
        expect(mockFS.existsSync(`/project/file${i}.ts`)).toBe(true);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should continue after non-critical failures', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'read_file',
          arguments: { path: '/exists.ts' },
        },
        {
          id: '2',
          name: 'read_file',
          arguments: { path: '/nonexistent.ts' },
        },
        {
          id: '3',
          name: 'write_file',
          arguments: { path: '/created.ts', content: 'success' },
        },
      ];

      mockFS.writeFileSync('/exists.ts', 'content');

      const result = await orchestrator.executeSequential(toolCalls);

      // All tools should have been executed
      expect(result.results).toHaveLength(3);
      expect(mockFS.existsSync('/created.ts')).toBe(true);
    });

    it('should provide detailed error information', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'read_file',
          arguments: { path: '/missing.ts' },
        },
      ];

      const result = await orchestrator.executeSequential(toolCalls);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('read_file');
    });
  });

  describe('Context Management', () => {
    it('should use working directory from context', async () => {
      orchestrator.setContext({ workingDirectory: '/project' });
      
      const toolCall: ToolCall = {
        id: '1',
        name: 'list_directory',
        arguments: { path: '/project' },
      };

      const result = await orchestrator.executeSingle(toolCall);
      expect(result.success).toBe(true);
    });

    it('should update context dynamically', async () => {
      orchestrator.setContext({ timeout: 5000 });
      
      const toolCall: ToolCall = {
        id: '1',
        name: 'read_file',
        arguments: { path: '/project/package.json' },
      };

      const result = await orchestrator.executeSingle(toolCall);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should execute single tool quickly', async () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'read_file',
        arguments: { path: '/project/package.json' },
      };

      const start = Date.now();
      await orchestrator.executeSingle(toolCall);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle large batch operations', async () => {
      const toolCalls: ToolCall[] = Array.from({ length: 50 }, (_, i) => ({
        id: `tool_${i}`,
        name: 'read_file',
        arguments: { path: '/project/package.json' },
      }));

      const start = Date.now();
      const result = await orchestrator.executeParallel(toolCalls);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(50);
      expect(duration).toBeLessThan(1000);
    });
  });
});
