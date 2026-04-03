/**
 * SessionManager - Session Persistence and Management
 * 
 * This module provides comprehensive session management:
 * - Session creation and lifecycle
 * - Message persistence
 * - Session snapshots and checkpoints
 * - Resume capability
 * - Session metadata and search
 * 
 * @module SessionManager
 */

import {
  Session,
  SessionMetadata,
  SessionContext,
  SessionState,
  SessionSnapshot,
  Message,
  LLMConfig,
  Logger,
  AgentError,
  TokenUsage,
} from '../types/index.js';

/**
 * Events emitted by SessionManager
 */
export interface SessionManagerEvents {
  onSessionCreated?: (session: Session) => void;
  onSessionUpdated?: (session: Session) => void;
  onSessionDeleted?: (sessionId: string) => void;
  onMessageAdded?: (sessionId: string, message: Message) => void;
  onSnapshotCreated?: (sessionId: string, snapshot: SessionSnapshot) => void;
}

/**
 * Configuration for SessionManager
 */
export interface SessionManagerConfig {
  storagePath?: string;
  maxSessions?: number;
  maxMessagesPerSession?: number;
  autoSave?: boolean;
  saveInterval?: number;
  compressionEnabled?: boolean;
  events?: SessionManagerEvents;
  logger?: Logger;
  defaultLLMConfig: LLMConfig;
}

/**
 * Session query options
 */
export interface SessionQuery {
  userId?: string;
  projectPath?: string;
  state?: SessionState;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  searchTerm?: string;
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerSession: number;
  oldestSession: Date | null;
  newestSession: Date | null;
}

/**
 * Default session configuration
 */
const DEFAULT_CONFIG: Partial<SessionManagerConfig> = {
  storagePath: './sessions',
  maxSessions: 100,
  maxMessagesPerSession: 10000,
  autoSave: true,
  saveInterval: 60000, // 1 minute
  compressionEnabled: true,
};

/**
 * SessionManager class for managing sessions
 */
export class SessionManager {
  private sessions: Map<string, Session>;
  private snapshots: Map<string, SessionSnapshot[]>;
  private config: Required<SessionManagerConfig>;
  private events: SessionManagerEvents;
  private logger: Logger;
  private saveTimer: Timer | null;
  private isInitialized: boolean;

  /**
   * Creates a new SessionManager instance
   * 
   * @param config - Configuration options
   */
  constructor(config: SessionManagerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<SessionManagerConfig>;
    this.events = config.events || {};
    this.logger = config.logger || this.createDefaultLogger();
    
    this.sessions = new Map();
    this.snapshots = new Map();
    this.saveTimer = null;
    this.isInitialized = false;

    this.logger.info('[SessionManager] Initialized');
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: () => {},
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Initializes the session manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create storage directory
      const fs = await import('fs/promises');
      const path = await import('path');
      
      await fs.mkdir(this.config.storagePath, { recursive: true });

      // Load existing sessions
      await this.loadSessions();

      // Start auto-save if enabled
      if (this.config.autoSave) {
        this.startAutoSave();
      }

      this.isInitialized = true;
      this.logger.info('[SessionManager] Initialized successfully');
    } catch (error) {
      this.logger.error('[SessionManager] Initialization failed:', error);
      throw new AgentError(
        'Failed to initialize SessionManager',
        'SESSION_INIT_ERROR',
        false,
        { error }
      );
    }
  }

  /**
   * Creates a new session
   * 
   * @param name - Session name
   * @param metadata - Session metadata
   * @param context - Session context
   * @returns Created session
   */
  async createSession(
    name: string,
    metadata?: Partial<SessionMetadata>,
    context?: Partial<SessionContext>
  ): Promise<Session> {
    this.ensureInitialized();

    const now = new Date();
    const session: Session = {
      id: this.generateSessionId(),
      name,
      createdAt: now,
      updatedAt: now,
      messages: [],
      metadata: {
        llmConfig: metadata?.llmConfig || this.config.defaultLLMConfig,
        ...metadata,
      } as SessionMetadata,
      context: {
        workingDirectory: context?.workingDirectory || process.cwd(),
        environmentVariables: context?.environmentVariables || {},
        fileContexts: context?.fileContexts || [],
        customData: context?.customData || {},
      },
      state: 'active',
    };

    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      await this.removeOldestSession();
    }

    this.sessions.set(session.id, session);
    this.snapshots.set(session.id, []);

    // Persist session
    await this.saveSession(session);

    this.events.onSessionCreated?.(session);
    this.logger.info(`[SessionManager] Created session ${session.id}: ${name}`);

    return session;
  }

  /**
   * Gets a session by ID
   * 
   * @param sessionId - Session ID
   * @returns Session or undefined
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all sessions
   * 
   * @returns Array of sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Queries sessions based on criteria
   * 
   * @param query - Query options
   * @returns Matching sessions
   */
  querySessions(query: SessionQuery): Session[] {
    let sessions = this.getAllSessions();

    if (query.userId) {
      sessions = sessions.filter(s => s.metadata.userId === query.userId);
    }

    if (query.projectPath) {
      sessions = sessions.filter(s => s.metadata.projectPath === query.projectPath);
    }

    if (query.state) {
      sessions = sessions.filter(s => s.state === query.state);
    }

    if (query.tags && query.tags.length > 0) {
      sessions = sessions.filter(s => 
        query.tags!.some(tag => s.metadata.tags?.includes(tag))
      );
    }

    if (query.createdAfter) {
      sessions = sessions.filter(s => s.createdAt >= query.createdAfter!);
    }

    if (query.createdBefore) {
      sessions = sessions.filter(s => s.createdAt <= query.createdBefore!);
    }

    if (query.searchTerm) {
      const term = query.searchTerm.toLowerCase();
      sessions = sessions.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.metadata.title?.toLowerCase().includes(term) ||
        s.metadata.description?.toLowerCase().includes(term)
      );
    }

    return sessions;
  }

  /**
   * Updates a session
   * 
   * @param sessionId - Session ID
   * @param updates - Partial session updates
   * @returns Updated session or undefined
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<Session, 'id' | 'createdAt'>>
  ): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Apply updates
    if (updates.name) session.name = updates.name;
    if (updates.messages) session.messages = updates.messages;
    if (updates.metadata) session.metadata = { ...session.metadata, ...updates.metadata };
    if (updates.context) session.context = { ...session.context, ...updates.context };
    if (updates.state) session.state = updates.state;

    session.updatedAt = new Date();

    // Persist changes
    await this.saveSession(session);

    this.events.onSessionUpdated?.(session);
    this.logger.debug(`[SessionManager] Updated session ${sessionId}`);

    return session;
  }

  /**
   * Adds a message to a session
   * 
   * @param sessionId - Session ID
   * @param message - Message to add
   * @returns Updated session or undefined
   */
  async addMessage(sessionId: string, message: Message): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Check message limit
    if (session.messages.length >= this.config.maxMessagesPerSession) {
      // Remove oldest messages (keep 80% of max)
      const keepCount = Math.floor(this.config.maxMessagesPerSession * 0.8);
      session.messages = session.messages.slice(-keepCount);
      this.logger.warn(`[SessionManager] Trimmed messages for session ${sessionId}`);
    }

    session.messages.push(message);
    session.updatedAt = new Date();

    // Persist changes
    await this.saveSession(session);

    this.events.onMessageAdded?.(sessionId, message);
    this.logger.debug(`[SessionManager] Added message to session ${sessionId}`);

    return session;
  }

  /**
   * Deletes a session
   * 
   * @param sessionId - Session ID
   * @returns True if deleted
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove from memory
    this.sessions.delete(sessionId);
    this.snapshots.delete(sessionId);

    // Remove from disk
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(this.config.storagePath, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.warn(`[SessionManager] Failed to delete session file:`, error);
    }

    this.events.onSessionDeleted?.(sessionId);
    this.logger.info(`[SessionManager] Deleted session ${sessionId}`);

    return true;
  }

  /**
   * Creates a session snapshot
   * 
   * @param sessionId - Session ID
   * @param checkpoint - Checkpoint name
   * @returns Created snapshot or undefined
   */
  async createSnapshot(
    sessionId: string,
    checkpoint: string
  ): Promise<SessionSnapshot | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const snapshot: SessionSnapshot = {
      sessionId,
      timestamp: new Date(),
      messages: [...session.messages],
      tokenUsage: this.calculateTokenUsage(session),
      checkpoint,
    };

    const snapshots = this.snapshots.get(sessionId) || [];
    snapshots.push(snapshot);
    this.snapshots.set(sessionId, snapshots);

    // Persist snapshot
    await this.saveSnapshot(snapshot);

    this.events.onSnapshotCreated?.(sessionId, snapshot);
    this.logger.info(`[SessionManager] Created snapshot for ${sessionId}: ${checkpoint}`);

    return snapshot;
  }

  /**
   * Gets snapshots for a session
   * 
   * @param sessionId - Session ID
   * @returns Array of snapshots
   */
  getSnapshots(sessionId: string): SessionSnapshot[] {
    return this.snapshots.get(sessionId) || [];
  }

  /**
   * Restores a session from a snapshot
   * 
   * @param sessionId - Session ID
   * @param checkpoint - Checkpoint name
   * @returns Restored session or undefined
   */
  async restoreFromSnapshot(
    sessionId: string,
    checkpoint: string
  ): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const snapshots = this.snapshots.get(sessionId) || [];
    const snapshot = snapshots.find(s => s.checkpoint === checkpoint);
    if (!snapshot) return undefined;

    session.messages = [...snapshot.messages];
    session.updatedAt = new Date();
    session.state = 'active';

    await this.saveSession(session);

    this.logger.info(`[SessionManager] Restored session ${sessionId} from ${checkpoint}`);

    return session;
  }

  /**
   * Resumes a paused session
   * 
   * @param sessionId - Session ID
   * @returns Resumed session or undefined
   */
  async resumeSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (session.state !== 'paused') {
      this.logger.warn(`[SessionManager] Session ${sessionId} is not paused`);
      return session;
    }

    session.state = 'active';
    session.updatedAt = new Date();

    await this.saveSession(session);

    this.logger.info(`[SessionManager] Resumed session ${sessionId}`);

    return session;
  }

  /**
   * Pauses an active session
   * 
   * @param sessionId - Session ID
   * @returns Paused session or undefined
   */
  async pauseSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.state = 'paused';
    session.updatedAt = new Date();

    await this.saveSession(session);

    this.logger.info(`[SessionManager] Paused session ${sessionId}`);

    return session;
  }

  /**
   * Gets session statistics
   * 
   * @returns Session statistics
   */
  getStats(): SessionStats {
    const sessions = this.getAllSessions();
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const activeSessions = sessions.filter(s => s.state === 'active').length;

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalMessages,
      totalTokens: sessions.reduce((sum, s) => sum + this.calculateTokenUsage(s).totalTokens, 0),
      averageMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
      oldestSession: sessions.length > 0 
        ? new Date(Math.min(...sessions.map(s => s.createdAt.getTime())))
        : null,
      newestSession: sessions.length > 0
        ? new Date(Math.max(...sessions.map(s => s.createdAt.getTime())))
        : null,
    };
  }

  /**
   * Exports a session to JSON
   * 
   * @param sessionId - Session ID
   * @returns JSON string or undefined
   */
  exportSession(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return JSON.stringify(session, null, 2);
  }

  /**
   * Imports a session from JSON
   * 
   * @param json - JSON string
   * @returns Imported session or undefined
   */
  async importSession(json: string): Promise<Session | undefined> {
    try {
      const session: Session = JSON.parse(json);
      
      // Validate session structure
      if (!session.id || !session.name) {
        throw new Error('Invalid session structure');
      }

      // Generate new ID to avoid conflicts
      session.id = this.generateSessionId();
      session.createdAt = new Date();
      session.updatedAt = new Date();

      this.sessions.set(session.id, session);
      this.snapshots.set(session.id, []);

      await this.saveSession(session);

      this.logger.info(`[SessionManager] Imported session ${session.id}`);

      return session;
    } catch (error) {
      this.logger.error('[SessionManager] Failed to import session:', error);
      return undefined;
    }
  }

  /**
   * Saves all sessions
   */
  async saveAllSessions(): Promise<void> {
    for (const session of this.sessions.values()) {
      await this.saveSession(session);
    }
    this.logger.debug('[SessionManager] Saved all sessions');
  }

  /**
   * Disposes the session manager
   */
  async dispose(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    await this.saveAllSessions();
    this.isInitialized = false;

    this.logger.info('[SessionManager] Disposed');
  }

  /**
   * Ensures the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new AgentError(
        'SessionManager not initialized',
        'SESSION_NOT_INITIALIZED',
        false
      );
    }
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Saves a session to disk
   * 
   * @param session - Session to save
   */
  private async saveSession(session: Session): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const filePath = path.join(this.config.storagePath, `${session.id}.json`);
      const data = JSON.stringify(session, null, 2);

      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      this.logger.error(`[SessionManager] Failed to save session ${session.id}:`, error);
    }
  }

  /**
   * Saves a snapshot to disk
   * 
   * @param snapshot - Snapshot to save
   */
  private async saveSnapshot(snapshot: SessionSnapshot): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const snapshotsDir = path.join(this.config.storagePath, 'snapshots');
      await fs.mkdir(snapshotsDir, { recursive: true });

      const fileName = `${snapshot.sessionId}_${snapshot.checkpoint}.json`;
      const filePath = path.join(snapshotsDir, fileName);
      const data = JSON.stringify(snapshot, null, 2);

      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      this.logger.error('[SessionManager] Failed to save snapshot:', error);
    }
  }

  /**
   * Loads all sessions from disk
   */
  private async loadSessions(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const files = await fs.readdir(this.config.storagePath);
      const sessionFiles = files.filter(f => f.endsWith('.json') && !f.includes('_'));

      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this.config.storagePath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const session: Session = JSON.parse(data);

          // Convert date strings back to Date objects
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
          session.messages.forEach(m => {
            m.timestamp = new Date(m.timestamp);
          });

          this.sessions.set(session.id, session);
          this.snapshots.set(session.id, []);
        } catch (error) {
          this.logger.warn(`[SessionManager] Failed to load session from ${file}:`, error);
        }
      }

      this.logger.info(`[SessionManager] Loaded ${this.sessions.size} sessions`);
    } catch (error) {
      this.logger.warn('[SessionManager] Failed to load sessions:', error);
    }
  }

  /**
   * Removes the oldest session
   */
  private async removeOldestSession(): Promise<void> {
    let oldest: Session | null = null;
    
    for (const session of this.sessions.values()) {
      if (!oldest || session.updatedAt < oldest.updatedAt) {
        oldest = session;
      }
    }

    if (oldest) {
      await this.deleteSession(oldest.id);
      this.logger.info(`[SessionManager] Removed oldest session ${oldest.id}`);
    }
  }

  /**
   * Starts auto-save timer
   */
  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.saveAllSessions();
    }, this.config.saveInterval);
  }

  /**
   * Calculates token usage for a session
   * 
   * @param session - Session
   * @returns Token usage
   */
  private calculateTokenUsage(session: Session): TokenUsage {
    // This is a simplified calculation
    // In production, you'd want to track actual token usage
    const totalChars = session.messages.reduce((sum, m) => {
      if ('content' in m && typeof m.content === 'string') {
        return sum + m.content.length;
      }
      return sum;
    }, 0);

    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      inputTokens: Math.floor(estimatedTokens * 0.7),
      outputTokens: Math.floor(estimatedTokens * 0.3),
      totalTokens: estimatedTokens,
    };
  }
}

/**
 * Factory function to create SessionManager instances
 */
export function createSessionManager(config: SessionManagerConfig): SessionManager {
  return new SessionManager(config);
}

export default SessionManager;
