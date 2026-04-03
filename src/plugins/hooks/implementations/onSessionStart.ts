/**
 * onSessionStart.ts
 * 
 * Session Started Hook Implementation
 * 
 * This hook is triggered when a new session is started. It allows plugins
 * to initialize session-specific resources and state.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnSessionStartData, HookContext } from '../types';

/**
 * onSessionStart hook definition
 */
export const onSessionStartDefinition: HookDefinition<OnSessionStartData> = {
  name: 'onSessionStart',
  description: 'Called when a new session is started. Plugins can initialize session-specific resources.',
  category: HookCategory.SESSION,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 10000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Initialize session storage
plugin.registerHook('onSessionStart', async (context) => {
  const { sessionId } = context.data;
  
  await context.setSessionData('startTime', Date.now());
  await context.setSessionData('messageCount', 0);
});`,
    `// Log session start
plugin.registerHook('onSessionStart', async (context) => {
  const { sessionId, cwd } = context.data;
  console.log(\`Session \${sessionId} started in \${cwd}\`);
});`,
    `// Load session history
plugin.registerHook('onSessionStart', async (context) => {
  const { sessionId } = context.data;
  
  const history = await context.loadHistory();
  if (history) {
    console.log(\`Loaded \${history.length} messages from history\`);
  }
});`
  ],
  relatedHooks: ['onSessionEnd'],
  schema: {
    input: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Unique session ID' },
        name: { type: 'string', description: 'Session name' },
        metadata: { type: 'object', description: 'Session metadata' },
        timestamp: { type: 'string', format: 'date-time' },
        cwd: { type: 'string', description: 'Working directory' }
      },
      required: ['sessionId', 'timestamp', 'cwd']
    }
  }
};

/**
 * onSessionStart hook context
 */
export interface OnSessionStartContext extends HookContext<OnSessionStartData> {
  /** Set session data */
  setSessionData(key: string, value: any): Promise<void>;
  /** Get session data */
  getSessionData(key: string): Promise<any>;
  /** Load session history */
  loadHistory(): Promise<any[] | null>;
  /** Set session name */
  setName(name: string): void;
  /** Add session metadata */
  addMetadata(key: string, value: any): void;
  /** Register cleanup for session end */
  registerCleanup(cleanupFn: () => Promise<void> | void): void;
  /** Log session event */
  log(message: string): void;
}

/**
 * Creates an onSessionStart hook context
 */
export function createOnSessionStartContext(
  data: OnSessionStartData,
  executionId: string
): OnSessionStartContext {
  const sessionData: Map<string, any> = new Map();
  const cleanupFunctions: Array<() => Promise<void> | void> = [];

  return {
    hookName: 'onSessionStart',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnSessionStartData>(key: K): OnSessionStartData[K] {
      return data[key];
    },

    set<K extends keyof OnSessionStartData>(key: K, value: OnSessionStartData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    async setSessionData(key: string, value: any): Promise<void> {
      sessionData.set(key, value);
    },

    async getSessionData(key: string): Promise<any> {
      return sessionData.get(key);
    },

    async loadHistory(): Promise<any[] | null> {
      // Would load from session storage
      return null;
    },

    setName(name: string): void {
      data.name = name;
    },

    addMetadata(key: string, value: any): void {
      if (!data.metadata) {
        data.metadata = {};
      }
      data.metadata[key] = value;
    },

    registerCleanup(cleanupFn: () => Promise<void> | void): void {
      cleanupFunctions.push(cleanupFn);
    },

    log(message: string): void {
      console.log(`[onSessionStart] [${data.sessionId}] ${message}`);
    }
  };
}

/**
 * Default onSessionStart handler
 */
export async function defaultOnSessionStartHandler(context: OnSessionStartContext): Promise<void> {
  const { sessionId, name, cwd } = context.data;
  
  console.log(`[onSessionStart] Session ${sessionId} started`);
  
  if (name) {
    console.log(`  Name: ${name}`);
  }
  
  console.log(`  Working directory: ${cwd}`);
  
  // Initialize session data
  await context.setSessionData('startTime', Date.now());
  await context.setSessionData('messageCount', 0);
  await context.setSessionData('toolCallCount', 0);
  
  // Add metadata
  context.addMetadata('initializedAt', new Date().toISOString());
  context.addMetadata('pluginVersion', '1.0.0');
}

export default onSessionStartDefinition;
