/**
 * @fileoverview Memory Read Command - /memory-read
 * @module commands/memory/memory-read
 * @description Read a value from the memory store.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Memory Read Command Implementation
 * @class MemoryReadCommand
 * @extends Command
 * @description Reads a value from the persistent memory store by key.
 * Supports various output formats and default values.
 * 
 * @example
 * ```typescript
 * const cmd = new MemoryReadCommand();
 * const result = await cmd.run(context, {
 *   command: 'memory-read',
 *   args: { key: 'user.preferences' },
 *   options: {},
 *   raw: '/memory-read user.preferences'
 * });
 * ```
 */
export class MemoryReadCommand extends Command {
  constructor() {
    super({
      name: 'memory-read',
      description: 'Read a value from the memory store',
      category: 'memory',
      aliases: ['mr', 'mem-read', 'read'],
      arguments: [
        {
          name: 'key',
          description: 'Key to read from memory',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'd',
          long: 'default',
          description: 'Default value if key not found',
          type: 'string'
        },
        {
          short: 't',
          long: 'type',
          description: 'Expected value type',
          type: 'string',
          choices: ['string', 'number', 'boolean', 'object', 'array'],
          default: 'string'
        },
        {
          short: 'r',
          long: 'raw',
          description: 'Output raw value without formatting',
          type: 'boolean',
          default: false
        },
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Read a value',
          command: '/memory-read user.name'
        },
        {
          description: 'Read with default',
          command: '/memory-read theme --default=dark'
        },
        {
          description: 'Read as JSON',
          command: '/memory-read config --json'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['memory-write', 'memory-search', 'memory-list'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        default?: string;
        type?: string;
        raw?: boolean;
        json?: boolean;
      };

      const key = args.args.key as string;

      // Read from memory
      const value = await context.memory.read(key);

      if (value === null) {
        if (options.default !== undefined) {
          if (options.json) {
            return CommandResultBuilder.success({
              key,
              value: options.default,
              defaultUsed: true
            });
          }
          context.output.info(`Key "${key}" not found, using default: ${options.default}`);
          return CommandResultBuilder.success({ key, value: options.default, defaultUsed: true });
        }

        return CommandResultBuilder.failure(`Key "${key}" not found in memory`);
      }

      // Convert type if needed
      let typedValue: unknown = value;
      if (options.type && options.type !== 'object') {
        typedValue = this.convertType(value, options.type);
      }

      if (options.json) {
        return CommandResultBuilder.success({
          key,
          value: typedValue,
          type: typeof typedValue
        });
      }

      if (options.raw) {
        context.output.write(String(typedValue));
      } else {
        context.output.write(`\x1b[36m${key}\x1b[0m = `);
        if (typeof typedValue === 'object') {
          context.output.json(typedValue);
        } else {
          context.output.write(String(typedValue));
        }
        context.output.write('\n');
      }

      return CommandResultBuilder.success({ key, value: typedValue });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to read memory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private convertType(value: unknown, type: string): unknown {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }
}

export default MemoryReadCommand;
