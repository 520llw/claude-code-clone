/**
 * UI Hooks Unit Tests
 * Tests for custom React/Vue hooks
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, wait } from '../../setup';

// ============================================================================
// Mock Hook Implementations
// ============================================================================

// Mock useState implementation
function createMockState<T>(initialValue: T): {
  value: T;
  setValue: (newValue: T | ((prev: T) => T)) => void;
  listeners: Array<(value: T) => void>;
  subscribe: (listener: (value: T) => void) => () => void;
} {
  let value = initialValue;
  const listeners: Array<(value: T) => void> = [];

  const setValue = (newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      value = (newValue as (prev: T) => T)(value);
    } else {
      value = newValue;
    }
    listeners.forEach(listener => listener(value));
  };

  const subscribe = (listener: (value: T) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  };

  return {
    get value() { return value; },
    setValue,
    listeners,
    subscribe,
  };
}

// Mock useEffect implementation
class MockEffectHook {
  private effects: Array<{
    effect: () => (() => void) | void;
    deps: unknown[];
    cleanup?: () => void;
  }> = [];

  useEffect(effect: () => (() => void) | void, deps?: unknown[]): void {
    const existingIndex = this.effects.findIndex(e => e.effect === effect);
    
    if (existingIndex >= 0) {
      const existing = this.effects[existingIndex];
      if (!this.depsEqual(existing.deps, deps)) {
        // Dependencies changed, run cleanup and re-run effect
        existing.cleanup?.();
        existing.cleanup = effect() || undefined;
        existing.deps = deps || [];
      }
    } else {
      // New effect
      const cleanup = effect();
      this.effects.push({
        effect,
        deps: deps || [],
        cleanup: cleanup || undefined,
      });
    }
  }

  cleanupAll(): void {
    this.effects.forEach(e => e.cleanup?.());
    this.effects = [];
  }

  private depsEqual(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }
}

// Mock useMessages hook
class MockUseMessagesHook {
  private messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }> = [];

  private listeners: Array<(messages: typeof this.messages) => void> = [];

  addMessage(role: string, content: string): void {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    this.notifyListeners();
  }

  updateMessage(id: string, updates: Partial<{ content: string }>): boolean {
    const message = this.messages.find(m => m.id === id);
    if (!message) return false;
    Object.assign(message, updates);
    this.notifyListeners();
    return true;
  }

  clearMessages(): void {
    this.messages = [];
    this.notifyListeners();
  }

  getMessages(): typeof this.messages {
    return [...this.messages];
  }

  subscribe(listener: (messages: typeof this.messages) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.messages]));
  }
}

// Mock useStreaming hook
class MockUseStreamingHook {
  private content = '';
  private isStreaming = false;
  private listeners: Array<(state: { content: string; isStreaming: boolean }) => void> = [];

  startStream(): void {
    this.isStreaming = true;
    this.content = '';
    this.notifyListeners();
  }

  appendChunk(chunk: string): void {
    this.content += chunk;
    this.notifyListeners();
  }

  endStream(): void {
    this.isStreaming = false;
    this.notifyListeners();
  }

  getState(): { content: string; isStreaming: boolean } {
    return { content: this.content, isStreaming: this.isStreaming };
  }

  subscribe(listener: (state: { content: string; isStreaming: boolean }) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }
}

// Mock useToolExecution hook
class MockUseToolExecutionHook {
  private tools: Map<string, {
    status: 'idle' | 'running' | 'completed' | 'error';
    result?: unknown;
    error?: string;
  }> = new Map();

  private listeners: Array<(tools: typeof this.tools) => void> = [];

  async executeTool(name: string, args: unknown): Promise<unknown> {
    this.tools.set(name, { status: 'running' });
    this.notifyListeners();

    // Simulate execution
    await wait(10);

    const result = { success: true, data: `Result of ${name}` };
    this.tools.set(name, { status: 'completed', result });
    this.notifyListeners();

    return result;
  }

  getToolState(name: string): { status: string; result?: unknown; error?: string } | undefined {
    return this.tools.get(name);
  }

  subscribe(listener: (tools: typeof this.tools) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(new Map(this.tools)));
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UI Hooks', () => {
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // useState Tests
  // ============================================================================

  describe('useState Hook', () => {
    test('should initialize with initial value', () => {
      const state = createMockState('initial');

      expect(state.value).toBe('initial');
    });

    test('should update value', () => {
      const state = createMockState('initial');

      state.setValue('updated');

      expect(state.value).toBe('updated');
    });

    test('should support functional updates', () => {
      const state = createMockState(0);

      state.setValue(prev => prev + 1);
      state.setValue(prev => prev + 1);

      expect(state.value).toBe(2);
    });

    test('should notify subscribers on change', () => {
      const state = createMockState('initial');
      const changes: string[] = [];

      state.subscribe(value => changes.push(value));
      state.setValue('changed');

      expect(changes).toContain('changed');
    });

    test('should allow unsubscribing', () => {
      const state = createMockState('initial');
      const changes: string[] = [];

      const unsubscribe = state.subscribe(value => changes.push(value));
      unsubscribe();
      state.setValue('changed');

      expect(changes).toHaveLength(1);
    });
  });

  // ============================================================================
  // useEffect Tests
  // ============================================================================

  describe('useEffect Hook', () => {
    test('should run effect on first call', () => {
      const hook = new MockEffectHook();
      let effectRan = false;

      hook.useEffect(() => {
        effectRan = true;
      }, []);

      expect(effectRan).toBe(true);
    });

    test('should run cleanup on unmount', () => {
      const hook = new MockEffectHook();
      let cleanupRan = false;

      hook.useEffect(() => {
        return () => { cleanupRan = true; };
      }, []);

      hook.cleanupAll();

      expect(cleanupRan).toBe(true);
    });

    test('should re-run when dependencies change', () => {
      const hook = new MockEffectHook();
      let runCount = 0;

      const runEffect = (dep: number) => {
        hook.useEffect(() => {
          runCount++;
        }, [dep]);
      };

      runEffect(1);
      runEffect(2);
      runEffect(3);

      expect(runCount).toBe(3);
    });

    test('should not re-run when dependencies are same', () => {
      const hook = new MockEffectHook();
      let runCount = 0;

      const runEffect = (dep: number) => {
        hook.useEffect(() => {
          runCount++;
        }, [dep]);
      };

      runEffect(1);
      runEffect(1);
      runEffect(1);

      expect(runCount).toBe(1);
    });
  });

  // ============================================================================
  // useMessages Tests
  // ============================================================================

  describe('useMessages Hook', () => {
    test('should start with empty messages', () => {
      const hook = new MockUseMessagesHook();

      expect(hook.getMessages()).toHaveLength(0);
    });

    test('should add message', () => {
      const hook = new MockUseMessagesHook();

      hook.addMessage('user', 'Hello');

      expect(hook.getMessages()).toHaveLength(1);
      expect(hook.getMessages()[0].content).toBe('Hello');
    });

    test('should add multiple messages', () => {
      const hook = new MockUseMessagesHook();

      hook.addMessage('user', 'Hello');
      hook.addMessage('assistant', 'Hi!');
      hook.addMessage('user', 'How are you?');

      expect(hook.getMessages()).toHaveLength(3);
    });

    test('should update message', () => {
      const hook = new MockUseMessagesHook();
      hook.addMessage('assistant', 'Typin...');

      const id = hook.getMessages()[0].id;
      hook.updateMessage(id, { content: 'Typing complete!' });

      expect(hook.getMessages()[0].content).toBe('Typing complete!');
    });

    test('should clear all messages', () => {
      const hook = new MockUseMessagesHook();
      hook.addMessage('user', 'Hello');
      hook.addMessage('assistant', 'Hi!');

      hook.clearMessages();

      expect(hook.getMessages()).toHaveLength(0);
    });

    test('should notify subscribers on add', () => {
      const hook = new MockUseMessagesHook();
      let messageCount = 0;

      hook.subscribe(messages => { messageCount = messages.length; });
      hook.addMessage('user', 'Test');

      expect(messageCount).toBe(1);
    });

    test('should generate unique ids', () => {
      const hook = new MockUseMessagesHook();

      hook.addMessage('user', 'Message 1');
      hook.addMessage('user', 'Message 2');

      const ids = hook.getMessages().map(m => m.id);
      expect(new Set(ids).size).toBe(2);
    });
  });

  // ============================================================================
  // useStreaming Tests
  // ============================================================================

  describe('useStreaming Hook', () => {
    test('should start with empty content', () => {
      const hook = new MockUseStreamingHook();

      expect(hook.getState().content).toBe('');
      expect(hook.getState().isStreaming).toBe(false);
    });

    test('should start stream', () => {
      const hook = new MockUseStreamingHook();

      hook.startStream();

      expect(hook.getState().isStreaming).toBe(true);
    });

    test('should append chunks', () => {
      const hook = new MockUseStreamingHook();
      hook.startStream();

      hook.appendChunk('Hello');
      hook.appendChunk(' ');
      hook.appendChunk('World');

      expect(hook.getState().content).toBe('Hello World');
    });

    test('should end stream', () => {
      const hook = new MockUseStreamingHook();
      hook.startStream();

      hook.endStream();

      expect(hook.getState().isStreaming).toBe(false);
    });

    test('should notify subscribers', () => {
      const hook = new MockUseStreamingHook();
      let receivedContent = '';

      hook.subscribe(state => { receivedContent = state.content; });
      hook.startStream();
      hook.appendChunk('Test');

      expect(receivedContent).toBe('Test');
    });
  });

  // ============================================================================
  // useToolExecution Tests
  // ============================================================================

  describe('useToolExecution Hook', () => {
    test('should start with no tools', () => {
      const hook = new MockUseToolExecutionHook();

      expect(hook.getToolState('any')).toBeUndefined();
    });

    test('should execute tool', async () => {
      const hook = new MockUseToolExecutionHook();

      const result = await hook.executeTool('file_read', { path: '/test.txt' });

      expect(result).toBeDefined();
    });

    test('should track tool status', async () => {
      const hook = new MockUseToolExecutionHook();

      const executePromise = hook.executeTool('file_read', { path: '/test.txt' });
      
      expect(hook.getToolState('file_read')?.status).toBe('running');

      await executePromise;

      expect(hook.getToolState('file_read')?.status).toBe('completed');
    });

    test('should store tool result', async () => {
      const hook = new MockUseToolExecutionHook();

      await hook.executeTool('file_read', { path: '/test.txt' });

      const state = hook.getToolState('file_read');
      expect(state?.result).toBeDefined();
    });

    test('should notify subscribers', async () => {
      const hook = new MockUseToolExecutionHook();
      let toolCount = 0;

      hook.subscribe(tools => { toolCount = tools.size; });
      await hook.executeTool('file_read', { path: '/test.txt' });

      expect(toolCount).toBe(1);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle rapid state updates', () => {
      const state = createMockState(0);
      const values: number[] = [];

      state.subscribe(v => values.push(v));

      for (let i = 0; i < 100; i++) {
        state.setValue(i);
      }

      expect(values.length).toBe(101);
    });

    test('should handle multiple subscribers', () => {
      const state = createMockState('initial');
      const values1: string[] = [];
      const values2: string[] = [];

      state.subscribe(v => values1.push(v));
      state.subscribe(v => values2.push(v));

      state.setValue('changed');

      expect(values1).toContain('changed');
      expect(values2).toContain('changed');
    });

    test('should handle empty dependency array', () => {
      const hook = new MockEffectHook();
      let runCount = 0;

      hook.useEffect(() => { runCount++; }, []);
      hook.useEffect(() => { runCount++; }, []);
      hook.useEffect(() => { runCount++; }, []);

      expect(runCount).toBe(1);
    });

    test('should handle undefined dependencies', () => {
      const hook = new MockEffectHook();
      let runCount = 0;

      hook.useEffect(() => { runCount++; });
      hook.useEffect(() => { runCount++; });

      expect(runCount).toBe(2);
    });

    test('should handle message update for non-existent id', () => {
      const hook = new MockUseMessagesHook();

      const result = hook.updateMessage('non-existent', { content: 'Test' });

      expect(result).toBe(false);
    });

    test('should handle streaming without start', () => {
      const hook = new MockUseStreamingHook();

      hook.appendChunk('Test');

      expect(hook.getState().content).toBe('Test');
    });
  });
});
