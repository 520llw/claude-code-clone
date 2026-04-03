/**
 * onExit.ts
 * 
 * Application Exit Hook Implementation
 * 
 * This hook is triggered when the application is exiting. It allows plugins
 * to perform cleanup, save state, or prevent exit if necessary.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnExitData, HookContext } from '../types';

/**
 * onExit hook definition
 */
export const onExitDefinition: HookDefinition<OnExitData> = {
  name: 'onExit',
  description: 'Called when the application is exiting. Plugins can perform cleanup or prevent exit.',
  category: HookCategory.LIFECYCLE,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 30000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Save plugin state
plugin.registerHook('onExit', async (context) => {
  await context.saveState();
  console.log('Plugin state saved');
});`,
    `// Confirm exit with user
plugin.registerHook('onExit', async (context) => {
  const { code } = context.data;
  
  if (code === 0 && hasUnsavedChanges()) {
    const shouldExit = await context.confirm('You have unsaved changes. Exit anyway?');
    if (!shouldExit) {
      context.preventExit('User cancelled exit');
    }
  }
});`,
    `// Clean up resources
plugin.registerHook('onExit', async (context) => {
  await context.cleanup();
  console.log('Resources cleaned up');
});`
  ],
  relatedHooks: ['onInit'],
  schema: {
    input: {
      type: 'object',
      properties: {
        code: { type: 'number', description: 'Exit code' },
        reason: { type: 'string', description: 'Exit reason' },
        sessionDuration: { type: 'number', description: 'Session duration in ms' },
        timestamp: { type: 'string', format: 'date-time' },
        preventExit: { type: 'boolean', description: 'Whether to prevent exit' },
        preventReason: { type: 'string', description: 'Reason for preventing exit' }
      },
      required: ['code', 'sessionDuration', 'timestamp', 'preventExit']
    }
  }
};

/**
 * Exit codes
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  MISUSE = 2,
  CANT_EXECUTE = 126,
  COMMAND_NOT_FOUND = 127,
  INVALID_EXIT = 128,
  TERMINATED = 130,
  OUT_OF_RANGE = 255
}

/**
 * onExit hook context
 */
export interface OnExitContext extends HookContext<OnExitData> {
  /** Prevent the exit */
  preventExit(reason: string): void;
  /** Allow the exit */
  allowExit(): void;
  /** Save plugin state */
  saveState(): Promise<void>;
  /** Clean up resources */
  cleanup(): Promise<void>;
  /** Show confirmation dialog */
  confirm(message: string): Promise<boolean>;
  /** Get session statistics */
  getSessionStats(): { duration: number; messageCount: number; toolCallCount: number };
  /** Schedule a task to run after exit */
  scheduleAfterExit(task: () => Promise<void>): void;
  /** Log exit event */
  log(message: string): void;
}

/**
 * Creates an onExit hook context
 */
export function createOnExitContext(
  data: OnExitData,
  executionId: string
): OnExitContext {
  const afterExitTasks: Array<() => Promise<void>> = [];

  return {
    hookName: 'onExit',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnExitData>(key: K): OnExitData[K] {
      return data[key];
    },

    set<K extends keyof OnExitData>(key: K, value: OnExitData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    preventExit(reason: string): void {
      data.preventExit = true;
      data.preventReason = reason;
    },

    allowExit(): void {
      data.preventExit = false;
      data.preventReason = undefined;
    },

    async saveState(): Promise<void> {
      // Would save plugin state
      console.log('[onExit] Saving plugin state');
    },

    async cleanup(): Promise<void> {
      // Would clean up resources
      console.log('[onExit] Cleaning up resources');
    },

    async confirm(message: string): Promise<boolean> {
      // Would show confirmation dialog
      console.log(`[onExit] Confirm: ${message}`);
      return true;
    },

    getSessionStats(): { duration: number; messageCount: number; toolCallCount: number } {
      // Would retrieve session stats
      return {
        duration: data.sessionDuration,
        messageCount: 0,
        toolCallCount: 0
      };
    },

    scheduleAfterExit(task: () => Promise<void>): void {
      afterExitTasks.push(task);
    },

    log(message: string): void {
      console.log(`[onExit] ${message}`);
    }
  };
}

/**
 * Default onExit handler
 */
export async function defaultOnExitHandler(context: OnExitContext): Promise<void> {
  const { code, reason, sessionDuration, preventExit } = context.data;
  
  console.log(`[onExit] Application exiting with code ${code}`);
  
  if (reason) {
    console.log(`  Reason: ${reason}`);
  }
  
  console.log(`  Session duration: ${(sessionDuration / 1000 / 60).toFixed(1)} minutes`);
  
  if (preventExit) {
    console.log(`  Exit prevented: ${context.data.preventReason}`);
    return;
  }
  
  // Save state
  await context.saveState();
  
  // Clean up
  await context.cleanup();
  
  // Log stats
  const stats = context.getSessionStats();
  console.log(`  Messages: ${stats.messageCount}`);
  console.log(`  Tool calls: ${stats.toolCallCount}`);
}

/**
 * Get exit code description
 */
export function getExitCodeDescription(code: number): string {
  const descriptions: Record<number, string> = {
    [ExitCode.SUCCESS]: 'Success',
    [ExitCode.GENERAL_ERROR]: 'General error',
    [ExitCode.MISUSE]: 'Misuse of shell builtins',
    [ExitCode.CANT_EXECUTE]: 'Command invoked cannot execute',
    [ExitCode.COMMAND_NOT_FOUND]: 'Command not found',
    [ExitCode.INVALID_EXIT]: 'Invalid argument to exit',
    [ExitCode.TERMINATED]: 'Script terminated by Ctrl+C',
    [ExitCode.OUT_OF_RANGE]: 'Exit status out of range'
  };
  
  return descriptions[code] || `Unknown exit code: ${code}`;
}

export default onExitDefinition;
