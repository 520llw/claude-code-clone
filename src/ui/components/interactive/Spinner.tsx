/**
 * Spinner Component for Claude Code Clone
 * Loading indicators with various styles
 * @module components/interactive/Spinner
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme, useThemeAnimations } from '../../hooks/useTheme.js';

/**
 * Spinner type
 */
export type SpinnerType = 
  | 'dots' 
  | 'line' 
  | 'arrow' 
  | 'bounce'
  | 'circle'
  | 'moon'
  | 'hearts'
  | 'clock'
  | 'earth'
  | 'custom';

/**
 * Props for Spinner component
 */
export interface SpinnerProps {
  /** Spinner type */
  type?: SpinnerType;
  /** Custom frames (for custom type) */
  frames?: string[];
  /** Animation interval in ms */
  interval?: number;
  /** Label text */
  label?: string;
  /** Label position */
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  /** Text color */
  color?: string;
  /** Whether to show checkmark when done */
  showCheckmark?: boolean;
  /** Whether loading is complete */
  isComplete?: boolean;
  /** Completion message */
  completeMessage?: string;
  /** Custom complete icon */
  completeIcon?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Predefined spinner frames
 */
const SPINNER_FRAMES: Record<SpinnerType, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bounce: ['( ●    )', '(  ●   )', '(   ●  )', '(    ● )', '(     ●)', '(    ● )', '(   ●  )', '(  ●   )', '( ●    )', '(●     )'],
  circle: ['◐', '◓', '◑', '◒'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  hearts: ['💛', '💙', '💜', '💚', '❤️'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
  earth: ['🌍', '🌎', '🌏'],
  custom: [],
};

/**
 * Error boundary for Spinner
 */
interface SpinnerErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SpinnerErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SpinnerErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SpinnerErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Spinner Error:', error, errorInfo);
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
 * Spinner component - Loading indicators
 * 
 * @example
 * ```tsx
 * <Spinner type="dots" label="Loading..." />
 * <Spinner type="line" label="Processing" />
 * ```
 */
function SpinnerComponent({
  type = 'dots',
  frames: customFrames,
  interval: customInterval,
  label,
  labelPosition = 'right',
  color: customColor,
  showCheckmark = true,
  isComplete = false,
  completeMessage = 'Done',
  completeIcon = '✓',
  'data-testid': testId = 'spinner',
}: SpinnerProps): ReactNode {
  const theme = useCurrentTheme();
  const animations = useThemeAnimations();
  const [frameIndex, setFrameIndex] = useState(0);
  
  const frames = type === 'custom' && customFrames 
    ? customFrames 
    : SPINNER_FRAMES[type];
  
  const interval = customInterval || 80;
  const color = customColor || theme.colors.status.loading;
  
  useEffect(() => {
    if (isComplete || !animations.enabled) return;
    
    const timer = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, interval / animations.speed);
    
    return () => clearInterval(timer);
  }, [frames.length, interval, isComplete, animations.enabled, animations.speed]);
  
  // Render completion state
  if (isComplete && showCheckmark) {
    return (
      <Box flexDirection="row" gap={1} data-testid={testId}>
        <Text color={theme.colors.status.success}>{completeIcon}</Text>
        {label && <Text color={theme.colors.text}>{completeMessage || label}</Text>}
      </Box>
    );
  }
  
  const currentFrame = frames[frameIndex] || frames[0];
  
  // Render based on label position
  const renderSpinner = () => (
    <Text color={color}>{currentFrame}</Text>
  );
  
  const renderLabel = () => label ? (
    <Text color={theme.colors.text}>{label}</Text>
  ) : null;
  
  switch (labelPosition) {
    case 'left':
      return (
        <Box flexDirection="row" gap={1} data-testid={testId}>
          {renderLabel()}
          {renderSpinner()}
        </Box>
      );
    case 'top':
      return (
        <Box flexDirection="column" data-testid={testId}>
          {renderLabel()}
          {renderSpinner()}
        </Box>
      );
    case 'bottom':
      return (
        <Box flexDirection="column" data-testid={testId}>
          {renderSpinner()}
          {renderLabel()}
        </Box>
      );
    case 'right':
    default:
      return (
        <Box flexDirection="row" gap={1} data-testid={testId}>
          {renderSpinner()}
          {renderLabel()}
        </Box>
      );
  }
}

/**
 * PropTypes validation for Spinner
 */
SpinnerComponent.propTypes = {
  type: PropTypes.oneOf([
    'dots', 'line', 'arrow', 'bounce', 'circle', 'moon', 'hearts', 'clock', 'earth', 'custom'
  ] as const),
  frames: PropTypes.arrayOf(PropTypes.string),
  interval: PropTypes.number,
  label: PropTypes.string,
  labelPosition: PropTypes.oneOf(['left', 'right', 'top', 'bottom'] as const),
  color: PropTypes.string,
  showCheckmark: PropTypes.bool,
  isComplete: PropTypes.bool,
  completeMessage: PropTypes.string,
  completeIcon: PropTypes.string,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped Spinner with error boundary
 */
export function Spinner(props: SpinnerProps): ReactNode {
  return (
    <SpinnerErrorBoundary>
      <SpinnerComponent {...props} />
    </SpinnerErrorBoundary>
  );
}

/**
 * Dots spinner (most common)
 */
export function DotsSpinner({ label }: { label?: string }): ReactNode {
  return <Spinner type="dots" label={label} />;
}

DotsSpinner.propTypes = {
  label: PropTypes.string,
};

/**
 * Line spinner
 */
export function LineSpinner({ label }: { label?: string }): ReactNode {
  return <Spinner type="line" label={label} />;
}

LineSpinner.propTypes = {
  label: PropTypes.string,
};

/**
 * Loading state with spinner and text
 */
export function LoadingState({
  message,
  type = 'dots',
}: {
  message: string;
  type?: SpinnerType;
}): ReactNode {
  return <Spinner type={type} label={message} />;
}

LoadingState.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['dots', 'line', 'arrow', 'bounce', 'circle', 'moon', 'hearts', 'clock', 'earth', 'custom']),
};

/**
 * Success state (checkmark)
 */
export function SuccessState({
  message = 'Success',
}: {
  message?: string;
}): ReactNode {
  return (
    <Spinner 
      isComplete 
      completeMessage={message} 
      completeIcon="✓"
      showCheckmark
    />
  );
}

SuccessState.propTypes = {
  message: PropTypes.string,
};

/**
 * Error state (X mark)
 */
export function ErrorState({
  message = 'Error',
}: {
  message?: string;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.colors.status.error}>✗</Text>
      <Text color={theme.colors.status.error}>{message}</Text>
    </Box>
  );
}

ErrorState.propTypes = {
  message: PropTypes.string,
};

export default Spinner;
