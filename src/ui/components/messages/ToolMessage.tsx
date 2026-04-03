/**
 * Tool Message Component for Claude Code Clone
 * Displays tool execution results with status indicators
 * @module components/messages/ToolMessage
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { ToolMessage as ToolMessageType, ToolOutput, BashOutput, FileReadOutput, FileWriteOutput, FileEditOutput, SearchOutput } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Props for ToolMessage component
 */
export interface ToolMessageProps {
  /** The tool message to display */
  message: ToolMessageType;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to show expanded output */
  defaultExpanded?: boolean;
  /** Maximum width of the message */
  maxWidth?: number;
  /** Maximum height for output */
  maxOutputHeight?: number;
  /** Custom render function for output */
  renderOutput?: (output: ToolOutput) => ReactNode;
  /** Callback when expand/collapse is toggled */
  onToggleExpand?: (expanded: boolean) => void;
  /** Additional styling */
  style?: {
    padding?: number;
    margin?: number;
    border?: boolean;
  };
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for status indicator
 */
interface StatusIndicatorProps {
  /** Execution status */
  status: ToolMessageType['status'];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Props for tool output display
 */
interface ToolOutputDisplayProps {
  /** Tool output */
  output: ToolOutput;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Maximum height */
  maxHeight?: number;
}

/**
 * Error boundary for ToolMessage
 */
interface ToolMessageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ToolMessageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ToolMessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ToolMessageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ToolMessage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering tool message</Text>
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
    pending: { icon: '⏳', color: colors.status.pending, label: 'Pending' },
    running: { icon: '▶', color: colors.status.loading, label: 'Running' },
    success: { icon: '✓', color: colors.status.success, label: 'Success' },
    error: { icon: '✗', color: colors.status.error, label: 'Error' },
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
 * Bash output display component
 */
function BashOutputDisplay({ output, colors }: { output: BashOutput; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  const hasError = output.exitCode !== 0;
  
  return (
    <Box flexDirection="column">
      {/* Command display */}
      <Box flexDirection="row" gap={1}>
        <Text color={colors.textMuted}>$</Text>
        <Text color={colors.primary}>{output.command}</Text>
      </Box>
      
      {/* Exit code */}
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={colors.textMuted}>Exit code:</Text>
        <Text color={hasError ? colors.status.error : colors.status.success}>
          {output.exitCode}
        </Text>
      </Box>
      
      {/* stdout */}
      {output.stdout && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.textMuted} dimColor>stdout:</Text>
          <Box paddingLeft={2}>
            <Text color={colors.text}>{output.stdout}</Text>
          </Box>
        </Box>
      )}
      
      {/* stderr */}
      {output.stderr && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.status.error} dimColor>stderr:</Text>
          <Box paddingLeft={2}>
            <Text color={colors.status.error}>{output.stderr}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * File read output display component
 */
function FileReadOutputDisplay({ output, colors, maxHeight = 20 }: { output: FileReadOutput; colors: ReturnType<typeof useCurrentTheme>['colors']; maxHeight?: number }): ReactNode {
  const lines = output.content.split('\n');
  const displayLines = lines.slice(0, maxHeight);
  const hasMore = lines.length > maxHeight;
  
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={colors.status.info}>📄</Text>
        <Text color={colors.primary}>{output.path}</Text>
        <Text color={colors.textMuted}>
          ({output.lineCount} lines, {formatFileSize(output.size)})
        </Text>
      </Box>
      
      <Box 
        flexDirection="column" 
        marginTop={1}
        paddingX={1}
        borderStyle="single"
        borderColor={colors.border}
      >
        {displayLines.map((line, index) => (
          <Text key={index} color={colors.text}>
            {line || ' '}
          </Text>
        ))}
        {hasMore && (
          <Text color={colors.textMuted} dimColor>
            ... {lines.length - maxHeight} more lines ...
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * File write output display component
 */
function FileWriteOutputDisplay({ output, colors }: { output: FileWriteOutput; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={colors.status.success}>✓</Text>
        <Text color={colors.status.success}>
          {output.created ? 'Created' : 'Updated'}
        </Text>
        <Text color={colors.primary}>{output.path}</Text>
        <Text color={colors.textMuted}>
          ({formatFileSize(output.bytesWritten)})
        </Text>
      </Box>
    </Box>
  );
}

/**
 * File edit output display component
 */
function FileEditOutputDisplay({ output, colors }: { output: FileEditOutput; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={colors.status.success}>✎</Text>
        <Text color={colors.status.success}>Edited</Text>
        <Text color={colors.primary}>{output.path}</Text>
        <Text color={colors.textMuted}>
          ({output.linesChanged} lines changed)
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Search output display component
 */
function SearchOutputDisplay({ output, colors, maxHeight = 10 }: { output: SearchOutput; colors: ReturnType<typeof useCurrentTheme>['colors']; maxHeight?: number }): ReactNode {
  const displayResults = output.results.slice(0, maxHeight);
  const hasMore = output.results.length > maxHeight;
  
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={colors.status.info}>🔍</Text>
        <Text color={colors.text}>Search:</Text>
        <Text color={colors.primary}>{output.query}</Text>
      </Box>
      
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={colors.textMuted}>
          Found {output.totalMatches} matches in {output.filesSearched} files
        </Text>
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        {displayResults.map((result, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Box flexDirection="row" gap={1}>
              <Text color={colors.primary}>{result.filePath}</Text>
              <Text color={colors.textMuted}>:{result.lineNumber}</Text>
            </Box>
            {result.contextBefore?.map((ctx, i) => (
              <Text key={`before-${i}`} color={colors.textMuted} dimCode>
                {ctx}
              </Text>
            ))}
            <Text color={colors.text}>{result.content}</Text>
            {result.contextAfter?.map((ctx, i) => (
              <Text key={`after-${i}`} color={colors.textMuted} dimCode>
                {ctx}
              </Text>
            ))}
          </Box>
        ))}
        {hasMore && (
          <Text color={colors.textMuted} dimColor>
            ... {output.results.length - maxHeight} more results ...
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Generic tool output display
 */
function GenericToolOutputDisplay({ output, colors }: { output: { type: 'generic'; data: unknown }; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  return (
    <Box flexDirection="column">
      <Text color={colors.textMuted}>Tool Output:</Text>
      <Box paddingLeft={2}>
        <Text color={colors.text}>
          {JSON.stringify(output.data, null, 2)}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Tool output display dispatcher
 */
function ToolOutputDisplay({ output, colors, maxHeight }: ToolOutputDisplayProps): ReactNode {
  switch (output.type) {
    case 'bash':
      return <BashOutputDisplay output={output as BashOutput} colors={colors} />;
    case 'file_read':
      return <FileReadOutputDisplay output={output as FileReadOutput} colors={colors} maxHeight={maxHeight} />;
    case 'file_write':
      return <FileWriteOutputDisplay output={output as FileWriteOutput} colors={colors} />;
    case 'file_edit':
      return <FileEditOutputDisplay output={output as FileEditOutput} colors={colors} />;
    case 'search':
      return <SearchOutputDisplay output={output as SearchOutput} colors={colors} maxHeight={maxHeight} />;
    default:
      return <GenericToolOutputDisplay output={output as { type: 'generic'; data: unknown }} colors={colors} />;
  }
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * ToolMessage component - Displays tool execution results
 * 
 * @example
 * ```tsx
 * <ToolMessage 
 *   message={{
 *     id: '3',
 *     role: 'tool',
 *     toolName: 'bash',
 *     toolCallId: 'call-1',
 *     content: 'Command executed successfully',
 *     status: 'success',
 *     timestamp: new Date(),
 *     output: {
 *       type: 'bash',
 *       command: 'ls -la',
 *       exitCode: 0,
 *       stdout: 'total 32...',
 *       stderr: '',
 *     },
 *   }}
 * />
 * ```
 */
function ToolMessageComponent({
  message,
  showTimestamp = false,
  defaultExpanded = true,
  maxWidth,
  maxOutputHeight = 20,
  renderOutput,
  onToggleExpand,
  style = { padding: 1, margin: 0, border: true },
  'data-testid': testId = 'tool-message',
}: ToolMessageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const messageColors = theme.messages.tool;
  const effectiveMaxWidth = maxWidth || Math.min(columns - 4, 100);
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggleExpand?.(newExpanded);
  };

  return (
    <Box
      flexDirection="column"
      width={effectiveMaxWidth}
      marginTop={style.margin}
      marginBottom={style.margin}
      data-testid={testId}
    >
      {/* Header with tool indicator */}
      <Box flexDirection="row" gap={1} marginBottom={0}>
        <Text bold color={messageColors.border}>
          🔧 {message.toolName}
        </Text>
        {showTimestamp && (
          <Text color={theme.colors.textMuted}>
            {formatTimestamp(message.timestamp)}
          </Text>
        )}
        <Spacer />
        <StatusIndicator status={message.status} colors={theme.colors} />
        {message.duration && (
          <Text color={theme.colors.textMuted}>
            ({formatDuration(message.duration)})
          </Text>
        )}
      </Box>

      {/* Message content box */}
      <Box
        flexDirection="column"
        borderStyle={style.border ? 'single' : undefined}
        borderColor={messageColors.border}
        paddingX={style.padding}
        paddingY={style.padding ? Math.max(0, style.padding - 1) : 0}
        backgroundColor={messageColors.background}
      >
        {/* Expand/collapse toggle */}
        <Box flexDirection="row" onPress={handleToggle}>
          <Text color={theme.colors.textMuted}>
            {expanded ? '▼' : '▶'} Output
          </Text>
        </Box>

        {/* Output content */}
        {expanded && (
          <Box flexDirection="column" marginTop={1}>
            {renderOutput && message.output ? (
              renderOutput(message.output)
            ) : message.output ? (
              <ToolOutputDisplay
                output={message.output}
                colors={theme.colors}
                maxHeight={maxOutputHeight}
              />
            ) : (
              <Text color={messageColors.text}>{message.content}</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for ToolMessage
 */
ToolMessageComponent.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['tool'] as const).isRequired,
    toolName: PropTypes.string.isRequired,
    toolCallId: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['pending', 'running', 'success', 'error'] as const).isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    duration: PropTypes.number,
    output: PropTypes.object,
    metadata: PropTypes.object,
  }).isRequired,
  showTimestamp: PropTypes.bool,
  defaultExpanded: PropTypes.bool,
  maxWidth: PropTypes.number,
  maxOutputHeight: PropTypes.number,
  renderOutput: PropTypes.func,
  onToggleExpand: PropTypes.func,
  style: PropTypes.shape({
    padding: PropTypes.number,
    margin: PropTypes.number,
    border: PropTypes.bool,
  }),
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ToolMessage with error boundary
 */
export function ToolMessage(props: ToolMessageProps): ReactNode {
  return (
    <ToolMessageErrorBoundary>
      <ToolMessageComponent {...props} />
    </ToolMessageErrorBoundary>
  );
}

/**
 * Compact tool message variant
 */
export function CompactToolMessage({
  message,
  maxWidth,
}: Omit<ToolMessageProps, 'style' | 'showTimestamp' | 'defaultExpanded'>): ReactNode {
  return (
    <ToolMessage
      message={message}
      showTimestamp={false}
      defaultExpanded={false}
      maxWidth={maxWidth}
      style={{ padding: 0, margin: 0, border: false }}
    />
  );
}

CompactToolMessage.propTypes = {
  message: PropTypes.object.isRequired,
  maxWidth: PropTypes.number,
};

export default ToolMessage;
