/**
 * Model Context Protocol (MCP) Stdio Transport
 * 
 * This module provides a transport implementation that uses standard input/output
 * streams for communication. This is the most common transport for MCP servers
 * that are spawned as child processes.
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { Readable, Writable } from 'stream';
import {
  MCPTransport,
  TransportState,
  TransportError,
  ConnectionTimeoutError,
  MessageSerializationError,
  MessageParsingError,
  createMessageId,
} from '../MCPTransport';
import {
  JSONRPCMessage,
  StdioTransportOptions,
  MCP_ERROR_CODES,
} from '../types';

/**
 * Stdio transport for MCP communication
 * 
 * Spawns a child process and communicates via stdin/stdout.
 * stderr is available for logging.
 */
export class StdioTransport extends MCPTransport {
  private _process: ChildProcess | null = null;
  private _stderrBuffer = '';
  private _stdoutBuffer = '';
  private _messageQueue: Buffer[] = [];
  private _isReading = false;

  constructor(options: StdioTransportOptions) {
    super(options);
  }

  /**
   * Get the child process
   */
  get process(): ChildProcess | null {
    return this._process;
  }

  /**
   * Get transport options
   */
  get stdioOptions(): StdioTransportOptions {
    return this._options as StdioTransportOptions;
  }

  /**
   * Check if the process is running
   */
  get isProcessRunning(): boolean {
    return this._process !== null && !this._process.killed;
  }

  /**
   * Connect to the stdio transport by spawning the process
   */
  async connect(): Promise<void> {
    if (this._state === TransportState.CONNECTED || this._state === TransportState.CONNECTING) {
      return;
    }

    this.setState(TransportState.CONNECTING);

    try {
      await this.spawnProcess();
      this.setState(TransportState.CONNECTED);
      this.handleConnect();
    } catch (error) {
      this.setState(TransportState.ERROR);
      throw error;
    }
  }

  /**
   * Disconnect from the transport by killing the process
   */
  async disconnect(): Promise<void> {
    if (this._state === TransportState.DISCONNECTED || this._state === TransportState.DISCONNECTING) {
      return;
    }

    this.setState(TransportState.DISCONNECTING);

    if (this._process && !this._process.killed) {
      // Try graceful shutdown first
      this._process.stdin?.end();

      // Give it a moment to close gracefully
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Force kill if still running
      if (!this._process.killed) {
        this._process.kill('SIGTERM');

        // Give it another moment
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Force kill with SIGKILL if still running
        if (!this._process.killed) {
          this._process.kill('SIGKILL');
        }
      }
    }

    this._process = null;
    this._stderrBuffer = '';
    this._stdoutBuffer = '';

    this.setState(TransportState.DISCONNECTED);
    this.handleClose('Process terminated');
  }

  /**
   * Spawn the child process
   */
  private async spawnProcess(): Promise<void> {
    const options = this.stdioOptions;

    const spawnOptions: SpawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
      cwd: options.cwd,
      windowsHide: true,
    };

    return new Promise((resolve, reject) => {
      try {
        this._process = spawn(options.command, options.args ?? [], spawnOptions);

        if (!this._process.stdin || !this._process.stdout || !this._process.stderr) {
          reject(new TransportError(
            'Failed to create stdio streams',
            'STDIO_STREAM_ERROR'
          ));
          return;
        }

        // Set up stdout data handler
        this._process.stdout.on('data', (data: Buffer) => {
          this.handleStdoutData(data);
        });

        // Set up stderr data handler
        this._process.stderr.on('data', (data: Buffer) => {
          this.handleStderrData(data);
        });

        // Set up process error handler
        this._process.on('error', (error) => {
          this.handleError(new TransportError(
            `Process error: ${error.message}`,
            'PROCESS_ERROR',
            error
          ));
        });

        // Set up process close handler
        this._process.on('close', (code, signal) => {
          const reason = code !== null ? `exit code ${code}` : `signal ${signal}`;
          this.handleClose(`Process closed with ${reason}`);
        });

        // Set up process exit handler
        this._process.on('exit', (code, signal) => {
          const reason = code !== null ? `exit code ${code}` : `signal ${signal}`;
          this.handleClose(`Process exited with ${reason}`);
        });

        // Wait a moment for the process to start
        setTimeout(() => {
          if (this._process && !this._process.killed) {
            resolve();
          } else {
            reject(new TransportError(
              'Process failed to start',
              'PROCESS_START_ERROR'
            ));
          }
        }, 100);
      } catch (error) {
        reject(new TransportError(
          `Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`,
          'SPAWN_ERROR',
          error instanceof Error ? error : undefined
        ));
      }
    });
  }

  /**
   * Handle stdout data
   */
  private handleStdoutData(data: Buffer): void {
    // Append to buffer
    this._stdoutBuffer += data.toString('utf-8');

    // Process complete messages (line-delimited JSON)
    const lines = this._stdoutBuffer.split('\n');
    this._stdoutBuffer = lines.pop() ?? ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const message = this.parseMessage(trimmed);
        if (message) {
          this.handleMessage(message);
        }
      }
    }
  }

  /**
   * Handle stderr data
   */
  private handleStderrData(data: Buffer): void {
    this._stderrBuffer += data.toString('utf-8');

    // Process complete lines
    const lines = this._stderrBuffer.split('\n');
    this._stderrBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Emit stderr as an event for logging purposes
        this.emit('stderr', trimmed);
      }
    }
  }

  /**
   * Send a message through the transport
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected || !this._process?.stdin) {
      throw new TransportError('Transport not connected', 'TRANSPORT_NOT_CONNECTED');
    }

    try {
      const data = this.serializeMessage(message);
      const line = `${data}\n`;

      return new Promise((resolve, reject) => {
        const stdin = this._process!.stdin!;

        const onError = (error: Error): void => {
          cleanup();
          reject(new MessageSerializationError(error));
        };

        const onDrain = (): void => {
          cleanup();
          resolve();
        };

        const cleanup = (): void => {
          stdin.off('error', onError);
        };

        stdin.once('error', onError);

        const canWrite = stdin.write(line, 'utf-8');

        if (canWrite) {
          cleanup();
          resolve();
        } else {
          stdin.once('drain', onDrain);
        }
      });
    } catch (error) {
      throw new MessageSerializationError(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Send a message with progress tracking
   */
  async sendWithProgress(
    message: JSONRPCMessage,
    onProgress?: (progress: import('../types').Progress) => void
  ): Promise<void> {
    // Stdio doesn't natively support progress, but we can track it via notifications
    if (onProgress && 'id' in message) {
      // Set up a one-time listener for progress notifications
      const checkProgress = (msg: JSONRPCMessage): void => {
        if (
          'method' in msg &&
          msg.method === 'notifications/progress' &&
          'params' in msg &&
          typeof msg.params === 'object' &&
          msg.params !== null
        ) {
          const params = msg.params as { progressToken: string | number; progress: number; total?: number };
          if (params.progressToken === message.id) {
            onProgress({
              progress: params.progress,
              total: params.total,
            });
          }
        }
      };

      this.once('message', checkProgress);
    }

    await this.send(message);
  }

  /**
   * Write raw data to stdin
   */
  async writeRaw(data: string | Buffer): Promise<void> {
    if (!this.isConnected || !this._process?.stdin) {
      throw new TransportError('Transport not connected', 'TRANSPORT_NOT_CONNECTED');
    }

    return new Promise((resolve, reject) => {
      const stdin = this._process!.stdin!;

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const onDrain = (): void => {
        cleanup();
        resolve();
      };

      const cleanup = (): void => {
        stdin.off('error', onError);
      };

      stdin.once('error', onError);

      const canWrite = stdin.write(data);

      if (canWrite) {
        cleanup();
        resolve();
      } else {
        stdin.once('drain', onDrain);
      }
    });
  }

  /**
   * Get the process ID
   */
  get pid(): number | undefined {
    return this._process?.pid;
  }

  /**
   * Kill the process with a specific signal
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    if (!this._process || this._process.killed) {
      return false;
    }

    return this._process.kill(signal);
  }

  /**
   * Dispose of the transport
   */
  async dispose(): Promise<void> {
    await super.dispose();
    this._stderrBuffer = '';
    this._stdoutBuffer = '';
    this._messageQueue = [];
  }
}

/**
 * Stdio transport factory
 */
export class StdioTransportFactory {
  static create(options: StdioTransportOptions): StdioTransport {
    return new StdioTransport(options);
  }
}

/**
 * Create a stdio transport instance
 */
export function createStdioTransport(options: Omit<StdioTransportOptions, 'type'>): StdioTransport {
  return new StdioTransport({ type: 'stdio', ...options });
}

/**
 * Stdio transport error
 */
export class StdioTransportError extends TransportError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'StdioTransportError';
  }
}

/**
 * Process spawn error
 */
export class ProcessSpawnError extends StdioTransportError {
  constructor(command: string, cause?: Error) {
    super(`Failed to spawn process: ${command}`, 'PROCESS_SPAWN_ERROR', cause);
    this.name = 'ProcessSpawnError';
  }
}

/**
 * Process exited error
 */
export class ProcessExitedError extends StdioTransportError {
  constructor(code: number | null, signal: NodeJS.Signals | null) {
    const reason = code !== null ? `exit code ${code}` : `signal ${signal}`;
    super(`Process exited with ${reason}`, 'PROCESS_EXITED');
    this.name = 'ProcessExitedError';
  }
}

/**
 * Stdio stream error
 */
export class StdioStreamError extends StdioTransportError {
  constructor(stream: string, cause?: Error) {
    super(`Failed to access ${stream} stream`, 'STDIO_STREAM_ERROR', cause);
    this.name = 'StdioStreamError';
  }
}

// Register the stdio transport factory
import { TransportRegistry } from '../MCPTransport';

TransportRegistry.register('stdio', {
  create: (options) => new StdioTransport(options as StdioTransportOptions),
});
