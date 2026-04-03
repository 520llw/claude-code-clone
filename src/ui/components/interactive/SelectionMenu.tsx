/**
 * Selection Menu Component for Claude Code Clone
 * List selection with search and keyboard navigation
 * @module components/interactive/SelectionMenu
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo, useEffect } from 'react';
  import { Box, Text, useInput } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';

/**
 * Menu item type
 */
export interface MenuItem {
  /** Item ID/value */
  id: string;
  /** Display label */
  label: string;
  /** Item description */
  description?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Item icon */
  icon?: string;
  /** Item metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Props for SelectionMenu component
 */
export interface SelectionMenuProps {
  /** Menu title */
  title?: string;
  /** Menu items */
  items: MenuItem[];
  /** Initially selected item ID */
  selectedId?: string;
  /** Enable search */
  enableSearch?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Maximum height */
  maxHeight?: number;
  /** Show item descriptions */
  showDescriptions?: boolean;
  /** Show item icons */
  showIcons?: boolean;
  /** Allow multiple selection */
  multiSelect?: boolean;
  /** Initially selected IDs (for multi-select) */
  selectedIds?: string[];
  /** Custom item renderer */
  renderItem?: (item: MenuItem, isSelected: boolean, isFocused: boolean) => ReactNode;
  /** Callback when item is selected */
  onSelect: (item: MenuItem | MenuItem[]) => void;
  /** Callback when selection changes (for multi-select) */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for menu item component
 */
interface MenuItemComponentProps {
  /** Item data */
  item: MenuItem;
  /** Whether selected */
  isSelected: boolean;
  /** Whether focused */
  isFocused: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show description */
  showDescription: boolean;
  /** Show icon */
  showIcon: boolean;
  /** Multi-select mode */
  multiSelect: boolean;
  /** Whether checked (for multi-select) */
  isChecked?: boolean;
}

/**
 * Error boundary for SelectionMenu
 */
interface SelectionMenuErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SelectionMenuErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SelectionMenuErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SelectionMenuErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('SelectionMenu Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error in selection menu</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Menu item component
 */
function MenuItemComponent({
  item,
  isSelected,
  isFocused,
  colors,
  showDescription,
  showIcon,
  multiSelect,
  isChecked,
}: MenuItemComponentProps): ReactNode {
  const textColor = item.disabled 
    ? colors.disabled 
    : isSelected 
      ? colors.primary 
      : colors.text;
  
  return (
    <Box 
      flexDirection="row"
      gap={1}
      paddingX={1}
      backgroundColor={isFocused ? colors.selection : undefined}
    >
      {/* Selection indicator */}
      <Box width={2}>
        <Text color={isFocused ? colors.cursor : colors.textMuted}>
          {isFocused ? '▶' : ' '}
        </Text>
      </Box>
      
      {/* Multi-select checkbox */}
      {multiSelect && (
        <Box width={3}>
          <Text color={colors.textMuted}>
            [{isChecked ? '✓' : ' '}]
          </Text>
        </Box>
      )}
      
      {/* Icon */}
      {showIcon && (
        <Box width={2}>
          <Text color={textColor}>
            {item.icon || '•'}
          </Text>
        </Box>
      )}
      
      {/* Label and description */}
      <Box flexDirection="column">
        <Text 
          color={textColor}
          bold={isSelected}
          strikethrough={item.disabled}
        >
          {item.label}
        </Text>
        {showDescription && item.description && (
          <Text color={colors.textMuted} dimColor>
            {item.description}
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * SelectionMenu component - List selection with search
 * 
 * @example
 * ```tsx
 * <SelectionMenu 
 *   title="Select an option"
 *   items={[
 *     { id: '1', label: 'Option 1' },
 *     { id: '2', label: 'Option 2' },
 *   ]}
 *   onSelect={(item) => console.log(item.id)}
 * />
 * ```
 */
function SelectionMenuComponent({
  title,
  items,
  selectedId,
  enableSearch = false,
  searchPlaceholder = 'Search...',
  maxHeight = 15,
  showDescriptions = true,
  showIcons = true,
  multiSelect = false,
  selectedIds: controlledSelectedIds,
  renderItem,
  onSelect,
  onSelectionChange,
  onCancel,
  'data-testid': testId = 'selection-menu',
}: SelectionMenuProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(controlledSelectedIds || [])
  );
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);
  
  // Get initial index from selectedId
  const initialIndex = useMemo(() => {
    if (selectedId) {
      const index = filteredItems.findIndex(item => item.id === selectedId);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [filteredItems, selectedId]);
  
  // Navigation
  const { index: focusedIndex, setIndex } = useArrowNavigation(filteredItems.length, {
    initialIndex,
    wrap: true,
  });
  
  // Reset index when search changes
  useEffect(() => {
    setIndex(0);
  }, [searchQuery, setIndex]);
  
  // Sync controlled selectedIds
  useEffect(() => {
    if (controlledSelectedIds) {
      setCheckedIds(new Set(controlledSelectedIds));
    }
  }, [controlledSelectedIds]);
  
  // Keyboard input
  useInput((input, key) => {
    // Handle search input
    if (enableSearch && !key.ctrl && !key.meta && input) {
      setSearchQuery(prev => prev + input);
      return;
    }
    
    // Backspace in search
    if (enableSearch && key.backspace) {
      setSearchQuery(prev => prev.slice(0, -1));
      return;
    }
    
    // Select item
    if (key.return) {
      const item = filteredItems[focusedIndex];
      if (item && !item.disabled) {
        if (multiSelect) {
          // Toggle check
          const newChecked = new Set(checkedIds);
          if (newChecked.has(item.id)) {
            newChecked.delete(item.id);
          } else {
            newChecked.add(item.id);
          }
          setCheckedIds(newChecked);
          onSelectionChange?.(Array.from(newChecked));
        } else {
          onSelect(item);
        }
      }
      return;
    }
    
    // Multi-select: submit selected items
    if (multiSelect && key.ctrl && input === 'd') {
      const selectedItems = items.filter(item => checkedIds.has(item.id));
      onSelect(selectedItems);
      return;
    }
    
    // Cancel
    if (key.escape) {
      onCancel?.();
      return;
    }
  });
  
  // Display items (limited by maxHeight)
  const displayItems = filteredItems.slice(0, maxHeight);
  const hasMore = filteredItems.length > maxHeight;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {/* Title */}
      {title && (
        <Box marginBottom={1}>
          <Text bold color={theme.colors.primary}>
            {title}
          </Text>
        </Box>
      )}
      
      {/* Search */}
      {enableSearch && (
        <Box flexDirection="row" marginBottom={1}>
          <Text color={theme.colors.textMuted}>🔍</Text>
          <Text 
            color={searchQuery ? theme.colors.text : theme.colors.textMuted}
            dimColor={!searchQuery}
          >
            {searchQuery || searchPlaceholder}
          </Text>
          {searchQuery && (
            <Text color={theme.colors.textMuted}>
              {' '}({filteredItems.length} results)
            </Text>
          )}
        </Box>
      )}
      
      {/* Items */}
      <Box flexDirection="column">
        {displayItems.length === 0 ? (
          <Text color={theme.colors.textMuted} dimColor>
            No items found
          </Text>
        ) : (
          displayItems.map((item, index) => {
            const isFocused = index === focusedIndex;
            const isSelected = item.id === selectedId;
            const isChecked = checkedIds.has(item.id);
            
            if (renderItem) {
              return (
                <Box key={item.id}>
                  {renderItem(item, isSelected, isFocused)}
                </Box>
              );
            }
            
            return (
              <MenuItemComponent
                key={item.id}
                item={item}
                isSelected={isSelected}
                isFocused={isFocused}
                colors={theme.colors}
                showDescription={showDescriptions}
                showIcon={showIcons}
                multiSelect={multiSelect}
                isChecked={isChecked}
              />
            );
          })
        )}
        
        {hasMore && (
          <Text color={theme.colors.textMuted} dimColor>
            ... {filteredItems.length - maxHeight} more items ...
          </Text>
        )}
      </Box>
      
      {/* Footer */}
      <Box flexDirection="row" marginTop={1}>
        <Text color={theme.colors.textMuted} dimColor>
          {multiSelect 
            ? '↑/↓ to navigate, Space to toggle, Ctrl+D to confirm, Esc to cancel'
            : '↑/↓ to navigate, Enter to select, Esc to cancel'
          }
        </Text>
      </Box>
      
      {/* Multi-select count */}
      {multiSelect && checkedIds.size > 0 && (
        <Box marginTop={1}>
          <Text color={theme.colors.status.info}>
            {checkedIds.size} item(s) selected
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for SelectionMenu
 */
SelectionMenuComponent.propTypes = {
  title: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      disabled: PropTypes.bool,
      icon: PropTypes.string,
      metadata: PropTypes.object,
    })
  ).isRequired,
  selectedId: PropTypes.string,
  enableSearch: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  maxHeight: PropTypes.number,
  showDescriptions: PropTypes.bool,
  showIcons: PropTypes.bool,
  multiSelect: PropTypes.bool,
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  renderItem: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
  onSelectionChange: PropTypes.func,
  onCancel: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped SelectionMenu with error boundary
 */
export function SelectionMenu(props: SelectionMenuProps): ReactNode {
  return (
    <SelectionMenuErrorBoundary>
      <SelectionMenuComponent {...props} />
    </SelectionMenuErrorBoundary>
  );
}

/**
 * Simple list selector
 */
export function ListSelector(
  props: Omit<SelectionMenuProps, 'enableSearch' | 'showDescriptions' | 'showIcons'>
): ReactNode {
  return (
    <SelectionMenu
      {...props}
      enableSearch={false}
      showDescriptions={false}
      showIcons={false}
    />
  );
}

ListSelector.propTypes = {
  items: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};

/**
 * Searchable list
 */
export function SearchableList(
  props: Omit<SelectionMenuProps, 'enableSearch'>
): ReactNode {
  return <SelectionMenu {...props} enableSearch />;
}

SearchableList.propTypes = {
  items: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default SelectionMenu;
