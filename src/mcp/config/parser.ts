/**
 * MCP Configuration Parser
 * 
 * This file contains utilities for parsing MCP configuration files.
 */

import { readFile } from 'fs/promises';
import { MCPConfig, ServerConfig, TransportConfig } from '../types';
import { MCPConfigurationError } from '../utils/errors';

/**
 * Supported configuration file formats
 */
export type ConfigFormat = 'json' | 'yaml' | 'yml';

/**
 * Parse options
 */
export interface ParseOptions {
  /**
   * Configuration format (auto-detected if not specified)
   */
  format?: ConfigFormat;

  /**
   * Validate after parsing
   */
  validate?: boolean;

  /**
   * Expand environment variables
   */
  expandEnv?: boolean;
}

/**
 * Parse a configuration file
 */
export async function parseConfigFile(
  filePath: string,
  options: ParseOptions = {}
): Promise<MCPConfig> {
  const content = await readFile(filePath, 'utf-8');
  return parseConfig(content, { ...options, format: detectFormat(filePath) });
}

/**
 * Parse configuration from string
 */
export function parseConfig(
  content: string,
  options: ParseOptions = {}
): MCPConfig {
  const format = options.format || 'json';

  let parsed: unknown;

  try {
    switch (format) {
      case 'json':
        parsed = JSON.parse(content);
        break;
      case 'yaml':
      case 'yml':
        parsed = parseYAML(content);
        break;
      default:
        throw new MCPConfigurationError(`Unsupported format: ${format}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MCPConfigurationError(`Invalid ${format}: ${error.message}`);
    }
    throw error;
  }

  // Expand environment variables
  if (options.expandEnv !== false) {
    parsed = expandEnvironmentVariables(parsed);
  }

  // Validate
  if (options.validate !== false) {
    validateConfig(parsed);
  }

  return parsed as MCPConfig;
}

/**
 * Detect configuration format from file extension
 */
export function detectFormat(filePath: string): ConfigFormat {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'json';
  }
}

/**
 * Simple YAML parser (for basic configurations)
 */
function parseYAML(content: string): unknown {
  // This is a simplified YAML parser for basic configurations
  // For production, consider using a proper YAML library like js-yaml

  const lines = content.split('\n');
  const result: Record<string, unknown> = {};
  let currentSection: string | null = null;
  let currentArray: unknown[] | null = null;
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Calculate indent
    const indent = line.search(/\S/);

    // Parse key-value pairs
    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      if (!value) {
        // Start of a new section or array
        if (indent > indentLevel) {
          // Nested section
        } else {
          currentSection = key.trim();
          result[currentSection] = {};
          indentLevel = indent;
        }
      } else {
        // Key-value pair
        const parsedValue = parseYAMLValue(value);
        if (currentSection && indent > indentLevel) {
          (result[currentSection] as Record<string, unknown>)[key.trim()] = parsedValue;
        } else {
          result[key.trim()] = parsedValue;
        }
      }
    }
  }

  return result;
}

/**
 * Parse a YAML value
 */
function parseYAMLValue(value: string): unknown {
  const trimmed = value.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null
  if (trimmed === 'null' || trimmed === '~') return null;

  // Number
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

  // String (remove quotes if present)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Expand environment variables in configuration
 */
function expandEnvironmentVariables(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const [name, defaultValue] = varName.split(':-');
      return process.env[name] || defaultValue || match;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(expandEnvironmentVariables);
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvironmentVariables(value);
    }
    return result;
  }

  return obj;
}

/**
 * Validate configuration structure
 */
export function validateConfig(config: unknown): asserts config is MCPConfig {
  if (typeof config !== 'object' || config === null) {
    throw new MCPConfigurationError('Configuration must be an object');
  }

  const cfg = config as Record<string, unknown>;

  // Check version
  if (cfg.version && typeof cfg.version !== 'string') {
    throw new MCPConfigurationError('Version must be a string');
  }

  // Check servers
  if (!cfg.servers) {
    throw new MCPConfigurationError('Configuration must have a servers array');
  }

  if (!Array.isArray(cfg.servers)) {
    throw new MCPConfigurationError('Servers must be an array');
  }

  for (let i = 0; i < cfg.servers.length; i++) {
    validateServerConfig(cfg.servers[i], i);
  }
}

/**
 * Validate server configuration
 */
function validateServerConfig(server: unknown, index: number): void {
  if (typeof server !== 'object' || server === null) {
    throw new MCPConfigurationError(`Server ${index} must be an object`);
  }

  const srv = server as Record<string, unknown>;

  // Check name
  if (!srv.name || typeof srv.name !== 'string') {
    throw new MCPConfigurationError(`Server ${index} must have a name`);
  }

  // Check transport
  if (!srv.transport || typeof srv.transport !== 'object') {
    throw new MCPConfigurationError(`Server ${index} must have a transport configuration`);
  }

  const transport = srv.transport as Record<string, unknown>;

  if (!transport.type || typeof transport.type !== 'string') {
    throw new MCPConfigurationError(`Server ${index} transport must have a type`);
  }

  // Validate transport-specific fields
  validateTransportConfig(transport, index);
}

/**
 * Validate transport configuration
 */
function validateTransportConfig(transport: Record<string, unknown>, serverIndex: number): void {
  const type = transport.type as string;

  switch (type) {
    case 'stdio':
      if (!transport.command || typeof transport.command !== 'string') {
        throw new MCPConfigurationError(
          `Server ${serverIndex} stdio transport must have a command`
        );
      }
      break;

    case 'sse':
    case 'http':
    case 'websocket':
      if (!transport.url || typeof transport.url !== 'string') {
        throw new MCPConfigurationError(
          `Server ${serverIndex} ${type} transport must have a url`
        );
      }
      break;

    default:
      throw new MCPConfigurationError(
        `Server ${serverIndex} has unsupported transport type: ${type}`
      );
  }
}

/**
 * Merge multiple configurations
 */
export function mergeConfigs(...configs: MCPConfig[]): MCPConfig {
  const result: MCPConfig = {
    version: configs[0]?.version || '1.0.0',
    servers: [],
  };

  const serverNames = new Set<string>();

  for (const config of configs) {
    if (config.servers) {
      for (const server of config.servers) {
        if (!serverNames.has(server.name)) {
          serverNames.add(server.name);
          result.servers.push(server);
        }
      }
    }
  }

  return result;
}

/**
 * Convert configuration to JSON string
 */
export function configToJSON(config: MCPConfig, pretty = true): string {
  return JSON.stringify(config, null, pretty ? 2 : undefined);
}

/**
 * Convert configuration to YAML string
 */
export function configToYAML(config: MCPConfig): string {
  // Simple YAML serializer
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
        if (typeof value === 'object') {
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
  }

  return lines.join('\n');
}
