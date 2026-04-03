/**
 * Confirmation Dialog Component for Claude Code Clone
 * Yes/No/Always/Never prompts with keyboard navigation
 * @module components/interactive/ConfirmationDialog
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useArrowNavigation } from '../../hooks/useKeyboard.js';

/**
 * Confirmation option type
 */
export type ConfirmationOption = 'yes' | 'no' | 'always' | 'never';

/**
 * Props for ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /** Dialog message/question */
  message: string;
  /** Dialog title */
  title?: string;
  /** Available options */
  options?: ConfirmationOption[];
  /** Default selected option */
  defaultOption?: ConfirmationOption;
  /** Whether to show "always" option */
  showAlways?: boolean;
  /** Whether to show "never" option */
  showNever?: boolean;
  /** Custom labels for options */
  labels?: Partial<Record<ConfirmationOption, string>>;
  /** Whether dialog is focused */
  isFocused?: boolean;
  /** Timeout in ms (0 = no timeout) */
  timeout?: number;
  /** Custom render function */
  renderDialog?: (props: {
    message: string;
    options: ConfirmationOption[];
    selectedIndex: number;
    timeRemaining?: number;
  }) => ReactNode;
  /** Callback when option is selected */
  onConfirm: (option: ConfirmationOption) => void;
  /** Callback when cancelled (Escape) */
  onCancel?: () => void;
  /** Callback on timeout */
  onTimeout?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for option button
 */
interface OptionButtonProps {
  /** Option value */
  option: ConfirmationOption;
  /** Display label */
  label: string;
  /** Whether selected */
  isSelected: boolean;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Keyboard shortcut */
  shortcut?: string;
}

/**
 * Error boundary for ConfirmationDialog
 */
interface ConfirmationDialogErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ConfirmationDialogErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ConfirmationDialogErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ConfirmationDialogErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ConfirmationDialog Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error in confirmation dialog</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Option button component
 */
function OptionButton({ option, label, isSelected, colors, shortcut }: OptionButtonProps): ReactNode {
  const optionColors = {
    yes: colors.status.success,
    no: colors.status.error,
    always: colors.status.info,
    never: colors.status.warning,
  };
  
  return (
    <Box 
      flexDirection="row" 
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? colors.selection : undefined}
    >
      <Text color={isSelected ? colors.cursor : colors.textMuted}>
        {isSelected ? '▶' : ' '}
      </Text>
      <Text 
        color={isSelected ? optionColors[option] : colors.text}
        bold={isSelected}
      >
        {label}
      </Text>
      {shortcut && (
        <Text color={colors.textMuted} dimColor>
          ({shortcut})
        </Text>
      )}
    </Box>
  );
}

/**
 * ConfirmationDialog component - Yes/No/Always/Never prompts
 * 
 * @example
 * ```tsx
 * <ConfirmationDialog 
 *   message="Delete this file?"
 *   title="Confirm Delete"
 *   options={['yes', 'no']}
 *   onConfirm={(option) => console.log(option)}
 * />
 * ```
 */
function ConfirmationDialogComponent({
  message,
  title,
  options: customOptions,
  defaultOption = 'no',
  showAlways = false,
  showNever = false,
  labels = {},
  isFocused = true,
  timeout = 0,
  renderDialog,
  onConfirm,
  onCancel,
  onTimeout,
  'data-testid': testId = 'confirmation-dialog',
}: ConfirmationDialogProps): ReactNode {
  const theme = useCurrentTheme();
  const [timeRemaining, setTimeRemaining] = useState(timeout > 0 ? timeout : undefined);
  
  // Build options list
  const options = customOptions || [
    'yes',
    'no',
    ...(showAlways ? ['always' as const] : []),
    ...(showNever ? ['never' as const] : []),
  ];
  
  // Default labels
  const defaultLabels: Record<ConfirmationOption, string> = {
    yes: labels.yes || 'Yes',
    no: labels.no || 'No',
    always: labels.always || 'Always',
    never: labels.never || 'Never',
  };
  
  // Keyboard shortcuts
  const shortcuts: Record<ConfirmationOption, string> = {
    yes: 'y',
    no: 'n',
    always: 'a',
    never: 'v',
  };
  
  // Navigation
  const defaultIndex = options.indexOf(defaultOption);
  const { index: selectedIndex, setIndex } = useArrowNavigation(options.length, {
    enabled: isFocused,
    initialIndex: defaultIndex >= 0 ? defaultIndex : 0,
  });
  
  // Timeout handling
  useEffect(() => {
    if (timeout <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === undefined || prev <= 100) {
          clearInterval(interval);
          onTimeout?.();
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [timeout, onTimeout]);
  
  // Keyboard input
  useInput((input, key) => {
    if (!isFocused) return;
    
    // Direct option selection
    const lowerInput = input.toLowerCase();
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (lowerInput === shortcuts[option] || lowerInput === option[0]) {
        onConfirm(option);
        return;
      }
    }
    
    // Enter to confirm selection
    if (key.return) {
      onConfirm(options[selectedIndex]);
      return;
    }
    
    // Escape to cancel
    if (key.escape) {
      onCancel?.();
      return;
    }
  });
  
  if (renderDialog) {
    return (
      <Box data-testid={testId}>
        {renderDialog({
          message,
          options: options as ConfirmationOption[],
          selectedIndex,
          timeRemaining,
        })}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.colors.border}
      paddingX={2}
      paddingY={1}
      data-testid={testId}
    >
      {/* Title */}
      {title && (
        <Box marginBottom={1}>
          <Text bold color={theme.colors.primary}>
            {title}
          </Text>
        </Box>
      )}
      
      {/* Message */}
      <Box marginBottom={1}>
        <Text color={theme.colors.text}>{message}</Text>
      </Box>
      
      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => (
          <OptionButton
            key={option}
            option={option}
            label={defaultLabels[option]}
            isSelected={index === selectedIndex}
            colors={theme.colors}
            shortcut={shortcuts[option]}
          />
        ))}
      </Box>
      
      {/* Timeout indicator */}
      {timeRemaining !== undefined && timeout > 0 && (
        <Box marginTop={1}>
          <Text color={theme.colors.textMuted} dimColor>
            Auto-selecting in {(timeRemaining / 1000).toFixed(1)}s
          </Text>
        </Box>
      )}
      
      {/* Help text */}
      <Box marginTop={1}>
        <Text color={theme.colors.textMuted} dimColor>
          Use ↑/↓ or letter keys to select, Enter to confirm, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for ConfirmationDialog
 */
ConfirmationDialogComponent.propTypes = {
  message: PropTypes.string.isRequired,
  title: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.oneOf(['yes', 'no', 'always', 'never'] as const)),
  defaultOption: PropTypes.oneOf(['yes', 'no', 'always', 'never'] as const),
  showAlways: PropTypes.bool,
  showNever: PropTypes.bool,
  labels: PropTypes.object,
  isFocused: PropTypes.bool,
  timeout: PropTypes.number,
  renderDialog: PropTypes.func,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  onTimeout: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ConfirmationDialog with error boundary
 */
export function ConfirmationDialog(props: ConfirmationDialogProps): ReactNode {
  return (
    <ConfirmationDialogErrorBoundary>
      <ConfirmationDialogComponent {...props} />
    </ConfirmationDialogErrorBoundary>
  );
}

/**
 * Simple yes/no dialog
 */
export function YesNoDialog(
  props: Omit<ConfirmationDialogProps, 'options' | 'showAlways' | 'showNever'>
): ReactNode {
  return (
    <ConfirmationDialog
      {...props}
      options={['yes', 'no']}
    />
  );
}

YesNoDialog.propTypes = {
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

/**
 * Confirm delete dialog
 */
export function ConfirmDeleteDialog(
  props: Omit<ConfirmationDialogProps, 'title' | 'options' | 'defaultOption'>
): ReactNode {
  return (
    <ConfirmationDialog
      {...props}
      title="Confirm Delete"
      options={['yes', 'no']}
      defaultOption="no"
    />
  );
}

ConfirmDeleteDialog.propTypes = {
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

/**
 * Confirm overwrite dialog
 */
export function ConfirmOverwriteDialog(
  props: Omit<ConfirmationDialogProps, 'title' | 'options' | 'defaultOption'>
): ReactNode {
  return (
    <ConfirmationDialog
      {...props}
      title="Confirm Overwrite"
      options={['yes', 'no', 'always', 'never']}
      defaultOption="no"
      showAlways
      showNever
    />
  );
}

ConfirmOverwriteDialog.propTypes = {
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default ConfirmationDialog;
