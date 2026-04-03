/**
 * Zod Schemas for Runtime Validation
 * 
 * Comprehensive Zod schemas for validating context-related data structures
 * at runtime. These schemas ensure data integrity throughout the system.
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const MessageRoleSchema = z.enum([
  'user',
  'assistant', 
  'system',
  'tool',
  'compressed'
]);

export const CompressionLevelSchema = z.enum([
  'none',
  'light',
  'medium',
  'heavy',
  'extreme'
]);

export const CompressionStrategySchema = z.enum([
  'micro',
  'auto',
  'full',
  'manual'
]);

export const SimilarityMethodSchema = z.enum([
  'cosine',
  'euclidean',
  'dot',
  'hybrid'
]);

export const SearchSourceSchema = z.enum([
  'message',
  'memory',
  'topic',
  'file',
  'code'
]);

export const CircuitStateSchema = z.enum([
  'closed',
  'open',
  'half-open'
]);

// ============================================================================
// Message Schemas
// ============================================================================

export const CodeBlockSchema = z.object({
  language: z.string(),
  content: z.string(),
  filePath: z.string().optional(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
});

export const MessageMetadataSchema = z.object({
  source: z.string().optional(),
  importance: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  filePaths: z.array(z.string()).optional(),
  codeBlocks: z.array(CodeBlockSchema).optional(),
  isCheckpoint: z.boolean().optional(),
  checkpointId: z.string().optional(),
});

export const ContextMessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(0).max(1000000),
  timestamp: z.number().positive(),
  metadata: MessageMetadataSchema.optional(),
  tokenCount: z.number().nonnegative().optional(),
  compressionLevel: CompressionLevelSchema.optional(),
  originalContent: z.string().optional(),
});

// ============================================================================
// Context State Schemas
// ============================================================================

export const CompressionRecordSchema = z.object({
  timestamp: z.number().positive(),
  strategy: CompressionStrategySchema,
  messagesBefore: z.number().nonnegative(),
  messagesAfter: z.number().nonnegative(),
  tokensBefore: z.number().nonnegative(),
  tokensAfter: z.number().nonnegative(),
  reason: z.string(),
});

export const ContextStateMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  createdAt: z.number().positive(),
  lastModified: z.number().positive(),
  version: z.number().nonnegative(),
  compressionHistory: z.array(CompressionRecordSchema),
});

export const ContextStatsSchema = z.object({
  totalTokens: z.number().nonnegative(),
  messageCount: z.number().nonnegative(),
  compressedCount: z.number().nonnegative(),
  memoryTokens: z.number().nonnegative(),
  availableTokens: z.number().nonnegative(),
  utilizationPercent: z.number().min(0).max(1),
});

export const ContextStateSchema = z.object({
  messages: z.array(ContextMessageSchema),
  metadata: ContextStateMetadataSchema,
  stats: ContextStatsSchema,
  memory: z.any(), // MemoryStateSchema - circular reference handled separately
});

// ============================================================================
// Compression Schemas
// ============================================================================

export const CompressionOptionsSchema = z.object({
  strategy: CompressionStrategySchema,
  targetTokens: z.number().positive().optional(),
  preserveRecent: z.number().nonnegative().optional(),
  preserveCheckpoints: z.boolean().optional(),
  generateSummary: z.boolean().optional(),
  aggressive: z.boolean().optional(),
});

export const CompressionResultSchema = z.object({
  success: z.boolean(),
  strategy: CompressionStrategySchema,
  messagesRemoved: z.number().nonnegative(),
  messagesCompressed: z.number().nonnegative(),
  tokensBefore: z.number().nonnegative(),
  tokensAfter: z.number().nonnegative(),
  summary: z.string().optional(),
  reinjectedContent: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

export const CompressionContextSchema = z.object({
  messages: z.array(ContextMessageSchema),
  tokenBudget: z.any(), // TokenBudgetSchema
  priorityQueue: z.any(), // PriorityQueueSchema
  memoryState: z.any(), // MemoryStateSchema
});

// ============================================================================
// Token Budget Schemas
// ============================================================================

export const BudgetThresholdsSchema = z.object({
  warning: z.number().min(0).max(1),
  critical: z.number().min(0).max(1),
  emergency: z.number().min(0).max(1),
}).refine(
  (data) => data.warning < data.critical && data.critical < data.emergency,
  { message: 'Thresholds must be in ascending order: warning < critical < emergency' }
);

export const BudgetAllocationSchema = z.object({
  conversation: z.number().nonnegative(),
  memory: z.number().nonnegative(),
  system: z.number().nonnegative(),
  working: z.number().nonnegative(),
  buffer: z.number().nonnegative(),
});

export const TokenBudgetSchema = z.object({
  total: z.number().positive(),
  reserved: z.number().nonnegative(),
  used: z.number().nonnegative(),
  available: z.number().nonnegative(),
  thresholds: BudgetThresholdsSchema,
});

export const TokenUsageSchema = z.object({
  component: z.string(),
  tokens: z.number().nonnegative(),
  priority: z.number().min(0).max(10),
  reclaimable: z.boolean(),
});

// ============================================================================
// Relevance Schemas
// ============================================================================

export const RelevanceFactorsSchema = z.object({
  recency: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  semantic: z.number().min(0).max(1),
  reference: z.number().min(0).max(1),
  userEmphasis: z.number().min(0).max(1),
});

export const RelevanceScoreSchema = z.object({
  messageId: z.string().uuid(),
  score: z.number().min(0).max(1),
  factors: RelevanceFactorsSchema,
  computedAt: z.number().positive(),
});

export const RelevanceQuerySchema = z.object({
  text: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  messageIds: z.array(z.string().uuid()).optional(),
  timeRange: z.object({
    start: z.number().positive(),
    end: z.number().positive(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Memory Schemas
// ============================================================================

export const MemoryIndexEntrySchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  tokenCount: z.number().nonnegative(),
  filePath: z.string(),
  relevanceScore: z.number().min(0).max(1),
});

export const MemoryIndexSchema = z.object({
  version: z.number().nonnegative(),
  entries: z.array(MemoryIndexEntrySchema),
  topics: z.array(z.string()),
  tags: z.array(z.string()),
  lastUpdated: z.number().positive(),
});

export const TopicEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().positive(),
  content: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  references: z.array(z.string()),
});

export const TopicMetadataSchema = z.object({
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  accessCount: z.number().nonnegative(),
  lastAccessed: z.number().positive(),
  importance: z.number().min(0).max(1),
});

export const TopicFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  content: z.string(),
  entries: z.array(TopicEntrySchema),
  metadata: TopicMetadataSchema,
});

export const MemoryStateSchema = z.object({
  index: MemoryIndexSchema,
  topics: z.map(z.string(), TopicFileSchema),
  lastSync: z.number().positive(),
  dirty: z.boolean(),
});

// ============================================================================
// Search Schemas
// ============================================================================

export const SearchResultItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number().min(0).max(1),
  source: SearchSourceSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const SemanticSearchResultSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultItemSchema),
  totalResults: z.number().nonnegative(),
  searchTime: z.number().nonnegative(),
});

export const EmbeddingEntrySchema = z.object({
  id: z.string(),
  embedding: z.array(z.number()),
  text: z.string(),
  createdAt: z.number().positive(),
  accessCount: z.number().nonnegative(),
  lastAccessed: z.number().positive(),
});

export const EmbeddingCacheSchema = z.object({
  entries: z.map(z.string(), EmbeddingEntrySchema),
  maxSize: z.number().positive(),
  ttl: z.number().positive(),
});

export const SimilarityScoreSchema = z.object({
  id1: z.string(),
  id2: z.string(),
  similarity: z.number().min(-1).max(1),
  method: SimilarityMethodSchema,
});

// ============================================================================
// Priority Queue Schemas
// ============================================================================

export const PriorityItemSchema = z.object({
  id: z.string(),
  priority: z.number(),
  data: z.unknown(),
  timestamp: z.number().positive(),
});

export const PriorityQueueSchema = z.object({
  items: z.array(PriorityItemSchema),
  maxSize: z.number().positive(),
});

export const QueueStatsSchema = z.object({
  size: z.number().nonnegative(),
  maxSize: z.number().positive(),
  averagePriority: z.number(),
  oldestItem: z.number().positive(),
  newestItem: z.number().positive(),
});

// ============================================================================
// File Context Schemas
// ============================================================================

export const FileContextSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string(),
  tokenCount: z.number().nonnegative(),
  lastAccessed: z.number().positive(),
  accessCount: z.number().nonnegative(),
  importance: z.number().min(0).max(1),
});

export const FileReferenceSchema = z.object({
  path: z.string(),
  lineStart: z.number().nonnegative(),
  lineEnd: z.number().nonnegative(),
  content: z.string(),
  context: z.string(),
});

// ============================================================================
// Circuit Breaker Schemas
// ============================================================================

export const CircuitBreakerStateSchema = z.object({
  state: CircuitStateSchema,
  failureCount: z.number().nonnegative(),
  successCount: z.number().nonnegative(),
  lastFailureTime: z.number().positive(),
  lastSuccessTime: z.number().positive(),
  consecutiveFailures: z.number().nonnegative(),
});

export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().positive(),
  successThreshold: z.number().positive(),
  timeout: z.number().positive(),
  halfOpenMaxCalls: z.number().positive(),
});

// ============================================================================
// Event Schemas
// ============================================================================

export const ContextEventTypeSchema = z.enum([
  'message:add',
  'message:remove',
  'message:compress',
  'compression:start',
  'compression:complete',
  'compression:error',
  'budget:warning',
  'budget:critical',
  'memory:sync',
  'memory:update',
]);

export const ContextEventSchema = z.object({
  type: ContextEventTypeSchema,
  timestamp: z.number().positive(),
  data: z.unknown(),
  source: z.string(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const MemoryConfigSchema = z.object({
  enabled: z.boolean(),
  indexPath: z.string(),
  maxTopics: z.number().positive(),
  syncInterval: z.number().positive(),
  autoSummarize: z.boolean(),
});

export const SearchConfigSchema = z.object({
  enabled: z.boolean(),
  embeddingModel: z.string(),
  cacheSize: z.number().positive(),
  cacheTtl: z.number().positive(),
  similarityThreshold: z.number().min(0).max(1),
});

export const BudgetConfigSchema = z.object({
  allocation: BudgetAllocationSchema,
  thresholds: BudgetThresholdsSchema,
  autoReclaim: z.boolean(),
});

export const ContextConfigSchema = z.object({
  maxTokens: z.number().positive(),
  compressionThresholds: z.object({
    micro: z.number().min(0).max(1),
    auto: z.number().min(0).max(1),
    full: z.number().min(0).max(1),
  }),
  memory: MemoryConfigSchema,
  search: SearchConfigSchema,
  budget: BudgetConfigSchema,
});

// ============================================================================
// Validation Functions
// ============================================================================

export function validateContextMessage(data: unknown): z.SafeParseReturnType<unknown, any> {
  return ContextMessageSchema.safeParse(data);
}

export function validateCompressionResult(data: unknown): z.SafeParseReturnType<unknown, any> {
  return CompressionResultSchema.safeParse(data);
}

export function validateTokenBudget(data: unknown): z.SafeParseReturnType<unknown, any> {
  return TokenBudgetSchema.safeParse(data);
}

export function validateMemoryIndex(data: unknown): z.SafeParseReturnType<unknown, any> {
  return MemoryIndexSchema.safeParse(data);
}

export function validateTopicFile(data: unknown): z.SafeParseReturnType<unknown, any> {
  return TopicFileSchema.safeParse(data);
}

export function validateContextConfig(data: unknown): z.SafeParseReturnType<unknown, any> {
  return ContextConfigSchema.safeParse(data);
}

// ============================================================================
// Type Inference Helpers
// ============================================================================

export type ValidatedContextMessage = z.infer<typeof ContextMessageSchema>;
export type ValidatedCompressionResult = z.infer<typeof CompressionResultSchema>;
export type ValidatedTokenBudget = z.infer<typeof TokenBudgetSchema>;
export type ValidatedMemoryIndex = z.infer<typeof MemoryIndexSchema>;
export type ValidatedTopicFile = z.infer<typeof TopicFileSchema>;
export type ValidatedContextConfig = z.infer<typeof ContextConfigSchema>;
