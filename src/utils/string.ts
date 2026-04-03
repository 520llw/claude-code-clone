/**
 * String Utilities Module
 * 
 * Provides comprehensive string manipulation utilities including formatting,
 * transformation, validation, and advanced pattern matching.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TruncateOptions {
  length: number;
  omission?: string;
  separator?: string | RegExp;
}

export interface PadOptions {
  length: number;
  chars?: string;
}

export interface WordOptions {
  pattern?: RegExp;
  guard?: boolean;
}

export interface TemplateOptions {
  escape?: RegExp;
  evaluate?: RegExp;
  interpolate?: RegExp;
  variable?: string;
  imports?: Record<string, unknown>;
}

// ============================================================================
// Case Conversion
// ============================================================================

export function camelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '')
    .replace(/[-_]+/g, '');
}

export function pascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/[-_]+/g, '');
}

export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function constantCase(str: string): string {
  return snakeCase(str).toUpperCase();
}

export function dotCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1.$2')
    .replace(/[\s_-]+/g, '.')
    .toLowerCase();
}

export function pathCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1/$2')
    .replace(/[\s_-]+/g, '/')
    .toLowerCase();
}

export function headerCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\w/g, match => match.toUpperCase());
}

export function sentenceCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(^")|(\.\s+\w)/g, match => match.toUpperCase());
}

export function lowerCase(str: string): string {
  return str.toLowerCase();
}

export function upperCase(str: string): string {
  return str.toUpperCase();
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function uncapitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function swapCase(str: string): string {
  return str
    .split('')
    .map(char =>
      char === char.toUpperCase()
        ? char.toLowerCase()
        : char.toUpperCase()
    )
    .join('');
}

// ============================================================================
// Truncation and Padding
// ============================================================================

export function truncate(str: string, options: TruncateOptions): string {
  const { length, omission = '...', separator } = options;

  if (str.length <= length) {
    return str;
  }

  let truncated = str.slice(0, length - omission.length);

  if (separator) {
    const lastIndex = truncated.lastIndexOf(separator as string);
    if (lastIndex !== -1) {
      truncated = truncated.slice(0, lastIndex);
    }
  }

  return truncated + omission;
}

export function pad(str: string, options: PadOptions): string {
  const { length, chars = ' ' } = options;
  const strLength = str.length;

  if (strLength >= length) {
    return str;
  }

  const padLength = length - strLength;
  const leftPad = Math.floor(padLength / 2);
  const rightPad = padLength - leftPad;

  return (
    repeat(chars, Math.ceil(leftPad / chars.length)).slice(0, leftPad) +
    str +
    repeat(chars, Math.ceil(rightPad / chars.length)).slice(0, rightPad)
  );
}

export function padStart(str: string, options: PadOptions): string {
  const { length, chars = ' ' } = options;
  const strLength = str.length;

  if (strLength >= length) {
    return str;
  }

  const padLength = length - strLength;
  return (
    repeat(chars, Math.ceil(padLength / chars.length)).slice(0, padLength) + str
  );
}

export function padEnd(str: string, options: PadOptions): string {
  const { length, chars = ' ' } = options;
  const strLength = str.length;

  if (strLength >= length) {
    return str;
  }

  const padLength = length - strLength;
  return (
    str + repeat(chars, Math.ceil(padLength / chars.length)).slice(0, padLength)
  );
}

export function repeat(str: string, count: number): string {
  if (count <= 0) return '';
  if (count === 1) return str;

  let result = '';
  let pattern = str;

  while (count > 0) {
    if (count & 1) {
      result += pattern;
    }
    count >>= 1;
    pattern += pattern;
  }

  return result;
}

// ============================================================================
// Trimming
// ============================================================================

export function trim(str: string, chars?: string): string {
  if (chars === undefined) {
    return str.trim();
  }
  const regex = new RegExp(`^[${escapeRegExp(chars)}]+|[${escapeRegExp(chars)}]+$`, 'g');
  return str.replace(regex, '');
}

export function trimStart(str: string, chars?: string): string {
  if (chars === undefined) {
    return str.trimStart();
  }
  const regex = new RegExp(`^[${escapeRegExp(chars)}]+`, 'g');
  return str.replace(regex, '');
}

export function trimEnd(str: string, chars?: string): string {
  if (chars === undefined) {
    return str.trimEnd();
  }
  const regex = new RegExp(`[${escapeRegExp(chars)}]+$`, 'g');
  return str.replace(regex, '');
}

// ============================================================================
// Word Operations
// ============================================================================

export function words(str: string, pattern?: RegExp): string[] {
  const defaultPattern = /[\w']+/g;
  const matches = str.match(pattern || defaultPattern);
  return matches || [];
}

export function countWords(str: string): number {
  return words(str).length;
}

export function splitWords(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/);
}

// ============================================================================
// Character Operations
// ============================================================================

export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

export function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function unescape(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str: string): string {
  return escape(str);
}

export function unescapeHtml(str: string): string {
  return unescape(str);
}

// ============================================================================
// Slug and URL
// ============================================================================

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function dasherize(str: string): string {
  return kebabCase(str);
}

export function humanize(str: string): string {
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

// ============================================================================
// Templates
// ============================================================================

export function template(str: string, data: Record<string, unknown>): string {
  return str.replace(/\$\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : match;
  });
}

export function compileTemplate(str: string): (data: Record<string, unknown>) => string {
  return (data: Record<string, unknown>) => template(str, data);
}

// ============================================================================
// Validation
// ============================================================================

export function isEmpty(str: string): boolean {
  return !str || str.length === 0;
}

export function isBlank(str: string): boolean {
  return !str || str.trim().length === 0;
}

export function isNumeric(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(Number(str));
}

export function isInteger(str: string): boolean {
  return /^-?\d+$/.test(str);
}

export function isFloat(str: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(str);
}

export function isAlpha(str: string): boolean {
  return /^[a-zA-Z]+$/.test(str);
}

export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

export function isLowerCase(str: string): boolean {
  return str === str.toLowerCase();
}

export function isUpperCase(str: string): boolean {
  return str === str.toUpperCase();
}

// ============================================================================
// Extraction
// ============================================================================

export function extractEmails(str: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return str.match(emailRegex) || [];
}

export function extractUrls(str: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return str.match(urlRegex) || [];
}

export function extractNumbers(str: string): number[] {
  const matches = str.match(/-?\d+(\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

export function extractHashtags(str: string): string[] {
  const hashtagRegex = /#\w+/g;
  return str.match(hashtagRegex) || [];
}

export function extractMentions(str: string): string[] {
  const mentionRegex = /@\w+/g;
  return str.match(mentionRegex) || [];
}

// ============================================================================
// Replacement
// ============================================================================

export function replaceAll(
  str: string,
  search: string | RegExp,
  replacement: string
): string {
  if (typeof search === 'string') {
    return str.split(search).join(replacement);
  }
  return str.replace(new RegExp(search.source, 'g'), replacement);
}

export function remove(str: string, pattern: string | RegExp): string {
  return replaceAll(str, pattern, '');
}

// ============================================================================
// Formatting
// ============================================================================

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatNumber(num: number, locale: string = 'en-US'): string {
  return num.toLocaleString(locale);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============================================================================
// Masking
// ============================================================================

export function mask(str: string, start: number = 0, end?: number, maskChar: string = '*'): string {
  const len = str.length;
  const maskEnd = end ?? len;

  if (start >= len || maskEnd <= start) {
    return str;
  }

  const prefix = str.slice(0, start);
  const suffix = str.slice(maskEnd);
  const masked = repeat(maskChar, Math.min(maskEnd - start, len - start));

  return prefix + masked + suffix;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;

  const maskedLocal = local.length > 2
    ? local.charAt(0) + repeat('*', local.length - 2) + local.charAt(local.length - 1)
    : repeat('*', local.length);

  return `${maskedLocal}@${domain}`;
}

export function maskCard(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, '');
  return mask(cleaned, 0, cleaned.length - 4);
}

// ============================================================================
// Similarity
// ============================================================================

export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const matrix: number[][] = [];

  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[m][n];
}

export function similarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  camelCase,
  pascalCase,
  kebabCase,
  snakeCase,
  constantCase,
  dotCase,
  pathCase,
  headerCase,
  titleCase,
  sentenceCase,
  lowerCase,
  upperCase,
  capitalize,
  uncapitalize,
  swapCase,
  truncate,
  pad,
  padStart,
  padEnd,
  repeat,
  trim,
  trimStart,
  trimEnd,
  words,
  countWords,
  splitWords,
  reverse,
  escape,
  unescape,
  escapeRegExp,
  escapeHtml,
  unescapeHtml,
  slugify,
  dasherize,
  humanize,
  template,
  compileTemplate,
  isEmpty,
  isBlank,
  isNumeric,
  isInteger,
  isFloat,
  isAlpha,
  isAlphanumeric,
  isLowerCase,
  isUpperCase,
  extractEmails,
  extractUrls,
  extractNumbers,
  extractHashtags,
  extractMentions,
  replaceAll,
  remove,
  formatBytes,
  formatNumber,
  formatDuration,
  mask,
  maskEmail,
  maskCard,
  levenshteinDistance,
  similarity,
};
