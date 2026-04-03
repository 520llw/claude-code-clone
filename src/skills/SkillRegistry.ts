/**
 * SkillRegistry.ts - Skill Registration and Discovery
 * 
 * Central registry for managing skill definitions and instances.
 * Handles registration, lookup, and lifecycle management.
 */

import { EventEmitter } from 'events';
import {
  Skill,
  SkillDefinition,
  SkillId,
  SkillVersion,
  SkillCategory,
  RegisteredSkill,
  SkillRegistrationOptions,
  DEFAULT_REGISTRATION_OPTIONS,
  SkillLifecycleState,
  SkillError,
  SkillErrorCode,
  SkillExecutionError,
  SkillSearchFilters,
  SkillStatistics,
  SkillFactory,
} from './types';
import { SkillValidator } from './utils/validator';

/**
 * Registry events
 */
export interface RegistryEvents {
  'skill:registered': { skillId: SkillId; definition: SkillDefinition };
  'skill:unregistered': { skillId: SkillId };
  'skill:loaded': { skillId: SkillId; instance: Skill };
  'skill:unloaded': { skillId: SkillId };
  'skill:updated': { skillId: SkillId; oldVersion: SkillVersion; newVersion: SkillVersion };
  'skill:deprecated': { skillId: SkillId; message?: string };
}

/**
 * Skill registry for managing all registered skills
 */
export class SkillRegistry extends EventEmitter {
  /**
   * Map of registered skills
   */
  private _skills: Map<SkillId, RegisteredSkill> = new Map();

  /**
   * Skill validator
   */
  private _validator: SkillValidator;

  /**
   * Statistics for each skill
   */
  private _statistics: Map<SkillId, SkillStatistics> = new Map();

  /**
   * Skill factories for lazy loading
   */
  private _factories: Map<SkillId, SkillFactory> = new Map();

  /**
   * Create a new skill registry
   */
  constructor() {
    super();
    this._validator = new SkillValidator();
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a skill definition
   */
  public async register(
    definition: SkillDefinition,
    options?: Partial<SkillRegistrationOptions>
  ): Promise<RegisteredSkill> {
    const opts = { ...DEFAULT_REGISTRATION_OPTIONS, ...options };
    const skillId = definition.metadata.id;

    // Check if already registered
    if (this._skills.has(skillId) && !opts.overrideExisting) {
      throw new SkillExecutionError(
        'SKILL_ALREADY_REGISTERED',
        `Skill '${skillId}' is already registered. Use overrideExisting to replace.`
      );
    }

    // Validate definition if required
    if (opts.validateOnRegister) {
      const validation = this._validator.validateDefinition(definition);
      if (!validation.valid) {
        throw new SkillExecutionError(
          'SKILL_VALIDATION_FAILED',
          `Skill validation failed: ${validation.errors.join(', ')}`
        );
      }
    }

    // Check for version conflicts
    const existing = this._skills.get(skillId);
    if (existing) {
      const oldVersion = existing.definition.metadata.version;
      const newVersion = definition.metadata.version;
      
      if (this._compareVersions(oldVersion, newVersion) > 0) {
        throw new SkillExecutionError(
          'SKILL_INCOMPATIBLE',
          `Cannot register older version (${newVersion}) over newer version (${oldVersion})`
        );
      }
    }

    // Create registered skill entry
    const registeredSkill: RegisteredSkill = {
      definition,
      state: 'registered',
      registeredAt: new Date(),
      executionCount: 0,
      options: opts,
    };

    // Store skill
    this._skills.set(skillId, registeredSkill);

    // Initialize statistics
    if (!this._statistics.has(skillId)) {
      this._initializeStatistics(skillId);
    }

    // Auto-load if enabled
    if (opts.autoLoad && !opts.lazyLoad) {
      await this.load(skillId);
    }

    // Emit event
    this.emit('skill:registered', { skillId, definition });

    // Check if this is an update
    if (existing) {
      this.emit('skill:updated', {
        skillId,
        oldVersion: existing.definition.metadata.version,
        newVersion: definition.metadata.version,
      });
    }

    return registeredSkill;
  }

  /**
   * Register a skill with its factory
   */
  public async registerWithFactory(
    definition: SkillDefinition,
    factory: SkillFactory,
    options?: Partial<SkillRegistrationOptions>
  ): Promise<RegisteredSkill> {
    const skillId = definition.metadata.id;
    
    // Store factory for lazy loading
    this._factories.set(skillId, factory);

    // Register with lazy loading enabled
    return this.register(definition, { ...options, lazyLoad: true });
  }

  /**
   * Unregister a skill
   */
  public async unregister(skillId: SkillId): Promise<boolean> {
    const skill = this._skills.get(skillId);
    if (!skill) {
      return false;
    }

    // Unload if loaded
    if (skill.instance) {
      await this.unload(skillId);
    }

    // Remove from registry
    this._skills.delete(skillId);
    this._factories.delete(skillId);

    this.emit('skill:unregistered', { skillId });

    return true;
  }

  /**
   * Unregister multiple skills
   */
  public async unregisterMany(skillIds: SkillId[]): Promise<number> {
    let count = 0;
    for (const skillId of skillIds) {
      if (await this.unregister(skillId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Unregister all skills
   */
  public async unregisterAll(): Promise<number> {
    const skillIds = Array.from(this._skills.keys());
    return this.unregisterMany(skillIds);
  }

  // ============================================================================
  // Loading Methods
  // ============================================================================

  /**
   * Load a registered skill
   */
  public async load(skillId: SkillId): Promise<Skill> {
    const registered = this._skills.get(skillId);
    if (!registered) {
      throw new SkillExecutionError(
        'SKILL_NOT_FOUND',
        `Skill '${skillId}' is not registered`
      );
    }

    // Already loaded
    if (registered.instance) {
      return registered.instance;
    }

    // Check for factory (lazy loading)
    const factory = this._factories.get(skillId);
    if (factory) {
      registered.instance = factory(registered.definition.config);
    } else {
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `No factory available for skill '${skillId}'`
      );
    }

    // Initialize the skill
    await registered.instance.initialize();

    registered.state = 'ready';
    registered.loadedAt = new Date();

    this.emit('skill:loaded', { skillId, instance: registered.instance });

    return registered.instance;
  }

  /**
   * Load multiple skills
   */
  public async loadMany(skillIds: SkillId[]): Promise<Skill[]> {
    return Promise.all(skillIds.map(id => this.load(id)));
  }

  /**
   * Load all registered skills
   */
  public async loadAll(): Promise<Skill[]> {
    const skillIds = Array.from(this._skills.keys());
    return this.loadMany(skillIds);
  }

  /**
   * Unload a skill
   */
  public async unload(skillId: SkillId): Promise<boolean> {
    const registered = this._skills.get(skillId);
    if (!registered || !registered.instance) {
      return false;
    }

    // Dispose the instance
    await registered.instance.dispose();

    registered.instance = undefined;
    registered.state = 'registered';

    this.emit('skill:unloaded', { skillId });

    return true;
  }

  /**
   * Unload multiple skills
   */
  public async unloadMany(skillIds: SkillId[]): Promise<number> {
    let count = 0;
    for (const skillId of skillIds) {
      if (await this.unload(skillId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Unload all skills
   */
  public async unloadAll(): Promise<number> {
    const skillIds = Array.from(this._skills.keys());
    return this.unloadMany(skillIds);
  }

  // ============================================================================
  // Lookup Methods
  // ============================================================================

  /**
   * Get a registered skill
   */
  public get(skillId: SkillId): RegisteredSkill | undefined {
    return this._skills.get(skillId);
  }

  /**
   * Get a loaded skill instance
   */
  public getInstance(skillId: SkillId): Skill | undefined {
    return this._skills.get(skillId)?.instance;
  }

  /**
   * Check if a skill is registered
   */
  public has(skillId: SkillId): boolean {
    return this._skills.has(skillId);
  }

  /**
   * Check if a skill is loaded
   */
  public isLoaded(skillId: SkillId): boolean {
    return this._skills.get(skillId)?.instance !== undefined;
  }

  /**
   * Get all registered skill IDs
   */
  public getAllIds(): SkillId[] {
    return Array.from(this._skills.keys());
  }

  /**
   * Get all registered skills
   */
  public getAll(): RegisteredSkill[] {
    return Array.from(this._skills.values());
  }

  /**
   * Get all loaded skills
   */
  public getLoaded(): Skill[] {
    return this.getAll()
      .map(s => s.instance)
      .filter((s): s is Skill => s !== undefined);
  }

  /**
   * Get skills by category
   */
  public getByCategory(category: SkillCategory): RegisteredSkill[] {
    return this.getAll().filter(
      s => s.definition.metadata.category === category
    );
  }

  /**
   * Get skills by tag
   */
  public getByTag(tag: string): RegisteredSkill[] {
    return this.getAll().filter(s =>
      s.definition.metadata.tags.includes(tag)
    );
  }

  /**
   * Get skills by author
   */
  public getByAuthor(author: string): RegisteredSkill[] {
    return this.getAll().filter(
      s => s.definition.metadata.author.name === author
    );
  }

  /**
   * Search skills with filters
   */
  public search(filters: SkillSearchFilters): RegisteredSkill[] {
    return this.getAll().filter(skill => {
      const meta = skill.definition.metadata;

      if (filters.category && meta.category !== filters.category) {
        return false;
      }

      if (filters.author && meta.author.name !== filters.author) {
        return false;
      }

      if (filters.tags && !filters.tags.every(tag => meta.tags.includes(tag))) {
        return false;
      }

      if (filters.minRating !== undefined) {
        // Rating would come from external source
        return true;
      }

      return true;
    });
  }

  // ============================================================================
  // Update Methods
  // ============================================================================

  /**
   * Update a skill's definition
   */
  public async update(
    skillId: SkillId,
    updates: Partial<SkillDefinition>
  ): Promise<RegisteredSkill> {
    const registered = this._skills.get(skillId);
    if (!registered) {
      throw new SkillExecutionError(
        'SKILL_NOT_FOUND',
        `Skill '${skillId}' is not registered`
      );
    }

    // Merge updates
    const updatedDefinition: SkillDefinition = {
      ...registered.definition,
      ...updates,
      metadata: {
        ...registered.definition.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    // Unload if loaded
    const wasLoaded = registered.instance !== undefined;
    if (wasLoaded) {
      await this.unload(skillId);
    }

    // Update registration
    registered.definition = updatedDefinition;

    // Reload if it was loaded
    if (wasLoaded) {
      await this.load(skillId);
    }

    this.emit('skill:updated', {
      skillId,
      oldVersion: registered.definition.metadata.version,
      newVersion: updatedDefinition.metadata.version,
    });

    return registered;
  }

  /**
   * Mark a skill as deprecated
   */
  public deprecate(
    skillId: SkillId,
    message?: string,
    replacement?: SkillId
  ): void {
    const registered = this._skills.get(skillId);
    if (!registered) {
      throw new SkillExecutionError(
        'SKILL_NOT_FOUND',
        `Skill '${skillId}' is not registered`
      );
    }

    registered.definition.metadata.deprecated = true;
    registered.definition.metadata.deprecationMessage = message;
    
    if (replacement) {
      registered.definition.metadata.replaces = [replacement];
    }

    this.emit('skill:deprecated', { skillId, message });
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * Get skill statistics
   */
  public getStatistics(skillId: SkillId): SkillStatistics | undefined {
    return this._statistics.get(skillId);
  }

  /**
   * Get all statistics
   */
  public getAllStatistics(): Map<SkillId, SkillStatistics> {
    return new Map(this._statistics);
  }

  /**
   * Update skill statistics
   */
  public updateStatistics(
    skillId: SkillId,
    updates: Partial<SkillStatistics>
  ): void {
    const stats = this._statistics.get(skillId);
    if (stats) {
      Object.assign(stats, updates);
    }
  }

  /**
   * Record skill execution
   */
  public recordExecution(
    skillId: SkillId,
    success: boolean,
    executionTime: number,
    tokensUsed?: number
  ): void {
    const stats = this._statistics.get(skillId);
    if (!stats) return;

    stats.totalExecutions++;
    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
    }

    // Update average execution time
    const totalTime = stats.averageExecutionTime * (stats.totalExecutions - 1);
    stats.averageExecutionTime = (totalTime + executionTime) / stats.totalExecutions;

    if (tokensUsed) {
      stats.totalTokensUsed += tokensUsed;
    }

    stats.lastUsedAt = new Date();

    // Update registered skill execution count
    const registered = this._skills.get(skillId);
    if (registered) {
      registered.executionCount++;
      registered.lastExecutedAt = new Date();
    }
  }

  // ============================================================================
  // Dependency Methods
  // ============================================================================

  /**
   * Check if all dependencies for a skill are satisfied
   */
  public checkDependencies(skillId: SkillId): { satisfied: boolean; missing: SkillId[] } {
    const registered = this._skills.get(skillId);
    if (!registered) {
      return { satisfied: false, missing: [skillId] };
    }

    const missing: SkillId[] = [];

    for (const dep of registered.definition.dependencies) {
      if (!dep.optional && !this._skills.has(dep.skillId)) {
        missing.push(dep.skillId);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }

  /**
   * Get dependency tree for a skill
   */
  public getDependencyTree(skillId: SkillId): { skillId: SkillId; dependencies: SkillId[] }[] {
    const tree: { skillId: SkillId; dependencies: SkillId[] }[] = [];
    const visited = new Set<SkillId>();

    const buildTree = (id: SkillId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const registered = this._skills.get(id);
      if (!registered) return;

      const deps = registered.definition.dependencies
        .filter(d => !d.optional)
        .map(d => d.skillId);

      tree.push({ skillId: id, dependencies: deps });

      for (const dep of deps) {
        buildTree(dep);
      }
    };

    buildTree(skillId);
    return tree;
  }

  /**
   * Resolve dependency order
   */
  public resolveDependencyOrder(skillIds: SkillId[]): SkillId[] {
    const visited = new Set<SkillId>();
    const result: SkillId[] = [];

    const visit = (id: SkillId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const registered = this._skills.get(id);
      if (registered) {
        for (const dep of registered.definition.dependencies) {
          if (!dep.optional) {
            visit(dep.skillId);
          }
        }
      }

      result.push(id);
    };

    for (const skillId of skillIds) {
      visit(skillId);
    }

    return result;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get registry size
   */
  public get size(): number {
    return this._skills.size;
  }

  /**
   * Check if registry is empty
   */
  public get isEmpty(): boolean {
    return this._skills.size === 0;
  }

  /**
   * Get count of loaded skills
   */
  public get loadedCount(): number {
    return this.getLoaded().length;
  }

  /**
   * Export registry to JSON
   */
  public toJSON(): object {
    return {
      skills: Array.from(this._skills.entries()).map(([id, skill]) => ({
        id,
        definition: skill.definition,
        state: skill.state,
        registeredAt: skill.registeredAt,
        loadedAt: skill.loadedAt,
        executionCount: skill.executionCount,
        lastExecutedAt: skill.lastExecutedAt,
      })),
      statistics: Array.from(this._statistics.entries()),
    };
  }

  /**
   * Create a snapshot of the registry
   */
  public createSnapshot(): {
    skills: Map<SkillId, RegisteredSkill>;
    statistics: Map<SkillId, SkillStatistics>;
    timestamp: Date;
  } {
    return {
      skills: new Map(this._skills),
      statistics: new Map(this._statistics),
      timestamp: new Date(),
    };
  }

  /**
   * Restore from snapshot
   */
  public restoreSnapshot(snapshot: ReturnType<typeof this.createSnapshot>): void {
    this._skills = new Map(snapshot.skills);
    this._statistics = new Map(snapshot.statistics);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize statistics for a skill
   */
  private _initializeStatistics(skillId: SkillId): void {
    this._statistics.set(skillId, {
      skillId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalTokensUsed: 0,
      usageByDay: new Map(),
      popularInputs: new Map(),
    });
  }

  /**
   * Compare two semantic versions
   * Returns: negative if v1 < v2, 0 if equal, positive if v1 > v2
   */
  private _compareVersions(v1: SkillVersion, v2: SkillVersion): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] !== parts2[i]) {
        return parts1[i] - parts2[i];
      }
    }

    return 0;
  }
}

export default SkillRegistry;
