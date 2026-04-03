/**
 * Global Type Definitions for Claude Code Clone
 * 
 * This module contains all shared type definitions used across the application.
 * All types are strictly typed with Zod schemas for runtime validation.
 */

import { z } from 'zod';
import type { ReactNode } from 'react';

// ============================================================================
// Core Primitive Types
// ============================================================================

export type UUID = string;
export type Timestamp = number;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// ============================================================================
// Agent Types
// ============================================================================

export const AgentTypeSchema = z.enum([
  'parent',
  'sub',
  'specialized',
  'orchestrator',
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentStateSchema = z.enum([
  'idle',
  'initializing',
  'ready',
  'executing',
  'waiting',
  'error',
  'terminated',
]);

export type AgentState = z.infer<typeof AgentStateSchema>;

export const AgentEventSchema = z.enum([
  'initialized',
  'task:started',
  'task:completed',
  'task:failed',
  'message:received',
  'message:sent',
  'delegated',
  'error',
  'terminated',
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const AgentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  tools: z.array(z.string()),
  maxConcurrentTasks: z.number().default(1),
});

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  type: AgentTypeSchema,
  model: z.string().optional(),
  capabilities: z.array(AgentCapabilitySchema).default([]),
  maxTokens: z.number().default(8192),
  temperature: z.number().min(0).max(1).default(0.7),
  systemPrompt: z.string().optional(),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: AgentTypeSchema,
  state: AgentStateSchema,
  capabilities: z.array(AgentCapabilitySchema),
  createdAt: z.number(),
  lastActiveAt: z.number(),
  taskCount: z.number().default(0),
  metadata: z.record(z.unknown()),
});

export type AgentInfo = z.infer<typeof AgentInfoSchema>;

// ============================================================================
// Task Types
// ============================================================================

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'delegated',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string(),
  type: z.string(),
  priority: TaskPrioritySchema.default('normal'),
  status: TaskStatusSchema.default('pending'),
  parentId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
  context: z.record(z.unknown()).default({}),
  expectedOutput: z.string().optional(),
  createdAt: z.number().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskResultSchema = z.object({
  taskId: z.string().uuid(),
  success: z.boolean(),
  output: z.string(),
  artifacts: z.array(z.object({
    type: z.string(),
    content: z.unknown(),
    metadata: z.record(z.unknown()).optional(),
  })).default([]),
  subTasks: z.array(TaskSchema).default([]),
  error: z.string().optional(),
  executionTime: z.number(),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
  }).optional(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

// ============================================================================
// Message Types
// ============================================================================

export const MessageRoleSchema = z.enum([
  'user',
  'assistant',
  'system',
  'tool',
]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageContentTypeSchema = z.enum([
  'text',
  'code',
  'tool_call',
  'tool_result',
  'image',
  'file',
  'thinking',
]);

export type MessageContentType = z.infer<typeof MessageContentTypeSchema>;

export const MessageContentSchema = z.object({
  type: MessageContentTypeSchema,
  content: z.string(),
  language: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type MessageContent = z.infer<typeof MessageContentSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid().optional(),
  role: MessageRoleSchema,
  content: z.union([z.string(), z.array(MessageContentSchema)]),
  timestamp: z.number().optional(),
  agentId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.unknown()),
  })).optional(),
  toolResults: z.array(z.object({
    toolCallId: z.string(),
    result: z.unknown(),
    error: z.string().optional(),
  })).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Tool Types
// ============================================================================

export const ToolCategorySchema = z.enum([
  'filesystem',
  'search',
  'code',
  'git',
  'bash',
  'network',
  'analysis',
  'mcp',
  'custom',
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const PermissionLevelSchema = z.enum([
  'auto',
  'ask',
  'deny',
]);

export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const PermissionSchema = z.object({
  tool: z.string(),
  level: PermissionLevelSchema,
  conditions: z.array(z.string()).optional(),
});

export type Permission = z.infer<typeof PermissionSchema>;

export const ToolContextSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  workingDirectory: z.string(),
  environment: z.record(z.string()).default({}),
  permissions: z.array(PermissionSchema).default([]),
});

export type ToolContext = z.infer<typeof ToolContextSchema>;

export const ToolResultSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  artifacts: z.array(z.object({
    type: z.string(),
    path: z.string().optional(),
    content: z.unknown(),
  })).default([]),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: ToolCategorySchema,
  parameters: z.any(),
  permissions: z.array(PermissionSchema).default([]),
  examples: z.array(z.object({
    description: z.string(),
    parameters: z.record(z.unknown()),
    expectedOutput: z.string(),
  })).default([]),
  isDangerous: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  requiresConfirmation: z.boolean().default(false),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ============================================================================
// Command Types
// ============================================================================

export const CommandCategorySchema = z.enum([
  'system',
  'config',
  'session',
  'tools',
  'help',
  'custom',
]);

export type CommandCategory = z.infer<typeof CommandCategorySchema>;

export const CommandDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: CommandCategorySchema,
  aliases: z.array(z.string()).default([]),
  arguments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean().default(false),
    type: z.enum(['string', 'number', 'boolean', 'array']),
    default: z.unknown().optional(),
  })).default([]),
  options: z.array(z.object({
    name: z.string(),
    description: z.string(),
    alias: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean', 'array']),
    default: z.unknown().optional(),
  })).default([]),
  handler: z.function().optional(),
});

export type CommandDefinition = z.infer<typeof CommandDefinitionSchema>;

// ============================================================================
// Context Types
// ============================================================================

export const CompressionStrategySchema = z.enum([
  'none',
  'micro-compact',
  'auto-compact',
  'full-compact',
]);

export type CompressionStrategy = z.infer<typeof CompressionStrategySchema>;

export const ConversationContextSchema = z.object({
  sessionId: z.string().uuid(),
  messages: z.array(MessageSchema),
  workingDirectory: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
    summary: z.string().optional(),
  })).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type ConversationContext = z.infer<typeof ConversationContextSchema>;

export const CompressedContextSchema = z.object({
  originalTokenCount: z.number(),
  compressedTokenCount: z.number(),
  strategy: CompressionStrategySchema,
  summary: z.string(),
  recentMessages: z.array(MessageSchema),
  compressedMessages: z.array(z.object({
    summary: z.string(),
    originalCount: z.number(),
    keyPoints: z.array(z.string()),
  })),
  metadata: z.record(z.unknown()),
});

export type CompressedContext = z.infer<typeof CompressedContextSchema>;

// ============================================================================
// Session Types
// ============================================================================

export const SessionStateSchema = z.enum([
  'created',
  'active',
  'paused',
  'resumed',
  'ended',
]);

export type SessionState = z.infer<typeof SessionStateSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  state: SessionStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  endedAt: z.number().optional(),
  workingDirectory: z.string(),
  context: ConversationContextSchema,
  messageCount: z.number().default(0),
  tokenUsage: z.object({
    input: z.number().default(0),
    output: z.number().default(0),
  }).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// Plugin Types
// ============================================================================

export const HookPointSchema = z.enum([
  'before:tool:execute',
  'after:tool:execute',
  'before:message:send',
  'after:message:receive',
  'before:command:execute',
  'after:command:execute',
  'on:session:start',
  'on:session:end',
  'on:agent:initialize',
  'on:agent:terminate',
]);

export type HookPoint = z.infer<typeof HookPointSchema>;

export const HookRegistrationSchema = z.object({
  point: HookPointSchema,
  handler: z.function(),
  priority: z.number().default(0),
});

export type HookRegistration = z.infer<typeof HookRegistrationSchema>;

export const PluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  license: z.string(),
  entry: z.string(),
  hooks: z.array(HookPointSchema).default([]),
  tools: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  configSchema: z.record(z.unknown()).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export const PluginContextSchema = z.object({
  config: z.record(z.unknown()),
  logger: z.unknown(),
  api: z.record(z.function()),
});

export type PluginContext = z.infer<typeof PluginContextSchema>;

// ============================================================================
// Skill Types
// ============================================================================

export const SkillLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const SkillDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  level: SkillLevelSchema,
  triggers: z.array(z.string()),
  tools: z.array(z.string()),
  prompt: z.string(),
  examples: z.array(z.string()).default([]),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// ============================================================================
// MCP Types
// ============================================================================

export const MCPTransportTypeSchema = z.enum([
  'stdio',
  'sse',
  'websocket',
]);

export type MCPTransportType = z.infer<typeof MCPTransportTypeSchema>;

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  transport: MCPTransportTypeSchema,
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  url: z.string().optional(),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const MCPResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export type MCPResource = z.infer<typeof MCPResourceSchema>;

// ============================================================================
// Configuration Types
// ============================================================================

export const ModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'kimi', 'custom']),
  name: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  maxTokens: z.number().default(8192),
  temperature: z.number().min(0).max(1).default(0.7),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const ContextConfigSchema = z.object({
  maxTokens: z.number().default(200000),
  compression: z.object({
    enabled: z.boolean().default(true),
    strategy: CompressionStrategySchema.default('auto-compact'),
    threshold: z.number().min(0).max(1).default(0.8),
    preserveRecent: z.number().default(10),
  }).default({}),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

export const TelemetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  anonymized: z.boolean().default(true),
  endpoint: z.string().optional(),
  sampleRate: z.number().min(0).max(1).default(1),
});

export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;

export const AppConfigSchema = z.object({
  model: ModelConfigSchema,
  context: ContextConfigSchema,
  permissions: z.object({
    default: PermissionLevelSchema.default('ask'),
    tools: z.record(PermissionLevelSchema).default({}),
  }).default({}),
  plugins: z.object({
    enabled: z.array(z.string()).default([]),
    directory: z.string().default('~/.claude-code/plugins'),
  }).default({}),
  mcp: z.object({
    servers: z.array(MCPServerConfigSchema).default([]),
  }).default({}),
  telemetry: TelemetryConfigSchema.default({}),
  features: z.record(z.boolean()).default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ============================================================================
// UI Types
// ============================================================================

export const UIThemeSchema = z.enum([
  'default',
  'dark',
  'light',
  'high-contrast',
]);

export type UITheme = z.infer<typeof UIThemeSchema>;

export const UIConfigSchema = z.object({
  theme: UIThemeSchema.default('default'),
  showTimestamps: z.boolean().default(false),
  showTokenCount: z.boolean().default(true),
  compactMode: z.boolean().default(false),
  animations: z.boolean().default(true),
});

export type UIConfig = z.infer<typeof UIConfigSchema>;

// ============================================================================
// Telemetry Types
// ============================================================================

export const TelemetryEventTypeSchema = z.enum([
  'session:start',
  'session:end',
  'message:send',
  'message:receive',
  'tool:execute',
  'tool:error',
  'command:execute',
  'error',
  'performance',
]);

export type TelemetryEventType = z.infer<typeof TelemetryEventTypeSchema>;

export const TelemetryEventSchema = z.object({
  id: z.string().uuid(),
  type: TelemetryEventTypeSchema,
  timestamp: z.number(),
  sessionId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// ============================================================================
// Error Types
// ============================================================================

export const ErrorCodeSchema = z.enum([
  'UNKNOWN_ERROR',
  'CONFIG_ERROR',
  'CONFIG_PARSE_ERROR',
  'CONFIG_VALIDATION_ERROR',
  'AGENT_ERROR',
  'AGENT_INITIALIZATION_ERROR',
  'AGENT_EXECUTION_ERROR',
  'AGENT_COMMUNICATION_ERROR',
  'TOOL_ERROR',
  'TOOL_NOT_FOUND',
  'TOOL_VALIDATION_ERROR',
  'TOOL_EXECUTION_ERROR',
  'TOOL_PERMISSION_DENIED',
  'QUERY_ENGINE_ERROR',
  'LLM_ERROR',
  'STREAMING_ERROR',
  'RATE_LIMIT_ERROR',
  'CONTEXT_ERROR',
  'CONTEXT_OVERFLOW',
  'COMPRESSION_ERROR',
  'PLUGIN_ERROR',
  'PLUGIN_LOAD_ERROR',
  'PLUGIN_ACTIVATION_ERROR',
  'PLUGIN_HOOK_ERROR',
  'SESSION_ERROR',
  'SESSION_NOT_FOUND',
  'SESSION_CORRUPTED',
  'MCP_ERROR',
  'VALIDATION_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorDetailsSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  cause: z.unknown().optional(),
  context: z.record(z.unknown()).optional(),
  recoverable: z.boolean().default(false),
});

export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

// ============================================================================
// LLM Provider Types
// ============================================================================

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
}

export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
}

export interface KimiConfig extends LLMConfig {
  provider: 'kimi';
}

export function isAnthropicConfig(config: LLMConfig): config is AnthropicConfig {
  return config.provider === 'anthropic';
}

export function isOpenAIConfig(config: LLMConfig): config is OpenAIConfig {
  return config.provider === 'openai';
}

export function isKimiConfig(config: LLMConfig): config is KimiConfig {
  return config.provider === 'kimi';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onContent?: (content: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public provider?: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class AgentError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AgentError';
  }
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export type ValidationResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError };

export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Re-export commonly used types
// ============================================================================

export type { ReactNode };

// ============================================================================
// Missing Stubs (referenced but not originally defined)
// ============================================================================

export class ToolError extends Error {
  constructor(message: string, public toolName?: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export class PermissionError extends Error {
  constructor(message: string, public toolName?: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
