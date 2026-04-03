/**
 * Bash Execution Component for Claude Code Clone
 * Displays command execution with real-time output
 * @module components/tools/BashExecution
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect, useRef } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useThemeAnimations } from '../../hooks/useTheme.js';

/**
 * Props for BashExecution component
 */
export interface BashExecutionProps {
  /** Command being executed */
  command: string;
  /** Current stdout output */
  stdout?: string;
  /** Current stderr output */
  stderr?: string;
  /** Exit code (undefined if still running) */
  exitCode?: number;
  /** Execution status */
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  /** Working directory */
  cwd?: string;
  /** Execution start time */
  startTime?: Date;
  /** Execution end time */
  endTime?: Date;
  /** Maximum height for output */
  maxOutputHeight?: number;
  /** Whether output is collapsed */
  defaultCollapsed?: boolean;
  /** Whether to show command */
  showCommand?: boolean;
  /** Whether to show timing info */
  showTiming?: boolean;
  /** Whether to show exit code */
  showExitCode?: boolean;
  /** Custom prompt string */
  prompt?: string;
  /** Callback when collapse is toggled */
  onToggleCollapse?: (collapsed: boolean) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for execution status indicator
 */
interface StatusIndicatorProps {
  /** Current status */
  status: BashExecutionProps['status'];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Props for command display
 */
interface CommandDisplayProps {
  /** Command string */
  command: string;
  /** Prompt */
  prompt: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Props for output display
 */
interface OutputDisplayProps {
  /** stdout content */
  stdout: string;
  /** stderr content */
  stderr: string;
  /** Maximum height */
  maxHeight: number;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Whether collapsed */
  collapsed: boolean;
}

/**
 * Error boundary for BashExecution
 */
interface BashExecutionErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class BashExecutionErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  BashExecutionErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): BashExecutionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('BashExecution Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering bash execution</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Status indicator component
 */
function StatusIndicator({ status, colors }: StatusIndicatorProps): ReactNode {
  const statusConfig = {
    idle: { icon: '○', color: colors.textMuted, label: 'Idle' },
    running: { icon: '▶', color: colors.status.loading, label: 'Running' },
    completed: { icon: '✓', color: colors.status.success, label: 'Completed' },
    error: { icon: '✗', color: colors.status.error, label: 'Error' },
    cancelled: { icon: '⊘', color: colors.status.warning, label: 'Cancelled' },
  };
  
  const config = statusConfig[status];
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={config.color}>{config.icon}</Text>
      <Text color={config.color}>{config.label}</Text>
    </Box>
  );
}

/**
 * Running indicator with animation
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
  
  return (
    <Text color={colors.status.loading}>
      {frames[frame]}
    </Text>
  );
}

/**
 * Command display component
 */
function CommandDisplay({ command, prompt, colors }: CommandDisplayProps): ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={colors.status.success}>{prompt}</Text>
      <Text color={colors.text}>{command}</Text>
    </Box>
  );
}

/**
 * Output display component
 */
function OutputDisplay({ stdout, stderr, maxHeight, colors, collapsed }: OutputDisplayProps): ReactNode {
  if (collapsed) return null;
  
  const stdoutLines = stdout.split('\n').filter(line => line.length > 0);
  const stderrLines = stderr.split('\n').filter(line => line.length > 0);
  
  const displayStdout = stdoutLines.slice(-maxHeight);
  const displayStderr = stderrLines.slice(-maxHeight);
  const hasMoreStdout = stdoutLines.length > maxHeight;
  const hasMoreStderr = stderrLines.length > maxHeight;
  
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* stdout */}
      {stdout && (
        <Box flexDirection="column">
          <Text color={colors.textMuted} dimColor>stdout:</Text>
          <Box 
            flexDirection="column" 
            paddingLeft={2}
            borderStyle="single"
            borderColor={colors.border}
          >
            {hasMoreStdout && (
              <Text color={colors.textMuted} dimColor>
                ... {stdoutLines.length - maxHeight} lines hidden ...
              </Text>
            )}
            {displayStdout.map((line, index) => (
              <Text key={`out-${index}`} color={colors.text}>
                {line}
              </Text>
            ))}
            {displayStdout.length === 0 && (
              <Text color={colors.textMuted} dimColor>(empty)</Text>
            )}
          </Box>
        </Box>
      )}
      
      {/* stderr */}
      {stderr && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.status.error} dimColor>stderr:</Text>
          <Box 
            flexDirection="column" 
            paddingLeft={2}
            borderStyle="single"
            borderColor={colors.status.error}
          >
            {hasMoreStderr && (
              <Text color={colors.textMuted} dimColor>
                ... {stderrLines.length - maxHeight} lines hidden ...
              </Text>
            )}
            {displayStderr.map((line, index) => (
              <Text key={`err-${index}`} color={colors.status.error}>
                {line}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Format duration to human-readable string
 */
function formatDuration(startTime: Date, endTime?: Date): string {
  const end = endTime || new Date();
  const ms = end.getTime() - startTime.getTime();
  
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * BashExecution component - Displays command execution
 * 
 * @example
 * ```tsx
 * <BashExecution 
 *   command="ls -la"
 *   status="running"
 *   stdout="file1.txt\nfile2.txt"
 *   cwd="/home/user"
 * />
 * ```
 */
function BashExecutionComponent({
  command,
  stdout = '',
  stderr = '',
  exitCode,
  status,
  cwd,
  startTime,
  endTime,
  maxOutputHeight = 20,
  defaultCollapsed = false,
  showCommand = true,
  showTiming = true,
  showExitCode = true,
  prompt = '$',
  onToggleCollapse,
  onCancel,
  'data-testid': testId = 'bash-execution',
}: BashExecutionProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isRunning = status === 'running';
  const hasOutput = stdout.length > 0 || stderr.length > 0;
  
  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onToggleCollapse?.(newCollapsed);
  };

  return (
    <Box
      flexDirection="column"
      width={Math.min(columns - 4, 100)}
      borderStyle="single"
      borderColor={
        status === 'error' ? theme.colors.status.error :
        status === 'completed' ? theme.colors.status.success :
        theme.colors.border
      }
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text bold color={theme.colors.primary}>
          🖥 Bash
        </Text>
        
        <StatusIndicator status={status} colors={theme.colors} />
        
        {isRunning && <RunningIndicator colors={theme.colors} />}
        
        <Spacer />
        
        {showTiming && startTime && (
          <Text color={theme.colors.textMuted}>
            {formatDuration(startTime, endTime)}
          </Text>
        )}
        
        {showExitCode && exitCode !== undefined && (
          <Text color={exitCode === 0 ? theme.colors.status.success : theme.colors.status.error}>
            exit: {exitCode}
          </Text>
        )}
        
        {isRunning && onCancel && (
          <Box onPress={onCancel}>
            <Text color={theme.colors.status.error}>[Cancel]</Text>
          </Box>
        )}
        
        {hasOutput && (
          <Box onPress={handleToggleCollapse}>
            <Text color={theme.colors.textMuted}>
              {collapsed ? '[Show]' : '[Hide]'}
            </Text>
          </Box>
        )}
      </Box>
      
      {/* Working directory */}
      {cwd && (
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Text color={theme.colors.textMuted}>in</Text>
          <Text color={theme.colors.status.info}>{cwd}</Text>
        </Box>
      )}
      
      {/* Command */}
      {showCommand && (
        <Box marginTop={1}>
          <CommandDisplay 
            command={command} 
            prompt={prompt}
            colors={theme.colors} 
          />
        </Box>
      )}
      
      {/* Output */}
      <OutputDisplay
        stdout={stdout}
        stderr={stderr}
        maxHeight={maxOutputHeight}
        colors={theme.colors}
        collapsed={collapsed}
      />
    </Box>
  );
}

/**
 * PropTypes validation for BashExecution
 */
BashExecutionComponent.propTypes = {
  command: PropTypes.string.isRequired,
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  exitCode: PropTypes.number,
  status: PropTypes.oneOf(['idle', 'running', 'completed', 'error', 'cancelled'] as const).isRequired,
  cwd: PropTypes.string,
  startTime: PropTypes.instanceOf(Date),
  endTime: PropTypes.instanceOf(Date),
  maxOutputHeight: PropTypes.number,
  defaultCollapsed: PropTypes.bool,
  showCommand: PropTypes.bool,
  showTiming: PropTypes.bool,
  showExitCode: PropTypes.bool,
  prompt: PropTypes.string,
  onToggleCollapse: PropTypes.func,
  onCancel: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped BashExecution with error boundary
 */
export function BashExecution(props: BashExecutionProps): ReactNode {
  return (
    <BashExecutionErrorBoundary>
      <BashExecutionComponent {...props} />
    </BashExecutionErrorBoundary>
  );
}

/**
 * Compact bash execution variant
 */
export function CompactBashExecution({
  command,
  status,
  exitCode,
}: Pick<BashExecutionProps, 'command' | 'status' | 'exitCode'>): ReactNode {
  const theme = useCurrentTheme();
  
  const statusIcon = {
    idle: '○',
    running: '▶',
    completed: '✓',
    error: '✗',
    cancelled: '⊘',
  };
  
  const statusColor = {
    idle: theme.colors.textMuted,
    running: theme.colors.status.loading,
    completed: theme.colors.status.success,
    error: theme.colors.status.error,
    cancelled: theme.colors.status.warning,
  };
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={statusColor[status]}>{statusIcon[status]}</Text>
      <Text color={theme.colors.textMuted}>$</Text>
      <Text color={theme.colors.text}>{command}</Text>
      {exitCode !== undefined && (
        <Text color={exitCode === 0 ? theme.colors.status.success : theme.colors.status.error}>
          ({exitCode})
        </Text>
      )}
    </Box>
  );
}

CompactBashExecution.propTypes = {
  command: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['idle', 'running', 'completed', 'error', 'cancelled'] as const).isRequired,
  exitCode: PropTypes.number,
};

/**
 * Bash execution result (completed state)
 */
export function BashResult({
  command,
  stdout,
  stderr,
  exitCode,
  duration,
}: {
  command: string;
  stdout?: string;
  stderr?: string;
  exitCode: number;
  duration?: string;
}): ReactNode {
  return (
    <BashExecution
      command={command}
      stdout={stdout}
      stderr={stderr}
      exitCode={exitCode}
      status={exitCode === 0 ? 'completed' : 'error'}
      showTiming={!!duration}
      startTime={duration ? new Date(Date.now() - parseInt(duration)) : undefined}
      endTime={new Date()}
    />
  );
}

BashResult.propTypes = {
  command: PropTypes.string.isRequired,
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  exitCode: PropTypes.number.isRequired,
  duration: PropTypes.string,
};

export default BashExecution;
