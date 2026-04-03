/**
 * Main App Component
 *
 * Root Ink component with full Claude Code experience:
 * - Streaming LLM output (token-by-token)
 * - Permission prompts for tool execution
 * - Real-time tool execution display with spinners
 * - Slash command system (/help, /clear, /model, etc.)
 * - Welcome screen and provider switching panel
 * - Markdown rendering and inline diff display
 * - Multi-line input with autocomplete
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, useApp, useInput, useStdout, Text } from 'ink';
import { randomUUID } from 'crypto';
import type { ConfigManager } from '@config/index';
import type { Logger } from '@utils/logger';
import type { AgentLoop } from '@core/AgentLoop';
import type { Message } from '../types/index.js';

// UI Components
import { ChatInput } from './components/input';
import { MessageList } from './components/messages';
import { StatusBar } from './components/status';
import { ToolPanel } from './components/tools';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProviderPanel, DEFAULT_PROVIDERS } from './components/ProviderPanel';
import { PermissionPrompt } from './components/PermissionPrompt';
import type { PermissionRequest, PermissionDecision } from './components/PermissionPrompt';
import type { ProviderOption } from './components/ProviderPanel';
import type { ToolExecutionInfo } from './components/ToolExecution';

// Hooks
import { useMessages } from './hooks/use-messages';
import { useSession } from './hooks/use-session';
import { useCommands } from './hooks/use-commands';
import type { CommandAction } from './hooks/use-commands';

// ============================================================================
// Props
// ============================================================================

interface AppProps {
  initialPrompt?: string;
  workingDirectory: string;
  config: ConfigManager;
  logger: Logger;
  agent?: AgentLoop;
}

// ============================================================================
// Helpers
// ============================================================================

// ============================================================================
// Helpers
// ============================================================================

function makeMsg(role: string, content: string): Message {
  return {
    id: randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    metadata: {},
  } as Message;
}

function detectProviders(config: ConfigManager): ProviderOption[] {
  const currentProvider = (config.get('model.provider') as string) || 'anthropic';
  const currentModel = (config.get('model.name') as string) || '';

  return DEFAULT_PROVIDERS.map(p => {
    const envKey = process.env[p.apiKeyEnv];
    const isConfigured = !!envKey || (currentProvider === p.id && !!(config.get('model.apiKey') as string));
    return {
      ...p,
      configured: isConfigured,
      currentModel: currentProvider === p.id && currentModel ? currentModel : p.currentModel,
    };
  });
}

// ============================================================================
// App Component
// ============================================================================

export function App({ initialPrompt, workingDirectory, config, logger, agent }: AppProps): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // ── Core State ──────────────────────────────────────────────────────────
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showProviderPanel, setShowProviderPanel] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [tokenCount, setTokenCount] = useState(0);
  const [totalCost] = useState(0);
  const [activeProvider, setActiveProvider] = useState(
    (config.get('model.provider') as string) || 'anthropic'
  );
  const [activeModel, setActiveModel] = useState(
    (config.get('model.name') as string) || 'claude-sonnet-4-20250514'
  );

  // ── Streaming State ─────────────────────────────────────────────────────
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // ── Tool Execution State ────────────────────────────────────────────────
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionInfo[]>([]);

  // ── Permission State ────────────────────────────────────────────────────
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const permissionResolverRef = useRef<((decision: PermissionDecision) => void) | null>(null);

  // ── Hooks ───────────────────────────────────────────────────────────────
  const { messages, addMessage, clearMessages } = useMessages();
  const { session, createSession } = useSession(workingDirectory);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows);
  const [, setTerminalWidth] = useState(stdout.columns);
  const [providers, setProviders] = useState<ProviderOption[]>(() => detectProviders(config));

  // ── Command Handler ─────────────────────────────────────────────────────
  const handleCommandAction = useCallback((action: CommandAction) => {
    switch (action.type) {
      case 'clear':
        clearMessages();
        break;
      case 'exit':
        exit();
        break;
      case 'toggle_tools':
        setShowTools(prev => !prev);
        break;
      case 'switch_model':
        setActiveModel(action.model);
        config.set('model.name', action.model);
        addMessage(makeMsg('system', `Model switched to ${action.model}`));
        break;
      case 'switch_provider':
        setActiveProvider(action.provider);
        config.set('model.provider', action.provider);
        addMessage(makeMsg('system', `Provider switched to ${action.provider}`));
        break;
      case 'compact':
        addMessage(makeMsg('system', 'Context compression triggered.'));
        break;
      case 'show_help':
        const helpText = action.commands
          .map(c => `  /${c.name}${c.args ? ' ' + c.args : ''} — ${c.description}`)
          .join('\n');
        addMessage(makeMsg('system', `Available commands:\n${helpText}`));
        break;
      case 'message':
        addMessage(makeMsg('system', action.text));
        break;
      case 'debug_toggle':
        addMessage(makeMsg('system', 'Debug mode toggled.'));
        break;
      default:
        break;
    }
  }, [clearMessages, exit, config, addMessage]);

  const { commandDefs, executeCommand, isSlashCommand } = useCommands({
    onAction: handleCommandAction,
    activeProvider,
    activeModel,
    messageCount: messages.length,
    tokenCount,
  });

  // ── Initialize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setStatus('Initializing...');
        await createSession('New Session');

        if (initialPrompt) {
          setShowWelcome(false);
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

    const handleResize = () => {
      setTerminalHeight(stdout.rows);
      setTerminalWidth(stdout.columns);
    };

    stdout.on('resize', handleResize);
    return () => { stdout.off('resize', handleResize); };
  }, []);

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────
  useInput((input, key) => {
    if (showWelcome && !showProviderPanel) {
      setShowWelcome(false);
      return;
    }

    if (key.ctrl && input === 'l') clearMessages();
    if (key.ctrl && input === 't') setShowTools(prev => !prev);
    if (key.ctrl && input === 'p') setShowProviderPanel(prev => !prev);
    // Use Ctrl+Q to exit (Escape conflicts with input/autocomplete)
    if (key.ctrl && input === 'q') exit();
  });

  // ── Provider Switch ─────────────────────────────────────────────────────
  const handleProviderSwitch = useCallback((providerId: string, model: string) => {
    setActiveProvider(providerId);
    setActiveModel(model);
    config.set('model.provider', providerId);
    config.set('model.name', model);
    setProviders(prev => prev.map(p => ({
      ...p,
      currentModel: p.id === providerId ? model : p.currentModel,
    })));
    logger.info(`Switched to ${providerId} / ${model}`);
    addMessage(makeMsg('system', `Switched to ${providerId} / ${model}`));
  }, [config, logger, addMessage]);

  // ── Permission Handler ──────────────────────────────────────────────────
  const handlePermissionDecision = useCallback((decision: PermissionDecision) => {
    if (permissionResolverRef.current) {
      permissionResolverRef.current(decision);
      permissionResolverRef.current = null;
    }
    setPendingPermission(null);
  }, []);

  // ── Submit Handler (Streaming + Tool Execution) ─────────────────────────
  const handleSubmit = useCallback(async (input: string) => {
    if (!input.trim() || isProcessing) return;
    if (showWelcome) setShowWelcome(false);

    // Check for slash commands first
    if (isSlashCommand(input)) {
      const result = executeCommand(input);
      if (result) {
        if (!result.success && result.output) {
          addMessage(makeMsg('system', result.output));
        }
        return;
      }
    }

    setIsProcessing(true);
    setIsStreaming(false);
    setStreamingText('');
    setToolExecutions([]);
    setStatus('Thinking...');

    // Add user message
    addMessage(makeMsg('user', input));

    try {
      if (agent) {
        // ── Try streaming mode first ──────────────────────────────────
        const hasStreamSupport = typeof agent.streamWithMessage === 'function';

        if (hasStreamSupport) {
          setIsStreaming(true);
          setStatus('Streaming...');

          let accumulatedText = '';
          // Build streaming callbacks
          const streamCallbacks = {
            onToken: (token: string) => {
              accumulatedText += token;
              setStreamingText(accumulatedText);
            },
            onToolUse: (toolMsg: any) => {
              const execId = randomUUID();
              const exec: ToolExecutionInfo = {
                id: execId,
                toolName: toolMsg.toolName || toolMsg.name || 'unknown',
                params: toolMsg.toolInput || toolMsg.input || {},
                status: 'running',
                startTime: Date.now(),
              };
              setToolExecutions(prev => [...prev, exec]);
            },
            onComplete: (_msg: any) => {
              setIsStreaming(false);
              if (accumulatedText) {
                addMessage(makeMsg('assistant', accumulatedText));
              }
              setStreamingText('');
            },
            onError: (error: Error) => {
              setIsStreaming(false);
              setStreamingText('');
              addMessage(makeMsg('assistant', `Error: ${error.message}`));
              setStatus('Error');
            },
            onUsage: (usage: any) => {
              if (usage) {
                setTokenCount(prev => prev + (usage.totalTokens || usage.inputTokens + usage.outputTokens || 0));
              }
            },
          };

          // Build the user message for the agent
          const agentMessage = {
            id: randomUUID(),
            role: 'user' as const,
            content: input,
            timestamp: Date.now(),
            metadata: {},
          };

          try {
            const result = await agent.streamWithMessage(agentMessage, streamCallbacks);

            // Mark all tool executions as complete
            setToolExecutions(prev => prev.map(e => ({
              ...e,
              status: 'success' as const,
              endTime: Date.now(),
            })));

            setStatus(result?.success !== false ? 'Ready' : 'Error');
          } catch (streamError) {
            // Fallback: if streaming fails, show whatever we accumulated
            if (accumulatedText) {
              addMessage(makeMsg('assistant', accumulatedText));
            }
            setIsStreaming(false);
            setStreamingText('');
            throw streamError;
          }

        } else {
          // ── Fallback: non-streaming mode ────────────────────────────
          setStatus('Thinking...');

          const result = await agent.run(input);

          if (result && result.messages) {
            for (const msg of result.messages) {
              if ('role' in msg && msg.role === 'assistant' && 'content' in msg) {
                addMessage(makeMsg('assistant', typeof msg.content === 'string' ? msg.content : ''));
              }
            }
          }

          // Add tool call/result messages
          if (result && result.iterations) {
            for (const iteration of result.iterations) {
              if (iteration.toolResults) {
                for (const tr of iteration.toolResults) {
                  const exec: ToolExecutionInfo = {
                    id: randomUUID(),
                    toolName: tr.toolName || 'tool',
                    params: {},
                    status: tr.success ? 'success' : 'error',
                    startTime: Date.now() - (iteration.duration || 0),
                    endTime: Date.now(),
                    result: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
                    error: tr.error,
                  };
                  setToolExecutions(prev => [...prev, exec]);
                }
              }
            }
          }

          if (result && result.totalTokenUsage) {
            setTokenCount(prev => prev + (result.totalTokenUsage.totalTokens || 0));
          }

          setStatus(result?.success ? 'Ready' : 'Error');
        }

      } else {
        // No agent configured
        addMessage(makeMsg('assistant', 'No agent configured. Set your API key with `/provider` or run `bun run setup`.'));
        setStatus('Ready');
      }
    } catch (error) {
      logger.error('Error processing message', error as Error);
      addMessage(makeMsg('assistant', `Error: ${error instanceof Error ? error.message : String(error)}`));
      setStatus('Error');
    } finally {
      setIsProcessing(false);
      setIsStreaming(false);
    }
  }, [isProcessing, showWelcome, addMessage, logger, agent, isSlashCommand, executeCommand]);

  // ── Wire agent permission callback ──────────────────────────────────────
  useEffect(() => {
    if (!agent) return;

    // Access events via type assertion (UI layer integration)
    const agentAny = agent as any;
    if (!agentAny.events) return;

    const originalOnPermissionRequest = agentAny.events.onPermissionRequest;
    agentAny.events.onPermissionRequest = async (toolName: string, params: Record<string, unknown>) => {
      return new Promise<boolean>((resolve) => {
        const request: PermissionRequest = {
          id: randomUUID(),
          toolName,
          params,
          isDangerous: /bash|shell|delete|remove|rm/i.test(toolName),
          isReadOnly: /read|view|list|search|grep|find/i.test(toolName),
        };

        setPendingPermission(request);

        permissionResolverRef.current = (decision: PermissionDecision) => {
          switch (decision) {
            case 'yes':
              resolve(true);
              break;
            case 'always':
              resolve(true);
              break;
            case 'no':
            case 'never':
              resolve(false);
              break;
          }
        };
      });
    };

    return () => {
      if (agentAny.events) {
        agentAny.events.onPermissionRequest = originalOnPermissionRequest;
      }
    };
  }, [agent]);

  // ── Layout Calculations ─────────────────────────────────────────────────
  const statusBarHeight = 1;
  const inputHeight = 3;
  const toolPanelWidth = showTools ? 40 : 0;
  const messagesHeight = terminalHeight - statusBarHeight - inputHeight;

  // ── Loading ─────────────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <Box flexDirection="column" height={terminalHeight} alignItems="center" justifyContent="center">
        <Text color="cyan">Initializing Claude Code Clone...</Text>
        <Text dimColor>Loading configuration and tools...</Text>
      </Box>
    );
  }

  // ── Welcome Screen ──────────────────────────────────────────────────────
  if (showWelcome) {
    const currentProviderInfo = providers.find(p => p.id === activeProvider) ?? providers[0];
    if (!currentProviderInfo) return <Box><Text>No providers</Text></Box>;
    return (
      <Box flexDirection="column" height={terminalHeight}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <WelcomeScreen
            version="1.0.0"
            provider={{
              name: currentProviderInfo.name,
              configured: currentProviderInfo.configured,
              model: activeModel,
            }}
            availableProviders={providers.map(p => ({
              name: p.name,
              configured: p.configured,
              model: p.currentModel,
            }))}
          />
        </Box>
      </Box>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Provider panel overlay */}
      {showProviderPanel && (
        <Box position="absolute" marginTop={2} marginLeft={4}>
          <ProviderPanel
            providers={providers}
            activeProviderId={activeProvider}
            onSelect={handleProviderSwitch}
            onClose={() => setShowProviderPanel(false)}
          />
        </Box>
      )}

      {/* Main content area */}
      <Box flexDirection="row" height={messagesHeight}>
        <Box flexGrow={1} flexDirection="column">
          <MessageList
            messages={messages}
            maxHeight={messagesHeight}
            showTimestamps={config.get('ui.showTimestamps') ?? false}
            compactMode={config.get('ui.compactMode') ?? false}
            streamingText={streamingText}
            isStreaming={isStreaming}
            toolExecutions={toolExecutions}
          />
        </Box>

        {showTools && (
          <Box width={toolPanelWidth} flexDirection="column" borderStyle="single">
            <ToolPanel />
          </Box>
        )}
      </Box>

      {/* Permission prompt (overlays input area when active) */}
      {pendingPermission ? (
        <Box flexDirection="column">
          <PermissionPrompt
            request={pendingPermission}
            onDecision={handlePermissionDecision}
          />
        </Box>
      ) : (
        /* Input area */
        <Box height={inputHeight} flexDirection="column" borderStyle="round" borderColor={isProcessing ? 'yellow' : isStreaming ? 'green' : 'cyan'}>
          <ChatInput
            onSubmit={handleSubmit}
            disabled={isProcessing}
            placeholder={
              isStreaming ? 'Streaming response...'
                : isProcessing ? 'Processing...'
                : 'Type a message or /help for commands...'
            }
            slashCommands={commandDefs}
          />
        </Box>
      )}

      {/* Status bar */}
      <Box height={statusBarHeight}>
        <StatusBar
          status={status}
          sessionName={session?.name}
          messageCount={messages.length}
          tokenCount={tokenCount}
          workingDirectory={workingDirectory}
          provider={activeProvider}
          model={activeModel}
          cost={totalCost}
        />
      </Box>
    </Box>
  );
}

export default App;
