/**
 * Context Types - Core type definitions for the context management system
 * 
 * This module provides comprehensive type definitions for:
 * - Context messages and conversation history
 * - Compression strategies and results
 * - Memory and topic management
 * - Token budgets and limits
 * - Semantic search and relevance scoring
 */

import { z } from 'zod';

// ============================================================================
// Core Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'compressed';

export interface ContextMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
  tokenCount?: number;
  compressionLevel?: CompressionLevel;
  originalContent?: string;
}

export interface MessageMetadata {
  source?: string;
  importance?: number;
  tags?: string[];
  references?: string[];
  filePaths?: string[];
  codeBlocks?: CodeBlock[];
  isCheckpoint?: boolean;
  checkpointId?: string;
}

export interface CodeBlock {
  language: string;
  content: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
}

// ============================================================================
// Context State Types
// ============================================================================

export interface ContextState {
  messages: ContextMessage[];
  metadata: ContextStateMetadata;
  stats: ContextStats;
  memory: MemoryState;
}

export interface ContextStateMetadata {
  sessionId: string;
  createdAt: number;
  lastModified: number;
  version: number;
  compressionHistory: CompressionRecord[];
}

export interface ContextStats {
  totalTokens: number;
  messageCount: number;
  compressedCount: number;
  memoryTokens: number;
  availableTokens: number;
  utilizationPercent: number;
}

export interface CompressionRecord {
  timestamp: number;
  strategy: CompressionStrategy;
  messagesBefore: number;
  messagesAfter: number;
  tokensBefore: number;
  tokensAfter: number;
  reason: string;
}

// ============================================================================
// Compression Types
// ============================================================================

export type CompressionLevel = 'none' | 'light' | 'medium' | 'heavy' | 'extreme';
export type CompressionStrategy = 'micro' | 'auto' | 'full' | 'manual';

export interface CompressionOptions {
  strategy: CompressionStrategy;
  targetTokens?: number;
  preserveRecent?: number;
  preserveCheckpoints?: boolean;
  generateSummary?: boolean;
  aggressive?: boolean;
}

export interface CompressionResult {
  success: boolean;
  strategy: CompressionStrategy;
  messagesRemoved: number;
  messagesCompressed: number;
  tokensBefore: number;
  tokensAfter: number;
  summary?: string;
  reinjectedContent?: string[];
  errors?: string[];
}

export interface CompressionContext {
  messages: ContextMessage[];
  tokenBudget: TokenBudget;
  priorityQueue: PriorityQueue;
  memoryState: MemoryState;
}

// ============================================================================
// Token Budget Types
// ============================================================================

export interface TokenBudget {
  total: number;
  reserved: number;
  used: number;
  available: number;
  thresholds: BudgetThresholds;
}

export interface BudgetThresholds {
  warning: number;
  critical: number;
  emergency: number;
}

export interface BudgetAllocation {
  conversation: number;
  memory: number;
  system: number;
  working: number;
  buffer: number;
}

export interface TokenUsage {
  component: string;
  tokens: number;
  priority: number;
  reclaimable: boolean;
}

// ============================================================================
// Relevance Types
// ============================================================================

export interface RelevanceScore {
  messageId: string;
  score: number;
  factors: RelevanceFactors;
  computedAt: number;
}

export interface RelevanceFactors {
  recency: number;
  importance: number;
  semantic: number;
  reference: number;
  userEmphasis: number;
}

export interface RelevanceQuery {
  text?: string;
  embedding?: number[];
  messageIds?: string[];
  timeRange?: { start: number; end: number };
  tags?: string[];
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryState {
  index: MemoryIndex;
  topics: Map<string, TopicFile>;
  lastSync: number;
  dirty: boolean;
}

export interface MemoryIndex {
  version: number;
  entries: MemoryIndexEntry[];
  topics: string[];
  tags: string[];
  lastUpdated: number;
}

export interface MemoryIndexEntry {
  id: string;
  topic: string;
  title: string;
  summary: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
  filePath: string;
  relevanceScore: number;
}

export interface TopicFile {
  id: string;
  name: string;
  description: string;
  content: string;
  entries: TopicEntry[];
  metadata: TopicMetadata;
}

export interface TopicEntry {
  id: string;
  timestamp: number;
  content: string;
  summary: string;
  tags: string[];
  references: string[];
}

export interface TopicMetadata {
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed: number;
  importance: number;
}

// ============================================================================
// Semantic Search Types
// ============================================================================

export interface SemanticSearchResult {
  query: string;
  results: SearchResultItem[];
  totalResults: number;
  searchTime: number;
}

export interface SearchResultItem {
  id: string;
  content: string;
  score: number;
  source: SearchSource;
  metadata?: Record<string, unknown>;
}

export type SearchSource = 'message' | 'memory' | 'topic' | 'file' | 'code';

export interface EmbeddingCache {
  entries: Map<string, EmbeddingEntry>;
  maxSize: number;
  ttl: number;
}

export interface EmbeddingEntry {
  id: string;
  embedding: number[];
  text: string;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface SimilarityScore {
  id1: string;
  id2: string;
  similarity: number;
  method: SimilarityMethod;
}

export type SimilarityMethod = 'cosine' | 'euclidean' | 'dot' | 'hybrid';

// ============================================================================
// Priority Queue Types
// ============================================================================

export interface PriorityQueue {
  items: PriorityItem[];
  maxSize: number;
}

export interface PriorityItem {
  id: string;
  priority: number;
  data: unknown;
  timestamp: number;
}

export interface QueueStats {
  size: number;
  maxSize: number;
  averagePriority: number;
  oldestItem: number;
  newestItem: number;
}

// ============================================================================
// File Context Types
// ============================================================================

export interface FileContext {
  path: string;
  content: string;
  language: string;
  tokenCount: number;
  lastAccessed: number;
  accessCount: number;
  importance: number;
}

export interface FileReference {
  path: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  context: string;
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type ContextEventType = 
  | 'message:add'
  | 'message:remove'
  | 'message:compress'
  | 'compression:start'
  | 'compression:complete'
  | 'compression:error'
  | 'budget:warning'
  | 'budget:critical'
  | 'memory:sync'
  | 'memory:update';

export interface ContextEvent {
  type: ContextEventType;
  timestamp: number;
  data: unknown;
  source: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ContextConfig {
  maxTokens: number;
  compressionThresholds: {
    micro: number;
    auto: number;
    full: number;
  };
  memory: MemoryConfig;
  search: SearchConfig;
  budget: BudgetConfig;
}

export interface MemoryConfig {
  enabled: boolean;
  indexPath: string;
  maxTopics: number;
  syncInterval: number;
  autoSummarize: boolean;
}

export interface SearchConfig {
  enabled: boolean;
  embeddingModel: string;
  cacheSize: number;
  cacheTtl: number;
  similarityThreshold: number;
}

export interface BudgetConfig {
  allocation: BudgetAllocation;
  thresholds: BudgetThresholds;
  autoReclaim: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export interface AsyncIterator<T> {
  next(): Promise<IteratorResult<T>>;
  return?(value?: T): Promise<IteratorResult<T>>;
  throw?(e?: Error): Promise<IteratorResult<T>>;
}

export interface IteratorResult<T> {
  value: T;
  done: boolean;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool', 'compressed']);

export const ContextMessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
  metadata: z.object({
    source: z.string().optional(),
    importance: z.number().optional(),
    tags: z.array(z.string()).optional(),
    references: z.array(z.string()).optional(),
    filePaths: z.array(z.string()).optional(),
    isCheckpoint: z.boolean().optional(),
    checkpointId: z.string().optional(),
  }).optional(),
  tokenCount: z.number().optional(),
  compressionLevel: z.enum(['none', 'light', 'medium', 'heavy', 'extreme']).optional(),
  originalContent: z.string().optional(),
});

export const TokenBudgetSchema = z.object({
  total: z.number(),
  reserved: z.number(),
  used: z.number(),
  available: z.number(),
  thresholds: z.object({
    warning: z.number(),
    critical: z.number(),
    emergency: z.number(),
  }),
});

export const CompressionResultSchema = z.object({
  success: z.boolean(),
  strategy: z.enum(['micro', 'auto', 'full', 'manual']),
  messagesRemoved: z.number(),
  messagesCompressed: z.number(),
  tokensBefore: z.number(),
  tokensAfter: z.number(),
  summary: z.string().optional(),
  reinjectedContent: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MAX_TOKENS = 128000;
export const DEFAULT_MICRO_THRESHOLD = 0.7;
export const DEFAULT_AUTO_THRESHOLD = 0.8;
export const DEFAULT_FULL_THRESHOLD = 0.95;
export const DEFAULT_RESERVE_TOKENS = 4000;
export const DEFAULT_BUFFER_TOKENS = 2000;

export const COMPRESSION_LEVELS: Record<CompressionLevel, number> = {
  none: 1.0,
  light: 0.8,
  medium: 0.5,
  heavy: 0.3,
  extreme: 0.1,
};
