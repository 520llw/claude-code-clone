#Requires -Version 5.1
<#
.SYNOPSIS
    Claude Code Clone Installer for Windows

.DESCRIPTION
    This script installs Claude Code Clone on Windows systems.

.PARAMETER Version
    Specific version to install (default: latest)

.PARAMETER InstallDir
    Installation directory (default: %LOCALAPPDATA%\Programs\ClaudeCodeClone)

.PARAMETER NoAddToPath
    Don't add to PATH

.PARAMETER Uninstall
    Uninstall Claude Code Clone

.EXAMPLE
    # Install latest version
    iwr -useb https://get.claude-code.dev/install.ps1 | iex

    # Install specific version
    iwr -useb https://get.claude-code.dev/install.ps1 | iex -Version "1.0.0"

    # Install to custom directory
    .\install.ps1 -InstallDir "C:\Tools"
#>

[CmdletBinding()]
param(
    [string]$Version = "latest",
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\ClaudeCodeClone",
    [switch]$NoAddToPath,
    [switch]$Uninstall
)

# Configuration
$Repo = "yourorg/claude-code-clone"
$BinaryName = "claude-code-clone.exe"
$ErrorActionPreference = "Stop"

# Colors for console output
function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success($Message) {
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning($Message) {
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step($Message) {
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

# Print banner
function Print-Banner {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Cyan
    Write-Host "║              Claude Code Clone Installer                   ║" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Cyan
    Write-Host "║         AI-powered terminal coding assistant               ║" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

# Detect platform
function Get-Platform {
    Write-Step "Detecting platform..."
    
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $platform = "win-$arch"
    
    Write-Info "Detected platform: $platform"
    return $platform
}

# Check dependencies
function Test-Dependencies {
    Write-Step "Checking dependencies..."
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        throw "PowerShell 5.1 or higher is required"
    }
    
    Write-Success "All dependencies satisfied"
}

# Get latest version
function Get-LatestVersion {
    if ($Version -eq "latest") {
        Write-Step "Fetching latest version..."
        
        try {
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
            $script:Version = $release.tag_name -replace '^v', ''
            Write-Info "Latest version: $Version"
        }
        catch {
            throw "Failed to fetch latest version: $_"
        }
    }
    else {
        # Remove 'v' prefix if present
        $script:Version = $Version -replace '^v', ''
    }
}

# Download binary
function Download-Binary {
    param([string]$Platform)
    
    Write-Step "Downloading Claude Code Clone v$Version..."
    
    $downloadUrl = "https://github.com/$Repo/releases/download/v$Version/${BinaryName%.exe}-v$Version-$Platform.zip"
    $tempDir = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    $zipPath = Join-Path $tempDir "claude-code-clone.zip"
    
    Write-Info "Download URL: $downloadUrl"
    
    try {
        # Download with progress
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
        Write-Success "Download complete"
    }
    catch {
        throw "Failed to download binary: $_"
    }
    
    # Extract
    Write-Step "Extracting archive..."
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    
    # Find binary
    $binary = Get-ChildItem -Path $tempDir -Filter $BinaryName -Recurse | Select-Object -First 1
    if (-not $binary) {
        throw "Binary not found in archive"
    }
    
    return @{
        BinaryPath = $binary.FullName
        TempDir = $tempDir
    }
}

# Install binary
function Install-Binary {
    param(
        [string]$BinaryPath,
        [string]$TempDir
    )
    
    Write-Step "Installing to $InstallDir..."
    
    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    # Copy binary
    $destPath = Join-Path $InstallDir $BinaryName
    Copy-Item -Path $BinaryPath -Destination $destPath -Force
    
    # Create symlink for 'ccode'
    $ccodePath = Join-Path $InstallDir "ccode.exe"
    if (Test-Path $ccodePath) {
        Remove-Item $ccodePath -Force
    }
    
    # Use hard link or copy for Windows
    Copy-Item -Path $destPath -Destination $ccodePath -Force
    
    Write-Success "Installation complete"
    
    # Add to PATH
    if (-not $NoAddToPath) {
        Add-ToPath
    }
    
    # Cleanup
    Remove-Item $TempDir -Recurse -Force
}

# Add to PATH
function Add-ToPath {
    Write-Step "Adding to PATH..."
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    
    if ($currentPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$InstallDir",
            "User"
        )
        Write-Success "Added $InstallDir to PATH"
        Write-Warning "Please restart your terminal for PATH changes to take effect"
    }
    else {
        Write-Info "Already in PATH"
    }
}

# Verify installation
function Test-Installation {
    Write-Step "Verifying installation..."
    
    $binaryPath = Join-Path $InstallDir $BinaryName
    
    if (-not (Test-Path $binaryPath)) {
        throw "Installation verification failed - binary not found"
    }
    
    try {
        $installedVersion = & $binaryPath --version 2>$null
        Write-Success "Claude Code Clone $installedVersion installed successfully!"
    }
    catch {
        Write-Warning "Could not verify version, but binary exists"
    }
}

# Uninstall
function Uninstall-Application {
    Write-Step "Uninstalling Claude Code Clone..."
    
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
        Write-Success "Removed installation directory"
    }
    
    # Remove from PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -like "*$InstallDir*") {
        $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $InstallDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Success "Removed from PATH"
    }
    
    # Remove config directory
    $configDir = Join-Path $env:APPDATA "claude-code-clone"
    if (Test-Path $configDir) {
        Write-Info "Configuration directory: $configDir"
        $response = Read-Host "Remove configuration directory? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Remove-Item $configDir -Recurse -Force
            Write-Success "Configuration removed"
        }
    }
    
    Write-Success "Uninstallation complete"
}

# Main function
function Main {
    Print-Banner
    
    Write-Info "Install directory: $InstallDir"
    Write-Info "Target version: $Version"
    
    if ($Uninstall) {
        Uninstall-Application
        return
    }
    
    Test-Dependencies
    $platform = Get-Platform
    Get-LatestVersion
    $download = Download-Binary -Platform $platform
    Install-Binary -BinaryPath $download.BinaryPath -TempDir $download.TempDir
    Test-Installation
    
    Write-Host ""
    Write-Success "Claude Code Clone v$Version is ready to use!"
    Write-Host ""
    Write-Host "Quick start:" -ForegroundColor Cyan
    Write-Host "  claude-code --help       Show help"
    Write-Host "  claude-code --version    Show version"
    Write-Host "  claude-code              Start interactive session"
    Write-Host ""
    Write-Host "Documentation: https://github.com/$Repo#readme" -ForegroundColor Cyan
    Write-Host ""
}

# Run main function
Main
