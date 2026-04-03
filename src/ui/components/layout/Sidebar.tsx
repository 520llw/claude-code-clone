/**
 * Sidebar Component for Claude Code Clone
 * Side panel for context and navigation
 * @module components/layout/Sidebar
 */

import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';

/**
 * Sidebar section item
 */
export interface SidebarItem {
  /** Item ID */
  id: string;
  /** Display label */
  label: string;
  /** Item icon */
  icon?: string;
  /** Whether selected */
  selected?: boolean;
  /** Whether disabled */
  disabled?: boolean;
  /** Item badge/text */
  badge?: string;
  /** Children items */
  children?: SidebarItem[];
  /** Whether expanded (for children) */
  expanded?: boolean;
  /** Callback when clicked */
  onClick?: () => void;
}

/**
 * Sidebar section
 */
export interface SidebarSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section icon */
  icon?: string;
  /** Section items */
  items: SidebarItem[];
  /** Whether expanded */
  expanded?: boolean;
}

/**
 * Props for Sidebar component
 */
export interface SidebarProps {
  /** Sidebar sections */
  sections: SidebarSection[];
  /** Sidebar width */
  width?: number;
  /** Sidebar position */
  position?: 'left' | 'right';
  /** Currently selected item ID */
  selectedId?: string;
  /** Show section titles */
  showTitles?: boolean;
  /** Enable keyboard navigation */
  enableNavigation?: boolean;
  /** Custom item renderer */
  renderItem?: (item: SidebarItem, isSelected: boolean, depth: number) => ReactNode;
  /** Custom section renderer */
  renderSection?: (section: SidebarSection, isExpanded: boolean) => ReactNode;
  /** Callback when item is selected */
  onSelect?: (item: SidebarItem, sectionId: string) => void;
  /** Callback when section is toggled */
  onToggleSection?: (sectionId: string, expanded: boolean) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for Sidebar
 */
interface SidebarErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SidebarErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SidebarErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SidebarErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Sidebar Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">Sidebar Error</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Sidebar item component
 */
function SidebarItemComponent({
  item,
  isSelected,
  depth,
  colors,
  onClick,
}: {
  item: SidebarItem;
  isSelected: boolean;
  depth: number;
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  onClick?: () => void;
}): ReactNode {
  const indent = '  '.repeat(depth);
  
  return (
    <Box 
      flexDirection="row"
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? colors.selection : undefined}
      onPress={item.disabled ? undefined : onClick}
    >
      <Text color={colors.textMuted}>{indent}</Text>
      
      {/* Selection indicator */}
      <Box width={2}>
        <Text color={isSelected ? colors.cursor : colors.textMuted}>
          {isSelected ? '▶' : ' '}
        </Text>
      </Box>
      
      {/* Icon */}
      {item.icon && (
        <Text color={item.disabled ? colors.disabled : colors.text}>
          {item.icon}
        </Text>
      )}
      
      {/* Label */}
      <Text 
        color={item.disabled ? colors.disabled : isSelected ? colors.primary : colors.text}
        bold={isSelected}
        strikethrough={item.disabled}
      >
        {item.label}
      </Text>
      
      {/* Badge */}
      {item.badge && (
        <Text color={colors.textMuted} dimColor>
          {item.badge}
        </Text>
      )}
    </Box>
  );
}

/**
 * Sidebar section component
 */
function SidebarSectionComponent({
  section,
  selectedId,
  showTitle,
  colors,
  renderItem,
  onSelect,
  onToggle,
}: {
  section: SidebarSection;
  selectedId?: string;
  showTitle: boolean;
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  renderItem?: (item: SidebarItem, isSelected: boolean, depth: number) => ReactNode;
  onSelect?: (item: SidebarItem) => void;
  onToggle?: () => void;
}): ReactNode {
  const [expanded, setExpanded] = useState(section.expanded !== false);
  
  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.();
  };
  
  // Render items recursively
  const renderItems = (items: SidebarItem[], depth = 0): ReactNode[] => {
    return items.flatMap(item => {
      const isSelected = item.id === selectedId;
      const nodes: ReactNode[] = [];
      
      if (renderItem) {
        nodes.push(
          <Box key={item.id}>
            {renderItem(item, isSelected, depth)}
          </Box>
        );
      } else {
        nodes.push(
          <SidebarItemComponent
            key={item.id}
            item={item}
            isSelected={isSelected}
            depth={depth}
            colors={colors}
            onClick={() => onSelect?.(item)}
          />
        );
      }
      
      // Render children if expanded
      if (item.children && item.expanded !== false) {
        nodes.push(...renderItems(item.children, depth + 1));
      }
      
      return nodes;
    });
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Section title */}
      {showTitle && (
        <Box 
          flexDirection="row"
          gap={1}
          paddingX={1}
          onPress={handleToggle}
        >
          <Text color={colors.textMuted}>
            {expanded ? '▼' : '▶'}
          </Text>
          {section.icon && (
            <Text color={colors.primary}>{section.icon}</Text>
          )}
          <Text color={colors.primary} bold>
            {section.title}
          </Text>
        </Box>
      )}
      
      {/* Section items */}
      {expanded && (
        <Box flexDirection="column">
          {renderItems(section.items)}
        </Box>
      )}
    </Box>
  );
}

/**
 * Sidebar component - Side panel for context
 * 
 * @example
 * ```tsx
 * <Sidebar 
 *   sections={[
 *     {
 *       id: 'files',
 *       title: 'Files',
 *       items: [
 *         { id: '1', label: 'index.ts', icon: '📄' },
 *       ],
 *     },
 *   ]}
 *   width={30}
 * />
 * ```
 */
function SidebarComponent({
  sections,
  width = 30,
  position = 'left',
  selectedId,
  showTitles = true,
  enableNavigation = true,
  renderItem,
  renderSection,
  onSelect,
  onToggleSection,
  'data-testid': testId = 'sidebar',
}: SidebarProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  
  // Flatten all items for navigation
  const allItems = sections.flatMap(s => s.items);
  const { index: navIndex } = useArrowNavigation(allItems.length, {
    enabled: enableNavigation,
  });

  return (
    <Box
      flexDirection="column"
      width={width}
      height="100%"
      borderStyle="single"
      borderColor={theme.colors.border}
      borderDimColor
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {sections.map(section => (
        <SidebarSectionComponent
          key={section.id}
          section={section}
          selectedId={selectedId}
          showTitle={showTitles}
          colors={theme.colors}
          renderItem={renderItem}
          onSelect={item => onSelect?.(item, section.id)}
          onToggle={() => onToggleSection?.(section.id, !section.expanded)}
        />
      ))}
    </Box>
  );
}

/**
 * PropTypes validation for Sidebar
 */
SidebarComponent.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      icon: PropTypes.string,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          icon: PropTypes.string,
          selected: PropTypes.bool,
          disabled: PropTypes.bool,
          badge: PropTypes.string,
          children: PropTypes.array,
          expanded: PropTypes.bool,
          onClick: PropTypes.func,
        })
      ).isRequired,
      expanded: PropTypes.bool,
    })
  ).isRequired,
  width: PropTypes.number,
  position: PropTypes.oneOf(['left', 'right'] as const),
  selectedId: PropTypes.string,
  showTitles: PropTypes.bool,
  enableNavigation: PropTypes.bool,
  renderItem: PropTypes.func,
  renderSection: PropTypes.func,
  onSelect: PropTypes.func,
  onToggleSection: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped Sidebar with error boundary
 */
export function Sidebar(props: SidebarProps): ReactNode {
  return (
    <SidebarErrorBoundary>
      <SidebarComponent {...props} />
    </SidebarErrorBoundary>
  );
}

/**
 * Simple file sidebar
 */
export function FileSidebar({
  files,
  selectedPath,
  onSelect,
}: {
  files: Array<{ path: string; name: string; type: 'file' | 'directory' }>;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}): ReactNode {
  const theme = useCurrentTheme();
  
  const items: SidebarItem[] = files.map(f => ({
    id: f.path,
    label: f.name,
    icon: f.type === 'directory' ? '📁' : '📄',
    selected: f.path === selectedPath,
  }));
  
  return (
    <Sidebar
      sections={[{ id: 'files', title: 'Files', items }]}
      selectedId={selectedPath}
      onSelect={item => onSelect?.(item.id)}
    />
  );
}

FileSidebar.propTypes = {
  files: PropTypes.array.isRequired,
  selectedPath: PropTypes.string,
  onSelect: PropTypes.func,
};

export default Sidebar;
