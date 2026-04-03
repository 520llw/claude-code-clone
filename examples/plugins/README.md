# Plugin Development Guide

This guide explains how to develop plugins for the Claude Code Clone plugin system.

## Table of Contents

- [Getting Started](#getting-started)
- [Plugin Structure](#plugin-structure)
- [Creating Your First Plugin](#creating-your-first-plugin)
- [Plugin Metadata](#plugin-metadata)
- [Configuration](#configuration)
- [Hooks](#hooks)
- [Commands](#commands)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Getting Started

### Prerequisites

- Node.js 18+
- TypeScript knowledge
- Understanding of async/await

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/claude-code-clone.git
cd claude-code-clone
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Plugin Structure

A plugin is a TypeScript class that extends the base `Plugin` class:

```typescript
import { Plugin, PluginMetadata, PluginCategory } from 'claude-code-clone/plugins';

export class MyPlugin extends Plugin {
  public readonly metadata: PluginMetadata = {
    id: 'com.example.myplugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'A description of my plugin',
    author: 'Your Name',
    category: PluginCategory.UTILITY
  };

  public async onActivate(): Promise<void> {
    // Plugin initialization
  }

  public async onDeactivate(): Promise<void> {
    // Plugin cleanup
  }
}
```

## Creating Your First Plugin

### 1. Create the Plugin File

Create a new file `my-plugin.ts`:

```typescript
import { Plugin, PluginMetadata, PluginCategory } from 'claude-code-clone/plugins';

export class MyPlugin extends Plugin {
  public readonly metadata: PluginMetadata = {
    id: 'com.example.myplugin',
    name: 'My First Plugin',
    version: '1.0.0',
    description: 'My first Claude Code Clone plugin',
    author: 'Your Name',
    category: PluginCategory.UTILITY
  };

  public async onActivate(): Promise<void> {
    this.logger.info('MyPlugin activated!');
  }

  public async onDeactivate(): Promise<void> {
    this.logger.info('MyPlugin deactivated!');
  }
}
```

### 2. Register Hooks

```typescript
public async onActivate(): Promise<void> {
  // Register a hook
  this.registerHook('onMessage', async (context) => {
    this.logger.info('Message received:', context.data.content);
  });
}
```

### 3. Register Commands

```typescript
public async onActivate(): Promise<void> {
  // Register a command
  this.registerCommand('myplugin.hello', async (name: string) => {
    return `Hello, ${name}!`;
  });
}
```

### 4. Load Your Plugin

```typescript
import { PluginManager } from 'claude-code-clone/plugins';
import { MyPlugin } from './my-plugin';

const manager = new PluginManager({ hostVersion: '1.0.0', hostApi: {} });
await manager.initialize();

// Load the plugin
await manager.loadPlugin('./my-plugin');
```

## Plugin Metadata

The `PluginMetadata` interface defines your plugin's identity:

```typescript
interface PluginMetadata {
  id: string;              // Unique identifier (reverse domain notation)
  name: string;            // Display name
  version: string;         // Semantic version
  description: string;     // Short description
  author: string;          // Author name/email
  license?: string;        // SPDX license identifier
  homepage?: string;       // Plugin homepage URL
  repository?: string;     // Repository URL
  keywords?: string[];     // Keywords for search
  category: PluginCategory;
  enabledByDefault?: boolean;
  requiresRestart?: boolean;
}
```

## Configuration

Define configuration options with a schema:

```typescript
public readonly configSchema: ConfigSchemaEntry[] = [
  {
    key: 'apiKey',
    type: 'string',
    label: 'API Key',
    description: 'Your API key',
    required: true,
    sensitive: true  // Will be masked in UI
  },
  {
    key: 'timeout',
    type: 'number',
    label: 'Timeout',
    description: 'Request timeout in milliseconds',
    default: 5000,
    min: 1000,
    max: 60000
  },
  {
    key: 'mode',
    type: 'enum',
    label: 'Mode',
    description: 'Operating mode',
    enumValues: ['simple', 'advanced'],
    default: 'simple'
  }
];
```

Access configuration in your plugin:

```typescript
const apiKey = this.context.config.apiKey;
const timeout = this.context.config.timeout || 5000;
```

## Hooks

Hooks allow your plugin to respond to application events:

### Available Hooks

| Hook | Description | Data Type |
|------|-------------|-----------|
| `onInit` | Application initializing | `OnInitData` |
| `onMessage` | New message received | `OnMessageData` |
| `onToolCall` | Tool about to be called | `OnToolCallData` |
| `onToolResult` | Tool execution completed | `OnToolResultData` |
| `onResponse` | Response generated | `OnResponseData` |
| `onError` | Error occurred | `OnErrorData` |
| `onSessionStart` | Session started | `OnSessionStartData` |
| `onSessionEnd` | Session ended | `OnSessionEndData` |
| `onFileChange` | File changed | `OnFileChangeData` |
| `onCommand` | Command executed | `OnCommandData` |
| `onContextCompact` | Context compressed | `OnContextCompactData` |
| `onPermissionRequest` | Permission requested | `OnPermissionRequestData` |
| `onLLMCall` | LLM API called | `OnLLMCallData` |
| `onStreamToken` | Stream token received | `OnStreamTokenData` |
| `onExit` | Application exiting | `OnExitData` |

### Hook Handler Example

```typescript
this.registerHook('onMessage', async (context) => {
  const { content, role } = context.data;
  
  // Log the message
  this.logger.info(`${role}: ${content}`);
  
  // Modify the message
  if (content.includes('urgent')) {
    context.addMetadata('priority', 'high');
  }
  
  // Cancel processing if needed
  if (content.includes('spam')) {
    context.cancel('Message flagged as spam');
  }
});
```

## Commands

Register custom commands that can be called by users or other plugins:

```typescript
public async onActivate(): Promise<void> {
  // Simple command
  this.registerCommand('myplugin.greet', (name: string) => {
    return `Hello, ${name}!`;
  });
  
  // Async command
  this.registerCommand('myplugin.fetch', async (url: string) => {
    const response = await fetch(url);
    return response.text();
  });
}
```

Call commands programmatically:

```typescript
const plugin = manager.getPlugin('com.example.myplugin');
const result = await plugin.executeCommand('myplugin.greet', 'World');
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
public async onActivate(): Promise<void> {
  try {
    await this.initializeResources();
  } catch (error) {
    this.logger.error('Failed to initialize:', error);
    // Don't throw - let the plugin manager handle it
  }
}
```

### 2. Resource Cleanup

Clean up resources in `onDeactivate`:

```typescript
private fileWatcher?: fs.FSWatcher;

public async onActivate(): Promise<void> {
  this.fileWatcher = fs.watch('./file.txt', () => {
    // Handle change
  });
}

public async onDeactivate(): Promise<void> {
  this.fileWatcher?.close();
}
```

### 3. Configuration Validation

Validate configuration before using it:

```typescript
public async onActivate(): Promise<void> {
  const validation = this.validateConfig(this.context.config);
  if (!validation.valid) {
    this.logger.error('Invalid configuration:', validation.errors);
    return;
  }
}
```

### 4. Logging

Use the plugin logger for all logging:

```typescript
this.logger.debug('Debug information');
this.logger.info('General information');
this.logger.warn('Warning message');
this.logger.error('Error message');
```

### 5. Storage

Use the storage API for persistence:

```typescript
// Save data
await this.storage.set('key', value);

// Load data
const value = await this.storage.get('key');

// Check existence
const exists = await this.storage.has('key');

// Delete data
await this.storage.delete('key');
```

## Examples

### Example 1: Message Logger Plugin

```typescript
export class MessageLoggerPlugin extends Plugin {
  public readonly metadata = {
    id: 'com.example.messagelogger',
    name: 'Message Logger',
    version: '1.0.0',
    description: 'Logs all messages to a file',
    author: 'Your Name',
    category: PluginCategory.UTILITY
  };

  public readonly configSchema = [
    {
      key: 'logFile',
      type: 'string',
      label: 'Log File Path',
      default: './messages.log'
    }
  ];

  public async onActivate(): Promise<void> {
    this.registerHook('onMessage', async (context) => {
      const logEntry = `[${new Date().toISOString()}] ${context.data.role}: ${context.data.content}\n`;
      await fs.appendFile(this.context.config.logFile, logEntry);
    });
  }
}
```

### Example 2: Auto-Formatter Plugin

```typescript
export class AutoFormatterPlugin extends Plugin {
  public readonly metadata = {
    id: 'com.example.autoformatter',
    name: 'Auto Formatter',
    version: '1.0.0',
    description: 'Auto-formats code on save',
    author: 'Your Name',
    category: PluginCategory.DEVELOPMENT
  };

  public async onActivate(): Promise<void> {
    this.registerHook('onFileChange', async (context) => {
      const { path, changeType } = context.data;
      
      if (changeType === 'modified' && path.endsWith('.ts')) {
        await this.formatFile(path);
      }
    });
  }

  private async formatFile(path: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await execAsync(`prettier --write "${path}"`);
  }
}
```

### Example 3: Git Integration Plugin

See the built-in `GitPlugin.ts` for a complete example.

## Publishing Your Plugin

1. Build your plugin:
```bash
npm run build
```

2. Create a package:
```bash
npm pack
```

3. Publish to npm (optional):
```bash
npm publish
```

4. Or distribute directly as a `.tgz` file.

## Resources

- [Plugin API Documentation](../../docs/plugin-api.md)
- [Hook Reference](../../docs/hooks.md)
- [Example Plugins](./)
- [Built-in Plugins](../../src/plugins/builtin/)

## Support

For questions and support:
- GitHub Issues: https://github.com/yourusername/claude-code-clone/issues
- Discord: https://discord.gg/claudecode
- Documentation: https://docs.claudecode.dev

## License

Plugins you create are your own work. We recommend using the MIT license for maximum compatibility.
