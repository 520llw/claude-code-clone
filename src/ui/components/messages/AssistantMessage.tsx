/**
 * Assistant Message Component for Claude Code Clone
 * Displays AI responses with streaming support and thinking content
 * @module components/messages/AssistantMessage
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect, useRef } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import type { AssistantMessage as AssistantMessageType, ToolCall } from '../../types/index.js';
import { useCurrentTheme, useThemeAnimations } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useStreaming } from '../../hooks/useStreaming.js';

/**
 * Props for AssistantMessage component
 */
export interface AssistantMessageProps {
  /** The assistant message to display */
  message: AssistantMessageType;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to show thinking content */
  showThinking?: boolean;
  /** Whether to show tool calls */
  showToolCalls?: boolean;
  /** Maximum width of the message */
  maxWidth?: number;
  /** Enable streaming animation for new content */
  enableStreaming?: boolean;
  /** Streaming speed in ms per chunk */
  streamingSpeed?: number;
  /** Custom render function for content */
  renderContent?: (content: string, isStreaming: boolean) => ReactNode;
  /** Callback when streaming completes */
  onStreamingComplete?: () => void;
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
 * Props for streaming indicator
 */
interface StreamingIndicatorProps {
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Animation frames */
  frames?: string[];
}

/**
 * Props for thinking content
 */
interface ThinkingContentProps {
  /** Thinking text */
  thinking: string;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Whether expanded */
  expanded: boolean;
  /** Toggle expanded state */
  onToggle: () => void;
}

/**
 * Props for tool call display
 */
interface ToolCallDisplayProps {
  /** Tool calls to display */
  toolCalls: ToolCall[];
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
}

/**
 * Error boundary for AssistantMessage
 */
interface AssistantMessageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AssistantMessageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  AssistantMessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AssistantMessageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('AssistantMessage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering assistant message</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Streaming indicator component
 */
function StreamingIndicator({ 
  colors, 
  frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] 
}: StreamingIndicatorProps): ReactNode {
  const [frameIndex, setFrameIndex] = useState(0);
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!animations.enabled) return;
    
    const interval = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, animations.cursorBlinkRate / 2);
    
    return () => clearInterval(interval);
  }, [frames.length, animations.enabled, animations.cursorBlinkRate]);
  
  return (
    <Text color={colors.status.loading}>
      {frames[frameIndex]}
    </Text>
  );
}

/**
 * Thinking content component
 */
function ThinkingContent({ thinking, colors, expanded, onToggle }: ThinkingContentProps): ReactNode {
  if (!thinking) return null;
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" gap={1} onPress={onToggle}>
        <Text color={colors.status.info}>
          {expanded ? '▼' : '▶'}
        </Text>
        <Text color={colors.textMuted} dimColor>
          Thinking...
        </Text>
      </Box>
      {expanded && (
        <Box 
          marginLeft={2} 
          marginTop={1}
          paddingX={1}
          borderStyle="single"
          borderColor={colors.border}
        >
          <Text color={colors.textMuted} dimColor italic>
            {thinking}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Tool call display component
 */
function ToolCallDisplay({ toolCalls, colors }: ToolCallDisplayProps): ReactNode {
  if (!toolCalls || toolCalls.length === 0) return null;
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.textMuted} dimColor>
        Tool Calls:
      </Text>
      {toolCalls.map((call, index) => (
        <Box key={call.id} flexDirection="row" marginLeft={2} gap={1}>
          <Text color={colors.status.info}>{index + 1}.</Text>
          <Text color={colors.primary}>{call.name}</Text>
          <Text color={colors.textMuted}>
            ({Object.keys(call.arguments).length} args)
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * AssistantMessage component - Displays AI responses
 * 
 * @example
 * ```tsx
 * <AssistantMessage 
 *   message={{
 *     id: '2',
 *     role: 'assistant',
 *     content: 'Hello! How can I help you today?',
 *     timestamp: new Date(),
 *     isStreaming: false,
 *   }}
 * />
 * ```
 */
function AssistantMessageComponent({
  message,
  showTimestamp = false,
  showThinking = false,
  showToolCalls = true,
  maxWidth,
  enableStreaming = false,
  streamingSpeed = 30,
  renderContent,
  onStreamingComplete,
  style = { padding: 1, margin: 0, border: true },
  'data-testid': testId = 'assistant-message',
}: AssistantMessageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const messageColors = theme.messages.assistant;
  const effectiveMaxWidth = maxWidth || Math.min(columns - 4, 100);
  
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(
    enableStreaming && message.isStreaming ? '' : message.content
  );
  
  const streaming = useStreaming({
    delay: streamingSpeed,
    onChunk: (chunk) => {
      setDisplayedContent(prev => prev + chunk);
    },
    onComplete: () => {
      onStreamingComplete?.();
    },
  });
  
  // Start streaming when message is streaming
  useEffect(() => {
    if (enableStreaming && message.isStreaming && message.content) {
      streaming.start(message.content);
    }
    
    return () => {
      streaming.stop();
    };
  }, [message.content, message.isStreaming, enableStreaming]);
  
  // Update content when message changes
  useEffect(() => {
    if (!message.isStreaming) {
      setDisplayedContent(message.content);
    }
  }, [message.content, message.isStreaming]);

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

  const wrappedLines = wrapContent(displayedContent);
  const hasThinking = showThinking && message.thinking;
  const hasToolCalls = showToolCalls && message.toolCalls && message.toolCalls.length > 0;
  const isStreaming = message.isStreaming || streaming.isStreaming;

  return (
    <Box
      flexDirection="column"
      width={effectiveMaxWidth}
      marginTop={style.margin}
      marginBottom={style.margin}
      data-testid={testId}
    >
      {/* Header with assistant indicator */}
      <Box flexDirection="row" gap={1} marginBottom={0}>
        <Text bold color={messageColors.border}>
          Claude
        </Text>
        {showTimestamp && (
          <Text color={theme.colors.textMuted}>
            {formatTimestamp(message.timestamp)}
          </Text>
        )}
        {isStreaming && (
          <StreamingIndicator colors={theme.colors} />
        )}
        <Spacer />
        {message.tokenUsage && (
          <Text color={theme.colors.textMuted} dimColor>
            {message.tokenUsage.total} tokens
          </Text>
        )}
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
          <Box>{renderContent(displayedContent, isStreaming)}</Box>
        ) : (
          <Box flexDirection="column">
            {wrappedLines.map((line, index) => (
              <Text key={index} color={messageColors.text}>
                {line || ' '}
              </Text>
            ))}
            {isStreaming && (
              <Text color={theme.colors.cursor}>▌</Text>
            )}
          </Box>
        )}

        {/* Thinking content */}
        {hasThinking && (
          <ThinkingContent
            thinking={message.thinking!}
            colors={theme.colors}
            expanded={thinkingExpanded}
            onToggle={() => setThinkingExpanded(!thinkingExpanded)}
          />
        )}

        {/* Tool calls */}
        {hasToolCalls && (
          <ToolCallDisplay
            toolCalls={message.toolCalls!}
            colors={theme.colors}
          />
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for AssistantMessage
 */
AssistantMessageComponent.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['assistant'] as const).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    isStreaming: PropTypes.bool,
    toolCalls: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        arguments: PropTypes.object.isRequired,
      })
    ),
    thinking: PropTypes.string,
    tokenUsage: PropTypes.shape({
      input: PropTypes.number.isRequired,
      output: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired,
    }),
    metadata: PropTypes.object,
  }).isRequired,
  showTimestamp: PropTypes.bool,
  showThinking: PropTypes.bool,
  showToolCalls: PropTypes.bool,
  maxWidth: PropTypes.number,
  enableStreaming: PropTypes.bool,
  streamingSpeed: PropTypes.number,
  renderContent: PropTypes.func,
  onStreamingComplete: PropTypes.func,
  style: PropTypes.shape({
    padding: PropTypes.number,
    margin: PropTypes.number,
    border: PropTypes.bool,
  }),
  'data-testid': PropTypes.string,
};

/**
 * Wrapped AssistantMessage with error boundary
 */
export function AssistantMessage(props: AssistantMessageProps): ReactNode {
  return (
    <AssistantMessageErrorBoundary>
      <AssistantMessageComponent {...props} />
    </AssistantMessageErrorBoundary>
  );
}

/**
 * Streaming assistant message variant
 */
export function StreamingAssistantMessage(
  props: Omit<AssistantMessageProps, 'enableStreaming'>
): ReactNode {
  return <AssistantMessage {...props} enableStreaming />;
}

StreamingAssistantMessage.propTypes = {
  message: PropTypes.object.isRequired,
};

/**
 * Compact assistant message variant
 */
export function CompactAssistantMessage({
  message,
  maxWidth,
}: Omit<AssistantMessageProps, 'style' | 'showTimestamp' | 'showThinking' | 'showToolCalls'>): ReactNode {
  return (
    <AssistantMessage
      message={message}
      showTimestamp={false}
      showThinking={false}
      showToolCalls={false}
      maxWidth={maxWidth}
      style={{ padding: 0, margin: 0, border: false }}
    />
  );
}

CompactAssistantMessage.propTypes = {
  message: PropTypes.object.isRequired,
  maxWidth: PropTypes.number,
};

export default AssistantMessage;
