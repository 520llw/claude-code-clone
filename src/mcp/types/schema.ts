/**
 * Model Context Protocol (MCP) Zod Schemas
 * 
 * This module contains Zod validation schemas for all MCP protocol types,
 * ensuring type safety and runtime validation of messages.
 */

import { z } from 'zod';

// ============================================================================
// JSON-RPC Schemas
// ============================================================================

export const JSONRPCVersionSchema = z.literal('2.0');

export const JSONRPCErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

export const JSONRPCRequestSchema = z.object({
  jsonrpc: JSONRPCVersionSchema,
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});

export const JSONRPCNotificationSchema = z.object({
  jsonrpc: JSONRPCVersionSchema,
  method: z.string(),
  params: z.unknown().optional(),
});

export const JSONRPCResponseSchema = z.object({
  jsonrpc: JSONRPCVersionSchema,
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: JSONRPCErrorSchema.optional(),
});

export const JSONRPCMessageSchema = z.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
]);

// ============================================================================
// Implementation Schemas
// ============================================================================

export const ImplementationSchema = z.object({
  name: z.string(),
  version: z.string(),
});

// ============================================================================
// Capability Schemas
// ============================================================================

export const ClientCapabilitiesSchema = z.object({
  experimental: z.record(z.unknown()).optional(),
  roots: z.object({
    listChanged: z.boolean().optional(),
  }).optional(),
  sampling: z.record(z.unknown()).optional(),
});

export const ServerCapabilitiesSchema = z.object({
  experimental: z.record(z.unknown()).optional(),
  logging: z.record(z.unknown()).optional(),
  prompts: z.object({
    listChanged: z.boolean().optional(),
  }).optional(),
  resources: z.object({
    subscribe: z.boolean().optional(),
    listChanged: z.boolean().optional(),
  }).optional(),
  tools: z.object({
    listChanged: z.boolean().optional(),
  }).optional(),
});

// ============================================================================
// Initialize Schemas
// ============================================================================

export const InitializeRequestSchema = z.object({
  protocolVersion: z.string(),
  capabilities: ClientCapabilitiesSchema,
  clientInfo: ImplementationSchema,
});

export const InitializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ImplementationSchema,
  instructions: z.string().optional(),
});

// ============================================================================
// Tool Schemas
// ============================================================================

export const ToolInputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.unknown()).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
  $defs: z.record(z.unknown()).optional(),
});

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: ToolInputSchemaSchema,
});

export const CallToolRequestSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).optional(),
});

export const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  data: z.string(), // base64
  mimeType: z.string(),
});

export const TextResourceContentsSchema = z.object({
  uri: z.string(),
  mimeType: z.string().optional(),
  text: z.string(),
});

export const BlobResourceContentsSchema = z.object({
  uri: z.string(),
  mimeType: z.string().optional(),
  blob: z.string(), // base64
});

export const EmbeddedResourceSchema = z.object({
  type: z.literal('resource'),
  resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
});

export const ToolContentSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
  EmbeddedResourceSchema,
]);

export const CallToolResultSchema = z.object({
  content: z.array(ToolContentSchema),
  isError: z.boolean().optional(),
});

export const ListToolsResultSchema = z.object({
  tools: z.array(ToolSchema),
  nextCursor: z.string().optional(),
});

// ============================================================================
// Resource Schemas
// ============================================================================

export const ResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export const ResourceTemplateSchema = z.object({
  uriTemplate: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export const ReadResourceRequestSchema = z.object({
  uri: z.string(),
});

export const ReadResourceResultSchema = z.object({
  contents: z.array(z.union([TextResourceContentsSchema, BlobResourceContentsSchema])),
});

export const ListResourcesResultSchema = z.object({
  resources: z.array(ResourceSchema),
  nextCursor: z.string().optional(),
});

export const ListResourceTemplatesResultSchema = z.object({
  resourceTemplates: z.array(ResourceTemplateSchema),
});

export const SubscribeRequestSchema = z.object({
  uri: z.string(),
});

export const UnsubscribeRequestSchema = z.object({
  uri: z.string(),
});

export const ResourceUpdatedNotificationSchema = z.object({
  uri: z.string(),
});

// ============================================================================
// Prompt Schemas
// ============================================================================

export const PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const PromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(PromptArgumentSchema).optional(),
});

export const PromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([TextContentSchema, ImageContentSchema, EmbeddedResourceSchema]),
});

export const GetPromptRequestSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string()).optional(),
});

export const GetPromptResultSchema = z.object({
  description: z.string().optional(),
  messages: z.array(PromptMessageSchema),
});

export const ListPromptsResultSchema = z.object({
  prompts: z.array(PromptSchema),
  nextCursor: z.string().optional(),
});

// ============================================================================
// Logging Schemas
// ============================================================================

export const LogLevelSchema = z.enum([
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
]);

export const SetLevelRequestSchema = z.object({
  level: LogLevelSchema,
});

export const LoggingMessageNotificationSchema = z.object({
  level: LogLevelSchema,
  logger: z.string().optional(),
  data: z.unknown(),
});

// ============================================================================
// Sampling Schemas
// ============================================================================

export const SamplingMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([TextContentSchema, ImageContentSchema]),
});

export const ModelHintSchema = z.object({
  name: z.string().optional(),
});

export const ModelPreferencesSchema = z.object({
  hints: z.array(ModelHintSchema).optional(),
  costPriority: z.number().optional(),
  speedPriority: z.number().optional(),
  intelligencePriority: z.number().optional(),
});

export const CreateMessageRequestSchema = z.object({
  messages: z.array(SamplingMessageSchema),
  modelPreferences: ModelPreferencesSchema.optional(),
  systemPrompt: z.string().optional(),
  includeContext: z.enum(['none', 'thisServer', 'allServers']).optional(),
  temperature: z.number().optional(),
  maxTokens: z.number(),
  stopSequences: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateMessageResultSchema = z.object({
  model: z.string(),
  stopReason: z.enum(['endTurn', 'stopSequence', 'maxTokens']).optional(),
  role: z.enum(['user', 'assistant']),
  content: z.union([TextContentSchema, ImageContentSchema]),
});

// ============================================================================
// Root Schemas
// ============================================================================

export const RootSchema = z.object({
  uri: z.string(),
  name: z.string().optional(),
});

export const ListRootsResultSchema = z.object({
  roots: z.array(RootSchema),
});

// ============================================================================
// Completion Schemas
// ============================================================================

export const PromptReferenceSchema = z.object({
  type: z.literal('ref/prompt'),
  name: z.string(),
});

export const ResourceReferenceSchema = z.object({
  type: z.literal('ref/resource'),
  uri: z.string(),
});

export const CompleteRequestSchema = z.object({
  ref: z.union([PromptReferenceSchema, ResourceReferenceSchema]),
  argument: z.object({
    name: z.string(),
    value: z.string(),
  }),
});

export const CompleteResultSchema = z.object({
  completion: z.object({
    values: z.array(z.string()),
    hasMore: z.boolean().optional(),
    total: z.number().optional(),
  }),
});

// ============================================================================
// Progress Schemas
// ============================================================================

export const ProgressSchema = z.object({
  progress: z.number(),
  total: z.number().optional(),
});

export const ProgressNotificationSchema = z.object({
  progressToken: z.union([z.string(), z.number()]),
  progress: z.number(),
  total: z.number().optional(),
});

export const CancelledNotificationSchema = z.object({
  requestId: z.union([z.string(), z.number()]),
  reason: z.string().optional(),
});

// ============================================================================
// Transport Schemas
// ============================================================================

export const TransportTypeSchema = z.enum(['stdio', 'sse', 'http', 'websocket']);

export const StdioTransportOptionsSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().optional(),
  headers: z.record(z.string()).optional(),
});

export const SSETransportOptionsSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  reconnectDelay: z.number().optional(),
  maxReconnectAttempts: z.number().optional(),
  timeout: z.number().optional(),
});

export const HTTPTransportOptionsSchema = z.object({
  type: z.literal('http'),
  baseUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
  pollingInterval: z.number().optional(),
  timeout: z.number().optional(),
});

export const MCPTransportOptionsSchema = z.union([
  StdioTransportOptionsSchema,
  SSETransportOptionsSchema,
  HTTPTransportOptionsSchema,
]);

// ============================================================================
// Client/Server Options Schemas
// ============================================================================

export const MCPClientOptionsSchema = z.object({
  name: z.string(),
  version: z.string(),
  capabilities: ClientCapabilitiesSchema.optional(),
  requestTimeout: z.number().optional(),
});

export const MCPServerOptionsSchema = z.object({
  name: z.string(),
  version: z.string(),
  capabilities: ServerCapabilitiesSchema.optional(),
  instructions: z.string().optional(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  transport: MCPTransportOptionsSchema,
  enabled: z.boolean().optional(),
  autoConnect: z.boolean().optional(),
  capabilities: ClientCapabilitiesSchema.optional(),
});

export const MCPClientConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  capabilities: ClientCapabilitiesSchema.optional(),
  requestTimeout: z.number().optional(),
  servers: z.array(MCPServerConfigSchema).optional(),
});

// ============================================================================
// Filesystem Server Schemas
// ============================================================================

export const FilesystemConfigSchema = z.object({
  allowedDirectories: z.array(z.string()),
  readOnly: z.boolean().optional(),
  followSymlinks: z.boolean().optional(),
  maxFileSize: z.number().optional(),
});

export const FileInfoSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory', 'symlink']),
  size: z.number(),
  modified: z.string(),
  created: z.string(),
  permissions: z.string(),
});

// ============================================================================
// Fetch Server Schemas
// ============================================================================

export const FetchConfigSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
  allowedProtocols: z.array(z.string()).optional(),
  maxResponseSize: z.number().optional(),
  timeout: z.number().optional(),
  followRedirects: z.boolean().optional(),
  defaultHeaders: z.record(z.string()).optional(),
});

export const FetchResultSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  body: z.string(),
  contentType: z.string().optional(),
});

// ============================================================================
// Utility Type Inference
// ============================================================================

export type JSONRPCVersionType = z.infer<typeof JSONRPCVersionSchema>;
export type JSONRPCErrorType = z.infer<typeof JSONRPCErrorSchema>;
export type JSONRPCRequestType = z.infer<typeof JSONRPCRequestSchema>;
export type JSONRPCNotificationType = z.infer<typeof JSONRPCNotificationSchema>;
export type JSONRPCResponseType = z.infer<typeof JSONRPCResponseSchema>;
export type JSONRPCMessageType = z.infer<typeof JSONRPCMessageSchema>;

export type ImplementationType = z.infer<typeof ImplementationSchema>;
export type ClientCapabilitiesType = z.infer<typeof ClientCapabilitiesSchema>;
export type ServerCapabilitiesType = z.infer<typeof ServerCapabilitiesSchema>;

export type InitializeRequestType = z.infer<typeof InitializeRequestSchema>;
export type InitializeResultType = z.infer<typeof InitializeResultSchema>;

export type ToolType = z.infer<typeof ToolSchema>;
export type CallToolRequestType = z.infer<typeof CallToolRequestSchema>;
export type CallToolResultType = z.infer<typeof CallToolResultSchema>;
export type ListToolsResultType = z.infer<typeof ListToolsResultSchema>;

export type ResourceType = z.infer<typeof ResourceSchema>;
export type ResourceTemplateType = z.infer<typeof ResourceTemplateSchema>;
export type ReadResourceRequestType = z.infer<typeof ReadResourceRequestSchema>;
export type ReadResourceResultType = z.infer<typeof ReadResourceResultSchema>;
export type ListResourcesResultType = z.infer<typeof ListResourcesResultSchema>;

export type PromptType = z.infer<typeof PromptSchema>;
export type PromptArgumentType = z.infer<typeof PromptArgumentSchema>;
export type PromptMessageType = z.infer<typeof PromptMessageSchema>;
export type GetPromptRequestType = z.infer<typeof GetPromptRequestSchema>;
export type GetPromptResultType = z.infer<typeof GetPromptResultSchema>;
export type ListPromptsResultType = z.infer<typeof ListPromptsResultSchema>;

export type LogLevelType = z.infer<typeof LogLevelSchema>;
export type CreateMessageRequestType = z.infer<typeof CreateMessageRequestSchema>;
export type CreateMessageResultType = z.infer<typeof CreateMessageResultSchema>;

export type RootType = z.infer<typeof RootSchema>;
export type CompleteRequestType = z.infer<typeof CompleteRequestSchema>;
export type CompleteResultType = z.infer<typeof CompleteResultSchema>;

export type ProgressType = z.infer<typeof ProgressSchema>;
export type ProgressNotificationType = z.infer<typeof ProgressNotificationSchema>;

export type StdioTransportOptionsType = z.infer<typeof StdioTransportOptionsSchema>;
export type SSETransportOptionsType = z.infer<typeof SSETransportOptionsSchema>;
export type HTTPTransportOptionsType = z.infer<typeof HTTPTransportOptionsSchema>;
export type MCPTransportOptionsType = z.infer<typeof MCPTransportOptionsSchema>;

export type MCPClientOptionsType = z.infer<typeof MCPClientOptionsSchema>;
export type MCPServerOptionsType = z.infer<typeof MCPServerOptionsSchema>;

export type FilesystemConfigType = z.infer<typeof FilesystemConfigSchema>;
export type FetchConfigType = z.infer<typeof FetchConfigSchema>;
