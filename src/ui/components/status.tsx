/**
 * Status Bar Component
 * 
 * Displays system status information at the bottom of the terminal.
 */

import React from 'react';
import { Box, Text } from 'ink';

// ============================================================================
// Props
// ============================================================================

interface StatusBarProps {
  status: string;
  sessionName?: string;
  messageCount: number;
  tokenCount: number;
  workingDirectory: string;
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
}: StatusBarProps): JSX.Element {
  // Truncate working directory if too long
  const displayDir = workingDirectory.length > 30
    ? '...' + workingDirectory.slice(-27)
    : workingDirectory;
  
  // Get status color
  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case 'ready':
        return 'green' as const;
      case 'thinking':
      case 'processing':
        return 'yellow' as const;
      case 'error':
        return 'red' as const;
      default:
        return 'gray' as const;
    }
  };
  
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      backgroundColor="gray"
    >
      {/* Left section */}
      <Box flexDirection="row">
        <Text color="white" bold> Claude Code </Text>
        <Text color="white">|</Text>
        <Text color={getStatusColor()}> {status} </Text>
      </Box>
      
      {/* Middle section */}
      <Box flexDirection="row">
        {sessionName && (
          <>
            <Text color="white" dimColor>Session: {sessionName}</Text>
            <Text color="white"> | </Text>
          </>
        )}
        <Text color="white" dimColor>Msgs: {messageCount}</Text>
        {tokenCount > 0 && (
          <>
            <Text color="white"> | </Text>
            <Text color="white" dimColor>Tokens: {tokenCount}</Text>
          </>
        )}
      </Box>
      
      {/* Right section */}
      <Box flexDirection="row">
        <Text color="white" dimColor>{displayDir}</Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
