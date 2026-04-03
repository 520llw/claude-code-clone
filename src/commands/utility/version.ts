/**
 * @fileoverview Version Command - /version
 * @module commands/utility/version
 * @description Show version information.
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
 * Version Command Implementation
 * @class VersionCommand
 * @extends Command
 * @description Shows version information for the application.
 * 
 * @example
 * ```typescript
 * const cmd = new VersionCommand();
 * const result = await cmd.run(context, {
 *   command: 'version',
 *   args: {},
 *   options: {},
 *   raw: '/version'
 * });
 * ```
 */
export class VersionCommand extends Command {
  constructor() {
    super({
      name: 'version',
      description: 'Show version information',
      category: 'utility',
      aliases: ['v', 'ver'],
      arguments: [],
      options: [
        {
          short: 'd',
          long: 'detailed',
          description: 'Show detailed version info',
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
          description: 'Show version',
          command: '/version'
        },
        {
          description: 'Show detailed version',
          command: '/version --detailed'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['clear', 'exit'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        detailed?: boolean;
        json?: boolean;
      };

      const versionInfo = {
        name: 'Claude Code Clone',
        version: '1.0.0',
        build: '2024.01.15',
        node: process.version,
        platform: process.platform,
        arch: process.arch
      };

      if (options.json) {
        return CommandResultBuilder.success(versionInfo);
      }

      context.output.write('\n');
      context.output.write(`\x1b[1m\x1b[36m${versionInfo.name}\x1b[0m\n`);
      context.output.write(`  Version: ${versionInfo.version}\n`);
      
      if (options.detailed) {
        context.output.write(`  Build: ${versionInfo.build}\n`);
        context.output.write(`  Node.js: ${versionInfo.node}\n`);
        context.output.write(`  Platform: ${versionInfo.platform}\n`);
        context.output.write(`  Architecture: ${versionInfo.arch}\n`);
      }

      context.output.write('\n');

      return CommandResultBuilder.success(versionInfo);
    } catch (error) {
      return CommandResultBuilder.failure(
        `Version check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default VersionCommand;
