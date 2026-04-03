/**
 * StreamingMessage Component
 *
 * Renders LLM output incrementally with a blinking cursor,
 * simulating the real Claude Code streaming experience.
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// ============================================================================
// Props
// ============================================================================

interface StreamingMessageProps {
  /** Current accumulated text */
  text: string;
  /** Whether the stream is still active */
  isStreaming: boolean;
  /** Role of the message sender */
  role?: string;
  /** Optional label color */
  color?: string;
}

// ============================================================================
// Blinking Cursor
// ============================================================================

function BlinkingCursor(): JSX.Element {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(v => !v);
    }, 530);
    return () => clearInterval(timer);
  }, []);

  return <Text color="cyan">{visible ? '█' : ' '}</Text>;
}

// ============================================================================
// Component
// ============================================================================

export function StreamingMessage({
  text,
  isStreaming,
  role = 'assistant',
  color = 'green',
}: StreamingMessageProps): JSX.Element {
  const icon = role === 'assistant' ? '◆' : '>';
  const label = role === 'assistant' ? 'Assistant' : role;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box>
        <Text color={color} bold>{icon} {label}</Text>
        {isStreaming && (
          <Text color="yellow" dimColor> [streaming]</Text>
        )}
      </Box>

      {/* Content */}
      <Box marginLeft={3} flexDirection="row" flexWrap="wrap">
        <Text>{text}</Text>
        {isStreaming && <BlinkingCursor />}
      </Box>
    </Box>
  );
}

export default StreamingMessage;
