/**
 * FileTools Tests
 * 
 * Comprehensive test suite for file-related tools including
 * read, write, edit, delete, move, and search operations.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockFS } from '../../mocks/MockFS';
import { MockFileTools, ToolResult } from '../../mocks/MockTools';

// File tool implementations for testing
interface ReadFileArgs {
  path: string;
  encoding?: BufferEncoding;
  offset?: number;
  limit?: number;
}

interface WriteFileArgs {
  path: string;
  content: string;
  encoding?: BufferEncoding;
  append?: boolean;
}

interface EditFileArgs {
  path: string;
  oldString: string;
  newString: string;
}

interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  created: Date;
  modified: Date;
  accessed: Date;
}

class FileTools {
  private mockFS: MockFS;

  constructor(mockFS: MockFS) {
    this.mockFS = mockFS;
  }

  async readFile(args: ReadFileArgs): Promise<ToolResult> {
    try {
      const content = this.mockFS.readFileSync(args.path, args.encoding || 'utf-8') as string;
      
      let result = content;
      if (args.offset !== undefined || args.limit !== undefined) {
        const lines = content.split('\n');
        const start = args.offset || 0;
        const end = args.limit ? start + args.limit : lines.length;
        result = lines.slice(start, end).join('\n');
      }

      return {
        success: true,
        output: result,
        metadata: {
          path: args.path,
          size: Buffer.byteLength(content),
          lines: content.split('\n').length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async writeFile(args: WriteFileArgs): Promise<ToolResult> {
    try {
      if (args.append) {
        const existing = this.mockFS.existsSync(args.path)
          ? (this.mockFS.readFileSync(args.path, 'utf-8') as string)
          : '';
        this.mockFS.writeFileSync(args.path, existing + args.content);
      } else {
        this.mockFS.writeFileSync(args.path, args.content);
      }

      return {
        success: true,
        output: `File written successfully: ${args.path}`,
        metadata: {
          path: args.path,
          size: Buffer.byteLength(args.content),
          appended: args.append || false,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async editFile(args: EditFileArgs): Promise<ToolResult> {
    try {
      const content = this.mockFS.readFileSync(args.path, 'utf-8') as string;
      
      if (!content.includes(args.oldString)) {
        return {
          success: false,
          error: `Old string not found in file: ${args.path}`,
        };
      }

      const occurrences = content.split(args.oldString).length - 1;
      if (occurrences > 1) {
        return {
          success: false,
          error: `Multiple occurrences (${occurrences}) found. Please be more specific.`,
        };
      }

      const newContent = content.replace(args.oldString, args.newString);
      this.mockFS.writeFileSync(args.path, newContent);

      return {
        success: true,
        output: `File edited successfully: ${args.path}`,
        metadata: {
          path: args.path,
          replacements: 1,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createDirectory(args: { path: string; recursive?: boolean }): Promise<ToolResult> {
    try {
      this.mockFS.mkdirSync(args.path, { recursive: args.recursive ?? true });
      return {
        success: true,
        output: `Directory created: ${args.path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listDirectory(args: { path: string }): Promise<ToolResult> {
    try {
      const entries = this.mockFS.readdirSync(args.path);
      const details = entries.map(name => {
        const fullPath = `${args.path}/${name}`.replace(/\/+/g, '/');
        const stat = this.mockFS.statSync(fullPath);
        return {
          name,
          type: stat.isDirectory() ? 'directory' : 'file',
          size: stat.size,
        };
      });

      return {
        success: true,
        output: JSON.stringify(details, null, 2),
        metadata: { count: entries.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async deletePath(args: { path: string; recursive?: boolean }): Promise<ToolResult> {
    try {
      const stat = this.mockFS.statSync(args.path);
      
      if (stat.isDirectory()) {
        this.mockFS.rmdirSync(args.path);
      } else {
        this.mockFS.unlinkSync(args.path);
      }

      return {
        success: true,
        output: `Deleted: ${args.path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async movePath(args: { source: string; destination: string }): Promise<ToolResult> {
    try {
      this.mockFS.renameSync(args.source, args.destination);
      return {
        success: true,
        output: `Moved: ${args.source} -> ${args.destination}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async copyFile(args: { source: string; destination: string }): Promise<ToolResult> {
    try {
      this.mockFS.copyFileSync(args.source, args.destination);
      return {
        success: true,
        output: `Copied: ${args.source} -> ${args.destination}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getFileInfo(args: { path: string }): Promise<ToolResult> {
    try {
      const stat = this.mockFS.statSync(args.path);
      const info: FileInfo = {
        path: args.path,
        size: stat.size,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        created: stat.birthtime,
        modified: stat.mtime,
        accessed: stat.atime,
      };

      return {
        success: true,
        output: JSON.stringify(info, null, 2),
        data: info,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async searchInFiles(args: { path: string; pattern: string; filePattern?: string }): Promise<ToolResult> {
    try {
      const files = this.mockFS.findFiles(args.path, args.filePattern || '*');
      const regex = new RegExp(args.pattern, 'g');
      const results: Array<{ file: string; line: number; content: string }> = [];

      for (const file of files) {
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

      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        metadata: { matches: results.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

describe('FileTools', () => {
  let mockFS: MockFS;
  let fileTools: FileTools;

  beforeEach(() => {
    mockFS = new MockFS();
    fileTools = new FileTools(mockFS);
  });

  describe('readFile', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/test.txt', 'Hello, World!');
    });

    it('should read file contents', async () => {
      const result = await fileTools.readFile({ path: '/test.txt' });
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should read file with offset and limit', async () => {
      mockFS.writeFileSync('/multi.txt', 'line1\nline2\nline3\nline4\nline5');
      
      const result = await fileTools.readFile({ path: '/multi.txt', offset: 1, limit: 2 });
      expect(result.output).toBe('line2\nline3');
    });

    it('should return metadata', async () => {
      const result = await fileTools.readFile({ path: '/test.txt' });
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.path).toBe('/test.txt');
      expect(result.metadata?.size).toBeGreaterThan(0);
    });

    it('should fail for non-existent file', async () => {
      const result = await fileTools.readFile({ path: '/nonexistent.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should fail for directory', async () => {
      mockFS.mkdirSync('/testdir');
      const result = await fileTools.readFile({ path: '/testdir' });
      expect(result.success).toBe(false);
    });
  });

  describe('writeFile', () => {
    it('should write new file', async () => {
      const result = await fileTools.writeFile({
        path: '/new.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(mockFS.readFileSync('/new.txt', 'utf-8')).toBe('New content');
    });

    it('should overwrite existing file', async () => {
      mockFS.writeFileSync('/existing.txt', 'Old content');
      
      await fileTools.writeFile({
        path: '/existing.txt',
        content: 'New content',
      });

      expect(mockFS.readFileSync('/existing.txt', 'utf-8')).toBe('New content');
    });

    it('should append to file', async () => {
      mockFS.writeFileSync('/append.txt', 'First');
      
      await fileTools.writeFile({
        path: '/append.txt',
        content: 'Second',
        append: true,
      });

      expect(mockFS.readFileSync('/append.txt', 'utf-8')).toBe('FirstSecond');
    });

    it('should create parent directories', async () => {
      const result = await fileTools.writeFile({
        path: '/parent/child/file.txt',
        content: 'Nested content',
      });

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/parent/child/file.txt')).toBe(true);
    });

    it('should return file metadata', async () => {
      const result = await fileTools.writeFile({
        path: '/meta.txt',
        content: 'Content',
      });

      expect(result.metadata?.size).toBeGreaterThan(0);
    });
  });

  describe('editFile', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/edit.txt', 'const x = 1;\nconst y = 2;');
    });

    it('should replace string in file', async () => {
      const result = await fileTools.editFile({
        path: '/edit.txt',
        oldString: 'const x = 1;',
        newString: 'const x = 10;',
      });

      expect(result.success).toBe(true);
      expect(mockFS.readFileSync('/edit.txt', 'utf-8')).toBe('const x = 10;\nconst y = 2;');
    });

    it('should fail if old string not found', async () => {
      const result = await fileTools.editFile({
        path: '/edit.txt',
        oldString: 'not found',
        newString: 'replacement',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for multiple occurrences', async () => {
      mockFS.writeFileSync('/multi.txt', 'abc abc abc');
      
      const result = await fileTools.editFile({
        path: '/multi.txt',
        oldString: 'abc',
        newString: 'xyz',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple occurrences');
    });

    it('should return replacement count', async () => {
      const result = await fileTools.editFile({
        path: '/edit.txt',
        oldString: 'const x = 1;',
        newString: 'const x = 10;',
      });

      expect(result.metadata?.replacements).toBe(1);
    });
  });

  describe('createDirectory', () => {
    it('should create directory', async () => {
      const result = await fileTools.createDirectory({ path: '/newdir' });
      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/newdir')).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const result = await fileTools.createDirectory({
        path: '/a/b/c/d',
        recursive: true,
      });

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/a/b/c/d')).toBe(true);
    });

    it('should succeed if directory exists', async () => {
      mockFS.mkdirSync('/exists');
      const result = await fileTools.createDirectory({ path: '/exists' });
      expect(result.success).toBe(true);
    });
  });

  describe('listDirectory', () => {
    beforeEach(() => {
      mockFS.mkdirSync('/listdir');
      mockFS.writeFileSync('/listdir/file1.txt', 'content1');
      mockFS.writeFileSync('/listdir/file2.txt', 'content2');
      mockFS.mkdirSync('/listdir/subdir');
    });

    it('should list directory contents', async () => {
      const result = await fileTools.listDirectory({ path: '/listdir' });
      expect(result.success).toBe(true);
      
      const entries = JSON.parse(result.output || '[]');
      expect(entries).toHaveLength(3);
    });

    it('should include file details', async () => {
      const result = await fileTools.listDirectory({ path: '/listdir' });
      const entries = JSON.parse(result.output || '[]');
      
      const fileEntry = entries.find((e: any) => e.name === 'file1.txt');
      expect(fileEntry.type).toBe('file');
      expect(fileEntry.size).toBeGreaterThan(0);
    });

    it('should include directory entries', async () => {
      const result = await fileTools.listDirectory({ path: '/listdir' });
      const entries = JSON.parse(result.output || '[]');
      
      const dirEntry = entries.find((e: any) => e.name === 'subdir');
      expect(dirEntry.type).toBe('directory');
    });

    it('should fail for non-existent directory', async () => {
      const result = await fileTools.listDirectory({ path: '/nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  describe('deletePath', () => {
    it('should delete file', async () => {
      mockFS.writeFileSync('/delete.txt', 'content');
      
      const result = await fileTools.deletePath({ path: '/delete.txt' });
      
      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/delete.txt')).toBe(false);
    });

    it('should delete empty directory', async () => {
      mockFS.mkdirSync('/deletedir');
      
      const result = await fileTools.deletePath({ path: '/deletedir' });
      
      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/deletedir')).toBe(false);
    });

    it('should fail for non-existent path', async () => {
      const result = await fileTools.deletePath({ path: '/nonexistent' });
      expect(result.success).toBe(false);
    });

    it('should fail to delete non-empty directory', async () => {
      mockFS.mkdirSync('/nonempty');
      mockFS.writeFileSync('/nonempty/file.txt', 'content');
      
      const result = await fileTools.deletePath({ path: '/nonempty' });
      expect(result.success).toBe(false);
    });
  });

  describe('movePath', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/source.txt', 'content');
    });

    it('should move file', async () => {
      const result = await fileTools.movePath({
        source: '/source.txt',
        destination: '/dest.txt',
      });

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/source.txt')).toBe(false);
      expect(mockFS.existsSync('/dest.txt')).toBe(true);
    });

    it('should move directory', async () => {
      mockFS.mkdirSync('/srcdir');
      mockFS.writeFileSync('/srcdir/file.txt', 'content');
      
      const result = await fileTools.movePath({
        source: '/srcdir',
        destination: '/destdir',
      });

      expect(result.success).toBe(true);
      expect(mockFS.existsSync('/destdir/file.txt')).toBe(true);
    });

    it('should fail for non-existent source', async () => {
      const result = await fileTools.movePath({
        source: '/nonexistent',
        destination: '/dest.txt',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('copyFile', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/original.txt', 'original content');
    });

    it('should copy file', async () => {
      const result = await fileTools.copyFile({
        source: '/original.txt',
        destination: '/copy.txt',
      });

      expect(result.success).toBe(true);
      expect(mockFS.readFileSync('/copy.txt', 'utf-8')).toBe('original content');
      expect(mockFS.existsSync('/original.txt')).toBe(true);
    });

    it('should fail for non-existent source', async () => {
      const result = await fileTools.copyFile({
        source: '/nonexistent.txt',
        destination: '/copy.txt',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    beforeEach(() => {
      mockFS.writeFileSync('/info.txt', 'file content here');
    });

    it('should return file information', async () => {
      const result = await fileTools.getFileInfo({ path: '/info.txt' });
      
      expect(result.success).toBe(true);
      const info = result.data as FileInfo;
      expect(info.path).toBe('/info.txt');
      expect(info.size).toBeGreaterThan(0);
      expect(info.isFile).toBe(true);
      expect(info.isDirectory).toBe(false);
    });

    it('should return directory information', async () => {
      mockFS.mkdirSync('/infodir');
      
      const result = await fileTools.getFileInfo({ path: '/infodir' });
      
      expect(result.success).toBe(true);
      const info = result.data as FileInfo;
      expect(info.isDirectory).toBe(true);
      expect(info.isFile).toBe(false);
    });

    it('should include timestamps', async () => {
      const result = await fileTools.getFileInfo({ path: '/info.txt' });
      const info = result.data as FileInfo;
      
      expect(info.created).toBeInstanceOf(Date);
      expect(info.modified).toBeInstanceOf(Date);
      expect(info.accessed).toBeInstanceOf(Date);
    });

    it('should fail for non-existent path', async () => {
      const result = await fileTools.getFileInfo({ path: '/nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  describe('searchInFiles', () => {
    beforeEach(() => {
      mockFS.mkdirSync('/search');
      mockFS.writeFileSync('/search/file1.ts', 'const x = 1;\nconst y = 2;');
      mockFS.writeFileSync('/search/file2.ts', 'const a = 1;\nlet x = 3;');
      mockFS.writeFileSync('/search/readme.md', '# Documentation');
    });

    it('should search in files', async () => {
      const result = await fileTools.searchInFiles({
        path: '/search',
        pattern: 'const',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should filter by file pattern', async () => {
      const result = await fileTools.searchInFiles({
        path: '/search',
        pattern: 'const',
        filePattern: '*.ts',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches.every((m: any) => m.file.endsWith('.ts'))).toBe(true);
    });

    it('should return line numbers', async () => {
      const result = await fileTools.searchInFiles({
        path: '/search',
        pattern: 'const x',
      });

      const matches = JSON.parse(result.output || '[]');
      expect(matches[0].line).toBe(1);
    });

    it('should return match count', async () => {
      const result = await fileTools.searchInFiles({
        path: '/search',
        pattern: 'const',
      });

      expect(result.metadata?.matches).toBeGreaterThan(0);
    });

    it('should handle no matches', async () => {
      const result = await fileTools.searchInFiles({
        path: '/search',
        pattern: 'nonexistent_pattern_xyz',
      });

      expect(result.success).toBe(true);
      const matches = JSON.parse(result.output || '[]');
      expect(matches).toHaveLength(0);
    });
  });
});
