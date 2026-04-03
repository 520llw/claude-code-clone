/**
 * Tools Module
 * 
 * This module exports all tool-related classes and interfaces.
 */

// Types
export type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolCategory,
  Permission,
  PermissionLevel,
} from '@types/index';

// Re-export from core
export { BaseTool } from '@core/base-classes';
export type { ITool, IToolRegistry } from '@core/interfaces';

// Placeholder for future tool implementations
// These will be implemented in separate files:
// - registry.ts
// - permissions.ts
// - validators.ts
// - definitions/*.ts (filesystem.ts, search.ts, bash.ts, edit.ts, etc.)
