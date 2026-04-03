/**
 * Configuration System
 * 
 * This module provides a comprehensive configuration management system
 * with support for multiple sources, validation, and hot reloading.
 */

import { z } from 'zod';
import { readFile, writeFile, exists, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  AppConfig,
  IConfigManager,
  ILogger,
  ValidationResult,
} from '@core/interfaces';

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Model configuration schema
 */
export const ModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'custom']).default('anthropic'),
  name: z.string().default('claude-3-5-sonnet-20241022'),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().min(1).max(200000).default(8192),
  temperature: z.number().min(0).max(1).default(0.7),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(1).optional(),
});

/**
 * Context configuration schema
 */
export const ContextConfigSchema = z.object({
  maxTokens: z.number().min(1000).max(500000).default(200000),
  compression: z.object({
    enabled: z.boolean().default(true),
    strategy: z.enum(['none', 'micro-compact', 'auto-compact', 'full-compact']).default('auto-compact'),
    threshold: z.number().min(0).max(1).default(0.8),
    preserveRecent: z.number().min(1).max(100).default(10),
  }).default({}),
});

/**
 * Permission configuration schema
 */
export const PermissionConfigSchema = z.object({
  default: z.enum(['auto', 'ask', 'deny']).default('ask'),
  tools: z.record(z.enum(['auto', 'ask', 'deny'])).default({}),
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  enabled: z.array(z.string()).default([]),
  directory: z.string().default(join(homedir(), '.claude-code', 'plugins')),
});

/**
 * MCP server configuration schema
 */
export const MCPServerConfigSchema = z.object({
  name: z.string(),
  transport: z.enum(['stdio', 'sse', 'websocket']).default('stdio'),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  url: z.string().url().optional(),
});

/**
 * MCP configuration schema
 */
export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema).default([]),
});

/**
 * Telemetry configuration schema
 */
export const TelemetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  anonymized: z.boolean().default(true),
  endpoint: z.string().url().optional(),
  sampleRate: z.number().min(0).max(1).default(1),
});

/**
 * UI configuration schema
 */
export const UIConfigSchema = z.object({
  theme: z.enum(['default', 'dark', 'light', 'high-contrast']).default('default'),
  showTimestamps: z.boolean().default(false),
  showTokenCount: z.boolean().default(true),
  compactMode: z.boolean().default(false),
  animations: z.boolean().default(true),
});

/**
 * Main application configuration schema
 */
export const AppConfigSchema = z.object({
  model: ModelConfigSchema.default({}),
  context: ContextConfigSchema.default({}),
  permissions: PermissionConfigSchema.default({}),
  plugins: PluginConfigSchema.default({}),
  mcp: MCPConfigSchema.default({}),
  telemetry: TelemetryConfigSchema.default({}),
  ui: UIConfigSchema.default({}),
  features: z.record(z.boolean()).default({}),
});

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  model: {
    provider: 'anthropic',
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    temperature: 0.7,
  },
  context: {
    maxTokens: 200000,
    compression: {
      enabled: true,
      strategy: 'auto-compact',
      threshold: 0.8,
      preserveRecent: 10,
    },
  },
  permissions: {
    default: 'ask',
    tools: {
      View: 'auto',
      Read: 'auto',
      Search: 'auto',
      Edit: 'ask',
      Bash: 'ask',
      Delete: 'ask',
    },
  },
  plugins: {
    enabled: [],
    directory: join(homedir(), '.claude-code', 'plugins'),
  },
  mcp: {
    servers: [],
  },
  telemetry: {
    enabled: true,
    anonymized: true,
    sampleRate: 1,
  },
  ui: {
    theme: 'default',
    showTimestamps: false,
    showTokenCount: true,
    compactMode: false,
    animations: true,
  },
  features: {
    'multi-agent': true,
    'context-compression': true,
    'mcp-support': true,
    'plugin-system': true,
    'skill-system': true,
    'streaming': true,
    'telemetry': true,
  },
};

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * Configuration manager implementation
 */
export class ConfigManager implements IConfigManager {
  private config: AppConfig;
  private changeHandlers: Array<(config: AppConfig) => void> = [];
  private isDisposedFlag = false;
  private logger?: ILogger;

  /**
   * Create a new configuration manager
   */
  constructor(initialConfig: Partial<AppConfig> = {}, logger?: ILogger) {
    this.config = this.mergeWithDefaults(initialConfig);
    this.logger = logger;
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    this.ensureNotDisposed();
    return { ...this.config };
  }

  /**
   * Get a specific configuration value by path
   */
  get<T>(path: string): T | undefined {
    this.ensureNotDisposed();
    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }

    return value as T;
  }

  /**
   * Set a configuration value by path
   */
  set<T>(path: string, value: T): void {
    this.ensureNotDisposed();
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    this.notifyChangeHandlers();
    this.logger?.debug(`Config updated: ${path}`, { value });
  }

  /**
   * Load configuration from a file
   */
  async loadFile(path: string): Promise<void> {
    this.ensureNotDisposed();
    
    try {
      const resolvedPath = resolve(path);
      
      if (!(await exists(resolvedPath))) {
        throw new Error(`Configuration file not found: ${resolvedPath}`);
      }

      const content = await readFile(resolvedPath, 'utf-8');
      const parsed = this.parseConfigFile(content, resolvedPath);
      
      this.config = this.mergeWithDefaults(parsed);
      this.notifyChangeHandlers();
      
      this.logger?.info(`Configuration loaded from ${resolvedPath}`);
    } catch (error) {
      this.logger?.error('Failed to load configuration file', error as Error);
      throw error;
    }
  }

  /**
   * Save configuration to a file
   */
  async saveFile(path: string): Promise<void> {
    this.ensureNotDisposed();
    
    try {
      const resolvedPath = resolve(path);
      const dir = dirname(resolvedPath);
      
      // Ensure directory exists
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
      }

      const content = this.serializeConfig(this.config, resolvedPath);
      await writeFile(resolvedPath, content, 'utf-8');
      
      this.logger?.info(`Configuration saved to ${resolvedPath}`);
    } catch (error) {
      this.logger?.error('Failed to save configuration file', error as Error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.ensureNotDisposed();
    this.config = { ...DEFAULT_CONFIG };
    this.notifyChangeHandlers();
    this.logger?.info('Configuration reset to defaults');
  }

  /**
   * Validate the current configuration
   */
  validate(): ValidationResult<AppConfig> {
    this.ensureNotDisposed();
    
    const result = AppConfigSchema.safeParse(this.config);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, errors: result.error };
    }
  }

  /**
   * Watch for configuration changes
   */
  onChange(handler: (config: AppConfig) => void): void {
    this.ensureNotDisposed();
    this.changeHandlers.push(handler);
  }

  /**
   * Get configuration schema
   */
  getSchema(): z.ZodSchema<AppConfig> {
    return AppConfigSchema;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isDisposedFlag) return;
    
    this.changeHandlers = [];
    this.isDisposedFlag = true;
    this.logger?.debug('ConfigManager disposed');
  }

  /**
   * Check if disposed
   */
  get isDisposed(): boolean {
    return this.isDisposedFlag;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private ensureNotDisposed(): void {
    if (this.isDisposedFlag) {
      throw new Error('ConfigManager has been disposed');
    }
  }

  private mergeWithDefaults(config: Partial<AppConfig>): AppConfig {
    return deepMerge(DEFAULT_CONFIG, config) as AppConfig;
  }

  private parseConfigFile(content: string, path: string): Partial<AppConfig> {
    const ext = path.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'json':
        return JSON.parse(content) as Partial<AppConfig>;
      case 'yaml':
      case 'yml':
        return parseYaml(content) as Partial<AppConfig>;
      default:
        // Try JSON first, then YAML
        try {
          return JSON.parse(content) as Partial<AppConfig>;
        } catch {
          return parseYaml(content) as Partial<AppConfig>;
        }
    }
  }

  private serializeConfig(config: AppConfig, path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'json':
        return JSON.stringify(config, null, 2);
      case 'yaml':
      case 'yml':
        return stringifyYaml(config);
      default:
        return JSON.stringify(config, null, 2);
    }
  }

  private notifyChangeHandlers(): void {
    for (const handler of this.changeHandlers) {
      try {
        handler(this.getConfig());
      } catch (error) {
        this.logger?.error('Error in config change handler', error as Error);
      }
    }
  }
}

// ============================================================================
// Configuration Loaders
// ============================================================================

/**
 * Load configuration from multiple sources
 */
export async function loadConfig(options: {
  configPath?: string;
  globalConfig?: boolean;
  projectConfig?: boolean;
  envVars?: boolean;
  logger?: ILogger;
} = {}): Promise<ConfigManager> {
  const { configPath, globalConfig = true, projectConfig = true, envVars = true, logger } = options;
  
  const manager = new ConfigManager({}, logger);

  // Load global config
  if (globalConfig) {
    const globalPath = join(homedir(), '.config', 'claude-code', 'config.yaml');
    try {
      if (await exists(globalPath)) {
        await manager.loadFile(globalPath);
      }
    } catch {
      // Ignore errors for optional config files
    }
  }

  // Load project config
  if (projectConfig) {
    const projectPath = join(process.cwd(), '.claude-code', 'config.yaml');
    try {
      if (await exists(projectPath)) {
        await manager.loadFile(projectPath);
      }
    } catch {
      // Ignore errors for optional config files
    }
  }

  // Load from specified path
  if (configPath) {
    await manager.loadFile(configPath);
  }

  // Load from environment variables
  if (envVars) {
    loadEnvVars(manager);
  }

  return manager;
}

/**
 * Load configuration from environment variables
 */
function loadEnvVars(manager: ConfigManager): void {
  const envMappings: Record<string, string> = {
    CLAUDE_API_KEY: 'model.apiKey',
    CLAUDE_MODEL: 'model.name',
    CLAUDE_MAX_TOKENS: 'model.maxTokens',
    CLAUDE_TEMPERATURE: 'model.temperature',
    CLAUDE_CONTEXT_MAX_TOKENS: 'context.maxTokens',
    CLAUDE_TELEMETRY_ENABLED: 'telemetry.enabled',
    CLAUDE_PLUGINS_DIR: 'plugins.directory',
  };

  for (const [envVar, configPath] of Object.entries(envMappings)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      const parsed = parseEnvValue(value);
      manager.set(configPath, parsed);
    }
  }
}

/**
 * Parse environment variable value
 */
function parseEnvValue(value: string): unknown {
  // Try boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // Try number
  const num = Number(value);
  if (!isNaN(num)) return num;
  
  // Try JSON
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

// ============================================================================
// Exports
// ============================================================================

export { ConfigManager };
export default ConfigManager;
