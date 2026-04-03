# Deployment Guide

This guide covers deploying and managing Claude Code Clone in production environments.

## Table of Contents

- [Overview](#overview)
- [Release Process](#release-process)
- [CI/CD Pipeline](#cicd-pipeline)
- [Package Distribution](#package-distribution)
- [Version Management](#version-management)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Telemetry](#monitoring--telemetry)
- [Security](#security)

## Overview

Claude Code Clone uses a comprehensive deployment infrastructure that supports:

- **Multi-platform builds**: macOS (x64, ARM64), Linux (x64, ARM64), Windows (x64)
- **Multiple distribution channels**: npm, Homebrew, AUR, APT, YUM/DNF, Docker
- **Automated releases**: GitHub Actions workflows for CI/CD
- **Auto-update system**: Built-in update checking and installation
- **Telemetry & error reporting**: Optional usage analytics and crash reporting

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Pre-release versions:
- `1.0.0-alpha.1` - Early testing
- `1.0.0-beta.1` - Feature complete, testing
- `1.0.0-rc.1` - Release candidate

### Creating a Release

1. **Update version:**
   ```bash
   npm version [patch|minor|major]
   ```

2. **Update CHANGELOG.md:**
   ```markdown
   ## [1.0.0] - 2024-01-01
   
   ### Added
   - New feature description
   
   ### Changed
   - Change description
   
   ### Fixed
   - Bug fix description
   ```

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "chore(release): prepare v1.0.0"
   git push origin main
   ```

4. **Create and push tag:**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

5. **GitHub Actions will automatically:**
   - Run tests
   - Build packages
   - Create GitHub Release
   - Publish to npm
   - Update Homebrew formula
   - Update AUR package

### Manual Release

```bash
# Build all packages
npm run pack:all

# Create release draft
gh release create v1.0.0 --draft --title "v1.0.0" --notes-file CHANGELOG.md

# Upload assets
gh release upload v1.0.0 build/packages/*

# Publish release
gh release edit v1.0.0 --draft=false
```

## CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to main | Lint, test, build verification |
| `test.yml` | Push/PR, scheduled | Full test suite |
| `build.yml` | Push/PR, tags | Multi-platform builds |
| `release.yml` | Tags | Full release automation |

### Pipeline Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Lint     │───>│    Test     │───>│    Build    │───>│   Release   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
 ESLint/TS Type      Unit/E2E         All Platforms     GitHub/npm/
   Checking           Tests             Binaries        Homebrew/AUR
```

### Required Secrets

Configure these in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm publishing token |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password |
| `HOMEBREW_TAP_TOKEN` | GitHub token for Homebrew tap |
| `AUR_SSH_KEY` | SSH key for AUR publishing |
| `SLACK_WEBHOOK_URL` | Slack notifications (optional) |

## Package Distribution

### npm Registry

**Configuration:** `package.json`

```json
{
  "name": "claude-code-clone",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

**Publishing:**
```bash
npm publish --access public
```

### Homebrew Tap

**Repository:** `yourorg/homebrew-tap`

**Formula:** `Formula/claude-code-clone.rb`

**Auto-update via GitHub Actions:**
```yaml
- name: Update Homebrew formula
  run: |
    # Download binaries and calculate SHA256
    # Update formula with new version and checksums
    # Commit and push to tap repo
```

### AUR Package

**Repository:** `aur.archlinux.org/claude-code-clone.git`

**Files:**
- `PKGBUILD` - Package build script
- `.SRCINFO` - Package metadata

**Auto-update via GitHub Actions:**
```yaml
- name: Update AUR package
  run: |
    # Update PKGBUILD version and checksums
    # Update .SRCINFO
    # Commit and push to AUR
```

### Debian Package

**Build:**
```bash
cd debian
dpkg-buildpackage -us -uc -b
```

**Repository Setup:**
```bash
# Create repository structure
reprepro includedeb stable ../claude-code-clone_1.0.0_amd64.deb
```

### RPM Package

**Build:**
```bash
rpmbuild -ba rpm/claude-code-clone.spec
```

**Repository Setup:**
```bash
createrepo /path/to/rpm/repo
```

### Docker Hub

**Multi-platform build:**
```bash
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag yourusername/claude-code-clone:1.0.0 \
  --tag yourusername/claude-code-clone:latest \
  --push .
```

## Version Management

### Version Files

| File | Purpose |
|------|---------|
| `package.json` | npm version |
| `src/version.ts` | Runtime version |
| `debian/changelog` | Debian package version |
| `aur/PKGBUILD` | AUR package version |
| `rpm/claude-code-clone.spec` | RPM package version |

### Version Check Script

```bash
# scripts/version.js
#!/usr/bin/env node
const pkg = require('../package.json');
console.log(`v${pkg.version}`);
```

### Auto-update Configuration

```typescript
// src/update/UpdateChecker.ts
const updateChecker = new UpdateChecker({
  repository: 'yourorg/claude-code-clone',
  checkInterval: 24 * 60 * 60 * 1000, // 24 hours
  channel: 'stable'
});
```

## Rollback Procedures

### npm Rollback

```bash
# Unpublish (within 24 hours)
npm unpublish claude-code-clone@1.0.0

# Or deprecate
npm deprecate claude-code-clone@1.0.0 "Critical bug, use 1.0.1"
```

### GitHub Release Rollback

1. Delete release tag:
   ```bash
   git push --delete origin v1.0.0
   git tag --delete v1.0.0
   ```

2. Delete GitHub release (via web UI or API)

3. Restore from backup if needed

### Homebrew Rollback

```bash
# Revert formula to previous version
cd homebrew-tap
git revert HEAD
git push
```

### AUR Rollback

```bash
# Push previous PKGBUILD
git checkout HEAD~1 -- PKGBUILD .SRCINFO
git commit -m "Rollback to previous version"
git push
```

### Emergency Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

VERSION=$1
PREVIOUS_VERSION=$2

# Rollback npm
npm deprecate "claude-code-clone@$VERSION" "Rolled back, use $PREVIOUS_VERSION"

# Rollback GitHub release
gh release delete "v$VERSION" --yes

# Notify
slack-notify "Rolled back claude-code-clone from $VERSION to $PREVIOUS_VERSION"
```

## Monitoring & Telemetry

### Telemetry Configuration

```typescript
// src/telemetry/TelemetryClient.ts
const telemetry = new TelemetryClient({
  enabled: true,
  endpoint: 'https://telemetry.claude-code.dev/events',
  batchSize: 10,
  flushInterval: 30000
});
```

### Error Reporting

```typescript
// src/telemetry/ErrorReporter.ts
const errorReporter = new ErrorReporter({
  enabled: true,
  endpoint: 'https://errors.claude-code.dev/api/error',
  environment: 'production',
  release: process.env.PACKAGE_VERSION
});
```

### Analytics

```typescript
// src/telemetry/Analytics.ts
const analytics = createAnalytics(telemetry);
analytics.trackCommand('init', [], 1500);
analytics.trackFeature('git-integration');
```

### Health Checks

```yaml
# Docker health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node /app/dist/cli.js --version || exit 1
```

### Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Downloads | npm/GitHub | N/A |
| Install Success Rate | Telemetry | < 95% |
| Error Rate | Error Reporter | > 1% |
| Update Adoption | Telemetry | N/A |
| API Response Time | Telemetry | > 5s |

## Security

### Code Signing

**macOS:**
```bash
codesign --force --options runtime --sign "Developer ID Application" \
  claude-code-clone
```

**Windows:**
```powershell
# Sign with certificate
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com \
  claude-code-clone.exe
```

### Checksum Verification

```bash
# Generate checksums
sha256sum claude-code-clone-* > checksums.txt

# Verify
cat checksums.txt | sha256sum -c
```

### npm Package Security

```bash
# Audit dependencies
npm audit

# Fix issues
npm audit fix

# Scan with Snyk
npx snyk test
```

### Secrets Management

- Use GitHub Secrets for CI/CD
- Rotate tokens regularly
- Use least-privilege access
- Never commit secrets to repository

### Security Scanning

```yaml
# .github/workflows/security.yml
- name: Run Snyk
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

- name: Run Trivy
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
```

## Deployment Checklist

Before each release:

- [ ] All tests passing
- [ ] CHANGELOG.md updated
- [ ] Version bumped in all files
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Release notes prepared
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Secrets validated

## Support

For deployment issues:

- [GitHub Issues](https://github.com/yourorg/claude-code-clone/issues)
- [Deployment Documentation](https://github.com/yourorg/claude-code-clone/blob/main/DEPLOY.md)
- Email: deploy@claude-code.dev
