/**
 * @fileoverview Tool Registry for Claude Code Clone
 * 
 * This module provides the central registry for all tools in the system.
 * It handles tool registration, discovery, categorization, and lifecycle management.
 * 
 * @module ToolRegistry
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { Tool, ToolCategory, PermissionLevel, ToolConfig, ToolResult } from './Tool';
import { EventEmitter } from 'events';

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Tool registration information
 */
export interface ToolRegistration {
  /** Tool instance */
  tool: Tool;
  /** When the tool was registered */
  registeredAt: Date;
  /** Registration metadata */
  metadata: Record<string, unknown>;
}

/**
 * Tool filter options
 */
export interface ToolFilterOptions {
  /** Filter by category */
  category?: ToolCategory;
  /** Filter by permission level */
  permissionLevel?: PermissionLevel;
  /** Filter by tags */
  tags?: string[];
  /** Filter by name pattern */
  namePattern?: RegExp;
  /** Whether tool requires sandbox */
  requiresSandbox?: boolean;
  /** Whether tool is cacheable */
  cacheable?: boolean;
}

/**
 * Tool statistics
 */
export interface ToolStatistics {
  /** Total number of registered tools */
  totalTools: number;
  /** Tools by category */
  toolsByCategory: Record<ToolCategory, number>;
  /** Tools by permission level */
  toolsByPermission: Record<PermissionLevel, number>;
  /** Most used tools */
  mostUsedTools: Array<{ name: string; count: number }>;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
}

/**
 * Tool search result
 */
export interface ToolSearchResult {
  /** Matching tools */
  tools: Tool[];
  /** Total matches */
  total: number;
  /** Search query used */
  query: string;
}

// ============================================================================
// Tool Registry Class
// ============================================================================

/**
 * Central registry for managing all tools in the Claude Code Clone system.
 * 
 * The ToolRegistry provides:
 * - Tool registration and unregistration
 * - Tool discovery and lookup
 * - Categorization and filtering
 * - Statistics tracking
 * - Event-driven architecture
 * 
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 * registry.register(new FileReadTool());
 * registry.register(new BashTool());
 * 
 * const fileTools = registry.getToolsByCategory(ToolCategory.FILE);
 * const bashTool = registry.getTool('bash');
 * ```
 */
export class ToolRegistry extends EventEmitter {
  /** Map of registered tools by name */
  private tools: Map<string, ToolRegistration> = new Map();

  /** Execution statistics */
  private executionStats: Map<string, { success: number; failure: number }> = new Map();

  /** Global tool configuration */
  private globalConfig: ToolConfig;

  /** Whether the registry has been initialized */
  private initialized: boolean = false;

  /**
   * Creates a new ToolRegistry instance
   * @param config - Global tool configuration
   */
  constructor(config: ToolConfig = {}) {
    super();
    this.globalConfig = {
      defaultTimeout: 30000,
      maxTimeout: 300000,
      enableCache: false,
      ...config,
    };
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a tool with the registry
   * 
   * @param tool - Tool instance to register
   * @param metadata - Optional registration metadata
   * @returns True if registration was successful
   * @throws Error if tool with same name already exists
   * 
   * @example
   * ```typescript
   * registry.register(new FileReadTool());
   * ```
   */
  public register(tool: Tool, metadata: Record<string, unknown> = {}): boolean {
    const name = tool.name.toLowerCase();

    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered`);
    }

    // Validate tool has required properties
    if (!tool.name || !tool.description) {
      throw new Error('Tool must have name and description');
    }

    // Register the tool
    this.tools.set(name, {
      tool,
      registeredAt: new Date(),
      metadata,
    });

    // Initialize execution stats
    this.executionStats.set(name, { success: 0, failure: 0 });

    // Set up event listeners
    this.setupToolEventListeners(tool);

    // Emit registration event
    this.emit('tool:registered', { name, tool, metadata });

    return true;
  }

  /**
   * Register multiple tools at once
   * 
   * @param tools - Array of tool instances
   * @returns Number of tools successfully registered
   * 
   * @example
   * ```typescript
   * registry.registerAll([
   *   new FileReadTool(),
   *   new FileEditTool(),
   *   new BashTool(),
   * ]);
   * ```
   */
  public registerAll(tools: Tool[]): number {
    let registered = 0;
    for (const tool of tools) {
      try {
        this.register(tool);
        registered++;
      } catch (error) {
        this.emit('tool:registrationFailed', { tool: tool.name, error });
      }
    }
    return registered;
  }

  /**
   * Unregister a tool from the registry
   * 
   * @param name - Name of the tool to unregister
   * @returns True if unregistration was successful
   * 
   * @example
   * ```typescript
   * registry.unregister('file_read');
   * ```
   */
  public unregister(name: string): boolean {
    const lowerName = name.toLowerCase();
    const registration = this.tools.get(lowerName);

    if (!registration) {
      return false;
    }

    // Remove event listeners
    registration.tool.removeAllListeners();

    // Remove from registry
    this.tools.delete(lowerName);
    this.executionStats.delete(lowerName);

    // Emit unregistration event
    this.emit('tool:unregistered', { name: lowerName });

    return true;
  }

  /**
   * Unregister all tools
   * 
   * @example
   * ```typescript
   * registry.unregisterAll();
   * ```
   */
  public unregisterAll(): void {
    const names = Array.from(this.tools.keys());
    for (const name of names) {
      this.unregister(name);
    }
    this.emit('registry:cleared');
  }

  // ============================================================================
  // Lookup Methods
  // ============================================================================

  /**
   * Get a tool by name
   * 
   * @param name - Tool name
   * @returns Tool instance or undefined if not found
   * 
   * @example
   * ```typescript
   * const tool = registry.getTool('file_read');
   * if (tool) {
   *   // Use the tool
   * }
   * ```
   */
  public getTool(name: string): Tool | undefined {
    const registration = this.tools.get(name.toLowerCase());
    return registration?.tool;
  }

  /**
   * Get all registered tools
   * 
   * @returns Array of all registered tools
   * 
   * @example
   * ```typescript
   * const allTools = registry.getAllTools();
   * ```
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values()).map((r) => r.tool);
  }

  /**
   * Get all registered tool names
   * 
   * @returns Array of tool names
   * 
   * @example
   * ```typescript
   * const names = registry.getAllToolNames();
   * // ['file_read', 'file_edit', 'bash', ...]
   * ```
   */
  public getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   * 
   * @param name - Tool name
   * @returns True if tool is registered
   * 
   * @example
   * ```typescript
   * if (registry.hasTool('file_read')) {
   *   // Tool exists
   * }
   * ```
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name.toLowerCase());
  }

  // ============================================================================
  // Filtering Methods
  // ============================================================================

  /**
   * Get tools by category
   * 
   * @param category - Tool category
   * @returns Array of tools in the category
   * 
   * @example
   * ```typescript
   * const fileTools = registry.getToolsByCategory(ToolCategory.FILE);
   * ```
   */
  public getToolsByCategory(category: ToolCategory): Tool[] {
    return this.filterTools({ category });
  }

  /**
   * Get tools by permission level
   * 
   * @param permissionLevel - Permission level
   * @returns Array of tools with the permission level
   * 
   * @example
   * ```typescript
   * const askTools = registry.getToolsByPermission(PermissionLevel.ASK);
   * ```
   */
  public getToolsByPermission(permissionLevel: PermissionLevel): Tool[] {
    return this.filterTools({ permissionLevel });
  }

  /**
   * Get tools by tags
   * 
   * @param tags - Tags to match (all must match)
   * @returns Array of tools with all specified tags
   * 
   * @example
   * ```typescript
   * const gitTools = registry.getToolsByTags(['git', 'version-control']);
   * ```
   */
  public getToolsByTags(tags: string[]): Tool[] {
    return this.filterTools({ tags });
  }

  /**
   * Filter tools based on criteria
   * 
   * @param options - Filter options
   * @returns Array of matching tools
   * 
   * @example
   * ```typescript
   * const sandboxedFileTools = registry.filterTools({
   *   category: ToolCategory.FILE,
   *   requiresSandbox: true,
   * });
   * ```
   */
  public filterTools(options: ToolFilterOptions): Tool[] {
    return Array.from(this.tools.values())
      .filter((registration) => {
        const tool = registration.tool;

        if (options.category && tool.category !== options.category) {
          return false;
        }

        if (options.permissionLevel && tool.permissionLevel !== options.permissionLevel) {
          return false;
        }

        if (options.tags && options.tags.length > 0) {
          const hasAllTags = options.tags.every((tag) => tool.tags.includes(tag));
          if (!hasAllTags) {
            return false;
          }
        }

        if (options.namePattern && !options.namePattern.test(tool.name)) {
          return false;
        }

        if (options.requiresSandbox !== undefined && tool.requiresSandbox !== options.requiresSandbox) {
          return false;
        }

        if (options.cacheable !== undefined && tool.cacheable !== options.cacheable) {
          return false;
        }

        return true;
      })
      .map((registration) => registration.tool);
  }

  /**
   * Search for tools by query string
   * 
   * Searches in tool names, descriptions, documentation, and tags.
   * 
   * @param query - Search query
   * @returns Search results
   * 
   * @example
   * ```typescript
   * const results = registry.searchTools('file read');
   * ```
   */
  public searchTools(query: string): ToolSearchResult {
    const lowerQuery = query.toLowerCase();
    const searchTerms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);

    const matchingTools = this.getAllTools().filter((tool) => {
      const searchableText = [
        tool.name,
        tool.description,
        tool.documentation,
        ...tool.tags,
      ]
        .join(' ')
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });

    return {
      tools: matchingTools,
      total: matchingTools.length,
      query,
    };
  }

  // ============================================================================
  // Category Methods
  // ============================================================================

  /**
   * Get all available categories
   * 
   * @returns Array of categories that have tools
   * 
   * @example
   * ```typescript
   * const categories = registry.getCategories();
   * // [ToolCategory.FILE, ToolCategory.SEARCH, ...]
   * ```
   */
  public getCategories(): ToolCategory[] {
    const categories = new Set<ToolCategory>();
    for (const registration of this.tools.values()) {
      categories.add(registration.tool.category);
    }
    return Array.from(categories);
  }

  /**
   * Get tools organized by category
   * 
   * @returns Map of category to tools
   * 
   * @example
   * ```typescript
   * const byCategory = registry.getToolsByCategoryMap();
   * const fileTools = byCategory.get(ToolCategory.FILE);
   * ```
   */
  public getToolsByCategoryMap(): Map<ToolCategory, Tool[]> {
    const map = new Map<ToolCategory, Tool[]>();

    for (const registration of this.tools.values()) {
      const category = registration.tool.category;
      const tools = map.get(category) || [];
      tools.push(registration.tool);
      map.set(category, tools);
    }

    return map;
  }

  // ============================================================================
  // Permission Methods
  // ============================================================================

  /**
   * Get all permission levels used by registered tools
   * 
   * @returns Array of permission levels
   * 
   * @example
   * ```typescript
   * const levels = registry.getPermissionLevels();
   * // [PermissionLevel.AUTO_APPROVE, PermissionLevel.ASK, ...]
   * ```
   */
  public getPermissionLevels(): PermissionLevel[] {
    const levels = new Set<PermissionLevel>();
    for (const registration of this.tools.values()) {
      levels.add(registration.tool.permissionLevel);
    }
    return Array.from(levels);
  }

  /**
   * Get tools that require user approval
   * 
   * @returns Array of tools with ASK permission level
   * 
   * @example
   * ```typescript
   * const askTools = registry.getToolsRequiringApproval();
   * ```
   */
  public getToolsRequiringApproval(): Tool[] {
    return this.getToolsByPermission(PermissionLevel.ASK);
  }

  /**
   * Get tools that are auto-approved
   * 
   * @returns Array of tools with AUTO_APPROVE permission level
   * 
   * @example
   * ```typescript
   * const autoTools = registry.getAutoApprovedTools();
   * ```
   */
  public getAutoApprovedTools(): Tool[] {
    return this.getToolsByPermission(PermissionLevel.AUTO_APPROVE);
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * Get execution statistics for all tools
   * 
   * @returns Tool statistics
   * 
   * @example
   * ```typescript
   * const stats = registry.getStatistics();
   * console.log(`Total tools: ${stats.totalTools}`);
   * console.log(`Total executions: ${stats.totalExecutions}`);
   * ```
   */
  public getStatistics(): ToolStatistics {
    const toolsByCategory: Record<string, number> = {};
    const toolsByPermission: Record<string, number> = {};
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;

    for (const registration of this.tools.values()) {
      const tool = registration.tool;

      // Count by category
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;

      // Count by permission
      toolsByPermission[tool.permissionLevel] = (toolsByPermission[tool.permissionLevel] || 0) + 1;

      // Count executions
      const stats = this.executionStats.get(tool.name);
      if (stats) {
        totalExecutions += stats.success + stats.failure;
        successfulExecutions += stats.success;
        failedExecutions += stats.failure;
      }
    }

    // Get most used tools
    const mostUsedTools = Array.from(this.executionStats.entries())
      .map(([name, stats]) => ({ name, count: stats.success + stats.failure }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTools: this.tools.size,
      toolsByCategory: toolsByCategory as Record<ToolCategory, number>,
      toolsByPermission: toolsByPermission as Record<PermissionLevel, number>,
      mostUsedTools,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
    };
  }

  /**
   * Get execution statistics for a specific tool
   * 
   * @param name - Tool name
   * @returns Execution statistics or undefined if tool not found
   * 
   * @example
   * ```typescript
   * const stats = registry.getToolStatistics('file_read');
   * if (stats) {
   *   console.log(`Success: ${stats.success}, Failure: ${stats.failure}`);
   * }
   * ```
   */
  public getToolStatistics(name: string): { success: number; failure: number } | undefined {
    return this.executionStats.get(name.toLowerCase());
  }

  /**
   * Reset execution statistics
   * 
   * @param name - Optional tool name to reset (resets all if not specified)
   * 
   * @example
   * ```typescript
   * registry.resetStatistics(); // Reset all
   * registry.resetStatistics('file_read'); // Reset specific tool
   * ```
   */
  public resetStatistics(name?: string): void {
    if (name) {
      const lowerName = name.toLowerCase();
      if (this.executionStats.has(lowerName)) {
        this.executionStats.set(lowerName, { success: 0, failure: 0 });
      }
    } else {
      for (const key of this.executionStats.keys()) {
        this.executionStats.set(key, { success: 0, failure: 0 });
      }
    }
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Initialize the registry
   * 
   * This method should be called before using the registry.
   * It sets up the registry and emits the initialized event.
   * 
   * @example
   * ```typescript
   * await registry.initialize();
   * ```
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.emit('registry:initialized');
  }

  /**
   * Dispose of the registry
   * 
   * This method cleans up resources and unregisters all tools.
   * 
   * @example
   * ```typescript
   * await registry.dispose();
   * ```
   */
  public async dispose(): Promise<void> {
    this.unregisterAll();
    this.removeAllListeners();
    this.initialized = false;
    this.emit('registry:disposed');
  }

  /**
   * Check if the registry is initialized
   * 
   * @returns True if initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Update global configuration
   * 
   * @param config - New configuration (partial)
   * 
   * @example
   * ```typescript
   * registry.updateConfig({ defaultTimeout: 60000 });
   * ```
   */
  public updateConfig(config: Partial<ToolConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    this.emit('registry:configUpdated', this.globalConfig);
  }

  /**
   * Get global configuration
   * 
   * @returns Current global configuration
   * 
   * @example
   * ```typescript
   * const config = registry.getConfig();
   * ```
   */
  public getConfig(): ToolConfig {
    return { ...this.globalConfig };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up event listeners for a tool
   * @param tool - Tool to set up listeners for
   */
  private setupToolEventListeners(tool: Tool): void {
    tool.on('execution:complete', (event: { executionId: string; result: ToolResult }) => {
      const stats = this.executionStats.get(tool.name);
      if (stats) {
        if (event.result.success) {
          stats.success++;
        } else {
          stats.failure++;
        }
      }
      this.emit('tool:executionComplete', { tool: tool.name, ...event });
    });

    tool.on('execution:error', (event: { executionId: string; error: unknown }) => {
      this.emit('tool:executionError', { tool: tool.name, ...event });
    });

    tool.on('permission:requested', (event: { executionId: string; reason: string }) => {
      this.emit('tool:permissionRequested', { tool: tool.name, ...event });
    });
  }
}

// ============================================================================
// Global Registry Instance
// ============================================================================

/** Global tool registry instance */
let globalRegistry: ToolRegistry | null = null;

/**
 * Get or create the global tool registry
 * @param config - Optional configuration for new registry
 * @returns Global tool registry
 * 
 * @example
 * ```typescript
 * const registry = getGlobalRegistry();
 * ```
 */
export function getGlobalRegistry(config?: ToolConfig): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry(config);
  }
  return globalRegistry;
}

/**
 * Set the global tool registry
 * @param registry - Registry to set as global
 * 
 * @example
 * ```typescript
 * setGlobalRegistry(new ToolRegistry());
 * ```
 */
export function setGlobalRegistry(registry: ToolRegistry): void {
  globalRegistry = registry;
}

/**
 * Reset the global tool registry
 * 
 * @example
 * ```typescript
 * resetGlobalRegistry();
 * ```
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a tool registry with common tools pre-registered
 * @param config - Optional configuration
 * @returns Pre-configured tool registry
 * 
 * @example
 * ```typescript
 * const registry = createDefaultRegistry();
 * ```
 */
export function createDefaultRegistry(config?: ToolConfig): ToolRegistry {
  const registry = new ToolRegistry(config);
  // Common tools would be registered here
  return registry;
}

/**
 * Group tools by a property
 * @param tools - Tools to group
 * @param key - Property to group by
 * @returns Grouped tools
 * 
 * @example
 * ```typescript
 * const byCategory = groupTools(tools, 'category');
 * ```
 */
export function groupTools<K extends keyof Tool>(
  tools: Tool[],
  key: K
): Map<Tool[K], Tool[]> {
  const map = new Map<Tool[K], Tool[]>();

  for (const tool of tools) {
    const value = tool[key];
    const group = map.get(value) || [];
    group.push(tool);
    map.set(value, group);
  }

  return map;
}

/**
 * Sort tools by name
 * @param tools - Tools to sort
 * @returns Sorted tools
 * 
 * @example
 * ```typescript
 * const sorted = sortToolsByName(tools);
 * ```
 */
export function sortToolsByName(tools: Tool[]): Tool[] {
  return [...tools].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort tools by category then name
 * @param tools - Tools to sort
 * @returns Sorted tools
 * 
 * @example
 * ```typescript
 * const sorted = sortToolsByCategoryAndName(tools);
 * ```
 */
export function sortToolsByCategoryAndName(tools: Tool[]): Tool[] {
  return [...tools].sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }
    return a.name.localeCompare(b.name);
  });
}

export default ToolRegistry;
