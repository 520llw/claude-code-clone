/**
 * @fileoverview Settings Reset Command - /settings-reset
 * @module commands/settings/settings-reset
 * @description Reset settings to defaults.
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
 * Settings Reset Command Implementation
 * @class SettingsResetCommand
 * @extends Command
 * @description Resets settings to their default values.
 * 
 * @example
 * ```typescript
 * const cmd = new SettingsResetCommand();
 * const result = await cmd.run(context, {
 *   command: 'settings-reset',
 *   args: { key: 'editor.theme' },
 *   options: {},
 *   raw: '/settings-reset editor.theme'
 * });
 * ```
 */
export class SettingsResetCommand extends Command {
  constructor() {
    super({
      name: 'settings-reset',
      description: 'Reset settings to defaults',
      category: 'settings',
      aliases: ['sr', 'reset-settings', 'config-reset'],
      arguments: [
        {
          name: 'key',
          description: 'Setting key to reset (omit for all)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'f',
          long: 'force',
          description: 'Skip confirmation',
          type: 'boolean',
          default: false
        },
        {
          short: 'a',
          long: 'all',
          description: 'Reset all settings',
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
          description: 'Reset a setting',
          command: '/settings-reset editor.theme'
        },
        {
          description: 'Reset all settings',
          command: '/settings-reset --all'
        },
        {
          description: 'Force reset',
          command: '/settings-reset --all --force'
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
        force?: boolean;
        all?: boolean;
        json?: boolean;
      };

      const key = args.args.key as string | undefined;

      if (options.all || !key) {
        // Reset all settings
        if (!options.force) {
          const confirmed = await context.input.confirm(
            'Reset all settings to defaults? This cannot be undone.',
            false
          );
          if (!confirmed) {
            return CommandResultBuilder.failure('Reset cancelled');
          }
        }

        context.settings.resetAll();
        await context.settings.save();

        if (options.json) {
          return CommandResultBuilder.success({ reset: 'all' });
        }

        context.output.success('All settings reset to defaults');
        return CommandResultBuilder.success({ reset: 'all' });
      }

      // Reset specific setting
      context.settings.reset(key);
      await context.settings.save();

      if (options.json) {
        return CommandResultBuilder.success({ reset: key });
      }

      context.output.success(`Reset "${key}" to default`);
      return CommandResultBuilder.success({ reset: key });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to reset settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default SettingsResetCommand;
