/**
 * Session Info Component for Claude Code Clone
 * Displays session metadata
 * @module components/status/SessionInfo
 */

import React, { Component, type ReactNode, type ErrorInfo, useMemo } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import type { SessionInfo as SessionInfoType } from '../../types/index.js';
import { useCurrentTheme } from '../../hooks/useTheme.js';

/**
 * Props for SessionInfo component
 */
export interface SessionInfoProps {
  /** Session information */
  session: SessionInfoType;
  /** Display mode */
  mode?: 'compact' | 'detailed' | 'minimal';
  /** Show session ID */
  showId?: boolean;
  /** Show creation time */
  showCreatedAt?: boolean;
  /** Show last activity */
  showLastActivity?: boolean;
  /** Show message count */
  showMessageCount?: boolean;
  /** Show token usage */
  showTokenUsage?: boolean;
  /** Show working directory */
  showCwd?: boolean;
  /** Show active tools */
  showActiveTools?: boolean;
  /** Custom formatter for dates */
  dateFormatter?: (date: Date) => string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Error boundary for SessionInfo
 */
interface SessionInfoErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SessionInfoErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  SessionInfoErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SessionInfoErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('SessionInfo Error:', error, errorInfo);
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
 * Format date to relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Format date to absolute time
 */
function formatAbsoluteTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration from start to now
 */
function formatSessionDuration(startDate: Date): string {
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * SessionInfo component - Displays session metadata
 * 
 * @example
 * ```tsx
 * <SessionInfo 
 *   session={{
 *     id: 'sess-123',
 *     name: 'My Session',
 *     createdAt: new Date(),
 *     lastActivity: new Date(),
 *     messageCount: 42,
 *     totalTokens: 15000,
 *     cwd: '/home/user/project',
 *     activeTools: ['bash', 'file'],
 *   }}
 *   mode="detailed"
 * />
 * ```
 */
function SessionInfoComponent({
  session,
  mode = 'compact',
  showId = false,
  showCreatedAt = true,
  showLastActivity = true,
  showMessageCount = true,
  showTokenUsage = true,
  showCwd = true,
  showActiveTools = true,
  dateFormatter,
  'data-testid': testId = 'session-info',
}: SessionInfoProps): ReactNode {
  const theme = useCurrentTheme();
  
  const formatDate = dateFormatter || formatAbsoluteTime;
  
  // Calculate session duration
  const duration = useMemo(() => 
    formatSessionDuration(session.createdAt),
    [session.createdAt]
  );
  
  // Minimal mode - just name and duration
  if (mode === 'minimal') {
    return (
      <Box flexDirection="row" gap={1} data-testid={testId}>
        <Text color={theme.colors.primary}>📁</Text>
        <Text color={theme.colors.text} bold>{session.name}</Text>
        <Text color={theme.colors.textMuted}>({duration})</Text>
      </Box>
    );
  }
  
  // Compact mode
  if (mode === 'compact') {
    return (
      <Box flexDirection="row" gap={2} data-testid={testId}>
        <Text color={theme.colors.primary}>📁</Text>
        <Text color={theme.colors.text} bold>{session.name}</Text>
        
        {showMessageCount && (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>💬</Text>
            <Text color={theme.colors.text}>{session.messageCount}</Text>
          </Box>
        )}
        
        {showTokenUsage && (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>🪙</Text>
            <Text color={theme.colors.text}>{session.totalTokens.toLocaleString()}</Text>
          </Box>
        )}
        
        {showCwd && (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>📂</Text>
            <Text color={theme.colors.textMuted}>{session.cwd}</Text>
          </Box>
        )}
        
        {showActiveTools && session.activeTools.length > 0 && (
          <Box flexDirection="row" gap={1}>
            <Text color={theme.colors.textMuted}>🔧</Text>
            <Text color={theme.colors.textMuted}>
              {session.activeTools.join(', ')}
            </Text>
          </Box>
        )}
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
          📁 Session
        </Text>
        <Text color={theme.colors.text} bold>
          {session.name}
        </Text>
      </Box>
      
      {/* Session details */}
      <Box flexDirection="column">
        {/* ID */}
        {showId && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>ID:</Text>
            </Box>
            <Text color={theme.colors.text}>{session.id}</Text>
          </Box>
        )}
        
        {/* Created */}
        {showCreatedAt && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Created:</Text>
            </Box>
            <Text color={theme.colors.text}>
              {formatDate(session.createdAt)}
            </Text>
            <Text color={theme.colors.textMuted}>
              ({formatRelativeTime(session.createdAt)})
            </Text>
          </Box>
        )}
        
        {/* Duration */}
        <Box flexDirection="row" gap={2}>
          <Box width={15}>
            <Text color={theme.colors.textMuted}>Duration:</Text>
          </Box>
          <Text color={theme.colors.text}>{duration}</Text>
        </Box>
        
        {/* Last activity */}
        {showLastActivity && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Last Activity:</Text>
            </Box>
            <Text color={theme.colors.text}>
              {formatDate(session.lastActivity)}
            </Text>
            <Text color={theme.colors.textMuted}>
              ({formatRelativeTime(session.lastActivity)})
            </Text>
          </Box>
        )}
        
        {/* Message count */}
        {showMessageCount && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Messages:</Text>
            </Box>
            <Text color={theme.colors.text}>{session.messageCount}</Text>
          </Box>
        )}
        
        {/* Token usage */}
        {showTokenUsage && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Total Tokens:</Text>
            </Box>
            <Text color={theme.colors.text}>
              {session.totalTokens.toLocaleString()}
            </Text>
          </Box>
        )}
        
        {/* Working directory */}
        {showCwd && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Directory:</Text>
            </Box>
            <Text color={theme.colors.status.info}>{session.cwd}</Text>
          </Box>
        )}
        
        {/* Active tools */}
        {showActiveTools && session.activeTools.length > 0 && (
          <Box flexDirection="row" gap={2}>
            <Box width={15}>
              <Text color={theme.colors.textMuted}>Active Tools:</Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              {session.activeTools.map((tool, index) => (
                <Box key={tool}>
                  <Text color={theme.colors.status.success}>{tool}</Text>
                  {index < session.activeTools.length - 1 && (
                    <Text color={theme.colors.textMuted}>, </Text>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for SessionInfo
 */
SessionInfoComponent.propTypes = {
  session: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    createdAt: PropTypes.instanceOf(Date).isRequired,
    lastActivity: PropTypes.instanceOf(Date).isRequired,
    messageCount: PropTypes.number.isRequired,
    totalTokens: PropTypes.number.isRequired,
    cwd: PropTypes.string.isRequired,
    activeTools: PropTypes.arrayOf(PropTypes.string).isRequired,
    metadata: PropTypes.object,
  }).isRequired,
  mode: PropTypes.oneOf(['compact', 'detailed', 'minimal'] as const),
  showId: PropTypes.bool,
  showCreatedAt: PropTypes.bool,
  showLastActivity: PropTypes.bool,
  showMessageCount: PropTypes.bool,
  showTokenUsage: PropTypes.bool,
  showCwd: PropTypes.bool,
  showActiveTools: PropTypes.bool,
  dateFormatter: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped SessionInfo with error boundary
 */
export function SessionInfo(props: SessionInfoProps): ReactNode {
  return (
    <SessionInfoErrorBoundary>
      <SessionInfoComponent {...props} />
    </SessionInfoErrorBoundary>
  );
}

/**
 * Compact session badge
 */
export function SessionBadge({
  name,
  messageCount,
}: {
  name: string;
  messageCount?: number;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.colors.primary}>📁</Text>
      <Text color={theme.colors.text}>{name}</Text>
      {messageCount !== undefined && (
        <Text color={theme.colors.textMuted}>({messageCount})</Text>
      )}
    </Box>
  );
}

SessionBadge.propTypes = {
  name: PropTypes.string.isRequired,
  messageCount: PropTypes.number,
};

export default SessionInfo;
