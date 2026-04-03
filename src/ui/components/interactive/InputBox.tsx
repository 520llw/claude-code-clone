/**
 * Input Box Component for Claude Code Clone
 * Multiline input with history and autocomplete support
 * @module components/interactive/InputBox
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useRef, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';
import { useInputHistory, useInputCursor, useAutocomplete } from '../../hooks/useInput.js';
import type { AutocompleteSuggestion, InputHistoryEntry } from '../../types/index.js';

/**
 * Props for InputBox component
 */
export interface InputBoxProps {
  /** Input value (controlled) */
  value?: string;
  /** Default value (uncontrolled) */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input prompt */
  prompt?: string;
  /** Whether multiline */
  multiline?: boolean;
  /** Maximum lines for multiline */
  maxLines?: number;
  /** Maximum characters */
  maxLength?: number;
  /** Enable history */
  enableHistory?: boolean;
  /** History entries */
  history?: InputHistoryEntry[];
  /** Enable autocomplete */
  enableAutocomplete?: boolean;
  /** Autocomplete suggestions */
  suggestions?: AutocompleteSuggestion[];
  /** Whether input is focused */
  isFocused?: boolean;
  /** Whether input is disabled */
  isDisabled?: boolean;
  /** Whether to mask input (password) */
  mask?: boolean;
  /** Mask character */
  maskChar?: string;
  /** Custom render function */
  renderInput?: (props: {
    value: string;
    cursorPosition: number;
    placeholder?: string;
  }) => ReactNode;
  /** Callback on value change */
  onChange?: (value: string) => void;
  /** Callback on submit */
  onSubmit?: (value: string) => void;
  /** Callback on cancel */
  onCancel?: () => void;
  /** Callback on focus */
  onFocus?: () => void;
  /** Callback on blur */
  onBlur?: () => void;
  /** Callback on history navigation */
  onHistoryNavigate?: (entry: InputHistoryEntry) => void;
  /** Callback on autocomplete */
  onAutocomplete?: (suggestion: AutocompleteSuggestion) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for InputBox
 */
interface InputBoxErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class InputBoxErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  InputBoxErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): InputBoxErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('InputBox Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error in input</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Autocomplete dropdown component
 */
interface AutocompleteDropdownProps {
  /** Suggestions to display */
  suggestions: AutocompleteSuggestion[];
  /** Selected index */
  selectedIndex: number;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Maximum height */
  maxHeight?: number;
}

function AutocompleteDropdown({
  suggestions,
  selectedIndex,
  colors,
  maxHeight = 5,
}: AutocompleteDropdownProps): ReactNode {
  const displaySuggestions = suggestions.slice(0, maxHeight);
  
  return (
    <Box 
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.border}
      backgroundColor={colors.surface}
    >
      {displaySuggestions.map((suggestion, index) => (
        <Box 
          key={`${suggestion.value}-${index}`}
          flexDirection="row"
          gap={1}
          backgroundColor={index === selectedIndex ? colors.selection : undefined}
        >
          <Text color={colors.textMuted}>{suggestion.icon || '•'}</Text>
          <Text 
            color={index === selectedIndex ? colors.primary : colors.text}
            bold={index === selectedIndex}
          >
            {suggestion.label}
          </Text>
          {suggestion.description && (
            <Text color={colors.textMuted} dimColor>
              {suggestion.description}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * InputBox component - Multiline input with history and autocomplete
 * 
 * @example
 * ```tsx
 * <InputBox 
 *   placeholder="Type a message..."
 *   onSubmit={(value) => console.log(value)}
 *   enableHistory
 *   enableAutocomplete
 * />
 * ```
 */
function InputBoxComponent({
  value: controlledValue,
  defaultValue = '',
  placeholder,
  prompt = '>',
  multiline = false,
  maxLines = 10,
  maxLength,
  enableHistory = false,
  history: externalHistory,
  enableAutocomplete = false,
  suggestions = [],
  isFocused = true,
  isDisabled = false,
  mask = false,
  maskChar = '•',
  renderInput,
  onChange,
  onSubmit,
  onCancel,
  onFocus,
  onBlur,
  onHistoryNavigate,
  onAutocomplete,
  'data-testid': testId = 'input-box',
}: InputBoxProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const inputRef = useRef({ value: internalValue });
  
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  
  // History management
  const { history: localHistory, addToHistory } = useInputHistory({ maxSize: 100 });
  const history = externalHistory || localHistory;
  
  // Cursor management
  const cursor = useInputCursor();
  
  // Autocomplete
  const autocomplete = useAutocomplete(suggestions);
  
  // Update cursor when value changes
  useEffect(() => {
    cursor.setValue(value);
  }, [value]);
  
  const handleChange = useCallback((newValue: string) => {
    if (maxLength && newValue.length > maxLength) return;
    
    if (!isControlled) {
      setInternalValue(newValue);
    }
    inputRef.current.value = newValue;
    onChange?.(newValue);
    
    // Update autocomplete query
    if (enableAutocomplete) {
      autocomplete.setQuery(newValue);
    }
  }, [isControlled, maxLength, onChange, enableAutocomplete, autocomplete]);
  
  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      if (enableHistory) {
        addToHistory(value);
      }
      onSubmit?.(value);
      
      if (!isControlled) {
        setInternalValue('');
        cursor.setValue('');
      }
      setHistoryIndex(-1);
    }
  }, [value, enableHistory, onSubmit, isControlled, addToHistory, cursor]);
  
  const handleHistoryUp = useCallback(() => {
    if (!enableHistory || history.length === 0) return;
    
    if (historyIndex === -1) {
      setSavedInput(value);
    }
    
    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    
    const entry = history[newIndex];
    if (entry) {
      handleChange(entry.content);
      onHistoryNavigate?.(entry);
    }
  }, [enableHistory, history, historyIndex, value, handleChange, onHistoryNavigate]);
  
  const handleHistoryDown = useCallback(() => {
    if (!enableHistory || historyIndex === -1) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    if (newIndex === -1) {
      handleChange(savedInput);
    } else {
      const entry = history[newIndex];
      if (entry) {
        handleChange(entry.content);
        onHistoryNavigate?.(entry);
      }
    }
  }, [enableHistory, historyIndex, savedInput, history, handleChange, onHistoryNavigate]);
  
  const handleAutocompleteSelect = useCallback(() => {
    const suggestion = autocomplete.selectCurrent();
    if (suggestion) {
      handleChange(suggestion.value);
      onAutocomplete?.(suggestion);
      autocomplete.close();
    }
  }, [autocomplete, handleChange, onAutocomplete]);
  
  // Keyboard input handling
  useInput((input, key) => {
    if (!isFocused || isDisabled) return;
    
    // Handle autocomplete
    if (autocomplete.isOpen) {
      if (key.upArrow) {
        autocomplete.selectPrevious();
        return;
      }
      if (key.downArrow) {
        autocomplete.selectNext();
        return;
      }
      if (key.return || key.tab) {
        handleAutocompleteSelect();
        return;
      }
      if (key.escape) {
        autocomplete.close();
        return;
      }
    }
    
    // History navigation
    if (key.upArrow && enableHistory) {
      handleHistoryUp();
      return;
    }
    if (key.downArrow && enableHistory && historyIndex !== -1) {
      handleHistoryDown();
      return;
    }
    
    // Submit
    if (key.return && !multiline) {
      handleSubmit();
      return;
    }
    
    // Cancel
    if (key.escape) {
      onCancel?.();
      return;
    }
    
    // Character input
    if (input && !key.ctrl && !key.meta) {
      cursor.insertAtCursor(input);
      handleChange(cursor.value);
      
      if (enableAutocomplete) {
        autocomplete.open();
      }
    }
    
    // Backspace
    if (key.backspace || key.delete) {
      cursor.deleteBeforeCursor();
      handleChange(cursor.value);
    }
    
    // Cursor movement
    if (key.leftArrow) {
      cursor.moveCursorLeft();
    }
    if (key.rightArrow) {
      cursor.moveCursorRight();
    }
    if (key.home) {
      cursor.moveCursorToStart();
    }
    if (key.end) {
      cursor.moveCursorToEnd();
    }
  });
  
  // Render masked or plain value
  const displayValue = mask ? maskChar.repeat(value.length) : value;
  
  // Split into lines for multiline display
  const lines = multiline ? displayValue.split('\n') : [displayValue];
  const displayLines = lines.slice(-maxLines);
  
  return (
    <Box
      flexDirection="column"
      data-testid={testId}
    >
      {/* Input area */}
      <Box flexDirection="column">
        {renderInput ? (
          renderInput({ value, cursorPosition: cursor.cursorPosition, placeholder })
        ) : (
          <Box flexDirection="column">
            {displayLines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Text color={theme.colors.status.info}>{prompt}</Text>
                <Text 
                  color={line ? theme.colors.text : theme.colors.textMuted}
                  dimColor={!line}
                >
                  {line || placeholder || ''}
                </Text>
                {index === displayLines.length - 1 && isFocused && (
                  <Text color={theme.colors.cursor}>▌</Text>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
      
      {/* Autocomplete dropdown */}
      {enableAutocomplete && autocomplete.isOpen && autocomplete.filteredSuggestions.length > 0 && (
        <Box marginTop={1}>
          <AutocompleteDropdown
            suggestions={autocomplete.filteredSuggestions}
            selectedIndex={autocomplete.selectedIndex}
            colors={theme.colors}
          />
        </Box>
      )}
      
      {/* Character count */}
      {maxLength && (
        <Box flexDirection="row" justifyContent="flex-end">
          <Text 
            color={value.length > maxLength * 0.9 ? theme.colors.status.warning : theme.colors.textMuted}
            dimColor
          >
            {value.length}/{maxLength}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for InputBox
 */
InputBoxComponent.propTypes = {
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  placeholder: PropTypes.string,
  prompt: PropTypes.string,
  multiline: PropTypes.bool,
  maxLines: PropTypes.number,
  maxLength: PropTypes.number,
  enableHistory: PropTypes.bool,
  history: PropTypes.array,
  enableAutocomplete: PropTypes.bool,
  suggestions: PropTypes.array,
  isFocused: PropTypes.bool,
  isDisabled: PropTypes.bool,
  mask: PropTypes.bool,
  maskChar: PropTypes.string,
  renderInput: PropTypes.func,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onHistoryNavigate: PropTypes.func,
  onAutocomplete: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped InputBox with error boundary
 */
export function InputBox(props: InputBoxProps): ReactNode {
  return (
    <InputBoxErrorBoundary>
      <InputBoxComponent {...props} />
    </InputBoxErrorBoundary>
  );
}

/**
 * Simple single-line input
 */
export function SingleLineInput(
  props: Omit<InputBoxProps, 'multiline'>
): ReactNode {
  return <InputBox {...props} multiline={false} />;
}

SingleLineInput.propTypes = {
  placeholder: PropTypes.string,
};

/**
 * Password input
 */
export function PasswordInput(
  props: Omit<InputBoxProps, 'mask'>
): ReactNode {
  return <InputBox {...props} mask />;
}

PasswordInput.propTypes = {
  placeholder: PropTypes.string,
};

export default InputBox;
