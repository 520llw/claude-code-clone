/**
 * HookRegistry.ts
 * 
 * Hook Registry for Claude Code Clone Plugin System
 * 
 * This file implements the HookRegistry class which is responsible for:
 * - Hook registration and deregistration
 * - Hook metadata storage
 * - Hook discovery and lookup
 * - Hook categorization
 * - Hook dependency tracking
 * - Hook schema management
 * 
 * The HookRegistry maintains a catalog of all available hooks and provides
 * APIs for querying and managing hook definitions.
 * 
 * @module HookSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  HookDefinition,
  HookCategory,
  HookExecutionOrder,
  HookSchema,
  RegisteredHook,
  HookHandlerInfo,
  HookStatistics,
  HookName
} from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Hook registry options
 */
export interface HookRegistryOptions {
  /** Enable strict mode (validate all hooks) */
  strict?: boolean;
  /** Allow dynamic hook registration */
  allowDynamicRegistration?: boolean;
  /** Maximum number of hooks */
  maxHooks?: number;
  /** Maximum handlers per hook */
  maxHandlersPerHook?: number;
  /** Enable hook caching */
  enableCache?: boolean;
}

/**
 * Hook filter options
 */
export interface HookFilterOptions {
  /** Filter by category */
  category?: HookCategory;
  /** Filter by categories */
  categories?: HookCategory[];
  /** Filter by cancellable */
  cancellable?: boolean;
  /** Filter by execution order */
  executionOrder?: HookExecutionOrder;
  /** Search query */
  query?: string;
}

/**
 * Hook search result
 */
export interface HookSearchResult {
  hooks: HookDefinition[];
  total: number;
}

// ============================================================================
// Built-in Hook Definitions
// ============================================================================

/**
 * Built-in hook definitions
 */
const BUILTIN_HOOKS: HookDefinition[] = [
  {
    name: 'onInit',
    description: 'Called when the application is initializing',
    category: HookCategory.LIFECYCLE,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 30000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onInit", async (context) => { /* initialize plugin */ })'
    ],
    relatedHooks: ['onExit']
  },
  {
    name: 'onMessage',
    description: 'Called when a new message is received',
    category: HookCategory.MESSAGE,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 5000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onMessage", async (context) => { /* process message */ })'
    ],
    relatedHooks: ['onResponse', 'onToolCall']
  },
  {
    name: 'onToolCall',
    description: 'Called when a tool is about to be called',
    category: HookCategory.TOOL,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 5000,
    allowModification: true,
    stopOnError: true,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onToolCall", async (context) => { /* validate tool call */ })'
    ],
    relatedHooks: ['onToolResult', 'onPermissionRequest']
  },
  {
    name: 'onToolResult',
    description: 'Called when a tool execution is completed',
    category: HookCategory.TOOL,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 5000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onToolResult", async (context) => { /* process result */ })'
    ],
    relatedHooks: ['onToolCall', 'onResponse']
  },
  {
    name: 'onResponse',
    description: 'Called when a response is generated',
    category: HookCategory.MESSAGE,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 5000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onResponse", async (context) => { /* process response */ })'
    ],
    relatedHooks: ['onMessage', 'onStreamToken']
  },
  {
    name: 'onError',
    description: 'Called when an error occurs',
    category: HookCategory.SYSTEM,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 10000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onError", async (context) => { /* handle error */ })'
    ],
    relatedHooks: []
  },
  {
    name: 'onSessionStart',
    description: 'Called when a new session is started',
    category: HookCategory.SESSION,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 10000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onSessionStart", async (context) => { /* initialize session */ })'
    ],
    relatedHooks: ['onSessionEnd']
  },
  {
    name: 'onSessionEnd',
    description: 'Called when a session is ended',
    category: HookCategory.SESSION,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 10000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onSessionEnd", async (context) => { /* cleanup session */ })'
    ],
    relatedHooks: ['onSessionStart']
  },
  {
    name: 'onFileChange',
    description: 'Called when a file is changed',
    category: HookCategory.FILE,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 5000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onFileChange", async (context) => { /* handle file change */ })'
    ],
    relatedHooks: []
  },
  {
    name: 'onCommand',
    description: 'Called when a command is executed',
    category: HookCategory.COMMAND,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 30000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onCommand", async (context) => { /* handle command */ })'
    ],
    relatedHooks: ['onPermissionRequest']
  },
  {
    name: 'onContextCompact',
    description: 'Called when context is being compressed',
    category: HookCategory.CONTEXT,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: false,
    defaultTimeout: 10000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onContextCompact", async (context) => { /* handle compaction */ })'
    ],
    relatedHooks: []
  },
  {
    name: 'onPermissionRequest',
    description: 'Called when a permission is requested',
    category: HookCategory.PERMISSION,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 60000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: true,
    examples: [
      'plugin.registerHook("onPermissionRequest", async (context) => { /* handle permission */ })'
    ],
    relatedHooks: ['onToolCall', 'onCommand']
  },
  {
    name: 'onLLMCall',
    description: 'Called when an LLM API call is made',
    category: HookCategory.LLM,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 30000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onLLMCall", async (context) => { /* monitor LLM call */ })'
    ],
    relatedHooks: ['onStreamToken', 'onResponse']
  },
  {
    name: 'onStreamToken',
    description: 'Called when a stream token is received',
    category: HookCategory.LLM,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 1000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onStreamToken", async (context) => { /* process token */ })'
    ],
    relatedHooks: ['onLLMCall', 'onResponse']
  },
  {
    name: 'onExit',
    description: 'Called when the application is exiting',
    category: HookCategory.LIFECYCLE,
    executionOrder: HookExecutionOrder.SEQUENTIAL,
    cancellable: true,
    defaultTimeout: 30000,
    allowModification: true,
    stopOnError: false,
    stopOnSuccess: false,
    examples: [
      'plugin.registerHook("onExit", async (context) => { /* cleanup */ })'
    ],
    relatedHooks: ['onInit']
  }
];

// ============================================================================
// Hook Registry Class
// ============================================================================

/**
 * HookRegistry - Central registry for hook definitions.
 * 
 * The HookRegistry maintains a catalog of all available hooks and provides
 * APIs for registration, discovery, and management of hook definitions.
 * 
 * @example
 * ```typescript
 * const registry = new HookRegistry();
 * 
 * // Register a custom hook
 * registry.register({
 *   name: 'onCustomEvent',
 *   description: 'Called when a custom event occurs',
 *   category: HookCategory.SYSTEM,
 *   executionOrder: HookExecutionOrder.SEQUENTIAL,
 *   cancellable: false,
 *   defaultTimeout: 5000,
 *   allowModification: true,
 *   stopOnError: false,
 *   stopOnSuccess: false
 * });
 * 
 * // Get hook definition
 * const definition = registry.get('onMessage');
 * 
 * // Search hooks
 * const results = registry.search({ category: HookCategory.MESSAGE });
 * ```
 */
export class HookRegistry extends EventEmitter {
  /**
   * Registered hooks map
   */
  private hooks: Map<string, RegisteredHook> = new Map();

  /**
   * Hooks by category
   */
  private hooksByCategory: Map<HookCategory, Set<string>> = new Map();

  /**
   * Registry options
   */
  private options: HookRegistryOptions;

  /**
   * Whether the registry is initialized
   */
  private initialized: boolean = false;

  /**
   * Creates a new HookRegistry instance.
   * 
   * @param options - Registry options
   */
  constructor(options: HookRegistryOptions = {}) {
    super();
    this.setMaxListeners(100);

    this.options = {
      strict: false,
      allowDynamicRegistration: true,
      maxHooks: 1000,
      maxHandlersPerHook: 100,
      enableCache: true,
      ...options
    };
  }

  /**
   * Initializes the registry.
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register built-in hooks
    for (const hook of BUILTIN_HOOKS) {
      this.register(hook);
    }

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Disposes the registry.
   */
  public dispose(): void {
    this.hooks.clear();
    this.hooksByCategory.clear();
    this.removeAllListeners();
    this.initialized = false;
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Registers a hook definition.
   * 
   * @param definition - Hook definition
   * @returns The registered hook
   * @throws Error if registration fails
   */
  public register(definition: HookDefinition): RegisteredHook {
    // Check if dynamic registration is allowed
    if (!this.options.allowDynamicRegistration && this.initialized) {
      throw new Error('Dynamic hook registration is not allowed');
    }

    // Check maximum hooks limit
    if (this.hooks.size >= (this.options.maxHooks || 1000)) {
      throw new Error('Maximum number of hooks reached');
    }

    // Validate definition
    this.validateDefinition(definition);

    // Check if hook already exists
    if (this.hooks.has(definition.name)) {
      throw new Error(`Hook ${definition.name} is already registered`);
    }

    // Create registered hook
    const registeredHook: RegisteredHook = {
      definition,
      handlers: [],
      registeredAt: new Date(),
      totalExecutions: 0,
      totalErrors: 0,
      averageExecutionTime: 0
    };

    // Store hook
    this.hooks.set(definition.name, registeredHook);

    // Index by category
    if (!this.hooksByCategory.has(definition.category)) {
      this.hooksByCategory.set(definition.category, new Set());
    }
    this.hooksByCategory.get(definition.category)!.add(definition.name);

    this.emit('hookRegistered', { hookName: definition.name, definition });

    return registeredHook;
  }

  /**
   * Unregisters a hook.
   * 
   * @param hookName - Hook name
   * @returns True if the hook was unregistered
   */
  public unregister(hookName: string): boolean {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return false;
    }

    // Remove from category index
    this.hooksByCategory.get(hook.definition.category)?.delete(hookName);

    // Remove hook
    this.hooks.delete(hookName);

    this.emit('hookUnregistered', { hookName });

    return true;
  }

  /**
   * Updates a hook definition.
   * 
   * @param hookName - Hook name
   * @param updates - Updates to apply
   * @returns The updated hook
   */
  public update(
    hookName: string,
    updates: Partial<Omit<HookDefinition, 'name'>>
  ): RegisteredHook {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      throw new Error(`Hook ${hookName} not found`);
    }

    // Handle category change
    if (updates.category && updates.category !== hook.definition.category) {
      this.hooksByCategory.get(hook.definition.category)?.delete(hookName);
      
      if (!this.hooksByCategory.has(updates.category)) {
        this.hooksByCategory.set(updates.category, new Set());
      }
      this.hooksByCategory.get(updates.category)!.add(hookName);
    }

    // Update definition
    Object.assign(hook.definition, updates);

    this.emit('hookUpdated', { hookName, definition: hook.definition });

    return hook;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Gets a hook definition.
   * 
   * @param hookName - Hook name
   * @returns Hook definition or undefined
   */
  public get(hookName: string): HookDefinition | undefined {
    return this.hooks.get(hookName)?.definition;
  }

  /**
   * Gets a registered hook.
   * 
   * @param hookName - Hook name
   * @returns Registered hook or undefined
   */
  public getRegistered(hookName: string): RegisteredHook | undefined {
    return this.hooks.get(hookName);
  }

  /**
   * Gets all hook definitions.
   * 
   * @returns Array of all hook definitions
   */
  public getAll(): HookDefinition[] {
    return Array.from(this.hooks.values()).map(h => h.definition);
  }

  /**
   * Gets all registered hooks.
   * 
   * @returns Array of all registered hooks
   */
  public getAllRegistered(): RegisteredHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Checks if a hook is registered.
   * 
   * @param hookName - Hook name
   * @returns True if the hook is registered
   */
  public has(hookName: string): boolean {
    return this.hooks.has(hookName);
  }

  /**
   * Gets hooks by category.
   * 
   * @param category - Hook category
   * @returns Array of hooks in the category
   */
  public getByCategory(category: HookCategory): HookDefinition[] {
    const hookNames = this.hooksByCategory.get(category);
    if (!hookNames) {
      return [];
    }

    return Array.from(hookNames)
      .map(name => this.hooks.get(name)?.definition)
      .filter((h): h is HookDefinition => h !== undefined);
  }

  /**
   * Gets all hook categories.
   * 
   * @returns Array of categories with hook counts
   */
  public getCategories(): Array<{ category: HookCategory; count: number }> {
    const result: Array<{ category: HookCategory; count: number }> = [];

    for (const [category, hooks] of this.hooksByCategory) {
      result.push({ category, count: hooks.size });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * Searches for hooks.
   * 
   * @param options - Filter options
   * @returns Search results
   */
  public search(options: HookFilterOptions = {}): HookSearchResult {
    let results = Array.from(this.hooks.values()).map(h => h.definition);

    // Filter by category
    if (options.category) {
      results = results.filter(h => h.category === options.category);
    }

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      results = results.filter(h => options.categories!.includes(h.category));
    }

    // Filter by cancellable
    if (options.cancellable !== undefined) {
      results = results.filter(h => h.cancellable === options.cancellable);
    }

    // Filter by execution order
    if (options.executionOrder) {
      results = results.filter(h => h.executionOrder === options.executionOrder);
    }

    // Filter by query
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(h =>
        h.name.toLowerCase().includes(query) ||
        h.description.toLowerCase().includes(query)
      );
    }

    return {
      hooks: results,
      total: results.length
    };
  }

  /**
   * Finds hooks by name pattern.
   * 
   * @param pattern - Name pattern (supports wildcards)
   * @returns Array of matching hooks
   */
  public findByPattern(pattern: string): HookDefinition[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    
    return Array.from(this.hooks.values())
      .map(h => h.definition)
      .filter(h => regex.test(h.name));
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * Gets registry statistics.
   * 
   * @returns Registry statistics
   */
  public getStatistics(): HookStatistics {
    const hooks = Array.from(this.hooks.values());
    
    const totalExecutions = hooks.reduce((sum, h) => sum + h.totalExecutions, 0);
    const totalErrors = hooks.reduce((sum, h) => sum + h.totalErrors, 0);
    const totalHandlers = hooks.reduce((sum, h) => sum + h.handlers.length, 0);
    
    // Calculate average execution time
    const avgExecutionTime = totalExecutions > 0
      ? hooks.reduce((sum, h) => sum + (h.averageExecutionTime * h.totalExecutions), 0) / totalExecutions
      : 0;

    // Most used hooks
    const mostUsedHooks = hooks
      .filter(h => h.totalExecutions > 0)
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, 5)
      .map(h => ({ name: h.definition.name, executions: h.totalExecutions }));

    // Slowest hooks
    const slowestHooks = hooks
      .filter(h => h.averageExecutionTime > 0)
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
      .slice(0, 5)
      .map(h => ({ name: h.definition.name, avgTime: h.averageExecutionTime }));

    // Error rates
    const errorRates: Record<string, number> = {};
    for (const hook of hooks) {
      if (hook.totalExecutions > 0) {
        errorRates[hook.definition.name] = hook.totalErrors / hook.totalExecutions;
      }
    }

    return {
      totalHooks: hooks.length,
      totalHandlers,
      totalExecutions,
      totalErrors,
      averageExecutionTime: avgExecutionTime,
      mostUsedHooks,
      slowestHooks,
      errorRates
    };
  }

  /**
   * Updates hook statistics after execution.
   * 
   * @param hookName - Hook name
   * @param duration - Execution duration
   * @param error - Whether an error occurred
   */
  public updateStatistics(hookName: string, duration: number, error: boolean): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    hook.totalExecutions++;
    if (error) {
      hook.totalErrors++;
    }

    // Update average execution time using moving average
    const alpha = 0.1; // Smoothing factor
    hook.averageExecutionTime = 
      hook.averageExecutionTime * (1 - alpha) + duration * alpha;
  }

  // ============================================================================
  // Handler Management
  // ============================================================================

  /**
   * Gets handlers for a hook.
   * 
   * @param hookName - Hook name
   * @returns Array of handlers
   */
  public getHandlers(hookName: string): HookHandlerInfo[] {
    return this.hooks.get(hookName)?.handlers || [];
  }

  /**
   * Adds a handler to a hook.
   * 
   * @param hookName - Hook name
   * @param handler - Handler info
   * @throws Error if hook doesn't exist or max handlers reached
   */
  public addHandler(hookName: string, handler: HookHandlerInfo): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      throw new Error(`Hook ${hookName} not found`);
    }

    if (hook.handlers.length >= (this.options.maxHandlersPerHook || 100)) {
      throw new Error(`Maximum handlers reached for hook ${hookName}`);
    }

    hook.handlers.push(handler);

    // Sort handlers by priority (higher first)
    hook.handlers.sort((a, b) => b.priority - a.priority);

    this.emit('handlerAdded', { hookName, handlerId: handler.handlerId });
  }

  /**
   * Removes a handler from a hook.
   * 
   * @param hookName - Hook name
   * @param handlerId - Handler ID
   * @returns True if the handler was removed
   */
  public removeHandler(hookName: string, handlerId: string): boolean {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return false;
    }

    const index = hook.handlers.findIndex(h => h.handlerId === handlerId);
    if (index === -1) {
      return false;
    }

    hook.handlers.splice(index, 1);

    this.emit('handlerRemoved', { hookName, handlerId });

    return true;
  }

  /**
   * Removes all handlers for a plugin.
   * 
   * @param pluginId - Plugin ID
   * @returns Number of handlers removed
   */
  public removePluginHandlers(pluginId: string): number {
    let removedCount = 0;

    for (const hook of this.hooks.values()) {
      const initialLength = hook.handlers.length;
      hook.handlers = hook.handlers.filter(h => h.pluginId !== pluginId);
      removedCount += initialLength - hook.handlers.length;
    }

    if (removedCount > 0) {
      this.emit('pluginHandlersRemoved', { pluginId, count: removedCount });
    }

    return removedCount;
  }

  /**
   * Gets the count of handlers for a hook.
   * 
   * @param hookName - Hook name
   * @returns Number of handlers
   */
  public getHandlerCount(hookName: string): number {
    return this.hooks.get(hookName)?.handlers.length || 0;
  }

  /**
   * Gets the total count of all handlers.
   * 
   * @returns Total number of handlers
   */
  public getTotalHandlerCount(): number {
    return Array.from(this.hooks.values())
      .reduce((sum, h) => sum + h.handlers.length, 0);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validates a hook definition.
   * 
   * @param definition - Definition to validate
   * @throws Error if validation fails
   */
  private validateDefinition(definition: HookDefinition): void {
    if (!definition.name) {
      throw new Error('Hook name is required');
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.name)) {
      throw new Error(`Invalid hook name: ${definition.name}`);
    }

    if (!definition.description) {
      throw new Error('Hook description is required');
    }

    if (!Object.values(HookCategory).includes(definition.category)) {
      throw new Error(`Invalid hook category: ${definition.category}`);
    }

    if (definition.defaultTimeout <= 0) {
      throw new Error('Hook defaultTimeout must be positive');
    }
  }
}

export default HookRegistry;
