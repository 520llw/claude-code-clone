#!/usr/bin/env bash
#
# Claude Code Clone - One-Command Setup Script (macOS/Linux)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yourorg/claude-code-clone/main/scripts/setup.sh | bash
#   OR
#   bash scripts/setup.sh
#
# Features:
#   - Auto-installs Bun runtime
#   - Clones/updates repository
#   - Installs dependencies
#   - Builds the project
#   - Interactive API key configuration
#   - Registers shell alias
#   - Verifies installation
#

set -euo pipefail

# ============================================================================
# Colors & Helpers
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
step()    { echo -e "\n${CYAN}${BOLD}>>> $1${NC}"; }

# ============================================================================
# Configuration
# ============================================================================

REPO_URL="${REPO_URL:-https://github.com/yourorg/claude-code-clone.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.claude-code-clone}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/claude-code}"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

# ============================================================================
# Banner
# ============================================================================

echo -e "${CYAN}"
cat << 'BANNER'
  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
 ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
 ██║     ██║     ███████║██║   ██║██║  ██║█████╗
 ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
 ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
       ██████╗ ██████╗ ██████╗ ███████╗
      ██╔════╝██╔═══██╗██╔══██╗██╔════╝
      ██║     ██║   ██║██║  ██║█████╗
      ██║     ██║   ██║██║  ██║██╔══╝
      ╚██████╗╚██████╔╝██████╔╝███████╗
       ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
BANNER
echo -e "${NC}"
echo -e "${DIM}One-Command Setup - AI-Powered Terminal Coding Assistant${NC}"
echo ""

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================

step "Checking prerequisites"

check_command() {
  if command -v "$1" &> /dev/null; then
    success "$1 found: $(command -v "$1")"
    return 0
  else
    return 1
  fi
}

if ! check_command "curl"; then
  error "curl is required but not installed."
  echo "  Install with: sudo apt install curl  (or brew install curl)"
  exit 1
fi

if ! check_command "git"; then
  error "git is required but not installed."
  echo "  Install with: sudo apt install git  (or brew install git)"
  exit 1
fi

# ============================================================================
# Step 2: Install Bun
# ============================================================================

step "Checking Bun runtime"

if check_command "bun"; then
  BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
  info "Bun version: $BUN_VERSION"
else
  info "Bun not found. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash

  # Source bun into current session
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if check_command "bun"; then
    success "Bun installed successfully: $(bun --version)"
  else
    error "Failed to install Bun. Please install manually: https://bun.sh"
    exit 1
  fi
fi

# ============================================================================
# Step 3: Clone or Update Repository
# ============================================================================

step "Setting up project"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repository exists at $INSTALL_DIR, updating..."
  cd "$INSTALL_DIR"
  git pull --ff-only || warn "Could not auto-update. Continuing with existing version."
else
  if [ -d "$INSTALL_DIR" ]; then
    warn "Directory $INSTALL_DIR exists but is not a git repo."
    info "Using existing directory..."
  else
    info "Cloning repository to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR" || {
      warn "Could not clone from $REPO_URL"
      info "If you already have the code, set INSTALL_DIR to point to it."
      info "Trying current directory instead..."
      INSTALL_DIR="$(pwd)"
    }
  fi
  cd "$INSTALL_DIR"
fi

success "Project directory: $INSTALL_DIR"

# ============================================================================
# Step 4: Install Dependencies
# ============================================================================

step "Installing dependencies"

if [ -f "package.json" ]; then
  bun install
  success "Dependencies installed"
else
  error "package.json not found in $INSTALL_DIR"
  exit 1
fi

# ============================================================================
# Step 5: Build Project
# ============================================================================

step "Building project"

bun run build && success "Build completed" || {
  warn "Build failed. You may need to fix issues and run 'bun run build' manually."
}

# ============================================================================
# Step 6: Interactive API Configuration
# ============================================================================

step "Configuring API providers"

mkdir -p "$CONFIG_DIR"

echo ""
echo -e "${BOLD}Which providers would you like to configure?${NC}"
echo -e "  ${CYAN}1)${NC} Anthropic (Claude)    - ${DIM}ANTHROPIC_API_KEY${NC}"
echo -e "  ${GREEN}2)${NC} OpenAI (GPT)          - ${DIM}OPENAI_API_KEY${NC}"
echo -e "  ${MAGENTA}3)${NC} Kimi (Moonshot AI)    - ${DIM}MOONSHOT_API_KEY${NC}"
echo -e "  ${YELLOW}4)${NC} Skip configuration"
echo ""

PROVIDER="anthropic"
MODEL=""
API_KEY=""

read -p "Select provider [1-4] (default: 1): " PROVIDER_CHOICE
PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

case "$PROVIDER_CHOICE" in
  1)
    PROVIDER="anthropic"
    MODEL="claude-sonnet-4-20250514"
    echo -e "\n${CYAN}Enter your Anthropic API key:${NC}"
    read -s -p "API Key: " API_KEY
    echo ""
    ;;
  2)
    PROVIDER="openai"
    MODEL="gpt-4o"
    echo -e "\n${GREEN}Enter your OpenAI API key:${NC}"
    read -s -p "API Key: " API_KEY
    echo ""
    ;;
  3)
    PROVIDER="kimi"
    MODEL="kimi-k2.5"
    echo -e "\n${MAGENTA}Enter your Moonshot API key:${NC}"
    read -s -p "API Key: " API_KEY
    echo ""
    ;;
  4)
    info "Skipping API configuration. You can set it up later."
    ;;
  *)
    warn "Invalid choice. Skipping configuration."
    ;;
esac

# Write config file
if [ -n "$API_KEY" ]; then
  cat > "$CONFIG_FILE" << EOF
# Claude Code Clone Configuration
# Generated by setup script

model:
  provider: ${PROVIDER}
  name: ${MODEL}
  apiKey: "${API_KEY}"
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
EOF

  chmod 600 "$CONFIG_FILE"
  success "Configuration saved to $CONFIG_FILE (permissions: 600)"

  # Also set environment variable for current session
  case "$PROVIDER" in
    anthropic) export ANTHROPIC_API_KEY="$API_KEY" ;;
    openai)    export OPENAI_API_KEY="$API_KEY" ;;
    kimi)      export MOONSHOT_API_KEY="$API_KEY" ;;
  esac
else
  if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << EOF
# Claude Code Clone Configuration
# Set your API key below or via environment variable

model:
  provider: anthropic
  name: claude-sonnet-4-20250514
  # apiKey: "your-api-key-here"
  maxTokens: 16000
  temperature: 0

ui:
  theme: default
  showTokenCount: true
EOF
    info "Default config written to $CONFIG_FILE"
  fi
fi

# ============================================================================
# Step 7: Register Shell Alias
# ============================================================================

step "Setting up shell commands"

# Determine shell config file
SHELL_RC=""
if [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "${BASH_VERSION:-}" ] || [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

ALIAS_LINE="alias ccode='cd $INSTALL_DIR && bun run start'"
BIN_EXPORT="export PATH=\"$INSTALL_DIR/dist:\$PATH\""

if [ -n "$SHELL_RC" ]; then
  # Add alias if not already present
  if ! grep -q "alias ccode=" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Claude Code Clone" >> "$SHELL_RC"
    echo "$ALIAS_LINE" >> "$SHELL_RC"
    success "Added 'ccode' alias to $SHELL_RC"
  else
    info "'ccode' alias already exists in $SHELL_RC"
  fi

  # Source for current session
  eval "$ALIAS_LINE" 2>/dev/null || true
else
  warn "Could not detect shell config file."
  echo "  Add this to your shell profile manually:"
  echo "    $ALIAS_LINE"
fi

# ============================================================================
# Step 8: Verify Installation
# ============================================================================

step "Verifying installation"

if [ -f "$INSTALL_DIR/dist/cli.js" ]; then
  success "Build artifacts found"
else
  warn "Build artifacts not found. Run 'bun run build' in $INSTALL_DIR"
fi

if [ -f "$CONFIG_FILE" ]; then
  success "Configuration file exists"
else
  warn "No configuration file found"
fi

# ============================================================================
# Done!
# ============================================================================

echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Setup Complete!${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
echo -e "  ${BOLD}Quick Start:${NC}"
echo -e "    ${CYAN}cd $INSTALL_DIR && bun run start${NC}"
echo -e "    ${DIM}or use the alias:${NC} ${CYAN}ccode${NC}"
echo ""
echo -e "  ${BOLD}Configuration:${NC}"
echo -e "    ${DIM}Config file:${NC} $CONFIG_FILE"
echo -e "    ${DIM}Provider:${NC}    $PROVIDER"
echo -e "    ${DIM}Model:${NC}       ${MODEL:-default}"
echo ""
echo -e "  ${BOLD}Commands:${NC}"
echo -e "    ccode                     ${DIM}Start interactive session${NC}"
echo -e "    ccode \"your prompt\"        ${DIM}Run with initial prompt${NC}"
echo -e "    ccode config --list       ${DIM}View configuration${NC}"
echo -e "    ccode session --list      ${DIM}List saved sessions${NC}"
echo ""
echo -e "  ${BOLD}Keyboard Shortcuts:${NC}"
echo -e "    Ctrl+P  ${DIM}Switch provider${NC}"
echo -e "    Ctrl+T  ${DIM}Toggle tool panel${NC}"
echo -e "    Ctrl+L  ${DIM}Clear screen${NC}"
echo -e "    Escape  ${DIM}Exit${NC}"
echo ""

if [ -n "$SHELL_RC" ] && [ -z "${SOURCED_RC:-}" ]; then
  echo -e "  ${YELLOW}Run 'source $SHELL_RC' or open a new terminal to use the 'ccode' alias.${NC}"
  echo ""
fi
