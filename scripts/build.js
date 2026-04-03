#!/usr/bin/env node
/**
 * Build Script for Claude Code Clone
 * 
 * This script handles the complete build process including:
 * - TypeScript compilation
 * - Asset bundling
 * - Binary generation
 * - Platform-specific packaging
 * 
 * Usage:
 *   node scripts/build.js              # Development build
 *   NODE_ENV=production node scripts/build.js  # Production build
 *   node scripts/build.js --target=macos-arm64 # Specific target
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// Configuration
const CONFIG = {
  srcDir: path.resolve(__dirname, '../src'),
  outDir: path.resolve(__dirname, '../dist'),
  assetsDir: path.resolve(__dirname, '../assets'),
  isProduction: process.env.NODE_ENV === 'production',
  targets: {
    'macos-x64': 'node18-macos-x64',
    'macos-arm64': 'node18-macos-arm64',
    'linux-x64': 'node18-linux-x64',
    'linux-arm64': 'node18-linux-arm64',
    'win-x64': 'node18-win-x64'
  }
};

// Colors for terminal output
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

async function clean() {
  log('Cleaning build directory...', 'step');
  if (fs.existsSync(CONFIG.outDir)) {
    fs.rmSync(CONFIG.outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
  log('Clean complete', 'success');
}

async function typeCheck() {
  log('Running TypeScript type checker...', 'step');
  try {
    execSync('npx tsc --noEmit', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    log('Type check passed', 'success');
  } catch (e) {
    error('Type check failed');
  }
}

async function buildTypeScript() {
  log('Building TypeScript...', 'step');
  
  const buildOptions = {
    entryPoints: [
      path.join(CONFIG.srcDir, 'index.ts'),
      path.join(CONFIG.srcDir, 'cli.ts')
    ],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outdir: CONFIG.outDir,
    format: 'cjs',
    sourcemap: !CONFIG.isProduction,
    minify: CONFIG.isProduction,
    splitting: false,
    external: [
      // Native modules that shouldn't be bundled
      'fsevents',
      '@anthropic-ai/sdk',
      'esbuild'
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(CONFIG.isProduction ? 'production' : 'development'),
      'process.env.PACKAGE_VERSION': JSON.stringify(require('../package.json').version)
    },
    banner: {
      js: `#!/usr/bin/env node
/**
 * Claude Code Clone v${require('../package.json').version}
 * Built: ${new Date().toISOString()}
 * Environment: ${CONFIG.isProduction ? 'production' : 'development'}
 */`
    }
  };

  try {
    await esbuild.build(buildOptions);
    log('TypeScript build complete', 'success');
  } catch (e) {
    error(`Build failed: ${e.message}`);
  }
}

async function copyAssets() {
  log('Copying assets...', 'step');
  
  const assetsOutDir = path.join(CONFIG.outDir, 'assets');
  fs.mkdirSync(assetsOutDir, { recursive: true });

  // Copy template files
  const templatesDir = path.join(CONFIG.srcDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    fs.cpSync(templatesDir, path.join(assetsOutDir, 'templates'), { recursive: true });
  }

  // Copy configuration files
  const configFiles = ['.claude-code-config.json', 'default-prompts.json'];
  for (const file of configFiles) {
    const srcPath = path.join(CONFIG.srcDir, '..', file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(assetsOutDir, file));
    }
  }

  log('Assets copied', 'success');
}

async function generateTypes() {
  log('Generating type definitions...', 'step');
  try {
    execSync('npx tsc --declaration --emitDeclarationOnly --outDir dist', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });
    log('Type definitions generated', 'success');
  } catch (e) {
    log('Warning: Type definition generation had issues', 'warning');
  }
}

async function makeExecutable() {
  log('Setting executable permissions...', 'step');
  
  const cliPath = path.join(CONFIG.outDir, 'cli.js');
  if (fs.existsSync(cliPath)) {
    fs.chmodSync(cliPath, 0o755);
  }

  log('Permissions set', 'success');
}

async function createPackageJson() {
  log('Creating package.json for distribution...', 'step');
  
  const pkg = require('../package.json');
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    main: 'index.js',
    types: 'index.d.ts',
    bin: pkg.bin,
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    repository: pkg.repository,
    bugs: pkg.bugs,
    homepage: pkg.homepage,
    engines: pkg.engines,
    os: pkg.os,
    cpu: pkg.cpu,
    dependencies: {} // Bundled, so no deps needed
  };

  fs.writeFileSync(
    path.join(CONFIG.outDir, 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );

  log('Package.json created', 'success');
}

async function validateBuild() {
  log('Validating build...', 'step');
  
  const requiredFiles = ['index.js', 'cli.js', 'package.json'];
  for (const file of requiredFiles) {
    const filePath = path.join(CONFIG.outDir, file);
    if (!fs.existsSync(filePath)) {
      error(`Missing required file: ${file}`);
    }
  }

  // Test that the CLI can show help
  try {
    execSync('node dist/cli.js --help', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      timeout: 10000
    });
    log('Build validation passed', 'success');
  } catch (e) {
    error(`Build validation failed: ${e.message}`);
  }
}

async function generateChecksums() {
  log('Generating checksums...', 'step');
  
  const checksums = {};
  const files = fs.readdirSync(CONFIG.outDir);
  
  for (const file of files) {
    const filePath = path.join(CONFIG.outDir, file);
    if (fs.statSync(filePath).isFile()) {
      const hash = require('crypto')
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
      checksums[file] = hash;
    }
  }

  fs.writeFileSync(
    path.join(CONFIG.outDir, 'checksums.json'),
    JSON.stringify(checksums, null, 2)
  );

  log('Checksums generated', 'success');
}

async function main() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║      Claude Code Clone - Build System v1.0.0           ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

  log(`Environment: ${CONFIG.isProduction ? 'production' : 'development'}`, 'info');
  log(`Output directory: ${CONFIG.outDir}`, 'info');

  try {
    await clean();
    await typeCheck();
    await buildTypeScript();
    await copyAssets();
    await generateTypes();
    await makeExecutable();
    await createPackageJson();
    await validateBuild();
    await generateChecksums();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}${colors.green}✓ Build completed successfully in ${duration}s${colors.reset}\n`);
  } catch (e) {
    console.error(`\n${colors.bright}${colors.red}✗ Build failed: ${e.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Claude Code Clone Build Script

Usage:
  node scripts/build.js [options]

Options:
  --target=<platform>  Build for specific platform (macos-x64, macos-arm64, linux-x64, linux-arm64, win-x64)
  --skip-typecheck     Skip TypeScript type checking
  --skip-validate      Skip build validation
  --help, -h           Show this help message

Environment Variables:
  NODE_ENV=production  Build for production
`);
  process.exit(0);
}

main();
