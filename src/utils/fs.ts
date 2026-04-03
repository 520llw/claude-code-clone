/**
 * Filesystem Utilities Module
 * 
 * Provides comprehensive filesystem utilities including file operations,
 * directory management, file watching, and path operations.
 */

import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  appendFile as fsAppendFile,
  access as fsAccess,
  stat as fsStat,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  copyFile as fsCopyFile,
  unlink as fsUnlink,
  rmdir as fsRmdir,
  rename as fsRename,
  symlink as fsSymlink,
  readlink as fsReadlink,
  lstat as fsLstat,
  chmod as fsChmod,
  chown as fsChown,
  truncate as fsTruncate,
  watch as fsWatch,
  constants,
} from 'fs';
import { promisify } from 'util';
import { join, dirname, basename, extname, resolve, relative } from 'path';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';

// ============================================================================
// Promisified FS Functions
// ============================================================================

export const readFile = promisify(fsReadFile);
export const writeFile = promisify(fsWriteFile);
export const appendFile = promisify(fsAppendFile);
export const access = promisify(fsAccess);
export const stat = promisify(fsStat);
export const mkdir = promisify(fsMkdir);
export const readdir = promisify(fsReaddir);
export const copyFile = promisify(fsCopyFile);
export const unlink = promisify(fsUnlink);
export const rmdir = promisify(fsRmdir);
export const rename = promisify(fsRename);
export const symlink = promisify(fsSymlink);
export const readlink = promisify(fsReadlink);
export const lstat = promisify(fsLstat);
export const chmod = promisify(fsChmod);
export const chown = promisify(fsChown);
export const truncate = promisify(fsTruncate);

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  mode: number;
}

export interface DirectoryOptions {
  recursive?: boolean;
  mode?: number;
}

export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
  filter?: (src: string, dest: string) => boolean;
}

export interface RemoveOptions {
  recursive?: boolean;
  force?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface SearchOptions {
  pattern?: RegExp | string;
  recursive?: boolean;
  includeDirs?: boolean;
  includeFiles?: boolean;
  exclude?: string[];
}

export interface WatchOptions {
  recursive?: boolean;
  persistent?: boolean;
  encoding?: BufferEncoding;
}

export interface FileWatcher {
  on(event: 'change', listener: (path: string, stats?: FileInfo) => void): void;
  on(event: 'add', listener: (path: string, stats?: FileInfo) => void): void;
  on(event: 'unlink', listener: (path: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  close(): void;
}

// ============================================================================
// File Operations
// ============================================================================

export async function readTextFile(
  path: string,
  encoding: BufferEncoding = 'utf8'
): Promise<string> {
  return readFile(path, { encoding });
}

export async function readJsonFile<T = unknown>(path: string): Promise<T> {
  const content = await readTextFile(path);
  return JSON.parse(content) as T;
}

export async function writeTextFile(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  await ensureDir(dirname(path));
  return writeFile(path, content, { encoding });
}

export async function writeJsonFile(
  path: string,
  data: unknown,
  pretty: boolean = true
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeTextFile(path, content);
}

export async function appendTextFile(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  await ensureDir(dirname(path));
  return appendFile(path, content, { encoding });
}

export async function readLines(path: string): Promise<string[]> {
  const content = await readTextFile(path);
  return content.split(/\r?\n/);
}

export async function writeLines(path: string, lines: string[]): Promise<void> {
  const content = lines.join('\n');
  await writeTextFile(path, content);
}

export async function streamFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  await ensureDir(dirname(destinationPath));
  const source = createReadStream(sourcePath);
  const destination = createWriteStream(destinationPath);
  await pipeline(source, destination);
}

export async function getFileHash(
  path: string,
  algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(path);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function getFileInfo(path: string): Promise<FileInfo> {
  const stats = await stat(path);
  const lstats = await lstat(path);

  return {
    path: resolve(path),
    name: basename(path),
    size: stats.size,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    isSymbolicLink: lstats.isSymbolicLink(),
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    accessedAt: stats.atime,
    mode: stats.mode,
  };
}

// ============================================================================
// Directory Operations
// ============================================================================

export async function ensureDir(
  path: string,
  options: DirectoryOptions = {}
): Promise<void> {
  const { mode = 0o777 } = options;

  try {
    await mkdir(path, { recursive: true, mode });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function emptyDir(path: string): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });

  await Promise.all(
    entries.map(async entry => {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        await remove(entryPath, { recursive: true });
      } else {
        await unlink(entryPath);
      }
    })
  );
}

export async function copyDir(
  src: string,
  dest: string,
  options: CopyOptions = {}
): Promise<void> {
  const { overwrite = true, filter } = options;

  await ensureDir(dest);

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (filter && !filter(srcPath, destPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, options);
    } else {
      if (overwrite || !(await exists(destPath))) {
        await copyFile(srcPath, destPath);
      }
    }
  }
}

export async function* walkDir(
  path: string,
  options: SearchOptions = {}
): AsyncGenerator<string> {
  const { recursive = true, pattern, includeDirs = false, includeFiles = true, exclude = [] } = options;

  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(path, entry.name);

    // Check exclude patterns
    if (exclude.some(e => entryPath.includes(e))) {
      continue;
    }

    if (entry.isDirectory()) {
      if (includeDirs) {
        if (!pattern || matchesPattern(entry.name, pattern)) {
          yield entryPath;
        }
      }

      if (recursive) {
        yield* walkDir(entryPath, options);
      }
    } else if (entry.isFile() && includeFiles) {
      if (!pattern || matchesPattern(entry.name, pattern)) {
        yield entryPath;
      }
    }
  }
}

function matchesPattern(name: string, pattern: RegExp | string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(name);
  }
  return name.includes(pattern);
}

export async function listFiles(
  path: string,
  options: SearchOptions = {}
): Promise<string[]> {
  const files: string[] = [];
  for await (const file of walkDir(path, { ...options, includeFiles: true, includeDirs: false })) {
    files.push(file);
  }
  return files;
}

export async function listDirs(
  path: string,
  options: Omit<SearchOptions, 'includeDirs' | 'includeFiles'> = {}
): Promise<string[]> {
  const dirs: string[] = [];
  for await (const dir of walkDir(path, { ...options, includeDirs: true, includeFiles: false })) {
    dirs.push(dir);
  }
  return dirs;
}

// ============================================================================
// Remove Operations
// ============================================================================

export async function remove(
  path: string,
  options: RemoveOptions = {}
): Promise<void> {
  const { recursive = false, force = false, maxRetries = 3, retryDelay = 100 } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const stats = await stat(path);

      if (stats.isDirectory()) {
        if (recursive) {
          await removeDirRecursive(path);
        } else {
          await rmdir(path);
        }
      } else {
        await unlink(path);
      }

      return;
    } catch (error: unknown) {
      lastError = error as Error;
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOENT') {
        if (force) {
          return;
        }
        throw error;
      }

      if (attempt < maxRetries) {
        await delay(retryDelay * attempt);
      }
    }
  }

  throw lastError;
}

async function removeDirRecursive(path: string): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });

  await Promise.all(
    entries.map(async entry => {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        await removeDirRecursive(entryPath);
      } else {
        await unlink(entryPath);
      }
    })
  );

  await rmdir(path);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Path Predicates
// ============================================================================

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function isSymbolicLink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function isEmptyDir(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length === 0;
  } catch {
    return false;
  }
}

export async function isReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// File Watching
// ============================================================================

export function watch(
  path: string,
  options: WatchOptions = {}
): FileWatcher {
  const { recursive = false, persistent = true } = options;

  const watcher = fsWatch(path, { recursive, persistent });
  const eventEmitter = new EventTarget();

  watcher.on('change', (eventType, filename) => {
    if (typeof filename === 'string') {
      const fullPath = join(path, filename);
      getFileInfo(fullPath)
        .then(stats => {
          eventEmitter.dispatchEvent(
            new CustomEvent('change', { detail: { path: fullPath, stats } })
          );
        })
        .catch(() => {
          eventEmitter.dispatchEvent(
            new CustomEvent('unlink', { detail: { path: fullPath } })
          );
        });
    }
  });

  watcher.on('error', error => {
    eventEmitter.dispatchEvent(new CustomEvent('error', { detail: error }));
  });

  return {
    on(event: string, listener: (...args: unknown[]) => void): void {
      eventEmitter.addEventListener(event, (e: Event) => {
        const customEvent = e as CustomEvent;
        if (event === 'unlink') {
          listener(customEvent.detail.path);
        } else if (event === 'error') {
          listener(customEvent.detail);
        } else {
          listener(customEvent.detail.path, customEvent.detail.stats);
        }
      });
    },
    close(): void {
      watcher.close();
    },
  };
}

// ============================================================================
// Temp Files
// ============================================================================

export function getTempDir(): string {
  return process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
}

export function getTempFile(prefix: string = 'tmp'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return join(getTempDir(), `${prefix}-${timestamp}-${random}`);
}

export async function withTempFile<T>(
  fn: (path: string) => Promise<T>,
  options: { prefix?: string; suffix?: string } = {}
): Promise<T> {
  const { prefix = 'tmp', suffix = '' } = options;
  const tempPath = getTempFile(prefix) + suffix;

  try {
    return await fn(tempPath);
  } finally {
    try {
      await remove(tempPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function withTempDir<T>(
  fn: (path: string) => Promise<T>,
  options: { prefix?: string } = {}
): Promise<T> {
  const { prefix = 'tmp' } = options;
  const tempPath = getTempFile(prefix);
  await ensureDir(tempPath);

  try {
    return await fn(tempPath);
  } finally {
    try {
      await remove(tempPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// File Comparison
// ============================================================================

export async function areFilesEqual(
  path1: string,
  path2: string
): Promise<boolean> {
  const [hash1, hash2] = await Promise.all([
    getFileHash(path1),
    getFileHash(path2),
  ]);

  return hash1 === hash2;
}

export async function findDuplicates(
  paths: string[]
): Promise<string[][]> {
  const hashMap = new Map<string, string[]>();

  for (const path of paths) {
    const hash = await getFileHash(path);
    const existing = hashMap.get(hash) || [];
    existing.push(path);
    hashMap.set(hash, existing);
  }

  return Array.from(hashMap.values()).filter(group => group.length > 1);
}

// ============================================================================
// Disk Usage
// ============================================================================

export async function getDirSize(path: string): Promise<number> {
  let totalSize = 0;

  for await (const filePath of walkDir(path)) {
    const stats = await stat(filePath);
    totalSize += stats.size;
  }

  return totalSize;
}

export interface DiskUsage {
  total: number;
  free: number;
  used: number;
}

export async function getDiskUsage(path: string): Promise<DiskUsage> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const { stdout } = await execAsync(`df -k "${path}"`);
  const lines = stdout.trim().split('\n');
  const dataLine = lines[lines.length - 1];
  const parts = dataLine.split(/\s+/);

  const total = parseInt(parts[1], 10) * 1024;
  const used = parseInt(parts[2], 10) * 1024;
  const free = parseInt(parts[3], 10) * 1024;

  return { total, used, free };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  readFile,
  writeFile,
  appendFile,
  readTextFile,
  writeTextFile,
  readJsonFile,
  writeJsonFile,
  readLines,
  writeLines,
  ensureDir,
  emptyDir,
  copyDir,
  remove,
  walkDir,
  listFiles,
  listDirs,
  exists,
  isFile,
  isDirectory,
  isSymbolicLink,
  isEmptyDir,
  isReadable,
  isWritable,
  isExecutable,
  getFileInfo,
  getFileHash,
  streamFile,
  watch,
  getTempDir,
  getTempFile,
  withTempFile,
  withTempDir,
  areFilesEqual,
  findDuplicates,
  getDirSize,
  getDiskUsage,
};
