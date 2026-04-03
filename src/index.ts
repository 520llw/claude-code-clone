/**
 * Claude Code Clone - Main Entry Point
 * 
 * This is the main library entry point that exports all public APIs.
 */

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Types
// ============================================================================

export * from './types/index';

// ============================================================================
// Configuration
// ============================================================================

export {
  ConfigManager,
  loadConfig,
  DEFAULT_CONFIG,
  // Schemas
  AppConfigSchema,
  ModelConfigSchema,
  ContextConfigSchema,
  PermissionConfigSchema,
  PluginConfigSchema,
  MCPConfigSchema,
  TelemetryConfigSchema,
  UIConfigSchema,
} from './config/index';

// ============================================================================
// Core
// ============================================================================

export {
  // Base classes
  DisposableBase,
  EventEmitterBase,
  BaseAgent,
  BaseTool,
  BaseCommand,
  BasePlugin,
  BaseSkill,
  BaseContextCompressor,
  
  // Error system
  ClaudeCodeError,
  ConfigError,
  ConfigParseError,
  ConfigValidationError,
  AgentError,
  AgentInitializationError,
  AgentExecutionError,
  AgentCommunicationError,
  ToolError,
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionError,
  ToolPermissionDeniedError,
  QueryEngineError,
  LLMError,
  StreamingError,
  RateLimitError,
  ContextError,
  ContextOverflowError,
  CompressionError,
  PluginError,
  PluginLoadError,
  PluginActivationError,
  PluginHookError,
  SessionError,
  SessionNotFoundError,
  SessionCorruptedError,
  MCPError,
  ValidationError,
  ErrorRecoverySuggestions,
  GlobalErrorHandler,
  globalErrorHandler,
  isClaudeCodeError,
  isRecoverable,
  getErrorDetails,
  createError,
  
  // Event system
  EventEmitter,
  EventBus,
  TypedEventEmitter,
  EventPipeline,
  EventPriority,
  SystemEvents,
  AgentEvents,
  SessionEvents,
  ToolEvents,
  PluginEvents,
  eventBus,
  
  // Version
  VERSION as CORE_VERSION,
} from './core/index';

// ============================================================================
// Interfaces (re-exported from core)
// ============================================================================

export type {
  IDisposable,
  IEventEmitter,
  ILogger,
  LogLevel,
  IConfigManager,
  IAgent,
  IAgentOrchestrator,
  ITool,
  IToolRegistry,
  ICommand,
  ICommandRegistry,
  CommandContext,
  CommandResult,
  IContextManager,
  IContextCompressor,
  ISessionManager,
  IPlugin,
  IPluginRegistry,
  IHookRegistry,
  HookHandler,
  HookExecutionContext,
  ISkill,
  ISkillRegistry,
  SkillContext,
  IQueryEngine,
  QueryOptions,
  QueryResult,
  TokenUsage,
  ModelInfo,
  IMCPClient,
  ITelemetryService,
  IPermissionManager,
  ICache,
  IErrorHandler,
  ErrorHandlerFn,
  IFeatureFlags,
  IUIComponent,
  IFileSystem,
  IGitClient,
} from './core/index';

// ============================================================================
// Agent Module
// ============================================================================

export {
  BaseAgent as AgentBase,
} from './agent/index';

// ============================================================================
// Tools Module
// ============================================================================

export {
  BaseTool as ToolBase,
} from './tools/index';

// ============================================================================
// Commands Module
// ============================================================================

export {
  BaseCommand as CommandBase,
} from './commands/index';

// ============================================================================
// Plugins Module
// ============================================================================

export {
  BasePlugin as PluginBase,
} from './plugins/index';

// ============================================================================
// Context Module
// ============================================================================

export {
  BaseContextCompressor as ContextCompressorBase,
} from './context/index';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Logger
  Logger,
  NoOpLogger,
  LoggerFactory,
  createLogger,
  getDefaultLogger,
  getLogger,
} from './utils/index';

// ============================================================================
// UI (for custom UIs)
// ============================================================================

export {
  App as UIApp,
  ChatInput,
  MessageList,
  StatusBar,
  ToolPanel,
  useMessages,
  useSession,
  defaultTheme,
  darkTheme,
  lightTheme,
} from './ui/index';

export type { Theme } from './ui/index';

// ============================================================================
// Default Export
// ============================================================================

export default {
  VERSION,
  ConfigManager,
};
