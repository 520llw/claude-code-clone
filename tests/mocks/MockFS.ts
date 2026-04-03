/**
 * MockFS - Mock filesystem implementation for testing
 * 
 * Provides an in-memory filesystem that mimics Node.js fs module behavior
 * without touching the actual filesystem.
 */

export interface MockFileEntry {
  type: 'file' | 'directory';
  content?: string | Buffer;
  mode?: number;
  birthtime?: Date;
  mtime?: Date;
  atime?: Date;
}

export interface MockStats {
  size: number;
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
  birthtime: Date;
  mtime: Date;
  atime: Date;
  mode: number;
}

export class MockFSError extends Error {
  code: string;
  path?: string;
  syscall?: string;

  constructor(message: string, code: string, path?: string, syscall?: string) {
    super(message);
    this.name = 'MockFSError';
    this.code = code;
    this.path = path;
    this.syscall = syscall;
  }
}

/**
 * Mock filesystem implementation
 */
export class MockFS {
  private files: Map<string, MockFileEntry> = new Map();
  private watchers: Array<{ path: string; callback: (event: string, filename: string) => void }> = [];

  constructor() {
    this.reset();
  }

  /**
   * Reset the filesystem to initial state
   */
  reset(): void {
    this.files.clear();
    this.watchers = [];
    // Create root directory
    this.files.set('/', {
      type: 'directory',
      mode: 0o755,
      birthtime: new Date(),
      mtime: new Date(),
      atime: new Date(),
    });
  }

  // ============================================================================
  // Synchronous Methods
  // ============================================================================

  /**
   * Read file synchronously
   */
  readFileSync(path: string, encoding?: BufferEncoding | null): string | Buffer {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, open '${path}'`,
        'ENOENT',
        path,
        'open'
      );
    }

    if (entry.type === 'directory') {
      throw new MockFSError(
        `EISDIR: illegal operation on a directory, read`,
        'EISDIR',
        path,
        'read'
      );
    }

    entry.atime = new Date();

    if (encoding === null || encoding === undefined) {
      return Buffer.from(entry.content || '');
    }

    return (entry.content || '').toString();
  }

  /**
   * Write file synchronously
   */
  writeFileSync(path: string, data: string | Buffer, options?: { encoding?: BufferEncoding; mode?: number }): void {
    const normalizedPath = this.normalizePath(path);
    const dir = this.getDirectory(normalizedPath);

    if (dir && dir.type !== 'directory') {
      throw new MockFSError(
        `ENOTDIR: not a directory, open '${path}'`,
        'ENOTDIR',
        path,
        'open'
      );
    }

    // Ensure parent directory exists
    const parentDir = this.getParentDirectory(normalizedPath);
    if (!this.files.has(parentDir)) {
      throw new MockFSError(
        `ENOENT: no such file or directory, open '${path}'`,
        'ENOENT',
        path,
        'open'
      );
    }

    const content = Buffer.isBuffer(data) ? data.toString() : data;
    const now = new Date();

    this.files.set(normalizedPath, {
      type: 'file',
      content,
      mode: options?.mode || 0o644,
      birthtime: this.files.get(normalizedPath)?.birthtime || now,
      mtime: now,
      atime: now,
    });

    this.notifyWatchers('change', normalizedPath);
  }

  /**
   * Check if path exists
   */
  existsSync(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath);
  }

  /**
   * Get file stats
   */
  statSync(path: string): MockStats {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, stat '${path}'`,
        'ENOENT',
        path,
        'stat'
      );
    }

    return this.createStats(entry);
  }

  /**
   * Read directory contents
   */
  readdirSync(path: string): string[] {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, scandir '${path}'`,
        'ENOENT',
        path,
        'scandir'
      );
    }

    if (entry.type !== 'directory') {
      throw new MockFSError(
        `ENOTDIR: not a directory, scandir '${path}'`,
        'ENOTDIR',
        path,
        'scandir'
      );
    }

    const entries: string[] = [];
    const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

    for (const [filePath, fileEntry] of this.files) {
      if (filePath === normalizedPath) continue;
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        // Only include direct children
        if (!relativePath.includes('/')) {
          entries.push(relativePath);
        }
      }
    }

    entry.atime = new Date();
    return entries;
  }

  /**
   * Create directory
   */
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void {
    const normalizedPath = this.normalizePath(path);

    if (this.files.has(normalizedPath)) {
      const entry = this.files.get(normalizedPath);
      if (entry?.type === 'directory') {
        if (!options?.recursive) {
          throw new MockFSError(
            `EEXIST: file already exists, mkdir '${path}'`,
            'EEXIST',
            path,
            'mkdir'
          );
        }
        return;
      }
      throw new MockFSError(
        `EEXIST: file already exists, mkdir '${path}'`,
        'EEXIST',
        path,
        'mkdir'
      );
    }

    // Check parent directory exists or create recursively
    const parentDir = this.getParentDirectory(normalizedPath);
    if (!this.files.has(parentDir)) {
      if (options?.recursive) {
        this.mkdirSync(parentDir, options);
      } else {
        throw new MockFSError(
          `ENOENT: no such file or directory, mkdir '${path}'`,
          'ENOENT',
          path,
          'mkdir'
        );
      }
    }

    const now = new Date();
    this.files.set(normalizedPath, {
      type: 'directory',
      mode: options?.mode || 0o755,
      birthtime: now,
      mtime: now,
      atime: now,
    });

    this.notifyWatchers('rename', normalizedPath);
  }

  /**
   * Delete file
   */
  unlinkSync(path: string): void {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, unlink '${path}'`,
        'ENOENT',
        path,
        'unlink'
      );
    }

    if (entry.type === 'directory') {
      throw new MockFSError(
        `EISDIR: illegal operation on a directory, unlink '${path}'`,
        'EISDIR',
        path,
        'unlink'
      );
    }

    this.files.delete(normalizedPath);
    this.notifyWatchers('rename', normalizedPath);
  }

  /**
   * Remove directory
   */
  rmdirSync(path: string): void {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, rmdir '${path}'`,
        'ENOENT',
        path,
        'rmdir'
      );
    }

    if (entry.type !== 'directory') {
      throw new MockFSError(
        `ENOTDIR: not a directory, rmdir '${path}'`,
        'ENOTDIR',
        path,
        'rmdir'
      );
    }

    // Check if directory is empty
    const entries = this.readdirSync(normalizedPath);
    if (entries.length > 0) {
      throw new MockFSError(
        `ENOTEMPTY: directory not empty, rmdir '${path}'`,
        'ENOTEMPTY',
        path,
        'rmdir'
      );
    }

    this.files.delete(normalizedPath);
    this.notifyWatchers('rename', normalizedPath);
  }

  /**
   * Copy file
   */
  copyFileSync(src: string, dest: string): void {
    const normalizedSrc = this.normalizePath(src);
    const normalizedDest = this.normalizePath(dest);

    const entry = this.files.get(normalizedSrc);
    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, copyfile '${src}'`,
        'ENOENT',
        src,
        'copyfile'
      );
    }

    if (entry.type === 'directory') {
      throw new MockFSError(
        `EISDIR: illegal operation on a directory, copyfile '${src}'`,
        'EISDIR',
        src,
        'copyfile'
      );
    }

    this.writeFileSync(normalizedDest, entry.content || '');
  }

  /**
   * Rename/move file or directory
   */
  renameSync(oldPath: string, newPath: string): void {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);

    const entry = this.files.get(normalizedOld);
    if (!entry) {
      throw new MockFSError(
        `ENOENT: no such file or directory, rename '${oldPath}'`,
        'ENOENT',
        oldPath,
        'rename'
      );
    }

    // Move all children if directory
    if (entry.type === 'directory') {
      const children: Array<[string, MockFileEntry]> = [];
      for (const [path, fileEntry] of this.files) {
        if (path.startsWith(normalizedOld + '/') || path === normalizedOld) {
          children.push([path, fileEntry]);
        }
      }

      for (const [path, fileEntry] of children) {
        const newChildPath = normalizedNew + path.slice(normalizedOld.length);
        this.files.delete(path);
        this.files.set(newChildPath, fileEntry);
      }
    } else {
      this.files.delete(normalizedOld);
      this.files.set(normalizedNew, entry);
    }

    this.notifyWatchers('rename', normalizedNew);
  }

  // ============================================================================
  // Asynchronous Methods
  // ============================================================================

  async readFile(path: string, encoding?: BufferEncoding | null): Promise<string | Buffer> {
    return this.readFileSync(path, encoding);
  }

  async writeFile(path: string, data: string | Buffer, options?: { encoding?: BufferEncoding }): Promise<void> {
    return this.writeFileSync(path, data, options);
  }

  async access(path: string): Promise<void> {
    if (!this.existsSync(path)) {
      throw new MockFSError(
        `ENOENT: no such file or directory, access '${path}'`,
        'ENOENT',
        path,
        'access'
      );
    }
  }

  async stat(path: string): Promise<MockStats> {
    return this.statSync(path);
  }

  async readdir(path: string): Promise<string[]> {
    return this.readdirSync(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void> {
    return this.mkdirSync(path, options);
  }

  async unlink(path: string): Promise<void> {
    return this.unlinkSync(path);
  }

  async rmdir(path: string): Promise<void> {
    return this.rmdirSync(path);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    return this.copyFileSync(src, dest);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return this.renameSync(oldPath, newPath);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Find files matching a pattern
   */
  findFiles(basePath: string, pattern: string): string[] {
    const normalizedBase = this.normalizePath(basePath);
    const regex = this.globToRegex(pattern);
    const results: string[] = [];

    for (const [path, entry] of this.files) {
      if (entry.type !== 'file') continue;
      if (path.startsWith(normalizedBase) || normalizedBase === '/') {
        const relativePath = normalizedBase === '/' 
          ? path 
          : path.slice(normalizedBase.length + 1);
        if (regex.test(relativePath) || regex.test(path.split('/').pop() || '')) {
          results.push(path);
        }
      }
    }

    return results;
  }

  /**
   * Get file content as string
   */
  getContent(path: string): string | undefined {
    const entry = this.files.get(this.normalizePath(path));
    if (entry?.type === 'file') {
      return entry.content?.toString();
    }
    return undefined;
  }

  /**
   * Set file content directly
   */
  setContent(path: string, content: string): void {
    this.writeFileSync(path, content);
  }

  /**
   * Create a directory structure from an object
   */
  createStructure(structure: Record<string, string | Record<string, unknown>>, basePath = ''): void {
    for (const [name, value] of Object.entries(structure)) {
      const fullPath = basePath ? `${basePath}/${name}` : name;
      
      if (typeof value === 'string') {
        // Ensure parent directory exists
        const parentDir = this.getParentDirectory(fullPath);
        if (!this.existsSync(parentDir)) {
          this.mkdirSync(parentDir, { recursive: true });
        }
        this.writeFileSync(fullPath, value);
      } else {
        this.mkdirSync(fullPath, { recursive: true });
        this.createStructure(value as Record<string, string>, fullPath);
      }
    }
  }

  /**
   * Get all files as a flat object
   */
  getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, entry] of this.files) {
      if (entry.type === 'file' && entry.content !== undefined) {
        result[path] = entry.content.toString();
      }
    }
    return result;
  }

  /**
   * Dump filesystem state for debugging
   */
  dump(): string {
    const lines: string[] = ['Filesystem State:'];
    const sortedPaths = Array.from(this.files.keys()).sort();
    
    for (const path of sortedPaths) {
      const entry = this.files.get(path);
      const icon = entry?.type === 'directory' ? '📁' : '📄';
      lines.push(`  ${icon} ${path}`);
    }
    
    return lines.join('\n');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private normalizePath(path: string): string {
    // Remove trailing slashes except for root
    let normalized = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    // Resolve . and ..
    const parts = normalized.split('/').filter(p => p && p !== '.');
    const resolved: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    
    return '/' + resolved.join('/');
  }

  private getParentDirectory(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.length === 0 ? '/' : '/' + parts.join('/');
  }

  private getDirectory(path: string): MockFileEntry | undefined {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
      return this.files.get('/');
    }
    
    // Check each parent directory
    let currentPath = '/';
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath === '/' ? `/${parts[i]}` : `${currentPath}/${parts[i]}`;
      const entry = this.files.get(currentPath);
      if (entry?.type !== 'directory' && i < parts.length - 1) {
        return entry;
      }
    }
    
    return undefined;
  }

  private createStats(entry: MockFileEntry): MockStats {
    const content = entry.content?.toString() || '';
    
    return {
      size: entry.type === 'file' ? Buffer.byteLength(content) : 0,
      isFile: () => entry.type === 'file',
      isDirectory: () => entry.type === 'directory',
      isSymbolicLink: () => false,
      birthtime: entry.birthtime || new Date(),
      mtime: entry.mtime || new Date(),
      atime: entry.atime || new Date(),
      mode: entry.mode || 0o644,
    };
  }

  private globToRegex(pattern: string): RegExp {
    // Simple glob to regex conversion
    const regexPattern = pattern
      .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<DOUBLESTAR>>>/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');
    
    return new RegExp(regexPattern);
  }

  private notifyWatchers(event: string, filename: string): void {
    for (const watcher of this.watchers) {
      if (filename.startsWith(watcher.path) || watcher.path === '/') {
        watcher.callback(event, filename);
      }
    }
  }

  /**
   * Watch a path for changes
   */
  watch(path: string, callback: (event: string, filename: string) => void): () => void {
    const watcher = { path: this.normalizePath(path), callback };
    this.watchers.push(watcher);
    
    return () => {
      const index = this.watchers.indexOf(watcher);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }
    };
  }
}

// Export singleton instance
export const mockFS = new MockFS();
