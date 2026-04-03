/**
 * Custom hooks for Claude Code Clone UI
 * @module hooks
 */

// Theme hooks
export {
  useTheme,
  useCurrentTheme,
  useThemeColors,
  useThemeColor,
  useIsDarkTheme,
  useAvailableThemes,
  useThemeSwitcher,
  useThemeStyles,
  useThemeAnimations,
  ThemeProvider,
  ThemeContext,
} from './useTheme.js';

// Terminal hooks
export {
  useTerminalSize,
  useTerminalCapabilities,
  useTerminalSupports,
  useTerminalColors,
  useContentWidth,
  useTerminalBreakpoint,
  useTerminalFocus,
  useTerminalEnvironment,
  useTextWrap,
  useTerminal,
} from './useTerminal.js';

// Keyboard hooks
export {
  useKeyboard,
  useKeyboardShortcuts,
  useArrowNavigation,
  useConfirmationKeys,
  useEscapeKey,
  useEnterKey,
  useTabKey,
  useFocusManager,
  useKeySequence,
  useDebouncedKeyboard,
  useCommonShortcuts,
} from './useKeyboard.js';

// Streaming hooks
export {
  useStreaming,
  useTypewriter,
  useWordStreaming,
  useLineStreaming,
  useStreamingMetrics,
} from './useStreaming.js';

// Input hooks
export {
  useInputHistory,
  useInputCursor,
  useInputSelection,
  useMultilineInput,
  useAutocomplete,
} from './useInput.js';

// Re-export types
export type { KeyboardHandler, UseKeyboardOptions } from './useKeyboard.js';
export type { InputHistoryOptions } from './useInput.js';
