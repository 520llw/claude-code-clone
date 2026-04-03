/**
 * Analytics Module
 * 
 * Tracks usage metrics, performance data, and user engagement.
 * Provides insights into feature usage and performance bottlenecks.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { TelemetryClient, TelemetryEvent } from './TelemetryClient';

export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  sampleRate: number;
  anonymizeIp: boolean;
  sessionTimeout: number; // milliseconds
}

export interface Session {
  id: string;
  startTime: number;
  lastActivity: number;
  commandCount: number;
  duration: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  tags?: Record<string, string>;
}

export interface FeatureUsage {
  feature: string;
  count: number;
  firstUsed: number;
  lastUsed: number;
}

export class Analytics extends EventEmitter {
  private config: AnalyticsConfig;
  private telemetry: TelemetryClient;
  private session: Session;
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];
  private sessionTimer: NodeJS.Timeout | null = null;

  constructor(telemetry: TelemetryClient, config: Partial<AnalyticsConfig> = {}) {
    super();

    this.telemetry = telemetry;
    this.config = {
      enabled: telemetry.isEnabled(),
      sampleRate: 1.0,
      anonymizeIp: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...config
    };

    this.session = this.createSession();
    this.startSessionTimer();

    // Track session start
    this.trackEvent('session_start', {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    });
  }

  /**
   * Create a new session
   */
  private createSession(): Session {
    return {
      id: this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      commandCount: 0,
      duration: 0
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start session timer
   */
  private startSessionTimer(): void {
    this.sessionTimer = setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Check every minute
  }

  /**
   * Check if session has timed out
   */
  private checkSessionTimeout(): void {
    const now = Date.now();
    const inactiveTime = now - this.session.lastActivity;

    if (inactiveTime > this.config.sessionTimeout) {
      this.endSession();
      this.session = this.createSession();
      this.trackEvent('session_start', { reason: 'timeout' });
    }
  }

  /**
   * End current session
   */
  private endSession(): void {
    const now = Date.now();
    this.session.duration = now - this.session.startTime;
    this.session.lastActivity = now;

    this.trackEvent('session_end', {
      duration: this.session.duration,
      commandCount: this.session.commandCount
    });

    this.emit('session-end', this.session);
  }

  /**
   * Track a generic event
   */
  trackEvent(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    this.session.lastActivity = Date.now();

    this.telemetry.track(eventName, {
      ...properties,
      sessionId: this.session.id,
      sessionDuration: Date.now() - this.session.startTime
    });

    this.emit('event', { eventName, properties });
  }

  /**
   * Track command usage
   */
  trackCommand(command: string, args: string[] = [], duration?: number): void {
    this.session.commandCount++;

    this.trackEvent('command_executed', {
      command,
      argCount: args.length,
      duration,
      hasFlags: args.some(a => a.startsWith('-'))
    });

    this.emit('command', { command, args, duration });
  }

  /**
   * Track feature usage
   */
  trackFeature(feature: string, properties: Record<string, any> = {}): void {
    const now = Date.now();
    const existing = this.featureUsage.get(feature);

    if (existing) {
      existing.count++;
      existing.lastUsed = now;
    } else {
      this.featureUsage.set(feature, {
        feature,
        count: 1,
        firstUsed: now,
        lastUsed: now
      });
    }

    this.trackEvent('feature_used', {
      feature,
      ...properties
    });

    this.emit('feature', { feature, properties });
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);

    this.trackEvent('performance_metric', {
      metricName: metric.name,
      value: metric.value,
      unit: metric.unit,
      tags: metric.tags
    });

    this.emit('performance', metric);
  }

  /**
   * Start performance timer
   */
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const startTime = process.hrtime.bigint();

    return () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      this.trackPerformance({
        name,
        value: duration,
        unit: 'ms',
        tags
      });

      return duration;
    };
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.trackEvent('error', {
      errorType: error.name,
      errorMessage: error.message,
      ...context
    });

    this.emit('error', { error, context });
  }

  /**
   * Track API call
   */
  trackApiCall(
    provider: string,
    operation: string,
    duration: number,
    success: boolean,
    properties: Record<string, any> = {}
  ): void {
    this.trackEvent('api_call', {
      provider,
      operation,
      duration,
      success,
      ...properties
    });

    this.emit('api-call', { provider, operation, duration, success });
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    id: string;
    duration: number;
    commandCount: number;
    featuresUsed: number;
  } {
    return {
      id: this.session.id,
      duration: Date.now() - this.session.startTime,
      commandCount: this.session.commandCount,
      featuresUsed: this.featureUsage.size
    };
  }

  /**
   * Get feature usage statistics
   */
  getFeatureStats(): FeatureUsage[] {
    return Array.from(this.featureUsage.values());
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const stats: Record<string, { values: number[] }> = {};

    for (const metric of this.performanceMetrics) {
      if (!stats[metric.name]) {
        stats[metric.name] = { values: [] };
      }
      stats[metric.name].values.push(metric.value);
    }

    const result: Record<string, { count: number; avg: number; min: number; max: number }> = {};

    for (const [name, data] of Object.entries(stats)) {
      const values = data.values;
      result[name] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }

    return result;
  }

  /**
   * Export analytics data
   */
  exportData(): {
    session: Session;
    features: FeatureUsage[];
    performance: PerformanceMetric[];
    exportedAt: number;
  } {
    return {
      session: { ...this.session },
      features: this.getFeatureStats(),
      performance: [...this.performanceMetrics],
      exportedAt: Date.now()
    };
  }

  /**
   * Save analytics data to file
   */
  saveToFile(filePath?: string): void {
    const targetPath = filePath || path.join(
      os.homedir(),
      '.config',
      'claude-code-clone',
      'analytics.json'
    );

    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(targetPath, JSON.stringify(this.exportData(), null, 2));
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Enable analytics
   */
  enable(): void {
    this.config.enabled = true;
    this.emit('enabled');
  }

  /**
   * Disable analytics
   */
  disable(): void {
    this.config.enabled = false;
    this.emit('disabled');
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Dispose analytics
   */
  dispose(): void {
    this.endSession();

    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.saveToFile();
    this.removeAllListeners();
  }
}

// Export singleton instance (requires TelemetryClient)
export const createAnalytics = (telemetry: TelemetryClient) => new Analytics(telemetry);
