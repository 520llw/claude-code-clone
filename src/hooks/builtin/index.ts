/**
 * Built-in Hooks
 * 
 * Pre-built hooks for common use cases in the Claude Code hooks system.
 */

// ============================================================================
// Pre-Command Hooks
// ============================================================================

export {
  PreCommandHookImpl,
  createPreCommandHook,
  createPreCommandValidator,
  createPreCommandLogger,
  createPreCommandTransformer,
  createPreCommandPermissionCheck,
  createPreCommandRateLimiter,
  createPreCommandAudit
} from './pre-command';

// ============================================================================
// Post-Command Hooks
// ============================================================================

export {
  PostCommandHookImpl,
  createPostCommandHook,
  createPostCommandLogger,
  createPostCommandHistoryTracker,
  createPostCommandNotifier,
  createPostCommandMetricsCollector,
  createPostCommandResultProcessor,
  createPostCommandCleanup
} from './post-command';

// ============================================================================
// Pre-Tool Hooks
// ============================================================================

export {
  PreToolHookImpl,
  createPreToolHook,
  createPreToolValidator,
  createPreToolLogger,
  createPreToolRateLimiter,
  createPreToolTransformer,
  createPreToolAccessControl,
  createPreToolParameterSanitizer
} from './pre-tool';

// ============================================================================
// Post-Tool Hooks
// ============================================================================

export {
  PostToolHookImpl,
  createPostToolHook,
  createPostToolLogger,
  createPostToolCache,
  createPostToolResultProcessor,
  createPostToolMetricsCollector,
  createPostToolResultValidator,
  createPostToolCleanup
} from './post-tool';

// ============================================================================
// Error Hooks
// ============================================================================

export {
  ErrorHookImpl,
  createErrorHook,
  createErrorLogger,
  createErrorRetryHandler,
  createErrorNotifier,
  createErrorFallbackHandler,
  createErrorMetricsCollector,
  createErrorCircuitBreaker
} from './on-error';

// ============================================================================
// Response Hooks
// ============================================================================

export {
  ResponseHookImpl,
  createResponseHook,
  createResponseParser,
  createResponseValidator,
  createResponseLogger,
  createResponseTransformer,
  createResponseContentFilter,
  createResponseMetricsCollector,
  createResponseCache
} from './on-response';

// ============================================================================
// Hook Presets
// ============================================================================

import { HookRegistry } from '../HookRegistry';
import { createPreCommandLogger, createPreCommandValidator } from './pre-command';
import { createPostCommandLogger, createPostCommandHistoryTracker } from './post-command';
import { createPreToolLogger, createPreToolValidator } from './pre-tool';
import { createPostToolLogger, createPostToolCache } from './post-tool';
import { createErrorLogger, createErrorRetryHandler } from './on-error';
import { createResponseLogger, createResponseValidator } from './on-response';

/**
 * Register all built-in hooks with a registry
 */
export function registerAllBuiltInHooks(registry: HookRegistry): void {
  // Pre-command hooks
  registry.register(createPreCommandLogger());
  registry.register(createPreCommandValidator());

  // Post-command hooks
  registry.register(createPostCommandLogger());
  registry.register(createPostCommandHistoryTracker());

  // Pre-tool hooks
  registry.register(createPreToolLogger());
  registry.register(createPreToolValidator());

  // Post-tool hooks
  registry.register(createPostToolLogger());
  registry.register(createPostToolCache());

  // Error hooks
  registry.register(createErrorLogger());
  registry.register(createErrorRetryHandler(['*'], 3, 1000));

  // Response hooks
  registry.register(createResponseLogger());
  registry.register(createResponseValidator(response => ({
    valid: !!response.content || !!(response.toolCalls && response.toolCalls.length > 0)
  })));
}

/**
 * Register development hooks (verbose logging)
 */
export function registerDevelopmentHooks(registry: HookRegistry): void {
  registry.register(createPreCommandLogger('debug', true));
  registry.register(createPostCommandLogger('debug', true));
  registry.register(createPreToolLogger('debug', true));
  registry.register(createPostToolLogger('debug', true, 1000));
  registry.register(createResponseLogger('debug', true, 1000));
  registry.register(createErrorLogger('debug', true));
}

/**
 * Register production hooks (minimal logging, focus on metrics)
 */
export function registerProductionHooks(registry: HookRegistry): void {
  registry.register(createPreCommandLogger('info', false));
  registry.register(createPostCommandLogger('info', false));
  registry.register(createPreToolLogger('info', false));
  registry.register(createPostToolLogger('info', false, 100));
  registry.register(createResponseLogger('info', false, 100));
  registry.register(createErrorLogger('error', false));
}

/**
 * Register security hooks (access control, sanitization)
 */
export function registerSecurityHooks(
  registry: HookRegistry,
  options: {
    allowedTools?: string[];
    blockedTools?: string[];
    commandWhitelist?: string[];
    commandBlacklist?: string[];
  } = {}
): void {
  const { createPreToolAccessControl, createPreToolParameterSanitizer } = require('./pre-tool');
  const { createPreCommandPermissionCheck } = require('./pre-command');

  if (options.allowedTools || options.blockedTools) {
    registry.register(createPreToolAccessControl(
      options.allowedTools,
      options.blockedTools
    ));
  }

  registry.register(createPreToolParameterSanitizer(params => {
    // Remove sensitive fields
    const sanitized = { ...params };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.apiKey;
    return sanitized;
  }));

  if (options.commandWhitelist || options.commandBlacklist) {
    registry.register(createPreCommandPermissionCheck(
      () => true, // Replace with actual permission check
      'Command not allowed'
    ));
  }
}

/**
 * Register monitoring hooks (metrics, alerting)
 */
export function registerMonitoringHooks(registry: HookRegistry): void {
  const { createPostCommandMetricsCollector } = require('./post-command');
  const { createPostToolMetricsCollector } = require('./post-tool');
  const { createErrorMetricsCollector } = require('./on-error');
  const { createResponseMetricsCollector } = require('./on-response');

  registry.register(createPostCommandMetricsCollector(metrics => {
    // Send to monitoring system
    console.log('[Metrics] Command:', metrics);
  }));

  registry.register(createPostToolMetricsCollector(metrics => {
    console.log('[Metrics] Tool:', metrics);
  }));

  registry.register(createErrorMetricsCollector(metrics => {
    console.log('[Metrics] Error:', metrics);
  }));

  registry.register(createResponseMetricsCollector(metrics => {
    console.log('[Metrics] Response:', metrics);
  }));
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Hook preset names
 */
export type HookPreset = 'default' | 'development' | 'production' | 'security' | 'monitoring';

/**
 * Apply a hook preset to a registry
 */
export function applyHookPreset(
  registry: HookRegistry,
  preset: HookPreset,
  options?: Record<string, unknown>
): void {
  switch (preset) {
    case 'default':
      registerAllBuiltInHooks(registry);
      break;
    case 'development':
      registerDevelopmentHooks(registry);
      break;
    case 'production':
      registerProductionHooks(registry);
      break;
    case 'security':
      registerSecurityHooks(registry, options as any);
      break;
    case 'monitoring':
      registerMonitoringHooks(registry);
      break;
    default:
      throw new Error(`Unknown hook preset: ${preset}`);
  }
}
