/**
 * MockTools - Mock implementations of all tools for testing
 * 
 * Provides mock implementations of file tools, search tools, execution tools,
 * and other utilities used by the Claude Code clone.
 */

import { MockFS } from './MockFS';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  id?: string;
}

export interface MockToolConfig {
  delay?: number;
  errorRate?: number;
  shouldLogCalls?: boolean;
}

/**
 * Mock File Tools
 */
export class MockFileTools {
  private mockFS: MockFS;
  private config: MockToolConfig;
  private callLog: Array<{ tool: string; args: Record<string, unknown>; result: ToolResult; timestamp: number }> = [];

  constructor(mockFS: MockFS, config: MockToolConfig = {}) {
    this.mockFS = mockFS;
    this.config = {
      delay: 0,
      errorRate: 0,
      shouldLogCalls: false,
      ...config,
    };
  }

  /**
   * Read file contents
   */
  async readFile(args: { path: string; encoding?: string }): Promise<ToolResult> {
    await this.simulateDelay();
    
    if (this.shouldError()) {
      return this.createErrorResult(`Failed to read file: ${args.path}`);
    }

    try {
      const content = this.mockFS.readFileSync(args.path, args.encoding || 'utf-8');
      const result = this.createSuccessResult(content as string);
      this.logCall('read_file', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Write file contents
   */
  async writeFile(args: { path: string; content: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to write file: ${args.path}`);
    }

    try {
      this.mockFS.writeFileSync(args.path, args.content);
      const result = this.createSuccessResult(`File written successfully: ${args.path}`);
      this.logCall('write_file', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Edit file contents
   */
  async editFile(args: { path: string; oldString: string; newString: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to edit file: ${args.path}`);
    }

    try {
      const content = this.mockFS.readFileSync(args.path, 'utf-8') as string;
      if (!content.includes(args.oldString)) {
        return this.createErrorResult(`Old string not found in file: ${args.path}`);
      }
      const newContent = content.replace(args.oldString, args.newString);
      this.mockFS.writeFileSync(args.path, newContent);
      const result = this.createSuccessResult(`File edited successfully: ${args.path}`);
      this.logCall('edit_file', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Create directory
   */
  async createDirectory(args: { path: string; recursive?: boolean }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to create directory: ${args.path}`);
    }

    try {
      this.mockFS.mkdirSync(args.path, { recursive: args.recursive ?? true });
      const result = this.createSuccessResult(`Directory created: ${args.path}`);
      this.logCall('create_directory', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(args: { path: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to list directory: ${args.path}`);
    }

    try {
      const entries = this.mockFS.readdirSync(args.path);
      const result = this.createSuccessResult(JSON.stringify(entries, null, 2));
      this.logCall('list_directory', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Delete file or directory
   */
  async deletePath(args: { path: string; recursive?: boolean }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to delete: ${args.path}`);
    }

    try {
      const stat = this.mockFS.statSync(args.path);
      if (stat.isDirectory()) {
        this.mockFS.rmdirSync(args.path);
      } else {
        this.mockFS.unlinkSync(args.path);
      }
      const result = this.createSuccessResult(`Deleted: ${args.path}`);
      this.logCall('delete_path', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Move/rename file or directory
   */
  async movePath(args: { source: string; destination: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to move: ${args.source}`);
    }

    try {
      this.mockFS.renameSync(args.source, args.destination);
      const result = this.createSuccessResult(`Moved: ${args.source} -> ${args.destination}`);
      this.logCall('move_path', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Search within file contents
   */
  async searchFiles(args: { path: string; regex: string; filePattern?: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to search files in: ${args.path}`);
    }

    try {
      const files = this.mockFS.findFiles(args.path, args.filePattern || '*');
      const regex = new RegExp(args.regex, 'g');
      const results: Array<{ file: string; matches: string[] }> = [];

      for (const file of files) {
        const content = this.mockFS.readFileSync(file, 'utf-8') as string;
        const matches = content.match(regex);
        if (matches) {
          results.push({ file, matches });
        }
      }

      const result = this.createSuccessResult(JSON.stringify(results, null, 2));
      this.logCall('search_files', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(args: { path: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Failed to get file info: ${args.path}`);
    }

    try {
      const stat = this.mockFS.statSync(args.path);
      const info = {
        path: args.path,
        size: stat.size,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        created: stat.birthtime,
        modified: stat.mtime,
        accessed: stat.atime,
      };
      const result = this.createSuccessResult(JSON.stringify(info, null, 2));
      this.logCall('get_file_info', args, result);
      return result;
    } catch (error: any) {
      return this.createErrorResult(error.message);
    }
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.delay! > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }

  private shouldError(): boolean {
    return Math.random() < (this.config.errorRate || 0);
  }

  private createSuccessResult(output: string, data?: unknown): ToolResult {
    return { success: true, output, data };
  }

  private createErrorResult(error: string): ToolResult {
    return { success: false, error };
  }

  private logCall(tool: string, args: Record<string, unknown>, result: ToolResult): void {
    if (this.config.shouldLogCalls) {
      this.callLog.push({ tool, args, result, timestamp: Date.now() });
    }
  }

  getCallLog(): Array<{ tool: string; args: Record<string, unknown>; result: ToolResult; timestamp: number }> {
    return [...this.callLog];
  }

  clearCallLog(): void {
    this.callLog = [];
  }
}

/**
 * Mock Search Tools
 */
export class MockSearchTools {
  private mockFS: MockFS;
  private config: MockToolConfig;
  private searchIndex: Map<string, string[]> = new Map();

  constructor(mockFS: MockFS, config: MockToolConfig = {}) {
    this.mockFS = mockFS;
    this.config = {
      delay: 0,
      errorRate: 0,
      shouldLogCalls: false,
      ...config,
    };
  }

  /**
   * Grep search in files
   */
  async grepSearch(args: { pattern: string; path?: string; include?: string; exclude?: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult('Grep search failed');
    }

    const path = args.path || '/';
    const files = this.mockFS.findFiles(path, args.include || '*');
    const regex = new RegExp(args.pattern, 'g');
    const results: Array<{ file: string; line: number; content: string }> = [];

    for (const file of files) {
      if (args.exclude && file.match(args.exclude)) continue;
      
      try {
        const content = this.mockFS.readFileSync(file, 'utf-8') as string;
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({ file, line: index + 1, content: line.trim() });
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return this.createSuccessResult(JSON.stringify(results, null, 2), { count: results.length });
  }

  /**
   * Find files by name pattern
   */
  async findFiles(args: { pattern: string; path?: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult('Find files failed');
    }

    const path = args.path || '/';
    const files = this.mockFS.findFiles(path, args.pattern);
    
    return this.createSuccessResult(JSON.stringify(files, null, 2), { count: files.length });
  }

  /**
   * Code symbol search (functions, classes, etc.)
   */
  async codeSymbolSearch(args: { symbol: string; path?: string; language?: string }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult('Code symbol search failed');
    }

    const path = args.path || '/';
    const pattern = args.language ? `*.${args.language}` : '*';
    const files = this.mockFS.findFiles(path, pattern);
    const results: Array<{ file: string; line: number; type: string; name: string }> = [];

    const symbolPatterns: Record<string, RegExp> = {
      function: new RegExp(`(function|const|let|var)\\s+${args.symbol}\\s*\\(|${args.symbol}\\s*\\(.*?\\)\\s*\\{`, 'g'),
      class: new RegExp(`class\\s+${args.symbol}`, 'g'),
      method: new RegExp(`${args.symbol}\\s*\\(`, 'g'),
    };

    for (const file of files) {
      try {
        const content = this.mockFS.readFileSync(file, 'utf-8') as string;
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          for (const [type, pattern] of Object.entries(symbolPatterns)) {
            if (pattern.test(line)) {
              results.push({ file, line: index + 1, type, name: args.symbol });
            }
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return this.createSuccessResult(JSON.stringify(results, null, 2), { count: results.length });
  }

  /**
   * Web search (mock implementation)
   */
  async webSearch(args: { query: string; numResults?: number }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult('Web search failed');
    }

    const mockResults = Array.from({ length: args.numResults || 5 }, (_, i) => ({
      title: `Result ${i + 1} for "${args.query}"`,
      url: `https://example.com/result-${i + 1}`,
      snippet: `This is a mock search result snippet for "${args.query}"...`,
    }));

    return this.createSuccessResult(JSON.stringify(mockResults, null, 2), { count: mockResults.length });
  }

  /**
   * Add to search index
   */
  addToIndex(key: string, content: string[]): void {
    this.searchIndex.set(key, content);
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.delay! > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }

  private shouldError(): boolean {
    return Math.random() < (this.config.errorRate || 0);
  }

  private createSuccessResult(output: string, metadata?: Record<string, unknown>): ToolResult {
    return { success: true, output, metadata };
  }

  private createErrorResult(error: string): ToolResult {
    return { success: false, error };
  }
}

/**
 * Mock Execution Tools
 */
export class MockExecutionTools {
  private config: MockToolConfig;
  private commandHistory: Array<{ command: string; output: string; exitCode: number; timestamp: number }> = [];
  private mockOutputs: Map<string, { output: string; exitCode: number }> = new Map();

  constructor(config: MockToolConfig = {}) {
    this.config = {
      delay: 0,
      errorRate: 0,
      shouldLogCalls: false,
      ...config,
    };
  }

  /**
   * Execute shell command
   */
  async executeCommand(args: { command: string; cwd?: string; timeout?: number; env?: Record<string, string> }): Promise<ToolResult> {
    await this.simulateDelay();

    if (this.shouldError()) {
      return this.createErrorResult(`Command failed: ${args.command}`, 1);
    }

    // Check for mock output
    const mockOutput = this.mockOutputs.get(args.command);
    const output = mockOutput?.output || `Mock output for: ${args.command}`;
    const exitCode = mockOutput?.exitCode ?? 0;

    this.commandHistory.push({
      command: args.command,
      output,
      exitCode,
      timestamp: Date.now(),
    });

    if (exitCode !== 0) {
      return this.createErrorResult(output, exitCode);
    }

    return this.createSuccessResult(output, { exitCode });
  }

  /**
   * Execute command with streaming output
   */
  async *streamCommand(args: { command: string; cwd?: string }): AsyncGenerator<{ type: 'stdout' | 'stderr'; data: string }> {
    await this.simulateDelay();

    const lines = [
      { type: 'stdout' as const, data: `Executing: ${args.command}` },
      { type: 'stdout' as const, data: 'Processing...' },
      { type: 'stdout' as const, data: 'Complete!' },
    ];

    for (const line of lines) {
      await this.simulateDelay();
      yield line;
    }
  }

  /**
   * Run npm/yarn/pnpm command
   */
  async runPackageCommand(args: { packageManager: 'npm' | 'yarn' | 'pnpm'; script: string; args?: string[] }): Promise<ToolResult> {
    const command = `${args.packageManager} ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command });
  }

  /**
   * Run Python script
   */
  async runPython(args: { script: string; args?: string[]; cwd?: string }): Promise<ToolResult> {
    const command = `python ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command, cwd: args.cwd });
  }

  /**
   * Run Node.js script
   */
  async runNode(args: { script: string; args?: string[]; cwd?: string }): Promise<ToolResult> {
    const command = `node ${args.script}${args.args ? ' ' + args.args.join(' ') : ''}`;
    return this.executeCommand({ command, cwd: args.cwd });
  }

  /**
   * Set mock output for a specific command
   */
  setMockOutput(command: string, output: string, exitCode = 0): void {
    this.mockOutputs.set(command, { output, exitCode });
  }

  /**
   * Get command history
   */
  getCommandHistory(): Array<{ command: string; output: string; exitCode: number; timestamp: number }> {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.mockOutputs.clear();
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.delay! > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }

  private shouldError(): boolean {
    return Math.random() < (this.config.errorRate || 0);
  }

  private createSuccessResult(output: string, metadata?: Record<string, unknown>): ToolResult {
    return { success: true, output, metadata };
  }

  private createErrorResult(error: string, exitCode = 1): ToolResult {
    return { success: false, error, metadata: { exitCode } };
  }
}

/**
 * Main MockTools class that aggregates all tool mocks
 */
export class MockTools {
  file: MockFileTools;
  search: MockSearchTools;
  execution: MockExecutionTools;

  constructor(mockFS: MockFS, config: MockToolConfig = {}) {
    this.file = new MockFileTools(mockFS, config);
    this.search = new MockSearchTools(mockFS, config);
    this.execution = new MockExecutionTools(config);
  }

  /**
   * Execute a tool call
   */
  async executeTool(call: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = call;

    switch (name) {
      // File tools
      case 'read_file':
        return this.file.readFile(args as { path: string; encoding?: string });
      case 'write_file':
        return this.file.writeFile(args as { path: string; content: string });
      case 'edit_file':
        return this.file.editFile(args as { path: string; oldString: string; newString: string });
      case 'create_directory':
        return this.file.createDirectory(args as { path: string; recursive?: boolean });
      case 'list_directory':
        return this.file.listDirectory(args as { path: string });
      case 'delete_path':
        return this.file.deletePath(args as { path: string; recursive?: boolean });
      case 'move_path':
        return this.file.movePath(args as { source: string; destination: string });
      case 'search_files':
        return this.file.searchFiles(args as { path: string; regex: string; filePattern?: string });
      case 'get_file_info':
        return this.file.getFileInfo(args as { path: string });

      // Search tools
      case 'grep_search':
        return this.search.grepSearch(args as { pattern: string; path?: string; include?: string; exclude?: string });
      case 'find_files':
        return this.search.findFiles(args as { pattern: string; path?: string });
      case 'code_symbol_search':
        return this.search.codeSymbolSearch(args as { symbol: string; path?: string; language?: string });
      case 'web_search':
        return this.search.webSearch(args as { query: string; numResults?: number });

      // Execution tools
      case 'execute_command':
        return this.execution.executeCommand(args as { command: string; cwd?: string; timeout?: number });
      case 'run_package_command':
        return this.execution.runPackageCommand(args as { packageManager: 'npm' | 'yarn' | 'pnpm'; script: string; args?: string[] });
      case 'run_python':
        return this.execution.runPython(args as { script: string; args?: string[]; cwd?: string });
      case 'run_node':
        return this.execution.runNode(args as { script: string; args?: string[]; cwd?: string });

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Reset all tool mocks
   */
  reset(): void {
    this.file.clearCallLog();
    this.execution.clearHistory();
  }
}
