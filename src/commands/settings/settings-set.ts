/**
 * @fileoverview Settings Set Command - /settings-set
 * @module commands/settings/settings-set
 * @description Set a setting value.
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
 * Settings Set Command Implementation
 * @class SettingsSetCommand
 * @extends Command
 * @description Sets a setting value in the settings store.
 * 
 * @example
 * ```typescript
 * const cmd = new SettingsSetCommand();
 * const result = await cmd.run(context, {
 *   command: 'settings-set',
 *   args: { key: 'editor.theme', value: 'dark' },
 *   options: {},
 *   raw: '/settings-set editor.theme dark'
 * });
 * ```
 */
export class SettingsSetCommand extends Command {
  constructor() {
    super({
      name: 'settings-set',
      description: 'Set a setting value',
      category: 'settings',
      aliases: ['ss', 'set', 'config-set'],
      arguments: [
        {
          name: 'key',
          description: 'Setting key (dot notation supported)',
          required: true,
          type: 'string'
        },
        {
          name: 'value',
          description: 'Value to set',
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
          choices: ['string', 'number', 'boolean', 'json'],
          default: 'auto'
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
          description: 'Set a string value',
          command: '/settings-set editor.theme dark'
        },
        {
          description: 'Set a number',
          command: '/settings-set editor.fontSize 16 --type=number'
        },
        {
          description: 'Set a boolean',
          command: '/settings-set editor.wordWrap true --type=boolean'
        },
        {
          description: 'Set JSON',
          command: '/settings-set editor.rules \'{"maxLineLength": 120}\' --type=json'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['settings-get', 'settings-list', 'settings-reset'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        type?: string;
        json?: boolean;
      };

      const key = args.args.key as string;
      let value: unknown = args.args.value as string;

      // Parse value based on type
      value = this.parseValue(value as string, options.type || 'auto');

      // Set the value
      context.settings.set(key, value);

      // Save settings
      await context.settings.save();

      if (options.json) {
        return CommandResultBuilder.success({ key, value });
      }

      context.output.success(`Set "${key}"`);
      context.output.info(`Value: ${typeof value === 'object' ? JSON.stringify(value) : value}`);

      return CommandResultBuilder.success({ key, value });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to set setting: ${error instanceof Error ? error.message : String(error)}`
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

export default SettingsSetCommand;
