/**
 * Tool Execution Display Component
 *
 * Shows real-time tool execution status:
 * - Spinner + tool name during execution
 * - Elapsed time counter
 * - Result summary or inline diff on completion
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// ============================================================================
// Types
// ============================================================================

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolExecutionInfo {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  status: ToolStatus;
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
  diff?: {
    file: string;
    additions: number;
    deletions: number;
  };
}

interface ToolExecutionProps {
  execution: ToolExecutionInfo;
  compact?: boolean;
}

// ============================================================================
// Spinner frames
// ============================================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ============================================================================
// Tool name → icon mapping
// ============================================================================

function getToolColor(name: string): string {
  if (/bash|shell|exec/i.test(name)) return 'yellow';
  if (/delete|remove/i.test(name)) return 'red';
  if (/edit|write|create/i.test(name)) return 'cyan';
  if (/read|view|list|search|grep|find/i.test(name)) return 'green';
  if (/git/i.test(name)) return 'magenta';
  return 'white';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function summarizeResult(result: string, maxLen: number = 80): string {
  if (!result) return '';
  const lines = result.split('\n');
  if (lines.length === 1) {
    return result.length > maxLen ? result.slice(0, maxLen - 3) + '...' : result;
  }
  const first = (lines[0] || '').length > maxLen ? (lines[0] || '').slice(0, maxLen - 3) + '...' : (lines[0] || '');
  return `${first} (+${lines.length - 1} lines)`;
}

// ============================================================================
// Component
// ============================================================================

export function ToolExecution({
  execution,
  compact = false,
}: ToolExecutionProps): JSX.Element {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Animate spinner
  useEffect(() => {
    if (execution.status !== 'running') return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
      setElapsed(Date.now() - execution.startTime);
    }, 80);
    return () => clearInterval(timer);
  }, [execution.status, execution.startTime]);

  const color = getToolColor(execution.toolName);
  const duration = execution.endTime
    ? formatDuration(execution.endTime - execution.startTime)
    : formatDuration(elapsed);

  // Running state
  if (execution.status === 'running') {
    return (
      <Box paddingX={1} flexDirection="row">
        <Text color="yellow">{SPINNER_FRAMES[frame]} </Text>
        <Text color={color} bold>{execution.toolName}</Text>
        <Text dimColor> {duration}</Text>
        {!compact && execution.params && Object.keys(execution.params).length > 0 && (
          <Text dimColor>
            {' '}({Object.entries(execution.params).slice(0, 2).map(([k, v]) => {
              const val = typeof v === 'string' ? (v.length > 30 ? v.slice(0, 27) + '...' : v) : String(v);
              return `${k}=${val}`;
            }).join(', ')})
          </Text>
        )}
      </Box>
    );
  }

  // Success state
  if (execution.status === 'success') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row">
          <Text color="green">✓ </Text>
          <Text color={color} bold>{execution.toolName}</Text>
          <Text dimColor> ({duration})</Text>
        </Box>

        {/* Show diff summary for file edits */}
        {execution.diff && (
          <Box marginLeft={3}>
            <Text dimColor>{execution.diff.file}: </Text>
            {execution.diff.additions > 0 && (
              <Text color="green">+{execution.diff.additions} </Text>
            )}
            {execution.diff.deletions > 0 && (
              <Text color="red">-{execution.diff.deletions}</Text>
            )}
          </Box>
        )}

        {/* Show result summary */}
        {!compact && execution.result && !execution.diff && (
          <Box marginLeft={3}>
            <Text dimColor>{summarizeResult(execution.result)}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Error state
  if (execution.status === 'error') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row">
          <Text color="red">✗ </Text>
          <Text color={color} bold>{execution.toolName}</Text>
          <Text dimColor> ({duration})</Text>
        </Box>
        {execution.error && (
          <Box marginLeft={3}>
            <Text color="red">{summarizeResult(execution.error, 100)}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Pending state
  return (
    <Box paddingX={1}>
      <Text dimColor>○ {execution.toolName} (pending)</Text>
    </Box>
  );
}

// ============================================================================
// Tool Execution List (for multiple concurrent tools)
// ============================================================================

interface ToolExecutionListProps {
  executions: ToolExecutionInfo[];
  compact?: boolean;
}

export function ToolExecutionList({
  executions,
  compact = false,
}: ToolExecutionListProps): JSX.Element {
  if (executions.length === 0) return <></>;

  return (
    <Box flexDirection="column" marginY={0}>
      {executions.map((exec) => (
        <ToolExecution key={exec.id} execution={exec} compact={compact} />
      ))}
    </Box>
  );
}

export default ToolExecution;
