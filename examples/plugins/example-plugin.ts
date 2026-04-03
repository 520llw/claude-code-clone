/**
 * example-plugin.ts
 * 
 * Example Plugin for Claude Code Clone
 * 
 * This file demonstrates how to create a plugin for the Claude Code Clone
 * plugin system. It shows best practices for plugin development including:
 * - Plugin metadata definition
 * - Configuration schema
 * - Hook registration
 * - Command registration
 * - Error handling
 * - Cleanup
 * 
 * @module ExamplePlugins
 * @author Your Name
 * @version 1.0.0
 */

import {
  Plugin,
  PluginMetadata,
  PluginCategory,
  ConfigSchemaEntry,
  PluginCapabilities
} from '../../src/plugins';

/**
 * ExamplePlugin - A sample plugin demonstrating plugin development.
 * 
 * This plugin provides:
 * - Message processing and logging
 * - Custom commands
 * - Configuration options
 * - Hook handlers
 * 
 * @example
 * ```typescript
 * // Load the plugin
 * await pluginManager.loadPlugin('./example-plugin');
 * 
 * // Use the custom command
 * await pluginManager.getPlugin('com.example.myplugin').greet('World');
 * ```
 */
export class ExamplePlugin extends Plugin {
  /**
   * Plugin metadata
   * 
   * This defines the plugin's identity and basic information.
   * The ID should follow reverse domain notation.
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.example.myplugin',
    name: 'My Example Plugin',
    version: '1.0.0',
    description: 'An example plugin demonstrating the Claude Code Clone plugin system',
    author: 'Your Name <your.email@example.com>',
    license: 'MIT',
    homepage: 'https://github.com/yourusername/example-plugin',
    repository: 'https://github.com/yourusername/example-plugin.git',
    keywords: ['example', 'demo', 'tutorial'],
    category: PluginCategory.UTILITY,
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   * 
   * Define the configuration options your plugin accepts.
   * These will be shown in the plugin settings UI.
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'greetingFormat',
      type: 'enum',
      label: 'Greeting Format',
      description: 'How to format greeting messages',
      enumValues: ['formal', 'casual', 'funny'],
      default: 'casual',
      required: false
    },
    {
      key: 'enableLogging',
      type: 'boolean',
      label: 'Enable Logging',
      description: 'Whether to log plugin activities',
      default: true,
      required: false
    },
    {
      key: 'logLevel',
      type: 'enum',
      label: 'Log Level',
      description: 'Minimum log level to display',
      enumValues: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      required: false
    },
    {
      key: 'maxMessages',
      type: 'number',
      label: 'Maximum Messages',
      description: 'Maximum number of messages to process per session',
      default: 1000,
      min: 100,
      max: 10000,
      required: false
    },
    {
      key: 'customPrefix',
      type: 'string',
      label: 'Custom Prefix',
      description: 'Prefix to add to all plugin messages',
      default: '[Example]',
      pattern: '^\\[.+\\]$',
      required: false
    }
  ];

  /**
   * Plugin dependencies
   * 
   * List any plugins that your plugin depends on.
   * These will be loaded before your plugin.
   */
  public readonly dependencies = [
    {
      id: 'com.claudecode.builtin.history',
      version: '^1.0.0',
      optional: true,
      reason: 'Used for command history integration'
    }
  ];

  /**
   * Plugin capabilities
   * 
   * Declare what your plugin provides and requires.
   */
  public readonly capabilities: PluginCapabilities = {
    providesHooks: ['onMessage', 'onResponse'],
    providesCommands: ['example.greet', 'example.status'],
    requiresNetwork: false,
    requiresFileSystem: false,
    requiresShell: false,
    requiresLLM: false
  };

  /**
   * Message counter
   */
  private messageCount: number = 0;

  /**
   * Called when the plugin is activated.
   * 
   * This is where you initialize your plugin, register hooks,
   * and set up any resources you need.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('ExamplePlugin activating...');

    // Log configuration
    if (this.context.config.enableLogging) {
      this.logger.info('Plugin configuration:', this.context.config);
    }

    // Register hooks
    this.registerHook('onMessage', this.handleMessage.bind(this), 10);
    this.registerHook('onResponse', this.handleResponse.bind(this));
    this.registerHook('onSessionStart', this.handleSessionStart.bind(this));
    this.registerHook('onSessionEnd', this.handleSessionEnd.bind(this));

    // Register commands
    this.registerCommand('example.greet', this.greet.bind(this));
    this.registerCommand('example.status', this.getStatus.bind(this));
    this.registerCommand('example.config', this.showConfig.bind(this));

    // Show activation notification
    this.ui.showNotification(
      `${this.context.config.customPrefix} Plugin activated!`,
      'success'
    );

    this.logger.info('ExamplePlugin activated successfully');
  }

  /**
   * Called when the plugin is deactivated.
   * 
   * This is where you clean up resources, save state,
   * and perform any necessary shutdown tasks.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('ExamplePlugin deactivating...');

    // Save any state you need to persist
    await this.storage.set('messageCount', this.messageCount);
    await this.storage.set('lastDeactivated', new Date().toISOString());

    this.logger.info('ExamplePlugin deactivated');
  }

  /**
   * Called when the plugin configuration changes.
   * 
   * @param newConfig - The new configuration
   * @param oldConfig - The previous configuration
   */
  public async onConfigChange(
    newConfig: Record<string, any>,
    oldConfig: Record<string, any>
  ): Promise<void> {
    this.logger.info('Configuration changed:', { newConfig, oldConfig });

    // React to configuration changes
    if (newConfig.logLevel !== oldConfig.logLevel) {
      this.logger.info(`Log level changed from ${oldConfig.logLevel} to ${newConfig.logLevel}`);
    }
  }

  // ============================================================================
  // Hook Handlers
  // ============================================================================

  /**
   * Handles incoming messages.
   * 
   * @param context - Hook context
   */
  private async handleMessage(context: any): Promise<void> {
    // Check if we've reached the message limit
    const maxMessages = this.context.config.maxMessages || 1000;
    if (this.messageCount >= maxMessages) {
      this.logger.warn('Message limit reached');
      return;
    }

    this.messageCount++;

    const { content, role } = context.data;

    if (this.context.config.enableLogging) {
      this.logger.info(`Received ${role} message #${this.messageCount}:`, 
        content.substring(0, 50) + (content.length > 50 ? '...' : ''));
    }

    // Example: Add metadata to the message
    context.addMetadata('processedBy', this.metadata.id);
    context.addMetadata('processedAt', new Date().toISOString());

    // Example: Modify message content based on configuration
    if (this.context.config.greetingFormat === 'funny') {
      if (content.toLowerCase().includes('hello')) {
        context.set('content', content + ' 🎉');
      }
    }
  }

  /**
   * Handles generated responses.
   * 
   * @param context - Hook context
   */
  private async handleResponse(context: any): Promise<void> {
    const { content, model } = context.data;

    if (this.context.config.enableLogging) {
      this.logger.info(`Response generated by ${model}`);
    }

    // Example: Add a signature to responses
    if (this.context.config.greetingFormat === 'formal') {
      context.appendContent(`\n\n---\nProcessed by ${this.metadata.name}`);
    }
  }

  /**
   * Handles session start.
   * 
   * @param context - Hook context
   */
  private async handleSessionStart(context: any): Promise<void> {
    this.logger.info('New session started:', context.data.sessionId);
    
    // Reset message counter for new session
    this.messageCount = 0;

    // Load persisted state
    const savedCount = await this.storage.get<number>('messageCount');
    if (savedCount) {
      this.logger.info(`Previous session had ${savedCount} messages`);
    }
  }

  /**
   * Handles session end.
   * 
   * @param context - Hook context
   */
  private async handleSessionEnd(context: any): Promise<void> {
    this.logger.info('Session ended:', {
      duration: context.data.duration,
      messagesProcessed: this.messageCount
    });
  }

  // ============================================================================
  // Commands
  // ============================================================================

  /**
   * Greets the user.
   * 
   * @param name - Name to greet
   * @returns Greeting message
   */
  public greet(name: string = 'World'): string {
    const format = this.context.config.greetingFormat;
    
    let greeting: string;
    
    switch (format) {
      case 'formal':
        greeting = `Good day, ${name}.`;
        break;
      case 'funny':
        greeting = `Hey there, ${name}! 👋 What's up?`;
        break;
      case 'casual':
      default:
        greeting = `Hello, ${name}!`;
        break;
    }

    this.logger.info('Greeting generated:', greeting);
    
    return `${this.context.config.customPrefix} ${greeting}`;
  }

  /**
   * Gets plugin status.
   * 
   * @returns Status information
   */
  public getStatus(): Record<string, any> {
    return {
      pluginId: this.metadata.id,
      version: this.metadata.version,
      state: this.getState(),
      uptime: this.getUptime(),
      messagesProcessed: this.messageCount,
      config: this.context.config
    };
  }

  /**
   * Shows current configuration.
   * 
   * @returns Configuration display
   */
  public showConfig(): string {
    const lines = [
      `${this.context.config.customPrefix} Current Configuration:`,
      '---',
      ...Object.entries(this.context.config).map(([key, value]) => 
        `  ${key}: ${value}`
      )
    ];

    return lines.join('\n');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Gets the message count.
   * 
   * @returns Number of messages processed
   */
  public getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Resets the message counter.
   */
  public resetMessageCount(): void {
    this.messageCount = 0;
    this.logger.info('Message counter reset');
  }
}

// Export the plugin as default
export default ExamplePlugin;

// Also export a factory function for dynamic creation
export function createExamplePlugin(): ExamplePlugin {
  return new ExamplePlugin();
}
