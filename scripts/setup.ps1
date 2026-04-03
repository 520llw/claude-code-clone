#Requires -Version 5.1
<#
.SYNOPSIS
    Claude Code Clone - One-Command Setup Script (Windows)

.DESCRIPTION
    Installs Bun, dependencies, builds the project, configures API providers,
    and registers shell commands. Run and go!

.EXAMPLE
    # From PowerShell:
    irm https://raw.githubusercontent.com/yourorg/claude-code-clone/main/scripts/setup.ps1 | iex

    # Or locally:
    .\scripts\setup.ps1
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "$env:USERPROFILE\.claude-code-clone",
    [string]$ConfigDir = "$env:APPDATA\claude-code",
    [switch]$SkipConfig
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Helpers
# ============================================================================

function Write-Step { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }

# ============================================================================
# Banner
# ============================================================================

Write-Host @"

  Claude Code Clone - Setup
  AI-Powered Terminal Coding Assistant

"@ -ForegroundColor Cyan

# ============================================================================
# Step 1: Prerequisites
# ============================================================================

Write-Step "Checking prerequisites"

# Check Git
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    Write-Ok "Git found: $($git.Source)"
} else {
    Write-Err "Git is required. Install from https://git-scm.com/download/win"
    exit 1
}

# Check PowerShell version
Write-Ok "PowerShell $($PSVersionTable.PSVersion)"

# ============================================================================
# Step 2: Install Bun
# ============================================================================

Write-Step "Checking Bun runtime"

$bun = Get-Command bun -ErrorAction SilentlyContinue
if ($bun) {
    $bunVersion = & bun --version 2>$null
    Write-Ok "Bun found: v$bunVersion"
} else {
    Write-Info "Bun not found. Installing..."
    try {
        irm https://bun.sh/install.ps1 | iex
        # Refresh PATH
        $env:BUN_INSTALL = "$env:USERPROFILE\.bun"
        $env:PATH = "$env:BUN_INSTALL\bin;$env:PATH"

        $bun = Get-Command bun -ErrorAction SilentlyContinue
        if ($bun) {
            Write-Ok "Bun installed successfully"
        } else {
            Write-Err "Bun installation failed. Install manually: https://bun.sh"
            exit 1
        }
    } catch {
        Write-Err "Failed to install Bun: $_"
        exit 1
    }
}

# ============================================================================
# Step 3: Clone/Update Repository
# ============================================================================

Write-Step "Setting up project"

$RepoUrl = "https://github.com/yourorg/claude-code-clone.git"

if (Test-Path "$InstallDir\.git") {
    Write-Info "Repository exists, updating..."
    Push-Location $InstallDir
    try { git pull --ff-only } catch { Write-Warn "Could not auto-update." }
    Pop-Location
} elseif (Test-Path "$InstallDir\package.json") {
    Write-Info "Using existing project at $InstallDir"
} else {
    Write-Info "Cloning repository..."
    try {
        git clone $RepoUrl $InstallDir
    } catch {
        Write-Warn "Could not clone. Using current directory..."
        $InstallDir = $PWD.Path
    }
}

Write-Ok "Project directory: $InstallDir"

# ============================================================================
# Step 4: Install Dependencies
# ============================================================================

Write-Step "Installing dependencies"

Push-Location $InstallDir
try {
    & bun install
    Write-Ok "Dependencies installed"
} catch {
    Write-Err "Failed to install dependencies: $_"
    exit 1
}

# ============================================================================
# Step 5: Build Project
# ============================================================================

Write-Step "Building project"

try {
    & bun run build
    Write-Ok "Build completed"
} catch {
    Write-Warn "Build failed. Run 'bun run build' manually to fix."
}
Pop-Location

# ============================================================================
# Step 6: Interactive API Configuration
# ============================================================================

Write-Step "Configuring API providers"

if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

$ConfigFile = Join-Path $ConfigDir "config.yaml"

if (-not $SkipConfig) {
    Write-Host ""
    Write-Host "Which provider would you like to configure?" -ForegroundColor White
    Write-Host "  1) Anthropic (Claude)    - ANTHROPIC_API_KEY" -ForegroundColor Cyan
    Write-Host "  2) OpenAI (GPT)          - OPENAI_API_KEY" -ForegroundColor Green
    Write-Host "  3) Kimi (Moonshot AI)    - MOONSHOT_API_KEY" -ForegroundColor Magenta
    Write-Host "  4) Skip configuration" -ForegroundColor Yellow
    Write-Host ""

    $choice = Read-Host "Select provider [1-4] (default: 1)"
    if ([string]::IsNullOrEmpty($choice)) { $choice = "1" }

    $Provider = "anthropic"
    $Model = "claude-sonnet-4-20250514"
    $ApiKey = ""

    switch ($choice) {
        "1" {
            $Provider = "anthropic"
            $Model = "claude-sonnet-4-20250514"
            Write-Host ""
            $secureKey = Read-Host "Enter your Anthropic API key" -AsSecureString
            $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
            )
        }
        "2" {
            $Provider = "openai"
            $Model = "gpt-4o"
            Write-Host ""
            $secureKey = Read-Host "Enter your OpenAI API key" -AsSecureString
            $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
            )
        }
        "3" {
            $Provider = "kimi"
            $Model = "kimi-k2.5"
            Write-Host ""
            $secureKey = Read-Host "Enter your Moonshot API key" -AsSecureString
            $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
            )
        }
        "4" {
            Write-Info "Skipping API configuration."
        }
        default {
            Write-Warn "Invalid choice. Skipping."
        }
    }

    if ($ApiKey) {
        $configContent = @"
# Claude Code Clone Configuration
# Generated by setup script

model:
  provider: $Provider
  name: $Model
  apiKey: "$ApiKey"
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
"@
        Set-Content -Path $ConfigFile -Value $configContent -Encoding UTF8
        Write-Ok "Configuration saved to $ConfigFile"

        # Set env var for current session
        switch ($Provider) {
            "anthropic" { $env:ANTHROPIC_API_KEY = $ApiKey }
            "openai"    { $env:OPENAI_API_KEY = $ApiKey }
            "kimi"      { $env:MOONSHOT_API_KEY = $ApiKey }
        }
    }
}

# ============================================================================
# Step 7: Add to PATH
# ============================================================================

Write-Step "Setting up shell commands"

$distPath = Join-Path $InstallDir "dist"

# Add to user PATH if not already there
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable(
        "PATH",
        "$currentPath;$InstallDir;$distPath",
        "User"
    )
    $env:PATH = "$env:PATH;$InstallDir;$distPath"
    Write-Ok "Added to PATH"
} else {
    Write-Info "Already in PATH"
}

# Create ccode.cmd wrapper
$wrapperPath = Join-Path $InstallDir "ccode.cmd"
$wrapperContent = @"
@echo off
cd /d "$InstallDir"
bun run start %*
"@
Set-Content -Path $wrapperPath -Value $wrapperContent -Encoding ASCII
Write-Ok "Created ccode.cmd wrapper"

# ============================================================================
# Step 8: Verify
# ============================================================================

Write-Step "Verifying installation"

if (Test-Path (Join-Path $InstallDir "dist\cli.js")) {
    Write-Ok "Build artifacts found"
} else {
    Write-Warn "Build artifacts not found. Run 'bun run build' in $InstallDir"
}

if (Test-Path $ConfigFile) {
    Write-Ok "Configuration file exists"
} else {
    Write-Warn "No configuration file"
}

# ============================================================================
# Done!
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor White
Write-Host "    cd $InstallDir; bun run start" -ForegroundColor Cyan
Write-Host "    or: ccode" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Configuration:" -ForegroundColor White
Write-Host "    Config: $ConfigFile" -ForegroundColor DarkGray
Write-Host "    Provider: $Provider" -ForegroundColor DarkGray
Write-Host "    Model: $Model" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Keyboard Shortcuts:" -ForegroundColor White
Write-Host "    Ctrl+P  Switch provider" -ForegroundColor DarkGray
Write-Host "    Ctrl+T  Toggle tool panel" -ForegroundColor DarkGray
Write-Host "    Ctrl+L  Clear screen" -ForegroundColor DarkGray
Write-Host "    Escape  Exit" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Open a new terminal to use the 'ccode' command." -ForegroundColor Yellow
Write-Host ""
