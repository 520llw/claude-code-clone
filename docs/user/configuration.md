# Configuration Guide

Complete guide to configuring Claude Code Clone for your workflow and preferences.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Configuration Files](#configuration-files)
3. [API Configuration](#api-configuration)
4. [UI Configuration](#ui-configuration)
5. [Editor Configuration](#editor-configuration)
6. [Tool Configuration](#tool-configuration)
7. [Security Configuration](#security-configuration)
8. [Advanced Configuration](#advanced-configuration)
9. [Environment Variables](#environment-variables)
10. [Configuration Examples](#configuration-examples)

## Configuration Overview

Claude Code Clone uses a hierarchical configuration system that allows you to customize behavior at multiple levels:

1. **Default Configuration**: Built-in defaults
2. **Global Configuration**: User-wide settings
3. **Project Configuration**: Project-specific settings
4. **Session Configuration**: Temporary session settings
5. **Environment Variables**: Runtime overrides

### Configuration Priority

Settings are applied in this order (later overrides earlier):

```
Defaults → Global Config → Project Config → Environment Variables → Session Config
```

### Configuration Commands

```bash
# Show all configuration
claude-code-clone config --list

# Get a specific value
claude-code-clone config get api.model

# Set a value
claude-code-clone config set api.model claude-3-opus

# Remove a setting
claude-code-clone config delete api.model

# Initialize configuration
claude-code-clone config --init

# Validate configuration
claude-code-clone config --validate

# Reset to defaults
claude-code-clone config --reset
```

## Configuration Files

### Global Configuration

**Location:**
- macOS/Linux: `~/.claude-code-clone/config.json`
- Windows: `%USERPROFILE%\.claude-code-clone\config.json`

**Purpose:** User-wide default settings

**Structure:**
```json
{
  "api": { /* API settings */ },
  "ui": { /* UI settings */ },
  "editor": { /* Editor settings */ },
  "tools": { /* Tool settings */ },
  "logging": { /* Logging settings */ },
  "security": { /* Security settings */ }
}
```

### Project Configuration

**Location:** `.claude-code-clone/config.json` (in project root)

**Purpose:** Project-specific settings that override global config

**Structure:**
```json
{
  "project": {
    "name": "my-project",
    "type": "nodejs",
    "exclude": ["node_modules"],
    "include": ["src"]
  },
  "ai": {
    "context_files": ["README.md"],
    "code_style": "standard"
  }
}
```

### Session Configuration

**Location:** Temporary, stored in memory

**Purpose:** Runtime overrides for current session only

**Usage:**
```bash
# Set session-only configuration
claude-code-clone config set --session api.model claude-3-sonnet
```

### Configuration Schema

All configuration files follow a JSON schema:

```json
{
  "$schema": "https://claude-code-clone.com/schema/config.json",
  "type": "object",
  "properties": {
    "api": { "$ref": "#/definitions/api" },
    "ui": { "$ref": "#/definitions/ui" },
    "editor": { "$ref": "#/definitions/editor" },
    "tools": { "$ref": "#/definitions/tools" }
  }
}
```

## API Configuration

Configure AI model access and behavior.

### Provider Settings

```json
{
  "api": {
    "provider": "anthropic",
    "key": "sk-ant-...",
    "base_url": "https://api.anthropic.com",
    "timeout": 60000
  }
}
```

**Supported Providers:**

| Provider | Value | Description |
|----------|-------|-------------|
| Anthropic | `anthropic` | Claude models (recommended) |
| OpenAI | `openai` | GPT models |
| Azure | `azure` | Azure OpenAI |
| Local | `ollama` | Local models via Ollama |
| Custom | `custom` | Custom API endpoint |

### Model Settings

```json
{
  "api": {
    "model": "claude-3-opus-20240229",
    "max_tokens": 4096,
    "temperature": 0.7,
    "top_p": 1.0,
    "top_k": null
  }
}
```

**Available Models (Anthropic):**

| Model | ID | Best For |
|-------|-----|----------|
| Claude 3 Opus | `claude-3-opus-20240229` | Complex tasks, coding |
| Claude 3 Sonnet | `claude-3-sonnet-20240229` | Balanced performance |
| Claude 3 Haiku | `claude-3-haiku-20240307` | Fast responses |

**Parameters:**

- **max_tokens**: Maximum response length (1-8192)
- **temperature**: Creativity level (0.0-1.0)
  - 0.0: Deterministic, focused
  - 0.7: Balanced (default)
  - 1.0: Creative, varied
- **top_p**: Nucleus sampling (0.0-1.0)
- **top_k**: Top-k sampling (1-100)

### Request Configuration

```json
{
  "api": {
    "requests": {
      "max_retries": 3,
      "retry_delay": 1000,
      "timeout": 60000,
      "concurrent": 5
    }
  }
}
```

### Context Configuration

```json
{
  "api": {
    "context": {
      "max_files": 50,
      "max_tokens": 100000,
      "include_project_structure": true,
      "include_git_info": true
    }
  }
}
```

## UI Configuration

Customize the user interface appearance and behavior.

### Theme Settings

```json
{
  "ui": {
    "theme": "dark",
    "color_scheme": "default",
    "high_contrast": false
  }
}
```

**Available Themes:**

| Theme | Description |
|-------|-------------|
| `dark` | Dark background (default) |
| `light` | Light background |
| `high-contrast` | High contrast for accessibility |
| `auto` | Follow system preference |

**Color Schemes:**

| Scheme | Description |
|--------|-------------|
| `default` | Standard colors |
| `solarized` | Solarized color palette |
| `monokai` | Monokai-inspired |
| `dracula` | Dracula theme |

### Display Settings

```json
{
  "ui": {
    "syntax_highlighting": true,
    "line_numbers": true,
    "wrap_lines": true,
    "show_whitespace": false,
    "tab_width": 2,
    "font_size": 14,
    "font_family": "monospace"
  }
}
```

### Interaction Settings

```json
{
  "ui": {
    "confirm_destructive": true,
    "show_progress": true,
    "auto_save": true,
    "save_history": true,
    "history_size": 1000,
    "scrollback": 10000
  }
}
```

### Notification Settings

```json
{
  "ui": {
    "notifications": {
      "enabled": true,
      "sound": false,
      "desktop": true,
      "on_complete": true,
      "on_error": true
    }
  }
}
```

## Editor Configuration

Configure external editor integration.

### Editor Selection

```json
{
  "editor": {
    "default_editor": "vscode",
    "open_in_editor": true,
    "editor_args": ["--goto"]
  }
}
```

**Supported Editors:**

| Editor | Value | Command |
|--------|-------|---------|
| VS Code | `vscode` | `code` |
| Vim | `vim` | `vim` |
| Neovim | `nvim` | `nvim` |
| Emacs | `emacs` | `emacs` |
| Sublime | `sublime` | `subl` |
| Atom | `atom` | `atom` |
| IntelliJ | `intellij` | `idea` |

### Code Style

```json
{
  "editor": {
    "tab_size": 2,
    "use_spaces": true,
    "trim_trailing_whitespace": true,
    "insert_final_newline": true,
    "max_line_length": 100
  }
}
```

### Formatting

```json
{
  "editor": {
    "format_on_save": true,
    "formatter": "prettier",
    "formatter_args": ["--single-quote"]
  }
}
```

## Tool Configuration

Configure built-in tools and their behavior.

### Tool Enablement

```json
{
  "tools": {
    "enabled": ["file", "shell", "search", "git", "browser"],
    "disabled": []
  }
}
```

### File Tool

```json
{
  "tools": {
    "file": {
      "max_size": 1048576,
      "encoding": "utf-8",
      "backup": true,
      "backup_suffix": ".bak"
    }
  }
}
```

### Shell Tool

```json
{
  "tools": {
    "shell": {
      "enabled": true,
      "shell": "/bin/bash",
      "working_directory": ".",
      "timeout": 30000,
      "allowed_commands": ["npm", "yarn", "git", "node", "python"],
      "blocked_commands": ["rm -rf /", "sudo", "chmod -R"],
      "require_confirmation": true,
      "show_output": true
    }
  }
}
```

### Search Tool

```json
{
  "tools": {
    "search": {
      "case_sensitive": false,
      "whole_word": false,
      "regex": true,
      "max_results": 100,
      "exclude_patterns": ["node_modules", ".git", "dist"]
    }
  }
}
```

### Git Tool

```json
{
  "tools": {
    "git": {
      "enabled": true,
      "auto_commit": false,
      "commit_message_template": "AI: {description}",
      "require_confirmation": true,
      "show_diff": true
    }
  }
}
```

### Browser Tool

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "headless": true,
      "timeout": 30000,
      "user_agent": "Claude-Code-Clone/1.0"
    }
  }
}
```

## Security Configuration

Configure security settings and permissions.

### General Security

```json
{
  "security": {
    "confirm_destructive": true,
    "confirm_shell": true,
    "confirm_file_write": true,
    "max_file_size": 10485760,
    "allowed_paths": ["./src", "./tests"],
    "blocked_paths": ["./secrets", "./.env"]
  }
}
```

### API Security

```json
{
  "security": {
    "api": {
      "key_storage": "keychain",
      "encrypt_config": true,
      "rotate_key_warning": 30
    }
  }
}
```

**Key Storage Options:**

| Method | Description |
|--------|-------------|
| `plaintext` | Store in config file (not recommended) |
| `keychain` | Use OS keychain (recommended) |
| `env` | Read from environment variable |
| `prompt` | Prompt each time |

## Advanced Configuration

### Logging

```json
{
  "logging": {
    "level": "info",
    "file": "~/.claude-code-clone/logs/claude-code-clone.log",
    "max_size": "10mb",
    "max_files": 5,
    "console": true,
    "format": "json"
  }
}
```

**Log Levels:**

| Level | Description |
|-------|-------------|
| `error` | Errors only |
| `warn` | Warnings and errors |
| `info` | General information (default) |
| `debug` | Detailed debugging |
| `trace` | Very detailed tracing |

### Performance

```json
{
  "performance": {
    "cache_enabled": true,
    "cache_size": "100mb",
    "cache_ttl": 3600,
    "parallel_requests": 5,
    "stream_responses": true
  }
}
```

### Plugins

```json
{
  "plugins": {
    "directory": "~/.claude-code-clone/plugins",
    "enabled": ["plugin-name"],
    "disabled": [],
    "auto_update": true,
    "registry": "https://registry.claude-code-clone.com"
  }
}
```

### Updates

```json
{
  "updates": {
    "auto": true,
    "channel": "stable",
    "check_interval": 86400,
    "notify_only": false
  }
}
```

**Channels:**

| Channel | Description |
|---------|-------------|
| `stable` | Production releases |
| `beta` | Beta releases |
| `nightly` | Latest development |

## Environment Variables

All configuration options can be set via environment variables.

### Variable Naming Convention

Environment variables use the prefix `CLAUDE_CODE_` and uppercase names:

```
CLAUDE_CODE_<SECTION>_<KEY>
```

### Common Environment Variables

```bash
# API Configuration
export ANTHROPIC_API_KEY="sk-ant-..."
export CLAUDE_CODE_API_PROVIDER="anthropic"
export CLAUDE_CODE_API_MODEL="claude-3-opus-20240229"
export CLAUDE_CODE_API_MAX_TOKENS="4096"
export CLAUDE_CODE_API_TEMPERATURE="0.7"

# UI Configuration
export CLAUDE_CODE_UI_THEME="dark"
export CLAUDE_CODE_UI_SYNTAX_HIGHLIGHTING="true"
export CLAUDE_CODE_UI_CONFIRM_DESTRUCTIVE="true"

# Editor Configuration
export CLAUDE_CODE_EDITOR_DEFAULT_EDITOR="vscode"
export CLAUDE_CODE_EDITOR_TAB_SIZE="2"
export CLAUDE_CODE_EDITOR_USE_SPACES="true"

# Tool Configuration
export CLAUDE_CODE_TOOLS_ENABLED="file,shell,search,git"
export CLAUDE_CODE_TOOLS_SHELL_ALLOWED_COMMANDS="npm,yarn,git,node"

# Security Configuration
export CLAUDE_CODE_SECURITY_CONFIRM_DESTRUCTIVE="true"
export CLAUDE_CODE_SECURITY_ALLOWED_PATHS="./src,./tests"

# Logging Configuration
export CLAUDE_CODE_LOGGING_LEVEL="info"
export CLAUDE_CODE_LOGGING_FILE="~/.claude-code-clone/logs/claude-code-clone.log"

# Paths
export CLAUDE_CODE_CONFIG_DIR="~/.claude-code-clone"
export CLAUDE_CODE_CACHE_DIR="~/.cache/claude-code-clone"
export CLAUDE_CODE_PLUGIN_DIR="~/.claude-code-clone/plugins"
```

### Boolean Values

Boolean environment variables accept:

- `true`, `1`, `yes`, `on` → True
- `false`, `0`, `no`, `off` → False

### Array Values

Arrays are specified as comma-separated values:

```bash
export CLAUDE_CODE_TOOLS_ENABLED="file,shell,search,git"
```

## Configuration Examples

### Minimal Configuration

```json
{
  "api": {
    "key": "sk-ant-..."
  }
}
```

### Development Configuration

```json
{
  "api": {
    "provider": "anthropic",
    "key": "sk-ant-...",
    "model": "claude-3-sonnet-20240229",
    "temperature": 0.8
  },
  "ui": {
    "theme": "dark",
    "syntax_highlighting": true
  },
  "tools": {
    "shell": {
      "allowed_commands": ["npm", "yarn", "git", "node", "pytest"],
      "require_confirmation": false
    }
  },
  "logging": {
    "level": "debug"
  }
}
```

### Production Configuration

```json
{
  "api": {
    "provider": "anthropic",
    "key": "${ANTHROPIC_API_KEY}",
    "model": "claude-3-opus-20240229",
    "temperature": 0.3,
    "max_tokens": 2048
  },
  "ui": {
    "confirm_destructive": true,
    "auto_save": true
  },
  "security": {
    "confirm_destructive": true,
    "confirm_shell": true,
    "confirm_file_write": true,
    "allowed_paths": ["./src"],
    "blocked_paths": ["./secrets", "./.env", "./config"]
  },
  "tools": {
    "shell": {
      "require_confirmation": true,
      "allowed_commands": ["npm", "git"],
      "blocked_commands": ["rm", "sudo"]
    }
  },
  "logging": {
    "level": "warn",
    "file": "/var/log/claude-code-clone.log"
  }
}
```

### Team Configuration

```json
{
  "project": {
    "name": "team-project",
    "type": "nodejs",
    "exclude": ["node_modules", ".git", "dist", "coverage"],
    "include": ["src", "tests", "docs"]
  },
  "ai": {
    "context_files": ["README.md", "CONTRIBUTING.md", "package.json"],
    "code_style": "airbnb",
    "documentation_style": "jsdoc"
  },
  "editor": {
    "tab_size": 2,
    "use_spaces": true,
    "format_on_save": true,
    "formatter": "prettier"
  },
  "tools": {
    "enabled": ["file", "shell", "search", "git"],
    "shell": {
      "allowed_commands": ["npm", "yarn", "git", "node", "jest"],
      "require_confirmation": true
    }
  }
}
```

### CI/CD Configuration

```json
{
  "api": {
    "provider": "anthropic",
    "key": "${ANTHROPIC_API_KEY}",
    "model": "claude-3-haiku-20240307",
    "max_tokens": 1024
  },
  "ui": {
    "confirm_destructive": false,
    "show_progress": false
  },
  "tools": {
    "shell": {
      "require_confirmation": false,
      "show_output": false
    }
  },
  "logging": {
    "level": "error",
    "console": false
  }
}
```

---

**Configuration Quick Reference**

```bash
# View all config
claude-code-clone config --list

# Get a value
claude-code-clone config get api.model

# Set a value
claude-code-clone config set api.model claude-3-opus

# Set session-only
claude-code-clone config set --session ui.theme light

# Validate config
claude-code-clone config --validate

# Reset to defaults
claude-code-clone config --reset
```
