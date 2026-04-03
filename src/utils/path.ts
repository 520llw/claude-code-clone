/**
 * Path Utilities Module
 * 
 * Provides comprehensive path manipulation utilities including normalization,
 * resolution, pattern matching, and cross-platform compatibility.
 */

import {
  normalize as pathNormalize,
  join as pathJoin,
  resolve as pathResolve,
  relative as pathRelative,
  dirname as pathDirname,
  basename as pathBasename,
  extname as pathExtname,
  isAbsolute as pathIsAbsolute,
  sep as pathSep,
  delimiter as pathDelimiter,
  posix,
  win32,
  parse as pathParse,
  format as pathFormat,
} from 'path';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export interface PathInfo {
  absolute: string;
  normalized: string;
  parsed: ParsedPath;
  segments: string[];
  depth: number;
}

export interface GlobOptions {
  cwd?: string;
  dot?: boolean;
  nocase?: boolean;
  absolute?: boolean;
}

export interface MatchOptions {
  partial?: boolean;
  dot?: boolean;
  nocase?: boolean;
}

// ============================================================================
// Basic Path Operations
// ============================================================================

export function normalize(path: string): string {
  return pathNormalize(path);
}

export function join(...paths: string[]): string {
  return pathJoin(...paths);
}

export function resolve(...paths: string[]): string {
  return pathResolve(...paths);
}

export function relative(from: string, to: string): string {
  return pathRelative(from, to);
}

export function dirname(path: string): string {
  return pathDirname(path);
}

export function basename(path: string, ext?: string): string {
  return pathBasename(path, ext);
}

export function extname(path: string): string {
  return pathExtname(path);
}

export function isAbsolute(path: string): boolean {
  return pathIsAbsolute(path);
}

export function parse(path: string): ParsedPath {
  return pathParse(path);
}

export function format(pathObject: ParsedPath): string {
  return pathFormat(pathObject);
}

// ============================================================================
// Platform Detection
// ============================================================================

export const isWindows = process.platform === 'win32';
export const isPosix = !isWindows;

export function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}

export function toWindows(path: string): string {
  return path.replace(/\//g, '\\');
}

export function toPlatform(path: string): string {
  return isWindows ? toWindows(path) : toPosix(path);
}

export function ensurePosix(path: string): string {
  return toPosix(path);
}

export function ensureWindows(path: string): string {
  return toWindows(path);
}

// ============================================================================
// Path Analysis
// ============================================================================

export function getPathInfo(path: string): PathInfo {
  const absolute = resolve(path);
  const normalized = normalize(absolute);
  const parsed = parse(normalized);
  const segments = normalized.split(pathSep).filter(Boolean);

  return {
    absolute,
    normalized,
    parsed,
    segments,
    depth: segments.length,
  };
}

export function getCommonAncestor(...paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) return dirname(paths[0]);

  const normalizedPaths = paths.map(p => normalize(p));
  const splitPaths = normalizedPaths.map(p => p.split(pathSep).filter(Boolean));

  const minLength = Math.min(...splitPaths.map(p => p.length));
  let commonIndex = 0;

  for (let i = 0; i < minLength; i++) {
    const segment = splitPaths[0][i];
    if (splitPaths.every(p => p[i] === segment)) {
      commonIndex = i + 1;
    } else {
      break;
    }
  }

  if (commonIndex === 0) {
    return isWindows ? '' : '/';
  }

  return (isAbsolute(normalizedPaths[0]) ? pathSep : '') +
    splitPaths[0].slice(0, commonIndex).join(pathSep);
}

export function getRelativeDepth(from: string, to: string): number {
  const rel = relative(from, to);
  const segments = rel.split(pathSep).filter(Boolean);
  let depth = 0;

  for (const segment of segments) {
    if (segment === '..') {
      depth--;
    } else if (segment !== '.') {
      depth++;
    }
  }

  return depth;
}

export function isDescendant(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

export function isAncestor(child: string, parent: string): boolean {
  return isDescendant(parent, child);
}

export function isSamePath(path1: string, path2: string): boolean {
  return normalize(path1) === normalize(path2);
}

export function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = normalize(parent);
  const normalizedChild = normalize(child);

  return (
    normalizedChild.startsWith(normalizedParent + pathSep) ||
    normalizedChild === normalizedParent
  );
}

// ============================================================================
// Path Manipulation
// ============================================================================

export function addExt(path: string, ext: string): string {
  const currentExt = extname(path);
  if (currentExt === ext) {
    return path;
  }
  return path + ext;
}

export function removeExt(path: string, ext?: string): string {
  const currentExt = extname(path);
  if (!ext || currentExt === ext) {
    return path.slice(0, -currentExt.length) || path;
  }
  return path;
}

export function changeExt(path: string, newExt: string): string {
  const withoutExt = removeExt(path);
  return withoutExt + newExt;
}

export function ensureExt(path: string, ext: string): string {
  if (!path.endsWith(ext)) {
    return path + ext;
  }
  return path;
}

export function removeTrailingSep(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

export function ensureTrailingSep(path: string): string {
  if (!path.endsWith(pathSep) && path.length > 0) {
    return path + pathSep;
  }
  return path;
}

export function removeLeadingSep(path: string): string {
  return path.replace(/^[\\/]+/, '');
}

export function ensureLeadingSep(path: string): string {
  if (!path.startsWith(pathSep) && !isAbsolute(path)) {
    return pathSep + path;
  }
  return path;
}

export function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }

  const parsed = parse(path);
  const available = maxLength - parsed.ext.length - 3; // 3 for "..."

  if (available <= 0) {
    return '...' + parsed.ext;
  }

  return parsed.name.slice(0, available) + '...' + parsed.ext;
}

export function shortenPath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }

  const segments = path.split(pathSep);
  const shortened: string[] = [];
  let currentLength = 0;

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (currentLength + segment.length + 1 <= maxLength - 3) {
      shortened.unshift(segment);
      currentLength += segment.length + 1;
    } else {
      shortened.unshift('...');
      break;
    }
  }

  return shortened.join(pathSep);
}

// ============================================================================
// Path Components
// ============================================================================

export function getFilename(path: string): string {
  return basename(path, extname(path));
}

export function getParentDir(path: string): string {
  return dirname(dirname(path));
}

export function getRoot(path: string): string {
  return parse(path).root;
}

export function getSegments(path: string): string[] {
  return normalize(path).split(pathSep).filter(Boolean);
}

export function getLastSegment(path: string): string {
  const segments = getSegments(path);
  return segments[segments.length - 1] || '';
}

export function getFirstSegment(path: string): string {
  const segments = getSegments(path);
  return segments[0] || '';
}

export function getDepth(path: string): number {
  return getSegments(path).length;
}

// ============================================================================
// Path Validation
// ============================================================================

export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Check for invalid characters on Windows
  if (isWindows) {
    const invalidChars = /[<>:"|?*]/;
    const invalidNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

    const segments = path.split(/[\\/]/);
    for (const segment of segments) {
      if (invalidChars.test(segment) || invalidNames.test(segment)) {
        return false;
      }
    }
  }

  return true;
}

export function isValidFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Check for invalid characters
  const invalidChars = isWindows ? /[<>:"/\\|?*]/ : /\/\0/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // Check for reserved names on Windows
  if (isWindows) {
    const invalidNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
    const baseName = basename(filename, extname(filename));
    if (invalidNames.test(baseName)) {
      return false;
    }
  }

  // Check for trailing periods or spaces on Windows
  if (isWindows && /[.\s]$/.test(filename)) {
    return false;
  }

  return true;
}

export function sanitizeFilename(filename: string, replacement: string = '_'): string {
  let sanitized = filename;

  // Replace invalid characters
  if (isWindows) {
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, replacement);
  } else {
    sanitized = sanitized.replace(/[/\0]/g, replacement);
  }

  // Remove trailing periods and spaces on Windows
  if (isWindows) {
    sanitized = sanitized.replace(/[.\s]+$/, '');
  }

  // Handle reserved names on Windows
  if (isWindows) {
    const invalidNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
    const baseName = basename(sanitized, extname(sanitized));
    if (invalidNames.test(baseName)) {
      sanitized = replacement + sanitized;
    }
  }

  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'unnamed';
  }

  return sanitized;
}

// ============================================================================
// Glob Pattern Matching
// ============================================================================

export function globToRegex(pattern: string): RegExp {
  let regex = '';
  let inGroup = false;

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];

    switch (c) {
      case '/':
      case '\\':
        regex += '[\\\\/]';
        break;
      case '$':
      case '^':
      case '+':
      case '.':
      case '(':
      case ')':
      case '=':
      case '!':
      case '|':
        regex += '\\' + c;
        break;
      case '?':
        regex += '.';
        break;
      case '[':
      case ']':
        regex += c;
        break;
      case '{':
        inGroup = true;
        regex += '(';
        break;
      case '}':
        inGroup = false;
        regex += ')';
        break;
      case ',':
        if (inGroup) {
          regex += '|';
        } else {
          regex += '\\,';
        }
        break;
      case '*':
        const prevChar = pattern[i - 1];
        let starCount = 1;
        while (pattern[i + 1] === '*') {
          starCount++;
          i++;
        }
        const nextChar = pattern[i + 1];
        const isGlobstar = starCount > 1 &&
          (prevChar === '/' || prevChar === undefined) &&
          (nextChar === '/' || nextChar === undefined);

        if (isGlobstar) {
          regex += '((?:[^/\\\\]*(?:/\\\\|\$))*)';
          if (nextChar === '/') {
            i++;
          }
        } else {
          regex += '([^/\\\\]*)';
        }
        break;
      default:
        regex += c;
    }
  }

  return new RegExp('^' + regex + '$', 'i');
}

export function matchGlob(path: string, pattern: string, options: MatchOptions = {}): boolean {
  const { dot = false, nocase = true } = options;

  // Handle dotfiles
  if (!dot && basename(path).startsWith('.')) {
    return false;
  }

  const regex = globToRegex(pattern);
  if (nocase) {
    return regex.test(path) || regex.test(path.toLowerCase());
  }
  return regex.test(path);
}

export function matchAnyGlob(path: string, patterns: string[], options: MatchOptions = {}): boolean {
  return patterns.some(pattern => matchGlob(path, pattern, options));
}

export function matchAllGlobs(path: string, patterns: string[], options: MatchOptions = {}): boolean {
  return patterns.every(pattern => matchGlob(path, pattern, options));
}

// ============================================================================
// Path Templates
// ============================================================================

export interface PathTemplate {
  template: string;
  variables: string[];
}

export function parseTemplate(template: string): PathTemplate {
  const variableRegex = /\{(\w+)\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variableRegex.exec(template)) !== null) {
    variables.push(match[1]);
  }

  return { template, variables };
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

export function createPathTemplate(
  template: string
): (variables: Record<string, string>) => string {
  return (variables: Record<string, string>) => renderTemplate(template, variables);
}

// ============================================================================
// URL Path Helpers
// ============================================================================

export function toFileUrl(path: string): string {
  const absolute = resolve(path);
  const posixPath = toPosix(absolute);
  return 'file://' + (posixPath.startsWith('/') ? '' : '/') + posixPath;
}

export function fromFileUrl(url: string): string {
  if (!url.startsWith('file://')) {
    throw new Error('Not a file URL');
  }
  return url.slice(7); // Remove 'file://'
}

export function joinUrlPaths(...paths: string[]): string {
  return paths
    .map(p => p.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function normalizeUrlPath(path: string): string {
  return '/' + path
    .split('/')
    .filter(Boolean)
    .join('/');
}

// ============================================================================
// Constants
// ============================================================================

export const sep = pathSep;
export const delimiter = pathDelimiter;
export const posixPath = posix;
export const win32Path = win32;

// ============================================================================
// Default Export
// ============================================================================

export default {
  normalize,
  join,
  resolve,
  relative,
  dirname,
  basename,
  extname,
  isAbsolute,
  parse,
  format,
  sep,
  delimiter,
  isWindows,
  isPosix,
  toPosix,
  toWindows,
  toPlatform,
  getPathInfo,
  getCommonAncestor,
  getRelativeDepth,
  isDescendant,
  isAncestor,
  isSamePath,
  isSubPath,
  addExt,
  removeExt,
  changeExt,
  ensureExt,
  removeTrailingSep,
  ensureTrailingSep,
  removeLeadingSep,
  ensureLeadingSep,
  truncatePath,
  shortenPath,
  getFilename,
  getParentDir,
  getRoot,
  getSegments,
  getLastSegment,
  getFirstSegment,
  getDepth,
  isValidPath,
  isValidFilename,
  sanitizeFilename,
  globToRegex,
  matchGlob,
  matchAnyGlob,
  matchAllGlobs,
  parseTemplate,
  renderTemplate,
  createPathTemplate,
  toFileUrl,
  fromFileUrl,
  joinUrlPaths,
  normalizeUrlPath,
};
