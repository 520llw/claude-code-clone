/**
 * Theme system exports for Claude Code Clone
 * @module theme
 */

// Type exports
export type {
  Theme,
  PartialTheme,
  ThemeContextValue,
  ThemeProviderProps,
  UseThemeOptions,
  ColorValue,
  AnsiColor,
  HexColor,
  RGBColor,
  BorderStyle,
  Spacing,
  Typography,
  MessageColors,
  StatusColors,
  SyntaxColors,
  DiffColors,
  UIColors,
  ColorAccessibility,
  ContrastRatio,
} from './types.js';

// Default theme exports
export {
  defaultTheme,
  defaultLightTheme,
  highContrastDarkTheme,
  defaultBorderStyle,
  defaultSpacing,
  defaultTypography,
  getThemeById,
  listDefaultThemes,
} from './default.js';

// Dark theme exports
export {
  midnightTheme,
  draculaTheme,
  monokaiTheme,
  nordTheme,
  createDarkTheme,
  listDarkThemes,
} from './dark.js';

// Light theme exports
export {
  solarizedLightTheme,
  githubLightTheme,
  oneLightTheme,
  highContrastLightTheme,
  createLightTheme,
  listLightThemes,
} from './light.js';

// Theme utility functions
import type { Theme, ColorValue, RGBColor, HexColor } from './types.js';

/**
 * Convert color value to RGB tuple
 */
export function colorToRGB(color: ColorValue): RGBColor {
  if (Array.isArray(color)) {
    return color;
  }
  
  if (typeof color === 'string' && color.startsWith('#')) {
    const hex = color.slice(1);
    const bigint = parseInt(hex, 16);
    return [
      (bigint >> 16) & 255,
      (bigint >> 8) & 255,
      bigint & 255,
    ];
  }
  
  // ANSI color mapping
  const ansiColors: Record<string, RGBColor> = {
    black: [0, 0, 0],
    red: [205, 49, 49],
    green: [13, 188, 121],
    yellow: [229, 229, 16],
    blue: [36, 114, 200],
    magenta: [188, 63, 188],
    cyan: [17, 168, 205],
    white: [229, 229, 229],
    gray: [118, 118, 118],
    grey: [118, 118, 118],
    blackBright: [85, 85, 85],
    redBright: [241, 76, 76],
    greenBright: [22, 198, 12],
    yellowBright: [245, 245, 67],
    blueBright: [59, 142, 234],
    magentaBright: [214, 112, 214],
    cyanBright: [41, 218, 255],
    whiteBright: [255, 255, 255],
  };
  
  return ansiColors[color] || [255, 255, 255];
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): HexColor {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculate luminance of a color
 */
export function getLuminance(color: ColorValue): number {
  const [r, g, b] = colorToRGB(color).map(c => {
    const normalized = c / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: ColorValue, color2: ColorValue): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if color contrast meets WCAG standards
 */
export function checkContrastAccessibility(
  foreground: ColorValue,
  background: ColorValue
): { ratio: number; passesAA: boolean; passesAAA: boolean } {
  const ratio = getContrastRatio(foreground, background);
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
  };
}

/**
 * Get accessible text color for background
 */
export function getAccessibleTextColor(
  background: ColorValue,
  options: { preferDark?: ColorValue; preferLight?: ColorValue } = {}
): ColorValue {
  const { preferDark = 'black', preferLight = 'white' } = options;
  const luminance = getLuminance(background);
  return luminance > 0.5 ? preferDark : preferLight;
}

/**
 * Blend two colors with opacity
 */
export function blendColors(
  base: ColorValue,
  overlay: ColorValue,
  opacity: number
): HexColor {
  const [r1, g1, b1] = colorToRGB(base);
  const [r2, g2, b2] = colorToRGB(overlay);
  
  const r = Math.round(r1 * (1 - opacity) + r2 * opacity);
  const g = Math.round(g1 * (1 - opacity) + g2 * opacity);
  const b = Math.round(b1 * (1 - opacity) + b2 * opacity);
  
  return rgbToHex(r, g, b);
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: ColorValue, percent: number): HexColor {
  const [r, g, b] = colorToRGB(color);
  const amount = Math.min(100, Math.max(0, percent)) / 100;
  
  return rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount)
  );
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: ColorValue, percent: number): HexColor {
  const [r, g, b] = colorToRGB(color);
  const amount = 1 - Math.min(100, Math.max(0, percent)) / 100;
  
  return rgbToHex(
    Math.round(r * amount),
    Math.round(g * amount),
    Math.round(b * amount)
  );
}

/**
 * Get all available themes
 */
export function getAllThemes(): Theme[] {
  return [
    // Default themes
    defaultTheme,
    defaultLightTheme,
    highContrastDarkTheme,
    // Dark themes
    ...listDarkThemes(),
    // Light themes
    ...listLightThemes(),
  ];
}

/**
 * Find theme by ID (case insensitive)
 */
export function findTheme(id: string): Theme | undefined {
  return getAllThemes().find(
    theme => theme.id.toLowerCase() === id.toLowerCase()
  );
}

/**
 * Merge two themes (base + override)
 */
export function mergeThemes(base: Theme, override: Partial<Theme>): Theme {
  return {
    ...base,
    ...override,
    colors: { ...base.colors, ...override.colors },
    messages: { ...base.messages, ...override.messages },
    status: { ...base.status, ...override.status },
    syntax: { ...base.syntax, ...override.syntax },
    diff: { ...base.diff, ...override.diff },
    animations: { ...base.animations, ...override.animations },
    components: { ...base.components, ...override.components },
  };
}

// Re-export default as named export
export { defaultTheme as darkTheme } from './default.js';
export { defaultLightTheme as lightTheme } from './default.js';

// Theme context and provider (will be implemented in hooks)
export const THEME_CONTEXT_SYMBOL = Symbol('theme-context');
