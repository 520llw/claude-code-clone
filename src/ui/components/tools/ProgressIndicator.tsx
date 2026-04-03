/**
 * Progress Indicator Component for Claude Code Clone
 * Displays progress bars, spinners, and loading states
 * @module components/tools/ProgressIndicator
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme, useThemeAnimations } from '../../hooks/useTheme.js';

/**
 * Progress indicator type
 */
export type ProgressType = 'spinner' | 'bar' | 'dots' | 'pulse';

/**
 * Props for ProgressIndicator component
 */
export interface ProgressIndicatorProps {
  /** Type of progress indicator */
  type?: ProgressType;
  /** Progress value (0-100) for bar type */
  progress?: number;
  /** Status message */
  message?: string;
  /** Whether indeterminate */
  indeterminate?: boolean;
  /** Custom spinner frames */
  spinnerFrames?: string[];
  /** Spinner animation interval in ms */
  spinnerInterval?: number;
  /** Bar width in characters */
  barWidth?: number;
  /** Bar fill character */
  barFillChar?: string;
  /** Bar empty character */
  barEmptyChar?: string;
  /** Whether to show percentage */
  showPercentage?: boolean;
  /** Custom label */
  label?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for spinner component
 */
interface SpinnerProps {
  /** Animation frames */
  frames: string[];
  /** Animation interval */
  interval: number;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Animation enabled */
  enabled: boolean;
}

/**
 * Props for progress bar component
 */
interface ProgressBarProps {
  /** Progress value (0-100) */
  progress: number;
  /** Bar width */
  width: number;
  /** Fill character */
  fillChar: string;
  /** Empty character */
  emptyChar: string;
  /** Show percentage */
  showPercentage: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Indeterminate mode */
  indeterminate: boolean;
}

/**
 * Props for dots indicator
 */
interface DotsIndicatorProps {
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Animation enabled */
  enabled: boolean;
}

/**
 * Props for pulse indicator
 */
interface PulseIndicatorProps {
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Animation enabled */
  enabled: boolean;
}

/**
 * Error boundary for ProgressIndicator
 */
interface ProgressIndicatorErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ProgressIndicatorErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ProgressIndicatorErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ProgressIndicatorErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ProgressIndicator Error:', error, errorInfo);
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
 * Default spinner frames
 */
const DEFAULT_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Spinner component
 */
function SpinnerComponent({ frames, interval, colors, enabled }: SpinnerProps): ReactNode {
  const [frameIndex, setFrameIndex] = useState(0);
  
  useEffect(() => {
    if (!enabled) return;
    
    const timer = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [frames.length, interval, enabled]);
  
  return (
    <Text color={colors.status.loading}>
      {frames[frameIndex]}
    </Text>
  );
}

/**
 * Progress bar component
 */
function ProgressBarComponent({
  progress,
  width,
  fillChar,
  emptyChar,
  showPercentage,
  colors,
  indeterminate,
}: ProgressBarProps): ReactNode {
  const [indeterminatePos, setIndeterminatePos] = useState(0);
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!indeterminate || !animations.enabled) return;
    
    const timer = setInterval(() => {
      setIndeterminatePos(p => (p + 1) % (width - 3));
    }, 100 / animations.speed);
    
    return () => clearInterval(timer);
  }, [indeterminate, width, animations.enabled, animations.speed]);
  
  if (indeterminate) {
    const bar = Array(width).fill(emptyChar);
    for (let i = 0; i < 3; i++) {
      const pos = (indeterminatePos + i) % width;
      bar[pos] = fillChar;
    }
    
    return (
      <Box flexDirection="row">
        <Text color={colors.status.loading}>
          [{bar.join('')}]
        </Text>
        {showPercentage && (
          <Text color={colors.textMuted}> ???%</Text>
        )}
      </Box>
    );
  }
  
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;
  
  const bar = fillChar.repeat(filled) + emptyChar.repeat(empty);
  
  return (
    <Box flexDirection="row">
      <Text color={colors.status.loading}>
        [{bar}]
      </Text>
      {showPercentage && (
        <Text color={colors.textMuted}> {clampedProgress.toFixed(0)}%</Text>
      )}
    </Box>
  );
}

/**
 * Dots indicator component
 */
function DotsIndicatorComponent({ colors, enabled }: DotsIndicatorProps): ReactNode {
  const [dotCount, setDotCount] = useState(0);
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!enabled) return;
    
    const timer = setInterval(() => {
      setDotCount(c => (c + 1) % 4);
    }, 500 / animations.speed);
    
    return () => clearInterval(timer);
  }, [enabled, animations.speed]);
  
  return (
    <Text color={colors.status.loading}>
      {'.'.repeat(dotCount)}
    </Text>
  );
}

/**
 * Pulse indicator component
 */
function PulseIndicatorComponent({ colors, enabled }: PulseIndicatorProps): ReactNode {
  const [intensity, setIntensity] = useState(0);
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!enabled) return;
    
    let direction = 1;
    const timer = setInterval(() => {
      setIntensity(i => {
        const newI = i + direction * 0.1;
        if (newI >= 1) direction = -1;
        if (newI <= 0) direction = 1;
        return Math.max(0, Math.min(1, newI));
      });
    }, 100 / animations.speed);
    
    return () => clearInterval(timer);
  }, [enabled, animations.speed]);
  
  const pulseChars = ['○', '◔', '◑', '◕', '●'];
  const charIndex = Math.floor(intensity * (pulseChars.length - 1));
  
  return (
    <Text color={colors.status.loading}>
      {pulseChars[charIndex]}
    </Text>
  );
}

/**
 * ProgressIndicator component - Displays loading/progress state
 * 
 * @example
 * ```tsx
 * // Spinner
 * <ProgressIndicator type="spinner" message="Loading..." />
 * 
 * // Progress bar
 * <ProgressIndicator type="bar" progress={75} message="Uploading..." />
 * 
 * // Indeterminate bar
 * <ProgressIndicator type="bar" indeterminate message="Processing..." />
 * ```
 */
function ProgressIndicatorComponent({
  type = 'spinner',
  progress = 0,
  message,
  indeterminate = false,
  spinnerFrames = DEFAULT_SPINNER_FRAMES,
  spinnerInterval = 80,
  barWidth = 30,
  barFillChar = '█',
  barEmptyChar = '░',
  showPercentage = true,
  label,
  'data-testid': testId = 'progress-indicator',
}: ProgressIndicatorProps): ReactNode {
  const theme = useCurrentTheme();
  const animations = useThemeAnimations();
  
  const renderIndicator = () => {
    switch (type) {
      case 'spinner':
        return (
          <SpinnerComponent
            frames={spinnerFrames}
            interval={spinnerInterval}
            colors={theme.colors}
            enabled={animations.enabled}
          />
        );
        
      case 'bar':
        return (
          <ProgressBarComponent
            progress={progress}
            width={barWidth}
            fillChar={barFillChar}
            emptyChar={barEmptyChar}
            showPercentage={showPercentage}
            colors={theme.colors}
            indeterminate={indeterminate}
          />
        );
        
      case 'dots':
        return (
          <DotsIndicatorComponent
            colors={theme.colors}
            enabled={animations.enabled}
          />
        );
        
      case 'pulse':
        return (
          <PulseIndicatorComponent
            colors={theme.colors}
            enabled={animations.enabled}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <Box
      flexDirection="row"
      gap={1}
      data-testid={testId}
    >
      {label && (
        <Text color={theme.colors.textMuted}>{label}</Text>
      )}
      
      {renderIndicator()}
      
      {message && (
        <Text color={theme.colors.text}>{message}</Text>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for ProgressIndicator
 */
ProgressIndicatorComponent.propTypes = {
  type: PropTypes.oneOf(['spinner', 'bar', 'dots', 'pulse'] as const),
  progress: PropTypes.number,
  message: PropTypes.string,
  indeterminate: PropTypes.bool,
  spinnerFrames: PropTypes.arrayOf(PropTypes.string),
  spinnerInterval: PropTypes.number,
  barWidth: PropTypes.number,
  barFillChar: PropTypes.string,
  barEmptyChar: PropTypes.string,
  showPercentage: PropTypes.bool,
  label: PropTypes.string,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ProgressIndicator with error boundary
 */
export function ProgressIndicator(props: ProgressIndicatorProps): ReactNode {
  return (
    <ProgressIndicatorErrorBoundary>
      <ProgressIndicatorComponent {...props} />
    </ProgressIndicatorErrorBoundary>
  );
}

/**
 * Simple spinner component
 */
export function Spinner({ message }: { message?: string }): ReactNode {
  return <ProgressIndicator type="spinner" message={message} />;
}

Spinner.propTypes = {
  message: PropTypes.string,
};

/**
 * Progress bar component
 */
export function ProgressBar({
  progress,
  message,
  showPercentage = true,
}: {
  progress: number;
  message?: string;
  showPercentage?: boolean;
}): ReactNode {
  return (
    <ProgressIndicator
      type="bar"
      progress={progress}
      message={message}
      showPercentage={showPercentage}
    />
  );
}

ProgressBar.propTypes = {
  progress: PropTypes.number.isRequired,
  message: PropTypes.string,
  showPercentage: PropTypes.bool,
};

/**
 * Indeterminate progress component
 */
export function IndeterminateProgress({ message }: { message?: string }): ReactNode {
  return (
    <ProgressIndicator
      type="bar"
      indeterminate
      message={message}
      showPercentage={false}
    />
  );
}

IndeterminateProgress.propTypes = {
  message: PropTypes.string,
};

/**
 * Loading dots component
 */
export function LoadingDots(): ReactNode {
  return <ProgressIndicator type="dots" />;
}

/**
 * Pulse indicator component
 */
export function Pulse(): ReactNode {
  return <ProgressIndicator type="pulse" />;
}

export default ProgressIndicator;
