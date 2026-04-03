/**
 * onInit.ts
 * 
 * Application Initialization Hook Implementation
 * 
 * This hook is triggered when the application is initializing, before
 * any other components are loaded. It allows plugins to perform early
 * setup and configuration.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnInitData, HookContext } from '../types';

/**
 * onInit hook definition
 */
export const onInitDefinition: HookDefinition<OnInitData> = {
  name: 'onInit',
  description: 'Called when the application is initializing. Plugins can perform early setup and configuration.',
  category: HookCategory.LIFECYCLE,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 30000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Initialize plugin resources
plugin.registerHook('onInit', async (context) => {
  const { appVersion, appConfig } = context.data;
  console.log(\`Initializing plugin for app version \${appVersion}\`);
  
  // Load plugin configuration
  await context.getPluginConfig();
  
  // Initialize resources
  await initializeResources();
});`,
    `// Check compatibility
plugin.registerHook('onInit', async (context) => {
  const { appVersion } = context.data;
  
  if (!isCompatible(appVersion)) {
    console.warn('Plugin may not be compatible with this app version');
  }
});`
  ],
  relatedHooks: ['onExit'],
  schema: {
    input: {
      type: 'object',
      properties: {
        appVersion: { type: 'string', description: 'Application version' },
        appConfig: { type: 'object', description: 'Application configuration' },
        env: { type: 'object', description: 'Environment variables' },
        args: { type: 'array', items: { type: 'string' }, description: 'Command line arguments' },
        cwd: { type: 'string', description: 'Working directory' }
      },
      required: ['appVersion', 'cwd']
    }
  }
};

/**
 * onInit hook context
 */
export interface OnInitContext extends HookContext<OnInitData> {
  /** Get plugin configuration */
  getPluginConfig(): Promise<Record<string, any>>;
  /** Set plugin configuration */
  setPluginConfig(config: Record<string, any>): Promise<void>;
  /** Register a cleanup function to be called on exit */
  registerCleanup(cleanupFn: () => Promise<void> | void): void;
  /** Log initialization message */
  log(message: string, level?: 'debug' | 'info' | 'warn' | 'error'): void;
}

/**
 * Creates an onInit hook context
 */
export function createOnInitContext(
  data: OnInitData,
  executionId: string
): OnInitContext {
  const cleanupFunctions: Array<() => Promise<void> | void> = [];

  return {
    hookName: 'onInit',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnInitData>(key: K): OnInitData[K] {
      return data[key];
    },

    set<K extends keyof OnInitData>(key: K, value: OnInitData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    async getPluginConfig(): Promise<Record<string, any>> {
      // Implementation would retrieve plugin config
      return {};
    },

    async setPluginConfig(config: Record<string, any>): Promise<void> {
      // Implementation would store plugin config
    },

    registerCleanup(cleanupFn: () => Promise<void> | void): void {
      cleanupFunctions.push(cleanupFn);
    },

    log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
      const prefix = `[onInit] [${level.toUpperCase()}]`;
      console[level](prefix, message);
    }
  };
}

/**
 * Default onInit handler
 */
export async function defaultOnInitHandler(context: OnInitContext): Promise<void> {
  const { appVersion, cwd } = context.data;
  
  context.log(`Application initializing (version: ${appVersion}, cwd: ${cwd})`);
  
  // Perform any necessary initialization
  // This is a placeholder for actual initialization logic
}

export default onInitDefinition;
