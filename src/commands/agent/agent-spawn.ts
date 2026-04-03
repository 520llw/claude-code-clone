/**
 * @fileoverview Agent Spawn Command - /agent-spawn
 * @module commands/agent/agent-spawn
 * @description Spawn a new sub-agent for parallel task execution.
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
 * Agent Spawn Command Implementation
 * @class AgentSpawnCommand
 * @extends Command
 * @description Spawns a new sub-agent for parallel task execution.
 * 
 * @example
 * ```typescript
 * const cmd = new AgentSpawnCommand();
 * const result = await cmd.run(context, {
 *   command: 'agent-spawn',
 *   args: { task: 'Analyze codebase' },
 *   options: { name: 'analyzer' },
 *   raw: '/agent-spawn "Analyze codebase" --name=analyzer'
 * });
 * ```
 */
export class AgentSpawnCommand extends Command {
  constructor() {
    super({
      name: 'agent-spawn',
      description: 'Spawn a new sub-agent for parallel task execution',
      category: 'agent',
      aliases: ['as', 'spawn', 'agent-create'],
      arguments: [
        {
          name: 'task',
          description: 'Initial task or instructions for the agent',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'n',
          long: 'name',
          description: 'Agent name',
          type: 'string'
        },
        {
          short: 'r',
          long: 'role',
          description: 'Agent role (e.g., coder, reviewer, researcher)',
          type: 'string',
          choices: ['coder', 'reviewer', 'researcher', 'debugger', 'general'],
          default: 'general'
        },
        {
          short: 'm',
          long: 'model',
          description: 'Model to use for the agent',
          type: 'string',
          default: 'default'
        },
        {
          short: 't',
          long: 'max-tokens',
          description: 'Maximum tokens for responses',
          type: 'number',
          default: 4000
        },
        {
          short: 'c',
          long: 'cwd',
          description: 'Working directory for the agent',
          type: 'string'
        },
        {
          long: 'timeout',
          description: 'Timeout in seconds',
          type: 'number'
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
          description: 'Spawn a coder agent',
          command: '/agent-spawn "Refactor auth module" --role=coder --name=refactorer'
        },
        {
          description: 'Spawn a reviewer agent',
          command: '/agent-spawn "Review PR #42" --role=reviewer'
        },
        {
          description: 'Spawn with custom model',
          command: '/agent-spawn "Research API options" --model=gpt-4'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['agent-list', 'agent-kill', 'agent-status'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        name?: string;
        role?: string;
        model?: string;
        'max-tokens'?: number;
        cwd?: string;
        timeout?: number;
        json?: boolean;
      };

      const task = args.args.task as string;

      // Generate agent name if not provided
      const agentName = options.name || `agent-${Date.now()}`;

      // Create agent config
      const config = {
        name: agentName,
        role: options.role || 'general',
        instructions: task,
        cwd: options.cwd || context.cwd,
        maxTokens: options['max-tokens'] || 4000,
        model: options.model || 'default'
      };

      // Spawn agent
      const agent = await context.agentManager.spawn(config);

      // Send initial task
      const response = await agent.send(task);

      if (options.json) {
        return CommandResultBuilder.success({
          agentId: agent.id,
          name: agentName,
          role: config.role,
          initialResponse: response
        });
      }

      context.output.success(`Spawned agent "${agentName}" (${agent.id})`);
      context.output.info(`Role: ${config.role}`);
      context.output.write(`\n\x1b[1mInitial Response:\x1b[0m\n`);
      context.output.write(response);
      context.output.write('\n');

      return CommandResultBuilder.success({
        agentId: agent.id,
        name: agentName
      });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default AgentSpawnCommand;
