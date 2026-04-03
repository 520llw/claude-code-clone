/**
 * Skill Templates - Template generation for new skills
 * 
 * Provides templates for creating new skills with proper structure.
 */

import {
  SkillDefinition,
  SkillMetadata,
  SkillCategory,
  SkillAuthor,
  SkillInputSchema,
  SkillOutputSchema,
  SkillExample,
  SkillParameter,
} from '../types';

/**
 * Template options
 */
export interface SkillTemplateOptions {
  name: string;
  id?: string;
  description?: string;
  category?: SkillCategory;
  author?: SkillAuthor;
  includeExamples?: boolean;
  includeTests?: boolean;
  includeDocumentation?: boolean;
}

/**
 * Generated skill template
 */
export interface GeneratedSkillTemplate {
  definition: SkillDefinition;
  typescriptCode: string;
  jsonConfig: string;
  readme: string;
  testCode?: string;
}

/**
 * Skill template generator
 */
export class SkillTemplateGenerator {
  /**
   * Generate a complete skill template
   */
  generate(options: SkillTemplateOptions): GeneratedSkillTemplate {
    const id = options.id || this._toKebabCase(options.name);
    const category = options.category || 'custom';
    const description = options.description || `${options.name} skill`;
    const author = options.author || { name: 'Anonymous' };

    const definition = this._generateDefinition(id, options.name, description, category, author);
    const typescriptCode = this._generateTypeScript(definition);
    const jsonConfig = this._generateJSON(definition);
    const readme = this._generateReadme(definition);
    const testCode = options.includeTests ? this._generateTests(definition) : undefined;

    return {
      definition,
      typescriptCode,
      jsonConfig,
      readme,
      testCode,
    };
  }

  /**
   * Generate a code skill template
   */
  generateCodeSkill(name: string, options?: Partial<SkillTemplateOptions>): GeneratedSkillTemplate {
    return this.generate({
      name,
      category: 'code',
      description: `Code skill: ${name}`,
      includeExamples: true,
      includeTests: true,
      includeDocumentation: true,
      ...options,
    });
  }

  /**
   * Generate an analysis skill template
   */
  generateAnalysisSkill(name: string, options?: Partial<SkillTemplateOptions>): GeneratedSkillTemplate {
    return this.generate({
      name,
      category: 'analysis',
      description: `Analysis skill: ${name}`,
      includeExamples: true,
      includeTests: true,
      includeDocumentation: true,
      ...options,
    });
  }

  /**
   * Generate a generation skill template
   */
  generateGenerationSkill(name: string, options?: Partial<SkillTemplateOptions>): GeneratedSkillTemplate {
    return this.generate({
      name,
      category: 'generation',
      description: `Generation skill: ${name}`,
      includeExamples: true,
      includeTests: true,
      includeDocumentation: true,
      ...options,
    });
  }

  /**
   * Generate a git skill template
   */
  generateGitSkill(name: string, options?: Partial<SkillTemplateOptions>): GeneratedSkillTemplate {
    return this.generate({
      name,
      category: 'git',
      description: `Git skill: ${name}`,
      includeExamples: true,
      includeTests: true,
      includeDocumentation: true,
      ...options,
    });
  }

  /**
   * Generate a utility skill template
   */
  generateUtilitySkill(name: string, options?: Partial<SkillTemplateOptions>): GeneratedSkillTemplate {
    return this.generate({
      name,
      category: 'utility',
      description: `Utility skill: ${name}`,
      includeExamples: true,
      includeTests: true,
      includeDocumentation: true,
      ...options,
    });
  }

  // ============================================================================
  // Private Generation Methods
  // ============================================================================

  private _generateDefinition(
    id: string,
    name: string,
    description: string,
    category: SkillCategory,
    author: SkillAuthor
  ): SkillDefinition {
    const now = new Date();

    return {
      metadata: {
        id,
        name,
        version: '1.0.0',
        description,
        category,
        author,
        tags: [category, 'skill'],
        license: 'MIT',
        createdAt: now,
        updatedAt: now,
      },
      compatibility: {
        minPlatformVersion: '1.0.0',
      },
      config: {
        enabled: true,
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        parallel: false,
        maxConcurrency: 1,
        cacheResults: false,
        cacheTtl: 3600000,
        logLevel: 'info',
        customSettings: {},
      },
      inputSchema: {
        type: 'object',
        properties: {
          input: {
            name: 'input',
            type: 'string',
            description: 'Input to process',
            required: true,
          },
        },
        required: ['input'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            name: 'result',
            type: 'string',
            description: 'Processing result',
            required: true,
          },
        },
        required: ['result'],
      },
      examples: [
        {
          name: 'Basic usage',
          description: 'Demonstrates basic skill usage',
          input: { input: 'Hello, World!' },
          expectedOutput: { result: 'Processed: Hello, World!' },
        },
      ],
      requiredTools: [],
      requiredContext: [],
      successCriteria: [
        {
          name: 'success',
          description: 'Skill executed successfully',
          check: (output) => output.success,
        },
      ],
      dependencies: [],
      documentation: {
        readme: `# ${name}\n\n${description}\n\n## Usage\n\n\`\`\`typescript\nconst result = await skill.execute({ input: 'your input' }, context);\n\`\`\`\n\n## Examples\n\nSee the examples in the skill definition.`,
        changelog: '# Changelog\n\n## 1.0.0\n\n- Initial release',
        apiReference: `# API Reference\n\n## Input\n\n- \`input\` (string, required): Input to process\n\n## Output\n\n- \`result\` (string): Processing result`,
        tutorials: [],
      },
    };
  }

  private _generateTypeScript(definition: SkillDefinition): string {
    const className = this._toPascalCase(definition.metadata.name) + 'Skill';

    return `import { Skill, SkillInput, SkillOutput, SkillContext, SkillDefinition } from '../Skill';

const definition: SkillDefinition = ${JSON.stringify(definition, null, 2)};

export class ${className} extends Skill {
  constructor(config?: Partial<SkillDefinition['config']>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize your skill here
    this._log('info', 'Initializing ${className}');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    this._log('info', 'Executing ${className}', { input });

    try {
      // Implement your skill logic here
      const result = await this._process(input, context);

      return {
        success: true,
        data: { result },
        metadata: {
          executionTime: 0,
          startTime: new Date(),
          endTime: new Date(),
          cached: false,
          retryCount: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          executionTime: 0,
          startTime: new Date(),
          endTime: new Date(),
          cached: false,
          retryCount: 0,
        },
      };
    }
  }

  private async _process(input: SkillInput, context: SkillContext): Promise<string> {
    // Your processing logic here
    return \`Processed: \${input.input}\`;
  }

  protected async onDispose(): Promise<void> {
    // Cleanup your skill here
    this._log('info', 'Disposing ${className}');
  }
}

// Factory function for registration
export default function createSkill(config?: Partial<SkillDefinition['config']>): ${className} {
  return new ${className}(config);
}

export { definition };
`;
  }

  private _generateJSON(definition: SkillDefinition): string {
    const configObj = {
      name: definition.metadata.name,
      version: definition.metadata.version,
      description: definition.metadata.description,
      main: 'index.js',
      types: 'index.d.ts',
      keywords: definition.metadata.tags,
      author: definition.metadata.author,
      license: definition.metadata.license,
      peerDependencies: {
        '@claude-code/skills': `>=${definition.compatibility.minPlatformVersion}`,
      },
    };

    return JSON.stringify(configObj, null, 2);
  }

  private _generateReadme(definition: SkillDefinition): string {
    return `# ${definition.metadata.name}

${definition.metadata.description}

## Installation

\`\`\`bash
npm install @claude-code/skills-${definition.metadata.id}
\`\`\`

## Usage

### Basic Usage

\`\`\`typescript
import { SkillManager } from '@claude-code/skills';
import createSkill from '@claude-code/skills-${definition.metadata.id}';

const manager = new SkillManager();
const skill = createSkill();
await manager.register(skill.definition);

const result = await manager.execute('${definition.metadata.id}', {
  input: 'your input here'
});
\`\`\`

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
${Object.entries(definition.inputSchema.properties)
  .map(([name, param]) => `| ${name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |`)
  .join('\n')}

## Output

| Parameter | Type | Description |
|-----------|------|-------------|
${Object.entries(definition.outputSchema.properties)
  .map(([name, param]) => `| ${name} | ${param.type} | ${param.description} |`)
  .join('\n')}

## Examples

${definition.examples.map(ex => `### ${ex.name}

${ex.description}

\`\`\`typescript
const input = ${JSON.stringify(ex.input, null, 2)};
const result = await skill.execute(input, context);
// Expected: ${JSON.stringify(ex.expectedOutput)}
\`\`\``).join('\n\n')}

## License

${definition.metadata.license}

## Author

${definition.metadata.author.name}${definition.metadata.author.email ? ` <${definition.metadata.author.email}>` : ''}
`;
  }

  private _generateTests(definition: SkillDefinition): string {
    const className = this._toPascalCase(definition.metadata.name) + 'Skill';

    return `import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ${className} } from './${definition.metadata.id}.skill';
import { SkillContext } from '../types';

describe('${className}', () => {
  let skill: ${className};
  let context: SkillContext;

  beforeEach(async () => {
    skill = new ${className}();
    context = {
      sessionId: 'test-session',
      workspacePath: '/tmp',
      projectRoot: '/tmp',
      files: [],
      environment: {},
      variables: new Map(),
      history: [],
    };
    await skill.initialize();
  });

  afterEach(async () => {
    await skill.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(skill.state).toBe('ready');
    });

    it('should have correct metadata', () => {
      expect(skill.id).toBe('${definition.metadata.id}');
      expect(skill.name).toBe('${definition.metadata.name}');
      expect(skill.version).toBe('${definition.metadata.version}');
    });
  });

  describe('execution', () => {
    it('should execute with valid input', async () => {
      const input = { input: 'test' };
      const result = await skill.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fail with invalid input', async () => {
      const input = {}; // Missing required 'input' field
      const result = await skill.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should track execution count', async () => {
      const input = { input: 'test' };
      
      await skill.execute(input, context);
      expect(skill.executionCount).toBe(1);

      await skill.execute(input, context);
      expect(skill.executionCount).toBe(2);
    });
  });

  describe('validation', () => {
    it('should validate correct input', async () => {
      const input = { input: 'test' };
      const isValid = await skill.validate(input);
      expect(isValid).toBe(true);
    });

    it('should reject invalid input', async () => {
      const input = {}; // Missing required field
      const isValid = await skill.validate(input);
      expect(isValid).toBe(false);
    });
  });

  describe('examples', () => {
    ${definition.examples.map((ex, i) => `it('should match example ${i + 1}: ${ex.name}', async () => {
      const result = await skill.execute(${JSON.stringify(ex.input)}, context);
      expect(result.success).toBe(true);
      ${ex.expectedOutput ? `expect(result.data).toEqual(${JSON.stringify(ex.expectedOutput)});` : ''}
    });`).join('\n    ')}
  });
});
`;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private _toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private _toPascalCase(str: string): string {
    return str
      .replace(/(?:^|[-_\s]+)(\w)/g, (_, char) => char.toUpperCase())
      .replace(/[-_\s]+/g, '');
  }
}

export default SkillTemplateGenerator;
