#!/usr/bin/env node
/**
 * Claude Code Clone - Node.js Installer
 * 
 * Cross-platform installation script that works on any system with Node.js.
 * 
 * Usage:
 *   npx claude-code-clone-install
 *   node install.js [--version=VERSION] [--dir=DIRECTORY]
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Configuration
const CONFIG = {
  repo: 'yourorg/claude-code-clone',
  binaryName: 'claude-code-clone',
  defaultInstallDir: {
    win32: path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ClaudeCodeClone'),
    darwin: '/usr/local/bin',
    linux: '/usr/local/bin'
  }
};

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Logger
const logger = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`)
};

// Print banner
function printBanner() {
  console.log(`${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║              Claude Code Clone Installer                   ║');
  console.log('║                                                            ║');
  console.log('║         AI-powered terminal coding assistant               ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
}

// Detect platform
function detectPlatform() {
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
  
  const mappedPlatform = platformMap[platform];
  const mappedArch = archMap[arch];
  
  if (!mappedPlatform || !mappedArch) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }
  
  return `${mappedPlatform}-${mappedArch}`;
}

// Get install directory
function getInstallDir(customDir) {
  if (customDir) return customDir;
  return CONFIG.defaultInstallDir[process.platform] || CONFIG.defaultInstallDir.linux;
}

// Fetch latest version
async function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${CONFIG.repo}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'claude-code-clone-installer'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve(release.tag_name);
        } catch (e) {
          reject(new Error('Failed to parse release data'));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Download file
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, { headers: { 'User-Agent': 'claude-code-clone-installer' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\r${colors.cyan}Downloading... ${percent}%${colors.reset}`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        process.stdout.write('\n');
        file.close(resolve);
      });
    }).on('error', reject);
  });
}

// Extract archive
async function extractArchive(archivePath, destDir) {
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Use PowerShell for Windows
    execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    // Use tar for Unix
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

// Check if sudo is needed
function needsSudo(installDir) {
  try {
    fs.accessSync(installDir, fs.constants.W_OK);
    return false;
  } catch {
    return true;
  }
}

// Install binary
async function installBinary(sourcePath, installDir, useSudo) {
  const binaryName = process.platform === 'win32' ? `${CONFIG.binaryName}.exe` : CONFIG.binaryName;
  const destPath = path.join(installDir, binaryName);
  
  // Create install directory
  if (useSudo) {
    execSync(`sudo mkdir -p "${installDir}"`, { stdio: 'inherit' });
  } else {
    fs.mkdirSync(installDir, { recursive: true });
  }
  
  // Move binary
  if (useSudo) {
    execSync(`sudo mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
    execSync(`sudo chmod +x "${destPath}"`, { stdio: 'inherit' });
  } else {
    fs.renameSync(sourcePath, destPath);
    fs.chmodSync(destPath, 0o755);
  }
  
  // Create symlink for 'ccode'
  const ccodePath = path.join(installDir, process.platform === 'win32' ? 'ccode.exe' : 'ccode');
  try {
    if (useSudo) {
      execSync(`sudo ln -sf "${destPath}" "${ccodePath}"`, { stdio: 'ignore' });
    } else {
      fs.symlinkSync(destPath, ccodePath);
    }
  } catch {
    // Symlink creation failed, ignore
  }
  
  return destPath;
}

// Add to PATH
async function addToPath(installDir) {
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Add to Windows PATH
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(installDir)) {
      execSync(`setx PATH "%PATH%;${installDir}"`, { stdio: 'ignore' });
      logger.warning('Please restart your terminal for PATH changes to take effect');
    }
  } else {
    // Check if already in PATH
    const currentPath = process.env.PATH || '';
    if (currentPath.split(':').includes(installDir)) {
      return;
    }
    
    // Suggest adding to shell profile
    const shell = process.env.SHELL || '/bin/bash';
    const profileFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
    
    logger.info(`Add the following to your shell profile (${profileFile}):`);
    console.log(`  export PATH="${installDir}:$PATH"`);
  }
}

// Verify installation
async function verifyInstallation(binaryPath) {
  try {
    const version = execSync(`"${binaryPath}" --version`, { encoding: 'utf8' }).trim();
    logger.success(`Claude Code Clone ${version} installed successfully!`);
    return true;
  } catch {
    logger.warning('Could not verify version, but installation completed');
    return false;
  }
}

// Uninstall
async function uninstall(installDir) {
  logger.step('Uninstalling Claude Code Clone...');
  
  const binaryName = process.platform === 'win32' ? `${CONFIG.binaryName}.exe` : CONFIG.binaryName;
  const binaryPath = path.join(installDir, binaryName);
  const ccodePath = path.join(installDir, process.platform === 'win32' ? 'ccode.exe' : 'ccode');
  
  const useSudo = needsSudo(installDir);
  
  if (fs.existsSync(binaryPath)) {
    if (useSudo) {
      execSync(`sudo rm -f "${binaryPath}"`, { stdio: 'ignore' });
      execSync(`sudo rm -f "${ccodePath}"`, { stdio: 'ignore' });
    } else {
      fs.unlinkSync(binaryPath);
      if (fs.existsSync(ccodePath)) {
        fs.unlinkSync(ccodePath);
      }
    }
  }
  
  // Remove config directory
  const configDir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'claude-code-clone')
    : path.join(process.env.HOME || '', '.config', 'claude-code-clone');
  
  if (fs.existsSync(configDir)) {
    logger.info(`Configuration directory: ${configDir}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Remove configuration directory? [y/N] ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() === 'y') {
      fs.rmSync(configDir, { recursive: true, force: true });
      logger.success('Configuration removed');
    }
  }
  
  logger.success('Uninstallation complete');
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let version = 'latest';
  let installDir = null;
  let shouldUninstall = false;
  
  for (const arg of args) {
    if (arg.startsWith('--version=')) {
      version = arg.split('=')[1];
    } else if (arg.startsWith('--dir=')) {
      installDir = arg.split('=')[1];
    } else if (arg === '--uninstall') {
      shouldUninstall = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Claude Code Clone Installer

Usage: node install.js [OPTIONS]

Options:
  --version=VERSION    Install specific version (default: latest)
  --dir=DIRECTORY      Install directory
  --uninstall          Uninstall Claude Code Clone
  --help, -h           Show this help message

Examples:
  node install.js
  node install.js --version=1.0.0
  node install.js --dir=/opt/claude-code-clone
`);
      return;
    }
  }
  
  printBanner();
  
  installDir = getInstallDir(installDir);
  
  if (shouldUninstall) {
    await uninstall(installDir);
    return;
  }
  
  logger.info(`Install directory: ${installDir}`);
  logger.info(`Target version: ${version}`);
  
  // Detect platform
  const platform = detectPlatform();
  logger.info(`Platform: ${platform}`);
  
  // Get version
  if (version === 'latest') {
    logger.step('Fetching latest version...');
    version = await fetchLatestVersion();
    logger.info(`Latest version: ${version}`);
  }
  
  version = version.replace(/^v/, '');
  
  // Download
  logger.step(`Downloading Claude Code Clone v${version}...`);
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-clone-'));
  const archiveName = `${CONFIG.binaryName}-v${version}-${platform}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
  const downloadUrl = `https://github.com/${CONFIG.repo}/releases/download/v${version}/${archiveName}`;
  const archivePath = path.join(tempDir, archiveName);
  
  logger.info(`Download URL: ${downloadUrl}`);
  
  try {
    await downloadFile(downloadUrl, archivePath);
    logger.success('Download complete');
  } catch (e) {
    logger.error(`Download failed: ${e.message}`);
    process.exit(1);
  }
  
  // Extract
  logger.step('Extracting archive...');
  const extractDir = path.join(tempDir, 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });
  
  try {
    await extractArchive(archivePath, extractDir);
    logger.success('Extraction complete');
  } catch (e) {
    logger.error(`Extraction failed: ${e.message}`);
    process.exit(1);
  }
  
  // Find binary
  const binaryName = process.platform === 'win32' ? `${CONFIG.binaryName}.exe` : CONFIG.binaryName;
  const extractedBinary = path.join(extractDir, binaryName);
  
  if (!fs.existsSync(extractedBinary)) {
    logger.error('Binary not found in archive');
    process.exit(1);
  }
  
  // Install
  logger.step('Installing...');
  const useSudo = needsSudo(installDir);
  
  if (useSudo) {
    logger.info('Sudo access required for installation');
  }
  
  try {
    const installedPath = await installBinary(extractedBinary, installDir, useSudo);
    logger.success('Installation complete');
    
    // Add to PATH
    await addToPath(installDir);
    
    // Verify
    await verifyInstallation(installedPath);
  } catch (e) {
    logger.error(`Installation failed: ${e.message}`);
    process.exit(1);
  }
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log('');
  logger.success(`Claude Code Clone v${version} is ready to use!`);
  console.log('');
  console.log(`${colors.cyan}Quick start:${colors.reset}`);
  console.log('  claude-code --help       Show help');
  console.log('  claude-code --version    Show version');
  console.log('  claude-code              Start interactive session');
  console.log('');
  console.log(`${colors.cyan}Documentation:${colors.reset} https://github.com/${CONFIG.repo}#readme`);
  console.log('');
}

// Run
main().catch(e => {
  logger.error(e.message);
  process.exit(1);
});
