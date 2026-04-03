/**
 * Hooks System
 * 
 * Main exports for the Claude Code hooks system.
 * Provides a comprehensive framework for extending agent behavior
 * through lifecycle hooks.
 */

// ============================================================================
// Core Exports
// ============================================================================

export { HookEngine, getHookEngine, setHookEngine, resetHookEngine } from './HookEngine';
export { HookRegistry, getHookRegistry, setHookRegistry, resetHookRegistry } from './HookRegistry';
export { HookRunner, createHookRunner } from './HookRunner';

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Core types
  HookId,
  HookPriority,
  HookPhase,
  HookLifecycleState,
  HookContext,
  HookDefinition,
  AnyHookDefinition,
  HookHandler,
  SyncHookHandler,
  AsyncHookHandler,
  
  // Context types
  PreCommandContext,
  PostCommandContext,
  PreToolContext,
  PostToolContext,
  ErrorContext,
  ResponseContext,
  
  // Handler types
  PreCommandHandler,
  PostCommandHandler,
  PreToolHandler,
  PostToolHandler,
  ErrorHandler,
  ResponseHandler,
  
  // Definition types
  PreCommandHook,
  PostCommandHook,
  PreToolHook,
  PostToolHook,
  ErrorHook,
  ResponseHook,
  HookMetadata,
  HookCondition,
  
  // Registration types
  HookRegistration,
  HookRegistrationOptions,
  HookRegistrationResult,
  HookExecutionStats,
  
  // Engine types
  HookEngineConfig,
  HookEngineState,
  HookExecutionOptions,
  HookExecutionResult,
  
  // Runner types
  HookRunnerConfig,
  HookBatchResult,
  HookMiddleware,
  
  // Built-in types
  BuiltInHookType,
  PreCommandConfig,
  PostCommandConfig,
  PreToolConfig,
  PostToolConfig,
  ErrorHookConfig,
  ResponseHookConfig,
  
  // Event types
  HookEventType,
  HookEvent,
  HookEventListener,
  
  // Type guards
  isHookContext,
  isPreCommandContext,
  isPostCommandContext,
  isPreToolContext,
  isPostToolContext,
  isErrorContext,
  isResponseContext
} from './types';

// ============================================================================
// Built-in Hooks Exports
// ============================================================================

export {
  createPreCommandHook,
  createPreCommandValidator,
  createPreCommandLogger,
  createPreCommandTransformer,
  PreCommandHookImpl
} from './builtin/pre-command';

export {
  createPostCommandHook,
  createPostCommandLogger,
  createPostCommandHistoryTracker,
  createPostCommandNotifier,
  PostCommandHookImpl
} from './builtin/post-command';

export {
  createPreToolHook,
  createPreToolValidator,
  createPreToolLogger,
  createPreToolRateLimiter,
  PreToolHookImpl
} from './builtin/pre-tool';

export {
  createPostToolHook,
  createPostToolLogger,
  createPostToolCache,
  createPostToolResultProcessor,
  PostToolHookImpl
} from './builtin/post-tool';

export {
  createErrorHook,
  createErrorLogger,
  createErrorRetryHandler,
  createErrorNotifier,
  ErrorHookImpl
} from './builtin/on-error';

export {
  createResponseHook,
  createResponseParser,
  createResponseValidator,
  createResponseLogger,
  ResponseHookImpl
} from './builtin/on-response';

// ============================================================================
// Utility Functions
// ============================================================================

import { HookRegistry } from './HookRegistry';
import { HookEngine } from './HookEngine';
import { HookRunner } from './HookRunner';
import { HookDefinition, HookContext, HookPriority, HookPhase } from './types';

/**
 * Create a hook definition with defaults
 */
export function createHook<TContext extends HookContext>(
  id: string,
  name: string,
  type: string,
  handler: (context: TContext) => Promise<TContext> | TContext,
  options: Partial<Omit<HookDefinition<TContext>, 'id' | 'name' | 'type' | 'handler'>> = {}
): HookDefinition<TContext> {
  return {
    id,
    name,
    type,
    description: options.description || '',
    phase: options.phase || HookPhase.BEFORE,
    priority: options.priority ?? HookPriority.NORMAL,
    enabled: options.enabled ?? true,
    handler,
    conditions: options.conditions,
    timeoutMs: options.timeoutMs,
    retryable: options.retryable ?? false,
    maxRetries: options.maxRetries ?? 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: options.meta?.tags || [],
      dependencies: options.meta?.dependencies || [],
      dependents: options.meta?.dependents || [],
      ...options.meta
    }
  };
}

/**
 * Compose multiple hooks into a single hook
 */
export function composeHooks<TContext extends HookContext>(
  hooks: Array<(context: TContext) => Promise<TContext> | TContext>
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    let result = context;
    for (const hook of hooks) {
      result = await hook(result);
      if (result.cancel) {
        break;
      }
    }
    return result;
  };
}

/**
 * Create a conditional hook that only executes when condition is met
 */
export function conditionalHook<TContext extends HookContext>(
  condition: (context: TContext) => boolean | Promise<boolean>,
  handler: (context: TContext) => Promise<TContext> | TContext
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    const shouldExecute = await condition(context);
    if (shouldExecute) {
      return handler(context);
    }
    return context;
  };
}

/**
 * Create a retryable hook wrapper
 */
export function withRetry<TContext extends HookContext>(
  handler: (context: TContext) => Promise<TContext> | TContext,
  maxRetries: number,
  delayMs: number = 1000
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError;
  };
}

/**
 * Create a timeout wrapper for hooks
 */
export function withTimeout<TContext extends HookContext>(
  handler: (context: TContext) => Promise<TContext> | TContext,
  timeoutMs: number
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    return Promise.race([
      handler(context),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Hook timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  };
}

/**
 * Create a logging wrapper for hooks
 */
export function withLogging<TContext extends HookContext>(
  handler: (context: TContext) => Promise<TContext> | TContext,
  hookName: string
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    const startTime = Date.now();
    console.log(`[Hook:${hookName}] Starting execution`);
    
    try {
      const result = await handler(context);
      const duration = Date.now() - startTime;
      console.log(`[Hook:${hookName}] Completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Hook:${hookName}] Failed after ${duration}ms:`, error);
      throw error;
    }
  };
}

// ============================================================================
// Hooks Manager
// ============================================================================

/**
 * Hooks Manager class
 * 
 * Provides a high-level API for managing hooks
 */
export class HooksManager {
  private registry: HookRegistry;
  private engine: HookEngine;
  private runner: HookRunner;

  constructor() {
    this.registry = new HookRegistry();
    this.engine = new HookEngine();
    this.runner = new HookRunner(this.registry);
  }

  /**
   * Initialize the hooks system
   */
  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  /**
   * Shutdown the hooks system
   */
  async shutdown(): Promise<void> {
    await this.engine.shutdown();
    this.runner.dispose();
  }

  /**
   * Register a hook
   */
  register<TContext extends HookContext>(
    hook: HookDefinition<TContext>,
    options?: import('./types').HookRegistrationOptions
  ): import('./types').HookRegistrationResult {
    return this.registry.register(hook, options);
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    return this.registry.unregister(hookId);
  }

  /**
   * Get the registry
   */
  getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Get the engine
   */
  getEngine(): HookEngine {
    return this.engine;
  }

  /**
   * Get the runner
   */
  getRunner(): HookRunner {
    return this.runner;
  }
}

// ============================================================================
// Default Instance
// ============================================================================

let defaultManager: HooksManager | null = null;

/**
 * Get the default hooks manager instance
 */
export function getHooksManager(): HooksManager {
  if (!defaultManager) {
    defaultManager = new HooksManager();
  }
  return defaultManager;
}

/**
 * Reset the default hooks manager instance
 */
export function resetHooksManager(): void {
  defaultManager = null;
}

// ============================================================================
// Version
// ============================================================================

export const HOOKS_VERSION = '1.0.0';
