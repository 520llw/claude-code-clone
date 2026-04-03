/**
 * Model Context Protocol (MCP) Transport Layer
 * 
 * This module provides the abstract base class and interfaces for MCP transports.
 * Transports handle the low-level communication between MCP clients and servers.
 */

import { EventEmitter } from 'events';
import { JSONRPCMessage, MCPTransportOptions, Progress } from './types';

/**
 * Connection state for the transport
 */
export enum TransportState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
}

/**
 * Transport events interface
 */
export interface TransportEvents {
  message: (message: JSONRPCMessage) => void;
  error: (error: Error) => void;
  connect: () => void;
  disconnect: (reason?: string) => void;
  stateChange: (state: TransportState) => void;
}

/**
 * Abstract base class for MCP transports
 * 
 * All transport implementations must extend this class and implement
 * the abstract methods for sending messages and managing connections.
 */
export abstract class MCPTransport extends EventEmitter {
  protected _state: TransportState = TransportState.DISCONNECTED;
  protected _options: MCPTransportOptions;
  protected _messageQueue: JSONRPCMessage[] = [];
  protected _isProcessingQueue = false;

  constructor(options: MCPTransportOptions) {
    super();
    this._options = {
      timeout: 60000,
      ...options,
    };
  }

  /**
   * Get the current transport state
   */
  get state(): TransportState {
    return this._state;
  }

  /**
   * Check if the transport is connected
   */
  get isConnected(): boolean {
    return this._state === TransportState.CONNECTED;
  }

  /**
   * Get transport options
   */
  get options(): MCPTransportOptions {
    return { ...this._options };
  }

  /**
   * Connect to the transport
   * Must be implemented by subclasses
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the transport
   * Must be implemented by subclasses
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send a message through the transport
   * Must be implemented by subclasses
   */
  abstract send(message: JSONRPCMessage): Promise<void>;

  /**
   * Send a message with progress tracking
   * Can be overridden by subclasses for specialized progress handling
   */
  async sendWithProgress(
    message: JSONRPCMessage,
    onProgress?: (progress: Progress) => void
  ): Promise<void> {
    // Store progress callback if provided
    if (onProgress && 'id' in message) {
      this._progressCallbacks.set(message.id, onProgress);
    }

    try {
      await this.send(message);
    } catch (error) {
      // Clean up progress callback on error
      if ('id' in message) {
        this._progressCallbacks.delete(message.id);
      }
      throw error;
    }
  }

  private _progressCallbacks = new Map<string | number, (progress: Progress) => void>();

  /**
   * Handle progress notification
   */
  protected handleProgress(token: string | number, progress: Progress): void {
    const callback = this._progressCallbacks.get(token);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Clean up progress callback for a request
   */
  protected cleanupProgress(requestId: string | number): void {
    this._progressCallbacks.delete(requestId);
  }

  /**
   * Set the transport state and emit state change event
   */
  protected setState(state: TransportState): void {
    const previousState = this._state;
    this._state = state;
    
    if (previousState !== state) {
      this.emit('stateChange', state);
    }
  }

  /**
   * Queue a message for sending when connection is established
   */
  protected queueMessage(message: JSONRPCMessage): void {
    this._messageQueue.push(message);
    this.processMessageQueue();
  }

  /**
   * Process queued messages
   */
  protected async processMessageQueue(): Promise<void> {
    if (this._isProcessingQueue || !this.isConnected) {
      return;
    }

    this._isProcessingQueue = true;

    try {
      while (this._messageQueue.length > 0 && this.isConnected) {
        const message = this._messageQueue.shift();
        if (message) {
          try {
            await this.send(message);
          } catch (error) {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    } finally {
      this._isProcessingQueue = false;
    }
  }

  /**
   * Handle incoming message
   */
  protected handleMessage(message: JSONRPCMessage): void {
    // Handle progress notifications
    if ('method' in message && message.method === 'notifications/progress') {
      const params = message.params as { progressToken: string | number; progress: number; total?: number };
      if (params?.progressToken !== undefined) {
        this.handleProgress(params.progressToken, {
          progress: params.progress,
          total: params.total,
        });
      }
    }

    this.emit('message', message);
  }

  /**
   * Handle transport error
   */
  protected handleError(error: Error): void {
    this.setState(TransportState.ERROR);
    this.emit('error', error);
  }

  /**
   * Handle connection close
   */
  protected handleClose(reason?: string): void {
    this.setState(TransportState.DISCONNECTED);
    this.emit('disconnect', reason);
  }

  /**
   * Handle successful connection
   */
  protected handleConnect(): void {
    this.setState(TransportState.CONNECTED);
    this.emit('connect');
    this.processMessageQueue();
  }

  /**
   * Validate JSON-RPC message
   */
  protected validateMessage(data: unknown): data is JSONRPCMessage {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const message = data as Record<string, unknown>;

    // Check jsonrpc version
    if (message.jsonrpc !== '2.0') {
      return false;
    }

    // Check for request/response/notification structure
    const hasMethod = 'method' in message && typeof message.method === 'string';
    const hasId = 'id' in message && (typeof message.id === 'string' || typeof message.id === 'number');
    const hasResult = 'result' in message;
    const hasError = 'error' in message;

    // Request: has method and id
    // Notification: has method but no id
    // Response: has id and (result or error)
    if (hasMethod) {
      return true; // Request or notification
    }

    if (hasId && (hasResult || hasError)) {
      return true; // Response
    }

    return false;
  }

  /**
   * Parse and validate incoming data as JSON-RPC message
   */
  protected parseMessage(data: string): JSONRPCMessage | null {
    try {
      const parsed = JSON.parse(data);
      
      if (this.validateMessage(parsed)) {
        return parsed;
      }
      
      this.handleError(new Error('Invalid JSON-RPC message format'));
      return null;
    } catch (error) {
      this.handleError(new Error(`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`));
      return null;
    }
  }

  /**
   * Serialize message to string
   */
  protected serializeMessage(message: JSONRPCMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Wait for connection with timeout
   */
  protected async waitForConnection(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this._options.timeout ?? 60000;

    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      const onConnect = (): void => {
        cleanup();
        resolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const onDisconnect = (): void => {
        cleanup();
        reject(new Error('Disconnected while waiting for connection'));
      };

      const cleanup = (): void => {
        clearTimeout(timeoutId);
        this.off('connect', onConnect);
        this.off('error', onError);
        this.off('disconnect', onDisconnect);
      };

      this.once('connect', onConnect);
      this.once('error', onError);
      this.once('disconnect', onDisconnect);
    });
  }

  /**
   * Dispose of the transport and clean up resources
   */
  async dispose(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
    this._progressCallbacks.clear();
    this._messageQueue = [];
  }
}

/**
 * Transport factory interface
 */
export interface TransportFactory {
  create(options: MCPTransportOptions): MCPTransport;
}

/**
 * Registry of transport factories
 */
export class TransportRegistry {
  private static factories = new Map<string, TransportFactory>();

  /**
   * Register a transport factory
   */
  static register(type: string, factory: TransportFactory): void {
    TransportRegistry.factories.set(type, factory);
  }

  /**
   * Create a transport instance
   */
  static create(options: MCPTransportOptions): MCPTransport {
    const factory = TransportRegistry.factories.get(options.type);
    if (!factory) {
      throw new Error(`No transport factory registered for type: ${options.type}`);
    }
    return factory.create(options);
  }

  /**
   * Check if a transport type is registered
   */
  static isRegistered(type: string): boolean {
    return TransportRegistry.factories.has(type);
  }

  /**
   * Get registered transport types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(TransportRegistry.factories.keys());
  }

  /**
   * Unregister a transport factory
   */
  static unregister(type: string): boolean {
    return TransportRegistry.factories.delete(type);
  }

  /**
   * Clear all registered factories
   */
  static clear(): void {
    TransportRegistry.factories.clear();
  }
}

/**
 * Transport error class
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Connection timeout error
 */
export class ConnectionTimeoutError extends TransportError {
  constructor(timeoutMs: number) {
    super(`Connection timeout after ${timeoutMs}ms`, 'CONNECTION_TIMEOUT');
    this.name = 'ConnectionTimeoutError';
  }
}

/**
 * Message serialization error
 */
export class MessageSerializationError extends TransportError {
  constructor(cause?: Error) {
    super('Failed to serialize message', 'SERIALIZATION_ERROR', cause);
    this.name = 'MessageSerializationError';
  }
}

/**
 * Message parsing error
 */
export class MessageParsingError extends TransportError {
  constructor(cause?: Error) {
    super('Failed to parse message', 'PARSING_ERROR', cause);
    this.name = 'MessageParsingError';
  }
}

/**
 * Transport closed error
 */
export class TransportClosedError extends TransportError {
  constructor() {
    super('Transport is closed', 'TRANSPORT_CLOSED');
    this.name = 'TransportClosedError';
  }
}

/**
 * Utility function to create a unique message ID
 */
export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Utility function to create a JSON-RPC request
 */
export function createRequest(method: string, params?: unknown, id?: string | number): {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
} {
  return {
    jsonrpc: '2.0',
    id: id ?? createMessageId(),
    method,
    params,
  };
}

/**
 * Utility function to create a JSON-RPC notification
 */
export function createNotification(method: string, params?: unknown): {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
} {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

/**
 * Utility function to create a JSON-RPC success response
 */
export function createResponse(id: string | number, result: unknown): {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
} {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Utility function to create a JSON-RPC error response
 */
export function createErrorResponse(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): {
  jsonrpc: '2.0';
  id: string | number;
  error: { code: number; message: string; data?: unknown };
} {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}
