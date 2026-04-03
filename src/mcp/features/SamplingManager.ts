/**
 * Sampling Manager
 * 
 * This file contains the sampling manager for handling LLM sampling
 * requests from MCP servers.
 */

import { EventEmitter } from 'events';
import {
  CreateMessageRequest,
  CreateMessageResult,
  SamplingMessage,
  ModelPreferences,
  ModelHint,
  TextContent,
  ImageContent,
  MCPErrorCode,
} from '../types';
import { MCPClient } from '../MCPClient';
import { MCPSamplingError, MCPUnsupportedOperationError } from '../utils/errors';

/**
 * Sampling provider interface
 */
export interface SamplingProvider {
  /**
   * Provider name
   */
  name: string;

  /**
   * Create a message using the provider
   */
  createMessage(request: SamplingRequest): Promise<SamplingResponse>;

  /**
   * Get available models
   */
  getModels?(): Promise<string[]>;

  /**
   * Check if provider is available
   */
  isAvailable(): boolean;
}

/**
 * Sampling request
 */
export interface SamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Sampling response
 */
export interface SamplingResponse {
  model: string;
  content: TextContent | ImageContent;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Sampling handler function
 */
export type SamplingHandler = (
  request: SamplingRequest,
  context: SamplingContext
) => Promise<SamplingResponse>;

/**
 * Sampling context
 */
export interface SamplingContext {
  serverName: string;
  client: MCPClient;
  signal?: AbortSignal;
}

/**
 * Sampling options
 */
export interface SamplingOptions {
  /**
   * MCP client instance
   */
  client: MCPClient;

  /**
   * Default provider
   */
  defaultProvider?: SamplingProvider;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Sampling request record
 */
export interface SamplingRequestRecord {
  id: string;
  serverName: string;
  request: SamplingRequest;
  response?: SamplingResponse;
  error?: Error;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'success' | 'error';
}

/**
 * Sampling manager for handling LLM sampling
 */
export class SamplingManager extends EventEmitter {
  private _client: MCPClient;
  private _options: Required<SamplingOptions>;
  private _providers = new Map<string, SamplingProvider>();
  private _handler?: SamplingHandler;
  private _requestHistory: SamplingRequestRecord[] = [];
  private _maxHistorySize = 100;
  private _requestCounter = 0;

  constructor(options: SamplingOptions) {
    super();
    this._client = options.client;
    this._options = {
      client: options.client,
      defaultProvider: options.defaultProvider,
      timeout: options.timeout || 60000,
      debug: options.debug || false,
    };

    if (options.defaultProvider) {
      this.registerProvider(options.defaultProvider);
    }
  }

  // ========================================================================
  // Provider Management
  // ========================================================================

  /**
   * Register a sampling provider
   */
  registerProvider(provider: SamplingProvider): void {
    this._log(`Registering sampling provider: ${provider.name}`);
    this._providers.set(provider.name, provider);
    this.emit('providerRegistered', provider.name);
  }

  /**
   * Unregister a sampling provider
   */
  unregisterProvider(name: string): boolean {
    this._log(`Unregistering sampling provider: ${name}`);
    const result = this._providers.delete(name);
    if (result) {
      this.emit('providerUnregistered', name);
    }
    return result;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): SamplingProvider | undefined {
    return this._providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): SamplingProvider[] {
    return Array.from(this._providers.values());
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): SamplingProvider[] {
    return this.getAllProviders().filter((p) => p.isAvailable());
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: SamplingProvider): void {
    this._options.defaultProvider = provider;
    this.registerProvider(provider);
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): SamplingProvider | undefined {
    return this._options.defaultProvider;
  }

  // ========================================================================
  // Sampling Handler
  // ========================================================================

  /**
   * Set a custom sampling handler
   */
  setHandler(handler: SamplingHandler): void {
    this._log('Setting custom sampling handler');
    this._handler = handler;
  }

  /**
   * Clear the custom sampling handler
   */
  clearHandler(): void {
    this._log('Clearing custom sampling handler');
    this._handler = undefined;
  }

  // ========================================================================
  // Sampling Operations
  // ========================================================================

  /**
   * Create a message (sampling request)
   */
  async createMessage(
    serverName: string,
    request: SamplingRequest,
    options?: {
      provider?: string;
      timeout?: number;
      signal?: AbortSignal;
    }
  ): Promise<SamplingResponse> {
    const startTime = Date.now();
    const requestId = this._generateRequestId();

    this._log(`Creating message for ${serverName}`, request);

    // Create request record
    const record: SamplingRequestRecord = {
      id: requestId,
      serverName,
      request,
      startTime,
      status: 'pending',
    };
    this._addToHistory(record);

    try {
      let response: SamplingResponse;

      // Use custom handler if set
      if (this._handler) {
        response = await this._handler(request, {
          serverName,
          client: this._client,
          signal: options?.signal,
        });
      } else {
        // Use provider
        const providerName = options?.provider;
        const provider = providerName
          ? this.getProvider(providerName)
          : this._options.defaultProvider || this.getAvailableProviders()[0];

        if (!provider) {
          throw new MCPSamplingError('No sampling provider available');
        }

        if (!provider.isAvailable()) {
          throw new MCPSamplingError(`Provider ${provider.name} is not available`);
        }

        response = await this._callProvider(provider, request, options);
      }

      // Update record
      record.response = response;
      record.endTime = Date.now();
      record.status = 'success';

      this.emit('messageCreated', record);

      return response;
    } catch (error) {
      // Update record
      record.error = error instanceof Error ? error : new Error(String(error));
      record.endTime = Date.now();
      record.status = 'error';

      this._log(`Sampling failed for ${serverName}:`, error);
      this.emit('messageFailed', record);

      throw error;
    }
  }

  /**
   * Call a provider with timeout
   */
  private async _callProvider(
    provider: SamplingProvider,
    request: SamplingRequest,
    options?: { timeout?: number; signal?: AbortSignal }
  ): Promise<SamplingResponse> {
    const timeout = options?.timeout || this._options.timeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new MCPSamplingError(`Sampling request timed out after ${timeout}ms`));
      }, timeout);

      // Handle abort signal
      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new MCPSamplingError('Sampling request was cancelled'));
      };

      if (options?.signal) {
        options.signal.addEventListener('abort', onAbort);
      }

      provider
        .createMessage(request)
        .then((response) => {
          clearTimeout(timeoutId);
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          reject(error);
        });
    });
  }

  /**
   * Handle sampling request from server
   */
  async handleServerRequest(
    serverName: string,
    request: CreateMessageRequest
  ): Promise<CreateMessageResult> {
    this._log(`Handling sampling request from ${serverName}`, request);

    // Convert MCP request to sampling request
    const samplingRequest: SamplingRequest = {
      messages: request.messages,
      modelPreferences: request.modelPreferences,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stopSequences: request.stopSequences,
      metadata: request.metadata,
    };

    const response = await this.createMessage(serverName, samplingRequest);

    // Convert sampling response to MCP result
    const result: CreateMessageResult = {
      model: response.model,
      stopReason: response.stopReason,
      role: 'assistant',
      content: response.content,
    };

    return result;
  }

  // ========================================================================
  // Model Selection
  // ========================================================================

  /**
   * Select a model based on preferences
   */
  selectModel(
    preferences: ModelPreferences | undefined,
    availableModels: string[]
  ): string | undefined {
    if (!preferences || availableModels.length === 0) {
      return availableModels[0];
    }

    // Try hints first
    if (preferences.hints && preferences.hints.length > 0) {
      for (const hint of preferences.hints) {
        if (hint.name) {
          const match = availableModels.find(
            (m) => m.toLowerCase() === hint.name!.toLowerCase()
          );
          if (match) return match;
        }
      }
    }

    // Use priority-based selection
    const scored = availableModels.map((model) => ({
      model,
      score: this._scoreModel(model, preferences),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.model;
  }

  /**
   * Score a model based on preferences
   */
  private _scoreModel(model: string, preferences: ModelPreferences): number {
    let score = 0;
    const lowerModel = model.toLowerCase();

    // Cost priority (prefer cheaper models if cost is important)
    if (preferences.costPriority) {
      if (lowerModel.includes('gpt-4')) score -= preferences.costPriority * 0.5;
      if (lowerModel.includes('gpt-3.5')) score += preferences.costPriority * 0.5;
    }

    // Speed priority (prefer faster models if speed is important)
    if (preferences.speedPriority) {
      if (lowerModel.includes('turbo')) score += preferences.speedPriority * 0.5;
      if (lowerModel.includes('mini')) score += preferences.speedPriority * 0.3;
    }

    // Intelligence priority (prefer smarter models if intelligence is important)
    if (preferences.intelligencePriority) {
      if (lowerModel.includes('gpt-4')) score += preferences.intelligencePriority * 0.5;
      if (lowerModel.includes('claude-3-opus')) score += preferences.intelligencePriority * 0.5;
    }

    return score;
  }

  // ========================================================================
  // Request History
  // ========================================================================

  /**
   * Add to request history
   */
  private _addToHistory(record: SamplingRequestRecord): void {
    this._requestHistory.push(record);

    if (this._requestHistory.length > this._maxHistorySize) {
      this._requestHistory = this._requestHistory.slice(-this._maxHistorySize);
    }
  }

  /**
   * Get request history
   */
  getRequestHistory(
    filter?: {
      serverName?: string;
      status?: 'pending' | 'success' | 'error';
      limit?: number;
    }
  ): SamplingRequestRecord[] {
    let history = this._requestHistory;

    if (filter?.serverName) {
      history = history.filter((h) => h.serverName === filter.serverName);
    }

    if (filter?.status) {
      history = history.filter((h) => h.status === filter.status);
    }

    if (filter?.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear request history
   */
  clearHistory(): void {
    this._requestHistory = [];
    this.emit('historyCleared');
  }

  /**
   * Get sampling statistics
   */
  getStatistics(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    pendingRequests: number;
    averageLatency: number;
  } {
    const total = this._requestHistory.length;
    const successful = this._requestHistory.filter((h) => h.status === 'success').length;
    const failed = this._requestHistory.filter((h) => h.status === 'error').length;
    const pending = this._requestHistory.filter((h) => h.status === 'pending').length;

    const completed = this._requestHistory.filter((h) => h.endTime);
    const avgLatency =
      completed.length > 0
        ? completed.reduce((sum, h) => sum + (h.endTime! - h.startTime), 0) /
          completed.length
        : 0;

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      pendingRequests: pending,
      averageLatency: Math.round(avgLatency),
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate a unique request ID
   */
  private _generateRequestId(): string {
    return `sampling_${++this._requestCounter}_${Date.now()}`;
  }

  /**
   * Log a debug message
   */
  private _log(...args: unknown[]): void {
    if (this._options.debug) {
      console.log('[SamplingManager]', ...args);
    }
  }

  /**
   * Dispose of the sampling manager
   */
  dispose(): void {
    this._log('Disposing sampling manager');
    this._providers.clear();
    this._handler = undefined;
    this._requestHistory = [];
    this.removeAllListeners();
  }
}

/**
 * Create a sampling manager
 */
export function createSamplingManager(options: SamplingOptions): SamplingManager {
  return new SamplingManager(options);
}

/**
 * Create a simple sampling provider from a function
 */
export function createSamplingProvider(
  name: string,
  createMessage: (request: SamplingRequest) => Promise<SamplingResponse>,
  options?: {
    getModels?: () => Promise<string[]>;
    isAvailable?: () => boolean;
  }
): SamplingProvider {
  return {
    name,
    createMessage,
    getModels: options?.getModels,
    isAvailable: options?.isAvailable || (() => true),
  };
}

/**
 * Helper to create text content
 */
export function createTextContent(text: string): TextContent {
  return {
    type: 'text',
    text,
  };
}

/**
 * Helper to create image content
 */
export function createImageContent(data: string, mimeType: string): ImageContent {
  return {
    type: 'image',
    data,
    mimeType,
  };
}

/**
 * Helper to create a sampling message
 */
export function createSamplingMessage(
  role: 'user' | 'assistant',
  content: TextContent | ImageContent
): SamplingMessage {
  return {
    role,
    content,
  };
}

/**
 * Helper to format sampling messages as a prompt string
 */
export function formatSamplingMessages(messages: SamplingMessage[]): string {
  return messages
    .map((msg) => {
      if (msg.content.type === 'text') {
        return `${msg.role}: ${msg.content.text}`;
      }
      return `${msg.role}: [Image]`;
    })
    .join('\n\n');
}
