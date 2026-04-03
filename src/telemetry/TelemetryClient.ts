/**
 * Telemetry Client Module
 * 
 * Handles telemetry data collection, batching, and transmission.
 * Respects user privacy settings and supports opt-out.
 */

import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  batchSize: number;
  flushInterval: number;
  maxQueueSize: number;
  sampleRate: number;
  anonymousId: string;
}

export interface TelemetryEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  anonymousId: string;
  properties: Record<string, any>;
  context: TelemetryContext;
}

export interface TelemetryContext {
  version: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  cwd: string;
}

export class TelemetryClient extends EventEmitter {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private context: TelemetryContext;

  constructor(config: Partial<TelemetryConfig> = {}) {
    super();
    
    this.config = {
      enabled: this.loadEnabledState(),
      endpoint: 'https://telemetry.claude-code.dev/events',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxQueueSize: 100,
      sampleRate: 1.0,
      anonymousId: this.loadOrCreateAnonymousId(),
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.context = this.buildContext();

    // Start flush timer if enabled
    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Load enabled state from config file
   */
  private loadEnabledState(): boolean {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.telemetry !== false; // Default to true
      }
    } catch {
      // Default to enabled
    }
    return true;
  }

  /**
   * Load or create anonymous ID
   */
  private loadOrCreateAnonymousId(): string {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.anonymousId) {
          return config.anonymousId;
        }
      }
    } catch {
      // Continue to create new ID
    }

    // Create new anonymous ID
    const anonymousId = this.generateAnonymousId();
    this.saveAnonymousId(anonymousId);
    return anonymousId;
  }

  /**
   * Save anonymous ID to config
   */
  private saveAnonymousId(anonymousId: string): void {
    try {
      const configPath = this.getConfigPath();
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      config.anonymousId = anonymousId;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Get config file path
   */
  private getConfigPath(): string {
    return path.join(os.homedir(), '.config', 'claude-code-clone', 'config.json');
  }

  /**
   * Generate anonymous ID
   */
  private generateAnonymousId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build telemetry context
   */
  private buildContext(): TelemetryContext {
    return {
      version: process.env.PACKAGE_VERSION || 'unknown',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd()
    };
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.config.enabled = true;
    this.saveEnabledState(true);
    this.startFlushTimer();
    this.emit('enabled');
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.config.enabled = false;
    this.saveEnabledState(false);
    this.stopFlushTimer();
    this.flush(); // Flush remaining events
    this.emit('disabled');
  }

  /**
   * Save enabled state
   */
  private saveEnabledState(enabled: boolean): void {
    try {
      const configPath = this.getConfigPath();
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      config.telemetry = enabled;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Track an event
   */
  track(eventType: string, properties: Record<string, any> = {}): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    const event: TelemetryEvent = {
      eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      anonymousId: this.config.anonymousId,
      properties: this.sanitizeProperties(properties),
      context: this.context
    };

    this.eventQueue.push(event);

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.flush();
    }

    this.emit('event', event);
  }

  /**
   * Sanitize properties to remove sensitive data
   */
  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'apiKey', 'api_key', 'token', 'password', 'secret', 'auth',
      'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip sensitive keys
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeProperties(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush events to the server
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.config.batchSize);

    try {
      await this.sendEvents(events);
      this.emit('flushed', { count: events.length });
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      this.emit('flush-error', error);
    }
  }

  /**
   * Send events to the telemetry endpoint
   */
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ events });

      const options: https.RequestOptions = {
        hostname: new URL(this.config.endpoint).hostname,
        path: new URL(this.config.endpoint).pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-API-Key': this.config.apiKey || '',
          'User-Agent': `claude-code-clone/${this.context.version}`
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Dispose the client
   */
  async dispose(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const telemetryClient = new TelemetryClient();
