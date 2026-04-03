/**
 * Keyboard shortcuts hook for Claude Code Clone
 * @module hooks/useKeyboard
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useInput, useApp } from 'ink';
import type { KeyboardShortcut, KeyPressEvent } from '../types/index.js';

/**
 * Keyboard handler function type
 */
export type KeyboardHandler = (input: string, key: KeyPressEvent) => boolean | void;

/**
 * Options for useKeyboard hook
 */
export interface UseKeyboardOptions {
  /** Whether keyboard handling is enabled */
  enabled?: boolean;
  /** Focus trap - only handle when focused */
  isFocused?: boolean;
  /** Stop propagation on handled keys */
  stopPropagation?: boolean;
}

/**
 * Hook for handling keyboard input
 * @param handler - Keyboard event handler
 * @param options - Hook options
 */
export function useKeyboard(
  handler: KeyboardHandler,
  options: UseKeyboardOptions = {}
): void {
  const { enabled = true, isFocused = true, stopPropagation = true } = options;
  const handlerRef = useRef(handler);
  
  // Keep handler reference up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useInput((input, key) => {
    if (!enabled || !isFocused) return;
    
    const event: KeyPressEvent = {
      key: input || getKeyName(key),
      ctrl: key.ctrl,
      alt: key.alt,
      shift: key.shift,
      meta: key.meta,
      input,
    };
    
    const result = handlerRef.current(input, event);
    
    if (stopPropagation && result !== false) {
      // Handler consumed the event
    }
  });
}

/**
 * Get key name from Ink key object
 */
function getKeyName(key: { upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean; escape?: boolean; tab?: boolean; backspace?: boolean; delete?: boolean; pageUp?: boolean; pageDown?: boolean; home?: boolean; end?: boolean }): string {
  if (key.upArrow) return 'ArrowUp';
  if (key.downArrow) return 'ArrowDown';
  if (key.leftArrow) return 'ArrowLeft';
  if (key.rightArrow) return 'ArrowRight';
  if (key.return) return 'Enter';
  if (key.escape) return 'Escape';
  if (key.tab) return 'Tab';
  if (key.backspace) return 'Backspace';
  if (key.delete) return 'Delete';
  if (key.pageUp) return 'PageUp';
  if (key.pageDown) return 'PageDown';
  if (key.home) return 'Home';
  if (key.end) return 'End';
  return 'Unknown';
}

/**
 * Hook for registering keyboard shortcuts
 * @param shortcuts - Array of keyboard shortcuts
 * @param options - Hook options
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardOptions = {}
): void {
  const { enabled = true, isFocused = true } = options;
  const shortcutsRef = useRef(shortcuts);
  
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useInput((input, key) => {
    if (!enabled || !isFocused) return;
    
    for (const shortcut of shortcutsRef.current) {
      if (!shortcut.enabled && shortcut.enabled !== undefined) continue;
      
      if (matchesShortcut(input, key, shortcut)) {
        shortcut.handler();
        break;
      }
    }
  });
}

/**
 * Check if key event matches a shortcut
 */
function matchesShortcut(
  input: string,
  key: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean; escape?: boolean; tab?: boolean; backspace?: boolean; delete?: boolean },
  shortcut: KeyboardShortcut
): boolean {
  const keyName = input || getKeyName(key);
  
  if (keyName.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }
  
  const modifiers = shortcut.modifiers || {};
  
  if (modifiers.ctrl !== undefined && key.ctrl !== modifiers.ctrl) return false;
  if (modifiers.alt !== undefined && key.alt !== modifiers.alt) return false;
  if (modifiers.shift !== undefined && key.shift !== modifiers.shift) return false;
  if (modifiers.meta !== undefined && key.meta !== modifiers.meta) return false;
  
  return true;
}

/**
 * Hook for arrow key navigation
 * @param itemCount - Total number of items
 * @param options - Navigation options
 * @returns Current index and navigation functions
 */
export function useArrowNavigation(
  itemCount: number,
  options: {
    initialIndex?: number;
    wrap?: boolean;
    enabled?: boolean;
  } = {}
): {
  index: number;
  setIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  first: () => void;
  last: () => void;
} {
  const { initialIndex = 0, wrap = true, enabled = true } = options;
  const [index, setIndex] = useState(initialIndex);
  
  const next = useCallback(() => {
    setIndex(current => {
      if (current < itemCount - 1) return current + 1;
      return wrap ? 0 : current;
    });
  }, [itemCount, wrap]);
  
  const previous = useCallback(() => {
    setIndex(current => {
      if (current > 0) return current - 1;
      return wrap ? itemCount - 1 : current;
    });
  }, [itemCount, wrap]);
  
  const first = useCallback(() => setIndex(0), []);
  const last = useCallback(() => setIndex(itemCount - 1), [itemCount]);
  
  useInput((input, key) => {
    if (!enabled) return;
    
    if (key.downArrow) {
      next();
    } else if (key.upArrow) {
      previous();
    } else if (key.home) {
      first();
    } else if (key.end) {
      last();
    }
  });
  
  return { index, setIndex, next, previous, first, last };
}

/**
 * Hook for handling confirmation keys (y/n)
 * @param onConfirm - Called when confirmed
 * @param onCancel - Called when cancelled
 * @param options - Hook options
 */
export function useConfirmationKeys(
  onConfirm: () => void,
  onCancel: () => void,
  options: { enabled?: boolean; confirmKey?: string; cancelKey?: string } = {}
): void {
  const { enabled = true, confirmKey = 'y', cancelKey = 'n' } = options;
  
  useInput((input, key) => {
    if (!enabled) return;
    
    if (key.return) {
      onConfirm();
    } else if (input.toLowerCase() === confirmKey.toLowerCase()) {
      onConfirm();
    } else if (input.toLowerCase() === cancelKey.toLowerCase()) {
      onCancel();
    } else if (key.escape) {
      onCancel();
    }
  });
}

/**
 * Hook for handling escape key
 * @param onEscape - Called when escape is pressed
 * @param options - Hook options
 */
export function useEscapeKey(
  onEscape: () => void,
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;
  
  useInput((input, key) => {
    if (!enabled) return;
    
    if (key.escape) {
      onEscape();
    }
  });
}

/**
 * Hook for handling enter key
 * @param onEnter - Called when enter is pressed
 * @param options - Hook options
 */
export function useEnterKey(
  onEnter: () => void,
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;
  
  useInput((input, key) => {
    if (!enabled) return;
    
    if (key.return) {
      onEnter();
    }
  });
}

/**
 * Hook for handling tab key
 * @param onTab - Called when tab is pressed
 * @param options - Hook options
 */
export function useTabKey(
  onTab: (shift: boolean) => void,
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;
  
  useInput((input, key) => {
    if (!enabled) return;
    
    if (key.tab) {
      onTab(key.shift);
    }
  });
}

/**
 * Hook for focus management
 * @param focusableCount - Number of focusable elements
 * @returns Focus state and controls
 */
export function useFocusManager(
  focusableCount: number
): {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  isFocused: (index: number) => boolean;
} {
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const focusNext = useCallback(() => {
    setFocusedIndex(current => 
      current < focusableCount - 1 ? current + 1 : current
    );
  }, [focusableCount]);
  
  const focusPrevious = useCallback(() => {
    setFocusedIndex(current => 
      current > 0 ? current - 1 : current
    );
  }, []);
  
  const focusFirst = useCallback(() => setFocusedIndex(0), []);
  const focusLast = useCallback(() => setFocusedIndex(focusableCount - 1), [focusableCount]);
  
  const isFocused = useCallback((index: number) => index === focusedIndex, [focusedIndex]);
  
  useInput((input, key) => {
    if (key.tab) {
      if (key.shift) {
        focusPrevious();
      } else {
        focusNext();
      }
    }
  });
  
  return {
    focusedIndex,
    setFocusedIndex,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    isFocused,
  };
}

/**
 * Hook for key sequence detection
 * @param sequence - Key sequence to detect
 * @param onMatch - Called when sequence is matched
 * @param options - Hook options
 */
export function useKeySequence(
  sequence: string[],
  onMatch: () => void,
  options: { enabled?: boolean; timeout?: number } = {}
): void {
  const { enabled = true, timeout = 1000 } = options;
  const [buffer, setBuffer] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useInput((input, key) => {
    if (!enabled) return;
    
    const keyName = input || getKeyName(key);
    const newBuffer = [...buffer, keyName];
    
    // Check if buffer matches sequence start
    const matches = sequence.every((seqKey, i) => 
      newBuffer[i]?.toLowerCase() === seqKey.toLowerCase()
    );
    
    if (!matches) {
      setBuffer([]);
      return;
    }
    
    setBuffer(newBuffer);
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Check if complete sequence matched
    if (newBuffer.length === sequence.length) {
      onMatch();
      setBuffer([]);
    } else {
      // Set timeout to clear buffer
      timeoutRef.current = setTimeout(() => {
        setBuffer([]);
      }, timeout);
    }
  });
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

/**
 * Hook for debounced keyboard input
 * @param delay - Debounce delay in ms
 * @returns Debounced input handler
 */
export function useDebouncedKeyboard(
  delay: number = 300
): {
  value: string;
  setValue: (value: string) => void;
  flush: () => void;
  clear: () => void;
} {
  const [value, setValueState] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const setValue = useCallback((newValue: string) => {
    setValueState(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(newValue);
    }, delay);
  }, [delay]);
  
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDebouncedValue(value);
  }, [value]);
  
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValueState('');
    setDebouncedValue('');
  }, []);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return { value: debouncedValue, setValue, flush, clear };
}

/**
 * Hook to get common keyboard shortcuts
 * @returns Common shortcuts configuration
 */
export function useCommonShortcuts(): Record<string, KeyboardShortcut> {
  return useMemo(() => ({
    quit: {
      key: 'c',
      modifiers: { ctrl: true },
      description: 'Quit application',
      handler: () => process.exit(0),
    },
    help: {
      key: '?',
      description: 'Show help',
      handler: () => {},
    },
    clear: {
      key: 'l',
      modifiers: { ctrl: true },
      description: 'Clear screen',
      handler: () => console.clear(),
    },
  }), []);
}

export default useKeyboard;
