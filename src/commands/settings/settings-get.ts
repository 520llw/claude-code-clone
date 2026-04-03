/**
 * @fileoverview Settings Get Command - /settings-get
 * @module commands/settings/settings-get
 * @description Get a setting value.
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
 * Settings Get Command Implementation
 * @class SettingsGetCommand
 * @extends Command
 * @description Gets a setting value from the settings store.
 * 
 * @example
 * ```typescript
 * const cmd = new SettingsGetCommand();
 * const result = await cmd.run(context, {
 *   command: 'settings-get',
 *   args: { key: 'editor.theme' },
 *   options: {},
 *   raw: '/settings-get editor.theme'
 * });
 * ```
 */
export class SettingsGetCommand extends Command {
  constructor() {
    super({
      name: 'settings-get',
      description: 'Get a setting value',
      category: 'settings',
      aliases: ['sg', 'get', 'config-get'],
      arguments: [
        {
          name: 'key',
          description: 'Setting key (dot notation supported)',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'd',
          long: 'default',
          description: 'Default value if setting not found',
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
          description: 'Get a setting',
          command: '/settings-get editor.theme'
        },
        {
          description: 'Get with default',
          command: '/settings-get editor.fontSize --default=14'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['settings-set', 'settings-list', 'settings-reset'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        default?: string;
        json?: boolean;
      };

      const key = args.args.key as string;

      // Get setting value
      let value: unknown;
      if (options.default !== undefined) {
        value = context.settings.get(key, options.default);
      } else {
        value = context.settings.get(key);
      }

      if (value === undefined) {
        return CommandResultBuilder.failure(`Setting "${key}" not found`);
      }

      if (options.json) {
        return CommandResultBuilder.success({ key, value });
      }

      context.output.write(`\x1b[36m${key}\x1b[0m = `);
      if (typeof value === 'object') {
        context.output.json(value);
      } else {
        context.output.write(String(value));
      }
      context.output.write('\n');

      return CommandResultBuilder.success({ key, value });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to get setting: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default SettingsGetCommand;
