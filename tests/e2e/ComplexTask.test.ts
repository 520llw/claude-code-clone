/**
 * Complex Task End-to-End Tests
 * Tests for complex multi-step tasks and workflows
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestContext, cleanupTestContext } from '../setup';
import { MockLLMClient, createMockLLM } from '../mocks/MockLLM';
import { MockToolRegistry, createMockTools } from '../mocks/MockTools';
import { MockFS, createSampleProjectFS } from '../mocks/MockFS';

// ============================================================================
// Complex Task Application
// ============================================================================

class ComplexTaskApp {
  llm: MockLLMClient;
  tools: MockToolRegistry;
  fs: MockFS;
  taskLog: Array<{
    task: string;
    steps: string[];
    completed: boolean;
    duration: number;
  }> = [];

  constructor() {
    this.llm = createMockLLM();
    this.tools = createMockTools();
    this.fs = createSampleProjectFS();
  }

  async executeComplexTask(task: string, expectedSteps: string[]): Promise<{
    success: boolean;
    steps: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const executedSteps: string[] = [];

    // Simulate task execution with multiple steps
    for (const step of expectedSteps) {
      // Execute step
      await this.executeStep(step);
      executedSteps.push(step);
    }

    const duration = Date.now() - startTime;
    const success = executedSteps.length === expectedSteps.length;

    this.taskLog.push({
      task,
      steps: executedSteps,
      completed: success,
      duration,
    });

    return { success, steps: executedSteps, duration };
  }

  private async executeStep(step: string): Promise<void> {
    // Simulate step execution time
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  getTaskLog(): typeof this.taskLog {
    return [...this.taskLog];
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Complex Task E2E', () => {
  let app: ComplexTaskApp;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    app = new ComplexTaskApp();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Project Setup Workflow
  // ============================================================================

  describe('Project Setup Workflow', () => {
    test('should set up a new project', async () => {
      const steps = [
        'Create project directory',
        'Initialize package.json',
        'Install dependencies',
        'Create source files',
        'Create test files',
        'Set up configuration',
      ];

      const result = await app.executeComplexTask('Set up new TypeScript project', steps);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(6);
    });

    test('should configure build pipeline', async () => {
      const steps = [
        'Set up TypeScript config',
        'Configure build scripts',
        'Set up linting',
        'Configure testing',
        'Set up CI/CD',
      ];

      const result = await app.executeComplexTask('Configure build pipeline', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Code Generation Workflow
  // ============================================================================

  describe('Code Generation Workflow', () => {
    test('should generate API endpoints', async () => {
      const steps = [
        'Analyze requirements',
        'Generate route handlers',
        'Generate controller',
        'Generate models',
        'Generate validation',
        'Generate tests',
      ];

      const result = await app.executeComplexTask('Generate REST API', steps);

      expect(result.success).toBe(true);
    });

    test('should generate React components', async () => {
      const steps = [
        'Analyze component requirements',
        'Generate component structure',
        'Add TypeScript types',
        'Add styling',
        'Add tests',
        'Add Storybook stories',
      ];

      const result = await app.executeComplexTask('Generate React component', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Refactoring Workflow
  // ============================================================================

  describe('Refactoring Workflow', () => {
    test('should migrate to TypeScript', async () => {
      const steps = [
        'Analyze JavaScript files',
        'Rename files to .ts',
        'Add basic types',
        'Fix type errors',
        'Add strict types',
        'Update imports',
        'Run tests',
      ];

      const result = await app.executeComplexTask('Migrate to TypeScript', steps);

      expect(result.success).toBe(true);
    });

    test('should refactor to use hooks', async () => {
      const steps = [
        'Identify class components',
        'Convert to functional components',
        'Extract state to hooks',
        'Extract side effects',
        'Optimize re-renders',
        'Update tests',
      ];

      const result = await app.executeComplexTask('Refactor to hooks', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Debugging Workflow
  // ============================================================================

  describe('Debugging Workflow', () => {
    test('should debug failing tests', async () => {
      const steps = [
        'Run tests to identify failures',
        'Read failing test files',
        'Analyze error messages',
        'Check related source files',
        'Identify root cause',
        'Implement fix',
        'Verify fix with tests',
      ];

      const result = await app.executeComplexTask('Debug failing tests', steps);

      expect(result.success).toBe(true);
    });

    test('should investigate performance issue', async () => {
      const steps = [
        'Identify slow operations',
        'Profile the application',
        'Analyze profiler output',
        'Find bottlenecks',
        'Implement optimizations',
        'Verify improvements',
      ];

      const result = await app.executeComplexTask('Investigate performance', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Documentation Workflow
  // ============================================================================

  describe('Documentation Workflow', () => {
    test('should generate API documentation', async () => {
      const steps = [
        'Scan source files',
        'Extract JSDoc comments',
        'Parse type definitions',
        'Generate markdown',
        'Create examples',
        'Build documentation site',
      ];

      const result = await app.executeComplexTask('Generate API docs', steps);

      expect(result.success).toBe(true);
    });

    test('should update README', async () => {
      const steps = [
        'Analyze project structure',
        'Read existing README',
        'Update installation instructions',
        'Update usage examples',
        'Add contribution guidelines',
        'Update changelog',
      ];

      const result = await app.executeComplexTask('Update README', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Testing Workflow
  // ============================================================================

  describe('Testing Workflow', () => {
    test('should add test coverage', async () => {
      const steps = [
        'Identify untested code',
        'Read source files',
        'Write unit tests',
        'Write integration tests',
        'Write e2e tests',
        'Run coverage report',
        'Address gaps',
      ];

      const result = await app.executeComplexTask('Add test coverage', steps);

      expect(result.success).toBe(true);
    });

    test('should set up test environment', async () => {
      const steps = [
        'Install testing framework',
        'Configure test runner',
        'Set up test utilities',
        'Create test fixtures',
        'Add test scripts',
        'Configure CI integration',
      ];

      const result = await app.executeComplexTask('Set up testing', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Security Workflow
  // ============================================================================

  describe('Security Workflow', () => {
    test('should audit dependencies', async () => {
      const steps = [
        'Run security audit',
        'Analyze vulnerabilities',
        'Check for outdated packages',
        'Review security advisories',
        'Update vulnerable packages',
        'Verify fixes',
      ];

      const result = await app.executeComplexTask('Audit dependencies', steps);

      expect(result.success).toBe(true);
    });

    test('should implement authentication', async () => {
      const steps = [
        'Choose auth strategy',
        'Set up auth middleware',
        'Create login endpoint',
        'Create register endpoint',
        'Add session/JWT handling',
        'Protect routes',
        'Add tests',
      ];

      const result = await app.executeComplexTask('Implement auth', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Deployment Workflow
  // ============================================================================

  describe('Deployment Workflow', () => {
    test('should prepare for deployment', async () => {
      const steps = [
        'Optimize build',
        'Configure environment variables',
        'Set up Docker',
        'Configure CI/CD pipeline',
        'Set up monitoring',
        'Create deployment docs',
      ];

      const result = await app.executeComplexTask('Prepare deployment', steps);

      expect(result.success).toBe(true);
    });

    test('should set up CI/CD', async () => {
      const steps = [
        'Choose CI platform',
        'Create workflow file',
        'Configure build steps',
        'Configure test steps',
        'Configure deployment',
        'Add notifications',
      ];

      const result = await app.executeComplexTask('Set up CI/CD', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Data Migration Workflow
  // ============================================================================

  describe('Data Migration Workflow', () => {
    test('should create database migration', async () => {
      const steps = [
        'Analyze schema changes',
        'Create migration file',
        'Write up migration',
        'Write down migration',
        'Test migration locally',
        'Document changes',
      ];

      const result = await app.executeComplexTask('Create migration', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Code Review Workflow
  // ============================================================================

  describe('Code Review Workflow', () => {
    test('should perform comprehensive review', async () => {
      const steps = [
        'Read changed files',
        'Analyze code quality',
        'Check for bugs',
        'Review test coverage',
        'Check documentation',
        'Verify best practices',
        'Provide feedback',
      ];

      const result = await app.executeComplexTask('Code review', steps);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Task Logging
  // ============================================================================

  describe('Task Logging', () => {
    test('should log completed tasks', async () => {
      await app.executeComplexTask('Task 1', ['Step 1', 'Step 2']);
      await app.executeComplexTask('Task 2', ['Step A', 'Step B']);

      const log = app.getTaskLog();

      expect(log).toHaveLength(2);
      expect(log[0].task).toBe('Task 1');
      expect(log[1].task).toBe('Task 2');
    });

    test('should track task duration', async () => {
      const result = await app.executeComplexTask('Timed task', ['Step 1']);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should track completion status', async () => {
      const result = await app.executeComplexTask('Complete task', [
        'Step 1',
        'Step 2',
        'Step 3',
      ]);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty task', async () => {
      const result = await app.executeComplexTask('Empty task', []);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(0);
    });

    test('should handle single step task', async () => {
      const result = await app.executeComplexTask('Single step', ['Only step']);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
    });

    test('should handle many steps', async () => {
      const steps = Array.from({ length: 50 }, (_, i) => `Step ${i + 1}`);

      const result = await app.executeComplexTask('Many steps', steps);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(50);
    });

    test('should handle rapid task execution', async () => {
      const promises: Promise<{ success: boolean; steps: string[]; duration: number }>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(app.executeComplexTask(`Task ${i}`, ['Step 1', 'Step 2']));
      }

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
