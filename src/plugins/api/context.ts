/**
 * context.ts
 * 
 * Plugin Context Helpers
 * 
 * This file provides helper functions for working with plugin contexts,
 * including context creation, validation, and utility functions.
 * 
 * @module PluginAPI
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { PluginContext, PluginConfig, PluginLogger, PluginStorage, PluginMetadata } from '../Plugin';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a mock plugin context for testing.
 * 
 * @param metadata - Plugin metadata
 * @param config - Plugin configuration
 * @returns Mock plugin context
 */
export function createMockContext(
  metadata: PluginMetadata,
  config: PluginConfig = {}
): PluginContext {
  const storage = createMockStorage();
  
  return {
    instanceId: uuidv4(),
    metadata,
    config,
    hostVersion: '1.0.0',
    api: {},
    logger: createMockLogger(),
    storage,
    ui: createMockUI(),
    network: createMockNetwork(),
    filesystem: createMockFileSystem(),
    shell: createMockShell(),
    llm: createMockLLM()
  };
}

/**
 * Creates a mock logger.
 * 
 * @returns Mock logger
 */
export function createMockLogger(): PluginLogger {
  return {
    debug: (...args: any[]) => console.debug('[Mock]', ...args),
    info: (...args: any[]) => console.info('[Mock]', ...args),
    warn: (...args: any[]) => console.warn('[Mock]', ...args),
    error: (...args: any[]) => console.error('[Mock]', ...args),
    trace: (...args: any[]) => console.trace('[Mock]', ...args)
  };
}

/**
 * Creates a mock storage.
 * 
 * @returns Mock storage
 */
export function createMockStorage(): PluginStorage {
  const data = new Map<string, any>();
  
  return {
    get: async <T>(key: string, defaultValue?: T) => {
      return data.has(key) ? data.get(key) : defaultValue;
    },
    set: async <T>(key: string, value: T) => {
      data.set(key, value);
    },
    delete: async (key: string) => {
      data.delete(key);
    },
    has: async (key: string) => {
      return data.has(key);
    },
    keys: async () => {
      return Array.from(data.keys());
    },
    clear: async () => {
      data.clear();
    }
  };
}

/**
 * Creates a mock UI interface.
 * 
 * @returns Mock UI
 */
export function createMockUI(): any {
  return {
    showNotification: (message: string, type?: string) => {
      console.log(`[Notification] ${type || 'info'}: ${message}`);
    },
    showModal: async (title: string, content: string) => {
      console.log(`[Modal] ${title}: ${content}`);
      return { buttonId: 'ok', cancelled: false };
    },
    showInput: async (title: string, placeholder?: string, defaultValue?: string) => {
      console.log(`[Input] ${title}`);
      return defaultValue || '';
    },
    showConfirm: async (title: string, message: string) => {
      console.log(`[Confirm] ${title}: ${message}`);
      return true;
    },
    showProgress: (title: string) => ({
      update: (progress: number, message?: string) => {},
      complete: (message?: string) => {},
      error: (message: string) => {},
      dispose: () => {}
    }),
    registerStatusBarItem: (id: string, options: any) => {},
    updateStatusBarItem: (id: string, options: any) => {},
    removeStatusBarItem: (id: string) => {},
    registerWebviewPanel: (id: string, options: any) => {}
  };
}

/**
 * Creates a mock network interface.
 * 
 * @returns Mock network
 */
export function createMockNetwork(): any {
  return {
    request: async (options: any) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: Buffer.from(''),
      url: ''
    }),
    fetch: async (url: string) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: Buffer.from(''),
      url
    }),
    websocket: async (url: string) => ({
      send: () => {},
      close: () => {},
      onMessage: () => {},
      onClose: () => {},
      onError: () => {},
      readyState: 1
    }),
    getAllowedDomains: () => []
  };
}

/**
 * Creates a mock file system interface.
 * 
 * @returns Mock file system
 */
export function createMockFileSystem(): any {
  const files = new Map<string, any>();
  
  return {
    readFile: async (path: string) => {
      return files.get(path) || Buffer.from('');
    },
    writeFile: async (path: string, data: any) => {
      files.set(path, data);
    },
    exists: async (path: string) => {
      return files.has(path);
    },
    stat: async (path: string) => {
      throw new Error('Not implemented');
    },
    mkdir: async (path: string) => {},
    readdir: async (path: string) => [],
    delete: async (path: string) => {
      files.delete(path);
    },
    rename: async (oldPath: string, newPath: string) => {},
    copy: async (src: string, dest: string) => {},
    watch: (path: string) => ({
      onChange: () => {},
      onError: () => {},
      close: () => {}
    }),
    getAllowedPaths: () => []
  };
}

/**
 * Creates a mock shell interface.
 * 
 * @returns Mock shell
 */
export function createMockShell(): any {
  return {
    execute: async (command: string) => ({
      stdout: '',
      stderr: '',
      exitCode: 0
    }),
    executeStream: (command: string) => ({
      onStdout: () => {},
      onStderr: () => {},
      onExit: () => {},
      onError: () => {},
      kill: () => true
    }),
    spawn: (command: string, args?: string[]) => ({
      pid: 0,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      kill: () => true,
      onExit: () => {},
      onError: () => {}
    }),
    getAllowedCommands: () => [],
    getAllowedPaths: () => []
  };
}

/**
 * Creates a mock LLM interface.
 * 
 * @returns Mock LLM
 */
export function createMockLLM(): any {
  return {
    complete: async (prompt: string) => ({
      content: 'Mock response',
      model: 'mock',
      usage: { prompt: 0, completion: 0, total: 0 },
      finishReason: 'stop'
    }),
    streamComplete: (prompt: string) => ({
      onToken: () => {},
      onComplete: () => {},
      onError: () => {},
      abort: () => {}
    }),
    getAvailableModels: async () => ['mock'],
    getModelInfo: async (model: string) => ({
      id: 'mock',
      name: 'Mock Model',
      description: 'A mock model for testing',
      maxTokens: 1000,
      contextWindow: 2000,
      capabilities: []
    }),
    countTokens: async (text: string) => Math.ceil(text.length / 4)
  };
}

/**
 * Validates a plugin context.
 * 
 * @param context - Context to validate
 * @returns Validation result
 */
export function validateContext(context: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!context) {
    errors.push('Context is required');
    return { valid: false, errors };
  }
  
  if (!context.instanceId) {
    errors.push('instanceId is required');
  }
  
  if (!context.metadata) {
    errors.push('metadata is required');
  }
  
  if (!context.config) {
    errors.push('config is required');
  }
  
  if (!context.logger) {
    errors.push('logger is required');
  }
  
  if (!context.storage) {
    errors.push('storage is required');
  }
  
  if (!context.ui) {
    errors.push('ui is required');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Merges configuration with defaults.
 * 
 * @param config - User configuration
 * @param defaults - Default configuration
 * @returns Merged configuration
 */
export function mergeConfig<T extends Record<string, any>>(
  config: Partial<T>,
  defaults: T
): T {
  return {
    ...defaults,
    ...config
  };
}

/**
 * Gets a nested value from an object.
 * 
 * @param obj - Object to search
 * @param path - Path to value (e.g., 'a.b.c')
 * @returns Value or undefined
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

/**
 * Sets a nested value in an object.
 * 
 * @param obj - Object to modify
 * @param path - Path to value (e.g., 'a.b.c')
 * @param value - Value to set
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  const target = keys.reduce((current, key) => {
    if (!current[key]) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  target[lastKey] = value;
}
