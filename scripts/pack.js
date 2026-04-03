#!/usr/bin/env node
/**
 * Packaging Script for Claude Code Clone
 * 
 * Creates distributable packages for multiple platforms:
 * - npm package (.tgz)
 * - Standalone binaries (using pkg)
 * - Platform-specific archives (.tar.gz, .zip)
 * - Installer packages (where applicable)
 * 
 * Usage:
 *   node scripts/pack.js              # Package current platform
 *   node scripts/pack.js --all        # Package all platforms
 *   node scripts/pack.js --platform=macos --arch=arm64
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const yazl = require('yazl');

// Configuration
const CONFIG = {
  version: require('../package.json').version,
  name: require('../package.json').name,
  buildDir: path.resolve(__dirname, '../build'),
  distDir: path.resolve(__dirname, '../dist'),
  outputDir: path.resolve(__dirname, '../build/packages'),
  pkgConfig: require('../package.json').pkg
};

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    step: colors.cyan
  };
  const color = colorMap[type] || colors.reset;
  console.log(`${colors.bright}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

function error(message) {
  log(message, 'error');
  process.exit(1);
}

// Platform detection
function getCurrentPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  
  const platformMap = {
    'darwin': 'macos',
    'linux': 'linux',
    'win32': 'win'
  };
  
  const archMap = {
    'x64': 'x64',
    'arm64': 'arm64'
  };
  
  return `${platformMap[platform]}-${archMap[arch]}`;
}

async function clean() {
  log('Cleaning package directory...', 'step');
  if (fs.existsSync(CONFIG.outputDir)) {
    fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  log('Clean complete', 'success');
}

async function buildNpmPackage() {
  log('Building npm package...', 'step');
  
  try {
    const result = execSync('npm pack --pack-destination build/packages', {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8'
    });
    
    // Rename to standardized name
    const originalName = result.trim();
    const newName = `${CONFIG.name}-${CONFIG.version}.tgz`;
    
    fs.renameSync(
      path.join(CONFIG.outputDir, originalName),
      path.join(CONFIG.outputDir, newName)
    );
    
    log(`npm package created: ${newName}`, 'success');
    return newName;
  } catch (e) {
    error(`npm pack failed: ${e.message}`);
  }
}

async function buildBinary(target) {
  log(`Building binary for ${target}...`, 'step');
  
  const binaryDir = path.join(CONFIG.buildDir, 'binaries', target);
  
  // Ensure dist is built
  if (!fs.existsSync(CONFIG.distDir)) {
    log('Building distribution first...', 'warning');
    execSync('node scripts/build.js', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
  }

  try {
    // Use pkg to create binary
    const pkgCommand = `npx pkg . --targets ${target} --output ${binaryDir}/${CONFIG.name}`;
    execSync(pkgCommand, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    
    log(`Binary built for ${target}`, 'success');
    return path.join(binaryDir, CONFIG.name);
  } catch (e) {
    log(`Binary build failed for ${target}: ${e.message}`, 'warning');
    return null;
  }
}

async function createTarGz(sourceDir, outputFile) {
  log(`Creating tar.gz: ${outputFile}...`, 'step');
  
  const outputPath = path.join(CONFIG.outputDir, outputFile);
  
  await tar.create({
    gzip: true,
    file: outputPath,
    cwd: sourceDir,
    portable: true,
    noMtime: true
  }, fs.readdirSync(sourceDir));
  
  log(`Created: ${outputFile}`, 'success');
  return outputPath;
}

async function createZip(sourceDir, outputFile) {
  log(`Creating zip: ${outputFile}...`, 'step');
  
  const outputPath = path.join(CONFIG.outputDir, outputFile);
  const zipfile = new yazl.ZipFile();
  
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    if (fs.statSync(filePath).isFile()) {
      zipfile.addFile(filePath, file);
    } else {
      await addDirectoryToZip(zipfile, filePath, file);
    }
  }
  
  zipfile.end();
  
  await new Promise((resolve, reject) => {
    zipfile.outputStream
      .pipe(fs.createWriteStream(outputPath))
      .on('close', resolve)
      .on('error', reject);
  });
  
  log(`Created: ${outputFile}`, 'success');
  return outputPath;
}

async function addDirectoryToZip(zipfile, dirPath, zipPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const zipFilePath = path.join(zipPath, file);
    if (fs.statSync(filePath).isFile()) {
      zipfile.addFile(filePath, zipFilePath);
    } else {
      await addDirectoryToZip(zipfile, filePath, zipFilePath);
    }
  }
}

async function packagePlatform(platform) {
  log(`Packaging for ${platform}...`, 'step');
  
  const binaryDir = path.join(CONFIG.buildDir, 'binaries', platform);
  
  // Check if binary exists, build if not
  if (!fs.existsSync(binaryDir)) {
    const target = CONFIG.pkgConfig.targets.find(t => t.includes(platform.replace('-', '-')));
    if (target) {
      await buildBinary(target);
    }
  }
  
  if (!fs.existsSync(binaryDir)) {
    log(`Binary not found for ${platform}, skipping...`, 'warning');
    return null;
  }
  
  // Create archive
  const isWindows = platform.startsWith('win');
  const archiveName = `${CONFIG.name}-${CONFIG.version}-${platform}.${isWindows ? 'zip' : 'tar.gz'}`;
  
  if (isWindows) {
    return await createZip(binaryDir, archiveName);
  } else {
    return await createTarGz(binaryDir, archiveName);
  }
}

async function generateManifest() {
  log('Generating package manifest...', 'step');
  
  const manifest = {
    version: CONFIG.version,
    name: CONFIG.name,
    builtAt: new Date().toISOString(),
    packages: {}
  };
  
  const files = fs.readdirSync(CONFIG.outputDir);
  for (const file of files) {
    const filePath = path.join(CONFIG.outputDir, file);
    if (fs.statSync(filePath).isFile()) {
      const hash = require('crypto')
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
      
      const stats = fs.statSync(filePath);
      
      manifest.packages[file] = {
        size: stats.size,
        sha256: hash,
        url: `https://github.com/yourorg/${CONFIG.name}/releases/download/v${CONFIG.version}/${file}`
      };
    }
  }
  
  fs.writeFileSync(
    path.join(CONFIG.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  log('Manifest generated', 'success');
}

async function generateInstallScripts() {
  log('Generating install scripts...', 'step');
  
  // Generate install.sh
  const installSh = `#!/bin/bash
# Claude Code Clone Installer
# Auto-generated install script

set -e

VERSION="${CONFIG.version}"
REPO="yourorg/${CONFIG.name}"
INSTALL_DIR="\${INSTALL_DIR:-/usr/local/bin}"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "\$ARCH" in
  x86_64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: \$ARCH"; exit 1 ;;
esac

case "\$OS" in
  darwin) PLATFORM="macos-\$ARCH" ;;
  linux) PLATFORM="linux-\$ARCH" ;;
  *) echo "Unsupported OS: \$OS"; exit 1 ;;
esac

echo "Installing Claude Code Clone v\$VERSION for \$PLATFORM..."

# Download
DOWNLOAD_URL="https://github.com/\$REPO/releases/download/v\$VERSION/${CONFIG.name}-\$VERSION-\$PLATFORM.tar.gz"
curl -fsSL "\$DOWNLOAD_URL" -o /tmp/claude-code-clone.tar.gz

# Extract
tar -xzf /tmp/claude-code-clone.tar.gz -C /tmp

# Install
sudo mv /tmp/${CONFIG.name} "\$INSTALL_DIR/"
sudo chmod +x "\$INSTALL_DIR/${CONFIG.name}"

# Cleanup
rm -f /tmp/claude-code-clone.tar.gz

echo "✓ Claude Code Clone v\$VERSION installed successfully!"
echo "Run 'claude-code --help' to get started."
`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'install.sh'), installSh);
  fs.chmodSync(path.join(CONFIG.outputDir, 'install.sh'), 0o755);
  
  // Generate install.ps1
  const installPs1 = `# Claude Code Clone Installer for Windows
# Auto-generated install script

param(
    [string]$Version = "${CONFIG.version}",
    [string]$InstallDir = "$env:LOCALAPPDATA\\Programs\\ClaudeCodeClone"
)

$ErrorActionPreference = "Stop"

$repo = "yourorg/${CONFIG.name}"
$platform = "win-x64"
$archiveName = "${CONFIG.name}-$Version-$platform.zip"
$downloadUrl = "https://github.com/$repo/releases/download/v$Version/$archiveName"

Write-Host "Installing Claude Code Clone v$Version for Windows..."

# Create install directory
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Download
$tempFile = "$env:TEMP\\$archiveName"
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile

# Extract
Expand-Archive -Path $tempFile -DestinationPath $InstallDir -Force

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "User")
    Write-Host "Added $InstallDir to PATH"
}

# Cleanup
Remove-Item $tempFile -Force

Write-Host "✓ Claude Code Clone v$Version installed successfully!" -ForegroundColor Green
Write-Host "Run 'claude-code --help' to get started."
`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'install.ps1'), installPs1);
  
  log('Install scripts generated', 'success');
}

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║    Claude Code Clone - Packaging System v1.0.0         ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const buildAll = args.includes('--all');
  const platformArg = args.find(arg => arg.startsWith('--platform='))?.split('=')[1];
  const archArg = args.find(arg => arg.startsWith('--arch='))?.split('=')[1];

  try {
    await clean();
    
    // Always build npm package
    await buildNpmPackage();
    
    if (buildAll) {
      // Build all platforms
      for (const target of CONFIG.pkgConfig.targets) {
        const platform = target.replace('node18-', '');
        await packagePlatform(platform);
      }
    } else if (platformArg) {
      // Build specific platform
      const platform = archArg ? `${platformArg}-${archArg}` : platformArg;
      await packagePlatform(platform);
    } else {
      // Build current platform
      const currentPlatform = getCurrentPlatform();
      await packagePlatform(currentPlatform);
    }
    
    await generateManifest();
    await generateInstallScripts();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}${colors.green}✓ Packaging completed successfully in ${duration}s${colors.reset}\n`);
    
    // List created packages
    const packages = fs.readdirSync(CONFIG.outputDir);
    console.log(`${colors.bright}Created packages:${colors.reset}`);
    for (const pkg of packages) {
      const stats = fs.statSync(path.join(CONFIG.outputDir, pkg));
      const size = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  ${colors.cyan}•${colors.reset} ${pkg} (${size} MB)`);
    }
    console.log();
  } catch (e) {
    console.error(`\n${colors.bright}${colors.red}✗ Packaging failed: ${e.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Claude Code Clone Packaging Script

Usage:
  node scripts/pack.js [options]

Options:
  --all                Package all platforms
  --platform=<name>    Package specific platform (macos, linux, win)
  --arch=<arch>        Architecture (x64, arm64)
  --help, -h           Show this help message

Examples:
  node scripts/pack.js --all
  node scripts/pack.js --platform=macos --arch=arm64
`);
  process.exit(0);
}

main();
