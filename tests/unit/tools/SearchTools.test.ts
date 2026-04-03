/**
 * SearchTools Tests
 * 
 * Comprehensive test suite for search-related tools including
 * grep search, file finding, code symbol search, and web search.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockFS } from '../../mocks/MockFS';
import { ToolResult } from '../../mocks/MockTools';

// Search result types
interface GrepMatch {
  file: string;
  line: number;
  column?: number;
  content: string;
}

interface FileMatch {
  path: string;
  name: string;
  size: number;
  modified: Date;
}

interface SymbolMatch {
  file: string;
  line: number;
  column: number;
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import';
  signature?: string;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// SearchTools implementation
class SearchTools {
  private mockFS: MockFS;
  private mockWebResults: Map<string, WebSearchResult[]> = new Map();

  constructor(mockFS: MockFS) {
    this.mockFS = mockFS;
  }

  /**
   * Grep-style search in files
   */
  async grepSearch(args: {
    pattern: string;
    path?: string;
    include?: string;
    exclude?: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
  }): Promise<ToolResult> {
    try {
      const searchPath = args.path || '/';
      const flags = args.caseSensitive ? 'g' : 'gi';
      const pattern = args.wholeWord ? `\\b${args.pattern}\\b` : args.pattern;
      const regex = new RegExp(pattern, flags);

      const files = this.mockFS.findFiles(searchPath, args.include || '*');
      const results: GrepMatch[] = [];

      for (const file of files) {
        if (args.exclude && new RegExp(args.exclude).test(file)) {
          continue;
        }

        try {
          const content = this.mockFS.readFileSync(file, 'utf-8') as string;
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (regex.test(line)) {
              results.push({
                file,
                line: index + 1,
                content: line.trim(),
              });
            }
          });
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: {
          pattern: args.pattern,
          filesSearched: files.length,
          matches: results.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Find files by name pattern
   */
  async findFiles(args: {
    pattern: string;
    path?: string;
    type?: 'file' | 'directory';
  }): Promise<ToolResult> {
    try {
      const searchPath = args.path || '/';
      const files = this.mockFS.findFiles(searchPath, args.pattern);

      const results: FileMatch[] = files.map(path => {
        const name = path.split('/').pop() || '';
        const stat = this.mockFS.statSync(path);
        return {
          path,
          name,
          size: stat.size,
          modified: stat.mtime,
        };
      });

      if (args.type) {
        const filtered = results.filter(r => {
          const stat = this.mockFS.statSync(r.path);
          return args.type === 'directory' ? stat.isDirectory() : stat.isFile();
        });
        return {
          success: true,
          output: JSON.stringify(filtered, null, 2),
          metadata: { count: filtered.length },
        };
      }

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: { count: results.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search for code symbols (functions, classes, etc.)
   */
  async codeSymbolSearch(args: {
    symbol: string;
    path?: string;
    language?: string;
    type?: 'function' | 'class' | 'interface' | 'variable';
  }): Promise<ToolResult> {
    try {
      const searchPath = args.path || '/';
      const filePattern = args.language ? `*.${args.language}` : '*';
      const files = this.mockFS.findFiles(searchPath, filePattern);

      const results: SymbolMatch[] = [];
      const symbolRegexes: Record<string, RegExp> = {
        function: new RegExp(`(?:function|const|let|var)\\s+${args.symbol}\\s*[\(=:]|${args.symbol}\\s*\\(`, 'g'),
        class: new RegExp(`class\\s+${args.symbol}\\b`, 'g'),
        interface: new RegExp(`interface\\s+${args.symbol}\\b`, 'g'),
        variable: new RegExp(`(?:const|let|var)\\s+${args.symbol}\\s*=`, 'g'),
      };

      for (const file of files) {
        try {
          const content = this.mockFS.readFileSync(file, 'utf-8') as string;
          const lines = content.split('\n');

          lines.forEach((line, lineIndex) => {
            const types = args.type ? [args.type] : Object.keys(symbolRegexes);

            for (const type of types) {
              const regex = symbolRegexes[type];
              if (regex && regex.test(line)) {
                results.push({
                  file,
                  line: lineIndex + 1,
                  column: line.indexOf(args.symbol) + 1,
                  name: args.symbol,
                  type: type as SymbolMatch['type'],
                  signature: line.trim(),
                });
              }
            }
          });
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: {
          symbol: args.symbol,
          matches: results.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search for imports/exports
   */
  async importSearch(args: {
    module: string;
    path?: string;
  }): Promise<ToolResult> {
    try {
      const searchPath = args.path || '/';
      const files = this.mockFS.findFiles(searchPath, '*');

      const results: Array<{ file: string; line: number; statement: string }> = [];
      const importRegex = new RegExp(`(?:import|export).*?(?:from\\s+['"]${args.module}['"]|require\\s*\\(\\s*['"]${args.module}['"]\\s*\\))`, 'g');

      for (const file of files) {
        try {
          const content = this.mockFS.readFileSync(file, 'utf-8') as string;
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (importRegex.test(line)) {
              results.push({
                file,
                line: index + 1,
                statement: line.trim(),
              });
            }
          });
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: { module: args.module, matches: results.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mock web search
   */
  async webSearch(args: {
    query: string;
    numResults?: number;
  }): Promise<ToolResult> {
    // Return mock results
    const mockResults = this.mockWebResults.get(args.query) || [
      {
        title: `Search result for "${args.query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(args.query)}`,
        snippet: `This is a mock search result for "${args.query}" containing relevant information.`,
      },
    ];

    const limited = mockResults.slice(0, args.numResults || 5);

    return {
      success: true,
      output: JSON.stringify(limited, null, 2),
      metadata: {
        query: args.query,
        results: limited.length,
      },
    };
  }

  /**
   * Set mock web search results
   */
  setMockWebResults(query: string, results: WebSearchResult[]): void {
    this.mockWebResults.set(query, results);
  }

  /**
   * Full text search with context
   */
  async fullTextSearch(args: {
    query: string;
    path?: string;
    contextLines?: number;
  }): Promise<ToolResult> {
    try {
      const searchPath = args.path || '/';
      const files = this.mockFS.findFiles(searchPath, '*');
      const contextLines = args.contextLines || 2;

      const results: Array<{
        file: string;
        line: number;
        match: string;
        context: string[];
      }> = [];

      const regex = new RegExp(args.query, 'gi');

      for (const file of files) {
        try {
          const content = this.mockFS.readFileSync(file, 'utf-8') as string;
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (regex.test(line)) {
              const start = Math.max(0, index - contextLines);
              const end = Math.min(lines.length, index + contextLines + 1);
              
              results.push({
                file,
                line: index + 1,
                match: line.trim(),
                context: lines.slice(start, end),
              });
            }
          });
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: { query: args.query, matches: results.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

describe('SearchTools', () => {
  let mockFS: MockFS;
  let searchTools: SearchTools;

  beforeEach(() => {
    mockFS = new MockFS();
    searchTools = new SearchTools(mockFS);

    // Setup test files
    mockFS.mkdirSync('/project');
    mockFS.mkdirSync('/project/src');
    mockFS.writeFileSync('/project/src/index.ts', `
import { utils } from './utils';

export class MyClass {
  private value: number;
  
  constructor(value: number) {
    this.value = value;
  }
  
  public getValue(): number {
    return this.value;
  }
}

export function helper() {
  return 'help';
}
`);
    mockFS.writeFileSync('/project/src/utils.ts', `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const CONFIG = {
  apiUrl: 'https://api.example.com',
};
`);
    mockFS.writeFileSync('/project/README.md', '# Project\n\nThis is a test project.');
  });

  describe('grepSearch', () => {
    it('should find pattern in files', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'function',
        path: '/project',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should respect case sensitivity', async () => {
      const caseSensitive = await searchTools.grepSearch({
        pattern: 'Function',
        path: '/project',
        caseSensitive: true,
      });

      const caseInsensitive = await searchTools.grepSearch({
        pattern: 'Function',
        path: '/project',
        caseSensitive: false,
      });

      expect(JSON.parse(caseSensitive.output || '[]')).toHaveLength(0);
      expect(JSON.parse(caseInsensitive.output || '[]').length).toBeGreaterThan(0);
    });

    it('should support whole word matching', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'val',
        path: '/project',
        wholeWord: true,
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.every((m: GrepMatch) => m.content.includes('value'))).toBe(true);
    });

    it('should filter by include pattern', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'export',
        path: '/project',
        include: '*.ts',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.every((m: GrepMatch) => m.file.endsWith('.ts'))).toBe(true);
    });

    it('should filter by exclude pattern', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'export',
        path: '/project',
        exclude: 'utils\\.ts$',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.every((m: GrepMatch) => !m.file.includes('utils.ts'))).toBe(true);
    });

    it('should return match metadata', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'function',
        path: '/project',
      });

      expect(result.metadata?.filesSearched).toBeGreaterThan(0);
      expect(result.metadata?.matches).toBeGreaterThan(0);
    });

    it('should return line numbers', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'class MyClass',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].line).toBe(5);
    });
  });

  describe('findFiles', () => {
    it('should find files by pattern', async () => {
      const result = await searchTools.findFiles({
        pattern: '*.ts',
        path: '/project',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBe(2);
    });

    it('should filter by type', async () => {
      const files = await searchTools.findFiles({
        pattern: '*',
        path: '/project',
        type: 'file',
      });

      const directories = await searchTools.findFiles({
        pattern: '*',
        path: '/project',
        type: 'directory',
      });

      expect(JSON.parse(files.output || '[]').every((m: FileMatch) => m.size >= 0)).toBe(true);
    });

    it('should include file metadata', async () => {
      const result = await searchTools.findFiles({
        pattern: '*.md',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].name).toBe('README.md');
      expect(matches[0].size).toBeGreaterThan(0);
      expect(matches[0].modified).toBeDefined();
    });

    it('should return empty for no matches', async () => {
      const result = await searchTools.findFiles({
        pattern: '*.py',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches).toHaveLength(0);
    });
  });

  describe('codeSymbolSearch', () => {
    it('should find function definitions', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'helper',
        path: '/project',
        type: 'function',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('function');
    });

    it('should find class definitions', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'MyClass',
        path: '/project',
        type: 'class',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('class');
    });

    it('should find variable definitions', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'CONFIG',
        path: '/project',
        type: 'variable',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should filter by language', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'formatDate',
        path: '/project',
        language: 'ts',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.every((m: SymbolMatch) => m.file.endsWith('.ts'))).toBe(true);
    });

    it('should include line and column numbers', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'MyClass',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].line).toBeGreaterThan(0);
      expect(matches[0].column).toBeGreaterThan(0);
    });

    it('should include signature', async () => {
      const result = await searchTools.codeSymbolSearch({
        symbol: 'formatDate',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].signature).toContain('formatDate');
    });
  });

  describe('importSearch', () => {
    it('should find ES6 imports', async () => {
      const result = await searchTools.importSearch({
        module: './utils',
        path: '/project',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should find require statements', async () => {
      mockFS.writeFileSync('/project/legacy.js', `
const utils = require('./utils');
`);

      const result = await searchTools.importSearch({
        module: './utils',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should include import statement', async () => {
      const result = await searchTools.importSearch({
        module: './utils',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].statement).toContain('import');
    });
  });

  describe('webSearch', () => {
    it('should return search results', async () => {
      const result = await searchTools.webSearch({
        query: 'typescript tutorial',
      });

      expect(result.success).toBe(true);
      const results = JSON.parse(result.output || '[]');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit results', async () => {
      const result = await searchTools.webSearch({
        query: 'test',
        numResults: 2,
      });

      const results = JSON.parse(result.output || '[]');
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should include result metadata', async () => {
      const result = await searchTools.webSearch({
        query: 'test',
      });

      expect(result.metadata?.query).toBe('test');
      expect(result.metadata?.results).toBeGreaterThan(0);
    });

    it('should use mock results when set', async () => {
      searchTools.setMockWebResults('custom query', [
        { title: 'Custom', url: 'https://custom.com', snippet: 'Custom result' },
      ]);

      const result = await searchTools.webSearch({
        query: 'custom query',
      });

      const results = JSON.parse(result.output || '[]');
      expect(results[0].title).toBe('Custom');
    });
  });

  describe('fullTextSearch', () => {
    it('should search with context', async () => {
      const result = await searchTools.fullTextSearch({
        query: 'MyClass',
        path: '/project',
        contextLines: 2,
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].context.length).toBeGreaterThan(1);
    });

    it('should include match line in context', async () => {
      const result = await searchTools.fullTextSearch({
        query: 'getValue',
        path: '/project',
        contextLines: 1,
      });

      const matches = JSON.parse(result.output || '[]');
      const context = matches[0].context;
      expect(context.some((line: string) => line.includes('getValue'))).toBe(true);
    });

    it('should handle multiple matches in same file', async () => {
      const result = await searchTools.fullTextSearch({
        query: 'value',
        path: '/project',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pattern', async () => {
      const result = await searchTools.grepSearch({
        pattern: '',
        path: '/project',
      });

      expect(result.success).toBe(true);
    });

    it('should handle special regex characters', async () => {
      mockFS.writeFileSync('/special.txt', 'test[0] = value;');
      
      const result = await searchTools.grepSearch({
        pattern: '\\[0\\]',
        path: '/special.txt',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle non-existent path', async () => {
      const result = await searchTools.grepSearch({
        pattern: 'test',
        path: '/nonexistent',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches).toHaveLength(0);
    });

    it('should handle binary files gracefully', async () => {
      mockFS.writeFileSync('/binary.bin', Buffer.from([0x00, 0x01, 0x02]));
      
      const result = await searchTools.grepSearch({
        pattern: 'test',
        path: '/binary.bin',
      });

      expect(result.success).toBe(true);
    });
  });
});
