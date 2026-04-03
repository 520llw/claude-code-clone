/**
 * Chat Input Component
 * 
 * A text input component for the chat interface with history support.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// ============================================================================
// Props
// ============================================================================

interface ChatInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps): JSX.Element {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Handle keyboard input
  useInput((char, key) => {
    if (disabled) return;
    
    // Handle special keys
    if (key.return) {
      if (input.trim()) {
        // Add to history
        setHistory(prev => [...prev, input]);
        setHistoryIndex(-1);
        
        // Submit
        onSubmit(input);
        setInput('');
        setCursorPosition(0);
      }
      return;
    }
    
    if (key.upArrow) {
      // Navigate history up
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
        setCursorPosition(history[history.length - 1 - newIndex].length);
      }
      return;
    }
    
    if (key.downArrow) {
      // Navigate history down
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
        setCursorPosition(history[history.length - 1 - newIndex].length);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setCursorPosition(0);
      }
      return;
    }
    
    if (key.leftArrow) {
      // Move cursor left
      setCursorPosition(pos => Math.max(0, pos - 1));
      return;
    }
    
    if (key.rightArrow) {
      // Move cursor right
      setCursorPosition(pos => Math.min(input.length, pos + 1));
      return;
    }
    
    if (key.home) {
      // Move to beginning
      setCursorPosition(0);
      return;
    }
    
    if (key.end) {
      // Move to end
      setCursorPosition(input.length);
      return;
    }
    
    if (key.delete) {
      // Delete character at cursor
      if (cursorPosition < input.length) {
        const newInput = input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
        setInput(newInput);
      }
      return;
    }
    
    if (key.backspace) {
      // Delete character before cursor
      if (cursorPosition > 0) {
        const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(pos => pos - 1);
      }
      return;
    }
    
    if (key.ctrl && char === 'c') {
      // Ctrl+C is handled by Ink
      return;
    }
    
    if (key.ctrl && char === 'u') {
      // Clear line
      setInput('');
      setCursorPosition(0);
      return;
    }
    
    if (key.ctrl && char === 'a') {
      // Move to beginning
      setCursorPosition(0);
      return;
    }
    
    if (key.ctrl && char === 'e') {
      // Move to end
      setCursorPosition(input.length);
      return;
    }
    
    if (key.ctrl && char === 'k') {
      // Delete to end of line
      setInput(input.slice(0, cursorPosition));
      return;
    }
    
    // Insert character
    if (char && !key.ctrl && !key.meta) {
      const newInput = input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(pos => pos + char.length);
    }
  });
  
  // Render input with cursor
  const renderInput = () => {
    if (disabled) {
      return (
        <Text dimColor>{placeholder}</Text>
      );
    }
    
    if (input.length === 0) {
      return (
        <Text dimColor>{placeholder}</Text>
      );
    }
    
    const beforeCursor = input.slice(0, cursorPosition);
    const atCursor = input[cursorPosition] || ' ';
    const afterCursor = input.slice(cursorPosition + 1);
    
    return (
      <Text>
        <Text color="green">{'>'}</Text>{' '}
        {beforeCursor}
        <Text backgroundColor="white" color="black">{atCursor}</Text>
        {afterCursor}
      </Text>
    );
  };
  
  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        {renderInput()}
      </Box>
    </Box>
  );
}

export default ChatInput;
