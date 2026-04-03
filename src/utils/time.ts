/**
 * Time Utilities Module
 * 
 * Provides comprehensive time and date manipulation utilities including
 * formatting, parsing, duration calculations, and scheduling.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type TimeUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y';

export interface Duration {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export interface FormatOptions {
  format?: string;
  locale?: string;
  timezone?: string;
}

export interface ParseOptions {
  format?: string;
  locale?: string;
  timezone?: string;
}

export interface CronOptions {
  timezone?: string;
}

export interface TimerOptions {
  interval: number;
  immediate?: boolean;
}

export interface DebounceOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

const TIME_UNITS: Record<TimeUnit, number> = {
  ms: 1,
  s: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  d: MS_PER_DAY,
  w: MS_PER_WEEK,
  M: MS_PER_DAY * 30, // Approximate
  y: MS_PER_DAY * 365, // Approximate
};

const FORMAT_TOKENS: Record<string, (date: Date) => string> = {
  YYYY: d => String(d.getFullYear()),
  MM: d => String(d.getMonth() + 1).padStart(2, '0'),
  DD: d => String(d.getDate()).padStart(2, '0'),
  HH: d => String(d.getHours()).padStart(2, '0'),
  mm: d => String(d.getMinutes()).padStart(2, '0'),
  ss: d => String(d.getSeconds()).padStart(2, '0'),
  SSS: d => String(d.getMilliseconds()).padStart(3, '0'),
  MMM: d => d.toLocaleString('en-US', { month: 'short' }),
  MMMM: d => d.toLocaleString('en-US', { month: 'long' }),
  ddd: d => d.toLocaleString('en-US', { weekday: 'short' }),
  dddd: d => d.toLocaleString('en-US', { weekday: 'long' }),
};

// ============================================================================
// Duration Operations
// ============================================================================

export function toMilliseconds(value: number, unit: TimeUnit): number {
  return value * TIME_UNITS[unit];
}

export function fromMilliseconds(ms: number, unit: TimeUnit): number {
  return ms / TIME_UNITS[unit];
}

export function parseDuration(input: string): number {
  const regex = /(-?\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)/gi;
  let totalMs = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase() as TimeUnit;
    totalMs += value * TIME_UNITS[unit];
  }

  return totalMs;
}

export function formatDuration(ms: number, options: { compact?: boolean } = {}): string {
  const { compact = false } = options;

  if (ms === 0) return '0ms';

  const isNegative = ms < 0;
  const absMs = Math.abs(ms);

  const parts: string[] = [];

  const days = Math.floor(absMs / MS_PER_DAY);
  const hours = Math.floor((absMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((absMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((absMs % MS_PER_MINUTE) / MS_PER_SECOND);
  const milliseconds = absMs % MS_PER_SECOND;

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  if (milliseconds > 0 && parts.length === 0) parts.push(`${milliseconds}ms`);

  const result = compact ? parts[0] || '0ms' : parts.join(' ');
  return isNegative ? `-${result}` : result;
}

export function formatDurationPrecise(ms: number): string {
  if (ms < MS_PER_SECOND) {
    return `${ms}ms`;
  }
  if (ms < MS_PER_MINUTE) {
    return `${(ms / MS_PER_SECOND).toFixed(2)}s`;
  }
  if (ms < MS_PER_HOUR) {
    return `${(ms / MS_PER_MINUTE).toFixed(2)}m`;
  }
  if (ms < MS_PER_DAY) {
    return `${(ms / MS_PER_HOUR).toFixed(2)}h`;
  }
  return `${(ms / MS_PER_DAY).toFixed(2)}d`;
}

export function addDuration(date: Date, duration: Duration): Date {
  const result = new Date(date);

  if (duration.years) result.setFullYear(result.getFullYear() + duration.years);
  if (duration.months) result.setMonth(result.getMonth() + duration.months);
  if (duration.weeks) result.setDate(result.getDate() + duration.weeks * 7);
  if (duration.days) result.setDate(result.getDate() + duration.days);
  if (duration.hours) result.setHours(result.getHours() + duration.hours);
  if (duration.minutes) result.setMinutes(result.getMinutes() + duration.minutes);
  if (duration.seconds) result.setSeconds(result.getSeconds() + duration.seconds);
  if (duration.milliseconds) result.setMilliseconds(result.getMilliseconds() + duration.milliseconds);

  return result;
}

export function subtractDuration(date: Date, duration: Duration): Date {
  const negativeDuration: Duration = {};
  for (const [key, value] of Object.entries(duration)) {
    if (value !== undefined) {
      (negativeDuration as Record<string, number>)[key] = -value;
    }
  }
  return addDuration(date, negativeDuration);
}

export function diffInMs(date1: Date, date2: Date): number {
  return date1.getTime() - date2.getTime();
}

export function diffInSeconds(date1: Date, date2: Date): number {
  return Math.floor(diffInMs(date1, date2) / MS_PER_SECOND);
}

export function diffInMinutes(date1: Date, date2: Date): number {
  return Math.floor(diffInMs(date1, date2) / MS_PER_MINUTE);
}

export function diffInHours(date1: Date, date2: Date): number {
  return Math.floor(diffInMs(date1, date2) / MS_PER_HOUR);
}

export function diffInDays(date1: Date, date2: Date): number {
  return Math.floor(diffInMs(date1, date2) / MS_PER_DAY);
}

// ============================================================================
// Date Formatting
// ============================================================================

export function format(date: Date | number, options: FormatOptions = {}): string {
  const { format: formatStr = 'YYYY-MM-DD HH:mm:ss', locale = 'en-US' } = options;

  const d = typeof date === 'number' ? new Date(date) : date;

  let result = formatStr;
  for (const [token, formatter] of Object.entries(FORMAT_TOKENS)) {
    result = result.replace(new RegExp(token, 'g'), formatter(d));
  }

  return result;
}

export function formatISO(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toISOString();
}

export function formatRelative(date: Date | number, baseDate: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const base = typeof baseDate === 'number' ? new Date(baseDate) : baseDate;

  const diff = diffInMs(d, base);
  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  if (absDiff < MS_PER_MINUTE) {
    return isFuture ? 'in a few seconds' : 'just now';
  }

  if (absDiff < MS_PER_HOUR) {
    const minutes = Math.floor(absDiff / MS_PER_MINUTE);
    return isFuture ? `in ${minutes} minute${minutes > 1 ? 's' : ''}` : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  if (absDiff < MS_PER_DAY) {
    const hours = Math.floor(absDiff / MS_PER_HOUR);
    return isFuture ? `in ${hours} hour${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  if (absDiff < MS_PER_DAY * 7) {
    const days = Math.floor(absDiff / MS_PER_DAY);
    return isFuture ? `in ${days} day${days > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''} ago`;
  }

  if (absDiff < MS_PER_DAY * 30) {
    const weeks = Math.floor(absDiff / MS_PER_WEEK);
    return isFuture ? `in ${weeks} week${weeks > 1 ? 's' : ''}` : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }

  if (absDiff < MS_PER_DAY * 365) {
    const months = Math.floor(absDiff / (MS_PER_DAY * 30));
    return isFuture ? `in ${months} month${months > 1 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(absDiff / (MS_PER_DAY * 365));
  return isFuture ? `in ${years} year${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''} ago`;
}

export function formatTimeAgo(date: Date | number): string {
  return formatRelative(date);
}

// ============================================================================
// Date Parsing
// ============================================================================

export function parse(input: string, format?: string): Date {
  if (!format) {
    return new Date(input);
  }

  // Simple format parsing
  const regex = format
    .replace('YYYY', '(\\d{4})')
    .replace('MM', '(\\d{2})')
    .replace('DD', '(\\d{2})')
    .replace('HH', '(\\d{2})')
    .replace('mm', '(\\d{2})')
    .replace('ss', '(\\d{2})');

  const match = input.match(new RegExp(`^${regex}$`));

  if (!match) {
    throw new Error(`Failed to parse date: ${input}`);
  }

  // Extract values based on format
  const tokenOrder: string[] = [];
  const tokenRegex = /(YYYY|MM|DD|HH|mm|ss)/g;
  let tokenMatch;
  while ((tokenMatch = tokenRegex.exec(format)) !== null) {
    tokenOrder.push(tokenMatch[1]);
  }

  const values: Record<string, number> = {};
  for (let i = 0; i < tokenOrder.length; i++) {
    values[tokenOrder[i]] = parseInt(match[i + 1], 10);
  }

  return new Date(
    values.YYYY || 0,
    (values.MM || 1) - 1,
    values.DD || 1,
    values.HH || 0,
    values.mm || 0,
    values.ss || 0
  );
}

export function parseTimestamp(timestamp: number): Date {
  // Detect if timestamp is in seconds or milliseconds
  const ms = timestamp < 1e10 ? timestamp * 1000 : timestamp;
  return new Date(ms);
}

// ============================================================================
// Date Manipulation
// ============================================================================

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfWeek(date: Date, weekStartsOn: number = 0): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfWeek(date: Date, weekStartsOn: number = 0): Date {
  const result = startOfWeek(date, weekStartsOn);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(11, 31);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

// ============================================================================
// Date Comparison
// ============================================================================

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

export function isSameYear(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isYesterday(date: Date): boolean {
  const yesterday = addDays(new Date(), -1);
  return isSameDay(date, yesterday);
}

export function isTomorrow(date: Date): boolean {
  const tomorrow = addDays(new Date(), 1);
  return isSameDay(date, tomorrow);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

export function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

export function isBetween(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

// ============================================================================
// Timers and Scheduling
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function delay<T>(ms: number, value?: T): Promise<T | undefined> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export class Timer {
  private callback: () => void;
  private interval: number;
  private timerId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(callback: () => void, interval: number) {
    this.callback = callback;
    this.interval = interval;
  }

  start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.timerId = setInterval(this.callback, this.interval);
    }
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
      this.isRunning = false;
    }
  }

  restart(): void {
    this.stop();
    this.start();
  }

  get running(): boolean {
    return this.isRunning;
  }
}

export class Stopwatch {
  private startTime: number = 0;
  private elapsed: number = 0;
  private isRunning: boolean = false;

  start(): void {
    if (!this.isRunning) {
      this.startTime = performance.now();
      this.isRunning = true;
    }
  }

  stop(): number {
    if (this.isRunning) {
      this.elapsed += performance.now() - this.startTime;
      this.isRunning = false;
    }
    return this.elapsed;
  }

  reset(): void {
    this.elapsed = 0;
    this.isRunning = false;
  }

  restart(): void {
    this.reset();
    this.start();
  }

  getElapsed(): number {
    if (this.isRunning) {
      return this.elapsed + (performance.now() - this.startTime);
    }
    return this.elapsed;
  }

  getElapsedFormatted(): string {
    return formatDuration(this.getElapsed());
  }

  get running(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  toMilliseconds,
  fromMilliseconds,
  parseDuration,
  formatDuration,
  formatDurationPrecise,
  addDuration,
  subtractDuration,
  diffInMs,
  diffInSeconds,
  diffInMinutes,
  diffInHours,
  diffInDays,
  format,
  formatISO,
  formatRelative,
  formatTimeAgo,
  parse,
  parseTimestamp,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addMonths,
  addYears,
  isSameDay,
  isSameMonth,
  isSameYear,
  isToday,
  isYesterday,
  isTomorrow,
  isWeekend,
  isLeapYear,
  isBefore,
  isAfter,
  isBetween,
  sleep,
  delay,
  timeout,
  Timer,
  Stopwatch,
};
