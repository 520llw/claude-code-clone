/**
 * @fileoverview Server Tool for Claude Code Clone
 * 
 * This tool manages development servers:
 * - Start dev servers
 * - Stop running servers
 * - Check server status
 * - Port management
 * 
 * @module ServerTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const ServerInputSchema = z.object({
  action: z.enum(['start', 'stop', 'status', 'restart']).describe('Server action'),
  name: z.string().default('default').describe('Server instance name'),
  command: z.string().optional().describe('Command to start server'),
  port: z.number().int().min(1).max(65535).optional().describe('Server port'),
  working_dir: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  timeout: z.number().int().min(1000).max(60000).default(10000).describe('Startup timeout'),
}).describe('Input for server management');

export type ServerInput = z.infer<typeof ServerInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const ServerOutputSchema = z.object({
  action: z.string().describe('Action performed'),
  name: z.string().describe('Server name'),
  status: z.enum(['started', 'stopped', 'running', 'not_running', 'error']).describe('Server status'),
  port: z.number().int().optional().describe('Server port'),
  pid: z.number().int().optional().describe('Process ID'),
  message: z.string().describe('Status message'),
}).describe('Result of server operation');

export type ServerOutput = z.infer<typeof ServerOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

// Store running servers
const runningServers = new Map<string, { process: ChildProcess; port?: number; pid: number }>();

export class ServerTool extends Tool {
  public readonly name = 'server';
  public readonly description = 'Start, stop, and manage development servers';
  public readonly documentation = `
## Server Tool

Manages development servers:
- Start dev servers
- Stop running servers
- Check server status
- Restart servers

### Input Parameters

- **action** (required): 'start', 'stop', 'status', or 'restart'
- **name** (optional): Server instance name (default: 'default')
- **command** (optional): Command to start server
- **port** (optional): Server port
- **working_dir** (optional): Working directory
- **env** (optional): Environment variables
- **timeout** (optional): Startup timeout (default: 10000ms)

### Output

Returns server status:
- action: Action performed
- name: Server name
- status: 'started', 'stopped', 'running', 'not_running', 'error'
- port: Server port
- pid: Process ID
- message: Status message

### Examples

Start server:
\`\`\`json
{
  "action": "start",
  "command": "npm run dev",
  "port": 3000
}
\`\`\`

Check status:
\`\`\`json
{
  "action": "status",
  "name": "default"
}
\`\`\`

Stop server:
\`\`\`json
{
  "action": "stop",
  "name": "default"
}
\`\`\`
  `;
  public readonly category = ToolCategory.EXECUTION;
  public readonly permissionLevel = PermissionLevel.ASK;
  public readonly inputSchema = ServerInputSchema;
  public readonly outputSchema = ServerOutputSchema;
  public readonly tags = ['server', 'dev-server', 'process', 'port'];
  public readonly examples = [
    { description: 'Start server', input: { action: 'start', command: 'npm run dev', port: 3000 } },
    { description: 'Check status', input: { action: 'status' } },
    { description: 'Stop server', input: { action: 'stop' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as ServerInput;

    try {
      const workingDir = params.working_dir 
        ? path.resolve(context.workingDirectory, params.working_dir)
        : context.workingDirectory;

      let output: ServerOutput;

      switch (params.action) {
        case 'start':
          output = await this.startServer(params, workingDir);
          break;
        case 'stop':
          output = this.stopServer(params.name);
          break;
        case 'status':
          output = this.getStatus(params.name);
          break;
        case 'restart':
          this.stopServer(params.name);
          output = await this.startServer(params, workingDir);
          break;
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('SERVER_ERROR', String(error)));
    }
  }

  private async startServer(params: ServerInput, workingDir: string): Promise<ServerOutput> {
    if (!params.command) {
      throw new Error('Command required to start server');
    }

    // Stop existing server with same name
    if (runningServers.has(params.name)) {
      this.stopServer(params.name);
    }

    const env = { ...process.env, ...params.env };
    if (params.port) {
      env.PORT = String(params.port);
    }

    const child = spawn(params.command, [], {
      cwd: workingDir,
      shell: true,
      env,
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    // Wait a bit to see if process starts successfully
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (child.pid && !child.killed) {
      runningServers.set(params.name, {
        process: child,
        port: params.port,
        pid: child.pid,
      });

      return {
        action: 'start',
        name: params.name,
        status: 'started',
        port: params.port,
        pid: child.pid,
        message: `Server '${params.name}' started on port ${params.port || 'unknown'}`,
      };
    } else {
      throw new Error('Failed to start server process');
    }
  }

  private stopServer(name: string): ServerOutput {
    const server = runningServers.get(name);
    
    if (!server) {
      return {
        action: 'stop',
        name,
        status: 'not_running',
        message: `Server '${name}' is not running`,
      };
    }

    try {
      process.kill(-server.process.pid!, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(-server.process.pid!, 'SIGKILL');
        } catch {
          // Process already terminated
        }
      }, 5000);
    } catch {
      // Process already terminated
    }

    runningServers.delete(name);

    return {
      action: 'stop',
      name,
      status: 'stopped',
      message: `Server '${name}' stopped`,
    };
  }

  private getStatus(name: string): ServerOutput {
    const server = runningServers.get(name);
    
    if (!server) {
      return {
        action: 'status',
        name,
        status: 'not_running',
        message: `Server '${name}' is not running`,
      };
    }

    // Check if process is still alive
    try {
      process.kill(server.pid, 0);
      return {
        action: 'status',
        name,
        status: 'running',
        port: server.port,
        pid: server.pid,
        message: `Server '${name}' is running on port ${server.port || 'unknown'} (PID: ${server.pid})`,
      };
    } catch {
      runningServers.delete(name);
      return {
        action: 'status',
        name,
        status: 'not_running',
        message: `Server '${name}' is not running`,
      };
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: ServerOutput): string {
    const icon = output.status === 'running' || output.status === 'started' ? '🟢' : 
                 output.status === 'stopped' ? '🔴' : '⚪';
    return `${icon} ${output.message}`;
  }

  private createSuccessResult(startedAt: Date, data: ServerOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: data.status !== 'error',
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default ServerTool;
