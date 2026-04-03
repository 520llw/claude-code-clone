/**
 * CodeGenerationSkill.ts - Intelligent Code Generation
 * 
 * Generates code based on:
 * - Natural language descriptions
 * - Type definitions
 * - Existing code patterns
 * - API specifications
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
 * Code generation type
 */
export type GenerationType =
  | 'function'
  | 'class'
  | 'interface'
  | 'component'
  | 'test'
  | 'utility'
  | 'api-client'
  | 'validation'
  | 'complete';

/**
 * Generated code result
 */
export interface GeneratedCode {
  type: GenerationType;
  language: string;
  code: string;
  fileName: string;
  description: string;
  dependencies: string[];
  imports: string[];
  exports: string[];
  examples: string[];
  documentation: string;
}

/**
 * Code generation options
 */
export interface CodeGenerationOptions {
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
  style: 'functional' | 'object-oriented' | 'mixed';
  includeTests: boolean;
  includeDocumentation: boolean;
  includeExamples: boolean;
  maxLines: number;
  complexity: 'simple' | 'moderate' | 'complex';
  patterns: string[];
}

const definition: SkillDefinition = {
  metadata: {
    id: 'code-generation',
    name: 'Code Generation',
    version: '1.0.0',
    description: 'Generates code from natural language descriptions, type definitions, and specifications.',
    category: 'generation',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['code-generation', 'ai', 'automation'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 60000,
    retries: 2,
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
      description: {
        name: 'description',
        type: 'string',
        description: 'Natural language description of what to generate',
        required: true,
      },
      generationType: {
        name: 'generationType',
        type: 'string',
        description: 'Type of code to generate',
        required: true,
        enum: ['function', 'class', 'interface', 'component', 'test', 'utility', 'api-client', 'validation'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Generation options',
        required: false,
      },
      context: {
        name: 'context',
        type: 'object',
        description: 'Additional context (types, interfaces, existing code)',
        required: false,
      },
    },
    required: ['description', 'generationType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      type: { name: 'type', type: 'string', required: true },
      language: { name: 'language', type: 'string', required: true },
      code: { name: 'code', type: 'string', required: true },
      fileName: { name: 'fileName', type: 'string', required: true },
      description: { name: 'description', type: 'string', required: true },
      dependencies: { name: 'dependencies', type: 'array', required: true },
      imports: { name: 'imports', type: 'array', required: true },
      exports: { name: 'exports', type: 'array', required: true },
      examples: { name: 'examples', type: 'array', required: true },
      documentation: { name: 'documentation', type: 'string', required: true },
    },
    required: ['type', 'language', 'code', 'fileName', 'description', 'dependencies', 'imports', 'exports', 'examples', 'documentation'],
  },
  examples: [
    {
      name: 'Generate utility function',
      description: 'Generate a utility function',
      input: {
        description: 'Create a function that formats dates in a human-readable way',
        generationType: 'function',
        options: { language: 'typescript', includeTests: true },
      },
      expectedOutput: {
        type: 'function',
        language: 'typescript',
        code: 'export function formatDate(date: Date): string { ... }',
        fileName: 'formatDate.ts',
        description: 'Formats dates in human-readable format',
        dependencies: [],
        imports: [],
        exports: ['formatDate'],
        examples: [],
        documentation: '/** ... */',
      },
    },
  ],
  requiredTools: [],
  requiredContext: [],
  successCriteria: [{ name: 'success', description: 'Code generated', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Code Generation Skill\n\nGenerates code from descriptions and specifications.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class CodeGenerationSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing CodeGenerationSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const description = input.description as string;
    const generationType = input.generationType as GenerationType;
    const options: CodeGenerationOptions = {
      language: 'typescript',
      style: 'mixed',
      includeTests: true,
      includeDocumentation: true,
      includeExamples: true,
      maxLines: 100,
      complexity: 'moderate',
      patterns: [],
      ...(input.options as Partial<CodeGenerationOptions> || {}),
    };

    this._log('info', `Generating ${generationType}`, { description: description.substring(0, 50) });

    // Generate code based on type
    let generatedCode: GeneratedCode;

    switch (generationType) {
      case 'function':
        generatedCode = this._generateFunction(description, options, input.context as Record<string, unknown>);
        break;
      case 'class':
        generatedCode = this._generateClass(description, options, input.context as Record<string, unknown>);
        break;
      case 'interface':
        generatedCode = this._generateInterface(description, options, input.context as Record<string, unknown>);
        break;
      case 'component':
        generatedCode = this._generateComponent(description, options, input.context as Record<string, unknown>);
        break;
      case 'test':
        generatedCode = this._generateTest(description, options, input.context as Record<string, unknown>);
        break;
      case 'utility':
        generatedCode = this._generateUtility(description, options, input.context as Record<string, unknown>);
        break;
      case 'api-client':
        generatedCode = this._generateApiClient(description, options, input.context as Record<string, unknown>);
        break;
      case 'validation':
        generatedCode = this._generateValidation(description, options, input.context as Record<string, unknown>);
        break;
      default:
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: `Unknown generation type: ${generationType}` },
          metadata: this._createMetadata(startTime),
        };
    }

    return {
      success: true,
      data: generatedCode,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing CodeGenerationSkill');
  }

  // ============================================================================
  // Generation Methods
  // ============================================================================

  private _generateFunction(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const functionName = this._extractFunctionName(description) || 'generatedFunction';
    const params = this._extractParameters(description);
    const returnType = this._extractReturnType(description);

    let code = '';

    // Add documentation
    if (options.includeDocumentation) {
      code += `/**\n * ${description}\n`;
      for (const param of params) {
        code += ` * @param ${param.name} - ${param.description}\n`;
      }
      if (returnType) {
        code += ` * @returns ${returnType.description}\n`;
      }
      code += ` */\n`;
    }

    // Function signature
    const isAsync = description.toLowerCase().includes('async') || description.toLowerCase().includes('fetch');
    code += `${isAsync ? 'async ' : ''}export function ${functionName}(`;
    code += params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
    code += `)`;
    if (returnType && options.language === 'typescript') {
      code += `: ${isAsync ? 'Promise<' : ''}${returnType.type}${isAsync ? '>' : ''}`;
    }
    code += ` {\n`;

    // Function body
    code += this._generateFunctionBody(description, params, isAsync, options.complexity);

    code += `}\n`;

    return {
      type: 'function',
      language: options.language,
      code,
      fileName: `${functionName}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [functionName],
      examples: this._generateExamples(functionName, params),
      documentation: options.includeDocumentation ? code.split('{')[0] : '',
    };
  }

  private _generateClass(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const className = this._extractClassName(description) || 'GeneratedClass';

    let code = '';

    if (options.includeDocumentation) {
      code += `/**\n * ${description}\n */\n`;
    }

    code += `export class ${className} {\n`;

    // Properties
    code += `  // Properties\n`;
    code += `  private _data: unknown;\n\n`;

    // Constructor
    code += `  constructor(data?: unknown) {\n`;
    code += `    this._data = data;\n`;
    code += `  }\n\n`;

    // Methods
    code += `  // Methods\n`;
    code += `  public process(): unknown {\n`;
    code += `    // TODO: Implement processing logic\n`;
    code += `    return this._data;\n`;
    code += `  }\n`;

    code += `}\n`;

    return {
      type: 'class',
      language: options.language,
      code,
      fileName: `${className}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [className],
      examples: [`const instance = new ${className}();`],
      documentation: '',
    };
  }

  private _generateInterface(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const interfaceName = this._extractClassName(description) || 'GeneratedInterface';

    let code = '';

    if (options.includeDocumentation) {
      code += `/**\n * ${description}\n */\n`;
    }

    code += `export interface ${interfaceName} {\n`;
    code += `  id: string;\n`;
    code += `  name: string;\n`;
    code += `  createdAt: Date;\n`;
    code += `  updatedAt: Date;\n`;
    code += `}\n`;

    return {
      type: 'interface',
      language: options.language,
      code,
      fileName: `${interfaceName}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [interfaceName],
      examples: [`const data: ${interfaceName} = { id: '1', name: 'test', createdAt: new Date(), updatedAt: new Date() };`],
      documentation: '',
    };
  }

  private _generateComponent(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const componentName = this._extractClassName(description) || 'GeneratedComponent';

    let code = '';

    code += `import React from 'react';\n\n`;

    if (options.includeDocumentation) {
      code += `/**\n * ${description}\n */\n`;
    }

    code += `export interface ${componentName}Props {\n`;
    code += `  title?: string;\n`;
    code += `  children?: React.ReactNode;\n`;
    code += `}\n\n`;

    code += `export const ${componentName}: React.FC<${componentName}Props> = ({ title, children }) => {\n`;
    code += `  return (\n`;
    code += `    <div className="${componentName.toLowerCase()}">\n`;
    code += `      {title && <h2>{title}</h2>}\n`;
    code += `      {children}\n`;
    code += `    </div>\n`;
    code += `  );\n`;
    code += `};\n`;

    return {
      type: 'component',
      language: options.language,
      code,
      fileName: `${componentName}.tsx`,
      description,
      dependencies: ['react'],
      imports: ['react'],
      exports: [componentName],
      examples: [`<${componentName} title="Hello">Content</${componentName}>`],
      documentation: '',
    };
  }

  private _generateTest(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const targetFunction = context?.['targetFunction'] as string || 'targetFunction';

    let code = '';

    code += `import { describe, it, expect } from 'vitest';\n`;
    code += `import { ${targetFunction} } from './${targetFunction}';\n\n`;

    code += `describe('${targetFunction}', () => {\n`;
    code += `  it('should work correctly', () => {\n`;
    code += `    const result = ${targetFunction}();\n`;
    code += `    expect(result).toBeDefined();\n`;
    code += `  });\n`;
    code += `});\n`;

    return {
      type: 'test',
      language: options.language,
      code,
      fileName: `${targetFunction}.test.ts`,
      description,
      dependencies: ['vitest'],
      imports: ['vitest'],
      exports: [],
      examples: [],
      documentation: '',
    };
  }

  private _generateUtility(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const utilityName = this._extractFunctionName(description) || 'utility';

    let code = '';

    code += `/**\n * Utility functions for ${utilityName}\n */\n\n`;

    code += `/**\n * ${description}\n */\n`;
    code += `export function ${utilityName}(input: unknown): unknown {\n`;
    code += `  // TODO: Implement\n`;
    code += `  return input;\n`;
    code += `}\n`;

    return {
      type: 'utility',
      language: options.language,
      code,
      fileName: `${utilityName}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [utilityName],
      examples: [`${utilityName}(data)`],
      documentation: '',
    };
  }

  private _generateApiClient(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const clientName = this._extractClassName(description) || 'ApiClient';
    const baseUrl = context?.['baseUrl'] as string || 'https://api.example.com';

    let code = '';

    code += `export class ${clientName} {\n`;
    code += `  private baseUrl: string;\n`;
    code += `  private headers: Record<string, string>;\n\n`;

    code += `  constructor(apiKey?: string) {\n`;
    code += `    this.baseUrl = '${baseUrl}';\n`;
    code += `    this.headers = {\n`;
    code += `      'Content-Type': 'application/json',\n`;
    code += `      ...(apiKey && { 'Authorization': \`Bearer \${apiKey}\` }),\n`;
    code += `    };\n`;
    code += `  }\n\n`;

    code += `  async get<T>(endpoint: string): Promise<T> {\n`;
    code += `    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {\n`;
    code += `      headers: this.headers,\n`;
    code += `    });\n`;
    code += `    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n`;
    code += `    return response.json();\n`;
    code += `  }\n\n`;

    code += `  async post<T>(endpoint: string, data: unknown): Promise<T> {\n`;
    code += `    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {\n`;
    code += `      method: 'POST',\n`;
    code += `      headers: this.headers,\n`;
    code += `      body: JSON.stringify(data),\n`;
    code += `    });\n`;
    code += `    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n`;
    code += `    return response.json();\n`;
    code += `  }\n`;

    code += `}\n`;

    return {
      type: 'api-client',
      language: options.language,
      code,
      fileName: `${clientName}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [clientName],
      examples: [`const client = new ${clientName}('api-key');`],
      documentation: '',
    };
  }

  private _generateValidation(
    description: string,
    options: CodeGenerationOptions,
    context?: Record<string, unknown>
  ): GeneratedCode {
    const validatorName = this._extractFunctionName(description) || 'validate';

    let code = '';

    code += `export interface ValidationResult {\n`;
    code += `  valid: boolean;\n`;
    code += `  errors: string[];\n`;
    code += `}\n\n`;

    code += `export function ${validatorName}(data: unknown): ValidationResult {\n`;
    code += `  const errors: string[] = [];\n\n`;
    code += `  if (!data) {\n`;
    code += `    errors.push('Data is required');\n`;
    code += `  }\n\n`;
    code += `  return {\n`;
    code += `    valid: errors.length === 0,\n`;
    code += `    errors,\n`;
    code += `  };\n`;
    code += `}\n`;

    return {
      type: 'validation',
      language: options.language,
      code,
      fileName: `${validatorName}.ts`,
      description,
      dependencies: [],
      imports: [],
      exports: [validatorName, 'ValidationResult'],
      examples: [`const result = ${validatorName}(data);`],
      documentation: '',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private _extractFunctionName(description: string): string | null {
    const patterns = [
      /function\s+(\w+)/i,
      /create\s+(?:a\s+)?(?:function\s+)?(?:called\s+)?(\w+)/i,
      /generate\s+(?:a\s+)?(?:function\s+)?(?:called\s+)?(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private _extractClassName(description: string): string | null {
    const patterns = [
      /class\s+(\w+)/i,
      /component\s+(\w+)/i,
      /create\s+(?:a\s+)?(?:class|component)\s+(?:called\s+)?(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private _extractParameters(description: string): Array<{ name: string; type: string; optional: boolean; description: string }> {
    // Simple parameter extraction
    const params: Array<{ name: string; type: string; optional: boolean; description: string }> = [];
    
    if (description.includes('date')) {
      params.push({ name: 'date', type: 'Date', optional: false, description: 'The date to format' });
    }
    if (description.includes('input') || description.includes('data')) {
      params.push({ name: 'input', type: 'unknown', optional: false, description: 'Input data' });
    }
    if (description.includes('options')) {
      params.push({ name: 'options', type: 'Record<string, unknown>', optional: true, description: 'Optional configuration' });
    }

    if (params.length === 0) {
      params.push({ name: 'value', type: 'unknown', optional: false, description: 'Input value' });
    }

    return params;
  }

  private _extractReturnType(description: string): { type: string; description: string } | null {
    if (description.includes('string') || description.includes('format')) {
      return { type: 'string', description: 'Formatted string' };
    }
    if (description.includes('boolean')) {
      return { type: 'boolean', description: 'Boolean result' };
    }
    if (description.includes('array') || description.includes('list')) {
      return { type: 'unknown[]', description: 'Array of results' };
    }
    return { type: 'unknown', description: 'Result' };
  }

  private _generateFunctionBody(
    description: string,
    params: Array<{ name: string; type: string }>,
    isAsync: boolean,
    complexity: string
  ): string {
    let body = '';

    if (description.toLowerCase().includes('format') && description.toLowerCase().includes('date')) {
      body += `  const d = date instanceof Date ? date : new Date(date);\n`;
      body += `  return d.toLocaleDateString('en-US', {\n`;
      body += `    year: 'numeric',\n`;
      body += `    month: 'long',\n`;
      body += `    day: 'numeric',\n`;
      body += `  });\n`;
    } else if (description.toLowerCase().includes('validate')) {
      body += `  // Validation logic\n`;
      body += `  if (!value) {\n`;
      body += `    throw new Error('Invalid input');\n`;
      body += `  }\n`;
      body += `  return true;\n`;
    } else if (isAsync) {
      body += `  // Async operation\n`;
      body += `  const response = await fetch('/api/data');\n`;
      body += `  return response.json();\n`;
    } else {
      body += `  // TODO: Implement ${description.toLowerCase()}\n`;
      body += `  return value;\n`;
    }

    return body;
  }

  private _generateExamples(functionName: string, params: Array<{ name: string }>): string[] {
    const args = params.map(p => `'${p.name}'`).join(', ');
    return [
      `${functionName}(${args})`,
    ];
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

export default function createSkill(config?: Partial<SkillConfig>): CodeGenerationSkill {
  return new CodeGenerationSkill(config);
}

export { definition };
