/**
 * Default theme configuration for Claude Code Clone
 * @module theme/default
 */

import type { Theme, BorderStyle, Spacing, Typography } from './types.js';

/**
 * Default border style - single line
 */
export const defaultBorderStyle: BorderStyle = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
};

/**
 * Default spacing values
 */
export const defaultSpacing: Spacing = {
  top: 1,
  right: 2,
  bottom: 1,
  left: 2,
};

/**
 * Default typography settings
 */
export const defaultTypography: Typography = {
  fontSize: 1,
  lineHeight: 1.2,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

/**
 * Default theme - Dark mode (Claude Code style)
 */
export const defaultTheme: Theme = {
  name: 'Default Dark',
  id: 'default-dark',
  isDark: true,
  
  colors: {
    primary: 'cyan',
    secondary: 'magenta',
    background: 'black',
    surface: '#1a1a2e',
    text: 'white',
    textMuted: 'gray',
    border: '#3d3d5c',
    divider: '#2a2a3e',
    selection: '#3d3d5c',
    cursor: 'cyan',
    focus: 'cyan',
    hover: '#2a2a3e',
    active: '#3d3d5c',
    disabled: 'gray',
  },
  
  messages: {
    user: {
      text: 'white',
      background: '#1a3a4a',
      border: '#2a5a6a',
    },
    assistant: {
      text: 'white',
      background: '#1a1a2e',
      border: '#3d3d5c',
    },
    system: {
      text: 'yellow',
      background: '#2a2a1e',
      border: '#4a4a2e',
    },
    error: {
      text: 'redBright',
      background: '#3a1a1a',
      border: '#5a2a2a',
    },
    tool: {
      text: 'green',
      background: '#1a2a1a',
      border: '#2a4a2a',
    },
  },
  
  status: {
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    pending: 'cyan',
    loading: 'cyanBright',
  },
  
  syntax: {
    keyword: 'magenta',
    string: 'green',
    number: 'yellow',
    comment: 'gray',
    function: 'cyan',
    variable: 'white',
    type: 'yellowBright',
    operator: 'red',
    punctuation: 'white',
    background: '#0d0d1a',
  },
  
  diff: {
    added: '#1a3a1a',
    addedText: 'greenBright',
    removed: '#3a1a1a',
    removedText: 'redBright',
    unchanged: 'transparent',
    lineNumber: 'gray',
    header: '#2a2a3e',
    headerText: 'white',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
  
  components: {
    InputBox: {
      maxHeight: 10,
      showLineNumbers: false,
    },
    CodeBlock: {
      maxHeight: 30,
      showLineNumbers: true,
      wrapLines: false,
    },
    Spinner: {
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    },
  },
};

/**
 * Default light theme
 */
export const defaultLightTheme: Theme = {
  name: 'Default Light',
  id: 'default-light',
  isDark: false,
  
  colors: {
    primary: 'blue',
    secondary: 'magenta',
    background: 'white',
    surface: '#f5f5f5',
    text: 'black',
    textMuted: 'gray',
    border: '#cccccc',
    divider: '#e0e0e0',
    selection: '#b3d9ff',
    cursor: 'blue',
    focus: 'blue',
    hover: '#e8e8e8',
    active: '#d0d0d0',
    disabled: '#999999',
  },
  
  messages: {
    user: {
      text: 'black',
      background: '#e3f2fd',
      border: '#90caf9',
    },
    assistant: {
      text: 'black',
      background: '#f5f5f5',
      border: '#e0e0e0',
    },
    system: {
      text: '#f57c00',
      background: '#fff3e0',
      border: '#ffcc80',
    },
    error: {
      text: '#d32f2f',
      background: '#ffebee',
      border: '#ef9a9a',
    },
    tool: {
      text: '#388e3c',
      background: '#e8f5e9',
      border: '#a5d6a7',
    },
  },
  
  status: {
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    pending: 'cyan',
    loading: 'blueBright',
  },
  
  syntax: {
    keyword: '#d73a49',
    string: '#032f62',
    number: '#005cc5',
    comment: '#6a737d',
    function: '#6f42c1',
    variable: '#24292e',
    type: '#e36209',
    operator: '#d73a49',
    punctuation: '#24292e',
    background: '#f6f8fa',
  },
  
  diff: {
    added: '#e6ffed',
    addedText: '#22863a',
    removed: '#ffeef0',
    removedText: '#cb2431',
    unchanged: 'transparent',
    lineNumber: '#6a737d',
    header: '#f1f8ff',
    headerText: '#24292e',
  },
  
  borderStyle: defaultBorderStyle,
  spacing: defaultSpacing,
  typography: defaultTypography,
  
  animations: {
    enabled: true,
    speed: 1,
    cursorBlinkRate: 530,
  },
  
  components: {
    InputBox: {
      maxHeight: 10,
      showLineNumbers: false,
    },
    CodeBlock: {
      maxHeight: 30,
      showLineNumbers: true,
      wrapLines: false,
    },
    Spinner: {
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    },
  },
};

/**
 * High contrast dark theme for accessibility
 */
export const highContrastDarkTheme: Theme = {
  ...defaultTheme,
  name: 'High Contrast Dark',
  id: 'high-contrast-dark',
  colors: {
    ...defaultTheme.colors,
    primary: 'white',
    secondary: 'yellow',
    text: 'white',
    textMuted: 'whiteBright',
    border: 'white',
    divider: 'white',
    focus: 'yellow',
    cursor: 'yellow',
  },
  messages: {
    user: {
      text: 'white',
      background: 'black',
      border: 'cyan',
    },
    assistant: {
      text: 'white',
      background: 'black',
      border: 'white',
    },
    system: {
      text: 'yellow',
      background: 'black',
      border: 'yellow',
    },
    error: {
      text: 'redBright',
      background: 'black',
      border: 'red',
    },
    tool: {
      text: 'greenBright',
      background: 'black',
      border: 'green',
    },
  },
};

/**
 * Get theme by ID
 */
export function getThemeById(id: string): Theme | undefined {
  const themes = [defaultTheme, defaultLightTheme, highContrastDarkTheme];
  return themes.find(theme => theme.id === id);
}

/**
 * List all available default themes
 */
export function listDefaultThemes(): Theme[] {
  return [defaultTheme, defaultLightTheme, highContrastDarkTheme];
}

export default defaultTheme;
