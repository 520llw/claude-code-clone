#!/usr/bin/env node
/**
 * Post-install Script
 * 
 * Runs after npm install to set up the environment.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message) {
  console.log(`${colors.cyan}[postinstall]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[postinstall]${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}[postinstall]${colors.reset} ${message}`);
}

async function main() {
  // Skip if running in CI
  if (process.env.CI) {
    return;
  }

  log('Setting up Claude Code Clone...');

  // Create config directory
  const configDir = path.join(os.homedir(), '.config', 'claude-code-clone');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    log(`Created config directory: ${configDir}`);
  }

  // Create default config if not exists
  const configPath = path.join(configDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      telemetry: true,
      errorReporting: true,
      theme: 'dark',
      autoUpdate: true,
      updateChannel: 'stable'
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log('Created default configuration');
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    warn('ANTHROPIC_API_KEY not set');
    warn('Set it with: export ANTHROPIC_API_KEY="your-api-key"');
  }

  success('Setup complete!');
  console.log('');
  console.log('Quick start:');
  console.log('  claude-code --help       Show help');
  console.log('  claude-code --version    Show version');
  console.log('  claude-code              Start interactive session');
  console.log('');
}

main().catch(() => {
  // Silently fail - don't break install
});
