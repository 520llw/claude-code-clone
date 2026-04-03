/**
 * onContextCompact.ts
 * 
 * Context Compression Hook Implementation
 * 
 * This hook is triggered when the context is being compressed to fit within
 * token limits. It allows plugins to influence which messages are removed
 * or how the context is summarized.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnContextCompactData, HookContext } from '../types';

/**
 * onContextCompact hook definition
 */
export const onContextCompactDefinition: HookDefinition<OnContextCompactData> = {
  name: 'onContextCompact',
  description: 'Called when context is being compressed to fit within token limits.',
  category: HookCategory.CONTEXT,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: false,
  defaultTimeout: 10000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Preserve important messages
plugin.registerHook('onContextCompact', async (context) => {
  const { messagesToRemove } = context.data;
  
  // Don't remove messages with important keywords
  const importantIndices = context.findMessages(/IMPORTANT|CRITICAL/);
  for (const index of importantIndices) {
    const msgIndex = messagesToRemove.indexOf(index);
    if (msgIndex > -1) {
      messagesToRemove.splice(msgIndex, 1);
    }
  }
});`,
    `// Generate better summary
plugin.registerHook('onContextCompact', async (context) => {
  const summary = await context.generateSummary();
  context.set('summary', summary);
});`
  ],
  relatedHooks: [],
  schema: {
    input: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'Context ID' },
        originalTokenCount: { type: 'number', description: 'Original token count' },
        targetTokenCount: { type: 'number', description: 'Target token count' },
        messagesToRemove: { type: 'array', items: { type: 'string' }, description: 'Message IDs to remove' },
        summary: { type: 'string', description: 'Summary of removed content' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['contextId', 'originalTokenCount', 'targetTokenCount', 'messagesToRemove', 'timestamp']
    }
  }
};

/**
 * Message info
 */
export interface MessageInfo {
  id: string;
  role: string;
  content: string;
  tokenCount: number;
  timestamp: Date;
}

/**
 * onContextCompact hook context
 */
export interface OnContextCompactContext extends HookContext<OnContextCompactData> {
  /** Get all messages */
  getMessages(): Promise<MessageInfo[]>;
  /** Get messages that will be removed */
  getMessagesToRemove(): Promise<MessageInfo[]>;
  /** Preserve a message (remove from removal list) */
  preserveMessage(messageId: string): void;
  /** Add a message to removal list */
  removeMessage(messageId: string): void;
  /** Find messages matching pattern */
  findMessages(pattern: string | RegExp): string[];
  /** Generate summary of messages */
  generateSummary(): Promise<string>;
  /** Calculate tokens for a message */
  calculateTokens(content: string): number;
  /** Get compression ratio */
  getCompressionRatio(): number;
  /** Log compaction info */
  log(message: string): void;
}

/**
 * Creates an onContextCompact hook context
 */
export function createOnContextCompactContext(
  data: OnContextCompactData,
  executionId: string
): OnContextCompactContext {
  return {
    hookName: 'onContextCompact',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnContextCompactData>(key: K): OnContextCompactData[K] {
      return data[key];
    },

    set<K extends keyof OnContextCompactData>(key: K, value: OnContextCompactData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    async getMessages(): Promise<MessageInfo[]> {
      // Would retrieve all messages
      return [];
    },

    async getMessagesToRemove(): Promise<MessageInfo[]> {
      // Would retrieve messages to be removed
      return [];
    },

    preserveMessage(messageId: string): void {
      const index = data.messagesToRemove.indexOf(messageId);
      if (index > -1) {
        data.messagesToRemove.splice(index, 1);
      }
    },

    removeMessage(messageId: string): void {
      if (!data.messagesToRemove.includes(messageId)) {
        data.messagesToRemove.push(messageId);
      }
    },

    findMessages(pattern: string | RegExp): string[] {
      // Would search through messages
      return [];
    },

    async generateSummary(): Promise<string> {
      // Would generate summary using LLM
      return `Context compressed from ${data.originalTokenCount} to ${data.targetTokenCount} tokens.`;
    },

    calculateTokens(content: string): number {
      // Rough estimate: 1 token ≈ 4 characters
      return Math.ceil(content.length / 4);
    },

    getCompressionRatio(): number {
      return data.targetTokenCount / data.originalTokenCount;
    },

    log(message: string): void {
      console.log(`[onContextCompact] ${message}`);
    }
  };
}

/**
 * Default onContextCompact handler
 */
export async function defaultOnContextCompactHandler(context: OnContextCompactContext): Promise<void> {
  const { contextId, originalTokenCount, targetTokenCount, messagesToRemove } = context.data;
  
  console.log(`[onContextCompact] Compressing context ${contextId}`);
  console.log(`  Tokens: ${originalTokenCount} -> ${targetTokenCount}`);
  console.log(`  Messages to remove: ${messagesToRemove.length}`);
  console.log(`  Compression ratio: ${(context.getCompressionRatio() * 100).toFixed(1)}%`);
  
  // Generate summary if not provided
  if (!context.data.summary) {
    const summary = await context.generateSummary();
    context.set('summary', summary);
  }
}

export default onContextCompactDefinition;
