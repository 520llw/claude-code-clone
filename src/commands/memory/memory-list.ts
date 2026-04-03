/**
 * @fileoverview Memory List Command - /memory-list
 * @module commands/memory/memory-list
 * @description List all keys in the memory store.
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
 * Memory List Command Implementation
 * @class MemoryListCommand
 * @extends Command
 * @description Lists all keys in the memory store with optional filtering.
 * 
 * @example
 * ```typescript
 * const cmd = new MemoryListCommand();
 * const result = await cmd.run(context, {
 *   command: 'memory-list',
 *   args: {},
 *   options: { prefix: 'user' },
 *   raw: '/memory-list --prefix=user'
 * });
 * ```
 */
export class MemoryListCommand extends Command {
  constructor() {
    super({
      name: 'memory-list',
      description: 'List all keys in the memory store',
      category: 'memory',
      aliases: ['ml', 'mem-list', 'list-memory'],
      arguments: [
        {
          name: 'prefix',
          description: 'Filter by key prefix',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'p',
          long: 'prefix',
          description: 'Filter by key prefix',
          type: 'string'
        },
        {
          short: 's',
          long: 'show-values',
          description: 'Show values alongside keys',
          type: 'boolean',
          default: false
        },
        {
          short: 'l',
          long: 'limit',
          description: 'Maximum entries to show',
          type: 'number',
          default: 100
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
          description: 'List all keys',
          command: '/memory-list'
        },
        {
          description: 'List with prefix',
          command: '/memory-list user'
        },
        {
          description: 'Show values',
          command: '/memory-list --show-values'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['memory-read', 'memory-search', 'memory-write'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        prefix?: string;
        'show-values'?: boolean;
        limit?: number;
        json?: boolean;
      };

      const prefix = (args.args.prefix as string) || options.prefix;

      // Get all keys
      let keys = await context.memory.list();

      // Filter by prefix
      if (prefix) {
        keys = keys.filter(k => k.startsWith(prefix));
      }

      const total = keys.length;

      // Apply limit
      keys = keys.slice(0, options.limit || 100);

      if (options.json) {
        const entries = options['show-values'] 
          ? await Promise.all(keys.map(async k => ({
              key: k,
              value: await context.memory.read(k)
            })))
          : keys.map(k => ({ key: k }));
        
        return CommandResultBuilder.success({
          entries,
          total,
          shown: keys.length
        });
      }

      // Display
      if (keys.length === 0) {
        context.output.info(prefix 
          ? `No keys found with prefix "${prefix}"`
          : 'No memory entries found'
        );
        return CommandResultBuilder.success({ count: 0 });
      }

      context.output.write(`\n\x1b[1mMemory Keys${prefix ? ` (prefix: ${prefix})` : ''}:\x1b[0m\n`);
      context.output.write(`Showing ${keys.length} of ${total} entries\n\n`);

      if (options['show-values']) {
        for (const key of keys) {
          const value = await context.memory.read(key);
          context.output.write(`  \x1b[36m${key}\x1b[0m\n`);
          if (typeof value === 'object') {
            context.output.write(`    `);
            context.output.json(value);
          } else {
            const valueStr = String(value).substring(0, 80);
            context.output.write(`    ${valueStr}${String(value).length > 80 ? '...' : ''}\n`);
          }
        }
      } else {
        for (const key of keys) {
          context.output.write(`  • ${key}\n`);
        }
      }

      context.output.write('\n');

      return CommandResultBuilder.success({
        count: keys.length,
        total
      });
    } catch (error) {
      return CommandResultBuilder.failure(
        `List failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default MemoryListCommand;
