/**
 * AutoComplete Component for Claude Code Clone
 * Command/file completion dropdown
 * @module components/interactive/AutoComplete
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';
import type { AutocompleteSuggestion } from '../../types/index.js';

/**
 * Props for AutoComplete component
 */
export interface AutoCompleteProps {
  /** Current input value */
  value: string;
  /** Available suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Whether dropdown is open */
  isOpen?: boolean;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
  /** Highlight matched text */
  highlightMatches?: boolean;
  /** Show suggestion type icons */
  showTypeIcons?: boolean;
  /** Custom filter function */
  filterFn?: (suggestions: AutocompleteSuggestion[], query: string) => AutocompleteSuggestion[];
  /** Custom sort function */
  sortFn?: (a: AutocompleteSuggestion, b: AutocompleteSuggestion) => number;
  /** Custom item renderer */
  renderSuggestion?: (suggestion: AutocompleteSuggestion, isSelected: boolean, query: string) => ReactNode;
  /** Callback when suggestion is selected */
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  /** Callback when dropdown is closed */
  onClose?: () => void;
  /** Callback when dropdown is opened */
  onOpen?: () => void;
  /** Callback when selection changes */
  onHighlight?: (suggestion: AutocompleteSuggestion | null) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for suggestion item
 */
interface SuggestionItemProps {
  /** Suggestion data */
  suggestion: AutocompleteSuggestion;
  /** Whether selected */
  isSelected: boolean;
  /** Current query */
  query: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Highlight matches */
  highlightMatches: boolean;
  /** Show type icon */
  showTypeIcon: boolean;
}

/**
 * Error boundary for AutoComplete
 */
interface AutoCompleteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AutoCompleteErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  AutoCompleteErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AutoCompleteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('AutoComplete Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

/**
 * Get icon for suggestion type
 */
function getTypeIcon(type: AutocompleteSuggestion['type']): string {
  const iconMap: Record<string, string> = {
    command: '⌘',
    file: '📄',
    directory: '📁',
    variable: '🔤',
    history: '⏱',
  };
  return iconMap[type] || '•';
}

/**
 * Highlight matching text
 */
function highlightMatch(text: string, query: string, colors: ReturnType<typeof useCurrentTheme>['colors']): ReactNode {
  if (!query) return <Text color={colors.text}>{text}</Text>;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) {
    return <Text color={colors.text}>{text}</Text>;
  }
  
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  
  return (
    <>
      <Text color={colors.text}>{before}</Text>
      <Text color={colors.primary} bold>{match}</Text>
      <Text color={colors.text}>{after}</Text>
    </>
  );
}

/**
 * Suggestion item component
 */
function SuggestionItemComponent({
  suggestion,
  isSelected,
  query,
  colors,
  highlightMatches,
  showTypeIcon,
}: SuggestionItemProps): ReactNode {
  return (
    <Box 
      flexDirection="row"
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? colors.selection : undefined}
    >
      {/* Selection indicator */}
      <Box width={2}>
        <Text color={isSelected ? colors.cursor : colors.textMuted}>
          {isSelected ? '▶' : ' '}
        </Text>
      </Box>
      
      {/* Type icon */}
      {showTypeIcon && (
        <Box width={2}>
          <Text color={colors.textMuted}>
            {getTypeIcon(suggestion.type)}
          </Text>
        </Box>
      )}
      
      {/* Label */}
      <Box flexDirection="column">
        <Box flexDirection="row">
          {highlightMatches 
            ? highlightMatch(suggestion.label, query, colors)
            : <Text color={isSelected ? colors.primary : colors.text}>{suggestion.label}</Text>
          }
        </Box>
        
        {/* Description */}
        {suggestion.description && (
          <Text color={colors.textMuted} dimColor>
            {suggestion.description}
          </Text>
        )}
      </Box>
      
      {/* Value preview */}
      {suggestion.value !== suggestion.label && (
        <Box marginLeft={2}>
          <Text color={colors.textMuted} dimColor>
            → {suggestion.value}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Default filter function
 */
function defaultFilter(suggestions: AutocompleteSuggestion[], query: string): AutocompleteSuggestion[] {
  if (!query) return suggestions;
  
  const lowerQuery = query.toLowerCase();
  return suggestions.filter(s => 
    s.label.toLowerCase().includes(lowerQuery) ||
    s.value.toLowerCase().includes(lowerQuery) ||
    s.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Default sort function (prioritizes prefix matches)
 */
function defaultSort(a: AutocompleteSuggestion, b: AutocompleteSuggestion, query: string): number {
  if (!query) return 0;
  
  const lowerQuery = query.toLowerCase();
  const aLower = a.label.toLowerCase();
  const bLower = b.label.toLowerCase();
  
  const aStartsWith = aLower.startsWith(lowerQuery);
  const bStartsWith = bLower.startsWith(lowerQuery);
  
  if (aStartsWith && !bStartsWith) return -1;
  if (!aStartsWith && bStartsWith) return 1;
  
  return a.label.localeCompare(b.label);
}

/**
 * AutoComplete component - Command/file completion dropdown
 * 
 * @example
 * ```tsx
 * <AutoComplete 
 *   value="git"
 *   suggestions={[
 *     { label: 'git add', value: 'git add', type: 'command' },
 *     { label: 'git commit', value: 'git commit', type: 'command' },
 *   ]}
 *   onSelect={(s) => console.log(s.value)}
 * />
 * ```
 */
function AutoCompleteComponent({
  value,
  suggestions,
  isOpen: controlledIsOpen,
  maxSuggestions = 10,
  highlightMatches = true,
  showTypeIcons = true,
  filterFn = defaultFilter,
  sortFn,
  renderSuggestion,
  onSelect,
  onClose,
  onOpen,
  onHighlight,
  'data-testid': testId = 'autocomplete',
}: AutoCompleteProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  
  // Filter and sort suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = filterFn(suggestions, value);
    
    if (sortFn) {
      filtered = filtered.sort((a, b) => sortFn(a, b));
    } else {
      filtered = filtered.sort((a, b) => defaultSort(a, b, value));
    }
    
    return filtered.slice(0, maxSuggestions);
  }, [suggestions, value, filterFn, sortFn, maxSuggestions]);
  
  // Navigation
  const { index: selectedIndex, setIndex } = useArrowNavigation(
    filteredSuggestions.length,
    { enabled: isOpen && filteredSuggestions.length > 0, wrap: true }
  );
  
  // Reset index when suggestions change
  useEffect(() => {
    setIndex(0);
  }, [filteredSuggestions.length, setIndex]);
  
  // Notify highlight change
  useEffect(() => {
    const highlighted = filteredSuggestions[selectedIndex] || null;
    onHighlight?.(highlighted);
  }, [selectedIndex, filteredSuggestions, onHighlight]);
  
  // Handle open/close
  const handleOpen = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
    onOpen?.();
  };
  
  const handleClose = () => {
    if (!isControlled) {
      setInternalIsOpen(false);
    }
    onClose?.();
  };
  
  // Keyboard handling (when integrated with parent input)
  useInput((input, key) => {
    if (!isOpen) {
      // Open on Tab
      if (key.tab && filteredSuggestions.length > 0) {
        handleOpen();
      }
      return;
    }
    
    // Close on Escape
    if (key.escape) {
      handleClose();
      return;
    }
    
    // Select on Tab or Enter
    if (key.tab || key.return) {
      const suggestion = filteredSuggestions[selectedIndex];
      if (suggestion) {
        onSelect(suggestion);
        handleClose();
      }
      return;
    }
  });
  
  // Don't render if no suggestions
  if (!isOpen || filteredSuggestions.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      backgroundColor={theme.colors.surface}
      width={Math.min(columns - 4, 80)}
      data-testid={testId}
    >
      {/* Header */}
      <Box flexDirection="row" paddingX={1} paddingY={0}>
        <Text color={theme.colors.textMuted} dimColor>
          {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''}
        </Text>
      </Box>
      
      {/* Suggestions list */}
      <Box flexDirection="column">
        {filteredSuggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex;
          
          if (renderSuggestion) {
            return (
              <Box key={`${suggestion.value}-${index}`}>
                {renderSuggestion(suggestion, isSelected, value)}
              </Box>
            );
          }
          
          return (
            <SuggestionItemComponent
              key={`${suggestion.value}-${index}`}
              suggestion={suggestion}
              isSelected={isSelected}
              query={value}
              colors={theme.colors}
              highlightMatches={highlightMatches}
              showTypeIcon={showTypeIcons}
            />
          );
        })}
      </Box>
      
      {/* Footer */}
      <Box flexDirection="row" paddingX={1} paddingY={0}>
        <Text color={theme.colors.textMuted} dimColor>
          ↑/↓ to navigate, Tab/Enter to select, Esc to close
        </Text>
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for AutoComplete
 */
AutoCompleteComponent.propTypes = {
  value: PropTypes.string.isRequired,
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['command', 'file', 'directory', 'variable', 'history']).isRequired,
      description: PropTypes.string,
      icon: PropTypes.string,
    })
  ).isRequired,
  isOpen: PropTypes.bool,
  maxSuggestions: PropTypes.number,
  highlightMatches: PropTypes.bool,
  showTypeIcons: PropTypes.bool,
  filterFn: PropTypes.func,
  sortFn: PropTypes.func,
  renderSuggestion: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  onOpen: PropTypes.func,
  onHighlight: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped AutoComplete with error boundary
 */
export function AutoComplete(props: AutoCompleteProps): ReactNode {
  return (
    <AutoCompleteErrorBoundary>
      <AutoCompleteComponent {...props} />
    </AutoCompleteErrorBoundary>
  );
}

/**
 * Command completion
 */
export function CommandCompletion(
  props: Omit<AutoCompleteProps, 'suggestions'> & { commands: string[] }
): ReactNode {
  const suggestions = useMemo(() => 
    props.commands.map(cmd => ({
      label: cmd,
      value: cmd,
      type: 'command' as const,
    })),
    [props.commands]
  );
  
  return <AutoComplete {...props} suggestions={suggestions} />;
}

CommandCompletion.propTypes = {
  value: PropTypes.string.isRequired,
  commands: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelect: PropTypes.func.isRequired,
};

/**
 * File path completion
 */
export function PathCompletion(
  props: Omit<AutoCompleteProps, 'suggestions'> & { paths: string[] }
): ReactNode {
  const suggestions = useMemo(() => 
    props.paths.map(path => ({
      label: path.split('/').pop() || path,
      value: path,
      type: path.endsWith('/') ? 'directory' as const : 'file' as const,
    })),
    [props.paths]
  );
  
  return <AutoComplete {...props} suggestions={suggestions} />;
}

PathCompletion.propTypes = {
  value: PropTypes.string.isRequired,
  paths: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default AutoComplete;
