/**
 * @fileoverview Help Commands Command - /help-commands
 * @module commands/help/help-commands
 * @description Show all available commands with descriptions.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import CommandRegistry from '../CommandRegistry';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Help Commands Command Implementation
 * @class HelpCommandsCommand
 * @extends Command
 * @description Shows all available commands organized by category.
 * 
 * @example
 * ```typescript
 * const cmd = new HelpCommandsCommand();
 * const result = await cmd.run(context, {
 *   command: 'help-commands',
 *   args: {},
 *   options: {},
 *   raw: '/help-commands'
 * });
 * ```
 */
export class HelpCommandsCommand extends Command {
  constructor() {
    super({
      name: 'help-commands',
      description: 'Show all available commands with descriptions',
      category: 'help',
      aliases: ['hc', 'commands'],
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
          description: 'Show all commands',
          command: '/help-commands'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['help', 'help-tools', 'help-shortcuts'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      const registry = CommandRegistry.getInstance();
      const categories = registry.getCategories();

      if (options.json) {
        const commandsByCategory: Record<string, Array<{
          name: string;
          description: string;
          aliases: string[];
        }>> = {};

        for (const category of categories) {
          const commands = registry.getByCategory(category);
          commandsByCategory[category] = commands.map(cmd => ({
            name: cmd.getName(),
            description: cmd.getDescription(),
            aliases: cmd.getAliases()
          }));
        }

        return CommandResultBuilder.success({ commands: commandsByCategory });
      }

      context.output.write('\n\x1b[1mAvailable Commands:\x1b[0m\n');

      for (const category of categories) {
        const commands = registry.getByCategory(category);
        if (commands.length === 0) continue;

        context.output.write(`\n\x1b[1m${category.toUpperCase()}\x1b[0m\n`);

        for (const cmd of commands) {
          if (cmd.isHidden()) continue;
          const aliases = cmd.getAliases().length > 0 
            ? ` (${cmd.getAliases().join(', ')})` 
            : '';
          context.output.write(`  /${cmd.getName().padEnd(20)} ${cmd.getDescription()}${aliases}\n`);
        }
      }

      context.output.write('\n');

      return CommandResultBuilder.success({ categories: categories.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Help failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default HelpCommandsCommand;
