/**
 * Enhanced Status Bar Component
 *
 * Shows provider info, model name, status, token count, cost, and directory.
 * Color-coded by provider.
 */

import { Box, Text } from 'ink';

// ============================================================================
// Props
// ============================================================================

interface StatusBarProps {
  status: string;
  sessionName?: string | undefined;
  messageCount: number;
  tokenCount: number;
  workingDirectory: string;
  provider?: string | undefined;
  model?: string | undefined;
  cost?: number | undefined;
}

// ============================================================================
// Helpers
// ============================================================================

function getProviderColor(provider: string): string {
  switch (provider?.toLowerCase()) {
    case 'anthropic': return 'cyan';
    case 'openai': return 'green';
    case 'kimi': return 'magenta';
    case 'google': return 'blue';
    default: return 'white';
  }
}

function getProviderIcon(provider: string): string {
  switch (provider?.toLowerCase()) {
    case 'anthropic': return '◆';
    case 'openai': return '◈';
    case 'kimi': return '◇';
    case 'google': return '◉';
    default: return '●';
  }
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'ready': return 'green';
    case 'thinking...':
    case 'thinking':
    case 'processing': return 'yellow';
    case 'error': return 'red';
    default: return 'gray';
  }
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ============================================================================
// Component
// ============================================================================

export function StatusBar({
  status,
  sessionName,
  messageCount,
  tokenCount,
  workingDirectory,
  provider = 'anthropic',
  model,
  cost = 0,
}: StatusBarProps): JSX.Element {
  const displayDir = workingDirectory.length > 25
    ? '...' + workingDirectory.slice(-22)
    : workingDirectory;

  const providerColor = getProviderColor(provider);
  const providerIcon = getProviderIcon(provider);
  const statusColor = getStatusColor(status);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
    >
      {/* Left: provider + status */}
      <Box flexDirection="row">
        <Text color={providerColor} bold>{providerIcon} </Text>
        <Text color={providerColor} bold>
          {provider.charAt(0).toUpperCase() + provider.slice(1)}
        </Text>
        {model && (
          <Text dimColor color="white"> / {model}</Text>
        )}
        <Text color="white"> | </Text>
        <Text color={statusColor}>{status}</Text>
      </Box>

      {/* Middle: session + stats */}
      <Box flexDirection="row">
        {sessionName && (
          <>
            <Text color="white" dimColor>{sessionName}</Text>
            <Text color="white"> | </Text>
          </>
        )}
        <Text color="white" dimColor>Msgs: {messageCount}</Text>
        {tokenCount > 0 && (
          <>
            <Text color="white"> | </Text>
            <Text color="white" dimColor>Tokens: {formatTokenCount(tokenCount)}</Text>
          </>
        )}
        {cost > 0 && (
          <>
            <Text color="white"> | </Text>
            <Text color="green" dimColor>${cost.toFixed(4)}</Text>
          </>
        )}
      </Box>

      {/* Right: directory */}
      <Box flexDirection="row">
        <Text color="white" dimColor>{displayDir}</Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
