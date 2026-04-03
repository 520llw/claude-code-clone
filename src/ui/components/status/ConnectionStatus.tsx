/**
 * Connection Status Component for Claude Code Clone
 * Displays API connection indicator
 * @module components/status/ConnectionStatus
 */

import React, { Component, type ReactNode, type ErrorInfo, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import type { ConnectionStatus as ConnectionStatusType, ConnectionInfo } from '../../types/index.js';
import { useCurrentTheme, useThemeAnimations } from '../../hooks/useTheme.js';

/**
 * Props for ConnectionStatus component
 */
export interface ConnectionStatusProps {
  /** Connection information */
  connection: ConnectionInfo;
  /** Display mode */
  mode?: 'icon' | 'text' | 'full';
  /** Show latency */
  showLatency?: boolean;
  /** Show provider name */
  showProvider?: boolean;
  /** Show model name */
  showModel?: boolean;
  /** Custom connected icon */
  connectedIcon?: string;
  /** Custom connecting icon */
  connectingIcon?: string;
  /** Custom disconnected icon */
  disconnectedIcon?: string;
  /** Custom error icon */
  errorIcon?: string;
  /** Pulse animation on connected */
  pulseOnConnected?: boolean;
  /** Callback on status click */
  onClick?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for ConnectionStatus
 */
interface ConnectionStatusErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ConnectionStatusErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ConnectionStatusErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ConnectionStatusErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ConnectionStatus Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box>
          <Text color="red">?</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Status configuration
 */
const STATUS_CONFIG: Record<ConnectionStatusType, {
  icon: string;
  color: string;
  label: string;
  animate: boolean;
}> = {
  connected: {
    icon: '🟢',
    color: 'green',
    label: 'Connected',
    animate: false,
  },
  connecting: {
    icon: '🟡',
    color: 'yellow',
    label: 'Connecting',
    animate: true,
  },
  disconnected: {
    icon: '🔴',
    color: 'red',
    label: 'Disconnected',
    animate: false,
  },
  error: {
    icon: '⚠',
    color: 'red',
    label: 'Error',
    animate: false,
  },
};

/**
 * Pulsing indicator component
 */
function PulsingIndicator({ 
  baseIcon, 
  color 
}: { 
  baseIcon: string; 
  color: string;
}): ReactNode {
  const [pulse, setPulse] = useState(true);
  const animations = useThemeAnimations();
  
  useEffect(() => {
    if (!animations.enabled) return;
    
    const interval = setInterval(() => {
      setPulse(p => !p);
    }, 500 / animations.speed);
    
    return () => clearInterval(interval);
  }, [animations.enabled, animations.speed]);
  
  return (
    <Text color={color} dimColor={!pulse}>
      {baseIcon}
    </Text>
  );
}

/**
 * Format latency
 */
function formatLatency(ms?: number): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Get latency color
 */
function getLatencyColor(ms: number, colors: ReturnType<typeof useCurrentTheme>['colors']): string {
  if (ms < 100) return colors.status.success;
  if (ms < 500) return colors.status.warning;
  return colors.status.error;
}

/**
 * ConnectionStatus component - Displays API connection status
 * 
 * @example
 * ```tsx
 * <ConnectionStatus 
 *   connection={{
 *     status: 'connected',
 *     provider: 'anthropic',
 *     model: 'claude-3-opus',
 *     latency: 150,
 *   }}
 *   mode="full"
 * />
 * ```
 */
function ConnectionStatusComponent({
  connection,
  mode = 'icon',
  showLatency = true,
  showProvider = true,
  showModel = true,
  connectedIcon,
  connectingIcon,
  disconnectedIcon,
  errorIcon,
  pulseOnConnected = false,
  onClick,
  'data-testid': testId = 'connection-status',
}: ConnectionStatusProps): ReactNode {
  const theme = useCurrentTheme();
  const config = STATUS_CONFIG[connection.status];
  
  // Custom icons
  const icon = {
    connected: connectedIcon || config.icon,
    connecting: connectingIcon || config.icon,
    disconnected: disconnectedIcon || config.icon,
    error: errorIcon || config.icon,
  }[connection.status];
  
  // Get color from theme
  const color = {
    connected: theme.colors.status.success,
    connecting: theme.colors.status.pending,
    disconnected: theme.colors.status.error,
    error: theme.colors.status.error,
  }[connection.status];
  
  // Icon only mode
  if (mode === 'icon') {
    const shouldPulse = config.animate || (pulseOnConnected && connection.status === 'connected');
    
    return (
      <Box onPress={onClick} data-testid={testId}>
        {shouldPulse ? (
          <PulsingIndicator baseIcon={icon} color={color} />
        ) : (
          <Text color={color}>{icon}</Text>
        )}
      </Box>
    );
  }
  
  // Text only mode
  if (mode === 'text') {
    return (
      <Box flexDirection="row" gap={1} onPress={onClick} data-testid={testId}>
        <Text color={color}>{config.label}</Text>
        {showLatency && connection.latency && (
          <Text color={getLatencyColor(connection.latency, theme.colors)}>
            ({formatLatency(connection.latency)})
          </Text>
        )}
      </Box>
    );
  }
  
  // Full mode
  return (
    <Box 
      flexDirection="row" 
      gap={1} 
      onPress={onClick}
      data-testid={testId}
    >
      {/* Status icon */}
      {config.animate || (pulseOnConnected && connection.status === 'connected') ? (
        <PulsingIndicator baseIcon={icon} color={color} />
      ) : (
        <Text color={color}>{icon}</Text>
      )}
      
      {/* Status label */}
      <Text color={color}>{config.label}</Text>
      
      {/* Provider */}
      {showProvider && (
        <Text color={theme.colors.textMuted}>
          {connection.provider}
        </Text>
      )}
      
      {/* Model */}
      {showModel && connection.model && (
        <Text color={theme.colors.textMuted}>
          ({connection.model})
        </Text>
      )}
      
      {/* Latency */}
      {showLatency && connection.latency && (
        <Text color={getLatencyColor(connection.latency, theme.colors)}>
          {formatLatency(connection.latency)}
        </Text>
      )}
      
      {/* Error message */}
      {connection.status === 'error' && connection.error && (
        <Text color={theme.colors.status.error}>
          {connection.error}
        </Text>
      )}
    </Box>
  );
}

/**
 * PropTypes validation for ConnectionStatus
 */
ConnectionStatusComponent.propTypes = {
  connection: PropTypes.shape({
    status: PropTypes.oneOf(['connected', 'connecting', 'disconnected', 'error'] as const).isRequired,
    provider: PropTypes.string.isRequired,
    model: PropTypes.string.isRequired,
    lastPing: PropTypes.instanceOf(Date),
    error: PropTypes.string,
    latency: PropTypes.number,
  }).isRequired,
  mode: PropTypes.oneOf(['icon', 'text', 'full'] as const),
  showLatency: PropTypes.bool,
  showProvider: PropTypes.bool,
  showModel: PropTypes.bool,
  connectedIcon: PropTypes.string,
  connectingIcon: PropTypes.string,
  disconnectedIcon: PropTypes.string,
  errorIcon: PropTypes.string,
  pulseOnConnected: PropTypes.bool,
  onClick: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped ConnectionStatus with error boundary
 */
export function ConnectionStatus(props: ConnectionStatusProps): ReactNode {
  return (
    <ConnectionStatusErrorBoundary>
      <ConnectionStatusComponent {...props} />
    </ConnectionStatusErrorBoundary>
  );
}

/**
 * Simple connection indicator (icon only)
 */
export function ConnectionIndicator({
  status,
}: {
  status: ConnectionStatusType;
}): ReactNode {
  return (
    <ConnectionStatus
      connection={{ status, provider: '', model: '' }}
      mode="icon"
    />
  );
}

ConnectionIndicator.propTypes = {
  status: PropTypes.oneOf(['connected', 'connecting', 'disconnected', 'error'] as const).isRequired,
};

/**
 * Connected badge
 */
export function ConnectedBadge({
  provider,
  model,
}: {
  provider?: string;
  model?: string;
}): ReactNode {
  return (
    <ConnectionStatus
      connection={{ 
        status: 'connected', 
        provider: provider || '', 
        model: model || '' 
      }}
      mode="full"
      showLatency={false}
    />
  );
}

ConnectedBadge.propTypes = {
  provider: PropTypes.string,
  model: PropTypes.string,
};

export default ConnectionStatus;
