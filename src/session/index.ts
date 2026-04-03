/**
 * Session Module
 * 
 * This module exports all session-related classes and interfaces.
 */

// Types
export type {
  Session,
  SessionState,
  ConversationContext,
} from '@types/index';

// Re-export from core
export type { ISessionManager } from '@core/interfaces';

// Placeholder for future session implementations
// These will be implemented in separate files:
// - manager.ts
// - persistence.ts
// - state.ts
// - recovery.ts
