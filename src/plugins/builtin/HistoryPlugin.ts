/**
 * HistoryPlugin.ts
 * 
 * Command History Plugin for Claude Code Clone
 * 
 * This plugin provides command history management including:
 * - Command history tracking
 * - History search and filtering
 * - Favorite commands
 * - History persistence
 * - Command suggestions
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, ConfigSchemaEntry } from '../Plugin';

/**
 * History entry
 */
export interface HistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  sessionId: string;
  success?: boolean;
  duration?: number;
  output?: string;
  tags?: string[];
  favorite?: boolean;
}

/**
 * History search options
 */
export interface HistorySearchOptions {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  favoritesOnly?: boolean;
  successfulOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * History statistics
 */
export interface HistoryStats {
  totalCommands: number;
  uniqueCommands: number;
  favoriteCommands: number;
  averageDuration: number;
  successRate: number;
  mostUsedCommands: Array<{ command: string; count: number }>;
}

/**
 * HistoryPlugin - Manages command history for Claude Code Clone.
 * 
 * This plugin tracks and manages command history, allowing users to
 * search, filter, and reuse previous commands.
 * 
 * @example
 * ```typescript
 * const historyPlugin = new HistoryPlugin();
 * await pluginManager.loadPlugin(historyPlugin);
 * 
 * // Search history
 * const results = historyPlugin.search({ query: 'git' });
 * ```
 */
export class HistoryPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.history',
    name: 'Command History',
    version: '1.0.0',
    description: 'Tracks and manages command history with search and favorites',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.UTILITY,
    keywords: ['history', 'commands', 'search', 'favorites'],
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'maxHistorySize',
      type: 'number',
      label: 'Maximum history size',
      description: 'Maximum number of commands to keep in history',
      default: 1000,
      min: 100,
      max: 10000,
      required: false
    },
    {
      key: 'persistHistory',
      type: 'boolean',
      label: 'Persist history',
      description: 'Save history to disk between sessions',
      default: true,
      required: false
    },
    {
      key: 'includeOutput',
      type: 'boolean',
      label: 'Include command output',
      description: 'Store command output in history',
      default: false,
      required: false
    },
    {
      key: 'deduplicate',
      type: 'boolean',
      label: 'Deduplicate commands',
      description: 'Remove duplicate consecutive commands',
      default: true,
      required: false
    },
    {
      key: 'suggestionsEnabled',
      type: 'boolean',
      label: 'Enable suggestions',
      description: 'Show command suggestions based on history',
      default: true,
      required: false
    },
    {
      key: 'suggestionCount',
      type: 'number',
      label: 'Suggestion count',
      description: 'Number of suggestions to show',
      default: 5,
      min: 1,
      max: 20,
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onCommand', 'onSessionStart'],
    providesCommands: ['history.search', 'history.get', 'history.clear', 'history.favorite']
  };

  /**
   * Command history
   */
  private history: HistoryEntry[] = [];

  /**
   * Current session ID
   */
  private sessionId: string = '';

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('HistoryPlugin activated');

    // Load persisted history
    if (this.context.config.persistHistory) {
      await this.loadHistory();
    }

    // Register hooks
    this.registerHook('onCommand', this.handleCommand.bind(this));
    this.registerHook('onSessionStart', this.handleSessionStart.bind(this));

    // Register commands
    this.registerCommand('history.search', this.search.bind(this));
    this.registerCommand('history.get', this.getHistory.bind(this));
    this.registerCommand('history.getRecent', this.getRecent.bind(this));
    this.registerCommand('history.clear', this.clearHistory.bind(this));
    this.registerCommand('history.favorite', this.favoriteCommand.bind(this));
    this.registerCommand('history.unfavorite', this.unfavoriteCommand.bind(this));
    this.registerCommand('history.getFavorites', this.getFavorites.bind(this));
    this.registerCommand('history.getStats', this.getStats.bind(this));
    this.registerCommand('history.suggest', this.getSuggestions.bind(this));
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('HistoryPlugin deactivated');

    // Save history
    if (this.context.config.persistHistory) {
      await this.saveHistory();
    }
  }

  /**
   * Handles session start.
   */
  private async handleSessionStart(context: any): Promise<void> {
    this.sessionId = context.data.sessionId;
  }

  /**
   * Handles command execution.
   */
  private async handleCommand(context: any): Promise<void> {
    const { command, commandId } = context.data;

    // Skip if deduplicating and same as last command
    if (this.context.config.deduplicate && this.history.length > 0) {
      const lastCommand = this.history[this.history.length - 1];
      if (lastCommand.command === command) {
        return;
      }
    }

    // Add to history
    const entry: HistoryEntry = {
      id: commandId,
      command,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    this.history.push(entry);

    // Trim history if needed
    const maxSize = this.context.config.maxHistorySize || 1000;
    if (this.history.length > maxSize) {
      this.history = this.history.slice(-maxSize);
    }

    this.logger.debug(`Added to history: ${command}`);
  }

  // ============================================================================
  // History Operations
  // ============================================================================

  /**
   * Adds a command to history.
   * 
   * @param command - Command string
   * @param options - Additional options
   * @returns History entry
   */
  public add(command: string, options: Partial<HistoryEntry> = {}): HistoryEntry {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      sessionId: this.sessionId,
      ...options
    };

    this.history.push(entry);

    // Trim if needed
    const maxSize = this.context.config.maxHistorySize || 1000;
    if (this.history.length > maxSize) {
      this.history = this.history.slice(-maxSize);
    }

    return entry;
  }

  /**
   * Searches command history.
   * 
   * @param options - Search options
   * @returns Filtered history entries
   */
  public search(options: HistorySearchOptions = {}): HistoryEntry[] {
    let results = [...this.history];

    // Filter by query
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(entry => 
        entry.command.toLowerCase().includes(query) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by date range
    if (options.startDate) {
      results = results.filter(entry => entry.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter(entry => entry.timestamp <= options.endDate!);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(entry => 
        options.tags!.some(tag => entry.tags?.includes(tag))
      );
    }

    // Filter favorites
    if (options.favoritesOnly) {
      results = results.filter(entry => entry.favorite);
    }

    // Filter by success
    if (options.successfulOnly) {
      results = results.filter(entry => entry.success !== false);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Gets all history entries.
   * 
   * @returns All history entries
   */
  public getHistory(): HistoryEntry[] {
    return [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Gets recent commands.
   * 
   * @param limit - Number of commands to return
   * @returns Recent commands
   */
  public getRecent(limit: number = 10): HistoryEntry[] {
    return this.getHistory().slice(0, limit);
  }

  /**
   * Clears command history.
   */
  public async clearHistory(): Promise<void> {
    this.history = [];
    
    if (this.context.config.persistHistory) {
      await this.storage.delete('commandHistory');
    }

    this.logger.info('History cleared');
    this.emit('historyCleared');
  }

  /**
   * Marks a command as favorite.
   * 
   * @param entryId - History entry ID
   */
  public async favoriteCommand(entryId: string): Promise<void> {
    const entry = this.history.find(e => e.id === entryId);
    if (entry) {
      entry.favorite = true;
      await this.saveHistory();
      this.logger.info(`Favorited command: ${entry.command}`);
    }
  }

  /**
   * Removes a command from favorites.
   * 
   * @param entryId - History entry ID
   */
  public async unfavoriteCommand(entryId: string): Promise<void> {
    const entry = this.history.find(e => e.id === entryId);
    if (entry) {
      entry.favorite = false;
      await this.saveHistory();
      this.logger.info(`Unfavorited command: ${entry.command}`);
    }
  }

  /**
   * Gets favorite commands.
   * 
   * @returns Favorite commands
   */
  public getFavorites(): HistoryEntry[] {
    return this.history
      .filter(entry => entry.favorite)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Gets command suggestions based on partial input.
   * 
   * @param partial - Partial command
   * @returns Suggested commands
   */
  public getSuggestions(partial: string): string[] {
    if (!this.context.config.suggestionsEnabled) {
      return [];
    }

    const partialLower = partial.toLowerCase();
    
    // Get unique commands that match
    const matches = new Map<string, number>();
    
    for (const entry of this.history) {
      if (entry.command.toLowerCase().includes(partialLower)) {
        const count = matches.get(entry.command) || 0;
        matches.set(entry.command, count + 1);
      }
    }

    // Sort by frequency and return top suggestions
    const sorted = Array.from(matches.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([command]) => command);

    const suggestionCount = this.context.config.suggestionCount || 5;
    return sorted.slice(0, suggestionCount);
  }

  /**
   * Gets history statistics.
   * 
   * @returns History statistics
   */
  public getStats(): HistoryStats {
    const totalCommands = this.history.length;
    
    // Count unique commands
    const uniqueCommands = new Set(this.history.map(e => e.command)).size;
    
    // Count favorites
    const favoriteCommands = this.history.filter(e => e.favorite).length;
    
    // Calculate average duration
    const entriesWithDuration = this.history.filter(e => e.duration !== undefined);
    const averageDuration = entriesWithDuration.length > 0
      ? entriesWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / entriesWithDuration.length
      : 0;
    
    // Calculate success rate
    const entriesWithSuccess = this.history.filter(e => e.success !== undefined);
    const successRate = entriesWithSuccess.length > 0
      ? entriesWithSuccess.filter(e => e.success).length / entriesWithSuccess.length
      : 1;

    // Most used commands
    const commandCounts = new Map<string, number>();
    for (const entry of this.history) {
      const count = commandCounts.get(entry.command) || 0;
      commandCounts.set(entry.command, count + 1);
    }
    
    const mostUsedCommands = Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));

    return {
      totalCommands,
      uniqueCommands,
      favoriteCommands,
      averageDuration,
      successRate,
      mostUsedCommands
    };
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Loads history from storage.
   */
  private async loadHistory(): Promise<void> {
    const stored = await this.storage.get<HistoryEntry[]>('commandHistory');
    
    if (stored) {
      // Convert date strings back to Date objects
      this.history = stored.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
      
      this.logger.info(`Loaded ${this.history.length} history entries`);
    }
  }

  /**
   * Saves history to storage.
   */
  private async saveHistory(): Promise<void> {
    await this.storage.set('commandHistory', this.history);
  }

  /**
   * Updates a history entry with execution results.
   * 
   * @param entryId - Entry ID
   * @param success - Whether command succeeded
   * @param duration - Execution duration
   * @param output - Command output
   */
  public updateEntry(
    entryId: string,
    updates: Partial<Pick<HistoryEntry, 'success' | 'duration' | 'output'>>
  ): void {
    const entry = this.history.find(e => e.id === entryId);
    if (entry) {
      Object.assign(entry, updates);
    }
  }
}

export default HistoryPlugin;
