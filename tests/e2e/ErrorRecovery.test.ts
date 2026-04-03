/**
 * Error Recovery End-to-End Tests
 * Tests for error handling and recovery scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestContext, cleanupTestContext } from '../setup';
import { MockLLMClient, createMockLLM } from '../mocks/MockLLM';
import { MockToolRegistry, createMockTools } from '../mocks/MockTools';
import { MockFS, createSampleProjectFS } from '../mocks/MockFS';

// ============================================================================
// Error Recovery Application
// ============================================================================

class ErrorRecoveryApp {
  llm: MockLLMClient;
  tools: MockToolRegistry;
  fs: MockFS;
  errorLog: Array<{
    error: string;
    recovered: boolean;
    strategy: string;
    timestamp: number;
  }> = [];
  recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();

  constructor() {
    this.llm = createMockLLM();
    this.tools = createMockTools();
    this.fs = createSampleProjectFS();
    this.setupRecoveryStrategies();
  }

  private setupRecoveryStrategies(): void {
    this.recoveryStrategies.set('file_not_found', async () => {
      // Create the missing file
      const writeTool = this.tools.get('file_write')!;
      await writeTool.execute({ path: '/recovered.txt', content: 'Recovered content' });
      return true;
    });

    this.recoveryStrategies.set('permission_denied', async () => {
      // Try with elevated permissions (simulated)
      return true;
    });

    this.recoveryStrategies.set('timeout', async () => {
      // Retry with longer timeout
      return true;
    });

    this.recoveryStrategies.set('network_error', async () => {
      // Retry the operation
      return true;
    });
  }

  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    errorType: string
  ): Promise<{ success: boolean; result?: T; recovered: boolean }> {
    try {
      const result = await operation();
      return { success: true, result, recovered: false };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Try recovery
      const strategy = this.recoveryStrategies.get(errorType);
      let recovered = false;
      
      if (strategy) {
        recovered = await strategy();
      }

      this.errorLog.push({
        error: errorMessage,
        recovered,
        strategy: errorType,
        timestamp: Date.now(),
      });

      if (recovered) {
        // Retry operation after recovery
        try {
          const result = await operation();
          return { success: true, result, recovered: true };
        } catch {
          return { success: false, recovered: true };
        }
      }

      return { success: false, recovered: false };
    }
  }

  async simulateErrorScenario(scenario: string): Promise<{
    handled: boolean;
    recovered: boolean;
  }> {
    switch (scenario) {
      case 'file_not_found': {
        const result = await this.executeWithRecovery(
          async () => {
            const readTool = this.tools.get('file_read')!;
            const result = await readTool.execute({ path: '/missing.txt' });
            if (!(result as { success: boolean }).success) {
              throw new Error('File not found');
            }
            return result;
          },
          'file_not_found'
        );
        return { handled: true, recovered: result.recovered };
      }

      case 'permission_denied': {
        const result = await this.executeWithRecovery(
          async () => {
            throw new Error('Permission denied');
          },
          'permission_denied'
        );
        return { handled: true, recovered: result.recovered };
      }

      case 'timeout': {
        const result = await this.executeWithRecovery(
          async () => {
            throw new Error('Operation timed out');
          },
          'timeout'
        );
        return { handled: true, recovered: result.recovered };
      }

      case 'network_error': {
        const result = await this.executeWithRecovery(
          async () => {
            throw new Error('Network error');
          },
          'network_error'
        );
        return { handled: true, recovered: result.recovered };
      }

      default:
        return { handled: false, recovered: false };
    }
  }

  getErrorLog(): typeof this.errorLog {
    return [...this.errorLog];
  }

  addRecoveryStrategy(name: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.set(name, strategy);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Error Recovery E2E', () => {
  let app: ErrorRecoveryApp;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    app = new ErrorRecoveryApp();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // File Error Recovery
  // ============================================================================

  describe('File Error Recovery', () => {
    test('should recover from file not found', async () => {
      const result = await app.simulateErrorScenario('file_not_found');

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
    });

    test('should log file errors', async () => {
      await app.simulateErrorScenario('file_not_found');

      const log = app.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].strategy).toBe('file_not_found');
    });

    test('should handle permission denied', async () => {
      const result = await app.simulateErrorScenario('permission_denied');

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
    });
  });

  // ============================================================================
  // Timeout Recovery
  // ============================================================================

  describe('Timeout Recovery', () => {
    test('should recover from timeout', async () => {
      const result = await app.simulateErrorScenario('timeout');

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
    });

    test('should log timeout errors', async () => {
      await app.simulateErrorScenario('timeout');

      const log = app.getErrorLog();
      expect(log[0].error).toContain('timed out');
    });
  });

  // ============================================================================
  // Network Error Recovery
  // ============================================================================

  describe('Network Error Recovery', () => {
    test('should recover from network error', async () => {
      const result = await app.simulateErrorScenario('network_error');

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
    });

    test('should log network errors', async () => {
      await app.simulateErrorScenario('network_error');

      const log = app.getErrorLog();
      expect(log[0].error).toContain('Network');
    });
  });

  // ============================================================================
  // Custom Recovery Strategies
  // ============================================================================

  describe('Custom Recovery Strategies', () => {
    test('should add custom recovery strategy', async () => {
      let strategyCalled = false;
      
      app.addRecoveryStrategy('custom_error', async () => {
        strategyCalled = true;
        return true;
      });

      const result = await app.executeWithRecovery(
        async () => { throw new Error('Custom error'); },
        'custom_error'
      );

      expect(strategyCalled).toBe(true);
      expect(result.recovered).toBe(true);
    });

    test('should handle failed recovery', async () => {
      app.addRecoveryStrategy('fails', async () => false);

      const result = await app.executeWithRecovery(
        async () => { throw new Error('Fails'); },
        'fails'
      );

      expect(result.recovered).toBe(false);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Error Logging
  // ============================================================================

  describe('Error Logging', () => {
    test('should log all errors', async () => {
      await app.simulateErrorScenario('file_not_found');
      await app.simulateErrorScenario('timeout');
      await app.simulateErrorScenario('network_error');

      const log = app.getErrorLog();
      expect(log).toHaveLength(3);
    });

    test('should include timestamps', async () => {
      await app.simulateErrorScenario('file_not_found');

      const log = app.getErrorLog();
      expect(log[0].timestamp).toBeGreaterThan(0);
    });

    test('should track recovery status', async () => {
      await app.simulateErrorScenario('file_not_found');

      const log = app.getErrorLog();
      expect(log[0].recovered).toBe(true);
    });
  });

  // ============================================================================
  // Multiple Error Scenarios
  // ============================================================================

  describe('Multiple Error Scenarios', () => {
    test('should handle sequential errors', async () => {
      const results = await Promise.all([
        app.simulateErrorScenario('file_not_found'),
        app.simulateErrorScenario('timeout'),
        app.simulateErrorScenario('network_error'),
      ]);

      expect(results.every(r => r.handled)).toBe(true);
    });

    test('should handle different error types', async () => {
      const scenarios = [
        'file_not_found',
        'permission_denied',
        'timeout',
        'network_error',
      ];

      for (const scenario of scenarios) {
        const result = await app.simulateErrorScenario(scenario);
        expect(result.handled).toBe(true);
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle unknown error types', async () => {
      const result = await app.simulateErrorScenario('unknown_error');

      expect(result.handled).toBe(false);
    });

    test('should handle successful operations', async () => {
      const result = await app.executeWithRecovery(
        async () => 'success',
        'any'
      );

      expect(result.success).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.result).toBe('success');
    });

    test('should handle recovery that throws', async () => {
      app.addRecoveryStrategy('throws', async () => {
        throw new Error('Recovery failed');
      });

      const result = await app.executeWithRecovery(
        async () => { throw new Error('Original'); },
        'throws'
      );

      expect(result.success).toBe(false);
    });

    test('should handle rapid errors', async () => {
      const promises: Promise<{ handled: boolean; recovered: boolean }>[] = [];

      for (let i = 0; i < 20; i++) {
        promises.push(app.simulateErrorScenario('file_not_found'));
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.handled)).toBe(true);
    });
  });
});
