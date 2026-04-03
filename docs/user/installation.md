# Installation Guide

Complete installation instructions for Claude Code Clone on all supported platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Platform-Specific Instructions](#platform-specific-instructions)
4. [Configuration](#configuration)
5. [Verification](#verification)
6. [Updating](#updating)
7. [Uninstallation](#uninstallation)
8. [Troubleshooting Installation](#troubleshooting-installation)

## Prerequisites

Before installing Claude Code Clone, ensure you have the following prerequisites:

### Required Software

#### Node.js

Claude Code Clone requires Node.js version 18.0 or higher.

**Check your Node.js version:**
```bash
node --version
```

**Install or update Node.js:**

- **macOS** (using Homebrew):
  ```bash
  brew install node
  ```

- **Ubuntu/Debian**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- **Windows**:
  Download from [nodejs.org](https://nodejs.org/) or use Chocolatey:
  ```powershell
  choco install nodejs
  ```

#### Git

Git is required for version control integration.

**Check your Git version:**
```bash
git --version
```

**Install Git:**

- **macOS**:
  ```bash
  brew install git
  ```

- **Ubuntu/Debian**:
  ```bash
  sudo apt-get update
  sudo apt-get install git
  ```

- **Windows**:
  Download from [git-scm.com](https://git-scm.com/)

#### Package Manager

Choose one of the following package managers:

- **npm** (included with Node.js)
- **yarn** (recommended)
  ```bash
  npm install -g yarn
  ```
- **pnpm**
  ```bash
  npm install -g pnpm
  ```

### API Access

Claude Code Clone requires access to an AI model API. Supported providers:

- **Anthropic Claude** (recommended)
- **OpenAI GPT**
- **Local models** (via Ollama, etc.)

**Get an API key:**

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Generate an API key
4. Save it securely (you'll need it during configuration)

### System Resources

Ensure your system meets these minimum requirements:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 16 GB |
| Disk Space | 2 GB | 5 GB |
| CPU | 2 cores | 4+ cores |
| Network | 1 Mbps | 10+ Mbps |

## Installation Methods

### Method 1: Global Installation (Recommended)

Install Claude Code Clone globally for system-wide access:

**Using npm:**
```bash
npm install -g claude-code-clone
```

**Using yarn:**
```bash
yarn global add claude-code-clone
```

**Using pnpm:**
```bash
pnpm add -g claude-code-clone
```

### Method 2: Local Installation

Install in a specific project directory:

```bash
cd your-project
npm install claude-code-clone
```

**Usage with local installation:**
```bash
npx claude-code-clone
```

### Method 3: Development Installation

Install from source for development or customization:

```bash
# Clone the repository
git clone https://github.com/claude-code-clone/claude-code-clone.git
cd claude-code-clone

# Install dependencies
npm install

# Build the project
npm run build

# Link for global access
npm link

# Or run directly
npm start
```

### Method 4: Docker Installation

Run Claude Code Clone in a container:

```bash
# Pull the image
docker pull claude-code-clone/cli:latest

# Run with volume mount
docker run -it \
  -v $(pwd):/workspace \
  -v ~/.claude-code-clone:/root/.claude-code-clone \
  claude-code-clone/cli:latest
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  claude-code:
    image: claude-code-clone/cli:latest
    volumes:
      - .:/workspace
      - ~/.claude-code-clone:/root/.claude-code-clone
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    stdin_open: true
    tty: true
```

### Method 5: Package Manager Installation

#### macOS (Homebrew)

```bash
brew tap claude-code-clone/tap
brew install claude-code-clone
```

#### Linux (Snap)

```bash
sudo snap install claude-code-clone
```

#### Windows (Chocolatey)

```powershell
choco install claude-code-clone
```

#### Windows (Scoop)

```powershell
scoop bucket add claude-code-clone
scoop install claude-code-clone
```

## Platform-Specific Instructions

### macOS

#### Standard Installation

```bash
# Install Node.js if not already installed
brew install node

# Install Claude Code Clone globally
npm install -g claude-code-clone

# Verify installation
claude-code-clone --version
```

#### Apple Silicon (M1/M2/M3) Notes

For optimal performance on Apple Silicon:

```bash
# Ensure Rosetta 2 is installed (if needed)
softwareupdate --install-rosetta --agree-to-license

# Use native ARM64 Node.js
arch -arm64 brew install node

# Install Claude Code Clone
arch -arm64 npm install -g claude-code-clone
```

#### macOS Security

If you encounter security warnings:

1. **Gatekeeper blocking**:
   ```bash
   # Remove quarantine attribute
   xattr -dr com.apple.quarantine $(which claude-code-clone)
   ```

2. **Permission denied**:
   ```bash
   # Fix permissions
   sudo chmod +x $(which claude-code-clone)
   ```

### Linux

#### Ubuntu/Debian

```bash
# Update package list
sudo apt-get update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Claude Code Clone
sudo npm install -g claude-code-clone

# Fix permissions if needed
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

#### CentOS/RHEL/Fedora

```bash
# For CentOS/RHEL 7/8
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# For Fedora
sudo dnf install nodejs

# Install Claude Code Clone
sudo npm install -g claude-code-clone
```

#### Arch Linux

```bash
# Install Node.js
sudo pacman -S nodejs npm

# Install Claude Code Clone
npm install -g claude-code-clone
```

#### Linux Permissions

If you encounter permission issues:

```bash
# Option 1: Change npm prefix to user directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Use npx (no global install needed)
npx claude-code-clone
```

### Windows

#### Standard Installation

```powershell
# Install Node.js from nodejs.org first
# Then install Claude Code Clone
npm install -g claude-code-clone
```

#### Windows Subsystem for Linux (WSL) - Recommended

For the best experience on Windows, use WSL2:

```bash
# In WSL2 terminal
# Follow Ubuntu/Debian instructions above
```

**Benefits of WSL:**
- Better file system performance
- Native Unix tools support
- Improved terminal experience
- Better compatibility with development tools

#### PowerShell Installation

```powershell
# Install using PowerShell
npm install -g claude-code-clone

# Add to PATH if needed
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Users\$env:USERNAME\AppData\Roaming\npm",
    "User"
)
```

#### Windows Terminal Configuration

For optimal display in Windows Terminal:

```json
{
  "profiles": {
    "defaults": {
      "font": {
        "face": "Cascadia Code",
        "size": 12
      },
      "useAcrylic": true,
      "acrylicOpacity": 0.8
    }
  }
}
```

## Configuration

### Initial Configuration

After installation, configure Claude Code Clone:

```bash
# Interactive configuration wizard
claude-code-clone config --init

# Or set configuration values directly
claude-code-clone config set api.provider anthropic
claude-code-clone config set api.key YOUR_API_KEY
```

### Configuration File Locations

**Global Configuration:**
- macOS/Linux: `~/.claude-code-clone/config.json`
- Windows: `%USERPROFILE%\.claude-code-clone\config.json`

**Project Configuration:**
- `.claude-code-clone/config.json` (in project root)

**Example Configuration:**

```json
{
  "api": {
    "provider": "anthropic",
    "key": "sk-ant-...",
    "model": "claude-3-opus-20240229",
    "max_tokens": 4096,
    "temperature": 0.7
  },
  "ui": {
    "theme": "dark",
    "syntax_highlighting": true,
    "line_numbers": true,
    "confirm_destructive": true
  },
  "editor": {
    "default_editor": "vscode",
    "tab_size": 2,
    "use_spaces": true
  },
  "tools": {
    "enabled": ["file", "shell", "search", "git"],
    "shell": {
      "allowed_commands": ["npm", "yarn", "git", "node"],
      "blocked_commands": ["rm -rf /", "sudo"]
    }
  },
  "logging": {
    "level": "info",
    "file": "~/.claude-code-clone/logs/claude-code-clone.log"
  }
}
```

### Environment Variables

You can also configure via environment variables:

```bash
# API Configuration
export ANTHROPIC_API_KEY="sk-ant-..."
export CLAUDE_CODE_PROVIDER="anthropic"
export CLAUDE_CODE_MODEL="claude-3-opus-20240229"

# UI Configuration
export CLAUDE_CODE_THEME="dark"
export CLAUDE_CODE_EDITOR="vscode"

# Paths
export CLAUDE_CODE_CONFIG_DIR="~/.claude-code-clone"
export CLAUDE_CODE_LOG_LEVEL="debug"
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:CLAUDE_CODE_THEME = "dark"
```

### Project-Specific Configuration

Create a project configuration file:

```bash
# Initialize project configuration
claude-code-clone init
```

This creates `.claude-code-clone/config.json`:

```json
{
  "project": {
    "name": "my-project",
    "type": "nodejs",
    "exclude": [
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage"
    ],
    "include": [
      "src",
      "lib",
      "tests"
    ]
  },
  "ai": {
    "context_files": [
      "README.md",
      "package.json"
    ],
    "code_style": "standard",
    "documentation_style": "jsdoc"
  }
}
```

## Verification

### Verify Installation

```bash
# Check version
claude-code-clone --version

# Expected output:
# Claude Code Clone v1.0.0

# Check installation path
which claude-code-clone
# or
where claude-code-clone

# Verify all components
claude-code-clone doctor
```

### Test Basic Functionality

```bash
# Start interactive mode
claude-code-clone

# Test a simple command
> What is your version?

# Exit
> /exit
```

### Diagnostic Commands

```bash
# Run diagnostics
claude-code-clone doctor

# Check configuration
claude-code-clone config --list

# Verify API connection
claude-code-clone test-api

# Show system info
claude-code-clone --info
```

## Updating

### Check for Updates

```bash
claude-code-clone --update-check
```

### Update to Latest Version

**Using npm:**
```bash
npm update -g claude-code-clone
```

**Using yarn:**
```bash
yarn global upgrade claude-code-clone
```

**Using pnpm:**
```bash
pnpm update -g claude-code-clone
```

**Using Homebrew (macOS):**
```bash
brew update
brew upgrade claude-code-clone
```

### Update from Source

```bash
cd /path/to/claude-code-clone
git pull
npm install
npm run build
```

### Automatic Updates

Enable automatic updates:

```bash
claude-code-clone config set updates.auto true
claude-code-clone config set updates.channel stable
```

## Uninstallation

### Global Uninstallation

**Using npm:**
```bash
npm uninstall -g claude-code-clone
```

**Using yarn:**
```bash
yarn global remove claude-code-clone
```

**Using pnpm:**
```bash
pnpm remove -g claude-code-clone
```

**Using Homebrew:**
```bash
brew uninstall claude-code-clone
```

### Remove Configuration

```bash
# Remove global configuration
rm -rf ~/.claude-code-clone

# Remove from Windows
rmdir /s %USERPROFILE%\.claude-code-clone
```

### Clean Up

```bash
# Remove cached data
rm -rf ~/.cache/claude-code-clone

# Remove logs
rm -rf ~/.claude-code-clone/logs

# Remove sessions
rm -rf ~/.claude-code-clone/sessions
```

## Troubleshooting Installation

### Common Issues

#### Issue: Permission Denied

**Symptom:**
```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**

1. **Change npm prefix:**
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   npm install -g claude-code-clone
   ```

2. **Use npx:**
   ```bash
   npx claude-code-clone
   ```

3. **Fix npm permissions (macOS/Linux):**
   ```bash
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
   ```

#### Issue: Node.js Version Too Old

**Symptom:**
```
Error: Claude Code Clone requires Node.js 18.0 or higher
```

**Solution:**
```bash
# Check current version
node --version

# Update Node.js (macOS)
brew upgrade node

# Update Node.js (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm
nvm install 18
nvm use 18
```

#### Issue: Command Not Found

**Symptom:**
```
claude-code-clone: command not found
```

**Solutions:**

1. **Check PATH:**
   ```bash
   echo $PATH
   ```

2. **Add to PATH:**
   ```bash
   # Find npm global bin
   npm bin -g
   
   # Add to PATH
   export PATH="$(npm bin -g):$PATH"
   ```

3. **Reinstall:**
   ```bash
   npm uninstall -g claude-code-clone
   npm install -g claude-code-clone
   ```

#### Issue: API Key Not Configured

**Symptom:**
```
Error: API key not configured
```

**Solution:**
```bash
# Set API key
claude-code-clone config set api.key YOUR_API_KEY

# Or set environment variable
export ANTHROPIC_API_KEY="YOUR_API_KEY"
```

#### Issue: Network/Proxy Problems

**Symptom:**
```
Error: Unable to connect to API
```

**Solutions:**

1. **Configure proxy:**
   ```bash
   export HTTP_PROXY="http://proxy.company.com:8080"
   export HTTPS_PROXY="http://proxy.company.com:8080"
   ```

2. **Configure in Claude Code Clone:**
   ```bash
   claude-code-clone config set network.proxy "http://proxy.company.com:8080"
   ```

#### Issue: Installation Hangs

**Symptom:** Installation process freezes

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

2. **Use different registry:**
   ```bash
   npm install -g claude-code-clone --registry https://registry.npmjs.org
   ```

3. **Check network:**
   ```bash
   ping registry.npmjs.org
   ```

### Getting Help

If you continue to experience issues:

1. **Check documentation**: [Troubleshooting Guide](troubleshooting.md)
2. **Search issues**: [GitHub Issues](https://github.com/claude-code-clone/claude-code-clone/issues)
3. **Join community**: [Discord](https://discord.gg/claude-code-clone)
4. **Contact support**: support@claude-code-clone.com

---

**Installation Quick Reference**

```bash
# Quick install
npm install -g claude-code-clone

# Configure
claude-code-clone config set api.key YOUR_KEY

# Verify
claude-code-clone --version

# Start
claude-code-clone
```
