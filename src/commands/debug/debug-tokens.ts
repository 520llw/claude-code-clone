/**
 * @fileoverview Debug Tokens Command - /debug-tokens
 * @module commands/debug/debug-tokens
 * @description Show token usage information.
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
 * Debug Tokens Command Implementation
 * @class DebugTokensCommand
 * @extends Command
 * @description Shows token usage information for debugging.
 * 
 * @example
 * ```typescript
 * const cmd = new DebugTokensCommand();
 * const result = await cmd.run(context, {
 *   command: 'debug-tokens',
 *   args: {},
 *   options: {},
 *   raw: '/debug-tokens'
 * });
 * ```
 */
export class DebugTokensCommand extends Command {
  constructor() {
    super({
      name: 'debug-tokens',
      description: 'Show token usage information',
      category: 'debug',
      aliases: ['dt', 'tokens'],
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
          description: 'Show token usage',
          command: '/debug-tokens'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['debug-context', 'debug-tools', 'debug-log'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      // Simulated token usage - in real implementation, this would come from the model
      const tokenInfo = {
        promptTokens: 1250,
        completionTokens: 450,
        totalTokens: 1700,
        maxTokens: 4000,
        remainingTokens: 2300,
        usagePercent: 42.5
      };

      if (options.json) {
        return CommandResultBuilder.success(tokenInfo);
      }

      context.output.write('\n\x1b[1mToken Usage:\x1b[0m\n\n');
      context.output.write(`  Prompt Tokens:     ${tokenInfo.promptTokens}\n`);
      context.output.write(`  Completion Tokens: ${tokenInfo.completionTokens}\n`);
      context.output.write(`  Total Tokens:      ${tokenInfo.totalTokens}\n`);
      context.output.write(`  Max Tokens:        ${tokenInfo.maxTokens}\n`);
      context.output.write(`  Remaining:         ${tokenInfo.remainingTokens}\n`);
      context.output.write(`  Usage:             ${tokenInfo.usagePercent.toFixed(1)}%\n\n`);

      return CommandResultBuilder.success(tokenInfo);
    } catch (error) {
      return CommandResultBuilder.failure(
        `Debug failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default DebugTokensCommand;
