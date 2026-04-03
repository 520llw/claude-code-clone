/**
 * onLLMCall.ts
 * 
 * LLM API Call Hook Implementation
 * 
 * This hook is triggered when an LLM API call is made. It allows plugins
 * to monitor, modify, or intercept LLM calls.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnLLMCallData, HookContext } from '../types';

/**
 * onLLMCall hook definition
 */
export const onLLMCallDefinition: HookDefinition<OnLLMCallData> = {
  name: 'onLLMCall',
  description: 'Called when an LLM API call is made. Plugins can monitor, modify, or intercept LLM calls.',
  category: HookCategory.LLM,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 30000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log LLM calls
plugin.registerHook('onLLMCall', async (context) => {
  const { model, options } = context.data;
  console.log(\`LLM call to \${model}\`);
  console.log('Options:', options);
});`,
    `// Modify prompt
plugin.registerHook('onLLMCall', async (context) => {
  const { prompt } = context.data;
  
  // Add system context
  const enhancedPrompt = \`Context: You are a helpful assistant.\\n\\n\${prompt}\`;
  context.setPrompt(enhancedPrompt);
});`,
    `// Cache responses
plugin.registerHook('onLLMCall', async (context) => {
  const cacheKey = context.getCacheKey();
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    context.cancel('Using cached response');
    return cached;
  }
});`
  ],
  relatedHooks: ['onStreamToken', 'onResponse'],
  schema: {
    input: {
      type: 'object',
      properties: {
        callId: { type: 'string', description: 'Unique call ID' },
        model: { type: 'string', description: 'Model name' },
        prompt: { description: 'Prompt or messages' },
        options: { type: 'object', description: 'Call options' },
        timestamp: { type: 'string', format: 'date-time' },
        allow: { type: 'boolean', description: 'Whether to allow the call' },
        blockReason: { type: 'string', description: 'Reason for blocking' }
      },
      required: ['callId', 'model', 'prompt', 'options', 'timestamp', 'allow']
    }
  }
};

/**
 * LLM call options
 */
export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  tools?: any[];
}

/**
 * onLLMCall hook context
 */
export interface OnLLMCallContext extends HookContext<OnLLMCallData> {
  /** Set the prompt */
  setPrompt(prompt: string | any[]): void;
  /** Get the prompt */
  getPrompt(): string | any[];
  /** Set model option */
  setOption(key: string, value: any): void;
  /** Get model option */
  getOption(key: string): any;
  /** Allow the call */
  allow(): void;
  /** Block the call */
  block(reason: string): void;
  /** Get cache key for this call */
  getCacheKey(): string;
  /** Estimate token count */
  estimateTokens(): number;
  /** Estimate cost */
  estimateCost(): number;
  /** Log the call */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

/**
 * Creates an onLLMCall hook context
 */
export function createOnLLMCallContext(
  data: OnLLMCallData,
  executionId: string
): OnLLMCallContext {
  return {
    hookName: 'onLLMCall',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnLLMCallData>(key: K): OnLLMCallData[K] {
      return data[key];
    },

    set<K extends keyof OnLLMCallData>(key: K, value: OnLLMCallData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    setPrompt(prompt: string | any[]): void {
      data.prompt = prompt;
    },

    getPrompt(): string | any[] {
      return data.prompt;
    },

    setOption(key: string, value: any): void {
      data.options[key] = value;
    },

    getOption(key: string): any {
      return data.options[key];
    },

    allow(): void {
      data.allow = true;
      data.blockReason = undefined;
    },

    block(reason: string): void {
      data.allow = false;
      data.blockReason = reason;
    },

    getCacheKey(): string {
      const promptStr = typeof data.prompt === 'string' 
        ? data.prompt 
        : JSON.stringify(data.prompt);
      return `${data.model}:${JSON.stringify(data.options)}:${promptStr}`;
    },

    estimateTokens(): number {
      const promptStr = typeof data.prompt === 'string' 
        ? data.prompt 
        : JSON.stringify(data.prompt);
      // Rough estimate: 1 token ≈ 4 characters
      return Math.ceil(promptStr.length / 4);
    },

    estimateCost(): number {
      const tokens = this.estimateTokens();
      // Rough estimate for GPT-4
      return (tokens / 1000) * 0.03;
    },

    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
      console[level](`[onLLMCall] ${message}`);
    }
  };
}

/**
 * Default onLLMCall handler
 */
export async function defaultOnLLMCallHandler(context: OnLLMCallContext): Promise<void> {
  const { callId, model, options } = context.data;
  
  const tokens = context.estimateTokens();
  const cost = context.estimateCost();
  
  console.log(`[onLLMCall] ${model} (${callId})`);
  console.log(`  Estimated tokens: ${tokens}`);
  console.log(`  Estimated cost: $${cost.toFixed(4)}`);
  
  if (options.temperature !== undefined) {
    console.log(`  Temperature: ${options.temperature}`);
  }
  
  if (options.maxTokens) {
    console.log(`  Max tokens: ${options.maxTokens}`);
  }
  
  // Add metadata
  context.addMeta('estimatedTokens', tokens);
  context.addMeta('estimatedCost', cost);
  context.addMeta('loggedAt', new Date().toISOString());
}

export default onLLMCallDefinition;
