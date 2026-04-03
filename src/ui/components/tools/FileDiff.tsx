/**
 * File Diff Component for Claude Code Clone
 * Displays side-by-side or unified diff with syntax highlighting
 * @module components/tools/FileDiff
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import type { FileDiff as FileDiffType, DiffHunk, DiffLine } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Diff view mode
 */
export type DiffViewMode = 'unified' | 'side-by-side';

/**
 * Props for FileDiff component
 */
export interface FileDiffProps {
  /** Diff data */
  diff: FileDiffType;
  /** View mode */
  mode?: DiffViewMode;
  /** Maximum height */
  maxHeight?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Context lines around changes */
  contextLines?: number;
  /** Whether collapsed by default */
  defaultCollapsed?: boolean;
  /** Custom render for header */
  renderHeader?: (oldPath: string, newPath: string) => ReactNode;
  /** Custom render for line */
  renderLine?: (line: DiffLine, oldNum?: number, newNum?: number) => ReactNode;
  /** Callback when collapse toggled */
  onToggleCollapse?: (collapsed: boolean) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for unified diff view
 */
interface UnifiedDiffViewProps {
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Maximum height */
  maxHeight: number;
}

/**
 * Props for side-by-side diff view
 */
interface SideBySideDiffViewProps {
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Maximum height */
  maxHeight: number;
  /** Terminal columns */
  columns: number;
}

/**
 * Props for diff line
 */
interface DiffLineProps {
  /** Line data */
  line: DiffLine;
  /** Old line number */
  oldLineNumber?: number;
  /** New line number */
  newLineNumber?: number;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Line width */
  width: number;
}

/**
 * Error boundary for FileDiff
 */
interface FileDiffErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class FileDiffErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  FileDiffErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FileDiffErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('FileDiff Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering diff</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Get color for line type
 */
function getLineColor(type: DiffLine['type'], colors: ReturnType<typeof useCurrentTheme>['colors']): string {
  switch (type) {
    case 'added':
      return colors.diff.addedText;
    case 'removed':
      return colors.diff.removedText;
    case 'header':
      return colors.diff.headerText;
    default:
      return colors.text;
  }
}

/**
 * Get background color for line type
 */
function getLineBackground(type: DiffLine['type'], colors: ReturnType<typeof useCurrentTheme>['colors']): string | undefined {
  switch (type) {
    case 'added':
      return colors.diff.added;
    case 'removed':
      return colors.diff.removed;
    case 'header':
      return colors.diff.header;
    default:
      return undefined;
  }
}

/**
 * Get prefix for line type
 */
function getLinePrefix(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'header':
      return '@';
    default:
      return ' ';
  }
}

/**
 * Unified diff line component
 */
function UnifiedDiffLineComponent({
  line,
  oldLineNumber,
  newLineNumber,
  colors,
  showLineNumbers,
  width,
}: DiffLineProps): ReactNode {
  const color = getLineColor(line.type, colors);
  const backgroundColor = getLineBackground(line.type, colors);
  const prefix = getLinePrefix(line.type);
  
  const lineNumWidth = showLineNumbers ? 12 : 0;
  const contentWidth = width - lineNumWidth - 2;
  
  return (
    <Box flexDirection="row" backgroundColor={backgroundColor}>
      {showLineNumbers && (
        <Box width={6}>
          <Text color={colors.diff.lineNumber} dimColor>
            {oldLineNumber || ' '}
          </Text>
        </Box>
      )}
      {showLineNumbers && (
        <Box width={6}>
          <Text color={colors.diff.lineNumber} dimColor>
            {newLineNumber || ' '}
          </Text>
        </Box>
      )}
      <Box width={2}>
        <Text color={color}>{prefix}</Text>
      </Box>
      <Box width={contentWidth}>
        <Text color={color}>
          {line.content.slice(0, contentWidth) || ' '}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Unified diff view component
 */
function UnifiedDiffView({ hunks, colors, showLineNumbers, maxHeight }: UnifiedDiffViewProps): ReactNode {
  const lines: ReactNode[] = [];
  let lineCount = 0;
  
  for (const hunk of hunks) {
    if (lineCount >= maxHeight) break;
    
    // Hunk header
    lines.push(
      <Box key={`hunk-${hunk.oldStart}`} backgroundColor={colors.diff.header}>
        <Text color={colors.diff.headerText}>
          {hunk.header}
        </Text>
      </Box>
    );
    lineCount++;
    
    // Hunk lines
    for (const line of hunk.lines) {
      if (lineCount >= maxHeight) break;
      
      lines.push(
        <UnifiedDiffLineComponent
          key={`line-${hunk.oldStart}-${lineCount}`}
          line={line}
          oldLineNumber={line.oldLineNumber}
          newLineNumber={line.newLineNumber}
          colors={colors}
          showLineNumbers={showLineNumbers}
          width={100}
        />
      );
      lineCount++;
    }
  }
  
  return (
    <Box flexDirection="column">
      {lines}
    </Box>
  );
}

/**
 * Side-by-side diff view component
 */
function SideBySideDiffView({ hunks, colors, showLineNumbers, maxHeight, columns }: SideBySideDiffViewProps): ReactNode {
  const sideWidth = Math.floor((columns - 6) / 2);
  const lineNumWidth = showLineNumbers ? 6 : 0;
  const contentWidth = sideWidth - lineNumWidth - 1;
  
  const rows: ReactNode[] = [];
  let lineCount = 0;
  
  for (const hunk of hunks) {
    if (lineCount >= maxHeight) break;
    
    // Hunk header spanning both sides
    rows.push(
      <Box key={`hunk-${hunk.oldStart}`} backgroundColor={colors.diff.header}>
        <Text color={colors.diff.headerText}>
          {hunk.header}
        </Text>
      </Box>
    );
    lineCount++;
    
    // Process lines in pairs for side-by-side
    const leftLines: Array<{ line?: DiffLine; lineNum?: number }> = [];
    const rightLines: Array<{ line?: DiffLine; lineNum?: number }> = [];
    
    for (const line of hunk.lines) {
      if (line.type === 'removed') {
        leftLines.push({ line, lineNum: line.oldLineNumber });
        rightLines.push({});
      } else if (line.type === 'added') {
        leftLines.push({});
        rightLines.push({ line, lineNum: line.newLineNumber });
      } else {
        leftLines.push({ line, lineNum: line.oldLineNumber });
        rightLines.push({ line, lineNum: line.newLineNumber });
      }
    }
    
    const maxLines = Math.max(leftLines.length, rightLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      if (lineCount >= maxHeight) break;
      
      const left = leftLines[i] || {};
      const right = rightLines[i] || {};
      
      rows.push(
        <Box key={`row-${hunk.oldStart}-${i}`} flexDirection="row">
          {/* Left side */}
          <Box width={sideWidth} flexDirection="row">
            {showLineNumbers && (
              <Box width={lineNumWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {left.lineNum || ' '}
                </Text>
              </Box>
            )}
            <Box width={contentWidth} backgroundColor={left.line ? getLineBackground(left.line.type, colors) : undefined}>
              <Text color={left.line ? getLineColor(left.line.type, colors) : colors.text}>
                {left.line ? getLinePrefix(left.line.type) : ' '}
                {left.line ? left.line.content.slice(0, contentWidth - 1) : ''}
              </Text>
            </Box>
          </Box>
          
          {/* Divider */}
          <Box width={2}>
            <Text color={colors.border}>│</Text>
          </Box>
          
          {/* Right side */}
          <Box width={sideWidth} flexDirection="row">
            {showLineNumbers && (
              <Box width={lineNumWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {right.lineNum || ' '}
                </Text>
              </Box>
            )}
            <Box width={contentWidth} backgroundColor={right.line ? getLineBackground(right.line.type, colors) : undefined}>
              <Text color={right.line ? getLineColor(right.line.type, colors) : colors.text}>
                {right.line ? getLinePrefix(right.line.type) : ' '}
                {right.line ? right.line.content.slice(0, contentWidth - 1) : ''}
              </Text>
            </Box>
          </Box>
        </Box>
      );
      
      lineCount++;
    }
  }
  
  return (
    <Box flexDirection="column">
      {rows}
    </Box>
  );
}

/**
 * FileDiff component - Displays file differences
 * 
 * @example
 * ```tsx
 * <FileDiff 
 *   diff={{
 *     oldPath: 'file.txt',
 *     newPath: 'file.txt',
 *     hunks: [{
 *       oldStart: 1,
 *       oldLines: 3,
 *       newStart: 1,
 *       newLines: 3,
 *       header: '@@ -1,3 +1,3 @@',
 *       lines: [
 *         { type: 'removed', content: 'old line', oldLineNumber: 1 },
 *         { type: 'added', content: 'new line', newLineNumber: 1 },
 *         { type: 'unchanged', content: 'same line', oldLineNumber: 2, newLineNumber: 2 },
 *       ],
 *     }],
 *   }}
 * />
 * ```
 */
function FileDiffComponent({
  diff,
  mode = 'unified',
  maxHeight = 30,
  showLineNumbers = true,
  contextLines = 3,
  defaultCollapsed = false,
  renderHeader,
  renderLine,
  onToggleCollapse,
  'data-testid': testId = 'file-diff',
}: FileDiffProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'added') added++;
        if (line.type === 'removed') removed++;
      }
    }
    
    return { added, removed };
  }, [diff.hunks]);
  
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
          📄 Diff
        </Text>
        
        {renderHeader ? (
          renderHeader(diff.oldPath, diff.newPath)
        ) : (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>{diff.oldPath}</Text>
            {diff.oldPath !== diff.newPath && (
              <>
                <Text color={theme.colors.textMuted}>→</Text>
                <Text color={theme.colors.textMuted}>{diff.newPath}</Text>
              </>
            )}
          </Box>
        )}
        
        <Box flexDirection="row" gap={2}>
          <Text color={theme.colors.diff.addedText}>+{stats.added}</Text>
          <Text color={theme.colors.diff.removedText}>-{stats.removed}</Text>
        </Box>
        
        <Box onPress={handleToggleCollapse}>
          <Text color={theme.colors.textMuted}>
            {collapsed ? '[Show]' : '[Hide]'}
          </Text>
        </Box>
      </Box>
      
      {/* Diff content */}
      {!collapsed && (
        <Box flexDirection="column" marginTop={1}>
          {mode === 'unified' ? (
            <UnifiedDiffView
              hunks={diff.hunks}
              colors={theme.colors}
              showLineNumbers={showLineNumbers}
              maxHeight={maxHeight}
            />
          ) : (
            <SideBySideDiffView
              hunks={diff.hunks}
              colors={theme.colors}
              showLineNumbers={showLineNumbers}
              maxHeight={maxHeight}
              columns={columns}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for FileDiff
 */
FileDiffComponent.propTypes = {
  diff: PropTypes.shape({
    oldPath: PropTypes.string.isRequired,
    newPath: PropTypes.string.isRequired,
    hunks: PropTypes.arrayOf(
      PropTypes.shape({
        oldStart: PropTypes.number.isRequired,
        oldLines: PropTypes.number.isRequired,
        newStart: PropTypes.number.isRequired,
        newLines: PropTypes.number.isRequired,
        header: PropTypes.string.isRequired,
        lines: PropTypes.arrayOf(
          PropTypes.shape({
            type: PropTypes.oneOf(['added', 'removed', 'unchanged', 'header']).isRequired,
            content: PropTypes.string.isRequired,
            oldLineNumber: PropTypes.number,
            newLineNumber: PropTypes.number,
          })
        ).isRequired,
      })
    ).isRequired,
    oldMode: PropTypes.string,
    newMode: PropTypes.string,
  }).isRequired,
  mode: PropTypes.oneOf(['unified', 'side-by-side'] as const),
  maxHeight: PropTypes.number,
  showLineNumbers: PropTypes.bool,
  contextLines: PropTypes.number,
  defaultCollapsed: PropTypes.bool,
  renderHeader: PropTypes.func,
  renderLine: PropTypes.func,
  onToggleCollapse: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped FileDiff with error boundary
 */
export function FileDiff(props: FileDiffProps): ReactNode {
  return (
    <FileDiffErrorBoundary>
      <FileDiffComponent {...props} />
    </FileDiffErrorBoundary>
  );
}

/**
 * Compact diff display
 */
export function CompactFileDiff({
  diff,
}: Pick<FileDiffProps, 'diff'>): ReactNode {
  const theme = useCurrentTheme();
  
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'added') added++;
        if (line.type === 'removed') removed++;
      }
    }
    
    return { added, removed };
  }, [diff.hunks]);
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.colors.textMuted}>{diff.newPath}</Text>
      <Text color={theme.colors.diff.addedText}>+{stats.added}</Text>
      <Text color={theme.colors.diff.removedText}>-{stats.removed}</Text>
    </Box>
  );
}

CompactFileDiff.propTypes = {
  diff: PropTypes.object.isRequired,
};

export default FileDiff;
