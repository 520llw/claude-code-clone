/**
 * @fileoverview Clear Command - /clear
 * @module commands/utility/clear
 * @description Clear the terminal screen.
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
 * Clear Command Implementation
 * @class ClearCommand
 * @extends Command
 * @description Clears the terminal screen.
 * 
 * @example
 * ```typescript
 * const cmd = new ClearCommand();
 * const result = await cmd.run(context, {
 *   command: 'clear',
 *   args: {},
 *   options: {},
 *   raw: '/clear'
 * });
 * ```
 */
export class ClearCommand extends Command {
  constructor() {
    super({
      name: 'clear',
      description: 'Clear the terminal screen',
      category: 'utility',
      aliases: ['cls', 'clean'],
      arguments: [],
      options: [],
      examples: [
        {
          description: 'Clear screen',
          command: '/clear'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['exit', 'version'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    context.output.clear();
    return CommandResultBuilder.success({ cleared: true });
  }
}

export default ClearCommand;
