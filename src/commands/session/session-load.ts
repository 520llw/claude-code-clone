/**
 * @fileoverview Session Load Command - /session-load
 * @module commands/session/session-load
 * @description Load a saved session state.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Session Load Command Implementation
 * @class SessionLoadCommand
 * @extends Command
 * @description Loads a saved session state from a file.
 * 
 * @example
 * ```typescript
 * const cmd = new SessionLoadCommand();
 * const result = await cmd.run(context, {
 *   command: 'session-load',
 *   args: { name: 'my-session' },
 *   options: {},
 *   raw: '/session-load my-session'
 * });
 * ```
 */
export class SessionLoadCommand extends Command {
  constructor() {
    super({
      name: 'session-load',
      description: 'Load a saved session state',
      category: 'session',
      aliases: ['sld', 'load-session'],
      arguments: [
        {
          name: 'name',
          description: 'Session name',
          required: false,
          type: 'string',
          default: 'default'
        }
      ],
      options: [
        {
          short: 'p',
          long: 'path',
          description: 'Custom load path',
          type: 'string'
        },
        {
          short: 'f',
          long: 'force',
          description: 'Skip confirmation',
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
          description: 'Load default session',
          command: '/session-load'
        },
        {
          description: 'Load named session',
          command: '/session-load project-work'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['session-save', 'session-list', 'session-clear'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        path?: string;
        force?: boolean;
        json?: boolean;
      };

      const name = (args.args.name as string) || 'default';
      
      // Determine load path
      const loadPath = options.path 
        ? resolve(options.path)
        : resolve(context.cwd, '.claude-sessions', `${name}.json`);

      // Check if exists
      if (!existsSync(loadPath)) {
        return CommandResultBuilder.failure(`Session "${name}" not found at ${loadPath}`);
      }

      // Confirm if not forced
      if (!options.force) {
        const confirmed = await context.input.confirm(
          `Load session "${name}"? This will replace current session data.`,
          false
        );
        if (!confirmed) {
          return CommandResultBuilder.failure('Load cancelled');
        }
      }

      // Load session
      const sessionData = JSON.parse(readFileSync(loadPath, 'utf-8'));

      // Restore memory
      if (sessionData.memory) {
        for (const [key, value] of Object.entries(sessionData.memory)) {
          await context.memory.write(key, value);
        }
      }

      // Restore settings
      if (sessionData.settings) {
        for (const [key, value] of Object.entries(sessionData.settings)) {
          context.settings.set(key, value);
        }
        await context.settings.save();
      }

      if (options.json) {
        return CommandResultBuilder.success({
          name,
          path: loadPath,
          loadedAt: new Date().toISOString(),
          savedAt: sessionData.savedAt
        });
      }

      context.output.success(`Session "${name}" loaded`);
      context.output.info(`Originally saved: ${sessionData.savedAt}`);

      return CommandResultBuilder.success({ name, path: loadPath });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Load failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default SessionLoadCommand;
