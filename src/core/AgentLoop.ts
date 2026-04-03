/**
 * AgentLoop - Main Agentic Loop Orchestrator
 * 
 * This module implements the core agentic loop:
 * User Input → LLM → Tool Selection → Tool Execution → Response
 * 
 * Features:
 * - Multi-turn conversation handling
 * - Tool execution with permission management
 * - Streaming responses
 * - Error handling and recovery
 * - Context management
 * - Session persistence
 * - Telemetry and logging
 * 
 * @module AgentLoop
 */

import {
  Message,
  TextMessage,
  ToolUseMessage,
  ToolResultMessage,
  Tool,
  ToolCall,
  ToolResult,
  ToolContext,
  AgentConfig,
  AgentIteration,
  AgentResult,
  AgentState,
  Session,
  LLMConfig,
  Logger,
  AgentError,
  LLMError,
  ToolError,
  PermissionError,
  StreamCallbacks,
  TokenUsage,
} from '../types/index.js';

import { QueryEngine, QueryOptions, QueryResponse } from './QueryEngine.js';
import { ContextManager } from './ContextManager.js';
import { PermissionManager } from './PermissionManager.js';
import { SessionManager } from './SessionManager.js';
import { TokenTracker } from './TokenTracker.js';
import { StreamingHandler } from './StreamingHandler.js';

// ============================================================================
// Constants and Defaults
// ============================================================================

/**
 * Default agent configuration
 */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 50,
  timeout: 300000, // 5 minutes
  autoApprove: false,
  streamResponses: true,
  contextConfig: {
    maxTokens: 100000,
    compressionStrategy: 'auto',
    preserveRecentMessages: 10,
    preserveSystemMessages: true,
    preserveToolResults: true,
  },
  tokenBudget: {
    maxInputTokens: 100000,
    maxOutputTokens: 16000,
    maxTotalTokens: 200000,
    warningThreshold: 0.8,
  },
};

/**
 * Default system prompt
 */
const DEFAULT_SYSTEM_PROMPT = `You are Claude Code, an AI assistant designed to help with software development tasks.
You have access to various tools for file operations, code analysis, shell commands, and more.

Guidelines:
- Always think step by step
- Use tools when needed to accomplish tasks
- Explain your reasoning when making changes
- Ask for clarification if the request is ambiguous
- Be concise but thorough in your responses`;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Agent events
 */
export interface AgentEvents {
  onStateChange?: (state: AgentState) => void;
  onMessage?: (message: Message) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolResult: ToolResult) => void;
  onIteration?: (iteration: AgentIteration) => void;
  onComplete?: (result: AgentResult) => void;
  onError?: (error: Error) => void;
  onStreamToken?: (token: string) => void;
}

/**
 * Agent configuration options
 */
export interface AgentOptions {
  sessionId?: string;
  llmConfig: LLMConfig;
  tools: Tool[];
  systemPrompt?: string;
  agentConfig?: Partial<AgentConfig>;
  events?: AgentEvents;
  logger?: Logger;
  workingDirectory?: string;
  enableSessionPersistence?: boolean;
  sessionStoragePath?: string;
}

/**
 * Tool execution result
 */
interface ToolExecutionResult {
  result: ToolResult;
  message: ToolResultMessage;
}

// ============================================================================
// AgentLoop Class
// ============================================================================

/**
 * AgentLoop class - Main orchestrator for the agentic loop
 */
export class AgentLoop {
  private sessionId: string;
  private llmConfig: LLMConfig;
  private tools: Map<string, Tool>;
  private systemPrompt: string;
  private config: AgentConfig;
  private events: AgentEvents;
  private logger: Logger;
  private workingDirectory: string;
  
  // Core components
  private queryEngine: QueryEngine;
  private contextManager: ContextManager;
  private permissionManager: PermissionManager;
  private sessionManager?: SessionManager;
  private tokenTracker: TokenTracker;
  
  // State
  private state: AgentState;
  private currentIteration: number;
  private iterations: AgentIteration[];
  private abortController: AbortController | null;
  private session?: Session;

  /**
   * Creates a new AgentLoop instance
   * 
   * @param options - Agent configuration options
   */
  constructor(options: AgentOptions) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.llmConfig = options.llmConfig;
    this.tools = new Map();
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.config = { ...DEFAULT_AGENT_CONFIG, ...options.agentConfig };
    this.events = options.events || {};
    this.logger = options.logger || this.createDefaultLogger();
    this.workingDirectory = options.workingDirectory || process.cwd();
    
    this.state = 'idle';
    this.currentIteration = 0;
    this.iterations = [];
    this.abortController = null;

    // Register tools
    for (const tool of options.tools) {
      this.tools.set(tool.definition.name, tool);
    }

    // Initialize components
    this.queryEngine = new QueryEngine({
      llmConfig: this.llmConfig,
      logger: this.logger,
      enableStreaming: this.config.streamResponses,
    });

    this.contextManager = new ContextManager({
      sessionId: this.sessionId,
      maxTokens: this.config.contextConfig.maxTokens,
      compressionStrategy: this.config.contextConfig.compressionStrategy,
      preserveRecentMessages: this.config.contextConfig.preserveRecentMessages,
      preserveSystemMessages: this.config.contextConfig.preserveSystemMessages,
      preserveToolResults: this.config.contextConfig.preserveToolResults,
      logger: this.logger,
    });

    this.permissionManager = new PermissionManager({
      sessionId: this.sessionId,
      logger: this.logger,
    });

    this.tokenTracker = new TokenTracker({
      sessionId: this.sessionId,
      budget: this.config.tokenBudget,
      logger: this.logger,
    });

    // Initialize session manager if persistence enabled
    if (options.enableSessionPersistence) {
      this.sessionManager = new SessionManager({
        storagePath: options.sessionStoragePath,
        defaultLLMConfig: this.llmConfig,
        logger: this.logger,
      });
    }

    this.logger.info(`[AgentLoop] Initialized for session ${this.sessionId}`);
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
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Initializes the agent
   */
  async initialize(): Promise<void> {
    this.setState('idle');
    
    if (this.sessionManager) {
      await this.sessionManager.initialize();
      
      // Create or resume session
      this.session = await this.sessionManager.createSession(
        `Session ${this.sessionId}`,
        {
          llmConfig: this.llmConfig,
        },
        {
          workingDirectory: this.workingDirectory,
        }
      );
    }

    this.logger.info('[AgentLoop] Initialized successfully');
  }

  /**
   * Runs the agent with user input
   * 
   * @param input - User input text
   * @returns Agent result
   */
  async run(input: string): Promise<AgentResult> {
    if (this.state !== 'idle') {
      throw new AgentError(
        'Agent is already running',
        'AGENT_ALREADY_RUNNING',
        false
      );
    }

    // Create user message
    const userMessage: TextMessage = {
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    return this.runWithMessage(userMessage);
  }

  /**
   * Runs the agent with a message
   * 
   * @param message - User message
   * @returns Agent result
   */
  async runWithMessage(message: Message): Promise<AgentResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    try {
      this.setState('processing');
      
      // Add user message to context
      this.contextManager.addMessage(message);
      await this.persistMessage(message);
      this.events.onMessage?.(message);

      // Run the agentic loop
      let shouldContinue = true;
      
      while (shouldContinue && this.currentIteration < this.config.maxIterations) {
        // Check for abort
        if (this.abortController.signal.aborted) {
          throw new AgentError('Agent execution aborted', 'AGENT_ABORTED', false);
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > this.config.timeout) {
          throw new AgentError(
            `Agent execution timed out after ${this.config.timeout}ms`,
            'AGENT_TIMEOUT',
            false
          );
        }

        // Run single iteration
        const iteration = await this.runIteration();
        this.iterations.push(iteration);
        this.currentIteration++;

        // Check if we should continue
        shouldContinue = iteration.toolCalls.length > 0;

        if (shouldContinue) {
          this.setState('executing_tool');
        }
      }

      // Build result
      const result: AgentResult = {
        success: true,
        messages: this.contextManager.getMessages(),
        iterations: this.iterations,
        totalTokenUsage: this.tokenTracker.getTotalUsage(),
        totalDuration: Date.now() - startTime,
      };

      this.setState('completed');
      this.events.onComplete?.(result);

      return result;

    } catch (error) {
      this.setState('error');
      this.events.onError?.(error as Error);
      
      return {
        success: false,
        messages: this.contextManager.getMessages(),
        iterations: this.iterations,
        totalTokenUsage: this.tokenTracker.getTotalUsage(),
        totalDuration: Date.now() - startTime,
        error: error as Error,
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Streams the agent response
   * 
   * @param input - User input
   * @param callbacks - Stream callbacks
   * @returns Agent result
   */
  async stream(
    input: string,
    callbacks: StreamCallbacks
  ): Promise<AgentResult> {
    const userMessage: TextMessage = {
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    return this.streamWithMessage(userMessage, callbacks);
  }

  /**
   * Streams with a message
   * 
   * @param message - User message
   * @param callbacks - Stream callbacks
   * @returns Agent result
   */
  async streamWithMessage(
    message: Message,
    callbacks: StreamCallbacks
  ): Promise<AgentResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    try {
      this.setState('streaming');
      
      // Add user message
      this.contextManager.addMessage(message);
      await this.persistMessage(message);
      this.events.onMessage?.(message);

      // Stream the response
      const streamCallbacks: StreamCallbacks = {
        ...callbacks,
        onToken: (token) => {
          this.events.onStreamToken?.(token);
          callbacks.onToken?.(token);
        },
        onToolUse: (toolUse) => {
          this.handleStreamedToolUse(toolUse);
          callbacks.onToolUse?.(toolUse);
        },
        onComplete: (msg) => {
          this.handleStreamedComplete(msg);
          callbacks.onComplete?.(msg);
        },
        onError: (error) => {
          this.setState('error');
          this.events.onError?.(error);
          callbacks.onError?.(error);
        },
      };

      await this.queryEngine.streamQuery(
        this.buildQueryOptions(),
        streamCallbacks
      );

      const result: AgentResult = {
        success: true,
        messages: this.contextManager.getMessages(),
        iterations: this.iterations,
        totalTokenUsage: this.tokenTracker.getTotalUsage(),
        totalDuration: Date.now() - startTime,
      };

      this.setState('completed');
      return result;

    } catch (error) {
      this.setState('error');
      this.events.onError?.(error as Error);
      
      return {
        success: false,
        messages: this.contextManager.getMessages(),
        iterations: this.iterations,
        totalTokenUsage: this.tokenTracker.getTotalUsage(),
        totalDuration: Date.now() - startTime,
        error: error as Error,
      };
    }
  }

  /**
   * Aborts the current execution
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.logger.info('[AgentLoop] Execution aborted');
    }
  }

  /**
   * Gets the current agent state
   * 
   * @returns Current state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Gets the conversation history
   * 
   * @returns Array of messages
   */
  getMessages(): Message[] {
    return this.contextManager.getMessages();
  }

  /**
   * Gets token usage statistics
   * 
   * @returns Token usage
   */
  getTokenUsage(): TokenUsage {
    return this.tokenTracker.getTotalUsage();
  }

  /**
   * Adds a tool to the agent
   * 
   * @param tool - Tool to add
   */
  addTool(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
    this.logger.info(`[AgentLoop] Added tool: ${tool.definition.name}`);
  }

  /**
   * Removes a tool from the agent
   * 
   * @param toolName - Name of tool to remove
   */
  removeTool(toolName: string): void {
    this.tools.delete(toolName);
    this.logger.info(`[AgentLoop] Removed tool: ${toolName}`);
  }

  /**
   * Clears the conversation history
   */
  clearHistory(): void {
    this.contextManager.clearMessages();
    this.iterations = [];
    this.currentIteration = 0;
    this.logger.info('[AgentLoop] History cleared');
  }

  /**
   * Disposes the agent
   */
  async dispose(): Promise<void> {
    this.abort();
    await this.sessionManager?.dispose();
    this.logger.info('[AgentLoop] Disposed');
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Runs a single iteration of the agentic loop
   * 
   * @returns Iteration result
   */
  private async runIteration(): Promise<AgentIteration> {
    const iterationStart = Date.now();
    this.setState('processing');

    // Query LLM
    const queryResponse = await this.queryEngine.query(this.buildQueryOptions());

    // Track token usage
    this.tokenTracker.recordUsage(queryResponse.usage);

    // Add LLM response to context
    this.contextManager.addMessage(queryResponse.message);
    await this.persistMessage(queryResponse.message);
    this.events.onMessage?.(queryResponse.message);

    // Execute tool calls if any
    const toolResults: ToolResult[] = [];
    
    if (queryResponse.toolCalls.length > 0) {
      for (const toolCall of queryResponse.toolCalls) {
        this.events.onToolCall?.(toolCall);
        
        const executionResult = await this.executeToolCall(toolCall);
        toolResults.push(executionResult.result);
        
        // Add tool result to context
        this.contextManager.addMessage(executionResult.message);
        await this.persistMessage(executionResult.message);
        this.events.onToolResult?.(executionResult.result);
        this.events.onMessage?.(executionResult.message);
      }
    }

    const iteration: AgentIteration = {
      iteration: this.currentIteration,
      input: this.contextManager.getMessages()[this.contextManager.getMessages().length - 2],
      llmResponse: queryResponse.message,
      toolCalls: queryResponse.toolCalls,
      toolResults,
      tokenUsage: queryResponse.usage,
      duration: Date.now() - iterationStart,
    };

    this.events.onIteration?.(iteration);

    return iteration;
  }

  /**
   * Builds query options for the LLM
   * 
   * @returns Query options
   */
  private buildQueryOptions(): QueryOptions {
    const toolDefinitions = Array.from(this.tools.values()).map(t => t.definition);

    return {
      messages: this.contextManager.getMessages(),
      tools: toolDefinitions,
      systemPrompt: this.systemPrompt,
      abortSignal: this.abortController?.signal,
    };
  }

  /**
   * Executes a tool call
   * 
   * @param toolCall - Tool call to execute
   * @returns Execution result
   */
  private async executeToolCall(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolCall.toolName);
    
    if (!tool) {
      const error = new ToolError(
        `Tool not found: ${toolCall.toolName}`,
        toolCall.toolName,
        toolCall.parameters
      );
      
      return {
        result: {
          toolCallId: toolCall.id,
          success: false,
          output: error.message,
          error,
        },
        message: {
          id: `result_${Date.now()}`,
          type: 'tool_result',
          role: 'tool',
          toolUseId: toolCall.id,
          content: error.message,
          isError: true,
          timestamp: new Date(),
        },
      };
    }

    // Check permissions
    if (!this.config.autoApprove) {
      const permission = await this.permissionManager.evaluatePermission(
        toolCall.toolName,
        toolCall.parameters,
        tool.definition
      );

      if (!permission.granted && !permission.decision) {
        // Need to wait for user approval
        this.setState('awaiting_permission');
        
        // For now, auto-approve in non-interactive mode
        // In production, this would wait for user input
        const decision = this.permissionManager.resolvePermissionRequest(
          this.permissionManager.getPendingRequests()[0]?.id || '',
          true,
          'session'
        );
        
        if (!decision.granted) {
          const error = new PermissionError(
            `Permission denied for tool: ${toolCall.toolName}`,
            toolCall.toolName
          );
          
          return {
            result: {
              toolCallId: toolCall.id,
              success: false,
              output: error.message,
              error,
            },
            message: {
              id: `result_${Date.now()}`,
              type: 'tool_result',
              role: 'tool',
              toolUseId: toolCall.id,
              content: error.message,
              isError: true,
              timestamp: new Date(),
            },
          };
        }
      }
    }

    // Execute tool
    const toolStart = Date.now();
    
    try {
      const toolContext: ToolContext = {
        sessionId: this.sessionId,
        workingDirectory: this.workingDirectory,
        abortSignal: this.abortController?.signal,
      };

      const result = await tool.execute(toolCall.parameters, toolContext);
      result.executionTime = Date.now() - toolStart;

      return {
        result,
        message: {
          id: `result_${Date.now()}`,
          type: 'tool_result',
          role: 'tool',
          toolUseId: toolCall.id,
          content: result.output,
          isError: !result.success,
          timestamp: new Date(),
        },
      };

    } catch (error) {
      const toolError = error instanceof Error ? error : new Error(String(error));
      
      return {
        result: {
          toolCallId: toolCall.id,
          success: false,
          output: toolError.message,
          error: toolError,
          executionTime: Date.now() - toolStart,
        },
        message: {
          id: `result_${Date.now()}`,
          type: 'tool_result',
          role: 'tool',
          toolUseId: toolCall.id,
          content: toolError.message,
          isError: true,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Handles streamed tool use
   * 
   * @param toolUse - Tool use message
   */
  private async handleStreamedToolUse(toolUse: ToolUseMessage): Promise<void> {
    const toolCall: ToolCall = {
      id: toolUse.toolUseId,
      toolName: toolUse.toolName,
      parameters: toolUse.toolInput,
      timestamp: new Date(),
    };

    this.events.onToolCall?.(toolCall);

    // Execute tool
    const result = await this.executeToolCall(toolCall);
    
    this.events.onToolResult?.(result.result);
    this.events.onMessage?.(result.message);
  }

  /**
   * Handles streamed completion
   * 
   * @param message - Completed message
   */
  private handleStreamedComplete(message: Message): void {
    this.contextManager.addMessage(message);
    this.persistMessage(message);
  }

  /**
   * Persists a message to session
   * 
   * @param message - Message to persist
   */
  private async persistMessage(message: Message): Promise<void> {
    if (this.sessionManager && this.session) {
      await this.sessionManager.addMessage(this.session.id, message);
    }
  }

  /**
   * Sets the agent state
   * 
   * @param state - New state
   */
  private setState(state: AgentState): void {
    if (this.state !== state) {
      this.state = state;
      this.events.onStateChange?.(state);
      this.logger.debug(`[AgentLoop] State changed to: ${state}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an AgentLoop instance
 * 
 * @param options - Agent options
 * @returns AgentLoop instance
 */
export function createAgentLoop(options: AgentOptions): AgentLoop {
  return new AgentLoop(options);
}

/**
 * Creates a simple agent with minimal configuration
 * 
 * @param llmConfig - LLM configuration
 * @param tools - Available tools
 * @returns AgentLoop instance
 */
export function createSimpleAgent(
  llmConfig: LLMConfig,
  tools: Tool[]
): AgentLoop {
  return new AgentLoop({
    llmConfig,
    tools,
  });
}

export default AgentLoop;
