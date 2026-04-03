# Testing Guide

Comprehensive guide to testing Claude Code Clone and its extensions.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Types](#test-types)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Test Utilities](#test-utilities)
7. [Mocking](#mocking)
8. [Test Patterns](#test-patterns)
9. [Coverage](#coverage)
10. [CI/CD Testing](#cicd-testing)

## Testing Overview

### Testing Philosophy

- **Test early, test often**: Write tests alongside code
- **Test behavior, not implementation**: Focus on what, not how
- **Maintainable tests**: Tests should be easy to understand and update
- **Fast feedback**: Tests should run quickly

### Test Pyramid

```
       /\
      /  \     E2E Tests (Few)
     /----\
    /      \   Integration Tests (Some)
   /--------\
  /          \ Unit Tests (Many)
 /------------\
```

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── core/               # Core module tests
│   ├── tools/              # Tool tests
│   ├── ai/                 # AI module tests
│   └── utils/              # Utility tests
├── integration/            # Integration tests
│   ├── api/                # API integration
│   ├── cli/                # CLI integration
│   └── plugins/            # Plugin integration
├── e2e/                    # End-to-end tests
│   ├── scenarios/          # User scenarios
│   └── workflows/          # Complete workflows
├── fixtures/               # Test data
└── helpers/                # Test utilities
```

## Test Types

### Unit Tests

Test individual functions and classes in isolation.

```typescript
// tests/unit/tools/file.test.ts
import { readFile } from '../../../src/tools/file';

describe('readFile', () => {
  it('should read file contents', async () => {
    const result = await readFile({
      file_path: 'tests/fixtures/sample.txt'
    });
    
    expect(result.content).toBe('Hello, World!');
    expect(result.size).toBe(13);
  });
  
  it('should read specific lines', async () => {
    const result = await readFile({
      file_path: 'tests/fixtures/multi-line.txt',
      offset: 2,
      limit: 3
    });
    
    expect(result.content).toBe('Line 2\nLine 3\nLine 4');
  });
  
  it('should throw on missing file', async () => {
    await expect(readFile({
      file_path: 'nonexistent.txt'
    })).rejects.toThrow('File not found');
  });
  
  it('should throw on directory', async () => {
    await expect(readFile({
      file_path: 'tests/fixtures'
    })).rejects.toThrow('Path is a directory');
  });
});
```

### Integration Tests

Test how components work together.

```typescript
// tests/integration/session.test.ts
import { SessionManager } from '../../src/core/session';
import { ContextManager } from '../../src/core/context';

describe('Session Integration', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });
  
  it('should create session with context', async () => {
    const session = await sessionManager.createSession({
      name: 'test-session'
    });
    
    await contextManager.initialize(session);
    
    expect(session.id).toBeDefined();
    expect(contextManager.getContext()).toBeDefined();
  });
  
  it('should persist and restore session', async () => {
    const session = await sessionManager.createSession({
      name: 'persist-test'
    });
    
    await sessionManager.saveSession(session.id);
    
    const restored = await sessionManager.loadSession(session.id);
    
    expect(restored.name).toBe('persist-test');
  });
});
```

### E2E Tests

Test complete user workflows.

```typescript
// tests/e2e/basic-workflow.test.ts
import { CLI } from '../helpers/cli';

describe('Basic Workflow', () => {
  let cli: CLI;
  
  beforeEach(async () => {
    cli = new CLI();
    await cli.start();
  });
  
  afterEach(async () => {
    await cli.stop();
  });
  
  it('should complete basic query workflow', async () => {
    // Start session
    await cli.type('/start test-session');
    await cli.expect('Session started');
    
    // Ask a question
    await cli.type('What files are in this project?');
    await cli.expect('package.json');
    
    // Save session
    await cli.type('/save');
    await cli.expect('Session saved');
  });
  
  it('should handle file operations', async () => {
    await cli.type('Create a file test.txt with "Hello"');
    await cli.expect('File created');
    
    await cli.type('Read test.txt');
    await cli.expect('Hello');
    
    await cli.type('Delete test.txt');
    await cli.expect('File deleted');
  });
});
```

## Unit Testing

### Testing Tools

```typescript
// tests/unit/tools/shell.test.ts
import { shell } from '../../../src/tools/shell';

describe('shell tool', () => {
  it('should execute command successfully', async () => {
    const result = await shell({
      command: 'echo "hello"'
    });
    
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
  });
  
  it('should handle command failure', async () => {
    const result = await shell({
      command: 'exit 1'
    });
    
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });
  
  it('should respect timeout', async () => {
    await expect(shell({
      command: 'sleep 10',
      timeout: 100
    })).rejects.toThrow('Timeout');
  });
  
  it('should set working directory', async () => {
    const result = await shell({
      command: 'pwd',
      cwd: '/tmp'
    });
    
    expect(result.stdout.trim()).toBe('/tmp');
  });
});
```

### Testing Core Components

```typescript
// tests/unit/core/context.test.ts
import { ContextManager } from '../../../src/core/context';

describe('ContextManager', () => {
  let manager: ContextManager;
  
  beforeEach(() => {
    manager = new ContextManager();
  });
  
  describe('addFile', () => {
    it('should add file to context', async () => {
      await manager.addFile('src/main.js');
      
      expect(manager.getContext().files).toContain('src/main.js');
    });
    
    it('should parse imports', async () => {
      await manager.addFile('src/main.js');
      
      const context = manager.getContext();
      expect(context.imports).toBeDefined();
    });
    
    it('should not add duplicate files', async () => {
      await manager.addFile('src/main.js');
      await manager.addFile('src/main.js');
      
      expect(manager.getContext().files).toHaveLength(1);
    });
  });
  
  describe('buildContext', () => {
    it('should include project context', async () => {
      const context = await manager.buildContext({
        query: 'test query'
      });
      
      expect(context.project).toBeDefined();
      expect(context.files).toBeDefined();
      expect(conversation).toBeDefined();
    });
    
    it('should respect max files limit', async () => {
      manager.config.maxFiles = 2;
      
      await manager.addFile('file1.js');
      await manager.addFile('file2.js');
      await manager.addFile('file3.js');
      
      const context = manager.getContext();
      expect(context.files).toHaveLength(2);
    });
  });
});
```

### Testing with Dependencies

```typescript
// tests/unit/ai/client.test.ts
import { AIClient } from '../../../src/ai/client';
import { MockProvider } from '../../mocks/ai-provider';

describe('AIClient', () => {
  let client: AIClient;
  let mockProvider: MockProvider;
  
  beforeEach(() => {
    mockProvider = new MockProvider();
    client = new AIClient(mockProvider);
  });
  
  it('should complete request', async () => {
    mockProvider.setResponse({
      content: 'Test response'
    });
    
    const result = await client.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    });
    
    expect(result.content).toBe('Test response');
  });
  
  it('should handle errors', async () => {
    mockProvider.setError(new Error('API Error'));
    
    await expect(client.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow('API Error');
  });
  
  it('should track token usage', async () => {
    mockProvider.setResponse({
      content: 'Response',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      }
    });
    
    const result = await client.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    });
    
    expect(result.usage.totalTokens).toBe(15);
  });
});
```

## Integration Testing

### API Integration

```typescript
// tests/integration/api/anthropic.test.ts
import { AnthropicProvider } from '../../../src/ai/providers/anthropic';

describe('Anthropic API Integration', () => {
  let provider: AnthropicProvider;
  
  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  });
  
  it('should complete with real API', async () => {
    const result = await provider.complete({
      messages: [
        { role: 'user', content: 'Say "Hello, World!"' }
      ],
      model: 'claude-3-haiku-20240307',
      maxTokens: 100
    });
    
    expect(result.content).toContain('Hello');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  }, 30000);
  
  it('should stream responses', async () => {
    const chunks: string[] = [];
    
    for await (const chunk of provider.stream({
      messages: [{ role: 'user', content: 'Count to 3' }],
      model: 'claude-3-haiku-20240307'
    })) {
      chunks.push(chunk.content);
    }
    
    const fullResponse = chunks.join('');
    expect(fullResponse).toContain('1');
    expect(fullResponse).toContain('2');
    expect(fullResponse).toContain('3');
  }, 30000);
});
```

### Plugin Integration

```typescript
// tests/integration/plugins/sample.test.ts
import { PluginManager } from '../../../src/plugins/PluginManager';
import { SamplePlugin } from '../../fixtures/plugins/sample';

describe('Plugin Integration', () => {
  let manager: PluginManager;
  
  beforeEach(() => {
    manager = new PluginManager();
  });
  
  it('should load and initialize plugin', async () => {
    const plugin = new SamplePlugin();
    
    await manager.load(plugin);
    
    expect(plugin.initialized).toBe(true);
  });
  
  it('should register plugin tools', async () => {
    const plugin = new SamplePlugin();
    
    await manager.load(plugin);
    
    const tool = manager.getTool('sample-tool');
    expect(tool).toBeDefined();
  });
  
  it('should execute plugin tool', async () => {
    const plugin = new SamplePlugin();
    await manager.load(plugin);
    
    const result = await manager.executeTool('sample-tool', {
      input: 'test'
    });
    
    expect(result.success).toBe(true);
  });
});
```

## E2E Testing

### CLI Testing

```typescript
// tests/e2e/cli/basic.test.ts
import { spawn } from 'child_process';
import { CLIHelper } from '../../helpers/cli-helper';

describe('CLI E2E', () => {
  let cli: CLIHelper;
  
  beforeEach(async () => {
    cli = new CLIHelper();
    await cli.start();
  });
  
  afterEach(async () => {
    await cli.stop();
  });
  
  it('should start and show welcome', async () => {
    const output = await cli.waitForOutput('Welcome to Claude Code Clone');
    expect(output).toContain('Welcome');
  });
  
  it('should process natural language query', async () => {
    await cli.type('What is 2 + 2?');
    
    const response = await cli.waitForResponse();
    expect(response).toContain('4');
  });
  
  it('should execute slash command', async () => {
    await cli.type('/help');
    
    const output = await cli.waitForOutput('Available commands');
    expect(output).toContain('commands');
  });
});
```

### Workflow Testing

```typescript
// tests/e2e/workflows/development.test.ts
describe('Development Workflow', () => {
  let cli: CLIHelper;
  
  beforeAll(async () => {
    cli = new CLIHelper();
    await cli.start();
  });
  
  afterAll(async () => {
    await cli.stop();
  });
  
  it('should complete feature development workflow', async () => {
    // 1. Explore project
    await cli.type('What is the project structure?');
    await cli.waitForResponse();
    
    // 2. Create new component
    await cli.type('Create a Button component in src/components/');
    const createResponse = await cli.waitForResponse();
    expect(createResponse).toContain('created');
    
    // 3. Add tests
    await cli.type('Create tests for the Button component');
    const testResponse = await cli.waitForResponse();
    expect(testResponse).toContain('test');
    
    // 4. Run tests
    await cli.type('/test');
    const testResult = await cli.waitForResponse();
    expect(testResult).toContain('pass');
  }, 120000);
});
```

## Test Utilities

### Test Helpers

```typescript
// tests/helpers/file-helper.ts
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export class TestFileHelper {
  private tempDir: string;
  
  constructor() {
    this.tempDir = join(tmpdir(), `claude-test-${Date.now()}`);
  }
  
  async setup() {
    await mkdir(this.tempDir, { recursive: true });
    return this.tempDir;
  }
  
  async createFile(path: string, content: string) {
    const fullPath = join(this.tempDir, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content);
    return fullPath;
  }
  
  async cleanup() {
    await rm(this.tempDir, { recursive: true, force: true });
  }
  
  getPath(relativePath: string): string {
    return join(this.tempDir, relativePath);
  }
}
```

### Mock Factories

```typescript
// tests/helpers/mocks.ts
import { Session } from '../../src/core/session';
import { Message } from '../../src/types';

export function createMockSession(overrides = {}): Session {
  return {
    id: 'test-session-' + Date.now(),
    name: 'Test Session',
    createdAt: new Date(),
    messages: [],
    ...overrides
  };
}

export function createMockMessage(overrides = {}): Message {
  return {
    id: 'msg-' + Date.now(),
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides
  };
}

export function createMockContext(overrides = {}) {
  return {
    event: 'test-event',
    timestamp: new Date(),
    logger: createMockLogger(),
    config: createMockConfig(),
    ...overrides
  };
}
```

## Mocking

### Mocking External APIs

```typescript
// tests/mocks/anthropic.ts
export class MockAnthropicClient {
  private responses: Map<string, any> = new Map();
  private errors: Map<string, Error> = new Map();
  
  setResponse(key: string, response: any) {
    this.responses.set(key, response);
  }
  
  setError(key: string, error: Error) {
    this.errors.set(key, error);
  }
  
  async complete(request: any) {
    const key = JSON.stringify(request.messages);
    
    if (this.errors.has(key)) {
      throw this.errors.get(key);
    }
    
    return this.responses.get(key) || {
      content: 'Default response',
      usage: { totalTokens: 10 }
    };
  }
  
  async *stream(request: any) {
    const response = await this.complete(request);
    yield { content: response.content };
  }
}
```

### Mocking File System

```typescript
// tests/mocks/fs.ts
import { jest } from '@jest/globals';

export function mockFs(files: Record<string, string>) {
  const mockReadFile = jest.fn();
  const mockWriteFile = jest.fn();
  const mockExists = jest.fn();
  
  mockReadFile.mockImplementation((path: string) => {
    if (files[path]) {
      return Promise.resolve(files[path]);
    }
    return Promise.reject(new Error('File not found'));
  });
  
  mockExists.mockImplementation((path: string) => {
    return Promise.resolve(path in files);
  });
  
  jest.mock('fs/promises', () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    access: mockExists
  }));
  
  return { mockReadFile, mockWriteFile, mockExists };
}
```

## Test Patterns

### AAA Pattern

```typescript
// Arrange, Act, Assert
it('should process request', async () => {
  // Arrange
  const processor = new RequestProcessor();
  const request = createMockRequest();
  
  // Act
  const result = await processor.process(request);
  
  // Assert
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
});
```

### Given-When-Then

```typescript
it('should save session', async () => {
  // Given
  const session = createMockSession({ name: 'test' });
  const manager = new SessionManager();
  
  // When
  await manager.save(session);
  
  // Then
  const saved = await manager.load(session.id);
  expect(saved.name).toBe('test');
});
```

### Table-Driven Tests

```typescript
it.each([
  ['valid@email.com', true],
  ['invalid-email', false],
  ['@nodomain.com', false],
  ['spaces in@email.com', false]
])('should validate email %s as %s', (email, expected) => {
  expect(validateEmail(email)).toBe(expected);
});
```

## Coverage

### Coverage Configuration

```json
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html']
};
```

### Running Coverage

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Check coverage for specific file
npm run test:coverage -- --collectCoverageFrom="src/tools/file.ts"
```

## CI/CD Testing

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

**Testing Quick Reference**

```
Commands:
  npm test              # Run all tests
  npm run test:unit     # Unit tests only
  npm run test:int      # Integration tests
  npm run test:e2e      # E2E tests
  npm run test:watch    # Watch mode
  npm run test:coverage # With coverage

Structure:
  tests/
    unit/        # Unit tests
    integration/ # Integration tests
    e2e/         # E2E tests
    fixtures/    # Test data
    helpers/     # Test utilities

Patterns:
  AAA: Arrange, Act, Assert
  Given-When-Then
  Table-driven tests
```
