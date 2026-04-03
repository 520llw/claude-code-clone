/**
 * Security Sanitizer Module
 * 
 * Provides comprehensive input sanitization utilities to prevent XSS,
 * SQL injection, command injection, and other security vulnerabilities.
 */

import { encode } from 'html-entities';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripTags?: boolean;
  encodeEntities?: boolean;
}

export interface SqlSanitizeOptions {
  escapeQuotes?: boolean;
  escapeWildcards?: boolean;
}

export interface CommandSanitizeOptions {
  allowSpaces?: boolean;
  allowedChars?: RegExp;
}

export interface FilenameSanitizeOptions {
  replacement?: string;
  maxLength?: number;
}

// ============================================================================
// HTML/XSS Sanitization
// ============================================================================

const DANGEROUS_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'button',
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'applet',
  'marquee',
  'blink',
];

const DANGEROUS_ATTRIBUTES = [
  'onabort',
  'onblur',
  'onchange',
  'onclick',
  'ondblclick',
  'onerror',
  'onfocus',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onmousedown',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'onreset',
  'onresize',
  'onselect',
  'onsubmit',
  'onunload',
  'javascript:',
  'data:',
  'vbscript:',
  'mocha:',
  'livescript:',
];

export function sanitizeHtml(input: string, options: SanitizeOptions = {}): string {
  const {
    allowedTags = [],
    allowedAttributes = {},
    stripTags = true,
    encodeEntities = true,
  } = options;

  let sanitized = input;

  // Remove or encode script tags and dangerous content
  if (stripTags) {
    // Remove dangerous tags
    for (const tag of DANGEROUS_TAGS) {
      const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*\\/?>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }

    // Remove all tags if no allowed tags specified
    if (allowedTags.length === 0) {
      sanitized = sanitized.replace(/<[^>]+>/g, '');
    } else {
      // Remove disallowed tags
      const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
      sanitized = sanitized.replace(tagRegex, (match, tag) => {
        const lowerTag = tag.toLowerCase();
        if (allowedTags.includes(lowerTag)) {
          return sanitizeAttributes(match, lowerTag, allowedAttributes);
        }
        return '';
      });
    }
  }

  // Remove dangerous attributes from remaining tags
  for (const attr of DANGEROUS_ATTRIBUTES) {
    const regex = new RegExp(`\\s${attr}=["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/(href|src|action|background|cite|longdesc|profile|usemap)=\s*["']?(javascript|data|vbscript):/gi, '');

  // Encode HTML entities if requested
  if (encodeEntities) {
    sanitized = encode(sanitized, { level: 'html5' });
  }

  return sanitized;
}

function sanitizeAttributes(
  tag: string,
  tagName: string,
  allowedAttributes: Record<string, string[]>
): string {
  const allowed = allowedAttributes[tagName] || [];
  const attrRegex = /\s([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/gi;

  let match;
  const attrs: string[] = [];

  while ((match = attrRegex.exec(tag)) !== null) {
    const attrName = match[1].toLowerCase();
    const attrValue = match[2];

    if (allowed.includes(attrName)) {
      // Sanitize attribute value
      const sanitizedValue = sanitizeAttributeValue(attrValue);
      attrs.push(` ${attrName}="${sanitizedValue}"`);
    }
  }

  if (tag.endsWith('/>')) {
    return `<${tagName}${attrs.join('')} />`;
  }
  return `<${tagName}${attrs.join('')}>`;
}

function sanitizeAttributeValue(value: string): string {
  return value
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

export function escapeHtml(input: string): string {
  return encode(input, { level: 'html5' });
}

export function escapeAttribute(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeJavaScript(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '\\b');
}

export function escapeCss(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

export function escapeUrl(input: string): string {
  return encodeURIComponent(input);
}

// ============================================================================
// SQL Injection Prevention
// ============================================================================

const SQL_KEYWORDS = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
  'TABLE', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'NULL', 'LIKE',
  'UNION', 'JOIN', 'HAVING', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET',
  'EXEC', 'EXECUTE', 'TRUNCATE', 'REPLACE', 'MERGE', 'CALL',
];

export function sanitizeSql(input: string, options: SqlSanitizeOptions = {}): string {
  const { escapeQuotes = true, escapeWildcards = true } = options;

  let sanitized = input;

  // Escape single quotes
  if (escapeQuotes) {
    sanitized = sanitized.replace(/'/g, "''");
  }

  // Escape SQL wildcards
  if (escapeWildcards) {
    sanitized = sanitized
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');

  // Remove comment sequences
  sanitized = sanitized.replace(/\/\*/g, '').replace(/\*\//g, '');
  sanitized = sanitized.replace(/--/g, '');
  sanitized = sanitized.replace(/#/g, '');

  return sanitized;
}

export function sanitizeSqlIdentifier(input: string): string {
  // Remove backticks and brackets
  let sanitized = input.replace(/[`\[\]]/g, '');

  // Remove non-identifier characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure it doesn't start with a number
  if (/^\d/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized;
}

export function isSqlInjectionAttempt(input: string): boolean {
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION\s+SELECT/i,
    /INSERT\s+INTO/i,
    /DELETE\s+FROM/i,
    /DROP\s+TABLE/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

// ============================================================================
// Command Injection Prevention
// ============================================================================

const DANGEROUS_SHELL_CHARS = /[;&|`$(){}[\]\\\n\r*?~<>^]/g;

export function sanitizeShellArg(input: string, options: CommandSanitizeOptions = {}): string {
  const { allowSpaces = false, allowedChars } = options;

  let sanitized = input;

  // Remove or escape dangerous characters
  if (allowedChars) {
    sanitized = sanitized.replace(new RegExp(`[^${allowedChars.source.slice(1, -1)}]`, 'g'), '');
  } else {
    sanitized = sanitized.replace(DANGEROUS_SHELL_CHARS, '');
  }

  // Handle spaces
  if (!allowSpaces) {
    sanitized = sanitized.replace(/\s/g, '');
  }

  return sanitized;
}

export function sanitizeCommand(input: string): string {
  // Remove command separators and dangerous operators
  return input
    .replace(/[;&|]/g, '')
    .replace(/`/g, '')
    .replace(/\$\(/g, '')
    .replace(/\$\{/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '');
}

export function isCommandInjectionAttempt(input: string): boolean {
  const suspiciousPatterns = [
    /[;|&`]/,
    /\$\(/,
    /\$\{/,
    /\n/,
    /\r/,
    /\/bin\/sh/,
    /\/bin\/bash/,
    /cmd\.exe/,
    /powershell/,
    /\.exe/,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

// ============================================================================
// Path Traversal Prevention
// ============================================================================

export function sanitizePath(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\x00/g, '');

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.\/|\.\.\\/g, '');
  sanitized = sanitized.replace(/%2e%2e%2f/gi, '');
  sanitized = sanitized.replace(/%2e%2e\//gi, '');
  sanitized = sanitized.replace(/%2e%2e%5c/gi, '');
  sanitized = sanitized.replace(/%2e%2e\\/gi, '');

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove leading slashes to prevent absolute path
  sanitized = sanitized.replace(/^\/+/, '');

  return sanitized;
}

export function sanitizeFilename(input: string, options: FilenameSanitizeOptions = {}): string {
  const { replacement = '_', maxLength = 255 } = options;

  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');

  // Remove path separators
  sanitized = sanitized.replace(/[\/\\]/g, replacement);

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, replacement);

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, replacement);

  // Handle reserved Windows names
  const reservedNames = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
  if (reservedNames.test(sanitized)) {
    sanitized = replacement + sanitized;
  }

  // Trim trailing periods and spaces (Windows)
  sanitized = sanitized.replace(/[.\s]+$/, '');

  // Limit length
  if (sanitized.length > maxLength) {
    const ext = sanitized.lastIndexOf('.');
    if (ext > 0) {
      sanitized = sanitized.slice(0, maxLength - (sanitized.length - ext)) + sanitized.slice(ext);
    } else {
      sanitized = sanitized.slice(0, maxLength);
    }
  }

  return sanitized || replacement;
}

export function isPathTraversalAttempt(input: string): boolean {
  const traversalPatterns = [
    /\.\.\/|\.\.\\/,
    /%2e%2e%2f/i,
    /%2e%2e\//i,
    /%2e%2e%5c/i,
    /%2e%2e\\/i,
    /%252e%252e%252f/i,
    /\.\.\.\//,
    /\.\.\.\\/,
  ];

  return traversalPatterns.some(pattern => pattern.test(input));
}

// ============================================================================
// JSON Sanitization
// ============================================================================

export function sanitizeJson(input: string): string {
  // Remove BOM
  let sanitized = input.replace(/^\uFEFF/, '');

  // Remove control characters except for whitespace
  sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // Remove Unicode directional formatting characters
  sanitized = sanitized.replace(/[\u200E\u200F\u202A-\u202E]/g, '');

  return sanitized;
}

export function safeJsonParse<T = unknown>(input: string, defaultValue?: T): T | undefined {
  try {
    const sanitized = sanitizeJson(input);
    return JSON.parse(sanitized) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// Email Sanitization
// ============================================================================

export function sanitizeEmail(input: string): string {
  // Remove whitespace
  let sanitized = input.trim().toLowerCase();

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>"'\s]/g, '');

  // Remove comments
  sanitized = sanitized.replace(/\([^)]*\)/g, '');

  return sanitized;
}

export function isValidEmailFormat(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(input);
}

// ============================================================================
// URL Sanitization
// ============================================================================

export function sanitizeUrl(input: string, allowedProtocols: string[] = ['http:', 'https:']): string {
  try {
    const url = new URL(input);

    // Check protocol
    if (!allowedProtocols.includes(url.protocol)) {
      return '';
    }

    // Remove dangerous characters from pathname
    url.pathname = url.pathname.replace(/[<>"'{}|\\^`\[\]]/g, '');

    // Remove username and password
    url.username = '';
    url.password = '';

    return url.toString();
  } catch {
    return '';
  }
}

export function isDangerousUrl(input: string): boolean {
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
    'chrome:',
    'resource:',
  ];

  const lowerInput = input.toLowerCase().trim();
  return dangerousProtocols.some(protocol => lowerInput.startsWith(protocol));
}

// ============================================================================
// General Input Sanitization
// ============================================================================

export function sanitizeInput(input: string): string {
  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');

  // Normalize Unicode
  sanitized = sanitized.normalize('NFC');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

export function sanitizeForLogging(input: string): string {
  return input
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ============================================================================
// Deep Sanitization for Objects
// ============================================================================

export function deepSanitize<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeInput(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSanitize) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitize(value);
    }
    return sanitized as T;
  }

  return obj;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  sanitizeHtml,
  stripHtml,
  escapeHtml,
  escapeAttribute,
  escapeJavaScript,
  escapeCss,
  escapeUrl,
  sanitizeSql,
  sanitizeSqlIdentifier,
  isSqlInjectionAttempt,
  sanitizeShellArg,
  sanitizeCommand,
  isCommandInjectionAttempt,
  sanitizePath,
  sanitizeFilename,
  isPathTraversalAttempt,
  sanitizeJson,
  safeJsonParse,
  sanitizeEmail,
  isValidEmailFormat,
  sanitizeUrl,
  isDangerousUrl,
  sanitizeInput,
  sanitizeForLogging,
  deepSanitize,
};
