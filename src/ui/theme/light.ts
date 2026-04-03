/**
 * Light themes collection for Claude Code Clone
 * @module theme/light
 */

import type { Theme, PartialTheme } from './types.js';
import { defaultLightTheme, defaultBorderStyle, defaultSpacing, defaultTypography } from './default.js';

/**
 * Solarized light theme
 */
export const solarizedLightTheme: Theme = {
  name: 'Solarized Light',
  id: 'solarized-light',
  isDark: false,
  
  colors: {
    primary: '#268bd2',
    secondary: '#d33682',
    background: '#fdf6e3',
    surface: '#eee8d5',
    text: '#073642',
    textMuted: '#93a1a1',
    border: '#93a1a1',
    divider: '#eee8d5',
    selection: '#eee8d5',
    cursor: '#268bd2',
    focus: '#268bd2',
    hover: '#eee8d5',
    active: '#93a1a1',
    disabled: '#93a1a1',
  },
  
  messages: {
    user: {
      text: '#073642',
      background: '#e8e4d8',
      border: '#268bd2',
    },
    assistant: {
      text: '#073642',
      background: '#fdf6e3',
      border: '#93a1a1',
    },
    system: {
      text: '#b58900',
      background: '#eee8d5',
      border: '#b58900',
    },
    error: {
      text: '#dc322f',
      background: '#eee8d5',
      border: '#dc322f',
    },
    tool: {
      text: '#859900',
      background: '#eee8d5',
      border: '#859900',
    },
  },
  
  status: {
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    info: '#268bd2',
    pending: '#2aa198',
    loading: '#268bd2',
  },
  
  syntax: {
    keyword: '#d33682',
    string: '#2aa198',
    number: '#d33682',
    comment: '#93a1a1',
    function: '#268bd2',
    variable: '#073642',
    type: '#b58900',
    operator: '#d33682',
    punctuation: '#586e75',
    background: '#fdf6e3',
  },
  
  diff: {
    added: '#e8f5e9',
    addedText: '#859900',
    removed: '#ffebee',
    removedText: '#dc322f',
    unchanged: 'transparent',
    lineNumber: '#93a1a1',
    header: '#eee8d5',
    headerText: '#073642',
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
 * GitHub-inspired light theme
 */
export const githubLightTheme: Theme = {
  name: 'GitHub Light',
  id: 'github-light',
  isDark: false,
  
  colors: {
    primary: '#0969da',
    secondary: '#8250df',
    background: '#ffffff',
    surface: '#f6f8fa',
    text: '#1f2328',
    textMuted: '#656d76',
    border: '#d0d7de',
    divider: '#d8dee4',
    selection: '#b3d9ff',
    cursor: '#0969da',
    focus: '#0969da',
    hover: '#f3f4f6',
    active: '#e5e7eb',
    disabled: '#8c959f',
  },
  
  messages: {
    user: {
      text: '#1f2328',
      background: '#ddf4ff',
      border: '#54aeff',
    },
    assistant: {
      text: '#1f2328',
      background: '#f6f8fa',
      border: '#d0d7de',
    },
    system: {
      text: '#9a6700',
      background: '#fff8c5',
      border: '#d4a72c',
    },
    error: {
      text: '#cf222e',
      background: '#ffebe9',
      border: '#ff8182',
    },
    tool: {
      text: '#1a7f37',
      background: '#dafbe1',
      border: '#4ac26b',
    },
  },
  
  status: {
    success: '#1a7f37',
    warning: '#9a6700',
    error: '#cf222e',
    info: '#0969da',
    pending: '#bf3989',
    loading: '#0969da',
  },
  
  syntax: {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    function: '#8250df',
    variable: '#1f2328',
    type: '#953800',
    operator: '#cf222e',
    punctuation: '#1f2328',
    background: '#f6f8fa',
  },
  
  diff: {
    added: '#dafbe1',
    addedText: '#1a7f37',
    removed: '#ffebe9',
    removedText: '#cf222e',
    unchanged: 'transparent',
    lineNumber: '#6e7781',
    header: '#f6f8fa',
    headerText: '#1f2328',
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
 * One Light theme
 */
export const oneLightTheme: Theme = {
  name: 'One Light',
  id: 'one-light',
  isDark: false,
  
  colors: {
    primary: '#4078f2',
    secondary: '#a626a4',
    background: '#fafafa',
    surface: '#f0f0f0',
    text: '#383a42',
    textMuted: '#a0a1a7',
    border: '#d1d1d1',
    divider: '#e5e5e5',
    selection: '#e5e5e5',
    cursor: '#4078f2',
    focus: '#4078f2',
    hover: '#f0f0f0',
    active: '#d1d1d1',
    disabled: '#a0a1a7',
  },
  
  messages: {
    user: {
      text: '#383a42',
      background: '#e8e8e8',
      border: '#4078f2',
    },
    assistant: {
      text: '#383a42',
      background: '#fafafa',
      border: '#d1d1d1',
    },
    system: {
      text: '#c18401',
      background: '#f0f0f0',
      border: '#c18401',
    },
    error: {
      text: '#e45649',
      background: '#f0f0f0',
      border: '#e45649',
    },
    tool: {
      text: '#50a14f',
      background: '#f0f0f0',
      border: '#50a14f',
    },
  },
  
  status: {
    success: '#50a14f',
    warning: '#c18401',
    error: '#e45649',
    info: '#4078f2',
    pending: '#a626a4',
    loading: '#4078f2',
  },
  
  syntax: {
    keyword: '#a626a4',
    string: '#50a14f',
    number: '#986801',
    comment: '#a0a1a7',
    function: '#4078f2',
    variable: '#383a42',
    type: '#c18401',
    operator: '#a626a4',
    punctuation: '#383a42',
    background: '#fafafa',
  },
  
  diff: {
    added: '#e8f5e9',
    addedText: '#50a14f',
    removed: '#ffebee',
    removedText: '#e45649',
    unchanged: 'transparent',
    lineNumber: '#a0a1a7',
    header: '#f0f0f0',
    headerText: '#383a42',
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
 * High contrast light theme for accessibility
 */
export const highContrastLightTheme: Theme = {
  name: 'High Contrast Light',
  id: 'high-contrast-light',
  isDark: false,
  
  colors: {
    primary: 'black',
    secondary: 'blue',
    background: 'white',
    surface: 'white',
    text: 'black',
    textMuted: 'black',
    border: 'black',
    divider: 'black',
    selection: '#b3d9ff',
    cursor: 'black',
    focus: 'blue',
    hover: '#f0f0f0',
    active: '#e0e0e0',
    disabled: 'gray',
  },
  
  messages: {
    user: {
      text: 'black',
      background: 'white',
      border: 'blue',
    },
    assistant: {
      text: 'black',
      background: 'white',
      border: 'black',
    },
    system: {
      text: 'black',
      background: 'white',
      border: 'yellowBright',
    },
    error: {
      text: 'black',
      background: 'white',
      border: 'red',
    },
    tool: {
      text: 'black',
      background: 'white',
      border: 'green',
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
    keyword: 'magenta',
    string: 'green',
    number: 'yellow',
    comment: 'gray',
    function: 'blue',
    variable: 'black',
    type: 'cyan',
    operator: 'red',
    punctuation: 'black',
    background: 'white',
  },
  
  diff: {
    added: '#e8f5e9',
    addedText: 'green',
    removed: '#ffebee',
    removedText: 'red',
    unchanged: 'transparent',
    lineNumber: 'gray',
    header: '#f0f0f0',
    headerText: 'black',
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
 * Create a custom light theme from partial configuration
 */
export function createLightTheme(partial: PartialTheme): Theme {
  return {
    ...defaultLightTheme,
    ...partial,
    isDark: false,
    colors: {
      ...defaultLightTheme.colors,
      ...partial.colors,
    },
    messages: {
      ...defaultLightTheme.messages,
      ...partial.messages,
    },
    status: {
      ...defaultLightTheme.status,
      ...partial.status,
    },
    syntax: {
      ...defaultLightTheme.syntax,
      ...partial.syntax,
    },
    diff: {
      ...defaultLightTheme.diff,
      ...partial.diff,
    },
  };
}

/**
 * List all light themes
 */
export function listLightThemes(): Theme[] {
  return [defaultLightTheme, solarizedLightTheme, githubLightTheme, oneLightTheme, highContrastLightTheme];
}

export { defaultLightTheme };
