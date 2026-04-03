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

// Actual implementations
export { SessionManager } from '@core/SessionManager';
export type { SessionManagerConfig } from '@core/SessionManager';
