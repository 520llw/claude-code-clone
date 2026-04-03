/**
 * @fileoverview Session Save Command - /session-save
 * @module commands/session/session-save
 * @description Save the current session state.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Session Save Command Implementation
 * @class SessionSaveCommand
 * @extends Command
 * @description Saves the current session state to a file.
 * 
 * @example
 * ```typescript
 * const cmd = new SessionSaveCommand();
 * const result = await cmd.run(context, {
 *   command: 'session-save',
 *   args: { name: 'my-session' },
 *   options: {},
 *   raw: '/session-save my-session'
 * });
 * ```
 */
export class SessionSaveCommand extends Command {
  constructor() {
    super({
      name: 'session-save',
      description: 'Save the current session state',
      category: 'session',
      aliases: ['ssv', 'save-session'],
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
          short: 'f',
          long: 'force',
          description: 'Overwrite existing session',
          type: 'boolean',
          default: false
        },
        {
          short: 'p',
          long: 'path',
          description: 'Custom save path',
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
          description: 'Save session',
          command: '/session-save'
        },
        {
          description: 'Save with name',
          command: '/session-save project-work'
        },
        {
          description: 'Force overwrite',
          command: '/session-save my-session --force'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['session-load', 'session-list', 'session-clear'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        force?: boolean;
        path?: string;
        json?: boolean;
      };

      const name = (args.args.name as string) || 'default';
      
      // Determine save path
      const savePath = options.path 
        ? resolve(options.path)
        : resolve(context.cwd, '.claude-sessions', `${name}.json`);

      // Check if exists
      if (existsSync(savePath) && !options.force) {
        const overwrite = await context.input.confirm(
          `Session "${name}" already exists. Overwrite?`,
          false
        );
        if (!overwrite) {
          return CommandResultBuilder.failure('Save cancelled');
        }
      }

      // Create session data
      const sessionData = {
        name,
        savedAt: new Date().toISOString(),
        cwd: context.cwd,
        env: context.env,
        memory: await this.getMemoryData(context),
        settings: context.settings.list()
      };

      // Ensure directory exists
      const dir = dirname(savePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Save session
      writeFileSync(savePath, JSON.stringify(sessionData, null, 2));

      if (options.json) {
        return CommandResultBuilder.success({
          name,
          path: savePath,
          savedAt: sessionData.savedAt
        });
      }

      context.output.success(`Session "${name}" saved`);
      context.output.info(`Path: ${savePath}`);

      return CommandResultBuilder.success({ name, path: savePath });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getMemoryData(context: CommandContext): Promise<Record<string, unknown>> {
    const keys = await context.memory.list();
    const data: Record<string, unknown> = {};
    
    for (const key of keys) {
      data[key] = await context.memory.read(key);
    }
    
    return data;
  }
}

export default SessionSaveCommand;
