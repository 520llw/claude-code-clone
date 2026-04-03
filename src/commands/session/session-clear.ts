/**
 * @fileoverview Session Clear Command - /session-clear
 * @module commands/session/session-clear
 * @description Clear saved sessions.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { readdirSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Session Clear Command Implementation
 * @class SessionClearCommand
 * @extends Command
 * @description Clears saved sessions.
 * 
 * @example
 * ```typescript
 * const cmd = new SessionClearCommand();
 * const result = await cmd.run(context, {
 *   command: 'session-clear',
 *   args: { name: 'my-session' },
 *   options: {},
 *   raw: '/session-clear my-session'
 * });
 * ```
 */
export class SessionClearCommand extends Command {
  constructor() {
    super({
      name: 'session-clear',
      description: 'Clear saved sessions',
      category: 'session',
      aliases: ['scl', 'clear-sessions'],
      arguments: [
        {
          name: 'name',
          description: 'Session name to clear (omit for all)',
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
          description: 'Clear all sessions',
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
          description: 'Clear specific session',
          command: '/session-clear my-session'
        },
        {
          description: 'Clear all sessions',
          command: '/session-clear --all'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['session-save', 'session-load', 'session-list'],
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

      const name = args.args.name as string | undefined;
      const sessionsDir = resolve(context.cwd, '.claude-sessions');

      if (!existsSync(sessionsDir)) {
        context.output.info('No sessions to clear');
        return CommandResultBuilder.success({ cleared: 0 });
      }

      if (options.all || !name) {
        // Clear all sessions
        const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

        if (files.length === 0) {
          context.output.info('No sessions to clear');
          return CommandResultBuilder.success({ cleared: 0 });
        }

        if (!options.force) {
          const confirmed = await context.input.confirm(
            `Clear all ${files.length} sessions? This cannot be undone.`,
            false
          );
          if (!confirmed) {
            return CommandResultBuilder.failure('Clear cancelled');
          }
        }

        for (const file of files) {
          unlinkSync(resolve(sessionsDir, file));
        }

        // Try to remove directory
        try {
          rmdirSync(sessionsDir);
        } catch {
          // Directory not empty or other error, ignore
        }

        if (options.json) {
          return CommandResultBuilder.success({ cleared: files.length });
        }

        context.output.success(`Cleared ${files.length} session(s)`);
        return CommandResultBuilder.success({ cleared: files.length });
      }

      // Clear specific session
      const sessionPath = resolve(sessionsDir, `${name}.json`);

      if (!existsSync(sessionPath)) {
        return CommandResultBuilder.failure(`Session "${name}" not found`);
      }

      if (!options.force) {
        const confirmed = await context.input.confirm(
          `Clear session "${name}"?`,
          false
        );
        if (!confirmed) {
          return CommandResultBuilder.failure('Clear cancelled');
        }
      }

      unlinkSync(sessionPath);

      if (options.json) {
        return CommandResultBuilder.success({ cleared: 1, name });
      }

      context.output.success(`Cleared session "${name}"`);
      return CommandResultBuilder.success({ cleared: 1 });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default SessionClearCommand;
