/**
 * Provider Switching Panel Component
 *
 * Allows real-time switching between LLM providers (Anthropic, OpenAI, Kimi, Custom).
 * Triggered with Ctrl+P.
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

// ============================================================================
// Types
// ============================================================================

export interface ProviderOption {
  id: string;
  name: string;
  configured: boolean;
  apiKeyEnv: string;
  currentModel: string;
  models: string[];
  color: string;
}

interface ProviderPanelProps {
  providers: ProviderOption[];
  activeProviderId: string;
  onSelect: (providerId: string, model: string) => void;
  onClose: () => void;
}

// ============================================================================
// Default Provider Definitions
// ============================================================================

export const DEFAULT_PROVIDERS: ProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    configured: false,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    currentModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ],
    color: 'cyan',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    configured: false,
    apiKeyEnv: 'OPENAI_API_KEY',
    currentModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1-preview',
    ],
    color: 'green',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    configured: false,
    apiKeyEnv: 'MOONSHOT_API_KEY',
    currentModel: 'kimi-k2.5',
    models: [
      'kimi-k2.5',
      'kimi-latest-8k',
      'kimi-k2-0905-preview',
    ],
    color: 'magenta',
  },
  {
    id: 'custom',
    name: 'Custom',
    configured: false,
    apiKeyEnv: 'CUSTOM_API_KEY',
    currentModel: '',
    models: [],
    color: 'yellow',
  },
];

// ============================================================================
// Component
// ============================================================================

export function ProviderPanel({
  providers,
  activeProviderId,
  onSelect,
  onClose,
}: ProviderPanelProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, providers.findIndex(p => p.id === activeProviderId))
  );
  const [mode, setMode] = useState<'provider' | 'model'>('provider');
  const [modelIndex, setModelIndex] = useState(0);

  const selectedProvider: ProviderOption | undefined = providers[selectedIndex];

  useInput((input, key) => {
    if (!selectedProvider) return;
    if (key.escape || (key.ctrl && input === 'p')) {
      if (mode === 'model') {
        setMode('provider');
      } else {
        onClose();
      }
      return;
    }

    if (mode === 'provider') {
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(providers.length - 1, prev + 1));
      } else if (key.return) {
        if (selectedProvider.models.length > 0) {
          setMode('model');
          setModelIndex(0);
        }
      }
    } else if (mode === 'model') {
      if (key.upArrow) {
        setModelIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModelIndex(prev => Math.min(selectedProvider.models.length - 1, prev + 1));
      } else if (key.return) {
        onSelect(selectedProvider.id, selectedProvider.models[modelIndex] || '');
        onClose();
      }
    }
  });

  if (!selectedProvider) {
    return (
      <Box>
        <Text color="red">No providers available</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          {mode === 'provider' ? ' Switch Provider ' : ` Select Model - ${selectedProvider.name} `}
        </Text>
      </Box>

      {mode === 'provider' ? (
        /* Provider list */
        <Box flexDirection="column">
          {providers.map((p, index) => {
            const isSelected = index === selectedIndex;
            const isActive = p.id === activeProviderId;
            return (
              <Box key={p.id} flexDirection="row">
                <Text color={isSelected ? 'white' : 'gray'}>
                  {isSelected ? ' > ' : '   '}
                </Text>
                <Text
                  color={p.configured ? p.color : 'gray'}
                  bold={isSelected}
                >
                  {p.configured ? '●' : '○'} {p.name}
                </Text>
                {isActive && (
                  <Text color="green" bold> [active]</Text>
                )}
                {p.configured ? (
                  <Text dimColor> - {p.currentModel}</Text>
                ) : (
                  <Text color="yellow" dimColor> - Set {p.apiKeyEnv}</Text>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        /* Model list */
        <Box flexDirection="column">
          {selectedProvider.models.map((model, index) => {
            const isSelected = index === modelIndex;
            const isCurrent = model === selectedProvider.currentModel;
            return (
              <Box key={model} flexDirection="row">
                <Text color={isSelected ? 'white' : 'gray'}>
                  {isSelected ? ' > ' : '   '}
                </Text>
                <Text
                  color={isSelected ? selectedProvider.color : 'white'}
                  bold={isSelected}
                >
                  {model}
                </Text>
                {isCurrent && (
                  <Text color="green" dimColor> (current)</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Footer hint */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          {mode === 'provider'
            ? 'Up/Down to navigate, Enter to select model, Esc to close'
            : 'Up/Down to navigate, Enter to confirm, Esc to go back'}
        </Text>
      </Box>
    </Box>
  );
}

export default ProviderPanel;
