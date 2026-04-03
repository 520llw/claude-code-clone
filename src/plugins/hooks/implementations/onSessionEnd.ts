/**
 * onSessionEnd.ts
 * 
 * Session Ended Hook Implementation
 * 
 * This hook is triggered when a session is ended. It allows plugins
 * to clean up session resources and save session state.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnSessionEndData, HookContext } from '../types';

/**
 * onSessionEnd hook definition
 */
export const onSessionEndDefinition: HookDefinition<OnSessionEndData> = {
  name: 'onSessionEnd',
  description: 'Called when a session is ended. Plugins can clean up resources and save session state.',
  category: HookCategory.SESSION,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 10000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Save session history
plugin.registerHook('onSessionEnd', async (context) => {
  const { sessionId, messageCount, duration } = context.data;
  
  await context.saveHistory();
  console.log(\`Session \${sessionId} ended. Messages: \${messageCount}, Duration: \${duration}ms\`);
});`,
    `// Generate session summary
plugin.registerHook('onSessionEnd', async (context) => {
  const summary = await context.generateSummary();
  context.set('summary', summary);
});`,
    `// Clean up temporary files
plugin.registerHook('onSessionEnd', async (context) => {
  await context.cleanupTempFiles();
});`
  ],
  relatedHooks: ['onSessionStart'],
  schema: {
    input: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        duration: { type: 'number', description: 'Session duration in ms' },
        messageCount: { type: 'number', description: 'Number of messages' },
        toolCallCount: { type: 'number', description: 'Number of tool calls' },
        timestamp: { type: 'string', format: 'date-time' },
        summary: { type: 'string', description: 'Session summary' }
      },
      required: ['sessionId', 'duration', 'messageCount', 'toolCallCount', 'timestamp']
    }
  }
};

/**
 * onSessionEnd hook context
 */
export interface OnSessionEndContext extends HookContext<OnSessionEndData> {
  /** Save session history */
  saveHistory(): Promise<void>;
  /** Generate session summary */
  generateSummary(): Promise<string>;
  /** Export session data */
  export(format: 'json' | 'markdown'): Promise<string>;
  /** Clean up temporary files */
  cleanupTempFiles(): Promise<void>;
  /** Get session statistics */
  getStats(): { duration: number; messageCount: number; toolCallCount: number; avgResponseTime?: number };
  /** Archive session */
  archive(): Promise<void>;
  /** Log session end */
  log(message: string): void;
}

/**
 * Creates an onSessionEnd hook context
 */
export function createOnSessionEndContext(
  data: OnSessionEndData,
  executionId: string
): OnSessionEndContext {
  return {
    hookName: 'onSessionEnd',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnSessionEndData>(key: K): OnSessionEndData[K] {
      return data[key];
    },

    set<K extends keyof OnSessionEndData>(key: K, value: OnSessionEndData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    async saveHistory(): Promise<void> {
      // Would save to session storage
      console.log(`[onSessionEnd] Saving history for session ${data.sessionId}`);
    },

    async generateSummary(): Promise<string> {
      const stats = this.getStats();
      return `Session lasted ${(stats.duration / 1000 / 60).toFixed(1)} minutes with ${stats.messageCount} messages and ${stats.toolCallCount} tool calls.`;
    },

    async export(format: 'json' | 'markdown'): Promise<string> {
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }
      
      return `# Session ${data.sessionId}

**Duration:** ${(data.duration / 1000 / 60).toFixed(1)} minutes
**Messages:** ${data.messageCount}
**Tool Calls:** ${data.toolCallCount}
**Ended:** ${data.timestamp}

${data.summary || ''}
`;
    },

    async cleanupTempFiles(): Promise<void> {
      // Would clean up temp files
      console.log(`[onSessionEnd] Cleaning up temporary files`);
    },

    getStats(): { duration: number; messageCount: number; toolCallCount: number; avgResponseTime?: number } {
      return {
        duration: data.duration,
        messageCount: data.messageCount,
        toolCallCount: data.toolCallCount
      };
    },

    async archive(): Promise<void> {
      // Would archive session
      console.log(`[onSessionEnd] Archiving session ${data.sessionId}`);
    },

    log(message: string): void {
      console.log(`[onSessionEnd] [${data.sessionId}] ${message}`);
    }
  };
}

/**
 * Default onSessionEnd handler
 */
export async function defaultOnSessionEndHandler(context: OnSessionEndContext): Promise<void> {
  const { sessionId, duration, messageCount, toolCallCount } = context.data;
  
  console.log(`[onSessionEnd] Session ${sessionId} ended`);
  console.log(`  Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  Messages: ${messageCount}`);
  console.log(`  Tool calls: ${toolCallCount}`);
  
  // Generate and set summary
  const summary = await context.generateSummary();
  context.set('summary', summary);
  
  // Save history
  await context.saveHistory();
  
  // Clean up
  await context.cleanupTempFiles();
}

export default onSessionEndDefinition;
