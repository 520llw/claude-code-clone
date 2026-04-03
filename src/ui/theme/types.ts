/**
 * Theme type definitions for Claude Code Clone
 * @module theme/types
 */

import type { LiteralUnion } from 'type-fest';

/**
 * ANSI color codes supported by Ink
 */
export type AnsiColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright';

/**
 * Hex color string type
 */
export type HexColor = `#${string}`;

/**
 * RGB color tuple
 */
export type RGBColor = [number, number, number];

/**
 * Color value type - can be ANSI, hex, or RGB
 */
export type ColorValue = AnsiColor | HexColor | RGBColor;

/**
 * Border style options
 */
export interface BorderStyle {
  /** Top-left corner character */
  topLeft: string;
  /** Top-right corner character */
  topRight: string;
  /** Bottom-left corner character */
  bottomLeft: string;
  /** Bottom-right corner character */
  bottomRight: string;
  /** Horizontal line character */
  horizontal: string;
  /** Vertical line character */
  vertical: string;
}

/**
 * Spacing values (padding/margin)
 */
export interface Spacing {
  /** Top spacing */
  top: number;
  /** Right spacing */
  right: number;
  /** Bottom spacing */
  bottom: number;
  /** Left spacing */
  left: number;
}

/**
 * Typography settings
 */
export interface Typography {
  /** Font family (if supported) */
  fontFamily?: string;
  /** Font size multiplier */
  fontSize?: number;
  /** Line height */
  lineHeight?: number;
  /** Bold text enabled */
  bold?: boolean;
  /** Italic text enabled */
  italic?: boolean;
  /** Underline text enabled */
  underline?: boolean;
  /** Strikethrough text enabled */
  strikethrough?: boolean;
}

/**
 * Message type-specific colors
 */
export interface MessageColors {
  /** User message colors */
  user: {
    text: ColorValue;
    background: ColorValue;
    border: ColorValue;
  };
  /** Assistant message colors */
  assistant: {
    text: ColorValue;
    background: ColorValue;
    border: ColorValue;
  };
  /** System message colors */
  system: {
    text: ColorValue;
    background: ColorValue;
    border: ColorValue;
  };
  /** Error message colors */
  error: {
    text: ColorValue;
    background: ColorValue;
    border: ColorValue;
  };
  /** Tool message colors */
  tool: {
    text: ColorValue;
    background: ColorValue;
    border: ColorValue;
  };
}

/**
 * Status indicator colors
 */
export interface StatusColors {
  /** Success state color */
  success: ColorValue;
  /** Warning state color */
  warning: ColorValue;
  /** Error state color */
  error: ColorValue;
  /** Info state color */
  info: ColorValue;
  /** Pending/state color */
  pending: ColorValue;
  /** Loading state color */
  loading: ColorValue;
}

/**
 * Syntax highlighting colors
 */
export interface SyntaxColors {
  /** Keyword color */
  keyword: ColorValue;
  /** String literal color */
  string: ColorValue;
  /** Number literal color */
  number: ColorValue;
  /** Comment color */
  comment: ColorValue;
  /** Function name color */
  function: ColorValue;
  /** Variable name color */
  variable: ColorValue;
  /** Type/class name color */
  type: ColorValue;
  /** Operator color */
  operator: ColorValue;
  /** Punctuation color */
  punctuation: ColorValue;
  /** Background color for code blocks */
  background: ColorValue;
}

/**
 * Diff view colors
 */
export interface DiffColors {
  /** Added line background */
  added: ColorValue;
  /** Added line text */
  addedText: ColorValue;
  /** Removed line background */
  removed: ColorValue;
  /** Removed line text */
  removedText: ColorValue;
  /** Unchanged line background */
  unchanged: ColorValue;
  /** Line number color */
  lineNumber: ColorValue;
  /** Header background */
  header: ColorValue;
  /** Header text */
  headerText: ColorValue;
}

/**
 * UI element colors
 */
export interface UIColors {
  /** Primary accent color */
  primary: ColorValue;
  /** Secondary accent color */
  secondary: ColorValue;
  /** Background color */
  background: ColorValue;
  /** Surface/card background */
  surface: ColorValue;
  /** Text color */
  text: ColorValue;
  /** Muted/secondary text color */
  textMuted: ColorValue;
  /** Border color */
  border: ColorValue;
  /** Divider line color */
  divider: ColorValue;
  /** Selection highlight color */
  selection: ColorValue;
  /** Cursor color */
  cursor: ColorValue;
  /** Focus indicator color */
  focus: ColorValue;
  /** Hover state color */
  hover: ColorValue;
  /** Active/pressed state color */
  active: ColorValue;
  /** Disabled state color */
  disabled: ColorValue;
}

/**
 * Complete theme configuration
 */
export interface Theme {
  /** Theme name */
  name: string;
  /** Theme identifier */
  id: string;
  /** Whether this is a dark theme */
  isDark: boolean;
  /** UI colors */
  colors: UIColors;
  /** Message-specific colors */
  messages: MessageColors;
  /** Status colors */
  status: StatusColors;
  /** Syntax highlighting colors */
  syntax: SyntaxColors;
  /** Diff view colors */
  diff: DiffColors;
  /** Border style */
  borderStyle: BorderStyle;
  /** Default spacing */
  spacing: Spacing;
  /** Typography settings */
  typography: Typography;
  /** Animation settings */
  animations: {
    /** Enable animations */
    enabled: boolean;
    /** Animation speed multiplier */
    speed: number;
    /** Cursor blink rate in ms */
    cursorBlinkRate: number;
  };
  /** Component-specific overrides */
  components?: Record<string, Record<string, unknown>>;
}

/**
 * Partial theme for customization
 */
export type PartialTheme = Partial<Omit<Theme, 'colors' | 'messages' | 'status' | 'syntax' | 'diff'>> & {
  colors?: Partial<UIColors>;
  messages?: Partial<MessageColors>;
  status?: Partial<StatusColors>;
  syntax?: Partial<SyntaxColors>;
  diff?: Partial<DiffColors>;
};

/**
 * Theme context value
 */
export interface ThemeContextValue {
  /** Current theme */
  theme: Theme;
  /** Set a new theme */
  setTheme: (theme: Theme) => void;
  /** Update theme partially */
  updateTheme: (partial: PartialTheme) => void;
  /** Reset to default theme */
  resetTheme: () => void;
  /** Toggle between light/dark */
  toggleTheme: () => void;
  /** Available themes */
  availableThemes: Theme[];
  /** Register a new theme */
  registerTheme: (theme: Theme) => void;
}

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  /** Initial theme */
  initialTheme?: Theme;
  /** Available themes */
  availableThemes?: Theme[];
  /** Children elements */
  children: React.ReactNode;
}

/**
 * Use theme hook options
 */
export interface UseThemeOptions {
  /** Whether to subscribe to theme changes */
  subscribe?: boolean;
}

/**
 * Color contrast ratio
 */
export type ContrastRatio = 'aa' | 'aaa' | 'fail';

/**
 * Color accessibility info
 */
export interface ColorAccessibility {
  /** Contrast ratio value */
  ratio: number;
  /** WCAG compliance level */
  wcag: ContrastRatio;
  /** Whether it passes AA standard */
  passesAA: boolean;
  /** Whether it passes AAA standard */
  passesAAA: boolean;
}
