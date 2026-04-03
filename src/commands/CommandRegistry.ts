/**
 * @fileoverview Command Registry for Claude Code Clone
 * @module commands/CommandRegistry
 * @description Central registry for all slash commands. Manages command registration,
 * lookup, categorization, and discovery. Implements singleton pattern for global access.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import Command, { CommandMetadata, CommandResult } from './Command';

/**
 * Registered command entry
 * @interface RegisteredCommand
 */
interface RegisteredCommand {
  /** Command instance */
  command: Command;
  /** Registration timestamp */
  registeredAt: Date;
  /** Registration source */
  source: string;
}

/**
 * Command search options
 * @interface SearchOptions
 */
interface SearchOptions {
  /** Filter by category */
  category?: string;
  /** Include hidden commands */
  includeHidden?: boolean;
  /** Include deprecated commands */
  includeDeprecated?: boolean;
  /** Search in description */
  searchDescription?: boolean;
  /** Maximum results */
  limit?: number;
}

/**
 * Command statistics
 * @interface CommandStats
 */
interface CommandStats {
  /** Total commands registered */
  totalCommands: number;
  /** Commands by category */
  commandsByCategory: Record<string, number>;
  /** Hidden commands count */
  hiddenCommands: number;
  /** Deprecated commands count */
  deprecatedCommands: number;
  /** Total aliases */
  totalAliases: number;
}

/**
 * Command registry event types
 * @type CommandRegistryEvent
 */
type CommandRegistryEvent = 
  | 'commandRegistered' 
  | 'commandUnregistered' 
  | 'registryCleared'
  | 'commandExecuted';

/**
 * Command registry event callback
 * @type CommandRegistryEventCallback
 */
type CommandRegistryEventCallback = (data: unknown) => void;

/**
 * Singleton command registry for managing all slash commands
 * @class CommandRegistry
 * @description Central registry that manages all commands in the system.
 * Provides registration, lookup, search, and categorization capabilities.
 * 
 * @example
 * ```typescript
 * const registry = CommandRegistry.getInstance();
 * registry.register(new GitStatusCommand());
 * const command = registry.get('git-status');
 * ```
 */
export class CommandRegistry {
  /** Singleton instance */
  private static instance: CommandRegistry;
  
  /** Map of command names to registered commands */
  private commands: Map<string, RegisteredCommand> = new Map();
  
  /** Map of aliases to command names */
  private aliases: Map<string, string> = new Map();
  
  /** Event listeners */
  private eventListeners: Map<CommandRegistryEvent, CommandRegistryEventCallback[]> = new Map();
  
  /** Command execution history */
  private executionHistory: Array<{
    commandName: string;
    timestamp: Date;
    success: boolean;
    duration: number;
  }> = [];
  
  /** Maximum history entries */
  private maxHistorySize = 1000;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.initializeEventListeners();
  }

  /**
   * Initialize event listener collections
   * @private
   */
  private initializeEventListeners(): void {
    this.eventListeners.set('commandRegistered', []);
    this.eventListeners.set('commandUnregistered', []);
    this.eventListeners.set('registryCleared', []);
    this.eventListeners.set('commandExecuted', []);
  }

  /**
   * Get the singleton instance
   * @static
   * @returns CommandRegistry instance
   */
  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  /**
   * Register a command
   * @param command - Command instance to register
   * @param source - Source of registration (e.g., 'plugin:git')
   * @returns Whether registration was successful
   * @throws Error if command with same name already exists
   */
  public register(command: Command, source: string = 'core'): boolean {
    const name = command.getName();
    
    // Check for duplicate registration
    if (this.commands.has(name)) {
      throw new Error(`Command "${name}" is already registered`);
    }

    // Register the command
    this.commands.set(name, {
      command,
      registeredAt: new Date(),
      source
    });

    // Register aliases
    for (const alias of command.getAliases()) {
      if (this.aliases.has(alias)) {
        console.warn(`Alias "${alias}" for command "${name}" conflicts with existing alias`);
      } else {
        this.aliases.set(alias, name);
      }
    }

    // Emit event
    this.emit('commandRegistered', { command: name, source, aliases: command.getAliases() });
    
    return true;
  }

  /**
   * Unregister a command
   * @param name - Command name to unregister
   * @returns Whether unregistration was successful
   */
  public unregister(name: string): boolean {
    const registered = this.commands.get(name);
    if (!registered) {
      return false;
    }

    // Remove command
    this.commands.delete(name);

    // Remove aliases
    for (const alias of registered.command.getAliases()) {
      if (this.aliases.get(alias) === name) {
        this.aliases.delete(alias);
      }
    }

    // Emit event
    this.emit('commandUnregistered', { command: name });
    
    return true;
  }

  /**
   * Get a command by name or alias
   * @param name - Command name or alias
   * @returns Command instance or null if not found
   */
  public get(name: string): Command | null {
    // Direct lookup
    const direct = this.commands.get(name);
    if (direct) {
      return direct.command;
    }

    // Alias lookup
    const aliasedName = this.aliases.get(name);
    if (aliasedName) {
      const aliased = this.commands.get(aliasedName);
      if (aliased) {
        return aliased.command;
      }
    }

    return null;
  }

  /**
   * Check if a command exists
   * @param name - Command name or alias
   * @returns Whether the command exists
   */
  public has(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * Get all registered commands
   * @param options - Search options
   * @returns Array of command instances
   */
  public getAll(options: SearchOptions = {}): Command[] {
    let commands = Array.from(this.commands.values()).map(r => r.command);

    // Filter by category
    if (options.category) {
      commands = commands.filter(cmd => cmd.getCategory() === options.category);
    }

    // Filter hidden commands
    if (!options.includeHidden) {
      commands = commands.filter(cmd => !cmd.isHidden());
    }

    // Filter deprecated commands
    if (!options.includeDeprecated) {
      commands = commands.filter(cmd => !cmd.isDeprecated());
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      commands = commands.slice(0, options.limit);
    }

    return commands;
  }

  /**
   * Get commands by category
   * @param category - Category name
   * @returns Array of commands in the category
   */
  public getByCategory(category: string): Command[] {
    return this.getAll({ category });
  }

  /**
   * Get all available categories
   * @returns Array of category names
   */
  public getCategories(): string[] {
    const categories = new Set<string>();
    for (const registered of this.commands.values()) {
      categories.add(registered.command.getCategory());
    }
    return Array.from(categories).sort();
  }

  /**
   * Search for commands
   * @param query - Search query
   * @param options - Search options
   * @returns Array of matching commands
   */
  public search(query: string, options: SearchOptions = {}): Command[] {
    const lowerQuery = query.toLowerCase();
    let results: Command[] = [];

    for (const registered of this.commands.values()) {
      const cmd = registered.command;
      const metadata = cmd.getMetadata();

      // Search in name
      if (cmd.getName().toLowerCase().includes(lowerQuery)) {
        results.push(cmd);
        continue;
      }

      // Search in aliases
      if (cmd.getAliases().some(alias => alias.toLowerCase().includes(lowerQuery))) {
        results.push(cmd);
        continue;
      }

      // Search in description
      if (options.searchDescription !== false && 
          metadata.description.toLowerCase().includes(lowerQuery)) {
        results.push(cmd);
        continue;
      }

      // Search in category
      if (cmd.getCategory().toLowerCase().includes(lowerQuery)) {
        results.push(cmd);
        continue;
      }
    }

    // Apply filters
    if (!options.includeHidden) {
      results = results.filter(cmd => !cmd.isHidden());
    }

    if (!options.includeDeprecated) {
      results = results.filter(cmd => !cmd.isDeprecated());
    }

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get command completions for autocomplete
   * @param partial - Partial command input
   * @returns Array of matching command names
   */
  public getCompletions(partial: string): string[] {
    const lowerPartial = partial.toLowerCase();
    const completions: string[] = [];

    for (const [name, registered] of this.commands) {
      // Match command name
      if (name.toLowerCase().startsWith(lowerPartial)) {
        completions.push(name);
      }

      // Match aliases
      for (const alias of registered.command.getAliases()) {
        if (alias.toLowerCase().startsWith(lowerPartial) && !completions.includes(name)) {
          completions.push(name);
        }
      }
    }

    return completions.sort();
  }

  /**
   * Clear all registered commands
   */
  public clear(): void {
    this.commands.clear();
    this.aliases.clear();
    this.executionHistory = [];
    this.emit('registryCleared', {});
  }

  /**
   * Get registration information for a command
   * @param name - Command name
   * @returns Registration info or null
   */
  public getRegistrationInfo(name: string): { registeredAt: Date; source: string } | null {
    const registered = this.commands.get(name);
    if (!registered) {
      return null;
    }
    return {
      registeredAt: registered.registeredAt,
      source: registered.source
    };
  }

  /**
   * Get command statistics
   * @returns Command statistics
   */
  public getStats(): CommandStats {
    const commandsByCategory: Record<string, number> = {};
    let hiddenCommands = 0;
    let deprecatedCommands = 0;
    let totalAliases = 0;

    for (const registered of this.commands.values()) {
      const cmd = registered.command;
      const category = cmd.getCategory();
      
      commandsByCategory[category] = (commandsByCategory[category] || 0) + 1;
      
      if (cmd.isHidden()) {
        hiddenCommands++;
      }
      
      if (cmd.isDeprecated()) {
        deprecatedCommands++;
      }
      
      totalAliases += cmd.getAliases().length;
    }

    return {
      totalCommands: this.commands.size,
      commandsByCategory,
      hiddenCommands,
      deprecatedCommands,
      totalAliases
    };
  }

  /**
   * Record command execution
   * @param commandName - Name of executed command
   * @param success - Whether execution was successful
   * @param duration - Execution duration in milliseconds
   */
  public recordExecution(commandName: string, success: boolean, duration: number): void {
    this.executionHistory.push({
      commandName,
      timestamp: new Date(),
      success,
      duration
    });

    // Trim history if needed
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }

    this.emit('commandExecuted', { commandName, success, duration });
  }

  /**
   * Get execution history
   * @param limit - Maximum entries to return
   * @returns Execution history
   */
  public getExecutionHistory(limit?: number): Array<{
    commandName: string;
    timestamp: Date;
    success: boolean;
    duration: number;
  }> {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get most used commands
   * @param limit - Number of commands to return
   * @returns Array of [commandName, count] tuples
   */
  public getMostUsed(limit: number = 10): Array<[string, number]> {
    const counts = new Map<string, number>();
    
    for (const entry of this.executionHistory) {
      counts.set(entry.commandName, (counts.get(entry.commandName) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Get command success rate
   * @param commandName - Command name (optional, for specific command)
   * @returns Success rate (0-1) or null if no data
   */
  public getSuccessRate(commandName?: string): number | null {
    let relevant = this.executionHistory;
    
    if (commandName) {
      relevant = relevant.filter(e => e.commandName === commandName);
    }

    if (relevant.length === 0) {
      return null;
    }

    const successful = relevant.filter(e => e.success).length;
    return successful / relevant.length;
  }

  /**
   * Add event listener
   * @param event - Event type
   * @param callback - Event callback
   */
  public on(event: CommandRegistryEvent, callback: CommandRegistryEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.push(callback);
    }
  }

  /**
   * Remove event listener
   * @param event - Event type
   * @param callback - Event callback to remove
   */
  public off(event: CommandRegistryEvent, callback: CommandRegistryEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   * @private
   * @param event - Event type
   * @param data - Event data
   */
  private emit(event: CommandRegistryEvent, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Get help text for all commands
   * @returns Formatted help text
   */
  public getHelp(): string {
    const lines: string[] = [];
    
    lines.push('\n\x1b[1m\x1b[36mAVAILABLE COMMANDS\x1b[0m\n');
    
    const categories = this.getCategories();
    
    for (const category of categories) {
      const commands = this.getByCategory(category);
      if (commands.length === 0) continue;
      
      lines.push(`\n\x1b[1m${category.toUpperCase()}\x1b[0m`);
      
      for (const cmd of commands) {
        if (cmd.isHidden()) continue;
        
        const name = cmd.getName();
        const description = cmd.getDescription();
        const deprecated = cmd.isDeprecated() ? ' \x1b[33m[DEPRECATED]\x1b[0m' : '';
        
        lines.push(`  /${name.padEnd(20)} ${description}${deprecated}`);
      }
    }
    
    lines.push('\n\x1b[90mUse /help <command> for detailed information about a specific command.\x1b[0m\n');
    
    return lines.join('\n');
  }

  /**
   * Export registry state
   * @returns Registry state object
   */
  public export(): {
    commands: Array<{ name: string; metadata: CommandMetadata; source: string; registeredAt: string }>;
    aliases: Record<string, string>;
    stats: CommandStats;
  } {
    const commands: Array<{ name: string; metadata: CommandMetadata; source: string; registeredAt: string }> = [];
    
    for (const [name, registered] of this.commands) {
      commands.push({
        name,
        metadata: registered.command.getMetadata(),
        source: registered.source,
        registeredAt: registered.registeredAt.toISOString()
      });
    }

    const aliases: Record<string, string> = {};
    for (const [alias, commandName] of this.aliases) {
      aliases[alias] = commandName;
    }

    return {
      commands,
      aliases,
      stats: this.getStats()
    };
  }

  /**
   * Import registry state
   * @param data - Registry state object
   * @param commandFactory - Factory function to create commands from metadata
   */
  public import(
    data: {
      commands: Array<{ name: string; metadata: CommandMetadata; source: string }>;
      aliases: Record<string, string>;
    },
    commandFactory: (metadata: CommandMetadata) => Command
  ): void {
    this.clear();
    
    for (const cmdData of data.commands) {
      try {
        const command = commandFactory(cmdData.metadata);
        this.register(command, cmdData.source);
      } catch (error) {
        console.warn(`Failed to import command "${cmdData.name}":`, error);
      }
    }
  }

  /**
   * Validate registry integrity
   * @returns Validation results
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for orphaned aliases
    for (const [alias, commandName] of this.aliases) {
      if (!this.commands.has(commandName)) {
        errors.push(`Orphaned alias "${alias}" points to non-existent command "${commandName}"`);
      }
    }

    // Check for duplicate aliases
    const aliasCounts = new Map<string, number>();
    for (const registered of this.commands.values()) {
      for (const alias of registered.command.getAliases()) {
        aliasCounts.set(alias, (aliasCounts.get(alias) || 0) + 1);
      }
    }
    for (const [alias, count] of aliasCounts) {
      if (count > 1) {
        errors.push(`Alias "${alias}" is defined by ${count} commands`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default CommandRegistry;
