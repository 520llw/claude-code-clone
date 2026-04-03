/**
 * Hook Registry
 * 
 * Central registry for managing hook definitions, dependencies,
 * and lifecycle management.
 */

import { EventEmitter } from 'events';
import {
  HookId,
  HookDefinition,
  AnyHookDefinition,
  HookRegistration,
  HookRegistrationOptions,
  HookRegistrationResult,
  HookLifecycleState,
  HookMetadata,
  HookPriority,
  HookExecutionStats,
  HookCondition,
  HookEventType,
  PreCommandHook,
  PostCommandHook,
  PreToolHook,
  PostToolHook,
  ErrorHook,
  ResponseHook,
  BuiltInHookType,
  HookContext
} from './types';

/**
 * Dependency graph for hook resolution
 */
interface DependencyGraph {
  /** Maps hook ID to its dependencies */
  dependencies: Map<HookId, HookId[]>;
  /** Maps hook ID to hooks that depend on it */
  dependents: Map<HookId, HookId[]>;
}

/**
 * Hook Registry class
 * 
 * Manages hook registration, dependencies, and lifecycle.
 * Provides a centralized store for all hook definitions.
 */
export class HookRegistry extends EventEmitter {
  /** Map of registered hooks */
  private hooks: Map<HookId, HookRegistration> = new Map();
  
  /** Dependency graph for hooks */
  private dependencyGraph: DependencyGraph = {
    dependencies: new Map(),
    dependents: new Map()
  };
  
  /** Tag index for quick lookup */
  private tagIndex: Map<string, Set<HookId>> = new Map();
  
  /** Author index for quick lookup */
  private authorIndex: Map<string, Set<HookId>> = new Map();
  
  /** Type index for quick lookup */
  private typeIndex: Map<string, Set<HookId>> = new Map();
  
  /** Maximum hooks allowed */
  private maxHooks: number = 1000;
  
  /** Registry version */
  private version: string = '1.0.0';

  /**
   * Create a new HookRegistry instance
   */
  constructor(maxHooks: number = 1000) {
    super();
    this.maxHooks = maxHooks;
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a hook
   */
  register<TContext extends HookContext>(
    hook: HookDefinition<TContext>,
    options: HookRegistrationOptions = {}
  ): HookRegistrationResult {
    // Validate hook
    const validationError = this.validateHook(hook);
    if (validationError) {
      return {
        success: false,
        error: validationError
      };
    }

    // Check registry capacity
    if (this.hooks.size >= this.maxHooks && !this.hooks.has(hook.id)) {
      return {
        success: false,
        error: `Registry capacity exceeded. Maximum ${this.maxHooks} hooks allowed.`
      };
    }

    // Check for existing hook
    const existing = this.hooks.get(hook.id);
    if (existing && !options.override) {
      return {
        success: false,
        error: `Hook with ID '${hook.id}' already registered. Use override option to replace.`
      };
    }

    // Resolve dependencies
    const dependencyError = this.resolveDependencies(hook);
    if (dependencyError) {
      return {
        success: false,
        error: dependencyError
      };
    }

    // Create metadata if not provided
    const meta: HookMetadata = hook.meta || {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: [],
      dependencies: [],
      dependents: []
    };

    // Create registration
    const registration: HookRegistration = {
      hook: hook as AnyHookDefinition,
      registeredAt: new Date(),
      options,
      state: HookLifecycleState.REGISTERED,
      stats: this.createEmptyStats()
    };

    // Store previous hook for result
    const previousHook = existing?.hook;

    // Add to registry
    this.hooks.set(hook.id, registration);

    // Update indexes
    this.updateIndexes(hook as AnyHookDefinition, 'add');

    // Update dependency graph
    this.updateDependencyGraph(hook as AnyHookDefinition);

    // Update state
    registration.state = HookLifecycleState.ENABLED;

    // Emit event
    this.emit(HookEventType.REGISTERED, {
      hookId: hook.id,
      hookName: hook.name,
      type: hook.type,
      overridden: !!previousHook
    });

    return {
      success: true,
      hookId: hook.id,
      previousHook
    };
  }

  /**
   * Register multiple hooks at once
   */
  registerBatch(
    hooks: AnyHookDefinition[],
    options: HookRegistrationOptions = {}
  ): HookRegistrationResult[] {
    const results: HookRegistrationResult[] = [];
    
    // Sort hooks by dependencies to ensure proper order
    const sortedHooks = this.topologicalSort(hooks);
    
    for (const hook of sortedHooks) {
      const result = this.register(hook, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    const hook = registration.hook;

    // Check if other hooks depend on this one
    const dependents = this.dependencyGraph.dependents.get(hookId);
    if (dependents && dependents.length > 0) {
      // Remove this hook from dependents' dependency lists
      for (const dependentId of dependents) {
        const dependent = this.hooks.get(dependentId);
        if (dependent) {
          dependent.hook.meta.dependencies = dependent.hook.meta.dependencies.filter(
            id => id !== hookId
          );
        }
      }
    }

    // Update indexes
    this.updateIndexes(hook, 'remove');

    // Update dependency graph
    this.dependencyGraph.dependencies.delete(hookId);
    this.dependencyGraph.dependents.delete(hookId);

    // Remove from registry
    this.hooks.delete(hookId);

    // Emit event
    this.emit(HookEventType.UNREGISTERED, {
      hookId,
      hookName: hook.name
    });

    return true;
  }

  /**
   * Unregister multiple hooks
   */
  unregisterBatch(hookIds: HookId[]): number {
    let count = 0;
    for (const hookId of hookIds) {
      if (this.unregister(hookId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Unregister all hooks
   */
  unregisterAll(): number {
    const hookIds = Array.from(this.hooks.keys());
    return this.unregisterBatch(hookIds);
  }

  // ============================================================================
  // Hook State Management
  // ============================================================================

  /**
   * Enable a hook
   */
  enable(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    if (registration.state === HookLifecycleState.ENABLED) {
      return true; // Already enabled
    }

    registration.state = HookLifecycleState.ENABLED;
    registration.hook.enabled = true;

    this.emit(HookEventType.ENABLED, { hookId });
    return true;
  }

  /**
   * Disable a hook
   */
  disable(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    if (registration.state === HookLifecycleState.DISABLED) {
      return true; // Already disabled
    }

    registration.state = HookLifecycleState.DISABLED;
    registration.hook.enabled = false;

    this.emit(HookEventType.DISABLED, { hookId });
    return true;
  }

  /**
   * Toggle hook state
   */
  toggle(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    if (registration.state === HookLifecycleState.ENABLED) {
      return this.disable(hookId);
    } else {
      return this.enable(hookId);
    }
  }

  /**
   * Set hook state
   */
  setState(hookId: HookId, state: HookLifecycleState): boolean {
    switch (state) {
      case HookLifecycleState.ENABLED:
        return this.enable(hookId);
      case HookLifecycleState.DISABLED:
        return this.disable(hookId);
      default:
        return false;
    }
  }

  // ============================================================================
  // Hook Retrieval
  // ============================================================================

  /**
   * Get a hook by ID
   */
  get(hookId: HookId): AnyHookDefinition | undefined {
    return this.hooks.get(hookId)?.hook;
  }

  /**
   * Get hook registration
   */
  getRegistration(hookId: HookId): HookRegistration | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Get all hooks
   */
  getAll(): AnyHookDefinition[] {
    return Array.from(this.hooks.values())
      .map(reg => reg.hook);
  }

  /**
   * Get all enabled hooks
   */
  getEnabled(): AnyHookDefinition[] {
    return Array.from(this.hooks.values())
      .filter(reg => reg.state === HookLifecycleState.ENABLED)
      .map(reg => reg.hook);
  }

  /**
   * Get hooks by type
   */
  getByType(type: string): AnyHookDefinition[] {
    const hookIds = this.typeIndex.get(type);
    if (!hookIds) return [];
    
    return Array.from(hookIds)
      .map(id => this.hooks.get(id)?.hook)
      .filter((hook): hook is AnyHookDefinition => hook !== undefined);
  }

  /**
   * Get hooks by tag
   */
  getByTag(tag: string): AnyHookDefinition[] {
    const hookIds = this.tagIndex.get(tag);
    if (!hookIds) return [];
    
    return Array.from(hookIds)
      .map(id => this.hooks.get(id)?.hook)
      .filter((hook): hook is AnyHookDefinition => hook !== undefined);
  }

  /**
   * Get hooks by author
   */
  getByAuthor(author: string): AnyHookDefinition[] {
    const hookIds = this.authorIndex.get(author);
    if (!hookIds) return [];
    
    return Array.from(hookIds)
      .map(id => this.hooks.get(id)?.hook)
      .filter((hook): hook is AnyHookDefinition => hook !== undefined);
  }

  /**
   * Get hooks by priority range
   */
  getByPriorityRange(min: number, max: number): AnyHookDefinition[] {
    return Array.from(this.hooks.values())
      .filter(reg => {
        const priority = reg.hook.priority as number;
        return priority >= min && priority <= max;
      })
      .map(reg => reg.hook);
  }

  /**
   * Find hooks matching a predicate
   */
  find(predicate: (hook: AnyHookDefinition) => boolean): AnyHookDefinition[] {
    return Array.from(this.hooks.values())
      .map(reg => reg.hook)
      .filter(predicate);
  }

  /**
   * Find a single hook matching a predicate
   */
  findOne(predicate: (hook: AnyHookDefinition) => boolean): AnyHookDefinition | undefined {
    for (const registration of this.hooks.values()) {
      if (predicate(registration.hook)) {
        return registration.hook;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Hook Statistics
  // ============================================================================

  /**
   * Get hook statistics
   */
  getStats(hookId: HookId): HookExecutionStats | undefined {
    return this.hooks.get(hookId)?.stats;
  }

  /**
   * Get all statistics
   */
  getAllStats(): Map<HookId, HookExecutionStats> {
    const stats = new Map<HookId, HookExecutionStats>();
    for (const [hookId, registration] of this.hooks) {
      stats.set(hookId, { ...registration.stats });
    }
    return stats;
  }

  /**
   * Reset hook statistics
   */
  resetStats(hookId: HookId): boolean {
    const registration = this.hooks.get(hookId);
    if (!registration) {
      return false;
    }

    registration.stats = this.createEmptyStats();
    return true;
  }

  /**
   * Reset all statistics
   */
  resetAllStats(): void {
    for (const registration of this.hooks.values()) {
      registration.stats = this.createEmptyStats();
    }
  }

  // ============================================================================
  // Dependency Management
  // ============================================================================

  /**
   * Get hook dependencies
   */
  getDependencies(hookId: HookId): HookId[] {
    return this.dependencyGraph.dependencies.get(hookId) || [];
  }

  /**
   * Get hooks that depend on a hook
   */
  getDependents(hookId: HookId): HookId[] {
    return this.dependencyGraph.dependents.get(hookId) || [];
  }

  /**
   * Check if a hook has circular dependencies
   */
  hasCircularDependency(hookId: HookId, visited: Set<HookId> = new Set()): boolean {
    if (visited.has(hookId)) {
      return true;
    }

    visited.add(hookId);
    const dependencies = this.dependencyGraph.dependencies.get(hookId) || [];
    
    for (const depId of dependencies) {
      if (this.hasCircularDependency(depId, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get execution order for hooks
   */
  getExecutionOrder(type: string): AnyHookDefinition[] {
    const hooks = this.getByType(type);
    return this.topologicalSort(hooks);
  }

  // ============================================================================
  // Built-in Hook Helpers
  // ============================================================================

  /**
   * Create a pre-command hook
   */
  createPreCommandHook(
    id: string,
    name: string,
    handler: PreCommandHook['handler'],
    config?: Partial<Omit<PreCommandHook, 'id' | 'name' | 'handler' | 'type'>>
  ): PreCommandHook {
    return {
      id,
      name,
      type: BuiltInHookType.PRE_COMMAND,
      description: config?.description || '',
      phase: config?.phase || 'before',
      priority: config?.priority ?? HookPriority.NORMAL,
      enabled: config?.enabled ?? true,
      handler,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  /**
   * Create a post-command hook
   */
  createPostCommandHook(
    id: string,
    name: string,
    handler: PostCommandHook['handler'],
    config?: Partial<Omit<PostCommandHook, 'id' | 'name' | 'handler' | 'type'>>
  ): PostCommandHook {
    return {
      id,
      name,
      type: BuiltInHookType.POST_COMMAND,
      description: config?.description || '',
      phase: config?.phase || 'after',
      priority: config?.priority ?? HookPriority.NORMAL,
      enabled: config?.enabled ?? true,
      handler,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  /**
   * Create a pre-tool hook
   */
  createPreToolHook(
    id: string,
    name: string,
    handler: PreToolHook['handler'],
    config?: Partial<Omit<PreToolHook, 'id' | 'name' | 'handler' | 'type'>>
  ): PreToolHook {
    return {
      id,
      name,
      type: BuiltInHookType.PRE_TOOL,
      description: config?.description || '',
      phase: config?.phase || 'before',
      priority: config?.priority ?? HookPriority.NORMAL,
      enabled: config?.enabled ?? true,
      handler,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  /**
   * Create a post-tool hook
   */
  createPostToolHook(
    id: string,
    name: string,
    handler: PostToolHook['handler'],
    config?: Partial<Omit<PostToolHook, 'id' | 'name' | 'handler' | 'type'>>
  ): PostToolHook {
    return {
      id,
      name,
      type: BuiltInHookType.POST_TOOL,
      description: config?.description || '',
      phase: config?.phase || 'after',
      priority: config?.priority ?? HookPriority.NORMAL,
      enabled: config?.enabled ?? true,
      handler,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  /**
   * Create an error hook
   */
  createErrorHook(
    id: string,
    name: string,
    handler: ErrorHook['handler'],
    errorTypes: string[],
    config?: Partial<Omit<ErrorHook, 'id' | 'name' | 'handler' | 'type' | 'errorTypes'>>
  ): ErrorHook {
    return {
      id,
      name,
      type: BuiltInHookType.ON_ERROR,
      description: config?.description || '',
      phase: config?.phase || 'on_error',
      priority: config?.priority ?? HookPriority.HIGH,
      enabled: config?.enabled ?? true,
      handler,
      errorTypes,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  /**
   * Create a response hook
   */
  createResponseHook(
    id: string,
    name: string,
    handler: ResponseHook['handler'],
    config?: Partial<Omit<ResponseHook, 'id' | 'name' | 'handler' | 'type'>>
  ): ResponseHook {
    return {
      id,
      name,
      type: BuiltInHookType.ON_RESPONSE,
      description: config?.description || '',
      phase: config?.phase || 'after',
      priority: config?.priority ?? HookPriority.NORMAL,
      enabled: config?.enabled ?? true,
      handler,
      conditions: config?.conditions,
      timeoutMs: config?.timeoutMs,
      retryable: config?.retryable ?? false,
      maxRetries: config?.maxRetries ?? 0,
      meta: {
        version: '1.0.0',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: config?.meta?.tags || [],
        dependencies: config?.meta?.dependencies || [],
        dependents: config?.meta?.dependents || []
      }
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate a hook definition
   */
  private validateHook(hook: HookDefinition): string | null {
    if (!hook.id || typeof hook.id !== 'string') {
      return 'Hook ID is required and must be a string';
    }

    if (!hook.name || typeof hook.name !== 'string') {
      return 'Hook name is required and must be a string';
    }

    if (!hook.type || typeof hook.type !== 'string') {
      return 'Hook type is required and must be a string';
    }

    if (typeof hook.handler !== 'function') {
      return 'Hook handler must be a function';
    }

    if (typeof hook.priority !== 'number') {
      return 'Hook priority must be a number';
    }

    return null;
  }

  /**
   * Resolve hook dependencies
   */
  private resolveDependencies(hook: HookDefinition): string | null {
    if (!hook.meta?.dependencies || hook.meta.dependencies.length === 0) {
      return null;
    }

    for (const depId of hook.meta.dependencies) {
      if (!this.hooks.has(depId)) {
        return `Dependency '${depId}' not found for hook '${hook.id}'`;
      }
    }

    return null;
  }

  /**
   * Update indexes
   */
  private updateIndexes(hook: AnyHookDefinition, operation: 'add' | 'remove'): void {
    // Type index
    this.updateIndex(this.typeIndex, hook.type, hook.id, operation);

    // Tag index
    if (hook.meta?.tags) {
      for (const tag of hook.meta.tags) {
        this.updateIndex(this.tagIndex, tag, hook.id, operation);
      }
    }

    // Author index
    if (hook.meta?.author) {
      this.updateIndex(this.authorIndex, hook.meta.author, hook.id, operation);
    }
  }

  /**
   * Update a single index
   */
  private updateIndex(
    index: Map<string, Set<HookId>>,
    key: string,
    hookId: HookId,
    operation: 'add' | 'remove'
  ): void {
    if (operation === 'add') {
      if (!index.has(key)) {
        index.set(key, new Set());
      }
      index.get(key)!.add(hookId);
    } else {
      const set = index.get(key);
      if (set) {
        set.delete(hookId);
        if (set.size === 0) {
          index.delete(key);
        }
      }
    }
  }

  /**
   * Update dependency graph
   */
  private updateDependencyGraph(hook: AnyHookDefinition): void {
    // Update dependencies
    if (hook.meta?.dependencies) {
      this.dependencyGraph.dependencies.set(hook.id, hook.meta.dependencies);
      
      // Update dependents for each dependency
      for (const depId of hook.meta.dependencies) {
        if (!this.dependencyGraph.dependents.has(depId)) {
          this.dependencyGraph.dependents.set(depId, []);
        }
        const dependents = this.dependencyGraph.dependents.get(depId)!;
        if (!dependents.includes(hook.id)) {
          dependents.push(hook.id);
        }
      }
    }

    // Update dependents
    if (hook.meta?.dependents) {
      this.dependencyGraph.dependents.set(hook.id, hook.meta.dependents);
    }
  }

  /**
   * Topological sort for hooks
   */
  private topologicalSort(hooks: AnyHookDefinition[]): AnyHookDefinition[] {
    const sorted: AnyHookDefinition[] = [];
    const visited = new Set<HookId>();
    const visiting = new Set<HookId>();
    const hookMap = new Map(hooks.map(h => [h.id, h]));

    const visit = (hook: AnyHookDefinition): void => {
      if (visited.has(hook.id)) return;
      if (visiting.has(hook.id)) {
        // Circular dependency detected, skip
        return;
      }

      visiting.add(hook.id);

      // Visit dependencies first
      const dependencies = hook.meta?.dependencies || [];
      for (const depId of dependencies) {
        const dep = hookMap.get(depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(hook.id);
      visited.add(hook.id);
      sorted.push(hook);
    };

    for (const hook of hooks) {
      visit(hook);
    }

    return sorted;
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): HookExecutionStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0
    };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get registry size
   */
  get size(): number {
    return this.hooks.size;
  }

  /**
   * Check if hook exists
   */
  has(hookId: HookId): boolean {
    return this.hooks.has(hookId);
  }

  /**
   * Get all hook IDs
   */
  getHookIds(): HookId[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get registry version
   */
  getVersion(): string {
    return this.version;
  }
}

/**
 * Singleton registry instance
 */
let globalRegistry: HookRegistry | null = null;

/**
 * Get or create global registry
 */
export function getHookRegistry(maxHooks?: number): HookRegistry {
  if (!globalRegistry) {
    globalRegistry = new HookRegistry(maxHooks);
  }
  return globalRegistry;
}

/**
 * Set global registry
 */
export function setHookRegistry(registry: HookRegistry): void {
  globalRegistry = registry;
}

/**
 * Reset global registry
 */
export function resetHookRegistry(): void {
  globalRegistry = null;
}
