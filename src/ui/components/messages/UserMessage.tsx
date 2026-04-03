/**
 * User Message Component for Claude Code Clone
 * Displays user messages with markdown support and styling
 * @module components/messages/UserMessage
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { UserMessage as UserMessageType, FileAttachment } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Props for UserMessage component
 */
export interface UserMessageProps {
  /** The user message to display */
  message: UserMessageType;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to show attachments */
  showAttachments?: boolean;
  /** Maximum width of the message */
  maxWidth?: number;
  /** Custom render function for content */
  renderContent?: (content: string) => ReactNode;
  /** Additional styling */
  style?: {
    padding?: number;
    margin?: number;
    border?: boolean;
  };
  /** Callback when message is clicked */
  onClick?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for attachment item
 */
interface AttachmentItemProps {
  /** File attachment */
  attachment: FileAttachment;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Error boundary for UserMessage
 */
interface UserMessageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class UserMessageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  UserMessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): UserMessageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('UserMessage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering user message</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Formats file size to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Attachment item component
 */
function AttachmentItem({ attachment, colors }: AttachmentItemProps): ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={colors.status.info}>📎</Text>
      <Text color={colors.textMuted}>{attachment.name}</Text>
      <Text color={colors.textMuted}>({formatFileSize(attachment.size)})</Text>
    </Box>
  );
}

/**
 * UserMessage component - Displays user messages
 * 
 * @example
 * ```tsx
 * <UserMessage 
 *   message={{
 *     id: '1',
 *     role: 'user',
 *     content: 'Hello, Claude!',
 *     timestamp: new Date(),
 *   }}
 * />
 * ```
 */
function UserMessageComponent({
  message,
  showTimestamp = false,
  showAttachments = true,
  maxWidth,
  renderContent,
  style = { padding: 1, margin: 0, border: true },
  onClick,
  'data-testid': testId = 'user-message',
}: UserMessageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const messageColors = theme.messages.user;
  const effectiveMaxWidth = maxWidth || Math.min(columns - 4, 100);

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
  const hasAttachments = showAttachments && message.attachments && message.attachments.length > 0;

  return (
    <Box
      flexDirection="column"
      width={effectiveMaxWidth}
      marginTop={style.margin}
      marginBottom={style.margin}
      data-testid={testId}
    >
      {/* Header with user indicator */}
      <Box flexDirection="row" gap={1} marginBottom={0}>
        <Text bold color={messageColors.border}>
          You
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
        borderStyle={style.border ? 'round' : undefined}
        borderColor={messageColors.border}
        paddingX={style.padding}
        paddingY={style.padding ? Math.max(0, style.padding - 1) : 0}
        backgroundColor={messageColors.background}
      >
        {/* Message text */}
        {renderContent ? (
          <Box>{renderContent(message.content)}</Box>
        ) : (
          <Box flexDirection="column">
            {wrappedLines.map((line, index) => (
              <Text key={index} color={messageColors.text}>
                {line || ' '}
              </Text>
            ))}
          </Box>
        )}

        {/* Attachments */}
        {hasAttachments && (
          <Box flexDirection="column" marginTop={1} gap={0}>
            <Text color={theme.colors.textMuted} dimColor>
              Attachments:
            </Text>
            {message.attachments!.map((attachment, index) => (
              <AttachmentItem
                key={`${attachment.path}-${index}`}
                attachment={attachment}
                colors={theme.colors}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for UserMessage
 */
UserMessageComponent.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['user'] as const).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    metadata: PropTypes.object,
    attachments: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        path: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        mimeType: PropTypes.string.isRequired,
        content: PropTypes.string,
      })
    ),
  }).isRequired,
  showTimestamp: PropTypes.bool,
  showAttachments: PropTypes.bool,
  maxWidth: PropTypes.number,
  renderContent: PropTypes.func,
  style: PropTypes.shape({
    padding: PropTypes.number,
    margin: PropTypes.number,
    border: PropTypes.bool,
  }),
  onClick: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped UserMessage with error boundary
 */
export function UserMessage(props: UserMessageProps): ReactNode {
  return (
    <UserMessageErrorBoundary>
      <UserMessageComponent {...props} />
    </UserMessageErrorBoundary>
  );
}

/**
 * Compact user message variant
 */
export function CompactUserMessage({
  message,
  maxWidth,
}: Omit<UserMessageProps, 'style' | 'showTimestamp' | 'showAttachments'>): ReactNode {
  return (
    <UserMessage
      message={message}
      showTimestamp={false}
      showAttachments={false}
      maxWidth={maxWidth}
      style={{ padding: 0, margin: 0, border: false }}
    />
  );
}

CompactUserMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['user'] as const).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
  }).isRequired,
  maxWidth: PropTypes.number,
};

/**
 * User message with full details
 */
export function DetailedUserMessage(props: UserMessageProps): ReactNode {
  return <UserMessage {...props} showTimestamp showAttachments />;
}

export default UserMessage;
