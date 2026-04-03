/**
 * Code display components for Claude Code Clone
 * @module components/code
 */

export { 
  CodeBlock, 
  InlineCode 
} from './CodeBlock.js';
export { 
  DiffView, 
  SingleFileDiff 
} from './DiffView.js';
export { 
  FileTree, 
  CompactFileTree 
} from './FileTree.js';
export { 
  Breadcrumb, 
  PathBreadcrumb, 
  CompactBreadcrumb 
} from './Breadcrumb.js';

// Re-export types
export type { CodeBlockProps, CodeLanguage, SyntaxToken, TokenType } from './CodeBlock.js';
export type { DiffViewProps, ViewMode } from './DiffView.js';
export type { FileTreeProps } from './FileTree.js';
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb.js';
