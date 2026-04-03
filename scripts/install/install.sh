#!/bin/bash
# =============================================================================
# Claude Code Clone - Universal Installation Script
# =============================================================================
# This script installs Claude Code Clone on macOS and Linux systems.
# 
# Installation methods:
#   curl -fsSL https://get.claude-code.dev | bash
#   wget -qO- https://get.claude-code.dev | bash
#
# Options:
#   -v, --version VERSION    Install specific version
#   -d, --dir DIRECTORY      Install to specific directory
#   --no-sudo               Don't use sudo for system-wide install
#   --uninstall             Uninstall Claude Code Clone
# =============================================================================

set -euo pipefail

# Configuration
REPO="yourorg/claude-code-clone"
BINARY_NAME="claude-code-clone"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
VERSION="${VERSION:-latest}"
USE_SUDO="${USE_SUDO:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║              Claude Code Clone Installer                   ║"
    echo "║                                                            ║"
    echo "║         AI-powered terminal coding assistant               ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Detect platform
detect_platform() {
    local os
    local arch
    
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)
    
    case "$arch" in
        x86_64|amd64)
            arch="x64"
            ;;
        arm64|aarch64)
            arch="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
    
    case "$os" in
        darwin)
            PLATFORM="macos-$arch"
            ;;
        linux)
            PLATFORM="linux-$arch"
            ;;
        *)
            log_error "Unsupported operating system: $os"
            exit 1
            ;;
    esac
    
    log_info "Detected platform: $PLATFORM"
}

# Check dependencies
check_dependencies() {
    log_step "Checking dependencies..."
    
    local deps=("curl" "tar")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency '$dep' is not installed"
            exit 1
        fi
    done
    
    log_success "All dependencies satisfied"
}

# Get latest version
get_latest_version() {
    if [ "$VERSION" = "latest" ]; then
        log_step "Fetching latest version..."
        
        VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | \
            grep '"tag_name":' | \
            sed -E 's/.*"([^"]+)".*/\1/')
        
        if [ -z "$VERSION" ]; then
            log_error "Failed to fetch latest version"
            exit 1
        fi
        
        log_info "Latest version: $VERSION"
    fi
    
    # Remove 'v' prefix if present
    VERSION=${VERSION#v}
}

# Download binary
download_binary() {
    log_step "Downloading Claude Code Clone v$VERSION..."
    
    local download_url="https://github.com/$REPO/releases/download/v$VERSION/${BINARY_NAME}-v$VERSION-$PLATFORM.tar.gz"
    local temp_dir
    temp_dir=$(mktemp -d)
    
    log_info "Download URL: $download_url"
    
    if ! curl -fsSL --progress-bar "$download_url" -o "$temp_dir/${BINARY_NAME}.tar.gz"; then
        log_error "Failed to download binary"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_success "Download complete"
    
    # Verify checksum if available
    log_step "Verifying download..."
    
    local checksum_url="https://github.com/$REPO/releases/download/v$VERSION/checksums.txt"
    if curl -fsSL "$checksum_url" -o "$temp_dir/checksums.txt" 2>/dev/null; then
        local expected_checksum
        expected_checksum=$(grep "${BINARY_NAME}-v$VERSION-$PLATFORM.tar.gz" "$temp_dir/checksums.txt" | awk '{print $1}')
        
        if [ -n "$expected_checksum" ]; then
            local actual_checksum
            actual_checksum=$(shasum -a 256 "$temp_dir/${BINARY_NAME}.tar.gz" | awk '{print $1}')
            
            if [ "$expected_checksum" != "$actual_checksum" ]; then
                log_error "Checksum verification failed!"
                rm -rf "$temp_dir"
                exit 1
            fi
            
            log_success "Checksum verified"
        fi
    else
        log_warning "Could not verify checksum"
    fi
    
    # Extract
    log_step "Extracting archive..."
    tar -xzf "$temp_dir/${BINARY_NAME}.tar.gz" -C "$temp_dir"
    
    # Store binary path
    BINARY_PATH="$temp_dir/$BINARY_NAME"
    TEMP_DIR="$temp_dir"
}

# Install binary
install_binary() {
    log_step "Installing to $INSTALL_DIR..."
    
    # Create install directory if needed
    if [ ! -d "$INSTALL_DIR" ]; then
        if [ "$USE_SUDO" = "true" ]; then
            sudo mkdir -p "$INSTALL_DIR"
        else
            mkdir -p "$INSTALL_DIR"
        fi
    fi
    
    # Check if we need sudo
    local needs_sudo=false
    if [ ! -w "$INSTALL_DIR" ]; then
        needs_sudo=true
    fi
    
    # Install binary
    if [ "$needs_sudo" = true ] && [ "$USE_SUDO" = "true" ]; then
        sudo mv "$BINARY_PATH" "$INSTALL_DIR/"
        sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"
    else
        mv "$BINARY_PATH" "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/$BINARY_NAME"
    fi
    
    # Create symlink for 'ccode'
    if [ "$needs_sudo" = true ] && [ "$USE_SUDO" = "true" ]; then
        sudo ln -sf "$INSTALL_DIR/$BINARY_NAME" "$INSTALL_DIR/ccode" 2>/dev/null || true
    else
        ln -sf "$INSTALL_DIR/$BINARY_NAME" "$INSTALL_DIR/ccode" 2>/dev/null || true
    fi
    
    log_success "Installation complete"
}

# Verify installation
verify_installation() {
    log_step "Verifying installation..."
    
    if ! command -v "$BINARY_NAME" &> /dev/null; then
        # Check if install dir is in PATH
        if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
            log_warning "$INSTALL_DIR is not in your PATH"
            log_info "Add the following to your shell profile:"
            echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
        fi
        
        log_error "Installation verification failed"
        exit 1
    fi
    
    local installed_version
    installed_version=$($BINARY_NAME --version 2>/dev/null || echo "unknown")
    
    log_success "Claude Code Clone $installed_version installed successfully!"
}

# Uninstall
uninstall() {
    log_step "Uninstalling Claude Code Clone..."
    
    local needs_sudo=false
    if [ -f "$INSTALL_DIR/$BINARY_NAME" ] && [ ! -w "$INSTALL_DIR/$BINARY_NAME" ]; then
        needs_sudo=true
    fi
    
    if [ "$needs_sudo" = true ] && [ "$USE_SUDO" = "true" ]; then
        sudo rm -f "$INSTALL_DIR/$BINARY_NAME"
        sudo rm -f "$INSTALL_DIR/ccode"
    else
        rm -f "$INSTALL_DIR/$BINARY_NAME"
        rm -f "$INSTALL_DIR/ccode"
    fi
    
    # Remove config directory
    local config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/claude-code-clone"
    if [ -d "$config_dir" ]; then
        log_info "Configuration directory: $config_dir"
        read -p "Remove configuration directory? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$config_dir"
            log_success "Configuration removed"
        fi
    fi
    
    log_success "Uninstallation complete"
}

# Cleanup
cleanup() {
    if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -d|--dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --no-sudo)
                USE_SUDO="false"
                shift
                ;;
            --uninstall)
                uninstall
                exit 0
                ;;
            -h|--help)
                echo "Claude Code Clone Installer"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -v, --version VERSION    Install specific version (default: latest)"
                echo "  -d, --dir DIRECTORY      Install directory (default: /usr/local/bin)"
                echo "  --no-sudo               Don't use sudo"
                echo "  --uninstall             Uninstall Claude Code Clone"
                echo "  -h, --help              Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  INSTALL_DIR             Installation directory"
                echo "  VERSION                 Version to install"
                echo "  USE_SUDO                Whether to use sudo (true/false)"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    trap cleanup EXIT
    
    parse_args "$@"
    print_banner
    
    log_info "Install directory: $INSTALL_DIR"
    log_info "Target version: $VERSION"
    
    check_dependencies
    detect_platform
    get_latest_version
    download_binary
    install_binary
    verify_installation
    
    echo ""
    log_success "Claude Code Clone v$VERSION is ready to use!"
    echo ""
    echo -e "${CYAN}Quick start:${NC}"
    echo "  claude-code --help       Show help"
    echo "  claude-code --version    Show version"
    echo "  claude-code              Start interactive session"
    echo ""
    echo -e "${CYAN}Documentation:${NC} https://github.com/$REPO#readme"
    echo ""
}

# Run main function
main "$@"
