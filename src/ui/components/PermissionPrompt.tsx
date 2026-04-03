/**
 * Permission Prompt Component
 *
 * Inline permission dialog for tool execution approval.
 * Matches the real Claude Code experience: Yes(y) / No(n) / Always(a) / Never(v)
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

// ============================================================================
// Types
// ============================================================================

export type PermissionDecision = 'yes' | 'no' | 'always' | 'never';

export interface PermissionRequest {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  description?: string;
  isReadOnly?: boolean;
  isDangerous?: boolean;
}

interface PermissionPromptProps {
  request: PermissionRequest;
  onDecision: (decision: PermissionDecision) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function summarizeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '(no params)';

  return entries
    .slice(0, 3)
    .map(([key, value]) => {
      const val = typeof value === 'string'
        ? (value.length > 50 ? value.slice(0, 47) + '...' : value)
        : JSON.stringify(value);
      return `${key}: ${val}`;
    })
    .join(', ')
    + (entries.length > 3 ? ` (+${entries.length - 3} more)` : '');
}

function getToolColor(toolName: string): string {
  if (/bash|shell|exec/i.test(toolName)) return 'yellow';
  if (/delete|remove|rm/i.test(toolName)) return 'red';
  if (/edit|write|create/i.test(toolName)) return 'cyan';
  if (/read|view|list|search|grep|find/i.test(toolName)) return 'green';
  return 'white';
}

// ============================================================================
// Component
// ============================================================================

export function PermissionPrompt({
  request,
  onDecision,
}: PermissionPromptProps): JSX.Element {
  const [selected, setSelected] = useState(0);
  const [decided, setDecided] = useState(false);
  const options: { key: string; label: string; decision: PermissionDecision; color: string }[] = [
    { key: 'y', label: 'Yes', decision: 'yes', color: 'green' },
    { key: 'n', label: 'No', decision: 'no', color: 'red' },
    { key: 'a', label: 'Always Allow', decision: 'always', color: 'cyan' },
    { key: 'v', label: 'Never Allow', decision: 'never', color: 'yellow' },
  ];

  const decide = (d: PermissionDecision) => {
    if (decided) return;
    setDecided(true);
    onDecision(d);
  };

  useInput((input, key) => {
    if (decided) return;

    const shortcut = options.find(o => o.key === input.toLowerCase());
    if (shortcut) {
      decide(shortcut.decision);
      return;
    }

    if (key.leftArrow || key.upArrow) {
      setSelected(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow || key.downArrow) {
      setSelected(prev => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      decide(options[selected]!.decision);
    } else if (key.escape) {
      decide('no');
    }
  });

  const toolColor = getToolColor(request.toolName);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={request.isDangerous ? 'red' : 'yellow'}
      paddingX={2}
      paddingY={0}
      marginY={0}
    >
      {/* Header */}
      <Box>
        <Text color={request.isDangerous ? 'red' : 'yellow'} bold>
          {request.isDangerous ? '⚠ Permission Required' : '? Allow Tool'}
        </Text>
      </Box>

      {/* Tool info */}
      <Box marginTop={0} flexDirection="column">
        <Box>
          <Text dimColor>Tool: </Text>
          <Text color={toolColor} bold>{request.toolName}</Text>
        </Box>
        <Box>
          <Text dimColor>Args: </Text>
          <Text>{summarizeParams(request.params)}</Text>
        </Box>
        {request.description && (
          <Box>
            <Text dimColor>Desc: </Text>
            <Text dimColor>{request.description}</Text>
          </Box>
        )}
      </Box>

      {/* Options */}
      <Box marginTop={1} flexDirection="row" gap={1}>
        {options.map((opt, i) => (
          <Box key={opt.key}>
            <Text
              color={i === selected ? opt.color : 'gray'}
              bold={i === selected}
              inverse={i === selected}
            >
              {` ${opt.label}(${opt.key}) `}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default PermissionPrompt;
