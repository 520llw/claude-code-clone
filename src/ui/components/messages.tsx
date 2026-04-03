/**
 * Message List Component
 * 
 * Displays a scrollable list of chat messages with syntax highlighting.
 */

import React, { useRef, useEffect } from 'react';
import { Box, Text, Static } from 'ink';
import type { Message, MessageContent } from '@types/index';
import { format } from 'date-fns';

// ============================================================================
// Props
// ============================================================================

interface MessageListProps {
  messages: Message[];
  maxHeight: number;
  showTimestamps?: boolean;
  compactMode?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MessageList({
  messages,
  maxHeight,
  showTimestamps = false,
  compactMode = false,
}: MessageListProps): JSX.Element {
  const scrollRef = useRef<number>(0);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current = Math.max(0, messages.length - maxHeight);
  }, [messages.length, maxHeight]);
  
  // Calculate visible messages
  const visibleMessages = messages.slice(scrollRef.current);
  
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
    </Box>
  );
}

// ============================================================================
// Message Item Component
// ============================================================================

interface MessageItemProps {
  message: Message;
  showTimestamp: boolean;
  compactMode: boolean;
}

function MessageItem({ message, showTimestamp, compactMode }: MessageItemProps): JSX.Element {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';
  
  // Format timestamp
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString()
    : null;
  
  // Get role display
  const getRoleDisplay = () => {
    switch (message.role) {
      case 'user':
        return { text: 'You', color: 'blue' as const };
      case 'assistant':
        return { text: 'Claude', color: 'green' as const };
      case 'system':
        return { text: 'System', color: 'yellow' as const };
      case 'tool':
        return { text: 'Tool', color: 'magenta' as const };
      default:
        return { text: 'Unknown', color: 'gray' as const };
    }
  };
  
  const role = getRoleDisplay();
  
  // Render content
  const renderContent = () => {
    if (typeof message.content === 'string') {
      return <Text>{message.content}</Text>;
    }
    
    // Handle array of content blocks
    return (
      <Box flexDirection="column">
        {message.content.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </Box>
    );
  };
  
  // Render tool calls if present
  const renderToolCalls = () => {
    if (!message.toolCalls || message.toolCalls.length === 0) return null;
    
    return (
      <Box flexDirection="column" marginTop={1}>
        {message.toolCalls.map((toolCall, i) => (
          <Box key={i} flexDirection="column" borderStyle="single" paddingX={1}>
            <Text dimColor>Tool: {toolCall.name}</Text>
            <Text dimColor>Args: {JSON.stringify(toolCall.arguments, null, 2)}</Text>
          </Box>
        ))}
      </Box>
    );
  };
  
  // Render tool results if present
  const renderToolResults = () => {
    if (!message.toolResults || message.toolResults.length === 0) return null;
    
    return (
      <Box flexDirection="column" marginTop={1}>
        {message.toolResults.map((result, i) => (
          <Box key={i} flexDirection="column" borderStyle="single" paddingX={1}>
            <Text dimColor>Result:</Text>
            <Text dimColor>{JSON.stringify(result.result, null, 2)}</Text>
            {result.error && (
              <Text color="red">Error: {result.error}</Text>
            )}
          </Box>
        ))}
      </Box>
    );
  };
  
  if (compactMode) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text color={role.color} bold>{role.text}:</Text>{' '}
          {renderContent()}
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      {/* Header */}
      <Box>
        <Text color={role.color} bold>{role.text}</Text>
        {showTimestamp && timestamp && (
          <Text dimColor> {timestamp}</Text>
        )}
      </Box>
      
      {/* Content */}
      <Box marginLeft={2} flexDirection="column">
        {renderContent()}
        {renderToolCalls()}
        {renderToolResults()}
      </Box>
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
      return <Text>{block.content}</Text>;
    
    case 'code':
      return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginY={1}>
          {block.language && (
            <Text dimColor>{block.language}</Text>
          )}
          <Text>{block.content}</Text>
        </Box>
      );
    
    case 'thinking':
      return (
        <Box flexDirection="column" marginY={1}>
          <Text dimColor italic>💭 {block.content}</Text>
        </Box>
      );
    
    case 'tool_call':
      return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginY={1}>
          <Text color="cyan">🔧 Tool Call</Text>
          <Text>{block.content}</Text>
        </Box>
      );
    
    case 'tool_result':
      return (
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginY={1}>
          <Text color="green">✓ Tool Result</Text>
          <Text>{block.content}</Text>
        </Box>
      );
    
    default:
      return <Text>{block.content}</Text>;
  }
}

export default MessageList;
