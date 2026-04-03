/**
 * @fileoverview Commands Index
 * @module commands/index
 * @description Exports all slash commands for the Claude Code Clone.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

// Base infrastructure
export { default as Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult, 
  CommandResultBuilder,
  CommandMetadata,
  CommandArgument,
  CommandOption,
  CommandExample,
  CommandPermissions,
  OutputInterface,
  InputInterface,
  MemoryInterface,
  AgentManagerInterface,
  AgentConfig,
  AgentHandle,
  AgentStatus,
  SettingsInterface,
  MemoryEntry,
  GitInfo,
  ProjectConfig,
  SpinnerHandle,
  ProgressBarHandle,
  ProgressBarOptions,
  TableData
} from './Command';

export { default as CommandRegistry } from './CommandRegistry';
export { default as CommandParser } from './CommandParser';

// Git Workflow Commands
export { GitStatusCommand } from './git/git-status';
export { GitDiffCommand } from './git/git-diff';
export { GitLogCommand } from './git/git-log';
export { GitBranchCommand } from './git/git-branch';
export { GitCommitCommand } from './git/git-commit';
export { GitPushCommand } from './git/git-push';
export { GitPullCommand } from './git/git-pull';
export { GitCheckoutCommand } from './git/git-checkout';
export { GitStashCommand } from './git/git-stash';
export { GitMergeCommand } from './git/git-merge';

// Code Review Commands
export { ReviewFileCommand } from './review/review-file';
export { ReviewPRCommand } from './review/review-pr';
export { ReviewChangesCommand } from './review/review-changes';
export { ReviewLastCommitCommand } from './review/review-last-commit';

// Memory Commands
export { MemoryReadCommand } from './memory/memory-read';
export { MemoryWriteCommand } from './memory/memory-write';
export { MemorySearchCommand } from './memory/memory-search';
export { MemoryClearCommand } from './memory/memory-clear';
export { MemoryListCommand } from './memory/memory-list';

// Agent Commands
export { AgentSpawnCommand } from './agent/agent-spawn';
export { AgentListCommand } from './agent/agent-list';
export { AgentKillCommand } from './agent/agent-kill';
export { AgentStatusCommand } from './agent/agent-status';

// Settings Commands
export { SettingsGetCommand } from './settings/settings-get';
export { SettingsSetCommand } from './settings/settings-set';
export { SettingsListCommand } from './settings/settings-list';
export { SettingsResetCommand } from './settings/settings-reset';

// Help Commands
export { HelpCommand } from './help/help';
export { HelpToolsCommand } from './help/help-tools';
export { HelpCommandsCommand } from './help/help-commands';
export { HelpShortcutsCommand } from './help/help-shortcuts';

// Session Commands
export { SessionSaveCommand } from './session/session-save';
export { SessionLoadCommand } from './session/session-load';
export { SessionListCommand } from './session/session-list';
export { SessionClearCommand } from './session/session-clear';

// Debug Commands
export { DebugContextCommand } from './debug/debug-context';
export { DebugTokensCommand } from './debug/debug-tokens';
export { DebugToolsCommand } from './debug/debug-tools';
export { DebugLogCommand } from './debug/debug-log';

// Utility Commands
export { ClearCommand } from './utility/clear';
export { ExitCommand } from './utility/exit';
export { VersionCommand } from './utility/version';
export { ConfigCommand } from './utility/config';

/**
 * Register all commands with the registry
 * @param registry - CommandRegistry instance
 */
import CommandRegistryClass from './CommandRegistry';

export function registerAllCommands(registry: typeof CommandRegistryClass): void {
  const instance = registry.getInstance();
  
  // Git Commands
  instance.register(new (require('./git/git-status').GitStatusCommand)());
  instance.register(new (require('./git/git-diff').GitDiffCommand)());
  instance.register(new (require('./git/git-log').GitLogCommand)());
  instance.register(new (require('./git/git-branch').GitBranchCommand)());
  instance.register(new (require('./git/git-commit').GitCommitCommand)());
  instance.register(new (require('./git/git-push').GitPushCommand)());
  instance.register(new (require('./git/git-pull').GitPullCommand)());
  instance.register(new (require('./git/git-checkout').GitCheckoutCommand)());
  instance.register(new (require('./git/git-stash').GitStashCommand)());
  instance.register(new (require('./git/git-merge').GitMergeCommand)());
  
  // Review Commands
  instance.register(new (require('./review/review-file').ReviewFileCommand)());
  instance.register(new (require('./review/review-pr').ReviewPRCommand)());
  instance.register(new (require('./review/review-changes').ReviewChangesCommand)());
  instance.register(new (require('./review/review-last-commit').ReviewLastCommitCommand)());
  
  // Memory Commands
  instance.register(new (require('./memory/memory-read').MemoryReadCommand)());
  instance.register(new (require('./memory/memory-write').MemoryWriteCommand)());
  instance.register(new (require('./memory/memory-search').MemorySearchCommand)());
  instance.register(new (require('./memory/memory-clear').MemoryClearCommand)());
  instance.register(new (require('./memory/memory-list').MemoryListCommand)());
  
  // Agent Commands
  instance.register(new (require('./agent/agent-spawn').AgentSpawnCommand)());
  instance.register(new (require('./agent/agent-list').AgentListCommand)());
  instance.register(new (require('./agent/agent-kill').AgentKillCommand)());
  instance.register(new (require('./agent/agent-status').AgentStatusCommand)());
  
  // Settings Commands
  instance.register(new (require('./settings/settings-get').SettingsGetCommand)());
  instance.register(new (require('./settings/settings-set').SettingsSetCommand)());
  instance.register(new (require('./settings/settings-list').SettingsListCommand)());
  instance.register(new (require('./settings/settings-reset').SettingsResetCommand)());
  
  // Help Commands
  instance.register(new (require('./help/help').HelpCommand)());
  instance.register(new (require('./help/help-tools').HelpToolsCommand)());
  instance.register(new (require('./help/help-commands').HelpCommandsCommand)());
  instance.register(new (require('./help/help-shortcuts').HelpShortcutsCommand)());
  
  // Session Commands
  instance.register(new (require('./session/session-save').SessionSaveCommand)());
  instance.register(new (require('./session/session-load').SessionLoadCommand)());
  instance.register(new (require('./session/session-list').SessionListCommand)());
  instance.register(new (require('./session/session-clear').SessionClearCommand)());
  
  // Debug Commands
  instance.register(new (require('./debug/debug-context').DebugContextCommand)());
  instance.register(new (require('./debug/debug-tokens').DebugTokensCommand)());
  instance.register(new (require('./debug/debug-tools').DebugToolsCommand)());
  instance.register(new (require('./debug/debug-log').DebugLogCommand)());
  
  // Utility Commands
  instance.register(new (require('./utility/clear').ClearCommand)());
  instance.register(new (require('./utility/exit').ExitCommand)());
  instance.register(new (require('./utility/version').VersionCommand)());
  instance.register(new (require('./utility/config').ConfigCommand)());
}

export default {
  registerAllCommands
};
