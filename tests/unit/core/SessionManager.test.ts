/**
 * SessionManager Tests
 * 
 * Comprehensive test suite for the SessionManager class which handles
 * session persistence, loading, and management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockFS } from '../../mocks/MockFS';

// Session types
interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  metadata: Record<string, unknown>;
  workingDirectory: string;
}

interface SessionManagerConfig {
  sessionsDirectory: string;
  maxSessions: number;
  autoSave: boolean;
}

// SessionManager implementation
class SessionManager {
  private config: SessionManagerConfig;
  private mockFS: MockFS;
  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string | null = null;

  constructor(config: Partial<SessionManagerConfig> = {}, mockFS: MockFS) {
    this.config = {
      sessionsDirectory: '/sessions',
      maxSessions: 50,
      autoSave: true,
      ...config,
    };
    this.mockFS = mockFS;
    this.initializeSessionsDirectory();
  }

  private initializeSessionsDirectory(): void {
    try {
      this.mockFS.mkdirSync(this.config.sessionsDirectory, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  /**
   * Create a new session
   */
  createSession(name?: string, workingDirectory?: string): Session {
    const now = Date.now();
    const session: Session = {
      id: this.generateSessionId(),
      name: name || `Session ${this.sessions.size + 1}`,
      createdAt: now,
      updatedAt: now,
      messages: [],
      metadata: {},
      workingDirectory: workingDirectory || '/',
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    if (this.config.autoSave) {
      this.saveSession(session.id);
    }

    this.enforceMaxSessions();
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | undefined {
    if (!this.currentSessionId) return undefined;
    return this.sessions.get(this.currentSessionId);
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false;
    }
    this.currentSessionId = sessionId;
    return true;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Add message to session
   */
  addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'timestamp'>): SessionMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const newMessage: SessionMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
    };

    session.messages.push(newMessage);
    session.updatedAt = Date.now();

    if (this.config.autoSave) {
      this.saveSession(sessionId);
    }

    return newMessage;
  }

  /**
   * Add message to current session
   */
  addMessageToCurrent(message: Omit<SessionMessage, 'id' | 'timestamp'>): SessionMessage | undefined {
    if (!this.currentSessionId) return undefined;
    return this.addMessage(this.currentSessionId, message);
  }

  /**
   * Update session metadata
   */
  updateMetadata(sessionId: string, metadata: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.metadata = { ...session.metadata, ...metadata };
    session.updatedAt = Date.now();

    if (this.config.autoSave) {
      this.saveSession(sessionId);
    }

    return true;
  }

  /**
   * Rename a session
   */
  renameSession(sessionId: string, newName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.name = newName;
    session.updatedAt = Date.now();

    if (this.config.autoSave) {
      this.saveSession(sessionId);
    }

    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const existed = this.sessions.delete(sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }

    // Delete from filesystem
    try {
      const sessionPath = `${this.config.sessionsDirectory}/${sessionId}.json`;
      if (this.mockFS.existsSync(sessionPath)) {
        this.mockFS.unlinkSync(sessionPath);
      }
    } catch {
      // File may not exist
    }

    return existed;
  }

  /**
   * Save session to disk
   */
  saveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const sessionPath = `${this.config.sessionsDirectory}/${sessionId}.json`;
      this.mockFS.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load session from disk
   */
  loadSession(sessionId: string): Session | undefined {
    try {
      const sessionPath = `${this.config.sessionsDirectory}/${sessionId}.json`;
      if (!this.mockFS.existsSync(sessionPath)) {
        return undefined;
      }

      const content = this.mockFS.readFileSync(sessionPath, 'utf-8') as string;
      const session: Session = JSON.parse(content);
      this.sessions.set(sessionId, session);
      return session;
    } catch {
      return undefined;
    }
  }

  /**
   * Load all sessions from disk
   */
  loadAllSessions(): number {
    let count = 0;
    try {
      const entries = this.mockFS.readdirSync(this.config.sessionsDirectory);
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const sessionId = entry.replace('.json', '');
          if (this.loadSession(sessionId)) {
            count++;
          }
        }
      }
    } catch {
      // Directory may not exist
    }
    return count;
  }

  /**
   * Export session to JSON
   */
  exportSession(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session from JSON
   */
  importSession(json: string): Session | undefined {
    try {
      const session: Session = JSON.parse(json);
      
      // Validate required fields
      if (!session.id || !session.name || !Array.isArray(session.messages)) {
        return undefined;
      }

      // Generate new ID to avoid conflicts
      session.id = this.generateSessionId();
      session.createdAt = Date.now();
      session.updatedAt = Date.now();

      this.sessions.set(session.id, session);
      
      if (this.config.autoSave) {
        this.saveSession(session.id);
      }

      return session;
    } catch {
      return undefined;
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    for (const sessionId of this.sessions.keys()) {
      try {
        const sessionPath = `${this.config.sessionsDirectory}/${sessionId}.json`;
        if (this.mockFS.existsSync(sessionPath)) {
          this.mockFS.unlinkSync(sessionPath);
        }
      } catch {
        // Ignore errors
      }
    }
    this.sessions.clear();
    this.currentSessionId = null;
  }

  /**
   * Search sessions
   */
  searchSessions(query: string): Session[] {
    const regex = new RegExp(query, 'gi');
    return this.getAllSessions().filter(session => {
      if (regex.test(session.name)) return true;
      return session.messages.some(msg => regex.test(msg.content));
    });
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    totalMessages: number;
    currentSession: string | null;
    oldestSession: number;
    newestSession: number;
  } {
    const sessions = this.getAllSessions();
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

    return {
      totalSessions: sessions.length,
      totalMessages,
      currentSession: this.currentSessionId,
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : 0,
      newestSession: sessions.length > 0 ? sessions[0].createdAt : 0,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private enforceMaxSessions(): void {
    if (this.sessions.size > this.config.maxSessions) {
      const sorted = this.getAllSessions();
      const toDelete = sorted.slice(this.config.maxSessions);
      for (const session of toDelete) {
        this.deleteSession(session.id);
      }
    }
  }
}

describe('SessionManager', () => {
  let mockFS: MockFS;
  let sessionManager: SessionManager;

  const defaultConfig: SessionManagerConfig = {
    sessionsDirectory: '/sessions',
    maxSessions: 10,
    autoSave: true,
  };

  beforeEach(() => {
    mockFS = new MockFS();
    sessionManager = new SessionManager(defaultConfig, mockFS);
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const sm = new SessionManager({}, mockFS);
      expect(sm).toBeDefined();
    });

    it('should create sessions directory', () => {
      expect(mockFS.existsSync('/sessions')).toBe(true);
    });

    it('should accept custom config', () => {
      const sm = new SessionManager(
        { sessionsDirectory: '/custom', maxSessions: 5 },
        mockFS
      );
      expect(sm).toBeDefined();
    });
  });

  describe('Session Creation', () => {
    it('should create a new session', () => {
      const session = sessionManager.createSession();
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBeDefined();
    });

    it('should create session with custom name', () => {
      const session = sessionManager.createSession('My Session');
      expect(session.name).toBe('My Session');
    });

    it('should create session with working directory', () => {
      const session = sessionManager.createSession('Test', '/project');
      expect(session.workingDirectory).toBe('/project');
    });

    it('should set created session as current', () => {
      const session = sessionManager.createSession();
      expect(sessionManager.getCurrentSession()?.id).toBe(session.id);
    });

    it('should auto-save new session', () => {
      const session = sessionManager.createSession();
      const sessionPath = `/sessions/${session.id}.json`;
      expect(mockFS.existsSync(sessionPath)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('Session Retrieval', () => {
    it('should get session by ID', () => {
      const session = sessionManager.createSession();
      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get current session', () => {
      const session = sessionManager.createSession();
      const current = sessionManager.getCurrentSession();
      expect(current?.id).toBe(session.id);
    });

    it('should return undefined when no current session', () => {
      expect(sessionManager.getCurrentSession()).toBeUndefined();
    });

    it('should get all sessions sorted by updatedAt', () => {
      const session1 = sessionManager.createSession('First');
      const session2 = sessionManager.createSession('Second');
      const all = sessionManager.getAllSessions();
      expect(all[0].id).toBe(session2.id);
      expect(all[1].id).toBe(session1.id);
    });
  });

  describe('Current Session Management', () => {
    it('should set current session', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      const result = sessionManager.setCurrentSession(session1.id);
      expect(result).toBe(true);
      expect(sessionManager.getCurrentSession()?.id).toBe(session1.id);
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.setCurrentSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Message Management', () => {
    it('should add message to session', () => {
      const session = sessionManager.createSession();
      const message = sessionManager.addMessage(session.id, {
        role: 'user',
        content: 'Hello',
      });
      
      expect(message).toBeDefined();
      expect(message?.content).toBe('Hello');
    });

    it('should return undefined for non-existent session', () => {
      const message = sessionManager.addMessage('non-existent', {
        role: 'user',
        content: 'Hello',
      });
      expect(message).toBeUndefined();
    });

    it('should add message to current session', () => {
      sessionManager.createSession();
      const message = sessionManager.addMessageToCurrent({
        role: 'assistant',
        content: 'Hi!',
      });
      
      expect(message).toBeDefined();
    });

    it('should return undefined when no current session', () => {
      const message = sessionManager.addMessageToCurrent({
        role: 'user',
        content: 'Hello',
      });
      expect(message).toBeUndefined();
    });

    it('should update session timestamp on message add', async () => {
      const session = sessionManager.createSession();
      const before = session.updatedAt;
      await new Promise(r => setTimeout(r, 10));
      
      sessionManager.addMessage(session.id, { role: 'user', content: 'Test' });
      expect(session.updatedAt).toBeGreaterThan(before);
    });
  });

  describe('Session Updates', () => {
    it('should update metadata', () => {
      const session = sessionManager.createSession();
      const result = sessionManager.updateMetadata(session.id, { key: 'value' });
      
      expect(result).toBe(true);
      expect(session.metadata.key).toBe('value');
    });

    it('should merge metadata', () => {
      const session = sessionManager.createSession();
      sessionManager.updateMetadata(session.id, { key1: 'value1' });
      sessionManager.updateMetadata(session.id, { key2: 'value2' });
      
      expect(session.metadata.key1).toBe('value1');
      expect(session.metadata.key2).toBe('value2');
    });

    it('should rename session', () => {
      const session = sessionManager.createSession('Old Name');
      const result = sessionManager.renameSession(session.id, 'New Name');
      
      expect(result).toBe(true);
      expect(session.name).toBe('New Name');
    });

    it('should return false when updating non-existent session', () => {
      const result = sessionManager.updateMetadata('non-existent', {});
      expect(result).toBe(false);
    });
  });

  describe('Session Deletion', () => {
    it('should delete session', () => {
      const session = sessionManager.createSession();
      const result = sessionManager.deleteSession(session.id);
      
      expect(result).toBe(true);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('should delete session file', () => {
      const session = sessionManager.createSession();
      const sessionPath = `/sessions/${session.id}.json`;
      
      sessionManager.deleteSession(session.id);
      expect(mockFS.existsSync(sessionPath)).toBe(false);
    });

    it('should reset current session when deleted', () => {
      const session = sessionManager.createSession();
      sessionManager.deleteSession(session.id);
      
      expect(sessionManager.getCurrentSession()).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.deleteSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should save session to disk', () => {
      const session = sessionManager.createSession('Test', undefined, false);
      const result = sessionManager.saveSession(session.id);
      
      expect(result).toBe(true);
    });

    it('should load session from disk', () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
      
      // Create new manager to test loading
      const newManager = new SessionManager(defaultConfig, mockFS);
      const loaded = newManager.loadSession(session.id);
      
      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe(session.name);
    });

    it('should return undefined for non-existent file', () => {
      const loaded = sessionManager.loadSession('non-existent');
      expect(loaded).toBeUndefined();
    });

    it('should load all sessions', () => {
      sessionManager.createSession('Session 1');
      sessionManager.createSession('Session 2');
      
      const newManager = new SessionManager(defaultConfig, mockFS);
      const count = newManager.loadAllSessions();
      
      expect(count).toBe(2);
    });
  });

  describe('Import/Export', () => {
    it('should export session to JSON', () => {
      const session = sessionManager.createSession('Export Test');
      const json = sessionManager.exportSession(session.id);
      
      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe('Export Test');
    });

    it('should return undefined for non-existent session export', () => {
      const json = sessionManager.exportSession('non-existent');
      expect(json).toBeUndefined();
    });

    it('should import session from JSON', () => {
      const session = sessionManager.createSession('Import Test');
      sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
      
      const json = sessionManager.exportSession(session.id)!;
      const imported = sessionManager.importSession(json);
      
      expect(imported).toBeDefined();
      expect(imported?.name).toBe('Import Test');
      expect(imported?.id).not.toBe(session.id); // New ID generated
    });

    it('should return undefined for invalid JSON', () => {
      const imported = sessionManager.importSession('invalid json');
      expect(imported).toBeUndefined();
    });

    it('should return undefined for missing required fields', () => {
      const imported = sessionManager.importSession('{"name": "test"}');
      expect(imported).toBeUndefined();
    });
  });

  describe('Search', () => {
    it('should search sessions by name', () => {
      sessionManager.createSession('Alpha Session');
      sessionManager.createSession('Beta Session');
      
      const results = sessionManager.searchSessions('Alpha');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alpha Session');
    });

    it('should search sessions by message content', () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: 'user', content: 'unique keyword here' });
      
      const results = sessionManager.searchSessions('unique keyword');
      expect(results).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      sessionManager.createSession('UPPERCASE');
      const results = sessionManager.searchSessions('uppercase');
      expect(results).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    it('should return session statistics', () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
      sessionManager.addMessage(session.id, { role: 'assistant', content: 'Hi!' });
      
      const stats = sessionManager.getStats();
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalMessages).toBe(2);
    });

    it('should track current session in stats', () => {
      const session = sessionManager.createSession();
      const stats = sessionManager.getStats();
      expect(stats.currentSession).toBe(session.id);
    });
  });

  describe('Max Sessions Limit', () => {
    it('should enforce max sessions limit', () => {
      const sm = new SessionManager({ maxSessions: 3 }, mockFS);
      
      sm.createSession('Session 1');
      sm.createSession('Session 2');
      sm.createSession('Session 3');
      sm.createSession('Session 4');
      
      expect(sm.getAllSessions()).toHaveLength(3);
    });

    it('should remove oldest sessions when limit exceeded', () => {
      const sm = new SessionManager({ maxSessions: 2 }, mockFS);
      
      const session1 = sm.createSession('Session 1');
      sm.createSession('Session 2');
      sm.createSession('Session 3');
      
      expect(sm.getSession(session1.id)).toBeUndefined();
    });
  });

  describe('Clear All', () => {
    it('should clear all sessions', () => {
      sessionManager.createSession('Session 1');
      sessionManager.createSession('Session 2');
      
      sessionManager.clearAllSessions();
      
      expect(sessionManager.getAllSessions()).toHaveLength(0);
      expect(sessionManager.getCurrentSession()).toBeUndefined();
    });

    it('should delete all session files', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      sessionManager.clearAllSessions();
      
      expect(mockFS.existsSync(`/sessions/${session1.id}.json`)).toBe(false);
      expect(mockFS.existsSync(`/sessions/${session2.id}.json`)).toBe(false);
    });
  });
});
