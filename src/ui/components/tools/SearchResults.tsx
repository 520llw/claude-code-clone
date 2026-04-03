/**
 * Search Results Component for Claude Code Clone
 * Displays search results with context and navigation
 * @module components/tools/SearchResults
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { SearchResult } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';

/**
 * Props for SearchResults component
 */
export interface SearchResultsProps {
  /** Search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Total files searched */
  filesSearched: number;
  /** Total matches */
  totalMatches: number;
  /** Maximum results to display */
  maxResults?: number;
  /** Context lines before/after match */
  contextLines?: number;
  /** Whether to show file paths */
  showFilePaths?: boolean;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to show match scores */
  showScores?: boolean;
  /** Whether results are selectable */
  selectable?: boolean;
  /** Currently selected index */
  selectedIndex?: number;
  /** Callback when result selected */
  onSelect?: (result: SearchResult, index: number) => void;
  /** Callback when result focused */
  onFocus?: (result: SearchResult, index: number) => void;
  /** Custom render for result */
  renderResult?: (result: SearchResult, index: number, isSelected: boolean) => ReactNode;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for individual search result
 */
interface SearchResultItemProps {
  /** Search result */
  result: SearchResult;
  /** Result index */
  index: number;
  /** Whether selected */
  isSelected: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Show file path */
  showFilePath: boolean;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Show scores */
  showScores: boolean;
  /** Context lines */
  contextLines: number;
  /** Content width */
  contentWidth: number;
  /** On select callback */
  onSelect?: () => void;
  /** On focus callback */
  onFocus?: () => void;
}

/**
 * Error boundary for SearchResults
 */
interface SearchResultsErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SearchResultsErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SearchResultsErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SearchResultsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('SearchResults Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering search results</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Highlight matching text in content
 */
function highlightMatch(content: string, query: string, colors: ReturnType<typeof useCurrentTheme>['colors']): ReactNode {
  if (!query) return <Text color={colors.text}>{content}</Text>;
  
  const parts = content.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <Text key={i} backgroundColor={colors.selection} color={colors.text} bold>
            {part}
          </Text>
        ) : (
          <Text key={i} color={colors.text}>{part}</Text>
        );
      })}
    </>
  );
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search result item component
 */
function SearchResultItemComponent({
  result,
  index,
  isSelected,
  colors,
  showFilePath,
  showLineNumbers,
  showScores,
  contextLines,
  contentWidth,
  onSelect,
  onFocus,
}: SearchResultItemProps): ReactNode {
  const backgroundColor = isSelected ? colors.selection : undefined;
  
  return (
    <Box 
      flexDirection="column" 
      marginBottom={1}
      backgroundColor={backgroundColor}
      onPress={onSelect}
      onFocus={onFocus}
    >
      {/* Header with file path and location */}
      <Box flexDirection="row" gap={1}>
        {showFilePath && (
          <Text color={colors.primary}>
            {result.filePath}
          </Text>
        )}
        {showLineNumbers && (
          <Text color={colors.textMuted}>
            :{result.lineNumber}
          </Text>
        )}
        {showScores && result.score !== undefined && (
          <Text color={colors.textMuted} dimColor>
            (score: {result.score.toFixed(2)})
          </Text>
        )}
        {isSelected && (
          <Text color={colors.cursor}>▶</Text>
        )}
      </Box>
      
      {/* Context before */}
      {result.contextBefore && result.contextBefore.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {result.contextBefore.slice(-contextLines).map((line, i) => (
            <Text key={`before-${i}`} color={colors.textMuted} dimColor>
              {line.slice(0, contentWidth)}
            </Text>
          ))}
        </Box>
      )}
      
      {/* Match line */}
      <Box flexDirection="row" marginLeft={2}>
        <Box width={contentWidth}>
          {highlightMatch(result.content, '', colors)}
        </Box>
      </Box>
      
      {/* Context after */}
      {result.contextAfter && result.contextAfter.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {result.contextAfter.slice(0, contextLines).map((line, i) => (
            <Text key={`after-${i}`} color={colors.textMuted} dimColor>
              {line.slice(0, contentWidth)}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * SearchResults component - Displays search results
 * 
 * @example
 * ```tsx
 * <SearchResults 
 *   query="function"
 *   results={[
 *     { filePath: 'src/index.ts', lineNumber: 10, content: 'function main() {}' },
 *   ]}
 *   filesSearched={5}
 *   totalMatches={42}
 * />
 * ```
 */
function SearchResultsComponent({
  query,
  results,
  filesSearched,
  totalMatches,
  maxResults = 50,
  contextLines = 2,
  showFilePaths = true,
  showLineNumbers = true,
  showScores = false,
  selectable = true,
  selectedIndex: controlledIndex,
  onSelect,
  onFocus,
  renderResult,
  'data-testid': testId = 'search-results',
}: SearchResultsProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const contentWidth = columns - 8;
  
  // Use controlled or uncontrolled selection
  const { index: navigationIndex, setIndex } = useArrowNavigation(
    Math.min(results.length, maxResults),
    { enabled: selectable, initialIndex: controlledIndex || 0 }
  );
  
  const activeIndex = controlledIndex !== undefined ? controlledIndex : navigationIndex;
  
  const displayResults = useMemo(() => 
    results.slice(0, maxResults),
    [results, maxResults]
  );
  
  const handleSelect = (result: SearchResult, index: number) => {
    onSelect?.(result, index);
  };
  
  const handleFocus = (result: SearchResult, index: number) => {
    setIndex(index);
    onFocus?.(result, index);
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
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          🔍 Search Results
        </Text>
        
        <Text color={theme.colors.textMuted}>
          "{query}"
        </Text>
        
        <Spacer />
        
        <Text color={theme.colors.textMuted}>
          {totalMatches} matches in {filesSearched} files
        </Text>
        
        {results.length > maxResults && (
          <Text color={theme.colors.textMuted} dimColor>
            (showing {maxResults} of {results.length})
          </Text>
        )}
      </Box>
      
      {/* Results list */}
      <Box flexDirection="column">
        {displayResults.length === 0 ? (
          <Text color={theme.colors.textMuted} dimColor>
            No results found
          </Text>
        ) : (
          displayResults.map((result, index) => {
            const isSelected = index === activeIndex;
            
            if (renderResult) {
              return (
                <Box key={`${result.filePath}-${result.lineNumber}`}>
                  {renderResult(result, index, isSelected)}
                </Box>
              );
            }
            
            return (
              <SearchResultItemComponent
                key={`${result.filePath}-${result.lineNumber}`}
                result={result}
                index={index}
                isSelected={isSelected}
                colors={theme.colors}
                showFilePath={showFilePaths}
                showLineNumbers={showLineNumbers}
                showScores={showScores}
                contextLines={contextLines}
                contentWidth={contentWidth}
                onSelect={() => handleSelect(result, index)}
                onFocus={() => handleFocus(result, index)}
              />
            );
          })
        )}
      </Box>
      
      {/* Footer with navigation hint */}
      {selectable && displayResults.length > 0 && (
        <Box flexDirection="row" marginTop={1}>
          <Text color={theme.colors.textMuted} dimColor>
            Use ↑/↓ to navigate, Enter to select
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for SearchResults
 */
SearchResultsComponent.propTypes = {
  query: PropTypes.string.isRequired,
  results: PropTypes.arrayOf(
    PropTypes.shape({
      filePath: PropTypes.string.isRequired,
      lineNumber: PropTypes.number.isRequired,
      column: PropTypes.number,
      content: PropTypes.string.isRequired,
      contextBefore: PropTypes.arrayOf(PropTypes.string),
      contextAfter: PropTypes.arrayOf(PropTypes.string),
      score: PropTypes.number,
    })
  ).isRequired,
  filesSearched: PropTypes.number.isRequired,
  totalMatches: PropTypes.number.isRequired,
  maxResults: PropTypes.number,
  contextLines: PropTypes.number,
  showFilePaths: PropTypes.bool,
  showLineNumbers: PropTypes.bool,
  showScores: PropTypes.bool,
  selectable: PropTypes.bool,
  selectedIndex: PropTypes.number,
  onSelect: PropTypes.func,
  onFocus: PropTypes.func,
  renderResult: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped SearchResults with error boundary
 */
export function SearchResults(props: SearchResultsProps): ReactNode {
  return (
    <SearchResultsErrorBoundary>
      <SearchResultsComponent {...props} />
    </SearchResultsErrorBoundary>
  );
}

/**
 * Compact search results display
 */
export function CompactSearchResults({
  query,
  totalMatches,
  filesSearched,
}: Pick<SearchResultsProps, 'query' | 'totalMatches' | 'filesSearched'>): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.colors.status.info}>🔍</Text>
      <Text color={theme.colors.text}>"{query}"</Text>
      <Text color={theme.colors.textMuted}>
        → {totalMatches} matches in {filesSearched} files
      </Text>
    </Box>
  );
}

CompactSearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  totalMatches: PropTypes.number.isRequired,
  filesSearched: PropTypes.number.isRequired,
};

export default SearchResults;
