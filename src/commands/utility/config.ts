/**
 * @fileoverview Config Command - /config
 * @module commands/utility/config
 * @description Open or edit configuration.
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
 * Config Command Implementation
 * @class ConfigCommand
 * @extends Command
 * @description Opens or edits the application configuration.
 * 
 * @example
 * ```typescript
 * const cmd = new ConfigCommand();
 * const result = await cmd.run(context, {
 *   command: 'config',
 *   args: {},
 *   options: {},
 *   raw: '/config'
 * });
 * ```
 */
export class ConfigCommand extends Command {
  constructor() {
    super({
      name: 'config',
      description: 'Open or edit configuration',
      category: 'utility',
      aliases: ['cfg', 'configuration'],
      arguments: [],
      options: [
        {
          short: 'e',
          long: 'edit',
          description: 'Open config in editor',
          type: 'boolean',
          default: false
        },
        {
          short: 'p',
          long: 'path',
          description: 'Show config file path',
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
          description: 'Show config',
          command: '/config'
        },
        {
          description: 'Open config in editor',
          command: '/config --edit'
        },
        {
          description: 'Show config path',
          command: '/config --path'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['settings-get', 'settings-set', 'settings-list'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        edit?: boolean;
        path?: boolean;
        json?: boolean;
      };

      const configPath = `${context.cwd}/.claude-config.json`;
      const settings = context.settings.list();

      if (options.path) {
        context.output.write(`${configPath}\n`);
        return CommandResultBuilder.success({ path: configPath });
      }

      if (options.edit) {
        context.output.info(`Opening config at: ${configPath}`);
        // In real implementation, this would open the editor
        return CommandResultBuilder.success({ edit: true, path: configPath });
      }

      if (options.json) {
        return CommandResultBuilder.success({
          path: configPath,
          settings
        });
      }

      context.output.write('\n\x1b[1mConfiguration:\x1b[0m\n');
      context.output.write(`  Path: ${configPath}\n\n`);
      context.output.write('  Settings:\n');
      
      for (const [key, value] of Object.entries(settings)) {
        context.output.write(`    ${key}: ${JSON.stringify(value)}\n`);
      }

      context.output.write('\n');

      return CommandResultBuilder.success({ path: configPath });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Config failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default ConfigCommand;
