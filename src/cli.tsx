#!/usr/bin/env bun
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
import { join } from 'node:path';
import { exists } from 'node:fs/promises';

// Core imports
import { ConfigManager, loadConfig } from '@config/index';
import { Logger, LoggerFactory } from '@utils/logger';
import { globalErrorHandler } from '@core/errors';
import { eventBus, SystemEvents } from '@core/events';

// UI imports
import { App } from '@ui/app';

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

async function runMain(initialPrompt: string | undefined, options: any): Promise<void> {
  const logger = createLogger(options.debug);
  
  try {
    // Initialize error handling
    setupErrorHandling(logger);
    
    // Load configuration
    const config = await initializeConfig(options, logger);
    
    // Set up logging based on config
    if (options.debug) {
      LoggerFactory.getInstance().setDefaultLevel('debug');
    }
    
    logger.info('Starting Claude Code Clone', {
      version: '1.0.0',
      directory: options.directory,
      model: config.get('model.name'),
    });
    
    // Emit system initialized event
    eventBus.emit(SystemEvents.INITIALIZED, {
      timestamp: Date.now(),
      config: config.getConfig(),
    });
    
    // Render the UI
    const { waitUntilExit } = render(
      <App
        initialPrompt={initialPrompt}
        workingDirectory={options.directory}
        config={config}
        logger={logger}
      />,
      {
        exitOnCtrlC: true,
      }
    );
    
    // Wait for the UI to exit
    await waitUntilExit();
    
    // Clean shutdown
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
  options: any,
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

async function handleConfigCommand(options: any): Promise<void> {
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

async function handleSessionCommand(options: any): Promise<void> {
  if (options.list) {
    console.log('Sessions:');
    // TODO: Implement session listing
    return;
  }
  
  if (options.resume) {
    console.log(`Resuming session: ${options.resume}`);
    // TODO: Implement session resumption
    return;
  }
  
  if (options.delete) {
    console.log(`Deleting session: ${options.delete}`);
    // TODO: Implement session deletion
    return;
  }
  
  if (options.export) {
    console.log(`Exporting session: ${options.export}`);
    // TODO: Implement session export
    return;
  }
  
  console.log('Use --list, --resume <id>, --delete <id>, or --export <id>');
}

async function handlePluginCommand(options: any): Promise<void> {
  if (options.list) {
    console.log('Installed plugins:');
    // TODO: Implement plugin listing
    return;
  }
  
  if (options.install) {
    console.log(`Installing plugin from: ${options.install}`);
    // TODO: Implement plugin installation
    return;
  }
  
  if (options.uninstall) {
    console.log(`Uninstalling plugin: ${options.uninstall}`);
    // TODO: Implement plugin uninstallation
    return;
  }
  
  console.log('Use --list, --install <path>, or --uninstall <name>');
}

// ============================================================================
// Run CLI
// ============================================================================

program.parse();
