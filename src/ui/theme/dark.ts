/**
 * Dark themes collection for Claude Code Clone
 * @module theme/dark
 */

import type { Theme, PartialTheme } from './types.js';
import { defaultTheme, defaultBorderStyle, defaultSpacing, defaultTypography } from './default.js';

/**
 * Midnight theme - Deep blue dark theme
 */
export const midnightTheme: Theme = {
  name: 'Midnight',
  id: 'midnight',
  isDark: true,
  
  colors: {
    primary: '#60a5fa',
    secondary: '#a78bfa',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    border: '#334155',
    divider: '#1e293b',
    selection: '#334155',
    cursor: '#60a5fa',
    focus: '#60a5fa',
    hover: '#1e293b',
    active: '#334155',
    disabled: '#475569',
  },
  
  messages: {
    user: {
      text: '#f1f5f9',
      background: '#1e3a5f',
      border: '#3b82f6',
    },
    assistant: {
      text: '#f1f5f9',
      background: '#1e293b',
      border: '#334155',
    },
    system: {
      text: '#fbbf24',
      background: '#451a03',
      border: '#d97706',
    },
    error: {
      text: '#f87171',
      background: '#450a0a',
      border: '#dc2626',
    },
    tool: {
      text: '#4ade80',
      background: '#064e3b',
      border: '#10b981',
    },
  },
  
  status: {
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    pending: '#22d3ee',
    loading: '#38bdf8',
  },
  
  syntax: {
    keyword: '#c084fc',
    string: '#4ade80',
    number: '#fbbf24',
    comment: '#64748b',
    function: '#60a5fa',
    variable: '#f1f5f9',
    type: '#f472b6',
    operator: '#f87171',
    punctuation: '#94a3b8',
    background: '#0f172a',
  },
  
  diff: {
    added: '#064e3b',
    addedText: '#4ade80',
    removed: '#450a0a',
    removedText: '#f87171',
    unchanged: 'transparent',
    lineNumber: '#64748b',
    header: '#1e293b',
    headerText: '#f1f5f9',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
};

/**
 * Dracula-inspired dark theme
 */
export const draculaTheme: Theme = {
  name: 'Dracula',
  id: 'dracula',
  isDark: true,
  
  colors: {
    primary: '#bd93f9',
    secondary: '#ff79c6',
    background: '#282a36',
    surface: '#44475a',
    text: '#f8f8f2',
    textMuted: '#6272a4',
    border: '#6272a4',
    divider: '#44475a',
    selection: '#44475a',
    cursor: '#bd93f9',
    focus: '#bd93f9',
    hover: '#44475a',
    active: '#6272a4',
    disabled: '#6272a4',
  },
  
  messages: {
    user: {
      text: '#f8f8f2',
      background: '#6272a4',
      border: '#bd93f9',
    },
    assistant: {
      text: '#f8f8f2',
      background: '#44475a',
      border: '#6272a4',
    },
    system: {
      text: '#f1fa8c',
      background: '#44475a',
      border: '#f1fa8c',
    },
    error: {
      text: '#ff5555',
      background: '#44475a',
      border: '#ff5555',
    },
    tool: {
      text: '#50fa7b',
      background: '#44475a',
      border: '#50fa7b',
    },
  },
  
  status: {
    success: '#50fa7b',
    warning: '#f1fa8c',
    error: '#ff5555',
    info: '#8be9fd',
    pending: '#bd93f9',
    loading: '#ff79c6',
  },
  
  syntax: {
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    comment: '#6272a4',
    function: '#50fa7b',
    variable: '#f8f8f2',
    type: '#8be9fd',
    operator: '#ff79c6',
    punctuation: '#f8f8f2',
    background: '#282a36',
  },
  
  diff: {
    added: '#1d412c',
    addedText: '#50fa7b',
    removed: '#4a1c1c',
    removedText: '#ff5555',
    unchanged: 'transparent',
    lineNumber: '#6272a4',
    header: '#44475a',
    headerText: '#f8f8f2',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
};

/**
 * Monokai-inspired dark theme
 */
export const monokaiTheme: Theme = {
  name: 'Monokai',
  id: 'monokai',
  isDark: true,
  
  colors: {
    primary: '#66d9ef',
    secondary: '#f92672',
    background: '#272822',
    surface: '#3e3d32',
    text: '#f8f8f2',
    textMuted: '#75715e',
    border: '#75715e',
    divider: '#3e3d32',
    selection: '#49483e',
    cursor: '#66d9ef',
    focus: '#66d9ef',
    hover: '#3e3d32',
    active: '#49483e',
    disabled: '#75715e',
  },
  
  messages: {
    user: {
      text: '#f8f8f2',
      background: '#3e3d32',
      border: '#66d9ef',
    },
    assistant: {
      text: '#f8f8f2',
      background: '#272822',
      border: '#75715e',
    },
    system: {
      text: '#e6db74',
      background: '#3e3d32',
      border: '#e6db74',
    },
    error: {
      text: '#f92672',
      background: '#3e3d32',
      border: '#f92672',
    },
    tool: {
      text: '#a6e22e',
      background: '#3e3d32',
      border: '#a6e22e',
    },
  },
  
  status: {
    success: '#a6e22e',
    warning: '#fd971f',
    error: '#f92672',
    info: '#66d9ef',
    pending: '#ae81ff',
    loading: '#f92672',
  },
  
  syntax: {
    keyword: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    comment: '#75715e',
    function: '#a6e22e',
    variable: '#f8f8f2',
    type: '#66d9ef',
    operator: '#f92672',
    punctuation: '#f8f8f2',
    background: '#272822',
  },
  
  diff: {
    added: '#2d3b1f',
    addedText: '#a6e22e',
    removed: '#3b1f1f',
    removedText: '#f92672',
    unchanged: 'transparent',
    lineNumber: '#75715e',
    header: '#3e3d32',
    headerText: '#f8f8f2',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
};

/**
 * Nord-inspired dark theme
 */
export const nordTheme: Theme = {
  name: 'Nord',
  id: 'nord',
  isDark: true,
  
  colors: {
    primary: '#88c0d0',
    secondary: '#bf616a',
    background: '#2e3440',
    surface: '#3b4252',
    text: '#eceff4',
    textMuted: '#4c566a',
    border: '#4c566a',
    divider: '#3b4252',
    selection: '#434c5e',
    cursor: '#88c0d0',
    focus: '#88c0d0',
    hover: '#3b4252',
    active: '#434c5e',
    disabled: '#4c566a',
  },
  
  messages: {
    user: {
      text: '#eceff4',
      background: '#434c5e',
      border: '#88c0d0',
    },
    assistant: {
      text: '#eceff4',
      background: '#3b4252',
      border: '#4c566a',
    },
    system: {
      text: '#ebcb8b',
      background: '#434c5e',
      border: '#ebcb8b',
    },
    error: {
      text: '#bf616a',
      background: '#434c5e',
      border: '#bf616a',
    },
    tool: {
      text: '#a3be8c',
      background: '#434c5e',
      border: '#a3be8c',
    },
  },
  
  status: {
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    info: '#81a1c1',
    pending: '#b48ead',
    loading: '#88c0d0',
  },
  
  syntax: {
    keyword: '#81a1c1',
    string: '#a3be8c',
    number: '#b48ead',
    comment: '#616e88',
    function: '#88c0d0',
    variable: '#eceff4',
    type: '#8fbcbb',
    operator: '#81a1c1',
    punctuation: '#eceff4',
    background: '#2e3440',
  },
  
  diff: {
    added: '#3b4d3b',
    addedText: '#a3be8c',
    removed: '#4d3b3b',
    removedText: '#bf616a',
    unchanged: 'transparent',
    lineNumber: '#616e88',
    header: '#3b4252',
    headerText: '#eceff4',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
};

/**
 * Create a custom dark theme from partial configuration
 */
export function createDarkTheme(partial: PartialTheme): Theme {
  return {
    ...defaultTheme,
    ...partial,
    isDark: true,
    colors: {
      ...defaultTheme.colors,
      ...partial.colors,
    },
    messages: {
      ...defaultTheme.messages,
      ...partial.messages,
    },
    status: {
      ...defaultTheme.status,
      ...partial.status,
    },
    syntax: {
      ...defaultTheme.syntax,
      ...partial.syntax,
    },
    diff: {
      ...defaultTheme.diff,
      ...partial.diff,
    },
  };
}

/**
 * List all dark themes
 */
export function listDarkThemes(): Theme[] {
  return [defaultTheme, midnightTheme, draculaTheme, monokaiTheme, nordTheme];
}

export { defaultTheme };
