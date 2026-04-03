/**
 * onMessage.ts
 * 
 * New Message Received Hook Implementation
 * 
 * This hook is triggered when a new message is received from the user.
 * It allows plugins to process, modify, or respond to messages before
 * they are sent to the LLM.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnMessageData, HookContext } from '../types';

/**
 * onMessage hook definition
 */
export const onMessageDefinition: HookDefinition<OnMessageData> = {
  name: 'onMessage',
  description: 'Called when a new message is received from the user. Plugins can process, modify, or analyze messages.',
  category: HookCategory.MESSAGE,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 5000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log all messages
plugin.registerHook('onMessage', async (context) => {
  const { messageId, content, role } = context.data;
  console.log(\`[\${role}] \${content}\`);
});`,
    `// Modify message content
plugin.registerHook('onMessage', async (context) => {
  const { content } = context.data;
  
  // Replace shortcuts
  const modified = content
    .replace(/@today/g, new Date().toDateString())
    .replace(/@cwd/g, process.cwd());
  
  if (modified !== content) {
    context.set('content', modified);
    context.set('modified', true);
    context.set('originalContent', content);
  }
});`,
    `// Block inappropriate content
plugin.registerHook('onMessage', async (context) => {
  const { content } = context.data;
  
  if (containsInappropriateContent(content)) {
    context.cancel('Message contains inappropriate content');
  }
});`
  ],
  relatedHooks: ['onResponse', 'onToolCall'],
  schema: {
    input: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Unique message ID' },
        content: { type: 'string', description: 'Message content' },
        role: { type: 'string', enum: ['user', 'assistant', 'system'], description: 'Message role' },
        timestamp: { type: 'string', format: 'date-time', description: 'Message timestamp' },
        metadata: { type: 'object', description: 'Optional message metadata' }
      },
      required: ['messageId', 'content', 'role', 'timestamp']
    }
  }
};

/**
 * onMessage hook context
 */
export interface OnMessageContext extends HookContext<OnMessageData> {
  /** Append content to the message */
  appendContent(text: string): void;
  /** Prepend content to the message */
  prependContent(text: string): void;
  /** Replace content in the message */
  replaceContent(search: string | RegExp, replacement: string): void;
  /** Add metadata to the message */
  addMetadata(key: string, value: any): void;
  /** Get message sentiment analysis */
  analyzeSentiment(): Promise<{ score: number; label: string }>;
  /** Extract entities from the message */
  extractEntities(): Promise<Array<{ type: string; value: string }>>;
}

/**
 * Creates an onMessage hook context
 */
export function createOnMessageContext(
  data: OnMessageData,
  executionId: string
): OnMessageContext {
  return {
    hookName: 'onMessage',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnMessageData>(key: K): OnMessageData[K] {
      return data[key];
    },

    set<K extends keyof OnMessageData>(key: K, value: OnMessageData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    appendContent(text: string): void {
      data.content += text;
      data.modified = true;
      if (!data.originalContent) {
        data.originalContent = data.content.slice(0, -text.length);
      }
    },

    prependContent(text: string): void {
      data.content = text + data.content;
      data.modified = true;
      if (!data.originalContent) {
        data.originalContent = data.content.slice(text.length);
      }
    },

    replaceContent(search: string | RegExp, replacement: string): void {
      const original = data.content;
      data.content = data.content.replace(search, replacement);
      if (data.content !== original) {
        data.modified = true;
        if (!data.originalContent) {
          data.originalContent = original;
        }
      }
    },

    addMetadata(key: string, value: any): void {
      if (!data.metadata) {
        data.metadata = {};
      }
      data.metadata[key] = value;
    },

    async analyzeSentiment(): Promise<{ score: number; label: string }> {
      // Placeholder implementation
      // In production, would use actual sentiment analysis
      return { score: 0, label: 'neutral' };
    },

    async extractEntities(): Promise<Array<{ type: string; value: string }>> {
      // Placeholder implementation
      // In production, would use actual NER
      return [];
    }
  };
}

/**
 * Default onMessage handler
 */
export async function defaultOnMessageHandler(context: OnMessageContext): Promise<void> {
  const { messageId, content, role } = context.data;
  
  console.log(`[onMessage] ${role}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
  
  // Add processing metadata
  context.addMetadata('processedAt', new Date().toISOString());
  context.addMetadata('contentLength', content.length);
}

export default onMessageDefinition;
