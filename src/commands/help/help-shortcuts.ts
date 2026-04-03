/**
 * @fileoverview Help Shortcuts Command - /help-shortcuts
 * @module commands/help/help-shortcuts
 * @description Show keyboard shortcuts.
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
 * Help Shortcuts Command Implementation
 * @class HelpShortcutsCommand
 * @extends Command
 * @description Shows available keyboard shortcuts.
 * 
 * @example
 * ```typescript
 * const cmd = new HelpShortcutsCommand();
 * const result = await cmd.run(context, {
 *   command: 'help-shortcuts',
 *   args: {},
 *   options: {},
 *   raw: '/help-shortcuts'
 * });
 * ```
 */
export class HelpShortcutsCommand extends Command {
  constructor() {
    super({
      name: 'help-shortcuts',
      description: 'Show keyboard shortcuts',
      category: 'help',
      aliases: ['hs', 'shortcuts', 'keys'],
      arguments: [],
      options: [
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Show keyboard shortcuts',
          command: '/help-shortcuts'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['help', 'help-tools', 'help-commands'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      const shortcuts = [
        { key: 'Tab', description: 'Autocomplete command or show suggestions' },
        { key: 'Ctrl+C', description: 'Cancel current operation' },
        { key: 'Ctrl+D', description: 'Exit application' },
        { key: 'Ctrl+L', description: 'Clear screen' },
        { key: '↑ / ↓', description: 'Navigate command history' },
        { key: 'Ctrl+R', description: 'Search command history' },
        { key: 'Ctrl+A', description: 'Move cursor to beginning of line' },
        { key: 'Ctrl+E', description: 'Move cursor to end of line' },
        { key: 'Ctrl+K', description: 'Clear from cursor to end of line' },
        { key: 'Ctrl+U', description: 'Clear from cursor to beginning of line' },
        { key: 'Esc', description: 'Cancel current input' }
      ];

      if (options.json) {
        return CommandResultBuilder.success({ shortcuts });
      }

      context.output.write('\n\x1b[1mKeyboard Shortcuts:\x1b[0m\n\n');

      for (const shortcut of shortcuts) {
        context.output.write(`  \x1b[36m${shortcut.key.padEnd(15)}\x1b[0m ${shortcut.description}\n`);
      }

      context.output.write('\n');

      return CommandResultBuilder.success({ count: shortcuts.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Help failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default HelpShortcutsCommand;
