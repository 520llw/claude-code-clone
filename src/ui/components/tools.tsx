/**
 * Tool Panel Component
 * 
 * Displays available tools and their status.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// ============================================================================
// Mock Tool Data (will be replaced with actual tool registry)
// ============================================================================

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

const MOCK_TOOLS: ToolInfo[] = [
  { name: 'View', description: 'View file contents', category: 'filesystem', enabled: true },
  { name: 'Read', description: 'Read file contents', category: 'filesystem', enabled: true },
  { name: 'Edit', description: 'Edit file contents', category: 'filesystem', enabled: true },
  { name: 'Create', description: 'Create new files', category: 'filesystem', enabled: true },
  { name: 'Delete', description: 'Delete files', category: 'filesystem', enabled: true },
  { name: 'Search', description: 'Search for files and content', category: 'search', enabled: true },
  { name: 'Grep', description: 'Search file contents', category: 'search', enabled: true },
  { name: 'Bash', description: 'Execute shell commands', category: 'bash', enabled: true },
  { name: 'Git', description: 'Git operations', category: 'git', enabled: true },
];

// ============================================================================
// Component
// ============================================================================

export function ToolPanel(): JSX.Element {
  const [tools] = useState<ToolInfo[]>(MOCK_TOOLS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Group tools by category
  const groupedTools = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);
  
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold underline>Available Tools</Text>
      </Box>
      
      {Object.entries(groupedTools).map(([category, categoryTools]) => (
        <Box key={category} flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>{capitalize(category)}</Text>
          {categoryTools.map((tool, index) => (
            <Box key={tool.name} flexDirection="row" paddingLeft={1}>
              <Text color={tool.enabled ? 'green' : 'red'}>
                {tool.enabled ? '✓' : '✗'}
              </Text>
              <Text> {tool.name}</Text>
              <Text dimColor> - {tool.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
      
      <Box marginTop={1} borderStyle="single" paddingX={1}>
        <Text dimColor>Press Ctrl+T to close</Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default ToolPanel;
