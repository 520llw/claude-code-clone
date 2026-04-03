/**
 * Theme management hook for Claude Code Clone
 * @module hooks/useTheme
 */

import { useState, useCallback, useContext, createContext, useMemo } from 'react';
import type { Theme, PartialTheme, ThemeContextValue, ThemeProviderProps } from '../theme/types.js';
import { defaultTheme } from '../theme/default.js';

/**
 * Theme context for providing theme throughout the app
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme provider component
 * @param props - Provider props
 * @returns Theme provider wrapper
 */
export function ThemeProvider({ 
  children, 
  initialTheme = defaultTheme,
  availableThemes: initialThemes = [defaultTheme]
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(initialThemes);

  /**
   * Set a new theme completely
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  /**
   * Update theme partially (merge with current)
   */
  const updateTheme = useCallback((partial: PartialTheme) => {
    setThemeState(current => ({
      ...current,
      ...partial,
      colors: { ...current.colors, ...partial.colors },
      messages: { ...current.messages, ...partial.messages },
      status: { ...current.status, ...partial.status },
      syntax: { ...current.syntax, ...partial.syntax },
      diff: { ...current.diff, ...partial.diff },
      animations: { ...current.animations, ...partial.animations },
    }));
  }, []);

  /**
   * Reset to default theme
   */
  const resetTheme = useCallback(() => {
    setThemeState(defaultTheme);
  }, []);

  /**
   * Toggle between light and dark variants
   */
  const toggleTheme = useCallback(() => {
    setThemeState(current => {
      // Find opposite variant of current theme
      const oppositeId = current.isDark 
        ? current.id.replace('-dark', '-light').replace('dark', 'light')
        : current.id.replace('-light', '-dark').replace('light', 'dark');
      
      const oppositeTheme = availableThemes.find(t => t.id === oppositeId);
      return oppositeTheme || (current.isDark ? defaultTheme : defaultTheme);
    });
  }, [availableThemes]);

  /**
   * Register a new theme
   */
  const registerTheme = useCallback((newTheme: Theme) => {
    setAvailableThemes(current => {
      const exists = current.some(t => t.id === newTheme.id);
      if (exists) {
        return current.map(t => t.id === newTheme.id ? newTheme : t);
      }
      return [...current, newTheme];
    });
  }, []);

  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    updateTheme,
    resetTheme,
    toggleTheme,
    availableThemes,
    registerTheme,
  }), [theme, setTheme, updateTheme, resetTheme, toggleTheme, availableThemes, registerTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * @returns Theme context value
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to get just the current theme
 * @returns Current theme
 */
export function useCurrentTheme(): Theme {
  const { theme } = useTheme();
  return theme;
}

/**
 * Hook to get theme colors
 * @returns Theme colors object
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * Hook to get a specific color from theme
 * @param path - Dot-notation path to color (e.g., 'messages.user.text')
 * @returns Color value
 */
export function useThemeColor(path: string): string {
  const { theme } = useTheme();
  
  const parts = path.split('.');
  let value: unknown = theme;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return theme.colors.text;
    }
  }
  
  return String(value || theme.colors.text);
}

/**
 * Hook to check if current theme is dark
 * @returns Whether current theme is dark
 */
export function useIsDarkTheme(): boolean {
  const { theme } = useTheme();
  return theme.isDark;
}

/**
 * Hook to get available themes
 * @returns List of available themes
 */
export function useAvailableThemes(): Theme[] {
  const { availableThemes } = useTheme();
  return availableThemes;
}

/**
 * Hook to switch to a specific theme by ID
 * @returns Function to switch theme
 */
export function useThemeSwitcher(): (themeId: string) => boolean {
  const { availableThemes, setTheme } = useTheme();
  
  return useCallback((themeId: string): boolean => {
    const targetTheme = availableThemes.find(t => t.id === themeId);
    if (targetTheme) {
      setTheme(targetTheme);
      return true;
    }
    return false;
  }, [availableThemes, setTheme]);
}

/**
 * Hook to get theme-aware styles
 * @returns Style helper functions
 */
export function useThemeStyles() {
  const { theme } = useTheme();
  
  return useMemo(() => ({
    /**
     * Get border style string
     */
    getBorder: (width: number = 1) => ({
      borderStyle: theme.borderStyle,
      borderColor: theme.colors.border,
    }),
    
    /**
     * Get padding based on theme spacing
     */
    getPadding: (multiplier: number = 1) => ({
      paddingTop: theme.spacing.top * multiplier,
      paddingRight: theme.spacing.right * multiplier,
      paddingBottom: theme.spacing.bottom * multiplier,
      paddingLeft: theme.spacing.left * multiplier,
    }),
    
    /**
     * Get typography styles
     */
    getTypography: (options: { bold?: boolean; italic?: boolean } = {}) => ({
      bold: options.bold ?? theme.typography.bold,
      italic: options.italic ?? theme.typography.italic,
    }),
    
    /**
     * Get color with fallback
     */
    getColor: (colorPath: string, fallback?: string) => {
      const parts = colorPath.split('.');
      let value: unknown = theme;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return fallback || theme.colors.text;
        }
      }
      
      return String(value || fallback || theme.colors.text);
    },
  }), [theme]);
}

/**
 * Hook for theme animation settings
 * @returns Animation configuration
 */
export function useThemeAnimations() {
  const { theme } = useTheme();
  
  return useMemo(() => ({
    enabled: theme.animations.enabled,
    speed: theme.animations.speed,
    cursorBlinkRate: theme.animations.cursorBlinkRate,
    /**
     * Calculate animation duration with speed multiplier
     */
    getDuration: (baseDuration: number) => baseDuration / theme.animations.speed,
  }), [theme.animations]);
}

export default useTheme;
