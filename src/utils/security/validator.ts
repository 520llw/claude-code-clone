/**
 * Security Validator Module
 * 
 * Provides security-focused validation utilities for authentication,
 * authorization, and input security checks.
 */

import { timingSafeEqual, createHash, randomBytes } from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  specialChars?: string;
  preventCommonPasswords?: boolean;
  preventUsernameInPassword?: boolean;
}

export interface TokenValidationOptions {
  maxAge?: number;
  algorithm?: string;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface IpValidationOptions {
  allowPrivate?: boolean;
  allowLoopback?: boolean;
  allowedRanges?: string[];
  blockedRanges?: string[];
}

export interface ContentSecurityPolicy {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  reportUri?: string;
}

export interface SecurityHeaders {
  contentSecurityPolicy?: ContentSecurityPolicy;
  strictTransportSecurity?: string;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xContentTypeOptions?: 'nosniff';
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

// ============================================================================
// Password Validation
// ============================================================================

const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'letmein', 'dragon', '111111', 'baseball',
  'iloveyou', 'trustno1', 'sunshine', 'princess', 'admin',
  'welcome', 'shadow', 'ashley', 'football', 'jesus',
  'michael', 'ninja', 'mustang', 'password1', '123456789',
]);

export function validatePassword(
  password: string,
  policy: PasswordPolicy = {},
  username?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
    specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?',
    preventCommonPasswords = true,
    preventUsernameInPassword = true,
  } = policy;

  // Length check
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (password.length > maxLength) {
    errors.push(`Password must be at most ${maxLength} characters long`);
  }

  // Character requirements
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSpecialChars) {
    const specialRegex = new RegExp(`[${escapeRegex(specialChars)}]`);
    if (!specialRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  // Common password check
  if (preventCommonPasswords && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  // Username in password check
  if (preventUsernameInPassword && username) {
    const lowerPassword = password.toLowerCase();
    const lowerUsername = username.toLowerCase();
    if (lowerPassword.includes(lowerUsername)) {
      errors.push('Password cannot contain your username');
    }
  }

  // Sequential characters check
  if (hasSequentialChars(password)) {
    errors.push('Password cannot contain sequential characters');
  }

  // Repeated characters check
  if (hasRepeatedChars(password)) {
    errors.push('Password cannot contain repeated characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function hasSequentialChars(password: string): boolean {
  const lower = password.toLowerCase();

  for (let i = 0; i < lower.length - 2; i++) {
    const c1 = lower.charCodeAt(i);
    const c2 = lower.charCodeAt(i + 1);
    const c3 = lower.charCodeAt(i + 2);

    // Check ascending sequence
    if (c1 + 1 === c2 && c2 + 1 === c3) {
      return true;
    }

    // Check descending sequence
    if (c1 - 1 === c2 && c2 - 1 === c3) {
      return true;
    }
  }

  return false;
}

function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

export function calculatePasswordStrength(password: string): number {
  let score = 0;

  // Length contribution
  score += Math.min(password.length * 4, 40);

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  // Penalties
  if (/^[a-zA-Z]+$/.test(password)) score -= 10;
  if (/^\d+$/.test(password)) score -= 10;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) score = 0;

  return Math.max(0, Math.min(100, score));
}

export function getPasswordStrengthLabel(score: number): string {
  if (score < 20) return 'very weak';
  if (score < 40) return 'weak';
  if (score < 60) return 'fair';
  if (score < 80) return 'good';
  return 'strong';
}

// ============================================================================
// Token Validation
// ============================================================================

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateTokenFormat(token: string, expectedLength: number = 43): boolean {
  // Base64url encoded 32 bytes = 43 characters
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(token) && token.length === expectedLength;
}

export function isTokenExpired(createdAt: Date, maxAgeMs: number): boolean {
  return Date.now() - createdAt.getTime() > maxAgeMs;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function compareTokenHash(token: string, hash: string): boolean {
  const computedHash = hashToken(token);
  return timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}

// ============================================================================
// Session Validation
// ============================================================================

export interface SessionData {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivityAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export function validateSession(
  session: SessionData,
  options: { maxAgeMs: number; inactivityTimeoutMs: number }
): { valid: boolean; reason?: string } {
  const { maxAgeMs, inactivityTimeoutMs } = options;

  // Check session age
  if (isTokenExpired(session.createdAt, maxAgeMs)) {
    return { valid: false, reason: 'session_expired' };
  }

  // Check inactivity
  if (isTokenExpired(session.lastActivityAt, inactivityTimeoutMs)) {
    return { valid: false, reason: 'session_inactive' };
  }

  return { valid: true };
}

// ============================================================================
// IP Address Validation
// ============================================================================

export function isValidIpAddress(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function isPrivateIp(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  return privateRanges.some(range => range.test(ip));
}

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.');
}

export function validateIpAddress(
  ip: string,
  options: IpValidationOptions = {}
): { valid: boolean; reason?: string } {
  const {
    allowPrivate = true,
    allowLoopback = true,
    allowedRanges = [],
    blockedRanges = [],
  } = options;

  if (!isValidIpAddress(ip)) {
    return { valid: false, reason: 'invalid_format' };
  }

  if (!allowLoopback && isLoopbackIp(ip)) {
    return { valid: false, reason: 'loopback_not_allowed' };
  }

  if (!allowPrivate && isPrivateIp(ip)) {
    return { valid: false, reason: 'private_not_allowed' };
  }

  // Check blocked ranges
  for (const range of blockedRanges) {
    if (isIpInRange(ip, range)) {
      return { valid: false, reason: 'ip_blocked' };
    }
  }

  // Check allowed ranges
  if (allowedRanges.length > 0) {
    const inAllowedRange = allowedRanges.some(range => isIpInRange(ip, range));
    if (!inAllowedRange) {
      return { valid: false, reason: 'ip_not_in_allowed_range' };
    }
  }

  return { valid: true };
}

function isIpInRange(ip: string, range: string): boolean {
  // Simple CIDR range check for IPv4
  if (!range.includes('/')) {
    return ip === range;
  }

  const [rangeIp, prefix] = range.split('/');
  const prefixLength = parseInt(prefix, 10);

  const ipParts = ip.split('.').map(Number);
  const rangeParts = rangeIp.split('.').map(Number);

  const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeInt = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];

  const mask = -1 << (32 - prefixLength);

  return (ipInt & mask) === (rangeInt & mask);
}

// ============================================================================
// Rate Limiting
// ============================================================================

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    requests = requests.filter(time => time > windowStart);

    // Check if under limit
    const allowed = requests.length < this.maxRequests;

    if (allowed) {
      requests.push(now);
    }

    this.requests.set(key, requests);

    // Calculate reset time
    const resetTime = requests.length > 0
      ? requests[0] + this.windowMs
      : now + this.windowMs;

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - requests.length),
      resetTime,
    };
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  resetAll(): void {
    this.requests.clear();
  }
}

// ============================================================================
// Origin Validation
// ============================================================================

export function validateOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) {
      return true;
    }

    // Wildcard subdomain match
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === domain.slice(1);
    }

    return false;
  });
}

export function validateReferer(referer: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(referer);
    return allowedHosts.includes(url.host);
  } catch {
    return false;
  }
}

// ============================================================================
// Content Security Policy
// ============================================================================

export function generateCSPHeader(policy: ContentSecurityPolicy): string {
  const directives: string[] = [];

  const addDirective = (name: string, values?: string[]) => {
    if (values && values.length > 0) {
      directives.push(`${name} ${values.join(' ')}`);
    }
  };

  addDirective('default-src', policy.defaultSrc);
  addDirective('script-src', policy.scriptSrc);
  addDirective('style-src', policy.styleSrc);
  addDirective('img-src', policy.imgSrc);
  addDirective('connect-src', policy.connectSrc);
  addDirective('font-src', policy.fontSrc);
  addDirective('object-src', policy.objectSrc);
  addDirective('media-src', policy.mediaSrc);
  addDirective('frame-src', policy.frameSrc);

  if (policy.reportUri) {
    directives.push(`report-uri ${policy.reportUri}`);
  }

  return directives.join('; ');
}

export function getRecommendedCSP(): ContentSecurityPolicy {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  };
}

// ============================================================================
// Security Headers
// ============================================================================

export function generateSecurityHeaders(options: SecurityHeaders = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  // Content Security Policy
  if (options.contentSecurityPolicy) {
    headers['Content-Security-Policy'] = generateCSPHeader(options.contentSecurityPolicy);
  }

  // Strict Transport Security
  if (options.strictTransportSecurity) {
    headers['Strict-Transport-Security'] = options.strictTransportSecurity;
  } else {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  // X-Frame-Options
  if (options.xFrameOptions) {
    headers['X-Frame-Options'] = options.xFrameOptions;
  } else {
    headers['X-Frame-Options'] = 'DENY';
  }

  // X-Content-Type-Options
  headers['X-Content-Type-Options'] = options.xContentTypeOptions || 'nosniff';

  // Referrer Policy
  headers['Referrer-Policy'] = options.referrerPolicy || 'strict-origin-when-cross-origin';

  // Permissions Policy
  if (options.permissionsPolicy) {
    headers['Permissions-Policy'] = options.permissionsPolicy;
  }

  // Additional recommended headers
  headers['X-XSS-Protection'] = '1; mode=block';

  return headers;
}

// ============================================================================
// Request Validation
// ============================================================================

export function validateRequestSize(contentLength: number, maxSize: number): boolean {
  return contentLength <= maxSize;
}

export function validateContentType(
  contentType: string,
  allowedTypes: string[]
): boolean {
  const baseType = contentType.split(';')[0].trim().toLowerCase();
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -1);
      return baseType.startsWith(prefix);
    }
    return baseType === type.toLowerCase();
  });
}

export function validateFileUpload(
  filename: string,
  mimetype: string,
  size: number,
  options: {
    allowedExtensions?: string[];
    allowedMimeTypes?: string[];
    maxSize?: number;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check file extension
  if (options.allowedExtensions) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext || !options.allowedExtensions.includes(ext)) {
      errors.push('File type not allowed');
    }
  }

  // Check MIME type
  if (options.allowedMimeTypes) {
    if (!validateContentType(mimetype, options.allowedMimeTypes)) {
      errors.push('MIME type not allowed');
    }
  }

  // Check file size
  if (options.maxSize && size > options.maxSize) {
    errors.push(`File size exceeds maximum of ${options.maxSize} bytes`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  validatePassword,
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  generateSecureToken,
  generateCsrfToken,
  validateTokenFormat,
  isTokenExpired,
  hashToken,
  compareTokenHash,
  validateSession,
  isValidIpAddress,
  isPrivateIp,
  isLoopbackIp,
  validateIpAddress,
  RateLimiter,
  validateOrigin,
  validateReferer,
  generateCSPHeader,
  getRecommendedCSP,
  generateSecurityHeaders,
  validateRequestSize,
  validateContentType,
  validateFileUpload,
};
