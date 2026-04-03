/**
 * Enhanced input handling hook for Claude Code Clone
 * @module hooks/useInput
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useInput as useInkInput } from 'ink';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { InputHistoryEntry, AutocompleteSuggestion } from '../types/index.js';

/**
 * Get the file path for persistent history storage
 */
function getHistoryFilePath(storageKey: string): string {
  return path.join(os.homedir(), '.claude-code', `${storageKey}.json`);
}

/**
 * Read history from file
 */
function readHistoryFromFile(storageKey: string): InputHistoryEntry[] {
  try {
    const filePath = getHistoryFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data).map((entry: InputHistoryEntry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

/**
 * Write history to file
 */
function writeHistoryToFile(storageKey: string, history: InputHistoryEntry[]): void {
  try {
    const filePath = getHistoryFilePath(storageKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(history), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

/**
 * Remove history file
 */
function removeHistoryFile(storageKey: string): void {
  try {
    const filePath = getHistoryFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore remove errors
  }
}

/**
 * Input state interface
 */
export interface InputState {
  /** Current input value */
  value: string;
  /** Cursor position */
  cursorPosition: number;
  /** Selection start */
  selectionStart: number;
  /** Selection end */
  selectionEnd: number;
  /** Whether input is focused */
  isFocused: boolean;
}

/**
 * Input history options
 */
export interface InputHistoryOptions {
  /** Maximum history entries */
  maxSize?: number;
  /** Persist to storage */
  persist?: boolean;
  /** Storage key */
  storageKey?: string;
}

/**
 * Hook for managing input history
 * @param options - History options
 * @returns History state and controls
 */
export function useInputHistory(options: InputHistoryOptions = {}): {
  history: InputHistoryEntry[];
  addToHistory: (content: string, type?: 'command' | 'message') => void;
  clearHistory: () => void;
  searchHistory: (query: string) => InputHistoryEntry[];
  getRecent: (count?: number) => InputHistoryEntry[];
} {
  const { maxSize = 1000, persist = false, storageKey = 'input-history' } = options;
  const [history, setHistory] = useState<InputHistoryEntry[]>(() => {
    if (persist) {
      return readHistoryFromFile(storageKey);
    }
    return [];
  });
  
  /**
   * Add entry to history
   */
  const addToHistory = useCallback((content: string, type: 'command' | 'message' = 'message') => {
    if (!content.trim()) return;
    
    setHistory(prev => {
      const newEntry: InputHistoryEntry = {
        content: content.trim(),
        timestamp: new Date(),
        type,
      };
      
      // Avoid duplicates at the top
      if (prev.length > 0 && prev[0].content === newEntry.content) {
        return prev;
      }
      
      const newHistory = [newEntry, ...prev].slice(0, maxSize);

      if (persist) {
        writeHistoryToFile(storageKey, newHistory);
      }
      
      return newHistory;
    });
  }, [maxSize, persist, storageKey]);
  
  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    if (persist) {
      removeHistoryFile(storageKey);
    }
  }, [persist, storageKey]);
  
  /**
   * Search history entries
   */
  const searchHistory = useCallback((query: string): InputHistoryEntry[] => {
    const lowerQuery = query.toLowerCase();
    return history.filter(entry => 
      entry.content.toLowerCase().includes(lowerQuery)
    );
  }, [history]);
  
  /**
   * Get recent entries
   */
  const getRecent = useCallback((count: number = 10): InputHistoryEntry[] => {
    return history.slice(0, count);
  }, [history]);
  
  return {
    history,
    addToHistory,
    clearHistory,
    searchHistory,
    getRecent,
  };
}

/**
 * Hook for input cursor management
 * @param initialValue - Initial input value
 * @returns Cursor state and controls
 */
export function useInputCursor(initialValue: string = ''): {
  value: string;
  cursorPosition: number;
  setValue: (value: string) => void;
  setCursorPosition: (position: number) => void;
  moveCursorLeft: (steps?: number) => void;
  moveCursorRight: (steps?: number) => void;
  moveCursorToStart: () => void;
  moveCursorToEnd: () => void;
  moveCursorToWordStart: () => void;
  moveCursorToWordEnd: () => void;
  insertAtCursor: (text: string) => void;
  deleteBeforeCursor: (count?: number) => void;
  deleteAfterCursor: (count?: number) => void;
  deleteWordBeforeCursor: () => void;
  deleteWordAfterCursor: () => void;
} {
  const [value, setValueState] = useState(initialValue);
  const [cursorPosition, setCursorPositionState] = useState(0);
  
  const setValue = useCallback((newValue: string) => {
    setValueState(newValue);
    setCursorPositionState(Math.min(cursorPosition, newValue.length));
  }, [cursorPosition]);
  
  const setCursorPosition = useCallback((position: number) => {
    setCursorPositionState(Math.max(0, Math.min(position, value.length)));
  }, [value.length]);
  
  const moveCursorLeft = useCallback((steps: number = 1) => {
    setCursorPositionState(pos => Math.max(0, pos - steps));
  }, []);
  
  const moveCursorRight = useCallback((steps: number = 1) => {
    setCursorPositionState(pos => Math.min(value.length, pos + steps));
  }, [value.length]);
  
  const moveCursorToStart = useCallback(() => {
    setCursorPositionState(0);
  }, []);
  
  const moveCursorToEnd = useCallback(() => {
    setCursorPositionState(value.length);
  }, [value.length]);
  
  const moveCursorToWordStart = useCallback(() => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(\S+\s*)$/);
    if (match) {
      setCursorPositionState(cursorPosition - match[0].length);
    } else {
      moveCursorToStart();
    }
  }, [value, cursorPosition, moveCursorToStart]);
  
  const moveCursorToWordEnd = useCallback(() => {
    const afterCursor = value.slice(cursorPosition);
    const match = afterCursor.match(/^(\s*\S+)/);
    if (match) {
      setCursorPositionState(cursorPosition + match[0].length);
    } else {
      moveCursorToEnd();
    }
  }, [value, cursorPosition, moveCursorToEnd]);
  
  const insertAtCursor = useCallback((text: string) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    setValueState(before + text + after);
    setCursorPositionState(cursorPosition + text.length);
  }, [value, cursorPosition]);
  
  const deleteBeforeCursor = useCallback((count: number = 1) => {
    const before = value.slice(0, Math.max(0, cursorPosition - count));
    const after = value.slice(cursorPosition);
    setValueState(before + after);
    setCursorPositionState(Math.max(0, cursorPosition - count));
  }, [value, cursorPosition]);
  
  const deleteAfterCursor = useCallback((count: number = 1) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition + count);
    setValueState(before + after);
  }, [value, cursorPosition]);
  
  const deleteWordBeforeCursor = useCallback(() => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(\S+\s*)$/);
    if (match) {
      deleteBeforeCursor(match[0].length);
    }
  }, [value, cursorPosition, deleteBeforeCursor]);
  
  const deleteWordAfterCursor = useCallback(() => {
    const afterCursor = value.slice(cursorPosition);
    const match = afterCursor.match(/^(\s*\S+)/);
    if (match) {
      deleteAfterCursor(match[0].length);
    }
  }, [value, cursorPosition, deleteAfterCursor]);
  
  return {
    value,
    cursorPosition,
    setValue,
    setCursorPosition,
    moveCursorLeft,
    moveCursorRight,
    moveCursorToStart,
    moveCursorToEnd,
    moveCursorToWordStart,
    moveCursorToWordEnd,
    insertAtCursor,
    deleteBeforeCursor,
    deleteAfterCursor,
    deleteWordBeforeCursor,
    deleteWordAfterCursor,
  };
}

/**
 * Hook for input selection management
 * @returns Selection state and controls
 */
export function useInputSelection(): {
  selectionStart: number;
  selectionEnd: number;
  hasSelection: boolean;
  selectedText: string;
  setSelection: (start: number, end: number) => void;
  clearSelection: () => void;
  selectAll: (textLength: number) => void;
  selectWordAt: (text: string, position: number) => void;
  selectLineAt: (text: string, position: number) => void;
  deleteSelection: (text: string) => { newText: string; newPosition: number };
  replaceSelection: (text: string, replacement: string) => { newText: string; newPosition: number };
} {
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  const hasSelection = selectionStart !== selectionEnd;
  
  const setSelection = useCallback((start: number, end: number) => {
    setSelectionStart(Math.min(start, end));
    setSelectionEnd(Math.max(start, end));
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectionStart(0);
    setSelectionEnd(0);
  }, []);
  
  const selectAll = useCallback((textLength: number) => {
    setSelectionStart(0);
    setSelectionEnd(textLength);
  }, []);
  
  const selectWordAt = useCallback((text: string, position: number) => {
    const before = text.slice(0, position);
    const after = text.slice(position);
    
    const beforeMatch = before.match(/\S+$/);
    const afterMatch = after.match(/^\S+/);
    
    const start = beforeMatch ? position - beforeMatch[0].length : position;
    const end = afterMatch ? position + afterMatch[0].length : position;
    
    setSelection(start, end);
  }, [setSelection]);
  
  const selectLineAt = useCallback((text: string, position: number) => {
    const lines = text.slice(0, position).split('\n');
    const currentLineStart = lines.slice(0, -1).join('\n').length + (lines.length > 1 ? 1 : 0);
    const nextLineStart = text.indexOf('\n', position);
    
    setSelection(currentLineStart, nextLineStart === -1 ? text.length : nextLineStart);
  }, [setSelection]);
  
  const deleteSelection = useCallback((text: string) => {
    const before = text.slice(0, selectionStart);
    const after = text.slice(selectionEnd);
    return {
      newText: before + after,
      newPosition: selectionStart,
    };
  }, [selectionStart, selectionEnd]);
  
  const replaceSelection = useCallback((text: string, replacement: string) => {
    const before = text.slice(0, selectionStart);
    const after = text.slice(selectionEnd);
    return {
      newText: before + replacement + after,
      newPosition: selectionStart + replacement.length,
    };
  }, [selectionStart, selectionEnd]);
  
  const selectedText = useMemo(() => '', []); // Would need text parameter
  
  return {
    selectionStart,
    selectionEnd,
    hasSelection,
    selectedText,
    setSelection,
    clearSelection,
    selectAll,
    selectWordAt,
    selectLineAt,
    deleteSelection,
    replaceSelection,
  };
}

/**
 * Hook for multiline input management
 * @returns Multiline input state and controls
 */
export function useMultilineInput(): {
  lines: string[];
  currentLine: number;
  currentColumn: number;
  setLines: (lines: string[]) => void;
  insertLine: (lineIndex?: number) => void;
  deleteLine: (lineIndex?: number) => void;
  moveLineUp: () => void;
  moveLineDown: () => void;
  getText: () => string;
  setText: (text: string) => void;
} {
  const [lines, setLinesState] = useState<string[]>(['']);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentColumn, setCurrentColumn] = useState(0);
  
  const setLines = useCallback((newLines: string[]) => {
    setLinesState(newLines);
    setCurrentLine(Math.min(currentLine, newLines.length - 1));
  }, [currentLine]);
  
  const insertLine = useCallback((lineIndex?: number) => {
    const index = lineIndex ?? currentLine + 1;
    const newLines = [...lines];
    newLines.splice(index, 0, '');
    setLinesState(newLines);
    setCurrentLine(index);
    setCurrentColumn(0);
  }, [lines, currentLine]);
  
  const deleteLine = useCallback((lineIndex?: number) => {
    const index = lineIndex ?? currentLine;
    if (lines.length <= 1) {
      setLinesState(['']);
      setCurrentLine(0);
      setCurrentColumn(0);
      return;
    }
    
    const newLines = lines.filter((_, i) => i !== index);
    setLinesState(newLines);
    setCurrentLine(Math.min(index, newLines.length - 1));
  }, [lines, currentLine]);
  
  const moveLineUp = useCallback(() => {
    setCurrentLine(line => Math.max(0, line - 1));
  }, []);
  
  const moveLineDown = useCallback(() => {
    setCurrentLine(line => Math.min(lines.length - 1, line + 1));
  }, [lines.length]);
  
  const getText = useCallback(() => lines.join('\n'), [lines]);
  
  const setText = useCallback((text: string) => {
    const newLines = text.split('\n');
    setLinesState(newLines.length > 0 ? newLines : ['']);
    setCurrentLine(0);
    setCurrentColumn(0);
  }, []);
  
  return {
    lines,
    currentLine,
    currentColumn,
    setLines,
    insertLine,
    deleteLine,
    moveLineUp,
    moveLineDown,
    getText,
    setText,
  };
}

/**
 * Hook for autocomplete functionality
 * @param suggestions - Available suggestions
 * @returns Autocomplete state and controls
 */
export function useAutocomplete(
  suggestions: AutocompleteSuggestion[]
): {
  filteredSuggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  isOpen: boolean;
  query: string;
  setQuery: (query: string) => void;
  open: () => void;
  close: () => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectCurrent: () => AutocompleteSuggestion | null;
  acceptSuggestion: (suggestion: AutocompleteSuggestion) => string;
} {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredSuggestions = useMemo(() => {
    if (!query) return suggestions.slice(0, 10);
    const lowerQuery = query.toLowerCase();
    return suggestions
      .filter(s => 
        s.label.toLowerCase().includes(lowerQuery) ||
        s.value.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 10);
  }, [query, suggestions]);
  
  const open = useCallback(() => {
    setIsOpen(true);
    setSelectedIndex(0);
  }, []);
  
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(0);
  }, []);
  
  const selectNext = useCallback(() => {
    setSelectedIndex(i => 
      Math.min(filteredSuggestions.length - 1, i + 1)
    );
  }, [filteredSuggestions.length]);
  
  const selectPrevious = useCallback(() => {
    setSelectedIndex(i => Math.max(0, i - 1));
  }, []);
  
  const selectCurrent = useCallback(() => {
    return filteredSuggestions[selectedIndex] || null;
  }, [filteredSuggestions, selectedIndex]);
  
  const acceptSuggestion = useCallback((suggestion: AutocompleteSuggestion) => {
    close();
    return suggestion.value;
  }, [close]);
  
  return {
    filteredSuggestions,
    selectedIndex,
    isOpen,
    query,
    setQuery,
    open,
    close,
    selectNext,
    selectPrevious,
    selectCurrent,
    acceptSuggestion,
  };
}

export default useInputHistory;
