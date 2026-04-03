/**
 * Skill.ts - Base Skill Class
 * 
 * Abstract base class for all skills in the Claude Code system.
 * Provides lifecycle management, validation, and execution framework.
 */

import { EventEmitter } from 'events';
import {
  SkillDefinition,
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillConfig,
  SkillLifecycleState,
  SkillExecutionStatus,
  SkillError,
  SkillErrorCode,
  SkillExecutionError,
  SkillOutputMetadata,
  SkillValidationResult,
  DEFAULT_SKILL_CONFIG,
} from './types';
import { SkillValidator } from './utils/validator';

/**
 * Skill execution options
 */
export interface SkillExecutionOptions {
  timeout?: number;
  retries?: number;
  abortSignal?: AbortSignal;
  parentExecutionId?: string;
}

/**
 * Abstract base class for all skills
 */
export abstract class Skill extends EventEmitter {
  /**
   * Skill definition
   */
  public readonly definition: SkillDefinition;

  /**
   * Current lifecycle state
   */
  protected _state: SkillLifecycleState = 'registered';

  /**
   * Current execution status
   */
  protected _executionStatus: SkillExecutionStatus = 'idle';

  /**
   * Skill configuration
   */
  protected _config: SkillConfig;

  /**
   * Execution count
   */
  protected _executionCount: number = 0;

  /**
   * Last execution time
   */
  protected _lastExecutionTime?: number;

  /**
   * Total tokens used
   */
  protected _totalTokensUsed: number = 0;

  /**
   * Cache for results
   */
  protected _resultCache: Map<string, { result: SkillOutput; expiresAt: number }> = new Map();

  /**
   * Abort controller for current execution
   */
  protected _abortController?: AbortController;

  /**
   * Validator instance
   */
  protected _validator: SkillValidator;

  /**
   * Initialize timestamp
   */
  protected _initializedAt?: Date;

  /**
   * Create a new skill instance
   */
  constructor(definition: SkillDefinition, config?: Partial<SkillConfig>) {
    super();
    this.definition = definition;
    this._config = { ...DEFAULT_SKILL_CONFIG, ...config };
    this._validator = new SkillValidator();
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get current lifecycle state
   */
  public get state(): SkillLifecycleState {
    return this._state;
  }

  /**
   * Get current execution status
   */
  public get executionStatus(): SkillExecutionStatus {
    return this._executionStatus;
  }

  /**
   * Get skill ID
   */
  public get id(): string {
    return this.definition.metadata.id;
  }

  /**
   * Get skill name
   */
  public get name(): string {
    return this.definition.metadata.name;
  }

  /**
   * Get skill version
   */
  public get version(): string {
    return this.definition.metadata.version;
  }

  /**
   * Get execution count
   */
  public get executionCount(): number {
    return this._executionCount;
  }

  /**
   * Get total tokens used
   */
  public get totalTokensUsed(): number {
    return this._totalTokensUsed;
  }

  /**
   * Check if skill is enabled
   */
  public get isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Check if skill is ready to execute
   */
  public get isReady(): boolean {
    return this._state === 'ready' && this.isEnabled;
  }

  /**
   * Check if skill is currently executing
   */
  public get isExecuting(): boolean {
    return this._executionStatus === 'executing';
  }

  /**
   * Check if skill is deprecated
   */
  public get isDeprecated(): boolean {
    return this.definition.metadata.deprecated ?? false;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Initialize the skill
   * Called before first execution
   */
  public async initialize(): Promise<void> {
    if (this._state !== 'registered') {
      throw new SkillExecutionError(
        'SKILL_EXECUTION_FAILED',
        `Cannot initialize skill in state: ${this._state}`
      );
    }

    this._setState('initialized');

    try {
      // Call beforeLoad hook if defined
      if (this.definition.hooks?.beforeLoad) {
        await this._executeHook('beforeLoad');
      }

      // Perform skill-specific initialization
      await this.onInitialize();

      // Call afterLoad hook if defined
      if (this.definition.hooks?.afterLoad) {
        await this._executeHook('afterLoad');
      }

      this._initializedAt = new Date();
      this._setState('ready');

      this.emit('initialized', { skillId: this.id });
    } catch (error) {
      this._setState('error');
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `Failed to initialize skill: ${error instanceof Error ? error.message : String(error)}`,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute the skill with given input and context
   */
  public async execute(
    input: SkillInput,
    context: SkillContext,
    options?: SkillExecutionOptions
  ): Promise<SkillOutput> {
    const startTime = Date.now();
    const executionId = this._generateExecutionId();

    // Check if skill is ready
    if (!this.isReady) {
      if (this._state === 'registered') {
        await this.initialize();
      } else if (this._state !== 'ready') {
        throw new SkillExecutionError(
          'SKILL_EXECUTION_FAILED',
          `Skill is not ready (current state: ${this._state})`
        );
      }
    }

    // Check if deprecated
    if (this.isDeprecated) {
      this.emit('deprecated', {
        skillId: this.id,
        message: this.definition.metadata.deprecationMessage,
      });
    }

    // Set execution status
    this._executionStatus = 'executing';
    this.emit('executing', { skillId: this.id, executionId });

    // Setup abort controller
    this._abortController = new AbortController();
    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        this._abortController?.abort();
      });
    }

    try {
      // Validate input
      this._executionStatus = 'validating';
      const validationResult = await this.validate(input);
      if (!validationResult) {
        throw new SkillExecutionError(
          'INVALID_INPUT',
          'Input validation failed'
        );
      }

      // Check cache
      if (this._config.cacheResults) {
        const cacheKey = this._generateCacheKey(input);
        const cached = this._resultCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          this._executionStatus = 'completed';
          this.emit('completed', { skillId: this.id, executionId, cached: true });
          return {
            ...cached.result,
            metadata: {
              ...cached.result.metadata,
              cached: true,
            },
          };
        }
      }

      // Call beforeExecute hook
      let processedInput = input;
      if (this.definition.hooks?.beforeExecute) {
        processedInput = await this._executeHook('beforeExecute', input);
      }

      // Execute with timeout and retries
      const timeout = options?.timeout ?? this._config.timeout;
      const maxRetries = options?.retries ?? this._config.retries;
      
      let result: SkillOutput;
      let retryCount = 0;
      let lastError: Error | undefined;

      while (retryCount <= maxRetries) {
        try {
          result = await this._executeWithTimeout(
            processedInput,
            context,
            timeout
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (retryCount < maxRetries && this._shouldRetry(error)) {
            retryCount++;
            await this._delay(this._config.retryDelay * retryCount);
            this.emit('retry', { skillId: this.id, executionId, retryCount });
          } else {
            throw error;
          }
        }
      }

      // Call afterExecute hook
      if (this.definition.hooks?.afterExecute) {
        result = await this._executeHook('afterExecute', result);
      }

      // Validate output
      const outputValidation = await this._validator.validateOutput(
        result,
        this.definition.outputSchema
      );
      if (!outputValidation.valid) {
        throw new SkillExecutionError(
          'INVALID_OUTPUT',
          `Output validation failed: ${outputValidation.errors.join(', ')}`
        );
      }

      // Build final output with metadata
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      const finalOutput: SkillOutput = {
        ...result!,
        metadata: {
          executionTime,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          tokensUsed: result!.metadata?.tokensUsed,
          modelUsed: result!.metadata?.modelUsed,
          cached: false,
          retryCount,
        },
      };

      // Cache result if enabled
      if (this._config.cacheResults && finalOutput.success) {
        const cacheKey = this._generateCacheKey(input);
        this._resultCache.set(cacheKey, {
          result: finalOutput,
          expiresAt: Date.now() + this._config.cacheTtl,
        });
      }

      // Update statistics
      this._executionCount++;
      this._lastExecutionTime = executionTime;
      if (finalOutput.metadata.tokensUsed) {
        this._totalTokensUsed += finalOutput.metadata.tokensUsed;
      }

      this._executionStatus = 'completed';
      this.emit('completed', { skillId: this.id, executionId, cached: false });

      return finalOutput;
    } catch (error) {
      return this._handleExecutionError(error, startTime, retryCount);
    } finally {
      this._abortController = undefined;
    }
  }

  /**
   * Validate skill input
   */
  public async validate(input: SkillInput): Promise<boolean> {
    const result = await this._validator.validateInput(
      input,
      this.definition.inputSchema
    );
    return result.valid;
  }

  /**
   * Get detailed validation result
   */
  public async validateDetailed(input: SkillInput): Promise<SkillValidationResult> {
    return this._validator.validateInput(input, this.definition.inputSchema);
  }

  /**
   * Cancel current execution
   */
  public cancel(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._executionStatus = 'cancelled';
      this.emit('cancelled', { skillId: this.id });
    }
  }

  /**
   * Dispose the skill
   */
  public async dispose(): Promise<void> {
    // Call beforeUnload hook
    if (this.definition.hooks?.beforeUnload) {
      await this._executeHook('beforeUnload');
    }

    // Cancel any ongoing execution
    this.cancel();

    // Perform skill-specific cleanup
    await this.onDispose();

    // Clear cache
    this._resultCache.clear();

    this._setState('unloaded');
    this.emit('disposed', { skillId: this.id });
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  /**
   * Skill-specific initialization logic
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Core skill execution logic
   */
  protected abstract onExecute(
    input: SkillInput,
    context: SkillContext
  ): Promise<SkillOutput>;

  /**
   * Skill-specific cleanup logic
   */
  protected abstract onDispose(): Promise<void>;

  // ============================================================================
  // Protected Methods
  // ============================================================================

  /**
   * Execute with timeout
   */
  protected async _executeWithTimeout(
    input: SkillInput,
    context: SkillContext,
    timeout: number
  ): Promise<SkillOutput> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new SkillExecutionError('SKILL_TIMEOUT', `Execution timed out after ${timeout}ms`));
      }, timeout);

      this.onExecute(input, context)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle execution error
   */
  protected _handleExecutionError(
    error: unknown,
    startTime: number,
    retryCount: number
  ): SkillOutput {
    const endTime = Date.now();
    
    let skillError: SkillError;

    if (error instanceof SkillExecutionError) {
      skillError = {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack,
      };
    } else if (error instanceof Error) {
      if (error.name === 'AbortError' || (error as Error).message?.includes('abort')) {
        skillError = {
          code: 'SKILL_CANCELLED',
          message: 'Skill execution was cancelled',
        };
        this._executionStatus = 'cancelled';
      } else {
        skillError = {
          code: 'SKILL_EXECUTION_FAILED',
          message: error.message,
          stack: error.stack,
        };
        this._executionStatus = 'failed';
      }
    } else {
      skillError = {
        code: 'SKILL_EXECUTION_FAILED',
        message: String(error),
      };
      this._executionStatus = 'failed';
    }

    // Call onError hook
    if (this.definition.hooks?.onError) {
      this._executeHook('onError', skillError).catch(() => {});
    }

    this.emit('error', { skillId: this.id, error: skillError });

    return {
      success: false,
      error: skillError,
      metadata: {
        executionTime: endTime - startTime,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        cached: false,
        retryCount,
      },
    };
  }

  /**
   * Execute a lifecycle hook
   */
  protected async _executeHook(
    hookName: string,
    data?: unknown
  ): Promise<any> {
    const hookCode = (this.definition.hooks as Record<string, string>)[hookName];
    if (!hookCode) return data;

    try {
      // Create a function from the hook code
      const hookFn = new Function('data', 'context', hookCode);
      return await hookFn(data, { skill: this });
    } catch (error) {
      this.emit('hookError', { skillId: this.id, hookName, error });
      throw error;
    }
  }

  /**
   * Set lifecycle state
   */
  protected _setState(state: SkillLifecycleState): void {
    const oldState = this._state;
    this._state = state;
    this.emit('stateChange', { skillId: this.id, oldState, newState: state });
  }

  /**
   * Generate cache key for input
   */
  protected _generateCacheKey(input: SkillInput): string {
    return `${this.id}:${JSON.stringify(input)}`;
  }

  /**
   * Generate unique execution ID
   */
  protected _generateExecutionId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine if an error should trigger a retry
   */
  protected _shouldRetry(error: unknown): boolean {
    // Don't retry on validation errors or cancellation
    if (error instanceof SkillExecutionError) {
      return !['INVALID_INPUT', 'INVALID_OUTPUT', 'SKILL_CANCELLED'].includes(error.code);
    }
    return true;
  }

  /**
   * Delay utility
   */
  protected _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if execution was aborted
   */
  protected _isAborted(): boolean {
    return this._abortController?.signal.aborted ?? false;
  }

  /**
   * Throw if aborted
   */
  protected _throwIfAborted(): void {
    if (this._isAborted()) {
      throw new SkillExecutionError('SKILL_CANCELLED', 'Execution was cancelled');
    }
  }

  /**
   * Log message at appropriate level
   */
  protected _log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this._config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const prefix = `[Skill:${this.id}]`;
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      console[level](`${prefix} ${message}${metaStr}`);
    }
  }

  /**
   * Get skill statistics
   */
  public getStatistics(): {
    executionCount: number;
    lastExecutionTime?: number;
    totalTokensUsed: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    return {
      executionCount: this._executionCount,
      lastExecutionTime: this._lastExecutionTime,
      totalTokensUsed: this._totalTokensUsed,
      averageExecutionTime: this._lastExecutionTime || 0,
      successRate: this._executionCount > 0 ? 1 : 0, // Simplified
    };
  }

  /**
   * Clear result cache
   */
  public clearCache(): void {
    this._resultCache.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SkillConfig>): void {
    this._config = { ...this._config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): SkillConfig {
    return { ...this._config };
  }

  /**
   * Check success criteria
   */
  public checkSuccessCriteria(output: SkillOutput): boolean {
    return this.definition.successCriteria.every(criterion => {
      try {
        return criterion.check(output);
      } catch {
        return false;
      }
    });
  }

  /**
   * Get required tools
   */
  public getRequiredTools(): string[] {
    return [...this.definition.requiredTools];
  }

  /**
   * Get required context
   */
  public getRequiredContext(): string[] {
    return [...this.definition.requiredContext];
  }

  /**
   * Check if all dependencies are satisfied
   */
  public async checkDependencies(
    availableSkills: Map<string, Skill>
  ): Promise<{ satisfied: boolean; missing: string[] }> {
    const missing: string[] = [];

    for (const dep of this.definition.dependencies) {
      if (!dep.optional && !availableSkills.has(dep.skillId)) {
        missing.push(dep.skillId);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }

  /**
   * toJSON for serialization
   */
  public toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      state: this.state,
      executionStatus: this.executionStatus,
      executionCount: this.executionCount,
      totalTokensUsed: this.totalTokensUsed,
      isEnabled: this.isEnabled,
      isReady: this.isReady,
      isDeprecated: this.isDeprecated,
    };
  }
}

export default Skill;
