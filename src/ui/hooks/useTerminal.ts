/**
 * Terminal information hook for Claude Code Clone
 * @module hooks/useTerminal
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { stdout } from 'process';
import type { TerminalSize, TerminalCapabilities } from '../types/index.js';

/**
 * Default terminal size
 */
const DEFAULT_TERMINAL_SIZE: TerminalSize = {
  columns: 80,
  rows: 24,
};

/**
 * Default terminal capabilities
 */
const DEFAULT_CAPABILITIES: TerminalCapabilities = {
  trueColor: false,
  color256: true,
  hyperlinks: false,
  images: false,
  mouse: false,
  bracketedPaste: false,
};

/**
 * Hook to get terminal size information
 * @returns Terminal size and resize handler
 */
export function useTerminalSize(): TerminalSize & { 
  refresh: () => void;
  isResizing: boolean;
} {
  const [size, setSize] = useState<TerminalSize>(() => {
    if (stdout && stdout.columns && stdout.rows) {
      return {
        columns: stdout.columns,
        rows: stdout.rows,
      };
    }
    return DEFAULT_TERMINAL_SIZE;
  });
  
  const [isResizing, setIsResizing] = useState(false);

  /**
   * Refresh terminal size
   */
  const refresh = useCallback(() => {
    if (stdout && stdout.columns && stdout.rows) {
      setSize({
        columns: stdout.columns,
        rows: stdout.rows,
      });
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);
      refresh();
      // Debounce resize state
      setTimeout(() => setIsResizing(false), 150);
    };

    stdout?.on('resize', handleResize);
    
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [refresh]);

  return { ...size, refresh, isResizing };
}

/**
 * Hook to get terminal capabilities
 * @returns Terminal capabilities
 */
export function useTerminalCapabilities(): TerminalCapabilities {
  return useMemo(() => {
    const capabilities = { ...DEFAULT_CAPABILITIES };
    
    // Check for color support via environment variables
    const term = process.env.TERM || '';
    const colorterm = process.env.COLORTERM || '';
    
    capabilities.trueColor = colorterm === 'truecolor' || colorterm === '24bit';
    capabilities.color256 = capabilities.trueColor || term.includes('256') || term.includes('color');
    
    // Check for hyperlink support (iTerm2, VTE-based terminals)
    const vteVersion = process.env.VTE_VERSION;
    const termProgram = process.env.TERM_PROGRAM || '';
    capabilities.hyperlinks = !!vteVersion || termProgram === 'iTerm.app';
    
    // Check for image support (iTerm2, kitty)
    capabilities.images = termProgram === 'iTerm.app' || term === 'xterm-kitty';
    
    // Check for mouse support
    capabilities.mouse = process.env.MOUSE_SUPPORT === '1' || term.includes('xterm');
    
    // Check for bracketed paste
    capabilities.bracketedPaste = term.includes('xterm') || term.includes('screen') || term.includes('tmux');
    
    return capabilities;
  }, []);
}

/**
 * Hook to detect if terminal supports a specific feature
 * @param feature - Feature to check
 * @returns Whether feature is supported
 */
export function useTerminalSupports(
  feature: keyof TerminalCapabilities
): boolean {
  const capabilities = useTerminalCapabilities();
  return capabilities[feature];
}

/**
 * Hook to get terminal color support level
 * @returns Color support level (0, 256, or 16777216)
 */
export function useTerminalColors(): { 
  level: 0 | 256 | 16777216; 
  hasBasic: boolean;
  has256: boolean;
  hasTrueColor: boolean;
} {
  const capabilities = useTerminalCapabilities();
  
  return useMemo(() => {
    if (capabilities.trueColor) {
      return { 
        level: 16777216, 
        hasBasic: true, 
        has256: true, 
        hasTrueColor: true 
      };
    }
    if (capabilities.color256) {
      return { 
        level: 256, 
        hasBasic: true, 
        has256: true, 
        hasTrueColor: false 
      };
    }
    return { 
      level: 0, 
      hasBasic: true, 
      has256: false, 
      hasTrueColor: false 
    };
  }, [capabilities]);
}

/**
 * Hook to calculate content width based on terminal size
 * @param percentage - Percentage of terminal width to use (0-1)
 * @param minWidth - Minimum width in columns
 * @param maxWidth - Maximum width in columns
 * @returns Calculated width
 */
export function useContentWidth(
  percentage: number = 1,
  minWidth: number = 40,
  maxWidth?: number
): number {
  const { columns } = useTerminalSize();
  
  return useMemo(() => {
    let width = Math.floor(columns * percentage);
    width = Math.max(width, minWidth);
    if (maxWidth !== undefined) {
      width = Math.min(width, maxWidth);
    }
    return width;
  }, [columns, percentage, minWidth, maxWidth]);
}

/**
 * Hook to check if terminal is in a specific size range
 * @returns Size category and checks
 */
export function useTerminalBreakpoint(): {
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
  isXLarge: boolean;
  category: 'small' | 'medium' | 'large' | 'xlarge';
} {
  const { columns } = useTerminalSize();
  
  return useMemo(() => {
    const isSmall = columns < 80;
    const isMedium = columns >= 80 && columns < 120;
    const isLarge = columns >= 120 && columns < 160;
    const isXLarge = columns >= 160;
    
    let category: 'small' | 'medium' | 'large' | 'xlarge' = 'small';
    if (isXLarge) category = 'xlarge';
    else if (isLarge) category = 'large';
    else if (isMedium) category = 'medium';
    
    return { isSmall, isMedium, isLarge, isXLarge, category };
  }, [columns]);
}

/**
 * Hook to track terminal focus
 * @returns Whether terminal is focused
 */
export function useTerminalFocus(): boolean {
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    process.stdin?.on('data', handleFocus);
    
    // For process-level focus detection
    const interval = setInterval(() => {
      // Check if stdin is paused (might indicate focus loss)
      setIsFocused(!process.stdin?.isPaused());
    }, 1000);

    return () => {
      process.stdin?.off('data', handleFocus);
      clearInterval(interval);
    };
  }, []);

  return isFocused;
}

/**
 * Hook to get terminal environment information
 * @returns Environment details
 */
export function useTerminalEnvironment(): {
  shell: string;
  term: string;
  termProgram: string;
  platform: string;
  isTmux: boolean;
  isScreen: boolean;
  isSSH: boolean;
} {
  return useMemo(() => ({
    shell: process.env.SHELL || 'unknown',
    term: process.env.TERM || 'unknown',
    termProgram: process.env.TERM_PROGRAM || 'unknown',
    platform: process.platform,
    isTmux: !!process.env.TMUX,
    isScreen: (process.env.TERM || '').includes('screen'),
    isSSH: !!process.env.SSH_CONNECTION,
  }), []);
}

/**
 * Hook to wrap text to terminal width
 * @param text - Text to wrap
 * @param maxWidth - Maximum width (defaults to terminal width)
 * @returns Wrapped lines
 */
export function useTextWrap(text: string, maxWidth?: number): string[] {
  const { columns } = useTerminalSize();
  const width = maxWidth || columns;
  
  return useMemo(() => {
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    
    for (const paragraph of paragraphs) {
      if (paragraph.length <= width) {
        lines.push(paragraph);
        continue;
      }
      
      let currentLine = '';
      const words = paragraph.split(' ');
      
      for (const word of words) {
        if ((currentLine + word).length > width) {
          if (currentLine) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
          // Handle words longer than width
          if (word.length > width) {
            for (let i = 0; i < word.length; i += width) {
              lines.push(word.slice(i, i + width));
            }
          } else {
            currentLine = word + ' ';
          }
        } else {
          currentLine += word + ' ';
        }
      }
      
      if (currentLine) {
        lines.push(currentLine.trim());
      }
    }
    
    return lines;
  }, [text, width]);
}

/**
 * Combined terminal info hook
 * @returns All terminal information
 */
export function useTerminal(): {
  size: TerminalSize;
  capabilities: TerminalCapabilities;
  environment: ReturnType<typeof useTerminalEnvironment>;
  breakpoint: ReturnType<typeof useTerminalBreakpoint>;
  colors: ReturnType<typeof useTerminalColors>;
  isFocused: boolean;
  refresh: () => void;
} {
  const size = useTerminalSize();
  const capabilities = useTerminalCapabilities();
  const environment = useTerminalEnvironment();
  const breakpoint = useTerminalBreakpoint();
  const colors = useTerminalColors();
  const isFocused = useTerminalFocus();

  return {
    size: { columns: size.columns, rows: size.rows },
    capabilities,
    environment,
    breakpoint,
    colors,
    isFocused,
    refresh: size.refresh,
  };
}

export default useTerminal;
