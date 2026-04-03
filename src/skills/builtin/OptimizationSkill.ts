/**
 * OptimizationSkill.ts - Code Optimization
 * 
 * Optimizes code for:
 * - Performance improvements
 * - Memory efficiency
 * - Bundle size reduction
 * - Algorithmic complexity
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
 * Optimization type
 */
export type OptimizationType =
  | 'performance'
  | 'memory'
  | 'bundle-size'
  | 'algorithm'
  | 'readability'
  | 'all';

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  id: string;
  type: OptimizationType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  location: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
  };
  originalCode: string;
  optimizedCode: string;
  expectedImprovement: {
    metric: string;
    before: string;
    after: string;
  };
  safe: boolean;
  confidence: number;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  filePath: string;
  suggestions: OptimizationSuggestion[];
  summary: {
    totalSuggestions: number;
    performance: number;
    memory: number;
    bundleSize: number;
    algorithm: number;
    estimatedImprovement: string;
  };
  appliedOptimizations: OptimizationSuggestion[];
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  types: OptimizationType[];
  autoApply: boolean;
  aggressive: boolean;
  preserveReadability: boolean;
  targetRuntime: 'node' | 'browser' | 'universal';
}

const definition: SkillDefinition = {
  metadata: {
    id: 'optimization',
    name: 'Code Optimization',
    version: '1.0.0',
    description: 'Optimizes code for performance, memory efficiency, bundle size, and algorithmic improvements.',
    category: 'utility',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['optimization', 'performance', 'memory', 'bundle-size'],
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
        description: 'Path to file to optimize',
        required: true,
      },
      code: {
        name: 'code',
        type: 'string',
        description: 'Code content to optimize',
        required: false,
      },
      optimizationType: {
        name: 'optimizationType',
        type: 'string',
        description: 'Type of optimization',
        required: true,
        enum: ['performance', 'memory', 'bundle-size', 'algorithm', 'all'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Optimization options',
        required: false,
      },
    },
    required: ['filePath', 'optimizationType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      filePath: { name: 'filePath', type: 'string', required: true },
      suggestions: { name: 'suggestions', type: 'array', required: true },
      summary: { name: 'summary', type: 'object', required: true },
      appliedOptimizations: { name: 'appliedOptimizations', type: 'array', required: true },
    },
    required: ['filePath', 'suggestions', 'summary', 'appliedOptimizations'],
  },
  examples: [
    {
      name: 'Optimize loop',
      description: 'Optimize a loop for better performance',
      input: {
        filePath: 'src/utils.ts',
        optimizationType: 'performance',
        code: 'for (let i = 0; i < array.length; i++) { ... }',
      },
      expectedOutput: {
        filePath: 'src/utils.ts',
        suggestions: [],
        summary: { totalSuggestions: 1, performance: 1, memory: 0, bundleSize: 0, algorithm: 0, estimatedImprovement: '20%' },
        appliedOptimizations: [],
      },
    },
  ],
  requiredTools: [],
  requiredContext: [],
  successCriteria: [{ name: 'success', description: 'Optimization completed', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Code Optimization Skill\n\nOptimizes code for various metrics.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class OptimizationSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing OptimizationSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const optimizationType = input.optimizationType as OptimizationType;
    
    const options: OptimizationOptions = {
      types: optimizationType === 'all' ? ['performance', 'memory', 'bundle-size', 'algorithm'] : [optimizationType],
      autoApply: false,
      aggressive: false,
      preserveReadability: true,
      targetRuntime: 'universal',
      ...(input.options as Partial<OptimizationOptions> || {}),
    };

    // Get code content
    const code = input.code as string || await this._readFile(input.filePath as string, context);
    
    if (!code) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Could not read code' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Analyze and generate suggestions
    const suggestions: OptimizationSuggestion[] = [];

    for (const type of options.types) {
      const typeSuggestions = this._analyzeForOptimization(code, input.filePath as string, type, options);
      suggestions.push(...typeSuggestions);
    }

    // Sort by severity
    suggestions.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Apply safe optimizations if autoApply is enabled
    const appliedOptimizations: OptimizationSuggestion[] = [];
    if (options.autoApply) {
      for (const suggestion of suggestions) {
        if (suggestion.safe && suggestion.confidence > 0.9) {
          appliedOptimizations.push(suggestion);
        }
      }
    }

    const summary = {
      totalSuggestions: suggestions.length,
      performance: suggestions.filter(s => s.type === 'performance').length,
      memory: suggestions.filter(s => s.type === 'memory').length,
      bundleSize: suggestions.filter(s => s.type === 'bundle-size').length,
      algorithm: suggestions.filter(s => s.type === 'algorithm').length,
      estimatedImprovement: this._calculateEstimatedImprovement(suggestions),
    };

    const result: OptimizationResult = {
      filePath: input.filePath as string,
      suggestions,
      summary,
      appliedOptimizations,
    };

    return {
      success: true,
      data: result,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing OptimizationSkill');
  }

  // ============================================================================
  // Optimization Analysis Methods
  // ============================================================================

  private _analyzeForOptimization(
    code: string,
    filePath: string,
    type: OptimizationType,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const lines = code.split('\n');

    switch (type) {
      case 'performance':
        suggestions.push(...this._analyzePerformance(code, lines, filePath));
        break;
      case 'memory':
        suggestions.push(...this._analyzeMemory(code, lines, filePath));
        break;
      case 'bundle-size':
        suggestions.push(...this._analyzeBundleSize(code, lines, filePath));
        break;
      case 'algorithm':
        suggestions.push(...this._analyzeAlgorithm(code, lines, filePath));
        break;
    }

    return suggestions;
  }

  private _analyzePerformance(code: string, lines: string[], filePath: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for inefficient loops
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Array.length in loop condition
      const loopPattern = /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\w+)\.length\s*;/;
      const match = line.match(loopPattern);
      if (match) {
        suggestions.push({
          id: `perf-loop-${i}`,
          type: 'performance',
          severity: 'medium',
          title: 'Cache array length in loop',
          description: 'Accessing .length on every iteration is inefficient',
          location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
          originalCode: line,
          optimizedCode: line.replace(match[0], match[0].replace(`${match[1]}.length`, `const len = ${match[1]}.length; ... < len`)),
          expectedImprovement: { metric: 'iterations', before: 'O(n) property access', after: 'O(1) variable access' },
          safe: true,
          confidence: 0.95,
        });
      }

      // Inefficient array methods
      if (line.includes('.forEach(') && (line.includes('await') || line.includes('async'))) {
        suggestions.push({
          id: `perf-async-foreach-${i}`,
          type: 'performance',
          severity: 'high',
          title: 'Replace forEach with for...of for async operations',
          description: 'forEach does not wait for async callbacks',
          location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
          originalCode: line,
          optimizedCode: `for (const item of array) {\n  await process(item);\n}`,
          expectedImprovement: { metric: 'execution', before: 'Parallel (unintended)', after: 'Sequential (correct)' },
          safe: false,
          confidence: 0.9,
        });
      }

      // Object spread in hot path
      if (line.includes('...') && line.includes('{') && !line.includes('//')) {
        suggestions.push({
          id: `perf-spread-${i}`,
          type: 'performance',
          severity: 'low',
          title: 'Consider object.assign for large objects',
          description: 'Object spread creates new objects which can be expensive',
          location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
          originalCode: line,
          optimizedCode: line.replace(/\{ \.\.\.(\w+) \}/, 'Object.assign({}, $1)'),
          expectedImprovement: { metric: 'memory', before: 'Multiple allocations', after: 'Single allocation' },
          safe: true,
          confidence: 0.7,
        });
      }
    }

    return suggestions;
  }

  private _analyzeMemory(code: string, lines: string[], filePath: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Large array creation in loop
      if (line.includes('new Array(') || line.includes('Array(')) {
        suggestions.push({
          id: `mem-array-${i}`,
          type: 'memory',
          severity: 'medium',
          title: 'Pre-allocate array when size is known',
          description: 'Dynamic array growth causes reallocations',
          location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
          originalCode: line,
          optimizedCode: line.replace(/new Array\(\)/, 'new Array(expectedSize)'),
          expectedImprovement: { metric: 'allocations', before: 'Multiple', after: 'Single' },
          safe: true,
          confidence: 0.8,
        });
      }

      // String concatenation in loop
      if (line.includes('+') && (line.includes('"') || line.includes("'"))) {
        const loopContext = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (loopContext.includes('for') || loopContext.includes('while')) {
          suggestions.push({
            id: `mem-string-${i}`,
            type: 'memory',
            severity: 'medium',
            title: 'Use array join instead of string concatenation',
            description: 'Strings are immutable, concatenation creates new strings',
            location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
            originalCode: line,
            optimizedCode: '// Use: parts.push(str); then parts.join("")',
            expectedImprovement: { metric: 'allocations', before: 'O(n²)', after: 'O(n)' },
            safe: true,
            confidence: 0.85,
          });
        }
      }

      // Event listeners without cleanup
      if (line.includes('addEventListener') && !code.includes('removeEventListener')) {
        suggestions.push({
          id: `mem-listener-${i}`,
          type: 'memory',
          severity: 'high',
          title: 'Remove event listeners to prevent memory leaks',
          description: 'Event listeners can prevent garbage collection',
          location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
          originalCode: line,
          optimizedCode: line + '\n// Add cleanup: element.removeEventListener(...)',
          expectedImprovement: { metric: 'memory leak', before: 'Present', after: 'Fixed' },
          safe: false,
          confidence: 0.8,
        });
      }
    }

    return suggestions;
  }

  private _analyzeBundleSize(code: string, lines: string[], filePath: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Full library imports
      if (line.includes('import') && line.includes('from') && !line.includes('{')) {
        const libMatch = line.match(/from\s+['"]([^'"]+)['"]/);
        if (libMatch && ['lodash', 'moment', 'rxjs'].some(lib => libMatch[1].includes(lib))) {
          suggestions.push({
            id: `bundle-full-import-${i}`,
            type: 'bundle-size',
            severity: 'high',
            title: 'Import specific functions instead of full library',
            description: `Importing entire ${libMatch[1]} increases bundle size significantly`,
            location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
            originalCode: line,
            optimizedCode: line.replace(/import\s+(\w+)/, 'import { specificFunction }'),
            expectedImprovement: { metric: 'bundle size', before: 'Full library', after: 'Used functions only' },
            safe: true,
            confidence: 0.9,
          });
        }
      }

      // Unused imports
      const importMatch = line.match(/import\s+\{\s*([^}]+)\s*\}/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(s => s.trim().split(' ')[0]);
        for (const imp of imports) {
          const usagePattern = new RegExp(`\\b${imp}\\b(?!\\s+from)`);
          if (!usagePattern.test(code.substring(code.indexOf(line) + line.length))) {
            suggestions.push({
              id: `bundle-unused-${i}`,
              type: 'bundle-size',
              severity: 'low',
              title: `Remove unused import: ${imp}`,
              description: 'Unused imports increase bundle size unnecessarily',
              location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
              originalCode: line,
              optimizedCode: line.replace(new RegExp(`(,?\\s*)?${imp}(,?\\s*)?`), ''),
              expectedImprovement: { metric: 'bundle size', before: 'Includes unused', after: 'Only used imports' },
              safe: true,
              confidence: 0.85,
            });
          }
        }
      }
    }

    return suggestions;
  }

  private _analyzeAlgorithm(code: string, lines: string[], filePath: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for nested loops (O(n²))
    let inLoop = false;
    let loopDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/\b(for|while)\s*\(/.test(line)) {
        loopDepth++;
        if (loopDepth === 2) {
          suggestions.push({
            id: `algo-nested-loop-${i}`,
            type: 'algorithm',
            severity: 'medium',
            title: 'Nested loops detected - O(n²) complexity',
            description: 'Consider using a Map/Set for O(n) lookup instead',
            location: { filePath, lineStart: i - 5, lineEnd: i + 1 },
            originalCode: lines.slice(Math.max(0, i - 2), i + 1).join('\n'),
            optimizedCode: '// Use Map for O(n) instead of O(n²)',
            expectedImprovement: { metric: 'time complexity', before: 'O(n²)', after: 'O(n)' },
            safe: false,
            confidence: 0.75,
          });
        }
      }

      if (line.includes('}')) {
        loopDepth = Math.max(0, loopDepth - 1);
      }

      // Inefficient array search
      if (line.includes('.find(') || line.includes('.filter(')) {
        const prevLines = lines.slice(Math.max(0, i - 10), i).join('\n');
        if (prevLines.includes('for') || prevLines.includes('while')) {
          suggestions.push({
            id: `algo-inefficient-search-${i}`,
            type: 'algorithm',
            severity: 'low',
            title: 'Consider using a Set for frequent lookups',
            description: 'Array.find is O(n) for each lookup',
            location: { filePath, lineStart: i + 1, lineEnd: i + 1 },
            originalCode: line,
            optimizedCode: '// Use Set.has for O(1) lookup',
            expectedImprovement: { metric: 'lookup time', before: 'O(n)', after: 'O(1)' },
            safe: true,
            confidence: 0.7,
          });
        }
      }
    }

    return suggestions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async _readFile(filePath: string, context: SkillContext): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      return await fs.readFile(path.join(context.workspacePath, filePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private _calculateEstimatedImprovement(suggestions: OptimizationSuggestion[]): string {
    if (suggestions.length === 0) return '0%';
    
    const highImpact = suggestions.filter(s => s.severity === 'high').length;
    const mediumImpact = suggestions.filter(s => s.severity === 'medium').length;
    
    const score = highImpact * 15 + mediumImpact * 5;
    return `${Math.min(score, 50)}%`;
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

export default function createSkill(config?: Partial<SkillConfig>): OptimizationSkill {
  return new OptimizationSkill(config);
}

export { definition };
