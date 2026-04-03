/**
 * Diff View Component for Claude Code Clone
 * Displays unified and side-by-side diffs
 * @module components/code/DiffView
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
export type ViewMode = 'unified' | 'split' | 'side-by-side';

/**
 * Props for DiffView component
 */
export interface DiffViewProps {
  /** Array of file diffs */
  diffs: FileDiffType[];
  /** View mode */
  mode?: ViewMode;
  /** Maximum height per file */
  maxHeight?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Context lines around changes */
  contextLines?: number;
  /** Whether collapsed by default */
  defaultCollapsed?: boolean;
  /** Show file stats */
  showStats?: boolean;
  /** Custom header renderer */
  renderHeader?: (diff: FileDiffType, index: number) => ReactNode;
  /** Callback when file is toggled */
  onToggleFile?: (diff: FileDiffType, index: number, collapsed: boolean) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for diff stats
 */
interface DiffStatsProps {
  /** Diff data */
  diff: FileDiffType;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Error boundary for DiffView
 */
interface DiffViewErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class DiffViewErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  DiffViewErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): DiffViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('DiffView Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering diff view</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Calculate diff statistics
 */
function calculateDiffStats(diff: FileDiffType): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') added++;
      if (line.type === 'removed') removed++;
    }
  }
  
  return { added, removed, changed: Math.min(added, removed) };
}

/**
 * Diff stats component
 */
function DiffStats({ diff, colors }: DiffStatsProps): ReactNode {
  const stats = calculateDiffStats(diff);
  
  return (
    <Box flexDirection="row" gap={2}>
      {stats.added > 0 && (
        <Text color={colors.diff.addedText}>
          +{stats.added}
        </Text>
      )}
      {stats.removed > 0 && (
        <Text color={colors.diff.removedText}>
          -{stats.removed}
        </Text>
      )}
      {stats.changed > 0 && (
        <Text color={colors.textMuted}>
          ~{stats.changed}
        </Text>
      )}
    </Box>
  );
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
 * Unified diff renderer
 */
function renderUnifiedDiff(
  diff: FileDiffType,
  colors: ReturnType<typeof useCurrentTheme>['colors'],
  showLineNumbers: boolean,
  maxHeight: number,
  columns: number
): ReactNode {
  const lineNumberWidth = 8;
  const contentWidth = columns - lineNumberWidth * 2 - 6;
  const lines: ReactNode[] = [];
  let lineCount = 0;
  
  for (const hunk of diff.hunks) {
    if (lineCount >= maxHeight) break;
    
    // Hunk header
    lines.push(
      <Box 
        key={`hunk-${hunk.oldStart}`} 
        backgroundColor={colors.diff.header}
        paddingX={1}
      >
        <Text color={colors.diff.headerText}>
          {hunk.header}
        </Text>
      </Box>
    );
    lineCount++;
    
    // Hunk lines
    for (const line of hunk.lines) {
      if (lineCount >= maxHeight) break;
      
      const color = getLineColor(line.type, colors);
      const backgroundColor = getLineBackground(line.type, colors);
      const prefix = getLinePrefix(line.type);
      
      lines.push(
        <Box 
          key={`line-${hunk.oldStart}-${lineCount}`}
          flexDirection="row"
          backgroundColor={backgroundColor}
        >
          {showLineNumbers && (
            <>
              <Box width={lineNumberWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {line.oldLineNumber || ' '}
                </Text>
              </Box>
              <Box width={lineNumberWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {line.newLineNumber || ' '}
                </Text>
              </Box>
            </>
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
      lineCount++;
    }
  }
  
  return <Box flexDirection="column">{lines}</Box>;
}

/**
 * Split diff renderer
 */
function renderSplitDiff(
  diff: FileDiffType,
  colors: ReturnType<typeof useCurrentTheme>['colors'],
  showLineNumbers: boolean,
  maxHeight: number,
  columns: number
): ReactNode {
  const sideWidth = Math.floor((columns - 4) / 2);
  const lineNumberWidth = showLineNumbers ? 6 : 0;
  const contentWidth = sideWidth - lineNumberWidth - 2;
  const rows: ReactNode[] = [];
  let lineCount = 0;
  
  for (const hunk of diff.hunks) {
    if (lineCount >= maxHeight) break;
    
    // Hunk header
    rows.push(
      <Box 
        key={`hunk-${hunk.oldStart}`}
        backgroundColor={colors.diff.header}
        paddingX={1}
      >
        <Text color={colors.diff.headerText}>{hunk.header}</Text>
      </Box>
    );
    lineCount++;
    
    // Process lines for side-by-side
    const leftLines: Array<{ line?: DiffLine; num?: number }> = [];
    const rightLines: Array<{ line?: DiffLine; num?: number }> = [];
    
    for (const line of hunk.lines) {
      if (line.type === 'removed') {
        leftLines.push({ line, num: line.oldLineNumber });
        rightLines.push({});
      } else if (line.type === 'added') {
        leftLines.push({});
        rightLines.push({ line, num: line.newLineNumber });
      } else {
        leftLines.push({ line, num: line.oldLineNumber });
        rightLines.push({ line, num: line.newLineNumber });
      }
    }
    
    const maxLines = Math.max(leftLines.length, rightLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      if (lineCount >= maxHeight) break;
      
      const left = leftLines[i] || {};
      const right = rightLines[i] || {};
      
      rows.push(
        <Box key={`row-${hunk.oldStart}-${i}`} flexDirection="row">
          {/* Left side (old) */}
          <Box 
            width={sideWidth} 
            flexDirection="row"
            backgroundColor={left.line ? getLineBackground(left.line.type, colors) : undefined}
          >
            {showLineNumbers && (
              <Box width={lineNumberWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {left.num || ' '}
                </Text>
              </Box>
            )}
            <Box width={contentWidth}>
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
          
          {/* Right side (new) */}
          <Box 
            width={sideWidth} 
            flexDirection="row"
            backgroundColor={right.line ? getLineBackground(right.line.type, colors) : undefined}
          >
            {showLineNumbers && (
              <Box width={lineNumberWidth}>
                <Text color={colors.diff.lineNumber} dimColor>
                  {right.num || ' '}
                </Text>
              </Box>
            )}
            <Box width={contentWidth}>
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
  
  return <Box flexDirection="column">{rows}</Box>;
}

/**
 * Single file diff component
 */
interface FileDiffItemProps {
  /** Diff data */
  diff: FileDiffType;
  /** File index */
  index: number;
  /** View mode */
  mode: ViewMode;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Max height */
  maxHeight: number;
  /** Show stats */
  showStats: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Terminal columns */
  columns: number;
  /** Initially collapsed */
  initiallyCollapsed: boolean;
  /** Custom header renderer */
  renderHeader?: (diff: FileDiffType, index: number) => ReactNode;
  /** Toggle callback */
  onToggle?: (diff: FileDiffType, index: number, collapsed: boolean) => void;
}

function FileDiffItem({
  diff,
  index,
  mode,
  showLineNumbers,
  maxHeight,
  showStats,
  colors,
  columns,
  initiallyCollapsed,
  renderHeader,
  onToggle,
}: FileDiffItemProps): ReactNode {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  
  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onToggle?.(diff, index, newCollapsed);
  };

  return (
    <Box 
      flexDirection="column" 
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
    >
      {/* File header */}
      <Box flexDirection="row" gap={1}>
        {renderHeader ? (
          renderHeader(diff, index)
        ) : (
          <>
            <Text bold color={colors.primary}>
              📄
            </Text>
            <Text color={colors.text}>
              {diff.oldPath === diff.newPath 
                ? diff.newPath 
                : `${diff.oldPath} → ${diff.newPath}`}
            </Text>
          </>
        )}
        
        {showStats && <DiffStats diff={diff} colors={colors} />}
        
        <Box onPress={handleToggle}>
          <Text color={colors.textMuted}>
            {collapsed ? '[Show]' : '[Hide]'}
          </Text>
        </Box>
      </Box>
      
      {/* Diff content */}
      {!collapsed && (
        <Box flexDirection="column" marginTop={1}>
          {mode === 'unified' 
            ? renderUnifiedDiff(diff, colors, showLineNumbers, maxHeight, columns)
            : renderSplitDiff(diff, colors, showLineNumbers, maxHeight, columns)
          }
        </Box>
      )}
    </Box>
  );
}

/**
 * DiffView component - Displays multiple file diffs
 * 
 * @example
 * ```tsx
 * <DiffView 
 *   diffs={[
 *     {
 *       oldPath: 'file.ts',
 *       newPath: 'file.ts',
 *       hunks: [...],
 *     },
 *   ]}
 *   mode="unified"
 * />
 * ```
 */
function DiffViewComponent({
  diffs,
  mode = 'unified',
  maxHeight = 30,
  showLineNumbers = true,
  contextLines = 3,
  defaultCollapsed = false,
  showStats = true,
  renderHeader,
  onToggleFile,
  'data-testid': testId = 'diff-view',
}: DiffViewProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  
  // Calculate total stats
  const totalStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    
    for (const diff of diffs) {
      const stats = calculateDiffStats(diff);
      added += stats.added;
      removed += stats.removed;
    }
    
    return { added, removed, files: diffs.length };
  }, [diffs]);

  return (
    <Box
      flexDirection="column"
      data-testid={testId}
    >
      {/* Summary header */}
      {diffs.length > 1 && (
        <Box flexDirection="row" gap={1} marginBottom={1}>
          <Text bold color={theme.colors.primary}>
            📑 Diff Summary
          </Text>
          <Text color={theme.colors.textMuted}>
            {totalStats.files} files changed
          </Text>
          <Text color={theme.colors.diff.addedText}>
            +{totalStats.added}
          </Text>
          <Text color={theme.colors.diff.removedText}>
            -{totalStats.removed}
          </Text>
        </Box>
      )}
      
      {/* File diffs */}
      <Box flexDirection="column">
        {diffs.map((diff, index) => (
          <FileDiffItem
            key={`${diff.oldPath}-${diff.newPath}`}
            diff={diff}
            index={index}
            mode={mode}
            showLineNumbers={showLineNumbers}
            maxHeight={maxHeight}
            showStats={showStats}
            colors={theme.colors}
            columns={columns}
            initiallyCollapsed={defaultCollapsed}
            renderHeader={renderHeader}
            onToggle={onToggleFile}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for DiffView
 */
DiffViewComponent.propTypes = {
  diffs: PropTypes.arrayOf(
    PropTypes.shape({
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
    })
  ).isRequired,
  mode: PropTypes.oneOf(['unified', 'split', 'side-by-side'] as const),
  maxHeight: PropTypes.number,
  showLineNumbers: PropTypes.bool,
  contextLines: PropTypes.number,
  defaultCollapsed: PropTypes.bool,
  showStats: PropTypes.bool,
  renderHeader: PropTypes.func,
  onToggleFile: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped DiffView with error boundary
 */
export function DiffView(props: DiffViewProps): ReactNode {
  return (
    <DiffViewErrorBoundary>
      <DiffViewComponent {...props} />
    </DiffViewErrorBoundary>
  );
}

/**
 * Single file diff view
 */
export function SingleFileDiff(
  props: Omit<DiffViewProps, 'diffs'> & { diff: FileDiffType }
): ReactNode {
  return <DiffView {...props} diffs={[props.diff]} />;
}

SingleFileDiff.propTypes = {
  diff: PropTypes.object.isRequired,
};

export default DiffView;
