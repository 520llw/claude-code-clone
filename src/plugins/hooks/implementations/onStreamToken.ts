/**
 * onStreamToken.ts
 * 
 * Stream Token Hook Implementation
 * 
 * This hook is triggered when a stream token is received from the LLM.
 * It allows plugins to process, filter, or transform stream tokens in real-time.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnStreamTokenData, HookContext } from '../types';

/**
 * onStreamToken hook definition
 */
export const onStreamTokenDefinition: HookDefinition<OnStreamTokenData> = {
  name: 'onStreamToken',
  description: 'Called when a stream token is received from the LLM. Plugins can process or filter tokens.',
  category: HookCategory.LLM,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 1000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log tokens (debug)
plugin.registerHook('onStreamToken', async (context) => {
  const { token, index } = context.data;
  console.debug(\`Token \${index}: \${token}\`);
});`,
    `// Filter sensitive content
plugin.registerHook('onStreamToken', async (context) => {
  const { token } = context.data;
  
  if (containsSensitiveData(token)) {
    context.filter(); // Don't include this token
  }
});`,
    `// Transform tokens
plugin.registerHook('onStreamToken', async (context) => {
  const { token } = context.data;
  
  // Replace certain patterns
  const transformed = token.replace(/OLD_PRODUCT_NAME/g, 'New Product Name');
  context.setToken(transformed);
});`
  ],
  relatedHooks: ['onLLMCall', 'onResponse'],
  schema: {
    input: {
      type: 'object',
      properties: {
        streamId: { type: 'string', description: 'Stream ID' },
        token: { type: 'string', description: 'Token content' },
        index: { type: 'number', description: 'Token index' },
        model: { type: 'string', description: 'Model name' },
        include: { type: 'boolean', description: 'Whether to include in output' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['streamId', 'token', 'index', 'model', 'include', 'timestamp']
    }
  }
};

/**
 * onStreamToken hook context
 */
export interface OnStreamTokenContext extends HookContext<OnStreamTokenData> {
  /** Set the token content */
  setToken(token: string): void;
  /** Get the token content */
  getToken(): string;
  /** Filter out this token (don't include in output) */
  filter(): void;
  /** Include this token in output */
  include(): void;
  /** Check if token matches pattern */
  matches(pattern: string | RegExp): boolean;
  /** Transform token */
  transform(transformer: (token: string) => string): void;
  /** Get stream statistics */
  getStats(): { tokensReceived: number; tokensFiltered: number; averageTokenLength: number };
  /** Log token */
  log(message: string): void;
}

/**
 * Stream statistics
 */
interface StreamStats {
  tokensReceived: number;
  tokensFiltered: number;
  totalLength: number;
}

// Global stream stats tracker
const streamStats: Map<string, StreamStats> = new Map();

/**
 * Creates an onStreamToken hook context
 */
export function createOnStreamTokenContext(
  data: OnStreamTokenData,
  executionId: string
): OnStreamTokenContext {
  // Initialize stats for this stream
  if (!streamStats.has(data.streamId)) {
    streamStats.set(data.streamId, {
      tokensReceived: 0,
      tokensFiltered: 0,
      totalLength: 0
    });
  }

  const stats = streamStats.get(data.streamId)!;
  stats.tokensReceived++;
  stats.totalLength += data.token.length;

  return {
    hookName: 'onStreamToken',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnStreamTokenData>(key: K): OnStreamTokenData[K] {
      return data[key];
    },

    set<K extends keyof OnStreamTokenData>(key: K, value: OnStreamTokenData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    setToken(token: string): void {
      data.token = token;
    },

    getToken(): string {
      return data.token;
    },

    filter(): void {
      data.include = false;
      stats.tokensFiltered++;
    },

    include(): void {
      data.include = true;
    },

    matches(pattern: string | RegExp): boolean {
      if (typeof pattern === 'string') {
        return data.token.includes(pattern);
      }
      return pattern.test(data.token);
    },

    transform(transformer: (token: string) => string): void {
      data.token = transformer(data.token);
    },

    getStats(): { tokensReceived: number; tokensFiltered: number; averageTokenLength: number } {
      return {
        tokensReceived: stats.tokensReceived,
        tokensFiltered: stats.tokensFiltered,
        averageTokenLength: stats.tokensReceived > 0 
          ? stats.totalLength / stats.tokensReceived 
          : 0
      };
    },

    log(message: string): void {
      console.log(`[onStreamToken] ${message}`);
    }
  };
}

/**
 * Default onStreamToken handler
 */
export async function defaultOnStreamTokenHandler(context: OnStreamTokenContext): Promise<void> {
  const { streamId, token, index, model } = context.data;
  const stats = context.getStats();
  
  // Only log every 10th token to avoid spam
  if (index % 10 === 0) {
    console.log(`[onStreamToken] ${model} token ${index} (stream: ${streamId})`);
    console.log(`  Stats: ${stats.tokensReceived} received, ${stats.tokensFiltered} filtered`);
  }
  
  // Add metadata
  context.addMeta('processedAt', new Date().toISOString());
  context.addMeta('tokenLength', token.length);
}

/**
 * Clean up stream stats when stream ends
 */
export function cleanupStreamStats(streamId: string): void {
  streamStats.delete(streamId);
}

/**
 * Check if token contains sensitive data
 */
export function containsSensitiveData(token: string): boolean {
  const sensitivePatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit cards
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /password[:\s]+\S+/i,
    /api[_-]?key[:\s]+\S+/i
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(token));
}

export default onStreamTokenDefinition;
