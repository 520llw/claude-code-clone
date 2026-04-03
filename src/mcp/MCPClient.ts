/**
 * Model Context Protocol (MCP) Client
 * 
 * This module provides a high-level MCP client implementation that manages
 * connections to MCP servers, handles tool/resource/prompt operations,
 * and provides a clean API for interacting with MCP servers.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  JSONRPCMessage,
  MCPClientOptions,
  MCPTransportOptions,
  MCPServerConfig,
  ClientCapabilities,
  ServerCapabilities,
  Implementation,
  InitializeResult,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  PromptMessage,
  CallToolResult,
  ReadResourceResult,
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
  RequestOptions,
  MCP_ERROR_CODES,
} from './types';
import { MCPProtocol, ProtocolState, ProtocolError } from './MCPProtocol';
import { MCPTransport, TransportState, TransportRegistry } from './MCPTransport';

/**
 * Server connection info
 */
export interface ServerConnection {
  id: string;
  name: string;
  protocol: MCPProtocol;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  connectedAt: Date;
}

/**
 * Client events
 */
export interface MCPClientEvents {
  connect: (serverId: string, serverInfo: Implementation) => void;
  disconnect: (serverId: string, reason?: string) => void;
  error: (serverId: string | null, error: Error) => void;
  toolsChanged: (serverId: string, tools: Tool[]) => void;
  resourcesChanged: (serverId: string, resources: Resource[]) => void;
  promptsChanged: (serverId: string, prompts: Prompt[]) => void;
  loggingMessage: (serverId: string, level: LogLevel, data: unknown) => void;
  progress: (serverId: string, token: string | number, progress: Progress) => void;
}

/**
 * Tool call options
 */
export interface ToolCallOptions extends RequestOptions {
  serverId?: string;
}

/**
 * Resource read options
 */
export interface ResourceReadOptions extends RequestOptions {
  serverId?: string;
}

/**
 * Prompt get options
 */
export interface PromptGetOptions extends RequestOptions {
  serverId?: string;
}

/**
 * MCP Client
 * 
 * A high-level client for connecting to and interacting with MCP servers.
 * Supports multiple concurrent server connections and provides unified
 * access to tools, resources, and prompts across all connected servers.
 */
export class MCPClient extends EventEmitter {
  private _options: Required<MCPClientOptions>;
  private _servers = new Map<string, ServerConnection>();
  private _serverConfigs = new Map<string, MCPServerConfig>();
  private _roots: Root[] = [];
  private _isDisposed = false;

  constructor(options: MCPClientOptions) {
    super();
    this._options = {
      name: options.name,
      version: options.version,
      capabilities: options.capabilities ?? {},
      requestTimeout: options.requestTimeout ?? 60000,
    };
  }

  /**
   * Get client name
   */
  get name(): string {
    return this._options.name;
  }

  /**
   * Get client version
   */
  get version(): string {
    return this._options.version;
  }

  /**
   * Get client capabilities
   */
  get capabilities(): ClientCapabilities {
    return { ...this._options.capabilities };
  }

  /**
   * Get all connected servers
   */
  get servers(): ServerConnection[] {
    return Array.from(this._servers.values());
  }

  /**
   * Get connected server IDs
   */
  get serverIds(): string[] {
    return Array.from(this._servers.keys());
  }

  /**
   * Get number of connected servers
   */
  get serverCount(): number {
    return this._servers.size;
  }

  /**
   * Check if client is disposed
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Get configured roots
   */
  get roots(): Root[] {
    return [...this._roots];
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<ServerConnection> {
    this.ensureNotDisposed();

    const serverId = this.generateServerId(config.name);

    if (this._servers.has(serverId)) {
      throw new Error(`Server with ID '${serverId}' is already connected`);
    }

    // Create transport
    const transport = TransportRegistry.create(config.transport);

    // Create protocol
    const protocol = new MCPProtocol(
      'client',
      transport,
      { name: this._options.name, version: this._options.version },
      {
        requestTimeout: this._options.requestTimeout,
        capabilities: config.capabilities ?? this._options.capabilities,
      }
    );

    // Set up event handlers
    this.setupProtocolHandlers(protocol, serverId);

    try {
      // Connect transport
      await transport.connect();

      // Initialize protocol
      const initResult = await protocol.initialize(
        config.capabilities ?? this._options.capabilities,
        { name: this._options.name, version: this._options.version }
      );

      // Create server connection
      const connection: ServerConnection = {
        id: serverId,
        name: config.name,
        protocol,
        capabilities: initResult.capabilities,
        serverInfo: initResult.serverInfo,
        connectedAt: new Date(),
      };

      this._servers.set(serverId, connection);
      this._serverConfigs.set(serverId, config);

      this.emit('connect', serverId, initResult.serverInfo);

      return connection;
    } catch (error) {
      await protocol.dispose();
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    await connection.protocol.shutdown();
    await connection.protocol.dispose();

    this._servers.delete(serverId);
    this._serverConfigs.delete(serverId);

    this.emit('disconnect', serverId);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this._servers.keys()).map((id) =>
      this.disconnect(id).catch(() => {
        // Ignore errors during mass disconnect
      })
    );

    await Promise.all(disconnectPromises);
  }

  /**
   * Get a server connection by ID
   */
  getServer(serverId: string): ServerConnection | undefined {
    return this._servers.get(serverId);
  }

  /**
   * Check if connected to a server
   */
  isConnected(serverId: string): boolean {
    const connection = this._servers.get(serverId);
    return connection?.protocol.isInitialized ?? false;
  }

  /**
   * Set up protocol event handlers
   */
  private setupProtocolHandlers(protocol: MCPProtocol, serverId: string): void {
    // Handle logging messages
    protocol.setNotificationHandler<{
      level: LogLevel;
      logger?: string;
      data: unknown;
    }>('notifications/message', async (params) => {
      this.emit('loggingMessage', serverId, params.level, params.data);
    });

    // Handle tool list changes
    protocol.setNotificationHandler('notifications/tools/list_changed', async () => {
      this.emit('toolsChanged', serverId, await this.listTools({ serverId }));
    });

    // Handle resource list changes
    protocol.setNotificationHandler('notifications/resources/list_changed', async () => {
      this.emit('resourcesChanged', serverId, await this.listResources({ serverId }));
    });

    // Handle prompt list changes
    protocol.setNotificationHandler('notifications/prompts/list_changed', async () => {
      this.emit('promptsChanged', serverId, await this.listPrompts({ serverId }));
    });

    // Handle progress notifications
    protocol.setNotificationHandler<{
      progressToken: string | number;
      progress: number;
      total?: number;
    }>('notifications/progress', async (params) => {
      this.emit('progress', serverId, params.progressToken, {
        progress: params.progress,
        total: params.total,
      });
    });

    // Handle errors
    protocol.on('error', (error) => {
      this.emit('error', serverId, error);
    });
  }

  // ========================================================================
  // Tool Operations
  // ========================================================================

  /**
   * List available tools from a server or all servers
   */
  async listTools(options: { serverId?: string; cursor?: string } = {}): Promise<Tool[]> {
    this.ensureNotDisposed();

    if (options.serverId) {
      const connection = this._servers.get(options.serverId);
      if (!connection) {
        throw new Error(`Server '${options.serverId}' is not connected`);
      }

      const result = await connection.protocol.request<ListToolsResult>('tools/list', {
        cursor: options.cursor,
      });

      return result.tools;
    }

    // Aggregate tools from all servers
    const allTools: Tool[] = [];
    for (const [id, connection] of this._servers) {
      if (connection.capabilities.tools) {
        try {
          const result = await connection.protocol.request<ListToolsResult>('tools/list', {
            cursor: options.cursor,
          });
          allTools.push(...result.tools);
        } catch (error) {
          this.emit('error', id, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return allTools;
  }

  /**
   * Call a tool on a server
   */
  async callTool(
    name: string,
    args?: Record<string, unknown>,
    options: ToolCallOptions = {}
  ): Promise<CallToolResult> {
    this.ensureNotDisposed();

    let connection: ServerConnection | undefined;

    if (options.serverId) {
      connection = this._servers.get(options.serverId);
    } else {
      // Find server that has this tool
      for (const [, conn] of this._servers) {
        if (conn.capabilities.tools) {
          try {
            const tools = await conn.protocol.request<ListToolsResult>('tools/list');
            if (tools.tools.some((t) => t.name === name)) {
              connection = conn;
              break;
            }
          } catch {
            // Continue to next server
          }
        }
      }
    }

    if (!connection) {
      throw new Error(`Tool '${name}' not found on any connected server`);
    }

    return connection.protocol.request<CallToolResult>(
      'tools/call',
      { name, arguments: args },
      options
    );
  }

  /**
   * Call a tool and return text content only
   */
  async callToolText(
    name: string,
    args?: Record<string, unknown>,
    options: ToolCallOptions = {}
  ): Promise<string> {
    const result = await this.callTool(name, args, options);

    if (result.isError) {
      throw new Error(`Tool '${name}' returned error: ${this.extractTextFromResult(result)}`);
    }

    return this.extractTextFromResult(result);
  }

  /**
   * Extract text content from tool result
   */
  private extractTextFromResult(result: CallToolResult): string {
    return result.content
      .map((item) => {
        if (item.type === 'text') {
          return item.text;
        }
        if (item.type === 'image') {
          return `[Image: ${item.mimeType}]`;
        }
        if (item.type === 'resource') {
          return `[Resource: ${item.resource.uri}]`;
        }
        return '';
      })
      .join('\n');
  }

  // ========================================================================
  // Resource Operations
  // ========================================================================

  /**
   * List available resources from a server or all servers
   */
  async listResources(options: { serverId?: string; cursor?: string } = {}): Promise<Resource[]> {
    this.ensureNotDisposed();

    if (options.serverId) {
      const connection = this._servers.get(options.serverId);
      if (!connection) {
        throw new Error(`Server '${options.serverId}' is not connected`);
      }

      const result = await connection.protocol.request<ListResourcesResult>('resources/list', {
        cursor: options.cursor,
      });

      return result.resources;
    }

    // Aggregate resources from all servers
    const allResources: Resource[] = [];
    for (const [id, connection] of this._servers) {
      if (connection.capabilities.resources) {
        try {
          const result = await connection.protocol.request<ListResourcesResult>('resources/list', {
            cursor: options.cursor,
          });
          allResources.push(...result.resources);
        } catch (error) {
          this.emit('error', id, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return allResources;
  }

  /**
   * List resource templates from a server
   */
  async listResourceTemplates(serverId: string): Promise<ResourceTemplate[]> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    const result = await connection.protocol.request<ListResourceTemplatesResult>(
      'resources/templates/list'
    );

    return result.resourceTemplates;
  }

  /**
   * Read a resource from a server
   */
  async readResource(uri: string, options: ResourceReadOptions = {}): Promise<ReadResourceResult> {
    this.ensureNotDisposed();

    let connection: ServerConnection | undefined;

    if (options.serverId) {
      connection = this._servers.get(options.serverId);
    } else {
      // Find server that has this resource
      for (const [, conn] of this._servers) {
        if (conn.capabilities.resources) {
          try {
            const resources = await conn.protocol.request<ListResourcesResult>('resources/list');
            if (resources.resources.some((r) => r.uri === uri)) {
              connection = conn;
              break;
            }
          } catch {
            // Continue to next server
          }
        }
      }
    }

    if (!connection) {
      throw new Error(`Resource '${uri}' not found on any connected server`);
    }

    return connection.protocol.request<ReadResourceResult>('resources/read', { uri }, options);
  }

  /**
   * Read a resource as text
   */
  async readResourceText(uri: string, options: ResourceReadOptions = {}): Promise<string> {
    const result = await this.readResource(uri, options);

    return result.contents
      .map((content) => {
        if ('text' in content) {
          return content.text;
        }
        return `[Binary content: ${content.uri}]`;
      })
      .join('\n');
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeToResource(serverId: string, uri: string): Promise<void> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    if (!connection.capabilities.resources?.subscribe) {
      throw new Error(`Server '${serverId}' does not support resource subscriptions`);
    }

    await connection.protocol.request('resources/subscribe', { uri });
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeFromResource(serverId: string, uri: string): Promise<void> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    await connection.protocol.request('resources/unsubscribe', { uri });
  }

  // ========================================================================
  // Prompt Operations
  // ========================================================================

  /**
   * List available prompts from a server or all servers
   */
  async listPrompts(options: { serverId?: string; cursor?: string } = {}): Promise<Prompt[]> {
    this.ensureNotDisposed();

    if (options.serverId) {
      const connection = this._servers.get(options.serverId);
      if (!connection) {
        throw new Error(`Server '${options.serverId}' is not connected`);
      }

      const result = await connection.protocol.request<ListPromptsResult>('prompts/list', {
        cursor: options.cursor,
      });

      return result.prompts;
    }

    // Aggregate prompts from all servers
    const allPrompts: Prompt[] = [];
    for (const [id, connection] of this._servers) {
      if (connection.capabilities.prompts) {
        try {
          const result = await connection.protocol.request<ListPromptsResult>('prompts/list', {
            cursor: options.cursor,
          });
          allPrompts.push(...result.prompts);
        } catch (error) {
          this.emit('error', id, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return allPrompts;
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
    options: PromptGetOptions = {}
  ): Promise<GetPromptResult> {
    this.ensureNotDisposed();

    let connection: ServerConnection | undefined;

    if (options.serverId) {
      connection = this._servers.get(options.serverId);
    } else {
      // Find server that has this prompt
      for (const [, conn] of this._servers) {
        if (conn.capabilities.prompts) {
          try {
            const prompts = await conn.protocol.request<ListPromptsResult>('prompts/list');
            if (prompts.prompts.some((p) => p.name === name)) {
              connection = conn;
              break;
            }
          } catch {
            // Continue to next server
          }
        }
      }
    }

    if (!connection) {
      throw new Error(`Prompt '${name}' not found on any connected server`);
    }

    return connection.protocol.request<GetPromptResult>('prompts/get', { name, arguments: args }, options);
  }

  /**
   * Get prompt messages as formatted string
   */
  async getPromptMessages(
    name: string,
    args?: Record<string, string>,
    options: PromptGetOptions = {}
  ): Promise<string> {
    const result = await this.getPrompt(name, args, options);

    return result.messages
      .map((msg) => {
        const content = this.formatPromptContent(msg.content);
        return `${msg.role}: ${content}`;
      })
      .join('\n\n');
  }

  /**
   * Format prompt content for display
   */
  private formatPromptContent(content: TextContent | ImageContent | EmbeddedResource): string {
    if (content.type === 'text') {
      return content.text;
    }
    if (content.type === 'image') {
      return `[Image: ${content.mimeType}]`;
    }
    return `[Resource: ${content.resource.uri}]`;
  }

  // ========================================================================
  // Root Operations
  // ========================================================================

  /**
   * Set roots for the client
   */
  setRoots(roots: Root[]): void {
    this._roots = [...roots];

    // Notify all servers of root changes
    for (const [, connection] of this._servers) {
      if (connection.capabilities.roots?.listChanged) {
        connection.protocol.notify('notifications/roots/list_changed', {}).catch(() => {
          // Ignore notification errors
        });
      }
    }
  }

  /**
   * Add a root
   */
  addRoot(root: Root): void {
    this.setRoots([...this._roots, root]);
  }

  /**
   * Remove a root
   */
  removeRoot(uri: string): void {
    this.setRoots(this._roots.filter((r) => r.uri !== uri));
  }

  /**
   * List roots (for servers to call)
   */
  async listRoots(serverId: string): Promise<Root[]> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    return this._roots;
  }

  // ========================================================================
  // Sampling Operations
  // ========================================================================

  /**
   * Create a message using server sampling (if supported)
   */
  async createMessage(
    serverId: string,
    request: CreateMessageRequest
  ): Promise<CreateMessageResult> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    if (!connection.capabilities.sampling) {
      throw new Error(`Server '${serverId}' does not support sampling`);
    }

    return connection.protocol.request<CreateMessageResult>('sampling/createMessage', request);
  }

  // ========================================================================
  // Logging Operations
  // ========================================================================

  /**
   * Set logging level on a server
   */
  async setLogLevel(serverId: string, level: LogLevel): Promise<void> {
    this.ensureNotDisposed();

    const connection = this._servers.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    if (!connection.capabilities.logging) {
      throw new Error(`Server '${serverId}' does not support logging`);
    }

    await connection.protocol.request('logging/setLevel', { level });
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate a unique server ID
   */
  private generateServerId(name: string): string {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let id = baseId;
    let counter = 1;

    while (this._servers.has(id)) {
      id = `${baseId}-${counter++}`;
    }

    return id;
  }

  /**
   * Ensure client is not disposed
   */
  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Client has been disposed');
    }
  }

  /**
   * Dispose of the client and all connections
   */
  async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    await this.disconnectAll();
    this.removeAllListeners();

    this._servers.clear();
    this._serverConfigs.clear();
    this._roots = [];
  }
}

/**
 * Create an MCP client instance
 */
export function createMCPClient(options: MCPClientOptions): MCPClient {
  return new MCPClient(options);
}

/**
 * MCP Client error
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly serverId?: string
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * Server not found error
 */
export class ServerNotFoundError extends MCPClientError {
  constructor(serverId: string) {
    super(`Server '${serverId}' not found`, MCP_ERROR_CODES.SERVER_NOT_CONNECTED, serverId);
    this.name = 'ServerNotFoundError';
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends MCPClientError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' not found`, MCP_ERROR_CODES.TOOL_NOT_FOUND);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends MCPClientError {
  constructor(resourceUri: string) {
    super(`Resource '${resourceUri}' not found`, MCP_ERROR_CODES.RESOURCE_NOT_FOUND);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Prompt not found error
 */
export class PromptNotFoundError extends MCPClientError {
  constructor(promptName: string) {
    super(`Prompt '${promptName}' not found`, MCP_ERROR_CODES.PROMPT_NOT_FOUND);
    this.name = 'PromptNotFoundError';
  }
}
