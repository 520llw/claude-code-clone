/**
 * Skill Parser - Parse skill files into definitions
 * 
 * Handles parsing of TypeScript, JavaScript, and JSON skill files.
 */

import {
  SkillDefinition,
  SkillMetadata,
  SkillCompatibility,
  SkillConfig,
  SkillInputSchema,
  SkillOutputSchema,
  SkillExample,
  SkillDependency,
  SuccessCriterion,
  SkillDocumentation,
  SkillHooks,
  SkillCategory,
  SkillAuthor,
  SkillParameter,
  SkillParserResult,
  SKILL_SCHEMA_VERSION,
} from '../types';

/**
 * Parser options
 */
export interface ParserOptions {
  strict: boolean;
  allowUnknownFields: boolean;
  validateSchemas: boolean;
}

/**
 * Default parser options
 */
const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  strict: true,
  allowUnknownFields: false,
  validateSchemas: true,
};

/**
 * Skill file parser
 */
export class SkillParser {
  private options: ParserOptions;

  constructor(options?: Partial<ParserOptions>) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
  }

  /**
   * Parse a skill file
   */
  parseSkillFile(content: string, filePath: string): SkillParserResult {
    const errors: string[] = [];

    try {
      // Try to parse as JSON first
      if (filePath.endsWith('.json')) {
        return this.parseJSON(content);
      }

      // Parse as TypeScript/JavaScript
      return this.parseTypeScript(content, filePath);
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors };
    }
  }

  /**
   * Parse JSON skill definition
   */
  parseJSON(content: string): SkillParserResult {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(content);
      
      if (!this.options.allowUnknownFields) {
        this._validateKnownFields(parsed);
      }

      const definition = this._buildDefinition(parsed);
      
      return { success: true, definition, errors };
    } catch (error) {
      errors.push(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors };
    }
  }

  /**
   * Parse TypeScript/JavaScript skill file
   */
  parseTypeScript(content: string, filePath: string): SkillParserResult {
    const errors: string[] = [];

    try {
      // Extract definition object from TypeScript
      const definitionMatch = content.match(/export\s+(?:default\s+)?(?:const|let|var)?\s*(?:skill)?\s*[:=]?\s*({[\s\S]*?});?\s*(?:export|$)/);
      
      if (!definitionMatch) {
        errors.push('Could not find skill definition export');
        return { success: false, errors };
      }

      // Convert TypeScript object to JSON-compatible format
      const jsonContent = this._typescriptToJSON(definitionMatch[1]);
      const parsed = JSON.parse(jsonContent);

      const definition = this._buildDefinition(parsed);
      
      return { success: true, definition, errors };
    } catch (error) {
      errors.push(`TypeScript parse error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors };
    }
  }

  /**
   * Parse skill metadata
   */
  parseMetadata(obj: unknown): SkillMetadata {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Metadata must be an object');
    }

    const meta = obj as Record<string, unknown>;

    return {
      id: this._requireString(meta, 'id'),
      name: this._requireString(meta, 'name'),
      version: this._requireString(meta, 'version') as `${number}.${number}.${number}`,
      description: this._requireString(meta, 'description'),
      category: this._requireString(meta, 'category') as SkillCategory,
      author: this._parseAuthor(meta.author),
      tags: this._parseStringArray(meta.tags),
      license: this._requireString(meta, 'license'),
      homepage: this._optionalString(meta, 'homepage'),
      repository: this._optionalString(meta, 'repository'),
      issues: this._optionalString(meta, 'issues'),
      createdAt: this._parseDate(meta.createdAt),
      updatedAt: this._parseDate(meta.updatedAt),
      deprecated: this._optionalBoolean(meta, 'deprecated'),
      deprecationMessage: this._optionalString(meta, 'deprecationMessage'),
      replaces: this._parseStringArray(meta.replaces),
    };
  }

  /**
   * Parse skill compatibility
   */
  parseCompatibility(obj: unknown): SkillCompatibility {
    if (!obj || typeof obj !== 'object') {
      return {
        minPlatformVersion: '1.0.0',
      };
    }

    const comp = obj as Record<string, unknown>;

    return {
      minPlatformVersion: this._requireString(comp, 'minPlatformVersion') as `${number}.${number}.${number}`,
      maxPlatformVersion: this._optionalString(comp, 'maxPlatformVersion') as `${number}.${number}.${number}` | undefined,
      requiredSkills: this._parseStringArray(comp.requiredSkills),
      conflictsWith: this._parseStringArray(comp.conflictsWith),
      os: this._parseOSArray(comp.os),
      nodeVersion: this._optionalString(comp, 'nodeVersion'),
    };
  }

  /**
   * Parse skill configuration
   */
  parseConfig(obj: unknown): SkillConfig {
    if (!obj || typeof obj !== 'object') {
      return this._defaultConfig();
    }

    const config = obj as Record<string, unknown>;

    return {
      enabled: this._optionalBoolean(config, 'enabled') ?? true,
      timeout: this._optionalNumber(config, 'timeout') ?? 30000,
      retries: this._optionalNumber(config, 'retries') ?? 3,
      retryDelay: this._optionalNumber(config, 'retryDelay') ?? 1000,
      parallel: this._optionalBoolean(config, 'parallel') ?? false,
      maxConcurrency: this._optionalNumber(config, 'maxConcurrency') ?? 1,
      cacheResults: this._optionalBoolean(config, 'cacheResults') ?? false,
      cacheTtl: this._optionalNumber(config, 'cacheTtl') ?? 3600000,
      logLevel: (this._optionalString(config, 'logLevel') as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
      customSettings: (config.customSettings as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Parse input schema
   */
  parseInputSchema(obj: unknown): SkillInputSchema {
    if (!obj || typeof obj !== 'object') {
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }

    const schema = obj as Record<string, unknown>;

    return {
      type: 'object',
      properties: this._parseParameters(schema.properties),
      required: this._parseStringArray(schema.required),
      additionalProperties: this._optionalBoolean(schema, 'additionalProperties'),
    };
  }

  /**
   * Parse output schema
   */
  parseOutputSchema(obj: unknown): SkillOutputSchema {
    if (!obj || typeof obj !== 'object') {
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }

    const schema = obj as Record<string, unknown>;

    return {
      type: 'object',
      properties: this._parseParameters(schema.properties),
      required: this._parseStringArray(schema.required),
    };
  }

  /**
   * Parse examples
   */
  parseExamples(obj: unknown): SkillExample[] {
    if (!Array.isArray(obj)) {
      return [];
    }

    return obj.map((ex, index) => this._parseExample(ex, index));
  }

  /**
   * Parse dependencies
   */
  parseDependencies(obj: unknown): SkillDependency[] {
    if (!Array.isArray(obj)) {
      return [];
    }

    return obj.map((dep, index) => {
      if (!dep || typeof dep !== 'object') {
        throw new Error(`Invalid dependency at index ${index}`);
      }

      const d = dep as Record<string, unknown>;
      return {
        skillId: this._requireString(d, 'skillId'),
        versionRange: this._requireString(d, 'versionRange'),
        optional: this._optionalBoolean(d, 'optional') ?? false,
      };
    });
  }

  /**
   * Parse success criteria
   */
  parseSuccessCriteria(obj: unknown): SuccessCriterion[] {
    if (!Array.isArray(obj)) {
      return [];
    }

    return obj.map((crit, index) => {
      if (!crit || typeof crit !== 'object') {
        throw new Error(`Invalid success criterion at index ${index}`);
      }

      const c = crit as Record<string, unknown>;
      return {
        name: this._requireString(c, 'name'),
        description: this._requireString(c, 'description'),
        check: () => true, // Will be overridden at runtime
      };
    });
  }

  /**
   * Parse documentation
   */
  parseDocumentation(obj: unknown): SkillDocumentation {
    if (!obj || typeof obj !== 'object') {
      return {
        readme: '',
        changelog: '',
        apiReference: '',
        tutorials: [],
      };
    }

    const doc = obj as Record<string, unknown>;

    return {
      readme: this._requireString(doc, 'readme'),
      changelog: this._optionalString(doc, 'changelog') ?? '',
      apiReference: this._optionalString(doc, 'apiReference') ?? '',
      tutorials: this._parseStringArray(doc.tutorials),
    };
  }

  /**
   * Parse hooks
   */
  parseHooks(obj: unknown): SkillHooks {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const hooks = obj as Record<string, unknown>;
    const result: SkillHooks = {};

    const hookNames = ['beforeLoad', 'afterLoad', 'beforeExecute', 'afterExecute', 'onError', 'beforeUnload'];
    
    for (const name of hookNames) {
      if (typeof hooks[name] === 'string') {
        (result as Record<string, string>)[name] = hooks[name] as string;
      }
    }

    return result;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private _buildDefinition(parsed: Record<string, unknown>): SkillDefinition {
    return {
      metadata: this.parseMetadata(parsed.metadata),
      compatibility: this.parseCompatibility(parsed.compatibility),
      config: this.parseConfig(parsed.config),
      inputSchema: this.parseInputSchema(parsed.inputSchema),
      outputSchema: this.parseOutputSchema(parsed.outputSchema),
      examples: this.parseExamples(parsed.examples),
      requiredTools: this._parseStringArray(parsed.requiredTools),
      requiredContext: this._parseStringArray(parsed.requiredContext),
      successCriteria: this.parseSuccessCriteria(parsed.successCriteria),
      dependencies: this.parseDependencies(parsed.dependencies),
      hooks: this.parseHooks(parsed.hooks),
      documentation: this.parseDocumentation(parsed.documentation),
    };
  }

  private _typescriptToJSON(tsContent: string): string {
    // Remove TypeScript type annotations
    let json = tsContent
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove type annotations
      .replace(/:\s*[A-Za-z<>,\[\]|&{}\s]+/g, '')
      // Convert single quotes to double quotes for JSON
      .replace(/'/g, '"')
      // Remove trailing commas
      .replace(/,\s*([}\]])/g, '$1')
      // Handle function expressions
      .replace(/\([^)]*\)\s*=>\s*\{[^}]*\}/g, '"function"')
      // Handle arrow functions
      .replace(/\([^)]*\)\s*=>/g, '"function"')
      // Handle regular functions
      .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, '"function"')
      // Handle async functions
      .replace(/async\s+function/g, 'function');

    return json;
  }

  private _validateKnownFields(obj: Record<string, unknown>): void {
    const knownFields = [
      'metadata', 'compatibility', 'config', 'inputSchema', 'outputSchema',
      'examples', 'requiredTools', 'requiredContext', 'successCriteria',
      'dependencies', 'hooks', 'documentation',
    ];

    for (const key of Object.keys(obj)) {
      if (!knownFields.includes(key)) {
        throw new Error(`Unknown field: ${key}`);
      }
    }
  }

  private _parseAuthor(obj: unknown): SkillAuthor {
    if (!obj || typeof obj !== 'object') {
      return { name: 'Unknown' };
    }

    const author = obj as Record<string, unknown>;
    return {
      name: this._requireString(author, 'name'),
      email: this._optionalString(author, 'email'),
      url: this._optionalString(author, 'url'),
      organization: this._optionalString(author, 'organization'),
    };
  }

  private _parseParameters(obj: unknown): Record<string, SkillParameter> {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const result: Record<string, SkillParameter> = {};
    const params = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(params)) {
      result[key] = this._parseParameter(value, key);
    }

    return result;
  }

  private _parseParameter(obj: unknown, name: string): SkillParameter {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`Invalid parameter: ${name}`);
    }

    const param = obj as Record<string, unknown>;
    const type = this._requireString(param, 'type') as SkillParameter['type'];

    const base: SkillParameter = {
      name,
      type,
      description: this._requireString(param, 'description'),
      required: this._optionalBoolean(param, 'required') ?? false,
    };

    // Add type-specific fields
    switch (type) {
      case 'string':
        return {
          ...base,
          default: this._optionalString(param, 'default'),
          enum: param.enum as string[] | undefined,
          pattern: this._optionalString(param, 'pattern'),
        };
      case 'number':
        return {
          ...base,
          default: this._optionalNumber(param, 'default'),
          enum: param.enum as number[] | undefined,
          min: this._optionalNumber(param, 'min'),
          max: this._optionalNumber(param, 'max'),
        };
      case 'boolean':
        return {
          ...base,
          default: this._optionalBoolean(param, 'default'),
        };
      case 'array':
        return {
          ...base,
          items: param.items ? this._parseParameter(param.items, `${name}[]`) : undefined,
        };
      case 'object':
        return {
          ...base,
          properties: param.properties ? this._parseParameters(param.properties) : undefined,
        };
      case 'file':
        return base;
      default:
        return base;
    }
  }

  private _parseExample(obj: unknown, index: number): SkillExample {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`Invalid example at index ${index}`);
    }

    const ex = obj as Record<string, unknown>;
    return {
      name: this._requireString(ex, 'name'),
      description: this._requireString(ex, 'description'),
      input: (ex.input as Record<string, unknown>) ?? {},
      expectedOutput: ex.expectedOutput,
      notes: this._optionalString(ex, 'notes'),
    };
  }

  private _parseStringArray(obj: unknown): string[] {
    if (!Array.isArray(obj)) {
      return [];
    }
    return obj.filter((item): item is string => typeof item === 'string');
  }

  private _parseOSArray(obj: unknown): ('windows' | 'macos' | 'linux' | 'unix')[] | undefined {
    if (!Array.isArray(obj)) {
      return undefined;
    }
    return obj.filter((item): item is 'windows' | 'macos' | 'linux' | 'unix' =>
      ['windows', 'macos', 'linux', 'unix'].includes(item as string)
    );
  }

  private _parseDate(obj: unknown): Date {
    if (obj instanceof Date) {
      return obj;
    }
    if (typeof obj === 'string') {
      return new Date(obj);
    }
    return new Date();
  }

  private _requireString(obj: Record<string, unknown>, key: string): string {
    const value = obj[key];
    if (typeof value !== 'string') {
      throw new Error(`Required string field '${key}' is missing or not a string`);
    }
    return value;
  }

  private _optionalString(obj: Record<string, unknown>, key: string): string | undefined {
    const value = obj[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new Error(`Field '${key}' must be a string`);
    }
    return value;
  }

  private _optionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
    const value = obj[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'number') {
      throw new Error(`Field '${key}' must be a number`);
    }
    return value;
  }

  private _optionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
    const value = obj[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Field '${key}' must be a boolean`);
    }
    return value;
  }

  private _defaultConfig(): SkillConfig {
    return {
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
    };
  }
}

export default SkillParser;
