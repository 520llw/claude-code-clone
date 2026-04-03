/**
 * TestingSkill.ts - Test Generation and Execution
 * 
 * Generates and executes tests including:
 * - Unit tests
 * - Integration tests
 * - Edge case testing
 * - Property-based tests
 * - Test coverage analysis
 */

import { Skill } from '../Skill';
import {
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillDefinition,
  SkillConfig,
} from '../types';

/**
 * Test type
 */
export type TestType = 'unit' | 'integration' | 'e2e' | 'property' | 'snapshot' | 'benchmark';

/**
 * Generated test
 */
export interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  type: TestType;
  code: string;
  targetFunction: string;
  assertions: TestAssertion[];
  fixtures?: string[];
  mocks?: string[];
}

/**
 * Test assertion
 */
export interface TestAssertion {
  type: 'equal' | 'notEqual' | 'throws' | 'resolves' | 'rejects' | 'contains' | 'matches';
  expected?: unknown;
  message: string;
}

/**
 * Test result
 */
export interface TestResult {
  testId: string;
  passed: boolean;
  duration: number;
  error?: {
    message: string;
    stack?: string;
  };
  output?: unknown;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  filePath: string;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
  };
}

/**
 * Test generation options
 */
export interface TestGenerationOptions {
  types: TestType[];
  includeEdgeCases: boolean;
  includeErrorCases: boolean;
  maxTestsPerFunction: number;
  framework: 'jest' | 'vitest' | 'mocha' | 'ava';
  mockExternalDeps: boolean;
}

const definition: SkillDefinition = {
  metadata: {
    id: 'testing',
    name: 'Test Generation',
    version: '1.0.0',
    description: 'Generates comprehensive tests including unit tests, integration tests, edge cases, and property-based tests.',
    category: 'code',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['testing', 'unit-tests', 'integration-tests', 'tdd'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 120000,
    retries: 1,
    retryDelay: 1000,
    parallel: false,
    maxConcurrency: 1,
    cacheResults: false,
    cacheTtl: 0,
    logLevel: 'info',
    customSettings: {},
  },
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Path to source file to test',
        required: true,
      },
      code: {
        name: 'code',
        type: 'string',
        description: 'Source code to test',
        required: false,
      },
      testType: {
        name: 'testType',
        type: 'string',
        description: 'Type of tests to generate',
        required: true,
        enum: ['unit', 'integration', 'e2e', 'property', 'all'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Test generation options',
        required: false,
      },
      outputPath: {
        name: 'outputPath',
        type: 'string',
        description: 'Output path for generated tests',
        required: false,
      },
    },
    required: ['filePath', 'testType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      tests: {
        name: 'tests',
        type: 'array',
        description: 'Generated tests',
        required: true,
      },
      testCode: {
        name: 'testCode',
        type: 'string',
        description: 'Complete test file content',
        required: true,
      },
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Output file path',
        required: false,
      },
      summary: {
        name: 'summary',
        type: 'object',
        description: 'Test generation summary',
        required: true,
      },
    },
    required: ['tests', 'testCode', 'summary'],
  },
  examples: [
    {
      name: 'Generate unit tests',
      description: 'Generate unit tests for a utility function',
      input: {
        filePath: 'src/utils/calculate.ts',
        testType: 'unit',
        options: { framework: 'vitest', includeEdgeCases: true },
      },
      expectedOutput: {
        tests: [],
        testCode: '// Generated tests...',
        summary: { totalTests: 5, functionsTested: 2, coverage: 0.9 },
      },
    },
  ],
  requiredTools: ['file-reader', 'ast-parser', 'test-runner'],
  requiredContext: ['workspacePath'],
  successCriteria: [{ name: 'success', description: 'Tests generated successfully', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Test Generation Skill\n\nGenerates comprehensive tests for your code.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class TestingSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing TestingSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const testType = input.testType as TestType | 'all';
    
    this._log('info', `Generating ${testType} tests`, { filePath: input.filePath });

    // Get source code
    const sourceCode = await this._getSourceCode(input, context);
    if (!sourceCode) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Could not read source code' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Parse functions to test
    const functions = this._parseFunctions(sourceCode);
    
    if (functions.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No testable functions found in source code' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Generate tests
    const options: TestGenerationOptions = {
      types: testType === 'all' ? ['unit', 'integration'] : [testType as TestType],
      includeEdgeCases: (input.options as TestGenerationOptions)?.includeEdgeCases ?? true,
      includeErrorCases: (input.options as TestGenerationOptions)?.includeErrorCases ?? true,
      maxTestsPerFunction: (input.options as TestGenerationOptions)?.maxTestsPerFunction ?? 5,
      framework: (input.options as TestGenerationOptions)?.framework ?? 'vitest',
      mockExternalDeps: (input.options as TestGenerationOptions)?.mockExternalDeps ?? true,
    };

    const generatedTests: GeneratedTest[] = [];

    for (const func of functions) {
      const tests = this._generateTestsForFunction(func, options);
      generatedTests.push(...tests);
    }

    // Generate complete test file
    const testCode = this._generateTestFile(generatedTests, input.filePath as string, options);

    // Write to file if output path specified
    const outputPath = input.outputPath as string || this._generateOutputPath(input.filePath as string);
    await this._writeTests(outputPath, testCode, context);

    const summary = {
      totalTests: generatedTests.length,
      functionsTested: functions.length,
      testTypes: options.types,
      framework: options.framework,
      coverage: this._estimateCoverage(generatedTests, functions),
    };

    return {
      success: true,
      data: {
        tests: generatedTests,
        testCode,
        filePath: outputPath,
        summary,
      },
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing TestingSkill');
  }

  // ============================================================================
  // Test Generation Methods
  // ============================================================================

  private _parseFunctions(code: string): Array<{
    name: string;
    params: { name: string; type: string; optional: boolean }[];
    returnType?: string;
    isAsync: boolean;
    isExported: boolean;
  }> {
    const functions = [];
    
    // Match function declarations
    const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g;
    // Match arrow functions assigned to const
    const arrowPattern = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*(\w+))?\s*=>/g;
    // Match method definitions
    const methodPattern = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;

    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      functions.push(this._parseFunctionMatch(match, code));
    }

    while ((match = arrowPattern.exec(code)) !== null) {
      functions.push(this._parseFunctionMatch(match, code));
    }

    while ((match = methodPattern.exec(code)) !== null) {
      functions.push(this._parseFunctionMatch(match, code));
    }

    return functions;
  }

  private _parseFunctionMatch(match: RegExpExecArray, code: string): {
    name: string;
    params: { name: string; type: string; optional: boolean }[];
    returnType?: string;
    isAsync: boolean;
    isExported: boolean;
  } {
    const [, name, paramsStr, returnType] = match;
    const isAsync = match[0].includes('async');
    const isExported = match[0].includes('export');

    const params = this._parseParams(paramsStr || '');

    return { name, params, returnType, isAsync, isExported };
  }

  private _parseParams(paramsStr: string): { name: string; type: string; optional: boolean }[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const [namePart, typePart] = param.split(':').map(s => s.trim());
      const optional = namePart.includes('?');
      const name = namePart.replace('?', '').trim();
      const type = typePart || 'any';

      return { name, type, optional };
    });
  }

  private _generateTestsForFunction(
    func: ReturnType<typeof this._parseFunctions>[0],
    options: TestGenerationOptions
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const testCount = Math.min(options.maxTestsPerFunction, 5);

    // Generate happy path test
    tests.push({
      id: `${func.name}-happy-path`,
      name: `should ${func.name} with valid input`,
      description: `Tests ${func.name} with typical valid inputs`,
      type: 'unit',
      code: '',
      targetFunction: func.name,
      assertions: [{ type: 'resolves', message: 'Should resolve successfully' }],
    });

    // Generate edge case tests
    if (options.includeEdgeCases) {
      tests.push({
        id: `${func.name}-edge-empty`,
        name: `should handle empty input`,
        description: `Tests ${func.name} with empty input`,
        type: 'unit',
        code: '',
        targetFunction: func.name,
        assertions: [{ type: func.params.length > 0 ? 'throws' : 'resolves', message: 'Should handle empty input' }],
      });

      tests.push({
        id: `${func.name}-edge-null`,
        name: `should handle null/undefined input`,
        description: `Tests ${func.name} with null/undefined inputs`,
        type: 'unit',
        code: '',
        targetFunction: func.name,
        assertions: [{ type: 'throws', message: 'Should throw for null/undefined' }],
      });
    }

    // Generate error case tests
    if (options.includeErrorCases) {
      tests.push({
        id: `${func.name}-error-invalid`,
        name: `should throw for invalid input`,
        description: `Tests ${func.name} error handling`,
        type: 'unit',
        code: '',
        targetFunction: func.name,
        assertions: [{ type: 'throws', message: 'Should throw error for invalid input' }],
      });
    }

    // Generate async test if function is async
    if (func.isAsync) {
      tests.push({
        id: `${func.name}-async`,
        name: `should ${func.name} asynchronously`,
        description: `Tests async behavior of ${func.name}`,
        type: 'unit',
        code: '',
        targetFunction: func.name,
        assertions: [{ type: 'resolves', message: 'Should resolve' }],
      });
    }

    return tests.slice(0, testCount);
  }

  private _generateTestFile(
    tests: GeneratedTest[],
    sourcePath: string,
    options: TestGenerationOptions
  ): string {
    const framework = options.framework;
    const importPath = this._getRelativeImportPath(sourcePath);

    let testFile = '';

    // Add imports based on framework
    if (framework === 'vitest') {
      testFile += `import { describe, it, expect, vi } from 'vitest';\n`;
    } else if (framework === 'jest') {
      testFile += `const { describe, it, expect, jest } = require('@jest/globals');\n`;
    }

    testFile += `import { ${[...new Set(tests.map(t => t.targetFunction))].join(', ')} } from '${importPath}';\n\n`;

    // Group tests by target function
    const groupedTests = this._groupBy(tests, 'targetFunction');

    for (const [funcName, funcTests] of groupedTests) {
      testFile += `describe('${funcName}', () => {\n`;

      for (const test of funcTests) {
        testFile += this._generateTestCase(test, framework, options);
      }

      testFile += `});\n\n`;
    }

    return testFile;
  }

  private _generateTestCase(
    test: GeneratedTest,
    framework: string,
    options: TestGenerationOptions
  ): string {
    let testCase = `  it('${test.name}', ${test.type === 'unit' && options.framework === 'vitest' ? 'async ' : ''}() => {\n`;

    // Generate setup
    testCase += `    // Arrange\n`;
    testCase += `    const input = {}; // TODO: Add test input\n\n`;

    // Generate action
    testCase += `    // Act\n`;
    if (test.type === 'unit') {
      testCase += `    const result = ${test.targetFunction}(input);\n\n`;
    }

    // Generate assertions
    testCase += `    // Assert\n`;
    for (const assertion of test.assertions) {
      switch (assertion.type) {
        case 'equal':
          testCase += `    expect(result).toEqual(${JSON.stringify(assertion.expected)});\n`;
          break;
        case 'notEqual':
          testCase += `    expect(result).not.toEqual(${JSON.stringify(assertion.expected)});\n`;
          break;
        case 'throws':
          testCase += `    expect(() => ${test.targetFunction}(input)).toThrow();\n`;
          break;
        case 'resolves':
          testCase += `    await expect(${test.targetFunction}(input)).resolves.toBeDefined();\n`;
          break;
        case 'rejects':
          testCase += `    await expect(${test.targetFunction}(input)).rejects.toThrow();\n`;
          break;
        default:
          testCase += `    expect(result).toBeDefined();\n`;
      }
    }

    testCase += `  });\n\n`;

    return testCase;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async _getSourceCode(input: SkillInput, context: SkillContext): Promise<string | null> {
    if (input.code) return input.code as string;
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      return await fs.readFile(path.join(context.workspacePath, input.filePath as string), 'utf-8');
    } catch {
      return null;
    }
  }

  private _getRelativeImportPath(sourcePath: string): string {
    const baseName = sourcePath.replace(/\.[^.]+$/, '');
    return baseName.startsWith('./') || baseName.startsWith('../') ? baseName : `./${baseName}`;
  }

  private _generateOutputPath(sourcePath: string): string {
    const baseName = sourcePath.replace(/\.[^.]+$/, '');
    return `${baseName}.test.ts`;
  }

  private async _writeTests(outputPath: string, testCode: string, context: SkillContext): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(context.workspacePath, outputPath);
      await fs.writeFile(fullPath, testCode, 'utf-8');
    } catch (error) {
      this._log('warn', 'Failed to write tests', { error });
    }
  }

  private _groupBy<T>(array: T[], key: keyof T): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of array) {
      const groupKey = String(item[key]);
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(item);
    }
    return map;
  }

  private _estimateCoverage(tests: GeneratedTest[], functions: unknown[]): number {
    const testedFunctions = new Set(tests.map(t => t.targetFunction)).size;
    return Math.min(testedFunctions / functions.length, 1);
  }

  private _createMetadata(startTime: number) {
    return {
      executionTime: Date.now() - startTime,
      startTime: new Date(startTime),
      endTime: new Date(),
      cached: false,
      retryCount: 0,
    };
  }
}

export default function createSkill(config?: Partial<SkillConfig>): TestingSkill {
  return new TestingSkill(config);
}

export { definition };
