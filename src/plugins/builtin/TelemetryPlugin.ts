/**
 * TelemetryPlugin.ts
 * 
 * Telemetry Collection Plugin for Claude Code Clone
 * 
 * This plugin provides telemetry collection capabilities including:
 * - Usage metrics tracking
 * - Performance monitoring
 * - Error reporting
 * - Feature adoption analytics
 * - Privacy-compliant data collection
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, ConfigSchemaEntry } from '../Plugin';
import { v4 as uuidv4 } from 'uuid';

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  id: string;
  type: string;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  data: Record<string, any>;
}

/**
 * Usage metrics
 */
export interface UsageMetrics {
  sessionId: string;
  startTime: Date;
  messageCount: number;
  toolCallCount: number;
  commandCount: number;
  totalTokens: number;
  sessionDuration: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * TelemetryPlugin - Collects usage and performance telemetry.
 * 
 * This plugin collects anonymized telemetry data to help improve
 * the application while respecting user privacy.
 * 
 * @example
 * ```typescript
 * const telemetryPlugin = new TelemetryPlugin();
 * await pluginManager.loadPlugin(telemetryPlugin);
 * 
 * // Track an event
 * telemetryPlugin.trackEvent('feature_used', { feature: 'git_commit' });
 * ```
 */
export class TelemetryPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.telemetry',
    name: 'Telemetry Collection',
    version: '1.0.0',
    description: 'Collects usage metrics and performance data to help improve the application',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.ANALYTICS,
    keywords: ['telemetry', 'analytics', 'metrics', 'monitoring'],
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'enabled',
      type: 'boolean',
      label: 'Enable telemetry',
      description: 'Allow collection of anonymized usage data',
      default: true,
      required: false
    },
    {
      key: 'collectErrors',
      type: 'boolean',
      label: 'Collect error reports',
      description: 'Send error reports to help improve stability',
      default: true,
      required: false
    },
    {
      key: 'collectPerformance',
      type: 'boolean',
      label: 'Collect performance metrics',
      description: 'Collect performance data to optimize the application',
      default: true,
      required: false
    },
    {
      key: 'anonymizeData',
      type: 'boolean',
      label: 'Anonymize data',
      description: 'Remove personally identifiable information from telemetry',
      default: true,
      required: false
    },
    {
      key: 'batchSize',
      type: 'number',
      label: 'Batch size',
      description: 'Number of events to batch before sending',
      default: 10,
      min: 1,
      max: 100,
      required: false
    },
    {
      key: 'flushInterval',
      type: 'number',
      label: 'Flush interval (ms)',
      description: 'Interval to flush telemetry data',
      default: 60000,
      min: 1000,
      max: 300000,
      required: false
    },
    {
      key: 'endpoint',
      type: 'string',
      label: 'Telemetry endpoint',
      description: 'URL to send telemetry data (leave empty for default)',
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onInit', 'onMessage', 'onToolCall', 'onToolResult', 'onError', 'onSessionStart', 'onSessionEnd'],
    requiresNetwork: true
  };

  /**
   * Session ID
   */
  private sessionId: string = '';

  /**
   * Event queue
   */
  private eventQueue: TelemetryEvent[] = [];

  /**
   * Performance metrics queue
   */
  private performanceQueue: PerformanceMetrics[] = [];

  /**
   * Usage metrics for current session
   */
  private usageMetrics: UsageMetrics;

  /**
   * Flush interval handle
   */
  private flushIntervalHandle?: NodeJS.Timeout;

  /**
   * Constructor
   */
  constructor() {
    super();
    this.sessionId = uuidv4();
    this.usageMetrics = {
      sessionId: this.sessionId,
      startTime: new Date(),
      messageCount: 0,
      toolCallCount: 0,
      commandCount: 0,
      totalTokens: 0,
      sessionDuration: 0
    };
  }

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('TelemetryPlugin activated');

    if (!this.context.config.enabled) {
      this.logger.info('Telemetry is disabled');
      return;
    }

    // Register hooks
    this.registerHook('onInit', this.handleInit.bind(this));
    this.registerHook('onMessage', this.handleMessage.bind(this));
    this.registerHook('onToolCall', this.handleToolCall.bind(this));
    this.registerHook('onToolResult', this.handleToolResult.bind(this));
    this.registerHook('onError', this.handleError.bind(this));
    this.registerHook('onSessionStart', this.handleSessionStart.bind(this));
    this.registerHook('onSessionEnd', this.handleSessionEnd.bind(this));

    // Start flush interval
    const flushInterval = this.context.config.flushInterval || 60000;
    this.flushIntervalHandle = setInterval(() => {
      this.flush();
    }, flushInterval);

    // Track initialization
    this.trackEvent('plugin_initialized', {
      pluginId: this.metadata.id,
      version: this.metadata.version
    });
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('TelemetryPlugin deactivated');

    // Stop flush interval
    if (this.flushIntervalHandle) {
      clearInterval(this.flushIntervalHandle);
    }

    // Final flush
    await this.flush();
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private async handleInit(context: any): Promise<void> {
    this.trackEvent('app_initialized', {
      appVersion: context.data.appVersion
    });
  }

  private async handleMessage(context: any): Promise<void> {
    this.usageMetrics.messageCount++;
    
    this.trackEvent('message_received', {
      role: context.data.role,
      contentLength: context.data.content?.length || 0
    });
  }

  private async handleToolCall(context: any): Promise<void> {
    this.usageMetrics.toolCallCount++;
    
    this.trackEvent('tool_called', {
      toolName: context.data.toolName
    });
  }

  private async handleToolResult(context: any): Promise<void> {
    this.trackEvent('tool_completed', {
      toolName: context.data.toolName,
      success: context.data.success,
      duration: context.data.duration
    });
  }

  private async handleError(context: any): Promise<void> {
    if (!this.context.config.collectErrors) {
      return;
    }

    const errorData: any = {
      type: context.data.type,
      component: context.data.component
    };

    // Include stack trace if not anonymizing
    if (!this.context.config.anonymizeData && context.data.stack) {
      errorData.stackHash = this.hashString(context.data.stack);
    }

    this.trackEvent('error_occurred', errorData);
  }

  private async handleSessionStart(context: any): Promise<void> {
    this.sessionId = context.data.sessionId;
    this.usageMetrics.sessionId = this.sessionId;
    this.usageMetrics.startTime = new Date();

    this.trackEvent('session_started', {
      cwd: this.context.config.anonymizeData ? undefined : context.data.cwd
    });
  }

  private async handleSessionEnd(context: any): Promise<void> {
    this.usageMetrics.sessionDuration = context.data.duration;

    this.trackEvent('session_ended', {
      duration: context.data.duration,
      messageCount: context.data.messageCount,
      toolCallCount: context.data.toolCallCount
    });

    // Send usage metrics
    if (this.context.config.enabled) {
      await this.sendUsageMetrics();
    }
  }

  // ============================================================================
  // Telemetry Methods
  // ============================================================================

  /**
   * Tracks an event.
   * 
   * @param type - Event type
   * @param data - Event data
   */
  public trackEvent(type: string, data: Record<string, any> = {}): void {
    if (!this.context.config.enabled) {
      return;
    }

    const event: TelemetryEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      sessionId: this.sessionId,
      data: this.context.config.anonymizeData ? this.anonymizeData(data) : data
    };

    this.eventQueue.push(event);

    // Flush if batch size reached
    const batchSize = this.context.config.batchSize || 10;
    if (this.eventQueue.length >= batchSize) {
      this.flush();
    }
  }

  /**
   * Tracks performance metrics.
   * 
   * @param operation - Operation name
   * @param duration - Operation duration in ms
   * @param success - Whether operation succeeded
   * @param metadata - Additional metadata
   */
  public trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    if (!this.context.config.enabled || !this.context.config.collectPerformance) {
      return;
    }

    this.performanceQueue.push({
      operation,
      duration,
      success,
      timestamp: new Date(),
      metadata
    });

    // Flush if batch size reached
    const batchSize = this.context.config.batchSize || 10;
    if (this.performanceQueue.length >= batchSize) {
      this.flush();
    }
  }

  /**
   * Flushes telemetry data to the server.
   */
  public async flush(): Promise<void> {
    if (!this.context.config.enabled) {
      return;
    }

    // Flush events
    if (this.eventQueue.length > 0) {
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      try {
        await this.sendEvents(events);
      } catch (error) {
        this.logger.error('Failed to send telemetry events:', error);
        // Re-queue events
        this.eventQueue.unshift(...events);
      }
    }

    // Flush performance metrics
    if (this.performanceQueue.length > 0) {
      const metrics = [...this.performanceQueue];
      this.performanceQueue = [];
      
      try {
        await this.sendPerformanceMetrics(metrics);
      } catch (error) {
        this.logger.error('Failed to send performance metrics:', error);
        // Re-queue metrics
        this.performanceQueue.unshift(...metrics);
      }
    }
  }

  /**
   * Sends events to the telemetry endpoint.
   * 
   * @param events - Events to send
   */
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    const endpoint = this.context.config.endpoint || 'https://telemetry.claudecode.dev/events';
    
    // In a real implementation, this would make an HTTP request
    this.logger.debug(`Sending ${events.length} telemetry events to ${endpoint}`);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sends performance metrics to the telemetry endpoint.
   * 
   * @param metrics - Metrics to send
   */
  private async sendPerformanceMetrics(metrics: PerformanceMetrics[]): Promise<void> {
    const endpoint = this.context.config.endpoint || 'https://telemetry.claudecode.dev/performance';
    
    this.logger.debug(`Sending ${metrics.length} performance metrics to ${endpoint}`);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sends usage metrics.
   */
  private async sendUsageMetrics(): Promise<void> {
    const endpoint = this.context.config.endpoint || 'https://telemetry.claudecode.dev/usage';
    
    this.logger.debug(`Sending usage metrics to ${endpoint}`);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Anonymizes data by removing PII.
   * 
   * @param data - Data to anonymize
   * @returns Anonymized data
   */
  private anonymizeData(data: Record<string, any>): Record<string, any> {
    const anonymized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive keys
      if (this.isSensitiveKey(key)) {
        continue;
      }
      
      // Anonymize strings that might contain PII
      if (typeof value === 'string') {
        anonymized[key] = this.anonymizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        anonymized[key] = this.anonymizeData(value);
      } else {
        anonymized[key] = value;
      }
    }
    
    return anonymized;
  }

  /**
   * Checks if a key is sensitive.
   * 
   * @param key - Key to check
   * @returns True if sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth',
      'email', 'phone', 'address', 'name', 'username'
    ];
    
    return sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
  }

  /**
   * Anonymizes a string.
   * 
   * @param str - String to anonymize
   * @returns Anonymized string
   */
  private anonymizeString(str: string): string {
    // Hash the string if it looks like it might contain PII
    if (str.includes('@') || /\d{3}/.test(str)) {
      return this.hashString(str);
    }
    
    return str;
  }

  /**
   * Creates a hash of a string.
   * 
   * @param str - String to hash
   * @returns Hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Gets the current usage metrics.
   * 
   * @returns Usage metrics
   */
  public getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  /**
   * Gets the event queue size.
   * 
   * @returns Queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.length + this.performanceQueue.length;
  }
}

export default TelemetryPlugin;
