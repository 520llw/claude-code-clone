#!/usr/bin/env node
/**
 * Claude Code Clone - Interactive Configuration Generator
 *
 * Cross-platform script for configuring API providers.
 * Run with: bun run setup  (or node scripts/setup-config.js)
 */

import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

// ============================================================================
// Config
// ============================================================================

const CONFIG_DIR = platform() === 'win32'
  ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'claude-code')
  : join(homedir(), '.config', 'claude-code');

const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml');

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ],
    testUrl: 'https://api.anthropic.com/v1/messages',
    color: '\x1b[36m', // cyan
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
    testUrl: 'https://api.openai.com/v1/models',
    color: '\x1b[32m', // green
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    envVar: 'MOONSHOT_API_KEY',
    defaultModel: 'kimi-k2.5',
    models: ['kimi-k2.5', 'kimi-latest-8k', 'kimi-k2-0905-preview'],
    testUrl: 'https://api.moonshot.ai/v1/models',
    color: '\x1b[35m', // magenta
  },
];

const NC = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

// ============================================================================
// Readline Helper
// ============================================================================

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);

    let input = '';
    const onData = (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (c === '\u0003') {
        // Ctrl+C
        process.exit(0);
      } else if (c === '\u007f' || c === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += c;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

// ============================================================================
// API Validation
// ============================================================================

async function validateApiKey(provider, apiKey) {
  try {
    const headers = { 'Content-Type': 'application/json' };

    if (provider.id === 'anthropic') {
      headers['X-API-Key'] = apiKey;
      headers['Anthropic-Version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url = provider.testUrl;
    let method = 'GET';
    let body = undefined;

    // For Anthropic we need to POST to /messages with minimal payload
    if (provider.id === 'anthropic') {
      method = 'POST';
      body = JSON.stringify({
        model: provider.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 200 or 401 means we reached the server (401 = invalid key)
    if (response.ok || response.status === 200) {
      return { valid: true, message: 'API key validated successfully' };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, message: 'Invalid API key (authentication failed)' };
    } else {
      // Other statuses (like 400) may still mean the key is valid
      return { valid: true, message: `Server responded with ${response.status} (key likely valid)` };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { valid: false, message: 'Connection timed out' };
    }
    return { valid: false, message: `Connection error: ${err.message}` };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`
${CYAN}${BOLD}Claude Code Clone - Configuration Setup${NC}
${DIM}Configure your AI providers and models${NC}
`);

  // Select provider
  console.log(`${BOLD}Select a provider:${NC}`);
  PROVIDERS.forEach((p, i) => {
    const envStatus = process.env[p.envVar] ? `${GREEN}(key found in env)${NC}` : `${DIM}(${p.envVar})${NC}`;
    console.log(`  ${p.color}${i + 1})${NC} ${p.name} ${envStatus}`);
  });
  console.log(`  ${YELLOW}4)${NC} Custom provider`);
  console.log('');

  const providerChoice = await ask(`Select [1-4] (default: 1): `) || '1';
  const providerIndex = parseInt(providerChoice) - 1;

  let provider, model, apiKey, baseUrl;

  if (providerIndex >= 0 && providerIndex < PROVIDERS.length) {
    provider = PROVIDERS[providerIndex];

    // API Key
    console.log(`\n${provider.color}${BOLD}${provider.name}${NC}`);

    const envKey = process.env[provider.envVar];
    if (envKey) {
      const useEnv = await ask(`Found ${provider.envVar} in environment. Use it? [Y/n]: `) || 'y';
      if (useEnv.toLowerCase() === 'y') {
        apiKey = envKey;
      }
    }

    if (!apiKey) {
      apiKey = await askSecret(`Enter API key: `);
    }

    // Validate
    if (apiKey) {
      process.stdout.write(`${DIM}Validating API key...${NC} `);
      const result = await validateApiKey(provider, apiKey);
      if (result.valid) {
        console.log(`${GREEN}${result.message}${NC}`);
      } else {
        console.log(`${RED}${result.message}${NC}`);
        const proceed = await ask(`Continue anyway? [y/N]: `) || 'n';
        if (proceed.toLowerCase() !== 'y') {
          console.log('Setup cancelled.');
          rl.close();
          return;
        }
      }
    }

    // Select model
    console.log(`\n${BOLD}Select model:${NC}`);
    provider.models.forEach((m, i) => {
      const isDefault = m === provider.defaultModel ? ` ${GREEN}(default)${NC}` : '';
      console.log(`  ${i + 1}) ${m}${isDefault}`);
    });
    console.log('');

    const modelChoice = await ask(`Select [1-${provider.models.length}] (default: 1): `) || '1';
    const modelIndex = parseInt(modelChoice) - 1;
    model = provider.models[modelIndex] || provider.defaultModel;

  } else {
    // Custom provider
    console.log(`\n${YELLOW}${BOLD}Custom Provider${NC}`);
    const customId = await ask('Provider ID (e.g., "my-provider"): ');
    baseUrl = await ask('Base URL (e.g., "https://api.example.com/v1"): ');
    model = await ask('Model name: ');
    apiKey = await askSecret('API key: ');

    provider = { id: customId || 'custom', name: 'Custom', defaultModel: model };
  }

  // Generate config
  const configYaml = `# Claude Code Clone Configuration
# Generated by setup-config.js on ${new Date().toISOString()}

model:
  provider: ${provider.id}
  name: ${model}
  apiKey: "${apiKey || ''}"${baseUrl ? `\n  baseUrl: "${baseUrl}"` : ''}
  maxTokens: 16000
  temperature: 0

context:
  maxTokens: 200000
  compression:
    enabled: true
    strategy: auto-compact
    threshold: 0.8
    preserveRecent: 10

permissions:
  default: ask
  tools:
    View: auto
    Read: auto
    Search: auto
    Edit: ask
    Bash: ask

ui:
  theme: default
  showTimestamps: false
  showTokenCount: true
  compactMode: false
  animations: true

features:
  multi-agent: true
  context-compression: true
  mcp-support: true
  plugin-system: true
  streaming: true
`;

  // Save
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, configYaml, 'utf-8');
  console.log(`\n${GREEN}${BOLD}Configuration saved!${NC}`);
  console.log(`  ${DIM}File:${NC}     ${CONFIG_FILE}`);
  console.log(`  ${DIM}Provider:${NC} ${provider.name}`);
  console.log(`  ${DIM}Model:${NC}    ${model}`);
  console.log(`\n${BOLD}Run 'bun run start' or 'ccode' to begin!${NC}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(`${RED}Error: ${err.message}${NC}`);
  rl.close();
  process.exit(1);
});
