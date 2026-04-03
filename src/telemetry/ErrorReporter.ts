/**
 * Error Reporter Module
 * 
 * Captures, filters, and reports errors with context information.
 * Supports both automatic and manual error reporting.
 */

import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface ErrorReporterConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  environment: 'development' | 'production' | 'test';
  release: string;
  maxBreadcrumbs: number;
  sampleRate: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
}

export interface ErrorEvent {
  eventId: string;
  timestamp: number;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: StackFrame[];
  };
  breadcrumbs: Breadcrumb[];
  context: ErrorContext;
  tags: Record<string, string>;
  extra: Record<string, any>;
}

export interface StackFrame {
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}

export interface Breadcrumb {
  timestamp: number;
  type: string;
  message: string;
  category?: string;
  data?: Record<string, any>;
}

export interface ErrorContext {
  os: {
    name: string;
    version: string;
    build?: string;
  };
  runtime: {
    name: string;
    version: string;
  };
  app: {
    name: string;
    version: string;
    cwd: string;
  };
  user?: {
    id?: string;
    ip_address?: string;
  };
}

export class ErrorReporter extends EventEmitter {
  private config: ErrorReporterConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private scope: { tags: Record<string, string>; extra: Record<string, any> } = {
    tags: {},
    extra: {}
  };

  constructor(config: Partial<ErrorReporterConfig> = {}) {
    super();

    this.config = {
      enabled: this.loadEnabledState(),
      endpoint: 'https://errors.claude-code.dev/api/error',
      environment: (process.env.NODE_ENV as any) || 'production',
      release: process.env.PACKAGE_VERSION || 'unknown',
      maxBreadcrumbs: 100,
      sampleRate: 1.0,
      ...config
    };

    // Set up global error handlers
    if (this.config.enabled) {
      this.installGlobalHandlers();
    }
  }

  /**
   * Load enabled state from config
   */
  private loadEnabledState(): boolean {
    try {
      const configPath = path.join(os.homedir(), '.config', 'claude-code-clone', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.errorReporting !== false; // Default to true
      }
    } catch {
      // Default to enabled
    }
    return true;
  }

  /**
   * Install global error handlers
   */
  private installGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.captureException(error, { level: 'fatal' });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.captureException(error, { level: 'error' });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.addBreadcrumb({
        type: 'warning',
        message: warning.message,
        category: 'warning',
        data: { name: warning.name, stack: warning.stack }
      });
    });
  }

  /**
   * Check if error reporting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable error reporting
   */
  enable(): void {
    this.config.enabled = true;
    this.saveEnabledState(true);
    this.installGlobalHandlers();
    this.emit('enabled');
  }

  /**
   * Disable error reporting
   */
  disable(): void {
    this.config.enabled = false;
    this.saveEnabledState(false);
    this.emit('disabled');
  }

  /**
   * Save enabled state
   */
  private saveEnabledState(enabled: boolean): void {
    try {
      const configPath = path.join(os.homedir(), '.config', 'claude-code-clone', 'config.json');
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      config.errorReporting = enabled;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Set a tag
   */
  setTag(key: string, value: string): void {
    this.scope.tags[key] = value;
  }

  /**
   * Set extra context
   */
  setExtra(key: string, value: any): void {
    this.scope.extra[key] = value;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      ...breadcrumb
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, options: { level?: ErrorEvent['level']; extra?: Record<string, any> } = {}): string | null {
    if (!this.config.enabled) return null;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return null;

    const eventId = this.generateEventId();

    const errorEvent: ErrorEvent = {
      eventId,
      timestamp: Date.now(),
      level: options.level || 'error',
      message: error.message,
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: this.parseStackTrace(error.stack)
      },
      breadcrumbs: [...this.breadcrumbs],
      context: this.buildContext(),
      tags: { ...this.scope.tags },
      extra: { ...this.scope.extra, ...options.extra }
    };

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const modifiedEvent = this.config.beforeSend(errorEvent);
      if (!modifiedEvent) return null; // Event was dropped
    }

    // Send the event
    this.sendEvent(modifiedEvent || errorEvent);

    this.emit('capture', errorEvent);

    return eventId;
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: ErrorEvent['level'] = 'info'): string | null {
    if (!this.config.enabled) return null;

    const eventId = this.generateEventId();

    const errorEvent: ErrorEvent = {
      eventId,
      timestamp: Date.now(),
      level,
      message,
      breadcrumbs: [...this.breadcrumbs],
      context: this.buildContext(),
      tags: { ...this.scope.tags },
      extra: { ...this.scope.extra }
    };

    this.sendEvent(errorEvent);

    return eventId;
  }

  /**
   * Parse stack trace into frames
   */
  private parseStackTrace(stack?: string): StackFrame[] {
    if (!stack) return [];

    const lines = stack.split('\n');
    const frames: StackFrame[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?/);
      if (match) {
        frames.push({
          function: match[1] || '<anonymous>',
          filename: match[2] || '<unknown>',
          lineno: parseInt(match[3], 10) || 0,
          colno: parseInt(match[4], 10) || 0,
          in_app: !match[2]?.includes('node_modules')
        });
      }
    }

    return frames;
  }

  /**
   * Build error context
   */
  private buildContext(): ErrorContext {
    return {
      os: {
        name: process.platform,
        version: os.release()
      },
      runtime: {
        name: 'node',
        version: process.version
      },
      app: {
        name: 'claude-code-clone',
        version: this.config.release,
        cwd: process.cwd()
      }
    };
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send event to error endpoint
   */
  private async sendEvent(event: ErrorEvent): Promise<void> {
    try {
      const data = JSON.stringify(event);

      const options: https.RequestOptions = {
        hostname: new URL(this.config.endpoint).hostname,
        path: new URL(this.config.endpoint).pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-API-Key': this.config.apiKey || '',
          'User-Agent': `claude-code-clone/${this.config.release}`
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          this.emit('sent', { eventId: event.eventId });
        } else {
          this.emit('send-error', { eventId: event.eventId, statusCode: res.statusCode });
        }
      });

      req.on('error', (err) => {
        this.emit('send-error', { eventId: event.eventId, error: err });
      });

      req.write(data);
      req.end();
    } catch {
      // Silently fail - don't crash the app due to error reporting
    }
  }

  /**
   * Create a scope for contextual data
   */
  withScope(callback: (scope: ErrorReporter) => void): void {
    const previousScope = { ...this.scope };
    callback(this);
    this.scope = previousScope;
  }
}

// Export singleton instance
export const errorReporter = new ErrorReporter();
