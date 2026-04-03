/**
 * onCommand.ts
 * 
 * Command Executed Hook Implementation
 * 
 * This hook is triggered when a command is executed. It allows plugins
 * to validate, modify, or monitor command execution.
 * 
 * @module HookImplementations
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { HookDefinition, HookCategory, HookExecutionOrder, OnCommandData, HookContext } from '../types';

/**
 * onCommand hook definition
 */
export const onCommandDefinition: HookDefinition<OnCommandData> = {
  name: 'onCommand',
  description: 'Called when a command is executed. Plugins can validate, modify, or monitor commands.',
  category: HookCategory.COMMAND,
  executionOrder: HookExecutionOrder.SEQUENTIAL,
  cancellable: true,
  defaultTimeout: 30000,
  allowModification: true,
  stopOnError: false,
  stopOnSuccess: false,
  examples: [
    `// Log commands
plugin.registerHook('onCommand', async (context) => {
  const { command, args } = context.data;
  console.log(\`Executing: \${command} \${args.join(' ')}\`);
});`,
    `// Block dangerous commands
plugin.registerHook('onCommand', async (context) => {
  const { command } = context.data;
  
  if (isDangerous(command)) {
    context.block('Command is not allowed');
  }
});`,
    `// Add environment variables
plugin.registerHook('onCommand', async (context) => {
  context.addEnv('CUSTOM_VAR', 'value');
});`
  ],
  relatedHooks: ['onPermissionRequest'],
  schema: {
    input: {
      type: 'object',
      properties: {
        commandId: { type: 'string', description: 'Unique command ID' },
        command: { type: 'string', description: 'Command name' },
        args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'object', description: 'Environment variables' },
        timestamp: { type: 'string', format: 'date-time' },
        allow: { type: 'boolean', description: 'Whether to allow execution' },
        blockReason: { type: 'string', description: 'Reason for blocking' }
      },
      required: ['commandId', 'command', 'args', 'cwd', 'env', 'timestamp', 'allow']
    }
  }
};

/**
 * Command execution result
 */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * onCommand hook context
 */
export interface OnCommandContext extends HookContext<OnCommandData> {
  /** Allow the command */
  allow(): void;
  /** Block the command */
  block(reason: string): void;
  /** Add an argument */
  addArg(arg: string): void;
  /** Remove an argument */
  removeArg(index: number): void;
  /** Add environment variable */
  addEnv(key: string, value: string): void;
  /** Get environment variable */
  getEnv(key: string): string | undefined;
  /** Change working directory */
  setCwd(cwd: string): void;
  /** Execute the command and get result */
  execute(): Promise<CommandResult>;
  /** Validate the command */
  validate(): { valid: boolean; errors: string[] };
  /** Check if command is in allowed list */
  isAllowed(): boolean;
  /** Log the command */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

/**
 * Creates an onCommand hook context
 */
export function createOnCommandContext(
  data: OnCommandData,
  executionId: string
): OnCommandContext {
  return {
    hookName: 'onCommand',
    data,
    executionId,
    timestamp: new Date(),
    cancelled: false,
    metadata: {},

    get<K extends keyof OnCommandData>(key: K): OnCommandData[K] {
      return data[key];
    },

    set<K extends keyof OnCommandData>(key: K, value: OnCommandData[K]): void {
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

    addArg(arg: string): void {
      data.args.push(arg);
    },

    removeArg(index: number): void {
      data.args.splice(index, 1);
    },

    addEnv(key: string, value: string): void {
      data.env[key] = value;
    },

    getEnv(key: string): string | undefined {
      return data.env[key];
    },

    setCwd(cwd: string): void {
      data.cwd = cwd;
    },

    async execute(): Promise<CommandResult> {
      // Would execute the command
      return { exitCode: 0, stdout: '', stderr: '', duration: 0 };
    },

    validate(): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      
      if (!data.command) {
        errors.push('Command is required');
      }
      
      // Check for dangerous patterns
      const fullCommand = `${data.command} ${data.args.join(' ')}`;
      const dangerousPatterns = [
        /rm\s+-rf\s+\//,
        />\s*\/dev\/null/,
        /mkfs\./,
        /dd\s+if=/
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(fullCommand)) {
          errors.push(`Command matches dangerous pattern: ${pattern}`);
        }
      }
      
      return { valid: errors.length === 0, errors };
    },

    isAllowed(): boolean {
      // Would check against allowed commands list
      return true;
    },

    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
      console[level](`[onCommand] ${message}`);
    }
  };
}

/**
 * Default onCommand handler
 */
export async function defaultOnCommandHandler(context: OnCommandContext): Promise<void> {
  const { commandId, command, args, cwd } = context.data;
  
  console.log(`[onCommand] ${command} ${args.join(' ')}`);
  console.log(`  Working directory: ${cwd}`);
  
  // Validate command
  const validation = context.validate();
  if (!validation.valid) {
    console.warn('Command validation warnings:', validation.errors);
  }
  
  // Add metadata
  context.addMeta('validatedAt', new Date().toISOString());
  context.addMeta('validationErrors', validation.errors);
}

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(command: string): boolean {
  const dangerousCommands = [
    'rm -rf /',
    'mkfs',
    'dd if=',
    '>:',
    ':(){ :|:& };:'
  ];
  
  return dangerousCommands.some(dangerous => 
    command.toLowerCase().includes(dangerous.toLowerCase())
  );
}

export default onCommandDefinition;
