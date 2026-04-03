/**
 * Header Component for Claude Code Clone
 * Top header with branding and navigation
 * @module components/layout/Header
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Text, Spacer } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Header action item
 */
export interface HeaderAction {
  /** Action ID */
  id: string;
  /** Display label */
  label: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Action icon */
  icon?: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Callback when clicked */
  onClick?: () => void;
}

/**
 * Props for Header component
 */
export interface HeaderProps {
  /** Application title */
  title?: string;
  /** Application subtitle */
  subtitle?: string;
  /** Show branding */
  showBranding?: boolean;
  /** Custom branding component */
  branding?: ReactNode;
  /** Header actions */
  actions?: HeaderAction[];
  /** Show keyboard shortcuts */
  showShortcuts?: boolean;
  /** Custom left content */
  leftContent?: ReactNode;
  /** Custom right content */
  rightContent?: ReactNode;
  /** Header height in lines */
  height?: number;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'none';
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for Header
 */
interface HeaderErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class HeaderErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  HeaderErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): HeaderErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Header Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">Header Error</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Default Claude Code branding
 */
function DefaultBranding({ title, subtitle }: { title: string; subtitle?: string }): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text bold color={theme.colors.primary}>
        ◈
      </Text>
      <Text bold color={theme.colors.text}>
        {title}
      </Text>
      {subtitle && (
        <Text color={theme.colors.textMuted}>
          {subtitle}
        </Text>
      )}
    </Box>
  );
}

/**
 * Action item component
 */
function ActionItem({ action, colors }: { action: HeaderAction; colors: ReturnType<typeof useCurrentTheme>['colors'] }): ReactNode {
  return (
    <Box 
      flexDirection="row" 
      gap={1}
      onPress={action.disabled ? undefined : action.onClick}
    >
      {action.icon && (
        <Text color={action.disabled ? colors.disabled : colors.text}>
          {action.icon}
        </Text>
      )}
      <Text 
        color={action.disabled ? colors.disabled : colors.text}
        strikethrough={action.disabled}
      >
        {action.label}
      </Text>
      {action.shortcut && (
        <Text color={colors.textMuted} dimColor>
          [{action.shortcut}]
        </Text>
      )}
    </Box>
  );
}

/**
 * Header component - Top header with branding
 * 
 * @example
 * ```tsx
 * <Header 
 *   title="Claude Code"
 *   subtitle="v1.0.0"
 *   actions={[
 *     { id: 'help', label: 'Help', shortcut: '?', onClick: showHelp },
 *   ]}
 * />
 * ```
 */
function HeaderComponent({
  title = 'Claude Code',
  subtitle,
  showBranding = true,
  branding,
  actions = [],
  showShortcuts = true,
  leftContent,
  rightContent,
  height = 1,
  borderStyle = 'none',
  'data-testid': testId = 'header',
}: HeaderProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  
  return (
    <Box
      flexDirection="column"
      height={height}
      width={columns}
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={theme.colors.border}
      paddingX={1}
      data-testid={testId}
    >
      <Box flexDirection="row" width={columns - 2}>
        {/* Left section */}
        <Box flexDirection="row" gap={2}>
          {leftContent}
          
          {showBranding && (
            branding || <DefaultBranding title={title} subtitle={subtitle} />
          )}
        </Box>
        
        <Spacer />
        
        {/* Right section */}
        <Box flexDirection="row" gap={2}>
          {/* Actions */}
          {actions.map(action => (
            <ActionItem 
              key={action.id} 
              action={action} 
              colors={theme.colors} 
            />
          ))}
          
          {rightContent}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for Header
 */
HeaderComponent.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  showBranding: PropTypes.bool,
  branding: PropTypes.node,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      shortcut: PropTypes.string,
      icon: PropTypes.string,
      disabled: PropTypes.bool,
      onClick: PropTypes.func,
    })
  ),
  showShortcuts: PropTypes.bool,
  leftContent: PropTypes.node,
  rightContent: PropTypes.node,
  height: PropTypes.number,
  borderStyle: PropTypes.oneOf(['single', 'double', 'none'] as const),
  'data-testid': PropTypes.string,
};

/**
 * Wrapped Header with error boundary
 */
export function Header(props: HeaderProps): ReactNode {
  return (
    <HeaderErrorBoundary>
      <HeaderComponent {...props} />
    </HeaderErrorBoundary>
  );
}

/**
 * Minimal header (just title)
 */
export function MinimalHeader({ title }: { title?: string }): ReactNode {
  return <Header title={title} showBranding actions={[]} />;
}

MinimalHeader.propTypes = {
  title: PropTypes.string,
};

/**
 * Header with navigation
 */
export function NavigationHeader({
  title,
  navItems,
  activeId,
  onNavigate,
}: {
  title?: string;
  navItems: Array<{ id: string; label: string }>;
  activeId?: string;
  onNavigate?: (id: string) => void;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Header
      title={title}
      leftContent={
        <Box flexDirection="row" gap={2}>
          {navItems.map(item => (
            <Box 
              key={item.id}
              onPress={() => onNavigate?.(item.id)}
            >
              <Text 
                color={item.id === activeId ? theme.colors.primary : theme.colors.text}
                bold={item.id === activeId}
                underline={item.id === activeId}
              >
                {item.label}
              </Text>
            </Box>
          ))}
        </Box>
      }
    />
  );
}

NavigationHeader.propTypes = {
  title: PropTypes.string,
  navItems: PropTypes.array.isRequired,
  activeId: PropTypes.string,
  onNavigate: PropTypes.func,
};

export default Header;
