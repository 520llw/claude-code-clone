/**
 * System Message Component for Claude Code Clone
 * Displays system notifications and status messages
 * @module components/messages/SystemMessage
 */

import React, { Component, type ReactNode, type ErrorInfo, useState } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { SystemMessage as SystemMessageType } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Props for SystemMessage component
 */
export interface SystemMessageProps {
  /** The system message to display */
  message: SystemMessageType;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to show dismiss button */
  dismissible?: boolean;
  /** Maximum width of the message */
  maxWidth?: number;
  /** Duration to auto-dismiss (in ms, 0 = no auto-dismiss) */
  autoDismiss?: number;
  /** Custom icon to display */
  customIcon?: string;
  /** Custom render function for content */
  renderContent?: (content: string, type: SystemMessageType['type']) => ReactNode;
  /** Callback when message is dismissed */
  onDismiss?: () => void;
  /** Callback when action is taken */
  onAction?: (action: string) => void;
  /** Additional styling */
  style?: {
    padding?: number;
    margin?: number;
    border?: boolean;
    align?: 'left' | 'center' | 'right';
  };
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for message type icon
 */
interface TypeIconProps {
  /** Message type */
  type: SystemMessageType['type'];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Custom icon override */
  customIcon?: string;
}

/**
 * Props for action buttons
 */
interface ActionButtonsProps {
  /** Available actions */
  actions?: Array<{ label: string; value: string }>;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Action callback */
  onAction?: (action: string) => void;
}

/**
 * Error boundary for SystemMessage
 */
interface SystemMessageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SystemMessageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SystemMessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SystemMessageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('SystemMessage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering system message</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Type icon component
 */
function TypeIcon({ type, colors, customIcon }: TypeIconProps): ReactNode {
  if (customIcon) {
    return <Text>{customIcon}</Text>;
  }
  
  const iconConfig = {
    info: { icon: 'ℹ', color: colors.status.info },
    warning: { icon: '⚠', color: colors.status.warning },
    success: { icon: '✓', color: colors.status.success },
    notification: { icon: '•', color: colors.textMuted },
  };
  
  const config = iconConfig[type];
  
  return <Text color={config.color}>{config.icon}</Text>;
}

/**
 * Get border color based on message type
 */
function getTypeBorderColor(type: SystemMessageType['type'], colors: ReturnType<typeof useCurrentTheme>['colors']): string {
  const colorMap = {
    info: colors.status.info,
    warning: colors.status.warning,
    success: colors.status.success,
    notification: colors.border,
  };
  return colorMap[type];
}

/**
 * Get background color based on message type
 */
function getTypeBackgroundColor(type: SystemMessageType['type'], colors: ReturnType<typeof useCurrentTheme>['colors']): string | undefined {
  // Return subtle background colors for certain types
  switch (type) {
    case 'warning':
      return '#2a2a1e';
    case 'success':
      return '#1a2a1a';
    case 'info':
      return '#1a1a2e';
    default:
      return undefined;
  }
}

/**
 * Action buttons component
 */
function ActionButtons({ actions, colors, onAction }: ActionButtonsProps): ReactNode {
  if (!actions || actions.length === 0) return null;
  
  return (
    <Box flexDirection="row" gap={2} marginTop={1}>
      {actions.map((action, index) => (
        <Box 
          key={index}
          flexDirection="row" 
          gap={1}
          onPress={() => onAction?.(action.value)}
        >
          <Text color={colors.primary}>[{action.label}]</Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * SystemMessage component - Displays system notifications
 * 
 * @example
 * ```tsx
 * <SystemMessage 
 *   message={{
 *     id: '5',
 *     role: 'system',
 *     content: 'Session saved successfully',
 *     type: 'success',
 *     timestamp: new Date(),
 *   }}
 * />
 * ```
 */
function SystemMessageComponent({
  message,
  showTimestamp = false,
  dismissible = false,
  maxWidth,
  autoDismiss = 0,
  customIcon,
  renderContent,
  onDismiss,
  onAction,
  style = { padding: 1, margin: 0, border: true, align: 'left' },
  'data-testid': testId = 'system-message',
}: SystemMessageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const messageColors = theme.messages.system;
  const effectiveMaxWidth = maxWidth || Math.min(columns - 4, 100);
  const [isDismissed, setIsDismissed] = useState(false);

  // Auto-dismiss effect
  React.useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss]);

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
   * Handle dismiss action
   */
  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  /**
   * Wrap content to fit within max width
   */
  const wrapContent = (content: string): string[] => {
    const lines: string[] = [];
    const contentWidth = effectiveMaxWidth - (style.padding || 0) * 2 - 6;
    
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

  if (isDismissed) {
    return null;
  }

  const wrappedLines = wrapContent(message.content);
  const borderColor = getTypeBorderColor(message.type, theme.colors);
  const backgroundColor = getTypeBackgroundColor(message.type, theme.colors);

  return (
    <Box
      flexDirection="column"
      width={effectiveMaxWidth}
      marginTop={style.margin}
      marginBottom={style.margin}
      alignItems={style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start'}
      data-testid={testId}
    >
      {/* Message content box */}
      <Box
        flexDirection="column"
        borderStyle={style.border ? 'single' : undefined}
        borderColor={borderColor}
        paddingX={style.padding}
        paddingY={style.padding ? Math.max(0, style.padding - 1) : 0}
        backgroundColor={backgroundColor}
      >
        {/* Header row */}
        <Box flexDirection="row" gap={1} marginBottom={0}>
          <TypeIcon 
            type={message.type} 
            colors={theme.colors} 
            customIcon={customIcon}
          />
          
          {showTimestamp && (
            <Text color={theme.colors.textMuted}>
              {formatTimestamp(message.timestamp)}
            </Text>
          )}
          
          <Spacer />
          
          {dismissible && (
            <Box onPress={handleDismiss}>
              <Text color={theme.colors.textMuted}>✕</Text>
            </Box>
          )}
        </Box>

        {/* Message text */}
        <Box flexDirection="column" marginTop={1}>
          {renderContent ? (
            renderContent(message.content, message.type)
          ) : (
            wrappedLines.map((line, index) => (
              <Text 
                key={index} 
                color={messageColors.text}
                dimColor={message.type === 'notification'}
              >
                {line || ' '}
              </Text>
            ))
          )}
        </Box>

        {/* Action buttons */}
        {message.metadata?.actions && (
          <ActionButtons
            actions={message.metadata.actions as Array<{ label: string; value: string }>}
            colors={theme.colors}
            onAction={onAction}
          />
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for SystemMessage
 */
SystemMessageComponent.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['system'] as const).isRequired,
    content: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['info', 'warning', 'success', 'notification'] as const).isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    metadata: PropTypes.object,
  }).isRequired,
  showTimestamp: PropTypes.bool,
  dismissible: PropTypes.bool,
  maxWidth: PropTypes.number,
  autoDismiss: PropTypes.number,
  customIcon: PropTypes.string,
  renderContent: PropTypes.func,
  onDismiss: PropTypes.func,
  onAction: PropTypes.func,
  style: PropTypes.shape({
    padding: PropTypes.number,
    margin: PropTypes.number,
    border: PropTypes.bool,
    align: PropTypes.oneOf(['left', 'center', 'right']),
  }),
  'data-testid': PropTypes.string,
};

/**
 * Wrapped SystemMessage with error boundary
 */
export function SystemMessage(props: SystemMessageProps): ReactNode {
  return (
    <SystemMessageErrorBoundary>
      <SystemMessageComponent {...props} />
    </SystemMessageErrorBoundary>
  );
}

/**
 * Info message variant
 */
export function InfoMessage(props: Omit<SystemMessageProps, 'message'> & { content: string }): ReactNode {
  const message: SystemMessageType = {
    id: `info-${Date.now()}`,
    role: 'system',
    content: props.content,
    type: 'info',
    timestamp: new Date(),
  };
  
  return <SystemMessage {...props} message={message} />;
}

InfoMessage.propTypes = {
  content: PropTypes.string.isRequired,
};

/**
 * Warning message variant
 */
export function WarningMessage(props: Omit<SystemMessageProps, 'message'> & { content: string }): ReactNode {
  const message: SystemMessageType = {
    id: `warning-${Date.now()}`,
    role: 'system',
    content: props.content,
    type: 'warning',
    timestamp: new Date(),
  };
  
  return <SystemMessage {...props} message={message} />;
}

WarningMessage.propTypes = {
  content: PropTypes.string.isRequired,
};

/**
 * Success message variant
 */
export function SuccessMessage(props: Omit<SystemMessageProps, 'message'> & { content: string }): ReactNode {
  const message: SystemMessageType = {
    id: `success-${Date.now()}`,
    role: 'system',
    content: props.content,
    type: 'success',
    timestamp: new Date(),
  };
  
  return <SystemMessage {...props} message={message} />;
}

SuccessMessage.propTypes = {
  content: PropTypes.string.isRequired,
};

/**
 * Notification message variant (subtle)
 */
export function NotificationMessage(props: Omit<SystemMessageProps, 'message'> & { content: string }): ReactNode {
  const message: SystemMessageType = {
    id: `notification-${Date.now()}`,
    role: 'system',
    content: props.content,
    type: 'notification',
    timestamp: new Date(),
  };
  
  return (
    <SystemMessage 
      {...props} 
      message={message} 
      style={{ ...props.style, border: false, padding: 0 }}
    />
  );
}

NotificationMessage.propTypes = {
  content: PropTypes.string.isRequired,
};

/**
 * Toast notification (auto-dismissing)
 */
export function ToastMessage(
  props: Omit<SystemMessageProps, 'message' | 'autoDismiss' | 'dismissible'> & { 
    content: string; 
    type?: SystemMessageType['type'];
    duration?: number;
  }
): ReactNode {
  const message: SystemMessageType = {
    id: `toast-${Date.now()}`,
    role: 'system',
    content: props.content,
    type: props.type || 'info',
    timestamp: new Date(),
  };
  
  return (
    <SystemMessage 
      {...props} 
      message={message} 
      autoDismiss={props.duration || 5000}
      dismissible
    />
  );
}

ToastMessage.propTypes = {
  content: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['info', 'warning', 'success', 'notification']),
  duration: PropTypes.number,
};

export default SystemMessage;
