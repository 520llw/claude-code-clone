/**
 * Update Downloader Module
 * 
 * Handles downloading update packages with progress tracking,
 * checksum verification, and resume capability.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
  speed: number; // bytes per second
  eta: number; // seconds
}

export interface DownloadOptions {
  url: string;
  destination: string;
  checksum?: string;
  checksumAlgorithm?: 'sha256' | 'sha512' | 'md5';
  resume?: boolean;
  timeout?: number;
  retries?: number;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadResult {
  filePath: string;
  size: number;
  checksum: string;
  duration: number;
}

export class UpdateDownloader extends EventEmitter {
  private abortController: AbortController | null = null;

  /**
   * Download a file with progress tracking
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    const {
      url,
      destination,
      checksum,
      checksumAlgorithm = 'sha256',
      resume = true,
      timeout = 300000, // 5 minutes
      retries = 3,
      onProgress
    } = options;

    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Check for partial download
    let startByte = 0;
    const partialPath = `${destination}.partial`;
    
    if (resume && fs.existsSync(partialPath)) {
      const stats = fs.statSync(partialPath);
      startByte = stats.size;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.performDownload({
          url,
          destination,
          partialPath,
          startByte,
          checksum,
          checksumAlgorithm,
          timeout,
          onProgress
        });
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.emit('retry', { attempt: attempt + 1, delay, error: lastError });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Download failed after all retries');
  }

  /**
   * Perform the actual download
   */
  private async performDownload(params: {
    url: string;
    destination: string;
    partialPath: string;
    startByte: number;
    checksum?: string;
    checksumAlgorithm: string;
    timeout: number;
    onProgress?: (progress: DownloadProgress) => void;
  }): Promise<DownloadResult> {
    const { url, destination, partialPath, startByte, checksum, checksumAlgorithm, timeout, onProgress } = params;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const hash = crypto.createHash(checksumAlgorithm);
      let downloadedBytes = startByte;
      let totalBytes = 0;
      let lastProgressTime = Date.now();
      let lastProgressBytes = startByte;

      // Create write stream (append if resuming)
      const fileStream = fs.createWriteStream(partialPath, {
        flags: startByte > 0 ? 'a' : 'w'
      });

      const requestOptions: https.RequestOptions = {
        method: 'GET',
        headers: {
          'User-Agent': 'claude-code-clone-updater',
          ...(startByte > 0 && { 'Range': `bytes=${startByte}-` })
        },
        timeout
      };

      const req = https.get(url, requestOptions, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            fileStream.close();
            this.performDownload({ ...params, url: redirectUrl })
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          fileStream.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        // Get total size
        const contentLength = res.headers['content-length'];
        if (contentLength) {
          totalBytes = parseInt(contentLength, 10) + startByte;
        }

        // Handle data
        res.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          hash.update(chunk);

          // Calculate progress
          const now = Date.now();
          const timeDelta = now - lastProgressTime;
          
          if (timeDelta >= 500) { // Update every 500ms
            const bytesDelta = downloadedBytes - lastProgressBytes;
            const speed = bytesDelta / (timeDelta / 1000);
            const remainingBytes = totalBytes - downloadedBytes;
            const eta = speed > 0 ? remainingBytes / speed : 0;

            const progress: DownloadProgress = {
              totalBytes,
              downloadedBytes,
              percent: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
              speed,
              eta
            };

            this.emit('progress', progress);
            onProgress?.(progress);

            lastProgressTime = now;
            lastProgressBytes = downloadedBytes;
          }
        });

        // Pipe to file
        res.pipe(fileStream);

        // Handle completion
        fileStream.on('finish', () => {
          fileStream.close();

          // Verify checksum if provided
          const calculatedChecksum = hash.digest('hex');
          
          if (checksum && calculatedChecksum !== checksum) {
            fs.unlinkSync(partialPath);
            reject(new Error('Checksum verification failed'));
            return;
          }

          // Move to final destination
          fs.renameSync(partialPath, destination);

          const duration = Date.now() - startTime;
          
          resolve({
            filePath: destination,
            size: downloadedBytes,
            checksum: calculatedChecksum,
            duration
          });
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        fileStream.close();
        reject(new Error('Request timeout'));
      });

      // Handle abort
      this.abortController = new AbortController();
      this.abortController.signal.addEventListener('abort', () => {
        req.destroy();
        fileStream.close();
        reject(new Error('Download aborted'));
      });
    });
  }

  /**
   * Abort the current download
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Verify file checksum
   */
  async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
    algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        const calculatedChecksum = hash.digest('hex');
        resolve(calculatedChecksum === expectedChecksum.toLowerCase());
      });

      stream.on('error', reject);
    });
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  }

  /**
   * Format duration to human-readable string
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const updateDownloader = new UpdateDownloader();
