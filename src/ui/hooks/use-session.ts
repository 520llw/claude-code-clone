/**
 * Session Hook
 * 
 * Custom hook for managing chat sessions.
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Session, SessionState } from '@types/index';

// ============================================================================
// Hook Interface
// ============================================================================

interface UseSessionReturn {
  session: Session | null;
  createSession: (name: string, workingDirectory?: string) => Promise<void>;
  updateSession: (updates: Partial<Session>) => void;
  endSession: () => void;
  setSessionState: (state: SessionState) => void;
  incrementMessageCount: () => void;
  addTokenUsage: (input: number, output: number) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSession(defaultWorkingDirectory: string): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  
  /**
   * Create a new session
   */
  const createSession = useCallback(async (name: string, workingDirectory?: string) => {
    const now = Date.now();
    const newSession: Session = {
      id: uuidv4(),
      name,
      state: 'active',
      createdAt: now,
      updatedAt: now,
      workingDirectory: workingDirectory ?? defaultWorkingDirectory,
      context: {
        sessionId: uuidv4(),
        messages: [],
        workingDirectory: workingDirectory ?? defaultWorkingDirectory,
        files: [],
        metadata: {},
      },
      messageCount: 0,
      tokenUsage: {
        input: 0,
        output: 0,
      },
      metadata: {},
    };
    
    setSession(newSession);
  }, [defaultWorkingDirectory]);
  
  /**
   * Update session properties
   */
  const updateSession = useCallback((updates: Partial<Session>) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates,
        updatedAt: Date.now(),
      };
    });
  }, []);
  
  /**
   * End the current session
   */
  const endSession = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        state: 'ended',
        endedAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
  }, []);
  
  /**
   * Set session state
   */
  const setSessionState = useCallback((state: SessionState) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        state,
        updatedAt: Date.now(),
      };
    });
  }, []);
  
  /**
   * Increment message count
   */
  const incrementMessageCount = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messageCount: prev.messageCount + 1,
        updatedAt: Date.now(),
      };
    });
  }, []);
  
  /**
   * Add token usage
   */
  const addTokenUsage = useCallback((input: number, output: number) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tokenUsage: {
          input: prev.tokenUsage.input + input,
          output: prev.tokenUsage.output + output,
        },
        updatedAt: Date.now(),
      };
    });
  }, []);
  
  return {
    session,
    createSession,
    updateSession,
    endSession,
    setSessionState,
    incrementMessageCount,
    addTokenUsage,
  };
}

export default useSession;
