/**
 * ThemePlugin.ts
 * 
 * Theme Management Plugin for Claude Code Clone
 * 
 * This plugin provides theme management capabilities including:
 * - Theme loading and switching
 * - Custom theme creation
 * - Color scheme management
 * - UI appearance customization
 * - Syntax highlighting themes
 * 
 * @module BuiltinPlugins
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { Plugin, PluginMetadata, PluginCategory, ConfigSchemaEntry } from '../Plugin';

/**
 * Theme definition
 */
export interface Theme {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  type: 'light' | 'dark' | 'high-contrast';
  colors: ThemeColors;
  syntax: SyntaxColors;
  isBuiltIn?: boolean;
}

/**
 * Theme colors
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  border: string;
  sidebar: string;
  panel: string;
  terminal: string;
  input: string;
  selection: string;
  highlight: string;
}

/**
 * Syntax highlighting colors
 */
export interface SyntaxColors {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  variable: string;
  type: string;
  operator: string;
  punctuation: string;
}

/**
 * Built-in themes
 */
const BUILT_IN_THEMES: Theme[] = [
  {
    id: 'default-dark',
    name: 'Default Dark',
    description: 'The default dark theme',
    author: 'Claude Code Clone',
    version: '1.0.0',
    type: 'dark',
    isBuiltIn: true,
    colors: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      primary: '#007acc',
      secondary: '#252526',
      accent: '#0098ff',
      success: '#4ec9b0',
      warning: '#cca700',
      error: '#f44336',
      info: '#75beff',
      muted: '#6e6e6e',
      border: '#3e3e3e',
      sidebar: '#252526',
      panel: '#1e1e1e',
      terminal: '#0c0c0c',
      input: '#3c3c3c',
      selection: '#264f78',
      highlight: '#add6ff26'
    },
    syntax: {
      keyword: '#569cd6',
      string: '#ce9178',
      number: '#b5cea8',
      comment: '#6a9955',
      function: '#dcdcaa',
      variable: '#9cdcfe',
      type: '#4ec9b0',
      operator: '#d4d4d4',
      punctuation: '#d4d4d4'
    }
  },
  {
    id: 'default-light',
    name: 'Default Light',
    description: 'The default light theme',
    author: 'Claude Code Clone',
    version: '1.0.0',
    type: 'light',
    isBuiltIn: true,
    colors: {
      background: '#ffffff',
      foreground: '#333333',
      primary: '#007acc',
      secondary: '#f3f3f3',
      accent: '#0098ff',
      success: '#388a34',
      warning: '#bf8803',
      error: '#e51400',
      info: '#1a85ff',
      muted: '#767676',
      border: '#e5e5e5',
      sidebar: '#f3f3f3',
      panel: '#ffffff',
      terminal: '#ffffff',
      input: '#ffffff',
      selection: '#add6ff',
      highlight: '#fffbdd'
    },
    syntax: {
      keyword: '#0000ff',
      string: '#a31515',
      number: '#098658',
      comment: '#008000',
      function: '#795e26',
      variable: '#001080',
      type: '#267f99',
      operator: '#000000',
      punctuation: '#000000'
    }
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'High contrast theme for accessibility',
    author: 'Claude Code Clone',
    version: '1.0.0',
    type: 'high-contrast',
    isBuiltIn: true,
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#0078d4',
      secondary: '#000000',
      accent: '#f38518',
      success: '#89d185',
      warning: '#ffcc00',
      error: '#f48771',
      info: '#75beff',
      muted: '#a6a6a6',
      border: '#6fc3df',
      sidebar: '#000000',
      panel: '#000000',
      terminal: '#000000',
      input: '#000000',
      selection: '#ffffff',
      highlight: '#f38518'
    },
    syntax: {
      keyword: '#569cd6',
      string: '#ce9178',
      number: '#b5cea8',
      comment: '#6a9955',
      function: '#dcdcaa',
      variable: '#9cdcfe',
      type: '#4ec9b0',
      operator: '#d4d4d4',
      punctuation: '#d4d4d4'
    }
  }
];

/**
 * ThemePlugin - Manages themes for Claude Code Clone.
 * 
 * This plugin provides theme management capabilities, allowing users
 * to customize the appearance of the application.
 * 
 * @example
 * ```typescript
 * const themePlugin = new ThemePlugin();
 * await pluginManager.loadPlugin(themePlugin);
 * 
 * // Switch theme
 * themePlugin.setTheme('default-light');
 * ```
 */
export class ThemePlugin extends Plugin {
  /**
   * Plugin metadata
   */
  public readonly metadata: PluginMetadata = {
    id: 'com.claudecode.builtin.theme',
    name: 'Theme Manager',
    version: '1.0.0',
    description: 'Manages themes and appearance settings for the application',
    author: 'Claude Code Clone',
    license: 'MIT',
    category: PluginCategory.THEME,
    keywords: ['theme', 'appearance', 'colors', 'ui', 'customization'],
    enabledByDefault: true,
    requiresRestart: false
  };

  /**
   * Configuration schema
   */
  public readonly configSchema: ConfigSchemaEntry[] = [
    {
      key: 'theme',
      type: 'enum',
      label: 'Active Theme',
      description: 'The currently active theme',
      enumValues: ['default-dark', 'default-light', 'high-contrast'],
      default: 'default-dark',
      required: false
    },
    {
      key: 'fontSize',
      type: 'number',
      label: 'Font Size',
      description: 'Base font size in pixels',
      default: 14,
      min: 8,
      max: 32,
      required: false
    },
    {
      key: 'fontFamily',
      type: 'string',
      label: 'Font Family',
      description: 'Font family for the UI',
      default: 'system-ui, -apple-system, sans-serif',
      required: false
    },
    {
      key: 'lineHeight',
      type: 'number',
      label: 'Line Height',
      description: 'Line height multiplier',
      default: 1.5,
      min: 1,
      max: 3,
      required: false
    },
    {
      key: 'autoDetectTheme',
      type: 'boolean',
      label: 'Auto-detect system theme',
      description: 'Automatically switch theme based on system preference',
      default: true,
      required: false
    },
    {
      key: 'customThemesPath',
      type: 'string',
      label: 'Custom Themes Path',
      description: 'Path to custom theme files',
      required: false
    }
  ];

  /**
   * Plugin capabilities
   */
  public readonly capabilities = {
    providesHooks: ['onInit'],
    providesThemes: ['default-dark', 'default-light', 'high-contrast']
  };

  /**
   * Available themes
   */
  private themes: Map<string, Theme> = new Map();

  /**
   * Current theme
   */
  private currentTheme: Theme = BUILT_IN_THEMES[0];

  /**
   * Called when the plugin is activated.
   */
  public async onActivate(): Promise<void> {
    this.logger.info('ThemePlugin activated');

    // Load built-in themes
    for (const theme of BUILT_IN_THEMES) {
      this.themes.set(theme.id, theme);
    }

    // Load custom themes
    await this.loadCustomThemes();

    // Set initial theme
    const themeId = this.context.config.theme || 'default-dark';
    await this.setTheme(themeId);

    // Register hooks
    this.registerHook('onInit', this.handleInit.bind(this));

    // Register commands
    this.registerCommand('theme.list', this.listThemes.bind(this));
    this.registerCommand('theme.set', this.setTheme.bind(this));
    this.registerCommand('theme.get', this.getCurrentTheme.bind(this));
    this.registerCommand('theme.create', this.createTheme.bind(this));
    this.registerCommand('theme.export', this.exportTheme.bind(this));
  }

  /**
   * Called when the plugin is deactivated.
   */
  public async onDeactivate(): Promise<void> {
    this.logger.info('ThemePlugin deactivated');
  }

  /**
   * Handles initialization.
   */
  private async handleInit(context: any): Promise<void> {
    // Auto-detect system theme if enabled
    if (this.context.config.autoDetectTheme) {
      this.detectSystemTheme();
    }
  }

  // ============================================================================
  // Theme Management
  // ============================================================================

  /**
   * Lists all available themes.
   * 
   * @returns Array of themes
   */
  public listThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Gets a theme by ID.
   * 
   * @param themeId - Theme ID
   * @returns Theme or undefined
   */
  public getTheme(themeId: string): Theme | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Sets the active theme.
   * 
   * @param themeId - Theme ID
   */
  public async setTheme(themeId: string): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    this.currentTheme = theme;
    
    // Apply theme
    this.applyTheme(theme);

    // Save preference
    await this.storage.set('activeTheme', themeId);

    this.logger.info(`Theme set to: ${theme.name}`);
    this.emit('themeChanged', { theme });
  }

  /**
   * Gets the current theme.
   * 
   * @returns Current theme
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Creates a custom theme.
   * 
   * @param theme - Theme definition
   */
  public async createTheme(theme: Omit<Theme, 'isBuiltIn'>): Promise<void> {
    const fullTheme: Theme = {
      ...theme,
      isBuiltIn: false
    };

    this.themes.set(theme.id, fullTheme);
    
    // Save to storage
    const customThemes = await this.storage.get<Theme[]>('customThemes') || [];
    customThemes.push(fullTheme);
    await this.storage.set('customThemes', customThemes);

    this.logger.info(`Created theme: ${theme.name}`);
    this.emit('themeCreated', { theme: fullTheme });
  }

  /**
   * Exports a theme to JSON.
   * 
   * @param themeId - Theme ID
   * @returns Theme JSON
   */
  public exportTheme(themeId: string): string {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    return JSON.stringify(theme, null, 2);
  }

  /**
   * Imports a theme from JSON.
   * 
   * @param json - Theme JSON
   */
  public async importTheme(json: string): Promise<void> {
    const theme = JSON.parse(json) as Theme;
    await this.createTheme(theme);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Applies a theme to the UI.
   * 
   * @param theme - Theme to apply
   */
  private applyTheme(theme: Theme): void {
    // In a real implementation, this would update CSS variables
    // or send a message to the renderer process
    this.logger.debug(`Applying theme: ${theme.name}`);

    // Emit theme change event
    this.emit('themeApplied', { theme });
  }

  /**
   * Loads custom themes from storage.
   */
  private async loadCustomThemes(): Promise<void> {
    const customThemes = await this.storage.get<Theme[]>('customThemes') || [];
    
    for (const theme of customThemes) {
      this.themes.set(theme.id, theme);
    }

    this.logger.info(`Loaded ${customThemes.length} custom themes`);
  }

  /**
   * Detects the system theme preference.
   */
  private detectSystemTheme(): void {
    // In a real implementation, this would check the system preference
    // For now, default to dark
    const prefersDark = true; // Would check window.matchMedia('(prefers-color-scheme: dark)')
    
    if (prefersDark && this.currentTheme.id !== 'default-dark') {
      this.setTheme('default-dark');
    } else if (!prefersDark && this.currentTheme.id !== 'default-light') {
      this.setTheme('default-light');
    }
  }

  /**
   * Generates CSS variables for a theme.
   * 
   * @param theme - Theme
   * @returns CSS string
   */
  public generateCSS(theme: Theme = this.currentTheme): string {
    const cssVars: string[] = [];

    // Add color variables
    for (const [key, value] of Object.entries(theme.colors)) {
      cssVars.push(`  --color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`);
    }

    // Add syntax variables
    for (const [key, value] of Object.entries(theme.syntax)) {
      cssVars.push(`  --syntax-${key}: ${value};`);
    }

    return `:root {\n${cssVars.join('\n')}\n}`;
  }

  /**
   * Gets theme colors for a specific UI element.
   * 
   * @param element - Element name
   * @returns Color value
   */
  public getColor(element: keyof ThemeColors): string {
    return this.currentTheme.colors[element];
  }

  /**
   * Gets syntax color for a token type.
   * 
   * @param token - Token type
   * @returns Color value
   */
  public getSyntaxColor(token: keyof SyntaxColors): string {
    return this.currentTheme.syntax[token];
  }
}

export default ThemePlugin;
