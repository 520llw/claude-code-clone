/**
 * Tool Status Component for Claude Code Clone
 * Displays current tool execution status
 * @module components/status/ToolStatus
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme, useThemeAnimations } from '../../hooks/useTheme.js';

/**
 * Tool execution status
 */
export type ToolExecutionStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Props for ToolStatus component
 */
export interface ToolStatusProps {
  /** Tool name */
  toolName: string;
  /** Execution status */
  status: ToolExecutionStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Status message */
  message?: string;
  /** Execution duration in ms */
  duration?: number;
  /** Show progress bar */
  showProgressBar?: boolean;
  /** Show duration */
  showDuration?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom icon */
  icon?: string;
  /** Callback on click */
  onClick?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for ToolStatus
 */
interface ToolStatusErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ToolStatusErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ToolStatusErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ToolStatusErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ToolStatus Error:', error, errorInfo);
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
 * Status configuration
 */
const STATUS_CONFIG: Record<ToolExecutionStatus, {
  icon: string;
  label: string;
  animate: boolean;
}> = {
  idle: { icon: '○', label: 'Idle', animate: false },
  pending: { icon: '⏳', label: 'Pending', animate: false },
  running: { icon: '▶', label: 'Running', animate: true },
  completed: { icon: '✓', label: 'Completed', animate: false },
  failed: { icon: '✗', label: 'Failed', animate: false },
  cancelled: { icon: '⊘', label: 'Cancelled', animate: false },
};

/**
 * Animated running indicator
 */
function RunningIndicator({ colors }: { colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!animations.enabled) return;
    
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 80 / animations.speed);
    
    return () => clearInterval(interval);
  }, [animations.enabled, animations.speed]);
  
  return <Text color={colors.status.loading}>{frames[frame]}</Text>;
}

/**
 * Progress bar component
 */
function ProgressBar({ 
  progress, 
  width = 20,
  colors,
}: { 
  progress: number; 
  width?: number;
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}): ReactNode {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;
  
  return (
    <Box flexDirection="row">
      <Text color={colors.status.loading}>
        {'█'.repeat(filled)}
      </Text>
      <Text color={colors.textMuted}>
        {'░'.repeat(empty)}
      </Text>
      <Text color={colors.textMuted}> {clampedProgress.toFixed(0)}%</Text>
    </Box>
  );
}

/**
 * Format duration
 */
function formatDuration(ms?: number): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * ToolStatus component - Displays tool execution status
 * 
 * @example
 * ```tsx
 * <ToolStatus 
 *   toolName="bash"
 *   status="running"
 *   message="Executing command..."
 *   progress={45}
 * />
 * ```
 */
function ToolStatusComponent({
  toolName,
  status,
  progress,
  message,
  duration,
  showProgressBar = true,
  showDuration = true,
  compact = false,
  icon: customIcon,
  onClick,
  'data-testid': testId = 'tool-status',
}: ToolStatusProps): ReactNode {
  const theme = useCurrentTheme();
  const config = STATUS_CONFIG[status];
  
  // Get color based on status
  const color = {
    idle: theme.colors.textMuted,
    pending: theme.colors.status.pending,
    running: theme.colors.status.loading,
    completed: theme.colors.status.success,
    failed: theme.colors.status.error,
    cancelled: theme.colors.status.warning,
  }[status];
  
  // Compact mode
  if (compact) {
    return (
      <Box flexDirection="row" gap={1} onPress={onClick} data-testid={testId}>
        <Text color={color}>
          {customIcon || config.icon}
        </Text>
        <Text color={color} bold>{toolName}</Text>
        {status === 'running' && progress !== undefined && (
          <Text color={theme.colors.textMuted}>{progress}%</Text>
        )}
        {showDuration && duration && status !== 'running' && (
          <Text color={theme.colors.textMuted}>({formatDuration(duration)})</Text>
        )}
      </Box>
    );
  }
  
  // Full mode
  return (
    <Box 
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      paddingX={1}
      paddingY={1}
      onPress={onClick}
      data-testid={testId}
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        {/* Icon */}
        {status === 'running' ? (
          <RunningIndicator colors={theme.colors} />
        ) : (
          <Text color={color}>
            {customIcon || config.icon}
          </Text>
        )}
        
        {/* Tool name */}
        <Text color={color} bold>
          {toolName}
        </Text>
        
        {/* Status label */}
        <Text color={color}>
          {config.label}
        </Text>
        
        {/* Duration */}
        {showDuration && duration && (
          <Text color={theme.colors.textMuted}>
            ({formatDuration(duration)})
          </Text>
        )}
      </Box>
      
      {/* Message */}
      {message && (
        <Box marginTop={1}>
          <Text color={theme.colors.text}>{message}</Text>
        </Box>
      )}
      
      {/* Progress bar */}
      {showProgressBar && status === 'running' && progress !== undefined && (
        <Box marginTop={1}>
          <ProgressBar progress={progress} colors={theme.colors} />
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for ToolStatus
 */
ToolStatusComponent.propTypes = {
  toolName: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['idle', 'pending', 'running', 'completed', 'failed', 'cancelled'] as const).isRequired,
  progress: PropTypes.number,
  message: PropTypes.string,
  duration: PropTypes.number,
  showProgressBar: PropTypes.bool,
  showDuration: PropTypes.bool,
  compact: PropTypes.bool,
  icon: PropTypes.string,
  onClick: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ToolStatus with error boundary
 */
export function ToolStatus(props: ToolStatusProps): ReactNode {
  return (
    <ToolStatusErrorBoundary>
      <ToolStatusComponent {...props} />
    </ToolStatusErrorBoundary>
  );
}

/**
 * Running tool indicator
 */
export function RunningTool({
  toolName,
  message,
}: {
  toolName: string;
  message?: string;
}): ReactNode {
  return (
    <ToolStatus
      toolName={toolName}
      status="running"
      message={message}
      compact
    />
  );
}

RunningTool.propTypes = {
  toolName: PropTypes.string.isRequired,
  message: PropTypes.string,
};

/**
 * Tool execution result
 */
export function ToolResult({
  toolName,
  success,
  duration,
}: {
  toolName: string;
  success: boolean;
  duration?: number;
}): ReactNode {
  return (
    <ToolStatus
      toolName={toolName}
      status={success ? 'completed' : 'failed'}
      duration={duration}
      compact
    />
  );
}

ToolResult.propTypes = {
  toolName: PropTypes.string.isRequired,
  success: PropTypes.bool.isRequired,
  duration: PropTypes.number,
};

export default ToolStatus;
