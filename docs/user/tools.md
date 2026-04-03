# Tool Reference

Complete reference for all tools available in Claude Code Clone.

## Table of Contents

1. [Tool Overview](#tool-overview)
2. [File Tools](#file-tools)
3. [Shell Tool](#shell-tool)
4. [Search Tool](#search-tool)
5. [Git Tool](#git-tool)
6. [Browser Tool](#browser-tool)
7. [Code Analysis Tools](#code-analysis-tools)
8. [Utility Tools](#utility-tools)
9. [Custom Tools](#custom-tools)
10. [Tool Configuration](#tool-configuration)

## Tool Overview

Tools are functions that Claude Code Clone can invoke to interact with your system. They provide capabilities for file operations, command execution, searching, and more.

### How Tools Work

When you make a request, the AI determines which tools to use:

1. **Request Analysis**: AI understands your intent
2. **Tool Selection**: AI selects appropriate tools
3. **Execution**: Tools execute with proper parameters
4. **Result Processing**: Results are processed and presented

### Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| File | `read_file`, `write_file`, `edit_file` | File operations |
| Execution | `shell` | Command execution |
| Search | `search`, `grep`, `find` | Code search |
| Version Control | `git` | Git operations |
| Web | `browser` | Web interaction |
| Analysis | `analyze`, `lint`, `test` | Code analysis |
| Utility | `calculator`, `datetime` | Helper functions |

### Enabling/Disabling Tools

```bash
# List available tools
> /tools list

# Enable a tool
> /tools enable browser

# Disable a tool
> /tools disable shell

# Show tool info
> /tools info file
```

## File Tools

### read_file

Read the contents of a file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file |
| `offset` | number | No | Line number to start from |
| `limit` | number | No | Maximum lines to read |

**Examples:**

```javascript
// Read entire file
read_file({
  file_path: "/path/to/file.js"
})

// Read specific lines
read_file({
  file_path: "/path/to/file.js",
  offset: 1,
  limit: 50
})
```

**Usage in chat:**
```
> Read src/main.js
> Show me lines 10-30 of config.json
> Read the README file
```

### write_file

Create or overwrite a file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file |
| `content` | string | Yes | Content to write |
| `append` | boolean | No | Append instead of overwrite |

**Examples:**

```javascript
// Create new file
write_file({
  file_path: "/path/to/new-file.js",
  content: "console.log('Hello');"
})

// Append to file
write_file({
  file_path: "/path/to/log.txt",
  content: "New log entry\n",
  append: true
})
```

**Usage in chat:**
```
> Create a file src/utils.js with content: [content]
> Append "console.log('Done')" to src/main.js
```

### edit_file

Edit a specific part of a file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file |
| `old_string` | string | Yes | Text to replace |
| `new_string` | string | Yes | Replacement text |

**Examples:**

```javascript
// Simple replacement
edit_file({
  file_path: "/path/to/file.js",
  old_string: "var x = 1;",
  new_string: "const x = 1;"
})

// Multi-line replacement
edit_file({
  file_path: "/path/to/file.js",
  old_string: `function old() {
  return 1;
}`,
  new_string: `function new() {
  return 2;
}`
})
```

**Usage in chat:**
```
> In src/main.js, replace "var" with "const"
> Edit src/utils.js to add error handling
```

### list_directory

List contents of a directory.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Directory path |
| `recursive` | boolean | No | List recursively |

**Examples:**

```javascript
// List directory
list_directory({
  path: "/path/to/dir"
})

// Recursive listing
list_directory({
  path: "/path/to/dir",
  recursive: true
})
```

**Usage in chat:**
```
> List files in src/
> Show directory structure
> What files are in the project?
```

### file_info

Get information about a file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file |

**Returns:**
- File size
- Creation date
- Modification date
- Permissions
- File type

**Usage in chat:**
```
> Get info about package.json
> Show file details for src/main.js
```

## Shell Tool

### shell

Execute shell commands.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | Yes | Command to execute |
| `cwd` | string | No | Working directory |
| `timeout` | number | No | Timeout in milliseconds |
| `env` | object | No | Environment variables |

**Examples:**

```javascript
// Simple command
shell({
  command: "npm test"
})

// With options
shell({
  command: "npm run build",
  cwd: "/path/to/project",
  timeout: 60000,
  env: { NODE_ENV: "production" }
})
```

**Usage in chat:**
```
> Run npm install
> Execute git status
> Run python script.py
> Execute make build
```

**Security:**
- Commands can be restricted via configuration
- Destructive commands may require confirmation
- Blocked commands are configurable

## Search Tool

### search

Search for patterns in code.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `path` | string | No | Search path |
| `file_pattern` | string | No | File pattern (e.g., "*.js") |
| `case_sensitive` | boolean | No | Case sensitive search |
| `regex` | boolean | No | Use regex |

**Examples:**

```javascript
// Simple search
search({
  query: "TODO",
  path: "/path/to/project"
})

// Regex search
search({
  query: "function\s+\w+",
  path: "/path/to/project",
  regex: true,
  file_pattern: "*.js"
})
```

**Usage in chat:**
```
> Search for "TODO" in the codebase
> Find all functions named "handle"
> Search for console.log statements
```

### grep

Grep-style text search.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Search pattern |
| `files` | array | No | Files to search |
| `options` | object | No | Grep options |

**Usage in chat:**
```
> Grep for "export" in src/
> Find imports from "react"
```

### find

Find files matching criteria.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | File pattern |
| `path` | string | No | Search path |
| `type` | string | No | File type (f/d) |

**Usage in chat:**
```
> Find all test files
> Find JavaScript files in src/
> Find directories named "components"
```

## Git Tool

### git_status

Show git repository status.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Repository path |

**Returns:**
- Modified files
- Staged files
- Untracked files
- Branch information

**Usage in chat:**
```
> Show git status
> What's the current branch?
> What files have changed?
```

### git_log

Show commit history.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Repository path |
| `limit` | number | No | Number of commits |
| `format` | string | No | Output format |

**Usage in chat:**
```
> Show recent commits
> Git log for src/main.js
> Show last 10 commits
```

### git_diff

Show differences.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | File or directory |
| `cached` | boolean | No | Show staged changes |

**Usage in chat:**
```
> Show git diff
> What changes are staged?
> Diff for src/main.js
```

### git_add

Stage files.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `files` | array | Yes | Files to stage |

**Usage in chat:**
```
> Stage all changes
> Add src/main.js to git
```

### git_commit

Create a commit.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Commit message |
| `files` | array | No | Files to commit |

**Usage in chat:**
```
> Commit with message "Add feature"
> Commit all changes
```

## Browser Tool

### browser_visit

Visit a URL.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to visit |
| `wait_until` | string | No | When to consider loaded |
| `timeout` | number | No | Timeout in milliseconds |

**Examples:**

```javascript
browser_visit({
  url: "https://example.com",
  wait_until: "networkidle",
  timeout: 30000
})
```

**Usage in chat:**
```
> Visit https://example.com
> Open the documentation page
```

### browser_click

Click an element.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `element` | string | Yes | Element selector or index |

**Usage in chat:**
```
> Click the login button
> Click element 5
```

### browser_find

Find elements on the page.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `keyword` | string | Yes | Text to search for |
| `skip` | number | No | Skip first N matches |

**Usage in chat:**
```
> Find "Submit" on the page
> Search for "Documentation"
```

### browser_scroll

Scroll the page.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `direction` | string | Yes | "up" or "down" |
| `amount` | number | Yes | Pixels to scroll |

**Usage in chat:**
```
> Scroll down 500 pixels
> Scroll up to top
```

### browser_screenshot

Take a screenshot.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Save path |
| `full_page` | boolean | No | Capture full page |

**Usage in chat:**
```
> Take a screenshot
> Screenshot the current page
```

## Code Analysis Tools

### analyze_code

Analyze code for various aspects.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | File to analyze |
| `analysis_type` | string | No | Type of analysis |

**Analysis Types:**
- `complexity` - Cyclomatic complexity
- `security` - Security issues
- `performance` - Performance issues
- `style` - Code style issues
- `all` - All analyses

**Usage in chat:**
```
> Analyze src/main.js for complexity
> Check src/auth.js for security issues
> Analyze code performance
```

### lint_code

Run linter on code.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | File to lint |
| `fix` | boolean | No | Auto-fix issues |

**Usage in chat:**
```
> Lint src/main.js
> Run linter with auto-fix
```

### format_code

Format code.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | File to format |
| `formatter` | string | No | Formatter to use |

**Usage in chat:**
```
> Format src/main.js
> Format code with prettier
```

### run_tests

Run tests.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `test_path` | string | No | Test file or directory |
| `coverage` | boolean | No | Show coverage |
| `watch` | boolean | No | Watch mode |

**Usage in chat:**
```
> Run tests
> Run tests with coverage
> Test src/utils.js
```

### type_check

Run type checker.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | No | File to check |
| `strict` | boolean | No | Strict mode |

**Usage in chat:**
```
> Run type checker
> Type check src/main.ts
```

## Utility Tools

### calculator

Perform calculations.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `expression` | string | Yes | Mathematical expression |

**Usage in chat:**
```
> Calculate 2 + 2
> What is 100 * 15%?
> Compute sqrt(144)
```

### datetime

Date and time operations.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | string | Yes | Operation type |
| `value` | string | No | Input value |

**Operations:**
- `now` - Current date/time
- `format` - Format date
- `parse` - Parse date
- `add` - Add time
- `diff` - Difference between dates

**Usage in chat:**
```
> What time is it?
> Format timestamp 1234567890
> Days until 2025-01-01
```

### uuid

Generate UUIDs.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version` | number | No | UUID version |
| `count` | number | No | Number to generate |

**Usage in chat:**
```
> Generate a UUID
> Create 5 UUIDs
```

### hash

Generate hashes.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | Yes | Data to hash |
| `algorithm` | string | No | Hash algorithm |

**Usage in chat:**
```
> Hash "hello world"
> Generate SHA-256 of file.txt
```

### encode_decode

Encode and decode data.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | Yes | Data to process |
| `operation` | string | Yes | encode/decode |
| `encoding` | string | Yes | Encoding type |

**Encodings:**
- `base64`
- `url`
- `html`
- `json`

**Usage in chat:**
```
> Base64 encode "hello"
> URL decode this string
> Parse this JSON
```

## Custom Tools

### Creating Custom Tools

Create custom tools to extend functionality:

```javascript
// ~/.claude-code-clone/tools/my-tool.js
module.exports = {
  name: 'my-tool',
  description: 'My custom tool',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input to process'
      }
    },
    required: ['input']
  },
  async execute({ input }) {
    // Tool logic
    return { result: input.toUpperCase() };
  }
};
```

### Registering Custom Tools

```json
{
  "tools": {
    "custom": [
      "~/.claude-code-clone/tools/my-tool.js"
    ]
  }
}
```

### Using Custom Tools

```
> /run my-tool --input "hello"
```

## Tool Configuration

### Global Tool Settings

```json
{
  "tools": {
    "enabled": ["file", "shell", "search", "git"],
    "disabled": [],
    "timeout": 30000,
    "max_output": 10000
  }
}
```

### File Tool Settings

```json
{
  "tools": {
    "file": {
      "max_size": 1048576,
      "encoding": "utf-8",
      "backup": true,
      "backup_suffix": ".bak"
    }
  }
}
```

### Shell Tool Settings

```json
{
  "tools": {
    "shell": {
      "enabled": true,
      "shell": "/bin/bash",
      "timeout": 30000,
      "allowed_commands": ["npm", "yarn", "git", "node"],
      "blocked_commands": ["rm -rf /", "sudo"],
      "require_confirmation": true,
      "show_output": true
    }
  }
}
```

### Search Tool Settings

```json
{
  "tools": {
    "search": {
      "case_sensitive": false,
      "whole_word": false,
      "regex": true,
      "max_results": 100,
      "exclude_patterns": ["node_modules", ".git"]
    }
  }
}
```

### Browser Tool Settings

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "headless": true,
      "timeout": 30000,
      "viewport": {
        "width": 1280,
        "height": 720
      }
    }
  }
}
```

---

**Tool Quick Reference**

```
File:
read_file, write_file, edit_file, list_directory, file_info

Execution:
shell

Search:
search, grep, find

Git:
git_status, git_log, git_diff, git_add, git_commit

Browser:
browser_visit, browser_click, browser_find, browser_scroll, browser_screenshot

Analysis:
analyze_code, lint_code, format_code, run_tests, type_check

Utility:
calculator, datetime, uuid, hash, encode_decode
```
