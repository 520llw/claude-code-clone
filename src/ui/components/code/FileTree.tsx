/**
 * File Tree Component for Claude Code Clone
 * Displays directory tree visualization
 * @module components/code/FileTree
 */

import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import type { FileTreeNode } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';

/**
 * Props for FileTree component
 */
export interface FileTreeProps {
  /** Root node of the tree */
  root: FileTreeNode;
  /** Maximum depth to display */
  maxDepth?: number;
  /** Whether to show file sizes */
  showSize?: boolean;
  /** Whether to show modification dates */
  showModified?: boolean;
  /** Whether tree is selectable */
  selectable?: boolean;
  /** Initially selected node path */
  selectedPath?: string;
  /** Initially expanded paths */
  expandedPaths?: string[];
  /** Custom icon renderer */
  renderIcon?: (node: FileTreeNode, isExpanded: boolean) => ReactNode;
  /** Callback when node is selected */
  onSelect?: (node: FileTreeNode) => void;
  /** Callback when node is toggled */
  onToggle?: (node: FileTreeNode, expanded: boolean) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for tree node
 */
interface TreeNodeProps {
  /** Node data */
  node: FileTreeNode;
  /** Current depth */
  depth: number;
  /** Maximum depth */
  maxDepth: number;
  /** Whether this node is last in its parent's children */
  isLast: boolean;
  /** Parent prefix for indentation */
  parentPrefix: string;
  /** Expanded paths set */
  expandedPaths: Set<string>;
  /** Selected path */
  selectedPath: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show size */
  showSize: boolean;
  /** Show modified date */
  showModified: boolean;
  /** Custom icon renderer */
  renderIcon?: (node: FileTreeNode, isExpanded: boolean) => ReactNode;
  /** Toggle callback */
  onToggle: (node: FileTreeNode) => void;
  /** Select callback */
  onSelect: (node: FileTreeNode) => void;
}

/**
 * Error boundary for FileTree
 */
interface FileTreeErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class FileTreeErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  FileTreeErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FileTreeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('FileTree Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering file tree</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Get file icon based on name and type
 */
function getFileIcon(node: FileTreeNode): string {
  if (node.type === 'directory') {
    return '📁';
  }
  
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    js: '📜', ts: '📘', jsx: '⚛', tsx: '⚛',
    py: '🐍', java: '☕', go: '🐹', rs: '🦀',
    html: '🌐', css: '🎨', scss: '🎨', sass: '🎨',
    json: '📋', md: '📝', txt: '📄',
    yml: '⚙', yaml: '⚙', toml: '⚙',
    sql: '🗃', sh: '⌨', bash: '⌨',
    dockerfile: '🐳', gitignore: '🔒',
  };
  
  return iconMap[ext] || '📄';
}

/**
 * Format file size
 */
function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date
 */
function formatDate(date?: Date): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Tree node component
 */
function TreeNodeComponent({
  node,
  depth,
  maxDepth,
  isLast,
  parentPrefix,
  expandedPaths,
  selectedPath,
  colors,
  showSize,
  showModified,
  renderIcon,
  onToggle,
  onSelect,
}: TreeNodeProps): ReactNode {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.type === 'directory' && node.children && node.children.length > 0;
  const shouldShowChildren = isExpanded && hasChildren && depth < maxDepth;
  
  // Build prefix for this node
  const connector = isLast ? '└── ' : '├── ';
  const prefix = parentPrefix + connector;
  const childPrefix = parentPrefix + (isLast ? '    ' : '│   ');
  
  const backgroundColor = isSelected ? colors.selection : undefined;
  
  return (
    <Box flexDirection="column">
      {/* Node line */}
      <Box 
        flexDirection="row"
        backgroundColor={backgroundColor}
        onPress={() => {
          if (hasChildren) {
            onToggle(node);
          } else {
            onSelect(node);
          }
        }}
      >
        <Text color={colors.textMuted}>{prefix}</Text>
        
        {/* Expand/collapse indicator for directories */}
        {node.type === 'directory' && (
          <Text color={colors.textMuted}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        )}
        
        {/* Icon */}
        <Box marginLeft={node.type === 'directory' ? 0 : 1}>
          {renderIcon ? (
            renderIcon(node, isExpanded)
          ) : (
            <Text>{getFileIcon(node)}</Text>
          )}
        </Box>
        
        {/* Name */}
        <Text 
          color={node.type === 'directory' ? colors.primary : colors.text}
          bold={node.type === 'directory'}
        >
          {node.name}
        </Text>
        
        {/* Size */}
        {showSize && node.size !== undefined && (
          <Text color={colors.textMuted} dimColor>
            {' '}({formatSize(node.size)})
          </Text>
        )}
        
        {/* Modified date */}
        {showModified && node.modified && (
          <Text color={colors.textMuted} dimColor>
            {' '}{formatDate(node.modified)}
          </Text>
        )}
      </Box>
      
      {/* Children */}
      {shouldShowChildren && node.children && (
        <Box flexDirection="column">
          {node.children.map((child, index) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children!.length - 1}
              parentPrefix={childPrefix}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              colors={colors}
              showSize={showSize}
              showModified={showModified}
              renderIcon={renderIcon}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * FileTree component - Displays directory tree
 * 
 * @example
 * ```tsx
 * <FileTree 
 *   root={{
 *     name: 'src',
 *     path: 'src',
 *     type: 'directory',
 *     children: [
 *       { name: 'index.ts', path: 'src/index.ts', type: 'file', size: 1024 },
 *     ],
 *   }}
 *   showSize
 * />
 * ```
 */
function FileTreeComponent({
  root,
  maxDepth = 10,
  showSize = false,
  showModified = false,
  selectable = true,
  selectedPath: controlledSelectedPath,
  expandedPaths: initialExpandedPaths = [],
  renderIcon,
  onSelect,
  onToggle,
  'data-testid': testId = 'file-tree',
}: FileTreeProps): ReactNode {
  const theme = useCurrentTheme();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(initialExpandedPaths)
  );
  const [selectedPath, setSelectedPath] = useState(controlledSelectedPath || root.path);
  
  // Flatten tree for keyboard navigation
  const flattenTree = (node: FileTreeNode, depth = 0): Array<{ node: FileTreeNode; depth: number }> => {
    const result = [{ node, depth }];
    if (node.type === 'directory' && node.children && expandedPaths.has(node.path)) {
      for (const child of node.children) {
        result.push(...flattenTree(child, depth + 1));
      }
    }
    return result;
  };
  
  const flatNodes = flattenTree(root);
  const { index, setIndex } = useArrowNavigation(flatNodes.length, { enabled: selectable });
  
  const handleToggle = (node: FileTreeNode) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(node.path)) {
      newExpanded.delete(node.path);
    } else {
      newExpanded.add(node.path);
    }
    setExpandedPaths(newExpanded);
    onToggle?.(node, newExpanded.has(node.path));
  };
  
  const handleSelect = (node: FileTreeNode) => {
    setSelectedPath(node.path);
    onSelect?.(node);
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
      {/* Root node */}
      <TreeNodeComponent
        node={root}
        depth={0}
        maxDepth={maxDepth}
        isLast={true}
        parentPrefix=""
        expandedPaths={expandedPaths}
        selectedPath={selectable ? flatNodes[index]?.node.path || selectedPath : selectedPath}
        colors={theme.colors}
        showSize={showSize}
        showModified={showModified}
        renderIcon={renderIcon}
        onToggle={handleToggle}
        onSelect={handleSelect}
      />
    </Box>
  );
}

/**
 * PropTypes validation for FileTree
 */
FileTreeComponent.propTypes = {
  root: PropTypes.shape({
    name: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['file', 'directory']).isRequired,
    children: PropTypes.array,
    expanded: PropTypes.bool,
    size: PropTypes.number,
    modified: PropTypes.instanceOf(Date),
    selected: PropTypes.bool,
  }).isRequired,
  maxDepth: PropTypes.number,
  showSize: PropTypes.bool,
  showModified: PropTypes.bool,
  selectable: PropTypes.bool,
  selectedPath: PropTypes.string,
  expandedPaths: PropTypes.arrayOf(PropTypes.string),
  renderIcon: PropTypes.func,
  onSelect: PropTypes.func,
  onToggle: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped FileTree with error boundary
 */
export function FileTree(props: FileTreeProps): ReactNode {
  return (
    <FileTreeErrorBoundary>
      <FileTreeComponent {...props} />
    </FileTreeErrorBoundary>
  );
}

/**
 * Compact file tree (just names)
 */
export function CompactFileTree({
  root,
  maxDepth = 3,
}: Pick<FileTreeProps, 'root' | 'maxDepth'>): ReactNode {
  return (
    <FileTree
      root={root}
      maxDepth={maxDepth}
      showSize={false}
      showModified={false}
      selectable={false}
    />
  );
}

CompactFileTree.propTypes = {
  root: PropTypes.object.isRequired,
  maxDepth: PropTypes.number,
};

export default FileTree;
