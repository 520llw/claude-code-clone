/**
 * Token Usage Component for Claude Code Clone
 * Displays token consumption and cost information
 * @module components/status/TokenUsage
 */

import React, { Component, type ReactNode, type ErrorInfo, useMemo } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import type { TokenUsage as TokenUsageType } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Props for TokenUsage component
 */
export interface TokenUsageProps {
  /** Token usage data */
  usage: TokenUsageType;
  /** Display mode */
  mode?: 'compact' | 'detailed' | 'bar';
  /** Show cost information */
  showCost?: boolean;
  /** Show percentage of context limit */
  showPercentage?: boolean;
  /** Warning threshold percentage (0-100) */
  warningThreshold?: number;
  /** Critical threshold percentage (0-100) */
  criticalThreshold?: number;
  /** Custom label */
  label?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Props for usage bar
 */
interface UsageBarProps {
  /** Current usage */
  current: number;
  /** Maximum limit */
  max: number;
  /** Bar width */
  width: number;
  /** Theme colors */
  colors: ReturnType<typeof useCurrentTheme>['colors'];
  /** Warning threshold */
  warningThreshold: number;
  /** Critical threshold */
  criticalThreshold: number;
}

/**
 * Error boundary for TokenUsage
 */
interface TokenUsageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TokenUsageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  TokenUsageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): TokenUsageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('TokenUsage Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">...</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Usage bar component
 */
function UsageBar({
  current,
  max,
  width,
  colors,
  warningThreshold,
  criticalThreshold,
}: UsageBarProps): ReactNode {
  const percentage = Math.min(100, (current / max) * 100);
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  // Determine color based on thresholds
  let barColor = colors.status.success;
  if (percentage >= criticalThreshold) {
    barColor = colors.status.error;
  } else if (percentage >= warningThreshold) {
    barColor = colors.status.warning;
  }
  
  const fillChar = '█';
  const emptyChar = '░';
  
  return (
    <Box flexDirection="row">
      <Text color={barColor}>{fillChar.repeat(filled)}</Text>
      <Text color={colors.textMuted}>{emptyChar.repeat(empty)}</Text>
      <Text color={colors.textMuted}> {percentage.toFixed(1)}%</Text>
    </Box>
  );
}

/**
 * TokenUsage component - Displays token consumption
 * 
 * @example
 * ```tsx
 * <TokenUsage 
 *   usage={{
 *     input: 1000,
 *     output: 500,
 *     total: 1500,
 *     contextLimit: 8000,
 *     contextPercentage: 18.75,
 *   }}
 *   mode="detailed"
 * />
 * ```
 */
function TokenUsageComponent({
  usage,
  mode = 'compact',
  showCost = true,
  showPercentage = true,
  warningThreshold = 70,
  criticalThreshold = 90,
  label,
  'data-testid': testId = 'token-usage',
}: TokenUsageProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  
  const barWidth = Math.min(30, Math.floor(columns / 3));
  
  // Calculate context percentage if not provided
  const contextPercentage = usage.contextPercentage || 
    (usage.contextLimit ? (usage.total / usage.contextLimit) * 100 : 0);
  
  // Determine status color
  const getStatusColor = (percentage: number) => {
    if (percentage >= criticalThreshold) return theme.colors.status.error;
    if (percentage >= warningThreshold) return theme.colors.status.warning;
    return theme.colors.status.success;
  };

  // Compact mode
  if (mode === 'compact') {
    return (
      <Box flexDirection="row" gap={1} data-testid={testId}>
        {label && <Text color={theme.colors.textMuted}>{label}</Text>}
        <Text color={theme.colors.textMuted}>Tokens:</Text>
        <Text color={theme.colors.text}>{formatNumber(usage.total)}</Text>
        {showPercentage && usage.contextLimit && (
          <Text color={getStatusColor(contextPercentage)}>
            ({contextPercentage.toFixed(1)}%)
          </Text>
        )}
        {showCost && usage.cost && (
          <Text color={theme.colors.textMuted}>
            {formatCurrency(usage.cost.total, usage.cost.currency)}
          </Text>
        )}
      </Box>
    );
  }
  
  // Bar mode
  if (mode === 'bar') {
    return (
      <Box flexDirection="column" data-testid={testId}>
        {label && (
          <Text color={theme.colors.textMuted}>{label}</Text>
        )}
        <Box flexDirection="row" gap={1}>
          <Text color={theme.colors.textMuted}>Usage:</Text>
          {usage.contextLimit ? (
            <UsageBar
              current={usage.total}
              max={usage.contextLimit}
              width={barWidth}
              colors={theme.colors}
              warningThreshold={warningThreshold}
              criticalThreshold={criticalThreshold}
            />
          ) : (
            <Text color={theme.colors.text}>{formatNumber(usage.total)}</Text>
          )}
        </Box>
      </Box>
    );
  }
  
  // Detailed mode
  return (
    <Box 
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {/* Header */}
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          📊 Token Usage
        </Text>
        {label && <Text color={theme.colors.textMuted}>{label}</Text>}
      </Box>
      
      {/* Token breakdown */}
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Box width={12}>
            <Text color={theme.colors.textMuted}>Input:</Text>
          </Box>
          <Text color={theme.colors.text}>{formatNumber(usage.input)}</Text>
        </Box>
        
        <Box flexDirection="row" gap={2}>
          <Box width={12}>
            <Text color={theme.colors.textMuted}>Output:</Text>
          </Box>
          <Text color={theme.colors.text}>{formatNumber(usage.output)}</Text>
        </Box>
        
        <Box flexDirection="row" gap={2}>
          <Box width={12}>
            <Text color={theme.colors.textMuted}>Total:</Text>
          </Box>
          <Text bold color={theme.colors.text}>{formatNumber(usage.total)}</Text>
        </Box>
      </Box>
      
      {/* Context limit bar */}
      {showPercentage && usage.contextLimit && (
        <Box flexDirection="column" marginTop={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>Context:</Text>
            <UsageBar
              current={usage.total}
              max={usage.contextLimit}
              width={barWidth}
              colors={theme.colors}
              warningThreshold={warningThreshold}
              criticalThreshold={criticalThreshold}
            />
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>
              {formatNumber(usage.total)} / {formatNumber(usage.contextLimit)} tokens
            </Text>
          </Box>
        </Box>
      )}
      
      {/* Cost information */}
      {showCost && usage.cost && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.colors.textMuted}>Cost:</Text>
          <Box flexDirection="row" gap={2} marginLeft={2}>
            <Text color={theme.colors.textMuted}>
              Input: {formatCurrency(usage.cost.input, usage.cost.currency)}
            </Text>
            <Text color={theme.colors.textMuted}>
              Output: {formatCurrency(usage.cost.output, usage.cost.currency)}
            </Text>
            <Text color={theme.colors.text} bold>
              Total: {formatCurrency(usage.cost.total, usage.cost.currency)}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for TokenUsage
 */
TokenUsageComponent.propTypes = {
  usage: PropTypes.shape({
    input: PropTypes.number.isRequired,
    output: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    cost: PropTypes.shape({
      input: PropTypes.number.isRequired,
      output: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired,
      currency: PropTypes.string.isRequired,
    }),
    contextLimit: PropTypes.number,
    contextPercentage: PropTypes.number,
  }).isRequired,
  mode: PropTypes.oneOf(['compact', 'detailed', 'bar'] as const),
  showCost: PropTypes.bool,
  showPercentage: PropTypes.bool,
  warningThreshold: PropTypes.number,
  criticalThreshold: PropTypes.number,
  label: PropTypes.string,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped TokenUsage with error boundary
 */
export function TokenUsage(props: TokenUsageProps): ReactNode {
  return (
    <TokenUsageErrorBoundary>
      <TokenUsageComponent {...props} />
    </TokenUsageErrorBoundary>
  );
}

/**
 * Compact token display
 */
export function CompactTokenUsage({
  total,
  contextLimit,
}: {
  total: number;
  contextLimit?: number;
}): ReactNode {
  const theme = useCurrentTheme();
  const percentage = contextLimit ? (total / contextLimit) * 100 : 0;
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.colors.textMuted}>🪙</Text>
      <Text color={theme.colors.text}>{formatNumber(total)}</Text>
      {contextLimit && (
        <Text 
          color={
            percentage >= 90 
              ? theme.colors.status.error 
              : percentage >= 70 
                ? theme.colors.status.warning 
                : theme.colors.status.success
          }
        >
          ({percentage.toFixed(0)}%)
        </Text>
      )}
    </Box>
  );
}

CompactTokenUsage.propTypes = {
  total: PropTypes.number.isRequired,
  contextLimit: PropTypes.number,
};

export default TokenUsage;
