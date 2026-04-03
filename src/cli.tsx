/**
 * Claude Code Clone - CLI Entry Point
 *
 * This is the main entry point for the Claude Code Clone CLI application.
 * It handles command-line parsing, initialization, and starts the terminal UI.
 */

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// Core imports
import { ConfigManager, loadConfig } from '@config/index';
import { Logger, LoggerFactory } from '@utils/logger';
import { globalErrorHandler } from '@core/errors';
import { eventBus, SystemEvents } from '@core/events';
import { AgentLoop } from '@core/AgentLoop';
import type { AgentEvents } from '@core/AgentLoop';
import type { LLMConfig, Tool, StreamCallbacks } from '@types/index';

// Tool imports
import {
  FileReadTool,
  FileEditTool,
  FileCreateTool,
  FileDeleteTool,
  DirectoryListTool,
} from './tools/implementations/file';
import {
  GrepTool,
  FindTool,
} from './tools/implementations/search';
import {
  BashTool,
  GitTool,
} from './tools/implementations/execution';

// UI imports
import { App } from '@ui/app';

// ============================================================================
// CLAUDE.md Loader
// ============================================================================

/**
 * Loads CLAUDE.md from project root and parent directories
 */
function loadClaudeMd(workingDirectory: string): string {
  const claudeMdPaths = [
    join(workingDirectory, 'CLAUDE.md'),
    join(workingDirectory, '.claude', 'CLAUDE.md'),
  ];

  // Walk up to find CLAUDE.md in parent directories (up to 5 levels)
  let dir = workingDirectory;
  for (let i = 0; i < 5; i++) {
    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached root
    claudeMdPaths.push(join(parent, 'CLAUDE.md'));
    dir = parent;
  }

  const contents: string[] = [];
  for (const p of claudeMdPaths) {
    try {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf-8').trim();
        if (content) {
          contents.push(`# Project Context (from ${p})\n\n${content}`);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return contents.join('\n\n---\n\n');
}

/**
 * Create default tools for the agent
 */
function createDefaultTools(workingDirectory: string): Tool[] {
  const tools: Tool[] = [];

  try {
    tools.push(new FileReadTool({ workingDirectory }));
    tools.push(new FileEditTool({ workingDirectory }));
    tools.push(new FileCreateTool({ workingDirectory }));
    tools.push(new FileDeleteTool({ workingDirectory }));
    tools.push(new DirectoryListTool({ workingDirectory }));
    tools.push(new GrepTool({ workingDirectory }));
    tools.push(new FindTool({ workingDirectory }));
    tools.push(new BashTool({ workingDirectory }));
    tools.push(new GitTool({ workingDirectory }));
  } catch {
    // Some tools may fail to initialize - that's okay
  }

  return tools;
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('claude-code')
  .description('A full-featured Claude Code clone with multi-agent orchestration')
  .version('1.0.0');

// Global options
program
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --directory <path>', 'Working directory', process.cwd())
  .option('-m, --model <name>', 'Model name to use')
  .option('--no-streaming', 'Disable response streaming')
  .option('--debug', 'Enable debug logging')
  .option('--dry-run', 'Run without making actual changes')
  .option('--api-key <key>', 'API key for the LLM provider');

// ============================================================================
// Commands
// ============================================================================

// Main chat command (default)
program
  .argument('[prompt]', 'Initial prompt to send')
  .action(async (prompt: string | undefined, options) => {
    await runMain(prompt, options);
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .option('-g, --global', 'Use global configuration')
  .option('-l, --list', 'List current configuration')
  .option('-e, --edit', 'Edit configuration')
  .option('--reset', 'Reset to default configuration')
  .action(async (options) => {
    await handleConfigCommand(options);
  });

// Session command
program
  .command('session')
  .description('Manage sessions')
  .option('-l, --list', 'List all sessions')
  .option('-r, --resume <id>', 'Resume a session')
  .option('-d, --delete <id>', 'Delete a session')
  .option('--export <id>', 'Export a session')
  .action(async (options) => {
    await handleSessionCommand(options);
  });

// Plugin command
program
  .command('plugin')
  .description('Manage plugins')
  .option('-l, --list', 'List installed plugins')
  .option('-i, --install <path>', 'Install a plugin')
  .option('-u, --uninstall <name>', 'Uninstall a plugin')
  .option('--enable <name>', 'Enable a plugin')
  .option('--disable <name>', 'Disable a plugin')
  .action(async (options) => {
    await handlePluginCommand(options);
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('Claude Code Clone v1.0.0');
    console.log('Built with Bun + TypeScript + React + Ink');
  });

// ============================================================================
// Main Function
// ============================================================================

async function runMain(initialPrompt: string | undefined, options: Record<string, unknown>): Promise<void> {
  const logger = createLogger(!!options.debug);

  try {
    // Initialize error handling
    setupErrorHandling(logger);

    // Load configuration
    const config = await initializeConfig(options, logger);
    const workingDirectory = (options.directory as string) || process.cwd();

    // Set up logging based on config
    if (options.debug) {
      LoggerFactory.getInstance().setDefaultLevel('debug');
    }

    // Load CLAUDE.md project context
    const claudeMdContent = loadClaudeMd(workingDirectory);

    // Build system prompt with CLAUDE.md context
    const baseSystemPrompt = `You are Claude Code, an AI assistant designed to help with software development tasks.
You have access to various tools for file operations, code analysis, shell commands, and more.

Guidelines:
- Always think step by step
- Use tools when needed to accomplish tasks
- Explain your reasoning when making changes
- Ask for clarification if the request is ambiguous
- Be concise but thorough in your responses`;

    const systemPrompt = claudeMdContent
      ? `${baseSystemPrompt}\n\n---\n\n${claudeMdContent}`
      : baseSystemPrompt;

    // Build LLM config from configuration
    const provider = (config.get('model.provider') as string) || 'anthropic';

    // Resolve API key based on provider
    const resolveApiKey = (): string => {
      const configKey = config.get('model.apiKey') as string;
      if (configKey) return configKey;

      switch (provider) {
        case 'kimi':
          return process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || '';
        case 'openai':
          return process.env.OPENAI_API_KEY || '';
        case 'anthropic':
        default:
          return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
      }
    };

    // Resolve default model based on provider
    const resolveDefaultModel = (): string => {
      const configModel = config.get('model.name') as string;
      if (configModel) return configModel;

      switch (provider) {
        case 'kimi':
          return 'kimi-k2.5';
        case 'openai':
          return 'gpt-4o';
        case 'anthropic':
        default:
          return 'claude-sonnet-4-20250514';
      }
    };

    const llmConfig: LLMConfig = {
      provider,
      model: resolveDefaultModel(),
      apiKey: resolveApiKey(),
      maxTokens: (config.get('model.maxTokens') as number) || 16000,
      temperature: (config.get('model.temperature') as number) || 0,
    };

    // Create tools
    const tools = createDefaultTools(workingDirectory);

    // Create AgentLoop
    const agentEvents: AgentEvents = {
      onStateChange: (state) => {
        logger.debug(`Agent state: ${state}`);
      },
      onMessage: (message) => {
        logger.debug(`Agent message: ${message.type}`);
      },
      onError: (error) => {
        logger.error('Agent error', error);
      },
      onPermissionRequest: async (toolName, _params) => {
        // In interactive mode, this will be handled by the UI
        // For now, prompt tools that aren't read-only need explicit approval
        logger.info(`Permission requested for tool: ${toolName}`);
        return true; // Auto-approve in non-interactive startup
      },
    };

    const agent = new AgentLoop({
      llmConfig,
      tools,
      systemPrompt,
      agentConfig: {
        autoApprove: false,
        streamResponses: options.streaming !== false,
        maxIterations: 50,
        timeout: 300000,
      },
      events: agentEvents,
      logger,
      workingDirectory,
      enableSessionPersistence: true,
      sessionStoragePath: join(homedir(), '.claude-code', 'sessions'),
    });

    // Initialize agent
    await agent.initialize();

    logger.info('Starting Claude Code Clone', {
      version: '1.0.0',
      directory: workingDirectory,
      model: llmConfig.model,
      toolCount: tools.length,
      hasClaudeMd: !!claudeMdContent,
    });

    // Emit system initialized event
    eventBus.emit(SystemEvents.INITIALIZED, {
      timestamp: Date.now(),
      config: config.getConfig(),
    });

    // Render the UI with agent
    const { waitUntilExit } = render(
      <App
        initialPrompt={initialPrompt}
        workingDirectory={workingDirectory}
        config={config}
        logger={logger}
        agent={agent}
      />,
      {
        exitOnCtrlC: true,
      }
    );

    // Wait for the UI to exit
    await waitUntilExit();

    // Clean shutdown
    await agent.dispose();
    await shutdown(logger);

  } catch (error) {
    logger.fatal(
      'Failed to start application',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function createLogger(debug: boolean): Logger {
  const logDir = join(homedir(), '.claude-code', 'logs');
  
  return new Logger({
    name: 'claude-code',
    level: debug ? 'debug' : 'info',
    logFile: join(logDir, 'claude-code.log'),
    console: true,
    structured: false,
  });
}

function setupErrorHandling(logger: Logger): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception', error);
    globalErrorHandler.handle(error).finally(() => {
      process.exit(1);
    });
  });
  
  // Handle unhandled rejections
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.fatal('Unhandled rejection', error);
    globalErrorHandler.handle(error).catch(() => {
      // Ignore
    });
  });
  
  // Handle SIGINT
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await shutdown(logger);
    process.exit(0);
  });
  
  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await shutdown(logger);
    process.exit(0);
  });
}

async function initializeConfig(
  options: Record<string, unknown>,
  logger: Logger
): Promise<ConfigManager> {
  const configPath = options.config;
  
  // Load configuration from multiple sources
  const config = await loadConfig({
    configPath,
    globalConfig: true,
    projectConfig: true,
    envVars: true,
    logger,
  });
  
  // Override with CLI options
  if (options.model) {
    config.set('model.name', options.model);
  }
  
  if (options.apiKey) {
    config.set('model.apiKey', options.apiKey);
  }
  
  if (options.streaming === false) {
    config.set('features.streaming', false);
  }
  
  // Validate configuration
  const validation = config.validate();
  if (!validation.success) {
    logger.error('Configuration validation failed', validation.errors as Error);
    throw new Error('Invalid configuration');
  }
  
  return config;
}

async function shutdown(logger: Logger): Promise<void> {
  logger.info('Shutting down...');
  
  // Emit shutdown event
  eventBus.emit(SystemEvents.SHUTDOWN, {
    timestamp: Date.now(),
  });
  
  // Dispose resources
  LoggerFactory.getInstance().dispose();
  eventBus.dispose();
  
  logger.info('Shutdown complete');
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleConfigCommand(options: Record<string, unknown>): Promise<void> {
  const configPath = options.global
    ? join(homedir(), '.config', 'claude-code', 'config.yaml')
    : join(process.cwd(), '.claude-code', 'config.yaml');
  
  if (options.list) {
    const config = await loadConfig({ configPath });
    console.log(JSON.stringify(config.getConfig(), null, 2));
    return;
  }
  
  if (options.reset) {
    const config = new ConfigManager();
    await config.saveFile(configPath);
    console.log(`Configuration reset and saved to ${configPath}`);
    return;
  }
  
  if (options.edit) {
    // Open editor (simplified for now)
    console.log(`Edit configuration at: ${configPath}`);
    return;
  }
  
  // Default: show help
  console.log('Use --list to view configuration, --reset to reset, or --edit to edit');
}

async function handleSessionCommand(options: Record<string, unknown>): Promise<void> {
  const sessionDir = join(homedir(), '.claude-code', 'sessions');

  if (options.list) {
    console.log('Sessions:');
    try {
      if (existsSync(sessionDir)) {
        const files = require('fs').readdirSync(sessionDir).filter((f: string) => f.endsWith('.json'));
        if (files.length === 0) {
          console.log('  No saved sessions found.');
        } else {
          for (const file of files) {
            const id = file.replace('.json', '');
            try {
              const data = JSON.parse(readFileSync(join(sessionDir, file), 'utf-8'));
              const name = data.name || 'Unnamed';
              const date = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown';
              const msgCount = data.messages?.length || 0;
              console.log(`  ${id} - ${name} (${msgCount} messages, ${date})`);
            } catch {
              console.log(`  ${id} - (unable to read)`);
            }
          }
        }
      } else {
        console.log('  No sessions directory found.');
      }
    } catch (error) {
      console.error('Failed to list sessions:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (options.resume) {
    const sessionFile = join(sessionDir, `${options.resume}.json`);
    if (existsSync(sessionFile)) {
      console.log(`Resuming session: ${options.resume}`);
      // Pass session ID to main run flow
      await runMain(undefined, { ...options, sessionId: options.resume, directory: process.cwd() });
    } else {
      console.error(`Session not found: ${options.resume}`);
    }
    return;
  }

  if (options.delete) {
    const sessionFile = join(sessionDir, `${options.delete}.json`);
    try {
      if (existsSync(sessionFile)) {
        require('fs').unlinkSync(sessionFile);
        console.log(`Deleted session: ${options.delete}`);
      } else {
        console.error(`Session not found: ${options.delete}`);
      }
    } catch (error) {
      console.error('Failed to delete session:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (options.export) {
    const sessionFile = join(sessionDir, `${options.export}.json`);
    try {
      if (existsSync(sessionFile)) {
        const data = readFileSync(sessionFile, 'utf-8');
        console.log(data);
      } else {
        console.error(`Session not found: ${options.export}`);
      }
    } catch (error) {
      console.error('Failed to export session:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  console.log('Use --list, --resume <id>, --delete <id>, or --export <id>');
}

async function handlePluginCommand(options: Record<string, unknown>): Promise<void> {
  const pluginDir = join(homedir(), '.claude-code', 'plugins');

  if (options.list) {
    console.log('Installed plugins:');
    try {
      if (existsSync(pluginDir)) {
        const dirs = require('fs').readdirSync(pluginDir).filter((f: string) => {
          try {
            return require('fs').statSync(join(pluginDir, f)).isDirectory();
          } catch {
            return false;
          }
        });
        if (dirs.length === 0) {
          console.log('  No plugins installed.');
        } else {
          for (const dir of dirs) {
            const manifestPath = join(pluginDir, dir, 'manifest.json');
            try {
              if (existsSync(manifestPath)) {
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                console.log(`  ${manifest.name || dir} v${manifest.version || '?'} - ${manifest.description || ''}`);
              } else {
                console.log(`  ${dir} - (no manifest)`);
              }
            } catch {
              console.log(`  ${dir} - (unable to read)`);
            }
          }
        }
      } else {
        console.log('  No plugins directory found.');
      }
    } catch (error) {
      console.error('Failed to list plugins:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (options.install) {
    const sourcePath = String(options.install);
    console.log(`Installing plugin from: ${sourcePath}`);
    try {
      const fs = require('fs');
      if (!existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true });
      }
      const pluginName = require('path').basename(sourcePath);
      const destPath = join(pluginDir, pluginName);
      // Copy plugin directory
      fs.cpSync(sourcePath, destPath, { recursive: true });
      console.log(`Plugin installed to: ${destPath}`);
    } catch (error) {
      console.error('Failed to install plugin:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (options.uninstall) {
    const pluginName = String(options.uninstall);
    const pluginPath = join(pluginDir, pluginName);
    try {
      if (existsSync(pluginPath)) {
        require('fs').rmSync(pluginPath, { recursive: true });
        console.log(`Uninstalled plugin: ${pluginName}`);
      } else {
        console.error(`Plugin not found: ${pluginName}`);
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  console.log('Use --list, --install <path>, or --uninstall <name>');
}

// ============================================================================
// Run CLI
// ============================================================================

program.parse();
