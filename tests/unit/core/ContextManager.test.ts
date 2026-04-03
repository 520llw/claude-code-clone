/**
 * ContextManager Tests
 * 
 * Comprehensive test suite for the ContextManager class which handles
 * conversation context, file context, and context window management.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MockFS } from '../../mocks/MockFS';

// Context types
interface FileContext {
  path: string;
  content: string;
  language?: string;
  isOpen: boolean;
  lastAccessed: number;
}

interface ContextEntry {
  type: 'file' | 'message' | 'system' | 'tool_result';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  tokens: number;
}

interface ContextWindow {
  entries: ContextEntry[];
  totalTokens: number;
  maxTokens: number;
}

interface ContextManagerConfig {
  maxContextTokens: number;
  maxFileTokens: number;
  fileContextLimit: number;
  workingDirectory: string;
}

// ContextManager implementation
class ContextManager {
  private config: ContextManagerConfig;
  private mockFS: MockFS;
  private fileContexts: Map<string, FileContext> = new Map();
  private contextHistory: ContextEntry[] = [];
  private systemContext: string = '';
  private openFiles: Set<string> = new Set();

  constructor(config: Partial<ContextManagerConfig> = {}, mockFS: MockFS) {
    this.config = {
      maxContextTokens: 100000,
      maxFileTokens: 10000,
      fileContextLimit: 10,
      workingDirectory: '/',
      ...config,
    };
    this.mockFS = mockFS;
  }

  /**
   * Set system context/prompt
   */
  setSystemContext(context: string): void {
    this.systemContext = context;
  }

  /**
   * Get system context
   */
  getSystemContext(): string {
    return this.systemContext;
  }

  /**
   * Add a file to context
   */
  async addFile(path: string, options?: { autoOpen?: boolean }): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);

    if (this.fileContexts.has(normalizedPath)) {
      // Update existing context
      const existing = this.fileContexts.get(normalizedPath)!;
      existing.lastAccessed = Date.now();
      if (options?.autoOpen) {
        existing.isOpen = true;
        this.openFiles.add(normalizedPath);
      }
      return true;
    }

    try {
      const content = this.mockFS.readFileSync(normalizedPath, 'utf-8') as string;
      const tokens = this.estimateTokens(content);

      if (tokens > this.config.maxFileTokens) {
        return false;
      }

      const fileContext: FileContext = {
        path: normalizedPath,
        content,
        language: this.detectLanguage(normalizedPath),
        isOpen: options?.autoOpen ?? false,
        lastAccessed: Date.now(),
      };

      this.fileContexts.set(normalizedPath, fileContext);

      if (options?.autoOpen) {
        this.openFiles.add(normalizedPath);
      }

      // Add to context history
      this.contextHistory.push({
        type: 'file',
        content: `File: ${normalizedPath}\n\`\`\`${fileContext.language}\n${content}\n\`\`\``,
        metadata: { path: normalizedPath, tokens },
        timestamp: Date.now(),
        tokens,
      });

      this.enforceFileLimit();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove a file from context
   */
  removeFile(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const existed = this.fileContexts.delete(normalizedPath);
    this.openFiles.delete(normalizedPath);
    return existed;
  }

  /**
   * Open a file for editing
   */
  openFile(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const fileContext = this.fileContexts.get(normalizedPath);

    if (!fileContext) {
      return false;
    }

    fileContext.isOpen = true;
    fileContext.lastAccessed = Date.now();
    this.openFiles.add(normalizedPath);
    return true;
  }

  /**
   * Close a file
   */
  closeFile(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const fileContext = this.fileContexts.get(normalizedPath);

    if (!fileContext) {
      return false;
    }

    fileContext.isOpen = false;
    this.openFiles.delete(normalizedPath);
    return true;
  }

  /**
   * Get open files
   */
  getOpenFiles(): FileContext[] {
    return Array.from(this.openFiles)
      .map(path => this.fileContexts.get(path)!)
      .filter(Boolean)
      .sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  /**
   * Get all file contexts
   */
  getAllFiles(): FileContext[] {
    return Array.from(this.fileContexts.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  /**
   * Update file content
   */
  updateFileContent(path: string, newContent: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const fileContext = this.fileContexts.get(normalizedPath);

    if (!fileContext) {
      return false;
    }

    fileContext.content = newContent;
    fileContext.lastAccessed = Date.now();

    // Update context history entry
    const historyEntry = this.contextHistory.find(
      e => e.type === 'file' && e.metadata?.path === normalizedPath
    );
    if (historyEntry) {
      historyEntry.content = `File: ${normalizedPath}\n\`\`\`${fileContext.language}\n${newContent}\n\`\`\``;
      historyEntry.tokens = this.estimateTokens(newContent);
    }

    return true;
  }

  /**
   * Add a message to context
   */
  addMessage(role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>): void {
    const tokens = this.estimateTokens(content);

    this.contextHistory.push({
      type: 'message',
      content: `${role}: ${content}`,
      metadata,
      timestamp: Date.now(),
      tokens,
    });

    this.enforceContextLimit();
  }

  /**
   * Add a tool result to context
   */
  addToolResult(toolName: string, result: unknown): void {
    const content = JSON.stringify(result, null, 2);
    const tokens = this.estimateTokens(content);

    this.contextHistory.push({
      type: 'tool_result',
      content: `Tool (${toolName}): ${content}`,
      metadata: { toolName, result },
      timestamp: Date.now(),
      tokens,
    });

    this.enforceContextLimit();
  }

  /**
   * Build the context window for LLM
   */
  buildContextWindow(): ContextWindow {
    const entries: ContextEntry[] = [];
    let totalTokens = 0;

    // Add system context first
    if (this.systemContext) {
      const systemTokens = this.estimateTokens(this.systemContext);
      entries.push({
        type: 'system',
        content: this.systemContext,
        timestamp: 0,
        tokens: systemTokens,
      });
      totalTokens += systemTokens;
    }

    // Add open files
    for (const file of this.getOpenFiles()) {
      const content = `File: ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
      const tokens = this.estimateTokens(content);

      if (totalTokens + tokens <= this.config.maxContextTokens) {
        entries.push({
          type: 'file',
          content,
          metadata: { path: file.path },
          timestamp: file.lastAccessed,
          tokens,
        });
        totalTokens += tokens;
      }
    }

    // Add recent messages and tool results
    const recentHistory = [...this.contextHistory]
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const entry of recentHistory) {
      if (totalTokens + entry.tokens <= this.config.maxContextTokens) {
        entries.push(entry);
        totalTokens += entry.tokens;
      } else {
        break;
      }
    }

    return {
      entries,
      totalTokens,
      maxTokens: this.config.maxContextTokens,
    };
  }

  /**
   * Get context statistics
   */
  getStats(): {
    totalFiles: number;
    openFiles: number;
    totalMessages: number;
    totalTokens: number;
    maxTokens: number;
  } {
    const window = this.buildContextWindow();

    return {
      totalFiles: this.fileContexts.size,
      openFiles: this.openFiles.size,
      totalMessages: this.contextHistory.filter(e => e.type === 'message').length,
      totalTokens: window.totalTokens,
      maxTokens: this.config.maxContextTokens,
    };
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.fileContexts.clear();
    this.openFiles.clear();
    this.contextHistory = [];
    this.systemContext = '';
  }

  /**
   * Search within context
   */
  search(query: string): ContextEntry[] {
    const regex = new RegExp(query, 'gi');
    return this.contextHistory.filter(entry => regex.test(entry.content));
  }

  /**
   * Get context history
   */
  getHistory(): ContextEntry[] {
    return [...this.contextHistory];
  }

  private normalizePath(path: string): string {
    return path.startsWith('/') ? path : `${this.config.workingDirectory}/${path}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private detectLanguage(path: string): string | undefined {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
    };
    return languageMap[ext || ''];
  }

  private enforceFileLimit(): void {
    if (this.fileContexts.size > this.config.fileContextLimit) {
      const sorted = Array.from(this.fileContexts.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toRemove = sorted.slice(0, sorted.length - this.config.fileContextLimit);
      for (const [path] of toRemove) {
        this.fileContexts.delete(path);
        this.openFiles.delete(path);
      }
    }
  }

  private enforceContextLimit(): void {
    let totalTokens = this.contextHistory.reduce((sum, e) => sum + e.tokens, 0);

    while (totalTokens > this.config.maxContextTokens && this.contextHistory.length > 0) {
      const removed = this.contextHistory.shift()!;
      totalTokens -= removed.tokens;
    }
  }
}

describe('ContextManager', () => {
  let mockFS: MockFS;
  let contextManager: ContextManager;

  const defaultConfig: ContextManagerConfig = {
    maxContextTokens: 10000,
    maxFileTokens: 5000,
    fileContextLimit: 5,
    workingDirectory: '/test',
  };

  beforeEach(() => {
    mockFS = new MockFS();
    contextManager = new ContextManager(defaultConfig, mockFS);
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const cm = new ContextManager({}, mockFS);
      expect(cm).toBeDefined();
    });

    it('should accept custom config', () => {
      const cm = new ContextManager(
        { maxContextTokens: 5000, workingDirectory: '/project' },
        mockFS
      );
      expect(cm).toBeDefined();
    });
  });

  describe('System Context', () => {
    it('should set and get system context', () => {
      const systemPrompt = 'You are a helpful coding assistant.';
      contextManager.setSystemContext(systemPrompt);
      expect(contextManager.getSystemContext()).toBe(systemPrompt);
    });

    it('should include system context in window', () => {
      contextManager.setSystemContext('System prompt');
      const window = contextManager.buildContextWindow();
      
      expect(window.entries.some(e => e.type === 'system')).toBe(true);
    });

    it('should handle empty system context', () => {
      const window = contextManager.buildContextWindow();
      expect(window.entries.some(e => e.type === 'system')).toBe(false);
    });
  });

  describe('File Management', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/test/file1.ts', 'const x = 1;');
      mockFS.writeFileSync('/test/file2.js', 'const y = 2;');
    });

    it('should add a file to context', async () => {
      const result = await contextManager.addFile('/test/file1.ts');
      expect(result).toBe(true);
    });

    it('should add file with auto-open option', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const openFiles = contextManager.getOpenFiles();
      expect(openFiles).toHaveLength(1);
      expect(openFiles[0].path).toBe('/test/file1.ts');
    });

    it('should detect file language', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const files = contextManager.getAllFiles();
      expect(files[0].language).toBe('typescript');
    });

    it('should handle non-existent files', async () => {
      const result = await contextManager.addFile('/test/nonexistent.ts');
      expect(result).toBe(false);
    });

    it('should update file access time on re-add', async () => {
      await contextManager.addFile('/test/file1.ts');
      const before = Date.now();
      await new Promise(r => setTimeout(r, 10));
      await contextManager.addFile('/test/file1.ts');
      
      const files = contextManager.getAllFiles();
      expect(files[0].lastAccessed).toBeGreaterThanOrEqual(before);
    });

    it('should remove a file from context', async () => {
      await contextManager.addFile('/test/file1.ts');
      const removed = contextManager.removeFile('/test/file1.ts');
      expect(removed).toBe(true);
      expect(contextManager.getAllFiles()).toHaveLength(0);
    });

    it('should return false when removing non-existent file', () => {
      const removed = contextManager.removeFile('/test/nonexistent.ts');
      expect(removed).toBe(false);
    });

    it('should open a file', async () => {
      await contextManager.addFile('/test/file1.ts');
      const opened = contextManager.openFile('/test/file1.ts');
      expect(opened).toBe(true);
      expect(contextManager.getOpenFiles()).toHaveLength(1);
    });

    it('should return false when opening non-existent file', () => {
      const opened = contextManager.openFile('/test/nonexistent.ts');
      expect(opened).toBe(false);
    });

    it('should close a file', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const closed = contextManager.closeFile('/test/file1.ts');
      expect(closed).toBe(true);
      expect(contextManager.getOpenFiles()).toHaveLength(0);
    });

    it('should return false when closing non-existent file', () => {
      const closed = contextManager.closeFile('/test/nonexistent.ts');
      expect(closed).toBe(false);
    });

    it('should update file content', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const updated = contextManager.updateFileContent('/test/file1.ts', 'const z = 3;');
      expect(updated).toBe(true);
      
      const files = contextManager.getAllFiles();
      expect(files[0].content).toBe('const z = 3;');
    });

    it('should return false when updating non-existent file', () => {
      const updated = contextManager.updateFileContent('/test/nonexistent.ts', 'content');
      expect(updated).toBe(false);
    });

    it('should enforce file limit', async () => {
      const cm = new ContextManager({ fileContextLimit: 2 }, mockFS);
      
      mockFS.writeFileSync('/test/file3.py', 'x = 1');
      mockFS.writeFileSync('/test/file4.rs', 'let x = 1;');
      mockFS.writeFileSync('/test/file5.go', 'var x = 1');

      await cm.addFile('/test/file1.ts');
      await new Promise(r => setTimeout(r, 10));
      await cm.addFile('/test/file2.js');
      await new Promise(r => setTimeout(r, 10));
      await cm.addFile('/test/file3.py');

      expect(cm.getAllFiles()).toHaveLength(2);
    });

    it('should reject files exceeding token limit', async () => {
      mockFS.writeFileSync('/test/large.ts', 'x'.repeat(25000));
      const result = await contextManager.addFile('/test/large.ts');
      expect(result).toBe(false);
    });
  });

  describe('Message Management', () => {
    it('should add user message', () => {
      contextManager.addMessage('user', 'Hello');
      const history = contextManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('message');
    });

    it('should add assistant message', () => {
      contextManager.addMessage('assistant', 'Hi there!');
      const history = contextManager.getHistory();
      expect(history[0].content).toContain('assistant:');
    });

    it('should add message with metadata', () => {
      contextManager.addMessage('user', 'Test', { id: 'msg-1' });
      const history = contextManager.getHistory();
      expect(history[0].metadata).toEqual({ id: 'msg-1' });
    });

    it('should estimate tokens for messages', () => {
      contextManager.addMessage('user', 'Hello world');
      const history = contextManager.getHistory();
      expect(history[0].tokens).toBeGreaterThan(0);
    });
  });

  describe('Tool Results', () => {
    it('should add tool result', () => {
      contextManager.addToolResult('read_file', { success: true, content: 'test' });
      const history = contextManager.getHistory();
      expect(history[0].type).toBe('tool_result');
    });

    it('should include tool name in content', () => {
      contextManager.addToolResult('write_file', { success: true });
      const history = contextManager.getHistory();
      expect(history[0].content).toContain('write_file');
    });
  });

  describe('Context Window', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/test/file1.ts', 'const x = 1;');
      contextManager.setSystemContext('System prompt');
    });

    it('should build context window', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      contextManager.addMessage('user', 'Hello');
      
      const window = contextManager.buildContextWindow();
      expect(window.entries.length).toBeGreaterThan(0);
    });

    it('should include system context first', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const window = contextManager.buildContextWindow();
      expect(window.entries[0].type).toBe('system');
    });

    it('should include open files', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      const window = contextManager.buildContextWindow();
      expect(window.entries.some(e => e.type === 'file')).toBe(true);
    });

    it('should track total tokens', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      contextManager.addMessage('user', 'Hello');
      
      const window = contextManager.buildContextWindow();
      expect(window.totalTokens).toBeGreaterThan(0);
    });

    it('should respect max tokens limit', async () => {
      const cm = new ContextManager({ maxContextTokens: 50 }, mockFS);
      cm.setSystemContext('This is a long system prompt that takes up tokens');
      
      const window = cm.buildContextWindow();
      expect(window.totalTokens).toBeLessThanOrEqual(50);
    });
  });

  describe('Context Statistics', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/test/file1.ts', 'const x = 1;');
    });

    it('should return stats', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      contextManager.addMessage('user', 'Hello');
      
      const stats = contextManager.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.openFiles).toBe(1);
      expect(stats.totalMessages).toBe(1);
    });

    it('should track token usage', async () => {
      await contextManager.addFile('/test/file1.ts');
      const stats = contextManager.getStats();
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.maxTokens).toBe(defaultConfig.maxContextTokens);
    });
  });

  describe('Context Search', () => {
    it('should search context history', () => {
      contextManager.addMessage('user', 'Hello world');
      contextManager.addMessage('assistant', 'Goodbye world');
      
      const results = contextManager.search('world');
      expect(results).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      contextManager.addMessage('user', 'HELLO');
      const results = contextManager.search('hello');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      contextManager.addMessage('user', 'Hello');
      const results = contextManager.search('xyz');
      expect(results).toHaveLength(0);
    });
  });

  describe('Clear Context', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/test/file1.ts', 'const x = 1;');
    });

    it('should clear all context', async () => {
      await contextManager.addFile('/test/file1.ts', { autoOpen: true });
      contextManager.addMessage('user', 'Hello');
      contextManager.setSystemContext('System');
      
      contextManager.clear();
      
      expect(contextManager.getAllFiles()).toHaveLength(0);
      expect(contextManager.getOpenFiles()).toHaveLength(0);
      expect(contextManager.getHistory()).toHaveLength(0);
      expect(contextManager.getSystemContext()).toBe('');
    });
  });

  describe('Language Detection', () => {
    const testCases = [
      { path: '/test/file.ts', expected: 'typescript' },
      { path: '/test/file.tsx', expected: 'tsx' },
      { path: '/test/file.js', expected: 'javascript' },
      { path: '/test/file.py', expected: 'python' },
      { path: '/test/file.java', expected: 'java' },
      { path: '/test/file.go', expected: 'go' },
      { path: '/test/file.rs', expected: 'rust' },
      { path: '/test/file.md', expected: 'markdown' },
      { path: '/test/file.json', expected: 'json' },
      { path: '/test/file', expected: undefined },
    ];

    testCases.forEach(({ path, expected }) => {
      it(`should detect ${expected || 'no'} language for ${path}`, async () => {
        mockFS.writeFileSync(path, 'content');
        await contextManager.addFile(path);
        const files = contextManager.getAllFiles();
        expect(files[0].language).toBe(expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', () => {
      contextManager.addMessage('user', '');
      const history = contextManager.getHistory();
      expect(history).toHaveLength(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      contextManager.addMessage('user', longMessage);
      const history = contextManager.getHistory();
      expect(history[0].tokens).toBeGreaterThan(0);
    });

    it('should handle special characters in content', () => {
      contextManager.addMessage('user', 'Hello \n\t\r "quoted" \'single\'');
      const history = contextManager.getHistory();
      expect(history[0].content).toContain('Hello');
    });

    it('should handle concurrent modifications', async () => {
      mockFS.writeFileSync('/test/file1.ts', 'const x = 1;');
      mockFS.writeFileSync('/test/file2.ts', 'const y = 2;');

      await Promise.all([
        contextManager.addFile('/test/file1.ts'),
        contextManager.addFile('/test/file2.ts'),
      ]);

      expect(contextManager.getAllFiles().length).toBeGreaterThanOrEqual(1);
    });
  });
});
