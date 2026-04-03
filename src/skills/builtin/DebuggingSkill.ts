/**
 * DebuggingSkill.ts - Intelligent Debugging Assistant
 * 
 * Helps debug issues by:
 * - Analyzing error messages and stack traces
 * - Suggesting potential causes
 * - Recommending fixes
 * - Generating debugging steps
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
 * Debug issue type
 */
export type DebugIssueType =
  | 'runtime-error'
  | 'compile-error'
  | 'test-failure'
  | 'performance'
  | 'memory'
  | 'async'
  | 'type-error'
  | 'import-error'
  | 'configuration';

/**
 * Debug analysis result
 */
export interface DebugAnalysis {
  issueType: DebugIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  location?: {
    file: string;
    line: number;
    column?: number;
  };
  explanation: string;
  suggestedFixes: SuggestedFix[];
  debuggingSteps: string[];
  relatedIssues: string[];
  confidence: number;
}

/**
 * Suggested fix
 */
export interface SuggestedFix {
  id: string;
  description: string;
  code?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  confidence: number;
  automatic: boolean;
}

/**
 * Debug options
 */
export interface DebugOptions {
  includeStackTrace: boolean;
  includeSourceContext: boolean;
  maxSuggestions: number;
  autoFix: boolean;
}

const definition: SkillDefinition = {
  metadata: {
    id: 'debugging',
    name: 'Debugging Assistant',
    version: '1.0.0',
    description: 'Intelligent debugging assistant that analyzes errors, suggests fixes, and provides debugging guidance.',
    category: 'utility',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['debugging', 'error-analysis', 'troubleshooting'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 60000,
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
      error: {
        name: 'error',
        type: 'string',
        description: 'Error message or stack trace',
        required: true,
      },
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Path to the file with the error',
        required: false,
      },
      code: {
        name: 'code',
        type: 'string',
        description: 'Source code around the error',
        required: false,
      },
      context: {
        name: 'context',
        type: 'object',
        description: 'Additional context (recent changes, environment, etc.)',
        required: false,
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Debugging options',
        required: false,
      },
    },
    required: ['error'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      issueType: { name: 'issueType', type: 'string', required: true },
      severity: { name: 'severity', type: 'string', required: true },
      rootCause: { name: 'rootCause', type: 'string', required: true },
      location: { name: 'location', type: 'object', required: false },
      explanation: { name: 'explanation', type: 'string', required: true },
      suggestedFixes: { name: 'suggestedFixes', type: 'array', required: true },
      debuggingSteps: { name: 'debuggingSteps', type: 'array', required: true },
      relatedIssues: { name: 'relatedIssues', type: 'array', required: true },
      confidence: { name: 'confidence', type: 'number', required: true },
    },
    required: ['issueType', 'severity', 'rootCause', 'explanation', 'suggestedFixes', 'debuggingSteps', 'relatedIssues', 'confidence'],
  },
  examples: [
    {
      name: 'Debug TypeError',
      description: 'Debug a TypeError',
      input: {
        error: 'TypeError: Cannot read property \'map\' of undefined',
        filePath: 'src/components/List.tsx',
        code: 'const items = data.items.map(item => <Item key={item.id} {...item} />);',
      },
      expectedOutput: {
        issueType: 'runtime-error',
        severity: 'medium',
        rootCause: 'Accessing property on undefined value',
        explanation: 'The data.items property is undefined when accessed',
        suggestedFixes: [],
        debuggingSteps: [],
        relatedIssues: [],
        confidence: 0.95,
      },
    },
  ],
  requiredTools: [],
  requiredContext: [],
  successCriteria: [{ name: 'success', description: 'Debug analysis completed', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Debugging Assistant Skill\n\nIntelligent debugging assistance for errors and issues.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class DebuggingSkill extends Skill {
  private errorPatterns: Map<RegExp, DebugIssueType>;

  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
    this.errorPatterns = this._initializeErrorPatterns();
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing DebuggingSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const error = input.error as string;
    const options: DebugOptions = {
      includeStackTrace: true,
      includeSourceContext: true,
      maxSuggestions: 5,
      autoFix: false,
      ...(input.options as Partial<DebugOptions> || {}),
    };

    this._log('info', 'Analyzing error', { error: error.substring(0, 100) });

    // Analyze the error
    const analysis = this._analyzeError(error, input.code as string, input.filePath as string);

    // Generate fixes
    const suggestedFixes = this._generateFixes(analysis, input.code as string, options);

    // Generate debugging steps
    const debuggingSteps = this._generateDebuggingSteps(analysis);

    // Find related issues
    const relatedIssues = this._findRelatedIssues(analysis);

    const result: DebugAnalysis = {
      ...analysis,
      suggestedFixes,
      debuggingSteps,
      relatedIssues,
    };

    return {
      success: true,
      data: result,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing DebuggingSkill');
  }

  // ============================================================================
  // Error Analysis Methods
  // ============================================================================

  private _initializeErrorPatterns(): Map<RegExp, DebugIssueType> {
    const patterns = new Map<RegExp, DebugIssueType>();

    // Runtime errors
    patterns.set(/Cannot read propert(?:y|ies)\s+['"](\w+)['"]\s+of\s+(null|undefined)/i, 'runtime-error');
    patterns.set(/(\w+)\s+is\s+not\s+defined/i, 'runtime-error');
    patterns.set(/(\w+)\s+is\s+not\s+a\s+function/i, 'runtime-error');

    // Type errors
    patterns.set(/TypeError|type.*error/i, 'type-error');
    patterns.set(/Argument of type.*is not assignable/i, 'type-error');
    patterns.set(/Property.*does not exist on type/i, 'type-error');

    // Import errors
    patterns.set(/Cannot find module|Module not found|import.*error/i, 'import-error');
    patterns.set(/Cannot resolve/i, 'import-error');

    // Async errors
    patterns.set(/UnhandledPromiseRejection|Promise.*rejected/i, 'async');
    patterns.set(/await.*async/i, 'async');

    // Memory errors
    patterns.set(/out of memory|memory.*exceeded|heap/i, 'memory');

    // Performance
    patterns.set(/timeout|performance|slow/i, 'performance');

    return patterns;
  }

  private _analyzeError(
    error: string,
    code?: string,
    filePath?: string
  ): Omit<DebugAnalysis, 'suggestedFixes' | 'debuggingSteps' | 'relatedIssues'> {
    // Determine issue type
    let issueType: DebugIssueType = 'runtime-error';
    for (const [pattern, type] of this.errorPatterns) {
      if (pattern.test(error)) {
        issueType = type;
        break;
      }
    }

    // Extract location from stack trace
    const location = this._extractLocation(error, filePath);

    // Determine severity
    const severity = this._determineSeverity(error, issueType);

    // Analyze root cause
    const rootCause = this._determineRootCause(error, issueType);

    // Generate explanation
    const explanation = this._generateExplanation(error, issueType, rootCause);

    // Calculate confidence
    const confidence = this._calculateConfidence(error, issueType, code);

    return {
      issueType,
      severity,
      rootCause,
      location,
      explanation,
      confidence,
    };
  }

  private _extractLocation(error: string, filePath?: string): DebugAnalysis['location'] {
    // Extract file and line from stack trace
    const stackPattern = /at\s+.*\s+\(([^:]+):(\d+):(\d+)\)/;
    const match = error.match(stackPattern);

    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      };
    }

    // Try TypeScript error format
    const tsPattern = /([^\(]+)\((\d+),(\d+)\)/;
    const tsMatch = error.match(tsPattern);

    if (tsMatch) {
      return {
        file: tsMatch[1].trim(),
        line: parseInt(tsMatch[2], 10),
        column: parseInt(tsMatch[3], 10),
      };
    }

    if (filePath) {
      return { file: filePath, line: 1 };
    }

    return undefined;
  }

  private _determineSeverity(error: string, issueType: DebugIssueType): DebugAnalysis['severity'] {
    if (error.includes('fatal') || error.includes('crash') || error.includes('out of memory')) {
      return 'critical';
    }
    if (issueType === 'type-error' || issueType === 'compile-error') {
      return 'medium';
    }
    if (issueType === 'runtime-error') {
      return 'high';
    }
    return 'medium';
  }

  private _determineRootCause(error: string, issueType: DebugIssueType): string {
    switch (issueType) {
      case 'runtime-error':
        const nullMatch = error.match(/Cannot read propert(?:y|ies)\s+['"](\w+)['"]\s+of\s+(null|undefined)/);
        if (nullMatch) {
          return `Attempting to access property '${nullMatch[1]}' on ${nullMatch[2]} value`;
        }
        const undefinedMatch = error.match(/(\w+)\s+is\s+not\s+defined/);
        if (undefinedMatch) {
          return `Variable or function '${undefinedMatch[1]}' is not defined`;
        }
        return 'Runtime error occurred during execution';

      case 'type-error':
        const typeMatch = error.match(/Argument of type ['"]([^'"]+)['"] is not assignable/);
        if (typeMatch) {
          return `Type mismatch: ${typeMatch[1]} is not compatible with expected type`;
        }
        return 'TypeScript type error';

      case 'import-error':
        const importMatch = error.match(/Cannot find module ['"]([^'"]+)['"]/);
        if (importMatch) {
          return `Module '${importMatch[1]}' cannot be found or imported`;
        }
        return 'Module import error';

      case 'async':
        return 'Unhandled promise rejection or async operation error';

      default:
        return 'Unknown error cause';
    }
  }

  private _generateExplanation(error: string, issueType: DebugIssueType, rootCause: string): string {
    const explanations: Record<DebugIssueType, string> = {
      'runtime-error': 'A runtime error occurred while executing the code. This typically happens when trying to access properties or call methods on undefined or null values.',
      'compile-error': 'The code failed to compile. This could be due to syntax errors, missing imports, or type mismatches.',
      'test-failure': 'A test assertion failed. Check the expected vs actual values to understand what went wrong.',
      'performance': 'A performance issue was detected. This could be caused by inefficient algorithms, memory leaks, or excessive resource usage.',
      'memory': 'A memory-related error occurred. This could indicate a memory leak or excessive memory consumption.',
      'async': 'An asynchronous operation failed or was not handled properly. Check for missing await statements or unhandled promise rejections.',
      'type-error': 'A TypeScript type error occurred. The types being used are not compatible with the expected types.',
      'import-error': 'A module could not be imported. Check that the module is installed and the import path is correct.',
      'configuration': 'A configuration error occurred. Check your configuration files for invalid or missing settings.',
    };

    return `${explanations[issueType] || 'An error occurred.'}\n\nRoot cause: ${rootCause}`;
  }

  // ============================================================================
  // Fix Generation Methods
  // ============================================================================

  private _generateFixes(
    analysis: Omit<DebugAnalysis, 'suggestedFixes' | 'debuggingSteps' | 'relatedIssues'>,
    code?: string,
    options?: DebugOptions
  ): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    switch (analysis.issueType) {
      case 'runtime-error':
        if (analysis.rootCause.includes('null') || analysis.rootCause.includes('undefined')) {
          fixes.push({
            id: 'fix-null-check',
            description: 'Add null/undefined check before accessing property',
            code: code ? this._generateNullCheckFix(code) : undefined,
            confidence: 0.9,
            automatic: false,
          });

          fixes.push({
            id: 'fix-optional-chaining',
            description: 'Use optional chaining operator (?.)',
            code: code ? this._generateOptionalChainingFix(code) : undefined,
            confidence: 0.85,
            automatic: true,
          });
        }
        break;

      case 'type-error':
        fixes.push({
          id: 'fix-type-assertion',
          description: 'Add type assertion or guard',
          confidence: 0.7,
          automatic: false,
        });
        break;

      case 'import-error':
        fixes.push({
          id: 'fix-install-dependency',
          description: 'Install the missing dependency',
          code: 'npm install <package-name>',
          confidence: 0.8,
          automatic: false,
        });
        break;

      case 'async':
        fixes.push({
          id: 'fix-add-await',
          description: 'Add await or .catch() to handle promise',
          confidence: 0.75,
          automatic: false,
        });
        break;
    }

    return fixes.slice(0, options?.maxSuggestions || 5);
  }

  private _generateNullCheckFix(code: string): string {
    // Simple transformation to add null check
    if (code.includes('.map(') || code.includes('.filter(')) {
      return code.replace(
        /(\w+)(\.map|\.filter)/,
        '($1 ?? [])$2'
      );
    }
    return `if (value) {\n  ${code}\n}`;
  }

  private _generateOptionalChainingFix(code: string): string {
    return code.replace(/\.(\w+)\(/g, '?.?$1(');
  }

  // ============================================================================
  // Debugging Steps Methods
  // ============================================================================

  private _generateDebuggingSteps(analysis: Omit<DebugAnalysis, 'suggestedFixes' | 'debuggingSteps' | 'relatedIssues'>): string[] {
    const steps: string[] = [];

    steps.push('1. Review the error message and location carefully');

    if (analysis.location) {
      steps.push(`2. Open ${analysis.location.file} at line ${analysis.location.line}`);
    }

    switch (analysis.issueType) {
      case 'runtime-error':
        steps.push('3. Check if the variable being accessed is properly initialized');
        steps.push('4. Add console.log statements to trace the value flow');
        steps.push('5. Consider using optional chaining (?.) or nullish coalescing (??)');
        break;

      case 'type-error':
        steps.push('3. Check the type definitions for the involved variables');
        steps.push('4. Ensure all function arguments match their expected types');
        steps.push('5. Consider using type guards or assertions');
        break;

      case 'import-error':
        steps.push('3. Verify the package is installed: npm list <package-name>');
        steps.push('4. Check the import path is correct');
        steps.push('5. Try reinstalling: npm install <package-name>');
        break;

      case 'async':
        steps.push('3. Check for missing await statements');
        steps.push('4. Add .catch() or try/catch to handle errors');
        steps.push('5. Verify async functions are properly marked');
        break;
    }

    steps.push('6. Run tests to verify the fix');

    return steps;
  }

  // ============================================================================
  // Related Issues Methods
  // ============================================================================

  private _findRelatedIssues(analysis: Omit<DebugAnalysis, 'suggestedFixes' | 'debuggingSteps' | 'relatedIssues'>): string[] {
    const related: string[] = [];

    switch (analysis.issueType) {
      case 'runtime-error':
        related.push('Similar null reference errors in the codebase');
        related.push('Type safety issues - consider enabling strict null checks');
        break;

      case 'type-error':
        related.push('Other type mismatches in related files');
        related.push('Missing type definitions for external libraries');
        break;

      case 'import-error':
        related.push('Circular dependency issues');
        related.push('Module resolution configuration');
        break;

      case 'async':
        related.push('Other unhandled promise rejections');
        related.push('Race conditions in async code');
        break;
    }

    return related;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private _calculateConfidence(error: string, issueType: DebugIssueType, code?: string): number {
    let confidence = 0.7;

    // Increase confidence for well-known error patterns
    if (error.includes('Cannot read property') || error.includes('is not defined')) {
      confidence += 0.2;
    }

    // Decrease confidence if code context is missing
    if (!code) {
      confidence -= 0.1;
    }

    return Math.min(confidence, 0.95);
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

export default function createSkill(config?: Partial<SkillConfig>): DebuggingSkill {
  return new DebuggingSkill(config);
}

export { definition };
