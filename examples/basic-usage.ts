/**
 * Basic Usage Example for Claude Code Clone
 * 
 * This example demonstrates how to use the core modules
 * to build a simple AI agent.
 */

import {
  AgentLoop,
  QueryEngine,
  ContextManager,
  SessionManager,
  PermissionManager,
  TokenTracker,
  createAgentLoop,
  createQueryEngine,
  createContextManager,
  createSessionManager,
  createPermissionManager,
} from '../src/core/index.js';

import {
  Tool,
  ToolDefinition,
  ToolContext,
  ToolResult,
  LLMConfig,
} from '../src/types/index.js';

// ============================================================================
// Example Tool Definitions
// ============================================================================

/**
 * Example read file tool
 */
const ReadFileTool: Tool = {
  definition: {
    name: 'ReadFile',
    description: 'Read the contents of a file',
    category: 'file_system',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to read',
        required: true,
      },
    ],
    permissionLevel: 'always_allow',
    readOnly: true,
    dangerous: false,
  },
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.resolve(context.workingDirectory, params.path as string);
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        toolCallId: '',
        success: true,
        output: content,
        metadata: { path: filePath },
      };
    } catch (error) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: error as Error,
      };
    }
  },
};

/**
 * Example write file tool
 */
const WriteFileTool: Tool = {
  definition: {
    name: 'WriteFile',
    description: 'Write content to a file',
    category: 'file_system',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to write',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write to the file',
        required: true,
      },
    ],
    permissionLevel: 'ask_every_time',
    readOnly: false,
    dangerous: false,
  },
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.resolve(context.workingDirectory, params.path as string);
      await fs.writeFile(filePath, params.content as string, 'utf-8');
      
      return {
        toolCallId: '',
        success: true,
        output: `File written successfully: ${filePath}`,
        metadata: { path: filePath },
      };
    } catch (error) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: error as Error,
      };
    }
  },
};

/**
 * Example bash tool
 */
const BashTool: Tool = {
  definition: {
    name: 'Bash',
    description: 'Execute a bash command',
    category: 'shell',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'The bash command to execute',
        required: true,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Timeout in milliseconds',
        required: false,
        default: 60000,
      },
    ],
    permissionLevel: 'ask_every_time',
    readOnly: false,
    dangerous: true,
    timeout: 60000,
  },
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);
      
      const { stdout, stderr } = await execAsync(params.command as string, {
        cwd: context.workingDirectory,
        timeout: (params.timeout as number) || 60000,
      });
      
      return {
        toolCallId: '',
        success: true,
        output: stdout || stderr,
        metadata: { command: params.command },
      };
    } catch (error) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: error as Error,
      };
    }
  },
};

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  // Configure LLM
  const llmConfig: LLMConfig = {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7,
  };

  // Create tools array
  const tools: Tool[] = [ReadFileTool, WriteFileTool, BashTool];

  // Create agent
  const agent = createAgentLoop({
    llmConfig,
    tools,
    systemPrompt: `You are Claude Code, an AI assistant for software development.
You have access to tools for file operations and shell commands.
Always think step by step and explain your reasoning.`,
    agentConfig: {
      maxIterations: 50,
      timeout: 300000,
      autoApprove: false,
      streamResponses: true,
    },
    events: {
      onStateChange: (state) => {
        console.log(`[Agent] State: ${state}`);
      },
      onMessage: (message) => {
        if (message.type === 'text') {
          console.log(`[${message.role}] ${message.content.substring(0, 100)}...`);
        } else if (message.type === 'tool_use') {
          console.log(`[Tool] ${message.toolName}`);
        }
      },
      onToolCall: (toolCall) => {
        console.log(`[Tool Call] ${toolCall.toolName}`);
      },
      onToolResult: (toolResult) => {
        console.log(`[Tool Result] Success: ${toolResult.success}`);
      },
      onComplete: (result) => {
        console.log(`[Complete] Success: ${result.success}`);
        console.log(`[Tokens] ${JSON.stringify(result.totalTokenUsage)}`);
      },
      onError: (error) => {
        console.error(`[Error] ${error.message}`);
      },
    },
  });

  // Initialize agent
  await agent.initialize();

  // Run agent with user input
  console.log('=== Running Agent ===');
  const result = await agent.run('List all files in the current directory');

  console.log('\n=== Result ===');
  console.log(`Success: ${result.success}`);
  console.log(`Iterations: ${result.iterations.length}`);
  console.log(`Total Tokens: ${result.totalTokenUsage.totalTokens}`);
  console.log(`Duration: ${result.totalDuration}ms`);

  // Dispose agent
  await agent.dispose();
}

// Run example if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main };
