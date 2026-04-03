/**
 * Anthropic SDK Wrapper
 * 
 * This module provides a wrapper around the Anthropic SDK with additional
 * features like retries, caching, and streaming support.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageParam, ContentBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import type { Stream } from '@anthropic-ai/sdk/streaming';
import type { ILogger } from '@core/interfaces';
import { retry, sleep } from '@utils/index';
import { RateLimitError, LLMError } from '@core/errors';

// ============================================================================
// Types
// ============================================================================

export interface AnthropicClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
  logger?: ILogger;
}

export interface ChatCompletionOptions {
  messages: MessageParam[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  tools?: Anthropic.Tool[];
  stream?: boolean;
}

export interface ChatCompletionResult {
  message: Message;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string | null;
}

// ============================================================================
// Anthropic Client
// ============================================================================

export class AnthropicClient {
  private client: Anthropic;
  private model: string;
  private maxRetries: number;
  private timeout: number;
  private logger?: ILogger;

  constructor(options: AnthropicClientOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
    this.model = options.model ?? 'claude-3-5-sonnet-20241022';
    this.maxRetries = options.maxRetries ?? 3;
    this.timeout = options.timeout ?? 60000;
    this.logger = options.logger;
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const { messages, stream = false, ...rest } = options;

    this.logger?.debug('Sending chat completion request', {
      model: this.model,
      messageCount: messages.length,
      stream,
    });

    try {
      const response = await retry(
        async () => {
          return await withTimeout(
            () =>
              this.client.messages.create({
                model: this.model,
                messages,
                max_tokens: rest.maxTokens ?? 4096,
                temperature: rest.temperature,
                top_p: rest.topP,
                top_k: rest.topK,
                stop_sequences: rest.stopSequences,
                system: rest.system,
                tools: rest.tools,
                stream: false,
              }),
            this.timeout,
            'Request timed out'
          );
        },
        {
          maxRetries: this.maxRetries,
          shouldRetry: (error) => {
            // Retry on rate limits and transient errors
            if (error instanceof Anthropic.APIError) {
              return error.status === 429 || error.status >= 500;
            }
            return false;
          },
        }
      );

      this.logger?.debug('Received chat completion response', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });

      return {
        message: response,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Stream a chat completion
   */
  async *streamChatCompletion(
    options: ChatCompletionOptions
  ): AsyncGenerator<ContentBlock, ChatCompletionResult> {
    const { messages, ...rest } = options;

    this.logger?.debug('Starting streaming chat completion', {
      model: this.model,
      messageCount: messages.length,
    });

    try {
      const stream = await this.client.messages.create({
        model: this.model,
        messages,
        max_tokens: rest.maxTokens ?? 4096,
        temperature: rest.temperature,
        top_p: rest.topP,
        top_k: rest.topK,
        stop_sequences: rest.stopSequences,
        system: rest.system,
        tools: rest.tools,
        stream: true,
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;
      const contentBlocks: ContentBlock[] = [];

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            inputTokens = event.message.usage.input_tokens;
            break;

          case 'content_block_start':
            // Initialize new content block
            break;

          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              yield {
                type: 'text',
                text: event.delta.text,
              } as TextBlock;
            }
            break;

          case 'content_block_stop':
            if (event.index < contentBlocks.length) {
              contentBlocks[event.index] = event.content_block;
            }
            break;

          case 'message_delta':
            if (event.usage) {
              outputTokens = event.usage.output_tokens;
            }
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            break;

          case 'message_stop':
            // Stream complete
            break;
        }
      }

      // Reconstruct the final message
      const finalMessage: Message = {
        id: '', // Will be filled by API
        type: 'message',
        role: 'assistant',
        content: contentBlocks,
        model: this.model,
        stop_reason: stopReason,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
      };

      return {
        message: finalMessage,
        usage: {
          inputTokens,
          outputTokens,
        },
        stopReason,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Count tokens in messages
   */
  async countTokens(messages: MessageParam[]): Promise<number> {
    // Anthropic doesn't provide a direct token counting endpoint
    // We use a heuristic: ~4 characters per token on average
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);

    return Math.ceil(totalChars / 4);
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20241022',
    ];
  }

  /**
   * Set the model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private handleError(error: unknown): never {
    if (error instanceof Anthropic.APIError) {
      this.logger?.error('Anthropic API error', error);

      if (error.status === 429) {
        const retryAfter = parseInt(error.headers?.['retry-after'] ?? '60', 10);
        throw new RateLimitError('Rate limit exceeded', { retryAfter });
      }

      throw new LLMError(`API error: ${error.message}`, { cause: error });
    }

    if (error instanceof Error) {
      this.logger?.error('Unexpected error', error);
      throw new LLMError(`Unexpected error: ${error.message}`, { cause: error });
    }

    throw new LLMError('Unknown error occurred');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// ============================================================================
// Exports
// ============================================================================

export { Anthropic };
export default AnthropicClient;
