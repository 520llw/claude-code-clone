/**
 * Plugin System Index
 * 
 * Main entry point for the Claude Code Clone plugin system.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

// ============================================================================
// Core Plugin Classes
// ============================================================================

export {
  Plugin,
  PluginMetadata,
  PluginAuthor,
  PluginCategory,
  ConfigSchemaEntry,
  PluginConfig,
  PluginDependency,
  PluginCapabilities,
  PluginContext,
  PluginLogger,
  PluginStorage,
  PluginUI,
  PluginNetwork,
  PluginFileSystem,
  PluginShell,
  PluginLLM,
  PluginState,
  PluginLifecycleEvent,
  PluginStats,
  PluginConstructor,
  isPluginConstructor
} from './Plugin';

export {
  PluginManager,
  PluginManagerOptions,
  PluginLoadOptions,
  PluginUnloadOptions,
  PluginOperationResult,
  PluginError,
  PluginErrorCode,
  PluginInfo,
  PluginManagerStats
} from './PluginManager';

export {
  PluginRegistry,
  RegisteredPlugin,
  PluginSourceType,
  PluginRegistrationStatus,
  PluginReview,
  PluginSearchOptions,
  PluginSearchResult,
  MarketplacePackage,
  RegistryOptions,
  RegistryStorage,
  PluginUpdateInfo,
  RegistryStats
} from './PluginRegistry';

export {
  PluginLoader,
  PluginLoaderOptions,
  SandboxConfig,
  PluginSource,
  PluginLoadResult,
  PluginLoadError,
  PluginLoadErrorCode,
  PluginScanResult
} from './PluginLoader';

export {
  PluginValidator,
  ValidationOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationErrorCode,
  ValidationWarningCode,
  ValidationDetails,
  CodeAnalysisResult,
  SecurityIssue,
  QualityIssue,
  ValidatorOptions
} from './PluginValidator';

// ============================================================================
// Hook System
// ============================================================================

export {
  // Types
  HookPriority,
  HookExecutionOrder,
  HookPhase,
  HookHandler,
  AsyncHookHandler,
  SyncHookHandler,
  HookHandlerInfo,
  HookContext,
  HookResult,
  HandlerResult,
  HookExecutionError,
  HookErrorCode,
  HookExecutionOptions,
  HookRegistrationOptions,
  HookDefinition,
  HookCategory,
  HookSchema,
  RegisteredHook,
  HookStatistics,
  HookDataType,
  HookName,
  HookEvents,
  
  // Hook data types
  OnInitData,
  OnMessageData,
  OnToolCallData,
  OnToolResultData,
  OnResponseData,
  OnErrorData,
  OnSessionStartData,
  OnSessionEndData,
  OnFileChangeData,
  OnCommandData,
  OnContextCompactData,
  OnPermissionRequestData,
  OnLLMCallData,
  OnStreamTokenData,
  OnExitData,
  
  // Hook Manager and Registry
  HookManager,
  HookManagerOptions,
  HookRegistry,
  HookRegistryOptions,
  HookFilterOptions,
  HookSearchResult
} from './hooks';

// ============================================================================
// Built-in Plugins
// ============================================================================

export { GitPlugin } from './builtin/GitPlugin';
export { GitHubPlugin } from './builtin/GitHubPlugin';
export { TelemetryPlugin } from './builtin/TelemetryPlugin';
export { ThemePlugin } from './builtin/ThemePlugin';
export { HistoryPlugin } from './builtin/HistoryPlugin';
export { AliasPlugin } from './builtin/AliasPlugin';

// ============================================================================
// Plugin API
// ============================================================================

export * from './api';

// ============================================================================
// Default Export
// ============================================================================

import { PluginManager } from './PluginManager';
export default PluginManager;
