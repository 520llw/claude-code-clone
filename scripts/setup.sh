#!/usr/bin/env bash
#
# Claude Code Clone - One-Command Setup & Run
#
# Usage (Linux/macOS):
#   curl -fsSL https://raw.githubusercontent.com/520llw/claude-code-clone/main/scripts/setup.sh | bash
#
# Usage (Windows Git Bash / MSYS2):
#   curl -fsSL https://raw.githubusercontent.com/520llw/claude-code-clone/main/scripts/setup.sh | bash
#
# Or locally:
#   bash scripts/setup.sh
#
# Environment variables (set before running):
#   MOONSHOT_API_KEY=sk-xxx   (for Kimi)
#   ANTHROPIC_API_KEY=sk-xxx  (for Claude)
#   OPENAI_API_KEY=sk-xxx     (for OpenAI)
#

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}  OK ${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC} $1"; }
step()    { echo -e "\n${CYAN}${BOLD}>>> $1${NC}"; }

# ── Config ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/520llw/claude-code-clone.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/claude-code-clone}"
CONFIG_DIR="$HOME/.config/claude-code"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

# ── Banner ────────────────────────────────────────────────────────────────
echo -e "${CYAN}"
echo '   ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████���'
echo '  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝'
echo '  ██║     █���║     ███████║██║   ██║██║  ██║█████╗  '
echo '  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  '
echo '  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗'
echo '   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝'
echo -e "${NC}${DIM}  One-Command Setup${NC}"
echo ""

# ── Step 1: Check prerequisites ──────────────────────────────────────────
step "Checking prerequisites"

for cmd in git curl node npm; do
  if command -v "$cmd" &>/dev/null; then
    success "$cmd: $(command -v "$cmd")"
  else
    error "$cmd not found. Please install it first."
    exit 1
  fi
done

NODE_VER=$(node --version)
info "Node.js $NODE_VER"

# ── Step 2: Clone or update repo ─────────────────────────────────────────
step "Setting up repository"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Found existing repo at $INSTALL_DIR, pulling latest..."
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || warn "Pull failed, using existing version"
elif [ -f "$INSTALL_DIR/package.json" ]; then
  info "Using existing project at $INSTALL_DIR"
  cd "$INSTALL_DIR"
else
  info "Cloning to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -2
  cd "$INSTALL_DIR"
fi
success "Project: $INSTALL_DIR"

# ── Step 3: Install dependencies ─────────────────────────────────────────
step "Installing dependencies"

npm install --no-audit --no-fund 2>&1 | tail -3
success "Dependencies installed"

# ── Step 4: Build ─────────────────────────────────────────────────────────
step "Building"

node scripts/build.cjs --skip-typecheck --skip-validate 2>&1 | tail -3
if [ -f dist/cli.mjs ]; then
  success "Build complete: dist/cli.mjs"
else
  error "Build failed"
  exit 1
fi

# ── Step 5: API Key Configuration ─────────────────────────────────────────
step "Configuring API"

# Auto-detect from environment
DETECTED_PROVIDER=""
DETECTED_KEY=""
DETECTED_MODEL=""

if [ -n "${MOONSHOT_API_KEY:-}" ]; then
  DETECTED_PROVIDER="kimi"
  DETECTED_KEY="$MOONSHOT_API_KEY"
  DETECTED_MODEL="kimi-k2.5"
elif [ -n "${KIMI_API_KEY:-}" ]; then
  DETECTED_PROVIDER="kimi"
  DETECTED_KEY="$KIMI_API_KEY"
  DETECTED_MODEL="kimi-k2.5"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  DETECTED_PROVIDER="anthropic"
  DETECTED_KEY="$ANTHROPIC_API_KEY"
  DETECTED_MODEL="claude-sonnet-4-20250514"
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  DETECTED_PROVIDER="openai"
  DETECTED_KEY="$OPENAI_API_KEY"
  DETECTED_MODEL="gpt-4o"
fi

if [ -n "$DETECTED_PROVIDER" ]; then
  KEY_PREVIEW="${DETECTED_KEY:0:8}...${DETECTED_KEY: -4}"
  success "Detected: ${DETECTED_PROVIDER} / ${DETECTED_MODEL} (${KEY_PREVIEW})"

  # Write config
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" << YAML
model:
  provider: ${DETECTED_PROVIDER}
  name: ${DETECTED_MODEL}
  apiKey: "${DETECTED_KEY}"
  maxTokens: 16000
  temperature: 0
ui:
  theme: default
  showTokenCount: true
YAML
  chmod 600 "$CONFIG_FILE"
  success "Config saved: $CONFIG_FILE"
else
  warn "No API key found in environment."
  echo ""
  echo -e "  Set one of these before running:"
  echo -e "    ${MAGENTA}export MOONSHOT_API_KEY=sk-xxx${NC}     # Kimi"
  echo -e "    ${CYAN}export ANTHROPIC_API_KEY=sk-xxx${NC}    # Claude"
  echo -e "    ${GREEN}export OPENAI_API_KEY=sk-xxx${NC}       # OpenAI"
  echo ""

  # Interactive prompt if TTY
  if [ -t 0 ]; then
    echo -e "${BOLD}Select provider:${NC}"
    echo "  1) Kimi (Moonshot AI)"
    echo "  2) Anthropic (Claude)"
    echo "  3) OpenAI (GPT)"
    echo "  4) Skip"
    read -p "Choice [1-4]: " CHOICE
    case "$CHOICE" in
      1) DETECTED_PROVIDER="kimi"; DETECTED_MODEL="kimi-k2.5" ;;
      2) DETECTED_PROVIDER="anthropic"; DETECTED_MODEL="claude-sonnet-4-20250514" ;;
      3) DETECTED_PROVIDER="openai"; DETECTED_MODEL="gpt-4o" ;;
      *) DETECTED_PROVIDER="" ;;
    esac

    if [ -n "$DETECTED_PROVIDER" ]; then
      read -s -p "Enter API key: " DETECTED_KEY; echo ""
      if [ -n "$DETECTED_KEY" ]; then
        mkdir -p "$CONFIG_DIR"
        cat > "$CONFIG_FILE" << YAML
model:
  provider: ${DETECTED_PROVIDER}
  name: ${DETECTED_MODEL}
  apiKey: "${DETECTED_KEY}"
  maxTokens: 16000
  temperature: 0
YAML
        chmod 600 "$CONFIG_FILE"
        success "Config saved"

        # Export for immediate use
        case "$DETECTED_PROVIDER" in
          kimi)      export MOONSHOT_API_KEY="$DETECTED_KEY" ;;
          anthropic) export ANTHROPIC_API_KEY="$DETECTED_KEY" ;;
          openai)    export OPENAI_API_KEY="$DETECTED_KEY" ;;
        esac
      fi
    fi
  fi
fi

# ── Step 6: Create launcher script ────────────────────────────────────────
step "Creating launcher"

LAUNCHER="$INSTALL_DIR/ccode"
cat > "$LAUNCHER" << 'SCRIPT'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/dist/cli.mjs" "$@"
SCRIPT
chmod +x "$LAUNCHER"

# Add to PATH via shell profile
SHELL_RC=""
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"

if [ -n "$SHELL_RC" ]; then
  if ! grep -q "claude-code-clone" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Claude Code Clone" >> "$SHELL_RC"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
    success "Added to PATH in $SHELL_RC"
  fi
fi

# Also add for current session
export PATH="$INSTALL_DIR:$PATH"

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║       Setup Complete!                 ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Run now:${NC}"
echo -e "    ${CYAN}cd $INSTALL_DIR && node dist/cli.mjs${NC}"
echo ""
echo -e "  ${BOLD}Or use the shortcut (after restarting terminal):${NC}"
echo -e "    ${CYAN}ccode${NC}"
echo ""
echo -e "  ${BOLD}Quick commands:${NC}"
echo -e "    ccode \"your question\"     # Ask something"
echo -e "    ccode --help              # Show help"
echo -e "    ccode config --list       # View config"
echo ""

# ── Auto-launch ──────────────────────────────────────────────────────────
if [ -t 0 ] && [ -n "$DETECTED_KEY" ]; then
  read -p "Launch now? [Y/n]: " LAUNCH
  if [ "${LAUNCH:-y}" != "n" ] && [ "${LAUNCH:-y}" != "N" ]; then
    echo ""
    exec node "$INSTALL_DIR/dist/cli.mjs"
  fi
fi
