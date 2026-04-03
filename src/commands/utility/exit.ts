/**
 * @fileoverview Exit Command - /exit
 * @module commands/utility/exit
 * @description Exit the application.
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
 * Exit Command Implementation
 * @class ExitCommand
 * @extends Command
 * @description Exits the application.
 * 
 * @example
 * ```typescript
 * const cmd = new ExitCommand();
 * const result = await cmd.run(context, {
 *   command: 'exit',
 *   args: {},
 *   options: {},
 *   raw: '/exit'
 * });
 * ```
 */
export class ExitCommand extends Command {
  constructor() {
    super({
      name: 'exit',
      description: 'Exit the application',
      category: 'utility',
      aliases: ['quit', 'q', 'bye'],
      arguments: [],
      options: [
        {
          short: 'c',
          long: 'code',
          description: 'Exit code',
          type: 'number',
          default: 0
        },
        {
          short: 'f',
          long: 'force',
          description: 'Force exit without confirmation',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Exit application',
          command: '/exit'
        },
        {
          description: 'Exit with error code',
          command: '/exit --code=1'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['clear', 'version'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    const options = args.options as {
      code?: number;
      force?: boolean;
    };

    if (!options.force) {
      const confirmed = await context.input.confirm('Are you sure you want to exit?', true);
      if (!confirmed) {
        return CommandResultBuilder.success({ cancelled: true });
      }
    }

    const exitCode = options.code || 0;
    context.output.info('Goodbye!');

    // In a real implementation, this would trigger application exit
    process.exit(exitCode);

    return CommandResultBuilder.success({ exitCode });
  }
}

export default ExitCommand;
