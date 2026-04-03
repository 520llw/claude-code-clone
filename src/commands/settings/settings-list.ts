/**
 * @fileoverview Settings List Command - /settings-list
 * @module commands/settings/settings-list
 * @description List all settings.
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
 * Settings List Command Implementation
 * @class SettingsListCommand
 * @extends Command
 * @description Lists all settings with optional filtering.
 * 
 * @example
 * ```typescript
 * const cmd = new SettingsListCommand();
 * const result = await cmd.run(context, {
 *   command: 'settings-list',
 *   args: {},
 *   options: { prefix: 'editor' },
 *   raw: '/settings-list --prefix=editor'
 * });
 * ```
 */
export class SettingsListCommand extends Command {
  constructor() {
    super({
      name: 'settings-list',
      description: 'List all settings',
      category: 'settings',
      aliases: ['sl', 'list-settings', 'config-list'],
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
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'List all settings',
          command: '/settings-list'
        },
        {
          description: 'List with prefix',
          command: '/settings-list editor'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['settings-get', 'settings-set', 'settings-reset'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        prefix?: string;
        json?: boolean;
      };

      const prefix = (args.args.prefix as string) || options.prefix;

      // Get all settings
      const settings = context.settings.list();

      // Filter by prefix
      let filteredSettings: Record<string, unknown> = settings;
      if (prefix) {
        filteredSettings = {};
        for (const [key, value] of Object.entries(settings)) {
          if (key.startsWith(prefix)) {
            filteredSettings[key] = value;
          }
        }
      }

      if (options.json) {
        return CommandResultBuilder.success({
          settings: filteredSettings,
          count: Object.keys(filteredSettings).length
        });
      }

      const keys = Object.keys(filteredSettings);

      if (keys.length === 0) {
        context.output.info(prefix 
          ? `No settings found with prefix "${prefix}"`
          : 'No settings found'
        );
        return CommandResultBuilder.success({ count: 0 });
      }

      context.output.write(`\n\x1b[1mSettings${prefix ? ` (prefix: ${prefix})` : ''}:\x1b[0m\n\n`);

      for (const key of keys.sort()) {
        const value = filteredSettings[key];
        context.output.write(`  \x1b[36m${key}\x1b[0m = `);
        if (typeof value === 'object') {
          context.output.json(value);
        } else {
          context.output.write(String(value));
        }
        context.output.write('\n');
      }

      context.output.write(`\nTotal: ${keys.length} setting(s)\n\n`);

      return CommandResultBuilder.success({ count: keys.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to list settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default SettingsListCommand;
