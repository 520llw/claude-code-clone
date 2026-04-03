/**
 * @fileoverview Help Tools Command - /help-tools
 * @module commands/help/help-tools
 * @description Show information about available tools.
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
 * Help Tools Command Implementation
 * @class HelpToolsCommand
 * @extends Command
 * @description Shows information about available tools and their usage.
 * 
 * @example
 * ```typescript
 * const cmd = new HelpToolsCommand();
 * const result = await cmd.run(context, {
 *   command: 'help-tools',
 *   args: {},
 *   options: {},
 *   raw: '/help-tools'
 * });
 * ```
 */
export class HelpToolsCommand extends Command {
  constructor() {
    super({
      name: 'help-tools',
      description: 'Show information about available tools',
      category: 'help',
      aliases: ['ht', 'tools'],
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
          description: 'Show tools help',
          command: '/help-tools'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['help', 'help-commands', 'help-shortcuts'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        json?: boolean;
      };

      const tools = [
        {
          name: 'File Operations',
          description: 'Read, write, and manage files',
          examples: ['Read file content', 'Write to files', 'List directory contents']
        },
        {
          name: 'Shell Execution',
          description: 'Execute shell commands',
          examples: ['Run git commands', 'Execute build scripts', 'Check system info']
        },
        {
          name: 'Web Search',
          description: 'Search the web for information',
          examples: ['Find documentation', 'Research topics', 'Look up error messages']
        },
        {
          name: 'Code Analysis',
          description: 'Analyze code for issues and improvements',
          examples: ['Review code quality', 'Find bugs', 'Suggest optimizations']
        },
        {
          name: 'Memory',
          description: 'Store and retrieve information',
          examples: ['Save preferences', 'Remember context', 'Store temporary data']
        },
        {
          name: 'Agents',
          description: 'Spawn and manage sub-agents',
          examples: ['Parallel processing', 'Background tasks', 'Specialized workers']
        }
      ];

      if (options.json) {
        return CommandResultBuilder.success({ tools });
      }

      context.output.write('\n\x1b[1mAvailable Tools:\x1b[0m\n\n');

      for (const tool of tools) {
        context.output.write(`  \x1b[36m${tool.name}\x1b[0m\n`);
        context.output.write(`    ${tool.description}\n`);
        context.output.write(`    Examples: ${tool.examples.join(', ')}\n\n`);
      }

      context.output.write('Use these tools through slash commands or by asking naturally.\n\n');

      return CommandResultBuilder.success({ count: tools.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Help failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default HelpToolsCommand;
