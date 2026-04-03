/**
 * DocumentationSkill.ts - Documentation Generation
 * 
 * Generates comprehensive documentation including:
 * - JSDoc/TSDoc comments
 * - README files
 * - API documentation
 * - Usage examples
 * - Changelog entries
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
 * Documentation type
 */
export type DocumentationType =
  | 'jsdoc'
  | 'readme'
  | 'api'
  | 'examples'
  | 'changelog'
  | 'contributing'
  | 'license'
  | 'all';

/**
 * Generated documentation
 */
export interface GeneratedDocumentation {
  type: DocumentationType;
  filePath?: string;
  content: string;
  sections: DocumentationSection[];
  metadata: {
    generatedAt: Date;
    sourceFiles: string[];
    totalLines: number;
    coverage: number;
  };
}

/**
 * Documentation section
 */
export interface DocumentationSection {
  title: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Documentation options
 */
export interface DocumentationOptions {
  includePrivate: boolean;
  includeExamples: boolean;
  includeTypes: boolean;
  style: 'minimal' | 'standard' | 'verbose';
  template?: string;
  customSections?: string[];
}

const definition: SkillDefinition = {
  metadata: {
    id: 'documentation',
    name: 'Documentation Generation',
    version: '1.0.0',
    description: 'Generates comprehensive documentation including JSDoc comments, README files, API docs, and usage examples.',
    category: 'code',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['documentation', 'jsdoc', 'readme', 'api-docs'],
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
        description: 'Path to source file or directory',
        required: true,
      },
      docType: {
        name: 'docType',
        type: 'string',
        description: 'Type of documentation to generate',
        required: true,
        enum: ['jsdoc', 'readme', 'api', 'examples', 'changelog', 'all'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Documentation generation options',
        required: false,
      },
      outputPath: {
        name: 'outputPath',
        type: 'string',
        description: 'Output path for generated documentation',
        required: false,
      },
    },
    required: ['filePath', 'docType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      type: { name: 'type', type: 'string', required: true },
      content: { name: 'content', type: 'string', required: true },
      filePath: { name: 'filePath', type: 'string', required: false },
      sections: { name: 'sections', type: 'array', required: true },
      metadata: { name: 'metadata', type: 'object', required: true },
    },
    required: ['type', 'content', 'sections', 'metadata'],
  },
  examples: [
    {
      name: 'Generate JSDoc',
      description: 'Generate JSDoc comments for a TypeScript file',
      input: {
        filePath: 'src/utils.ts',
        docType: 'jsdoc',
        options: { includeExamples: true, includeTypes: true },
      },
      expectedOutput: {
        type: 'jsdoc',
        content: '/** ... */',
        sections: [],
        metadata: { generatedAt: new Date(), sourceFiles: ['src/utils.ts'], totalLines: 50, coverage: 0.9 },
      },
    },
  ],
  requiredTools: ['file-reader', 'ast-parser'],
  requiredContext: ['workspacePath'],
  successCriteria: [{ name: 'success', description: 'Documentation generated', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Documentation Generation Skill\n\nGenerates comprehensive documentation.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class DocumentationSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing DocumentationSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const docType = input.docType as DocumentationType;
    
    this._log('info', `Generating ${docType} documentation`, { filePath: input.filePath });

    // Get source code
    const sourceCode = await this._getSourceCode(input, context);
    if (!sourceCode) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Could not read source code' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Generate documentation based on type
    let documentation: GeneratedDocumentation;
    
    switch (docType) {
      case 'jsdoc':
        documentation = this._generateJSDoc(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      case 'readme':
        documentation = this._generateREADME(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      case 'api':
        documentation = this._generateAPIDocs(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      case 'examples':
        documentation = this._generateExamples(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      case 'changelog':
        documentation = this._generateChangelog(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      case 'all':
        documentation = this._generateAllDocs(sourceCode, input.filePath as string, input.options as DocumentationOptions);
        break;
      default:
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: `Unknown documentation type: ${docType}` },
          metadata: this._createMetadata(startTime),
        };
    }

    // Write to file if output path specified
    if (input.outputPath) {
      await this._writeDocumentation(input.outputPath as string, documentation.content, context);
    }

    return {
      success: true,
      data: documentation,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing DocumentationSkill');
  }

  // ============================================================================
  // Documentation Generation Methods
  // ============================================================================

  private _generateJSDoc(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    const sections: DocumentationSection[] = [];
    const lines = code.split('\n');
    const includeExamples = options?.includeExamples ?? true;
    const includeTypes = options?.includeTypes ?? true;
    const includePrivate = options?.includePrivate ?? false;

    let generatedDocs = '';
    let inComment = false;
    let currentComment = '';

    // Parse functions and classes
    const functionPattern = /(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
    const classPattern = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    const methodPattern = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;

    let match;

    // Generate JSDoc for functions
    while ((match = functionPattern.exec(code)) !== null) {
      const [fullMatch, name, params, returnType] = match;
      const lineIndex = code.substring(0, match.index).split('\n').length;

      // Skip if already has JSDoc
      const prevLines = lines.slice(Math.max(0, lineIndex - 5), lineIndex);
      if (prevLines.some(l => l.includes('/**'))) continue;

      // Skip private if not including
      if (!includePrivate && prevLines.some(l => l.includes('@private'))) continue;

      const jsdoc = this._buildJSDocComment(name, params, returnType, includeExamples, includeTypes);
      
      sections.push({
        title: name,
        level: 2,
        content: jsdoc,
        lineStart: lineIndex,
        lineEnd: lineIndex,
      });

      generatedDocs += jsdoc + '\n';
    }

    // Generate JSDoc for classes
    while ((match = classPattern.exec(code)) !== null) {
      const [fullMatch, name, extendsClass] = match;
      const lineIndex = code.substring(0, match.index).split('\n').length;

      const prevLines = lines.slice(Math.max(0, lineIndex - 5), lineIndex);
      if (prevLines.some(l => l.includes('/**'))) continue;

      let jsdoc = `/**\n * ${name} class\n`;
      if (extendsClass) {
        jsdoc += ` * @extends ${extendsClass}\n`;
      }
      jsdoc += ` */\n`;

      sections.push({
        title: name,
        level: 2,
        content: jsdoc,
        lineStart: lineIndex,
        lineEnd: lineIndex,
      });

      generatedDocs += jsdoc + '\n';
    }

    return {
      type: 'jsdoc',
      filePath,
      content: generatedDocs,
      sections,
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: lines.length,
        coverage: sections.length / (lines.filter(l => l.match(/(?:function|class)\s+\w+/)).length || 1),
      },
    };
  }

  private _buildJSDocComment(
    name: string,
    params: string,
    returnType: string | undefined,
    includeExamples: boolean,
    includeTypes: boolean
  ): string {
    let comment = `/**\n * ${name}\n *\n`;

    // Parse parameters
    if (params) {
      const paramList = params.split(',').map(p => p.trim()).filter(p => p);
      for (const param of paramList) {
        const [paramName, paramType] = param.split(':').map(s => s.trim());
        const cleanName = paramName.replace(/[?\[\]]/g, '');
        const optional = paramName.includes('?');
        
        comment += ` * @param`;
        if (includeTypes && (paramType || paramType === undefined)) {
          comment += ` {${paramType || 'any'}}`;
        }
        comment += ` ${cleanName} - Description${optional ? ' (optional)' : ''}\n`;
      }
    }

    // Add return type
    if (returnType && includeTypes) {
      comment += ` * @returns {${returnType}} Description\n`;
    } else if (returnType) {
      comment += ` * @returns Description\n`;
    }

    // Add example
    if (includeExamples) {
      comment += ` *\n * @example\n * ${name}(${params ? 'params' : ''});\n`;
    }

    comment += ` */`;
    return comment;
  }

  private _generateREADME(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    const sections: DocumentationSection[] = [];
    const style = options?.style || 'standard';

    // Extract package info from package.json if available
    const packageName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Project';

    let readme = '';

    // Title
    readme += `# ${packageName}\n\n`;
    sections.push({ title: packageName, level: 1, content: '', lineStart: 1, lineEnd: 1 });

    // Description
    readme += `## Description\n\n`;
    readme += `A brief description of what this project does.\n\n`;
    sections.push({ title: 'Description', level: 2, content: 'Project description', lineStart: 3, lineEnd: 5 });

    // Installation
    readme += `## Installation\n\n`;
    readme += `\`\`\`bash\nnpm install ${packageName}\n\`\`\`\n\n`;
    sections.push({ title: 'Installation', level: 2, content: 'Installation instructions', lineStart: 7, lineEnd: 11 });

    // Usage
    readme += `## Usage\n\n`;
    readme += `\`\`\`typescript\nimport { something } from '${packageName}';\n\n// Your code here\n\`\`\`\n\n`;
    sections.push({ title: 'Usage', level: 2, content: 'Usage examples', lineStart: 13, lineEnd: 20 });

    // API (if verbose style)
    if (style === 'verbose') {
      readme += `## API\n\n`;
      readme += `See the [API documentation](./API.md) for detailed information.\n\n`;
      sections.push({ title: 'API', level: 2, content: 'API reference', lineStart: 22, lineEnd: 24 });
    }

    // Contributing
    readme += `## Contributing\n\n`;
    readme += `Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).\n\n`;
    sections.push({ title: 'Contributing', level: 2, content: 'Contributing guidelines', lineStart: 26, lineEnd: 28 });

    // License
    readme += `## License\n\n`;
    readme += `MIT\n`;
    sections.push({ title: 'License', level: 2, content: 'License information', lineStart: 30, lineEnd: 32 });

    return {
      type: 'readme',
      filePath: 'README.md',
      content: readme,
      sections,
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: readme.split('\n').length,
        coverage: 1,
      },
    };
  }

  private _generateAPIDocs(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    const sections: DocumentationSection[] = [];
    let apiDocs = `# API Documentation\n\n`;

    // Parse exports
    const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/g;
    let match;

    while ((match = exportPattern.exec(code)) !== null) {
      const [, name] = match;
      apiDocs += `## ${name}\n\n`;
      apiDocs += `Description of ${name}.\n\n`;
      sections.push({ title: name, level: 2, content: `API docs for ${name}`, lineStart: 1, lineEnd: 3 });
    }

    return {
      type: 'api',
      filePath: 'API.md',
      content: apiDocs,
      sections,
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: apiDocs.split('\n').length,
        coverage: sections.length / (code.match(/export/g)?.length || 1),
      },
    };
  }

  private _generateExamples(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    const sections: DocumentationSection[] = [];
    let examples = `# Usage Examples\n\n`;

    // Extract function signatures for examples
    const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      const [, name, params] = match;
      examples += `## ${name}\n\n`;
      examples += `\`\`\`typescript\n`;
      examples += `// Example usage of ${name}\n`;
      examples += `const result = await ${name}(${params ? '/* arguments */' : ''});\n`;
      examples += `console.log(result);\n`;
      examples += `\`\`\`\n\n`;

      sections.push({
        title: name,
        level: 2,
        content: `Example for ${name}`,
        lineStart: 1,
        lineEnd: 6,
      });
    }

    return {
      type: 'examples',
      filePath: 'EXAMPLES.md',
      content: examples,
      sections,
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: examples.split('\n').length,
        coverage: 1,
      },
    };
  }

  private _generateChangelog(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    const sections: DocumentationSection[] = [];
    const today = new Date().toISOString().split('T')[0];

    let changelog = `# Changelog\n\n`;
    changelog += `All notable changes to this project will be documented in this file.\n\n`;
    changelog += `## [Unreleased]\n\n`;
    changelog += `### Added\n- Initial release\n\n`;
    changelog += `## [1.0.0] - ${today}\n\n`;
    changelog += `### Added\n- First stable release\n`;

    sections.push(
      { title: 'Changelog', level: 1, content: 'Changelog header', lineStart: 1, lineEnd: 3 },
      { title: 'Unreleased', level: 2, content: 'Unreleased changes', lineStart: 5, lineEnd: 8 },
      { title: '1.0.0', level: 2, content: 'Version 1.0.0', lineStart: 10, lineEnd: 13 }
    );

    return {
      type: 'changelog',
      filePath: 'CHANGELOG.md',
      content: changelog,
      sections,
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: changelog.split('\n').length,
        coverage: 1,
      },
    };
  }

  private _generateAllDocs(
    code: string,
    filePath: string,
    options?: DocumentationOptions
  ): GeneratedDocumentation {
    // Combine all documentation types
    const jsdoc = this._generateJSDoc(code, filePath, options);
    const readme = this._generateREADME(code, filePath, options);
    const api = this._generateAPIDocs(code, filePath, options);
    const examples = this._generateExamples(code, filePath, options);
    const changelog = this._generateChangelog(code, filePath, options);

    const allContent = [
      '# Complete Documentation\n',
      '---\n',
      readme.content,
      '---\n',
      api.content,
      '---\n',
      examples.content,
      '---\n',
      changelog.content,
      '---\n',
      '## JSDoc Comments\n',
      jsdoc.content,
    ].join('\n');

    return {
      type: 'all',
      filePath: 'DOCUMENTATION.md',
      content: allContent,
      sections: [...readme.sections, ...api.sections, ...examples.sections, ...changelog.sections, ...jsdoc.sections],
      metadata: {
        generatedAt: new Date(),
        sourceFiles: [filePath],
        totalLines: allContent.split('\n').length,
        coverage: 1,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async _getSourceCode(input: SkillInput, context: SkillContext): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(context.workspacePath, input.filePath as string);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async _writeDocumentation(
    outputPath: string,
    content: string,
    context: SkillContext
  ): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(context.workspacePath, outputPath);
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      this._log('warn', 'Failed to write documentation', { error });
    }
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

export default function createSkill(config?: Partial<SkillConfig>): DocumentationSkill {
  return new DocumentationSkill(config);
}

export { definition };
