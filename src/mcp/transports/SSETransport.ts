/**
 * Model Context Protocol (MCP) SSE Transport
 * 
 * This module provides a transport implementation that uses Server-Sent Events (SSE)
 * for server-to-client communication and HTTP POST for client-to-server communication.
 */

import { EventSource } from 'eventsource';
import { MCPTransport, TransportState, TransportError, MessageSerializationError } from '../MCPTransport';
import {
  JSONRPCMessage,
  SSETransportOptions,
  MCP_ERROR_CODES,
} from '../types';

/**
 * SSE transport for MCP communication
 * 
 * Uses EventSource for receiving messages from the server and
 * HTTP POST requests for sending messages to the server.
 */
export class SSETransport extends MCPTransport {
  private _eventSource: EventSource | null = null;
  private _endpointUrl: string | null = null;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _messageId = 0;

  constructor(options: SSETransportOptions) {
    super(options);
  }

  /**
   * Get transport options
   */
  get sseOptions(): SSETransportOptions {
    return this._options as SSETransportOptions;
  }

  /**
   * Get the SSE endpoint URL
   */
  get url(): string {
    return this.sseOptions.url;
  }

  /**
   * Get the message endpoint URL (received from server)
   */
  get endpointUrl(): string | null {
    return this._endpointUrl;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._state === TransportState.CONNECTED && this._eventSource !== null;
  }

  /**
   * Connect to the SSE transport
   */
  async connect(): Promise<void> {
    if (this._state === TransportState.CONNECTED || this._state === TransportState.CONNECTING) {
      return;
    }

    this.setState(TransportState.CONNECTING);
    this._reconnectAttempts = 0;

    try {
      await this.connectEventSource();
    } catch (error) {
      this.setState(TransportState.ERROR);
      throw error;
    }
  }

  /**
   * Connect the EventSource
   */
  private async connectEventSource(): Promise<void> {
    const options = this.sseOptions;

    return new Promise((resolve, reject) => {
      try {
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          ...options.headers,
        };

        this._eventSource = new EventSource(options.url, {
          headers,
        });

        // Handle connection open
        this._eventSource.onopen = () => {
          this._reconnectAttempts = 0;
          // Don't mark as connected yet - wait for endpoint message
        };

        // Handle messages
        this._eventSource.onmessage = (event) => {
          this.handleSSEMessage(event);
        };

        // Handle endpoint event (contains the POST endpoint URL)
        this._eventSource.addEventListener('endpoint', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            this._endpointUrl = new URL(data.endpoint, options.url).toString();
            this.setState(TransportState.CONNECTED);
            this.handleConnect();
            resolve();
          } catch (error) {
            reject(new TransportError(
              'Failed to parse endpoint message',
              'ENDPOINT_PARSE_ERROR',
              error instanceof Error ? error : undefined
            ));
          }
        });

        // Handle errors
        this._eventSource.onerror = (error) => {
          if (this._state === TransportState.CONNECTING) {
            reject(new TransportError(
              'EventSource connection failed',
              'EVENTSOURCE_ERROR',
              error instanceof Error ? error : undefined
            ));
          } else {
            this.handleError(new TransportError(
              'EventSource error',
              'EVENTSOURCE_ERROR',
              error instanceof Error ? error : undefined
            ));
            this.attemptReconnect();
          }
        };

        // Set connection timeout
        const timeout = options.timeout ?? 60000;
        setTimeout(() => {
          if (this._state !== TransportState.CONNECTED) {
            this._eventSource?.close();
            reject(new TransportError(
              `Connection timeout after ${timeout}ms`,
              'CONNECTION_TIMEOUT'
            ));
          }
        }, timeout);
      } catch (error) {
        reject(new TransportError(
          `Failed to create EventSource: ${error instanceof Error ? error.message : String(error)}`,
          'EVENTSOURCE_CREATE_ERROR',
          error instanceof Error ? error : undefined
        ));
      }
    });
  }

  /**
   * Handle SSE message
   */
  private handleSSEMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Check if this is an endpoint message
      if (data.endpoint) {
        this._endpointUrl = new URL(data.endpoint, this.sseOptions.url).toString();

        if (this._state !== TransportState.CONNECTED) {
          this.setState(TransportState.CONNECTED);
          this.handleConnect();
        }
        return;
      }

      // Parse as JSON-RPC message
      const message = this.parseMessage(event.data);
      if (message) {
        this.handleMessage(message);
      }
    } catch (error) {
      // Not JSON or invalid message - might be a comment or keepalive
      if (event.data.startsWith(':')) {
        // SSE comment/keepalive - ignore
        return;
      }

      this.handleError(new MessageParsingError(error instanceof Error ? error : undefined));
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    const options = this.sseOptions;
    const maxAttempts = options.maxReconnectAttempts ?? 5;
    const delay = options.reconnectDelay ?? 5000;

    if (this._reconnectAttempts >= maxAttempts) {
      this.handleError(new TransportError(
        `Max reconnection attempts (${maxAttempts}) reached`,
        'MAX_RECONNECT_ATTEMPTS'
      ));
      this.setState(TransportState.ERROR);
      return;
    }

    this._reconnectAttempts++;
    this.setState(TransportState.CONNECTING);

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }

    this._reconnectTimer = setTimeout(() => {
      this.connectEventSource().catch(() => {
        // Error handled in connectEventSource
      });
    }, delay);
  }

  /**
   * Disconnect from the transport
   */
  async disconnect(): Promise<void> {
    if (this._state === TransportState.DISCONNECTED || this._state === TransportState.DISCONNECTING) {
      return;
    }

    this.setState(TransportState.DISCONNECTING);

    // Clear reconnect timer
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Close EventSource
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }

    this._endpointUrl = null;

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

    if (!this._endpointUrl) {
      throw new TransportError('Endpoint URL not received', 'NO_ENDPOINT_URL');
    }

    try {
      const data = this.serializeMessage(message);
      const options = this.sseOptions;

      const response = await fetch(this._endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: data,
      });

      if (!response.ok) {
        throw new TransportError(
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
    // SSE doesn't natively support progress, but we can track it via SSE events
    if (onProgress && 'id' in message) {
      // Progress notifications will come through the SSE connection
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

      // Remove listener after request completes or times out
      const cleanup = (): void => {
        this.off('message', checkProgress);
      };

      setTimeout(cleanup, this._options.timeout ?? 60000);
    }

    await this.send(message);
  }

  /**
   * Get connection stats
   */
  getStats(): {
    reconnectAttempts: number;
    state: TransportState;
    hasEndpoint: boolean;
  } {
    return {
      reconnectAttempts: this._reconnectAttempts,
      state: this._state,
      hasEndpoint: this._endpointUrl !== null,
    };
  }

  /**
   * Dispose of the transport
   */
  async dispose(): Promise<void> {
    await super.dispose();

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    this._endpointUrl = null;
    this._reconnectAttempts = 0;
  }
}

/**
 * SSE transport factory
 */
export class SSETransportFactory {
  static create(options: SSETransportOptions): SSETransport {
    return new SSETransport(options);
  }
}

/**
 * Create an SSE transport instance
 */
export function createSSETransport(options: Omit<SSETransportOptions, 'type'>): SSETransport {
  return new SSETransport({ type: 'sse', ...options });
}

/**
 * SSE transport error
 */
export class SSETransportError extends TransportError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'SSETransportError';
  }
}

/**
 * Endpoint not received error
 */
export class EndpointNotReceivedError extends SSETransportError {
  constructor() {
    super('Endpoint URL not received from server', 'ENDPOINT_NOT_RECEIVED');
    this.name = 'EndpointNotReceivedError';
  }
}

/**
 * Reconnection failed error
 */
export class ReconnectionFailedError extends SSETransportError {
  constructor(attempts: number) {
    super(`Failed to reconnect after ${attempts} attempts`, 'RECONNECTION_FAILED');
    this.name = 'ReconnectionFailedError';
  }
}

/**
 * HTTP error
 */
export class HTTPError extends SSETransportError {
  constructor(status: number, statusText: string) {
    super(`HTTP error ${status}: ${statusText}`, 'HTTP_ERROR');
    this.name = 'HTTPError';
  }
}

// Register the SSE transport factory
import { TransportRegistry } from '../MCPTransport';

TransportRegistry.register('sse', {
  create: (options) => new SSETransport(options as SSETransportOptions),
});
