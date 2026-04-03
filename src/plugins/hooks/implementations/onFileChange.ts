/**
 * onFileChange.ts
 * 
 * File Change Hook Implementation
 * 
 * This hook is triggered when a file is changed (created, modified, deleted, or renamed).
 * It allows plugins to react to file system changes.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnFileChangeData, HookContext } from '../types';

/**
 * onFileChange hook definition
 */
export const onFileChangeDefinition: HookDefinition<OnFileChangeData> = {
  name: 'onFileChange',
  description: 'Called when a file is changed (created, modified, deleted, or renamed).',
  category: HookCategory.FILE,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 5000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log file changes
plugin.registerHook('onFileChange', async (context) => {
  const { path, changeType } = context.data;
  console.log(\`File \${changeType}: \${path}\`);
});`,
    `// Auto-format on save
plugin.registerHook('onFileChange', async (context) => {
  const { path, changeType } = context.data;
  
  if (changeType === 'modified' && path.endsWith('.ts')) {
    await context.formatFile();
  }
});`,
    `// Sync to remote on change
plugin.registerHook('onFileChange', async (context) => {
  const { path, changeType } = context.data;
  
  if (changeType === 'modified' || changeType === 'created') {
    await context.syncToRemote();
  }
});`
  ],
  relatedHooks: [],
  schema: {
    input: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        changeType: { type: 'string', enum: ['created', 'modified', 'deleted', 'renamed'] },
        oldPath: { type: 'string', description: 'Old path (for rename)' },
        content: { type: 'string', description: 'File content (if available)' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['path', 'changeType', 'timestamp']
    }
  }
};

/**
 * onFileChange hook context
 */
export interface OnFileChangeContext extends HookContext<OnFileChangeData> {
  /** Get file content */
  getContent(): Promise<string | undefined>;
  /** Set file content */
  setContent(content: string): Promise<void>;
  /** Get file info */
  getFileInfo(): Promise<{ size: number; mtime: Date; isDirectory: boolean }>;
  /** Format the file */
  formatFile(): Promise<void>;
  /** Lint the file */
  lintFile(): Promise<{ issues: Array<{ line: number; message: string; severity: string }> }>;
  /** Sync file to remote */
  syncToRemote(): Promise<void>;
  /** Check if file matches pattern */
  matches(pattern: string | RegExp): boolean;
  /** Get file extension */
  getExtension(): string;
  /** Log file change */
  log(message: string): void;
}

/**
 * Creates an onFileChange hook context
 */
export function createOnFileChangeContext(
  data: OnFileChangeData,
  executionId: string
): OnFileChangeContext {
  return {
    hookName: 'onFileChange',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnFileChangeData>(key: K): OnFileChangeData[K] {
      return data[key];
    },

    set<K extends keyof OnFileChangeData>(key: K, value: OnFileChangeData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    async getContent(): Promise<string | undefined> {
      return data.content;
    },

    async setContent(content: string): Promise<void> {
      data.content = content;
    },

    async getFileInfo(): Promise<{ size: number; mtime: Date; isDirectory: boolean }> {
      // Would get actual file info
      return { size: 0, mtime: new Date(), isDirectory: false };
    },

    async formatFile(): Promise<void> {
      // Would format file based on type
      console.log(`[onFileChange] Formatting ${data.path}`);
    },

    async lintFile(): Promise<{ issues: Array<{ line: number; message: string; severity: string }> }> {
      // Would lint file
      return { issues: [] };
    },

    async syncToRemote(): Promise<void> {
      // Would sync to remote
      console.log(`[onFileChange] Syncing ${data.path} to remote`);
    },

    matches(pattern: string | RegExp): boolean {
      if (typeof pattern === 'string') {
        return data.path.includes(pattern);
      }
      return pattern.test(data.path);
    },

    getExtension(): string {
      const parts = data.path.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : '';
    },

    log(message: string): void {
      console.log(`[onFileChange] [${data.changeType}] ${message}`);
    }
  };
}

/**
 * Default onFileChange handler
 */
export async function defaultOnFileChangeHandler(context: OnFileChangeContext): Promise<void> {
  const { path, changeType, oldPath } = context.data;
  
  const ext = context.getExtension();
  
  console.log(`[onFileChange] ${changeType}: ${path}`);
  
  if (changeType === 'renamed' && oldPath) {
    console.log(`  Renamed from: ${oldPath}`);
  }
  
  if (ext) {
    console.log(`  Extension: ${ext}`);
  }
  
  // Add metadata
  context.addMeta('processedAt', new Date().toISOString());
  context.addMeta('extension', ext);
}

export default onFileChangeDefinition;
