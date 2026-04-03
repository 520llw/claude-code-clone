# Hook Development Guide

Guide to creating and using hooks in Claude Code Clone.

## Table of Contents

1. [What are Hooks?](#what-are-hooks)
2. [Hook System Overview](#hook-system-overview)
3. [Available Hook Events](#available-hook-events)
4. [Creating Hooks](#creating-hooks)
5. [Hook Context](#hook-context)
6. [Hook Patterns](#hook-patterns)
7. [Advanced Hook Usage](#advanced-hook-usage)
8. [Hook Best Practices](#hook-best-practices)
9. [Hook Examples](#hook-examples)
10. [Debugging Hooks](#debugging-hooks)

## What are Hooks?

Hooks are extension points that allow you to execute custom code at specific moments in Claude Code Clone's lifecycle. They enable you to:

- **Monitor operations**: Log actions and track usage
- **Validate changes**: Enforce rules before operations
- **Transform data**: Modify inputs or outputs
- **Integrate systems**: Connect to external services
- **Customize behavior**: Extend functionality

### Hook vs Plugin

| Aspect | Hook | Plugin |
|--------|------|--------|
| Scope | Single event | Multiple components |
| Purpose | Extend specific behavior | Add new capabilities |
| Complexity | Simple | Can be complex |
| Use Case | Validation, logging | Tools, skills, commands |

## Hook System Overview

### Hook Architecture

```
Request/Operation
      │
      ├──► before-[event] hooks
      │         │
      │         ├──► Hook 1 (priority 100)
      │         ├──► Hook 2 (priority 50)
      │         └──► Hook 3 (priority 10)
      │
      ├──► Execute Operation
      │
      └──► after-[event] hooks
                │
                ├──► Hook 1 (priority 100)
                ├──► Hook 2 (priority 50)
                └──► Hook 3 (priority 10)
```

### Hook Execution Order

Hooks execute by priority (higher first):

```typescript
// Priority 100: Validation hooks (run first)
// Priority 50:  Transformation hooks (run second)
// Priority 10:  Logging hooks (run last)
```

## Available Hook Events

### Request Lifecycle

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `before-request` | Before AI request | Yes |
| `after-request` | After AI response | No |
| `before-stream` | Before streaming starts | Yes |
| `after-stream` | After streaming ends | No |

### Tool Execution

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `before-tool` | Before tool execution | Yes |
| `after-tool` | After tool execution | No |
| `tool-error` | On tool error | No |

### File Operations

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `before-read` | Before reading file | Yes |
| `after-read` | After reading file | No |
| `before-write` | Before writing file | Yes |
| `after-write` | After writing file | No |
| `before-edit` | Before editing file | Yes |
| `after-edit` | After editing file | No |

### Session Lifecycle

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `session-start` | When session starts | No |
| `session-end` | When session ends | No |
| `session-save` | When session is saved | Yes |
| `session-load` | When session is loaded | Yes |

### Command Execution

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `before-command` | Before command execution | Yes |
| `after-command` | After command execution | No |
| `command-error` | On command error | No |

### Error Handling

| Event | When Fired | Can Cancel |
|-------|------------|------------|
| `error` | On any error | No |
| `unhandled-error` | On unhandled error | No |

## Creating Hooks

### Basic Hook

```typescript
// hooks/logging-hook.ts
import { Hook, HookContext } from '@claude-code-clone/sdk';

export const loggingHook: Hook = {
  name: 'logging-hook',
  event: 'before-tool',
  priority: 100,
  
  async execute(context: HookContext) {
    const { tool, params } = context;
    
    console.log(`[LOG] Executing tool: ${tool.name}`);
    console.log(`[LOG] Parameters:`, params);
    console.log(`[LOG] Timestamp:`, new Date().toISOString());
  }
};
```

### Hook with State

```typescript
// hooks/metrics-hook.ts
import { Hook, HookContext } from '@claude-code-clone/sdk';

class MetricsHook implements Hook {
  name = 'metrics-hook';
  event = 'after-tool';
  priority = 50;
  
  private metrics = {
    toolCalls: 0,
    totalDuration: 0,
    errors: 0
  };
  
  async execute(context: HookContext) {
    const { tool, result, duration } = context;
    
    this.metrics.toolCalls++;
    this.metrics.totalDuration += duration;
    
    if (!result.success) {
      this.metrics.errors++;
    }
    
    // Log metrics periodically
    if (this.metrics.toolCalls % 10 === 0) {
      this.logMetrics();
    }
  }
  
  private logMetrics() {
    const avgDuration = this.metrics.totalDuration / this.metrics.toolCalls;
    
    console.log('[METRICS] Tool Usage:');
    console.log(`  Calls: ${this.metrics.toolCalls}`);
    console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`  Errors: ${this.metrics.errors}`);
  }
}

export const metricsHook = new MetricsHook();
```

### Cancelable Hook

```typescript
// hooks/validation-hook.ts
import { Hook, HookContext } from '@claude-code-clone/sdk';

export const validationHook: Hook = {
  name: 'validation-hook',
  event: 'before-write',
  priority: 200, // High priority to run first
  
  async execute(context: HookContext) {
    const { file, content } = context;
    
    // Validate file path
    if (file.includes('..')) {
      throw new Error('Path traversal detected');
    }
    
    // Validate content size
    const maxSize = 1024 * 1024; // 1MB
    if (content.length > maxSize) {
      throw new Error(`File too large: ${content.length} bytes`);
    }
    
    // Validate content (example: no secrets)
    const secretsPattern = /(password|secret|key)\s*=\s*["'][^"']+["']/i;
    if (secretsPattern.test(content)) {
      throw new Error('Potential secret detected in file');
    }
    
    // Validation passed - operation continues
  }
};
```

## Hook Context

### Context Structure

```typescript
interface HookContext {
  // Event information
  event: string;
  timestamp: Date;
  
  // Operation data (varies by event)
  operation?: string;
  
  // Request/Response (for AI events)
  request?: Request;
  response?: Response;
  
  // Tool data (for tool events)
  tool?: Tool;
  params?: object;
  result?: Result;
  
  // File data (for file events)
  file?: string;
  content?: string;
  changes?: FileChange[];
  
  // Command data (for command events)
  command?: Command;
  args?: string[];
  
  // Session data (for session events)
  session?: Session;
  
  // Error data (for error events)
  error?: Error;
  
  // Timing
  duration?: number;
  startTime?: number;
  
  // Utilities
  logger: Logger;
  config: ConfigManager;
}
```

### Context by Event Type

```typescript
// before-request / after-request
interface RequestContext extends HookContext {
  request: {
    messages: Message[];
    model: string;
    tools?: Tool[];
  };
  response?: {
    content: string;
    toolCalls?: ToolCall[];
    usage: TokenUsage;
  };
}

// before-tool / after-tool
interface ToolContext extends HookContext {
  tool: {
    name: string;
    description: string;
  };
  params: object;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };
  duration: number;
}

// before-write / after-write
interface FileContext extends HookContext {
  file: string;
  content: string;
  encoding?: string;
}

// before-edit / after-edit
interface EditContext extends HookContext {
  file: string;
  changes: Array<{
    oldString: string;
    newString: string;
  }>;
}
```

## Hook Patterns

### Logging Pattern

```typescript
// hooks/comprehensive-logger.ts
export const comprehensiveLogger: Hook = {
  name: 'comprehensive-logger',
  
  // Multiple events
  events: ['before-tool', 'after-tool', 'error'],
  priority: 10,
  
  async execute(context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: context.event,
      sessionId: context.session?.id,
      data: this.extractData(context)
    };
    
    // Write to log file
    await appendFile(
      'claude-code-clone.log',
      JSON.stringify(logEntry) + '\n'
    );
  },
  
  extractData(context: HookContext) {
    switch (context.event) {
      case 'before-tool':
        return { tool: context.tool?.name, params: context.params };
      case 'after-tool':
        return { tool: context.tool?.name, duration: context.duration };
      case 'error':
        return { error: context.error?.message };
      default:
        return {};
    }
  }
};
```

### Validation Pattern

```typescript
// hooks/multi-validator.ts
export const multiValidator: Hook = {
  name: 'multi-validator',
  event: 'before-edit',
  priority: 150,
  
  async execute(context) {
    const validators = [
      this.validatePath,
      this.validateSize,
      this.validateContent,
      this.validatePermissions
    ];
    
    for (const validator of validators) {
      await validator(context);
    }
  },
  
  validatePath(context: HookContext) {
    const { file } = context;
    
    // Check for path traversal
    const resolved = path.resolve(file);
    const cwd = process.cwd();
    
    if (!resolved.startsWith(cwd)) {
      throw new Error(`File outside project: ${file}`);
    }
  },
  
  validateSize(context: HookContext) {
    const { changes } = context;
    const totalSize = changes.reduce((sum, c) => 
      sum + c.newString.length, 0
    );
    
    if (totalSize > 100000) {
      throw new Error('Edit too large');
    }
  },
  
  validateContent(context: HookContext) {
    const { changes } = context;
    
    for (const change of changes) {
      // Check for suspicious patterns
      if (/eval\s*\(/.test(change.newString)) {
        throw new Error('eval() detected');
      }
    }
  },
  
  validatePermissions(context: HookContext) {
    const { file } = context;
    
    // Check protected files
    const protectedFiles = ['.env', 'secrets.json'];
    const basename = path.basename(file);
    
    if (protectedFiles.includes(basename)) {
      throw new Error(`Cannot edit protected file: ${basename}`);
    }
  }
};
```

### Transformation Pattern

```typescript
// hooks/code-transformer.ts
export const codeTransformer: Hook = {
  name: 'code-transformer',
  event: 'before-write',
  priority: 75,
  
  async execute(context) {
    const { file, content } = context;
    
    // Only transform JavaScript files
    if (!file.endsWith('.js')) return;
    
    let transformed = content;
    
    // Apply transformations
    transformed = this.addUseStrict(transformed);
    transformed = this.normalizeLineEndings(transformed);
    transformed = this.trimTrailingWhitespace(transformed);
    
    // Update context
    context.content = transformed;
  },
  
  addUseStrict(content: string): string {
    if (!content.includes("'use strict'")) {
      return "'use strict';\n\n" + content;
    }
    return content;
  },
  
  normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, '\n');
  },
  
  trimTrailingWhitespace(content: string): string {
    return content.replace(/[ \t]+$/gm, '');
  }
};
```

### Notification Pattern

```typescript
// hooks/notification-hook.ts
export const notificationHook: Hook = {
  name: 'notification-hook',
  events: ['after-tool', 'error'],
  priority: 25,
  
  async execute(context) {
    if (context.event === 'after-tool') {
      const { tool, result } = context;
      
      if (!result.success) {
        await this.notify('error', `Tool ${tool.name} failed`);
      }
    } else if (context.event === 'error') {
      await this.notify('error', context.error?.message);
    }
  },
  
  async notify(type: string, message: string) {
    // Send desktop notification
    if (process.platform === 'darwin') {
      exec(`osascript -e 'display notification "${message}"'`);
    }
    
    // Or send to Slack
    // await slackClient.post({ type, message });
  }
};
```

## Advanced Hook Usage

### Conditional Hooks

```typescript
// hooks/conditional-hook.ts
export const conditionalHook: Hook = {
  name: 'conditional-hook',
  event: 'before-tool',
  priority: 100,
  
  // Only activate for specific tools
  condition: (context) => {
    return context.tool?.name === 'shell';
  },
  
  async execute(context) {
    const { params } = context;
    
    // Additional check
    if (params.command.includes('rm -rf')) {
      throw new Error('Destructive command blocked');
    }
  }
};
```

### Async Hooks

```typescript
// hooks/async-hook.ts
export const asyncHook: Hook = {
  name: 'async-hook',
  event: 'after-request',
  priority: 50,
  
  async execute(context) {
    // Fire and forget - don't block
    this.logToAnalytics(context).catch(console.error);
    
    // Or wait for completion
    await this.saveToDatabase(context);
  },
  
  async logToAnalytics(context: HookContext) {
    await fetch('https://analytics.example.com/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'ai-request',
        tokens: context.response?.usage
      })
    });
  },
  
  async saveToDatabase(context: HookContext) {
    // Save to local database
  }
};
```

### Chaining Hooks

```typescript
// hooks/hook-chain.ts
// Hook 1: Validation (priority 200)
export const validationHook: Hook = {
  name: 'validation-hook',
  event: 'before-write',
  priority: 200,
  async execute(context) {
    // Validate first
  }
};

// Hook 2: Transformation (priority 100)
export const transformationHook: Hook = {
  name: 'transformation-hook',
  event: 'before-write',
  priority: 100,
  async execute(context) {
    // Transform after validation
  }
};

// Hook 3: Logging (priority 50)
export const loggingHook: Hook = {
  name: 'logging-hook',
  event: 'before-write',
  priority: 50,
  async execute(context) {
    // Log last
  }
};
```

## Hook Best Practices

### Performance

```typescript
export const efficientHook: Hook = {
  name: 'efficient-hook',
  event: 'after-tool',
  priority: 10,
  
  async execute(context) {
    // Keep hooks fast
    // Avoid blocking operations
    
    // Bad: Synchronous file write
    // fs.writeFileSync('log.txt', data);
    
    // Good: Async operation
    this.logAsync(context).catch(console.error);
    
    // Or use batching
    this.queueLog(context);
  },
  
  logs: [] as HookContext[],
  
  queueLog(context: HookContext) {
    this.logs.push(context);
    
    // Flush every 10 logs
    if (this.logs.length >= 10) {
      this.flushLogs();
    }
  },
  
  async flushLogs() {
    const batch = this.logs.splice(0, 10);
    await this.writeLogs(batch);
  }
};
```

### Error Handling

```typescript
export const robustHook: Hook = {
  name: 'robust-hook',
  event: 'after-request',
  priority: 50,
  
  async execute(context) {
    try {
      await this.process(context);
    } catch (error) {
      // Log but don't throw
      // Hooks shouldn't break the main flow
      console.error('Hook error:', error);
      
      // Optionally report
      await this.reportError(error);
    }
  }
};
```

### State Management

```typescript
export const statefulHook: Hook = {
  name: 'stateful-hook',
  event: 'session-start',
  priority: 100,
  
  // Initialize state
  state: {
    startTime: 0,
    operationCount: 0
  },
  
  async execute(context) {
    this.state.startTime = Date.now();
    this.state.operationCount = 0;
  }
};

// Companion hook
export const statefulHookEnd: Hook = {
  name: 'stateful-hook-end',
  event: 'session-end',
  priority: 100,
  
  async execute(context) {
    const duration = Date.now() - statefulHook.state.startTime;
    
    console.log(`Session lasted ${duration}ms`);
    console.log(`Operations: ${statefulHook.state.operationCount}`);
  }
};
```

## Hook Examples

### Audit Logger

```typescript
// hooks/audit-logger.ts
export const auditLogger: Hook = {
  name: 'audit-logger',
  events: ['before-write', 'before-edit'],
  priority: 100,
  
  async execute(context) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event: context.event,
      file: context.file,
      sessionId: context.session?.id,
      user: process.env.USER,
      hostname: os.hostname()
    };
    
    // Write to audit log
    await appendFile(
      'audit.log',
      JSON.stringify(auditEntry) + '\n'
    );
  }
};
```

### Backup Hook

```typescript
// hooks/backup-hook.ts
export const backupHook: Hook = {
  name: 'backup-hook',
  event: 'before-edit',
  priority: 175,
  
  async execute(context) {
    const { file } = context;
    
    // Create backup directory
    const backupDir = '.claude-code-clone/backups';
    await mkdir(backupDir, { recursive: true });
    
    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${backupDir}/${path.basename(file)}.${timestamp}.bak`;
    
    // Copy original file
    await copyFile(file, backupFile);
    
    console.log(`[BACKUP] Created: ${backupFile}`);
  }
};
```

### Rate Limiter

```typescript
// hooks/rate-limiter.ts
export const rateLimiter: Hook = {
  name: 'rate-limiter',
  event: 'before-request',
  priority: 200,
  
  requests: [] as number[],
  limit: 10,
  window: 60000, // 1 minute
  
  async execute(context) {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(
      time => now - time < this.window
    );
    
    // Check limit
    if (this.requests.length >= this.limit) {
      const oldest = this.requests[0];
      const waitTime = this.window - (now - oldest);
      
      throw new Error(
        `Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)}s`
      );
    }
    
    // Add current request
    this.requests.push(now);
  }
};
```

## Debugging Hooks

### Hook Debugging

```typescript
// hooks/debug-hook.ts
export const debugHook: Hook = {
  name: 'debug-hook',
  events: ['before-tool', 'after-tool'],
  priority: 1000, // Run first
  
  async execute(context) {
    console.log('=== HOOK DEBUG ===');
    console.log('Event:', context.event);
    console.log('Tool:', context.tool?.name);
    console.log('Params:', context.params);
    console.log('Context keys:', Object.keys(context));
    console.log('==================');
  }
};
```

### Hook Testing

```typescript
// tests/hooks/my-hook.test.ts
describe('my-hook', () => {
  it('should execute successfully', async () => {
    const context = createMockContext({
      event: 'before-tool',
      tool: { name: 'test-tool' },
      params: { test: true }
    });
    
    await myHook.execute(context);
    
    // Assert expected behavior
    expect(context).toHaveProperty('modified', true);
  });
  
  it('should throw on invalid input', async () => {
    const context = createMockContext({
      event: 'before-tool',
      params: { invalid: true }
    });
    
    await expect(myHook.execute(context))
      .rejects.toThrow('Invalid input');
  });
});
```

---

**Hook Development Quick Reference**

```
Structure:
  name      # Unique identifier
  event(s)  # When to fire
  priority  # Execution order (higher first)
  execute() # Hook logic

Events:
  before/after-request  # AI requests
  before/after-tool     # Tool execution
  before/after-write    # File writes
  before/after-edit     # File edits
  session-start/end     # Session lifecycle
  error                 # Error handling

Best Practices:
  - Keep hooks fast
  - Handle errors gracefully
  - Use appropriate priority
  - Don't break main flow
```
