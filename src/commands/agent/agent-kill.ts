/**
 * @fileoverview Agent Kill Command - /agent-kill
 * @module commands/agent/agent-kill
 * @description Terminate an active agent.
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
 * Agent Kill Command Implementation
 * @class AgentKillCommand
 * @extends Command
 * @description Terminates an active agent by ID or name.
 * 
 * @example
 * ```typescript
 * const cmd = new AgentKillCommand();
 * const result = await cmd.run(context, {
 *   command: 'agent-kill',
 *   args: { agent: 'agent-123' },
 *   options: { force: true },
 *   raw: '/agent-kill agent-123 --force'
 * });
 * ```
 */
export class AgentKillCommand extends Command {
  constructor() {
    super({
      name: 'agent-kill',
      description: 'Terminate an active agent',
      category: 'agent',
      aliases: ['ak', 'kill-agent', 'agent-stop'],
      arguments: [
        {
          name: 'agent',
          description: 'Agent ID or name to kill',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'f',
          long: 'force',
          description: 'Force kill without confirmation',
          type: 'boolean',
          default: false
        },
        {
          short: 'a',
          long: 'all',
          description: 'Kill all agents',
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
          description: 'Kill agent by ID',
          command: '/agent-kill agent-123'
        },
        {
          description: 'Kill agent by name',
          command: '/agent-kill my-agent'
        },
        {
          description: 'Force kill',
          command: '/agent-kill agent-123 --force'
        },
        {
          description: 'Kill all agents',
          command: '/agent-kill --all'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['agent-spawn', 'agent-list', 'agent-status'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        force?: boolean;
        all?: boolean;
        json?: boolean;
      };

      const agentId = args.args.agent as string;

      if (options.all) {
        // Kill all agents
        const agents = context.agentManager.list();
        
        if (agents.length === 0) {
          context.output.info('No agents to kill');
          return CommandResultBuilder.success({ killed: 0 });
        }

        if (!options.force) {
          const confirmed = await context.input.confirm(
            `Kill all ${agents.length} agents?`,
            false
          );
          if (!confirmed) {
            return CommandResultBuilder.failure('Kill cancelled');
          }
        }

        let killed = 0;
        for (const agent of agents) {
          await agent.terminate();
          killed++;
        }

        if (options.json) {
          return CommandResultBuilder.success({ killed });
        }

        context.output.success(`Killed ${killed} agent(s)`);
        return CommandResultBuilder.success({ killed });
      }

      // Find agent
      let agent = context.agentManager.get(agentId);
      
      if (!agent) {
        // Try to find by name
        const agents = context.agentManager.list();
        agent = agents.find(a => a.name === agentId) || null;
      }

      if (!agent) {
        return CommandResultBuilder.failure(`Agent "${agentId}" not found`);
      }

      // Confirm if not forced
      if (!options.force) {
        const confirmed = await context.input.confirm(
          `Kill agent "${agent.name}" (${agent.id})?`,
          false
        );
        if (!confirmed) {
          return CommandResultBuilder.failure('Kill cancelled');
        }
      }

      // Terminate agent
      await agent.terminate();

      if (options.json) {
        return CommandResultBuilder.success({
          killed: 1,
          agentId: agent.id,
          name: agent.name
        });
      }

      context.output.success(`Killed agent "${agent.name}"`);
      return CommandResultBuilder.success({ killed: 1 });
    } catch (error) {
      return CommandResultBuilder.failure(
        `Failed to kill agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default AgentKillCommand;
