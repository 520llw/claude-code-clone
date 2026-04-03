# Frequently Asked Questions

Common questions and answers about Claude Code Clone.

## Table of Contents

1. [General Questions](#general-questions)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Tools](#tools)
6. [API & Models](#api--models)
7. [Security](#security)
8. [Performance](#performance)
9. [Troubleshooting](#troubleshooting)
10. [Development](#development)

## General Questions

### What is Claude Code Clone?

Claude Code Clone is an AI-powered coding assistant that brings the capabilities of advanced language models directly to your development workflow. It provides a conversational interface where you can interact with your codebase using natural language.

### How is it different from other AI coding tools?

Claude Code Clone differs in several ways:

- **Context Awareness**: Understands your entire project, not just the current file
- **Multi-file Operations**: Makes coordinated changes across multiple files
- **Integrated Tooling**: Built-in support for file operations, shell commands, and more
- **Extensible**: Plugin system for custom functionality
- **Terminal-based**: Works directly in your development environment

### Is it free to use?

Claude Code Clone is open-source and free to use. However, it requires an API key from an AI provider (like Anthropic or OpenAI), which may have associated costs based on usage.

### What platforms are supported?

Claude Code Clone supports:

- macOS 10.15+
- Ubuntu 18.04+ / Debian 9+
- Windows 10+ (with WSL2 recommended)
- Any platform with Node.js 18+

### What programming languages are supported?

Claude Code Clone works with any programming language. The AI can understand and work with:

- JavaScript / TypeScript
- Python
- Java
- Go
- Rust
- Ruby
- C/C++
- C#
- PHP
- And many more...

## Installation

### How do I install Claude Code Clone?

```bash
# Using npm (recommended)
npm install -g claude-code-clone

# Using yarn
yarn global add claude-code-clone

# Using pnpm
pnpm add -g claude-code-clone
```

See the [Installation Guide](user/installation.md) for detailed instructions.

### What are the system requirements?

**Minimum:**
- Node.js 18.0+
- 4 GB RAM
- 2 GB disk space

**Recommended:**
- Node.js 20+
- 16 GB RAM
- SSD storage

### How do I update Claude Code Clone?

```bash
# Using npm
npm update -g claude-code-clone

# Using yarn
yarn global upgrade claude-code-clone

# Using pnpm
pnpm update -g claude-code-clone
```

### How do I uninstall Claude Code Clone?

```bash
# Using npm
npm uninstall -g claude-code-clone

# Using yarn
yarn global remove claude-code-clone

# Using pnpm
pnpm remove -g claude-code-clone

# Remove configuration
rm -rf ~/.claude-code-clone
```

### Why do I get "command not found" after installation?

This usually means the npm global bin directory is not in your PATH.

**Fix:**
```bash
# Find npm bin directory
npm bin -g

# Add to PATH
export PATH="$(npm bin -g):$PATH"

# Or use npx
npx claude-code-clone
```

## Configuration

### Where is the configuration stored?

**Global configuration:**
- macOS/Linux: `~/.claude-code-clone/config.json`
- Windows: `%USERPROFILE%\.claude-code-clone\config.json`

**Project configuration:**
- `.claude-code-clone/config.json` (in project root)

### How do I set my API key?

```bash
# Using CLI
claude-code-clone config set api.key YOUR_API_KEY

# Using environment variable
export ANTHROPIC_API_KEY="YOUR_API_KEY"
```

### Which AI model should I use?

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| Claude 3 Opus | Complex tasks, coding | Slower | Higher |
| Claude 3 Sonnet | Balanced performance | Medium | Medium |
| Claude 3 Haiku | Fast responses | Fast | Lower |

**Recommendation:** Start with Claude 3 Sonnet for most tasks.

### How do I change the theme?

```bash
# Using CLI
claude-code-clone config set ui.theme light

# Or during session
> /theme light
```

Available themes: `dark`, `light`, `high-contrast`, `auto`

### Can I use a local AI model?

Yes! Claude Code Clone supports local models through:

- **Ollama**: Run models locally
- **LM Studio**: GUI for local models
- **Custom endpoints**: Configure your own

```bash
claude-code-clone config set api.provider ollama
claude-code-clone config set api.base_url http://localhost:11434
```

## Usage

### How do I start a session?

```bash
# Start in current directory
claude-code-clone

# Start in specific directory
claude-code-clone /path/to/project
```

### How do I reference files?

Use the `@` symbol:

```
> Explain @src/main.js
> Review @file1.js and @file2.js
> Compare @old.js with @new.js
> Fix the bug in @src/auth.js line 45
```

### How do I save a session?

```
> /save my-session
```

### How do I load a saved session?

```bash
# From command line
claude-code-clone --session my-session

# Or during session
> /load my-session
```

### Can I use Claude Code Clone in scripts?

Yes! Use command mode:

```bash
claude-code-clone --command "explain src/main.js"
```

Or batch mode:

```bash
claude-code-clone --batch operations.json
```

### How do I exit?

```
> /exit
# or
Ctrl+D
# or
Ctrl+C
```

## Tools

### What tools are available?

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Create/overwrite files |
| `edit_file` | Modify existing files |
| `shell` | Execute shell commands |
| `search` | Search code patterns |
| `git` | Git operations |
| `browser` | Web browser automation |

### How do I enable/disable tools?

```bash
# Enable a tool
claude-code-clone tools enable browser

# Disable a tool
claude-code-clone tools disable shell

# Or in config
{
  "tools": {
    "enabled": ["file", "shell"],
    "disabled": ["browser"]
  }
}
```

### Can I create custom tools?

Yes! See the [Plugin Development Guide](developer/plugins.md) for details.

### Why is the shell tool blocked?

The shell tool may be blocked for security. To enable:

```bash
claude-code-clone tools enable shell
```

Or configure allowed commands:

```json
{
  "tools": {
    "shell": {
      "enabled": true,
      "allowed_commands": ["npm", "git", "node"]
    }
  }
}
```

## API & Models

### Which AI providers are supported?

- **Anthropic Claude** (recommended)
- **OpenAI GPT**
- **Azure OpenAI**
- **Local models** (via Ollama)
- **Custom endpoints**

### How do I get an API key?

**Anthropic:**
1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create an account
3. Generate an API key

**OpenAI:**
1. Visit [platform.openai.com](https://platform.openai.com/)
2. Create an account
3. Generate an API key

### How much does it cost?

Costs depend on:
- Your AI provider
- The model used
- Your usage volume

**Anthropic Claude 3 pricing (approximate):**
- Opus: ~$15/M tokens input, ~$75/M tokens output
- Sonnet: ~$3/M tokens input, ~$15/M tokens output
- Haiku: ~$0.25/M tokens input, ~$1.25/M tokens output

### Can I use it offline?

Yes, with local models:

1. Install Ollama
2. Download a model
3. Configure Claude Code Clone to use local endpoint

```bash
claude-code-clone config set api.provider ollama
claude-code-clone config set api.base_url http://localhost:11434
```

### How do I check my API usage?

```bash
# Check token usage in session
> /stats session

# Or check provider dashboard
# Anthropic: console.anthropic.com
# OpenAI: platform.openai.com
```

## Security

### Is my code sent to the AI provider?

Yes, when you interact with Claude Code Clone:

- Referenced files are sent for context
- Your queries are sent for processing
- Tool outputs may be sent

### How is my API key stored?

By default, API keys are stored in:
- **macOS**: Keychain
- **Linux**: Secret Service API / libsecret
- **Windows**: Credential Manager

You can also use environment variables.

### Can I restrict file access?

Yes, configure allowed/blocked paths:

```json
{
  "security": {
    "allowed_paths": ["./src", "./tests"],
    "blocked_paths": ["./secrets", "./.env"]
  }
}
```

### Can I block dangerous commands?

Yes, configure blocked commands:

```json
{
  "tools": {
    "shell": {
      "blocked_commands": ["rm -rf /", "sudo", "chmod -R"]
    }
  }
}
```

### Is it safe to use on production code?

**Recommendations:**
- Always review AI-generated changes
- Use version control
- Test changes before deploying
- Enable confirmation prompts
- Configure security settings

## Performance

### Why is it slow?

Possible causes:

1. **Large context**: Too many files loaded
2. **Complex queries**: Requesting complex operations
3. **Network**: Slow connection to AI provider
4. **Model choice**: More capable models are slower

**Solutions:**

```bash
# Reduce context size
claude-code-clone config set api.context.max_files 20

# Use faster model
claude-code-clone config set api.model claude-3-haiku

# Enable caching
claude-code-clone config set performance.cache_enabled true
```

### How can I make it faster?

1. **Use a faster model** (Haiku instead of Opus)
2. **Reduce context size** (fewer files)
3. **Enable caching**
4. **Clear old sessions**
5. **Use specific queries** (less ambiguity)

### How much memory does it use?

Typical usage:
- Base: ~100-200 MB
- With large context: ~500 MB - 1 GB
- Peak during operations: ~1-2 GB

### Can I run it on a server?

Yes! Use daemon mode:

```bash
claude-code-clone --daemon start
```

## Troubleshooting

### "API key not configured" error

**Solution:**
```bash
claude-code-clone config set api.key YOUR_API_KEY
# or
export ANTHROPIC_API_KEY="YOUR_API_KEY"
```

### "Unable to connect to API" error

**Solutions:**
1. Check internet connection
2. Verify API key is correct
3. Check API status page
4. Configure proxy if needed

### "Rate limit exceeded" error

**Solutions:**
1. Wait and retry
2. Reduce request frequency
3. Upgrade your API plan
4. Enable response caching

### "Context window exceeded" error

**Solutions:**
```bash
# Reduce context
claude-code-clone config set api.context.max_files 10

# Clear conversation
> /clear

# Start new session
> /start
```

### Garbled text display

**Solutions:**
```bash
# Check terminal encoding
export LANG=en_US.UTF-8

# Use compatible terminal
# Disable special characters
claude-code-clone config set ui.ascii_only true
```

### How do I debug issues?

```bash
# Run diagnostics
claude-code-clone doctor

# Enable debug logging
export CLAUDE_CODE_LOG_LEVEL=debug

# Check logs
> /logs
```

## Development

### How do I contribute?

See the [Contributing Guide](developer/contributing.md):

1. Fork the repository
2. Create a branch
3. Make changes
4. Submit a pull request

### How do I create a plugin?

See the [Plugin Development Guide](developer/plugins.md):

```typescript
const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  tools: [myTool],
  hooks: [myHook]
};
```

### How do I run tests?

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# With coverage
npm run test:coverage
```

### How do I build from source?

```bash
git clone https://github.com/claude-code-clone/claude-code-clone.git
cd claude-code-clone
npm install
npm run build
npm link
```

---

**Still have questions?**

- Check the [full documentation](README.md)
- Join our [Discord community](https://discord.gg/claude-code-clone)
- Open an issue on [GitHub](https://github.com/claude-code-clone/issues)
- Email us at support@claude-code-clone.com
