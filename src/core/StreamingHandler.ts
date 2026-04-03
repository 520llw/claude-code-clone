/**
 * StreamingHandler - Server-Sent Events (SSE) Stream Processing
 * 
 * This module handles streaming responses from LLM APIs, providing:
 * - Real-time token processing
 * - Tool use detection and accumulation
 * - Event-based callbacks
 * - Backpressure handling
 * - Error recovery
 * 
 * Supports both Anthropic and OpenAI streaming formats.
 * 
 * @module StreamingHandler
 */

import {
  StreamEvent,
  StreamEventType,
  StreamCallbacks,
  Message,
  TextMessage,
  ToolUseMessage,
  TokenUsage,
  ToolCall,
  Logger,
  LLMError,
} from '../types/index.js';

/**
 * Parser state for accumulating partial data
 */
interface ParserState {
  buffer: string;
  currentText: string;
  currentToolUse: Partial<ToolUseMessage> | null;
  currentToolInput: string;
  messageId: string | null;
  usage: TokenUsage;
  contentBlocks: number;
}

/**
 * Configuration for StreamingHandler
 */
export interface StreamingHandlerConfig {
  callbacks?: StreamCallbacks;
  logger?: Logger;
  provider: 'anthropic' | 'openai';
  enableBackpressure?: boolean;
  maxBufferSize?: number;
  abortSignal?: AbortSignal;
}

/**
 * StreamingHandler class for processing LLM streaming responses
 */
export class StreamingHandler {
  private callbacks: StreamCallbacks;
  private logger: Logger;
  private provider: 'anthropic' | 'openai';
  private enableBackpressure: boolean;
  private maxBufferSize: number;
  private abortSignal?: AbortSignal;
  private state: ParserState;
  private isActive: boolean;
  private eventListeners: Map<string, Set<(event: StreamEvent) => void>>;

  /**
   * Creates a new StreamingHandler instance
   * 
   * @param config - Configuration options
   */
  constructor(config: StreamingHandlerConfig) {
    this.callbacks = config.callbacks || {};
    this.logger = config.logger || this.createDefaultLogger();
    this.provider = config.provider;
    this.enableBackpressure = config.enableBackpressure ?? true;
    this.maxBufferSize = config.maxBufferSize || 1024 * 1024; // 1MB default
    this.abortSignal = config.abortSignal;
    this.isActive = false;
    this.eventListeners = new Map();
    
    this.state = this.createInitialState();

    // Listen for abort signal
    this.abortSignal?.addEventListener('abort', () => {
      this.handleAbort();
    });

    this.logger.debug('[StreamingHandler] Initialized');
  }

  /**
   * Creates initial parser state
   */
  private createInitialState(): ParserState {
    return {
      buffer: '',
      currentText: '',
      currentToolUse: null,
      currentToolInput: '',
      messageId: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      contentBlocks: 0,
    };
  }

  /**
   * Creates a default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: () => {},
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Processes a streaming response from the LLM API
   * 
   * @param response - Fetch Response object
   * @returns Promise resolving to the complete message
   */
  async processStream(response: Response): Promise<Message> {
    if (!response.body) {
      throw new LLMError('Response body is null', response.status, this.provider);
    }

    this.isActive = true;
    this.callbacks.onStart?.();

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (this.isActive) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Check for abort
        if (this.abortSignal?.aborted) {
          throw new LLMError('Stream aborted', undefined, this.provider);
        }

        // Decode and process chunk
        const chunk = decoder.decode(value, { stream: true });
        await this.processChunk(chunk);

        // Handle backpressure if enabled
        if (this.enableBackpressure && this.state.buffer.length > this.maxBufferSize) {
          this.logger.warn('[StreamingHandler] Buffer size exceeded, pausing...');
          await this.sleep(10);
        }
      }

      // Process any remaining data in buffer
      this.flushBuffer();

      // Build and return final message
      return this.buildFinalMessage();

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Processes a chunk of streaming data
   * 
   * @param chunk - Raw chunk data
   */
  private async processChunk(chunk: string): Promise<void> {
    this.state.buffer += chunk;

    // Process complete SSE events
    let eventEnd = this.state.buffer.indexOf('\n\n');
    
    while (eventEnd !== -1) {
      const eventData = this.state.buffer.substring(0, eventEnd);
      this.state.buffer = this.state.buffer.substring(eventEnd + 2);
      
      await this.processEvent(eventData);
      
      eventEnd = this.state.buffer.indexOf('\n\n');
    }
  }

  /**
   * Processes a single SSE event
   * 
   * @param eventData - Raw event data
   */
  private async processEvent(eventData: string): Promise<void> {
    const lines = eventData.split('\n');
    let eventType: StreamEventType = 'message_delta';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.substring(7) as StreamEventType;
      } else if (line.startsWith('data: ')) {
        data = line.substring(6);
      }
    }

    if (!data) return;

    // Handle special events
    if (data === '[DONE]') {
      this.logger.debug('[StreamingHandler] Stream complete');
      return;
    }

    try {
      const parsedData = JSON.parse(data);
      const event: StreamEvent = {
        type: eventType,
        ...parsedData,
      };

      await this.handleEvent(event);
      this.emitEvent(event);

    } catch (error) {
      this.logger.warn('[StreamingHandler] Failed to parse event data:', data);
    }
  }

  /**
   * Handles a parsed stream event
   * 
   * @param event - Parsed stream event
   */
  private async handleEvent(event: StreamEvent): Promise<void> {
    this.logger.debug('[StreamingHandler] Event:', event.type, event);

    switch (event.type) {
      case 'message_start':
        this.handleMessageStart(event);
        break;

      case 'content_block_start':
        await this.handleContentBlockStart(event);
        break;

      case 'content_block_delta':
        await this.handleContentBlockDelta(event);
        break;

      case 'content_block_stop':
        await this.handleContentBlockStop(event);
        break;

      case 'message_delta':
        this.handleMessageDelta(event);
        break;

      case 'message_stop':
        this.handleMessageStop(event);
        break;

      case 'tool_use_start':
        this.handleToolUseStart(event);
        break;

      case 'tool_use_delta':
        this.handleToolUseDelta(event);
        break;

      case 'tool_use_stop':
        await this.handleToolUseStop(event);
        break;

      case 'error':
        this.handleStreamError(event);
        break;

      case 'ping':
        // Keep-alive, ignore
        break;

      default:
        this.logger.warn('[StreamingHandler] Unknown event type:', event.type);
    }
  }

  /**
   * Handles message_start event
   */
  private handleMessageStart(event: StreamEvent): void {
    this.state.messageId = event.message?.id || null;
    this.logger.debug('[StreamingHandler] Message started:', this.state.messageId);
  }

  /**
   * Handles content_block_start event
   */
  private async handleContentBlockStart(event: StreamEvent): Promise<void> {
    const block = event.content_block;
    if (!block) return;

    if (block.type === 'text') {
      // New text block started
      this.state.currentText = '';
    } else if (block.type === 'tool_use') {
      // New tool use block started
      this.state.currentToolUse = {
        type: 'tool_use',
        toolName: block.name || '',
        toolInput: {},
        toolUseId: `tool_${Date.now()}_${this.state.contentBlocks}`,
        id: `msg_${Date.now()}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      this.state.currentToolInput = '';
    }

    this.state.contentBlocks++;
  }

  /**
   * Handles content_block_delta event
   */
  private async handleContentBlockDelta(event: StreamEvent): Promise<void> {
    const delta = event.delta;
    if (!delta) return;

    if (delta.type === 'text_delta' && delta.text) {
      // Accumulate text
      this.state.currentText += delta.text;
      
      // Emit token callback
      this.callbacks.onToken?.(delta.text);
      
    } else if (delta.type === 'input_json_delta' && delta.partial_json) {
      // Accumulate tool input JSON
      this.state.currentToolInput += delta.partial_json;
    }
  }

  /**
   * Handles content_block_stop event
   */
  private async handleContentBlockStop(event: StreamEvent): Promise<void> {
    // Content block complete, finalize if needed
    if (this.state.currentToolUse && this.state.currentToolInput) {
      try {
        // Parse accumulated tool input
        const toolInput = JSON.parse(this.state.currentToolInput);
        this.state.currentToolUse.toolInput = toolInput;
      } catch (error) {
        this.logger.warn('[StreamingHandler] Failed to parse tool input:', error);
        this.state.currentToolUse.toolInput = {};
      }
    }
  }

  /**
   * Handles message_delta event
   */
  private handleMessageDelta(event: StreamEvent): void {
    if (event.message?.usage) {
      this.state.usage = {
        ...this.state.usage,
        ...event.message.usage,
      };
    }
  }

  /**
   * Handles message_stop event
   */
  private handleMessageStop(event: StreamEvent): void {
    this.logger.debug('[StreamingHandler] Message complete');
  }

  /**
   * Handles tool_use_start event
   */
  private handleToolUseStart(event: StreamEvent): void {
    // Tool use started, initialize tracking
    this.state.currentToolInput = '';
  }

  /**
   * Handles tool_use_delta event
   */
  private handleToolUseDelta(event: StreamEvent): void {
    const delta = event.delta;
    if (delta?.partial_json) {
      this.state.currentToolInput += delta.partial_json;
    }
  }

  /**
   * Handles tool_use_stop event
   */
  private async handleToolUseStop(event: StreamEvent): Promise<void> {
    if (this.state.currentToolUse) {
      try {
        // Parse final tool input
        const toolInput = JSON.parse(this.state.currentToolInput || '{}');
        const toolUse: ToolUseMessage = {
          ...this.state.currentToolUse,
          toolInput,
        } as ToolUseMessage;

        // Emit tool use callback
        this.callbacks.onToolUse?.(toolUse);

      } catch (error) {
        this.logger.warn('[StreamingHandler] Failed to finalize tool use:', error);
      }

      this.state.currentToolUse = null;
      this.state.currentToolInput = '';
    }
  }

  /**
   * Handles stream error event
   */
  private handleStreamError(event: StreamEvent): void {
    const error = event.error || new Error('Unknown stream error');
    this.logger.error('[StreamingHandler] Stream error:', error);
    this.callbacks.onError?.(error);
  }

  /**
   * Flushes remaining buffer data
   */
  private flushBuffer(): void {
    if (this.state.buffer.trim()) {
      this.logger.debug('[StreamingHandler] Flushing buffer:', this.state.buffer);
      // Process any remaining partial event
      this.processEvent(this.state.buffer);
    }
  }

  /**
   * Builds the final message from accumulated data
   */
  private buildFinalMessage(): Message {
    // Emit usage callback
    this.callbacks.onUsage?.(this.state.usage);

    // Determine message type based on accumulated content
    if (this.state.currentToolUse) {
      // Tool use message
      const toolUse: ToolUseMessage = {
        ...this.state.currentToolUse,
        toolInput: this.state.currentToolInput 
          ? JSON.parse(this.state.currentToolInput) 
          : {},
      } as ToolUseMessage;

      this.callbacks.onComplete?.(toolUse);
      return toolUse;
    }

    // Text message
    const textMessage: TextMessage = {
      id: this.state.messageId || `msg_${Date.now()}`,
      type: 'text',
      role: 'assistant',
      content: this.state.currentText,
      timestamp: new Date(),
      metadata: {
        usage: this.state.usage,
      },
    };

    this.callbacks.onComplete?.(textMessage);
    return textMessage;
  }

  /**
   * Handles abort signal
   */
  private handleAbort(): void {
    this.logger.info('[StreamingHandler] Abort signal received');
    this.isActive = false;
    
    const error = new LLMError('Stream aborted by user', undefined, this.provider);
    this.callbacks.onError?.(error);
  }

  /**
   * Handles errors during streaming
   */
  private handleError(error: Error): void {
    this.logger.error('[StreamingHandler] Error:', error);
    this.callbacks.onError?.(error);
  }

  /**
   * Adds an event listener for specific event types
   * 
   * @param eventType - Type of event to listen for
   * @param listener - Event listener function
   */
  addEventListener(
    eventType: StreamEventType,
    listener: (event: StreamEvent) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Removes an event listener
   * 
   * @param eventType - Type of event
   * @param listener - Listener to remove
   */
  removeEventListener(
    eventType: StreamEventType,
    listener: (event: StreamEvent) => void
  ): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  /**
   * Emits an event to registered listeners
   * 
   * @param event - Event to emit
   */
  private emitEvent(event: StreamEvent): void {
    const listeners = this.eventListeners.get(event.type);
    listeners?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn('[StreamingHandler] Event listener error:', error);
      }
    });
  }

  /**
   * Aborts the current stream
   */
  abort(): void {
    this.handleAbort();
  }

  /**
   * Checks if the handler is currently active
   * 
   * @returns True if active
   */
  isStreaming(): boolean {
    return this.isActive;
  }

  /**
   * Gets current accumulated text
   * 
   * @returns Current text content
   */
  getCurrentText(): string {
    return this.state.currentText;
  }

  /**
   * Gets current token usage
   * 
   * @returns Current usage
   */
  getCurrentUsage(): TokenUsage {
    return { ...this.state.usage };
  }

  /**
   * Resets the handler state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.isActive = false;
    this.logger.debug('[StreamingHandler] Reset');
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a stream from an async iterable
   * 
   * @param iterable - Async iterable of chunks
   * @returns Response-like object with body
   */
  static createStreamFromIterable(
    iterable: AsyncIterable<Uint8Array>
  ): Response {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of iterable) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  /**
   * Parses SSE data from a string
   * 
   * @param data - Raw SSE data
   * @returns Parsed events
   */
  static parseSSEData(data: string): Array<{ event: string; data: unknown }> {
    const events: Array<{ event: string; data: unknown }> = [];
    const lines = data.split('\n\n');

    for (const block of lines) {
      const lines = block.split('\n');
      let event = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.substring(7);
        } else if (line.startsWith('data: ')) {
          dataStr = line.substring(6);
        }
      }

      if (dataStr) {
        try {
          events.push({ event, data: JSON.parse(dataStr) });
        } catch {
          events.push({ event, data: dataStr });
        }
      }
    }

    return events;
  }
}

/**
 * Factory function to create StreamingHandler instances
 */
export function createStreamingHandler(
  config: StreamingHandlerConfig
): StreamingHandler {
  return new StreamingHandler(config);
}

/**
 * Utility to convert stream to async iterable
 */
export async function* streamToAsyncIterable(
  response: Response
): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export default StreamingHandler;
