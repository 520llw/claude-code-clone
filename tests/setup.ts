/**
 * Test Setup for Claude Code Clone
 * 
 * This file configures the testing environment, sets up global mocks,
 * and provides utility functions for all test suites.
 */

import { jest } from '@jest/globals';
import { MockLLM } from './mocks/MockLLM';
import { MockTools } from './mocks/MockTools';
import { MockFS } from './mocks/MockFS';

// ============================================================================
// Global Test Configuration
// ============================================================================

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Suppress console output during tests unless explicitly enabled
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

if (process.env.TEST_VERBOSE !== 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// ============================================================================
// Global Mocks
// ============================================================================

// Mock environment variables
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';

// Mock fs module
global.mockFS = new MockFS();

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn((path: string, encoding?: string) => {
    return global.mockFS.readFileSync(path, encoding);
  }),
  writeFileSync: jest.fn((path: string, data: string | Buffer) => {
    return global.mockFS.writeFileSync(path, data);
  }),
  existsSync: jest.fn((path: string) => {
    return global.mockFS.existsSync(path);
  }),
  statSync: jest.fn((path: string) => {
    return global.mockFS.statSync(path);
  }),
  readdirSync: jest.fn((path: string) => {
    return global.mockFS.readdirSync(path);
  }),
  mkdirSync: jest.fn((path: string, options?: { recursive?: boolean }) => {
    return global.mockFS.mkdirSync(path, options);
  }),
  unlinkSync: jest.fn((path: string) => {
    return global.mockFS.unlinkSync(path);
  }),
  rmdirSync: jest.fn((path: string) => {
    return global.mockFS.rmdirSync(path);
  }),
  copyFileSync: jest.fn((src: string, dest: string) => {
    return global.mockFS.copyFileSync(src, dest);
  }),
  renameSync: jest.fn((oldPath: string, newPath: string) => {
    return global.mockFS.renameSync(oldPath, newPath);
  }),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(async (path: string, encoding?: string) => {
    return global.mockFS.readFile(path, encoding);
  }),
  writeFile: jest.fn(async (path: string, data: string | Buffer) => {
    return global.mockFS.writeFile(path, data);
  }),
  access: jest.fn(async (path: string) => {
    return global.mockFS.access(path);
  }),
  stat: jest.fn(async (path: string) => {
    return global.mockFS.stat(path);
  }),
  readdir: jest.fn(async (path: string) => {
    return global.mockFS.readdir(path);
  }),
  mkdir: jest.fn(async (path: string, options?: any) => {
    return global.mockFS.mkdir(path, options);
  }),
  unlink: jest.fn(async (path: string) => {
    return global.mockFS.unlink(path);
  }),
  rmdir: jest.fn(async (path: string) => {
    return global.mockFS.rmdir(path);
  }),
  copyFile: jest.fn(async (src: string, dest: string) => {
    return global.mockFS.copyFile(src, dest);
  }),
  rename: jest.fn(async (oldPath: string, newPath: string) => {
    return global.mockFS.rename(oldPath, newPath);
  }),
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, options: any, callback: Function) => {
    callback(null, { stdout: 'mock output', stderr: '' });
  }),
  execSync: jest.fn((cmd: string) => {
    return Buffer.from('mock output');
  }),
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn(), pipe: jest.fn() },
    stderr: { on: jest.fn(), pipe: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
  })),
}));

// Mock axios for API calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
      stream: jest.fn(),
    },
    completions: {
      create: jest.fn(),
    },
  })),
}));

// Mock OpenAI SDK
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
    completions: {
      create: jest.fn(),
    },
  })),
}));

// Mock glob
jest.mock('glob', () => ({
  glob: jest.fn(async (pattern: string) => []),
  globSync: jest.fn((pattern: string) => []),
}));

// Mock chalk for colored output
jest.mock('chalk', () => ({
  blue: jest.fn((text: string) => text),
  green: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  cyan: jest.fn((text: string) => text),
  magenta: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
  white: jest.fn((text: string) => text),
  bold: jest.fn((text: string) => text),
  italic: jest.fn((text: string) => text),
  underline: jest.fn((text: string) => text),
}));

// Mock inquirer for CLI prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  createPromptModule: jest.fn(() => jest.fn()),
}));

// Mock ora for loading spinners
jest.mock('ora', () => jest.fn(() => ({
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
  color: '',
})));

// ============================================================================
// Global Test Utilities
// ============================================================================

declare global {
  var mockFS: MockFS;
  var mockLLM: MockLLM;
  var mockTools: MockTools;
}

/**
 * Reset all mocks and state before each test
 */
export function resetMocks(): void {
  global.mockFS.reset();
  jest.clearAllMocks();
}

/**
 * Create a test fixture with common setup
 */
export function createTestFixture() {
  return {
    mockFS: global.mockFS,
    mockLLM: new MockLLM(),
    mockTools: new MockTools(),
    reset: resetMocks,
  };
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a delayed promise for async testing
 */
export function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

/**
 * Create a mock stream for testing streaming responses
 */
export function createMockStream<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

/**
 * Collect all items from an async iterable
 */
export async function collectAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Assert that a promise rejects with a specific error
 */
export async function assertRejects(
  promise: Promise<any>,
  expectedError: string | RegExp | ErrorConstructor
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error: any) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else if (expectedError instanceof RegExp) {
      expect(error.message).toMatch(expectedError);
    } else if (typeof expectedError === 'function') {
      expect(error).toBeInstanceOf(expectedError);
    }
  }
}

/**
 * Generate unique test IDs
 */
let testIdCounter = 0;
export function generateTestId(prefix = 'test'): string {
  return `${prefix}_${++testIdCounter}_${Date.now()}`;
}

/**
 * Create a mock file structure for testing
 */
export function createMockFileStructure(files: Record<string, string>): void {
  Object.entries(files).forEach(([path, content]) => {
    global.mockFS.writeFileSync(path, content);
  });
}

/**
 * Type guard utilities for testing
 */
export const typeGuards = {
  isString: (value: unknown): value is string => typeof value === 'string',
  isNumber: (value: unknown): value is number => typeof value === 'number',
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  isObject: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  isArray: (value: unknown): value is unknown[] => Array.isArray(value),
  isFunction: (value: unknown): value is Function => typeof value === 'function',
  isUndefined: (value: unknown): value is undefined => value === undefined,
  isNull: (value: unknown): value is null => value === null,
};

// ============================================================================
// Test Data Generators
// ============================================================================

export const testDataGenerators = {
  /**
   * Generate a mock message
   */
  message: (overrides = {}) => ({
    id: generateTestId('msg'),
    role: 'user' as const,
    content: 'Test message content',
    timestamp: Date.now(),
    ...overrides,
  }),

  /**
   * Generate a mock tool call
   */
  toolCall: (overrides = {}) => ({
    id: generateTestId('tool'),
    name: 'test_tool',
    arguments: {},
    ...overrides,
  }),

  /**
   * Generate a mock tool result
   */
  toolResult: (overrides = {}) => ({
    toolCallId: generateTestId('tool'),
    success: true,
    output: 'Test output',
    ...overrides,
  }),

  /**
   * Generate a mock session
   */
  session: (overrides = {}) => ({
    id: generateTestId('session'),
    name: 'Test Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    context: {},
    ...overrides,
  }),

  /**
   * Generate mock context
   */
  context: (overrides = {}) => ({
    workingDirectory: '/test',
    files: [],
    environment: {},
    metadata: {},
    ...overrides,
  }),
};

// ============================================================================
// Jest Matchers Extension
// ============================================================================

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeValidDate(received: unknown) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Date`,
        pass: false,
      };
    }
  },

  toBeAsyncFunction(received: unknown) {
    const pass =
      typeof received === 'function' &&
      received.constructor.name === 'AsyncFunction';
    if (pass) {
      return {
        message: () => `expected ${received} not to be an async function`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be an async function`,
        pass: false,
      };
    }
  },
});

// ============================================================================
// Cleanup
// ============================================================================

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Export everything for use in tests
export { MockLLM, MockTools, MockFS };
