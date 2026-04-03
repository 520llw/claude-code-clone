/**
 * Footer Component for Claude Code Clone
 * Bottom status bar with system information
 * @module components/layout/Footer
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Status item for footer
 */
export interface FooterStatusItem {
  /** Item ID */
  id: string;
  /** Display label */
  label?: string;
  /** Item value */
  value: string;
  /** Item icon */
  icon?: string;
  /** Item color */
  color?: string;
  /** Whether highlighted */
  highlighted?: boolean;
}

/**
 * Props for Footer component
 */
export interface FooterProps {
  /** Left side status items */
  leftItems?: FooterStatusItem[];
  /** Right side status items */
  rightItems?: FooterStatusItem[];
  /** Center content */
  centerContent?: ReactNode;
  /** Show mode indicator */
  mode?: string;
  /** Show keyboard mode */
  keyboardMode?: 'normal' | 'insert' | 'visual' | 'command';
  /** Custom left content */
  leftContent?: ReactNode;
  /** Custom right content */
  rightContent?: ReactNode;
  /** Footer height */
  height?: number;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'none';
  /** Background color */
  backgroundColor?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for Footer
 */
interface FooterErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class FooterErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  FooterErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FooterErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Footer Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">Footer Error</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Status item component
 */
function StatusItem({ item, colors }: { item: FooterStatusItem; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  const color = item.color || (item.highlighted ? colors.primary : colors.textMuted);
  
  return (
    <Box flexDirection="row" gap={1}>
      {item.icon && (
        <Text color={color}>{item.icon}</Text>
      )}
      {item.label && (
        <Text color={colors.textMuted}>{item.label}:</Text>
      )}
      <Text color={color} bold={item.highlighted}>
        {item.value}
      </Text>
    </Box>
  );
}

/**
 * Keyboard mode indicator
 */
function KeyboardModeIndicator({ 
  mode, 
  colors 
}: { 
  mode: string; 
  colors: ReturnType<typeof useCurrentTheme>['colors'] 
}): ReactNode {
  const modeColors: Record<string, string> = {
    normal: colors.status.success,
    insert: colors.status.info,
    visual: colors.status.warning,
    command: colors.primary,
  };
  
  return (
    <Box 
      paddingX={1}
      backgroundColor={modeColors[mode] || colors.textMuted}
    >
      <Text color={colors.background} bold>
        {mode.toUpperCase()}
      </Text>
    </Box>
  );
}

/**
 * Footer component - Bottom status bar
 * 
 * @example
 * ```tsx
 * <Footer 
 *   leftItems={[
 *     { id: 'mode', value: 'NORMAL', color: 'green' },
 *   ]}
 *   rightItems={[
 *     { id: 'tokens', label: 'Tokens', value: '1500', icon: '🪙' },
 *   ]}
 * />
 * ```
 */
function FooterComponent({
  leftItems = [],
  rightItems = [],
  centerContent,
  mode,
  keyboardMode,
  leftContent,
  rightContent,
  height = 1,
  borderStyle = 'single',
  backgroundColor,
  'data-testid': testId = 'footer',
}: FooterProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const bgColor = backgroundColor || theme.colors.surface;
  
  return (
    <Box
      flexDirection="column"
      height={height}
      width={columns}
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={theme.colors.border}
      backgroundColor={bgColor}
      paddingX={1}
      data-testid={testId}
    >
      <Box flexDirection="row" width={columns - 2}>
        {/* Left section */}
        <Box flexDirection="row" gap={2}>
          {leftContent}
          
          {/* Keyboard mode */}
          {keyboardMode && (
            <KeyboardModeIndicator mode={keyboardMode} colors={theme.colors} />
          )}
          
          {/* Mode indicator */}
          {mode && !keyboardMode && (
            <Text color={theme.colors.primary} bold>
              {mode}
            </Text>
          )}
          
          {/* Left items */}
          {leftItems.map(item => (
            <StatusItem key={item.id} item={item} colors={theme.colors} />
          ))}
        </Box>
        
        {/* Center section */}
        {centerContent && (
          <>
            <Spacer />
            <Box>{centerContent}</Box>
            <Spacer />
          </>
        )}
        {!centerContent && <Spacer />}
        
        {/* Right section */}
        <Box flexDirection="row" gap={2}>
          {/* Right items */}
          {rightItems.map(item => (
            <StatusItem key={item.id} item={item} colors={theme.colors} />
          ))}
          
          {rightContent}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for Footer
 */
FooterComponent.propTypes = {
  leftItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
      value: PropTypes.string.isRequired,
      icon: PropTypes.string,
      color: PropTypes.string,
      highlighted: PropTypes.bool,
    })
  ),
  rightItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
      value: PropTypes.string.isRequired,
      icon: PropTypes.string,
      color: PropTypes.string,
      highlighted: PropTypes.bool,
    })
  ),
  centerContent: PropTypes.node,
  mode: PropTypes.string,
  keyboardMode: PropTypes.oneOf(['normal', 'insert', 'visual', 'command'] as const),
  leftContent: PropTypes.node,
  rightContent: PropTypes.node,
  height: PropTypes.number,
  borderStyle: PropTypes.oneOf(['single', 'double', 'none'] as const),
  backgroundColor: PropTypes.string,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped Footer with error boundary
 */
export function Footer(props: FooterProps): ReactNode {
  return (
    <FooterErrorBoundary>
      <FooterComponent {...props} />
    </FooterErrorBoundary>
  );
}

/**
 * Simple status bar
 */
export function StatusBar({
  status,
  info,
}: {
  status: string;
  info?: string;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Footer
      leftItems={[{ id: 'status', value: status }]}
      rightItems={info ? [{ id: 'info', value: info }] : []}
    />
  );
}

StatusBar.propTypes = {
  status: PropTypes.string.isRequired,
  info: PropTypes.string,
};

/**
 * Vim-style mode indicator footer
 */
export function VimFooter({
  mode,
  filename,
  lineInfo,
}: {
  mode: 'normal' | 'insert' | 'visual' | 'command';
  filename?: string;
  lineInfo?: string;
}): ReactNode {
  return (
    <Footer
      keyboardMode={mode}
      centerContent={filename ? <Text>{filename}</Text> : undefined}
      rightItems={lineInfo ? [{ id: 'lines', value: lineInfo }] : []}
    />
  );
}

VimFooter.propTypes = {
  mode: PropTypes.oneOf(['normal', 'insert', 'visual', 'command'] as const).isRequired,
  filename: PropTypes.string,
  lineInfo: PropTypes.string,
};

export default Footer;
