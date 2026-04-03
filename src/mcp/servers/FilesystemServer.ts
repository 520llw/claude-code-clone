/**
 * Model Context Protocol (MCP) Filesystem Server
 * 
 * This module provides a built-in MCP server that exposes filesystem
 * operations as MCP tools and resources. Supports file reading, writing,
 * directory listing, and more.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Stats } from 'fs';
import { z } from 'zod';
import { MCPServer, MCPServerOptions, createMCPServer } from '../MCPServer';
import { FilesystemConfig, FileInfo, Tool, Resource, TextResourceContents, BlobResourceContents } from '../types';
import { ToolsManager } from '../features/ToolsManager';
import { ResourcesManager } from '../features/ResourcesManager';

/**
 * Filesystem server options
 */
export interface FilesystemServerOptions extends MCPServerOptions {
  filesystem: FilesystemConfig;
}

/**
 * Path validation result
 */
interface PathValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
}

/**
 * Filesystem Server
 * 
 * An MCP server that provides filesystem access through tools and resources.
 */
export class FilesystemServer {
  private _server: MCPServer;
  private _config: FilesystemConfig;
  private _isRunning = false;

  constructor(options: FilesystemServerOptions) {
    this._config = {
      readOnly: false,
      followSymlinks: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      ...options.filesystem,
    };

    this._server = createMCPServer({
      name: options.name,
      version: options.version,
      capabilities: {
        ...options.capabilities,
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
      },
      instructions: options.instructions ?? this.getDefaultInstructions(),
    });

    this.registerTools();
    this.registerResources();
  }

  /**
   * Get the underlying MCP server
   */
  get server(): MCPServer {
    return this._server;
  }

  /**
   * Get filesystem configuration
   */
  get config(): FilesystemConfig {
    return { ...this._config };
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get default server instructions
   */
  private getDefaultInstructions(): string {
    return `Filesystem Server

This server provides access to the filesystem through MCP tools and resources.

Allowed directories:
${this._config.allowedDirectories.map((d) => `  - ${d}`).join('\n')}

${this._config.readOnly ? 'This server is in READ-ONLY mode.' : 'This server allows read and write operations.'}

Available tools:
- read_file: Read the contents of a file
- write_file: Write content to a file (if not read-only)
- list_directory: List the contents of a directory
- create_directory: Create a new directory (if not read-only)
- delete_file: Delete a file (if not read-only)
- move_file: Move or rename a file (if not read-only)
- search_files: Search for files matching a pattern
- get_file_info: Get information about a file

Available resources:
- file://{path}: Access file contents as a resource
- directory://{path}: Access directory listings as a resource`;
  }

  // ========================================================================
  // Path Validation
  // ========================================================================

  /**
   * Validate that a path is within allowed directories
   */
  private validatePath(inputPath: string): PathValidationResult {
    // Resolve the path
    let resolvedPath: string;
    try {
      resolvedPath = path.resolve(inputPath);
    } catch (error) {
      return { valid: false, error: 'Invalid path format' };
    }

    // Check if path is within allowed directories
    const isAllowed = this._config.allowedDirectories.some((allowedDir) => {
      const resolvedAllowed = path.resolve(allowedDir);
      return resolvedPath === resolvedAllowed || resolvedPath.startsWith(resolvedAllowed + path.sep);
    });

    if (!isAllowed) {
      return { valid: false, error: 'Path is outside allowed directories' };
    }

    return { valid: true, resolvedPath };
  }

  /**
   * Check if a path is a file
   */
  private async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a directory
   */
  private async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Tool Registration
  // ========================================================================

  /**
   * Register all filesystem tools
   */
  private registerTools(): void {
    // Read file tool
    this._server.registerTool(
      {
        name: 'read_file',
        description: 'Read the contents of a file. The path must be within an allowed directory.',
        parameters: z.object({
          path: z.string().describe('The path to the file to read'),
          offset: z.number().optional().describe('Start reading from this byte offset'),
          limit: z.number().optional().describe('Maximum number of bytes to read'),
        }),
      },
      async (args) => {
        const { path: filePath, offset, limit } = args as { path: string; offset?: number; limit?: number };

        const validation = this.validatePath(filePath);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const content = await this.readFile(validation.resolvedPath!, offset, limit);
          return ToolsManager.createTextResult(content);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Write file tool (only if not read-only)
    if (!this._config.readOnly) {
      this._server.registerTool(
        {
          name: 'write_file',
          description: 'Write content to a file. Creates the file if it does not exist.',
          parameters: z.object({
            path: z.string().describe('The path to the file to write'),
            content: z.string().describe('The content to write'),
            append: z.boolean().optional().describe('Append to the file instead of overwriting'),
          }),
        },
        async (args) => {
          const { path: filePath, content, append } = args as {
            path: string;
            content: string;
            append?: boolean;
          };

          const validation = this.validatePath(filePath);
          if (!validation.valid) {
            return ToolsManager.createErrorResult(validation.error!);
          }

          try {
            await this.writeFile(validation.resolvedPath!, content, append);
            return ToolsManager.createTextResult(`File written successfully: ${filePath}`);
          } catch (error) {
            return ToolsManager.createErrorResult(
              `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    }

    // List directory tool
    this._server.registerTool(
      {
        name: 'list_directory',
        description: 'List the contents of a directory.',
        parameters: z.object({
          path: z.string().describe('The path to the directory to list'),
        }),
      },
      async (args) => {
        const { path: dirPath } = args as { path: string };

        const validation = this.validatePath(dirPath);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const entries = await this.listDirectory(validation.resolvedPath!);
          const formatted = entries
            .map((e) => `${e.type === 'directory' ? '[DIR]' : '[FILE]'} ${e.name}`)
            .join('\n');
          return ToolsManager.createTextResult(formatted || 'Empty directory');
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Create directory tool (only if not read-only)
    if (!this._config.readOnly) {
      this._server.registerTool(
        {
          name: 'create_directory',
          description: 'Create a new directory. Creates parent directories if needed.',
          parameters: z.object({
            path: z.string().describe('The path to the directory to create'),
          }),
        },
        async (args) => {
          const { path: dirPath } = args as { path: string };

          const validation = this.validatePath(dirPath);
          if (!validation.valid) {
            return ToolsManager.createErrorResult(validation.error!);
          }

          try {
            await fs.mkdir(validation.resolvedPath!, { recursive: true });
            return ToolsManager.createTextResult(`Directory created: ${dirPath}`);
          } catch (error) {
            return ToolsManager.createErrorResult(
              `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );

      // Delete file tool
      this._server.registerTool(
        {
          name: 'delete_file',
          description: 'Delete a file or directory.',
          parameters: z.object({
            path: z.string().describe('The path to the file or directory to delete'),
            recursive: z.boolean().optional().describe('Delete directories recursively'),
          }),
        },
        async (args) => {
          const { path: filePath, recursive } = args as { path: string; recursive?: boolean };

          const validation = this.validatePath(filePath);
          if (!validation.valid) {
            return ToolsManager.createErrorResult(validation.error!);
          }

          try {
            const stats = await fs.stat(validation.resolvedPath!);
            if (stats.isDirectory()) {
              await fs.rmdir(validation.resolvedPath!, { recursive: recursive ?? false });
            } else {
              await fs.unlink(validation.resolvedPath!);
            }
            return ToolsManager.createTextResult(`Deleted: ${filePath}`);
          } catch (error) {
            return ToolsManager.createErrorResult(
              `Failed to delete: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );

      // Move file tool
      this._server.registerTool(
        {
          name: 'move_file',
          description: 'Move or rename a file or directory.',
          parameters: z.object({
            source: z.string().describe('The source path'),
            destination: z.string().describe('The destination path'),
          }),
        },
        async (args) => {
          const { source, destination } = args as { source: string; destination: string };

          const sourceValidation = this.validatePath(source);
          if (!sourceValidation.valid) {
            return ToolsManager.createErrorResult(`Source: ${sourceValidation.error}`);
          }

          const destValidation = this.validatePath(destination);
          if (!destValidation.valid) {
            return ToolsManager.createErrorResult(`Destination: ${destValidation.error}`);
          }

          try {
            await fs.rename(sourceValidation.resolvedPath!, destValidation.resolvedPath!);
            return ToolsManager.createTextResult(`Moved: ${source} -> ${destination}`);
          } catch (error) {
            return ToolsManager.createErrorResult(
              `Failed to move: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    }

    // Search files tool
    this._server.registerTool(
      {
        name: 'search_files',
        description: 'Search for files matching a pattern.',
        parameters: z.object({
          path: z.string().describe('The directory to search in'),
          pattern: z.string().describe('The search pattern (glob)'),
        }),
      },
      async (args) => {
        const { path: dirPath, pattern } = args as { path: string; pattern: string };

        const validation = this.validatePath(dirPath);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const results = await this.searchFiles(validation.resolvedPath!, pattern);
          const formatted = results.join('\n');
          return ToolsManager.createTextResult(formatted || 'No files found');
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to search: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Get file info tool
    this._server.registerTool(
      {
        name: 'get_file_info',
        description: 'Get detailed information about a file or directory.',
        parameters: z.object({
          path: z.string().describe('The path to get info for'),
        }),
      },
      async (args) => {
        const { path: filePath } = args as { path: string };

        const validation = this.validatePath(filePath);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const info = await this.getFileInfo(validation.resolvedPath!);
          const formatted = `
Name: ${info.name}
Type: ${info.type}
Size: ${info.size} bytes
Modified: ${info.modified}
Created: ${info.created}
Permissions: ${info.permissions}
          `.trim();
          return ToolsManager.createTextResult(formatted);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  // ========================================================================
  // Resource Registration
  // ========================================================================

  /**
   * Register filesystem resources
   */
  private registerResources(): void {
    // Register file resource template
    this._server.registerResourceTemplate(
      {
        uriTemplate: 'file://{path}',
        name: 'File Resource',
        description: 'Access file contents as a resource',
        mimeType: 'application/octet-stream',
      },
      async (params) => {
        const filePath = params.path;

        const validation = this.validatePath(filePath);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const content = await this.readFile(validation.resolvedPath!);
        return ResourcesManager.createTextContent(`file://${filePath}`, content);
      }
    );

    // Register directory resource template
    this._server.registerResourceTemplate(
      {
        uriTemplate: 'directory://{path}',
        name: 'Directory Resource',
        description: 'Access directory listings as a resource',
        mimeType: 'text/plain',
      },
      async (params) => {
        const dirPath = params.path;

        const validation = this.validatePath(dirPath);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const entries = await this.listDirectory(validation.resolvedPath!);
        const formatted = entries.map((e) => `${e.type}: ${e.name}`).join('\n');
        return ResourcesManager.createTextContent(`directory://${dirPath}`, formatted);
      }
    );
  }

  // ========================================================================
  // Filesystem Operations
  // ========================================================================

  /**
   * Read a file
   */
  private async readFile(
    filePath: string,
    offset?: number,
    limit?: number
  ): Promise<string> {
    // Check file size
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    if (stats.size > (this._config.maxFileSize ?? 10 * 1024 * 1024)) {
      throw new Error(`File too large (${stats.size} bytes)`);
    }

    let content: Buffer;

    if (offset !== undefined || limit !== undefined) {
      // Read partial content
      const fd = await fs.open(filePath, 'r');
      try {
        const start = offset ?? 0;
        const length = limit ?? stats.size - start;
        const buffer = Buffer.alloc(length);
        await fd.read(buffer, 0, length, start);
        content = buffer;
      } finally {
        await fd.close();
      }
    } else {
      content = await fs.readFile(filePath);
    }

    return content.toString('utf-8');
  }

  /**
   * Write a file
   */
  private async writeFile(filePath: string, content: string, append?: boolean): Promise<void> {
    const flag = append ? 'a' : 'w';
    await fs.writeFile(filePath, content, { flag, encoding: 'utf-8' });
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const fileInfos: FileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(entryPath);

      fileInfos.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        permissions: stats.mode.toString(8).slice(-3),
      });
    }

    return fileInfos;
  }

  /**
   * Search for files
   */
  private async searchFiles(dirPath: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));

    const search = async (currentPath: string): Promise<void> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await search(entryPath);
        } else if (regex.test(entry.name)) {
          results.push(entryPath);
        }
      }
    };

    await search(dirPath);
    return results;
  }

  /**
   * Get file information
   */
  private async getFileInfo(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    const name = path.basename(filePath);

    return {
      name,
      type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      permissions: stats.mode.toString(8).slice(-3),
    };
  }

  // ========================================================================
  // Server Lifecycle
  // ========================================================================

  /**
   * Start the server with a transport
   */
  async start(transport: import('../MCPTransport').MCPTransport): Promise<void> {
    await this._server.start(transport);
    this._isRunning = true;
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this._server.stop();
    this._isRunning = false;
  }

  /**
   * Dispose of the server
   */
  async dispose(): Promise<void> {
    await this._server.dispose();
    this._isRunning = false;
  }
}

/**
 * Create a filesystem server instance
 */
export function createFilesystemServer(
  name: string,
  version: string,
  config: FilesystemConfig
): FilesystemServer {
  return new FilesystemServer({
    name,
    version,
    filesystem: config,
  });
}

/**
 * Filesystem server error
 */
export class FilesystemServerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'FilesystemServerError';
  }
}

/**
 * Path not allowed error
 */
export class PathNotAllowedError extends FilesystemServerError {
  constructor(path: string) {
    super(`Path not allowed: ${path}`, 'PATH_NOT_ALLOWED', path);
    this.name = 'PathNotAllowedError';
  }
}

/**
 * File too large error
 */
export class FileTooLargeError extends FilesystemServerError {
  constructor(path: string, size: number, maxSize: number) {
    super(
      `File too large: ${path} (${size} bytes, max ${maxSize} bytes)`,
      'FILE_TOO_LARGE',
      path
    );
    this.name = 'FileTooLargeError';
  }
}

/**
 * Read-only error
 */
export class ReadOnlyError extends FilesystemServerError {
  constructor(operation: string) {
    super(`Operation '${operation}' not allowed in read-only mode`, 'READ_ONLY');
    this.name = 'ReadOnlyError';
  }
}
