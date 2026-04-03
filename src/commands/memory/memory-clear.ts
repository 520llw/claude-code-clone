/**
 * @fileoverview Memory Clear Command - /memory-clear
 * @module commands/memory/memory-clear
 * @description Clear all entries from the memory store.
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
 * Memory Clear Command Implementation
 * @class MemoryClearCommand
 * @extends Command
 * @description Clears all entries from the memory store with confirmation.
 * 
 * @example
 * ```typescript
 * const cmd = new MemoryClearCommand();
 * const result = await cmd.run(context, {
 *   command: 'memory-clear',
 *   args: {},
 *   options: { force: true },
 *   raw: '/memory-clear --force'
 * });
 * ```
 */
export class MemoryClearCommand extends Command {
  constructor() {
    super({
      name: 'memory-clear',
      description: 'Clear all entries from the memory store',
      category: 'memory',
      aliases: ['mc', 'mem-clear', 'clear-memory'],
      arguments: [
        {
          name: 'pattern',
          description: 'Pattern to match keys for selective clearing',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'f',
          long: 'force',
          description: 'Skip confirmation prompt',
          type: 'boolean',
          default: false
        },
        {
          short: 'd',
          long: 'dry-run',
          description: 'Show what would be deleted without deleting',
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
          description: 'Clear all memory (with confirmation)',
          command: '/memory-clear'
        },
        {
          description: 'Clear without confirmation',
          command: '/memory-clear --force'
        },
        {
          description: 'Clear keys matching pattern',
          command: '/memory-clear "temp.*" --force'
        },
        {
          description: 'Dry run',
          command: '/memory-clear --dry-run'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['memory-delete', 'memory-list', 'memory-write'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        force?: boolean;
        'dry-run'?: boolean;
        json?: boolean;
      };

      const pattern = args.args.pattern as string | undefined;

      // Get keys to delete
      let keys: string[];
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const allKeys = await context.memory.list();
        keys = allKeys.filter(k => regex.test(k));
      } else {
        keys = await context.memory.list();
      }

      if (keys.length === 0) {
        context.output.info('No memory entries to clear');
        return CommandResultBuilder.success({ cleared: 0 });
      }

      // Dry run
      if (options['dry-run']) {
        context.output.write(`\n\x1b[1mDry Run - Would delete:\x1b[0m\n`);
        for (const key of keys) {
          context.output.write(`  • ${key}\n`);
        }
        context.output.write(`\nTotal: ${keys.length} entries\n\n`);
        return CommandResultBuilder.success({ dryRun: true, wouldDelete: keys.length });
      }

      // Confirmation
      if (!options.force) {
        const confirmed = await context.input.confirm(
          pattern 
            ? `Delete ${keys.length} entries matching "${pattern}"?`
            : `Clear all ${keys.length} memory entries? This cannot be undone.`,
          false
        );
        if (!confirmed) {
          return CommandResultBuilder.failure('Clear cancelled');
        }
      }

      // Clear memory
      if (pattern) {
        for (const key of keys) {
          await context.memory.delete(key);
        }
      } else {
        await context.memory.clear();
      }

      if (options.json) {
        return CommandResultBuilder.success({
          cleared: keys.length,
          pattern: pattern || null
        });
      }

      context.output.success(`Cleared ${keys.length} memory entries`);

      return CommandResultBuilder.success({ cleared: keys.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default MemoryClearCommand;
