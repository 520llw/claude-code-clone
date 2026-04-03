/**
 * Main Area Component for Claude Code Clone
 * Main content area with scrollable viewport
 * @module components/layout/MainArea
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useRef, useEffect } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Scroll position
 */
export interface ScrollPosition {
  /** Current row */
  row: number;
  /** Current column */
  column: number;
}

/**
 * Props for MainArea component
 */
export interface MainAreaProps {
  /** Content to display */
  children: ReactNode;
  /** Whether content is scrollable */
  scrollable?: boolean;
  /** Initial scroll position */
  initialScrollPosition?: ScrollPosition;
  /** Whether to show scroll indicators */
  showScrollIndicators?: boolean;
  /** Content padding */
  padding?: number;
  /** Content padding X */
  paddingX?: number;
  /** Content padding Y */
  paddingY?: number;
  /** Background color */
  backgroundColor?: string;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'round' | 'none';
  /** Whether to fill available space */
  flex?: boolean;
  /** Maximum height */
  maxHeight?: number;
  /** Minimum height */
  minHeight?: number;
  /** Custom scroll handler */
  onScroll?: (position: ScrollPosition) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for MainArea
 */
interface MainAreaErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MainAreaErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  MainAreaErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MainAreaErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('MainArea Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red" padding={1}>
          <Text color="red">Error rendering content</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Scroll indicator component
 */
function ScrollIndicator({ 
  direction, 
  colors 
}: { 
  direction: 'up' | 'down'; 
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}): ReactNode {
  return (
    <Box 
      position="absolute" 
      {...(direction === 'up' ? { top: 0 } : { bottom: 0 })}
      width="100%"
      justifyContent="center"
    >
      <Text color={colors.textMuted} dimColor>
        {direction === 'up' ? '▲' : '▼'}
      </Text>
    </Box>
  );
}

/**
 * MainArea component - Main content area
 * 
 * @example
 * ```tsx
 * <MainArea scrollable padding={1}>
 *   <Text>Content goes here</Text>
 * </MainArea>
 * ```
 */
function MainAreaComponent({
  children,
  scrollable = false,
  initialScrollPosition = { row: 0, column: 0 },
  showScrollIndicators = true,
  padding = 0,
  paddingX,
  paddingY,
  backgroundColor,
  borderStyle = 'none',
  flex = true,
  maxHeight,
  minHeight,
  onScroll,
  'data-testid': testId = 'main-area',
}: MainAreaProps): ReactNode {
  const theme = useCurrentTheme();
  const { rows, columns } = useTerminalSize();
  const [scrollPosition, setScrollPosition] = useState(initialScrollPosition);
  const contentRef = useRef<ReactNode>(null);
  
  const effectivePaddingX = paddingX ?? padding;
  const effectivePaddingY = paddingY ?? padding;
  
  // Calculate dimensions
  const availableHeight = rows - 4; // Reserve space for header/footer
  const contentHeight = maxHeight 
    ? Math.min(maxHeight, availableHeight)
    : flex 
      ? availableHeight 
      : undefined;
  
  const contentWidth = columns - (effectivePaddingX * 2) - 4;
  
  // Handle scroll
  const handleScroll = (newPosition: ScrollPosition) => {
    setScrollPosition(newPosition);
    onScroll?.(newPosition);
  };

  return (
    <Box
      flexDirection="column"
      flexGrow={flex ? 1 : undefined}
      height={contentHeight}
      minHeight={minHeight}
      width={columns - 4}
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={theme.colors.border}
      backgroundColor={backgroundColor}
      paddingX={effectivePaddingX}
      paddingY={effectivePaddingY}
      data-testid={testId}
    >
      {/* Top scroll indicator */}
      {scrollable && showScrollIndicators && scrollPosition.row > 0 && (
        <ScrollIndicator direction="up" colors={theme.colors} />
      )}
      
      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
      
      {/* Bottom scroll indicator */}
      {scrollable && showScrollIndicators && (
        <ScrollIndicator direction="down" colors={theme.colors} />
      )}
    </Box>
  );
}

/**
 * PropTypes validation for MainArea
 */
MainAreaComponent.propTypes = {
  children: PropTypes.node.isRequired,
  scrollable: PropTypes.bool,
  initialScrollPosition: PropTypes.shape({
    row: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }),
  showScrollIndicators: PropTypes.bool,
  padding: PropTypes.number,
  paddingX: PropTypes.number,
  paddingY: PropTypes.number,
  backgroundColor: PropTypes.string,
  borderStyle: PropTypes.oneOf(['single', 'double', 'round', 'none'] as const),
  flex: PropTypes.bool,
  maxHeight: PropTypes.number,
  minHeight: PropTypes.number,
  onScroll: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped MainArea with error boundary
 */
export function MainArea(props: MainAreaProps): ReactNode {
  return (
    <MainAreaErrorBoundary>
      <MainAreaComponent {...props} />
    </MainAreaErrorBoundary>
  );
}

/**
 * Scrollable content area
 */
export function ScrollableArea(
  props: Omit<MainAreaProps, 'scrollable'>
): ReactNode {
  return <MainArea {...props} scrollable />;
}

ScrollableArea.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Padded content area
 */
export function PaddedArea(
  props: Omit<MainAreaProps, 'padding'>
): ReactNode {
  return <MainArea {...props} padding={1} />;
}

PaddedArea.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Content panel with border
 */
export function ContentPanel(
  props: Omit<MainAreaProps, 'borderStyle'>
): ReactNode {
  return <MainArea {...props} borderStyle="single" />;
}

ContentPanel.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainArea;
