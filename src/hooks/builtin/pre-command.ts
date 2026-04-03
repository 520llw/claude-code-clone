/**
 * Pre-Command Hook
 * 
 * Built-in hook for executing actions before command execution.
 * Provides validation, logging, and transformation capabilities.
 */

import {
  PreCommandContext,
  PreCommandHook,
  PreCommandConfig,
  HookPriority,
  HookPhase,
  HookCondition,
  PreCommandHandler
} from '../types';
import { Command, CommandType } from '../../commands/types';

/**
 * Default configuration for pre-command hooks
 */
const DEFAULT_CONFIG: PreCommandConfig = {
  validateCommands: true,
  logCommands: true,
  enableTransformation: false,
  commandWhitelist: undefined,
  commandBlacklist: undefined
};

/**
 * Pre-Command Hook Implementation
 * 
 * Main class for pre-command hook functionality
 */
export class PreCommandHookImpl {
  private config: PreCommandConfig;

  constructor(config: Partial<PreCommandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main handler for pre-command hook
   */
  async handler(context: PreCommandContext): Promise<PreCommandContext> {
    const { command } = context;

    // Log command if enabled
    if (this.config.logCommands) {
      this.logCommand(command);
    }

    // Validate command if enabled
    if (this.config.validateCommands) {
      const validationResult = this.validateCommand(command);
      if (!validationResult.valid) {
        context.validationErrors.push(...validationResult.errors);
        context.cancel = true;
        context.cancelReason = `Command validation failed: ${validationResult.errors.join(', ')}`;
        return context;
      }
    }

    // Check whitelist/blacklist
    const listCheck = this.checkCommandLists(command);
    if (!listCheck.allowed) {
      context.cancel = true;
      context.cancelReason = listCheck.reason;
      return context;
    }

    // Apply transformation if enabled
    if (this.config.enableTransformation) {
      context.modifiedCommand = this.transformCommand(command);
    }

    return context;
  }

  /**
   * Log command details
   */
  private logCommand(command: Command): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PreCommand] Executing command: ${command.name}`);
    console.log(`  Type: ${command.type}`);
    console.log(`  Args: ${JSON.stringify(command.args)}`);
    if (command.options) {
      console.log(`  Options: ${JSON.stringify(command.options)}`);
    }
  }

  /**
   * Validate a command
   */
  private validateCommand(command: Command): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!command.name) {
      errors.push('Command name is required');
    }

    if (!command.type) {
      errors.push('Command type is required');
    }

    // Validate command type
    const validTypes = Object.values(CommandType);
    if (command.type && !validTypes.includes(command.type as CommandType)) {
      errors.push(`Invalid command type: ${command.type}`);
    }

    // Validate arguments
    if (command.args) {
      if (typeof command.args !== 'object') {
        errors.push('Command args must be an object');
      }
    }

    // Validate options
    if (command.options) {
      if (typeof command.options !== 'object') {
        errors.push('Command options must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check command against whitelist/blacklist
   */
  private checkCommandLists(command: Command): { allowed: boolean; reason?: string } {
    // Check whitelist first
    if (this.config.commandWhitelist && this.config.commandWhitelist.length > 0) {
      if (!this.config.commandWhitelist.includes(command.name)) {
        return {
          allowed: false,
          reason: `Command '${command.name}' is not in the whitelist`
        };
      }
    }

    // Check blacklist
    if (this.config.commandBlacklist && this.config.commandBlacklist.length > 0) {
      if (this.config.commandBlacklist.includes(command.name)) {
        return {
          allowed: false,
          reason: `Command '${command.name}' is in the blacklist`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Transform a command
   */
  private transformCommand(command: Command): Command {
    // Add default options
    const transformed: Command = {
      ...command,
      options: {
        timeout: 30000,
        retryCount: 0,
        ...command.options
      }
    };

    // Add metadata
    transformed.metadata = {
      ...transformed.metadata,
      transformedAt: new Date().toISOString(),
      transformVersion: '1.0.0'
    };

    return transformed;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PreCommandConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PreCommandConfig {
    return { ...this.config };
  }
}

/**
 * Create a pre-command hook
 */
export function createPreCommandHook(
  id: string,
  name: string,
  handler: PreCommandHandler,
  config?: Partial<PreCommandConfig>
): PreCommandHook {
  const impl = new PreCommandHookImpl(config);
  
  return {
    id,
    name,
    type: 'pre-command',
    description: 'Hook executed before command execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler: async (context: PreCommandContext): Promise<PreCommandContext> => {
      // Run built-in handler first
      const modifiedContext = await impl.handler(context);
      
      // Run custom handler
      if (!modifiedContext.cancel) {
        return handler(modifiedContext);
      }
      
      return modifiedContext;
    },
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['pre-command', 'builtin'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a command validator hook
 */
export function createPreCommandValidator(
  customValidators?: Array<(command: Command) => { valid: boolean; error?: string }>
): PreCommandHook {
  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    const { command } = context;

    // Run custom validators
    if (customValidators) {
      for (const validator of customValidators) {
        const result = validator(command);
        if (!result.valid) {
          context.validationErrors.push(result.error || 'Validation failed');
          context.cancel = true;
          context.cancelReason = result.error;
          break;
        }
      }
    }

    return context;
  };

  return {
    id: 'pre-command-validator',
    name: 'Pre-Command Validator',
    type: 'pre-command',
    description: 'Validates commands before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    conditions: [
      {
        type: 'command',
        value: '*'
      }
    ],
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['validator', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a command logger hook
 */
export function createPreCommandLogger(
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
  logArgs: boolean = true
): PreCommandHook {
  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    const { command } = context;
    const timestamp = new Date().toISOString();

    const logMessage = `[${timestamp}] [PreCommand] ${command.name}`;
    const logData = logArgs ? { args: command.args, options: command.options } : {};

    switch (logLevel) {
      case 'debug':
        console.debug(logMessage, logData);
        break;
      case 'info':
        console.info(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'error':
        console.error(logMessage, logData);
        break;
    }

    return context;
  };

  return {
    id: 'pre-command-logger',
    name: 'Pre-Command Logger',
    type: 'pre-command',
    description: 'Logs commands before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.CRITICAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['logger', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a command transformer hook
 */
export function createPreCommandTransformer(
  transformFn: (command: Command) => Command
): PreCommandHook {
  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    try {
      context.modifiedCommand = transformFn(context.command);
    } catch (error) {
      context.validationErrors.push(`Transform failed: ${error}`);
      context.cancel = true;
      context.cancelReason = `Command transformation failed: ${error}`;
    }
    return context;
  };

  return {
    id: 'pre-command-transformer',
    name: 'Pre-Command Transformer',
    type: 'pre-command',
    description: 'Transforms commands before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.NORMAL,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['transformer', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a permission check hook
 */
export function createPreCommandPermissionCheck(
  permissionChecker: (command: Command, context: PreCommandContext) => boolean | Promise<boolean>,
  errorMessage: string = 'Permission denied'
): PreCommandHook {
  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    const hasPermission = await permissionChecker(context.command, context);
    
    if (!hasPermission) {
      context.cancel = true;
      context.cancelReason = errorMessage;
    }

    return context;
  };

  return {
    id: 'pre-command-permission-check',
    name: 'Pre-Command Permission Check',
    type: 'pre-command',
    description: 'Checks permissions before command execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['permission', 'security', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a rate limiter hook
 */
export function createPreCommandRateLimiter(
  maxRequests: number,
  windowMs: number
): PreCommandHook {
  const requests: Map<string, number[]> = new Map();

  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    const commandId = context.command.name;
    const now = Date.now();

    // Get or initialize request history
    let history = requests.get(commandId) || [];
    
    // Remove old requests outside the window
    history = history.filter(time => now - time < windowMs);
    
    // Check if limit exceeded
    if (history.length >= maxRequests) {
      context.cancel = true;
      context.cancelReason = `Rate limit exceeded: ${maxRequests} requests per ${windowMs}ms`;
      return context;
    }

    // Add current request
    history.push(now);
    requests.set(commandId, history);

    return context;
  };

  return {
    id: 'pre-command-rate-limiter',
    name: 'Pre-Command Rate Limiter',
    type: 'pre-command',
    description: 'Rate limits command execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.HIGH,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['rate-limiter', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}

/**
 * Create a command audit hook
 */
export function createPreCommandAudit(
  auditFn: (command: Command, context: PreCommandContext) => void | Promise<void>
): PreCommandHook {
  const handler: PreCommandHandler = async (context: PreCommandContext): Promise<PreCommandContext> => {
    try {
      await auditFn(context.command, context);
    } catch (error) {
      // Log audit failure but don't block execution
      console.warn('Audit failed:', error);
    }
    return context;
  };

  return {
    id: 'pre-command-audit',
    name: 'Pre-Command Audit',
    type: 'pre-command',
    description: 'Audits commands before execution',
    phase: HookPhase.BEFORE,
    priority: HookPriority.LOW,
    enabled: true,
    handler,
    retryable: false,
    maxRetries: 0,
    meta: {
      version: '1.0.0',
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['audit', 'pre-command'],
      dependencies: [],
      dependents: []
    }
  };
}
