/**
 * PluginManager.ts
 * 
 * Plugin Lifecycle Management for Claude Code Clone Plugin System
 * 
 * This file implements the PluginManager class which is responsible for:
 * - Plugin lifecycle management (load, activate, deactivate, unload)
 * - Plugin dependency resolution and ordering
 * - Plugin state tracking and transitions
 * - Plugin event coordination
 * - Plugin error handling and recovery
 * - Plugin configuration management
 * - Plugin sandbox management
 * 
 * The PluginManager is the central coordinator for all plugin-related operations
 * and ensures proper isolation, security, and resource management.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Plugin,
  PluginMetadata,
  PluginContext,
  PluginConfig,
  PluginState,
  PluginLifecycleEvent,
  PluginDependency,
  PluginLogger,
  PluginStats,
  PluginConstructor,
  isPluginConstructor
} from './Plugin';
import { PluginRegistry } from './PluginRegistry';
import { PluginLoader } from './PluginLoader';
import { PluginValidator } from './PluginValidator';
import { HookManager } from './hooks/HookManager';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Plugin manager configuration options
 */
export interface PluginManagerOptions {
  /** Directory to load plugins from */
  pluginsDirectory?: string;
  /** Directory for plugin data */
  dataDirectory?: string;
  /** Enable hot reloading of plugins */
  hotReload?: boolean;
  /** Maximum number of concurrent plugin loads */
  maxConcurrentLoads?: number;
  /** Default plugin timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable plugin sandboxing */
  enableSandbox?: boolean;
  /** Allowed plugin sources */
  allowedSources?: string[];
  /** Blocked plugin IDs */
  blockedPlugins?: string[];
  /** Required plugin IDs */
  requiredPlugins?: string[];
  /** Plugin configuration overrides */
  configOverrides?: Record<string, PluginConfig>;
  /** Host application version */
  hostVersion: string;
  /** Host application API */
  hostApi: any;
}

/**
 * Plugin load options
 */
export interface PluginLoadOptions {
  /** Plugin configuration */
  config?: PluginConfig;
  /** Skip dependency resolution */
  skipDependencies?: boolean;
  /** Force reload if already loaded */
  force?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Source of the plugin */
  source?: string;
  /** Whether to activate immediately */
  activate?: boolean;
}

/**
 * Plugin unload options
 */
export interface PluginUnloadOptions {
  /** Force unload even if dependencies exist */
  force?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Reason for unloading */
  reason?: string;
}

/**
 * Plugin operation result
 */
export interface PluginOperationResult<T = any> {
  success: boolean;
  pluginId?: string;
  instanceId?: string;
  data?: T;
  error?: PluginError;
  duration: number;
}

/**
 * Plugin error information
 */
export interface PluginError {
  code: PluginErrorCode;
  message: string;
  details?: any;
  stack?: string;
  cause?: Error;
}

/**
 * Plugin error codes
 */
export enum PluginErrorCode {
  UNKNOWN = 'UNKNOWN',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_LOADED = 'ALREADY_LOADED',
  NOT_LOADED = 'NOT_LOADED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  DEPENDENCY_VERSION_MISMATCH = 'DEPENDENCY_VERSION_MISMATCH',
  DEPENDENCY_CYCLE = 'DEPENDENCY_CYCLE',
  ACTIVATION_FAILED = 'ACTIVATION_FAILED',
  DEACTIVATION_FAILED = 'DEACTIVATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  SANDBOX_VIOLATION = 'SANDBOX_VIOLATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONFIG_INVALID = 'CONFIG_INVALID',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  SOURCE_NOT_ALLOWED = 'SOURCE_NOT_ALLOWED',
  PLUGIN_BLOCKED = 'PLUGIN_BLOCKED',
  HOOK_REGISTRATION_FAILED = 'HOOK_REGISTRATION_FAILED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}

/**
 * Plugin dependency graph node
 */
interface DependencyNode {
  pluginId: string;
  dependencies: string[];
  dependents: string[];
  visited: boolean;
  visiting: boolean;
  depth: number;
}

/**
 * Plugin instance wrapper
 */
interface PluginInstance {
  plugin: Plugin;
  metadata: PluginMetadata;
  instanceId: string;
  state: PluginState;
  config: PluginConfig;
  source?: string;
  loadTime?: Date;
  activateTime?: Date;
  error?: PluginError;
  disposables: Array<() => void>;
}

// ============================================================================
// Plugin Manager Class
// ============================================================================

/**
 * PluginManager - Central coordinator for plugin lifecycle management.
 * 
 * The PluginManager is responsible for:
 * - Loading and unloading plugins
 * - Activating and deactivating plugins
 * - Managing plugin dependencies
 * - Tracking plugin state
 * - Handling plugin errors
 * - Coordinating plugin events
 * 
 * @example
 * ```typescript
 * const manager = new PluginManager({
 *   pluginsDirectory: './plugins',
 *   hostVersion: '1.0.0',
 *   hostApi: api
 * });
 * 
 * // Load a plugin
 * await manager.loadPlugin('./plugins/my-plugin');
 * 
 * // Activate all loaded plugins
 * await manager.activateAll();
 * 
 * // Get plugin info
 * const info = manager.getPluginInfo('com.example.myplugin');
 * ```
 */
export class PluginManager extends EventEmitter {
  /**
   * Plugin registry for plugin discovery
   */
  private registry: PluginRegistry;

  /**
   * Plugin loader for dynamic loading
   */
  private loader: PluginLoader;

  /**
   * Plugin validator for validation
   */
  private validator: PluginValidator;

  /**
   * Hook manager for hook coordination
   */
  private hookManager: HookManager;

  /**
   * Loaded plugin instances
   */
  private instances: Map<string, PluginInstance> = new Map();

  /**
   * Plugin instances by ID
   */
  private instancesById: Map<string, PluginInstance> = new Map();

  /**
   * Manager configuration
   */
  private options: PluginManagerOptions;

  /**
   * Logger instance
   */
  private logger: PluginLogger;

  /**
   * Whether the manager is initialized
   */
  private initialized: boolean = false;

  /**
   * Operation queue for sequential operations
   */
  private operationQueue: Array<() => Promise<void>> = [];

  /**
   * Queue processing flag
   */
  private processingQueue: boolean = false;

  /**
   * Hot reload watchers
   */
  private hotReloadWatchers: Map<string, any> = new Map();

  /**
   * Creates a new PluginManager instance.
   * 
   * @param options - Manager configuration options
   */
  constructor(options: PluginManagerOptions) {
    super();
    this.setMaxListeners(200);

    this.options = {
      maxConcurrentLoads: 5,
      defaultTimeout: 30000,
      enableSandbox: true,
      hotReload: false,
      allowedSources: ['official', 'verified', 'local'],
      blockedPlugins: [],
      requiredPlugins: [],
      ...options
    };

    // Initialize logger
    this.logger = this.createLogger();

    // Initialize components
    this.registry = new PluginRegistry();
    this.loader = new PluginLoader({
      pluginsDirectory: this.options.pluginsDirectory,
      enableSandbox: this.options.enableSandbox
    });
    this.validator = new PluginValidator({
      hostVersion: this.options.hostVersion,
      allowedSources: this.options.allowedSources,
      blockedPlugins: this.options.blockedPlugins
    });
    this.hookManager = new HookManager();

    // Set up event handlers
    this.setupEventHandlers();

    this.logger.info('PluginManager created');
  }

  /**
   * Creates the plugin manager logger.
   * 
   * @returns Logger instance
   */
  private createLogger(): PluginLogger {
    return {
      debug: (message: string, ...args: any[]) => {
        console.debug(`[PluginManager] ${message}`, ...args);
        this.emit('log', { level: 'debug', message, args });
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[PluginManager] ${message}`, ...args);
        this.emit('log', { level: 'info', message, args });
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[PluginManager] ${message}`, ...args);
        this.emit('log', { level: 'warn', message, args });
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[PluginManager] ${message}`, ...args);
        this.emit('log', { level: 'error', message, args });
      },
      trace: (message: string, ...args: any[]) => {
        console.trace(`[PluginManager] ${message}`, ...args);
        this.emit('log', { level: 'trace', message, args });
      }
    };
  }

  /**
   * Sets up internal event handlers.
   */
  private setupEventHandlers(): void {
    // Forward hook events
    this.hookManager.on('hookExecuted', (event) => {
      this.emit('hookExecuted', event);
    });

    this.hookManager.on('hookError', (event) => {
      this.emit('hookError', event);
    });

    // Forward loader events
    this.loader.on('pluginLoaded', (event) => {
      this.emit('pluginLoaded', event);
    });

    this.loader.on('pluginLoadError', (event) => {
      this.emit('pluginLoadError', event);
    });
  }

  /**
   * Initializes the plugin manager.
   * 
   * @returns A promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('PluginManager already initialized');
      return;
    }

    this.logger.info('Initializing PluginManager...');

    try {
      // Initialize registry
      await this.registry.initialize();

      // Initialize loader
      await this.loader.initialize();

      // Initialize hook manager
      await this.hookManager.initialize();

      // Scan for plugins if directory is specified
      if (this.options.pluginsDirectory) {
        await this.scanPlugins();
      }

      this.initialized = true;
      this.logger.info('PluginManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize PluginManager:', error);
      throw error;
    }
  }

  /**
   * Scans the plugins directory for available plugins.
   * 
   * @returns A promise that resolves when scanning is complete
   */
  public async scanPlugins(): Promise<PluginMetadata[]> {
    this.logger.info('Scanning for plugins...');

    try {
      const plugins = await this.loader.scanPlugins();
      
      for (const metadata of plugins) {
        this.registry.register(metadata);
      }

      this.logger.info(`Found ${plugins.length} plugins`);
      this.emit('pluginsScanned', { count: plugins.length, plugins });

      return plugins;
    } catch (error) {
      this.logger.error('Failed to scan plugins:', error);
      throw error;
    }
  }

  /**
   * Loads a plugin from a path or package.
   * 
   * @param source - Plugin source (path, package name, or plugin ID)
   * @param options - Load options
   * @returns A promise that resolves with the load result
   */
  public async loadPlugin(
    source: string,
    options: PluginLoadOptions = {}
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();
    const instanceId = uuidv4();

    this.logger.info(`Loading plugin from source: ${source}`);

    try {
      // Check if already loaded
      if (!options.force) {
        const existingInstance = this.findInstanceBySource(source);
        if (existingInstance) {
          return {
            success: false,
            pluginId: existingInstance.metadata.id,
            instanceId: existingInstance.instanceId,
            error: {
              code: PluginErrorCode.ALREADY_LOADED,
              message: `Plugin ${existingInstance.metadata.id} is already loaded`
            },
            duration: Date.now() - startTime
          };
        }
      }

      // Load plugin module
      const loadResult = await this.loader.load(source);
      
      if (!loadResult.success || !loadResult.pluginConstructor) {
        return {
          success: false,
          error: loadResult.error || {
            code: PluginErrorCode.UNKNOWN,
            message: 'Failed to load plugin module'
          },
          duration: Date.now() - startTime
        };
      }

      const PluginClass = loadResult.pluginConstructor;
      const metadata = loadResult.metadata!;

      // Validate plugin
      const validationResult = this.validator.validate(metadata, {
        checkVersion: true,
        checkSource: true,
        checkBlocked: true
      });

      if (!validationResult.valid) {
        return {
          success: false,
          pluginId: metadata.id,
          error: {
            code: PluginErrorCode.VALIDATION_FAILED,
            message: `Plugin validation failed: ${validationResult.errors.join(', ')}`,
            details: validationResult.errors
          },
          duration: Date.now() - startTime
        };
      }

      // Resolve dependencies
      if (!options.skipDependencies && metadata.dependencies) {
        const dependencyResult = await this.resolveDependencies(metadata);
        if (!dependencyResult.success) {
          return {
            success: false,
            pluginId: metadata.id,
            error: dependencyResult.error,
            duration: Date.now() - startTime
          };
        }
      }

      // Create plugin instance
      const plugin = new PluginClass();

      // Validate plugin class
      if (!this.validatePluginInstance(plugin, metadata)) {
        return {
          success: false,
          pluginId: metadata.id,
          error: {
            code: PluginErrorCode.VALIDATION_FAILED,
            message: 'Plugin instance validation failed'
          },
          duration: Date.now() - startTime
        };
      }

      // Merge configuration
      const config = this.mergeConfig(metadata.id, options.config, plugin.getDefaultConfig());

      // Validate configuration
      const configValidation = plugin.validateConfig(config);
      if (!configValidation.valid) {
        return {
          success: false,
          pluginId: metadata.id,
          error: {
            code: PluginErrorCode.CONFIG_INVALID,
            message: `Invalid configuration: ${configValidation.errors.join(', ')}`,
            details: configValidation.errors
          },
          duration: Date.now() - startTime
        };
      }

      // Create plugin context
      const context = await this.createPluginContext(instanceId, metadata, config);
      plugin.setContext(context);

      // Create instance wrapper
      const instance: PluginInstance = {
        plugin,
        metadata,
        instanceId,
        state: PluginState.LOADED,
        config,
        source,
        loadTime: new Date(),
        disposables: []
      };

      // Store instance
      this.instances.set(instanceId, instance);
      this.instancesById.set(metadata.id, instance);

      // Set up plugin event handlers
      this.setupPluginEventHandlers(instance);

      // Update plugin state
      plugin.setState(PluginState.LOADED);

      this.logger.info(`Plugin ${metadata.id} loaded successfully`);
      this.emit('pluginLoaded', { instanceId, metadata, source });

      // Activate if requested
      if (options.activate !== false) {
        const activateResult = await this.activatePlugin(metadata.id);
        if (!activateResult.success) {
          // Activation failed, but load succeeded
          this.logger.warn(`Plugin ${metadata.id} loaded but activation failed`);
        }
      }

      return {
        success: true,
        pluginId: metadata.id,
        instanceId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${source}:`, error);
      
      return {
        success: false,
        error: this.createError(PluginErrorCode.UNKNOWN, 'Failed to load plugin', error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Activates a loaded plugin.
   * 
   * @param pluginId - The plugin ID
   * @param timeout - Activation timeout in milliseconds
   * @returns A promise that resolves with the activation result
   */
  public async activatePlugin(
    pluginId: string,
    timeout?: number
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();

    this.logger.info(`Activating plugin: ${pluginId}`);

    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return {
        success: false,
        pluginId,
        error: {
          code: PluginErrorCode.NOT_FOUND,
          message: `Plugin ${pluginId} not found`
        },
        duration: Date.now() - startTime
      };
    }

    // Check state
    if (instance.state === PluginState.ACTIVE) {
      return {
        success: true,
        pluginId,
        instanceId: instance.instanceId,
        duration: Date.now() - startTime
      };
    }

    if (instance.state !== PluginState.LOADED && instance.state !== PluginState.DEACTIVATED) {
      return {
        success: false,
        pluginId,
        instanceId: instance.instanceId,
        error: {
          code: PluginErrorCode.ACTIVATION_FAILED,
          message: `Plugin ${pluginId} is in invalid state: ${instance.state}`
        },
        duration: Date.now() - startTime
      };
    }

    try {
      // Update state
      instance.state = PluginState.ACTIVATING;
      instance.plugin.setState(PluginState.ACTIVATING);

      // Activate with timeout
      const activationTimeout = timeout || this.options.defaultTimeout || 30000;
      
      await this.runWithTimeout(
        () => instance.plugin.onActivate(),
        activationTimeout,
        `Plugin activation timed out after ${activationTimeout}ms`
      );

      // Update state
      instance.state = PluginState.ACTIVE;
      instance.activateTime = new Date();
      instance.plugin.setState(PluginState.ACTIVE);

      // Register hooks with hook manager
      await this.registerPluginHooks(instance);

      this.logger.info(`Plugin ${pluginId} activated successfully`);
      this.emit('pluginActivated', { pluginId, instanceId: instance.instanceId });

      return {
        success: true,
        pluginId,
        instanceId: instance.instanceId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      instance.state = PluginState.ERROR;
      instance.error = this.createError(PluginErrorCode.ACTIVATION_FAILED, 'Activation failed', error);
      instance.plugin.setState(PluginState.ERROR);

      this.logger.error(`Failed to activate plugin ${pluginId}:`, error);
      this.emit('pluginActivationFailed', { pluginId, error: instance.error });

      return {
        success: false,
        pluginId,
        instanceId: instance.instanceId,
        error: instance.error,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Deactivates an active plugin.
   * 
   * @param pluginId - The plugin ID
   * @param options - Unload options
   * @returns A promise that resolves with the deactivation result
   */
  public async deactivatePlugin(
    pluginId: string,
    options: PluginUnloadOptions = {}
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();

    this.logger.info(`Deactivating plugin: ${pluginId}`);

    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return {
        success: false,
        pluginId,
        error: {
          code: PluginErrorCode.NOT_FOUND,
          message: `Plugin ${pluginId} not found`
        },
        duration: Date.now() - startTime
      };
    }

    // Check for dependents
    if (!options.force) {
      const dependents = this.getDependents(pluginId);
      if (dependents.length > 0) {
        return {
          success: false,
          pluginId,
          instanceId: instance.instanceId,
          error: {
            code: PluginErrorCode.DEPENDENCY_MISSING,
            message: `Plugin ${pluginId} has active dependents: ${dependents.join(', ')}`
          },
          duration: Date.now() - startTime
        };
      }
    }

    // Check state
    if (instance.state !== PluginState.ACTIVE) {
      return {
        success: true,
        pluginId,
        instanceId: instance.instanceId,
        duration: Date.now() - startTime
      };
    }

    try {
      // Update state
      instance.state = PluginState.DEACTIVATING;
      instance.plugin.setState(PluginState.DEACTIVATING);

      // Unregister hooks
      await this.unregisterPluginHooks(instance);

      // Deactivate with timeout
      const deactivationTimeout = options.timeout || this.options.defaultTimeout || 30000;
      
      await this.runWithTimeout(
        () => instance.plugin.onDeactivate(),
        deactivationTimeout,
        `Plugin deactivation timed out after ${deactivationTimeout}ms`
      );

      // Clean up resources
      await instance.plugin.cleanup();

      // Run disposables
      for (const disposable of instance.disposables) {
        try {
          disposable();
        } catch (error) {
          this.logger.error(`Error running disposable for ${pluginId}:`, error);
        }
      }

      // Update state
      instance.state = PluginState.DEACTIVATED;
      instance.plugin.setState(PluginState.DEACTIVATED);

      this.logger.info(`Plugin ${pluginId} deactivated successfully`);
      this.emit('pluginDeactivated', { pluginId, instanceId: instance.instanceId, reason: options.reason });

      return {
        success: true,
        pluginId,
        instanceId: instance.instanceId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      instance.state = PluginState.ERROR;
      instance.error = this.createError(PluginErrorCode.DEACTIVATION_FAILED, 'Deactivation failed', error);
      instance.plugin.setState(PluginState.ERROR);

      this.logger.error(`Failed to deactivate plugin ${pluginId}:`, error);
      this.emit('pluginDeactivationFailed', { pluginId, error: instance.error });

      return {
        success: false,
        pluginId,
        instanceId: instance.instanceId,
        error: instance.error,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Unloads a plugin completely.
   * 
   * @param pluginId - The plugin ID
   * @param options - Unload options
   * @returns A promise that resolves with the unload result
   */
  public async unloadPlugin(
    pluginId: string,
    options: PluginUnloadOptions = {}
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();

    this.logger.info(`Unloading plugin: ${pluginId}`);

    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return {
        success: false,
        pluginId,
        error: {
          code: PluginErrorCode.NOT_FOUND,
          message: `Plugin ${pluginId} not found`
        },
        duration: Date.now() - startTime
      };
    }

    // Deactivate first if active
    if (instance.state === PluginState.ACTIVE) {
      const deactivateResult = await this.deactivatePlugin(pluginId, options);
      if (!deactivateResult.success && !options.force) {
        return deactivateResult;
      }
    }

    try {
      // Update state
      instance.state = PluginState.UNLOADING;
      instance.plugin.setState(PluginState.UNLOADING);

      // Remove from collections
      this.instances.delete(instance.instanceId);
      this.instancesById.delete(pluginId);

      // Remove hot reload watcher if exists
      if (this.hotReloadWatchers.has(pluginId)) {
        this.hotReloadWatchers.get(pluginId).close();
        this.hotReloadWatchers.delete(pluginId);
      }

      // Update state
      instance.state = PluginState.UNLOADED;
      instance.plugin.setState(PluginState.UNLOADED);

      this.logger.info(`Plugin ${pluginId} unloaded successfully`);
      this.emit('pluginUnloaded', { pluginId, instanceId: instance.instanceId, reason: options.reason });

      return {
        success: true,
        pluginId,
        instanceId: instance.instanceId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      instance.state = PluginState.ERROR;
      instance.error = this.createError(PluginErrorCode.UNKNOWN, 'Unload failed', error);
      instance.plugin.setState(PluginState.ERROR);

      this.logger.error(`Failed to unload plugin ${pluginId}:`, error);

      return {
        success: false,
        pluginId,
        instanceId: instance.instanceId,
        error: instance.error,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Reloads a plugin.
   * 
   * @param pluginId - The plugin ID
   * @param options - Load options
   * @returns A promise that resolves with the reload result
   */
  public async reloadPlugin(
    pluginId: string,
    options: PluginLoadOptions = {}
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();

    this.logger.info(`Reloading plugin: ${pluginId}`);

    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return {
        success: false,
        pluginId,
        error: {
          code: PluginErrorCode.NOT_FOUND,
          message: `Plugin ${pluginId} not found`
        },
        duration: Date.now() - startTime
      };
    }

    const source = instance.source;
    const config = options.config || instance.config;

    // Unload first
    const unloadResult = await this.unloadPlugin(pluginId, { force: true });
    if (!unloadResult.success) {
      return unloadResult;
    }

    // Load again
    const loadResult = await this.loadPlugin(source!, { ...options, config, force: true });
    
    this.emit('pluginReloaded', { pluginId, success: loadResult.success });

    return {
      ...loadResult,
      duration: Date.now() - startTime
    };
  }

  /**
   * Activates all loaded plugins in dependency order.
   * 
   * @returns A promise that resolves when all plugins are activated
   */
  public async activateAll(): Promise<PluginOperationResult[]> {
    this.logger.info('Activating all plugins...');

    const instances = Array.from(this.instances.values());
    const sortedIds = this.sortByDependencies(instances.map(i => i.metadata));

    const results: PluginOperationResult[] = [];

    for (const pluginId of sortedIds) {
      const result = await this.activatePlugin(pluginId);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Activated ${successCount}/${results.length} plugins`);

    return results;
  }

  /**
   * Deactivates all active plugins in reverse dependency order.
   * 
   * @param options - Unload options
   * @returns A promise that resolves when all plugins are deactivated
   */
  public async deactivateAll(options: PluginUnloadOptions = {}): Promise<PluginOperationResult[]> {
    this.logger.info('Deactivating all plugins...');

    const instances = Array.from(this.instances.values());
    const sortedIds = this.sortByDependencies(instances.map(i => i.metadata)).reverse();

    const results: PluginOperationResult[] = [];

    for (const pluginId of sortedIds) {
      const result = await this.deactivatePlugin(pluginId, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Deactivated ${successCount}/${results.length} plugins`);

    return results;
  }

  /**
   * Unloads all plugins.
   * 
   * @param options - Unload options
   * @returns A promise that resolves when all plugins are unloaded
   */
  public async unloadAll(options: PluginUnloadOptions = {}): Promise<PluginOperationResult[]> {
    this.logger.info('Unloading all plugins...');

    const instances = Array.from(this.instances.values());
    const sortedIds = this.sortByDependencies(instances.map(i => i.metadata)).reverse();

    const results: PluginOperationResult[] = [];

    for (const pluginId of sortedIds) {
      const result = await this.unloadPlugin(pluginId, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Unloaded ${successCount}/${results.length} plugins`);

    return results;
  }

  /**
   * Updates plugin configuration.
   * 
   * @param pluginId - The plugin ID
   * @param config - New configuration
   * @returns A promise that resolves with the update result
   */
  public async updateConfig(
    pluginId: string,
    config: PluginConfig
  ): Promise<PluginOperationResult> {
    const startTime = Date.now();

    this.logger.info(`Updating configuration for plugin: ${pluginId}`);

    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return {
        success: false,
        pluginId,
        error: {
          code: PluginErrorCode.NOT_FOUND,
          message: `Plugin ${pluginId} not found`
        },
        duration: Date.now() - startTime
      };
    }

    const oldConfig = { ...instance.config };
    const newConfig = { ...oldConfig, ...config };

    // Validate new configuration
    const validation = instance.plugin.validateConfig(newConfig);
    if (!validation.valid) {
      return {
        success: false,
        pluginId,
        instanceId: instance.instanceId,
        error: {
          code: PluginErrorCode.CONFIG_INVALID,
          message: `Invalid configuration: ${validation.errors.join(', ')}`,
          details: validation.errors
        },
        duration: Date.now() - startTime
      };
    }

    // Update configuration
    instance.config = newConfig;

    // Notify plugin
    try {
      await instance.plugin.onConfigChange(newConfig, oldConfig);
    } catch (error) {
      this.logger.error(`Error notifying plugin ${pluginId} of config change:`, error);
    }

    this.emit('pluginConfigUpdated', { pluginId, config: newConfig, oldConfig });

    return {
      success: true,
      pluginId,
      instanceId: instance.instanceId,
      duration: Date.now() - startTime
    };
  }

  /**
   * Gets a plugin instance.
   * 
   * @param pluginId - The plugin ID
   * @returns The plugin instance or undefined
   */
  public getPlugin(pluginId: string): Plugin | undefined {
    return this.instancesById.get(pluginId)?.plugin;
  }

  /**
   * Gets all loaded plugins.
   * 
   * @returns Array of plugin instances
   */
  public getAllPlugins(): Plugin[] {
    return Array.from(this.instances.values()).map(i => i.plugin);
  }

  /**
   * Gets plugin information.
   * 
   * @param pluginId - The plugin ID
   * @returns Plugin information or undefined
   */
  public getPluginInfo(pluginId: string): PluginInfo | undefined {
    const instance = this.instancesById.get(pluginId);
    if (!instance) {
      return undefined;
    }

    return {
      id: instance.metadata.id,
      instanceId: instance.instanceId,
      name: instance.metadata.name,
      version: instance.metadata.version,
      description: instance.metadata.description,
      author: instance.metadata.author,
      state: instance.state,
      config: instance.config,
      stats: instance.plugin.getStats(),
      loadTime: instance.loadTime,
      activateTime: instance.activateTime,
      uptime: instance.plugin.getUptime(),
      source: instance.source
    };
  }

  /**
   * Gets information for all plugins.
   * 
   * @returns Array of plugin information
   */
  public getAllPluginInfo(): PluginInfo[] {
    return Array.from(this.instancesById.keys())
      .map(id => this.getPluginInfo(id)!)
      .filter(Boolean);
  }

  /**
   * Gets plugin statistics.
   * 
   * @returns Plugin manager statistics
   */
  public getStats(): PluginManagerStats {
    const instances = Array.from(this.instances.values());
    
    return {
      totalPlugins: instances.length,
      activePlugins: instances.filter(i => i.state === PluginState.ACTIVE).length,
      loadedPlugins: instances.filter(i => i.state === PluginState.LOADED).length,
      errorPlugins: instances.filter(i => i.state === PluginState.ERROR).length,
      totalHooks: this.hookManager.getHookCount(),
      totalCommands: instances.reduce((sum, i) => sum + i.plugin.getRegisteredCommands().size, 0),
      uptime: process.uptime() * 1000
    };
  }

  /**
   * Checks if a plugin is loaded.
   * 
   * @param pluginId - The plugin ID
   * @returns True if the plugin is loaded
   */
  public isLoaded(pluginId: string): boolean {
    return this.instancesById.has(pluginId);
  }

  /**
   * Checks if a plugin is active.
   * 
   * @param pluginId - The plugin ID
   * @returns True if the plugin is active
   */
  public isActive(pluginId: string): boolean {
    const instance = this.instancesById.get(pluginId);
    return instance?.state === PluginState.ACTIVE;
  }

  /**
   * Gets the hook manager.
   * 
   * @returns The hook manager
   */
  public getHookManager(): HookManager {
    return this.hookManager;
  }

  /**
   * Gets the plugin registry.
   * 
   * @returns The plugin registry
   */
  public getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Disposes the plugin manager and all plugins.
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing PluginManager...');

    // Unload all plugins
    await this.unloadAll({ reason: 'PluginManager disposal' });

    // Clean up hot reload watchers
    for (const [pluginId, watcher] of this.hotReloadWatchers) {
      watcher.close();
    }
    this.hotReloadWatchers.clear();

    // Dispose components
    await this.hookManager.dispose();
    await this.loader.dispose();
    await this.registry.dispose();

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
    this.logger.info('PluginManager disposed');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Finds an instance by source.
   * 
   * @param source - The plugin source
   * @returns The instance or undefined
   */
  private findInstanceBySource(source: string): PluginInstance | undefined {
    return Array.from(this.instances.values()).find(i => i.source === source);
  }

  /**
   * Validates a plugin instance.
   * 
   * @param plugin - The plugin instance
   * @param metadata - The plugin metadata
   * @returns True if valid
   */
  private validatePluginInstance(plugin: Plugin, metadata: PluginMetadata): boolean {
    // Check that metadata matches
    if (plugin.metadata.id !== metadata.id) {
      this.logger.error(`Plugin metadata mismatch: ${plugin.metadata.id} !== ${metadata.id}`);
      return false;
    }

    // Check that onActivate is implemented
    if (typeof plugin.onActivate !== 'function') {
      this.logger.error(`Plugin ${metadata.id} does not implement onActivate`);
      return false;
    }

    return true;
  }

  /**
   * Creates a plugin context.
   * 
   * @param instanceId - The instance ID
   * @param metadata - The plugin metadata
   * @param config - The plugin configuration
   * @returns The plugin context
   */
  private async createPluginContext(
    instanceId: string,
    metadata: PluginMetadata,
    config: PluginConfig
  ): Promise<PluginContext> {
    return {
      instanceId,
      metadata,
      config,
      hostVersion: this.options.hostVersion,
      api: this.options.hostApi,
      logger: this.createPluginLogger(metadata.id),
      storage: this.createPluginStorage(metadata.id),
      ui: this.createPluginUI(metadata.id),
      // Conditionally provide restricted interfaces based on capabilities
      ...(metadata.capabilities?.requiresNetwork && {
        network: this.createPluginNetwork(metadata.id)
      }),
      ...(metadata.capabilities?.requiresFileSystem && {
        filesystem: this.createPluginFileSystem(metadata.id)
      }),
      ...(metadata.capabilities?.requiresShell && {
        shell: this.createPluginShell(metadata.id)
      }),
      ...(metadata.capabilities?.requiresLLM && {
        llm: this.createPluginLLM(metadata.id)
      })
    };
  }

  /**
   * Creates a plugin logger.
   * 
   * @param pluginId - The plugin ID
   * @returns Logger instance
   */
  private createPluginLogger(pluginId: string): PluginLogger {
    const prefix = `[Plugin:${pluginId}]`;
    
    return {
      debug: (message: string, ...args: any[]) => {
        this.logger.debug(`${prefix} ${message}`, ...args);
      },
      info: (message: string, ...args: any[]) => {
        this.logger.info(`${prefix} ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        this.logger.warn(`${prefix} ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        this.logger.error(`${prefix} ${message}`, ...args);
      },
      trace: (message: string, ...args: any[]) => {
        this.logger.trace(`${prefix} ${message}`, ...args);
      }
    };
  }

  /**
   * Creates plugin storage.
   * 
   * @param pluginId - The plugin ID
   * @returns Storage instance
   */
  private createPluginStorage(pluginId: string): any {
    // Implementation would use actual storage backend
    const storage = new Map<string, any>();

    return {
      get: async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      set: async <T>(key: string, value: T): Promise<void> => {
        storage.set(key, value);
      },
      delete: async (key: string): Promise<void> => {
        storage.delete(key);
      },
      has: async (key: string): Promise<boolean> => {
        return storage.has(key);
      },
      keys: async (): Promise<string[]> => {
        return Array.from(storage.keys());
      },
      clear: async (): Promise<void> => {
        storage.clear();
      }
    };
  }

  /**
   * Creates plugin UI interface.
   * 
   * @param pluginId - The plugin ID
   * @returns UI interface
   */
  private createPluginUI(pluginId: string): any {
    return {
      showNotification: (message: string, type: string = 'info') => {
        this.emit('showNotification', { pluginId, message, type });
      },
      showModal: async (title: string, content: string, options?: any) => {
        return new Promise((resolve) => {
          this.emit('showModal', { pluginId, title, content, options, resolve });
        });
      },
      showInput: async (title: string, placeholder?: string, defaultValue?: string) => {
        return new Promise((resolve) => {
          this.emit('showInput', { pluginId, title, placeholder, defaultValue, resolve });
        });
      },
      showConfirm: async (title: string, message: string) => {
        return new Promise((resolve) => {
          this.emit('showConfirm', { pluginId, title, message, resolve });
        });
      },
      showProgress: (title: string, message?: string) => {
        const handle = {
          update: (progress: number, msg?: string) => {
            this.emit('updateProgress', { pluginId, title, progress, message: msg });
          },
          complete: (msg?: string) => {
            this.emit('completeProgress', { pluginId, title, message: msg });
          },
          error: (msg: string) => {
            this.emit('errorProgress', { pluginId, title, message: msg });
          },
          dispose: () => {
            this.emit('disposeProgress', { pluginId, title });
          }
        };
        this.emit('showProgress', { pluginId, title, message, handle });
        return handle;
      },
      registerStatusBarItem: (id: string, options: any) => {
        this.emit('registerStatusBarItem', { pluginId, id, options });
      },
      updateStatusBarItem: (id: string, options: any) => {
        this.emit('updateStatusBarItem', { pluginId, id, options });
      },
      removeStatusBarItem: (id: string) => {
        this.emit('removeStatusBarItem', { pluginId, id });
      },
      registerWebviewPanel: (id: string, options: any) => {
        this.emit('registerWebviewPanel', { pluginId, id, options });
      }
    };
  }

  /**
   * Creates plugin network interface.
   * 
   * @param pluginId - The plugin ID
   * @returns Network interface
   */
  private createPluginNetwork(pluginId: string): any {
    // Implementation would provide restricted network access
    return {
      request: async (options: any) => {
        this.logger.warn(`Network request from ${pluginId}:`, options);
        throw new Error('Network access not implemented');
      },
      fetch: async (url: string, options?: any) => {
        this.logger.warn(`Fetch from ${pluginId}: ${url}`);
        throw new Error('Network access not implemented');
      },
      websocket: async (url: string, options?: any) => {
        this.logger.warn(`WebSocket from ${pluginId}: ${url}`);
        throw new Error('Network access not implemented');
      },
      getAllowedDomains: () => []
    };
  }

  /**
   * Creates plugin file system interface.
   * 
   * @param pluginId - The plugin ID
   * @returns File system interface
   */
  private createPluginFileSystem(pluginId: string): any {
    // Implementation would provide restricted file system access
    return {
      readFile: async (path: string, encoding?: BufferEncoding) => {
        this.logger.warn(`File read from ${pluginId}: ${path}`);
        throw new Error('File system access not implemented');
      },
      writeFile: async (path: string, data: any, encoding?: BufferEncoding) => {
        this.logger.warn(`File write from ${pluginId}: ${path}`);
        throw new Error('File system access not implemented');
      },
      exists: async (path: string) => false,
      stat: async (path: string) => {
        throw new Error('File system access not implemented');
      },
      mkdir: async (path: string, recursive?: boolean) => {
        throw new Error('File system access not implemented');
      },
      readdir: async (path: string) => [],
      delete: async (path: string, recursive?: boolean) => {
        throw new Error('File system access not implemented');
      },
      rename: async (oldPath: string, newPath: string) => {
        throw new Error('File system access not implemented');
      },
      copy: async (src: string, dest: string, options?: any) => {
        throw new Error('File system access not implemented');
      },
      watch: (path: string, options?: any) => {
        throw new Error('File system access not implemented');
      },
      getAllowedPaths: () => []
    };
  }

  /**
   * Creates plugin shell interface.
   * 
   * @param pluginId - The plugin ID
   * @returns Shell interface
   */
  private createPluginShell(pluginId: string): any {
    // Implementation would provide restricted shell access
    return {
      execute: async (command: string, options?: any) => {
        this.logger.warn(`Shell execute from ${pluginId}: ${command}`);
        throw new Error('Shell access not implemented');
      },
      executeStream: (command: string, options?: any) => {
        throw new Error('Shell access not implemented');
      },
      spawn: (command: string, args?: string[], options?: any) => {
        throw new Error('Shell access not implemented');
      },
      getAllowedCommands: () => [],
      getAllowedPaths: () => []
    };
  }

  /**
   * Creates plugin LLM interface.
   * 
   * @param pluginId - The plugin ID
   * @returns LLM interface
   */
  private createPluginLLM(pluginId: string): any {
    // Implementation would provide restricted LLM access
    return {
      complete: async (prompt: string, options?: any) => {
        this.logger.warn(`LLM complete from ${pluginId}`);
        throw new Error('LLM access not implemented');
      },
      streamComplete: (prompt: string, options?: any) => {
        throw new Error('LLM access not implemented');
      },
      getAvailableModels: async () => [],
      getModelInfo: async (model: string) => {
        throw new Error('LLM access not implemented');
      },
      countTokens: async (text: string, model?: string) => 0
    };
  }

  /**
   * Sets up plugin event handlers.
   * 
   * @param instance - The plugin instance
   */
  private setupPluginEventHandlers(instance: PluginInstance): void {
    instance.plugin.on('stateChange', (event: PluginLifecycleEvent) => {
      this.emit('pluginStateChange', {
        pluginId: instance.metadata.id,
        instanceId: instance.instanceId,
        event
      });
    });

    instance.plugin.on('hookRegistered', (event: any) => {
      this.logger.debug(`Plugin ${instance.metadata.id} registered hook: ${event.hookName}`);
    });

    instance.plugin.on('commandRegistered', (event: any) => {
      this.logger.debug(`Plugin ${instance.metadata.id} registered command: ${event.command}`);
    });
  }

  /**
   * Registers plugin hooks with the hook manager.
   * 
   * @param instance - The plugin instance
   */
  private async registerPluginHooks(instance: PluginInstance): Promise<void> {
    const hooks = instance.plugin.getRegisteredHooks();

    for (const [hookName, handlers] of hooks) {
      for (const handlerInfo of handlers) {
        try {
          await this.hookManager.registerHook(hookName, handlerInfo.handler, {
            priority: handlerInfo.priority,
            pluginId: instance.metadata.id
          });
        } catch (error) {
          this.logger.error(`Failed to register hook ${hookName} for ${instance.metadata.id}:`, error);
        }
      }
    }
  }

  /**
   * Unregisters plugin hooks from the hook manager.
   * 
   * @param instance - The plugin instance
   */
  private async unregisterPluginHooks(instance: PluginInstance): Promise<void> {
    await this.hookManager.unregisterPluginHooks(instance.metadata.id);
  }

  /**
   * Resolves plugin dependencies.
   * 
   * @param metadata - The plugin metadata
   * @returns Dependency resolution result
   */
  private async resolveDependencies(
    metadata: PluginMetadata
  ): Promise<{ success: boolean; error?: PluginError }> {
    if (!metadata.dependencies || metadata.dependencies.length === 0) {
      return { success: true };
    }

    for (const dep of metadata.dependencies) {
      // Check if dependency is loaded
      const depInstance = this.instancesById.get(dep.id);

      if (!depInstance) {
        if (!dep.optional) {
          return {
            success: false,
            error: {
              code: PluginErrorCode.DEPENDENCY_MISSING,
              message: `Required dependency ${dep.id} is not loaded`,
              details: { dependency: dep }
            }
          };
        }
        continue;
      }

      // Check version compatibility
      if (!this.checkVersionCompatibility(depInstance.metadata.version, dep.version)) {
        if (!dep.optional) {
          return {
            success: false,
            error: {
              code: PluginErrorCode.DEPENDENCY_VERSION_MISMATCH,
              message: `Dependency ${dep.id} version ${depInstance.metadata.version} does not satisfy ${dep.version}`,
              details: { dependency: dep, actualVersion: depInstance.metadata.version }
            }
          };
        }
      }

      // Ensure dependency is active
      if (depInstance.state !== PluginState.ACTIVE) {
        const activateResult = await this.activatePlugin(dep.id);
        if (!activateResult.success && !dep.optional) {
          return {
            success: false,
            error: {
              code: PluginErrorCode.DEPENDENCY_MISSING,
              message: `Failed to activate dependency ${dep.id}: ${activateResult.error?.message}`,
              details: { dependency: dep, activationError: activateResult.error }
            }
          };
        }
      }
    }

    return { success: true };
  }

  /**
   * Gets plugins that depend on a given plugin.
   * 
   * @param pluginId - The plugin ID
   * @returns Array of dependent plugin IDs
   */
  private getDependents(pluginId: string): string[] {
    const dependents: string[] = [];

    for (const instance of this.instances.values()) {
      const deps = instance.metadata.dependencies || [];
      if (deps.some(dep => dep.id === pluginId)) {
        dependents.push(instance.metadata.id);
      }
    }

    return dependents;
  }

  /**
   * Sorts plugins by dependencies (topological sort).
   * 
   * @param plugins - Array of plugin metadata
   * @returns Sorted array of plugin IDs
   */
  private sortByDependencies(plugins: PluginMetadata[]): string[] {
    const graph = new Map<string, DependencyNode>();

    // Build dependency graph
    for (const plugin of plugins) {
      graph.set(plugin.id, {
        pluginId: plugin.id,
        dependencies: plugin.dependencies?.map(d => d.id) || [],
        dependents: [],
        visited: false,
        visiting: false,
        depth: 0
      });
    }

    // Build reverse edges
    for (const node of graph.values()) {
      for (const depId of node.dependencies) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.push(node.pluginId);
        }
      }
    }

    const sorted: string[] = [];

    const visit = (node: DependencyNode, depth: number = 0): void => {
      if (node.visiting) {
        throw new Error(`Dependency cycle detected involving ${node.pluginId}`);
      }

      if (node.visited) {
        return;
      }

      node.visiting = true;
      node.depth = depth;

      // Visit dependencies first
      for (const depId of node.dependencies) {
        const depNode = graph.get(depId);
        if (depNode) {
          visit(depNode, depth + 1);
        }
      }

      node.visiting = false;
      node.visited = true;
      sorted.push(node.pluginId);
    };

    for (const node of graph.values()) {
      if (!node.visited) {
        visit(node);
      }
    }

    return sorted;
  }

  /**
   * Checks version compatibility.
   * 
   * @param version - The actual version
   * @param range - The required version range
   * @returns True if compatible
   */
  private checkVersionCompatibility(version: string, range: string): boolean {
    // Simple semver check - would use proper semver library in production
    if (range === '*' || range === 'latest') {
      return true;
    }

    // Basic version comparison
    const versionParts = version.split('.').map(Number);
    const rangeParts = range.replace(/^[>=<^~]+/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(versionParts.length, rangeParts.length); i++) {
      const v = versionParts[i] || 0;
      const r = rangeParts[i] || 0;

      if (v < r) return false;
      if (v > r) return true;
    }

    return true;
  }

  /**
   * Merges plugin configuration.
   * 
   * @param pluginId - The plugin ID
   * @param userConfig - User-provided configuration
   * @param defaultConfig - Default configuration
   * @returns Merged configuration
   */
  private mergeConfig(
    pluginId: string,
    userConfig?: PluginConfig,
    defaultConfig?: PluginConfig
  ): PluginConfig {
    const overrides = this.options.configOverrides?.[pluginId] || {};
    
    return {
      ...defaultConfig,
      ...userConfig,
      ...overrides
    };
  }

  /**
   * Runs a function with a timeout.
   * 
   * @param fn - The function to run
   * @param timeoutMs - Timeout in milliseconds
   * @param timeoutMessage - Timeout error message
   * @returns A promise that resolves with the function result
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      fn()
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
   * Creates a plugin error.
   * 
   * @param code - Error code
   * @param message - Error message
   * @param cause - Original error
   * @returns Plugin error object
   */
  private createError(code: PluginErrorCode, message: string, cause?: any): PluginError {
    return {
      code,
      message,
      details: cause,
      stack: cause?.stack,
      cause: cause instanceof Error ? cause : undefined
    };
  }
}

/**
 * Plugin information interface
 */
export interface PluginInfo {
  id: string;
  instanceId: string;
  name: string;
  version: string;
  description: string;
  author: string | { name: string; email?: string; url?: string };
  state: PluginState;
  config: PluginConfig;
  stats: PluginStats;
  loadTime?: Date;
  activateTime?: Date;
  uptime: number;
  source?: string;
}

/**
 * Plugin manager statistics interface
 */
export interface PluginManagerStats {
  totalPlugins: number;
  activePlugins: number;
  loadedPlugins: number;
  errorPlugins: number;
  totalHooks: number;
  totalCommands: number;
  uptime: number;
}

export default PluginManager;
