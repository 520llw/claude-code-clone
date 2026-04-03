/**
 * Model Context Protocol (MCP) Server
 * 
 * This module provides a high-level MCP server implementation that handles
 * client connections, manages tools/resources/prompts, and responds to
 * client requests.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  MCPServerOptions,
  ServerCapabilities,
  ClientCapabilities,
  Implementation,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  PromptMessage,
  CallToolRequest,
  CallToolResult,
  ReadResourceRequest,
  ReadResourceResult,
  GetPromptRequest,
  GetPromptResult,
  ListToolsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ListPromptsResult,
  TextContent,
  ImageContent,
  EmbeddedResource,
  TextResourceContents,
  BlobResourceContents,
  Root,
  CreateMessageRequest,
  CreateMessageResult,
  LogLevel,
  Progress,
  RequestHandler,
  NotificationHandler,
  ToolInputSchema,
  PromptArgument,
  MCP_ERROR_CODES,
  JSONRPC_ERROR_CODES,
} from './types';
import { MCPProtocol, ProtocolState, ProtocolError } from './MCPProtocol';
import { MCPTransport, TransportState } from './MCPTransport';
import { ToolsManager } from './features/ToolsManager';
import { ResourcesManager } from './features/ResourcesManager';
import { PromptsManager } from './features/PromptsManager';

/**
 * Client connection info
 */
export interface ClientConnection {
  id: string;
  protocol: MCPProtocol;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
  connectedAt: Date;
}

/**
 * Server events
 */
export interface MCPServerEvents {
  connect: (clientId: string, clientInfo: Implementation) => void;
  disconnect: (clientId: string, reason?: string) => void;
  error: (clientId: string | null, error: Error) => void;
  request: (clientId: string, method: string, params: unknown) => void;
  notification: (clientId: string, method: string, params: unknown) => void;
  rootsChanged: (clientId: string, roots: Root[]) => void;
  samplingRequest: (clientId: string, request: CreateMessageRequest) => void;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
}

/**
 * Resource registration options
 */
export interface ResourceRegistrationOptions {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource template registration options
 */
export interface ResourceTemplateRegistrationOptions {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Prompt registration options
 */
export interface PromptRegistrationOptions {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * MCP Server
 * 
 * A high-level server for handling MCP client connections and serving
 * tools, resources, and prompts.
 */
export class MCPServer extends EventEmitter {
  private _options: Required<MCPServerOptions>;
  private _clients = new Map<string, ClientConnection>();
  private _clientCounter = 0;
  private _isRunning = false;
  private _isDisposed = false;
  private _transport: MCPTransport | null = null;
  private _toolsManager: ToolsManager;
  private _resourcesManager: ResourcesManager;
  private _promptsManager: PromptsManager;
  private _logLevel: LogLevel = 'info';
  private _requestHandlers = new Map<string, RequestHandler>();
  private _notificationHandlers = new Map<string, NotificationHandler>();

  constructor(options: MCPServerOptions) {
    super();
    this._options = {
      name: options.name,
      version: options.version,
      capabilities: options.capabilities ?? {},
      instructions: options.instructions,
    };

    // Initialize feature managers
    this._toolsManager = new ToolsManager();
    this._resourcesManager = new ResourcesManager();
    this._promptsManager = new PromptsManager();

    // Set up feature manager event forwarding
    this.setupFeatureManagerEvents();
  }

  /**
   * Get server name
   */
  get name(): string {
    return this._options.name;
  }

  /**
   * Get server version
   */
  get version(): string {
    return this._options.version;
  }

  /**
   * Get server capabilities
   */
  get capabilities(): ServerCapabilities {
    return {
      ...this._options.capabilities,
      tools: this._toolsManager.hasTools() ? { listChanged: true } : undefined,
      resources: this._resourcesManager.hasResources()
        ? { subscribe: true, listChanged: true }
        : undefined,
      prompts: this._promptsManager.hasPrompts() ? { listChanged: true } : undefined,
      logging: {},
    };
  }

  /**
   * Get server instructions
   */
  get instructions(): string | undefined {
    return this._options.instructions;
  }

  /**
   * Get all connected clients
   */
  get clients(): ClientConnection[] {
    return Array.from(this._clients.values());
  }

  /**
   * Get number of connected clients
   */
  get clientCount(): number {
    return this._clients.size;
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Check if server is disposed
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Get tools manager
   */
  get tools(): ToolsManager {
    return this._toolsManager;
  }

  /**
   * Get resources manager
   */
  get resources(): ResourcesManager {
    return this._resourcesManager;
  }

  /**
   * Get prompts manager
   */
  get prompts(): PromptsManager {
    return this._promptsManager;
  }

  /**
   * Set up feature manager event forwarding
   */
  private setupFeatureManagerEvents(): void {
    // Forward tool changes to clients
    this._toolsManager.on('toolsChanged', () => {
      this.broadcastNotification('notifications/tools/list_changed', {});
    });

    // Forward resource changes to clients
    this._resourcesManager.on('resourcesChanged', () => {
      this.broadcastNotification('notifications/resources/list_changed', {});
    });

    // Forward resource updates to subscribed clients
    this._resourcesManager.on('resourceUpdated', (uri: string) => {
      this.broadcastNotification('notifications/resources/updated', { uri });
    });

    // Forward prompt changes to clients
    this._promptsManager.on('promptsChanged', () => {
      this.broadcastNotification('notifications/prompts/list_changed', {});
    });
  }

  /**
   * Start the server with a transport
   */
  async start(transport: MCPTransport): Promise<void> {
    this.ensureNotDisposed();

    if (this._isRunning) {
      throw new Error('Server is already running');
    }

    this._transport = transport;

    // Set up transport handlers
    transport.on('message', (message) => {
      this.handleTransportMessage(message);
    });

    transport.on('error', (error) => {
      this.emit('error', null, error);
    });

    transport.on('disconnect', () => {
      this.handleTransportDisconnect();
    });

    // Connect transport
    await transport.connect();

    this._isRunning = true;

    // Set up protocol handlers for incoming connections
    this.setupServerHandlers();
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    // Disconnect all clients
    for (const [clientId, client] of this._clients) {
      try {
        await client.protocol.shutdown();
        await client.protocol.dispose();
      } catch {
        // Ignore errors during shutdown
      }
      this.emit('disconnect', clientId);
    }

    this._clients.clear();

    // Disconnect transport
    if (this._transport) {
      await this._transport.disconnect();
      await this._transport.dispose();
      this._transport = null;
    }
  }

  /**
   * Handle transport message (for stdio-based servers)
   */
  private async handleTransportMessage(message: unknown): Promise<void> {
    // For stdio transport, we handle the protocol directly
    // For other transports, clients connect separately
  }

  /**
   * Handle transport disconnect
   */
  private handleTransportDisconnect(): void {
    if (this._isRunning) {
      this.stop().catch(() => {
        // Ignore errors during stop
      });
    }
  }

  /**
   * Set up server protocol handlers
   */
  private setupServerHandlers(): void {
    // These handlers are registered on a per-client basis when clients connect
  }

  /**
   * Register a client connection
   */
  async registerClient(protocol: MCPProtocol): Promise<string> {
    this.ensureNotDisposed();

    const clientId = `client-${++this._clientCounter}`;

    // Wait for initialization
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Client initialization timeout'));
      }, 60000);

      protocol.once('initialized', (result) => {
        clearTimeout(timeout);
        resolve();
      });

      protocol.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const clientInfo = protocol.peerImplementation;
    const clientCapabilities = protocol.peerCapabilities as ClientCapabilities;

    if (!clientInfo) {
      throw new Error('Client did not provide implementation info');
    }

    const connection: ClientConnection = {
      id: clientId,
      protocol,
      capabilities: clientCapabilities ?? {},
      clientInfo,
      connectedAt: new Date(),
    };

    this._clients.set(clientId, connection);

    // Set up protocol handlers for this client
    this.setupClientHandlers(clientId, protocol);

    this.emit('connect', clientId, clientInfo);

    return clientId;
  }

  /**
   * Set up handlers for a specific client
   */
  private setupClientHandlers(clientId: string, protocol: MCPProtocol): void {
    // Tool handlers
    protocol.setRequestHandler('tools/list', async () => {
      return { tools: this._toolsManager.listTools() };
    });

    protocol.setRequestHandler<CallToolRequest, CallToolResult>(
      'tools/call',
      async (params) => {
        return this._toolsManager.callTool(params.name, params.arguments);
      }
    );

    // Resource handlers
    protocol.setRequestHandler('resources/list', async () => {
      return { resources: this._resourcesManager.listResources() };
    });

    protocol.setRequestHandler('resources/templates/list', async () => {
      return { resourceTemplates: this._resourcesManager.listResourceTemplates() };
    });

    protocol.setRequestHandler<ReadResourceRequest, ReadResourceResult>(
      'resources/read',
      async (params) => {
        return { contents: [await this._resourcesManager.readResource(params.uri)] };
      }
    );

    protocol.setRequestHandler('resources/subscribe', async (params) => {
      this._resourcesManager.subscribe(clientId, params.uri);
      return {};
    });

    protocol.setRequestHandler('resources/unsubscribe', async (params) => {
      this._resourcesManager.unsubscribe(clientId, params.uri);
      return {};
    });

    // Prompt handlers
    protocol.setRequestHandler('prompts/list', async () => {
      return { prompts: this._promptsManager.listPrompts() };
    });

    protocol.setRequestHandler<GetPromptRequest, GetPromptResult>(
      'prompts/get',
      async (params) => {
        const messages = await this._promptsManager.getPrompt(params.name, params.arguments);
        return {
          messages,
          description: this._promptsManager.getPromptDescription(params.name),
        };
      }
    );

    // Logging handlers
    protocol.setRequestHandler('logging/setLevel', async (params) => {
      this._logLevel = params.level;
      return {};
    });

    // Root handlers
    if (protocol.peerCapabilities?.roots?.listChanged) {
      protocol.setNotificationHandler('notifications/roots/list_changed', async () => {
        // Client roots changed - could fetch them if needed
        this.emit('rootsChanged', clientId, []);
      });
    }

    // Sampling handlers
    protocol.setRequestHandler<CreateMessageRequest, CreateMessageResult>(
      'sampling/createMessage',
      async (params) => {
        this.emit('samplingRequest', clientId, params);
        throw new ProtocolError('Sampling not implemented', JSONRPC_ERROR_CODES.METHOD_NOT_FOUND);
      }
    );

    // Handle disconnect
    protocol.on('stateChange', (state) => {
      if (state === ProtocolState.CLOSED) {
        this.unregisterClient(clientId);
      }
    });

    // Handle errors
    protocol.on('error', (error) => {
      this.emit('error', clientId, error);
    });
  }

  /**
   * Unregister a client connection
   */
  private unregisterClient(clientId: string): void {
    const client = this._clients.get(clientId);
    if (!client) {
      return;
    }

    this._resourcesManager.unsubscribeAll(clientId);
    this._clients.delete(clientId);

    this.emit('disconnect', clientId);
  }

  /**
   * Broadcast a notification to all connected clients
   */
  async broadcastNotification(method: string, params: unknown): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [, client] of this._clients) {
      promises.push(
        client.protocol.notify(method, params).catch(() => {
          // Ignore notification errors
        })
      );
    }

    await Promise.all(promises);
  }

  // ========================================================================
  // Tool Registration
  // ========================================================================

  /**
   * Register a tool
   */
  registerTool<T extends z.ZodType<unknown>>(
    options: ToolRegistrationOptions,
    handler: (args: z.infer<T>) => Promise<CallToolResult>
  ): void {
    this.ensureNotDisposed();
    this._toolsManager.registerTool({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
      handler: handler as (args: unknown) => Promise<CallToolResult>,
    });
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    this.ensureNotDisposed();
    return this._toolsManager.unregisterTool(name);
  }

  // ========================================================================
  // Resource Registration
  // ========================================================================

  /**
   * Register a resource
   */
  registerResource(
    options: ResourceRegistrationOptions,
    handler: () => Promise<TextResourceContents | BlobResourceContents>
  ): void {
    this.ensureNotDisposed();
    this._resourcesManager.registerResource({
      uri: options.uri,
      name: options.name,
      description: options.description,
      mimeType: options.mimeType,
      handler,
    });
  }

  /**
   * Register a resource template
   */
  registerResourceTemplate(
    options: ResourceTemplateRegistrationOptions,
    handler: (params: Record<string, string>) => Promise<TextResourceContents | BlobResourceContents>
  ): void {
    this.ensureNotDisposed();
    this._resourcesManager.registerResourceTemplate({
      uriTemplate: options.uriTemplate,
      name: options.name,
      description: options.description,
      mimeType: options.mimeType,
      handler,
    });
  }

  /**
   * Unregister a resource
   */
  unregisterResource(uri: string): boolean {
    this.ensureNotDisposed();
    return this._resourcesManager.unregisterResource(uri);
  }

  /**
   * Unregister a resource template
   */
  unregisterResourceTemplate(uriTemplate: string): boolean {
    this.ensureNotDisposed();
    return this._resourcesManager.unregisterResourceTemplate(uriTemplate);
  }

  /**
   * Update a resource (notifies subscribers)
   */
  async updateResource(uri: string): Promise<void> {
    this.ensureNotDisposed();
    await this._resourcesManager.updateResource(uri);
  }

  // ========================================================================
  // Prompt Registration
  // ========================================================================

  /**
   * Register a prompt
   */
  registerPrompt(
    options: PromptRegistrationOptions,
    handler: (args?: Record<string, string>) => Promise<PromptMessage[]>
  ): void {
    this.ensureNotDisposed();
    this._promptsManager.registerPrompt({
      name: options.name,
      description: options.description,
      arguments: options.arguments,
      handler,
    });
  }

  /**
   * Unregister a prompt
   */
  unregisterPrompt(name: string): boolean {
    this.ensureNotDisposed();
    return this._promptsManager.unregisterPrompt(name);
  }

  // ========================================================================
  // Logging
  // ========================================================================

  /**
   * Send a log message to all clients
   */
  async log(level: LogLevel, data: unknown, logger?: string): Promise<void> {
    // Only send if level is >= current log level
    if (!this.shouldLog(level)) {
      return;
    }

    await this.broadcastNotification('notifications/message', {
      level,
      logger,
      data,
    });
  }

  /**
   * Log at debug level
   */
  async debug(data: unknown, logger?: string): Promise<void> {
    await this.log('debug', data, logger);
  }

  /**
   * Log at info level
   */
  async info(data: unknown, logger?: string): Promise<void> {
    await this.log('info', data, logger);
  }

  /**
   * Log at warning level
   */
  async warning(data: unknown, logger?: string): Promise<void> {
    await this.log('warning', data, logger);
  }

  /**
   * Log at error level
   */
  async error(data: unknown, logger?: string): Promise<void> {
    await this.log('error', data, logger);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    const currentIndex = levels.indexOf(this._logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  // ========================================================================
  // Custom Handlers
  // ========================================================================

  /**
   * Set a custom request handler
   */
  setRequestHandler<T = unknown, R = unknown>(method: string, handler: RequestHandler<T, R>): void {
    this._requestHandlers.set(method, handler as RequestHandler);
  }

  /**
   * Remove a custom request handler
   */
  removeRequestHandler(method: string): boolean {
    return this._requestHandlers.delete(method);
  }

  /**
   * Set a custom notification handler
   */
  setNotificationHandler<T = unknown>(method: string, handler: NotificationHandler<T>): void {
    this._notificationHandlers.set(method, handler as NotificationHandler);
  }

  /**
   * Remove a custom notification handler
   */
  removeNotificationHandler(method: string): boolean {
    return this._notificationHandlers.delete(method);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Ensure server is not disposed
   */
  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Server has been disposed');
    }
  }

  /**
   * Dispose of the server
   */
  async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    await this.stop();

    this._toolsManager.dispose();
    this._resourcesManager.dispose();
    this._promptsManager.dispose();

    this.removeAllListeners();
    this._requestHandlers.clear();
    this._notificationHandlers.clear();
  }
}

/**
 * Create an MCP server instance
 */
export function createMCPServer(options: MCPServerOptions): MCPServer {
  return new MCPServer(options);
}

/**
 * MCP Server error
 */
export class MCPServerError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message);
    this.name = 'MCPServerError';
  }
}

/**
 * Client not found error
 */
export class ClientNotFoundError extends MCPServerError {
  constructor(clientId: string) {
    super(`Client '${clientId}' not found`, MCP_ERROR_CODES.CLIENT_NOT_INITIALIZED);
    this.name = 'ClientNotFoundError';
  }
}

/**
 * Server not running error
 */
export class ServerNotRunningError extends MCPServerError {
  constructor() {
    super('Server is not running', MCP_ERROR_CODES.SERVER_NOT_CONNECTED);
    this.name = 'ServerNotRunningError';
  }
}
