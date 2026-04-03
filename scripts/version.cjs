#!/usr/bin/env node
/**
 * Version Management Script
 * 
 * Manages version numbers across all package files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to update
const FILES = [
  'package.json',
  'package-lock.json',
  'src/version.ts',
  'debian/changelog',
  'aur/PKGBUILD',
  'aur/.SRCINFO',
  'rpm/claude-code-clone.spec',
  'homebrew/claude-code-clone.rb',
  'Dockerfile'
];

function getCurrentVersion() {
  const pkg = require('../package.json');
  return pkg.version;
}

function updatePackageJson(version) {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated package.json`);
}

function updatePackageLock(version) {
  const lockPath = path.join(__dirname, '../package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = version;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = version;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    console.log(`✓ Updated package-lock.json`);
  }
}

function updateVersionTs(version) {
  const versionPath = path.join(__dirname, '../src/version.ts');
  const content = `// Auto-generated version file
export const VERSION = '${version}';
export const BUILD_DATE = '${new Date().toISOString()}';
`;
  fs.writeFileSync(versionPath, content);
  console.log(`✓ Updated src/version.ts`);
}

function updateDebianChangelog(version) {
  const changelogPath = path.join(__dirname, '../debian/changelog');
  const date = execSync('date -R').toString().trim();
  const entry = `claude-code-clone (${version}-1) unstable; urgency=medium

  * Release version ${version}

 -- Your Name <your.email@example.com>  ${date}

`;
  
  let existing = '';
  if (fs.existsSync(changelogPath)) {
    existing = fs.readFileSync(changelogPath, 'utf8');
  }
  
  fs.writeFileSync(changelogPath, entry + existing);
  console.log(`✓ Updated debian/changelog`);
}

function updateAurPkgbuild(version) {
  const pkgbuildPath = path.join(__dirname, '../aur/PKGBUILD');
  if (fs.existsSync(pkgbuildPath)) {
    let content = fs.readFileSync(pkgbuildPath, 'utf8');
    content = content.replace(/pkgver=.*/, `pkgver=${version}`);
    content = content.replace(/pkgrel=.*/, 'pkgrel=1');
    fs.writeFileSync(pkgbuildPath, content);
    console.log(`✓ Updated aur/PKGBUILD`);
  }
}

function updateAurSrcinfo(version) {
  const srcinfoPath = path.join(__dirname, '../aur/.SRCINFO');
  if (fs.existsSync(srcinfoPath)) {
    let content = fs.readFileSync(srcinfoPath, 'utf8');
    content = content.replace(/pkgver = .*/, `pkgver = ${version}`);
    content = content.replace(/pkgrel = .*/, 'pkgrel = 1');
    fs.writeFileSync(srcinfoPath, content);
    console.log(`✓ Updated aur/.SRCINFO`);
  }
}

function updateRpmSpec(version) {
  const specPath = path.join(__dirname, '../rpm/claude-code-clone.spec');
  if (fs.existsSync(specPath)) {
    let content = fs.readFileSync(specPath, 'utf8');
    content = content.replace(/Version:.*/, `Version:        ${version}`);
    fs.writeFileSync(specPath, content);
    console.log(`✓ Updated rpm/claude-code-clone.spec`);
  }
}

function updateHomebrewFormula(version) {
  const formulaPath = path.join(__dirname, '../homebrew/claude-code-clone.rb');
  if (fs.existsSync(formulaPath)) {
    let content = fs.readFileSync(formulaPath, 'utf8');
    content = content.replace(/version "[^"]+"/, `version "${version}"`);
    fs.writeFileSync(formulaPath, content);
    console.log(`✓ Updated homebrew/claude-code-clone.rb`);
  }
}

function updateDockerfile(version) {
  const dockerfilePath = path.join(__dirname, '../Dockerfile');
  if (fs.existsSync(dockerfilePath)) {
    let content = fs.readFileSync(dockerfilePath, 'utf8');
    content = content.replace(/version="[^"]+"/, `version="${version}"`);
    fs.writeFileSync(dockerfilePath, content);
    console.log(`✓ Updated Dockerfile`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'get') {
    console.log(getCurrentVersion());
    return;
  }

  if (command === 'set' && args[1]) {
    const newVersion = args[1].replace(/^v/, '');
    
    console.log(`Updating version to ${newVersion}...\n`);
    
    updatePackageJson(newVersion);
    updatePackageLock(newVersion);
    updateVersionTs(newVersion);
    updateDebianChangelog(newVersion);
    updateAurPkgbuild(newVersion);
    updateAurSrcinfo(newVersion);
    updateRpmSpec(newVersion);
    updateHomebrewFormula(newVersion);
    updateDockerfile(newVersion);
    
    console.log('\n✓ All files updated successfully!');
    return;
  }

  if (command === 'bump') {
    const type = args[1] || 'patch';
    const current = getCurrentVersion();
    const parts = current.split('.').map(Number);
    
    switch (type) {
      case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
      case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
      case 'patch':
      default:
        parts[2]++;
    }
    
    const newVersion = parts.join('.');
    
    console.log(`Bumping ${type} version: ${current} -> ${newVersion}\n`);
    
    updatePackageJson(newVersion);
    updatePackageLock(newVersion);
    updateVersionTs(newVersion);
    updateDebianChangelog(newVersion);
    updateAurPkgbuild(newVersion);
    updateAurSrcinfo(newVersion);
    updateRpmSpec(newVersion);
    updateHomebrewFormula(newVersion);
    updateDockerfile(newVersion);
    
    console.log('\n✓ Version bumped successfully!');
    console.log(`Run "git add . && git commit -m 'chore(release): v${newVersion}'" to commit changes`);
    return;
  }

  console.log(`
Version Management Script

Usage:
  node scripts/version.js <command> [options]

Commands:
  get                    Get current version
  set <version>          Set version to specific value
  bump [type]            Bump version (major|minor|patch)

Examples:
  node scripts/version.js get
  node scripts/version.js set 1.2.3
  node scripts/version.js bump patch
  node scripts/version.js bump minor
  node scripts/version.js bump major
`);
}

main();
