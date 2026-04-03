/**
 * Hooks Module Index
 * 
 * Exports all hook system components.
 * 
 * @module HookSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

// Export types
export * from './types';

// Export HookManager
export { HookManager, HookManagerOptions } from './HookManager';

// Export HookRegistry
export { HookRegistry, HookRegistryOptions, HookFilterOptions, HookSearchResult } from './HookRegistry';

// Export hook implementations
export * from './implementations';

// Default export
export { HookManager as default } from './HookManager';
