/**
 * CodeReviewSkill.ts - Automated Code Review
 * 
 * Performs comprehensive code reviews including:
 * - Style and formatting checks
 * - Best practices validation
 * - Security issue detection
 * - Performance considerations
 * - Maintainability assessment
 */

import { Skill } from '../Skill';
import {
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillDefinition,
  SkillConfig,
  SkillExecutionError,
} from '../types';

/**
 * Code review issue severity
 */
export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Code review issue category
 */
export type IssueCategory =
  | 'style'
  | 'best-practice'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'documentation'
  | 'testing';

/**
 * Code review issue
 */
export interface CodeReviewIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
  ruleId: string;
  documentationUrl?: string;
  codeSnippet?: string;
}

/**
 * Code review result
 */
export interface CodeReviewResult {
  filePath: string;
  issues: CodeReviewIssue[];
  summary: {
    totalIssues: number;
    infoCount: number;
    warningCount: number;
    errorCount: number;
    criticalCount: number;
  };
  score: number; // 0-100
  passed: boolean;
}

/**
 * Review configuration
 */
export interface ReviewConfig {
  rules: {
    style: boolean;
    bestPractices: boolean;
    security: boolean;
    performance: boolean;
    maintainability: boolean;
    documentation: boolean;
    testing: boolean;
  };
  severityThreshold: IssueSeverity;
  maxIssuesPerFile: number;
  ignorePatterns: string[];
  customRules: string[];
}

/**
 * Skill definition
 */
const definition: SkillDefinition = {
  metadata: {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Performs comprehensive automated code reviews with style checks, best practices validation, security analysis, and performance recommendations.',
    category: 'code',
    author: {
      name: 'Claude Code',
      organization: 'Anthropic',
    },
    tags: ['code-review', 'linting', 'quality', 'security', 'performance'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: {
    minPlatformVersion: '1.0.0',
  },
  config: {
    enabled: true,
    timeout: 60000,
    retries: 1,
    retryDelay: 1000,
    parallel: false,
    maxConcurrency: 1,
    cacheResults: true,
    cacheTtl: 300000,
    logLevel: 'info',
    customSettings: {},
  },
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Path to the file to review',
        required: true,
      },
      code: {
        name: 'code',
        type: 'string',
        description: 'Code content to review (alternative to filePath)',
        required: false,
      },
      language: {
        name: 'language',
        type: 'string',
        description: 'Programming language (auto-detected if not specified)',
        required: false,
        enum: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp', 'ruby', 'php'],
      },
      config: {
        name: 'config',
        type: 'object',
        description: 'Review configuration',
        required: false,
        properties: {
          rules: {
            name: 'rules',
            type: 'object',
            description: 'Enabled review rules',
            required: false,
          },
          severityThreshold: {
            name: 'severityThreshold',
            type: 'string',
            description: 'Minimum severity to report',
            required: false,
            enum: ['info', 'warning', 'error', 'critical'],
          },
        },
      },
    },
    required: ['filePath'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Path of the reviewed file',
        required: true,
      },
      issues: {
        name: 'issues',
        type: 'array',
        description: 'List of issues found',
        required: true,
      },
      summary: {
        name: 'summary',
        type: 'object',
        description: 'Issue summary statistics',
        required: true,
      },
      score: {
        name: 'score',
        type: 'number',
        description: 'Code quality score (0-100)',
        required: true,
      },
      passed: {
        name: 'passed',
        type: 'boolean',
        description: 'Whether the review passed the threshold',
        required: true,
      },
    },
    required: ['filePath', 'issues', 'summary', 'score', 'passed'],
  },
  examples: [
    {
      name: 'Review TypeScript file',
      description: 'Review a TypeScript source file',
      input: {
        filePath: 'src/components/Button.tsx',
        language: 'typescript',
      },
      expectedOutput: {
        filePath: 'src/components/Button.tsx',
        issues: [],
        summary: {
          totalIssues: 0,
          infoCount: 0,
          warningCount: 0,
          errorCount: 0,
          criticalCount: 0,
        },
        score: 95,
        passed: true,
      },
    },
    {
      name: 'Review with custom config',
      description: 'Review with specific rules enabled',
      input: {
        filePath: 'src/utils/helpers.ts',
        config: {
          rules: {
            style: true,
            security: true,
            performance: true,
          },
          severityThreshold: 'warning',
        },
      },
      expectedOutput: {
        filePath: 'src/utils/helpers.ts',
        issues: [
          {
            id: 'issue-1',
            severity: 'warning',
            category: 'style',
            file: 'src/utils/helpers.ts',
            line: 10,
            column: 5,
            message: 'Line exceeds 80 characters',
            suggestion: 'Break the line into multiple lines',
            ruleId: 'style/max-line-length',
          },
        ],
        summary: {
          totalIssues: 1,
          infoCount: 0,
          warningCount: 1,
          errorCount: 0,
          criticalCount: 0,
        },
        score: 85,
        passed: true,
      },
    },
  ],
  requiredTools: ['file-reader', 'language-detector'],
  requiredContext: ['workspacePath'],
  successCriteria: [
    {
      name: 'valid_result',
      description: 'Returns a valid review result',
      check: (output) => output.success && output.data && typeof (output.data as CodeReviewResult).score === 'number',
    },
  ],
  dependencies: [],
  documentation: {
    readme: `# Code Review Skill

Performs comprehensive automated code reviews.

## Features

- Style and formatting checks
- Best practices validation
- Security issue detection
- Performance recommendations
- Maintainability assessment
- Documentation completeness

## Usage

\`\`\`typescript
const result = await skill.execute({
  filePath: 'src/components/Button.tsx',
  language: 'typescript'
}, context);
\`\`\`

## Configuration

Customize review rules and thresholds through the config parameter.`,
    changelog: '# Changelog\n\n## 1.0.0\n\n- Initial release',
    apiReference: 'See input/output schemas for API details.',
    tutorials: [],
  },
};

/**
 * Code Review Skill implementation
 */
export class CodeReviewSkill extends Skill {
  private reviewConfig: ReviewConfig;
  private ruleRegistry: Map<string, ReviewRule>;

  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
    
    this.reviewConfig = {
      rules: {
        style: true,
        bestPractices: true,
        security: true,
        performance: true,
        maintainability: true,
        documentation: true,
        testing: true,
      },
      severityThreshold: 'info',
      maxIssuesPerFile: 100,
      ignorePatterns: ['node_modules/**', 'dist/**', 'build/**'],
      customRules: [],
    };

    this.ruleRegistry = new Map();
    this._initializeRules();
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing CodeReviewSkill');
    
    // Load custom rules if specified
    if (this.reviewConfig.customRules.length > 0) {
      await this._loadCustomRules();
    }
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    
    this._log('info', 'Starting code review', { filePath: input.filePath });

    // Get code content
    const code = await this._getCodeContent(input, context);
    if (!code) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Could not read code from ${input.filePath}`,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          startTime: new Date(startTime),
          endTime: new Date(),
          cached: false,
          retryCount: 0,
        },
      };
    }

    // Detect language
    const language = (input.language as string) || this._detectLanguage(input.filePath as string, code);

    // Merge config
    const config: ReviewConfig = {
      ...this.reviewConfig,
      ...(input.config as Partial<ReviewConfig> || {}),
    };

    // Perform review
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    // Run all enabled rules
    for (const [ruleId, rule] of this.ruleRegistry) {
      const category = rule.category;
      if (config.rules[category]) {
        const ruleIssues = await rule.check(code, lines, language, input.filePath as string);
        issues.push(...ruleIssues);
      }
    }

    // Sort by severity and line number
    issues.sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.line - b.line;
    });

    // Limit issues per file
    const limitedIssues = issues.slice(0, config.maxIssuesPerFile);

    // Filter by severity threshold
    const thresholdOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    const filteredIssues = limitedIssues.filter(
      issue => thresholdOrder[issue.severity] <= thresholdOrder[config.severityThreshold]
    );

    // Calculate score
    const score = this._calculateScore(filteredIssues, lines.length);

    // Determine if passed
    const hasCriticalOrErrors = filteredIssues.some(i => i.severity === 'critical' || i.severity === 'error');
    const passed = !hasCriticalOrErrors;

    // Build summary
    const summary = {
      totalIssues: filteredIssues.length,
      infoCount: filteredIssues.filter(i => i.severity === 'info').length,
      warningCount: filteredIssues.filter(i => i.severity === 'warning').length,
      errorCount: filteredIssues.filter(i => i.severity === 'error').length,
      criticalCount: filteredIssues.filter(i => i.severity === 'critical').length,
    };

    const result: CodeReviewResult = {
      filePath: input.filePath as string,
      issues: filteredIssues,
      summary,
      score,
      passed,
    };

    return {
      success: true,
      data: result,
      metadata: {
        executionTime: Date.now() - startTime,
        startTime: new Date(startTime),
        endTime: new Date(),
        cached: false,
        retryCount: 0,
      },
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing CodeReviewSkill');
    this.ruleRegistry.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async _getCodeContent(input: SkillInput, context: SkillContext): Promise<string | null> {
    if (input.code) {
      return input.code as string;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(context.workspacePath, input.filePath as string);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private _detectLanguage(filePath: string, code: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const extMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
    };

    return extMap[ext || ''] || 'unknown';
  }

  private _initializeRules(): void {
    // Style rules
    this.ruleRegistry.set('style/max-line-length', {
      category: 'style',
      check: (code, lines, language) => {
        const issues: CodeReviewIssue[] = [];
        const maxLength = language === 'python' ? 88 : 80;
        
        lines.forEach((line, index) => {
          if (line.length > maxLength && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            issues.push({
              id: `style-line-length-${index + 1}`,
              severity: 'warning',
              category: 'style',
              file: '',
              line: index + 1,
              column: maxLength + 1,
              message: `Line exceeds ${maxLength} characters (${line.length})`,
              suggestion: 'Break the line into multiple lines or extract into a variable',
              ruleId: 'style/max-line-length',
            });
          }
        });
        
        return issues;
      },
    });

    this.ruleRegistry.set('style/trailing-whitespace', {
      category: 'style',
      check: (code, lines) => {
        const issues: CodeReviewIssue[] = [];
        
        lines.forEach((line, index) => {
          if (line.endsWith(' ') || line.endsWith('\t')) {
            issues.push({
              id: `style-trailing-ws-${index + 1}`,
              severity: 'info',
              category: 'style',
              file: '',
              line: index + 1,
              column: line.length,
              message: 'Line has trailing whitespace',
              suggestion: 'Remove trailing whitespace',
              ruleId: 'style/trailing-whitespace',
            });
          }
        });
        
        return issues;
      },
    });

    // Security rules
    this.ruleRegistry.set('security/no-eval', {
      category: 'security',
      check: (code, lines) => {
        const issues: CodeReviewIssue[] = [];
        const evalPattern = /\beval\s*\(/;
        
        lines.forEach((line, index) => {
          if (evalPattern.test(line)) {
            issues.push({
              id: `security-eval-${index + 1}`,
              severity: 'critical',
              category: 'security',
              file: '',
              line: index + 1,
              column: line.indexOf('eval') + 1,
              message: 'Use of eval() detected - security risk',
              suggestion: 'Use JSON.parse for JSON, or safer alternatives',
              ruleId: 'security/no-eval',
              documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!',
            });
          }
        });
        
        return issues;
      },
    });

    this.ruleRegistry.set('security/no-hardcoded-secrets', {
      category: 'security',
      check: (code, lines) => {
        const issues: CodeReviewIssue[] = [];
        const secretPatterns = [
          /password\s*=\s*["'][^"']+["']/i,
          /api[_-]?key\s*=\s*["'][^"']+["']/i,
          /secret\s*=\s*["'][^"']+["']/i,
          /token\s*=\s*["'][^"']+["']/i,
        ];
        
        lines.forEach((line, index) => {
          for (const pattern of secretPatterns) {
            if (pattern.test(line) && !line.includes('process.env') && !line.includes('//')) {
              issues.push({
                id: `security-secret-${index + 1}`,
                severity: 'error',
                category: 'security',
                file: '',
                line: index + 1,
                column: 1,
                message: 'Potential hardcoded secret detected',
                suggestion: 'Use environment variables or a secrets manager',
                ruleId: 'security/no-hardcoded-secrets',
              });
              break;
            }
          }
        });
        
        return issues;
      },
    });

    // Best practice rules
    this.ruleRegistry.set('best-practice/no-console', {
      category: 'bestPractices',
      check: (code, lines, language) => {
        const issues: CodeReviewIssue[] = [];
        if (language !== 'typescript' && language !== 'javascript') return issues;
        
        const consolePattern = /\bconsole\.(log|warn|error|info|debug)\s*\(/;
        
        lines.forEach((line, index) => {
          if (consolePattern.test(line) && !line.includes('//')) {
            issues.push({
              id: `bp-console-${index + 1}`,
              severity: 'warning',
              category: 'best-practice',
              file: '',
              line: index + 1,
              column: line.indexOf('console') + 1,
              message: 'Console statement found',
              suggestion: 'Use a proper logging library for production code',
              ruleId: 'best-practice/no-console',
            });
          }
        });
        
        return issues;
      },
    });

    // Performance rules
    this.ruleRegistry.set('performance/no-loop-allocations', {
      category: 'performance',
      check: (code, lines) => {
        const issues: CodeReviewIssue[] = [];
        const loopPattern = /(for|while)\s*\([^)]*\)\s*\{[^}]*(?:new\s+\w+|\[\s*\])/;
        
        lines.forEach((line, index) => {
          if (loopPattern.test(line)) {
            issues.push({
              id: `perf-loop-alloc-${index + 1}`,
              severity: 'warning',
              category: 'performance',
              file: '',
              line: index + 1,
              column: 1,
              message: 'Potential allocation inside loop',
              suggestion: 'Move allocations outside the loop if possible',
              ruleId: 'performance/no-loop-allocations',
            });
          }
        });
        
        return issues;
      },
    });

    // Maintainability rules
    this.ruleRegistry.set('maintainability/function-length', {
      category: 'maintainability',
      check: (code, lines) => {
        const issues: CodeReviewIssue[] = [];
        const functionPattern = /(?:function|=>)\s*[{\(]/;
        let inFunction = false;
        let functionStart = 0;
        let braceCount = 0;
        const maxFunctionLines = 50;
        
        lines.forEach((line, index) => {
          if (functionPattern.test(line) && !inFunction) {
            inFunction = true;
            functionStart = index;
            braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          } else if (inFunction) {
            braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            
            if (braceCount === 0) {
              const functionLength = index - functionStart + 1;
              if (functionLength > maxFunctionLines) {
                issues.push({
                  id: `maint-function-length-${functionStart + 1}`,
                  severity: 'warning',
                  category: 'maintainability',
                  file: '',
                  line: functionStart + 1,
                  column: 1,
                  message: `Function is ${functionLength} lines long (max recommended: ${maxFunctionLines})`,
                  suggestion: 'Consider breaking the function into smaller functions',
                  ruleId: 'maintainability/function-length',
                });
              }
              inFunction = false;
            }
          }
        });
        
        return issues;
      },
    });
  }

  private async _loadCustomRules(): Promise<void> {
    // Load custom rules from files
    for (const rulePath of this.reviewConfig.customRules) {
      try {
        const rule = await import(rulePath);
        if (rule.default && typeof rule.default.check === 'function') {
          this.ruleRegistry.set(`custom/${rule.default.name || 'unknown'}`, rule.default);
        }
      } catch (error) {
        this._log('warn', `Failed to load custom rule from ${rulePath}`, { error });
      }
    }
  }

  private _calculateScore(issues: CodeReviewIssue[], totalLines: number): number {
    if (issues.length === 0) return 100;
    
    const severityWeights = {
      info: 1,
      warning: 3,
      error: 10,
      critical: 25,
    };
    
    const totalWeight = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
    const normalizedWeight = Math.min(totalWeight / totalLines, 1);
    
    return Math.max(0, Math.round(100 - normalizedWeight * 100));
  }
}

/**
 * Review rule interface
 */
interface ReviewRule {
  category: IssueCategory;
  check: (code: string, lines: string[], language: string, filePath: string) => CodeReviewIssue[] | Promise<CodeReviewIssue[]>;
}

/**
 * Factory function for registration
 */
export default function createSkill(config?: Partial<SkillConfig>): CodeReviewSkill {
  return new CodeReviewSkill(config);
}

export { definition };
