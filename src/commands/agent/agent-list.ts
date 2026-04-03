/**
 * @fileoverview Agent List Command - /agent-list
 * @module commands/agent/agent-list
 * @description List all active agents.
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
 * Agent List Command Implementation
 * @class AgentListCommand
 * @extends Command
 * @description Lists all active agents with their status and information.
 * 
 * @example
 * ```typescript
 * const cmd = new AgentListCommand();
 * const result = await cmd.run(context, {
 *   command: 'agent-list',
 *   args: {},
 *   options: {},
 *   raw: '/agent-list'
 * });
 * ```
 */
export class AgentListCommand extends Command {
  constructor() {
    super({
      name: 'agent-list',
      description: 'List all active agents',
      category: 'agent',
      aliases: ['al', 'agents', 'list-agents'],
      arguments: [],
      options: [
        {
          short: 'v',
          long: 'verbose',
          description: 'Show detailed agent information',
          type: 'boolean',
          default: false
        },
        {
          short: 's',
          long: 'state',
          description: 'Filter by agent state',
          type: 'string',
          choices: ['idle', 'working', 'error', 'terminated']
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
          description: 'List all agents',
          command: '/agent-list'
        },
        {
          description: 'Verbose listing',
          command: '/agent-list --verbose'
        },
        {
          description: 'Filter by state',
          command: '/agent-list --state=working'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['agent-spawn', 'agent-kill', 'agent-status'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        verbose?: boolean;
        state?: string;
        json?: boolean;
      };

      // Get all agents
      let agents = context.agentManager.list();

      // Filter by state
      if (options.state) {
        agents = agents.filter(a => a.getStatus().state === options.state);
      }

      if (options.json) {
        const agentData = agents.map(a => {
          const status = a.getStatus();
          return {
            id: a.id,
            name: a.name,
            state: status.state,
            tasksCompleted: status.tasksCompleted,
            currentTask: status.currentTask,
            uptime: status.uptime
          };
        });

        return CommandResultBuilder.success({
          agents: agentData,
          count: agents.length
        });
      }

      // Display
      if (agents.length === 0) {
        context.output.info('No active agents');
        return CommandResultBuilder.success({ count: 0 });
      }

      context.output.write(`\n\x1b[1mActive Agents (${agents.length}):\x1b[0m\n\n`);

      for (const agent of agents) {
        const status = agent.getStatus();
        const stateColor = status.state === 'idle' ? '\x1b[32m' :
                          status.state === 'working' ? '\x1b[33m' :
                          status.state === 'error' ? '\x1b[31m' : '\x1b[90m';

        context.output.write(`  \x1b[36m${agent.name}\x1b[0m (${agent.id})\n`);
        context.output.write(`    State: ${stateColor}${status.state}\x1b[0m\n`);
        context.output.write(`    Tasks: ${status.tasksCompleted}\n`);
        context.output.write(`    Uptime: ${this.formatUptime(status.uptime)}\n`);

        if (options.verbose && status.currentTask) {
          context.output.write(`    Current: ${status.currentTask}\n`);
        }

        context.output.write('\n');
      }

      return CommandResultBuilder.success({ count: agents.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export default AgentListCommand;
