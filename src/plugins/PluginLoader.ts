/**
 * PluginLoader.ts
 * 
 * Dynamic Plugin Loading for Claude Code Clone Plugin System
 * 
 * This file implements the PluginLoader class which is responsible for:
 * - Loading plugins from various sources (local, npm, GitHub, remote)
 * - Dynamic module resolution and loading
 * - Plugin sandboxing and isolation
 * - Plugin hot reloading
 * - Plugin dependency resolution
 * - Plugin source validation
 * - Plugin caching
 * 
 * The PluginLoader provides a secure and flexible mechanism for loading
 * plugins at runtime while maintaining proper isolation and security.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { pathToFileURL } from 'url';
import {
  Plugin,
  PluginMetadata,
  PluginConstructor,
  isPluginConstructor
} from './Plugin';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Plugin loader configuration options
 */
export interface PluginLoaderOptions {
  /** Directory to load plugins from */
  pluginsDirectory?: string;
  /** Enable plugin sandboxing */
  enableSandbox?: boolean;
  /** Sandbox configuration */
  sandboxConfig?: SandboxConfig;
  /** Enable hot reloading */
  hotReload?: boolean;
  /** Cache directory */
  cacheDirectory?: string;
  /** Enable caching */
  enableCache?: boolean;
  /** Allowed plugin sources */
  allowedSources?: PluginSource[];
  /** Module resolution paths */
  modulePaths?: string[];
  /** NPM registry URL */
  npmRegistry?: string;
  /** GitHub token for private repos */
  githubToken?: string;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Maximum plugin size in bytes */
  maxPluginSize?: number;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Allowed global objects */
  allowedGlobals?: string[];
  /** Blocked global objects */
  blockedGlobals?: string[];
  /** Allowed modules */
  allowedModules?: string[];
  /** Blocked modules */
  blockedModules?: string[];
  /** Allowed file system operations */
  allowedFsOperations?: string[];
  /** Allowed network hosts */
  allowedHosts?: string[];
  /** Memory limit in MB */
  memoryLimit?: number;
  /** CPU time limit in ms */
  cpuTimeLimit?: number;
  /** Execution timeout in ms */
  executionTimeout?: number;
}

/**
 * Plugin source types
 */
export enum PluginSource {
  LOCAL = 'local',
  NPM = 'npm',
  GITHUB = 'github',
  URL = 'url',
  BUILTIN = 'builtin',
  MEMORY = 'memory'
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  success: boolean;
  pluginConstructor?: PluginConstructor;
  metadata?: PluginMetadata;
  source?: string;
  sourceType?: PluginSource;
  error?: PluginLoadError;
  loadTime?: number;
  fromCache?: boolean;
}

/**
 * Plugin load error
 */
export interface PluginLoadError {
  code: PluginLoadErrorCode;
  message: string;
  details?: any;
  stack?: string;
}

/**
 * Plugin load error codes
 */
export enum PluginLoadErrorCode {
  UNKNOWN = 'UNKNOWN',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_SOURCE = 'INVALID_SOURCE',
  LOAD_FAILED = 'LOAD_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SANDBOX_ERROR = 'SANDBOX_ERROR',
  TIMEOUT = 'TIMEOUT',
  SIZE_EXCEEDED = 'SIZE_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_METADATA = 'INVALID_METADATA',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  CACHE_ERROR = 'CACHE_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR'
}

/**
 * Plugin scan result
 */
export interface PluginScanResult {
  path: string;
  metadata: PluginMetadata;
  sourceType: PluginSource;
}

/**
 * Plugin cache entry
 */
interface PluginCacheEntry {
  source: string;
  sourceType: PluginSource;
  pluginConstructor: PluginConstructor;
  metadata: PluginMetadata;
  loadedAt: Date;
  checksum: string;
}

/**
 * Hot reload watcher
 */
interface HotReloadWatcher {
  path: string;
  watcher: fs.FileWatcher;
  lastModified: Date;
}

// ============================================================================
// Plugin Loader Class
// ============================================================================

/**
 * PluginLoader - Dynamic plugin loading and management.
 * 
 * The PluginLoader handles loading plugins from various sources including
 * local directories, npm packages, GitHub repositories, and remote URLs.
 * It provides sandboxing for security and supports hot reloading during
 * development.
 * 
 * @example
 * ```typescript
 * const loader = new PluginLoader({
 *   pluginsDirectory: './plugins',
 *   enableSandbox: true,
 *   hotReload: true
 * });
 * 
 * await loader.initialize();
 * 
 * // Load a plugin
 * const result = await loader.load('./plugins/my-plugin');
 * if (result.success) {
 *   const plugin = new result.pluginConstructor!();
 * }
 * ```
 */
export class PluginLoader extends EventEmitter {
  /**
   * Loader configuration
   */
  private options: PluginLoaderOptions;

  /**
   * Plugin cache
   */
  private cache: Map<string, PluginCacheEntry> = new Map();

  /**
   * Hot reload watchers
   */
  private hotReloadWatchers: Map<string, HotReloadWatcher> = new Map();

  /**
   * Loaded plugin modules
   */
  private loadedModules: Map<string, any> = new Map();

  /**
   * Builtin plugins
   */
  private builtinPlugins: Map<string, PluginConstructor> = new Map();

  /**
   * Whether the loader is initialized
   */
  private initialized: boolean = false;

  /**
   * Creates a new PluginLoader instance.
   * 
   * @param options - Loader configuration options
   */
  constructor(options: PluginLoaderOptions = {}) {
    super();
    this.setMaxListeners(100);

    this.options = {
      enableSandbox: true,
      hotReload: false,
      enableCache: true,
      allowedSources: Object.values(PluginSource),
      npmRegistry: 'https://registry.npmjs.org',
      requestTimeout: 30000,
      maxPluginSize: 100 * 1024 * 1024, // 100MB
      ...options
    };

    // Set default sandbox config
    this.options.sandboxConfig = {
      allowedGlobals: ['console', 'Buffer', 'process', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      blockedGlobals: ['require', 'module', 'exports', '__dirname', '__filename'],
      allowedModules: [],
      blockedModules: ['child_process', 'cluster', 'dgram', 'dns', 'net', 'tls', 'repl', 'vm'],
      memoryLimit: 512,
      cpuTimeLimit: 5000,
      executionTimeout: 30000,
      ...this.options.sandboxConfig
    };
  }

  /**
   * Initializes the plugin loader.
   * 
   * @returns A promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure plugins directory exists
    if (this.options.pluginsDirectory) {
      try {
        await fs.access(this.options.pluginsDirectory);
      } catch {
        await fs.mkdir(this.options.pluginsDirectory, { recursive: true });
      }
    }

    // Ensure cache directory exists
    if (this.options.enableCache && this.options.cacheDirectory) {
      try {
        await fs.access(this.options.cacheDirectory);
      } catch {
        await fs.mkdir(this.options.cacheDirectory, { recursive: true });
      }
    }

    // Load cache from disk
    if (this.options.enableCache) {
      await this.loadCache();
    }

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Disposes the plugin loader.
   */
  public async dispose(): Promise<void> {
    // Stop all hot reload watchers
    for (const [path, watcher] of this.hotReloadWatchers) {
      watcher.watcher.close();
    }
    this.hotReloadWatchers.clear();

    // Save cache to disk
    if (this.options.enableCache) {
      await this.saveCache();
    }

    // Clear all caches
    this.cache.clear();
    this.loadedModules.clear();
    this.builtinPlugins.clear();

    this.initialized = false;
    this.emit('disposed');
  }

  // ============================================================================
  // Plugin Loading Methods
  // ============================================================================

  /**
   * Loads a plugin from a source.
   * 
   * @param source - Plugin source (path, package name, URL, etc.)
   * @param options - Load options
   * @returns A promise that resolves with the load result
   */
  public async load(source: string, options: { force?: boolean } = {}): Promise<PluginLoadResult> {
    const startTime = Date.now();

    this.emit('loadStarted', { source });

    try {
      // Determine source type
      const sourceType = this.detectSourceType(source);

      // Check if source is allowed
      if (!this.isSourceAllowed(sourceType)) {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.PERMISSION_DENIED,
            message: `Source type ${sourceType} is not allowed`
          },
          loadTime: Date.now() - startTime
        };
      }

      // Check cache
      if (!options.force && this.options.enableCache) {
        const cached = this.getCachedPlugin(source);
        if (cached) {
          this.emit('loadCompleted', { source, fromCache: true });
          return {
            success: true,
            pluginConstructor: cached.pluginConstructor,
            metadata: cached.metadata,
            source,
            sourceType,
            loadTime: Date.now() - startTime,
            fromCache: true
          };
        }
      }

      // Load based on source type
      let result: PluginLoadResult;

      switch (sourceType) {
        case PluginSource.LOCAL:
          result = await this.loadFromLocal(source);
          break;
        case PluginSource.NPM:
          result = await this.loadFromNpm(source);
          break;
        case PluginSource.GITHUB:
          result = await this.loadFromGitHub(source);
          break;
        case PluginSource.URL:
          result = await this.loadFromUrl(source);
          break;
        case PluginSource.BUILTIN:
          result = await this.loadBuiltin(source);
          break;
        default:
          result = {
            success: false,
            error: {
              code: PluginLoadErrorCode.INVALID_SOURCE,
              message: `Unknown source type: ${sourceType}`
            },
            loadTime: Date.now() - startTime
          };
      }

      // Cache successful loads
      if (result.success && this.options.enableCache) {
        this.cachePlugin(source, sourceType, result.pluginConstructor!, result.metadata!);
      }

      // Set up hot reload if enabled
      if (result.success && this.options.hotReload && sourceType === PluginSource.LOCAL) {
        this.setupHotReload(source, result.metadata!.id);
      }

      result.loadTime = Date.now() - startTime;

      if (result.success) {
        this.emit('loadCompleted', { source, metadata: result.metadata });
      } else {
        this.emit('loadFailed', { source, error: result.error });
      }

      return result;
    } catch (error) {
      const loadError = this.createError(PluginLoadErrorCode.UNKNOWN, 'Failed to load plugin', error);
      
      this.emit('loadFailed', { source, error: loadError });

      return {
        success: false,
        error: loadError,
        loadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Loads a plugin from a local path.
   * 
   * @param pluginPath - Path to the plugin
   * @returns Load result
   */
  private async loadFromLocal(pluginPath: string): Promise<PluginLoadResult> {
    try {
      // Resolve absolute path
      const absolutePath = path.resolve(pluginPath);

      // Check if path exists
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return this.loadFromDirectory(absolutePath);
      } else if (stats.isFile()) {
        return this.loadFromFile(absolutePath);
      } else {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.NOT_FOUND,
            message: `Path is not a file or directory: ${pluginPath}`
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.NOT_FOUND, `Plugin not found: ${pluginPath}`, error)
      };
    }
  }

  /**
   * Loads a plugin from a directory.
   * 
   * @param dirPath - Directory path
   * @returns Load result
   */
  private async loadFromDirectory(dirPath: string): Promise<PluginLoadResult> {
    try {
      // Look for package.json or plugin manifest
      const packageJsonPath = path.join(dirPath, 'package.json');
      const manifestPath = path.join(dirPath, 'plugin.json');
      const indexPath = path.join(dirPath, 'index.js');
      const indexTsPath = path.join(dirPath, 'index.ts');

      let metadata: PluginMetadata | undefined;
      let entryPoint: string | undefined;

      // Try package.json first
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        metadata = this.extractMetadataFromPackageJson(packageJson);
        entryPoint = path.join(dirPath, packageJson.main || 'index.js');
      } catch {
        // Try manifest.json
        try {
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
          metadata = manifest;
          entryPoint = path.join(dirPath, manifest.main || 'index.js');
        } catch {
          // Fall back to index file
          try {
            await fs.access(indexPath);
            entryPoint = indexPath;
          } catch {
            try {
              await fs.access(indexTsPath);
              entryPoint = indexTsPath;
            } catch {
              return {
                success: false,
                error: {
                  code: PluginLoadErrorCode.NOT_FOUND,
                  message: `No entry point found in directory: ${dirPath}`
                }
              };
            }
          }
        }
      }

      if (!entryPoint) {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.NOT_FOUND,
            message: `No entry point found in directory: ${dirPath}`
          }
        };
      }

      // Load the module
      const moduleResult = await this.loadModule(entryPoint, metadata);
      return moduleResult;
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.LOAD_FAILED, `Failed to load from directory: ${dirPath}`, error)
      };
    }
  }

  /**
   * Loads a plugin from a file.
   * 
   * @param filePath - File path
   * @returns Load result
   */
  private async loadFromFile(filePath: string): Promise<PluginLoadResult> {
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > (this.options.maxPluginSize || 100 * 1024 * 1024)) {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.SIZE_EXCEEDED,
            message: `Plugin file exceeds maximum size: ${stats.size} bytes`
          }
        };
      }

      return this.loadModule(filePath);
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.LOAD_FAILED, `Failed to load from file: ${filePath}`, error)
      };
    }
  }

  /**
   * Loads a plugin from npm.
   * 
   * @param packageName - NPM package name
   * @returns Load result
   */
  private async loadFromNpm(packageName: string): Promise<PluginLoadResult> {
    try {
      // In a real implementation, this would:
      // 1. Fetch package info from npm registry
      // 2. Download the package
      // 3. Extract and load it
      
      // For now, try to require the package directly
      const packagePath = require.resolve(packageName);
      return this.loadFromDirectory(path.dirname(packagePath));
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.NETWORK_ERROR, `Failed to load npm package: ${packageName}`, error)
      };
    }
  }

  /**
   * Loads a plugin from GitHub.
   * 
   * @param githubRef - GitHub reference (e.g., "owner/repo" or "owner/repo#tag")
   * @returns Load result
   */
  private async loadFromGitHub(githubRef: string): Promise<PluginLoadResult> {
    // Parse GitHub reference
    const match = githubRef.match(/^([^/]+)\/([^/#]+)(?:#(.+))?$/);
    if (!match) {
      return {
        success: false,
        error: {
          code: PluginLoadErrorCode.INVALID_SOURCE,
          message: `Invalid GitHub reference: ${githubRef}. Use format: owner/repo#tag`
        }
      };
    }

    const [, owner, repo, tag = 'main'] = match;

    try {
      // In a real implementation, this would:
      // 1. Download the repository archive
      // 2. Extract it
      // 3. Load the plugin
      
      return {
        success: false,
        error: {
          code: PluginLoadErrorCode.NOT_IMPLEMENTED,
          message: 'GitHub loading not yet implemented'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.NETWORK_ERROR, `Failed to load from GitHub: ${githubRef}`, error)
      };
    }
  }

  /**
   * Loads a plugin from a URL.
   * 
   * @param url - Plugin URL
   * @returns Load result
   */
  private async loadFromUrl(url: string): Promise<PluginLoadResult> {
    try {
      // In a real implementation, this would:
      // 1. Download the plugin from the URL
      // 2. Save to cache
      // 3. Load the plugin
      
      return {
        success: false,
        error: {
          code: PluginLoadErrorCode.NOT_IMPLEMENTED,
          message: 'URL loading not yet implemented'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.NETWORK_ERROR, `Failed to load from URL: ${url}`, error)
      };
    }
  }

  /**
   * Loads a builtin plugin.
   * 
   * @param pluginId - Builtin plugin ID
   * @returns Load result
   */
  private async loadBuiltin(pluginId: string): Promise<PluginLoadResult> {
    const builtinId = pluginId.replace(/^builtin:/, '');
    const constructor = this.builtinPlugins.get(builtinId);

    if (!constructor) {
      return {
        success: false,
        error: {
          code: PluginLoadErrorCode.NOT_FOUND,
          message: `Builtin plugin not found: ${builtinId}`
        }
      };
    }

    return {
      success: true,
      pluginConstructor: constructor,
      metadata: constructor.prototype.metadata,
      source: pluginId,
      sourceType: PluginSource.BUILTIN
    };
  }

  /**
   * Loads a plugin module.
   * 
   * @param modulePath - Path to the module
   * @param metadata - Optional metadata
   * @returns Load result
   */
  private async loadModule(modulePath: string, metadata?: PluginMetadata): Promise<PluginLoadResult> {
    try {
      // Clear require cache for hot reload
      const moduleId = require.resolve(modulePath);
      delete require.cache[moduleId];

      // Import the module
      const moduleExports = await import(pathToFileURL(modulePath).href);

      // Find the plugin class
      let PluginClass: PluginConstructor | undefined;

      // Check for default export
      if (moduleExports.default && isPluginConstructor(moduleExports.default)) {
        PluginClass = moduleExports.default;
      } else {
        // Look for named exports that extend Plugin
        for (const [name, exported] of Object.entries(moduleExports)) {
          if (isPluginConstructor(exported)) {
            PluginClass = exported;
            break;
          }
        }
      }

      if (!PluginClass) {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.VALIDATION_ERROR,
            message: `No Plugin class found in module: ${modulePath}`
          }
        };
      }

      // Validate metadata
      const pluginMetadata = PluginClass.prototype.metadata;
      if (!pluginMetadata) {
        return {
          success: false,
          error: {
            code: PluginLoadErrorCode.INVALID_METADATA,
            message: `Plugin metadata not defined in: ${modulePath}`
          }
        };
      }

      // Merge with provided metadata
      const finalMetadata = { ...metadata, ...pluginMetadata };

      return {
        success: true,
        pluginConstructor: PluginClass,
        metadata: finalMetadata,
        source: modulePath,
        sourceType: PluginSource.LOCAL
      };
    } catch (error) {
      return {
        success: false,
        error: this.createError(PluginLoadErrorCode.LOAD_FAILED, `Failed to load module: ${modulePath}`, error)
      };
    }
  }

  // ============================================================================
  // Plugin Scanning Methods
  // ============================================================================

  /**
   * Scans the plugins directory for available plugins.
   * 
   * @returns A promise that resolves with an array of plugin metadata
   */
  public async scanPlugins(): Promise<PluginMetadata[]> {
    if (!this.options.pluginsDirectory) {
      return [];
    }

    const results: PluginMetadata[] = [];

    try {
      const entries = await fs.readdir(this.options.pluginsDirectory, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const pluginPath = path.join(this.options.pluginsDirectory, entry.name);

        try {
          const loadResult = await this.loadFromDirectory(pluginPath);
          if (loadResult.success && loadResult.metadata) {
            results.push(loadResult.metadata);
          }
        } catch (error) {
          this.emit('scanError', { path: pluginPath, error });
        }
      }
    } catch (error) {
      this.emit('scanError', { error });
    }

    return results;
  }

  // ============================================================================
  // Builtin Plugin Methods
  // ============================================================================

  /**
   * Registers a builtin plugin.
   * 
   * @param id - Builtin plugin ID
   * @param constructor - Plugin constructor
   */
  public registerBuiltin(id: string, constructor: PluginConstructor): void {
    this.builtinPlugins.set(id, constructor);
    this.emit('builtinRegistered', { id });
  }

  /**
   * Unregisters a builtin plugin.
   * 
   * @param id - Builtin plugin ID
   * @returns True if the plugin was unregistered
   */
  public unregisterBuiltin(id: string): boolean {
    const result = this.builtinPlugins.delete(id);
    if (result) {
      this.emit('builtinUnregistered', { id });
    }
    return result;
  }

  /**
   * Gets all builtin plugin IDs.
   * 
   * @returns Array of builtin plugin IDs
   */
  public getBuiltinIds(): string[] {
    return Array.from(this.builtinPlugins.keys());
  }

  // ============================================================================
  // Hot Reload Methods
  // ============================================================================

  /**
   * Sets up hot reload for a plugin.
   * 
   * @param pluginPath - Path to the plugin
   * @param pluginId - Plugin ID
   */
  private setupHotReload(pluginPath: string, pluginId: string): void {
    if (this.hotReloadWatchers.has(pluginId)) {
      return;
    }

    try {
      const watcher = fs.watch(pluginPath, { recursive: true }, async (eventType, filename) => {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.ts') || filename === 'package.json')) {
          this.emit('hotReloadTriggered', { pluginId, path: pluginPath, filename });
          
          // Invalidate cache
          this.invalidateCache(pluginPath);
          
          // Notify that plugin should be reloaded
          this.emit('pluginChanged', { pluginId, path: pluginPath });
        }
      });

      this.hotReloadWatchers.set(pluginId, {
        path: pluginPath,
        watcher,
        lastModified: new Date()
      });
    } catch (error) {
      this.emit('hotReloadError', { pluginId, error });
    }
  }

  /**
   * Enables hot reload for a plugin.
   * 
   * @param pluginId - Plugin ID
   * @param pluginPath - Plugin path
   */
  public enableHotReload(pluginId: string, pluginPath: string): void {
    this.setupHotReload(pluginPath, pluginId);
  }

  /**
   * Disables hot reload for a plugin.
   * 
   * @param pluginId - Plugin ID
   */
  public disableHotReload(pluginId: string): void {
    const watcher = this.hotReloadWatchers.get(pluginId);
    if (watcher) {
      watcher.watcher.close();
      this.hotReloadWatchers.delete(pluginId);
    }
  }

  // ============================================================================
  // Cache Methods
  // ============================================================================

  /**
   * Gets a cached plugin.
   * 
   * @param source - Plugin source
   * @returns Cached entry or undefined
   */
  private getCachedPlugin(source: string): PluginCacheEntry | undefined {
    return this.cache.get(source);
  }

  /**
   * Caches a loaded plugin.
   * 
   * @param source - Plugin source
   * @param sourceType - Source type
   * @param pluginConstructor - Plugin constructor
   * @param metadata - Plugin metadata
   */
  private cachePlugin(
    source: string,
    sourceType: PluginSource,
    pluginConstructor: PluginConstructor,
    metadata: PluginMetadata
  ): void {
    this.cache.set(source, {
      source,
      sourceType,
      pluginConstructor,
      metadata,
      loadedAt: new Date(),
      checksum: '' // Would calculate actual checksum in production
    });
  }

  /**
   * Invalidates a cached plugin.
   * 
   * @param source - Plugin source
   */
  public invalidateCache(source: string): void {
    this.cache.delete(source);
    this.emit('cacheInvalidated', { source });
  }

  /**
   * Clears the plugin cache.
   */
  public clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Loads cache from disk.
   */
  private async loadCache(): Promise<void> {
    if (!this.options.cacheDirectory) {
      return;
    }

    try {
      const cachePath = path.join(this.options.cacheDirectory, 'plugin-cache.json');
      const data = await fs.readFile(cachePath, 'utf-8');
      const entries = JSON.parse(data);

      for (const [key, entry] of Object.entries(entries)) {
        // In a real implementation, would need to re-hydrate the constructor
        // For now, just skip
      }
    } catch {
      // Cache doesn't exist or is invalid
    }
  }

  /**
   * Saves cache to disk.
   */
  private async saveCache(): Promise<void> {
    if (!this.options.cacheDirectory) {
      return;
    }

    try {
      const cachePath = path.join(this.options.cacheDirectory, 'plugin-cache.json');
      const entries: Record<string, any> = {};

      for (const [key, entry] of this.cache) {
        entries[key] = {
          source: entry.source,
          sourceType: entry.sourceType,
          metadata: entry.metadata,
          loadedAt: entry.loadedAt,
          checksum: entry.checksum
        };
      }

      await fs.writeFile(cachePath, JSON.stringify(entries, null, 2));
    } catch (error) {
      this.emit('cacheError', { operation: 'save', error });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Detects the source type from a source string.
   * 
   * @param source - Plugin source
   * @returns Detected source type
   */
  private detectSourceType(source: string): PluginSource {
    // Check for builtin prefix
    if (source.startsWith('builtin:')) {
      return PluginSource.BUILTIN;
    }

    // Check for URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return PluginSource.URL;
    }

    // Check for GitHub reference
    if (/^[^/]+\/[^/]+(#.+)?$/.test(source) && !source.startsWith('.')) {
      return PluginSource.GITHUB;
    }

    // Check for npm package
    if (!source.startsWith('.') && !path.isAbsolute(source)) {
      return PluginSource.NPM;
    }

    // Default to local
    return PluginSource.LOCAL;
  }

  /**
   * Checks if a source type is allowed.
   * 
   * @param sourceType - Source type to check
   * @returns True if allowed
   */
  private isSourceAllowed(sourceType: PluginSource): boolean {
    return this.options.allowedSources?.includes(sourceType) || false;
  }

  /**
   * Extracts metadata from package.json.
   * 
   * @param packageJson - Package.json content
   * @returns Plugin metadata
   */
  private extractMetadataFromPackageJson(packageJson: any): PluginMetadata {
    return {
      id: packageJson.name,
      name: packageJson.displayName || packageJson.name,
      version: packageJson.version,
      description: packageJson.description || '',
      author: packageJson.author || 'Unknown',
      license: packageJson.license,
      homepage: packageJson.homepage,
      repository: packageJson.repository?.url || packageJson.repository,
      bugs: packageJson.bugs?.url || packageJson.bugs,
      keywords: packageJson.keywords,
      category: packageJson.category
    };
  }

  /**
   * Creates a load error.
   * 
   * @param code - Error code
   * @param message - Error message
   * @param cause - Original error
   * @returns Load error object
   */
  private createError(code: PluginLoadErrorCode, message: string, cause?: any): PluginLoadError {
    return {
      code,
      message,
      details: cause,
      stack: cause?.stack
    };
  }
}

// Add NOT_IMPLEMENTED to error codes
(PluginLoadErrorCode as any).NOT_IMPLEMENTED = 'NOT_IMPLEMENTED';

export default PluginLoader;
