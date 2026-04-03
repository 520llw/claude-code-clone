/**
 * Skill Validator - Validate skill definitions and inputs/outputs
 * 
 * Provides comprehensive validation for skills, inputs, and outputs.
 */

import {
  SkillDefinition,
  SkillInput,
  SkillOutput,
  SkillInputSchema,
  SkillOutputSchema,
  SkillParameter,
  SkillValidationResult,
  SkillMetadata,
  SkillCompatibility,
  SkillConfig,
  SkillExample,
  SkillDependency,
  SuccessCriterion,
  SkillDocumentation,
  SkillId,
  SkillVersion,
  SkillCategory,
} from '../types';

/**
 * Validator options
 */
export interface ValidatorOptions {
  strict: boolean;
  allowUnknownFields: boolean;
  validateExamples: boolean;
}

/**
 * Default validator options
 */
const DEFAULT_VALIDATOR_OPTIONS: ValidatorOptions = {
  strict: true,
  allowUnknownFields: false,
  validateExamples: true,
};

/**
 * Skill validator
 */
export class SkillValidator {
  private options: ValidatorOptions;

  constructor(options?: Partial<ValidatorOptions>) {
    this.options = { ...DEFAULT_VALIDATOR_OPTIONS, ...options };
  }

  // ============================================================================
  // Definition Validation
  // ============================================================================

  /**
   * Validate a complete skill definition
   */
  validateDefinition(definition: SkillDefinition): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    const metaResult = this.validateMetadata(definition.metadata);
    errors.push(...metaResult.errors);
    warnings.push(...metaResult.warnings);

    // Validate compatibility
    const compatResult = this.validateCompatibility(definition.compatibility);
    errors.push(...compatResult.errors);
    warnings.push(...compatResult.warnings);

    // Validate config
    const configResult = this.validateConfig(definition.config);
    errors.push(...configResult.errors);
    warnings.push(...configResult.warnings);

    // Validate schemas
    const inputResult = this.validateInputSchema(definition.inputSchema);
    errors.push(...inputResult.errors);
    warnings.push(...inputResult.warnings);

    const outputResult = this.validateOutputSchema(definition.outputSchema);
    errors.push(...outputResult.errors);
    warnings.push(...outputResult.warnings);

    // Validate examples
    if (this.options.validateExamples) {
      for (const example of definition.examples) {
        const exampleResult = this.validateExample(example, definition.inputSchema);
        errors.push(...exampleResult.errors);
        warnings.push(...exampleResult.warnings);
      }
    }

    // Validate dependencies
    const depResult = this.validateDependencies(definition.dependencies);
    errors.push(...depResult.errors);
    warnings.push(...depResult.warnings);

    // Validate success criteria
    const criteriaResult = this.validateSuccessCriteria(definition.successCriteria);
    errors.push(...criteriaResult.errors);
    warnings.push(...criteriaResult.warnings);

    // Validate documentation
    const docResult = this.validateDocumentation(definition.documentation);
    errors.push(...docResult.errors);
    warnings.push(...docResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate metadata
   */
  validateMetadata(metadata: SkillMetadata): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ID validation
    if (!metadata.id) {
      errors.push('Metadata id is required');
    } else if (!this._isValidSkillId(metadata.id)) {
      errors.push(`Invalid skill id: ${metadata.id}. Must be kebab-case.`);
    }

    // Name validation
    if (!metadata.name || metadata.name.length < 1) {
      errors.push('Metadata name is required');
    } else if (metadata.name.length > 100) {
      warnings.push('Metadata name exceeds 100 characters');
    }

    // Version validation
    if (!metadata.version) {
      errors.push('Metadata version is required');
    } else if (!this._isValidVersion(metadata.version)) {
      errors.push(`Invalid version: ${metadata.version}. Must be semantic version (MAJOR.MINOR.PATCH).`);
    }

    // Description validation
    if (!metadata.description) {
      errors.push('Metadata description is required');
    } else if (metadata.description.length < 10) {
      warnings.push('Metadata description is very short (minimum 10 characters recommended)');
    } else if (metadata.description.length > 1000) {
      warnings.push('Metadata description exceeds 1000 characters');
    }

    // Category validation
    const validCategories: SkillCategory[] = ['code', 'analysis', 'generation', 'git', 'utility', 'custom'];
    if (!metadata.category) {
      errors.push('Metadata category is required');
    } else if (!validCategories.includes(metadata.category)) {
      errors.push(`Invalid category: ${metadata.category}. Must be one of: ${validCategories.join(', ')}`);
    }

    // Author validation
    if (!metadata.author) {
      errors.push('Metadata author is required');
    } else if (!metadata.author.name) {
      errors.push('Author name is required');
    }

    // Tags validation
    if (!metadata.tags || metadata.tags.length === 0) {
      warnings.push('No tags specified. Tags help with discovery.');
    } else if (metadata.tags.length > 20) {
      warnings.push('More than 20 tags specified. Consider reducing for clarity.');
    }

    // License validation
    if (!metadata.license) {
      errors.push('Metadata license is required');
    }

    // Date validation
    if (!metadata.createdAt) {
      errors.push('Metadata createdAt is required');
    }
    if (!metadata.updatedAt) {
      errors.push('Metadata updatedAt is required');
    }

    // Deprecation validation
    if (metadata.deprecated && !metadata.deprecationMessage) {
      warnings.push('Skill is deprecated but no deprecation message provided');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate compatibility
   */
  validateCompatibility(compatibility: SkillCompatibility): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!compatibility.minPlatformVersion) {
      errors.push('Minimum platform version is required');
    } else if (!this._isValidVersion(compatibility.minPlatformVersion)) {
      errors.push(`Invalid minimum platform version: ${compatibility.minPlatformVersion}`);
    }

    if (compatibility.maxPlatformVersion && !this._isValidVersion(compatibility.maxPlatformVersion)) {
      errors.push(`Invalid maximum platform version: ${compatibility.maxPlatformVersion}`);
    }

    if (compatibility.maxPlatformVersion && compatibility.minPlatformVersion) {
      if (this._compareVersions(compatibility.maxPlatformVersion, compatibility.minPlatformVersion) < 0) {
        errors.push('Maximum platform version must be greater than or equal to minimum platform version');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate config
   */
  validateConfig(config: SkillConfig): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.timeout <= 0) {
      errors.push('Timeout must be positive');
    }

    if (config.retries < 0) {
      errors.push('Retries cannot be negative');
    }

    if (config.retryDelay < 0) {
      errors.push('Retry delay cannot be negative');
    }

    if (config.maxConcurrency < 1) {
      errors.push('Max concurrency must be at least 1');
    }

    if (config.cacheTtl < 0) {
      errors.push('Cache TTL cannot be negative');
    }

    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logLevel)) {
      errors.push(`Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate input schema
   */
  validateInputSchema(schema: SkillInputSchema): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (schema.type !== 'object') {
      errors.push('Input schema type must be "object"');
    }

    if (!schema.properties) {
      errors.push('Input schema properties is required');
    } else {
      for (const [name, param] of Object.entries(schema.properties)) {
        const paramResult = this.validateParameter(param, name);
        errors.push(...paramResult.errors);
        warnings.push(...paramResult.warnings);
      }
    }

    if (!schema.required) {
      warnings.push('No required fields specified in input schema');
    } else {
      for (const required of schema.required) {
        if (!schema.properties || !schema.properties[required]) {
          errors.push(`Required field '${required}' not found in properties`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate output schema
   */
  validateOutputSchema(schema: SkillOutputSchema): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (schema.type !== 'object') {
      errors.push('Output schema type must be "object"');
    }

    if (!schema.properties) {
      errors.push('Output schema properties is required');
    } else {
      for (const [name, param] of Object.entries(schema.properties)) {
        const paramResult = this.validateParameter(param, name);
        errors.push(...paramResult.errors);
        warnings.push(...paramResult.warnings);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a parameter
   */
  validateParameter(param: SkillParameter, name: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!param.name) {
      errors.push(`Parameter ${name} is missing name`);
    }

    if (!param.type) {
      errors.push(`Parameter ${name} is missing type`);
    } else {
      const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'file'];
      if (!validTypes.includes(param.type)) {
        errors.push(`Parameter ${name} has invalid type: ${param.type}`);
      }
    }

    if (!param.description) {
      warnings.push(`Parameter ${name} is missing description`);
    }

    // Type-specific validation
    if (param.type === 'string' && param.pattern) {
      try {
        new RegExp(param.pattern);
      } catch {
        errors.push(`Parameter ${name} has invalid pattern: ${param.pattern}`);
      }
    }

    if (param.type === 'number') {
      if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
        errors.push(`Parameter ${name} has min greater than max`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate example
   */
  validateExample(example: SkillExample, inputSchema: SkillInputSchema): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!example.name) {
      errors.push('Example is missing name');
    }

    if (!example.description) {
      warnings.push(`Example ${example.name} is missing description`);
    }

    if (!example.input) {
      errors.push(`Example ${example.name} is missing input`);
    } else {
      // Validate input against schema
      const inputResult = this.validateInput(example.input, inputSchema);
      errors.push(...inputResult.errors);
      warnings.push(...inputResult.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate dependencies
   */
  validateDependencies(dependencies: SkillDependency[]): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const dep of dependencies) {
      if (!dep.skillId) {
        errors.push('Dependency is missing skillId');
      }

      if (!dep.versionRange) {
        errors.push(`Dependency ${dep.skillId} is missing versionRange`);
      } else if (!this._isValidVersionRange(dep.versionRange)) {
        warnings.push(`Dependency ${dep.skillId} has unusual version range: ${dep.versionRange}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate success criteria
   */
  validateSuccessCriteria(criteria: SuccessCriterion[]): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (criteria.length === 0) {
      warnings.push('No success criteria defined');
    }

    for (const criterion of criteria) {
      if (!criterion.name) {
        errors.push('Success criterion is missing name');
      }

      if (!criterion.description) {
        warnings.push(`Success criterion ${criterion.name} is missing description`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate documentation
   */
  validateDocumentation(doc: SkillDocumentation): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!doc.readme) {
      warnings.push('No README documentation provided');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ============================================================================
  // Input/Output Validation
  // ============================================================================

  /**
   * Validate input against schema
   */
  validateInput(input: SkillInput, schema: SkillInputSchema): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const required of schema.required || []) {
      if (!(required in input)) {
        errors.push(`Missing required field: ${required}`);
      }
    }

    // Validate each field
    for (const [key, value] of Object.entries(input)) {
      const param = schema.properties?.[key];
      
      if (!param) {
        if (schema.additionalProperties === false) {
          errors.push(`Unknown field: ${key}`);
        }
        continue;
      }

      const valueResult = this._validateValue(value, param, key);
      errors.push(...valueResult.errors);
      warnings.push(...valueResult.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate output against schema
   */
  validateOutput(output: SkillOutput, schema: SkillOutputSchema): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.success) {
      // Don't validate failed outputs
      return { valid: true, errors, warnings };
    }

    if (!output.data || typeof output.data !== 'object') {
      errors.push('Output data must be an object');
      return { valid: false, errors, warnings };
    }

    const data = output.data as Record<string, unknown>;

    // Check required fields
    for (const required of schema.required || []) {
      if (!(required in data)) {
        errors.push(`Missing required output field: ${required}`);
      }
    }

    // Validate each field
    for (const [key, value] of Object.entries(data)) {
      const param = schema.properties?.[key];
      
      if (!param) {
        continue; // Allow extra output fields
      }

      const valueResult = this._validateValue(value, param, key);
      errors.push(...valueResult.errors);
      warnings.push(...valueResult.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private _validateValue(
    value: unknown,
    param: SkillParameter,
    path: string
  ): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (value === undefined || value === null) {
      if (param.required) {
        errors.push(`Required field ${path} is null or undefined`);
      }
      return { valid: errors.length === 0, errors, warnings };
    }

    switch (param.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field ${path} must be a string`);
        } else {
          if (param.pattern && !new RegExp(param.pattern).test(value)) {
            errors.push(`Field ${path} does not match pattern: ${param.pattern}`);
          }
          if (param.enum && !param.enum.includes(value)) {
            errors.push(`Field ${path} must be one of: ${param.enum.join(', ')}`);
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Field ${path} must be a number`);
        } else {
          if (param.min !== undefined && value < param.min) {
            errors.push(`Field ${path} must be at least ${param.min}`);
          }
          if (param.max !== undefined && value > param.max) {
            errors.push(`Field ${path} must be at most ${param.max}`);
          }
          if (param.enum && !param.enum.includes(value)) {
            errors.push(`Field ${path} must be one of: ${param.enum.join(', ')}`);
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field ${path} must be a boolean`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field ${path} must be an array`);
        } else if (param.items) {
          for (let i = 0; i < value.length; i++) {
            const itemResult = this._validateValue(value[i], param.items, `${path}[${i}]`);
            errors.push(...itemResult.errors);
            warnings.push(...itemResult.warnings);
          }
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`Field ${path} must be an object`);
        } else if (param.properties) {
          for (const [key, propParam] of Object.entries(param.properties)) {
            const propValue = (value as Record<string, unknown>)[key];
            const propResult = this._validateValue(propValue, propParam, `${path}.${key}`);
            errors.push(...propResult.errors);
            warnings.push(...propResult.warnings);
          }
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private _isValidSkillId(id: string): boolean {
    return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id);
  }

  private _isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  private _isValidVersionRange(range: string): boolean {
    // Basic semver range validation
    return /^(\^|~|>=|<=|>|<)?\d+\.\d+\.\d+/.test(range) || range === '*';
  }

  private _compareVersions(v1: SkillVersion, v2: SkillVersion): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] !== parts2[i]) {
        return parts1[i] - parts2[i];
      }
    }

    return 0;
  }
}

export default SkillValidator;
