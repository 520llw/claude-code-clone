/**
 * Logger Utility Module
 * 
 * Provides comprehensive logging functionality with multiple log levels,
 * structured logging, log rotation, and various output formats.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { format } from 'util';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
export type LogFormat = 'simple' | 'json' | 'pretty' | 'structured';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  source?: string;
  correlationId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number; // bytes
  maxFiles?: number;
  includeTimestamp: boolean;
  includeLevel: boolean;
  includeSource: boolean;
  colorize: boolean;
  prettyPrint: boolean;
  redactKeys?: string[];
}

export interface LogRotationConfig {
  maxSize: number;
  maxFiles: number;
  compress: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
  silent: 5,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m', // Magenta
  silent: '\x1b[0m', // Reset
};

const RESET_COLOR = '\x1b[0m';

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  format: 'pretty',
  enableConsole: true,
  enableFile: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  includeTimestamp: true,
  includeLevel: true,
  includeSource: true,
  colorize: true,
  prettyPrint: true,
  redactKeys: ['password', 'token', 'secret', 'key', 'authorization', 'cookie'],
};

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private config: LoggerConfig;
  private currentFileSize: number = 0;
  private logBuffer: string[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableFile && this.config.filePath) {
      this.ensureLogDirectory();
      this.initializeFileSize();
      this.startFlushInterval();
    }
  }

  // -------------------------------------------------------------------------
  // Public Logging Methods
  // -------------------------------------------------------------------------

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', message, context, error);
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? this.sanitizeContext(context) : undefined,
      error,
      source: this.getSource(),
    };

    const formattedLog = this.formatLog(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry, formattedLog);
    }

    if (this.config.enableFile && this.config.filePath) {
      this.writeToFile(formattedLog);
    }
  }

  // -------------------------------------------------------------------------
  // Child Logger
  // -------------------------------------------------------------------------

  child(context: Record<string, unknown>): Logger {
    const childConfig: LoggerConfig = {
      ...this.config,
    };
    const child = new Logger(childConfig);
    return child;
  }

  // -------------------------------------------------------------------------
  // Configuration Methods
  // -------------------------------------------------------------------------

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  setFormat(format: LogFormat): void {
    this.config.format = format;
  }

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  group(label: string): void {
    if (this.config.enableConsole) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.config.enableConsole) {
      console.groupEnd();
    }
  }

  table(data: unknown[]): void {
    if (this.config.enableConsole) {
      console.table(data);
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  flush(): void {
    if (this.logBuffer.length > 0 && this.config.filePath) {
      const content = this.logBuffer.join('\n') + '\n';
      appendFileSync(this.config.filePath, content, 'utf8');
      this.logBuffer = [];
    }
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatLog(entry: LogEntry): string {
    switch (this.config.format) {
      case 'json':
        return this.formatJson(entry);
      case 'structured':
        return this.formatStructured(entry);
      case 'simple':
        return this.formatSimple(entry);
      case 'pretty':
      default:
        return this.formatPretty(entry);
    }
  }

  private formatJson(entry: LogEntry): string {
    const logObj: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
    };

    if (entry.context && Object.keys(entry.context).length > 0) {
      logObj.context = entry.context;
    }

    if (entry.error) {
      logObj.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    if (entry.source && this.config.includeSource) {
      logObj.source = entry.source;
    }

    return JSON.stringify(logObj);
  }

  private formatStructured(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    if (this.config.includeLevel) {
      parts.push(`[${entry.level.toUpperCase()}]`);
    }

    if (entry.source && this.config.includeSource) {
      parts.push(`[${entry.source}]`);
    }

    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      parts.push(`{${contextStr}}`);
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`);
    }

    return parts.join(' ');
  }

  private formatSimple(entry: LogEntry): string {
    return entry.message;
  }

  private formatPretty(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      parts.push(`[${timestamp}]`);
    }

    if (this.config.includeLevel) {
      const levelStr = entry.level.toUpperCase().padEnd(5);
      parts.push(`[${levelStr}]`);
    }

    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = this.config.prettyPrint
        ? '\n' + JSON.stringify(entry.context, null, 2)
        : JSON.stringify(entry.context);
      parts.push(contextStr);
    }

    if (entry.error) {
      parts.push(`\n${entry.error.stack || entry.error.message}`);
    }

    return parts.join(' ');
  }

  private writeToConsole(entry: LogEntry, formattedLog: string): void {
    const output = this.config.colorize
      ? `${LEVEL_COLORS[entry.level]}${formattedLog}${RESET_COLOR}`
      : formattedLog;

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  private writeToFile(formattedLog: string): void {
    this.logBuffer.push(formattedLog);

    if (this.logBuffer.length >= 100) {
      this.flush();
    }

    this.checkRotation();
  }

  private checkRotation(): void {
    if (!this.config.filePath || !this.config.maxFileSize) {
      return;
    }

    this.currentFileSize += Buffer.byteLength(formattedLog, 'utf8');

    if (this.currentFileSize >= this.config.maxFileSize) {
      this.rotateLog();
    }
  }

  private rotateLog(): void {
    if (!this.config.filePath || !this.config.maxFiles) {
      return;
    }

    this.flush();

    const basePath = this.config.filePath;

    // Remove oldest log file
    const oldestLog = `${basePath}.${this.config.maxFiles}`;
    if (existsSync(oldestLog)) {
      // Delete oldest
      const fs = require('fs');
      fs.unlinkSync(oldestLog);
    }

    // Shift existing log files
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldPath = i === 1 ? basePath : `${basePath}.${i - 1}`;
      const newPath = `${basePath}.${i}`;
      
      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath);
      }
    }

    this.currentFileSize = 0;
  }

  private ensureLogDirectory(): void {
    if (this.config.filePath) {
      const dir = dirname(this.config.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private initializeFileSize(): void {
    if (this.config.filePath && existsSync(this.config.filePath)) {
      const stats = statSync(this.config.filePath);
      this.currentFileSize = stats.size;
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000); // Flush every 5 seconds
  }

  private getSource(): string | undefined {
    if (!this.config.includeSource) {
      return undefined;
    }

    const stack = new Error().stack;
    if (!stack) {
      return undefined;
    }

    const lines = stack.split('\n');
    // Find the caller (skip Logger methods)
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('logger.ts')) {
        const match = line.match(/at\s+(.+?)\s*\((.+?):(\d+):(\d+)\)/);
        if (match) {
          return `${match[2]}:${match[3]}`;
        }
      }
    }

    return undefined;
  }

  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.redactKeys || this.config.redactKeys.length === 0) {
      return context;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const shouldRedact = this.config.redactKeys.some(
        redactKey => key.toLowerCase().includes(redactKey.toLowerCase())
      );

      if (shouldRedact) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

let globalLogger: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function debug(message: string, context?: Record<string, unknown>): void {
  getLogger().debug(message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
  getLogger().info(message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
  getLogger().warn(message, context);
}

export function error(message: string, err?: Error, context?: Record<string, unknown>): void {
  getLogger().error(message, err, context);
}

export function fatal(message: string, err?: Error, context?: Record<string, unknown>): void {
  getLogger().fatal(message, err, context);
}

// ============================================================================
// Log Level Helpers
// ============================================================================

export function isValidLogLevel(level: string): level is LogLevel {
  return level in LOG_LEVELS;
}

export function parseLogLevel(level: string, defaultLevel: LogLevel = 'info'): LogLevel {
  const normalizedLevel = level.toLowerCase() as LogLevel;
  return isValidLogLevel(normalizedLevel) ? normalizedLevel : defaultLevel;
}

// ============================================================================
// Performance Logging
// ============================================================================

export class PerformanceLogger {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || getLogger();
  }

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  end(label: string, context?: Record<string, unknown>): number {
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      this.logger.warn(`Timer '${label}' does not exist`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);

    this.logger.debug(`Timer '${label}' took ${duration.toFixed(2)}ms`, {
      ...context,
      duration,
      label,
    });

    return duration;
  }

  logMemoryUsage(label?: string): void {
    const usage = process.memoryUsage();
    this.logger.debug(label || 'Memory usage', {
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
    });
  }
}

// ============================================================================
// Request Context Logger
// ============================================================================

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
}

export class RequestLogger {
  private logger: Logger;
  private context: RequestContext;

  constructor(context: RequestContext, logger?: Logger) {
    this.logger = logger || getLogger();
    this.context = context;
  }

  debug(message: string, additionalContext?: Record<string, unknown>): void {
    this.logger.debug(message, this.mergeContext(additionalContext));
  }

  info(message: string, additionalContext?: Record<string, unknown>): void {
    this.logger.info(message, this.mergeContext(additionalContext));
  }

  warn(message: string, additionalContext?: Record<string, unknown>): void {
    this.logger.warn(message, this.mergeContext(additionalContext));
  }

  error(message: string, err?: Error, additionalContext?: Record<string, unknown>): void {
    this.logger.error(message, err, this.mergeContext(additionalContext));
  }

  fatal(message: string, err?: Error, additionalContext?: Record<string, unknown>): void {
    this.logger.fatal(message, err, this.mergeContext(additionalContext));
  }

  private mergeContext(additional?: Record<string, unknown>): Record<string, unknown> {
    return {
      requestId: this.context.requestId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      path: this.context.path,
      method: this.context.method,
      ip: this.context.ip,
      userAgent: this.context.userAgent,
      ...additional,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default Logger;
