/**
 * Model Context Protocol (MCP) HTTP Transport
 * 
 * This module provides a transport implementation that uses HTTP POST requests
 * for both client-to-server and server-to-client communication. Supports
 * polling for server-to-client messages.
 */

import { MCPTransport, TransportState, TransportError, MessageSerializationError } from '../MCPTransport';
import {
  JSONRPCMessage,
  HTTPTransportOptions,
  MCP_ERROR_CODES,
} from '../types';

/**
 * HTTP transport for MCP communication
 * 
 * Uses HTTP POST requests for bidirectional communication.
 * Supports message polling for receiving messages from the server.
 */
export class HTTPTransport extends MCPTransport {
  private _sessionId: string | null = null;
  private _pollingInterval: number;
  private _pollingTimer: ReturnType<typeof setInterval> | null = null;
  private _messageQueue: JSONRPCMessage[] = [];
  private _lastPollTime = 0;
  private _abortController: AbortController | null = null;

  constructor(options: HTTPTransportOptions) {
    super(options);
    this._pollingInterval = options.pollingInterval ?? 1000;
  }

  /**
   * Get transport options
   */
  get httpOptions(): HTTPTransportOptions {
    return this._options as HTTPTransportOptions;
  }

  /**
   * Get the base URL
   */
  get baseUrl(): string {
    return this.httpOptions.baseUrl;
  }

  /**
   * Get the session ID
   */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /**
   * Get the polling interval
   */
  get pollingInterval(): number {
    return this._pollingInterval;
  }

  /**
   * Set the polling interval
   */
  set pollingInterval(value: number) {
    this._pollingInterval = Math.max(100, value);
    if (this._pollingTimer) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._state === TransportState.CONNECTED && this._sessionId !== null;
  }

  /**
   * Check if polling
   */
  get isPolling(): boolean {
    return this._pollingTimer !== null;
  }

  /**
   * Connect to the HTTP transport
   */
  async connect(): Promise<void> {
    if (this._state === TransportState.CONNECTED || this._state === TransportState.CONNECTING) {
      return;
    }

    this.setState(TransportState.CONNECTING);

    try {
      // Create session
      await this.createSession();

      // Start polling for messages
      this.startPolling();

      this.setState(TransportState.CONNECTED);
      this.handleConnect();
    } catch (error) {
      this.setState(TransportState.ERROR);
      throw error;
    }
  }

  /**
   * Create a session with the server
   */
  private async createSession(): Promise<void> {
    const options = this.httpOptions;
    const url = `${options.baseUrl}/mcp/session`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        body: JSON.stringify({
          client: {
            name: 'mcp-client',
            version: '1.0.0',
          },
        }),
      });

      if (!response.ok) {
        throw new HTTPTransportError(
          `Failed to create session: ${response.status} ${response.statusText}`,
          'SESSION_CREATE_ERROR'
        );
      }

      const data = await response.json();

      if (!data.sessionId) {
        throw new HTTPTransportError(
          'Session ID not received from server',
          'SESSION_ID_MISSING'
        );
      }

      this._sessionId = data.sessionId;
    } catch (error) {
      if (error instanceof HTTPTransportError) {
        throw error;
      }

      throw new HTTPTransportError(
        `Failed to create session: ${error instanceof Error ? error.message : String(error)}`,
        'SESSION_CREATE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Start polling for messages
   */
  private startPolling(): void {
    if (this._pollingTimer) {
      return;
    }

    this._abortController = new AbortController();

    this._pollingTimer = setInterval(async () => {
      await this.pollMessages();
    }, this._pollingInterval);

    // Do an initial poll
    this.pollMessages().catch(() => {
      // Error handled in pollMessages
    });
  }

  /**
   * Stop polling for messages
   */
  private stopPolling(): void {
    if (this._pollingTimer) {
      clearInterval(this._pollingTimer);
      this._pollingTimer = null;
    }

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Poll for messages from the server
   */
  private async pollMessages(): Promise<void> {
    if (!this._sessionId || !this.isConnected) {
      return;
    }

    // Prevent concurrent polls
    const now = Date.now();
    if (now - this._lastPollTime < this._pollingInterval / 2) {
      return;
    }
    this._lastPollTime = now;

    const options = this.httpOptions;
    const url = `${options.baseUrl}/mcp/messages?sessionId=${encodeURIComponent(this._sessionId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
        signal: this._abortController?.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Session not found - disconnect
          this.handleError(new HTTPTransportError(
            'Session not found',
            'SESSION_NOT_FOUND'
          ));
          await this.disconnect();
          return;
        }

        throw new HTTPTransportError(
          `Poll failed: ${response.status} ${response.statusText}`,
          'POLL_ERROR'
        );
      }

      const data = await response.json();

      if (Array.isArray(data.messages)) {
        for (const messageData of data.messages) {
          const message = this.parseMessage(JSON.stringify(messageData));
          if (message) {
            this.handleMessage(message);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Polling was aborted - this is expected during disconnect
        return;
      }

      // Don't emit errors for temporary network issues
      if (this.isConnected && error instanceof Error && !error.message.includes('fetch')) {
        this.handleError(error instanceof HTTPTransportError ? error : new HTTPTransportError(
          `Poll error: ${error instanceof Error ? error.message : String(error)}`,
          'POLL_ERROR',
          error instanceof Error ? error : undefined
        ));
      }
    }
  }

  /**
   * Disconnect from the transport
   */
  async disconnect(): Promise<void> {
    if (this._state === TransportState.DISCONNECTED || this._state === TransportState.DISCONNECTING) {
      return;
    }

    this.setState(TransportState.DISCONNECTING);

    // Stop polling
    this.stopPolling();

    // Delete session if we have one
    if (this._sessionId) {
      try {
        const options = this.httpOptions;
        const url = `${options.baseUrl}/mcp/session?sessionId=${encodeURIComponent(this._sessionId)}`;

        await fetch(url, {
          method: 'DELETE',
          headers: {
            ...options.headers,
          },
        });
      } catch {
        // Ignore errors during session cleanup
      }
    }

    this._sessionId = null;

    this.setState(TransportState.DISCONNECTED);
    this.handleClose('Disconnected by client');
  }

  /**
   * Send a message through the transport
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected) {
      throw new TransportError('Transport not connected', 'TRANSPORT_NOT_CONNECTED');
    }

    if (!this._sessionId) {
      throw new TransportError('Session ID not available', 'NO_SESSION_ID');
    }

    try {
      const data = this.serializeMessage(message);
      const options = this.httpOptions;
      const url = `${options.baseUrl}/mcp/messages?sessionId=${encodeURIComponent(this._sessionId)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        body: data,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new TransportError('Session not found', 'SESSION_NOT_FOUND');
        }

        throw new HTTPTransportError(
          `HTTP error ${response.status}: ${response.statusText}`,
          'HTTP_ERROR'
        );
      }
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }

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
    // HTTP doesn't natively support progress, but we can poll for progress notifications
    if (onProgress && 'id' in message) {
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

      this.on('message', checkProgress);

      // Remove listener after timeout
      setTimeout(() => {
        this.off('message', checkProgress);
      }, this._options.timeout ?? 60000);
    }

    await this.send(message);
  }

  /**
   * Send a synchronous request and wait for response
   */
  async sendRequest(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    if (!this.isConnected) {
      throw new TransportError('Transport not connected', 'TRANSPORT_NOT_CONNECTED');
    }

    if (!this._sessionId) {
      throw new TransportError('Session ID not available', 'NO_SESSION_ID');
    }

    try {
      const data = this.serializeMessage(message);
      const options = this.httpOptions;
      const url = `${options.baseUrl}/mcp/request?sessionId=${encodeURIComponent(this._sessionId)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        body: data,
      });

      if (!response.ok) {
        throw new HTTPTransportError(
          `HTTP error ${response.status}: ${response.statusText}`,
          'HTTP_ERROR'
        );
      }

      const responseData = await response.json();

      if (responseData.message) {
        return this.parseMessage(JSON.stringify(responseData.message));
      }

      return null;
    } catch (error) {
      if (error instanceof HTTPTransportError) {
        throw error;
      }

      throw new MessageSerializationError(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get connection stats
   */
  getStats(): {
    sessionId: string | null;
    state: TransportState;
    isPolling: boolean;
    pollingInterval: number;
    lastPollTime: number;
  } {
    return {
      sessionId: this._sessionId,
      state: this._state,
      isPolling: this.isPolling,
      pollingInterval: this._pollingInterval,
      lastPollTime: this._lastPollTime,
    };
  }

  /**
   * Force a poll for messages
   */
  async forcePoll(): Promise<void> {
    await this.pollMessages();
  }

  /**
   * Dispose of the transport
   */
  async dispose(): Promise<void> {
    await super.dispose();
    this.stopPolling();
    this._sessionId = null;
    this._messageQueue = [];
    this._lastPollTime = 0;
  }
}

/**
 * HTTP transport factory
 */
export class HTTPTransportFactory {
  static create(options: HTTPTransportOptions): HTTPTransport {
    return new HTTPTransport(options);
  }
}

/**
 * Create an HTTP transport instance
 */
export function createHTTPTransport(options: Omit<HTTPTransportOptions, 'type'>): HTTPTransport {
  return new HTTPTransport({ type: 'http', ...options });
}

/**
 * HTTP transport error
 */
export class HTTPTransportError extends TransportError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'HTTPTransportError';
  }
}

/**
 * Session error
 */
export class SessionError extends HTTPTransportError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR');
    this.name = 'SessionError';
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Polling error
 */
export class PollingError extends HTTPTransportError {
  constructor(message: string, cause?: Error) {
    super(`Polling error: ${message}`, 'POLLING_ERROR', cause);
    this.name = 'PollingError';
  }
}

// Register the HTTP transport factory
import { TransportRegistry } from '../MCPTransport';

TransportRegistry.register('http', {
  create: (options) => new HTTPTransport(options as HTTPTransportOptions),
});
