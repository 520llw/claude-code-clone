/**
 * Model Context Protocol (MCP) Prompts Manager
 * 
 * This module provides prompt registration, management, and retrieval
 * capabilities for MCP servers. Supports parameterized prompts with
 * argument validation.
 */

import { EventEmitter } from 'events';
import {
  Prompt,
  PromptArgument,
  PromptMessage,
  TextContent,
  ImageContent,
  EmbeddedResource,
  PromptDefinition,
  MCP_ERROR_CODES,
} from '../types';

/**
 * Prompt get context
 */
export interface PromptGetContext {
  clientId?: string;
}

/**
 * Prompt argument value
 */
export interface PromptArgumentValue {
  name: string;
  value: string;
  required: boolean;
}

/**
 * Prompt get error
 */
export class PromptGetError extends Error {
  constructor(
    message: string,
    public readonly promptName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptGetError';
  }
}

/**
 * Prompt not found error
 */
export class PromptNotFoundError extends Error {
  constructor(name: string) {
    super(`Prompt not found: ${name}`);
    this.name = 'PromptNotFoundError';
  }
}

/**
 * Missing required argument error
 */
export class MissingRequiredArgumentError extends Error {
  constructor(promptName: string, argName: string) {
    super(`Prompt '${promptName}' requires argument '${argName}'`);
    this.name = 'MissingRequiredArgumentError';
  }
}

/**
 * Invalid argument value error
 */
export class InvalidArgumentValueError extends Error {
  constructor(
    promptName: string,
    argName: string,
    value: string,
    reason: string
  ) {
    super(`Invalid value '${value}' for argument '${argName}' in prompt '${promptName}': ${reason}`);
    this.name = 'InvalidArgumentValueError';
  }
}

/**
 * Prompts Manager
 * 
 * Manages prompt registration and retrieval for MCP servers.
 * Supports parameterized prompts with argument validation.
 */
export class PromptsManager extends EventEmitter {
  private _prompts = new Map<string, PromptDefinition>();
  private _isDisposed = false;

  /**
   * Get all registered prompts
   */
  get prompts(): Prompt[] {
    return this.listPrompts();
  }

  /**
   * Get number of registered prompts
   */
  get promptCount(): number {
    return this._prompts.size;
  }

  /**
   * Get registered prompt names
   */
  get promptNames(): string[] {
    return Array.from(this._prompts.keys());
  }

  /**
   * Check if the manager has any prompts
   */
  hasPrompts(): boolean {
    return this._prompts.size > 0;
  }

  /**
   * Check if a prompt is registered
   */
  hasPrompt(name: string): boolean {
    return this._prompts.has(name);
  }

  /**
   * Register a prompt
   */
  registerPrompt(prompt: PromptDefinition): void {
    this.ensureNotDisposed();

    if (this._prompts.has(prompt.name)) {
      throw new Error(`Prompt '${prompt.name}' is already registered`);
    }

    // Validate prompt name
    if (!this.isValidPromptName(prompt.name)) {
      throw new Error(`Invalid prompt name: '${prompt.name}'. Names must match ^[a-zA-Z0-9_-]+$`);
    }

    // Validate argument names
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (!this.isValidArgumentName(arg.name)) {
          throw new Error(`Invalid argument name: '${arg.name}'`);
        }
      }
    }

    this._prompts.set(prompt.name, prompt);
    this.emit('promptRegistered', prompt.name);
    this.emit('promptsChanged');
  }

  /**
   * Unregister a prompt
   */
  unregisterPrompt(name: string): boolean {
    this.ensureNotDisposed();

    const deleted = this._prompts.delete(name);
    if (deleted) {
      this.emit('promptUnregistered', name);
      this.emit('promptsChanged');
    }
    return deleted;
  }

  /**
   * Get a prompt definition
   */
  getPromptDefinition(name: string): PromptDefinition | undefined {
    return this._prompts.get(name);
  }

  /**
   * Get a prompt's description
   */
  getPromptDescription(name: string): string | undefined {
    return this._prompts.get(name)?.description;
  }

  /**
   * List all registered prompts in MCP format
   */
  listPrompts(): Prompt[] {
    const prompts: Prompt[] = [];

    for (const [name, prompt] of this._prompts) {
      prompts.push({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      });
    }

    return prompts;
  }

  /**
   * Get a prompt with argument validation
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
    context: PromptGetContext = {}
  ): Promise<PromptMessage[]> {
    this.ensureNotDisposed();

    const prompt = this._prompts.get(name);
    if (!prompt) {
      throw new PromptNotFoundError(name);
    }

    // Validate required arguments
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (arg.required && (!args || args[arg.name] === undefined)) {
          throw new MissingRequiredArgumentError(name, arg.name);
        }
      }
    }

    // Execute prompt handler
    try {
      const messages = await prompt.handler(args);
      return messages;
    } catch (error) {
      throw new PromptGetError(
        `Failed to get prompt '${name}': ${error instanceof Error ? error.message : String(error)}`,
        name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate prompt arguments without executing
   */
  validatePromptArgs(name: string, args?: Record<string, string>): {
    valid: boolean;
    missing?: string[];
    extra?: string[];
  } {
    const prompt = this._prompts.get(name);
    if (!prompt) {
      return { valid: false };
    }

    const missing: string[] = [];
    const providedArgs = new Set(Object.keys(args ?? {}));

    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        providedArgs.delete(arg.name);
        if (arg.required && (!args || args[arg.name] === undefined)) {
          missing.push(arg.name);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined,
      extra: providedArgs.size > 0 ? Array.from(providedArgs) : undefined,
    };
  }

  /**
   * Get prompt arguments info
   */
  getPromptArguments(name: string): PromptArgument[] | undefined {
    return this._prompts.get(name)?.arguments;
  }

  /**
   * Validate prompt name format
   */
  private isValidPromptName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Validate argument name format
   */
  private isValidArgumentName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Create a text content message
   */
  static createTextMessage(role: 'user' | 'assistant', text: string): PromptMessage {
    return {
      role,
      content: { type: 'text', text },
    };
  }

  /**
   * Create an image content message
   */
  static createImageMessage(
    role: 'user' | 'assistant',
    data: string,
    mimeType: string
  ): PromptMessage {
    return {
      role,
      content: { type: 'image', data, mimeType },
    };
  }

  /**
   * Create a resource content message
   */
  static createResourceMessage(
    role: 'user' | 'assistant',
    resource: TextContent | ImageContent | EmbeddedResource
  ): PromptMessage {
    return {
      role,
      content: resource,
    };
  }

  /**
   * Create a user message
   */
  static createUserMessage(text: string): PromptMessage {
    return PromptsManager.createTextMessage('user', text);
  }

  /**
   * Create an assistant message
   */
  static createAssistantMessage(text: string): PromptMessage {
    return PromptsManager.createTextMessage('assistant', text);
  }

  /**
   * Create a conversation from text lines
   */
  static createConversation(lines: Array<{ role: 'user' | 'assistant'; text: string }>): PromptMessage[] {
    return lines.map((line) => PromptsManager.createTextMessage(line.role, line.text));
  }

  /**
   * Ensure manager is not disposed
   */
  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('PromptsManager has been disposed');
    }
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._prompts.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a prompts manager instance
 */
export function createPromptsManager(): PromptsManager {
  return new PromptsManager();
}

/**
 * Helper function to create a prompt definition
 */
export function definePrompt(
  name: string,
  handler: (args?: Record<string, string>) => Promise<PromptMessage[]>,
  options: { description?: string; arguments?: PromptArgument[] } = {}
): PromptDefinition {
  return {
    name,
    description: options.description,
    arguments: options.arguments,
    handler,
  };
}

/**
 * Create a prompt argument definition
 */
export function createPromptArgument(
  name: string,
  options: { description?: string; required?: boolean } = {}
): PromptArgument {
  return {
    name,
    description: options.description,
    required: options.required ?? false,
  };
}

/**
 * Common prompt helpers
 */
export const PromptHelpers = {
  /**
   * Create a system prompt
   */
  createSystemPrompt(name: string, systemMessage: string): PromptDefinition {
    return definePrompt(
      name,
      async () => [PromptsManager.createAssistantMessage(systemMessage)],
      { description: `System prompt: ${name}` }
    );
  },

  /**
   * Create a code review prompt
   */
  createCodeReviewPrompt(): PromptDefinition {
    return definePrompt(
      'code_review',
      async (args) => [
        PromptsManager.createUserMessage(
          `Please review the following code:\n\n${args?.code || '[No code provided]'}`
        ),
      ],
      {
        description: 'Request a code review',
        arguments: [
          createPromptArgument('code', { description: 'The code to review', required: true }),
          createPromptArgument('language', { description: 'Programming language', required: false }),
        ],
      }
    );
  },

  /**
   * Create a summarize prompt
   */
  createSummarizePrompt(): PromptDefinition {
    return definePrompt(
      'summarize',
      async (args) => [
        PromptsManager.createUserMessage(
          `Please summarize the following text:\n\n${args?.text || '[No text provided]'}`
        ),
      ],
      {
        description: 'Summarize a piece of text',
        arguments: [
          createPromptArgument('text', { description: 'The text to summarize', required: true }),
          createPromptArgument('max_length', {
            description: 'Maximum length of summary',
            required: false,
          }),
        ],
      }
    );
  },

  /**
   * Create an explain prompt
   */
  createExplainPrompt(): PromptDefinition {
    return definePrompt(
      'explain',
      async (args) => [
        PromptsManager.createUserMessage(
          `Please explain the following:\n\n${args?.topic || '[No topic provided]'}`
        ),
      ],
      {
        description: 'Explain a topic or concept',
        arguments: [
          createPromptArgument('topic', { description: 'The topic to explain', required: true }),
          createPromptArgument('audience', {
            description: 'Target audience (beginner, intermediate, expert)',
            required: false,
          }),
        ],
      }
    );
  },

  /**
   * Create a debug prompt
   */
  createDebugPrompt(): PromptDefinition {
    return definePrompt(
      'debug',
      async (args) => [
        PromptsManager.createUserMessage(
          `I'm having an issue with the following code. Can you help debug it?\n\n${
            args?.code || '[No code provided]'
          }\n\nError: ${args?.error || '[No error provided]'}`
        ),
      ],
      {
        description: 'Get help debugging code',
        arguments: [
          createPromptArgument('code', { description: 'The code with the issue', required: true }),
          createPromptArgument('error', { description: 'The error message', required: true }),
          createPromptArgument('language', { description: 'Programming language', required: false }),
        ],
      }
    );
  },

  /**
   * Create a multi-turn conversation prompt
   */
  createConversationPrompt(name: string, conversation: PromptMessage[]): PromptDefinition {
    return definePrompt(
      name,
      async () => conversation,
      { description: `Pre-defined conversation: ${name}` }
    );
  },

  /**
   * Chain multiple prompts together
   */
  async chainPrompts(
    manager: PromptsManager,
    promptNames: Array<{ name: string; args?: Record<string, string> }>
  ): Promise<PromptMessage[]> {
    const allMessages: PromptMessage[] = [];

    for (const { name, args } of promptNames) {
      const messages = await manager.getPrompt(name, args);
      allMessages.push(...messages);
    }

    return allMessages;
  },
};

/**
 * Pre-defined common prompts
 */
export const CommonPrompts = {
  /**
   * Code assistant prompt
   */
  codeAssistant: definePrompt(
    'code_assistant',
    async () => [
      PromptsManager.createAssistantMessage(
        'I am a helpful coding assistant. I can help you write, review, debug, and explain code. What would you like help with?'
      ),
    ],
    { description: 'Initialize a code assistant conversation' }
  ),

  /**
   * Documentation helper prompt
   */
  documentationHelper: definePrompt(
    'documentation_helper',
    async (args) => [
      PromptsManager.createUserMessage(
        `Please help me document the following code:\n\n${args?.code || '[No code provided]'}`
      ),
    ],
    {
      description: 'Generate documentation for code',
      arguments: [
        createPromptArgument('code', { description: 'The code to document', required: true }),
        createPromptArgument('style', {
          description: 'Documentation style (jsdoc, pydoc, etc.)',
          required: false,
        }),
      ],
    }
  ),

  /**
   * Refactoring prompt
   */
  refactoring: definePrompt(
    'refactoring',
    async (args) => [
      PromptsManager.createUserMessage(
        `Please suggest refactoring improvements for the following code:\n\n${
          args?.code || '[No code provided]'
        }\n\nGoals: ${args?.goals || 'Improve readability and maintainability'}`
      ),
    ],
    {
      description: 'Get refactoring suggestions',
      arguments: [
        createPromptArgument('code', { description: 'The code to refactor', required: true }),
        createPromptArgument('goals', { description: 'Refactoring goals', required: false }),
      ],
    }
  ),

  /**
   * Test generation prompt
   */
  testGeneration: definePrompt(
    'test_generation',
    async (args) => [
      PromptsManager.createUserMessage(
        `Please generate tests for the following code:\n\n${args?.code || '[No code provided]'}`
      ),
    ],
    {
      description: 'Generate unit tests for code',
      arguments: [
        createPromptArgument('code', { description: 'The code to test', required: true }),
        createPromptArgument('framework', { description: 'Testing framework', required: false }),
      ],
    }
  ),
};
