/**
 * Model Context Protocol (MCP) Protocol Handlers
 * 
 * This module provides protocol-level handling for MCP messages,
 * including request/response matching, notification handling,
 * and protocol state management.
 */

import { EventEmitter } from 'events';
import {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCError,
  MCP_ERROR_CODES,
  JSONRPC_ERROR_CODES,
  PendingRequest,
  RequestOptions,
  Progress,
  ClientCapabilities,
  ServerCapabilities,
  InitializeRequest,
  InitializeResult,
  Implementation,
} from './types';
import { MCPTransport, TransportState, createRequest, createNotification, createResponse, createErrorResponse } from './MCPTransport';

/**
 * Protocol state
 */
export enum ProtocolState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  SHUTTING_DOWN = 'shutting_down',
  CLOSED = 'closed',
}

/**
 * Protocol role
 */
export type ProtocolRole = 'client' | 'server';

/**
 * Protocol events
 */
export interface ProtocolEvents {
  request: (request: JSONRPCRequest) => void;
  notification: (notification: JSONRPCNotification) => void;
  response: (response: JSONRPCResponse) => void;
  error: (error: Error) => void;
  stateChange: (state: ProtocolState) => void;
  initialized: (result: InitializeResult) => void;
}

/**
 * Request handler type
 */
export type ProtocolRequestHandler<T = unknown, R = unknown> = (
  params: T,
  extra: { signal?: AbortSignal; sessionId?: string }
) => Promise<R>;

/**
 * Notification handler type
 */
export type ProtocolNotificationHandler<T = unknown> = (
  params: T,
  extra: { sessionId?: string }
) => Promise<void> | void;

/**
 * MCP Protocol handler
 * 
 * Manages the MCP protocol state, handles request/response matching,
 * and routes messages to appropriate handlers.
 */
export class MCPProtocol extends EventEmitter {
  private _state: ProtocolState = ProtocolState.UNINITIALIZED;
  private _role: ProtocolRole;
  private _transport: MCPTransport;
  private _pendingRequests = new Map<string | number, PendingRequest>();
  private _requestHandlers = new Map<string, ProtocolRequestHandler>();
  private _notificationHandlers = new Map<string, ProtocolNotificationHandler>();
  private _messageId = 0;
  private _requestTimeout: number;
  private _capabilities: ClientCapabilities | ServerCapabilities = {};
  private _peerCapabilities: ClientCapabilities | ServerCapabilities | null = null;
  private _implementation: Implementation;
  private _peerImplementation: Implementation | null = null;
  private _protocolVersion: string = '2024-11-05';
  private _instructions?: string;

  constructor(
    role: ProtocolRole,
    transport: MCPTransport,
    implementation: Implementation,
    options: {
      requestTimeout?: number;
      capabilities?: ClientCapabilities | ServerCapabilities;
      instructions?: string;
    } = {}
  ) {
    super();
    this._role = role;
    this._transport = transport;
    this._implementation = implementation;
    this._requestTimeout = options.requestTimeout ?? 60000;
    this._capabilities = options.capabilities ?? {};
    this._instructions = options.instructions;

    this.setupTransportHandlers();
    this.registerDefaultHandlers();
  }

  /**
   * Get current protocol state
   */
  get state(): ProtocolState {
    return this._state;
  }

  /**
   * Get protocol role
   */
  get role(): ProtocolRole {
    return this._role;
  }

  /**
   * Get transport instance
   */
  get transport(): MCPTransport {
    return this._transport;
  }

  /**
   * Get local capabilities
   */
  get capabilities(): ClientCapabilities | ServerCapabilities {
    return { ...this._capabilities };
  }

  /**
   * Get peer capabilities
   */
  get peerCapabilities(): ClientCapabilities | ServerCapabilities | null {
    return this._peerCapabilities;
  }

  /**
   * Get local implementation info
   */
  get implementation(): Implementation {
    return { ...this._implementation };
  }

  /**
   * Get peer implementation info
   */
  get peerImplementation(): Implementation | null {
    return this._peerImplementation;
  }

  /**
   * Get protocol version
   */
  get protocolVersion(): string {
    return this._protocolVersion;
  }

  /**
   * Check if protocol is initialized
   */
  get isInitialized(): boolean {
    return this._state === ProtocolState.INITIALIZED;
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    this._transport.on('message', (message: JSONRPCMessage) => {
      this.handleMessage(message);
    });

    this._transport.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this._transport.on('disconnect', () => {
      this.setState(ProtocolState.CLOSED);
      this.rejectAllPendingRequests(new Error('Transport disconnected'));
    });

    this._transport.on('stateChange', (state: TransportState) => {
      if (state === TransportState.DISCONNECTED && this._state !== ProtocolState.CLOSED) {
        this.setState(ProtocolState.CLOSED);
      }
    });
  }

  /**
   * Register default protocol handlers
   */
  private registerDefaultHandlers(): void {
    // Register initialize handler for servers
    if (this._role === 'server') {
      this.setRequestHandler<InitializeRequest, InitializeResult>(
        'initialize',
        async (params) => {
          this._peerCapabilities = params.capabilities;
          this._peerImplementation = params.clientInfo;

          // Validate protocol version
          if (params.protocolVersion !== this._protocolVersion) {
            throw new ProtocolError(
              `Unsupported protocol version: ${params.protocolVersion}`,
              MCP_ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION
            );
          }

          this.setState(ProtocolState.INITIALIZING);

          return {
            protocolVersion: this._protocolVersion,
            capabilities: this._capabilities as ServerCapabilities,
            serverInfo: this._implementation,
            instructions: this._instructions,
          };
        }
      );
    }

    // Handle initialized notification
    this.setNotificationHandler('initialized', async () => {
      if (this._state === ProtocolState.INITIALIZING) {
        this.setState(ProtocolState.INITIALIZED);
      }
    });
  }

  /**
   * Set protocol state and emit event
   */
  private setState(state: ProtocolState): void {
    const previousState = this._state;
    this._state = state;
    
    if (previousState !== state) {
      this.emit('stateChange', state);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `${this._role}-${++this._messageId}-${Date.now()}`;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: JSONRPCMessage): void {
    try {
      if ('id' in message && !('method' in message)) {
        // This is a response
        this.handleResponse(message as JSONRPCResponse);
      } else if ('method' in message) {
        if ('id' in message) {
          // This is a request
          this.handleRequest(message as JSONRPCRequest);
        } else {
          // This is a notification
          this.handleNotification(message as JSONRPCNotification);
        }
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(request: JSONRPCRequest): Promise<void> {
    this.emit('request', request);

    const handler = this._requestHandlers.get(request.method);

    if (!handler) {
      // Send method not found error
      await this.sendError(
        request.id,
        JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
        `Method not found: ${request.method}`
      );
      return;
    }

    try {
      const result = await handler(request.params ?? {}, {});
      await this.sendResponse(request.id, result);
    } catch (error) {
      let errorCode = JSONRPC_ERROR_CODES.INTERNAL_ERROR;
      let errorMessage = 'Internal error';
      let errorData: unknown;

      if (error instanceof ProtocolError) {
        errorCode = error.code;
        errorMessage = error.message;
        errorData = error.data;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      await this.sendError(request.id, errorCode, errorMessage, errorData);
    }
  }

  /**
   * Handle incoming notification
   */
  private async handleNotification(notification: JSONRPCNotification): Promise<void> {
    this.emit('notification', notification);

    const handler = this._notificationHandlers.get(notification.method);

    if (handler) {
      try {
        await handler(notification.params ?? {}, {});
      } catch (error) {
        // Notifications don't have responses, so just emit error
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Handle incoming response
   */
  private handleResponse(response: JSONRPCResponse): void {
    this.emit('response', response);

    const pending = this._pendingRequests.get(response.id);
    if (!pending) {
      // No pending request for this response
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeout);
    this._pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new ProtocolError(response.error.message, response.error.code, response.error.data));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Send a request and wait for response
   */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    if (this._state === ProtocolState.CLOSED) {
      throw new ProtocolError('Protocol is closed', MCP_ERROR_CODES.CONNECTION_CLOSED);
    }

    const id = this.generateId();
    const request = createRequest(method, params, id);

    // Check for abort signal
    if (options.signal?.aborted) {
      throw new Error('Request was aborted');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new ProtocolError(`Request timeout for method: ${method}`, MCP_ERROR_CODES.REQUEST_TIMEOUT));
      }, options.timeout ?? this._requestTimeout);

      const pending: PendingRequest = {
        id,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        onprogress: options.onprogress,
      };

      this._pendingRequests.set(id, pending);

      // Handle abort signal
      if (options.signal) {
        const onAbort = (): void => {
          this._pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(new Error('Request was aborted'));
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      this._transport.send(request).catch((error) => {
        this._pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send a notification (no response expected)
   */
  async notify(method: string, params?: unknown): Promise<void> {
    if (this._state === ProtocolState.CLOSED) {
      throw new ProtocolError('Protocol is closed', MCP_ERROR_CODES.CONNECTION_CLOSED);
    }

    const notification = createNotification(method, params);
    await this._transport.send(notification);
  }

  /**
   * Send a response
   */
  private async sendResponse(id: string | number, result: unknown): Promise<void> {
    const response = createResponse(id, result);
    await this._transport.send(response);
  }

  /**
   * Send an error response
   */
  private async sendError(
    id: string | number,
    code: number,
    message: string,
    data?: unknown
  ): Promise<void> {
    const response = createErrorResponse(id, code, message, data);
    await this._transport.send(response);
  }

  /**
   * Set a request handler
   */
  setRequestHandler<T = unknown, R = unknown>(
    method: string,
    handler: ProtocolRequestHandler<T, R>
  ): void {
    this._requestHandlers.set(method, handler as ProtocolRequestHandler);
  }

  /**
   * Remove a request handler
   */
  removeRequestHandler(method: string): boolean {
    return this._requestHandlers.delete(method);
  }

  /**
   * Set a notification handler
   */
  setNotificationHandler<T = unknown>(
    method: string,
    handler: ProtocolNotificationHandler<T>
  ): void {
    this._notificationHandlers.set(method, handler as ProtocolNotificationHandler);
  }

  /**
   * Remove a notification handler
   */
  removeNotificationHandler(method: string): boolean {
    return this._notificationHandlers.delete(method);
  }

  /**
   * Initialize the protocol (client-side)
   */
  async initialize(
    capabilities: ClientCapabilities = {},
    clientInfo: Implementation
  ): Promise<InitializeResult> {
    if (this._role !== 'client') {
      throw new ProtocolError('Only clients can initiate initialization', MCP_ERROR_CODES.INVALID_REQUEST);
    }

    if (this._state !== ProtocolState.UNINITIALIZED) {
      throw new ProtocolError('Protocol already initialized', MCP_ERROR_CODES.INVALID_REQUEST);
    }

    this.setState(ProtocolState.INITIALIZING);

    try {
      const result = await this.request<InitializeResult>('initialize', {
        protocolVersion: this._protocolVersion,
        capabilities,
        clientInfo,
      });

      this._peerCapabilities = result.capabilities;
      this._peerImplementation = result.serverInfo;

      // Send initialized notification
      await this.notify('initialized', {});

      this.setState(ProtocolState.INITIALIZED);
      this.emit('initialized', result);

      return result;
    } catch (error) {
      this.setState(ProtocolState.UNINITIALIZED);
      throw error;
    }
  }

  /**
   * Shutdown the protocol gracefully
   */
  async shutdown(): Promise<void> {
    if (this._state === ProtocolState.CLOSED) {
      return;
    }

    this.setState(ProtocolState.SHUTTING_DOWN);

    // Reject all pending requests
    this.rejectAllPendingRequests(new Error('Protocol is shutting down'));

    // Send shutdown notification if client
    if (this._role === 'client') {
      try {
        await this.notify('shutdown', {});
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.setState(ProtocolState.CLOSED);
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPendingRequests(reason: Error): void {
    for (const [id, pending] of this._pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(reason);
      this._pendingRequests.delete(id);
    }
  }

  /**
   * Dispose of the protocol
   */
  async dispose(): Promise<void> {
    await this.shutdown();
    await this._transport.dispose();
    this.removeAllListeners();
    this._requestHandlers.clear();
    this._notificationHandlers.clear();
  }
}

/**
 * Protocol error class
 */
export class ProtocolError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/**
 * Protocol not initialized error
 */
export class ProtocolNotInitializedError extends ProtocolError {
  constructor() {
    super('Protocol not initialized', MCP_ERROR_CODES.CLIENT_NOT_INITIALIZED);
    this.name = 'ProtocolNotInitializedError';
  }
}

/**
 * Method not found error
 */
export class MethodNotFoundError extends ProtocolError {
  constructor(method: string) {
    super(`Method not found: ${method}`, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND);
    this.name = 'MethodNotFoundError';
  }
}

/**
 * Invalid params error
 */
export class InvalidParamsError extends ProtocolError {
  constructor(message: string, data?: unknown) {
    super(message, JSONRPC_ERROR_CODES.INVALID_PARAMS, data);
    this.name = 'InvalidParamsError';
  }
}

/**
 * Create a client protocol instance
 */
export function createClientProtocol(
  transport: MCPTransport,
  implementation: Implementation,
  options?: {
    requestTimeout?: number;
    capabilities?: ClientCapabilities;
  }
): MCPProtocol {
  return new MCPProtocol('client', transport, implementation, options);
}

/**
 * Create a server protocol instance
 */
export function createServerProtocol(
  transport: MCPTransport,
  implementation: Implementation,
  options?: {
    requestTimeout?: number;
    capabilities?: ServerCapabilities;
    instructions?: string;
  }
): MCPProtocol {
  return new MCPProtocol('server', transport, implementation, options);
}
