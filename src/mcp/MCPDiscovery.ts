/**
 * MCP Server Discovery
 * 
 * This file contains utilities for discovering and managing MCP servers.
 */

import { EventEmitter } from 'events';
import { readdir, readFile, stat, access } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import {
  ServerConfig,
  TransportConfig,
  ServerCapabilities,
  Implementation,
} from './types';
import { MCPConfigurationError } from './utils/errors';

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /**
   * Search paths for MCP configuration files
   */
  searchPaths?: string[];

  /**
   * Configuration file names to look for
   */
  configFiles?: string[];

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Discovered server information
 */
export interface DiscoveredServer {
  /**
   * Server name
   */
  name: string;

  /**
   * Server configuration
   */
  config: ServerConfig;

  /**
   * Configuration file path (if discovered from file)
   */
  configPath?: string;

  /**
   * Server source (file, registry, manual)
   */
  source: 'file' | 'registry' | 'manual';

  /**
   * Whether the server is enabled
   */
  enabled: boolean;
}

/**
 * Server registry entry
 */
export interface ServerRegistryEntry {
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
  transport: TransportConfig;
  capabilities?: ServerCapabilities;
}

/**
 * MCP server discovery
 */
export class MCPDiscovery extends EventEmitter {
  private _options: DiscoveryOptions;
  private _discoveredServers = new Map<string, DiscoveredServer>();
  private _registry = new Map<string, ServerRegistryEntry>();

  constructor(options: DiscoveryOptions = {}) {
    super();
    this._options = {
      searchPaths: this._getDefaultSearchPaths(),
      configFiles: ['mcp.json', '.mcp.json', 'mcp.config.json'],
      debug: false,
      ...options,
    };
  }

  // ========================================================================
  // Default Search Paths
  // ========================================================================

  /**
   * Get default search paths for configuration files
   */
  private _getDefaultSearchPaths(): string[] {
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

  // ========================================================================
  // Server Discovery
  // ========================================================================

  /**
   * Discover servers from all sources
   */
  async discoverAll(): Promise<DiscoveredServer[]> {
    this._log('Starting server discovery');

    // Clear previous discoveries
    this._discoveredServers.clear();

    // Discover from configuration files
    await this.discoverFromFiles();

    // Discover from registry
    this.discoverFromRegistry();

    // Emit discovery event
    const servers = Array.from(this._discoveredServers.values());
    this.emit('discovered', servers);

    this._log(`Discovered ${servers.length} servers`);

    return servers;
  }

  /**
   * Discover servers from configuration files
   */
  async discoverFromFiles(): Promise<DiscoveredServer[]> {
    this._log('Discovering servers from configuration files');

    const servers: DiscoveredServer[] = [];

    for (const searchPath of this._options.searchPaths || []) {
      for (const configFile of this._options.configFiles || []) {
        const configPath = join(searchPath, configFile);

        try {
          // Check if file exists
          await access(configPath);

          // Read and parse configuration
          const config = await this._loadConfigFile(configPath);

          if (config.servers) {
            for (const serverConfig of config.servers) {
              const server: DiscoveredServer = {
                name: serverConfig.name,
                config: serverConfig,
                configPath,
                source: 'file',
                enabled: serverConfig.enabled !== false,
              };

              this._discoveredServers.set(serverConfig.name, server);
              servers.push(server);

              this._log(`Discovered server from file: ${serverConfig.name}`);
            }
          }
        } catch (error) {
          // File doesn't exist or is invalid, continue
          continue;
        }
      }
    }

    this._log(`Discovered ${servers.length} servers from files`);
    return servers;
  }

  /**
   * Load a configuration file
   */
  private async _loadConfigFile(path: string): Promise<{ servers: ServerConfig[] }> {
    try {
      const content = await readFile(path, 'utf-8');
      const config = JSON.parse(content);

      if (!config.servers || !Array.isArray(config.servers)) {
        throw new MCPConfigurationError('Invalid configuration file: missing servers array');
      }

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new MCPConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Discover servers from registry
   */
  discoverFromRegistry(): DiscoveredServer[] {
    this._log('Discovering servers from registry');

    const servers: DiscoveredServer[] = [];

    for (const [name, entry] of this._registry) {
      const server: DiscoveredServer = {
        name,
        config: {
          name,
          transport: entry.transport,
          capabilities: entry.capabilities,
          enabled: true,
        },
        source: 'registry',
        enabled: true,
      };

      // Only add if not already discovered from file
      if (!this._discoveredServers.has(name)) {
        this._discoveredServers.set(name, server);
        servers.push(server);

        this._log(`Discovered server from registry: ${name}`);
      }
    }

    this._log(`Discovered ${servers.length} servers from registry`);
    return servers;
  }

  // ========================================================================
  // Server Registry
  // ========================================================================

  /**
   * Register a server in the registry
   */
  registerServer(entry: ServerRegistryEntry): void {
    this._log(`Registering server: ${entry.name}`);
    this._registry.set(entry.name, entry);
    this.emit('registered', entry);
  }

  /**
   * Unregister a server from the registry
   */
  unregisterServer(name: string): boolean {
    this._log(`Unregistering server: ${name}`);
    const result = this._registry.delete(name);
    if (result) {
      this.emit('unregistered', name);
    }
    return result;
  }

  /**
   * Get a server from the registry
   */
  getRegistryEntry(name: string): ServerRegistryEntry | undefined {
    return this._registry.get(name);
  }

  /**
   * Get all registered servers
   */
  getAllRegistryEntries(): ServerRegistryEntry[] {
    return Array.from(this._registry.values());
  }

  /**
   * Load registry from file
   */
  async loadRegistry(path: string): Promise<void> {
    this._log(`Loading registry from: ${path}`);

    try {
      const content = await readFile(path, 'utf-8');
      const entries: ServerRegistryEntry[] = JSON.parse(content);

      for (const entry of entries) {
        this.registerServer(entry);
      }

      this._log(`Loaded ${entries.length} registry entries`);
    } catch (error) {
      throw new MCPConfigurationError(
        `Failed to load registry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save registry to file
   */
  async saveRegistry(path: string): Promise<void> {
    this._log(`Saving registry to: ${path}`);

    const entries = this.getAllRegistryEntries();
    const content = JSON.stringify(entries, null, 2);

    const { writeFile, mkdir } = await import('fs/promises');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');

    this._log(`Saved ${entries.length} registry entries`);
  }

  // ========================================================================
  // Server Management
  // ========================================================================

  /**
   * Get a discovered server by name
   */
  getServer(name: string): DiscoveredServer | undefined {
    return this._discoveredServers.get(name);
  }

  /**
   * Get all discovered servers
   */
  getAllServers(): DiscoveredServer[] {
    return Array.from(this._discoveredServers.values());
  }

  /**
   * Get enabled servers
   */
  getEnabledServers(): DiscoveredServer[] {
    return this.getAllServers().filter((s) => s.enabled);
  }

  /**
   * Add a manually configured server
   */
  addServer(config: ServerConfig): DiscoveredServer {
    const server: DiscoveredServer = {
      name: config.name,
      config,
      source: 'manual',
      enabled: config.enabled !== false,
    };

    this._discoveredServers.set(config.name, server);
    this.emit('added', server);

    this._log(`Added manual server: ${config.name}`);

    return server;
  }

  /**
   * Remove a server
   */
  removeServer(name: string): boolean {
    const result = this._discoveredServers.delete(name);
    if (result) {
      this.emit('removed', name);
      this._log(`Removed server: ${name}`);
    }
    return result;
  }

  /**
   * Enable a server
   */
  enableServer(name: string): boolean {
    const server = this._discoveredServers.get(name);
    if (server) {
      server.enabled = true;
      this.emit('enabled', name);
      this._log(`Enabled server: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Disable a server
   */
  disableServer(name: string): boolean {
    const server = this._discoveredServers.get(name);
    if (server) {
      server.enabled = false;
      this.emit('disabled', name);
      this._log(`Disabled server: ${name}`);
      return true;
    }
    return false;
  }

  // ========================================================================
  // Built-in Server Registry
  // ========================================================================

  /**
   * Register built-in servers
   */
  registerBuiltinServers(): void {
    this._log('Registering built-in servers');

    // Filesystem server
    this.registerServer({
      name: 'filesystem',
      description: 'Local filesystem access',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      },
      capabilities: {
        resources: { subscribe: true, listChanged: true },
      },
    });

    // GitHub server
    this.registerServer({
      name: 'github',
      description: 'GitHub integration',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      },
      capabilities: {
        tools: { listChanged: true },
      },
    });

    // Fetch server
    this.registerServer({
      name: 'fetch',
      description: 'HTTP fetching capabilities',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
      },
      capabilities: {
        tools: { listChanged: true },
      },
    });

    // PostgreSQL server
    this.registerServer({
      name: 'postgresql',
      description: 'PostgreSQL database access',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
      },
    });

    // SQLite server
    this.registerServer({
      name: 'sqlite',
      description: 'SQLite database access',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite'],
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
      },
    });

    this._log('Registered built-in servers');
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Log a debug message
   */
  private _log(...args: unknown[]): void {
    if (this._options.debug) {
      console.log('[MCPDiscovery]', ...args);
    }
  }

  /**
   * Clear all discovered servers
   */
  clear(): void {
    this._discoveredServers.clear();
    this._log('Cleared all discovered servers');
  }

  /**
   * Dispose of the discovery instance
   */
  dispose(): void {
    this._log('Disposing discovery');
    this.clear();
    this._registry.clear();
    this.removeAllListeners();
  }
}

/**
 * Global discovery instance
 */
let globalDiscovery: MCPDiscovery | undefined;

/**
 * Get the global discovery instance
 */
export function getGlobalDiscovery(options?: DiscoveryOptions): MCPDiscovery {
  if (!globalDiscovery) {
    globalDiscovery = new MCPDiscovery(options);
  }
  return globalDiscovery;
}

/**
 * Set the global discovery instance
 */
export function setGlobalDiscovery(discovery: MCPDiscovery): void {
  globalDiscovery = discovery;
}

/**
 * Server capability matcher
 */
export class ServerCapabilityMatcher {
  /**
   * Check if a server supports a specific capability
   */
  static hasCapability(
    capabilities: ServerCapabilities,
    feature: 'tools' | 'resources' | 'prompts' | 'logging',
    subFeature?: string
  ): boolean {
    const featureCapabilities = capabilities[feature];
    if (!featureCapabilities) {
      return false;
    }

    if (subFeature) {
      return (featureCapabilities as Record<string, boolean>)[subFeature] === true;
    }

    return true;
  }

  /**
   * Find servers with a specific capability
   */
  static findServersWithCapability(
    servers: DiscoveredServer[],
    feature: 'tools' | 'resources' | 'prompts' | 'logging',
    subFeature?: string
  ): DiscoveredServer[] {
    return servers.filter((server) => {
      const caps = server.config.capabilities;
      if (!caps) return false;
      return this.hasCapability(caps, feature, subFeature);
    });
  }

  /**
   * Get capability summary for a server
   */
  static getCapabilitySummary(capabilities: ServerCapabilities): string[] {
    const summary: string[] = [];

    if (capabilities.tools) {
      summary.push('tools');
      if (capabilities.tools.listChanged) summary.push('  - listChanged');
    }

    if (capabilities.resources) {
      summary.push('resources');
      if (capabilities.resources.subscribe) summary.push('  - subscribe');
      if (capabilities.resources.listChanged) summary.push('  - listChanged');
    }

    if (capabilities.prompts) {
      summary.push('prompts');
      if (capabilities.prompts.listChanged) summary.push('  - listChanged');
    }

    if (capabilities.logging) {
      summary.push('logging');
    }

    if (capabilities.experimental) {
      summary.push('experimental');
    }

    return summary;
  }
}
