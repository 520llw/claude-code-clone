# Claude Code Hooks System - Development Guide

This guide explains how to create, register, and use hooks in the Claude Code clone hooks system.

## Table of Contents

- [Overview](#overview)
- [Hook Types](#hook-types)
- [Creating Hooks](#creating-hooks)
- [Registering Hooks](#registering-hooks)
- [Hook Context](#hook-context)
- [Built-in Hooks](#built-in-hooks)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [API Reference](#api-reference)

## Overview

The hooks system allows you to extend and customize the behavior of the Claude Code agent at specific points in its lifecycle. Hooks can:

- Execute code before/after commands
- Intercept and modify tool calls
- Handle errors and implement retry logic
- Process and transform LLM responses
- Collect metrics and logs

## Hook Types

### 1. Pre-Command Hooks

Execute before a command is run. Can validate, transform, or cancel commands.

```typescript
import { createPreCommandHook } from '../src/hooks';

const myHook = createPreCommandHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    // Your logic here
    return context;
  }
);
```

### 2. Post-Command Hooks

Execute after a command completes. Can log results, collect metrics, or clean up.

```typescript
import { createPostCommandHook } from '../src/hooks';

const myHook = createPostCommandHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    console.log(`Command completed in ${context.durationMs}ms`);
    return context;
  }
);
```

### 3. Pre-Tool Hooks

Execute before a tool is called. Can validate, rate limit, or skip tool calls.

```typescript
import { createPreToolHook } from '../src/hooks';

const myHook = createPreToolHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    // Rate limiting example
    if (shouldSkipTool(context.toolCall)) {
      context.skipTool = true;
    }
    return context;
  }
);
```

### 4. Post-Tool Hooks

Execute after a tool call completes. Can cache results, log output, or process data.

```typescript
import { createPostToolHook } from '../src/hooks';

const myHook = createPostToolHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    if (context.success) {
      cacheResult(context.toolCall, context.result);
    }
    return context;
  }
);
```

### 5. Error Hooks

Execute when errors occur. Can implement retry logic, logging, or fallback behavior.

```typescript
import { createErrorHook } from '../src/hooks';

const myHook = createErrorHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    if (context.retryCount < context.maxRetries) {
      context.recoveryAction = 'retry';
      context.handled = true;
    }
    return context;
  },
  ['NetworkError', 'TimeoutError'] // Error types to handle
);
```

### 6. Response Hooks

Execute when LLM responses are received. Can parse, validate, or transform responses.

```typescript
import { createResponseHook } from '../src/hooks';

const myHook = createResponseHook(
  'my-hook-id',
  'My Hook Name',
  async (context) => {
    // Parse JSON response
    try {
      context.parsedContent = JSON.parse(context.response.content);
    } catch {
      // Not JSON
    }
    return context;
  }
);
```

## Creating Hooks

### Basic Hook

```typescript
import { createHook, HookPriority, HookPhase } from '../src/hooks';

const myHook = createHook(
  'my-unique-id',
  'My Hook Name',
  'pre-command', // hook type
  async (context) => {
    // Hook logic
    console.log('Hook executed!');
    return context;
  },
  {
    priority: HookPriority.NORMAL,
    phase: HookPhase.BEFORE,
    description: 'My custom hook'
  }
);
```

### Conditional Hook

```typescript
import { conditionalHook } from '../src/hooks';

const conditionalHook = conditionalHook(
  (context) => context.agentContext.debug === true,
  async (context) => {
    // Only executes in debug mode
    console.log('Debug info:', context);
    return context;
  }
);
```

### Composed Hook

```typescript
import { composeHooks } from '../src/hooks';

const composed = composeHooks([
  async (ctx) => { /* step 1 */ return ctx; },
  async (ctx) => { /* step 2 */ return ctx; },
  async (ctx) => { /* step 3 */ return ctx; }
]);
```

### Hook with Retry

```typescript
import { withRetry } from '../src/hooks';

const retryableHandler = withRetry(
  async (context) => {
    // Might throw error
    await riskyOperation();
    return context;
  },
  3, // max retries
  1000 // delay between retries
);
```

### Hook with Timeout

```typescript
import { withTimeout } from '../src/hooks';

const timedHandler = withTimeout(
  async (context) => {
    // Must complete within timeout
    await slowOperation();
    return context;
  },
  5000 // 5 second timeout
);
```

## Registering Hooks

### Using HooksManager

```typescript
import { getHooksManager } from '../src/hooks';

const manager = getHooksManager();
await manager.initialize();

// Register a hook
manager.register(myHook);

// Register with options
manager.register(myHook, { 
  override: true,
  config: { customOption: true }
});

// Unregister
manager.unregister('my-hook-id');

// Enable/Disable
manager.getRegistry().enable('my-hook-id');
manager.getRegistry().disable('my-hook-id');
```

### Using HookRegistry Directly

```typescript
import { HookRegistry } from '../src/hooks';

const registry = new HookRegistry();

registry.register(myHook);

// Get hooks by type
const preCommandHooks = registry.getByType('pre-command');

// Get hooks by tag
const loggingHooks = registry.getByTag('logger');
```

### Using HookEngine

```typescript
import { HookEngine } from '../src/hooks';

const engine = new HookEngine();
await engine.initialize();

// Execute hooks for a type
const result = await engine.executeHooks(
  'pre-command',
  preCommandContext
);
```

## Hook Context

### PreCommandContext

```typescript
interface PreCommandContext {
  executionId: string;
  command: Command;
  skipCommand: boolean;
  modifiedCommand?: Command;
  validationErrors: string[];
  cancel: boolean;
  cancelReason?: string;
  // ... more fields
}
```

### PostCommandContext

```typescript
interface PostCommandContext {
  command: Command;
  result: CommandResult;
  durationMs: number;
  success: boolean;
  error?: Error;
  modifiedResult?: CommandResult;
  // ... more fields
}
```

### PreToolContext

```typescript
interface PreToolContext {
  toolCall: ToolCall;
  skipTool: boolean;
  modifiedToolCall?: ToolCall;
  validationErrors: string[];
  // ... more fields
}
```

### PostToolContext

```typescript
interface PostToolContext {
  toolCall: ToolCall;
  result: ToolResult;
  durationMs: number;
  success: boolean;
  // ... more fields
}
```

### ErrorContext

```typescript
interface ErrorContext {
  error: Error;
  source: 'command' | 'tool' | 'llm' | 'agent' | 'system';
  handled: boolean;
  recoveryAction?: 'retry' | 'skip' | 'abort' | 'fallback';
  retryCount: number;
  maxRetries: number;
  // ... more fields
}
```

### ResponseContext

```typescript
interface ResponseContext {
  response: Response;
  processResponse: boolean;
  modifiedResponse?: Response;
  parsedContent?: unknown;
  // ... more fields
}
```

## Built-in Hooks

### Pre-Command Built-ins

```typescript
import {
  createPreCommandLogger,
  createPreCommandValidator,
  createPreCommandTransformer,
  createPreCommandPermissionCheck,
  createPreCommandRateLimiter,
  createPreCommandAudit
} from '../src/hooks';

// Logger
const logger = createPreCommandLogger('info', true);

// Validator
const validator = createPreCommandValidator([
  (cmd) => ({ valid: cmd.name.length > 0, error: 'Name required' })
]);

// Rate Limiter
const rateLimiter = createPreCommandRateLimiter(10, 60000); // 10 per minute
```

### Post-Command Built-ins

```typescript
import {
  createPostCommandLogger,
  createPostCommandHistoryTracker,
  createPostCommandNotifier,
  createPostCommandMetricsCollector
} from '../src/hooks';

// Notifier
const notifier = createPostCommandNotifier(
  (cmd, result) => console.log('Success!'),
  (cmd, error) => console.error('Failed:', error)
);
```

### Pre-Tool Built-ins

```typescript
import {
  createPreToolLogger,
  createPreToolRateLimiter,
  createPreToolAccessControl,
  createPreToolParameterSanitizer
} from '../src/hooks';

// Access Control
const accessControl = createPreToolAccessControl(
  ['allowed-tool-1', 'allowed-tool-2'], // whitelist
  ['blocked-tool'] // blacklist
);

// Sanitizer
const sanitizer = createPreToolParameterSanitizer(params => {
  delete params.password;
  delete params.token;
  return params;
});
```

### Error Built-ins

```typescript
import {
  createErrorLogger,
  createErrorRetryHandler,
  createErrorCircuitBreaker
} from '../src/hooks';

// Circuit Breaker
const circuitBreaker = createErrorCircuitBreaker(5, 60000); // 5 failures, 1 min reset
```

## Best Practices

### 1. Hook IDs

Use unique, descriptive IDs with namespaces:

```typescript
// Good
'company.feature.hook-name'
'my-plugin.validator'

// Bad
'hook1'
'validator'
```

### 2. Priorities

Use appropriate priorities:

```typescript
HookPriority.CRITICAL    // 0   - Logging, security
HookPriority.HIGH        // 10  - Validation, rate limiting
HookPriority.NORMAL      // 50  - Default
HookPriority.LOW         // 100 - Metrics, analytics
HookPriority.BACKGROUND  // 200 - Non-essential
```

### 3. Error Handling

Always handle errors gracefully:

```typescript
const myHook = createPreCommandHook(
  'my-hook',
  'My Hook',
  async (context) => {
    try {
      await riskyOperation();
    } catch (error) {
      // Log but don't throw to avoid breaking the chain
      console.error('Hook error:', error);
    }
    return context;
  }
);
```

### 4. Cancellation

Respect cancellation signals:

```typescript
const myHook = async (context) => {
  if (context.cancel) {
    return context; // Skip processing
  }
  // Continue processing
  return context;
};
```

### 5. Context Modification

Modify context appropriately:

```typescript
// Pre-hooks: set modifiedXxx fields
context.modifiedCommand = transformedCommand;

// Post-hooks: set modifiedResult fields
context.modifiedResult = processedResult;

// Error hooks: set recoveryAction
context.recoveryAction = 'retry';
context.handled = true;
```

## Examples

### Complete Example: Request Logging

```typescript
import { 
  getHooksManager,
  createPreCommandHook,
  createPostCommandHook 
} from '../src/hooks';

async function setupLogging() {
  const manager = getHooksManager();
  await manager.initialize();

  // Pre-command logging
  manager.register(createPreCommandHook(
    'logging.pre-command',
    'Pre-Command Logger',
    async (context) => {
      console.log(`[Request] ${context.command.name} started`);
      return context;
    }
  ));

  // Post-command logging
  manager.register(createPostCommandHook(
    'logging.post-command',
    'Post-Command Logger',
    async (context) => {
      const status = context.success ? 'SUCCESS' : 'FAILED';
      console.log(`[Request] ${context.command.name} ${status} (${context.durationMs}ms)`);
      return context;
    }
  ));
}
```

### Complete Example: Rate Limiting

```typescript
import { createPreToolHook, HookPriority } from '../src/hooks';

const rateLimiter = createPreToolHook(
  'rate-limiter',
  'API Rate Limiter',
  async (context) => {
    const toolName = context.toolCall.name;
    const calls = getCallCount(toolName);
    
    if (calls >= 100) {
      context.skipTool = true;
      context.validationErrors.push('Rate limit exceeded');
    } else {
      incrementCallCount(toolName);
    }
    
    return context;
  },
  {
    priority: HookPriority.HIGH
  }
);
```

### Complete Example: Response Caching

```typescript
import { createResponseHook } from '../src/hooks';

const cache = new Map();

const responseCache = createResponseHook(
  'response-cache',
  'Response Cache',
  async (context) => {
    const key = generateCacheKey(context.response);
    
    // Store in cache
    cache.set(key, {
      response: context.response,
      timestamp: Date.now()
    });
    
    return context;
  }
);
```

## API Reference

### Core Functions

- `createHook()` - Create a custom hook
- `createPreCommandHook()` - Create a pre-command hook
- `createPostCommandHook()` - Create a post-command hook
- `createPreToolHook()` - Create a pre-tool hook
- `createPostToolHook()` - Create a post-tool hook
- `createErrorHook()` - Create an error hook
- `createResponseHook()` - Create a response hook

### Utility Functions

- `composeHooks()` - Compose multiple handlers
- `conditionalHook()` - Conditionally execute a hook
- `withRetry()` - Add retry logic
- `withTimeout()` - Add timeout
- `withLogging()` - Add logging

### Classes

- `HooksManager` - High-level hook management
- `HookRegistry` - Hook registration and storage
- `HookEngine` - Hook execution engine
- `HookRunner` - Hook runner with advanced features

### Types

- `HookContext` - Base context type
- `PreCommandContext` - Pre-command context
- `PostCommandContext` - Post-command context
- `PreToolContext` - Pre-tool context
- `PostToolContext` - Post-tool context
- `ErrorContext` - Error context
- `ResponseContext` - Response context

## License

MIT
