/**
 * MCP Configuration Validator
 * 
 * This file contains utilities for validating MCP configuration.
 */

import { z } from 'zod';
import { MCPConfig, ServerConfig, TransportConfig } from '../types';
import { MCPConfigurationError } from '../utils/errors';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Strict mode (fail on warnings)
   */
  strict?: boolean;

  /**
   * Allow unknown properties
   */
  allowUnknown?: boolean;

  /**
   * Check server connectivity
   */
  checkConnectivity?: boolean;
}

/**
 * Zod schemas for validation
 */
const StdioTransportSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

const SSETransportSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const HTTPTransportSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const WebSocketTransportSchema = z.object({
  type: z.literal('websocket'),
  url: z.string().url(),
  protocols: z.array(z.string()).optional(),
});

const TransportSchema = z.discriminatedUnion('type', [
  StdioTransportSchema,
  SSETransportSchema,
  HTTPTransportSchema,
  WebSocketTransportSchema,
]);

const ServerCapabilitiesSchema = z.object({
  experimental: z.record(z.unknown()).optional(),
  logging: z.record(z.unknown()).optional(),
  prompts: z.object({
    listChanged: z.boolean().optional(),
  }).optional(),
  resources: z.object({
    subscribe: z.boolean().optional(),
    listChanged: z.boolean().optional(),
  }).optional(),
  tools: z.object({
    listChanged: z.boolean().optional(),
  }).optional(),
});

const ServerConfigSchema = z.object({
  name: z.string().min(1),
  transport: TransportSchema,
  capabilities: ServerCapabilitiesSchema.optional(),
  enabled: z.boolean().optional(),
  autoReconnect: z.boolean().optional(),
  reconnectDelay: z.number().min(0).optional(),
  maxReconnectAttempts: z.number().min(0).optional(),
  timeout: z.number().min(0).optional(),
});

const MCPConfigSchema = z.object({
  version: z.string().optional(),
  servers: z.array(ServerConfigSchema),
  defaults: z.object({
    timeout: z.number().min(0).optional(),
    autoReconnect: z.boolean().optional(),
    reconnectDelay: z.number().min(0).optional(),
  }).optional(),
});

/**
 * Validate MCP configuration
 */
export function validateMCPConfig(
  config: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Run Zod validation
  const result = MCPConfigSchema.safeParse(config);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VIOLATION',
      });
    }
  }

  // Additional validation
  if (typeof config === 'object' && config !== null) {
    const cfg = config as MCPConfig;

    // Check for duplicate server names
    if (cfg.servers) {
      const names = new Map<string, number[]>();
      cfg.servers.forEach((server, index) => {
        if (!names.has(server.name)) {
          names.set(server.name, []);
        }
        names.get(server.name)!.push(index);
      });

      for (const [name, indices] of names) {
        if (indices.length > 1) {
          errors.push({
            path: `servers`,
            message: `Duplicate server name "${name}" at indices: ${indices.join(', ')}`,
            code: 'DUPLICATE_SERVER_NAME',
          });
        }
      }

      // Validate each server
      cfg.servers.forEach((server, index) => {
        validateServer(server, index, errors, warnings, options);
      });
    }

    // Check version format
    if (cfg.version && !isValidVersion(cfg.version)) {
      warnings.push({
        path: 'version',
        message: `Version "${cfg.version}" does not follow semantic versioning`,
        code: 'INVALID_VERSION_FORMAT',
      });
    }
  }

  return {
    valid: errors.length === 0 && (options.strict ? warnings.length === 0 : true),
    errors,
    warnings,
  };
}

/**
 * Validate a server configuration
 */
function validateServer(
  server: ServerConfig,
  index: number,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  options: ValidationOptions
): void {
  const path = `servers[${index}]`;

  // Check server name format
  if (!/^[a-zA-Z0-9_-]+$/.test(server.name)) {
    warnings.push({
      path: `${path}.name`,
      message: `Server name "${server.name}" should only contain alphanumeric characters, hyphens, and underscores`,
      code: 'INVALID_NAME_FORMAT',
    });
  }

  // Validate transport-specific settings
  validateTransport(server.transport, `${path}.transport`, errors, warnings);

  // Check timeout values
  if (server.timeout !== undefined && server.timeout < 1000) {
    warnings.push({
      path: `${path}.timeout`,
      message: `Timeout ${server.timeout}ms is very short`,
      code: 'SHORT_TIMEOUT',
    });
  }

  if (server.timeout !== undefined && server.timeout > 300000) {
    warnings.push({
      path: `${path}.timeout`,
      message: `Timeout ${server.timeout}ms is very long`,
      code: 'LONG_TIMEOUT',
    });
  }

  // Check reconnect settings
  if (server.maxReconnectAttempts !== undefined && server.maxReconnectAttempts > 10) {
    warnings.push({
      path: `${path}.maxReconnectAttempts`,
      message: `Max reconnect attempts ${server.maxReconnectAttempts} is very high`,
      code: 'HIGH_RECONNECT_ATTEMPTS',
    });
  }
}

/**
 * Validate transport configuration
 */
function validateTransport(
  transport: TransportConfig,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  switch (transport.type) {
    case 'stdio':
      // Check for potentially dangerous commands
      const dangerousCommands = ['rm', 'del', 'format', 'mkfs'];
      const cmd = transport.command.toLowerCase();
      if (dangerousCommands.some((d) => cmd.includes(d))) {
        warnings.push({
          path: `${path}.command`,
          message: `Command "${transport.command}" may be potentially dangerous`,
          code: 'DANGEROUS_COMMAND',
        });
      }
      break;

    case 'sse':
    case 'http':
    case 'websocket':
      // Check for localhost URLs
      if (transport.url.includes('localhost') || transport.url.includes('127.0.0.1')) {
        warnings.push({
          path: `${path}.url`,
          message: `URL "${transport.url}" points to localhost`,
          code: 'LOCALHOST_URL',
        });
      }

      // Check for HTTP (non-secure) URLs
      if (transport.url.startsWith('http:') && !transport.url.startsWith('http://localhost')) {
        warnings.push({
          path: `${path}.url`,
          message: `URL "${transport.url}" uses unencrypted HTTP`,
          code: 'UNENCRYPTED_HTTP',
        });
      }
      break;
  }
}

/**
 * Check if version follows semantic versioning
 */
function isValidVersion(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  return semverRegex.test(version);
}

/**
 * Assert that configuration is valid
 */
export function assertValidConfig(
  config: unknown,
  options: ValidationOptions = {}
): asserts config is MCPConfig {
  const result = validateMCPConfig(config, options);

  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
    throw new MCPConfigurationError(`Invalid configuration: ${messages.join('; ')}`);
  }
}

/**
 * Get validation errors as string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('Configuration is valid');
  } else {
    lines.push('Configuration is invalid');
  }

  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      lines.push(`  [${error.code}] ${error.path}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      lines.push(`  [${warning.code}] ${warning.path}: ${warning.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Validate a single server configuration
 */
export function validateServerConfig(
  server: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const result = ServerConfigSchema.safeParse(server);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VIOLATION',
      });
    }
  }

  if (typeof server === 'object' && server !== null) {
    validateServer(server as ServerConfig, 0, errors, warnings, options);
  }

  return {
    valid: errors.length === 0 && (options.strict ? warnings.length === 0 : true),
    errors,
    warnings,
  };
}

/**
 * Quick validation check
 */
export function isValidConfig(config: unknown): boolean {
  const result = validateMCPConfig(config);
  return result.valid;
}
