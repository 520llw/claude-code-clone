/**
 * WebSocket Transport
 * 
 * This transport uses WebSocket for bidirectional communication.
 */

import { MCPTransport, TransportOptions, TransportState } from '../MCPTransport';
import {
  JSONRPCMessage,
  WebSocketTransportConfig,
} from '../types';
import {
  deserializeMessage,
  serializeMessage,
} from '../utils/serialization';
import { MCPConnectionError, MCPTransportError } from '../utils/errors';

/**
 * WebSocket transport options
 */
export interface WebSocketTransportOptions extends TransportOptions {
  /**
   * WebSocket implementation (for Node.js environments)
   */
  WebSocket?: typeof WebSocket;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Enable automatic reconnection
   */
  autoReconnect?: boolean;

  /**
   * Heartbeat interval in milliseconds (0 to disable)
   */
  heartbeatInterval?: number;
}

/**
 * WebSocket transport implementation
 */
export class WebSocketTransport extends MCPTransport {
  private _ws?: WebSocket;
  private _WebSocket: typeof WebSocket;
  private _retryCount = 0;
  private _retryDelay: number;
  private _maxRetries: number;
  private _autoReconnect: boolean;
  private _heartbeatInterval: number;
  private _reconnectTimer?: ReturnType<typeof setTimeout>;
  private _heartbeatTimer?: ReturnType<typeof setInterval>;
  private _wsOptions: WebSocketTransportOptions;
  private _messageQueue: JSONRPCMessage[] = [];

  constructor(config: WebSocketTransportConfig, options: WebSocketTransportOptions = {}) {
    super(config, options);
    this._wsOptions = options;
    this._WebSocket = options.WebSocket || globalThis.WebSocket;
    this._retryDelay = options.retryDelay || 1000;
    this._maxRetries = options.maxRetries || 3;
    this._autoReconnect = options.autoReconnect !== false;
    this._heartbeatInterval = options.heartbeatInterval || 30000;

    if (!this._WebSocket) {
      throw new MCPTransportError(
        'WebSocket not available. Provide an implementation or use a polyfill.'
      );
    }
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * Connect to the WebSocket transport
   */
  async connect(): Promise<void> {
    if (this._state === TransportState.Connected) {
      this._log('Already connected');
      return;
    }

    if (this._state === TransportState.Connecting) {
      this._log('Already connecting');
      return;
    }

    this.setState(TransportState.Connecting);

    const config = this._config as WebSocketTransportConfig;

    try {
      await this._connectWebSocket(config);
    } catch (error) {
      this.setState(TransportState.Error);
      throw error;
    }
  }

  /**
   * Connect to the WebSocket endpoint
   */
  private async _connectWebSocket(config: WebSocketTransportConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new MCPConnectionError('WebSocket connection timeout'));
      }, this._options.connectionTimeout || 30000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      try {
        this._ws = new this._WebSocket(config.url, config.protocols);

        this._ws.onopen = () => {
          cleanup();
          this._retryCount = 0;
          this._startHeartbeat();
          this._flushMessageQueue();
          this.handleConnect();
          resolve();
        };

        this._ws.onmessage = (event) => {
          this._handleMessage(event);
        };

        this._ws.onerror = (event) => {
          this._log('WebSocket error:', event);
          if (this._state === TransportState.Connecting) {
            cleanup();
            reject(new MCPConnectionError('WebSocket connection failed'));
          }
        };

        this._ws.onclose = (event) => {
          this._log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
          this._stopHeartbeat();
          
          if (this._state !== TransportState.Disconnecting) {
            this._handleUnexpectedClose(event);
          }
        };
      } catch (error) {
        cleanup();
        reject(
          new MCPConnectionError(
            `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  }

  /**
   * Handle unexpected WebSocket close
   */
  private _handleUnexpectedClose(event: CloseEvent): void {
    this.handleError(
      new MCPConnectionError(
        `WebSocket closed unexpectedly: code=${event.code}, reason=${event.reason || 'No reason'}`
      )
    );

    // Attempt reconnection if enabled
    if (this._autoReconnect && this._retryCount < this._maxRetries) {
      this._retryCount++;
      const delay = this._retryDelay * this._retryCount;
      this._log(`Reconnecting in ${delay}ms (attempt ${this._retryCount}/${this._maxRetries})`);

      this._reconnectTimer = setTimeout(() => {
        const config = this._config as WebSocketTransportConfig;
        this._connectWebSocket(config).catch((error) => {
          this._log('Reconnection failed:', error);
        });
      }, delay);
    } else if (this._retryCount >= this._maxRetries) {
      this._log('Max reconnection attempts reached');
      this.disconnect();
    }
  }

  /**
   * Disconnect from the WebSocket transport
   */
  async disconnect(): Promise<void> {
    if (this._state === TransportState.Disconnected) {
      return;
    }

    this.setState(TransportState.Disconnecting);

    // Clear timers
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }

    this._stopHeartbeat();

    // Close WebSocket
    if (this._ws) {
      // Only send close frame if connection is open
      if (this._ws.readyState === this._WebSocket.OPEN) {
        this._ws.close(1000, 'Normal closure');
      }
      this._ws = undefined;
    }

    this._retryCount = 0;
    this._messageQueue = [];

    this.handleDisconnect();
  }

  // ========================================================================
  // Heartbeat
  // ========================================================================

  /**
   * Start heartbeat to keep connection alive
   */
  private _startHeartbeat(): void {
    if (this._heartbeatInterval <= 0) return;

    this._log(`Starting heartbeat with interval ${this._heartbeatInterval}ms`);

    this._heartbeatTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === this._WebSocket.OPEN) {
        // Send ping frame
        this._ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this._heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }
  }

  // ========================================================================
  // Message Handling
  // ========================================================================

  /**
   * Handle incoming WebSocket message
   */
  private _handleMessage(event: MessageEvent): void {
    try {
      const data = event.data;

      // Handle ping/pong
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'ping') {
            this._ws?.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          if (parsed.type === 'pong') {
            return;
          }
        } catch {
          // Not a ping/pong, continue with normal processing
        }
      }

      const message = deserializeMessage(data);
      this.handleMessage(message);
    } catch (error) {
      this._log('Failed to parse WebSocket message:', event.data);
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ========================================================================
  // Message Sending
  // ========================================================================

  /**
   * Send a message through the WebSocket transport
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected()) {
      this.queueMessage(message);
      throw new MCPTransportError('Not connected');
    }

    if (!this._ws) {
      throw new MCPTransportError('WebSocket not available');
    }

    if (!this.validateMessageSize(message)) {
      throw new MCPTransportError('Message too large');
    }

    const data = serializeMessage(message);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MCPTransportError('Send timeout'));
      }, this._options.requestTimeout || 60000);

      try {
        this._ws!.send(data);
        clearTimeout(timeout);
        this._log('Sent message', message);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(
          new MCPTransportError(
            `Failed to send: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  }

  /**
   * Flush the message queue
   */
  private async _flushMessageQueue(): Promise<void> {
    while (this._messageQueue.length > 0 && this.isConnected()) {
      const message = this._messageQueue.shift();
      if (message) {
        try {
          await this.send(message);
        } catch (error) {
          this._log('Failed to send queued message:', error);
          // Put message back at front of queue
          this._messageQueue.unshift(message);
          break;
        }
      }
    }
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return (
      this._state === TransportState.Connected &&
      this._ws !== undefined &&
      this._ws.readyState === this._WebSocket.OPEN
    );
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get the WebSocket ready state
   */
  getReadyState(): number | undefined {
    return this._ws?.readyState;
  }

  /**
   * Get the WebSocket URL
   */
  getUrl(): string {
    return (this._config as WebSocketTransportConfig).url;
  }

  /**
   * Get the number of queued messages
   */
  getQueueLength(): number {
    return this._messageQueue.length;
  }

  /**
   * Clear the message queue
   */
  clearQueue(): void {
    this._messageQueue = [];
  }

  /**
   * Enable or disable auto-reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this._autoReconnect = enabled;
    if (!enabled && this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
  }

  /**
   * Set heartbeat interval
   */
  setHeartbeatInterval(intervalMs: number): void {
    this._heartbeatInterval = intervalMs;
    if (this.isConnected()) {
      this._stopHeartbeat();
      this._startHeartbeat();
    }
  }
}

/**
 * WebSocket ready states
 */
export const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * WebSocket polyfill for Node.js environments
 * Uses the 'ws' package if available
 */
export async function getWebSocketImplementation(): Promise<typeof WebSocket | undefined> {
  // Check if WebSocket is available globally (browser environment)
  if (typeof globalThis.WebSocket !== 'undefined') {
    return globalThis.WebSocket;
  }

  // Try to load 'ws' package (Node.js environment)
  try {
    const ws = await import('ws');
    return ws.WebSocket as unknown as typeof WebSocket;
  } catch {
    return undefined;
  }
}
