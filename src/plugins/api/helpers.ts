/**
 * helpers.ts
 * 
 * Plugin Development Helpers
 * 
 * This file provides utility functions and helpers for plugin development,
 * including common operations, validators, and convenience functions.
 * 
 * @module PluginAPI
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginConfig, ConfigSchemaEntry } from '../Plugin';

// ============================================================================
// Plugin Creation Helpers
// ============================================================================

/**
 * Creates a simple plugin class dynamically.
 * 
 * @param metadata - Plugin metadata
 * @param activateFn - Activation function
 * @returns Plugin class
 */
export function createPlugin(
  metadata: PluginMetadata,
  activateFn: (plugin: Plugin) => Promise<void> | void
): typeof Plugin {
  return class extends Plugin {
    metadata = metadata;
    
    async onActivate(): Promise<void> {
      await activateFn(this);
    }
  };
}

/**
 * Creates a plugin with configuration schema.
 * 
 * @param metadata - Plugin metadata
 * @param configSchema - Configuration schema
 * @param activateFn - Activation function
 * @returns Plugin class
 */
export function createConfigurablePlugin(
  metadata: PluginMetadata,
  configSchema: ConfigSchemaEntry[],
  activateFn: (plugin: Plugin) => Promise<void> | void
): typeof Plugin {
  return class extends Plugin {
    metadata = metadata;
    configSchema = configSchema;
    
    async onActivate(): Promise<void> {
      await activateFn(this);
    }
  };
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Gets a configuration value with fallback.
 * 
 * @param config - Plugin configuration
 * @param key - Configuration key
 * @param defaultValue - Default value
 * @returns Configuration value
 */
export function getConfigValue<T>(
  config: PluginConfig,
  key: string,
  defaultValue: T
): T {
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Sets a configuration value.
 * 
 * @param config - Plugin configuration
 * @param key - Configuration key
 * @param value - Value to set
 */
export function setConfigValue<T>(
  config: PluginConfig,
  key: string,
  value: T
): void {
  config[key] = value;
}

/**
 * Validates configuration against schema.
 * 
 * @param config - Configuration to validate
 * @param schema - Configuration schema
 * @returns Validation result
 */
export function validateConfig(
  config: PluginConfig,
  schema: ConfigSchemaEntry[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const entry of schema) {
    const value = config[entry.key];
    
    // Check required
    if (entry.required && (value === undefined || value === null)) {
      errors.push(`Missing required configuration: ${entry.key}`);
      continue;
    }
    
    // Skip if not provided and not required
    if (value === undefined || value === null) {
      continue;
    }
    
    // Validate type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (entry.type !== actualType) {
      errors.push(`Invalid type for ${entry.key}: expected ${entry.type}, got ${actualType}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Hook Helpers
// ============================================================================

/**
 * Creates a hook handler with priority.
 * 
 * @param handler - Handler function
 * @param priority - Handler priority
 * @returns Handler with metadata
 */
export function createHookHandler<T, R>(
  handler: (context: any) => Promise<R> | R,
  priority: number = 0
): { handler: typeof handler; priority: number } {
  return { handler, priority };
}

/**
 * Creates a cancellable hook handler.
 * 
 * @param handler - Handler function that can cancel
 * @returns Handler function
 */
export function createCancellableHandler<T>(
  handler: (context: any) => Promise<void> | void
): (context: any) => Promise<void> {
  return async (context: any) => {
    if (context.cancelled) {
      return;
    }
    await handler(context);
  };
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Creates a prefixed logger.
 * 
 * @param plugin - Plugin instance
 * @param prefix - Log prefix
 * @returns Prefixed logger
 */
export function createPrefixedLogger(plugin: Plugin, prefix: string) {
  return {
    debug: (message: string, ...args: any[]) => 
      plugin.logger.debug(`[${prefix}] ${message}`, ...args),
    info: (message: string, ...args: any[]) => 
      plugin.logger.info(`[${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => 
      plugin.logger.warn(`[${prefix}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => 
      plugin.logger.error(`[${prefix}] ${message}`, ...args),
    trace: (message: string, ...args: any[]) => 
      plugin.logger.trace(`[${prefix}] ${message}`, ...args)
  };
}

// ============================================================================
// String Helpers
// ============================================================================

/**
 * Truncates a string to a maximum length.
 * 
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add (default: '...')
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Converts a string to kebab-case.
 * 
 * @param str - String to convert
 * @returns Kebab-case string
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Converts a string to camelCase.
 * 
 * @param str - String to convert
 * @returns camelCase string
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^([A-Z])/, c => c.toLowerCase());
}

// ============================================================================
// Array Helpers
// ============================================================================

/**
 * Removes duplicates from an array.
 * 
 * @param arr - Array to deduplicate
 * @returns Deduplicated array
 */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Chunks an array into smaller arrays.
 * 
 * @param arr - Array to chunk
 * @param size - Chunk size
 * @returns Chunked array
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Flattens a nested array.
 * 
 * @param arr - Array to flatten
 * @returns Flattened array
 */
export function flatten<T>(arr: any[]): T[] {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

// ============================================================================
// Object Helpers
// ============================================================================

/**
 * Picks specific keys from an object.
 * 
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns Picked object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specific keys from an object.
 * 
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns Object without omitted keys
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Deep clones an object.
 * 
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

// ============================================================================
// Async Helpers
// ============================================================================

/**
 * Sleeps for a specified duration.
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs a function with timeout.
 * 
 * @param fn - Function to run
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves with function result
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    fn()
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Retries a function with exponential backoff.
 * 
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise that resolves with function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const delay = options.delay || 1000;
  const backoff = options.backoff || 2;
  
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const waitTime = delay * Math.pow(backoff, i);
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError!;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Checks if a value is a valid plugin ID.
 * 
 * @param id - ID to validate
 * @returns True if valid
 */
export function isValidPluginId(id: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id);
}

/**
 * Checks if a value is a valid semantic version.
 * 
 * @param version - Version to validate
 * @returns True if valid
 */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9._-]+)?(\+[a-zA-Z0-9._-]+)?$/.test(version);
}

/**
 * Checks if a string is empty or whitespace only.
 * 
 * @param str - String to check
 * @returns True if empty
 */
export function isEmpty(str: string): boolean {
  return !str || str.trim().length === 0;
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Creates an event emitter with typed events.
 * 
 * @returns Typed event emitter
 */
export function createEventEmitter<T extends Record<string, any>>() {
  const listeners: Map<keyof T, Set<(data: any) => void>> = new Map();
  
  return {
    on<K extends keyof T>(event: K, listener: (data: T[K]) => void): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
      
      return () => {
        listeners.get(event)?.delete(listener);
      };
    },
    
    emit<K extends keyof T>(event: K, data: T[K]): void {
      listeners.get(event)?.forEach(listener => listener(data));
    },
    
    off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
      listeners.get(event)?.delete(listener);
    }
  };
}
