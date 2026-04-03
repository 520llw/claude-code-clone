/**
 * Enhanced Chat Input Component
 *
 * Multi-line text input with:
 * - Shift+Enter for newline, Enter to submit
 * - Ctrl+Enter as alternative submit
 * - Dynamic height (grows up to 10 lines)
 * - Input history navigation
 * - Slash command detection and autocomplete dropdown
 * - Paste multi-line detection
 * - Cursor movement and line editing
 */

import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// ============================================================================
// Types
// ============================================================================

interface ChatInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Available slash commands for autocomplete */
  slashCommands?: SlashCommandDef[];
  /** Callback when user is typing a slash command */
  onSlashCommandDetected?: (prefix: string) => void;
}

export interface SlashCommandDef {
  name: string;
  description: string;
  args?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_VISIBLE_LINES = 10;
const MAX_HISTORY = 100;
const MAX_COMPLETIONS = 8;

// ============================================================================
// Component
// ============================================================================

export function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = 'Type a message...',
  slashCommands = [],
  onSlashCommandDetected,
}: ChatInputProps): JSX.Element {
  const [lines, setLines] = useState<string[]>(['']);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCompletions, setShowCompletions] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);

  // Get current text value
  const getText = useCallback(() => lines.join('\n'), [lines]);

  // Get matching slash command completions
  const getCompletions = (): SlashCommandDef[] => {
    if (lines.length !== 1 || !(lines[0] ?? '').startsWith('/')) return [];
    const prefix = (lines[0] ?? '').toLowerCase();
    return slashCommands
      .filter(c => ('/' + c.name).toLowerCase().startsWith(prefix))
      .slice(0, MAX_COMPLETIONS);
  };

  const completions = showCompletions ? getCompletions() : [];

  // Submit handler
  const submit = useCallback(() => {
    const text = getText().trim();
    if (!text || disabled) return;

    // Add to history
    setHistory(prev => {
      const next = [text, ...prev.filter(h => h !== text)];
      return next.slice(0, MAX_HISTORY);
    });

    onSubmit(text);
    setLines(['']);
    setCursorLine(0);
    setCursorCol(0);
    setHistoryIndex(-1);
    setShowCompletions(false);
  }, [getText, disabled, onSubmit]);

  // Insert character at cursor
  const insertChar = useCallback((char: string) => {
    setLines(prev => {
      const newLines = [...prev];
      const line = newLines[cursorLine] || '';
      newLines[cursorLine] = line.slice(0, cursorCol) + char + line.slice(cursorCol);

      // Slash command detection
      if (newLines.length === 1 && (newLines[0] ?? '').startsWith('/')) {
        setShowCompletions(true);
        setCompletionIndex(0);
        onSlashCommandDetected?.(newLines[0] ?? '');
      } else {
        setShowCompletions(false);
      }

      return newLines;
    });
    setCursorCol(prev => prev + char.length);
  }, [cursorLine, cursorCol, onSlashCommandDetected]);

  // Insert newline
  const insertNewline = useCallback(() => {
    setLines(prev => {
      const newLines = [...prev];
      const line = newLines[cursorLine] || '';
      const before = line.slice(0, cursorCol);
      const after = line.slice(cursorCol);
      newLines[cursorLine] = before;
      newLines.splice(cursorLine + 1, 0, after);
      return newLines;
    });
    setCursorLine(prev => prev + 1);
    setCursorCol(0);
  }, [cursorLine, cursorCol]);

  // Apply completion
  const applyCompletion = useCallback((cmd: SlashCommandDef) => {
    const text = '/' + cmd.name + (cmd.args ? ' ' : '');
    setLines([text]);
    setCursorCol(text.length);
    setShowCompletions(false);
  }, []);

  useInput((input, key) => {
    if (disabled) return;

    // Tab - apply or cycle completion
    if (key.tab && showCompletions && completions.length > 0) {
      applyCompletion(completions[completionIndex]!);
      return;
    }

    // Enter → submit or apply completion
    if (key.return) {
      if (showCompletions && completions.length > 0) {
        applyCompletion(completions[completionIndex]!);
        return;
      }
      submit();
      return;
    }

    // Ctrl+J → insert newline (Shift+Enter alternative)
    if (key.ctrl && input === 'j') {
      insertNewline();
      return;
    }

    // Escape → close completions
    if (key.escape && showCompletions) {
      setShowCompletions(false);
      return;
    }

    // Backspace
    if (key.backspace) {
      if (cursorCol > 0) {
        setLines(prev => {
          const newLines = [...prev];
          const line = newLines[cursorLine] || '';
          newLines[cursorLine] = line.slice(0, cursorCol - 1) + line.slice(cursorCol);
          // Re-check completions
          if (newLines.length === 1 && (newLines[0] ?? '').startsWith('/')) {
            setShowCompletions(true);
          } else {
            setShowCompletions(false);
          }
          return newLines;
        });
        setCursorCol(prev => prev - 1);
      } else if (cursorLine > 0) {
        // Merge with previous line
        setLines(prev => {
          const newLines = [...prev];
          const prevLen = (newLines[cursorLine - 1] ?? '').length;
          newLines[cursorLine - 1] = (newLines[cursorLine - 1] ?? '') + (newLines[cursorLine] ?? '');
          newLines.splice(cursorLine, 1);
          setCursorCol(prevLen);
          return newLines;
        });
        setCursorLine(prev => prev - 1);
      }
      return;
    }

    // Delete
    if (key.delete) {
      setLines(prev => {
        const newLines = [...prev];
        const line = newLines[cursorLine] || '';
        if (cursorCol < line.length) {
          newLines[cursorLine] = line.slice(0, cursorCol) + line.slice(cursorCol + 1);
        } else if (cursorLine < newLines.length - 1) {
          newLines[cursorLine] = (newLines[cursorLine] ?? '') + (newLines[cursorLine + 1] ?? '');
          newLines.splice(cursorLine + 1, 1);
        }
        return newLines;
      });
      return;
    }

    // Left arrow
    if (key.leftArrow) {
      if (cursorCol > 0) {
        setCursorCol(prev => prev - 1);
      } else if (cursorLine > 0) {
        setCursorLine(prev => prev - 1);
        setCursorCol(lines[cursorLine - 1]?.length || 0);
      }
      return;
    }

    // Right arrow
    if (key.rightArrow) {
      const lineLen = lines[cursorLine]?.length || 0;
      if (cursorCol < lineLen) {
        setCursorCol(prev => prev + 1);
      } else if (cursorLine < lines.length - 1) {
        setCursorLine(prev => prev + 1);
        setCursorCol(0);
      }
      return;
    }

    // Up arrow
    if (key.upArrow) {
      if (showCompletions && completions.length > 0) {
        setCompletionIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (cursorLine > 0) {
        setCursorLine(prev => prev - 1);
        setCursorCol(Math.min(cursorCol, lines[cursorLine - 1]?.length || 0));
      } else if (lines.length === 1 && history.length > 0) {
        const newIdx = historyIndex + 1;
        if (newIdx < history.length) {
          setHistoryIndex(newIdx);
          const histLines = (history[newIdx] ?? '').split('\n');
          setLines(histLines);
          setCursorLine(histLines.length - 1);
          setCursorCol((histLines[histLines.length - 1] ?? '').length);
        }
      }
      return;
    }

    // Down arrow
    if (key.downArrow) {
      if (showCompletions && completions.length > 0) {
        setCompletionIndex(prev => Math.min(completions.length - 1, prev + 1));
        return;
      }
      if (cursorLine < lines.length - 1) {
        setCursorLine(prev => prev + 1);
        setCursorCol(Math.min(cursorCol, lines[cursorLine + 1]?.length ?? 0));
      } else if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        const histLines = (history[newIdx] ?? '').split('\n');
        setLines(histLines);
        setCursorLine(histLines.length - 1);
        setCursorCol((histLines[histLines.length - 1] ?? '').length);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setLines(['']);
        setCursorLine(0);
        setCursorCol(0);
      }
      return;
    }

    // Ctrl+A → beginning of line
    if (key.ctrl && input === 'a') {
      setCursorCol(0);
      return;
    }

    // Ctrl+E → end of line
    if (key.ctrl && input === 'e') {
      setCursorCol(lines[cursorLine]?.length || 0);
      return;
    }

    // Ctrl+U → clear to beginning of line
    if (key.ctrl && input === 'u') {
      setLines(prev => {
        const newLines = [...prev];
        newLines[cursorLine] = (newLines[cursorLine] || '').slice(cursorCol);
        return newLines;
      });
      setCursorCol(0);
      return;
    }

    // Ctrl+K → delete to end of line
    if (key.ctrl && input === 'k') {
      setLines(prev => {
        const newLines = [...prev];
        newLines[cursorLine] = (newLines[cursorLine] || '').slice(0, cursorCol);
        return newLines;
      });
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      insertChar(input);
    }
  });

  // Render
  const visibleLines = lines.slice(0, MAX_VISIBLE_LINES);
  const lineCount = lines.length;
  const isMultiline = lineCount > 1;

  if (disabled) {
    return (
      <Box paddingX={1}>
        <Text color="gray">{placeholder}</Text>
      </Box>
    );
  }

  // Empty state
  const isEmpty = lines.length === 1 && lines[0] === '';

  return (
    <Box flexDirection="column">
      {/* Slash command autocomplete dropdown */}
      {showCompletions && completions.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor="cyan" marginBottom={0}>
          {completions.map((cmd, i) => (
            <Box key={cmd.name} paddingX={1}>
              <Text
                color={i === completionIndex ? 'cyan' : 'white'}
                bold={i === completionIndex}
                inverse={i === completionIndex}
              >
                {' /' + cmd.name}
              </Text>
              {cmd.args && <Text dimColor> {cmd.args}</Text>}
              <Text dimColor> - {cmd.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Input area */}
      <Box flexDirection="row" paddingX={1}>
        {/* Prompt */}
        <Text color={isMultiline ? 'yellow' : 'green'} bold>
          {isMultiline ? '| ' : '> '}
        </Text>

        {/* Text content */}
        <Box flexDirection="column" flexGrow={1}>
          {isEmpty ? (
            <Box>
              <Text inverse>{' '}</Text>
              <Text dimColor> {placeholder}</Text>
            </Box>
          ) : (
            visibleLines.map((line, lineIdx) => (
              <Box key={lineIdx} flexDirection="row">
                {isMultiline && (
                  <Text dimColor>{String(lineIdx + 1).padStart(2, ' ')} </Text>
                )}
                {lineIdx === cursorLine ? (
                  <Text>
                    {line.slice(0, cursorCol)}
                    <Text inverse>{line[cursorCol] || ' '}</Text>
                    {line.slice(cursorCol + 1)}
                  </Text>
                ) : (
                  <Text>{line || ' '}</Text>
                )}
              </Box>
            ))
          )}
          {lineCount > MAX_VISIBLE_LINES && (
            <Text dimColor>  ... (+{lineCount - MAX_VISIBLE_LINES} lines)</Text>
          )}
        </Box>

        {/* Line count */}
        {isMultiline && <Text dimColor> L{lineCount}</Text>}
      </Box>

      {/* Multi-line hint */}
      {isMultiline && (
        <Box paddingX={3}>
          <Text dimColor>Ctrl+J: new line | Enter: send</Text>
        </Box>
      )}
    </Box>
  );
}

export default ChatInput;
