/**
 * CodeAnalysisSkill.ts - Comprehensive Codebase Analysis
 * 
 * Analyzes codebases to provide insights on:
 * - Code structure and architecture
 * - Dependencies and relationships
 * - Complexity metrics
 * - Code quality indicators
 * - Technical debt assessment
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
 * Analysis scope
 */
export type AnalysisScope = 'file' | 'directory' | 'module' | 'project';

/**
 * Analysis metric
 */
export interface AnalysisMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

/**
 * Code entity
 */
export interface CodeEntity {
  id: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'module' | 'namespace';
  name: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  complexity: number;
  dependencies: string[];
  dependents: string[];
  documentation?: string;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    metadata: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

/**
 * Analysis result
 */
export interface CodeAnalysisResult {
  scope: AnalysisScope;
  targetPath: string;
  summary: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    averageComplexity: number;
    technicalDebtScore: number;
  };
  metrics: AnalysisMetric[];
  entities: CodeEntity[];
  dependencyGraph: DependencyGraph;
  hotspots: Array<{
    filePath: string;
    complexity: number;
    issues: string[];
  }>;
  recommendations: string[];
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  includeMetrics: boolean;
  includeDependencies: boolean;
  includeHotspots: boolean;
  complexityThreshold: number;
  maxFiles: number;
  excludePatterns: string[];
}

const definition: SkillDefinition = {
  metadata: {
    id: 'code-analysis',
    name: 'Code Analysis',
    version: '1.0.0',
    description: 'Performs comprehensive codebase analysis including structure, metrics, dependencies, and technical debt assessment.',
    category: 'analysis',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['analysis', 'metrics', 'dependencies', 'complexity', 'technical-debt'],
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
    cacheResults: true,
    cacheTtl: 600000,
    logLevel: 'info',
    customSettings: {},
  },
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        name: 'path',
        type: 'string',
        description: 'Path to analyze (file or directory)',
        required: true,
      },
      scope: {
        name: 'scope',
        type: 'string',
        description: 'Analysis scope',
        required: false,
        enum: ['file', 'directory', 'module', 'project'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Analysis options',
        required: false,
      },
    },
    required: ['path'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      scope: { name: 'scope', type: 'string', required: true },
      targetPath: { name: 'targetPath', type: 'string', required: true },
      summary: { name: 'summary', type: 'object', required: true },
      metrics: { name: 'metrics', type: 'array', required: true },
      entities: { name: 'entities', type: 'array', required: true },
      dependencyGraph: { name: 'dependencyGraph', type: 'object', required: true },
      hotspots: { name: 'hotspots', type: 'array', required: true },
      recommendations: { name: 'recommendations', type: 'array', required: true },
    },
    required: ['scope', 'targetPath', 'summary', 'metrics', 'entities', 'dependencyGraph', 'hotspots', 'recommendations'],
  },
  examples: [
    {
      name: 'Analyze project',
      description: 'Analyze entire project structure',
      input: {
        path: './src',
        scope: 'project',
        options: { includeMetrics: true, includeDependencies: true },
      },
      expectedOutput: {
        scope: 'project',
        targetPath: './src',
        summary: {
          totalFiles: 50,
          totalLines: 5000,
          totalFunctions: 200,
          totalClasses: 30,
          averageComplexity: 5.2,
          technicalDebtScore: 75,
        },
        metrics: [],
        entities: [],
        dependencyGraph: { nodes: [], edges: [] },
        hotspots: [],
        recommendations: [],
      },
    },
  ],
  requiredTools: ['file-reader', 'ast-parser'],
  requiredContext: ['workspacePath'],
  successCriteria: [{ name: 'success', description: 'Analysis completed', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Code Analysis Skill\n\nComprehensive codebase analysis for insights and metrics.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class CodeAnalysisSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing CodeAnalysisSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const targetPath = input.path as string;
    const scope = (input.scope as AnalysisScope) || 'directory';
    const options: AnalysisOptions = {
      includeMetrics: true,
      includeDependencies: true,
      includeHotspots: true,
      complexityThreshold: 10,
      maxFiles: 1000,
      excludePatterns: ['node_modules/**', 'dist/**', '*.test.ts', '*.spec.ts'],
      ...(input.options as Partial<AnalysisOptions> || {}),
    };

    this._log('info', `Analyzing ${scope}: ${targetPath}`);

    // Collect files to analyze
    const files = await this._collectFiles(targetPath, context, options);
    
    if (files.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No files found to analyze' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Analyze each file
    const entities: CodeEntity[] = [];
    const fileMetrics: Array<{ path: string; lines: number; complexity: number }> = [];

    for (const file of files) {
      try {
        const fileEntities = await this._analyzeFile(file, context);
        entities.push(...fileEntities);
        
        const content = await this._readFile(file, context);
        fileMetrics.push({
          path: file,
          lines: content.split('\n').length,
          complexity: fileEntities.reduce((sum, e) => sum + e.complexity, 0),
        });
      } catch (error) {
        this._log('warn', `Failed to analyze ${file}`, { error });
      }
    }

    // Build dependency graph
    const dependencyGraph = this._buildDependencyGraph(entities);

    // Calculate metrics
    const metrics = this._calculateMetrics(entities, fileMetrics);

    // Identify hotspots
    const hotspots = this._identifyHotspots(entities, fileMetrics, options.complexityThreshold);

    // Generate recommendations
    const recommendations = this._generateRecommendations(entities, metrics, hotspots);

    // Calculate summary
    const summary = {
      totalFiles: files.length,
      totalLines: fileMetrics.reduce((sum, m) => sum + m.lines, 0),
      totalFunctions: entities.filter(e => e.type === 'function').length,
      totalClasses: entities.filter(e => e.type === 'class').length,
      averageComplexity: entities.length > 0 
        ? entities.reduce((sum, e) => sum + e.complexity, 0) / entities.length 
        : 0,
      technicalDebtScore: this._calculateTechnicalDebtScore(metrics, hotspots),
    };

    const result: CodeAnalysisResult = {
      scope,
      targetPath,
      summary,
      metrics,
      entities,
      dependencyGraph,
      hotspots,
      recommendations,
    };

    return {
      success: true,
      data: result,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing CodeAnalysisSkill');
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  private async _collectFiles(
    targetPath: string,
    context: SkillContext,
    options: AnalysisOptions
  ): Promise<string[]> {
    const files: string[] = [];
    const path = await import('path');
    const fs = await import('fs/promises');

    const fullPath = path.join(context.workspacePath, targetPath);

    const collect = async (currentPath: string) => {
      try {
        const stat = await fs.stat(currentPath);
        
        if (stat.isFile() && this._isAnalyzableFile(currentPath)) {
          files.push(currentPath);
        } else if (stat.isDirectory()) {
          const entries = await fs.readdir(currentPath);
          
          for (const entry of entries) {
            const entryPath = path.join(currentPath, entry);
            
            // Check exclude patterns
            if (options.excludePatterns.some(pattern => 
              entryPath.includes(pattern.replace('/**', '').replace('/*', ''))
            )) {
              continue;
            }
            
            if (files.length < options.maxFiles) {
              await collect(entryPath);
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await collect(fullPath);
    return files;
  }

  private async _analyzeFile(filePath: string, context: SkillContext): Promise<CodeEntity[]> {
    const content = await this._readFile(filePath, context);
    const entities: CodeEntity[] = [];

    // Parse functions
    const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const [, name] = match;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      entities.push({
        id: `${filePath}#${name}`,
        type: 'function',
        name,
        filePath,
        lineStart: lineNumber,
        lineEnd: this._findEndLine(content, match.index),
        complexity: this._calculateComplexity(content, match.index),
        dependencies: this._extractDependencies(content, match.index),
        dependents: [],
      });
    }

    // Parse classes
    const classPattern = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    while ((match = classPattern.exec(content)) !== null) {
      const [, name] = match;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      entities.push({
        id: `${filePath}#${name}`,
        type: 'class',
        name,
        filePath,
        lineStart: lineNumber,
        lineEnd: this._findEndLine(content, match.index),
        complexity: this._calculateComplexity(content, match.index),
        dependencies: match[2] ? [match[2]] : [],
        dependents: [],
      });
    }

    // Parse interfaces
    const interfacePattern = /(?:export\s+)?interface\s+(\w+)/g;
    while ((match = interfacePattern.exec(content)) !== null) {
      const [, name] = match;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      entities.push({
        id: `${filePath}#${name}`,
        type: 'interface',
        name,
        filePath,
        lineStart: lineNumber,
        lineEnd: this._findEndLine(content, match.index),
        complexity: 1,
        dependencies: [],
        dependents: [],
      });
    }

    return entities;
  }

  private _buildDependencyGraph(entities: CodeEntity[]): DependencyGraph {
    const nodes = entities.map(e => ({
      id: e.id,
      type: e.type,
      label: e.name,
      metadata: {
        complexity: e.complexity,
        filePath: e.filePath,
      },
    }));

    const edges: DependencyGraph['edges'] = [];
    const entityMap = new Map(entities.map(e => [e.name, e.id]));

    for (const entity of entities) {
      for (const dep of entity.dependencies) {
        const targetId = entityMap.get(dep);
        if (targetId) {
          edges.push({
            from: entity.id,
            to: targetId,
            type: 'depends-on',
          });
        }
      }
    }

    return { nodes, edges };
  }

  private _calculateMetrics(
    entities: CodeEntity[],
    fileMetrics: Array<{ path: string; lines: number; complexity: number }>
  ): AnalysisMetric[] {
    const metrics: AnalysisMetric[] = [];

    // Cyclomatic complexity
    const avgComplexity = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.complexity, 0) / entities.length
      : 0;

    metrics.push({
      name: 'Average Cyclomatic Complexity',
      value: Math.round(avgComplexity * 100) / 100,
      unit: 'points',
      threshold: 10,
      status: avgComplexity > 10 ? 'critical' : avgComplexity > 5 ? 'warning' : 'good',
      description: 'Average complexity of all functions',
    });

    // Lines of code
    const totalLines = fileMetrics.reduce((sum, m) => sum + m.lines, 0);
    metrics.push({
      name: 'Total Lines of Code',
      value: totalLines,
      unit: 'lines',
      status: 'good',
      description: 'Total lines of code analyzed',
    });

    // Function count
    const functionCount = entities.filter(e => e.type === 'function').length;
    metrics.push({
      name: 'Function Count',
      value: functionCount,
      unit: 'functions',
      status: 'good',
      description: 'Total number of functions',
    });

    // Class count
    const classCount = entities.filter(e => e.type === 'class').length;
    metrics.push({
      name: 'Class Count',
      value: classCount,
      unit: 'classes',
      status: 'good',
      description: 'Total number of classes',
    });

    // Documentation coverage
    const documentedEntities = entities.filter(e => e.documentation).length;
    const docCoverage = entities.length > 0 ? (documentedEntities / entities.length) * 100 : 0;
    metrics.push({
      name: 'Documentation Coverage',
      value: Math.round(docCoverage * 100) / 100,
      unit: 'percent',
      threshold: 80,
      status: docCoverage < 50 ? 'critical' : docCoverage < 80 ? 'warning' : 'good',
      description: 'Percentage of entities with documentation',
    });

    return metrics;
  }

  private _identifyHotspots(
    entities: CodeEntity[],
    fileMetrics: Array<{ path: string; lines: number; complexity: number }>,
    complexityThreshold: number
  ): CodeAnalysisResult['hotspots'] {
    const hotspots: CodeAnalysisResult['hotspots'] = [];

    // Group by file
    const fileEntities = new Map<string, CodeEntity[]>();
    for (const entity of entities) {
      if (!fileEntities.has(entity.filePath)) {
        fileEntities.set(entity.filePath, []);
      }
      fileEntities.get(entity.filePath)!.push(entity);
    }

    for (const [filePath, fileEnts] of fileEntities) {
      const totalComplexity = fileEnts.reduce((sum, e) => sum + e.complexity, 0);
      
      if (totalComplexity > complexityThreshold * 2) {
        const issues: string[] = [];
        
        if (totalComplexity > complexityThreshold * 3) {
          issues.push('Very high complexity - consider refactoring');
        }
        
        const undocumentedCount = fileEnts.filter(e => !e.documentation).length;
        if (undocumentedCount > fileEnts.length * 0.5) {
          issues.push('Poor documentation coverage');
        }

        hotspots.push({
          filePath,
          complexity: totalComplexity,
          issues,
        });
      }
    }

    return hotspots.sort((a, b) => b.complexity - a.complexity).slice(0, 10);
  }

  private _generateRecommendations(
    entities: CodeEntity[],
    metrics: AnalysisMetric[],
    hotspots: CodeAnalysisResult['hotspots']
  ): string[] {
    const recommendations: string[] = [];

    // Complexity recommendations
    const complexityMetric = metrics.find(m => m.name === 'Average Cyclomatic Complexity');
    if (complexityMetric && complexityMetric.status !== 'good') {
      recommendations.push('Refactor complex functions to reduce cyclomatic complexity');
    }

    // Documentation recommendations
    const docMetric = metrics.find(m => m.name === 'Documentation Coverage');
    if (docMetric && docMetric.status !== 'good') {
      recommendations.push('Add JSDoc comments to improve documentation coverage');
    }

    // Hotspot recommendations
    if (hotspots.length > 0) {
      recommendations.push(`Address ${hotspots.length} identified code hotspots`);
    }

    // High complexity functions
    const highComplexityFunctions = entities.filter(e => e.complexity > 10);
    if (highComplexityFunctions.length > 0) {
      recommendations.push(`Refactor ${highComplexityFunctions.length} functions with complexity > 10`);
    }

    return recommendations;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private _isAnalyzableFile(filePath: string): boolean {
    const analyzableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go'];
    return analyzableExtensions.some(ext => filePath.endsWith(ext));
  }

  private async _readFile(filePath: string, context: SkillContext): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  }

  private _findEndLine(content: string, startIndex: number): number {
    // Simple heuristic - find matching closing brace
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const prevChar = content[i - 1];

      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return content.substring(0, i).split('\n').length;
          }
        }
      } else if (char === stringChar && prevChar !== '\\') {
        inString = false;
      }
    }

    return content.split('\n').length;
  }

  private _calculateComplexity(content: string, startIndex: number): number {
    // Simple cyclomatic complexity calculation
    const functionContent = content.substring(startIndex, startIndex + 2000);
    let complexity = 1;

    const complexityKeywords = ['if', 'while', 'for', 'case', 'catch', '&&', '||', '?'];
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = functionContent.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private _extractDependencies(content: string, startIndex: number): string[] {
    const deps: string[] = [];
    const functionContent = content.substring(startIndex, startIndex + 2000);

    // Match function calls
    const callPattern = /\b(\w+)\s*\(/g;
    let match;

    while ((match = callPattern.exec(functionContent)) !== null) {
      const [, name] = match;
      if (!['if', 'while', 'for', 'switch', 'catch', 'return'].includes(name)) {
        deps.push(name);
      }
    }

    return [...new Set(deps)];
  }

  private _calculateTechnicalDebtScore(metrics: AnalysisMetric[], hotspots: unknown[]): number {
    let score = 100;

    for (const metric of metrics) {
      if (metric.status === 'critical') score -= 15;
      else if (metric.status === 'warning') score -= 5;
    }

    score -= hotspots.length * 2;

    return Math.max(0, score);
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

export default function createSkill(config?: Partial<SkillConfig>): CodeAnalysisSkill {
  return new CodeAnalysisSkill(config);
}

export { definition };
