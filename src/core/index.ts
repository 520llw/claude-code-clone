/**
 * Core Module Exports
 * 
 * This module exports all core components of the Claude Code Clone.
 * 
 * @module Core
 */

// ============================================================================
// QueryEngine - LLM API Integration
// ============================================================================

export {
  QueryEngine,
  createQueryEngine,
  createAnthropicQueryEngine,
  createOpenAIQueryEngine,
  estimateQueryCost,
  type QueryEngineConfig,
  type QueryOptions,
  type QueryResponse,
} from './QueryEngine.js';

// ============================================================================
// AgentLoop - Main Agentic Loop
// ============================================================================

export {
  AgentLoop,
  createAgentLoop,
  createSimpleAgent,
  type AgentEvents,
  type AgentOptions,
} from './AgentLoop.js';

// ============================================================================
// ContextManager - Context Compression
// ============================================================================

export {
  ContextManager,
  createContextManager,
  calculateContextWindow,
  estimateMessageImportance,
  type ContextManagerConfig,
  type ContextManagerEvents,
} from './ContextManager.js';

// ============================================================================
// SessionManager - Session Persistence
// ============================================================================

export {
  SessionManager,
  createSessionManager,
  type SessionManagerConfig,
  type SessionManagerEvents,
  type SessionQuery,
  type SessionStats,
} from './SessionManager.js';

// ============================================================================
// PermissionManager - Permission System
// ============================================================================

export {
  PermissionManager,
  createPermissionManager,
  DEFAULT_PERMISSION_RULES,
  isReadOnlyOperation,
  isDangerousOperation,
  type PermissionManagerConfig,
  type PermissionManagerEvents,
} from './PermissionManager.js';

// ============================================================================
// StreamingHandler - Stream Processing
// ============================================================================

export {
  StreamingHandler,
  createStreamingHandler,
  streamToAsyncIterable,
  type StreamingHandlerConfig,
} from './StreamingHandler.js';

// ============================================================================
// TokenTracker - Token Budgeting
// ============================================================================

export {
  TokenTracker,
  createTokenTracker,
  DEFAULT_TOKEN_BUDGET,
  MODEL_PRICING,
  type TokenTrackerConfig,
  type TokenTrackerEvents,
} from './TokenTracker.js';

// ============================================================================
// Re-export Types
// ============================================================================

export * from '../types/index.js';
