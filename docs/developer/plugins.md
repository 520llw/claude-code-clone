# Plugin Development Guide

Complete guide to developing plugins for Claude Code Clone.

## Table of Contents

1. [Plugin Overview](#plugin-overview)
2. [Getting Started](#getting-started)
3. [Plugin Structure](#plugin-structure)
4. [Plugin API](#plugin-api)
5. [Creating Tools](#creating-tools)
6. [Creating Hooks](#creating-hooks)
7. [Creating Skills](#creating-skills)
8. [Plugin Configuration](#plugin-configuration)
9. [Plugin Distribution](#plugin-distribution)
10. [Best Practices](#best-practices)

## Plugin Overview

### What are Plugins?

Plugins extend Claude Code Clone's functionality by adding:

- **Custom Tools**: New capabilities for the AI
- **Hooks**: Extend behavior at key points
- **Skills**: Domain-specific expertise
- **Commands**: New slash commands
- **UI Components**: Custom interface elements

### Plugin Types

| Type | Description | Use Case |
|------|-------------|----------|
| Tool Plugin | Add new tools | Custom integrations |
| Hook Plugin | Extend lifecycle | Custom workflows |
| Skill Plugin | Domain expertise | Specialized knowledge |
| UI Plugin | Custom interface | Visual enhancements |
| Integration Plugin | External services | Third-party APIs |

## Getting Started

### Prerequisites

- Node.js 18+
- Claude Code Clone installed
- Basic TypeScript knowledge

### Plugin Scaffolding

```bash
# Create plugin directory
mkdir my-claude-plugin
cd my-claude-plugin

# Initialize project
npm init -y

# Install dependencies
npm install @claude-code-clone/sdk
npm install -D typescript @types/node

# Initialize TypeScript
npx tsc --init
```

### Basic Plugin

```typescript
// src/index.ts
import { Plugin, PluginContext } from '@claude-code-clone/sdk';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  
  async initialize(context: PluginContext) {
    console.log('Plugin initialized!');
  },
  
  async activate() {
    console.log('Plugin activated!');
  },
  
  async deactivate() {
    console.log('Plugin deactivated!');
  }
};

export default myPlugin;
```

## Plugin Structure

### Directory Layout

```
my-plugin/
├── src/
│   ├── index.ts           # Main entry point
│   ├── tools/             # Custom tools
│   │   └── my-tool.ts
│   ├── hooks/             # Custom hooks
│   │   └── my-hook.ts
│   ├── skills/            # Custom skills
│   │   └── my-skill.ts
│   └── types.ts           # Type definitions
├── tests/                 # Test files
├── docs/                  # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "my-claude-plugin",
  "version": "1.0.0",
  "description": "My Claude Code Clone plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/"
  },
  "peerDependencies": {
    "@claude-code-clone/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "claudePlugin": {
    "name": "my-plugin",
    "entry": "dist/index.js"
  }
}
```

## Plugin API

### Plugin Interface

```typescript
interface Plugin {
  // Required
  name: string;
  version: string;
  
  // Optional
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  
  // Lifecycle
  initialize?(context: PluginContext): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
  
  // Components
  tools?: Tool[];
  hooks?: Hook[];
  skills?: Skill[];
  commands?: Command[];
}
```

### Plugin Context

```typescript
interface PluginContext {
  // Core services
  logger: Logger;
  config: ConfigManager;
  storage: Storage;
  
  // Registries
  tools: ToolRegistry;
  hooks: HookManager;
  commands: CommandRegistry;
  
  // Utilities
  utils: {
    path: PathUtils;
    fs: FileSystem;
    http: HttpClient;
  };
}
```

### Lifecycle Methods

```typescript
const plugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  
  // Called when plugin is loaded
  async initialize(context) {
    // Setup resources
    // Register components
    // Load configuration
  },
  
  // Called when plugin is enabled
  async activate() {
    // Start services
    // Connect to APIs
  },
  
  // Called when plugin is disabled
  async deactivate() {
    // Cleanup resources
    // Save state
    // Disconnect
  }
};
```

## Creating Tools

### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: object): Promise<ToolResult>;
}
```

### Simple Tool Example

```typescript
// src/tools/calculator.ts
import { Tool } from '@claude-code-clone/sdk';

export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate'
      }
    },
    required: ['expression']
  },
  
  async execute({ expression }) {
    try {
      // Safe evaluation
      const result = safeEvaluate(expression);
      
      return {
        success: true,
        result: result.toString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

function safeEvaluate(expr: string): number {
  // Implement safe math evaluation
  // Don't use eval()!
}
```

### Complex Tool Example

```typescript
// src/tools/api-client.ts
import { Tool } from '@claude-code-clone/sdk';

interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class ApiClientTool implements Tool {
  name = 'api-client';
  description = 'Make HTTP API requests';
  
  parameters = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'HTTP method'
      },
      endpoint: {
        type: 'string',
        description: 'API endpoint'
      },
      body: {
        type: 'object',
        description: 'Request body'
      },
      headers: {
        type: 'object',
        description: 'Additional headers'
      }
    },
    required: ['method', 'endpoint']
  };
  
  private config: ApiClientConfig;
  
  constructor(config: ApiClientConfig) {
    this.config = config;
  }
  
  async execute(params: {
    method: string;
    endpoint: string;
    body?: object;
    headers?: Record<string, string>;
  }) {
    const url = `${this.config.baseUrl}${params.endpoint}`;
    
    const response = await fetch(url, {
      method: params.method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && {
          'Authorization': `Bearer ${this.config.apiKey}`
        }),
        ...params.headers
      },
      body: params.body ? JSON.stringify(params.body) : undefined
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data
    };
  }
}
```

### File Tool Example

```typescript
// src/tools/csv-processor.ts
import { Tool } from '@claude-code-clone/sdk';
import * as csv from 'csv-parse';

export const csvProcessorTool: Tool = {
  name: 'csv-processor',
  description: 'Process CSV files',
  
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to CSV file'
      },
      operation: {
        type: 'string',
        enum: ['parse', 'validate', 'transform'],
        description: 'Operation to perform'
      },
      options: {
        type: 'object',
        description: 'CSV parsing options'
      }
    },
    required: ['file_path', 'operation']
  },
  
  async execute({ file_path, operation, options }) {
    const content = await fs.readFile(file_path, 'utf-8');
    
    switch (operation) {
      case 'parse':
        return parseCSV(content, options);
      case 'validate':
        return validateCSV(content, options);
      case 'transform':
        return transformCSV(content, options);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
};
```

## Creating Hooks

### Hook Interface

```typescript
interface Hook {
  name: string;
  event: string;
  priority?: number;
  execute(context: HookContext): Promise<void>;
}
```

### Available Events

| Event | When Fired | Context |
|-------|------------|---------|
| `before-request` | Before AI request | Request data |
| `after-request` | After AI response | Response data |
| `before-tool` | Before tool execution | Tool, params |
| `after-tool` | After tool execution | Tool, result |
| `before-edit` | Before file edit | File, changes |
| `after-edit` | After file edit | File, result |
| `session-start` | When session starts | Session |
| `session-end` | When session ends | Session |
| `error` | On error | Error |

### Hook Example

```typescript
// src/hooks/logging-hook.ts
import { Hook } from '@claude-code-clone/sdk';

export const loggingHook: Hook = {
  name: 'logging-hook',
  event: 'before-tool',
  priority: 100, // Higher = earlier execution
  
  async execute(context) {
    const { tool, params } = context;
    
    console.log(`[LOG] Executing tool: ${tool.name}`);
    console.log(`[LOG] Parameters:`, params);
    
    // Add timing
    context.startTime = Date.now();
  }
};

export const loggingHookAfter: Hook = {
  name: 'logging-hook-after',
  event: 'after-tool',
  priority: 100,
  
  async execute(context) {
    const { tool, result } = context;
    const duration = Date.now() - context.startTime;
    
    console.log(`[LOG] Tool ${tool.name} completed in ${duration}ms`);
    console.log(`[LOG] Result:`, result.success ? 'success' : 'failed');
  }
};
```

### Validation Hook

```typescript
// src/hooks/validation-hook.ts
import { Hook } from '@claude-code-clone/sdk';

export const validationHook: Hook = {
  name: 'validation-hook',
  event: 'before-edit',
  priority: 200,
  
  async execute(context) {
    const { file, changes } = context;
    
    // Validate file type
    if (!file.endsWith('.js') && !file.endsWith('.ts')) {
      throw new Error('Only JavaScript/TypeScript files can be edited');
    }
    
    // Validate changes
    if (changes.length === 0) {
      throw new Error('No changes provided');
    }
    
    // Check for suspicious patterns
    const suspicious = ['eval(', 'Function(', 'setTimeout(', 'setInterval('];
    for (const change of changes) {
      for (const pattern of suspicious) {
        if (change.newContent.includes(pattern)) {
          console.warn(`[WARN] Suspicious pattern detected: ${pattern}`);
        }
      }
    }
  }
};
```

## Creating Skills

### Skill Interface

```typescript
interface Skill {
  name: string;
  description: string;
  patterns: string[]; // File patterns this skill applies to
  prompts: Record<string, string>;
  knowledge?: string[]; // Additional context
}
```

### Skill Example

```typescript
// src/skills/react-expert.ts
import { Skill } from '@claude-code-clone/sdk';

export const reactExpertSkill: Skill = {
  name: 'react-expert',
  description: 'Expert React development assistance',
  
  patterns: [
    '*.jsx',
    '*.tsx',
    '*.js',
    '*.ts'
  ],
  
  prompts: {
    component: `
You are a React expert. Create a component following these guidelines:
- Use functional components with hooks
- Include proper PropTypes/TypeScript types
- Follow React best practices
- Include JSDoc comments
- Make it accessible (ARIA labels, etc.)
- Optimize for performance when applicable
`,
    hook: `
You are a React expert. Create a custom hook following these guidelines:
- Follow the use[Name] naming convention
- Include proper TypeScript types
- Handle cleanup in useEffect
- Return a stable API (useMemo for objects/arrays)
- Include usage example in JSDoc
`,
    test: `
You are a React testing expert. Create tests following these guidelines:
- Use React Testing Library
- Follow testing best practices
- Test user interactions, not implementation
- Include accessibility tests
- Mock external dependencies
`
  },
  
  knowledge: [
    'React 18 features and patterns',
    'React hooks rules and best practices',
    'Common React performance optimizations',
    'React Testing Library patterns'
  ]
};
```

### Domain-Specific Skill

```typescript
// src/skills/database-expert.ts
import { Skill } from '@claude-code-clone/sdk';

export const databaseExpertSkill: Skill = {
  name: 'database-expert',
  description: 'Database design and query optimization',
  
  patterns: [
    '*.sql',
    '*-model.*',
    '*-schema.*',
    'migrations/*'
  ],
  
  prompts: {
    schema: `
You are a database expert. Design a schema following these guidelines:
- Use appropriate data types
- Define primary keys and indexes
- Establish proper relationships
- Include constraints for data integrity
- Consider query patterns for indexing
- Document with comments
`,
    query: `
You are a database expert. Write a query following these guidelines:
- Optimize for performance
- Use appropriate joins
- Include EXPLAIN plan considerations
- Handle edge cases (NULLs, empty results)
- Use parameterized queries for security
`,
    migration: `
You are a database expert. Create a migration following these guidelines:
- Make it reversible (up/down)
- Include safety checks
- Handle large tables carefully
- Add appropriate indexes
- Document breaking changes
`
  }
};
```

## Plugin Configuration

### Configuration Schema

```typescript
// src/config.ts
import { PluginConfig } from '@claude-code-clone/sdk';

export interface MyPluginConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  features?: {
    featureA: boolean;
    featureB: boolean;
  };
}

export const defaultConfig: MyPluginConfig = {
  endpoint: 'https://api.example.com',
  timeout: 30000,
  features: {
    featureA: true,
    featureB: false
  }
};
```

### Loading Configuration

```typescript
// src/index.ts
import { Plugin, PluginContext } from '@claude-code-clone/sdk';
import { MyPluginConfig, defaultConfig } from './config';

const plugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  async initialize(context: PluginContext) {
    // Load configuration
    const userConfig = await context.config.get('my-plugin') || {};
    const config: MyPluginConfig = {
      ...defaultConfig,
      ...userConfig
    };
    
    // Store for later use
    context.storage.set('my-plugin:config', config);
    
    // Validate configuration
    if (config.features.featureA && !config.apiKey) {
      throw new Error('apiKey is required when featureA is enabled');
    }
  }
};
```

### User Configuration

Users can configure your plugin in their config:

```json
{
  "plugins": {
    "my-plugin": {
      "apiKey": "secret-key",
      "endpoint": "https://custom.api.com",
      "timeout": 60000,
      "features": {
        "featureA": true,
        "featureB": true
      }
    }
  }
}
```

## Plugin Distribution

### Publishing to npm

```bash
# Build
npm run build

# Test
npm test

# Version bump
npm version [patch|minor|major]

# Publish
npm publish
```

### Plugin Registry

Submit to official registry:

```bash
# Create submission
claude-code-clone plugin submit ./my-plugin

# Or manually via GitHub
# Create PR to claude-code-clone/registry
```

### Installation

Users install your plugin:

```bash
# Via npm
npm install my-claude-plugin

# Via CLI
claude-code-clone plugin install my-claude-plugin

# Via config
{
  "plugins": {
    "enabled": ["my-plugin"]
  }
}
```

## Best Practices

### Error Handling

```typescript
async execute(params) {
  try {
    // Operation
    return { success: true, result };
  } catch (error) {
    // Log for debugging
    context.logger.error('Tool failed:', error);
    
    // Return user-friendly error
    return {
      success: false,
      error: `Operation failed: ${error.message}`
    };
  }
}
```

### Security

```typescript
// Validate inputs
if (!params.file_path || typeof params.file_path !== 'string') {
  throw new Error('Invalid file_path parameter');
}

// Sanitize paths
const safePath = path.resolve(params.file_path);
if (!safePath.startsWith(process.cwd())) {
  throw new Error('Path outside project directory');
}

// Don't expose sensitive data
return {
  success: true,
  // Don't include: apiKey, password, token
  result: publicData
};
```

### Performance

```typescript
// Cache expensive operations
const cacheKey = `result:${params.id}`;
let result = await context.cache.get(cacheKey);

if (!result) {
  result = await expensiveOperation(params);
  await context.cache.set(cacheKey, result, 3600000); // 1 hour
}

// Use async operations
const results = await Promise.all(
  items.map(item => processItem(item))
);
```

### Testing

```typescript
// tests/my-tool.test.ts
describe('my-tool', () => {
  it('should execute successfully', async () => {
    const result = await myTool.execute({
      param: 'value'
    });
    
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });
  
  it('should handle errors', async () => {
    const result = await myTool.execute({
      param: 'invalid'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

**Plugin Development Quick Reference**

```
Structure:
  src/
    index.ts          # Main entry
    tools/            # Custom tools
    hooks/            # Custom hooks
    skills/           # Custom skills

Key Interfaces:
  Plugin     # Main plugin interface
  Tool       # Custom tool
  Hook       # Lifecycle hook
  Skill      # Domain expertise

Lifecycle:
  initialize()  # Load and setup
  activate()    # Start services
  deactivate()  # Cleanup

Distribution:
  npm publish
  claude-code-clone plugin submit
```
