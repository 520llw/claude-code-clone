/**
 * SkillManager.ts - Skill Lifecycle Management
 * 
 * Central manager for the skills system. Coordinates registration,
 * loading, execution, and composition of skills.
 */

import { EventEmitter } from 'events';
import {
  Skill,
  SkillDefinition,
  SkillId,
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillConfig,
  SkillRegistrationOptions,
  SkillLoadOptions,
  SkillLoadResult,
  SkillComposition,
  ComposedSkillResult,
  SkillExecutionRecord,
  SkillStatistics,
  SkillSearchFilters,
  SkillEvent,
  SkillEventHandler,
  SkillError,
  SkillErrorCode,
  SkillExecutionError,
  RegisteredSkill,
} from './types';
import { SkillRegistry } from './SkillRegistry';
import { SkillLoader } from './SkillLoader';
import { SkillComposer } from './SkillComposer';

/**
 * Skill manager configuration
 */
export interface SkillManagerConfig {
  autoRegisterBuiltin: boolean;
  autoLoadOnExecute: boolean;
  enableCaching: boolean;
  cacheTtl: number;
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  searchPaths: string[];
}

/**
 * Default skill manager configuration
 */
export const DEFAULT_MANAGER_CONFIG: SkillManagerConfig = {
  autoRegisterBuiltin: true,
  autoLoadOnExecute: true,
  enableCaching: true,
  cacheTtl: 3600000,
  maxConcurrentExecutions: 5,
  defaultTimeout: 30000,
  searchPaths: [],
};

/**
 * Central skill manager
 */
export class SkillManager extends EventEmitter {
  /**
   * Skill registry
   */
  private _registry: SkillRegistry;

  /**
   * Skill loader
   */
  private _loader: SkillLoader;

  /**
   * Skill composer
   */
  private _composer: SkillComposer;

  /**
   * Manager configuration
   */
  private _config: SkillManagerConfig;

  /**
   * Execution history
   */
  private _executionHistory: SkillExecutionRecord[] = [];

  /**
   * Maximum history size
   */
  private _maxHistorySize: number = 1000;

  /**
   * Active executions
   */
  private _activeExecutions: Map<string, AbortController> = new Map();

  /**
   * Event handlers
   */
  private _eventHandlers: Map<string, Set<SkillEventHandler>> = new Map();

  /**
   * Session ID counter
   */
  private _sessionCounter: number = 0;

  /**
   * Create a new skill manager
   */
  constructor(config?: Partial<SkillManagerConfig>) {
    super();
    
    this._config = { ...DEFAULT_MANAGER_CONFIG, ...config };
    this._registry = new SkillRegistry();
    this._loader = new SkillLoader(this._config.searchPaths);
    this._composer = new SkillComposer(this._registry);

    // Setup event forwarding
    this._setupEventForwarding();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the skill manager
   */
  public async initialize(): Promise<void> {
    this.emit('initializing');

    // Auto-register builtin skills if enabled
    if (this._config.autoRegisterBuiltin) {
      await this._registerBuiltinSkills();
    }

    this.emit('initialized');
  }

  /**
   * Dispose the skill manager
   */
  public async dispose(): Promise<void> {
    this.emit('disposing');

    // Cancel all active executions
    for (const [id, controller] of this._activeExecutions) {
      controller.abort();
      this._activeExecutions.delete(id);
    }

    // Unload all skills
    await this._registry.unloadAll();

    // Unregister all skills
    await this._registry.unregisterAll();

    this.emit('disposed');
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
    return this._registry.register(definition, options);
  }

  /**
   * Register multiple skills
   */
  public async registerMany(
    definitions: SkillDefinition[],
    options?: Partial<SkillRegistrationOptions>
  ): Promise<RegisteredSkill[]> {
    return Promise.all(
      definitions.map(def => this.register(def, options))
    );
  }

  /**
   * Unregister a skill
   */
  public async unregister(skillId: SkillId): Promise<boolean> {
    return this._registry.unregister(skillId);
  }

  /**
   * Check if a skill is registered
   */
  public isRegistered(skillId: SkillId): boolean {
    return this._registry.has(skillId);
  }

  // ============================================================================
  // Loading Methods
  // ============================================================================

  /**
   * Load a skill from a source
   */
  public async load(options: SkillLoadOptions): Promise<SkillLoadResult> {
    return this._loader.load(options);
  }

  /**
   * Load and register a skill
   */
  public async loadAndRegister(
    options: SkillLoadOptions,
    registrationOptions?: Partial<SkillRegistrationOptions>
  ): Promise<RegisteredSkill> {
    const result = await this.load(options);
    
    if (!result.success || !result.definition) {
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        result.error?.message || 'Failed to load skill'
      );
    }

    return this.register(result.definition, registrationOptions);
  }

  /**
   * Load a skill instance
   */
  public async loadSkill(skillId: SkillId): Promise<Skill> {
    return this._registry.load(skillId);
  }

  /**
   * Unload a skill
   */
  public async unloadSkill(skillId: SkillId): Promise<boolean> {
    return this._registry.unload(skillId);
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  /**
   * Execute a skill
   */
  public async execute(
    skillId: SkillId,
    input: SkillInput,
    context?: Partial<SkillContext>,
    options?: {
      timeout?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<SkillOutput> {
    const executionId = this._generateExecutionId();
    
    // Get or load skill
    let skill = this._registry.getInstance(skillId);
    
    if (!skill) {
      if (this._config.autoLoadOnExecute) {
        skill = await this._registry.load(skillId);
      } else {
        throw new SkillExecutionError(
          'SKILL_NOT_FOUND',
          `Skill '${skillId}' is not loaded`
        );
      }
    }

    // Build full context
    const fullContext = this._buildContext(context);

    // Setup abort controller
    const abortController = new AbortController();
    this._activeExecutions.set(executionId, abortController);

    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        abortController.abort();
      });
    }

    try {
      this.emit('execution:started', { executionId, skillId, input });

      // Execute skill
      const output = await skill.execute(input, fullContext, {
        timeout: options?.timeout ?? this._config.defaultTimeout,
        abortSignal: abortController.signal,
      });

      // Record execution
      this._recordExecution(skillId, input, output, fullContext);

      // Update statistics
      this._registry.recordExecution(
        skillId,
        output.success,
        output.metadata.executionTime,
        output.metadata.tokensUsed
      );

      this.emit('execution:completed', { executionId, skillId, output });

      return output;
    } catch (error) {
      this.emit('execution:failed', { executionId, skillId, error });
      throw error;
    } finally {
      this._activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute multiple skills in sequence
   */
  public async executeSequence(
    executions: { skillId: SkillId; input: SkillInput }[],
    context?: Partial<SkillContext>
  ): Promise<SkillOutput[]> {
    const results: SkillOutput[] = [];
    let currentContext = { ...context };

    for (const { skillId, input } of executions) {
      const output = await this.execute(skillId, input, currentContext);
      results.push(output);

      // Update context with output for next execution
      if (output.success && output.data) {
        currentContext = {
          ...currentContext,
          variables: new Map([
            ...(currentContext.variables || new Map()),
            ['lastOutput', output.data],
          ]),
        };
      }
    }

    return results;
  }

  /**
   * Execute multiple skills in parallel
   */
  public async executeParallel(
    executions: { skillId: SkillId; input: SkillInput }[],
    context?: Partial<SkillContext>
  ): Promise<SkillOutput[]> {
    const fullContext = this._buildContext(context);
    
    return Promise.all(
      executions.map(({ skillId, input }) =>
        this.execute(skillId, input, fullContext)
      )
    );
  }

  /**
   * Cancel an execution
   */
  public cancelExecution(executionId: string): boolean {
    const controller = this._activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      this._activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all executions
   */
  public cancelAllExecutions(): number {
    let count = 0;
    for (const [id, controller] of this._activeExecutions) {
      controller.abort();
      this._activeExecutions.delete(id);
      count++;
    }
    return count;
  }

  // ============================================================================
  // Composition Methods
  // ============================================================================

  /**
   * Execute a composed skill
   */
  public async executeComposition(
    composition: SkillComposition,
    initialInput: SkillInput,
    context?: Partial<SkillContext>
  ): Promise<ComposedSkillResult> {
    return this._composer.execute(composition, initialInput, this._buildContext(context));
  }

  /**
   * Create a composition from skill IDs
   */
  public createComposition(
    id: string,
    name: string,
    skillIds: SkillId[]
  ): SkillComposition {
    return this._composer.createLinear(id, name, skillIds);
  }

  /**
   * Validate a composition
   */
  public validateComposition(composition: SkillComposition): {
    valid: boolean;
    errors: string[];
  } {
    return this._composer.validate(composition);
  }

  // ============================================================================
  // Lookup Methods
  // ============================================================================

  /**
   * Get a registered skill
   */
  public getSkill(skillId: SkillId): RegisteredSkill | undefined {
    return this._registry.get(skillId);
  }

  /**
   * Get a skill instance
   */
  public getSkillInstance(skillId: SkillId): Skill | undefined {
    return this._registry.getInstance(skillId);
  }

  /**
   * Get all registered skill IDs
   */
  public getAllSkillIds(): SkillId[] {
    return this._registry.getAllIds();
  }

  /**
   * Get all registered skills
   */
  public getAllSkills(): RegisteredSkill[] {
    return this._registry.getAll();
  }

  /**
   * Get skills by category
   */
  public getSkillsByCategory(category: string): RegisteredSkill[] {
    return this._registry.getByCategory(category as any);
  }

  /**
   * Search skills
   */
  public searchSkills(filters: SkillSearchFilters): RegisteredSkill[] {
    return this._registry.search(filters);
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * Get skill statistics
   */
  public getStatistics(skillId: SkillId): SkillStatistics | undefined {
    return this._registry.getStatistics(skillId);
  }

  /**
   * Get all statistics
   */
  public getAllStatistics(): Map<SkillId, SkillStatistics> {
    return this._registry.getAllStatistics();
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(
    skillId?: SkillId,
    limit?: number
  ): SkillExecutionRecord[] {
    let history = this._executionHistory;
    
    if (skillId) {
      history = history.filter(h => h.skillId === skillId);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history;
  }

  /**
   * Clear execution history
   */
  public clearHistory(): void {
    this._executionHistory = [];
  }

  // ============================================================================
  // Event Methods
  // ============================================================================

  /**
   * Subscribe to skill events
   */
  public onEvent(
    eventType: string,
    handler: SkillEventHandler
  ): () => void {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, new Set());
    }
    
    this._eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this._eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  public emitEvent(event: SkillEvent): void {
    const handlers = this._eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SkillManagerConfig>): void {
    this._config = { ...this._config, ...config };
  }

  /**
   * Get configuration
   */
  public getConfig(): SkillManagerConfig {
    return { ...this._config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Register builtin skills
   */
  private async _registerBuiltinSkills(): Promise<void> {
    // Builtin skills are registered by the registry
    // This would import and register all builtin skills
    this.emit('builtin:registering');
    
    // Placeholder - actual builtin registration would happen here
    
    this.emit('builtin:registered');
  }

  /**
   * Setup event forwarding from registry and loader
   */
  private _setupEventForwarding(): void {
    // Forward registry events
    this._registry.on('skill:registered', (data) => {
      this.emit('skill:registered', data);
    });
    
    this._registry.on('skill:unregistered', (data) => {
      this.emit('skill:unregistered', data);
    });

    // Forward loader events
    this._loader.on('loading', (data) => {
      this.emit('skill:loading', data);
    });
    
    this._loader.on('loaded', (data) => {
      this.emit('skill:loaded', data);
    });
  }

  /**
   * Build full context from partial context
   */
  private _buildContext(partial?: Partial<SkillContext>): SkillContext {
    this._sessionCounter++;
    
    return {
      sessionId: `session-${this._sessionCounter}`,
      workspacePath: process.cwd(),
      projectRoot: process.cwd(),
      files: [],
      selectedFiles: [],
      environment: { ...process.env },
      variables: new Map(),
      history: this._executionHistory.slice(-10),
      ...partial,
    };
  }

  /**
   * Record an execution
   */
  private _recordExecution(
    skillId: SkillId,
    input: SkillInput,
    output: SkillOutput,
    context: SkillContext
  ): void {
    const record: SkillExecutionRecord = {
      id: this._generateExecutionId(),
      skillId,
      input,
      output,
      context,
      timestamp: new Date(),
    };

    this._executionHistory.push(record);

    // Trim history if needed
    if (this._executionHistory.length > this._maxHistorySize) {
      this._executionHistory = this._executionHistory.slice(-this._maxHistorySize);
    }
  }

  /**
   * Generate execution ID
   */
  private _generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get the skill registry
   */
  public get registry(): SkillRegistry {
    return this._registry;
  }

  /**
   * Get the skill loader
   */
  public get loader(): SkillLoader {
    return this._loader;
  }

  /**
   * Get the skill composer
   */
  public get composer(): SkillComposer {
    return this._composer;
  }

  /**
   * Get active execution count
   */
  public get activeExecutionCount(): number {
    return this._activeExecutions.size;
  }

  /**
   * Get registered skill count
   */
  public get registeredSkillCount(): number {
    return this._registry.size;
  }

  /**
   * Get loaded skill count
   */
  public get loadedSkillCount(): number {
    return this._registry.loadedCount;
  }
}

export default SkillManager;
