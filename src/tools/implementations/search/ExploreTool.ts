/**
 * @fileoverview Explore Tool for Claude Code Clone
 * 
 * This tool provides codebase exploration capabilities with:
 * - Directory tree visualization
 * - File type analysis
 * - Import/dependency detection
 * - Project structure overview
 * 
 * @module ExploreTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const ExploreInputSchema = z.object({
  path: z.string().min(1).describe('Path to explore'),
  max_depth: z.number().int().min(1).max(10).default(3).describe('Maximum depth to explore'),
  include_hidden: z.boolean().default(false).describe('Include hidden files'),
  show_size: z.boolean().default(true).describe('Show file sizes'),
  exclude_patterns: z.array(z.string()).default(['node_modules', '.git', 'dist', 'build']).describe('Patterns to exclude'),
}).describe('Input for exploring codebase');

export type ExploreInput = z.infer<typeof ExploreInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const FileTypeCountSchema = z.object({
  extension: z.string().describe('File extension'),
  count: z.number().int().describe('Number of files'),
  total_size: z.number().int().describe('Total size in bytes'),
}).describe('File type count');

export const DirectoryNodeSchema = z.object({
  name: z.string().describe('Directory name'),
  path: z.string().describe('Full path'),
  type: z.literal('directory').describe('Node type'),
  children: z.array(z.lazy(() => z.union([DirectoryNodeSchema, FileNodeSchema]))).describe('Child nodes'),
  file_count: z.number().int().describe('Total file count in subtree'),
  size: z.number().int().describe('Total size in subtree'),
}).describe('Directory tree node');

export const FileNodeSchema = z.object({
  name: z.string().describe('File name'),
  path: z.string().describe('Full path'),
  type: z.literal('file').describe('Node type'),
  size: z.number().int().describe('File size'),
  extension: z.string().optional().describe('File extension'),
}).describe('File tree node');

export const ExploreOutputSchema = z.object({
  root_path: z.string().describe('Root path explored'),
  tree: DirectoryNodeSchema.describe('Directory tree'),
  total_files: z.number().int().describe('Total files'),
  total_directories: z.number().int().describe('Total directories'),
  total_size: z.number().int().describe('Total size in bytes'),
  file_types: z.array(FileTypeCountSchema).describe('File type breakdown'),
  max_depth_reached: z.boolean().describe('Whether max depth was reached'),
}).describe('Result of exploring codebase');

export type ExploreOutput = z.infer<typeof ExploreOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class ExploreTool extends Tool {
  public readonly name = 'explore';
  public readonly description = 'Explore codebase structure with tree visualization and file analysis';
  public readonly documentation = `
## Explore Tool

Explores and visualizes codebase structure:
- Directory tree visualization
- File type analysis
- Size information
- Project overview

### Input Parameters

- **path** (required): Path to explore
- **max_depth** (optional): Maximum depth (default: 3)
- **include_hidden** (optional): Include hidden files (default: false)
- **show_size** (optional): Show file sizes (default: true)
- **exclude_patterns** (optional): Patterns to exclude

### Output

Returns codebase structure:
- root_path: Root path explored
- tree: Directory tree structure
- total_files: Total file count
- total_directories: Total directory count
- total_size: Total size
- file_types: File type breakdown
- max_depth_reached: Whether max depth was hit
  `;
  public readonly category = ToolCategory.SEARCH;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = ExploreInputSchema;
  public readonly outputSchema = ExploreOutputSchema;
  public readonly tags = ['explore', 'tree', 'structure', 'analysis'];
  public readonly examples = [
    { description: 'Explore project', input: { path: '/path/to/project' } },
    { description: 'Deep exploration', input: { path: '/path/to/project', max_depth: 5 } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as ExploreInput;

    try {
      const rootPath = path.resolve(context.workingDirectory, params.path);
      const fileTypes = new Map<string, { count: number; size: number }>();
      let maxDepthReached = false;

      const buildTree = async (dirPath: string, name: string, depth: number): Promise<z.infer<typeof DirectoryNodeSchema>> => {
        if (depth >= params.max_depth) {
          maxDepthReached = true;
        }

        const node: z.infer<typeof DirectoryNodeSchema> = {
          name,
          path: dirPath,
          type: 'directory',
          children: [],
          file_count: 0,
          size: 0,
        };

        let items: string[];
        try {
          items = await fs.readdir(dirPath);
        } catch {
          return node;
        }

        for (const item of items) {
          if (!params.include_hidden && item.startsWith('.')) continue;
          if (params.exclude_patterns.some(p => minimatch(item, p))) continue;

          const itemPath = path.join(dirPath, item);
          const stats = await fs.stat(itemPath).catch(() => null);
          if (!stats) continue;

          if (stats.isDirectory()) {
            if (depth < params.max_depth) {
              const childNode = await buildTree(itemPath, item, depth + 1);
              node.children.push(childNode);
              node.file_count += childNode.file_count;
              node.size += childNode.size;
            }
            node.file_count += 1; // Count directory itself
          } else {
            const ext = path.extname(item).toLowerCase() || '(no extension)';
            const fileNode: z.infer<typeof FileNodeSchema> = {
              name: item,
              path: itemPath,
              type: 'file',
              size: stats.size,
              extension: ext,
            };
            node.children.push(fileNode);
            node.file_count += 1;
            node.size += stats.size;

            // Track file types
            const typeStats = fileTypes.get(ext) || { count: 0, size: 0 };
            typeStats.count++;
            typeStats.size += stats.size;
            fileTypes.set(ext, typeStats);
          }
        }

        // Sort children: directories first, then files alphabetically
        node.children.sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });

        return node;
      };

      const tree = await buildTree(rootPath, path.basename(rootPath), 0);

      // Convert file types map to array
      const fileTypesArray = Array.from(fileTypes.entries())
        .map(([extension, stats]) => ({
          extension,
          count: stats.count,
          total_size: stats.size,
        }))
        .sort((a, b) => b.count - a.count);

      const output: ExploreOutput = {
        root_path: rootPath,
        tree,
        total_files: fileTypesArray.reduce((sum, t) => sum + t.count, 0),
        total_directories: tree.file_count - fileTypesArray.reduce((sum, t) => sum + t.count, 0),
        total_size: tree.size,
        file_types: fileTypesArray,
        max_depth_reached: maxDepthReached,
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      return this.createErrorResult(startedAt, createToolError('EXPLORE_ERROR', String(error)));
    }
  }

  protected async validateContext(input: unknown, context: ToolContext): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private formatTree(node: z.infer<typeof DirectoryNodeSchema> | z.infer<typeof FileNodeSchema>, prefix = ''): string {
    if (node.type === 'file') {
      const size = ` (${this.formatBytes(node.size)})`;
      return `${prefix}📄 ${node.name}${size}`;
    }

    let result = `${prefix}📂 ${node.name}/`;
    if (node.size > 0) {
      result += ` (${this.formatBytes(node.size)})`;
    }

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLast = i === node.children.length - 1;
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const connector = isLast ? '└── ' : '├── ';
      result += '\n' + prefix + connector + this.formatTree(child, childPrefix).trimStart();
    }

    return result;
  }

  private formatOutput(output: ExploreOutput): string {
    const parts: string[] = [];
    parts.push(`📁 Exploring: ${output.root_path}`);
    parts.push(`   Files: ${output.total_files} | Directories: ${output.total_directories} | Size: ${this.formatBytes(output.total_size)}`);
    if (output.max_depth_reached) {
      parts.push('   ⚠️  Max depth reached');
    }
    parts.push('');
    parts.push(this.formatTree(output.tree));
    parts.push('');
    parts.push('File Types:');
    for (const type of output.file_types.slice(0, 10)) {
      parts.push(`   ${type.extension}: ${type.count} files (${this.formatBytes(type.total_size)})`);
    }
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: ExploreOutput, output: string): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: true,
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    return {
      executionId: this.id,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default ExploreTool;
