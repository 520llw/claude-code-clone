/**
 * Error Message Component for Claude Code Clone
 * Displays error messages with details and recovery options
 * @module components/messages/ErrorMessage
 */

import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { ErrorMessage as ErrorMessageType } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Props for ErrorMessage component
 */
export interface ErrorMessageProps {
  /** The error message to display */
  message: ErrorMessageType;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to show error code */
  showErrorCode?: boolean;
  /** Whether to show details by default */
  defaultShowDetails?: boolean;
  /** Maximum width of the message */
  maxWidth?: number;
  /** Maximum height for details */
  maxDetailsHeight?: number;
  /** Custom render function for error content */
  renderError?: (message: ErrorMessageType) => ReactNode;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Callback when dismiss is clicked */
  onDismiss?: () => void;
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
 * Props for error code display
 */
interface ErrorCodeDisplayProps {
  /** Error code */
  code: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Props for error details display
 */
interface ErrorDetailsProps {
  /** Error details/stack trace */
  details: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Maximum height */
  maxHeight?: number;
  /** Whether expanded */
  expanded: boolean;
  /** Toggle expanded state */
  onToggle: () => void;
}

/**
 * Props for recovery actions
 */
interface RecoveryActionsProps {
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
}

/**
 * Error boundary for ErrorMessage
 */
interface ErrorMessageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorMessageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorMessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorMessageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorMessage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering error message (meta-error!)</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Error code display component
 */
function ErrorCodeDisplay({ code, colors }: ErrorCodeDisplayProps): ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={colors.textMuted}>Code:</Text>
      <Text bold color={colors.status.error}>
        {code}
      </Text>
    </Box>
  );
}

/**
 * Error details component
 */
function ErrorDetails({ details, colors, maxHeight = 10, expanded, onToggle }: ErrorDetailsProps): ReactNode {
  const lines = details.split('\n');
  const displayLines = expanded ? lines : lines.slice(0, maxHeight);
  const hasMore = lines.length > maxHeight && !expanded;
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" gap={1} onPress={onToggle}>
        <Text color={colors.textMuted}>
          {expanded ? '▼' : '▶'} Details
        </Text>
      </Box>
      
      <Box 
        flexDirection="column" 
        marginTop={1}
        marginLeft={2}
        paddingX={1}
        borderStyle="single"
        borderColor={colors.status.error}
      >
        {displayLines.map((line, index) => (
          <Text key={index} color={colors.textMuted} dimColor>
            {line}
          </Text>
        ))}
        {hasMore && (
          <Text color={colors.textMuted} dimColor>
            ... {lines.length - maxHeight} more lines (click to expand) ...
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Recovery actions component
 */
function RecoveryActions({ recoverable, colors, onRetry, onDismiss }: RecoveryActionsProps): ReactNode {
  return (
    <Box flexDirection="row" gap={2} marginTop={1}>
      {recoverable && onRetry && (
        <Box 
          flexDirection="row" 
          gap={1}
          onPress={onRetry}
        >
          <Text color={colors.status.success}>↻</Text>
          <Text color={colors.status.success} bold>
            Retry
          </Text>
        </Box>
      )}
      {onDismiss && (
        <Box 
          flexDirection="row" 
          gap={1}
          onPress={onDismiss}
        >
          <Text color={colors.textMuted}>✕</Text>
          <Text color={colors.textMuted}>
            Dismiss
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * ErrorMessage component - Displays error messages
 * 
 * @example
 * ```tsx
 * <ErrorMessage 
 *   message={{
 *     id: '4',
 *     role: 'error',
 *     content: 'Failed to connect to API',
 *     code: 'API_ERROR',
 *     details: 'Connection timeout after 30s',
 *     recoverable: true,
 *     timestamp: new Date(),
 *   }}
 *   onRetry={() => retryConnection()}
 * />
 * ```
 */
function ErrorMessageComponent({
  message,
  showTimestamp = false,
  showErrorCode = true,
  defaultShowDetails = false,
  maxWidth,
  maxDetailsHeight = 10,
  renderError,
  onRetry,
  onDismiss,
  style = { padding: 1, margin: 0, border: true },
  'data-testid': testId = 'error-message',
}: ErrorMessageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const messageColors = theme.messages.error;
  const effectiveMaxWidth = maxWidth || Math.min(columns - 4, 100);
  const [detailsExpanded, setDetailsExpanded] = useState(defaultShowDetails);

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

  /**
   * Wrap content to fit within max width
   */
  const wrapContent = (content: string): string[] => {
    const lines: string[] = [];
    const contentWidth = effectiveMaxWidth - (style.padding || 0) * 2 - 4;
    
    const paragraphs = content.split('\n');
    for (const paragraph of paragraphs) {
      if (paragraph.length <= contentWidth) {
        lines.push(paragraph);
        continue;
      }
      
      let line = '';
      const words = paragraph.split(' ');
      for (const word of words) {
        if ((line + word).length > contentWidth) {
          if (line) lines.push(line.trim());
          line = word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line) lines.push(line.trim());
    }
    
    return lines;
  };

  const wrappedLines = wrapContent(message.content);
  const hasDetails = !!message.details;
  const isRecoverable = message.recoverable ?? false;

  return (
    <Box
      flexDirection="column"
      width={effectiveMaxWidth}
      marginTop={style.margin}
      marginBottom={style.margin}
      data-testid={testId}
    >
      {/* Header with error indicator */}
      <Box flexDirection="row" gap={1} marginBottom={0}>
        <Text bold color={messageColors.border}>
          ✗ Error
        </Text>
        {showTimestamp && (
          <Text color={theme.colors.textMuted}>
            {formatTimestamp(message.timestamp)}
          </Text>
        )}
        <Spacer />
      </Box>

      {/* Message content box */}
      <Box
        flexDirection="column"
        borderStyle={style.border ? 'double' : undefined}
        borderColor={messageColors.border}
        paddingX={style.padding}
        paddingY={style.padding ? Math.max(0, style.padding - 1) : 0}
        backgroundColor={messageColors.background}
      >
        {/* Error icon and main message */}
        {renderError ? (
          <Box>{renderError(message)}</Box>
        ) : (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color={messageColors.text}>⚠</Text>
              <Box flexDirection="column">
                {wrappedLines.map((line, index) => (
                  <Text key={index} color={messageColors.text} bold>
                    {line || ' '}
                  </Text>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* Error code */}
        {showErrorCode && message.code && (
          <Box marginTop={1}>
            <ErrorCodeDisplay code={message.code} colors={theme.colors} />
          </Box>
        )}

        {/* Error details */}
        {hasDetails && (
          <ErrorDetails
            details={message.details!}
            colors={theme.colors}
            maxHeight={maxDetailsHeight}
            expanded={detailsExpanded}
            onToggle={() => setDetailsExpanded(!detailsExpanded)}
          />
        )}

        {/* Recovery actions */}
        {(isRecoverable || onDismiss) && (
          <RecoveryActions
            recoverable={isRecoverable}
            colors={theme.colors}
            onRetry={onRetry || message.onRetry}
            onDismiss={onDismiss}
          />
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for ErrorMessage
 */
ErrorMessageComponent.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['error'] as const).isRequired,
    content: PropTypes.string.isRequired,
    code: PropTypes.string,
    details: PropTypes.string,
    recoverable: PropTypes.bool,
    onRetry: PropTypes.func,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    metadata: PropTypes.object,
  }).isRequired,
  showTimestamp: PropTypes.bool,
  showErrorCode: PropTypes.bool,
  defaultShowDetails: PropTypes.bool,
  maxWidth: PropTypes.number,
  maxDetailsHeight: PropTypes.number,
  renderError: PropTypes.func,
  onRetry: PropTypes.func,
  onDismiss: PropTypes.func,
  style: PropTypes.shape({
    padding: PropTypes.number,
    margin: PropTypes.number,
    border: PropTypes.bool,
  }),
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ErrorMessage with error boundary
 */
export function ErrorMessage(props: ErrorMessageProps): ReactNode {
  return (
    <ErrorMessageErrorBoundary>
      <ErrorMessageComponent {...props} />
    </ErrorMessageErrorBoundary>
  );
}

/**
 * Compact error message variant
 */
export function CompactErrorMessage({
  message,
  maxWidth,
}: Omit<ErrorMessageProps, 'style' | 'showTimestamp' | 'showErrorCode' | 'defaultShowDetails'>): ReactNode {
  return (
    <ErrorMessage
      message={message}
      showTimestamp={false}
      showErrorCode={false}
      defaultShowDetails={false}
      maxWidth={maxWidth}
      style={{ padding: 0, margin: 0, border: false }}
    />
  );
}

CompactErrorMessage.propTypes = {
  message: PropTypes.object.isRequired,
  maxWidth: PropTypes.number,
};

/**
 * Simple error message (just text)
 */
export function SimpleErrorMessage({ 
  content, 
  code 
}: { 
  content: string; 
  code?: string;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.messages.error.text}>✗</Text>
      <Text color={theme.messages.error.text}>{content}</Text>
      {code && (
        <Text color={theme.colors.textMuted}>({code})</Text>
      )}
    </Box>
  );
}

SimpleErrorMessage.propTypes = {
  content: PropTypes.string.isRequired,
  code: PropTypes.string,
};

export default ErrorMessage;
