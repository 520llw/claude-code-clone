/**
 * onToolCall.ts
 * 
 * Tool Call Hook Implementation
 * 
 * This hook is triggered when a tool is about to be called. It allows
 * plugins to validate, modify, or block tool calls before execution.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnToolCallData, HookContext } from '../types';

/**
 * onToolCall hook definition
 */
export const onToolCallDefinition: HookDefinition<OnToolCallData> = {
  name: 'onToolCall',
  description: 'Called when a tool is about to be called. Plugins can validate, modify, or block tool calls.',
  category: HookCategory.TOOL,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 5000,
  allowModification: true,
  stopOnError: true,
  stopOnSuccess: false,
  examples: [
    `// Log tool calls
plugin.registerHook('onToolCall', async (context) => {
  const { toolName, arguments: args } = context.data;
  console.log(\`Tool called: \${toolName}\`, args);
});`,
    `// Block dangerous commands
plugin.registerHook('onToolCall', async (context) => {
  const { toolName, arguments: args } = context.data;
  
  if (toolName === 'execute' && isDangerousCommand(args.command)) {
    context.set('allow', false);
    context.set('blockReason', 'Command is not allowed');
  }
});`,
    `// Add authentication headers
plugin.registerHook('onToolCall', async (context) => {
  const { toolName, arguments: args } = context.data;
  
  if (toolName === 'fetch') {
    args.headers = {
      ...args.headers,
      'X-Plugin-Auth': await getAuthToken()
    };
  }
});`
  ],
  relatedHooks: ['onToolResult', 'onPermissionRequest'],
  schema: {
    input: {
      type: 'object',
      properties: {
        callId: { type: 'string', description: 'Unique call ID' },
        toolName: { type: 'string', description: 'Tool name' },
        arguments: { type: 'object', description: 'Tool arguments' },
        timestamp: { type: 'string', format: 'date-time', description: 'Call timestamp' },
        allow: { type: 'boolean', description: 'Whether to allow the call' },
        blockReason: { type: 'string', description: 'Reason for blocking' }
      },
      required: ['callId', 'toolName', 'arguments', 'timestamp', 'allow']
    }
  }
};

/**
 * Tool call validation result
 */
export interface ToolValidationResult {
  valid: boolean;
  reason?: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * onToolCall hook context
 */
export interface OnToolCallContext extends HookContext<OnToolCallData> {
  /** Allow the tool call */
  allow(): void;
  /** Block the tool call */
  block(reason: string): void;
  /** Modify tool arguments */
  setArgument(key: string, value: any): void;
  /** Get an argument value */
  getArgument(key: string): any;
  /** Validate the tool call */
  validate(validator: (data: OnToolCallData) => ToolValidationResult): ToolValidationResult;
  /** Log the tool call */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  /** Get tool schema */
  getToolSchema(): Promise<object | undefined>;
  /** Check if user has permission for this tool */
  checkPermission(): Promise<boolean>;
}

/**
 * Creates an onToolCall hook context
 */
export function createOnToolCallContext(
  data: OnToolCallData,
  executionId: string
): OnToolCallContext {
  return {
    hookName: 'onToolCall',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnToolCallData>(key: K): OnToolCallData[K] {
      return data[key];
    },

    set<K extends keyof OnToolCallData>(key: K, value: OnToolCallData[K]): void {
      (data as any)[key] = value;
    },

    cancel(reason?: string): void {
      this.cancelled = true;
      this.cancellationReason = reason;
    },

    addMeta(key: string, value: any): void {
      this.metadata[key] = value;
    },

    allow(): void {
      data.allow = true;
      data.blockReason = undefined;
    },

    block(reason: string): void {
      data.allow = false;
      data.blockReason = reason;
    },

    setArgument(key: string, value: any): void {
      data.arguments[key] = value;
    },

    getArgument(key: string): any {
      return data.arguments[key];
    },

    validate(validator: (data: OnToolCallData) => ToolValidationResult): ToolValidationResult {
      return validator(data);
    },

    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
      console[level](`[onToolCall] ${message}`);
    },

    async getToolSchema(): Promise<object | undefined> {
      // Would retrieve from tool registry
      return undefined;
    },

    async checkPermission(): Promise<boolean> {
      // Would check user permissions
      return true;
    }
  };
}

/**
 * Default onToolCall handler
 */
export async function defaultOnToolCallHandler(context: OnToolCallContext): Promise<void> {
  const { callId, toolName, arguments: args } = context.data;
  
  console.log(`[onToolCall] ${toolName} (${callId})`);
  
  // Log arguments (excluding sensitive data)
  const sanitizedArgs = { ...args };
  for (const key of Object.keys(sanitizedArgs)) {
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token')) {
      sanitizedArgs[key] = '***';
    }
  }
  
  console.log('Arguments:', sanitizedArgs);
  
  // Add metadata
  context.addMeta('loggedAt', new Date().toISOString());
}

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    />\s*\/dev\/null/,
    /mkfs\./,
    /dd\s+if=/,
    /:\(\)\{\s*:\|:\&\s*\};/, // Fork bomb
    /curl\s+.*\s*\|\s*sh/,
    /wget\s+.*\s*\|\s*sh/,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command));
}

export default onToolCallDefinition;
