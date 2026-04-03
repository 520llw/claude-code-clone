/**
 * Model Context Protocol (MCP) System
 * 
 * This module provides a complete implementation of the Model Context Protocol,
 * including clients, servers, transports, and feature managers.
 * 
 * @example
 * ```typescript
 * import { createMCPClient, createStdioTransport } from './mcp';
 * 
 * const client = createMCPClient({ name: 'my-client', version: '1.0.0' });
 * const transport = createStdioTransport({ command: 'my-server' });
 * 
 * await client.connect({ name: 'my-server', transport });
 * const tools = await client.listTools();
 * ```
 */

// ============================================================================
// Version
// ============================================================================

export const MCP_VERSION = '2024-11-05';

// ============================================================================
// Core Components
// ============================================================================

export {
  MCPClient,
  createMCPClient,
  MCPClientError,
  ServerNotFoundError,
  ToolNotFoundError,
  ResourceNotFoundError,
  PromptNotFoundError,
} from './MCPClient';

export {
  MCPServer,
  createMCPServer,
  MCPServerError,
  ClientNotFoundError,
  ServerNotRunningError,
} from './MCPServer';

export {
  MCPProtocol,
  createClientProtocol,
  createServerProtocol,
  ProtocolState,
  ProtocolError,
  ProtocolNotInitializedError,
  MethodNotFoundError,
  InvalidParamsError,
} from './MCPProtocol';

export {
  MCPTransport,
  TransportState,
  TransportRegistry,
  TransportError,
  ConnectionTimeoutError,
  MessageSerializationError,
  MessageParsingError,
  TransportClosedError,
  createMessageId,
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse,
} from './MCPTransport';

// ============================================================================
// Transports
// ============================================================================

export {
  StdioTransport,
  StdioTransportFactory,
  createStdioTransport,
  StdioTransportError,
  ProcessSpawnError,
  ProcessExitedError,
  StdioStreamError,
} from './transports/StdioTransport';

export {
  SSETransport,
  SSETransportFactory,
  createSSETransport,
  SSETransportError,
  EndpointNotReceivedError,
  ReconnectionFailedError,
  HTTPError,
} from './transports/SSETransport';

export {
  HTTPTransport,
  HTTPTransportFactory,
  createHTTPTransport,
  HTTPTransportError,
  SessionError,
  SessionNotFoundError,
  PollingError,
} from './transports/HTTPTransport';

// ============================================================================
// Feature Managers
// ============================================================================

export {
  ToolsManager,
  createToolsManager,
  defineTool,
  ToolSchemas,
  ToolHelpers,
  ToolExecutionError,
  ToolValidationError,
  ToolNotFoundError,
} from './features/ToolsManager';

export {
  ResourcesManager,
  createResourcesManager,
  defineResource,
  defineResourceTemplate,
  ResourceHelpers,
  ResourceReadError,
  ResourceNotFoundError,
  ResourceTemplateNotFoundError,
  InvalidResourceUriError,
} from './features/ResourcesManager';

export {
  PromptsManager,
  createPromptsManager,
  definePrompt,
  createPromptArgument,
  PromptHelpers,
  CommonPrompts,
  PromptGetError,
  PromptNotFoundError,
  MissingRequiredArgumentError,
  InvalidArgumentValueError,
} from './features/PromptsManager';

// ============================================================================
// Built-in Servers
// ============================================================================

export {
  FilesystemServer,
  createFilesystemServer,
  FilesystemServerError,
  PathNotAllowedError,
  FileTooLargeError,
  ReadOnlyError,
} from './servers/FilesystemServer';

export {
  FetchServer,
  createFetchServer,
  FetchServerError,
  UrlNotAllowedError,
  ProtocolNotAllowedError,
  DomainBlockedError,
  ResponseTooLargeError,
  RequestTimeoutError,
} from './servers/FetchServer';

// ============================================================================
// Types
// ============================================================================

export {
  // Protocol constants
  MCP_PROTOCOL_VERSION,
  MCP_DEFAULT_REQUEST_TIMEOUT,
  MCP_MAX_MESSAGE_SIZE,
  
  // Error codes
  JSONRPC_ERROR_CODES,
  MCP_ERROR_CODES,
} from './types';

// Export all types
export type {
  // JSON-RPC types
  JSONRPCVersion,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCMessage,
  
  // Protocol types
  MCPRequest,
  MCPResponse,
  MCPError,
  
  // Lifecycle types
  InitializeRequest,
  InitializeResult,
  Implementation,
  ClientCapabilities,
  ServerCapabilities,
  
  // Tool types
  Tool,
  ToolInputSchema,
  ToolCallRequest,
  ToolCallResult,
  ListToolsResult,
  CallToolRequest,
  CallToolResult,
  
  // Resource types
  Resource,
  ResourceTemplate,
  ResourceContents,
  TextResourceContents,
  BlobResourceContents,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceRequest,
  ReadResourceResult,
  SubscribeRequest,
  UnsubscribeRequest,
  ResourceUpdatedNotification,
  ResourceListChangedNotification,
  
  // Prompt types
  Prompt,
  PromptArgument,
  PromptMessage,
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult,
  PromptListChangedNotification,
  
  // Content types
  TextContent,
  ImageContent,
  EmbeddedResource,
  Content,
  
  // Logging types
  LogLevel,
  SetLevelRequest,
  LoggingMessageNotification,
  
  // Sampling types
  CreateMessageRequest,
  CreateMessageResult,
  SamplingMessage,
  ModelPreferences,
  ModelHint,
  
  // Root types
  Root,
  ListRootsResult,
  RootsListChangedNotification,
  
  // Completion types
  CompleteRequest,
  CompleteResult,
  PromptReference,
  ResourceReference,
  
  // Pagination types
  PaginatedRequest,
  PaginatedResult,
  
  // Progress types
  Progress,
  ProgressNotification,
  CancelledNotification,
  
  // Transport types
  TransportType,
  TransportOptions,
  StdioTransportOptions,
  SSETransportOptions,
  HTTPTransportOptions,
  MCPTransportOptions,
  
  // Client/Server types
  MCPClientOptions,
  MCPServerOptions,
  ServerConnection,
  ClientConnection,
  
  // Manager types
  ToolDefinition,
  ResourceDefinition,
  ResourceTemplateDefinition,
  PromptDefinition,
  
  // Event types
  MCPEvent,
  MCPMessageEvent,
  MCPErrorEvent,
  MCPConnectEvent,
  MCPDisconnectEvent,
  MCPTransportEvent,
  
  // Utility types
  RequestHandler,
  NotificationHandler,
  RequestOptions,
  PendingRequest,
  
  // Configuration types
  MCPServerConfig,
  MCPClientConfig,
  
  // Filesystem types
  FilesystemConfig,
  FileInfo,
  
  // Fetch types
  FetchConfig,
  FetchResult,
} from './types';

// ============================================================================
// Schema Types (Zod)
// ============================================================================

export type {
  JSONRPCVersionType,
  JSONRPCErrorType,
  JSONRPCRequestType,
  JSONRPCNotificationType,
  JSONRPCResponseType,
  JSONRPCMessageType,
  ImplementationType,
  ClientCapabilitiesType,
  ServerCapabilitiesType,
  InitializeRequestType,
  InitializeResultType,
  ToolType,
  CallToolRequestType,
  CallToolResultType,
  ListToolsResultType,
  ResourceType,
  ResourceTemplateType,
  ReadResourceRequestType,
  ReadResourceResultType,
  ListResourcesResultType,
  PromptType,
  PromptArgumentType,
  PromptMessageType,
  GetPromptRequestType,
  GetPromptResultType,
  ListPromptsResultType,
  LogLevelType,
  CreateMessageRequestType,
  CreateMessageResultType,
  RootType,
  CompleteRequestType,
  CompleteResultType,
  ProgressType,
  ProgressNotificationType,
  StdioTransportOptionsType,
  SSETransportOptionsType,
  HTTPTransportOptionsType,
  MCPTransportOptionsType,
  MCPClientOptionsType,
  MCPServerOptionsType,
  FilesystemConfigType,
  FetchConfigType,
} from './types/schema';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a transport type is supported
 */
export function isTransportTypeSupported(type: string): boolean {
  return ['stdio', 'sse', 'http', 'websocket'].includes(type);
}

/**
 * Get supported transport types
 */
export function getSupportedTransportTypes(): string[] {
  return ['stdio', 'sse', 'http'];
}

/**
 * Create a unique ID for MCP messages
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate an MCP protocol version
 */
export function isValidProtocolVersion(version: string): boolean {
  return version === MCP_VERSION;
}

/**
 * Get the current MCP protocol version
 */
export function getProtocolVersion(): string {
  return MCP_VERSION;
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}

// ============================================================================
// Re-exports from submodules for convenience
// ============================================================================

export * from './transports';
export * from './features';
export * from './servers';
