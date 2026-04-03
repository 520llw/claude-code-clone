/**
 * Model Context Protocol (MCP) Type Definitions
 * 
 * This module contains all TypeScript type definitions for the MCP system,
 * including protocol messages, capabilities, tools, resources, and prompts.
 */

import { z } from 'zod';

// ============================================================================
// Protocol Version and Constants
// ============================================================================

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_DEFAULT_REQUEST_TIMEOUT = 60000;
export const MCP_MAX_MESSAGE_SIZE = 4 * 1024 * 1024; // 4MB

// ============================================================================
// JSON-RPC Types
// ============================================================================

export type JSONRPCVersion = '2.0';

export interface JSONRPCRequest {
  jsonrpc: JSONRPCVersion;
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: JSONRPCVersion;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: JSONRPCVersion;
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCNotification | JSONRPCResponse;

// JSON-RPC Error Codes
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
} as const;

// MCP-specific Error Codes
export const MCP_ERROR_CODES = {
  // SDK errors
  CONNECTION_CLOSED: -32000,
  REQUEST_TIMEOUT: -32001,
  // Protocol errors
  INVALID_MCP_MESSAGE: -32002,
  UNSUPPORTED_PROTOCOL_VERSION: -32003,
  // Server errors
  RESOURCE_NOT_FOUND: -32004,
  TOOL_NOT_FOUND: -32005,
  PROMPT_NOT_FOUND: -32006,
  INVALID_TOOL_PARAMETERS: -32007,
  INVALID_RESOURCE_PARAMETERS: -32008,
  // Client errors
  CLIENT_NOT_INITIALIZED: -32009,
  SERVER_NOT_CONNECTED: -32010,
} as const;

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  result: T;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Lifecycle Types
// ============================================================================

export interface InitializeRequest {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  instructions?: string;
}

export interface Implementation {
  name: string;
  version: string;
}

export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
}

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

// ============================================================================
// Tool Types
// ============================================================================

export interface Tool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  $defs?: Record<string, unknown>;
}

export interface ToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
}

export interface ListToolsResult {
  tools: Tool[];
  nextCursor?: string;
}

export interface CallToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface CallToolResult {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  mimeType?: string;
}

export interface TextResourceContents extends ResourceContents {
  text: string;
}

export interface BlobResourceContents extends ResourceContents {
  blob: string; // base64 encoded
}

export interface ListResourcesResult {
  resources: Resource[];
  nextCursor?: string;
}

export interface ListResourceTemplatesResult {
  resourceTemplates: ResourceTemplate[];
}

export interface ReadResourceRequest {
  uri: string;
}

export interface ReadResourceResult {
  contents: Array<TextResourceContents | BlobResourceContents>;
}

export interface SubscribeRequest {
  uri: string;
}

export interface UnsubscribeRequest {
  uri: string;
}

export interface ResourceUpdatedNotification {
  uri: string;
}

export interface ResourceListChangedNotification {
  /** No parameters */
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: TextContent | ImageContent | EmbeddedResource;
}

export interface ListPromptsResult {
  prompts: Prompt[];
  nextCursor?: string;
}

export interface GetPromptRequest {
  name: string;
  arguments?: Record<string, string>;
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

export interface PromptListChangedNotification {
  /** No parameters */
}

// ============================================================================
// Content Types
// ============================================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

export interface EmbeddedResource {
  type: 'resource';
  resource: TextResourceContents | BlobResourceContents;
}

export type Content = TextContent | ImageContent | EmbeddedResource;

// ============================================================================
// Logging Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export interface SetLevelRequest {
  level: LogLevel;
}

export interface LoggingMessageNotification {
  level: LogLevel;
  logger?: string;
  data: unknown;
}

// ============================================================================
// Sampling Types
// ============================================================================

export interface CreateMessageRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMessageResult {
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
  role: 'user' | 'assistant';
  content: TextContent | ImageContent;
}

export interface SamplingMessage {
  role: 'user' | 'assistant';
  content: TextContent | ImageContent;
}

export interface ModelPreferences {
  hints?: ModelHint[];
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface ModelHint {
  name?: string;
}

// ============================================================================
// Root Types
// ============================================================================

export interface Root {
  uri: string;
  name?: string;
}

export interface ListRootsResult {
  roots: Root[];
}

export interface RootsListChangedNotification {
  /** No parameters */
}

// ============================================================================
// Completion Types
// ============================================================================

export interface CompleteRequest {
  ref: PromptReference | ResourceReference;
  argument: {
    name: string;
    value: string;
  };
}

export interface CompleteResult {
  completion: {
    values: string[];
    hasMore?: boolean;
    total?: number;
  };
}

export interface PromptReference {
  type: 'ref/prompt';
  name: string;
}

export interface ResourceReference {
  type: 'ref/resource';
  uri: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginatedRequest {
  cursor?: string;
}

export interface PaginatedResult {
  nextCursor?: string;
}

// ============================================================================
// Progress Types
// ============================================================================

export interface Progress {
  progress: number;
  total?: number;
}

export interface ProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
}

export interface CancelledNotification {
  requestId: string | number;
  reason?: string;
}

// ============================================================================
// Transport Types
// ============================================================================

export type TransportType = 'stdio' | 'sse' | 'http' | 'websocket';

export interface TransportOptions {
  type: TransportType;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface StdioTransportOptions extends TransportOptions {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SSETransportOptions extends TransportOptions {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface HTTPTransportOptions extends TransportOptions {
  type: 'http';
  baseUrl: string;
  headers?: Record<string, string>;
  pollingInterval?: number;
}

export type MCPTransportOptions = StdioTransportOptions | SSETransportOptions | HTTPTransportOptions;

// ============================================================================
// Client/Server Types
// ============================================================================

export interface MCPClientOptions {
  name: string;
  version: string;
  capabilities?: ClientCapabilities;
  requestTimeout?: number;
}

export interface MCPServerOptions {
  name: string;
  version: string;
  capabilities?: ServerCapabilities;
  instructions?: string;
}

export interface ServerConnection {
  id: string;
  transport: MCPTransport;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
}

export interface ClientConnection {
  id: string;
  transport: MCPTransport;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}

// ============================================================================
// Tool/Resource/Prompt Manager Types
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<ToolCallResult>;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: () => Promise<TextResourceContents | BlobResourceContents>;
}

export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: (params: Record<string, string>) => Promise<TextResourceContents | BlobResourceContents>;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
  handler: (args?: Record<string, string>) => Promise<PromptMessage[]>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface MCPEvent {
  type: string;
  data?: unknown;
}

export interface MCPMessageEvent extends MCPEvent {
  type: 'message';
  data: JSONRPCMessage;
}

export interface MCPErrorEvent extends MCPEvent {
  type: 'error';
  data: Error;
}

export interface MCPConnectEvent extends MCPEvent {
  type: 'connect';
}

export interface MCPDisconnectEvent extends MCPEvent {
  type: 'disconnect';
  data?: { reason?: string };
}

export type MCPTransportEvent = MCPMessageEvent | MCPErrorEvent | MCPConnectEvent | MCPDisconnectEvent;

// ============================================================================
// Utility Types
// ============================================================================

export type RequestHandler<T = unknown, R = unknown> = (
  params: T,
  extra?: { signal?: AbortSignal }
) => Promise<R>;

export type NotificationHandler<T = unknown> = (params: T) => Promise<void> | void;

export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
  onprogress?: (progress: Progress) => void;
}

export interface PendingRequest {
  id: string | number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  onprogress?: (progress: Progress) => void;
}

// ============================================================================
// Server Configuration Types
// ============================================================================

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportOptions;
  enabled?: boolean;
  autoConnect?: boolean;
  capabilities?: ClientCapabilities;
}

export interface MCPClientConfig {
  name: string;
  version: string;
  capabilities?: ClientCapabilities;
  requestTimeout?: number;
  servers?: MCPServerConfig[];
}

// ============================================================================
// Filesystem Server Types
// ============================================================================

export interface FilesystemConfig {
  allowedDirectories: string[];
  readOnly?: boolean;
  followSymlinks?: boolean;
  maxFileSize?: number;
}

export interface FileInfo {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: string;
  created: string;
  permissions: string;
}

// ============================================================================
// Fetch Server Types
// ============================================================================

export interface FetchConfig {
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedProtocols?: string[];
  maxResponseSize?: number;
  timeout?: number;
  followRedirects?: boolean;
  defaultHeaders?: Record<string, string>;
}

export interface FetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType?: string;
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export * from './schema';
