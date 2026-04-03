/**
 * Enhanced Message List Component
 *
 * Displays chat messages with:
 * - Markdown rendering for assistant messages
 * - Inline diff display for file edit results
 * - Real-time tool execution display
 * - Streaming message support
 * - Syntax highlighting for code blocks
 */

import { useRef, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { Message, MessageContent } from '../../types/index.js';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolExecutionList } from './ToolExecution';
import { StreamingMessage } from './StreamingMessage';
import type { ToolExecutionInfo } from './ToolExecution';

// ============================================================================
// Props
// ============================================================================

interface MessageListProps {
  messages: Message[];
  maxHeight: number;
  showTimestamps?: boolean;
  compactMode?: boolean;
  /** Currently streaming message text */
  streamingText?: string;
  /** Whether a stream is active */
  isStreaming?: boolean;
  /** Active tool executions */
  toolExecutions?: ToolExecutionInfo[];
}

// ============================================================================
// Role Config
// ============================================================================

const ROLE_CONFIG: Record<string, { text: string; color: string; icon: string }> = {
  user: { text: 'You', color: 'blue', icon: '>' },
  assistant: { text: 'Assistant', color: 'green', icon: '◆' },
  system: { text: 'System', color: 'yellow', icon: '!' },
  tool: { text: 'Tool', color: 'magenta', icon: '#' },
};

// ============================================================================
// Component
// ============================================================================

export function MessageList({
  messages,
  maxHeight,
  showTimestamps = false,
  compactMode = false,
  streamingText,
  isStreaming = false,
  toolExecutions = [],
}: MessageListProps): JSX.Element {
  const scrollRef = useRef<number>(0);

  useEffect(() => {
    scrollRef.current = Math.max(0, messages.length - maxHeight);
  }, [messages.length, maxHeight]);

  const visibleMessages = messages.slice(scrollRef.current);

  if (messages.length === 0 && !isStreaming) {
    return (
      <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>No messages yet. Type a message or use /help for commands.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {visibleMessages.map((message, index) => (
        <MessageItem
          key={message.id || index}
          message={message}
          showTimestamp={showTimestamps}
          compactMode={compactMode}
        />
      ))}

      {/* Active tool executions */}
      {toolExecutions.length > 0 && (
        <Box marginY={0}>
          <ToolExecutionList executions={toolExecutions} compact={compactMode} />
        </Box>
      )}

      {/* Streaming message */}
      {isStreaming && streamingText !== undefined && (
        <StreamingMessage
          text={streamingText}
          isStreaming={true}
          role="assistant"
          color="green"
        />
      )}
    </Box>
  );
}

// ============================================================================
// Message Item
// ============================================================================

interface MessageItemProps {
  message: Message;
  showTimestamp: boolean;
  compactMode: boolean;
}

function MessageItem({ message, showTimestamp, compactMode }: MessageItemProps): JSX.Element {
  const role = ROLE_CONFIG[message.role] ?? { text: 'User', color: 'blue', icon: '>' };

  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString()
    : null;

  // Detect if content contains diff data
  const hasDiff = message.role === 'tool' &&
    typeof message.content === 'string' &&
    (message.content.includes('@@') || message.content.includes('+++ ') || message.content.includes('--- '));

  // Render content
  const renderContent = () => {
    if (typeof message.content === 'string') {
      // Use Markdown renderer for assistant messages
      if (message.role === 'assistant') {
        return <MarkdownRenderer content={message.content} />;
      }

      // Diff display for tool results
      if (hasDiff) {
        return <InlineDiff content={message.content} />;
      }

      // Inline code highlighting for all other messages
      return <InlineHighlight text={message.content} />;
    }

    // Array of content blocks
    return (
      <Box flexDirection="column">
        {(message.content as MessageContent[]).map((block: MessageContent, i: number) => (
          <ContentBlock key={i} block={block} />
        ))}
      </Box>
    );
  };

  // Render tool calls
  const renderToolCalls = () => {
    if (!message.toolCalls || message.toolCalls.length === 0) return null;
    return (
      <Box flexDirection="column" marginTop={0}>
        {message.toolCalls.map((toolCall: any, i: number) => (
          <Box key={i} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
            <Text color="cyan" bold>Tool: {toolCall.name}</Text>
            <Text dimColor>{JSON.stringify(toolCall.arguments, null, 2)}</Text>
          </Box>
        ))}
      </Box>
    );
  };

  // Render tool results
  const renderToolResults = () => {
    if (!message.toolResults || message.toolResults.length === 0) return null;
    return (
      <Box flexDirection="column" marginTop={0}>
        {message.toolResults.map((result: any, i: number) => {
          const isError = !!result.error;
          const content = typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2);
          const isDiff = content && (content.includes('@@') || content.includes('+++ '));

          return (
            <Box key={i} flexDirection="column" borderStyle="round" borderColor={isError ? 'red' : 'green'} paddingX={1}>
              <Text color={isError ? 'red' : 'green'} bold>
                {isError ? '✗ Error' : '✓ Result'}
              </Text>
              {isDiff ? (
                <InlineDiff content={content} />
              ) : (
                <Text dimColor>{content}</Text>
              )}
              {result.error && <Text color="red">{result.error}</Text>}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Compact mode
  if (compactMode) {
    return (
      <Box flexDirection="row" paddingX={1}>
        <Text color={role.color} bold>{role.icon} </Text>
        {typeof message.content === 'string' ? (
          <InlineHighlight text={message.content} />
        ) : (
          renderContent()
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={0} paddingX={1}>
      {/* Header */}
      <Box>
        <Text color={role.color} bold>{role.icon} {role.text}</Text>
        {showTimestamp && timestamp && <Text dimColor> {timestamp}</Text>}
      </Box>

      {/* Content */}
      <Box marginLeft={3} flexDirection="column">
        {renderContent()}
        {renderToolCalls()}
        {renderToolResults()}
      </Box>
    </Box>
  );
}

// ============================================================================
// Inline Code Highlighting
// ============================================================================

function InlineHighlight({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length <= 1) return <Text>{text}</Text>;

  return (
    <Text>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`')
          ? <Text key={i} color="cyan">{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

// ============================================================================
// Inline Diff Display
// ============================================================================

function InlineDiff({ content }: { content: string }): JSX.Element {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {lines.map((line, i) => {
        if (line.startsWith('+++') || line.startsWith('---')) {
          return <Text key={i} color="white" bold>{line}</Text>;
        }
        if (line.startsWith('@@')) {
          return <Text key={i} color="cyan">{line}</Text>;
        }
        if (line.startsWith('+')) {
          return <Text key={i} color="green">{line}</Text>;
        }
        if (line.startsWith('-')) {
          return <Text key={i} color="red">{line}</Text>;
        }
        return <Text key={i} dimColor>{line}</Text>;
      })}
    </Box>
  );
}

// ============================================================================
// Content Block Component
// ============================================================================

interface ContentBlockProps {
  block: MessageContent;
}

function ContentBlock({ block }: ContentBlockProps): JSX.Element {
  switch (block.type) {
    case 'text':
      return <MarkdownRenderer content={block.content} />;

    case 'code':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginY={0}>
          {block.language && (
            <Text color="cyan" dimColor>{block.language}</Text>
          )}
          <Text color="white">{block.content}</Text>
        </Box>
      );

    case 'thinking':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={0}>
          <Text color="yellow" dimColor bold>Thinking</Text>
          <Text dimColor italic>{block.content}</Text>
        </Box>
      );

    case 'tool_call':
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginY={0}>
          <Text color="cyan" bold>Tool Call</Text>
          <Text>{block.content}</Text>
        </Box>
      );

    case 'tool_result': {
      const isDiff = block.content.includes('@@') || block.content.includes('+++ ');
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} marginY={0}>
          <Text color="green" bold>Result</Text>
          {isDiff ? <InlineDiff content={block.content} /> : <Text>{block.content}</Text>}
        </Box>
      );
    }

    default:
      return <Text>{block.content}</Text>;
  }
}

export default MessageList;
