/**
 * types.ts
 * 
 * Plugin API Type Definitions
 * 
 * This file defines the public types exposed by the plugin API for
 * third-party plugin development.
 * 
 * @module PluginAPI
 * @author Claude Code Clone
 * @version 1.0.0
 */

// Re-export core plugin types
export {
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
  ModalOptions,
  ModalResult,
  ProgressHandle,
  StatusBarItemOptions,
  WebviewPanelOptions,
  PluginNetwork,
  NetworkRequestOptions,
  NetworkResponse,
  WebSocketOptions,
  WebSocketConnection,
  PluginFileSystem,
  FileStats,
  CopyOptions,
  WatchOptions,
  FileWatcher,
  PluginShell,
  ShellExecuteOptions,
  ShellExecuteResult,
  ShellStream,
  ShellSpawnOptions,
  ShellProcess,
  PluginLLM,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMTokenUsage,
  LLMTool,
  LLMToolCall,
  LLMStream,
  LLMModelInfo,
  PluginState,
  PluginLifecycleEvent,
  PluginStats,
  PluginConstructor
} from '../Plugin';

// Re-export hook types
export {
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
  HookDataType,
  HookName,
  HookEvents
} from '../hooks';

// Re-export manager types
export {
  PluginManagerOptions,
  PluginLoadOptions,
  PluginUnloadOptions,
  PluginOperationResult,
  PluginError,
  PluginErrorCode,
  PluginInfo,
  PluginManagerStats
} from '../PluginManager';

// Re-export registry types
export {
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
} from '../PluginRegistry';

// Re-export loader types
export {
  PluginLoaderOptions,
  SandboxConfig,
  PluginSource,
  PluginLoadResult,
  PluginLoadError,
  PluginLoadErrorCode,
  PluginScanResult
} from '../PluginLoader';

// Re-export validator types
export {
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
} from '../PluginValidator';

// Re-export hook registry types
export {
  HookRegistryOptions,
  HookFilterOptions,
  HookSearchResult
} from '../hooks/HookRegistry';

// Re-export hook manager types
export {
  HookManagerOptions
} from '../hooks/HookManager';

// ============================================================================
// Plugin Manifest Types
// ============================================================================

/**
 * Plugin manifest for distribution
 */
export interface PluginManifest {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Entry point file */
  main: string;
  /** Plugin files */
  files: string[];
  /** Plugin assets */
  assets?: string[];
  /** Plugin dependencies */
  dependencies?: Record<string, string>;
  /** Plugin configuration schema */
  configSchema?: ConfigSchemaEntry[];
  /** Minimum host version */
  minHostVersion?: string;
  /** Maximum host version */
  maxHostVersion?: string;
  /** Plugin icon */
  icon?: string;
  /** Plugin readme */
  readme?: string;
  /** Plugin changelog */
  changelog?: string;
  /** Plugin license */
  license?: string;
}

// ============================================================================
// Plugin Development Types
// ============================================================================

/**
 * Plugin development context
 */
export interface PluginDevContext {
  /** Plugin directory */
  pluginDir: string;
  /** Build directory */
  buildDir: string;
  /** Watch mode */
  watch: boolean;
  /** Hot reload */
  hotReload: boolean;
}

/**
 * Plugin build result
 */
export interface PluginBuildResult {
  success: boolean;
  outputPath: string;
  files: string[];
  errors: string[];
  warnings: string[];
  size: number;
}

/**
 * Plugin test result
 */
export interface PluginTestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
  };
}

// ============================================================================
// Plugin Marketplace Types
// ============================================================================

/**
 * Plugin package info
 */
export interface PluginPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl: string;
  iconUrl?: string;
  size: number;
  checksum: string;
  publishedAt: Date;
  updatedAt: Date;
  downloads: number;
  rating: number;
  reviews: number;
  tags: string[];
}

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  /** Version to install */
  version?: string;
  /** Force reinstall */
  force?: boolean;
  /** Enable after install */
  enable?: boolean;
  /** Install dependencies */
  installDependencies?: boolean;
}

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  success: boolean;
  pluginId: string;
  version: string;
  installPath: string;
  errors: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;

/**
 * Async return type
 */
export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> = 
  T extends (...args: any[]) => Promise<infer R> ? R : never;

/**
 * Event handler type
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Disposable interface
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * Closable interface
 */
export interface Closable {
  close(): void | Promise<void>;
}
