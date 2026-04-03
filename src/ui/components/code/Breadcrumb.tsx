/**
 * Breadcrumb Component for Claude Code Clone
 * Displays navigation breadcrumb trail
 * @module components/code/Breadcrumb
 */

import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Item label */
  label: string;
  /** Item value/path */
  value: string;
  /** Whether item is active */
  active?: boolean;
  /** Custom icon */
  icon?: string;
  /** Item metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Props for Breadcrumb component
 */
export interface BreadcrumbProps {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Separator between items */
  separator?: string;
  /** Maximum items to show (0 = all) */
  maxItems?: number;
  /** Items to show from start when truncated */
  itemsFromStart?: number;
  /** Items to show from end when truncated */
  itemsFromEnd?: number;
  /** Whether items are clickable */
  clickable?: boolean;
  /** Custom item renderer */
  renderItem?: (item: BreadcrumbItem, index: number) => ReactNode;
  /** Callback when item is clicked */
  onItemClick?: (item: BreadcrumbItem, index: number) => void;
  /** Callback when home/root is clicked */
  onHomeClick?: () => void;
  /** Show home icon */
  showHome?: boolean;
  /** Home label/icon */
  homeLabel?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for Breadcrumb
 */
interface BreadcrumbErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class BreadcrumbErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  BreadcrumbErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): BreadcrumbErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Breadcrumb Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">...</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Breadcrumb component - Displays navigation trail
 * 
 * @example
 * ```tsx
 * <Breadcrumb 
 *   items={[
 *     { label: 'home', value: '/home' },
 *     { label: 'user', value: '/home/user' },
 *     { label: 'projects', value: '/home/user/projects', active: true },
 *   ]}
 * />
 * ```
 */
function BreadcrumbComponent({
  items,
  separator = '/',
  maxItems = 0,
  itemsFromStart = 2,
  itemsFromEnd = 1,
  clickable = true,
  renderItem,
  onItemClick,
  onHomeClick,
  showHome = true,
  homeLabel = '🏠',
  'data-testid': testId = 'breadcrumb',
}: BreadcrumbProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Determine which items to show
  const displayItems = React.useMemo(() => {
    if (maxItems === 0 || items.length <= maxItems) {
      return items.map((item, index) => ({ item, index, isTruncated: false }));
    }
    
    const result: Array<{ item: BreadcrumbItem; index: number; isTruncated: boolean }> = [];
    
    // Add items from start
    for (let i = 0; i < itemsFromStart && i < items.length; i++) {
      result.push({ item: items[i], index: i, isTruncated: false });
    }
    
    // Add truncation indicator
    result.push({ 
      item: { label: '...', value: '' }, 
      index: -1, 
      isTruncated: true 
    });
    
    // Add items from end
    const endStart = Math.max(itemsFromStart, items.length - itemsFromEnd);
    for (let i = endStart; i < items.length; i++) {
      result.push({ item: items[i], index: i, isTruncated: false });
    }
    
    return result;
  }, [items, maxItems, itemsFromStart, itemsFromEnd]);

  return (
    <Box
      flexDirection="row"
      flexWrap="wrap"
      data-testid={testId}
    >
      {/* Home icon */}
      {showHome && (
        <Box 
          marginRight={1}
          onPress={onHomeClick}
        >
          <Text 
            color={theme.colors.primary}
            underline={hoveredIndex === -1}
            onMouseEnter={() => setHoveredIndex(-1)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {homeLabel}
          </Text>
        </Box>
      )}
      
      {/* Breadcrumb items */}
      {displayItems.map(({ item, index, isTruncated }, displayIndex) => {
        const isLast = displayIndex === displayItems.length - 1;
        const isActive = item.active || isLast;
        
        if (isTruncated) {
          return (
            <Box key={`truncated-${displayIndex}`} marginRight={1}>
              <Text color={theme.colors.textMuted}>{separator}</Text>
              <Text color={theme.colors.textMuted}>{item.label}</Text>
              <Text color={theme.colors.textMuted}>{separator}</Text>
            </Box>
          );
        }
        
        if (renderItem) {
          return (
            <Box key={`${item.value}-${displayIndex}`} marginRight={1}>
              {displayIndex > 0 && (
                <Text color={theme.colors.textMuted}>{separator}</Text>
              )}
              {renderItem(item, index)}
            </Box>
          );
        }
        
        return (
          <Box 
            key={`${item.value}-${displayIndex}`}
            flexDirection="row"
            marginRight={1}
          >
            {displayIndex > 0 && (
              <Text color={theme.colors.textMuted}>{separator}</Text>
            )}
            
            <Box
              onPress={() => clickable && onItemClick?.(item, index)}
            >
              {item.icon && (
                <Text color={isActive ? theme.colors.primary : theme.colors.text}>
                  {item.icon}{' '}
                </Text>
              )}
              <Text 
                color={isActive ? theme.colors.primary : theme.colors.text}
                bold={isActive}
                underline={hoveredIndex === index && clickable}
              >
                {item.label}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * PropTypes validation for Breadcrumb
 */
BreadcrumbComponent.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      active: PropTypes.bool,
      icon: PropTypes.string,
      metadata: PropTypes.object,
    })
  ).isRequired,
  separator: PropTypes.string,
  maxItems: PropTypes.number,
  itemsFromStart: PropTypes.number,
  itemsFromEnd: PropTypes.number,
  clickable: PropTypes.bool,
  renderItem: PropTypes.func,
  onItemClick: PropTypes.func,
  onHomeClick: PropTypes.func,
  showHome: PropTypes.bool,
  homeLabel: PropTypes.string,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped Breadcrumb with error boundary
 */
export function Breadcrumb(props: BreadcrumbProps): ReactNode {
  return (
    <BreadcrumbErrorBoundary>
      <BreadcrumbComponent {...props} />
    </BreadcrumbErrorBoundary>
  );
}

/**
 * Path breadcrumb (creates items from path string)
 */
export function PathBreadcrumb({
  path,
  separator = '/',
  onItemClick,
  ...props
}: Omit<BreadcrumbProps, 'items'> & { 
  path: string;
  onItemClick?: (path: string) => void;
}): ReactNode {
  const items = React.useMemo(() => {
    const parts = path.split(separator).filter(Boolean);
    let currentPath = '';
    
    return parts.map((part, index) => {
      currentPath += separator + part;
      return {
        label: part,
        value: currentPath,
        active: index === parts.length - 1,
      };
    });
  }, [path, separator]);
  
  return (
    <Breadcrumb
      {...props}
      items={items}
      separator={separator}
      onItemClick={(item, index) => onItemClick?.(item.value)}
    />
  );
}

PathBreadcrumb.propTypes = {
  path: PropTypes.string.isRequired,
  separator: PropTypes.string,
  onItemClick: PropTypes.func,
};

/**
 * Compact breadcrumb (no home, simple separator)
 */
export function CompactBreadcrumb({
  items,
  onItemClick,
}: Pick<BreadcrumbProps, 'items' | 'onItemClick'>): ReactNode {
  return (
    <Breadcrumb
      items={items}
      showHome={false}
      separator="›"
      onItemClick={onItemClick}
    />
  );
}

CompactBreadcrumb.propTypes = {
  items: PropTypes.array.isRequired,
  onItemClick: PropTypes.func,
};

export default Breadcrumb;
