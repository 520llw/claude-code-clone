/**
 * @fileoverview Debug Context Command - /debug-context
 * @module commands/debug/debug-context
 * @description Show current context information.
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
 * Debug Context Command Implementation
 * @class DebugContextCommand
 * @extends Command
 * @description Shows current context information for debugging.
 * 
 * @example
 * ```typescript
 * const cmd = new DebugContextCommand();
 * const result = await cmd.run(context, {
 *   command: 'debug-context',
 *   args: {},
 *   options: {},
 *   raw: '/debug-context'
 * });
 * ```
 */
export class DebugContextCommand extends Command {
  constructor() {
    super({
      name: 'debug-context',
      description: 'Show current context information',
      category: 'debug',
      aliases: ['dc', 'context'],
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
          description: 'Show context',
          command: '/debug-context'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['debug-tokens', 'debug-tools', 'debug-log'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      const contextInfo = {
        cwd: context.cwd,
        userId: context.userId,
        sessionId: context.sessionId,
        env: Object.keys(context.env),
        gitInfo: context.gitInfo,
        projectConfig: context.projectConfig
      };

      if (options.json) {
        return CommandResultBuilder.success(contextInfo);
      }

      context.output.write('\n\x1b[1mContext Information:\x1b[0m\n\n');
      context.output.write(`  \x1b[36mCWD:\x1b[0m ${contextInfo.cwd}\n`);
      context.output.write(`  \x1b[36mUser ID:\x1b[0m ${contextInfo.userId}\n`);
      context.output.write(`  \x1b[36mSession ID:\x1b[0m ${contextInfo.sessionId}\n`);
      context.output.write(`  \x1b[36mEnvironment Variables:\x1b[0m ${contextInfo.env.length}\n`);
      
      if (contextInfo.gitInfo) {
        context.output.write(`\n  \x1b[36mGit Info:\x1b[0m\n`);
        context.output.write(`    Repository: ${contextInfo.gitInfo.isRepo ? 'Yes' : 'No'}\n`);
        context.output.write(`    Branch: ${contextInfo.gitInfo.branch}\n`);
        context.output.write(`    Clean: ${contextInfo.gitInfo.isClean ? 'Yes' : 'No'}\n`);
      }

      if (contextInfo.projectConfig) {
        context.output.write(`\n  \x1b[36mProject Config:\x1b[0m\n`);
        context.output.write(`    Name: ${contextInfo.projectConfig.name}\n`);
        context.output.write(`    Root: ${contextInfo.projectConfig.root}\n`);
      }

      context.output.write('\n');

      return CommandResultBuilder.success(contextInfo);
    } catch (error) {
      return CommandResultBuilder.failure(
        `Debug failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default DebugContextCommand;
