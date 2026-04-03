/**
 * PluginSystem Integration Tests
 * 
 * End-to-end tests for the plugin system, testing plugin loading,
 * registration, hooks, and lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockFS } from '../mocks/MockFS';

// Plugin types
interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  hooks: Record<string, HookHandler>;
  commands?: Record<string, CommandHandler>;
  tools?: ToolDefinition[];
  activate(): void;
  deactivate(): void;
}

type HookHandler = (context: HookContext) => Promise<HookContext | void>;

interface HookContext {
  data: unknown;
  metadata: Record<string, unknown>;
  cancel?: boolean;
  cancelReason?: string;
}

type CommandHandler = (args: string[]) => Promise<string>;

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  entry: string;
  dependencies?: string[];
}

// PluginSystem implementation
class PluginSystem {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, HookHandler[]> = new Map();
  private commands: Map<string, CommandHandler> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();
  private mockFS: MockFS;
  private pluginDirectory: string;

  constructor(mockFS: MockFS, pluginDirectory: string = '/plugins') {
    this.mockFS = mockFS;
    this.pluginDirectory = pluginDirectory;
  }

  /**
   * Load a plugin from manifest
   */
  async loadPlugin(manifestPath: string): Promise<Plugin | undefined> {
    try {
      const content = this.mockFS.readFileSync(manifestPath, 'utf-8') as string;
      const manifest: PluginManifest = JSON.parse(content);

      // Check dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!this.plugins.has(dep)) {
            throw new Error(`Missing dependency: ${dep}`);
          }
        }
      }

      // Load plugin entry
      const entryPath = manifest.entry.startsWith('/')
        ? manifest.entry
        : `${this.pluginDirectory}/${manifest.entry}`;

      const entryContent = this.mockFS.readFileSync(entryPath, 'utf-8') as string;
      const plugin = this.createPluginFromCode(manifest, entryContent);

      // Register plugin
      this.plugins.set(manifest.name, plugin);
      this.registerPluginHooks(plugin);
      this.registerPluginCommands(plugin);
      this.registerPluginTools(plugin);

      // Activate plugin
      plugin.activate();

      return plugin;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Register a plugin directly
   */
  registerPlugin(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.name)) {
      return false;
    }

    this.plugins.set(plugin.name, plugin);
    this.registerPluginHooks(plugin);
    this.registerPluginCommands(plugin);
    this.registerPluginTools(plugin);
    plugin.activate();

    return true;
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    plugin.deactivate();
    this.unregisterPluginHooks(plugin);
    this.unregisterPluginCommands(plugin);
    this.unregisterPluginTools(plugin);
    this.plugins.delete(name);

    return true;
  }

  /**
   * Execute a hook
   */
  async executeHook(name: string, context: HookContext): Promise<HookContext> {
    const handlers = this.hooks.get(name) || [];
    let currentContext = { ...context };

    for (const handler of handlers) {
      try {
        const result = await handler(currentContext);
        if (result) {
          currentContext = { ...currentContext, ...result };
        }
        if (currentContext.cancel) {
          break;
        }
      } catch (error) {
        // Log error but continue with other handlers
      }
    }

    return currentContext;
  }

  /**
   * Execute a command
   */
  async executeCommand(name: string, args: string[]): Promise<string> {
    const handler = this.commands.get(name);
    if (!handler) {
      throw new Error(`Command not found: ${name}`);
    }
    return await handler(args);
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await tool.handler(args);
  }

  /**
   * Get loaded plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if plugin is loaded
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get available hooks
   */
  getHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get available commands
   */
  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get available tools
   */
  getTools(): string[] {
    return Array.from(this.tools.keys());
  }

  private createPluginFromCode(manifest: PluginManifest, code: string): Plugin {
    // In a real implementation, this would evaluate the plugin code
    // For testing, we create a mock plugin
    return {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      hooks: {},
      activate: () => {},
      deactivate: () => {},
    };
  }

  private registerPluginHooks(plugin: Plugin): void {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      this.hooks.get(hookName)!.push(handler);
    }
  }

  private unregisterPluginHooks(plugin: Plugin): void {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      const handlers = this.hooks.get(hookName);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  private registerPluginCommands(plugin: Plugin): void {
    if (plugin.commands) {
      for (const [name, handler] of Object.entries(plugin.commands)) {
        this.commands.set(`${plugin.name}:${name}`, handler);
      }
    }
  }

  private unregisterPluginCommands(plugin: Plugin): void {
    if (plugin.commands) {
      for (const name of Object.keys(plugin.commands)) {
        this.commands.delete(`${plugin.name}:${name}`);
      }
    }
  }

  private registerPluginTools(plugin: Plugin): void {
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.tools.set(`${plugin.name}:${tool.name}`, tool);
      }
    }
  }

  private unregisterPluginTools(plugin: Plugin): void {
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.tools.delete(`${plugin.name}:${tool.name}`);
      }
    }
  }
}

describe('PluginSystem Integration', () => {
  let mockFS: MockFS;
  let pluginSystem: PluginSystem;

  beforeEach(() => {
    mockFS = new MockFS();
    pluginSystem = new PluginSystem(mockFS);

    // Setup plugin directory
    mockFS.mkdirSync('/plugins');
  });

  afterEach(() => {
    mockFS.reset();
  });

  describe('Plugin Registration', () => {
    it('should register a plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      const result = pluginSystem.registerPlugin(plugin);

      expect(result).toBe(true);
      expect(pluginSystem.hasPlugin('test-plugin')).toBe(true);
    });

    it('should not register duplicate plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      const result = pluginSystem.registerPlugin(plugin);

      expect(result).toBe(false);
    });

    it('should activate plugin on registration', () => {
      let activated = false;
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => { activated = true; },
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      expect(activated).toBe(true);
    });

    it('should get registered plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      const retrieved = pluginSystem.getPlugin('test-plugin');

      expect(retrieved?.name).toBe('test-plugin');
    });
  });

  describe('Plugin Unloading', () => {
    it('should unload a plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      const result = pluginSystem.unloadPlugin('test-plugin');

      expect(result).toBe(true);
      expect(pluginSystem.hasPlugin('test-plugin')).toBe(false);
    });

    it('should deactivate plugin on unload', () => {
      let deactivated = false;
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => { deactivated = true; },
      };

      pluginSystem.registerPlugin(plugin);
      pluginSystem.unloadPlugin('test-plugin');

      expect(deactivated).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      const result = pluginSystem.unloadPlugin('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Hook System', () => {
    it('should register hooks from plugin', async () => {
      const hookHandler = jest.fn(async (ctx) => ctx);
      const plugin: Plugin = {
        name: 'hook-plugin',
        version: '1.0.0',
        hooks: {
          'before:command': hookHandler,
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      await pluginSystem.executeHook('before:command', {
        data: null,
        metadata: {},
      });

      expect(hookHandler).toHaveBeenCalled();
    });

    it('should execute multiple hooks', async () => {
      const calls: string[] = [];
      
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        hooks: {
          'test:hook': async () => { calls.push('plugin1'); },
        },
        activate: () => {},
        deactivate: () => {},
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        hooks: {
          'test:hook': async () => { calls.push('plugin2'); },
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin1);
      pluginSystem.registerPlugin(plugin2);

      await pluginSystem.executeHook('test:hook', {
        data: null,
        metadata: {},
      });

      expect(calls).toContain('plugin1');
      expect(calls).toContain('plugin2');
    });

    it('should pass context through hooks', async () => {
      const plugin: Plugin = {
        name: 'context-plugin',
        version: '1.0.0',
        hooks: {
          'transform': async (ctx) => ({
            ...ctx,
            data: (ctx.data as string) + ' transformed',
          }),
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      const result = await pluginSystem.executeHook('transform', {
        data: 'data',
        metadata: {},
      });

      expect(result.data).toBe('data transformed');
    });

    it('should support hook cancellation', async () => {
      const plugin: Plugin = {
        name: 'cancel-plugin',
        version: '1.0.0',
        hooks: {
          'check': async (ctx) => ({
            ...ctx,
            cancel: true,
            cancelReason: 'Cancelled by plugin',
          }),
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      const result = await pluginSystem.executeHook('check', {
        data: null,
        metadata: {},
      });

      expect(result.cancel).toBe(true);
      expect(result.cancelReason).toBe('Cancelled by plugin');
    });

    it('should unregister hooks on plugin unload', async () => {
      const handler = jest.fn();
      const plugin: Plugin = {
        name: 'temp-plugin',
        version: '1.0.0',
        hooks: {
          'temp:hook': handler,
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      pluginSystem.unloadPlugin('temp-plugin');

      await pluginSystem.executeHook('temp:hook', {
        data: null,
        metadata: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Command System', () => {
    it('should register commands from plugin', async () => {
      const plugin: Plugin = {
        name: 'cmd-plugin',
        version: '1.0.0',
        hooks: {},
        commands: {
          greet: async (args) => `Hello, ${args[0] || 'World'}!`,
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      const result = await pluginSystem.executeCommand('cmd-plugin:greet', ['Alice']);
      expect(result).toBe('Hello, Alice!');
    });

    it('should list available commands', () => {
      const plugin: Plugin = {
        name: 'cmd-plugin',
        version: '1.0.0',
        hooks: {},
        commands: {
          cmd1: async () => '1',
          cmd2: async () => '2',
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      const commands = pluginSystem.getCommands();
      expect(commands).toContain('cmd-plugin:cmd1');
      expect(commands).toContain('cmd-plugin:cmd2');
    });

    it('should throw for unknown command', async () => {
      await expect(pluginSystem.executeCommand('unknown', []))
        .rejects.toThrow('Command not found');
    });

    it('should unregister commands on plugin unload', () => {
      const plugin: Plugin = {
        name: 'temp-cmd',
        version: '1.0.0',
        hooks: {},
        commands: {
          test: async () => 'test',
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      pluginSystem.unloadPlugin('temp-cmd');

      expect(pluginSystem.getCommands()).not.toContain('temp-cmd:test');
    });
  });

  describe('Tool System', () => {
    it('should register tools from plugin', async () => {
      const plugin: Plugin = {
        name: 'tool-plugin',
        version: '1.0.0',
        hooks: {},
        tools: [
          {
            name: 'calculate',
            description: 'Calculate something',
            parameters: { a: { type: 'number' }, b: { type: 'number' } },
            handler: async (args) => (args.a as number) + (args.b as number),
          },
        ],
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      const result = await pluginSystem.executeTool('tool-plugin:calculate', { a: 5, b: 3 });
      expect(result).toBe(8);
    });

    it('should list available tools', () => {
      const plugin: Plugin = {
        name: 'tool-plugin',
        version: '1.0.0',
        hooks: {},
        tools: [
          {
            name: 'tool1',
            description: 'Tool 1',
            parameters: {},
            handler: async () => '1',
          },
        ],
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      expect(pluginSystem.getTools()).toContain('tool-plugin:tool1');
    });

    it('should throw for unknown tool', async () => {
      await expect(pluginSystem.executeTool('unknown', {}))
        .rejects.toThrow('Tool not found');
    });
  });

  describe('Plugin Loading from Filesystem', () => {
    it('should load plugin from manifest', async () => {
      mockFS.mkdirSync('/plugins/my-plugin');
      mockFS.writeFileSync('/plugins/my-plugin/manifest.json', JSON.stringify({
        name: 'my-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        entry: 'index.js',
      }));
      mockFS.writeFileSync('/plugins/my-plugin/index.js', '// Plugin code');

      const plugin = await pluginSystem.loadPlugin('/plugins/my-plugin/manifest.json');

      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('my-plugin');
    });

    it('should return undefined for invalid manifest', async () => {
      mockFS.writeFileSync('/plugins/invalid/manifest.json', 'invalid json');

      const plugin = await pluginSystem.loadPlugin('/plugins/invalid/manifest.json');

      expect(plugin).toBeUndefined();
    });

    it('should check dependencies on load', async () => {
      mockFS.mkdirSync('/plugins/dependent');
      mockFS.writeFileSync('/plugins/dependent/manifest.json', JSON.stringify({
        name: 'dependent',
        version: '1.0.0',
        entry: 'index.js',
        dependencies: ['required-plugin'],
      }));

      const plugin = await pluginSystem.loadPlugin('/plugins/dependent/manifest.json');

      expect(plugin).toBeUndefined();
    });

    it('should load plugin with satisfied dependencies', async () => {
      // First register required plugin
      const requiredPlugin: Plugin = {
        name: 'required-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };
      pluginSystem.registerPlugin(requiredPlugin);

      // Then try to load dependent
      mockFS.mkdirSync('/plugins/dependent');
      mockFS.writeFileSync('/plugins/dependent/manifest.json', JSON.stringify({
        name: 'dependent',
        version: '1.0.0',
        entry: 'index.js',
        dependencies: ['required-plugin'],
      }));
      mockFS.writeFileSync('/plugins/dependent/index.js', '// Plugin code');

      const plugin = await pluginSystem.loadPlugin('/plugins/dependent/manifest.json');

      expect(plugin).toBeDefined();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should track plugin lifecycle events', () => {
      const events: string[] = [];

      const plugin: Plugin = {
        name: 'lifecycle-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => { events.push('activated'); },
        deactivate: () => { events.push('deactivated'); },
      };

      pluginSystem.registerPlugin(plugin);
      expect(events).toContain('activated');

      pluginSystem.unloadPlugin('lifecycle-plugin');
      expect(events).toContain('deactivated');
    });

    it('should maintain plugin metadata', () => {
      const plugin: Plugin = {
        name: 'meta-plugin',
        version: '2.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);
      const retrieved = pluginSystem.getPlugin('meta-plugin');

      expect(retrieved?.version).toBe('2.0.0');
      expect(retrieved?.description).toBe('A test plugin');
      expect(retrieved?.author).toBe('Test Author');
    });
  });

  describe('Multiple Plugins', () => {
    it('should handle multiple plugins', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        hooks: {},
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin1);
      pluginSystem.registerPlugin(plugin2);

      expect(pluginSystem.getPlugins()).toHaveLength(2);
    });

    it('should isolate plugin namespaces', async () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        hooks: {},
        commands: {
          cmd: async () => 'plugin1',
        },
        activate: () => {},
        deactivate: () => {},
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        hooks: {},
        commands: {
          cmd: async () => 'plugin2',
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin1);
      pluginSystem.registerPlugin(plugin2);

      const result1 = await pluginSystem.executeCommand('plugin1:cmd', []);
      const result2 = await pluginSystem.executeCommand('plugin2:cmd', []);

      expect(result1).toBe('plugin1');
      expect(result2).toBe('plugin2');
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin activation errors', () => {
      const plugin: Plugin = {
        name: 'error-plugin',
        version: '1.0.0',
        hooks: {},
        activate: () => { throw new Error('Activation failed'); },
        deactivate: () => {},
      };

      expect(() => pluginSystem.registerPlugin(plugin)).toThrow('Activation failed');
    });

    it('should handle hook execution errors gracefully', async () => {
      const plugin: Plugin = {
        name: 'error-hook',
        version: '1.0.0',
        hooks: {
          'error:hook': async () => { throw new Error('Hook error'); },
        },
        activate: () => {},
        deactivate: () => {},
      };

      pluginSystem.registerPlugin(plugin);

      // Should not throw
      const result = await pluginSystem.executeHook('error:hook', {
        data: null,
        metadata: {},
      });

      expect(result).toBeDefined();
    });
  });
});
