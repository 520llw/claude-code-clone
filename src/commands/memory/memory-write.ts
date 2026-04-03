/**
 * @fileoverview Memory Write Command - /memory-write
 * @module commands/memory/memory-write
 * @description Write a value to the memory store.
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
 * Memory Write Command Implementation
 * @class MemoryWriteCommand
 * @extends Command
 * @description Writes a value to the persistent memory store by key.
 * Supports various value types and validation.
 * 
 * @example
 * ```typescript
 * const cmd = new MemoryWriteCommand();
 * const result = await cmd.run(context, {
 *   command: 'memory-write',
 *   args: { key: 'user.name', value: 'John' },
 *   options: {},
 *   raw: '/memory-write user.name John'
 * });
 * ```
 */
export class MemoryWriteCommand extends Command {
  constructor() {
    super({
      name: 'memory-write',
      description: 'Write a value to the memory store',
      category: 'memory',
      aliases: ['mw', 'mem-write', 'write'],
      arguments: [
        {
          name: 'key',
          description: 'Key to write to memory',
          required: true,
          type: 'string'
        },
        {
          name: 'value',
          description: 'Value to store',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 't',
          long: 'type',
          description: 'Value type',
          type: 'string',
          choices: ['string', 'number', 'boolean', 'json', 'auto'],
          default: 'auto'
        },
        {
          short: 'f',
          long: 'force',
          description: 'Overwrite existing value without confirmation',
          type: 'boolean',
          default: false
        },
        {
          short: 'e',
          long: 'expire',
          description: 'Expiration time in seconds',
          type: 'number'
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
          description: 'Write a string value',
          command: '/memory-write user.name "John Doe"'
        },
        {
          description: 'Write a number',
          command: '/memory-write counter 42 --type=number'
        },
        {
          description: 'Write JSON',
          command: '/memory-write config \'{"theme":"dark"}\' --type=json'
        },
        {
          description: 'Write with expiration',
          command: '/memory-write temp.value "hello" --expire=3600'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['memory-read', 'memory-delete', 'memory-list'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        type?: string;
        force?: boolean;
        expire?: number;
        json?: boolean;
      };

      const key = args.args.key as string;
      let value: unknown = args.args.value as string;

      // Check if key exists
      const existing = await context.memory.read(key);
      if (existing !== null && !options.force) {
        const overwrite = await context.input.confirm(
          `Key "${key}" already exists. Overwrite?`,
          false
        );
        if (!overwrite) {
          return CommandResultBuilder.failure('Write cancelled');
        }
      }

      // Parse value based on type
      value = this.parseValue(value as string, options.type || 'auto');

      // Write to memory
      await context.memory.write(key, value);

      if (options.json) {
        return CommandResultBuilder.success({
          key,
          value,
          type: typeof value,
          overwritten: existing !== null
        });
      }

      context.output.success(`Stored "${key}"`);
      if (typeof value === 'object') {
        context.output.json(value);
      } else {
        context.output.info(`Value: ${value}`);
      }

      return CommandResultBuilder.success({ key, value });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to write memory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Cannot parse "${value}" as number`);
        return num;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'json':
        return JSON.parse(value);
      case 'auto':
        // Try to auto-detect type
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (!isNaN(Number(value)) && value !== '') return Number(value);
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}

export default MemoryWriteCommand;
