/**
 * Update Checker Module
 * 
 * Checks for available updates from GitHub releases and notifies users.
 * Supports configurable check intervals and update channels.
 */

import * as https from 'https';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  isUpdateAvailable: boolean;
  releaseUrl: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
  isPrerelease: boolean;
}

export interface UpdateCheckerConfig {
  repository: string;
  currentVersion: string;
  checkInterval: number; // milliseconds
  channel: 'stable' | 'beta' | 'alpha';
  autoCheck: boolean;
  lastCheckFile: string;
}

export class UpdateChecker {
  private config: UpdateCheckerConfig;
  private lastCheckTime: number = 0;
  private cachedUpdateInfo: UpdateInfo | null = null;

  constructor(config: Partial<UpdateCheckerConfig> = {}) {
    this.config = {
      repository: 'yourorg/claude-code-clone',
      currentVersion: process.env.PACKAGE_VERSION || '0.0.0',
      checkInterval: 24 * 60 * 60 * 1000, // 24 hours
      channel: 'stable',
      autoCheck: true,
      lastCheckFile: path.join(os.homedir(), '.config', 'claude-code-clone', '.last-update-check'),
      ...config
    };

    this.loadLastCheckTime();
  }

  /**
   * Load the last check time from file
   */
  private loadLastCheckTime(): void {
    try {
      if (fs.existsSync(this.config.lastCheckFile)) {
        const data = fs.readFileSync(this.config.lastCheckFile, 'utf8');
        this.lastCheckTime = parseInt(data, 10) || 0;
      }
    } catch {
      this.lastCheckTime = 0;
    }
  }

  /**
   * Save the last check time to file
   */
  private saveLastCheckTime(): void {
    try {
      const dir = path.dirname(this.config.lastCheckFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.config.lastCheckFile, Date.now().toString());
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Check if it's time to check for updates
   */
  shouldCheck(): boolean {
    if (!this.config.autoCheck) return false;
    
    const now = Date.now();
    return (now - this.lastCheckTime) >= this.config.checkInterval;
  }

  /**
   * Fetch latest release information from GitHub
   */
  private async fetchLatestRelease(): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.config.repository}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': `claude-code-clone/${this.config.currentVersion}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else if (res.statusCode === 403) {
              reject(new Error('API rate limit exceeded. Please try again later.'));
            } else {
              reject(new Error(`GitHub API returned ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error('Failed to parse release data'));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Get the appropriate download URL for the current platform
   */
  private getDownloadUrl(release: any): string {
    const platform = this.getPlatform();
    const arch = this.getArch();
    const assetName = `claude-code-clone-${release.tag_name}-${platform}-${arch}.${platform === 'win' ? 'zip' : 'tar.gz'}`;
    
    const asset = release.assets?.find((a: any) => a.name === assetName);
    return asset?.browser_download_url || release.html_url;
  }

  /**
   * Get platform identifier
   */
  private getPlatform(): string {
    const platforms: Record<string, string> = {
      'darwin': 'macos',
      'linux': 'linux',
      'win32': 'win'
    };
    return platforms[process.platform] || 'linux';
  }

  /**
   * Get architecture identifier
   */
  private getArch(): string {
    const arches: Record<string, string> = {
      'x64': 'x64',
      'arm64': 'arm64'
    };
    return arches[process.arch] || 'x64';
  }

  /**
   * Check if version matches the update channel
   */
  private matchesChannel(version: string): boolean {
    const preRelease = semver.prerelease(version);
    
    switch (this.config.channel) {
      case 'stable':
        return preRelease === null;
      case 'beta':
        return preRelease === null || 
               (preRelease.length > 0 && ['beta', 'rc'].includes(preRelease[0] as string));
      case 'alpha':
        return true; // Accept all versions
      default:
        return preRelease === null;
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
    // Return cached result if available and not forcing
    if (!force && this.cachedUpdateInfo) {
      return this.cachedUpdateInfo;
    }

    // Check if we should check based on interval
    if (!force && !this.shouldCheck()) {
      return null;
    }

    try {
      const release = await this.fetchLatestRelease();
      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = this.config.currentVersion;

      // Check if update is available
      const isUpdateAvailable = semver.gt(latestVersion, currentVersion) && 
                                this.matchesChannel(latestVersion);

      const updateInfo: UpdateInfo = {
        version: latestVersion,
        currentVersion,
        isUpdateAvailable,
        releaseUrl: release.html_url,
        downloadUrl: this.getDownloadUrl(release),
        releaseNotes: release.body || '',
        publishedAt: release.published_at,
        isPrerelease: release.prerelease || false
      };

      // Cache and save check time
      this.cachedUpdateInfo = updateInfo;
      this.lastCheckTime = Date.now();
      this.saveLastCheckTime();

      return updateInfo;
    } catch (error) {
      // Silently fail for auto-checks
      if (!force) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Format update notification message
   */
  formatUpdateMessage(updateInfo: UpdateInfo): string {
    const lines = [
      '',
      '╔════════════════════════════════════════════════════════════╗',
      '║                    Update Available!                       ║',
      '╚════════════════════════════════════════════════════════════╝',
      '',
      `  Current version: ${updateInfo.currentVersion}`,
      `  Latest version:  ${updateInfo.version}`,
      `  Released:        ${new Date(updateInfo.publishedAt).toLocaleDateString()}`,
      ''
    ];

    if (updateInfo.isPrerelease) {
      lines.push('  ⚠️  This is a pre-release version');
      lines.push('');
    }

    lines.push('  Update now:');
    lines.push(`    npm install -g claude-code-clone@${updateInfo.version}`);
    lines.push('');
    lines.push(`  Release notes: ${updateInfo.releaseUrl}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Notify user about available update (if any)
   */
  async notifyIfUpdateAvailable(): Promise<void> {
    try {
      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo?.isUpdateAvailable) {
        console.log(this.formatUpdateMessage(updateInfo));
      }
    } catch {
      // Silently fail - don't interrupt user workflow
    }
  }

  /**
   * Get update configuration
   */
  getConfig(): UpdateCheckerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<UpdateCheckerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const updateChecker = new UpdateChecker();
