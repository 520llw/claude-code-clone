/**
 * Context Module - Main exports for the context management system
 * 
 * This module provides a comprehensive context management solution for AI systems,
 * including:
 * - Context state management
 * - Three-layer compression (micro, auto, full)
 * - Token budget management
 * - Relevance scoring
 * - Memory integration
 * - Semantic search
 */

// ============================================================================
// Core Exports
// ============================================================================

export { ContextManager, createContextManager, withContextManager } from './ContextManager.js';
export { ContextCompressor, createContextCompressor } from './ContextCompressor.js';
export { ContextBudget, createContextBudget } from './ContextBudget.js';
export { ContextRelevance, createContextRelevance, scoreMessages, getMostRelevant } from './ContextRelevance.js';

// ============================================================================
// Types Exports
// ============================================================================

export * from './types/index.js';
export * from './types/schema.js';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  // Token Counter
  CharacterTokenCounter,
  TiktokenCounter,
  SmartTokenCounter,
  countTokens,
  countMessageTokens,
  estimateTokens,
  getModelTokenLimit,
  formatTokenCount,
  calculateBudget,
  calculateCompressionSavings,
  updateMessageTokenCounts,
  findTokenHeavyMessages,
  estimateMessageTokens,
  detectContentType,
  analyzeTokenDistribution,
  getGlobalCounter,
  setGlobalCounter,
} from './utils/tokenCounter.js';

export {
  // Content Splitter
  TokenAwareSplitter,
  CodeAwareSplitter,
  SemanticSplitter,
  SmartSplitter,
  splitContent,
  splitByTokens,
  splitCode,
  reassembleChunks,
  DEFAULT_SPLITTER_CONFIG,
} from './utils/contentSplitter.js';

export {
  // Priority Queue
  BinaryHeapPriorityQueue,
  SortedArrayPriorityQueue,
  createPriorityQueue,
  createItem,
  mergeQueues,
  DEFAULT_QUEUE_CONFIG,
} from './utils/priorityQueue.js';

// ============================================================================
// Type Re-exports for Convenience
// ============================================================================

export type { TokenCounter } from './utils/tokenCounter.js';
export type { ContentSplitter, ContentChunk, SplitterConfig } from './utils/contentSplitter.js';
export type { IPriorityQueue, PriorityQueueItem, PriorityQueueConfig, QueueStats, EvictionPolicy } from './utils/priorityQueue.js';
export type { ManagerConfig } from './ContextManager.js';
export type { CompressorConfig, CompressionStrategy } from './ContextCompressor.js';
export type { BudgetConfig, BudgetEvents } from './ContextBudget.js';
export type { RelevanceConfig, RelevanceEvents } from './ContextRelevance.js';

// ============================================================================
// Constants
// ============================================================================

export {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MICRO_THRESHOLD,
  DEFAULT_AUTO_THRESHOLD,
  DEFAULT_FULL_THRESHOLD,
  DEFAULT_RESERVE_TOKENS,
  DEFAULT_BUFFER_TOKENS,
  COMPRESSION_LEVELS,
} from './types/index.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Module Info
// ============================================================================

export const MODULE_INFO = {
  name: '@claude-code/context',
  version: VERSION,
  description: 'Context management system for Claude Code clone',
  features: [
    'Three-layer compression (micro, auto, full)',
    'Token budget management',
    'Relevance scoring',
    'Memory integration',
    'Semantic search',
    'Priority queue management',
    'Content splitting',
    'Event-driven architecture',
  ],
};

// ============================================================================
// Default Export
// ============================================================================

export { ContextManager as default } from './ContextManager.js';
