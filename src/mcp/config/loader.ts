/**
 * MCP Configuration Loader
 * 
 * This file contains utilities for loading MCP configuration from various sources.
 */

import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { MCPConfig, ServerConfig } from '../types';
import { parseConfigFile, parseConfig, detectFormat, mergeConfigs } from './parser';
import { validateMCPConfig, assertValidConfig, ValidationOptions } from './validator';
import { MCPConfigurationError } from '../utils/errors';

/**
 * Loader options
 */
export interface LoaderOptions {
  /**
   * Configuration file path
   */
  configPath?: string;

  /**
   * Search paths for configuration files
   */
  searchPaths?: string[];

  /**
   * Configuration file names to look for
   */
  configFiles?: string[];

  /**
   * Validate configuration after loading
   */
  validate?: boolean;

  /**
   * Validation options
   */
  validationOptions?: ValidationOptions;

  /**
   * Expand environment variables
   */
  expandEnv?: boolean;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Default search paths
 */
export function getDefaultSearchPaths(): string[] {
  const paths: string[] = [];

  // Current working directory
  paths.push(process.cwd());

  // Home directory
  paths.push(homedir());

  // XDG config directory
  if (process.env.XDG_CONFIG_HOME) {
    paths.push(process.env.XDG_CONFIG_HOME);
  } else {
    paths.push(join(homedir(), '.config'));
  }

  // Platform-specific paths
  if (process.platform === 'darwin') {
    paths.push(join(homedir(), 'Library', 'Application Support', 'MCP'));
  } else if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      paths.push(join(process.env.APPDATA, 'MCP'));
    }
  } else {
    paths.push(join(homedir(), '.mcp'));
  }

  return paths;
}

/**
 * Default configuration file names
 */
export const DEFAULT_CONFIG_FILES = [
  'mcp.json',
  '.mcp.json',
  'mcp.config.json',
  'mcp.yaml',
  'mcp.yml',
  '.mcp.yaml',
  '.mcp.yml',
];

/**
 * Load configuration from file
 */
export async function loadConfigFile(
  filePath: string,
  options: LoaderOptions = {}
): Promise<MCPConfig> {
  const debug = options.debug || false;

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[ConfigLoader]', ...args);
    }
  };

  log(`Loading configuration from: ${filePath}`);

  try {
    // Check if file exists
    await access(filePath);

    // Parse configuration
    const config = await parseConfigFile(filePath, {
      format: detectFormat(filePath),
      expandEnv: options.expandEnv !== false,
      validate: false, // We'll validate separately
    });

    // Validate if requested
    if (options.validate !== false) {
      assertValidConfig(config, options.validationOptions);
    }

    log(`Configuration loaded successfully from: ${filePath}`);

    return config;
  } catch (error) {
    if (error instanceof MCPConfigurationError) {
      throw error;
    }
    throw new MCPConfigurationError(
      `Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Find configuration file
 */
export async function findConfigFile(
  options: LoaderOptions = {}
): Promise<string | undefined> {
  const searchPaths = options.searchPaths || getDefaultSearchPaths();
  const configFiles = options.configFiles || DEFAULT_CONFIG_FILES;

  for (const searchPath of searchPaths) {
    for (const configFile of configFiles) {
      const fullPath = join(searchPath, configFile);
      try {
        await access(fullPath);
        return fullPath;
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  return undefined;
}

/**
 * Load configuration from various sources
 */
export async function loadConfig(options: LoaderOptions = {}): Promise<MCPConfig> {
  const debug = options.debug || false;

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[ConfigLoader]', ...args);
    }
  };

  // If config path is specified, load from that
  if (options.configPath) {
    return loadConfigFile(resolve(options.configPath), options);
  }

  // Try to find configuration file
  const configPath = await findConfigFile(options);

  if (configPath) {
    log(`Found configuration file: ${configPath}`);
    return loadConfigFile(configPath, options);
  }

  // Return empty configuration
  log('No configuration file found, returning empty configuration');
  return {
    version: '1.0.0',
    servers: [],
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<MCPConfig> {
  const config: Partial<MCPConfig> = {
    servers: [],
  };

  // Parse MCP_SERVERS environment variable
  if (process.env.MCP_SERVERS) {
    try {
      const servers = JSON.parse(process.env.MCP_SERVERS);
      if (Array.isArray(servers)) {
        config.servers = servers;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse individual server configurations
  const serverPrefix = 'MCP_SERVER_';
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(serverPrefix) && value) {
      try {
        const serverName = key.slice(serverPrefix.length).toLowerCase();
        const serverConfig = JSON.parse(value);
        serverConfig.name = serverName;

        if (!config.servers) {
          config.servers = [];
        }

        // Check if server already exists
        const existingIndex = config.servers.findIndex((s) => s.name === serverName);
        if (existingIndex >= 0) {
          config.servers[existingIndex] = { ...config.servers[existingIndex], ...serverConfig };
        } else {
          config.servers.push(serverConfig);
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  return config;
}

/**
 * Load configuration from multiple sources and merge
 */
export async function loadMergedConfig(
  sources: Array<{ type: 'file' | 'env' | 'object'; value: string | Partial<MCPConfig> }>,
  options: LoaderOptions = {}
): Promise<MCPConfig> {
  const configs: MCPConfig[] = [];

  for (const source of sources) {
    try {
      switch (source.type) {
        case 'file':
          configs.push(await loadConfigFile(source.value as string, options));
          break;
        case 'env':
          const envConfig = loadConfigFromEnv();
          if (envConfig.servers && envConfig.servers.length > 0) {
            configs.push(envConfig as MCPConfig);
          }
          break;
        case 'object':
          configs.push(source.value as MCPConfig);
          break;
      }
    } catch (error) {
      if (options.debug) {
        console.log('[ConfigLoader] Failed to load source:', source, error);
      }
    }
  }

  if (configs.length === 0) {
    return {
      version: '1.0.0',
      servers: [],
    };
  }

  return mergeConfigs(...configs);
}

/**
 * Save configuration to file
 */
export async function saveConfigFile(
  filePath: string,
  config: MCPConfig,
  options: { format?: 'json' | 'yaml'; pretty?: boolean } = {}
): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { dirname } = await import('path');

  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });

  let content: string;
  const format = options.format || detectFormat(filePath);

  if (format === 'yaml' || format === 'yml') {
    content = configToYAML(config);
  } else {
    content = JSON.stringify(config, null, options.pretty !== false ? 2 : undefined);
  }

  await writeFile(filePath, content, 'utf-8');
}

/**
 * Convert configuration to YAML
 */
function configToYAML(config: MCPConfig): string {
  const lines: string[] = [];

  lines.push(`version: ${config.version || '1.0.0'}`);
  lines.push('servers:');

  for (const server of config.servers) {
    lines.push(`  - name: ${server.name}`);
    lines.push(`    transport:`);
    lines.push(`      type: ${server.transport.type}`);

    // Add transport-specific fields
    const transport = server.transport as Record<string, unknown>;
    for (const [key, value] of Object.entries(transport)) {
      if (key !== 'type') {
        if (Array.isArray(value)) {
          lines.push(`      ${key}:`);
          for (const item of value) {
            lines.push(`        - ${item}`);
          }
        } else if (typeof value === 'object' && value !== null) {
          lines.push(`      ${key}:`);
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            lines.push(`        ${subKey}: ${subValue}`);
          }
        } else {
          lines.push(`      ${key}: ${value}`);
        }
      }
    }

    // Add optional fields
    if (server.enabled !== undefined) {
      lines.push(`    enabled: ${server.enabled}`);
    }
    if (server.timeout) {
      lines.push(`    timeout: ${server.timeout}`);
    }
    if (server.autoReconnect !== undefined) {
      lines.push(`    autoReconnect: ${server.autoReconnect}`);
    }
    if (server.reconnectDelay) {
      lines.push(`    reconnectDelay: ${server.reconnectDelay}`);
    }
    if (server.maxReconnectAttempts) {
      lines.push(`    maxReconnectAttempts: ${server.maxReconnectAttempts}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a configuration builder
 */
export class ConfigBuilder {
  private config: MCPConfig = {
    version: '1.0.0',
    servers: [],
  };

  /**
   * Set configuration version
   */
  setVersion(version: string): this {
    this.config.version = version;
    return this;
  }

  /**
   * Add a server
   */
  addServer(server: ServerConfig): this {
    this.config.servers.push(server);
    return this;
  }

  /**
   * Add a stdio server
   */
  addStdioServer(
    name: string,
    command: string,
    args?: string[],
    options: Partial<Omit<ServerConfig, 'name' | 'transport'>> = {}
  ): this {
    return this.addServer({
      name,
      transport: {
        type: 'stdio',
        command,
        args,
      },
      ...options,
    });
  }

  /**
   * Add an SSE server
   */
  addSSEServer(
    name: string,
    url: string,
    options: Partial<Omit<ServerConfig, 'name' | 'transport'>> = {}
  ): this {
    return this.addServer({
      name,
      transport: {
        type: 'sse',
        url,
      },
      ...options,
    });
  }

  /**
   * Add an HTTP server
   */
  addHTTPServer(
    name: string,
    url: string,
    options: Partial<Omit<ServerConfig, 'name' | 'transport'>> = {}
  ): this {
    return this.addServer({
      name,
      transport: {
        type: 'http',
        url,
      },
      ...options,
    });
  }

  /**
   * Add a WebSocket server
   */
  addWebSocketServer(
    name: string,
    url: string,
    protocols?: string[],
    options: Partial<Omit<ServerConfig, 'name' | 'transport'>> = {}
  ): this {
    return this.addServer({
      name,
      transport: {
        type: 'websocket',
        url,
        protocols,
      },
      ...options,
    });
  }

  /**
   * Remove a server
   */
  removeServer(name: string): this {
    this.config.servers = this.config.servers.filter((s) => s.name !== name);
    return this;
  }

  /**
   * Set defaults
   */
  setDefaults(defaults: MCPConfig['defaults']): this {
    this.config.defaults = defaults;
    return this;
  }

  /**
   * Build the configuration
   */
  build(): MCPConfig {
    return { ...this.config };
  }

  /**
   * Validate the configuration
   */
  validate(options?: ValidationOptions): boolean {
    const result = validateMCPConfig(this.config, options);
    return result.valid;
  }

  /**
   * Save to file
   */
  async save(filePath: string, options?: { format?: 'json' | 'yaml'; pretty?: boolean }): Promise<void> {
    await saveConfigFile(filePath, this.config, options);
  }
}

/**
 * Create a configuration builder
 */
export function createConfigBuilder(): ConfigBuilder {
  return new ConfigBuilder();
}
