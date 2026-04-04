/**
 * Welcome Screen Component
 *
 * Displays an ASCII art logo, version info, provider status,
 * and quick start tips on first launch.
 */

import { Box, Text } from 'ink';

// ============================================================================
// Props
// ============================================================================

interface ProviderInfo {
  name: string;
  configured: boolean;
  model?: string;
}

interface WelcomeScreenProps {
  version: string;
  provider: ProviderInfo;
  availableProviders: ProviderInfo[];
  onDismiss?: () => void;
}

// ============================================================================
// ASCII Art Logo
// ============================================================================

const LOGO = [
  '  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗',
  ' ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝',
  ' ██║     ██║     ███████║██║   ██║██║  ██║█████╗  ',
  ' ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ',
  ' ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗',
  '  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝',
  '       ██████╗ ██████╗ ██████╗ ███████╗              ',
  '      ██╔════╝██╔═══██╗██╔══██╗██╔════╝              ',
  '      ██║     ██║   ██║██║  ██║█████╗                ',
  '      ██║     ██║   ██║██║  ██║██╔══╝                ',
  '      ╚██████╗╚██████╔╝██████╔╝███████╗              ',
  '       ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝              ',
];

// ============================================================================
// Provider color mapping
// ============================================================================

function getProviderColor(name: string): string {
  switch (name.toLowerCase()) {
    case 'anthropic': return 'cyan';
    case 'openai': return 'green';
    case 'kimi': return 'magenta';
    case 'google': return 'blue';
    default: return 'white';
  }
}

// ============================================================================
// Component
// ============================================================================

export function WelcomeScreen({
  version,
  provider,
  availableProviders,
}: WelcomeScreenProps): JSX.Element {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {/* Logo */}
      <Box flexDirection="column" alignItems="center">
        {LOGO.map((line, i) => (
          <Text key={i} color="cyan">{line}</Text>
        ))}
      </Box>

      {/* Version & tagline */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color="white" bold>v{version}</Text>
        <Text dimColor>AI-Powered Terminal Coding Assistant</Text>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(54)}</Text>
      </Box>

      {/* Active provider */}
      <Box flexDirection="column" alignItems="center">
        <Text bold color="white">Active Provider</Text>
        <Box marginTop={1}>
          <Text color={getProviderColor(provider.name)}>
            {provider.configured ? ' ● ' : ' ○ '}
          </Text>
          <Text color={getProviderColor(provider.name)} bold>
            {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
          </Text>
          {provider.model && (
            <Text dimColor> ({provider.model})</Text>
          )}
          {!provider.configured && (
            <Text color="yellow"> [Not configured]</Text>
          )}
        </Box>
      </Box>

      {/* Available providers */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text dimColor>Available Providers:</Text>
        <Box marginTop={1} flexDirection="row" gap={2}>
          {availableProviders.map((p) => (
            <Box key={p.name}>
              <Text color={p.configured ? getProviderColor(p.name) : 'gray'}>
                {p.configured ? '●' : '○'} {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(54)}</Text>
      </Box>

      {/* Quick start */}
      <Box flexDirection="column" paddingX={4}>
        <Text bold color="white">Quick Start</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>  <Text color="cyan" bold>Enter</Text>       Send message</Text>
          <Text>  <Text color="cyan" bold>Ctrl+P</Text>      Switch provider</Text>
          <Text>  <Text color="cyan" bold>Ctrl+T</Text>      Toggle tool panel</Text>
          <Text>  <Text color="cyan" bold>Ctrl+L</Text>      Clear screen</Text>
          <Text>  <Text color="cyan" bold>Ctrl+Q</Text>      Exit</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press any key or type a message to start...</Text>
      </Box>
    </Box>
  );
}

export default WelcomeScreen;
