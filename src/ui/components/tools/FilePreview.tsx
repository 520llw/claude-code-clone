/**
 * File Preview Component for Claude Code Clone
 * Displays file content with syntax highlighting
 * @module components/tools/FilePreview
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Syntax highlighting language
 */
export type PreviewLanguage = 
  | 'javascript' | 'typescript' | 'python' | 'java' | 'go' | 'rust' | 'c' | 'cpp' | 'csharp'
  | 'html' | 'css' | 'json' | 'yaml' | 'xml' | 'markdown' | 'sql' | 'shell' | 'bash'
  | 'text' | 'plaintext' | 'auto';

/**
 * Props for FilePreview component
 */
export interface FilePreviewProps {
  /** File path */
  filePath: string;
  /** File content */
  content: string;
  /** Programming language for syntax highlighting */
  language?: PreviewLanguage;
  /** Maximum height */
  maxHeight?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Starting line number */
  startLine?: number;
  /** Highlight specific lines */
  highlightLines?: number[];
  /** Whether collapsed by default */
  defaultCollapsed?: boolean;
  /** Whether to show file info */
  showFileInfo?: boolean;
  /** File size in bytes */
  fileSize?: number;
  /** Custom header renderer */
  renderHeader?: (filePath: string, lineCount: number) => ReactNode;
  /** Callback when collapse toggled */
  onToggleCollapse?: (collapsed: boolean) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for syntax highlighted line
 */
interface HighlightedLineProps {
  /** Line content */
  content: string;
  /** Line number */
  lineNumber: number;
  /** Whether highlighted */
  isHighlighted: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Language */
  language: PreviewLanguage;
}

/**
 * Error boundary for FilePreview
 */
interface FilePreviewErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class FilePreviewErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  FilePreviewErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FilePreviewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('FilePreview Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering file preview</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath: string): PreviewLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, PreviewLanguage> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'bash',
    zsh: 'shell',
    txt: 'text',
  };
  
  return languageMap[ext] || 'text';
}

/**
 * Simple syntax highlighting
 */
function highlightSyntax(content: string, language: PreviewLanguage, colors: ReturnType<typeof useCurrentTheme>['colors']): string {
  // This is a simplified syntax highlighter
  // In production, you might want to use a proper syntax highlighting library
  
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type', 'import', 'export', 'from', 'async', 'await'],
    python: ['def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'with'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'void', 'return', 'if', 'else', 'for', 'while', 'import'],
    go: ['func', 'package', 'import', 'return', 'if', 'else', 'for', 'range', 'struct', 'interface', 'type'],
    rust: ['fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'match', 'struct', 'enum', 'impl', 'use', 'mod'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER'],
  };
  
  const langKeywords = keywords[language] || [];
  
  // Simple tokenization
  let highlighted = content;
  
  // Highlight strings
  highlighted = highlighted.replace(
    /(".*?"|'.*?'|`.*?`)/g,
    (match) => `{${colors.syntax.string}|${match}}`
  );
  
  // Highlight numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    (match) => `{${colors.syntax.number}|${match}}`
  );
  
  // Highlight keywords
  for (const keyword of langKeywords) {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(regex, (match) => `{${colors.syntax.keyword}|${match}}`);
  }
  
  // Highlight comments
  if (language === 'python' || language === 'yaml' || language === 'shell' || language === 'bash') {
    highlighted = highlighted.replace(
      /(#.*$)/gm,
      (match) => `{${colors.syntax.comment}|${match}}`
    );
  } else {
    highlighted = highlighted.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      (match) => `{${colors.syntax.comment}|${match}}`
    );
  }
  
  return highlighted;
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const iconMap: Record<string, string> = {
    js: '📜',
    ts: '📘',
    jsx: '⚛',
    tsx: '⚛',
    py: '🐍',
    java: '☕',
    go: '🐹',
    rs: '🦀',
    html: '🌐',
    css: '🎨',
    json: '📋',
    md: '📝',
    sql: '🗃',
    sh: '⌨',
    yml: '⚙',
    yaml: '⚙',
  };
  
  return iconMap[ext] || '📄';
}

/**
 * FilePreview component - Displays file content
 * 
 * @example
 * ```tsx
 * <FilePreview 
 *   filePath="src/index.ts"
 *   content="const x = 1;\nconsole.log(x);"
 *   language="typescript"
 *   showLineNumbers
 * />
 * ```
 */
function FilePreviewComponent({
  filePath,
  content,
  language = 'auto',
  maxHeight = 30,
  showLineNumbers = true,
  startLine = 1,
  highlightLines = [],
  defaultCollapsed = false,
  showFileInfo = true,
  fileSize,
  renderHeader,
  onToggleCollapse,
  'data-testid': testId = 'file-preview',
}: FilePreviewProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  const detectedLanguage = language === 'auto' ? detectLanguage(filePath) : language;
  const lines = content.split('\n');
  const displayLines = lines.slice(0, maxHeight);
  const hasMore = lines.length > maxHeight;
  const lineNumberWidth = String(startLine + lines.length - 1).length + 1;
  const contentWidth = columns - (showLineNumbers ? lineNumberWidth + 4 : 4);
  
  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onToggleCollapse?.(newCollapsed);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text bold color={theme.colors.primary}>
          {getFileIcon(filePath)} File
        </Text>
        
        {renderHeader ? (
          renderHeader(filePath, lines.length)
        ) : (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.text}>{filePath}</Text>
            {showFileInfo && (
              <Text color={theme.colors.textMuted}>
                ({lines.length} lines{fileSize ? `, ${formatFileSize(fileSize)}` : ''})
              </Text>
            )}
          </Box>
        )}
        
        <Box onPress={handleToggleCollapse}>
          <Text color={theme.colors.textMuted}>
            {collapsed ? '[Show]' : '[Hide]'}
          </Text>
        </Box>
      </Box>
      
      {/* Content */}
      {!collapsed && (
        <Box 
          flexDirection="column" 
          marginTop={1}
          backgroundColor={theme.colors.syntax.background}
        >
          {displayLines.map((line, index) => {
            const lineNumber = startLine + index;
            const isHighlighted = highlightLines.includes(lineNumber);
            
            return (
              <Box 
                key={index} 
                flexDirection="row"
                backgroundColor={isHighlighted ? theme.colors.selection : undefined}
              >
                {showLineNumbers && (
                  <Box width={lineNumberWidth}>
                    <Text color={theme.colors.diff.lineNumber} dimColor>
                      {lineNumber}
                    </Text>
                  </Box>
                )}
                <Box width={contentWidth}>
                  <Text color={theme.colors.text}>
                    {line.slice(0, contentWidth) || ' '}
                  </Text>
                </Box>
              </Box>
            );
          })}
          
          {hasMore && (
            <Box flexDirection="row">
              {showLineNumbers && (
                <Box width={lineNumberWidth}>
                  <Text color={theme.colors.textMuted} dimColor>...</Text>
                </Box>
              )}
              <Text color={theme.colors.textMuted} dimColor>
                ... {lines.length - maxHeight} more lines ...
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for FilePreview
 */
FilePreviewComponent.propTypes = {
  filePath: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  language: PropTypes.oneOf([
    'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp',
    'html', 'css', 'json', 'yaml', 'xml', 'markdown', 'sql', 'shell', 'bash',
    'text', 'plaintext', 'auto',
  ] as const),
  maxHeight: PropTypes.number,
  showLineNumbers: PropTypes.bool,
  startLine: PropTypes.number,
  highlightLines: PropTypes.arrayOf(PropTypes.number),
  defaultCollapsed: PropTypes.bool,
  showFileInfo: PropTypes.bool,
  fileSize: PropTypes.number,
  renderHeader: PropTypes.func,
  onToggleCollapse: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped FilePreview with error boundary
 */
export function FilePreview(props: FilePreviewProps): ReactNode {
  return (
    <FilePreviewErrorBoundary>
      <FilePreviewComponent {...props} />
    </FilePreviewErrorBoundary>
  );
}

/**
 * Compact file preview
 */
export function CompactFilePreview({
  filePath,
  lineCount,
}: {
  filePath: string;
  lineCount?: number;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text>{getFileIcon(filePath)}</Text>
      <Text color={theme.colors.text}>{filePath}</Text>
      {lineCount !== undefined && (
        <Text color={theme.colors.textMuted}>({lineCount} lines)</Text>
      )}
    </Box>
  );
}

CompactFilePreview.propTypes = {
  filePath: PropTypes.string.isRequired,
  lineCount: PropTypes.number,
};

export default FilePreview;
