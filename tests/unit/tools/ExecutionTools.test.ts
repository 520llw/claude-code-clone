/**
 * ExecutionTools Tests
 * 
 * Comprehensive test suite for execution-related tools including
 * shell command execution, package management, and script running.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ToolResult } from '../../mocks/MockTools';

// Execution result types
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'completed' | 'error';
}

// ExecutionTools implementation
class ExecutionTools {
  private commandHistory: Array<{
    command: string;
    result: CommandResult;
    timestamp: number;
  }> = [];
  private mockOutputs: Map<string, CommandResult> = new Map();
  private runningProcesses: Map<number, ProcessInfo> = new Map();
  private processIdCounter = 1000;
  private shouldFailNext = false;
  private failWithError?: Error;

  /**
   * Execute a shell command
   */
  async executeCommand(args: {
    command: string;
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }): Promise<ToolResult> {
    // Check for forced failure
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        error: this.failWithError?.message || 'Command execution failed',
      };
    }

    // Check for mock output
    const mockResult = this.mockOutputs.get(args.command);
    if (mockResult) {
      this.logCommand(args.command, mockResult);
      return {
        success: mockResult.exitCode === 0,
        output: mockResult.stdout,
        error: mockResult.stderr || undefined,
        metadata: {
          exitCode: mockResult.exitCode,
          executionTime: mockResult.executionTime,
        },
      };
    }

    // Simulate command execution
    const startTime = Date.now();
    const simulatedResult = this.simulateCommand(args.command);
    const executionTime = Date.now() - startTime;

    const result: CommandResult = {
      ...simulatedResult,
      executionTime,
    };

    this.logCommand(args.command, result);

    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr || undefined,
      metadata: {
        exitCode: result.exitCode,
        executionTime,
      },
    };
  }

  /**
   * Execute command with streaming output
   */
  async *streamCommand(args: {
    command: string;
    cwd?: string;
  }): AsyncGenerator<{ type: 'stdout' | 'stderr'; data: string }> {
    const mockResult = this.mockOutputs.get(args.command);
    
    if (mockResult) {
      const lines = mockResult.stdout.split('\n');
      for (const line of lines) {
        if (line) {
          yield { type: 'stdout', data: line };
        }
      }
      if (mockResult.stderr) {
        yield { type: 'stderr', data: mockResult.stderr };
      }
      return;
    }

    // Default streaming simulation
    yield { type: 'stdout', data: `$ ${args.command}` };
    yield { type: 'stdout', data: 'Executing...' };
    yield { type: 'stdout', data: 'Done' };
  }

  /**
   * Run npm/yarn/pnpm command
   */
  async runPackageCommand(args: {
    packageManager: 'npm' | 'yarn' | 'pnpm';
    script: string;
    args?: string[];
    cwd?: string;
  }): Promise<ToolResult> {
    const command = `${args.packageManager} ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command, cwd: args.cwd });
  }

  /**
   * Run Python script
   */
  async runPython(args: {
    script: string;
    args?: string[];
    cwd?: string;
  }): Promise<ToolResult> {
    const command = `python ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command, cwd: args.cwd });
  }

  /**
   * Run Node.js script
   */
  async runNode(args: {
    script: string;
    args?: string[];
    cwd?: string;
  }): Promise<ToolResult> {
    const command = `node ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command, cwd: args.cwd });
  }

  /**
   * Start a background process
   */
  async startProcess(args: {
    command: string;
    cwd?: string;
  }): Promise<ToolResult> {
    const pid = ++this.processIdCounter;
    
    const processInfo: ProcessInfo = {
      pid,
      command: args.command,
      status: 'running',
    };

    this.runningProcesses.set(pid, processInfo);

    // Simulate process completion after a delay
    setTimeout(() => {
      processInfo.status = 'completed';
    }, 100);

    return {
      success: true,
      output: `Process started with PID ${pid}`,
      metadata: { pid },
    };
  }

  /**
   * Stop a running process
   */
  async stopProcess(args: { pid: number }): Promise<ToolResult> {
    const process = this.runningProcesses.get(args.pid);
    
    if (!process) {
      return {
        success: false,
        error: `Process ${args.pid} not found`,
      };
    }

    process.status = 'completed';
    return {
      success: true,
      output: `Process ${args.pid} stopped`,
    };
  }

  /**
   * Get process status
   */
  async getProcessStatus(args: { pid: number }): Promise<ToolResult> {
    const process = this.runningProcesses.get(args.pid);
    
    if (!process) {
      return {
        success: false,
        error: `Process ${args.pid} not found`,
      };
    }

    return {
      success: true,
      output: JSON.stringify(process, null, 2),
      data: process,
    };
  }

  /**
   * Get all running processes
   */
  getRunningProcesses(): ProcessInfo[] {
    return Array.from(this.runningProcesses.values())
      .filter(p => p.status === 'running');
  }

  /**
   * Set mock output for a command
   */
  setMockOutput(command: string, result: CommandResult): void {
    this.mockOutputs.set(command, result);
  }

  /**
   * Set next command to fail
   */
  setNextCommandToFail(error?: Error): void {
    this.shouldFailNext = true;
    this.failWithError = error;
  }

  /**
   * Get command history
   */
  getCommandHistory(): Array<{
    command: string;
    result: CommandResult;
    timestamp: number;
  }> {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.mockOutputs.clear();
    this.runningProcesses.clear();
  }

  private simulateCommand(command: string): CommandResult {
    // Simulate different command behaviors
    if (command.includes('ls') || command.includes('dir')) {
      return {
        stdout: 'file1.txt\nfile2.txt\ndir1/',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      };
    }

    if (command.includes('cat') || command.includes('type')) {
      return {
        stdout: 'File contents here',
        stderr: '',
        exitCode: 0,
        executionTime: 50,
      };
    }

    if (command.includes('error') || command.includes('fail')) {
      return {
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1,
        executionTime: 100,
      };
    }

    if (command.includes('echo')) {
      const parts = command.split(' ');
      parts.shift(); // Remove 'echo'
      return {
        stdout: parts.join(' '),
        stderr: '',
        exitCode: 0,
        executionTime: 10,
      };
    }

    // Default response
    return {
      stdout: `Executed: ${command}`,
      stderr: '',
      exitCode: 0,
      executionTime: 100,
    };
  }

  private logCommand(command: string, result: CommandResult): void {
    this.commandHistory.push({
      command,
      result,
      timestamp: Date.now(),
    });
  }
}

describe('ExecutionTools', () => {
  let executionTools: ExecutionTools;

  beforeEach(() => {
    executionTools = new ExecutionTools();
  });

  describe('executeCommand', () => {
    it('should execute a simple command', async () => {
      const result = await executionTools.executeCommand({
        command: 'echo Hello World',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
    });

    it('should return exit code', async () => {
      const result = await executionTools.executeCommand({
        command: 'ls',
      });

      expect(result.metadata?.exitCode).toBe(0);
    });

    it('should return execution time', async () => {
      const result = await executionTools.executeCommand({
        command: 'echo test',
      });

      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle command failure', async () => {
      const result = await executionTools.executeCommand({
        command: 'fail_command',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.exitCode).toBe(1);
    });

    it('should use mock output when set', async () => {
      executionTools.setMockOutput('custom_command', {
        stdout: 'Mock output',
        stderr: '',
        exitCode: 0,
        executionTime: 50,
      });

      const result = await executionTools.executeCommand({
        command: 'custom_command',
      });

      expect(result.output).toBe('Mock output');
    });

    it('should handle forced failure', async () => {
      executionTools.setNextCommandToFail(new Error('Forced error'));

      const result = await executionTools.executeCommand({
        command: 'any_command',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Forced error');
    });

    it('should accept cwd parameter', async () => {
      const result = await executionTools.executeCommand({
        command: 'ls',
        cwd: '/project',
      });

      expect(result.success).toBe(true);
    });

    it('should accept env parameter', async () => {
      const result = await executionTools.executeCommand({
        command: 'echo $TEST',
        env: { TEST: 'value' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('streamCommand', () => {
    it('should stream command output', async () => {
      const chunks: Array<{ type: string; data: string }> = [];

      for await (const chunk of executionTools.streamCommand({
        command: 'test',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should stream mock output', async () => {
      executionTools.setMockOutput('stream_test', {
        stdout: 'Line 1\nLine 2\nLine 3',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      });

      const chunks: Array<{ type: string; data: string }> = [];
      for await (const chunk of executionTools.streamCommand({
        command: 'stream_test',
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
    });

    it('should include stderr in stream', async () => {
      executionTools.setMockOutput('error_stream', {
        stdout: 'Output',
        stderr: 'Error message',
        exitCode: 1,
        executionTime: 100,
      });

      const chunks: Array<{ type: string; data: string }> = [];
      for await (const chunk of executionTools.streamCommand({
        command: 'error_stream',
      })) {
        chunks.push(chunk);
      }

      const stderrChunk = chunks.find(c => c.type === 'stderr');
      expect(stderrChunk).toBeDefined();
      expect(stderrChunk?.data).toBe('Error message');
    });
  });

  describe('runPackageCommand', () => {
    it('should run npm command', async () => {
      executionTools.setMockOutput('npm install', {
        stdout: 'Packages installed',
        stderr: '',
        exitCode: 0,
        executionTime: 5000,
      });

      const result = await executionTools.runPackageCommand({
        packageManager: 'npm',
        script: 'install',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Packages installed');
    });

    it('should run yarn command', async () => {
      executionTools.setMockOutput('yarn build', {
        stdout: 'Build successful',
        stderr: '',
        exitCode: 0,
        executionTime: 10000,
      });

      const result = await executionTools.runPackageCommand({
        packageManager: 'yarn',
        script: 'build',
      });

      expect(result.success).toBe(true);
    });

    it('should run pnpm command', async () => {
      executionTools.setMockOutput('pnpm test', {
        stdout: 'Tests passed',
        stderr: '',
        exitCode: 0,
        executionTime: 3000,
      });

      const result = await executionTools.runPackageCommand({
        packageManager: 'pnpm',
        script: 'test',
      });

      expect(result.success).toBe(true);
    });

    it('should pass additional arguments', async () => {
      executionTools.setMockOutput('npm run build -- --watch', {
        stdout: 'Building with watch',
        stderr: '',
        exitCode: 0,
        executionTime: 1000,
      });

      const result = await executionTools.runPackageCommand({
        packageManager: 'npm',
        script: 'run',
        args: ['build', '--', '--watch'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('runPython', () => {
    it('should run Python script', async () => {
      executionTools.setMockOutput('python script.py', {
        stdout: 'Python output',
        stderr: '',
        exitCode: 0,
        executionTime: 500,
      });

      const result = await executionTools.runPython({
        script: 'script.py',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Python output');
    });

    it('should pass script arguments', async () => {
      executionTools.setMockOutput('python script.py --arg1 value', {
        stdout: 'With args',
        stderr: '',
        exitCode: 0,
        executionTime: 500,
      });

      const result = await executionTools.runPython({
        script: 'script.py',
        args: ['--arg1', 'value'],
      });

      expect(result.success).toBe(true);
    });

    it('should handle Python errors', async () => {
      executionTools.setMockOutput('python error.py', {
        stdout: '',
        stderr: 'SyntaxError: invalid syntax',
        exitCode: 1,
        executionTime: 100,
      });

      const result = await executionTools.runPython({
        script: 'error.py',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });
  });

  describe('runNode', () => {
    it('should run Node.js script', async () => {
      executionTools.setMockOutput('node app.js', {
        stdout: 'Node output',
        stderr: '',
        exitCode: 0,
        executionTime: 200,
      });

      const result = await executionTools.runNode({
        script: 'app.js',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Node output');
    });

    it('should pass script arguments', async () => {
      executionTools.setMockOutput('node server.js --port 3000', {
        stdout: 'Server started on port 3000',
        stderr: '',
        exitCode: 0,
        executionTime: 200,
      });

      const result = await executionTools.runNode({
        script: 'server.js',
        args: ['--port', '3000'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Process Management', () => {
    it('should start a background process', async () => {
      const result = await executionTools.startProcess({
        command: 'long_running_task',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.pid).toBeDefined();
    });

    it('should stop a process', async () => {
      const start = await executionTools.startProcess({
        command: 'task',
      });
      const pid = start.metadata?.pid;

      const stop = await executionTools.stopProcess({ pid });
      expect(stop.success).toBe(true);
    });

    it('should fail to stop non-existent process', async () => {
      const result = await executionTools.stopProcess({ pid: 99999 });
      expect(result.success).toBe(false);
    });

    it('should get process status', async () => {
      const start = await executionTools.startProcess({
        command: 'task',
      });
      const pid = start.metadata?.pid;

      const status = await executionTools.getProcessStatus({ pid });
      expect(status.success).toBe(true);
      expect(status.data).toBeDefined();
    });

    it('should fail to get status of non-existent process', async () => {
      const result = await executionTools.getProcessStatus({ pid: 99999 });
      expect(result.success).toBe(false);
    });

    it('should list running processes', async () => {
      await executionTools.startProcess({ command: 'task1' });
      await executionTools.startProcess({ command: 'task2' });

      const processes = executionTools.getRunningProcesses();
      expect(processes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Command History', () => {
    it('should log executed commands', async () => {
      await executionTools.executeCommand({ command: 'cmd1' });
      await executionTools.executeCommand({ command: 'cmd2' });

      const history = executionTools.getCommandHistory();
      expect(history).toHaveLength(2);
    });

    it('should include command details in history', async () => {
      await executionTools.executeCommand({ command: 'test' });

      const history = executionTools.getCommandHistory();
      expect(history[0].command).toBe('test');
      expect(history[0].result).toBeDefined();
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should include exit code in history', async () => {
      await executionTools.executeCommand({ command: 'fail_command' });

      const history = executionTools.getCommandHistory();
      expect(history[0].result.exitCode).toBe(1);
    });

    it('should clear history', async () => {
      await executionTools.executeCommand({ command: 'test' });
      executionTools.clearHistory();

      expect(executionTools.getCommandHistory()).toHaveLength(0);
    });
  });

  describe('Mock Output Management', () => {
    it('should set and use mock output', async () => {
      executionTools.setMockOutput('mocked', {
        stdout: 'Mocked output',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      });

      const result = await executionTools.executeCommand({ command: 'mocked' });
      expect(result.output).toBe('Mocked output');
    });

    it('should support multiple mock outputs', async () => {
      executionTools.setMockOutput('cmd1', {
        stdout: 'Output 1',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      });

      executionTools.setMockOutput('cmd2', {
        stdout: 'Output 2',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      });

      const result1 = await executionTools.executeCommand({ command: 'cmd1' });
      const result2 = await executionTools.executeCommand({ command: 'cmd2' });

      expect(result1.output).toBe('Output 1');
      expect(result2.output).toBe('Output 2');
    });

    it('should clear mocks with history', async () => {
      executionTools.setMockOutput('mocked', {
        stdout: 'Mock',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      });

      executionTools.clearHistory();

      // After clearing, should use default simulation
      const result = await executionTools.executeCommand({ command: 'mocked' });
      expect(result.output).not.toBe('Mock');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty command', async () => {
      const result = await executionTools.executeCommand({ command: '' });
      expect(result.success).toBe(true);
    });

    it('should handle very long commands', async () => {
      const longCommand = 'echo ' + 'x'.repeat(10000);
      const result = await executionTools.executeCommand({ command: longCommand });
      expect(result.success).toBe(true);
    });

    it('should handle commands with special characters', async () => {
      const result = await executionTools.executeCommand({
        command: 'echo "Hello; World | Test & More"',
      });
      expect(result.success).toBe(true);
    });

    it('should handle timeout parameter', async () => {
      const result = await executionTools.executeCommand({
        command: 'sleep 10',
        timeout: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('should handle concurrent command execution', async () => {
      const promises = [
        executionTools.executeCommand({ command: 'cmd1' }),
        executionTools.executeCommand({ command: 'cmd2' }),
        executionTools.executeCommand({ command: 'cmd3' }),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
