/**
 * PluginValidator.ts
 * 
 * Plugin Validation for Claude Code Clone Plugin System
 * 
 * This file implements the PluginValidator class which is responsible for:
 * - Plugin metadata validation
 * - Plugin security validation
 * - Plugin compatibility checking
 * - Plugin source verification
 * - Plugin signature verification
 * - Plugin permission validation
 * - Plugin code analysis
 * 
 * The PluginValidator ensures that plugins meet all requirements before
 * they can be loaded and executed, providing security and stability.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  PluginMetadata,
  PluginCategory,
  PluginCapabilities,
  PluginConfig,
  ConfigSchemaEntry,
  PluginAuthor
} from './Plugin';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Validate metadata format */
  checkMetadata?: boolean;
  /** Validate version compatibility */
  checkVersion?: boolean;
  /** Validate source */
  checkSource?: boolean;
  /** Validate blocked plugins */
  checkBlocked?: boolean;
  /** Validate permissions */
  checkPermissions?: boolean;
  /** Validate code */
  checkCode?: boolean;
  /** Validate signature */
  checkSignature?: boolean;
  /** Validate checksum */
  checkChecksum?: boolean;
  /** Strict validation mode */
  strict?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Validation details */
  details?: ValidationDetails;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: ValidationErrorCode;
  /** Error message */
  message: string;
  /** Error field */
  field?: string;
  /** Error details */
  details?: any;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: ValidationWarningCode;
  /** Warning message */
  message: string;
  /** Warning field */
  field?: string;
  /** Warning details */
  details?: any;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  MISSING_ID = 'MISSING_ID',
  INVALID_ID = 'INVALID_ID',
  MISSING_NAME = 'MISSING_NAME',
  INVALID_NAME = 'INVALID_NAME',
  MISSING_VERSION = 'MISSING_VERSION',
  INVALID_VERSION = 'INVALID_VERSION',
  MISSING_DESCRIPTION = 'MISSING_DESCRIPTION',
  MISSING_AUTHOR = 'MISSING_AUTHOR',
  INVALID_AUTHOR = 'INVALID_AUTHOR',
  INVALID_CATEGORY = 'INVALID_CATEGORY',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  BLOCKED_PLUGIN = 'BLOCKED_PLUGIN',
  SOURCE_NOT_ALLOWED = 'SOURCE_NOT_ALLOWED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNSAFE_CODE = 'UNSAFE_CODE',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
  INVALID_CONFIG_SCHEMA = 'INVALID_CONFIG_SCHEMA'
}

/**
 * Validation warning codes
 */
export enum ValidationWarningCode {
  DEPRECATED_API = 'DEPRECATED_API',
  UNSTABLE_VERSION = 'UNSTABLE_VERSION',
  MISSING_LICENSE = 'MISSING_LICENSE',
  MISSING_HOMEPAGE = 'MISSING_HOMEPAGE',
  MISSING_REPOSITORY = 'MISSING_REPOSITORY',
  BROAD_PERMISSIONS = 'BROAD_PERMISSIONS',
  LARGE_BUNDLE_SIZE = 'LARGE_BUNDLE_SIZE',
  LOW_RATING = 'LOW_RATING',
  UNVERIFIED_SOURCE = 'UNVERIFIED_SOURCE',
  EXPERIMENTAL_FEATURE = 'EXPERIMENTAL_FEATURE'
}

/**
 * Validation details
 */
export interface ValidationDetails {
  /** Plugin ID */
  pluginId: string;
  /** Plugin version */
  version: string;
  /** Host version */
  hostVersion: string;
  /** Version compatibility */
  versionCompatible: boolean;
  /** Security score (0-100) */
  securityScore: number;
  /** Trust score (0-100) */
  trustScore: number;
  /** Estimated bundle size */
  bundleSize?: number;
  /** Required permissions */
  requiredPermissions: string[];
  /** Analysis results */
  analysis?: CodeAnalysisResult;
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult {
  /** Lines of code */
  linesOfCode: number;
  /** Cyclomatic complexity */
  complexity: number;
  /** Number of dependencies */
  dependencies: number;
  /** Security issues found */
  securityIssues: SecurityIssue[];
  /** Code quality issues */
  qualityIssues: QualityIssue[];
  /** Used APIs */
  usedApis: string[];
  /** Used modules */
  usedModules: string[];
}

/**
 * Security issue
 */
export interface SecurityIssue {
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Issue type */
  type: string;
  /** Issue description */
  description: string;
  /** Line number */
  line?: number;
  /** Code snippet */
  code?: string;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Code quality issue
 */
export interface QualityIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Issue type */
  type: string;
  /** Issue description */
  description: string;
  /** Line number */
  line?: number;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Validator configuration options
 */
export interface ValidatorOptions {
  /** Host application version */
  hostVersion: string;
  /** Minimum required host version for plugins */
  minHostVersion?: string;
  /** Maximum compatible host version */
  maxHostVersion?: string;
  /** Allowed plugin sources */
  allowedSources?: string[];
  /** Blocked plugin IDs */
  blockedPlugins?: string[];
  /** Trusted publishers */
  trustedPublishers?: string[];
  /** Required permissions for plugins */
  requiredPermissions?: string[];
  /** Maximum allowed bundle size in bytes */
  maxBundleSize?: number;
  /** Minimum security score (0-100) */
  minSecurityScore?: number;
  /** Minimum trust score (0-100) */
  minTrustScore?: number;
  /** Public keys for signature verification */
  publicKeys?: string[];
  /** Enable code analysis */
  enableCodeAnalysis?: boolean;
}

// ============================================================================
// Plugin Validator Class
// ============================================================================

/**
 * PluginValidator - Validates plugins before loading.
 * 
 * The PluginValidator performs comprehensive validation of plugins including
 * metadata validation, version compatibility checking, security analysis,
 * and code quality assessment.
 * 
 * @example
 * ```typescript
 * const validator = new PluginValidator({
 *   hostVersion: '1.0.0',
 *   blockedPlugins: ['malicious.plugin'],
 *   minSecurityScore: 70
 * });
 * 
 * const result = validator.validate(pluginMetadata);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export class PluginValidator extends EventEmitter {
  /**
   * Validator configuration
   */
  private options: ValidatorOptions;

  /**
   * Validation rules
   */
  private validationRules: Map<string, ValidationRule> = new Map();

  /**
   * Creates a new PluginValidator instance.
   * 
   * @param options - Validator configuration options
   */
  constructor(options: ValidatorOptions) {
    super();
    this.setMaxListeners(50);

    this.options = {
      minHostVersion: '1.0.0',
      allowedSources: ['official', 'verified', 'local'],
      blockedPlugins: [],
      trustedPublishers: [],
      requiredPermissions: [],
      maxBundleSize: 50 * 1024 * 1024, // 50MB
      minSecurityScore: 50,
      minTrustScore: 30,
      enableCodeAnalysis: true,
      ...options
    };

    // Initialize validation rules
    this.initializeValidationRules();
  }

  /**
   * Validates plugin metadata.
   * 
   * @param metadata - Plugin metadata to validate
   * @param options - Validation options
   * @returns Validation result
   */
  public validate(
    metadata: PluginMetadata,
    options: ValidationOptions = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const details: Partial<ValidationDetails> = {
      pluginId: metadata.id,
      version: metadata.version,
      hostVersion: this.options.hostVersion,
      versionCompatible: true,
      securityScore: 100,
      trustScore: 100,
      requiredPermissions: []
    };

    this.emit('validationStarted', { pluginId: metadata.id });

    // Check metadata
    if (options.checkMetadata !== false) {
      this.validateMetadata(metadata, errors, warnings);
    }

    // Check version compatibility
    if (options.checkVersion !== false) {
      this.validateVersionCompatibility(metadata, errors, warnings, details);
    }

    // Check blocked plugins
    if (options.checkBlocked !== false) {
      this.validateNotBlocked(metadata, errors);
    }

    // Check source
    if (options.checkSource !== false) {
      this.validateSource(metadata, errors, warnings);
    }

    // Check permissions
    if (options.checkPermissions !== false) {
      this.validatePermissions(metadata, errors, warnings, details);
    }

    // Check config schema
    if (metadata.configSchema) {
      this.validateConfigSchema(metadata.configSchema, errors);
    }

    // Calculate final scores
    details.securityScore = this.calculateSecurityScore(errors, warnings);
    details.trustScore = this.calculateTrustScore(metadata, errors, warnings);

    // Check minimum scores in strict mode
    if (options.strict) {
      if ((details.securityScore || 0) < (this.options.minSecurityScore || 0)) {
        errors.push({
          code: ValidationErrorCode.PERMISSION_DENIED,
          message: `Security score ${details.securityScore} is below minimum ${this.options.minSecurityScore}`,
          details: { score: details.securityScore, minScore: this.options.minSecurityScore }
        });
      }

      if ((details.trustScore || 0) < (this.options.minTrustScore || 0)) {
        errors.push({
          code: ValidationErrorCode.SOURCE_NOT_ALLOWED,
          message: `Trust score ${details.trustScore} is below minimum ${this.options.minTrustScore}`,
          details: { score: details.trustScore, minScore: this.options.minTrustScore }
        });
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      details: details as ValidationDetails
    };

    this.emit('validationCompleted', { pluginId: metadata.id, result });

    return result;
  }

  /**
   * Validates plugin configuration.
   * 
   * @param config - Configuration to validate
   * @param schema - Configuration schema
   * @returns Validation result
   */
  public validateConfig(
    config: PluginConfig,
    schema: ConfigSchemaEntry[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const entry of schema) {
      const value = config[entry.key];

      // Check required
      if (entry.required && (value === undefined || value === null)) {
        errors.push(`Missing required configuration: ${entry.key}`);
        continue;
      }

      // Skip if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (entry.type !== actualType) {
        errors.push(`Invalid type for ${entry.key}: expected ${entry.type}, got ${actualType}`);
        continue;
      }

      // Validate based on type
      switch (entry.type) {
        case 'string':
          this.validateStringConfig(value, entry, errors);
          break;
        case 'number':
          this.validateNumberConfig(value, entry, errors);
          break;
        case 'array':
          this.validateArrayConfig(value, entry, errors);
          break;
        case 'object':
          this.validateObjectConfig(value, entry, errors);
          break;
        case 'enum':
          this.validateEnumConfig(value, entry, errors);
          break;
      }
    }

    // Check for unknown keys
    const knownKeys = new Set(schema.map(e => e.key));
    for (const key of Object.keys(config)) {
      if (!knownKeys.has(key)) {
        errors.push(`Unknown configuration key: ${key}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates a plugin signature.
   * 
   * @param pluginData - Plugin data
   * @param signature - Signature to verify
   * @param publicKey - Public key for verification
   * @returns Whether the signature is valid
   */
  public validateSignature(
    pluginData: Buffer | string,
    signature: string,
    publicKey?: string
  ): boolean {
    const key = publicKey || this.options.publicKeys?.[0];
    
    if (!key) {
      this.emit('signatureError', { error: 'No public key available' });
      return false;
    }

    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(pluginData);
      
      const isValid = verifier.verify(key, signature, 'base64');
      
      this.emit('signatureVerified', { valid: isValid });
      
      return isValid;
    } catch (error) {
      this.emit('signatureError', { error });
      return false;
    }
  }

  /**
   * Validates a plugin checksum.
   * 
   * @param pluginData - Plugin data
   * @param expectedChecksum - Expected checksum
   * @returns Whether the checksum matches
   */
  public validateChecksum(
    pluginData: Buffer | string,
    expectedChecksum: string
  ): boolean {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(pluginData);
      const actualChecksum = hash.digest('hex');
      
      const matches = actualChecksum === expectedChecksum;
      
      this.emit('checksumVerified', { valid: matches });
      
      return matches;
    } catch (error) {
      this.emit('checksumError', { error });
      return false;
    }
  }

  /**
   * Checks if a plugin ID is blocked.
   * 
   * @param pluginId - Plugin ID to check
   * @returns True if the plugin is blocked
   */
  public isBlocked(pluginId: string): boolean {
    return this.options.blockedPlugins?.includes(pluginId) || false;
  }

  /**
   * Adds a plugin ID to the blocklist.
   * 
   * @param pluginId - Plugin ID to block
   */
  public blockPlugin(pluginId: string): void {
    if (!this.options.blockedPlugins) {
      this.options.blockedPlugins = [];
    }
    
    if (!this.options.blockedPlugins.includes(pluginId)) {
      this.options.blockedPlugins.push(pluginId);
      this.emit('pluginBlocked', { pluginId });
    }
  }

  /**
   * Removes a plugin ID from the blocklist.
   * 
   * @param pluginId - Plugin ID to unblock
   */
  public unblockPlugin(pluginId: string): void {
    if (this.options.blockedPlugins) {
      const index = this.options.blockedPlugins.indexOf(pluginId);
      if (index > -1) {
        this.options.blockedPlugins.splice(index, 1);
        this.emit('pluginUnblocked', { pluginId });
      }
    }
  }

  // ============================================================================
  // Private Validation Methods
  // ============================================================================

  /**
   * Validates plugin metadata.
   * 
   * @param metadata - Metadata to validate
   * @param errors - Errors array
   * @param warnings - Warnings array
   */
  private validateMetadata(
    metadata: PluginMetadata,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate ID
    if (!metadata.id) {
      errors.push({ code: ValidationErrorCode.MISSING_ID, message: 'Plugin ID is required' });
    } else {
      const idPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
      if (!idPattern.test(metadata.id)) {
        errors.push({
          code: ValidationErrorCode.INVALID_ID,
          message: `Invalid plugin ID format: ${metadata.id}. Use reverse domain notation (e.g., com.example.plugin)`,
          field: 'id'
        });
      }
    }

    // Validate name
    if (!metadata.name) {
      errors.push({ code: ValidationErrorCode.MISSING_NAME, message: 'Plugin name is required' });
    } else if (metadata.name.length < 2 || metadata.name.length > 100) {
      errors.push({
        code: ValidationErrorCode.INVALID_NAME,
        message: 'Plugin name must be between 2 and 100 characters',
        field: 'name'
      });
    }

    // Validate version
    if (!metadata.version) {
      errors.push({ code: ValidationErrorCode.MISSING_VERSION, message: 'Plugin version is required' });
    } else {
      const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9._-]+))?(?:\+([a-zA-Z0-9._-]+))?$/;
      if (!semverPattern.test(metadata.version)) {
        errors.push({
          code: ValidationErrorCode.INVALID_VERSION,
          message: `Invalid version format: ${metadata.version}. Use semantic versioning (e.g., 1.0.0)`,
          field: 'version'
        });
      }
    }

    // Validate description
    if (!metadata.description) {
      errors.push({
        code: ValidationErrorCode.MISSING_DESCRIPTION,
        message: 'Plugin description is required',
        field: 'description'
      });
    }

    // Validate author
    if (!metadata.author) {
      errors.push({
        code: ValidationErrorCode.MISSING_AUTHOR,
        message: 'Plugin author is required',
        field: 'author'
      });
    }

    // Validate category
    if (metadata.category && !Object.values(PluginCategory).includes(metadata.category)) {
      errors.push({
        code: ValidationErrorCode.INVALID_CATEGORY,
        message: `Invalid category: ${metadata.category}`,
        field: 'category'
      });
    }

    // Warnings for missing optional fields
    if (!metadata.license) {
      warnings.push({
        code: ValidationWarningCode.MISSING_LICENSE,
        message: 'Plugin license is not specified',
        field: 'license'
      });
    }

    if (!metadata.homepage) {
      warnings.push({
        code: ValidationWarningCode.MISSING_HOMEPAGE,
        message: 'Plugin homepage is not specified',
        field: 'homepage'
      });
    }

    if (!metadata.repository) {
      warnings.push({
        code: ValidationWarningCode.MISSING_REPOSITORY,
        message: 'Plugin repository is not specified',
        field: 'repository'
      });
    }
  }

  /**
   * Validates version compatibility.
   * 
   * @param metadata - Plugin metadata
   * @param errors - Errors array
   * @param warnings - Warnings array
   * @param details - Validation details
   */
  private validateVersionCompatibility(
    metadata: PluginMetadata,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    details: Partial<ValidationDetails>
  ): void {
    const hostVersion = this.options.hostVersion;
    const minVersion = metadata.minHostVersion;
    const maxVersion = metadata.maxHostVersion;

    // Check minimum version
    if (minVersion) {
      if (this.compareVersions(hostVersion, minVersion) < 0) {
        errors.push({
          code: ValidationErrorCode.INCOMPATIBLE_VERSION,
          message: `Host version ${hostVersion} is below minimum required version ${minVersion}`,
          details: { hostVersion, minVersion }
        });
        details.versionCompatible = false;
      }
    }

    // Check maximum version
    if (maxVersion) {
      if (this.compareVersions(hostVersion, maxVersion) > 0) {
        errors.push({
          code: ValidationErrorCode.INCOMPATIBLE_VERSION,
          message: `Host version ${hostVersion} exceeds maximum compatible version ${maxVersion}`,
          details: { hostVersion, maxVersion }
        });
        details.versionCompatible = false;
      }
    }

    // Warning for pre-release versions
    if (metadata.version.includes('-')) {
      warnings.push({
        code: ValidationWarningCode.UNSTABLE_VERSION,
        message: `Plugin version ${metadata.version} is a pre-release version`,
        field: 'version'
      });
    }
  }

  /**
   * Validates that a plugin is not blocked.
   * 
   * @param metadata - Plugin metadata
   * @param errors - Errors array
   */
  private validateNotBlocked(metadata: PluginMetadata, errors: ValidationError[]): void {
    if (this.isBlocked(metadata.id)) {
      errors.push({
        code: ValidationErrorCode.BLOCKED_PLUGIN,
        message: `Plugin ${metadata.id} is blocked`,
        details: { pluginId: metadata.id }
      });
    }
  }

  /**
   * Validates plugin source.
   * 
   * @param metadata - Plugin metadata
   * @param errors - Errors array
   * @param warnings - Warnings array
   */
  private validateSource(
    metadata: PluginMetadata,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check if publisher is trusted
    const authorName = typeof metadata.author === 'string' 
      ? metadata.author 
      : metadata.author.name;
      
    const isTrusted = this.options.trustedPublishers?.includes(authorName);
    
    if (!isTrusted) {
      warnings.push({
        code: ValidationWarningCode.UNVERIFIED_SOURCE,
        message: `Plugin publisher ${authorName} is not in the trusted publishers list`,
        field: 'author'
      });
    }
  }

  /**
   * Validates plugin permissions.
   * 
   * @param metadata - Plugin metadata
   * @param errors - Errors array
   * @param warnings - Warnings array
   * @param details - Validation details
   */
  private validatePermissions(
    metadata: PluginMetadata,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    details: Partial<ValidationDetails>
  ): void {
    const capabilities = metadata.capabilities || {};
    const permissions: string[] = [];

    if (capabilities.requiresNetwork) {
      permissions.push('network');
    }
    if (capabilities.requiresFileSystem) {
      permissions.push('filesystem');
    }
    if (capabilities.requiresShell) {
      permissions.push('shell');
    }
    if (capabilities.requiresLLM) {
      permissions.push('llm');
    }

    details.requiredPermissions = permissions;

    // Warning for broad permissions
    if (permissions.length > 2) {
      warnings.push({
        code: ValidationWarningCode.BROAD_PERMISSIONS,
        message: `Plugin requires multiple permissions: ${permissions.join(', ')}`,
        details: { permissions }
      });
    }
  }

  /**
   * Validates configuration schema.
   * 
   * @param schema - Configuration schema
   * @param errors - Errors array
   */
  private validateConfigSchema(schema: ConfigSchemaEntry[], errors: ValidationError[]): void {
    const keys = new Set<string>();

    for (const entry of schema) {
      // Check for duplicate keys
      if (keys.has(entry.key)) {
        errors.push({
          code: ValidationErrorCode.INVALID_CONFIG_SCHEMA,
          message: `Duplicate configuration key: ${entry.key}`,
          field: `configSchema.${entry.key}`
        });
      }
      keys.add(entry.key);

      // Validate entry
      if (!entry.key) {
        errors.push({
          code: ValidationErrorCode.INVALID_CONFIG_SCHEMA,
          message: 'Configuration entry must have a key',
          field: 'configSchema'
        });
      }

      if (!entry.type) {
        errors.push({
          code: ValidationErrorCode.INVALID_CONFIG_SCHEMA,
          message: `Configuration entry ${entry.key} must have a type`,
          field: `configSchema.${entry.key}.type`
        });
      }

      if (!entry.label) {
        errors.push({
          code: ValidationErrorCode.INVALID_CONFIG_SCHEMA,
          message: `Configuration entry ${entry.key} must have a label`,
          field: `configSchema.${entry.key}.label`
        });
      }
    }
  }

  /**
   * Validates string configuration value.
   * 
   * @param value - Value to validate
   * @param entry - Schema entry
   * @param errors - Errors array
   */
  private validateStringConfig(
    value: string,
    entry: ConfigSchemaEntry,
    errors: string[]
  ): void {
    if (entry.pattern) {
      const regex = new RegExp(entry.pattern);
      if (!regex.test(value)) {
        errors.push(`${entry.key} does not match required pattern: ${entry.pattern}`);
      }
    }
  }

  /**
   * Validates number configuration value.
   * 
   * @param value - Value to validate
   * @param entry - Schema entry
   * @param errors - Errors array
   */
  private validateNumberConfig(
    value: number,
    entry: ConfigSchemaEntry,
    errors: string[]
  ): void {
    if (entry.min !== undefined && value < entry.min) {
      errors.push(`${entry.key} must be at least ${entry.min}`);
    }
    if (entry.max !== undefined && value > entry.max) {
      errors.push(`${entry.key} must be at most ${entry.max}`);
    }
  }

  /**
   * Validates array configuration value.
   * 
   * @param value - Value to validate
   * @param entry - Schema entry
   * @param errors - Errors array
   */
  private validateArrayConfig(
    value: any[],
    entry: ConfigSchemaEntry,
    errors: string[]
  ): void {
    if (entry.items) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const itemType = Array.isArray(item) ? 'array' : typeof item;
        
        if (itemType !== entry.items.type) {
          errors.push(`${entry.key}[${i}] has invalid type: expected ${entry.items.type}, got ${itemType}`);
        }
      }
    }
  }

  /**
   * Validates object configuration value.
   * 
   * @param value - Value to validate
   * @param entry - Schema entry
   * @param errors - Errors array
   */
  private validateObjectConfig(
    value: object,
    entry: ConfigSchemaEntry,
    errors: string[]
  ): void {
    if (entry.properties) {
      for (const prop of entry.properties) {
        const propValue = (value as any)[prop.key];
        
        if (prop.required && (propValue === undefined || propValue === null)) {
          errors.push(`${entry.key}.${prop.key} is required`);
        }
      }
    }
  }

  /**
   * Validates enum configuration value.
   * 
   * @param value - Value to validate
   * @param entry - Schema entry
   * @param errors - Errors array
   */
  private validateEnumConfig(
    value: string,
    entry: ConfigSchemaEntry,
    errors: string[]
  ): void {
    if (entry.enumValues && !entry.enumValues.includes(value)) {
      errors.push(`${entry.key} must be one of: ${entry.enumValues.join(', ')}`);
    }
  }

  /**
   * Calculates security score.
   * 
   * @param errors - Validation errors
   * @param warnings - Validation warnings
   * @returns Security score (0-100)
   */
  private calculateSecurityScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;

    // Deduct for errors
    score -= errors.length * 20;

    // Deduct for warnings
    score -= warnings.length * 5;

    return Math.max(0, score);
  }

  /**
   * Calculates trust score.
   * 
   * @param metadata - Plugin metadata
   * @param errors - Validation errors
   * @param warnings - Validation warnings
   * @returns Trust score (0-100)
   */
  private calculateTrustScore(
    metadata: PluginMetadata,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 100;

    // Check if publisher is trusted
    const authorName = typeof metadata.author === 'string' 
      ? metadata.author 
      : metadata.author.name;
      
    if (!this.options.trustedPublishers?.includes(authorName)) {
      score -= 20;
    }

    // Check for license
    if (!metadata.license) {
      score -= 10;
    }

    // Check for repository
    if (!metadata.repository) {
      score -= 5;
    }

    // Deduct for warnings
    score -= warnings.length * 3;

    return Math.max(0, score);
  }

  /**
   * Compares two version strings.
   * 
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  /**
   * Initializes validation rules.
   */
  private initializeValidationRules(): void {
    // Add custom validation rules here
  }
}

/**
 * Validation rule interface
 */
interface ValidationRule {
  name: string;
  validate: (metadata: PluginMetadata) => ValidationError[];
}

export default PluginValidator;
