/**
 * useCommands Hook
 *
 * Connects CommandParser and CommandRegistry to the UI.
 * Provides built-in slash commands and autocomplete.
 */

import { useCallback, useMemo } from 'react';
import type { SlashCommandDef } from '../components/input';

// ============================================================================
// Types
// ============================================================================

export interface CommandResult {
  success: boolean;
  output?: string;
  action?: CommandAction;
}

export type CommandAction =
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'toggle_tools' }
  | { type: 'switch_model'; model: string }
  | { type: 'switch_provider'; provider: string }
  | { type: 'compact' }
  | { type: 'show_help'; commands: SlashCommandDef[] }
  | { type: 'show_diff' }
  | { type: 'list_sessions' }
  | { type: 'show_status' }
  | { type: 'set_theme'; theme: string }
  | { type: 'debug_toggle' }
  | { type: 'message'; text: string };

interface CommandHandler {
  def: SlashCommandDef;
  execute: (args: string) => CommandResult;
}

interface UseCommandsOptions {
  onAction?: (action: CommandAction) => void;
  activeProvider?: string;
  activeModel?: string;
  messageCount?: number;
  tokenCount?: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useCommands(options: UseCommandsOptions = {}) {
  const { onAction, activeProvider, activeModel, messageCount = 0, tokenCount = 0 } = options;

  // Build command handlers
  const handlers = useMemo<Record<string, CommandHandler>>(() => {
    const commandMap: Record<string, CommandHandler> = {
    help: {
      def: { name: 'help', description: 'Show available commands' },
      execute: () => {
        const cmds = Object.values(commandMap).map((h: CommandHandler) => h.def);
        return { success: true, action: { type: 'show_help', commands: cmds } as CommandAction };
      },
    },
    clear: {
      def: { name: 'clear', description: 'Clear all messages' },
      execute: () => ({ success: true, action: { type: 'clear' } as CommandAction }),
    },
    exit: {
      def: { name: 'exit', description: 'Exit the application' },
      execute: () => ({ success: true, action: { type: 'exit' } as CommandAction }),
    },
    quit: {
      def: { name: 'quit', description: 'Exit the application' },
      execute: () => ({ success: true, action: { type: 'exit' } as CommandAction }),
    },
    model: {
      def: { name: 'model', description: 'Switch model', args: '<model-name>' },
      execute: (args) => {
        const model = args.trim();
        if (!model) {
          return {
            success: true,
            action: {
              type: 'message',
              text: `Current model: ${activeModel || 'unknown'}. Usage: /model <model-name>`,
            } as CommandAction,
          };
        }
        return { success: true, action: { type: 'switch_model', model } as CommandAction };
      },
    },
    provider: {
      def: { name: 'provider', description: 'Switch LLM provider', args: '<name>' },
      execute: (args) => {
        const provider = args.trim();
        if (!provider) {
          return {
            success: true,
            action: {
              type: 'message',
              text: `Current provider: ${activeProvider || 'unknown'}. Options: anthropic, openai, kimi, custom`,
            } as CommandAction,
          };
        }
        return { success: true, action: { type: 'switch_provider', provider } as CommandAction };
      },
    },
    compact: {
      def: { name: 'compact', description: 'Trigger context compression' },
      execute: () => ({ success: true, action: { type: 'compact' } as CommandAction }),
    },
    tools: {
      def: { name: 'tools', description: 'Toggle tool panel' },
      execute: () => ({ success: true, action: { type: 'toggle_tools' } as CommandAction }),
    },
    diff: {
      def: { name: 'diff', description: 'Show recent file changes' },
      execute: () => ({ success: true, action: { type: 'show_diff' } as CommandAction }),
    },
    session: {
      def: { name: 'session', description: 'Session management', args: 'list|save|load' },
      execute: (args) => {
        const sub = args.trim().toLowerCase();
        if (sub === 'list' || !sub) {
          return { success: true, action: { type: 'list_sessions' } as CommandAction };
        }
        return {
          success: true,
          action: { type: 'message', text: `Session command: ${sub}` } as CommandAction,
        };
      },
    },
    status: {
      def: { name: 'status', description: 'Show session status' },
      execute: () => {
        return {
          success: true,
          action: {
            type: 'message',
            text: `Provider: ${activeProvider} | Model: ${activeModel} | Messages: ${messageCount} | Tokens: ${tokenCount}`,
          } as CommandAction,
        };
      },
    },
    theme: {
      def: { name: 'theme', description: 'Switch UI theme', args: '<name>' },
      execute: (args) => {
        const theme = args.trim() || 'default';
        return { success: true, action: { type: 'set_theme', theme } as CommandAction };
      },
    },
    debug: {
      def: { name: 'debug', description: 'Toggle debug mode' },
      execute: () => ({ success: true, action: { type: 'debug_toggle' } as CommandAction }),
    },
  };
    return commandMap;
  }, [activeProvider, activeModel, messageCount, tokenCount]);

  // Get all command definitions for autocomplete
  const commandDefs = useMemo<SlashCommandDef[]>(
    () => Object.values(handlers).map(h => h.def),
    [handlers]
  );

  // Execute a slash command
  const executeCommand = useCallback((input: string): CommandResult | null => {
    if (!input.startsWith('/')) return null;

    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(' ');

    if (!cmdName) return null;

    const handler = handlers[cmdName];
    if (!handler) {
      // Find closest match
      const allNames = Object.keys(handlers);
      const closest = allNames.find(n => n.startsWith(cmdName));
      return {
        success: false,
        output: `Unknown command: /${cmdName}${closest ? `. Did you mean /${closest}?` : ''}`,
      };
    }

    const result = handler.execute(args);

    // Dispatch action
    if (result.action && onAction) {
      onAction(result.action);
    }

    return result;
  }, [handlers, onAction]);

  // Check if input is a slash command
  const isSlashCommand = useCallback((input: string): boolean => {
    return input.startsWith('/') && input.length > 1;
  }, []);

  return {
    commandDefs,
    executeCommand,
    isSlashCommand,
  };
}

export default useCommands;
