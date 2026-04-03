/**
 * Update Installer Module
 * 
 * Handles installation of downloaded updates with backup creation,
 * atomic replacement, and rollback capability.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { UpdateDownloader } from './UpdateDownloader';

export interface InstallOptions {
  downloadUrl: string;
  checksum?: string;
  backupCurrent?: boolean;
  installDir?: string;
  restartAfterInstall?: boolean;
}

export interface InstallResult {
  success: boolean;
  previousVersion?: string;
  newVersion?: string;
  backupPath?: string;
  error?: string;
}

export interface BackupInfo {
  path: string;
  version: string;
  createdAt: Date;
}

export class UpdateInstaller extends EventEmitter {
  private downloader: UpdateDownloader;
  private backupDir: string;

  constructor() {
    super();
    this.downloader = new UpdateDownloader();
    this.backupDir = path.join(os.homedir(), '.config', 'claude-code-clone', 'backups');
  }

  /**
   * Install an update
   */
  async install(options: InstallOptions): Promise<InstallResult> {
    const {
      downloadUrl,
      checksum,
      backupCurrent = true,
      installDir = this.getDefaultInstallDir(),
      restartAfterInstall = false
    } = options;

    const currentBinaryPath = this.getCurrentBinaryPath();
    const currentVersion = this.getCurrentVersion();

    try {
      // Step 1: Create backup
      let backupPath: string | undefined;
      if (backupCurrent && fs.existsSync(currentBinaryPath)) {
        this.emit('status', { step: 'backup', message: 'Creating backup...' });
        backupPath = await this.createBackup(currentBinaryPath);
        this.emit('status', { step: 'backup', message: 'Backup created', backupPath });
      }

      // Step 2: Download update
      this.emit('status', { step: 'download', message: 'Downloading update...' });
      
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-update-'));
      const archivePath = path.join(tempDir, 'update.tar.gz');

      const downloadResult = await this.downloader.download({
        url: downloadUrl,
        destination: archivePath,
        checksum,
        onProgress: (progress) => {
          this.emit('download-progress', progress);
        }
      });

      this.emit('status', { step: 'download', message: 'Download complete', downloadResult });

      // Step 3: Extract archive
      this.emit('status', { step: 'extract', message: 'Extracting update...' });
      const extractedDir = path.join(tempDir, 'extracted');
      fs.mkdirSync(extractedDir, { recursive: true });
      
      await this.extractArchive(archivePath, extractedDir);
      this.emit('status', { step: 'extract', message: 'Extraction complete' });

      // Step 4: Find new binary
      const newBinaryPath = this.findBinary(extractedDir);
      if (!newBinaryPath) {
        throw new Error('New binary not found in archive');
      }

      // Step 5: Verify new binary
      this.emit('status', { step: 'verify', message: 'Verifying new binary...' });
      const newVersion = this.verifyBinary(newBinaryPath);
      this.emit('status', { step: 'verify', message: 'Verification complete', newVersion });

      // Step 6: Install new binary
      this.emit('status', { step: 'install', message: 'Installing update...' });
      await this.replaceBinary(currentBinaryPath, newBinaryPath);
      this.emit('status', { step: 'install', message: 'Installation complete' });

      // Step 7: Cleanup
      this.emit('status', { step: 'cleanup', message: 'Cleaning up...' });
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Step 8: Restart if requested
      if (restartAfterInstall) {
        this.emit('status', { step: 'restart', message: 'Restarting...' });
        this.restartProcess();
      }

      return {
        success: true,
        previousVersion: currentVersion,
        newVersion,
        backupPath
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('status', { step: 'error', message: `Installation failed: ${errorMessage}` });
      
      return {
        success: false,
        previousVersion: currentVersion,
        error: errorMessage
      };
    }
  }

  /**
   * Rollback to a previous version
   */
  async rollback(backupPath?: string): Promise<InstallResult> {
    try {
      // Find backup if not specified
      if (!backupPath) {
        const backups = this.listBackups();
        if (backups.length === 0) {
          throw new Error('No backups available for rollback');
        }
        backupPath = backups[0].path; // Most recent
      }

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
      }

      this.emit('status', { step: 'rollback', message: 'Rolling back...' });

      const currentBinaryPath = this.getCurrentBinaryPath();
      const currentVersion = this.getCurrentVersion();

      // Restore backup
      fs.copyFileSync(backupPath, currentBinaryPath);
      fs.chmodSync(currentBinaryPath, 0o755);

      const rolledBackVersion = this.getCurrentVersion();

      this.emit('status', { step: 'rollback', message: 'Rollback complete' });

      return {
        success: true,
        previousVersion: currentVersion,
        newVersion: rolledBackVersion
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: `Rollback failed: ${errorMessage}`
      };
    }
  }

  /**
   * Create a backup of the current binary
   */
  private async createBackup(binaryPath: string): Promise<string> {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const version = this.getCurrentVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `claude-code-clone-${version}-${timestamp}.backup`;
    const backupPath = path.join(this.backupDir, backupName);

    fs.copyFileSync(binaryPath, backupPath);

    // Save backup metadata
    const metaPath = `${backupPath}.json`;
    fs.writeFileSync(metaPath, JSON.stringify({
      version,
      createdAt: new Date().toISOString(),
      originalPath: binaryPath
    }));

    // Clean up old backups (keep last 5)
    this.cleanupOldBackups();

    return backupPath;
  }

  /**
   * List available backups
   */
  listBackups(): BackupInfo[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const backups: BackupInfo[] = [];
    const files = fs.readdirSync(this.backupDir);

    for (const file of files) {
      if (file.endsWith('.backup')) {
        const metaPath = path.join(this.backupDir, `${file}.json`);
        const backupPath = path.join(this.backupDir, file);

        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          backups.push({
            path: backupPath,
            version: meta.version,
            createdAt: new Date(meta.createdAt)
          });
        } catch {
          // Skip invalid backups
        }
      }
    }

    // Sort by date (newest first)
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Clean up old backups
   */
  private cleanupOldBackups(keepCount: number = 5): void {
    const backups = this.listBackups();
    
    for (let i = keepCount; i < backups.length; i++) {
      try {
        fs.unlinkSync(backups[i].path);
        fs.unlinkSync(`${backups[i].path}.json`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get the current binary path
   */
  private getCurrentBinaryPath(): string {
    return process.argv[0];
  }

  /**
   * Get the default installation directory
   */
  private getDefaultInstallDir(): string {
    const binaryPath = this.getCurrentBinaryPath();
    return path.dirname(binaryPath);
  }

  /**
   * Get the current version
   */
  private getCurrentVersion(): string {
    try {
      const result = execSync('"' + this.getCurrentBinaryPath() + '" --version', {
        encoding: 'utf8',
        timeout: 5000
      });
      return result.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract archive based on type
   */
  private async extractArchive(archivePath: string, destDir: string): Promise<void> {
    const isWindows = process.platform === 'win32';
    const isZip = archivePath.endsWith('.zip');

    if (isWindows && isZip) {
      // Use PowerShell on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`);
    } else {
      // Use tar for tar.gz
      execSync(`tar -xzf "${archivePath}" -C "${destDir}"`);
    }
  }

  /**
   * Find the binary in extracted directory
   */
  private findBinary(dir: string): string | null {
    const binaryName = process.platform === 'win32' ? 'claude-code-clone.exe' : 'claude-code-clone';
    
    const search = (currentDir: string): string | null => {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const result = search(fullPath);
          if (result) return result;
        } else if (file === binaryName) {
          return fullPath;
        }
      }
      
      return null;
    };

    return search(dir);
  }

  /**
   * Verify binary by running --version
   */
  private verifyBinary(binaryPath: string): string {
    try {
      const result = execSync(`"${binaryPath}" --version`, {
        encoding: 'utf8',
        timeout: 5000
      });
      return result.trim();
    } catch (error) {
      throw new Error(`Binary verification failed: ${error}`);
    }
  }

  /**
   * Replace the current binary with the new one
   */
  private async replaceBinary(currentPath: string, newPath: string): Promise<void> {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // On Windows, we need to handle the running binary
      // Rename current binary first
      const backupName = `${currentPath}.old`;
      
      if (fs.existsSync(backupName)) {
        fs.unlinkSync(backupName);
      }
      
      fs.renameSync(currentPath, backupName);
      fs.copyFileSync(newPath, currentPath);
      
      // Schedule old binary deletion on next restart
      this.scheduleDeletion(backupName);
    } else {
      // On Unix, we can replace directly
      fs.copyFileSync(newPath, currentPath);
      fs.chmodSync(currentPath, 0o755);
    }
  }

  /**
   * Schedule file deletion (Windows-specific)
   */
  private scheduleDeletion(filePath: string): void {
    if (process.platform === 'win32') {
      // Use Windows scheduled task or PowerShell
      try {
        execSync(`powershell -Command "Start-Sleep -Seconds 5; Remove-Item -Path '${filePath}' -Force"`, {
          detached: true,
          windowsHide: true
        });
      } catch {
        // Ignore scheduling errors
      }
    }
  }

  /**
   * Restart the process after update
   */
  private restartProcess(): void {
    const binaryPath = this.getCurrentBinaryPath();
    const args = process.argv.slice(1);

    // Spawn new process
    const child = spawn(binaryPath, args, {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    // Exit current process
    process.exit(0);
  }
}

// Export singleton instance
export const updateInstaller = new UpdateInstaller();
