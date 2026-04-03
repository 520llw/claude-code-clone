/**
 * @fileoverview Memory Search Command - /memory-search
 * @module commands/memory/memory-search
 * @description Search for keys and values in the memory store.
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
 * Memory Search Command Implementation
 * @class MemorySearchCommand
 * @extends Command
 * @description Searches for keys and values in the memory store.
 * 
 * @example
 * ```typescript
 * const cmd = new MemorySearchCommand();
 * const result = await cmd.run(context, {
 *   command: 'memory-search',
 *   args: { query: 'user' },
 *   options: {},
 *   raw: '/memory-search user'
 * });
 * ```
 */
export class MemorySearchCommand extends Command {
  constructor() {
    super({
      name: 'memory-search',
      description: 'Search for keys and values in the memory store',
      category: 'memory',
      aliases: ['ms', 'mem-search', 'search'],
      arguments: [
        {
          name: 'query',
          description: 'Search query',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'k',
          long: 'keys-only',
          description: 'Search only in keys',
          type: 'boolean',
          default: false
        },
        {
          short: 'v',
          long: 'values-only',
          description: 'Search only in values',
          type: 'boolean',
          default: false
        },
        {
          short: 'c',
          long: 'case-sensitive',
          description: 'Case-sensitive search',
          type: 'boolean',
          default: false
        },
        {
          short: 'r',
          long: 'regex',
          description: 'Use regular expression',
          type: 'boolean',
          default: false
        },
        {
          short: 'l',
          long: 'limit',
          description: 'Maximum results to return',
          type: 'number',
          default: 50
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
          description: 'Search for user',
          command: '/memory-search user'
        },
        {
          description: 'Search keys only',
          command: '/memory-search config --keys-only'
        },
        {
          description: 'Regex search',
          command: '/memory-search "^app\\." --regex'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['memory-read', 'memory-list', 'memory-write'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        'keys-only'?: boolean;
        'values-only'?: boolean;
        'case-sensitive'?: boolean;
        regex?: boolean;
        limit?: number;
        json?: boolean;
      };

      const query = args.args.query as string;

      // Search memory
      const results = await context.memory.search(query);

      // Filter results
      let filtered = results;
      
      if (options.regex) {
        const regex = new RegExp(query, options['case-sensitive'] ? '' : 'i');
        filtered = results.filter(r => 
          (!options['values-only'] && regex.test(r.key)) ||
          (!options['keys-only'] && regex.test(String(r.value)))
        );
      } else {
        const searchTerm = options['case-sensitive'] ? query : query.toLowerCase();
        filtered = results.filter(r => {
          if (options['keys-only']) {
            const key = options['case-sensitive'] ? r.key : r.key.toLowerCase();
            return key.includes(searchTerm);
          }
          if (options['values-only']) {
            const value = options['case-sensitive'] ? String(r.value) : String(r.value).toLowerCase();
            return value.includes(searchTerm);
          }
          const key = options['case-sensitive'] ? r.key : r.key.toLowerCase();
          const value = options['case-sensitive'] ? String(r.value) : String(r.value).toLowerCase();
          return key.includes(searchTerm) || value.includes(searchTerm);
        });
      }

      // Apply limit
      filtered = filtered.slice(0, options.limit || 50);

      if (options.json) {
        return CommandResultBuilder.success({
          query,
          results: filtered,
          count: filtered.length,
          total: results.length
        });
      }

      // Display results
      if (filtered.length === 0) {
        context.output.info(`No results found for "${query}"`);
        return CommandResultBuilder.success({ count: 0 });
      }

      context.output.write(`\n\x1b[1mSearch Results for "${query}":\x1b[0m\n`);
      context.output.write(`Found ${filtered.length} of ${results.length} entries\n\n`);

      for (const entry of filtered) {
        context.output.write(`  \x1b[36m${entry.key}\x1b[0m\n`);
        if (typeof entry.value === 'object') {
          context.output.write(`    `);
          context.output.json(entry.value);
        } else {
          const valueStr = String(entry.value).substring(0, 100);
          context.output.write(`    ${valueStr}${String(entry.value).length > 100 ? '...' : ''}\n`);
        }
      }

      context.output.write('\n');

      return CommandResultBuilder.success({
        count: filtered.length,
        total: results.length
      });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default MemorySearchCommand;
