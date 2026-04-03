/**
 * Plugin API Index
 * 
 * Public API for third-party plugin development.
 * 
 * @module PluginAPI
 * @author Claude Code Clone
 * @version 1.0.0
 */

// Export types
export * from './types';

// Export context helpers
export {
  createMockContext,
  createMockLogger,
  createMockStorage,
  createMockUI,
  createMockNetwork,
  createMockFileSystem,
  createMockShell,
  createMockLLM,
  validateContext,
  mergeConfig,
  getNestedValue,
  setNestedValue
} from './context';

// Export helpers
export {
  createPlugin,
  createConfigurablePlugin,
  getConfigValue,
  setConfigValue,
  validateConfig,
  createHookHandler,
  createCancellableHandler,
  createPrefixedLogger,
  truncate,
  toKebabCase,
  toCamelCase,
  unique,
  chunk,
  flatten,
  pick,
  omit,
  deepClone,
  sleep,
  withTimeout,
  retry,
  isValidPluginId,
  isValidVersion,
  isEmpty,
  createEventEmitter
} from './helpers';

// Re-export core classes for extension
export { Plugin } from '../Plugin';
export { HookManager } from '../hooks/HookManager';
export { HookRegistry } from '../hooks/HookRegistry';

// Export version
export const API_VERSION = '1.0.0';

// Default export
export { Plugin as default } from '../Plugin';
