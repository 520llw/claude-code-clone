# Installation Guide

This guide covers all installation methods for Claude Code Clone.

## Table of Contents

- [Quick Install](#quick-install)
- [Package Managers](#package-managers)
  - [npm](#npm)
  - [Homebrew (macOS)](#homebrew-macos)
  - [AUR (Arch Linux)](#aur-arch-linux)
  - [APT (Debian/Ubuntu)](#apt-debianubuntu)
  - [YUM/DNF (RHEL/CentOS/Fedora)](#yumdnf-rhelcentosfedora)
- [Manual Installation](#manual-installation)
- [Docker](#docker)
- [Building from Source](#building-from-source)
- [Post-Installation](#post-installation)
- [Troubleshooting](#troubleshooting)

## Quick Install

### macOS / Linux

```bash
curl -fsSL https://get.claude-code.dev | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://get.claude-code.dev/install.ps1 | iex
```

### Node.js (Cross-platform)

```bash
npx claude-code-clone-install
```

## Package Managers

### npm

Install globally via npm:

```bash
npm install -g claude-code-clone
```

Or use npx (no installation required):

```bash
npx claude-code-clone
```

**Requirements:**
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Homebrew (macOS)

```bash
# Add tap
brew tap yourorg/tap

# Install
brew install claude-code-clone

# Or install with cask (pre-built binary)
brew install --cask claude-code-clone
```

**Upgrade:**

```bash
brew update
brew upgrade claude-code-clone
```

### AUR (Arch Linux)

Using yay:

```bash
yay -S claude-code-clone
```

Using paru:

```bash
paru -S claude-code-clone
```

Manual installation:

```bash
git clone https://aur.archlinux.org/claude-code-clone.git
cd claude-code-clone
makepkg -si
```

### APT (Debian/Ubuntu)

```bash
# Download the .deb package
wget https://github.com/yourorg/claude-code-clone/releases/latest/download/claude-code-clone_1.0.0_amd64.deb

# Install
sudo dpkg -i claude-code-clone_1.0.0_amd64.deb

# Fix any dependency issues
sudo apt-get install -f
```

**Add our repository (recommended):**

```bash
# Add GPG key
curl -fsSL https://packages.claude-code.dev/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/claude-code-clone.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/claude-code-clone.gpg] https://packages.claude-code.dev stable main" | \
  sudo tee /etc/apt/sources.list.d/claude-code-clone.list

# Update and install
sudo apt-get update
sudo apt-get install claude-code-clone
```

### YUM/DNF (RHEL/CentOS/Fedora)

**For RHEL/CentOS 7/8:**

```bash
# Download the .rpm package
wget https://github.com/yourorg/claude-code-clone/releases/latest/download/claude-code-clone-1.0.0.x86_64.rpm

# Install
sudo yum localinstall claude-code-clone-1.0.0.x86_64.rpm
```

**For Fedora:**

```bash
sudo dnf install https://github.com/yourorg/claude-code-clone/releases/latest/download/claude-code-clone-1.0.0.x86_64.rpm
```

**Add our repository (recommended):**

```bash
# Add repository
sudo tee /etc/yum.repos.d/claude-code-clone.repo <<EOF
[claude-code-clone]
name=Claude Code Clone
baseurl=https://packages.claude-code.dev/rpm/stable/
enabled=1
gpgcheck=1
gpgkey=https://packages.claude-code.dev/gpg.key
EOF

# Install
sudo yum install claude-code-clone
```

## Manual Installation

### Download Pre-built Binaries

1. Download the appropriate binary for your platform from the [releases page](https://github.com/yourorg/claude-code-clone/releases)

2. Extract the archive:

   **macOS/Linux:**
   ```bash
   tar -xzf claude-code-clone-v1.0.0-macos-x64.tar.gz
   ```

   **Windows:**
   ```powershell
   Expand-Archive -Path claude-code-clone-v1.0.0-win-x64.zip -DestinationPath .\claude-code-clone
   ```

3. Move to a directory in your PATH:

   **macOS/Linux:**
   ```bash
   sudo mv claude-code-clone /usr/local/bin/
   sudo chmod +x /usr/local/bin/claude-code-clone
   ```

   **Windows:**
   ```powershell
   # Add to PATH manually or move to a directory already in PATH
   Move-Item .\claude-code-clone\claude-code-clone.exe C:\Windows\System32\
   ```

## Docker

### Using Docker Run

```bash
# Run with API key
docker run -it --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd):/workspace \
  claude-code-clone:latest

# Interactive mode
docker run -it --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd):/workspace \
  --entrypoint /bin/sh \
  claude-code-clone:latest
```

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# Run commands
docker-compose exec app claude-code --help

# Interactive session
docker-compose exec app claude-code
```

### Building Docker Image

```bash
# Clone repository
git clone https://github.com/yourorg/claude-code-clone.git
cd claude-code-clone

# Build image
docker build -t claude-code-clone:latest .

# Run
docker run -it --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd):/workspace \
  claude-code-clone:latest
```

## Building from Source

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git

### Build Steps

```bash
# Clone repository
git clone https://github.com/yourorg/claude-code-clone.git
cd claude-code-clone

# Install dependencies
npm ci

# Build
npm run build:prod

# Install globally from source
npm link

# Or package
npm pack
npm install -g ./claude-code-clone-1.0.0.tgz
```

### Development Build

```bash
# Install dependencies
npm ci

# Start development mode
npm run dev
```

## Post-Installation

### Configuration

Create a configuration file at `~/.config/claude-code-clone/config.json`:

```json
{
  "apiKey": "your-anthropic-api-key",
  "theme": "dark",
  "telemetry": true,
  "errorReporting": true
}
```

Or set environment variables:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### Shell Completions

**Bash:**
```bash
claude-code completions bash > ~/.local/share/bash-completion/completions/claude-code
```

**Zsh:**
```bash
claude-code completions zsh > ~/.zsh/completions/_claude-code
```

**Fish:**
```bash
claude-code completions fish > ~/.config/fish/completions/claude-code.fish
```

### Verify Installation

```bash
# Check version
claude-code --version

# Show help
claude-code --help

# Run diagnostics
claude-code doctor
```

## Troubleshooting

### Permission Denied (macOS/Linux)

```bash
# Fix permissions
sudo chmod +x /usr/local/bin/claude-code-clone

# Or install to user directory
npm install -g claude-code-clone --prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
```

### Command Not Found

Add to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
export PATH="/usr/local/bin:$PATH"
```

### Node.js Version Issues

```bash
# Check Node.js version
node --version

# Use nvm to switch versions
nvm install 18
nvm use 18
```

### Windows Defender / Antivirus Warnings

The pre-built binaries may trigger false positives. You can:

1. Add an exclusion in your antivirus software
2. Build from source instead
3. Use the npm installation method

### Update Issues

```bash
# Force reinstall
npm uninstall -g claude-code-clone
npm install -g claude-code-clone

# Clear npm cache
npm cache clean --force
```

### Getting Help

- [GitHub Issues](https://github.com/yourorg/claude-code-clone/issues)
- [Documentation](https://github.com/yourorg/claude-code-clone#readme)
- [Discord Community](https://discord.gg/claude-code-clone)

## Uninstallation

### npm

```bash
npm uninstall -g claude-code-clone
```

### Homebrew

```bash
brew uninstall claude-code-clone
brew untap yourorg/tap
```

### AUR

```bash
yay -R claude-code-clone
```

### APT

```bash
sudo apt-get remove claude-code-clone
sudo apt-get autoremove
```

### YUM/DNF

```bash
sudo yum remove claude-code-clone
```

### Manual

```bash
# Remove binary
sudo rm /usr/local/bin/claude-code-clone
sudo rm /usr/local/bin/ccode

# Remove config
rm -rf ~/.config/claude-code-clone
```

### Windows

```powershell
# Remove from install directory
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Programs\ClaudeCodeClone"

# Remove from PATH (manual step via System Properties)
```

---

For more information, visit the [project repository](https://github.com/yourorg/claude-code-clone).
