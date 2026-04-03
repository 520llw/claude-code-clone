/**
 * QueryEngine - LLM API Integration with Multi-Provider Support
 * 
 * This module provides comprehensive LLM API integration:
 * - Multi-provider support (Anthropic, OpenAI)
 * - Streaming responses with SSE
 * - Token tracking and budgeting
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Request/response transformation
 * - Comprehensive error handling
 * 
 * @module QueryEngine
 */

import {
  LLMConfig,
  AnthropicConfig,
  OpenAIConfig,
  Message,
  TextMessage,
  ToolUseMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  TokenUsage,
  StreamCallbacks,
  LLMError,
  AgentError,
  Logger,
  RetryConfig,
  CircuitBreakerConfig,
  isAnthropicConfig,
  isOpenAIConfig,
} from '../types/index.js';

import { StreamingHandler } from './StreamingHandler.js';
import { TokenTracker } from './TokenTracker.js';

// ============================================================================
// Constants and Defaults
// ============================================================================

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxCalls: 3,
};

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT = 120000; // 2 minutes

/**
 * Anthropic API base URL
 */
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * OpenAI API base URL
 */
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * QueryEngine configuration
 */
export interface QueryEngineConfig {
  llmConfig: LLMConfig;
  retryConfig?: Partial<RetryConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerBreakConfig>;
  logger?: Logger;
  timeout?: number;
  enableStreaming?: boolean;
  enableCaching?: boolean;
  cachePath?: string;
  telemetryCallback?: (event: string, data: Record<string, unknown>) => void;
}

/**
 * Request options for queries
 */
export interface QueryOptions {
  messages: Message[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  abortSignal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

/**
 * Query response
 */
export interface QueryResponse {
  message: Message;
  usage: TokenUsage;
  toolCalls: ToolCall[];
  duration: number;
  model: string;
  finishReason: string;
  metadata: Record<string, unknown>;
}

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker internal state
 */
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  halfOpenCalls: number;
}

// ============================================================================
// QueryEngine Class
// ============================================================================

/**
 * QueryEngine class for LLM API integration
 */
export class QueryEngine {
  private config: QueryEngineConfig;
  private retryConfig: RetryConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;
  private logger: Logger;
  private timeout: number;
  private enableStreaming: boolean;
  private streamingHandler: StreamingHandler | null;
  private tokenTracker: TokenTracker | null;
  private circuitBreaker: CircuitBreakerState;
  private requestCache: Map<string, QueryResponse>;
  private telemetryCallback?: (event: string, data: Record<string, unknown>) => void;

  /**
   * Creates a new QueryEngine instance
   * 
   * @param config - Configuration options
   */
  constructor(config: QueryEngineConfig) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.circuitBreakerConfig = { 
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG, 
      ...config.circuitBreakerConfig 
    };
    this.logger = config.logger || this.createDefaultLogger();
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.enableStreaming = config.enableStreaming ?? true;
    this.streamingHandler = null;
    this.tokenTracker = null;
    this.telemetryCallback = config.telemetryCallback;
    
    this.circuitBreaker = {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      halfOpenCalls: 0,
    };

    this.requestCache = new Map();

    this.logger.info(`[QueryEngine] Initialized with provider: ${config.llmConfig.provider}`);
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

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Sends a query to the LLM
   * 
   * @param options - Query options
   * @returns Query response
   */
  async query(options: QueryOptions): Promise<QueryResponse> {
    const startTime = Date.now();
    
    this.checkCircuitBreaker();
    this.trackTelemetry('query_start', { model: this.config.llmConfig.model });

    try {
      // Check cache if enabled
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(options);
        const cached = this.requestCache.get(cacheKey);
        if (cached) {
          this.logger.debug('[QueryEngine] Cache hit');
          this.trackTelemetry('query_cache_hit', {});
          return cached;
        }
      }

      // Execute with retry
      const response = await this.executeWithRetry(options);

      // Record success
      this.recordSuccess();

      // Cache response if enabled
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(options);
        this.requestCache.set(cacheKey, response);
      }

      const duration = Date.now() - startTime;
      this.trackTelemetry('query_complete', { 
        duration, 
        tokens: response.usage.totalTokens 
      });

      return response;

    } catch (error) {
      this.recordFailure();
      this.trackTelemetry('query_error', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Streams a query to the LLM
   * 
   * @param options - Query options
   * @param callbacks - Stream callbacks
   * @returns Promise resolving to final response
   */
  async streamQuery(
    options: QueryOptions,
    callbacks: StreamCallbacks
  ): Promise<QueryResponse> {
    const startTime = Date.now();
    
    this.checkCircuitBreaker();
    this.trackTelemetry('stream_start', { model: this.config.llmConfig.model });

    try {
      // Create streaming handler
      this.streamingHandler = new StreamingHandler({
        callbacks,
        logger: this.logger,
        provider: this.config.llmConfig.provider as 'anthropic' | 'openai',
        abortSignal: options.abortSignal,
      });

      // Execute streaming request
      const response = await this.executeStreamingRequest(options);

      // Record success
      this.recordSuccess();

      const duration = Date.now() - startTime;
      this.trackTelemetry('stream_complete', { 
        duration, 
        tokens: response.usage.totalTokens 
      });

      return response;

    } catch (error) {
      this.recordFailure();
      this.trackTelemetry('stream_error', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Sends a simple text query
   * 
   * @param prompt - User prompt
   * @param systemPrompt - Optional system prompt
   * @returns Response text
   */
  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Message[] = [{
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }];

    const response = await this.query({
      messages,
      systemPrompt,
    });

    if (response.message.type === 'text') {
      return response.message.content;
    }

    throw new LLMError('Unexpected response type', undefined, this.config.llmConfig.provider);
  }

  /**
   * Executes a tool call through the LLM
   * 
   * @param messages - Conversation messages
   * @param tools - Available tools
   * @param systemPrompt - Optional system prompt
   * @returns Tool calls from LLM
   */
  async executeWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt?: string
  ): Promise<ToolCall[]> {
    const response = await this.query({
      messages,
      tools,
      systemPrompt,
    });

    return response.toolCalls;
  }

  /**
   * Gets token usage statistics
   * 
   * @returns Token usage
   */
  getTokenUsage(): TokenUsage | null {
    return this.tokenTracker?.getTotalUsage() || null;
  }

  /**
   * Clears the request cache
   */
  clearCache(): void {
    this.requestCache.clear();
    this.logger.info('[QueryEngine] Cache cleared');
  }

  /**
   * Gets circuit breaker status
   * 
   * @returns Circuit breaker state
   */
  getCircuitBreakerStatus(): { state: CircuitState; failures: number } {
    return {
      state: this.circuitBreaker.state,
      failures: this.circuitBreaker.failures,
    };
  }

  /**
   * Resets the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      halfOpenCalls: 0,
    };
    this.logger.info('[QueryEngine] Circuit breaker reset');
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Executes a request with retry logic
   * 
   * @param options - Query options
   * @returns Query response
   */
  private async executeWithRetry(options: QueryOptions): Promise<QueryResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.info(`[QueryEngine] Retry attempt ${attempt}/${this.retryConfig.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }

        return await this.executeRequest(options);

      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryableError(error as Error)) {
          this.logger.warn('[QueryEngine] Non-retryable error:', error);
          throw error;
        }

        this.logger.warn(`[QueryEngine] Attempt ${attempt + 1} failed:`, error);
      }
    }

    throw new LLMError(
      `All ${this.retryConfig.maxRetries + 1} attempts failed: ${lastError?.message}`,
      undefined,
      this.config.llmConfig.provider,
      false
    );
  }

  /**
   * Executes a single request
   * 
   * @param options - Query options
   * @returns Query response
   */
  private async executeRequest(options: QueryOptions): Promise<QueryResponse> {
    const startTime = Date.now();

    if (isAnthropicConfig(this.config.llmConfig)) {
      return this.executeAnthropicRequest(options, startTime);
    } else if (isOpenAIConfig(this.config.llmConfig)) {
      return this.executeOpenAIRequest(options, startTime);
    }

    throw new LLMError(
      `Unsupported provider: ${this.config.llmConfig.provider}`,
      undefined,
      this.config.llmConfig.provider,
      false
    );
  }

  /**
   * Executes an Anthropic API request
   * 
   * @param options - Query options
   * @param startTime - Request start time
   * @returns Query response
   */
  private async executeAnthropicRequest(
    options: QueryOptions,
    startTime: number
  ): Promise<QueryResponse> {
    const config = this.config.llmConfig as AnthropicConfig;
    const url = `${config.baseUrl || ANTHROPIC_BASE_URL}/messages`;

    const body = this.buildAnthropicRequestBody(options);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'Anthropic-Version': '2023-06-01',
        'Anthropic-Beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `Anthropic API error: ${response.status} - ${errorText}`,
        response.status,
        'anthropic',
        this.isRetryableStatus(response.status)
      );
    }

    const data = await response.json();
    return this.parseAnthropicResponse(data, startTime);
  }

  /**
   * Executes an OpenAI API request
   * 
   * @param options - Query options
   * @param startTime - Request start time
   * @returns Query response
   */
  private async executeOpenAIRequest(
    options: QueryOptions,
    startTime: number
  ): Promise<QueryResponse> {
    const config = this.config.llmConfig as OpenAIConfig;
    const url = `${config.baseUrl || OPENAI_BASE_URL}/chat/completions`;

    const body = this.buildOpenAIRequestBody(options);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `OpenAI API error: ${response.status} - ${errorText}`,
        response.status,
        'openai',
        this.isRetryableStatus(response.status)
      );
    }

    const data = await response.json();
    return this.parseOpenAIResponse(data, startTime);
  }

  /**
   * Executes a streaming request
   * 
   * @param options - Query options
   * @returns Query response
   */
  private async executeStreamingRequest(options: QueryOptions): Promise<QueryResponse> {
    const startTime = Date.now();

    if (isAnthropicConfig(this.config.llmConfig)) {
      return this.executeAnthropicStreamingRequest(options, startTime);
    } else if (isOpenAIConfig(this.config.llmConfig)) {
      return this.executeOpenAIStreamingRequest(options, startTime);
    }

    throw new LLMError(
      `Unsupported provider for streaming: ${this.config.llmConfig.provider}`,
      undefined,
      this.config.llmConfig.provider,
      false
    );
  }

  /**
   * Executes an Anthropic streaming request
   * 
   * @param options - Query options
   * @param startTime - Request start time
   * @returns Query response
   */
  private async executeAnthropicStreamingRequest(
    options: QueryOptions,
    startTime: number
  ): Promise<QueryResponse> {
    const config = this.config.llmConfig as AnthropicConfig;
    const url = `${config.baseUrl || ANTHROPIC_BASE_URL}/messages`;

    const body = this.buildAnthropicRequestBody(options);
    body.stream = true;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'Anthropic-Version': '2023-06-01',
        'Anthropic-Beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `Anthropic API error: ${response.status} - ${errorText}`,
        response.status,
        'anthropic',
        this.isRetryableStatus(response.status)
      );
    }

    // Process stream
    const message = await this.streamingHandler!.processStream(response);

    const duration = Date.now() - startTime;

    return {
      message,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, // Updated via callbacks
      toolCalls: message.type === 'tool_use' ? [{
        id: (message as ToolUseMessage).toolUseId,
        toolName: (message as ToolUseMessage).toolName,
        parameters: (message as ToolUseMessage).toolInput,
        timestamp: new Date(),
      }] : [],
      duration,
      model: config.model,
      finishReason: 'stop',
      metadata: {},
    };
  }

  /**
   * Executes an OpenAI streaming request
   * 
   * @param options - Query options
   * @param startTime - Request start time
   * @returns Query response
   */
  private async executeOpenAIStreamingRequest(
    options: QueryOptions,
    startTime: number
  ): Promise<QueryResponse> {
    const config = this.config.llmConfig as OpenAIConfig;
    const url = `${config.baseUrl || OPENAI_BASE_URL}/chat/completions`;

    const body = this.buildOpenAIRequestBody(options);
    body.stream = true;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `OpenAI API error: ${response.status} - ${errorText}`,
        response.status,
        'openai',
        this.isRetryableStatus(response.status)
      );
    }

    // Process stream
    const message = await this.streamingHandler!.processStream(response);

    const duration = Date.now() - startTime;

    return {
      message,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      toolCalls: message.type === 'tool_use' ? [{
        id: (message as ToolUseMessage).toolUseId,
        toolName: (message as ToolUseMessage).toolName,
        parameters: (message as ToolUseMessage).toolInput,
        timestamp: new Date(),
      }] : [],
      duration,
      model: config.model,
      finishReason: 'stop',
      metadata: {},
    };
  }

  // ============================================================================
  // Request/Response Building
  // ============================================================================

  /**
   * Builds Anthropic request body
   * 
   * @param options - Query options
   * @returns Request body
   */
  private buildAnthropicRequestBody(options: QueryOptions): Record<string, unknown> {
    const config = this.config.llmConfig as AnthropicConfig;

    const messages = this.convertMessagesToAnthropicFormat(options.messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: options.maxTokens || config.maxTokens || 4096,
      messages,
    };

    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToAnthropicFormat(options.tools);
    }

    return body;
  }

  /**
   * Builds OpenAI request body
   * 
   * @param options - Query options
   * @returns Request body
   */
  private buildOpenAIRequestBody(options: QueryOptions): Record<string, unknown> {
    const config = this.config.llmConfig as OpenAIConfig;

    const messages = this.convertMessagesToOpenAIFormat(
      options.messages,
      options.systemPrompt
    );

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
    };

    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToOpenAIFormat(options.tools);
      body.tool_choice = 'auto';
    }

    return body;
  }

  /**
   * Converts messages to Anthropic format
   * 
   * @param messages - Messages to convert
   * @returns Anthropic-formatted messages
   */
  private convertMessagesToAnthropicFormat(
    messages: Message[]
  ): Array<Record<string, unknown>> {
    return messages.map(msg => {
      switch (msg.type) {
        case 'text':
          return {
            role: msg.role,
            content: msg.content,
          };
        case 'tool_use':
          return {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: msg.toolUseId,
              name: msg.toolName,
              input: msg.toolInput,
            }],
          };
        case 'tool_result':
          return {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.toolUseId,
              content: msg.content,
            }],
          };
        default:
          return {
            role: msg.role,
            content: '',
          };
      }
    });
  }

  /**
   * Converts messages to OpenAI format
   * 
   * @param messages - Messages to convert
   * @param systemPrompt - Optional system prompt
   * @returns OpenAI-formatted messages
   */
  private convertMessagesToOpenAIFormat(
    messages: Message[],
    systemPrompt?: string
  ): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];

    if (systemPrompt) {
      result.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    for (const msg of messages) {
      switch (msg.type) {
        case 'text':
          result.push({
            role: msg.role,
            content: msg.content,
          });
          break;
        case 'tool_use':
          result.push({
            role: 'assistant',
            tool_calls: [{
              id: msg.toolUseId,
              type: 'function',
              function: {
                name: msg.toolName,
                arguments: JSON.stringify(msg.toolInput),
              },
            }],
          });
          break;
        case 'tool_result':
          result.push({
            role: 'tool',
            tool_call_id: msg.toolUseId,
            content: msg.content,
          });
          break;
      }
    }

    return result;
  }

  /**
   * Converts tools to Anthropic format
   * 
   * @param tools - Tools to convert
   * @returns Anthropic-formatted tools
   */
  private convertToolsToAnthropicFormat(
    tools: ToolDefinition[]
  ): Array<Record<string, unknown>> {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: this.buildToolSchema(tool),
    }));
  }

  /**
   * Converts tools to OpenAI format
   * 
   * @param tools - Tools to convert
   * @returns OpenAI-formatted tools
   */
  private convertToolsToOpenAIFormat(
    tools: ToolDefinition[]
  ): Array<Record<string, unknown>> {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.buildToolSchema(tool),
      },
    }));
  }

  /**
   * Builds JSON schema for tool parameters
   * 
   * @param tool - Tool definition
   * @returns JSON schema
   */
  private buildToolSchema(tool: ToolDefinition): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of tool.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.enum) {
        properties[param.name] = {
          ...properties[param.name],
          enum: param.enum,
        };
      }

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  // ============================================================================
  // Response Parsing
  // ============================================================================

  /**
   * Parses Anthropic API response
   * 
   * @param data - Response data
   * @param startTime - Request start time
   * @returns Query response
   */
  private parseAnthropicResponse(
    data: Record<string, unknown>,
    startTime: number
  ): QueryResponse {
    const content = data.content as Array<Record<string, unknown>>;
    const usage = data.usage as Record<string, number>;

    let message: Message;
    const toolCalls: ToolCall[] = [];

    // Find text content or tool use
    const textContent = content.find(c => c.type === 'text');
    const toolUseContent = content.find(c => c.type === 'tool_use');

    if (toolUseContent) {
      message = {
        id: `msg_${Date.now()}`,
        type: 'tool_use',
        role: 'assistant',
        toolName: toolUseContent.name as string,
        toolInput: toolUseContent.input as Record<string, unknown>,
        toolUseId: toolUseContent.id as string,
        timestamp: new Date(),
      };

      toolCalls.push({
        id: toolUseContent.id as string,
        toolName: toolUseContent.name as string,
        parameters: toolUseContent.input as Record<string, unknown>,
        timestamp: new Date(),
      });
    } else {
      message = {
        id: `msg_${Date.now()}`,
        type: 'text',
        role: 'assistant',
        content: (textContent?.text as string) || '',
        timestamp: new Date(),
      };
    }

    return {
      message,
      usage: {
        inputTokens: usage?.input_tokens || 0,
        outputTokens: usage?.output_tokens || 0,
        totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
      },
      toolCalls,
      duration: Date.now() - startTime,
      model: data.model as string,
      finishReason: data.stop_reason as string,
      metadata: {},
    };
  }

  /**
   * Parses OpenAI API response
   * 
   * @param data - Response data
   * @param startTime - Request start time
   * @returns Query response
   */
  private parseOpenAIResponse(
    data: Record<string, unknown>,
    startTime: number
  ): QueryResponse {
    const choice = (data.choices as Array<Record<string, unknown>>)[0];
    const message_data = choice.message as Record<string, unknown>;
    const usage = data.usage as Record<string, number>;

    let message: Message;
    const toolCalls: ToolCall[] = [];

    // Check for tool calls
    if (message_data.tool_calls) {
      const toolCall = (message_data.tool_calls as Array<Record<string, unknown>>)[0];
      const function_data = toolCall.function as Record<string, unknown>;

      message = {
        id: `msg_${Date.now()}`,
        type: 'tool_use',
        role: 'assistant',
        toolName: function_data.name as string,
        toolInput: JSON.parse(function_data.arguments as string),
        toolUseId: toolCall.id as string,
        timestamp: new Date(),
      };

      toolCalls.push({
        id: toolCall.id as string,
        toolName: function_data.name as string,
        parameters: JSON.parse(function_data.arguments as string),
        timestamp: new Date(),
      });
    } else {
      message = {
        id: `msg_${Date.now()}`,
        type: 'text',
        role: 'assistant',
        content: (message_data.content as string) || '',
        timestamp: new Date(),
      };
    }

    return {
      message,
      usage: {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      },
      toolCalls,
      duration: Date.now() - startTime,
      model: data.model as string,
      finishReason: choice.finish_reason as string,
      metadata: {},
    };
  }

  // ============================================================================
  // Circuit Breaker
  // ============================================================================

  /**
   * Checks circuit breaker state
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      
      if (timeSinceLastFailure >= this.circuitBreakerConfig.resetTimeout) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.halfOpenCalls = 0;
        this.logger.info('[QueryEngine] Circuit breaker entering half-open state');
      } else {
        throw new LLMError(
          'Circuit breaker is open - too many failures',
          undefined,
          this.config.llmConfig.provider,
          true
        );
      }
    }

    if (this.circuitBreaker.state === 'half-open') {
      if (this.circuitBreaker.halfOpenCalls >= this.circuitBreakerConfig.halfOpenMaxCalls) {
        throw new LLMError(
          'Circuit breaker half-open limit reached',
          undefined,
          this.config.llmConfig.provider,
          true
        );
      }
      this.circuitBreaker.halfOpenCalls++;
    }
  }

  /**
   * Records a successful request
   */
  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.halfOpenCalls = 0;
      this.logger.info('[QueryEngine] Circuit breaker closed');
    }
  }

  /**
   * Records a failed request
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreakerConfig.failureThreshold) {
      this.circuitBreaker.state = 'open';
      this.logger.error('[QueryEngine] Circuit breaker opened due to failures');
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculates retry delay with exponential backoff
   * 
   * @param attempt - Current attempt number
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay
    );
    // Add jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Checks if an error is retryable
   * 
   * @param error - Error to check
   * @returns True if retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    return this.retryConfig.retryableErrors.some(code => 
      errorMessage.includes(code.toLowerCase())
    );
  }

  /**
   * Checks if an HTTP status is retryable
   * 
   * @param status - HTTP status code
   * @returns True if retryable
   */
  private isRetryableStatus(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * Generates a cache key for a request
   * 
   * @param options - Query options
   * @returns Cache key
   */
  private generateCacheKey(options: QueryOptions): string {
    const keyData = {
      messages: options.messages.map(m => ({
        role: m.role,
        content: (m as TextMessage).content || '',
      })),
      model: this.config.llmConfig.model,
      systemPrompt: options.systemPrompt,
    };
    return JSON.stringify(keyData);
  }

  /**
   * Tracks telemetry event
   * 
   * @param event - Event name
   * @param data - Event data
   */
  private trackTelemetry(event: string, data: Record<string, unknown>): void {
    this.telemetryCallback?.(event, {
      ...data,
      timestamp: Date.now(),
      provider: this.config.llmConfig.provider,
    });
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a QueryEngine for Anthropic
 * 
 * @param apiKey - API key
 * @param model - Model name
 * @param options - Additional options
 * @returns QueryEngine instance
 */
export function createAnthropicQueryEngine(
  apiKey: string,
  model: string = 'claude-3-5-sonnet-20241022',
  options?: Partial<Omit<QueryEngineConfig, 'llmConfig'>>
): QueryEngine {
  return new QueryEngine({
    llmConfig: {
      provider: 'anthropic',
      apiKey,
      model,
    },
    ...options,
  });
}

/**
 * Creates a QueryEngine for OpenAI
 * 
 * @param apiKey - API key
 * @param model - Model name
 * @param options - Additional options
 * @returns QueryEngine instance
 */
export function createOpenAIQueryEngine(
  apiKey: string,
  model: string = 'gpt-4o',
  options?: Partial<Omit<QueryEngineConfig, 'llmConfig'>>
): QueryEngine {
  return new QueryEngine({
    llmConfig: {
      provider: 'openai',
      apiKey,
      model,
    },
    ...options,
  });
}

/**
 * Factory function to create QueryEngine instances
 */
export function createQueryEngine(config: QueryEngineConfig): QueryEngine {
  return new QueryEngine(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimates cost for a query
 * 
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 * @param model - Model name
 * @returns Estimated cost in USD
 */
export function estimateQueryCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  };

  const modelPricing = pricing[model] || { input: 3.0, output: 15.0 };
  
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
  
  return inputCost + outputCost;
}

export default QueryEngine;
