/**
 * Main App Component
 * 
 * This is the root Ink component that orchestrates the terminal UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, useApp, useInput, useStdout } from 'ink';
import type { ConfigManager } from '@config/index';
import type { Logger } from '@utils/logger';
import type { IAgent } from '@core/interfaces';
import type { Message, Session } from '@types/index';

// UI Components
import { ChatInput } from './components/input';
import { MessageList } from './components/messages';
import { StatusBar } from './components/status';
import { ToolPanel } from './components/tools';

// Hooks
import { useMessages } from './hooks/use-messages';
import { useSession } from './hooks/use-session';

// ============================================================================
// Props
// ============================================================================

interface AppProps {
  initialPrompt?: string;
  workingDirectory: string;
  config: ConfigManager;
  logger: Logger;
}

// ============================================================================
// App Component
// ============================================================================

export function App({ initialPrompt, workingDirectory, config, logger }: AppProps): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  
  // State
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [status, setStatus] = useState('Ready');
  
  // Custom hooks
  const { messages, addMessage, clearMessages } = useMessages();
  const { session, createSession } = useSession(workingDirectory);
  
  // Terminal dimensions
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows);
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns);
  
  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setStatus('Initializing...');
        
        // Create initial session
        await createSession('New Session');
        
        // Handle initial prompt
        if (initialPrompt) {
          await handleSubmit(initialPrompt);
        }
        
        setIsReady(true);
        setStatus('Ready');
        
        logger.info('App initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize app', error as Error);
        setStatus('Error');
      }
    };
    
    init();
    
    // Handle resize
    const handleResize = () => {
      setTerminalHeight(stdout.rows);
      setTerminalWidth(stdout.columns);
    };
    
    stdout.on('resize', handleResize);
    
    return () => {
      stdout.off('resize', handleResize);
    };
  }, []);
  
  // Handle keyboard input
  useInput((input, key) => {
    // Ctrl+C is handled by Ink
    
    // Ctrl+L to clear screen
    if (key.ctrl && input === 'l') {
      clearMessages();
    }
    
    // Ctrl+T to toggle tool panel
    if (key.ctrl && input === 't') {
      setShowTools(prev => !prev);
    }
    
    // Escape to exit
    if (key.escape) {
      exit();
    }
  });
  
  // Handle user input submission
  const handleSubmit = useCallback(async (input: string) => {
    if (!input.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setStatus('Thinking...');
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    addMessage(userMessage);
    
    try {
      // TODO: Send to query engine and get response
      // This is a placeholder for the actual implementation
      await simulateResponse(input);
      
      setStatus('Ready');
    } catch (error) {
      logger.error('Error processing message', error as Error);
      
      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, addMessage, logger]);
  
  // Simulate response (placeholder)
  const simulateResponse = async (input: string): Promise<void> => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const responseMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `I received your message: "${input}"\n\n(This is a placeholder response. The actual query engine integration will be implemented in the query-engine module.)`,
      timestamp: Date.now(),
    };
    addMessage(responseMessage);
  };
  
  // Calculate layout
  const statusBarHeight = 1;
  const inputHeight = 3;
  const toolPanelWidth = showTools ? 40 : 0;
  const messagesHeight = terminalHeight - statusBarHeight - inputHeight;
  
  if (!isReady) {
    return (
      <Box flexDirection="column" height={terminalHeight}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          Initializing Claude Code Clone...
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Main content area */}
      <Box flexDirection="row" height={messagesHeight}>
        {/* Messages */}
        <Box flexGrow={1} flexDirection="column">
          <MessageList
            messages={messages}
            maxHeight={messagesHeight}
            showTimestamps={config.get('ui.showTimestamps') ?? false}
            compactMode={config.get('ui.compactMode') ?? false}
          />
        </Box>
        
        {/* Tool panel (optional) */}
        {showTools && (
          <Box width={toolPanelWidth} flexDirection="column" borderStyle="single">
            <ToolPanel />
          </Box>
        )}
      </Box>
      
      {/* Input area */}
      <Box height={inputHeight} flexDirection="column" borderStyle="single" borderTop>
        <ChatInput
          onSubmit={handleSubmit}
          disabled={isProcessing}
          placeholder={isProcessing ? 'Processing...' : 'Type a message...'}
        />
      </Box>
      
      {/* Status bar */}
      <Box height={statusBarHeight}>
        <StatusBar
          status={status}
          sessionName={session?.name}
          messageCount={messages.length}
          tokenCount={0} // TODO: Calculate actual token count
          workingDirectory={workingDirectory}
        />
      </Box>
    </Box>
  );
}

export default App;
