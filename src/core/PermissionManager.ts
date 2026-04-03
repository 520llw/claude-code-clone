/**
 * PermissionManager - Tool-Level Permission System
 * 
 * This module provides comprehensive permission management for tool execution:
 * - Tool-level permission configuration
 * - User approval workflow
 * - Permission caching and persistence
 * - Rule-based permission evaluation
 * - Audit logging
 * 
 * @module PermissionManager
 */

import {
  PermissionLevel,
  PermissionRequest,
  PermissionDecision,
  PermissionRule,
  PermissionCache,
  ToolDefinition,
  ToolCategory,
  Logger,
  PermissionError,
  AgentError,
} from '../types/index.js';

/**
 * Events emitted by PermissionManager
 */
export interface PermissionManagerEvents {
  onPermissionRequest?: (request: PermissionRequest) => void;
  onPermissionDecision?: (decision: PermissionDecision, request: PermissionRequest) => void;
  onPermissionCacheUpdate?: (cache: Map<string, PermissionCache>) => void;
}

/**
 * Configuration for PermissionManager
 */
export interface PermissionManagerConfig {
  sessionId: string;
  defaultLevel?: PermissionLevel;
  rules?: PermissionRule[];
  events?: PermissionManagerEvents;
  logger?: Logger;
  enablePersistence?: boolean;
  persistencePath?: string;
  auditLogPath?: string;
  autoApproveReadOnly?: boolean;
  autoApproveNonDangerous?: boolean;
}

/**
 * Default permission rules
 */
export const DEFAULT_PERMISSION_RULES: PermissionRule[] = [
  // Read-only file operations are generally safe
  {
    toolPattern: /^ReadFile$|^View$|^ViewDirectory$/,
    level: 'always_allow',
    conditions: { readOnly: true },
  },
  // Shell commands are dangerous
  {
    toolPattern: /^Bash$|^Shell$/,
    level: 'ask_every_time',
    conditions: { dangerous: true },
  },
  // Write operations require approval
  {
    toolPattern: /^WriteFile$|^EditFile$|^DeleteFile$/,
    level: 'ask_every_time',
    conditions: { readOnly: false },
  },
  // Search operations are generally safe
  {
    toolPattern: /^Search$|^Grep$|^Find$/,
    level: 'ask_once',
    conditions: { readOnly: true },
  },
];

/**
 * PermissionManager class for managing tool permissions
 */
export class PermissionManager {
  private sessionId: string;
  private defaultLevel: PermissionLevel;
  private rules: PermissionRule[];
  private events: PermissionManagerEvents;
  private logger: Logger;
  private enablePersistence: boolean;
  private persistencePath: string;
  private auditLogPath: string;
  private autoApproveReadOnly: boolean;
  private autoApproveNonDangerous: boolean;
  
  // Permission cache: toolName -> PermissionCache
  private permissionCache: Map<string, PermissionCache>;
  
  // Pending permission requests
  private pendingRequests: Map<string, PermissionRequest>;
  
  // Audit log
  private auditLog: Array<{
    timestamp: Date;
    action: 'request' | 'grant' | 'deny' | 'cache_hit';
    request?: PermissionRequest;
    decision?: PermissionDecision;
    rule?: PermissionRule;
  }>;

  /**
   * Creates a new PermissionManager instance
   * 
   * @param config - Configuration options
   */
  constructor(config: PermissionManagerConfig) {
    this.sessionId = config.sessionId;
    this.defaultLevel = config.defaultLevel || 'ask_every_time';
    this.rules = config.rules || [...DEFAULT_PERMISSION_RULES];
    this.events = config.events || {};
    this.logger = config.logger || this.createDefaultLogger();
    this.enablePersistence = config.enablePersistence ?? false;
    this.persistencePath = config.persistencePath || './permissions.json';
    this.auditLogPath = config.auditLogPath || './audit.log';
    this.autoApproveReadOnly = config.autoApproveReadOnly ?? true;
    this.autoApproveNonDangerous = config.autoApproveNonDangerous ?? false;
    
    this.permissionCache = new Map();
    this.pendingRequests = new Map();
    this.auditLog = [];

    this.logger.info(`[PermissionManager] Initialized for session ${this.sessionId}`);
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
   * Evaluates permission for a tool call
   * 
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @param toolDefinition - Tool definition (optional)
   * @returns Permission decision
   */
  async evaluatePermission(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolDefinition?: ToolDefinition
  ): Promise<{ granted: boolean; decision: PermissionDecision | null }> {
    this.logger.debug(`[PermissionManager] Evaluating permission for ${toolName}`);

    // Check cache first
    const cachedPermission = this.checkCache(toolName, toolInput);
    if (cachedPermission) {
      this.logAudit('cache_hit', undefined, undefined, undefined, { toolName, cachedPermission });
      return { granted: cachedPermission.level !== 'never_allow', decision: null };
    }

    // Evaluate rules
    const rule = this.findMatchingRule(toolName, toolDefinition);
    const effectiveLevel = rule?.level || toolDefinition?.permissionLevel || this.defaultLevel;

    this.logger.debug(`[PermissionManager] Effective level for ${toolName}: ${effectiveLevel}`);

    // Handle based on permission level
    switch (effectiveLevel) {
      case 'always_allow':
        return { granted: true, decision: null };

      case 'never_allow':
        return { 
          granted: false, 
          decision: {
            requestId: '',
            granted: false,
            timestamp: new Date(),
          }
        };

      case 'ask_once':
        // Check if we've asked for this tool before in this session
        if (this.permissionCache.has(toolName)) {
          const cache = this.permissionCache.get(toolName)!;
          return { granted: true, decision: null };
        }
        // Fall through to ask

      case 'ask_every_time':
      default:
        // Create permission request
        const request = this.createPermissionRequest(toolName, toolInput);
        this.pendingRequests.set(request.id, request);
        
        // Emit request event
        this.events.onPermissionRequest?.(request);
        
        this.logAudit('request', request);
        
        return { granted: false, decision: null }; // Will be resolved later
    }
  }

  /**
   * Resolves a pending permission request
   * 
   * @param requestId - ID of the permission request
   * @param granted - Whether permission is granted
   * @param duration - How long the permission lasts
   * @returns The permission decision
   */
  resolvePermissionRequest(
    requestId: string,
    granted: boolean,
    duration: 'once' | 'session' | 'forever' = 'once'
  ): PermissionDecision {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new PermissionError(`Permission request ${requestId} not found`);
    }

    const decision: PermissionDecision = {
      requestId,
      granted,
      duration: granted ? duration : undefined,
      timestamp: new Date(),
    };

    // Update cache if granted for session or forever
    if (granted && (duration === 'session' || duration === 'forever')) {
      this.updateCache(request.toolName, {
        toolName: request.toolName,
        level: duration === 'forever' ? 'always_allow' : 'ask_once',
        expiresAt: duration === 'forever' ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    // Remove from pending
    this.pendingRequests.delete(requestId);

    // Emit decision event
    this.events.onPermissionDecision?.(decision, request);
    
    this.logAudit(granted ? 'grant' : 'deny', request, decision);

    return decision;
  }

  /**
   * Grants permission for a tool
   * 
   * @param toolName - Name of the tool
   * @param duration - How long the permission lasts
   */
  grantPermission(
    toolName: string,
    duration: 'once' | 'session' | 'forever' = 'session'
  ): void {
    this.updateCache(toolName, {
      toolName,
      level: duration === 'forever' ? 'always_allow' : 'ask_once',
      expiresAt: duration === 'forever' ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    this.logger.info(`[PermissionManager] Granted permission for ${toolName} (${duration})`);
  }

  /**
   * Revokes permission for a tool
   * 
   * @param toolName - Name of the tool
   */
  revokePermission(toolName: string): void {
    this.permissionCache.delete(toolName);
    this.logger.info(`[PermissionManager] Revoked permission for ${toolName}`);
    this.events.onPermissionCacheUpdate?.(this.permissionCache);
  }

  /**
   * Checks if a tool has cached permission
   * 
   * @param toolName - Name of the tool
   * @returns True if permission is cached and valid
   */
  hasPermission(toolName: string): boolean {
    const cache = this.permissionCache.get(toolName);
    if (!cache) return false;
    
    // Check expiration
    if (cache.expiresAt && cache.expiresAt < new Date()) {
      this.permissionCache.delete(toolName);
      return false;
    }
    
    return cache.level !== 'never_allow';
  }

  /**
   * Adds a permission rule
   * 
   * @param rule - Rule to add
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
    this.logger.info(`[PermissionManager] Added rule for pattern: ${rule.toolPattern}`);
  }

  /**
   * Removes a permission rule
   * 
   * @param index - Index of rule to remove
   */
  removeRule(index: number): void {
    if (index >= 0 && index < this.rules.length) {
      const removed = this.rules.splice(index, 1);
      this.logger.info(`[PermissionManager] Removed rule:`, removed[0]);
    }
  }

  /**
   * Gets all permission rules
   * 
   * @returns Array of rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Gets all pending permission requests
   * 
   * @returns Array of pending requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Gets the permission cache
   * 
   * @returns Permission cache map
   */
  getPermissionCache(): Map<string, PermissionCache> {
    return new Map(this.permissionCache);
  }

  /**
   * Clears all cached permissions
   */
  clearCache(): void {
    this.permissionCache.clear();
    this.logger.info('[PermissionManager] Permission cache cleared');
    this.events.onPermissionCacheUpdate?.(this.permissionCache);
  }

  /**
   * Gets the audit log
   * 
   * @returns Audit log entries
   */
  getAuditLog(): Array<{
    timestamp: Date;
    action: 'request' | 'grant' | 'deny' | 'cache_hit';
    request?: PermissionRequest;
    decision?: PermissionDecision;
    rule?: PermissionRule;
  }> {
    return [...this.auditLog];
  }

  /**
   * Clears the audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.logger.info('[PermissionManager] Audit log cleared');
  }

  /**
   * Saves permission state to disk
   */
  async saveState(): Promise<void> {
    if (!this.enablePersistence) return;

    try {
      const state = {
        sessionId: this.sessionId,
        cache: Array.from(this.permissionCache.entries()),
        rules: this.rules,
        timestamp: new Date().toISOString(),
      };

      const fs = await import('fs/promises');
      await fs.writeFile(
        this.persistencePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );

      this.logger.info('[PermissionManager] State saved to', this.persistencePath);
    } catch (error) {
      this.logger.error('[PermissionManager] Failed to save state:', error);
    }
  }

  /**
   * Loads permission state from disk
   */
  async loadState(): Promise<void> {
    if (!this.enablePersistence) return;

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.persistencePath, 'utf-8');
      const state = JSON.parse(data);

      if (state.cache) {
        this.permissionCache = new Map(state.cache);
      }
      if (state.rules) {
        this.rules = state.rules;
      }

      this.logger.info('[PermissionManager] State loaded from', this.persistencePath);
    } catch (error) {
      this.logger.warn('[PermissionManager] Failed to load state:', error);
    }
  }

  /**
   * Creates a permission request
   * 
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @returns Permission request
   */
  private createPermissionRequest(
    toolName: string,
    toolInput: Record<string, unknown>
  ): PermissionRequest {
    return {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      toolName,
      toolInput,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };
  }

  /**
   * Checks the permission cache
   * 
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @returns Cached permission or null
   */
  private checkCache(
    toolName: string,
    toolInput: Record<string, unknown>
  ): PermissionCache | null {
    const cache = this.permissionCache.get(toolName);
    if (!cache) return null;

    // Check expiration
    if (cache.expiresAt && cache.expiresAt < new Date()) {
      this.permissionCache.delete(toolName);
      return null;
    }

    // Check conditions if present
    if (cache.conditions) {
      const conditionsMatch = this.matchConditions(toolInput, cache.conditions);
      if (!conditionsMatch) return null;
    }

    return cache;
  }

  /**
   * Updates the permission cache
   * 
   * @param toolName - Name of the tool
   * @param cache - Cache entry
   */
  private updateCache(toolName: string, cache: PermissionCache): void {
    this.permissionCache.set(toolName, cache);
    this.events.onPermissionCacheUpdate?.(this.permissionCache);
  }

  /**
   * Finds a matching rule for a tool
   * 
   * @param toolName - Name of the tool
   * @param toolDefinition - Tool definition
   * @returns Matching rule or undefined
   */
  private findMatchingRule(
    toolName: string,
    toolDefinition?: ToolDefinition
  ): PermissionRule | undefined {
    for (const rule of this.rules) {
      if (this.ruleMatches(rule, toolName, toolDefinition)) {
        return rule;
      }
    }
    return undefined;
  }

  /**
   * Checks if a rule matches a tool
   * 
   * @param rule - Permission rule
   * @param toolName - Name of the tool
   * @param toolDefinition - Tool definition
   * @returns True if rule matches
   */
  private ruleMatches(
    rule: PermissionRule,
    toolName: string,
    toolDefinition?: ToolDefinition
  ): boolean {
    // Check tool pattern
    const patternMatches = typeof rule.toolPattern === 'string'
      ? toolName === rule.toolPattern
      : rule.toolPattern.test(toolName);

    if (!patternMatches) return false;

    // Check conditions
    if (rule.conditions) {
      if (rule.conditions.readOnly !== undefined && toolDefinition) {
        if (rule.conditions.readOnly !== toolDefinition.readOnly) {
          return false;
        }
      }

      if (rule.conditions.dangerous !== undefined && toolDefinition) {
        if (rule.conditions.dangerous !== toolDefinition.isDangerous) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Matches conditions against tool input
   * 
   * @param toolInput - Tool input parameters
   * @param conditions - Conditions to match
   * @returns True if conditions match
   */
  private matchConditions(
    toolInput: Record<string, unknown>,
    conditions: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (toolInput[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Logs an audit entry
   * 
   * @param action - Action type
   * @param request - Permission request
   * @param decision - Permission decision
   * @param rule - Matching rule
   * @param metadata - Additional metadata
   */
  private logAudit(
    action: 'request' | 'grant' | 'deny' | 'cache_hit',
    request?: PermissionRequest,
    decision?: PermissionDecision,
    rule?: PermissionRule,
    metadata?: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date(),
      action,
      request,
      decision,
      rule,
    });

    // Write to file if configured
    if (this.auditLogPath) {
      this.writeAuditLogEntry({
        timestamp: new Date().toISOString(),
        action,
        toolName: request?.toolName,
        granted: decision?.granted,
        ...metadata,
      }).catch(() => {
        // Silently ignore audit log write failures
      });
    }
  }

  /**
   * Writes an entry to the audit log file
   * 
   * @param entry - Log entry
   */
  private async writeAuditLogEntry(entry: Record<string, unknown>): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.auditLogPath, line, 'utf-8');
    } catch (error) {
      this.logger.warn('[PermissionManager] Failed to write audit log:', error);
    }
  }

  /**
   * Gets recommended permission level for a tool category
   * 
   * @param category - Tool category
   * @returns Recommended permission level
   */
  static getRecommendedLevel(category: ToolCategory): PermissionLevel {
    const recommendations: Record<ToolCategory, PermissionLevel> = {
      file_system: 'ask_every_time',
      shell: 'ask_every_time',
      browser: 'ask_once',
      code_analysis: 'always_allow',
      search: 'ask_once',
      database: 'ask_every_time',
      network: 'ask_every_time',
      custom: 'ask_every_time',
    };

    return recommendations[category] || 'ask_every_time';
  }

  /**
   * Formats a permission request for display
   * 
   * @param request - Permission request
   * @returns Formatted string
   */
  static formatRequest(request: PermissionRequest): string {
    const inputStr = Object.entries(request.toolInput)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    
    return `Tool: ${request.toolName}\nInput: ${inputStr}`;
  }
}

/**
 * Factory function to create PermissionManager instances
 */
export function createPermissionManager(
  config: PermissionManagerConfig
): PermissionManager {
  return new PermissionManager(config);
}

/**
 * Quick permission check for read-only operations
 * 
 * @param toolDefinition - Tool definition
 * @returns True if read-only
 */
export function isReadOnlyOperation(toolDefinition: ToolDefinition): boolean {
  return toolDefinition.readOnly === true;
}

/**
 * Quick permission check for dangerous operations
 *
 * @param toolDefinition - Tool definition
 * @returns True if dangerous
 */
export function isDangerousOperation(toolDefinition: ToolDefinition): boolean {
  return toolDefinition.isDangerous === true;
}

export default PermissionManager;
