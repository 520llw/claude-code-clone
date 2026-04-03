# Tools API Documentation

API reference for Claude Code Clone tools.

## Table of Contents

1. [Tool Interface](#tool-interface)
2. [File Tools](#file-tools)
3. [Shell Tool](#shell-tool)
4. [Search Tools](#search-tools)
5. [Git Tools](#git-tools)
6. [Browser Tools](#browser-tools)
7. [Utility Tools](#utility-tools)
8. [Tool Registry](#tool-registry)
9. [Custom Tools](#custom-tools)
10. [Tool Result Types](#tool-result-types)

## Tool Interface

### Base Tool Interface

```typescript
interface Tool {
  // Tool identification
  name: string;
  description: string;
  
  // Parameters schema
  parameters: JSONSchema;
  
  // Execution
  execute(params: object): Promise<ToolResult>;
  
  // Optional: Validation
  validate?(params: object): ValidationResult;
  
  // Optional: Configuration
  config?: ToolConfig;
}

interface JSONSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: any[];
  default?: any;
}

interface ToolConfig {
  enabled: boolean;
  timeout?: number;
  requireConfirmation?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
```

## File Tools

### read_file

Read file contents.

```typescript
const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to read'
      },
      offset: {
        type: 'number',
        description: 'Line number to start from (1-indexed)',
        default: 1
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read',
        default: 1000
      }
    },
    required: ['file_path']
  },
  
  async execute(params: {
    file_path: string;
    offset?: number;
    limit?: number;
  }): Promise<ToolResult> {
    // Implementation
  }
};
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file_path` | string | Yes | - | Path to file |
| `offset` | number | No | 1 | Starting line |
| `limit` | number | No | 1000 | Max lines |

**Returns:**

```typescript
interface ReadFileResult {
  content: string;
  size: number;
  lines: number;
  encoding: string;
}
```

**Example:**

```typescript
const result = await toolRegistry.execute('read_file', {
  file_path: 'src/main.js',
  offset: 1,
  limit: 50
});

console.log(result.content);
```

### write_file

Write content to a file.

```typescript
const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create or overwrite a file',
  
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file'
      },
      content: {
        type: 'string',
        description: 'Content to write'
      },
      append: {
        type: 'boolean',
        description: 'Append instead of overwrite',
        default: false
      }
    },
    required: ['file_path', 'content']
  }
};
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file_path` | string | Yes | - | Path to file |
| `content` | string | Yes | - | Content to write |
| `append` | boolean | No | false | Append mode |

**Returns:**

```typescript
interface WriteFileResult {
  success: boolean;
  bytesWritten: number;
  filePath: string;
}
```

### edit_file

Edit a specific part of a file.

```typescript
const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Edit a specific part of a file',
  
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file'
      },
      old_string: {
        type: 'string',
        description: 'Text to replace'
      },
      new_string: {
        type: 'string',
        description: 'Replacement text'
      }
    },
    required: ['file_path', 'old_string', 'new_string']
  }
};
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to file |
| `old_string` | string | Yes | Text to find |
| `new_string` | string | Yes | Replacement |

**Returns:**

```typescript
interface EditFileResult {
  success: boolean;
  changes: number;
  filePath: string;
}
```

### list_directory

List directory contents.

```typescript
const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List files and directories',
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path',
        default: '.'
      },
      recursive: {
        type: 'boolean',
        description: 'List recursively',
        default: false
      }
    }
  }
};
```

**Returns:**

```typescript
interface ListDirectoryResult {
  path: string;
  entries: DirectoryEntry[];
}

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
}
```

## Shell Tool

### shell

Execute shell commands.

```typescript
const shellTool: Tool = {
  name: 'shell',
  description: 'Execute shell commands',
  
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command to execute'
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
        default: '.'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000
      },
      env: {
        type: 'object',
        description: 'Environment variables'
      }
    },
    required: ['command']
  }
};
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | Yes | - | Shell command |
| `cwd` | string | No | . | Working directory |
| `timeout` | number | No | 30000 | Timeout (ms) |
| `env` | object | No | {} | Environment vars |

**Returns:**

```typescript
interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}
```

**Example:**

```typescript
const result = await toolRegistry.execute('shell', {
  command: 'npm test',
  cwd: './my-project',
  timeout: 60000
});

if (result.success) {
  console.log('Tests passed!');
  console.log(result.stdout);
}
```

## Search Tools

### search

Search for patterns in code.

```typescript
const searchTool: Tool = {
  name: 'search',
  description: 'Search for patterns in the codebase',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      path: {
        type: 'string',
        description: 'Search path',
        default: '.'
      },
      file_pattern: {
        type: 'string',
        description: 'File pattern (glob)'
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Case sensitive search',
        default: false
      },
      regex: {
        type: 'boolean',
        description: 'Use regular expressions',
        default: false
      }
    },
    required: ['query']
  }
};
```

**Returns:**

```typescript
interface SearchResult {
  matches: SearchMatch[];
  total: number;
}

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  context: string[];
}
```

### grep

Grep-style text search.

```typescript
const grepTool: Tool = {
  name: 'grep',
  description: 'Search files for patterns',
  
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Search pattern'
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to search'
      },
      options: {
        type: 'object',
        properties: {
          caseSensitive: { type: 'boolean' },
          wholeWord: { type: 'boolean' },
          lineNumber: { type: 'boolean' }
        }
      }
    },
    required: ['pattern']
  }
};
```

### find

Find files matching criteria.

```typescript
const findTool: Tool = {
  name: 'find',
  description: 'Find files and directories',
  
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'File pattern'
      },
      path: {
        type: 'string',
        description: 'Search path',
        default: '.'
      },
      type: {
        type: 'string',
        enum: ['f', 'd'],
        description: 'File (f) or directory (d)'
      }
    }
  }
};
```

## Git Tools

### git_status

Show git repository status.

```typescript
const gitStatusTool: Tool = {
  name: 'git_status',
  description: 'Show git repository status',
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Repository path',
        default: '.'
      }
    }
  }
};
```

**Returns:**

```typescript
interface GitStatusResult {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}
```

### git_log

Show commit history.

```typescript
const gitLogTool: Tool = {
  name: 'git_log',
  description: 'Show commit history',
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Repository path',
        default: '.'
      },
      limit: {
        type: 'number',
        description: 'Number of commits',
        default: 10
      },
      format: {
        type: 'string',
        description: 'Output format',
        default: 'medium'
      }
    }
  }
};
```

**Returns:**

```typescript
interface GitLogResult {
  commits: GitCommit[];
}

interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
}
```

### git_diff

Show differences.

```typescript
const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Show differences',
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File or directory'
      },
      cached: {
        type: 'boolean',
        description: 'Show staged changes',
        default: false
      }
    }
  }
};
```

## Browser Tools

### browser_visit

Visit a URL.

```typescript
const browserVisitTool: Tool = {
  name: 'browser_visit',
  description: 'Visit a URL in a browser',
  
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to visit'
      },
      wait_until: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        default: 'networkidle'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000
      }
    },
    required: ['url']
  }
};
```

**Returns:**

```typescript
interface BrowserVisitResult {
  success: boolean;
  title: string;
  url: string;
  elements: ElementInfo[];
}

interface ElementInfo {
  index: number;
  tag: string;
  text: string;
  attributes: Record<string, string>;
}
```

### browser_click

Click an element.

```typescript
const browserClickTool: Tool = {
  name: 'browser_click',
  description: 'Click an element on the page',
  
  parameters: {
    type: 'object',
    properties: {
      element: {
        type: 'number',
        description: 'Element index'
      }
    },
    required: ['element']
  }
};
```

### browser_find

Find elements on the page.

```typescript
const browserFindTool: Tool = {
  name: 'browser_find',
  description: 'Find elements by text',
  
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Text to search for'
      },
      skip: {
        type: 'number',
        description: 'Skip first N matches',
        default: 0
      }
    },
    required: ['keyword']
  }
};
```

## Utility Tools

### calculator

Perform calculations.

```typescript
const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression'
      }
    },
    required: ['expression']
  }
};
```

**Example:**

```typescript
const result = await toolRegistry.execute('calculator', {
  expression: '2 + 2 * 5'
});

console.log(result.result); // 12
```

### datetime

Date and time operations.

```typescript
const datetimeTool: Tool = {
  name: 'datetime',
  description: 'Date and time operations',
  
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['now', 'format', 'parse', 'add', 'diff'],
        description: 'Operation to perform'
      },
      value: {
        type: 'string',
        description: 'Input value'
      },
      format: {
        type: 'string',
        description: 'Date format'
      }
    },
    required: ['operation']
  }
};
```

## Tool Registry

### ToolRegistry Class

```typescript
class ToolRegistry {
  // Register a tool
  register(tool: Tool): void;
  
  // Unregister a tool
  unregister(name: string): void;
  
  // Get tool by name
  getTool(name: string): Tool | undefined;
  
  // Get all tools
  getAllTools(): Tool[];
  
  // Get enabled tools
  getEnabledTools(): Tool[];
  
  // Check if tool exists
  hasTool(name: string): boolean;
  
  // Check if tool is enabled
  isEnabled(name: string): boolean;
  
  // Enable/disable tool
  setEnabled(name: string, enabled: boolean): void;
  
  // Execute tool
  execute(name: string, params: object): Promise<ToolResult>;
  
  // Validate tool parameters
  validate(name: string, params: object): ValidationResult;
}
```

### Registry Usage

```typescript
import { ToolRegistry } from 'claude-code-clone';

const registry = new ToolRegistry();

// Register built-in tools
registry.register(readFileTool);
registry.register(writeFileTool);
registry.register(shellTool);

// Execute tool
const result = await registry.execute('read_file', {
  file_path: 'README.md'
});

// Check if tool is enabled
if (registry.isEnabled('shell')) {
  // Execute shell command
}

// Disable a tool
registry.setEnabled('browser', false);
```

## Custom Tools

### Creating Custom Tools

```typescript
import { Tool, ToolResult } from 'claude-code-clone';

const myCustomTool: Tool = {
  name: 'my-tool',
  description: 'My custom tool description',
  
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input to process'
      },
      options: {
        type: 'object',
        description: 'Processing options',
        properties: {
          uppercase: {
            type: 'boolean',
            default: false
          }
        }
      }
    },
    required: ['input']
  },
  
  async execute(params: {
    input: string;
    options?: { uppercase?: boolean };
  }): Promise<ToolResult> {
    try {
      let result = params.input;
      
      if (params.options?.uppercase) {
        result = result.toUpperCase();
      }
      
      return {
        success: true,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  validate(params) {
    if (params.input.length > 1000) {
      return {
        valid: false,
        errors: ['Input too long (max 1000 characters)']
      };
    }
    return { valid: true };
  }
};

// Register the tool
registry.register(myCustomTool);
```

### Tool with Dependencies

```typescript
import { Tool, ToolResult, PluginContext } from 'claude-code-clone';

class APITool implements Tool {
  name = 'api-client';
  description = 'Make API requests';
  
  parameters = {
    type: 'object',
    properties: {
      endpoint: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST'] },
      data: { type: 'object' }
    },
    required: ['endpoint', 'method']
  };
  
  private apiKey: string;
  private baseUrl: string;
  
  constructor(context: PluginContext) {
    this.apiKey = context.config.get('api.key');
    this.baseUrl = context.config.get('api.baseUrl');
  }
  
  async execute(params: {
    endpoint: string;
    method: string;
    data?: object;
  }): Promise<ToolResult> {
    const response = await fetch(`${this.baseUrl}${params.endpoint}`, {
      method: params.method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: params.data ? JSON.stringify(params.data) : undefined
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      result: data
    };
  }
}
```

## Tool Result Types

### Success Result

```typescript
interface ToolSuccessResult {
  success: true;
  result: any;
  metadata?: {
    duration: number;
    timestamp: Date;
  };
}
```

### Error Result

```typescript
interface ToolErrorResult {
  success: false;
  error: string;
  errorCode?: string;
  details?: object;
}
```

### File Result

```typescript
interface FileToolResult extends ToolSuccessResult {
  result: {
    filePath: string;
    content?: string;
    size: number;
    modified?: Date;
  };
}
```

### Shell Result

```typescript
interface ShellToolResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}
```

---

**Tools API Quick Reference**

```
File:
  read_file(file_path, offset?, limit?)
  write_file(file_path, content, append?)
  edit_file(file_path, old_string, new_string)
  list_directory(path?, recursive?)

Shell:
  shell(command, cwd?, timeout?, env?)

Search:
  search(query, path?, file_pattern?, case_sensitive?, regex?)
  grep(pattern, files?, options?)
  find(pattern, path?, type?)

Git:
  git_status(path?)
  git_log(path?, limit?, format?)
  git_diff(path?, cached?)

Browser:
  browser_visit(url, wait_until?, timeout?)
  browser_click(element)
  browser_find(keyword, skip?)

Registry:
  register(tool)
  execute(name, params)
  isEnabled(name)
  setEnabled(name, enabled)
```
