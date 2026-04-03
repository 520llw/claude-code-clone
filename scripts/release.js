#!/usr/bin/env node
/**
 * Release Script
 * 
 * Automates the release process.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function exec(command, options = {}) {
  console.log(`$ ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function getCurrentVersion() {
  const pkg = require('../package.json');
  return pkg.version;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Claude Code Clone Release Script              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check git status
  console.log('Checking git status...');
  try {
    execSync('git diff --quiet');
  } catch {
    console.error('Error: You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  // Get current branch
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  if (branch !== 'main' && branch !== 'master') {
    const proceed = await question(`You are on branch "${branch}". Continue? [y/N] `);
    if (proceed.toLowerCase() !== 'y') {
      process.exit(0);
    }
  }

  // Pull latest changes
  console.log('\nPulling latest changes...');
  exec('git pull origin ' + branch);

  // Get version type
  const currentVersion = getCurrentVersion();
  console.log(`\nCurrent version: ${currentVersion}`);
  console.log('\nVersion bump type:');
  console.log('  1. patch (bug fixes)');
  console.log('  2. minor (new features)');
  console.log('  3. major (breaking changes)');
  console.log('  4. custom version');
  
  const choice = await question('\nSelect option (1-4): ');
  
  let newVersion;
  switch (choice) {
    case '1':
      exec('node scripts/version.js bump patch');
      break;
    case '2':
      exec('node scripts/version.js bump minor');
      break;
    case '3':
      exec('node scripts/version.js bump major');
      break;
    case '4':
      const custom = await question('Enter version (e.g., 1.2.3): ');
      exec(`node scripts/version.js set ${custom}`);
      break;
    default:
      console.log('Invalid option');
      process.exit(1);
  }

  // Get the new version
  newVersion = getCurrentVersion();
  console.log(`\nNew version: ${newVersion}`);

  // Update CHANGELOG
  console.log('\nPlease update CHANGELOG.md before continuing.');
  const changelogUpdated = await question('Have you updated CHANGELOG.md? [y/N] ');
  if (changelogUpdated.toLowerCase() !== 'y') {
    console.log('Please update CHANGELOG.md and run the script again.');
    process.exit(0);
  }

  // Run tests
  console.log('\nRunning tests...');
  try {
    exec('npm run test:ci');
  } catch {
    const proceed = await question('Tests failed. Continue anyway? [y/N] ');
    if (proceed.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }

  // Build
  console.log('\nBuilding...');
  exec('npm run build:prod');

  // Commit changes
  console.log('\nCommitting changes...');
  exec('git add .');
  exec(`git commit -m "chore(release): v${newVersion}"`);

  // Create tag
  console.log('\nCreating tag...');
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

  // Push
  const shouldPush = await question('\nPush to remote? [Y/n] ');
  if (shouldPush.toLowerCase() !== 'n') {
    exec('git push origin ' + branch);
    exec(`git push origin v${newVersion}`);
    console.log('\n✓ Pushed! GitHub Actions will now build and publish the release.');
  } else {
    console.log('\n⚠ Don\'t forget to push:');
    console.log(`  git push origin ${branch}`);
    console.log(`  git push origin v${newVersion}`);
  }

  console.log('\n✓ Release process complete!');
  console.log(`\nMonitor the release at:`);
  console.log(`  https://github.com/yourorg/claude-code-clone/actions`);
  console.log(`  https://github.com/yourorg/claude-code-clone/releases`);

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
