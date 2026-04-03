/**
 * Built-in Plugins Index
 * 
 * Exports all built-in plugins for the plugin system.
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

// Export GitPlugin
export { GitPlugin, GitStatus, GitCommit, GitBranch, GitDiff } from './GitPlugin';

// Export GitHubPlugin
export { GitHubPlugin, GitHubRepo, GitHubIssue, GitHubPR, GitHubWorkflow } from './GitHubPlugin';

// Export TelemetryPlugin
export { TelemetryPlugin, TelemetryEvent, UsageMetrics, PerformanceMetrics } from './TelemetryPlugin';

// Export ThemePlugin
export { ThemePlugin, Theme, ThemeColors, SyntaxColors } from './ThemePlugin';

// Export HistoryPlugin
export { HistoryPlugin, HistoryEntry, HistorySearchOptions, HistoryStats } from './HistoryPlugin';

// Export AliasPlugin
export { AliasPlugin, Alias, AliasParameter, AliasExpansion } from './AliasPlugin';

// Export all built-in plugins as array
import { GitPlugin } from './GitPlugin';
import { GitHubPlugin } from './GitHubPlugin';
import { TelemetryPlugin } from './TelemetryPlugin';
import { ThemePlugin } from './ThemePlugin';
import { HistoryPlugin } from './HistoryPlugin';
import { AliasPlugin } from './AliasPlugin';

/**
 * All built-in plugin constructors
 */
export const builtInPlugins = [
  GitPlugin,
  GitHubPlugin,
  TelemetryPlugin,
  ThemePlugin,
  HistoryPlugin,
  AliasPlugin
];

export default builtInPlugins;
