/**
 * @fileoverview Help Command - /help
 * @module commands/help/help
 * @description Show help information for commands.
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
 * Help Command Implementation
 * @class HelpCommand
 * @extends Command
 * @description Shows help information for commands or general help.
 * 
 * @example
 * ```typescript
 * const cmd = new HelpCommand();
 * const result = await cmd.run(context, {
 *   command: 'help',
 *   args: { command: 'git-status' },
 *   options: {},
 *   raw: '/help git-status'
 * });
 * ```
 */
export class HelpCommand extends Command {
  constructor() {
    super({
      name: 'help',
      description: 'Show help information for commands',
      category: 'help',
      aliases: ['h', '?'],
      arguments: [
        {
          name: 'command',
          description: 'Command to get help for',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'a',
          long: 'all',
          description: 'Show all commands including hidden ones',
          type: 'boolean',
          default: false
        },
        {
          short: 'c',
          long: 'category',
          description: 'Show commands in a specific category',
          type: 'string'
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
          description: 'Show general help',
          command: '/help'
        },
        {
          description: 'Get help for a command',
          command: '/help git-status'
        },
        {
          description: 'Show commands by category',
          command: '/help --category=git'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['help-tools', 'help-commands', 'help-shortcuts'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        all?: boolean;
        category?: string;
        json?: boolean;
      };

      const commandName = args.args.command as string | undefined;
      const registry = CommandRegistry.getInstance();

      // Get help for specific command
      if (commandName) {
        const command = registry.get(commandName);
        if (!command) {
          return CommandResultBuilder.failure(`Command "${commandName}" not found`);
        }

        const helpText = command.getHelp();
        context.output.write(helpText);
        return CommandResultBuilder.success({ command: commandName });
      }

      // Show commands by category
      if (options.category) {
        const commands = registry.getByCategory(options.category);
        
        if (commands.length === 0) {
          return CommandResultBuilder.failure(`No commands found in category "${options.category}"`);
        }

        context.output.write(`\n\x1b[1m${options.category.toUpperCase()} Commands:\x1b[0m\n\n`);
        
        for (const cmd of commands) {
          if (!options.all && cmd.isHidden()) continue;
          context.output.write(`  /${cmd.getName().padEnd(20)} ${cmd.getDescription()}\n`);
        }
        
        context.output.write('\n');
        return CommandResultBuilder.success({ category: options.category, count: commands.length });
      }

      // Show general help
      const helpText = registry.getHelp();
      context.output.write(helpText);

      context.output.write('\n\x1b[1m\x1b[36mGETTING STARTED\x1b[0m\n');
      context.output.write('  Type /help <command> for detailed help on a specific command.\n');
      context.output.write('  Use Tab for command completion.\n');
      context.output.write('  Press Ctrl+C to cancel current operation.\n\n');

      return CommandResultBuilder.success({});
    } catch (error) {
      return CommandResultBuilder.failure(
        `Help failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default HelpCommand;
