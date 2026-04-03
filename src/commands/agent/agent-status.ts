/**
 * @fileoverview Agent Status Command - /agent-status
 * @module commands/agent/agent-status
 * @description Show detailed status of an agent.
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
 * Agent Status Command Implementation
 * @class AgentStatusCommand
 * @extends Command
 * @description Shows detailed status of a specific agent or all agents.
 * 
 * @example
 * ```typescript
 * const cmd = new AgentStatusCommand();
 * const result = await cmd.run(context, {
 *   command: 'agent-status',
 *   args: { agent: 'agent-123' },
 *   options: {},
 *   raw: '/agent-status agent-123'
 * });
 * ```
 */
export class AgentStatusCommand extends Command {
  constructor() {
    super({
      name: 'agent-status',
      description: 'Show detailed status of an agent',
      category: 'agent',
      aliases: ['ast', 'agent-info'],
      arguments: [
        {
          name: 'agent',
          description: 'Agent ID or name (omit for all agents)',
          required: false,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'v',
          long: 'verbose',
          description: 'Show verbose information',
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
          description: 'Show all agent status',
          command: '/agent-status'
        },
        {
          description: 'Show specific agent status',
          command: '/agent-status agent-123'
        },
        {
          description: 'Verbose status',
          command: '/agent-status my-agent --verbose'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['agent-spawn', 'agent-list', 'agent-kill'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        verbose?: boolean;
        json?: boolean;
      };

      const agentId = args.args.agent as string | undefined;

      if (agentId) {
        // Show specific agent status
        let agent = context.agentManager.get(agentId);
        
        if (!agent) {
          // Try to find by name
          const agents = context.agentManager.list();
          agent = agents.find(a => a.name === agentId) || null;
        }

        if (!agent) {
          return CommandResultBuilder.failure(`Agent "${agentId}" not found`);
        }

        const status = agent.getStatus();

        if (options.json) {
          return CommandResultBuilder.success({
            id: agent.id,
            name: agent.name,
            ...status
          });
        }

        this.displayAgentStatus(context, agent.id, agent.name, status, options.verbose);

        return CommandResultBuilder.success({ agentId: agent.id });
      }

      // Show all agent status
      const agents = context.agentManager.list();

      if (agents.length === 0) {
        context.output.info('No active agents');
        return CommandResultBuilder.success({ count: 0 });
      }

      if (options.json) {
        const allStatus = agents.map(a => ({
          id: a.id,
          name: a.name,
          ...a.getStatus()
        }));

        return CommandResultBuilder.success({ agents: allStatus });
      }

      context.output.write(`\n\x1b[1mAgent Status (${agents.length}):\x1b[0m\n\n`);

      for (const agent of agents) {
        const status = agent.getStatus();
        this.displayAgentStatus(context, agent.id, agent.name, status, false);
      }

      return CommandResultBuilder.success({ count: agents.length });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private displayAgentStatus(
    context: CommandContext,
    id: string,
    name: string,
    status: {
      state: string;
      tasksCompleted: number;
      currentTask?: string;
      uptime: number;
    },
    verbose: boolean
  ): void {
    const stateColor = status.state === 'idle' ? '\x1b[32m' :
                      status.state === 'working' ? '\x1b[33m' :
                      status.state === 'error' ? '\x1b[31m' : '\x1b[90m';

    context.output.write(`  \x1b[36m${name}\x1b[0m\n`);
    context.output.write(`    ID: ${id}\n`);
    context.output.write(`    State: ${stateColor}${status.state}\x1b[0m\n`);
    context.output.write(`    Tasks Completed: ${status.tasksCompleted}\n`);
    context.output.write(`    Uptime: ${this.formatUptime(status.uptime)}\n`);

    if (verbose && status.currentTask) {
      context.output.write(`    Current Task: ${status.currentTask}\n`);
    }

    context.output.write('\n');
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }
}

export default AgentStatusCommand;
