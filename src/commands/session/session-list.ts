/**
 * @fileoverview Session List Command - /session-list
 * @module commands/session/session-list
 * @description List all saved sessions.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Session List Command Implementation
 * @class SessionListCommand
 * @extends Command
 * @description Lists all saved sessions.
 * 
 * @example
 * ```typescript
 * const cmd = new SessionListCommand();
 * const result = await cmd.run(context, {
 *   command: 'session-list',
 *   args: {},
 *   options: {},
 *   raw: '/session-list'
 * });
 * ```
 */
export class SessionListCommand extends Command {
  constructor() {
    super({
      name: 'session-list',
      description: 'List all saved sessions',
      category: 'session',
      aliases: ['sls', 'list-sessions'],
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
          description: 'List all sessions',
          command: '/session-list'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['session-save', 'session-load', 'session-clear'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      const sessionsDir = resolve(context.cwd, '.claude-sessions');

      if (!existsSync(sessionsDir)) {
        if (options.json) {
          return CommandResultBuilder.success({ sessions: [], count: 0 });
        }
        context.output.info('No saved sessions found');
        return CommandResultBuilder.success({ count: 0 });
      }

      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

      const sessions = files.map(file => {
        const path = resolve(sessionsDir, file);
        const stats = statSync(path);
        
        let data: { savedAt?: string; name?: string } = {};
        try {
          data = JSON.parse(readFileSync(path, 'utf-8'));
        } catch {
          // Ignore parse errors
        }

        return {
          name: data.name || file.replace('.json', ''),
          file,
          path,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          savedAt: data.savedAt
        };
      });

      if (options.json) {
        return CommandResultBuilder.success({ sessions, count: sessions.length });
      }

      if (sessions.length === 0) {
        context.output.info('No saved sessions found');
        return CommandResultBuilder.success({ count: 0 });
      }

      context.output.write(`\n\x1b[1mSaved Sessions (${sessions.length}):\x1b[0m\n\n`);

      for (const session of sessions) {
        context.output.write(`  \x1b[36m${session.name}\x1b[0m\n`);
        context.output.write(`    Saved: ${session.savedAt || 'Unknown'}\n`);
        context.output.write(`    Modified: ${session.modifiedAt}\n`);
        context.output.write(`    Size: ${this.formatBytes(session.size)}\n\n`);
      }

      return CommandResultBuilder.success({ count: sessions.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `List failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export default SessionListCommand;
