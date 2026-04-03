/**
 * AliasPlugin.ts
 * 
 * Command Alias Plugin for Claude Code Clone
 * 
 * This plugin provides command alias functionality including:
 * - Command aliasing
 * - Alias expansion
 * - Dynamic aliases
 * - Alias persistence
 * - Parameter substitution
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, ConfigSchemaEntry } from '../Plugin';

/**
 * Alias definition
 */
export interface Alias {
  name: string;
  command: string;
  description?: string;
  category?: string;
  parameters?: AliasParameter[];
  createdAt: Date;
  usageCount: number;
}

/**
 * Alias parameter
 */
export interface AliasParameter {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

/**
 * Alias expansion result
 */
export interface AliasExpansion {
  expanded: string;
  parameters: Record<string, string>;
  original: string;
}

/**
 * AliasPlugin - Manages command aliases for Claude Code Clone.
 * 
 * This plugin allows users to define shortcuts for commonly used commands,
 * with support for parameter substitution.
 * 
 * @example
 * ```typescript
 * const aliasPlugin = new AliasPlugin();
 * await pluginManager.loadPlugin(aliasPlugin);
 * 
 * // Define an alias
 * aliasPlugin.defineAlias('gs', 'git status');
 * 
 * // Expand an alias
 * const expanded = aliasPlugin.expand('gs');
 * console.log(expanded); // 'git status'
 * ```
 */
export class AliasPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.alias',
    name: 'Command Aliases',
    version: '1.0.0',
    description: 'Provides command aliasing with parameter substitution',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.UTILITY,
    keywords: ['alias', 'shortcuts', 'commands'],
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'persistAliases',
      type: 'boolean',
      label: 'Persist aliases',
      description: 'Save aliases between sessions',
      default: true,
      required: false
    },
    {
      key: 'showExpansion',
      type: 'boolean',
      label: 'Show alias expansion',
      description: 'Display the expanded command before execution',
      default: false,
      required: false
    },
    {
      key: 'maxAliasLength',
      type: 'number',
      label: 'Maximum alias length',
      description: 'Maximum length for alias names',
      default: 50,
      min: 1,
      max: 100,
      required: false
    },
    {
      key: 'builtInAliases',
      type: 'boolean',
      label: 'Enable built-in aliases',
      description: 'Load common built-in aliases',
      default: true,
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onCommand'],
    providesCommands: ['alias.define', 'alias.remove', 'alias.list', 'alias.expand']
  };

  /**
   * Aliases map
   */
  private aliases: Map<string, Alias> = new Map();

  /**
   * Built-in aliases
   */
  private readonly builtInAliases: Omit<Alias, 'createdAt' | 'usageCount'>[] = [
    { name: 'gs', command: 'git status', description: 'Git status' },
    { name: 'ga', command: 'git add', description: 'Git add' },
    { name: 'gc', command: 'git commit -m', description: 'Git commit' },
    { name: 'gp', command: 'git push', description: 'Git push' },
    { name: 'gpl', command: 'git pull', description: 'Git pull' },
    { name: 'gco', command: 'git checkout', description: 'Git checkout' },
    { name: 'gd', command: 'git diff', description: 'Git diff' },
    { name: 'gl', command: 'git log', description: 'Git log' },
    { name: 'll', command: 'ls -la', description: 'List all files' },
    { name: '..', command: 'cd ..', description: 'Go to parent directory' },
    { name: '...', command: 'cd ../..', description: 'Go up two directories' },
    { name: 'mkdirp', command: 'mkdir -p', description: 'Create directory recursively' },
    { name: 'rmrf', command: 'rm -rf', description: 'Remove recursively' },
    { name: 'port', command: 'lsof -i', description: 'Check port usage' }
  ];

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('AliasPlugin activated');

    // Load built-in aliases
    if (this.context.config.builtInAliases !== false) {
      for (const alias of this.builtInAliases) {
        this.aliases.set(alias.name, {
          ...alias,
          createdAt: new Date(),
          usageCount: 0
        });
      }
    }

    // Load persisted aliases
    if (this.context.config.persistAliases) {
      await this.loadAliases();
    }

    // Register hooks
    this.registerHook('onCommand', this.handleCommand.bind(this));

    // Register commands
    this.registerCommand('alias.define', this.defineAlias.bind(this));
    this.registerCommand('alias.remove', this.removeAlias.bind(this));
    this.registerCommand('alias.list', this.listAliases.bind(this));
    this.registerCommand('alias.get', this.getAlias.bind(this));
    this.registerCommand('alias.expand', this.expand.bind(this));
    this.registerCommand('alias.exists', this.exists.bind(this));
    this.registerCommand('alias.stats', this.getStats.bind(this));
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('AliasPlugin deactivated');

    // Save aliases
    if (this.context.config.persistAliases) {
      await this.saveAliases();
    }
  }

  /**
   * Handles command events.
   */
  private async handleCommand(context: any): Promise<void> {
    const { command } = context.data;

    // Check if command starts with an alias
    const expanded = this.expand(command);
    
    if (expanded !== command) {
      if (this.context.config.showExpansion) {
        this.ui.showNotification(`Expanded: ${expanded}`);
      }
      
      // Update the command in the context
      context.set('command', expanded);
    }
  }

  // ============================================================================
  // Alias Management
  // ============================================================================

  /**
   * Defines a new alias.
   * 
   * @param name - Alias name
   * @param command - Command to alias
   * @param options - Additional options
   * @returns The created alias
   */
  public defineAlias(
    name: string,
    command: string,
    options: Partial<Omit<Alias, 'name' | 'command' | 'createdAt' | 'usageCount'>> = {}
  ): Alias {
    // Validate name
    const maxLength = this.context.config.maxAliasLength || 50;
    if (name.length > maxLength) {
      throw new Error(`Alias name too long (max ${maxLength} characters)`);
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      throw new Error('Alias name contains invalid characters');
    }

    const alias: Alias = {
      name,
      command,
      description: options.description,
      category: options.category,
      parameters: options.parameters,
      createdAt: new Date(),
      usageCount: 0
    };

    this.aliases.set(name, alias);
    
    this.logger.info(`Defined alias: ${name} -> ${command}`);
    this.emit('aliasDefined', { alias });

    return alias;
  }

  /**
   * Removes an alias.
   * 
   * @param name - Alias name
   * @returns True if the alias was removed
   */
  public removeAlias(name: string): boolean {
    const result = this.aliases.delete(name);
    
    if (result) {
      this.logger.info(`Removed alias: ${name}`);
      this.emit('aliasRemoved', { name });
    }

    return result;
  }

  /**
   * Gets an alias.
   * 
   * @param name - Alias name
   * @returns Alias or undefined
   */
  public getAlias(name: string): Alias | undefined {
    return this.aliases.get(name);
  }

  /**
   * Lists all aliases.
   * 
   * @param category - Filter by category
   * @returns Array of aliases
   */
  public listAliases(category?: string): Alias[] {
    let aliases = Array.from(this.aliases.values());

    if (category) {
      aliases = aliases.filter(a => a.category === category);
    }

    // Sort by usage count (most used first)
    aliases.sort((a, b) => b.usageCount - a.usageCount);

    return aliases;
  }

  /**
   * Checks if an alias exists.
   * 
   * @param name - Alias name
   * @returns True if the alias exists
   */
  public exists(name: string): boolean {
    return this.aliases.has(name);
  }

  // ============================================================================
  // Alias Expansion
  // ============================================================================

  /**
   * Expands an alias in a command string.
   * 
   * @param command - Command that may contain aliases
   * @returns Expanded command
   */
  public expand(command: string): string {
    const parts = command.split(/\s+/);
    const firstPart = parts[0];

    const alias = this.aliases.get(firstPart);
    if (!alias) {
      return command;
    }

    // Increment usage count
    alias.usageCount++;

    // Handle parameter substitution
    let expanded = alias.command;
    
    if (alias.parameters && alias.parameters.length > 0) {
      // Substitute parameters
      const args = parts.slice(1);
      for (let i = 0; i < alias.parameters.length; i++) {
        const param = alias.parameters[i];
        const value = args[i] || param.default || '';
        expanded = expanded.replace(new RegExp(`\\$${i + 1}`, 'g'), value);
      }
      
      // Append remaining arguments
      if (args.length > alias.parameters.length) {
        expanded += ' ' + args.slice(alias.parameters.length).join(' ');
      }
    } else {
      // Simple alias - just append remaining arguments
      if (parts.length > 1) {
        expanded += ' ' + parts.slice(1).join(' ');
      }
    }

    return expanded;
  }

  /**
   * Expands an alias with detailed information.
   * 
   * @param command - Command to expand
   * @returns Expansion result
   */
  public expandDetailed(command: string): AliasExpansion {
    const expanded = this.expand(command);
    
    return {
      expanded,
      parameters: this.extractParameters(command),
      original: command
    };
  }

  /**
   * Extracts parameters from a command.
   * 
   * @param command - Command string
   * @returns Extracted parameters
   */
  private extractParameters(command: string): Record<string, string> {
    const parts = command.split(/\s+/);
    const alias = this.aliases.get(parts[0]);
    
    if (!alias || !alias.parameters) {
      return {};
    }

    const args = parts.slice(1);
    const parameters: Record<string, string> = {};

    for (let i = 0; i < alias.parameters.length; i++) {
      const param = alias.parameters[i];
      parameters[param.name] = args[i] || param.default || '';
    }

    return parameters;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Gets alias statistics.
   * 
   * @returns Statistics
   */
  public getStats(): { total: number; totalUsage: number; mostUsed: Alias[] } {
    const aliases = Array.from(this.aliases.values());
    const totalUsage = aliases.reduce((sum, a) => sum + a.usageCount, 0);
    
    const mostUsed = [...aliases]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      total: aliases.length,
      totalUsage,
      mostUsed
    };
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Loads aliases from storage.
   */
  private async loadAliases(): Promise<void> {
    const stored = await this.storage.get<Alias[]>('aliases');
    
    if (stored) {
      for (const alias of stored) {
        // Don't override built-in aliases
        if (!this.aliases.has(alias.name)) {
          this.aliases.set(alias.name, {
            ...alias,
            createdAt: new Date(alias.createdAt)
          });
        }
      }
      
      this.logger.info(`Loaded ${stored.length} aliases`);
    }
  }

  /**
   * Saves aliases to storage.
   */
  private async saveAliases(): Promise<void> {
    // Don't save built-in aliases
    const customAliases = Array.from(this.aliases.values())
      .filter(a => !this.builtInAliases.some(ba => ba.name === a.name));
    
    await this.storage.set('aliases', customAliases);
  }

  /**
   * Creates an alias with parameters.
   * 
   * @param name - Alias name
   * @param command - Command template with $1, $2, etc.
   * @param parameters - Parameter definitions
   * @returns The created alias
   */
  public defineParameterizedAlias(
    name: string,
    command: string,
    parameters: AliasParameter[]
  ): Alias {
    return this.defineAlias(name, command, { parameters });
  }
}

export default AliasPlugin;
