/**
 * Tool Execution Performance Tests
 * Performance benchmarks for tool execution operations
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, benchmark, PerformanceTimer } from '../setup';
import { MockToolRegistry, createMockTools } from '../mocks/MockTools';
import { MockFS, createSampleProjectFS } from '../mocks/MockFS';

// ============================================================================
// Test Suite
// ============================================================================

describe('Tool Execution Performance', () => {
  let tools: MockToolRegistry;
  let fs: MockFS;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    tools = createMockTools();
    fs = createSampleProjectFS();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Single Tool Execution Performance
  // ============================================================================

  describe('Single Tool Execution', () => {
    test('should execute file_read 1000 times efficiently', async () => {
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/perf-test.txt', 'Performance test content');

      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        await tools.execute('file_read', { path: '/perf-test.txt' });
      }

      timer.mark('end');
      const duration = timer.measure('read', 'start', 'end');

      expect(duration).toBeLessThan(5000);
    });

    test('should execute file_write 1000 times efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        await tools.execute('file_write', {
          path: `/perf-write-${i}.txt`,
          content: `Content ${i}`,
        });
      }

      timer.mark('end');
      const duration = timer.measure('write', 'start', 'end');

      expect(duration).toBeLessThan(5000);
    });

    test('benchmark single file_read', async () => {
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/bench.txt', 'Benchmark content');

      const stats = await benchmark(async () => {
        await tools.execute('file_read', { path: '/bench.txt' });
      }, 1000);

      expect(stats.mean).toBeLessThan(5);
    });

    test('benchmark single file_write', async () => {
      let counter = 0;
      const stats = await benchmark(async () => {
        await tools.execute('file_write', {
          path: `/bench-${counter++}.txt`,
          content: 'Benchmark',
        });
      }, 500);

      expect(stats.mean).toBeLessThan(10);
    });
  });

  // ============================================================================
  // Search Tool Performance
  // ============================================================================

  describe('Search Tool Performance', () => {
    beforeEach(() => {
      // Set up searchable content
      const grepTool = tools.get('grep')!;
      for (let i = 0; i < 100; i++) {
        grepTool.addSearchableFile(
          `/src/file${i}.ts`,
          `export function func${i}() { return ${i}; }\n`.repeat(100)
        );
      }
    });

    test('should search large codebase efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      const result = await tools.execute('grep', {
        pattern: 'export',
        path: '/src',
      });

      timer.mark('end');
      const duration = timer.measure('search', 'start', 'end');

      expect((result as { data: { matches: unknown[] } }).data.matches.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000);
    });

    test('benchmark grep operation', async () => {
      const stats = await benchmark(async () => {
        await tools.execute('grep', {
          pattern: 'function',
          path: '/src',
        });
      }, 100);

      expect(stats.mean).toBeLessThan(100);
    });
  });

  // ============================================================================
  // Concurrent Execution Performance
  // ============================================================================

  describe('Concurrent Execution', () => {
    test('should handle 100 concurrent file reads', async () => {
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/concurrent.txt', 'Concurrent test');

      const timer = new PerformanceTimer();
      timer.mark('start');

      const promises = Array.from({ length: 100 }, () =>
        tools.execute('file_read', { path: '/concurrent.txt' })
      );

      await Promise.all(promises);

      timer.mark('end');
      const duration = timer.measure('concurrent', 'start', 'end');

      expect(duration).toBeLessThan(1000);
    });

    test('should handle 100 concurrent file writes', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      const promises = Array.from({ length: 100 }, (_, i) =>
        tools.execute('file_write', {
          path: `/concurrent-${i}.txt`,
          content: `Content ${i}`,
        })
      );

      await Promise.all(promises);

      timer.mark('end');
      const duration = timer.measure('concurrent-write', 'start', 'end');

      expect(duration).toBeLessThan(2000);
    });

    test('should handle mixed concurrent operations', async () => {
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/mixed.txt', 'Mixed test');

      const timer = new PerformanceTimer();
      timer.mark('start');

      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 50; i++) {
        promises.push(tools.execute('file_read', { path: '/mixed.txt' }));
        promises.push(tools.execute('file_write', {
          path: `/mixed-write-${i}.txt`,
          content: 'Content',
        }));
        promises.push(tools.execute('bash', { command: 'echo test' }));
      }

      await Promise.all(promises);

      timer.mark('end');
      const duration = timer.measure('mixed', 'start', 'end');

      expect(duration).toBeLessThan(3000);
    });
  });

  // ============================================================================
  // Batch Execution Performance
  // ============================================================================

  describe('Batch Execution', () => {
    test('should execute 1000 operations sequentially', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        await tools.execute('bash', { command: `echo ${i}` });
      }

      timer.mark('end');
      const duration = timer.measure('sequential', 'start', 'end');

      expect(duration).toBeLessThan(5000);
    });

    test('should execute tool chain efficiently', async () => {
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/chain.txt', 'Chain test');

      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 100; i++) {
        await tools.execute('file_read', { path: '/chain.txt' });
        await tools.execute('file_write', {
          path: `/chain-out-${i}.txt`,
          content: 'Output',
        });
        await tools.execute('bash', { command: 'echo done' });
      }

      timer.mark('end');
      const duration = timer.measure('chain', 'start', 'end');

      expect(duration).toBeLessThan(3000);
    });
  });

  // ============================================================================
  // Large File Performance
  // ============================================================================

  describe('Large File Operations', () => {
    test('should handle 1MB file read', async () => {
      const largeContent = 'x'.repeat(1024 * 1024);
      const readTool = tools.get('file_read')!;
      readTool.setFileContent('/large.txt', largeContent);

      const timer = new PerformanceTimer();
      timer.mark('start');

      const result = await tools.execute('file_read', { path: '/large.txt' });

      timer.mark('end');
      const duration = timer.measure('large-read', 'start', 'end');

      expect((result as { success: boolean }).success).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    test('should handle 1MB file write', async () => {
      const largeContent = 'x'.repeat(1024 * 1024);

      const timer = new PerformanceTimer();
      timer.mark('start');

      const result = await tools.execute('file_write', {
        path: '/large-write.txt',
        content: largeContent,
      });

      timer.mark('end');
      const duration = timer.measure('large-write', 'start', 'end');

      expect((result as { success: boolean }).success).toBe(true);
      expect(duration).toBeLessThan(500);
    });
  });

  // ============================================================================
  // Memory Usage
  // ============================================================================

  describe('Memory Usage', () => {
    test('should handle 10000 file operations', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 10000; i++) {
        await tools.execute('file_write', {
          path: `/mem-test-${i}.txt`,
          content: `Content ${i}`,
        });
      }

      timer.mark('end');
      const duration = timer.measure('memory', 'start', 'end');

      expect(duration).toBeLessThan(10000);
    });

    test('should handle rapid tool registry operations', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        tools.get('file_read');
        tools.get('file_write');
        tools.get('bash');
        tools.get('grep');
        tools.get('list');
      }

      timer.mark('end');
      const duration = timer.measure('registry', 'start', 'end');

      expect(duration).toBeLessThan(1000);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty operations efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        await tools.execute('bash', { command: '' });
      }

      timer.mark('end');
      const duration = timer.measure('empty', 'start', 'end');

      expect(duration).toBeLessThan(2000);
    });

    test('should handle error cases efficiently', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let i = 0; i < 1000; i++) {
        try {
          await tools.execute('file_read', { path: '/non-existent.txt' });
        } catch {
          // Expected
        }
      }

      timer.mark('end');
      const duration = timer.measure('errors', 'start', 'end');

      expect(duration).toBeLessThan(3000);
    });

    test('should handle rapid reset and re-execution', async () => {
      const timer = new PerformanceTimer();
      timer.mark('start');

      for (let cycle = 0; cycle < 100; cycle++) {
        tools.resetAll();
        await tools.execute('file_write', {
          path: '/reset-test.txt',
          content: 'Test',
        });
      }

      timer.mark('end');
      const duration = timer.measure('reset', 'start', 'end');

      expect(duration).toBeLessThan(2000);
    });
  });
});
