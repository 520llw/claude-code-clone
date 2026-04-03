/**
 * SkillLoader.ts - Skill Loading System
 * 
 * Handles loading skills from various sources: files, directories,
 * URLs, npm packages, and the skill registry.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Skill,
  SkillDefinition,
  SkillId,
  SkillLoadOptions,
  SkillLoadResult,
  SkillSource,
  SkillModule,
  SkillFactory,
  SkillErrorCode,
  SkillExecutionError,
  SKILL_FILE_EXTENSIONS,
  SKILL_CONFIG_FILENAME,
  SKILL_README_FILENAME,
} from './types';
import { SkillParser } from './utils/parser';
import { SkillValidator } from './utils/validator';

/**
 * Skill loader for loading skills from various sources
 */
export class SkillLoader extends EventEmitter {
  /**
   * Parser instance
   */
  private _parser: SkillParser;

  /**
   * Validator instance
   */
  private _validator: SkillValidator;

  /**
   * Cache for loaded skills
   */
  private _cache: Map<string, { definition: SkillDefinition; timestamp: number }> = new Map();

  /**
   * Loaded module cache
   */
  private _moduleCache: Map<string, SkillModule> = new Map();

  /**
   * Search paths for skill resolution
   */
  private _searchPaths: string[] = [];

  /**
   * Create a new skill loader
   */
  constructor(searchPaths: string[] = []) {
    super();
    this._parser = new SkillParser();
    this._validator = new SkillValidator();
    this._searchPaths = searchPaths;
  }

  // ============================================================================
  // Public Loading Methods
  // ============================================================================

  /**
   * Load a skill from a source
   */
  public async load(options: SkillLoadOptions): Promise<SkillLoadResult> {
    const warnings: string[] = [];

    try {
      this.emit('loading', { source: options.from, path: options.path });

      let definition: SkillDefinition;

      switch (options.from) {
        case 'file':
          definition = await this._loadFromFile(options.path);
          break;
        case 'directory':
          definition = await this._loadFromDirectory(options.path);
          break;
        case 'url':
          definition = await this._loadFromUrl(options.path);
          break;
        case 'npm':
          definition = await this._loadFromNpm(options.path, options.version);
          break;
        case 'registry':
          definition = await this._loadFromRegistry(options.path, options.version);
          break;
        default:
          throw new SkillExecutionError(
            'SKILL_LOAD_FAILED',
            `Unknown load source: ${options.from}`
          );
      }

      // Validate loaded definition
      const validation = this._validator.validateDefinition(definition);
      if (!validation.valid) {
        throw new SkillExecutionError(
          'SKILL_VALIDATION_FAILED',
          `Loaded skill validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Verify signature if required
      if (options.verifySignature) {
        const signatureValid = await this._verifySignature(definition);
        if (!signatureValid) {
          throw new SkillExecutionError(
            'SKILL_VALIDATION_FAILED',
            'Skill signature verification failed'
          );
        }
      }

      this.emit('loaded', { skillId: definition.metadata.id });

      return {
        success: true,
        definition,
        warnings,
      };
    } catch (error) {
      const skillError = this._normalizeError(error);
      
      this.emit('error', { error: skillError });

      return {
        success: false,
        error: skillError,
        warnings,
      };
    }
  }

  /**
   * Load a skill from a file path
   */
  public async loadFromFile(filePath: string): Promise<SkillLoadResult> {
    return this.load({
      from: 'file',
      path: filePath,
      verifySignature: false,
      sandboxed: true,
    });
  }

  /**
   * Load a skill from a directory
   */
  public async loadFromDirectory(dirPath: string): Promise<SkillLoadResult> {
    return this.load({
      from: 'directory',
      path: dirPath,
      verifySignature: false,
      sandboxed: true,
    });
  }

  /**
   * Load a skill from a URL
   */
  public async loadFromUrl(url: string): Promise<SkillLoadResult> {
    return this.load({
      from: 'url',
      path: url,
      verifySignature: false,
      sandboxed: true,
    });
  }

  /**
   * Load a skill from npm
   */
  public async loadFromNpm(
    packageName: string,
    version?: string
  ): Promise<SkillLoadResult> {
    return this.load({
      from: 'npm',
      path: packageName,
      version,
      verifySignature: false,
      sandboxed: true,
    });
  }

  /**
   * Load multiple skills from a directory
   */
  public async loadAllFromDirectory(
    dirPath: string,
    recursive: boolean = true
  ): Promise<SkillLoadResult[]> {
    const results: SkillLoadResult[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          // Check if it's a skill directory
          const configPath = path.join(fullPath, SKILL_CONFIG_FILENAME);
          try {
            await fs.access(configPath);
            const result = await this.loadFromDirectory(fullPath);
            results.push(result);
          } catch {
            // Not a skill directory, recurse
            const subResults = await this.loadAllFromDirectory(fullPath, recursive);
            results.push(...subResults);
          }
        } else if (entry.isFile() && this._isSkillFile(entry.name)) {
          const result = await this.loadFromFile(fullPath);
          results.push(result);
        }
      }
    } catch (error) {
      results.push({
        success: false,
        error: this._normalizeError(error),
        warnings: [],
      });
    }

    return results;
  }

  /**
   * Create a skill instance from a definition
   */
  public async createSkill(
    definition: SkillDefinition,
    sandboxed: boolean = true
  ): Promise<Skill> {
    // Try to find a factory for this skill
    const factory = await this._findFactory(definition, sandboxed);
    
    if (!factory) {
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `No factory found for skill '${definition.metadata.id}'`
      );
    }

    return factory(definition.config);
  }

  // ============================================================================
  // Source Loading Methods
  // ============================================================================

  /**
   * Load from a file
   */
  private async _loadFromFile(filePath: string): Promise<SkillDefinition> {
    // Check cache
    const cached = this._getFromCache(filePath);
    if (cached) return cached;

    // Resolve path
    const resolvedPath = await this._resolvePath(filePath);
    
    // Read file
    const content = await fs.readFile(resolvedPath, 'utf-8');
    
    // Parse based on extension
    const ext = path.extname(resolvedPath);
    let definition: SkillDefinition;

    if (ext === '.json') {
      definition = JSON.parse(content);
    } else {
      // TypeScript/JavaScript skill file
      const parsed = this._parser.parseSkillFile(content, resolvedPath);
      if (!parsed.success || !parsed.definition) {
        throw new SkillExecutionError(
          'SKILL_LOAD_FAILED',
          `Failed to parse skill file: ${parsed.errors.join(', ')}`
        );
      }
      definition = parsed.definition;
    }

    // Cache result
    this._cache.set(filePath, { definition, timestamp: Date.now() });

    return definition;
  }

  /**
   * Load from a directory
   */
  private async _loadFromDirectory(dirPath: string): Promise<SkillDefinition> {
    // Check cache
    const cached = this._getFromCache(dirPath);
    if (cached) return cached;

    // Resolve path
    const resolvedPath = await this._resolvePath(dirPath);

    // Look for skill.config.json
    const configPath = path.join(resolvedPath, SKILL_CONFIG_FILENAME);
    
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Load main skill file if specified
      if (config.main) {
        const mainPath = path.join(resolvedPath, config.main);
        const definition = await this._loadFromFile(mainPath);
        
        // Merge with config
        const mergedDefinition: SkillDefinition = {
          ...definition,
          ...config,
          metadata: {
            ...definition.metadata,
            ...config.metadata,
          },
        };

        // Try to load README
        try {
          const readmePath = path.join(resolvedPath, SKILL_README_FILENAME);
          const readme = await fs.readFile(readmePath, 'utf-8');
          mergedDefinition.documentation.readme = readme;
        } catch {
          // README is optional
        }

        this._cache.set(dirPath, { definition: mergedDefinition, timestamp: Date.now() });
        return mergedDefinition;
      }

      // Use config as definition
      this._cache.set(dirPath, { definition: config, timestamp: Date.now() });
      return config;
    } catch (error) {
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `Failed to load skill from directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load from a URL
   */
  private async _loadFromUrl(url: string): Promise<SkillDefinition> {
    // Check cache
    const cached = this._getFromCache(url);
    if (cached) return cached;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new SkillExecutionError(
          'SKILL_LOAD_FAILED',
          `HTTP error ${response.status}: ${response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type');
      let definition: SkillDefinition;

      if (contentType?.includes('application/json')) {
        definition = await response.json();
      } else {
        const content = await response.text();
        const parsed = this._parser.parseSkillFile(content, url);
        if (!parsed.success || !parsed.definition) {
          throw new SkillExecutionError(
            'SKILL_LOAD_FAILED',
            `Failed to parse skill from URL: ${parsed.errors.join(', ')}`
          );
        }
        definition = parsed.definition;
      }

      this._cache.set(url, { definition, timestamp: Date.now() });
      return definition;
    } catch (error) {
      if (error instanceof SkillExecutionError) throw error;
      
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `Failed to fetch skill from URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load from npm package
   */
  private async _loadFromNpm(
    packageName: string,
    version?: string
  ): Promise<SkillDefinition> {
    const cacheKey = `${packageName}@${version || 'latest'}`;
    
    // Check cache
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Try to require the package
      const pkgPath = version
        ? `${packageName}@${version}`
        : packageName;

      // Dynamic import
      const module = await import(pkgPath);
      
      let definition: SkillDefinition;

      if (module.definition) {
        definition = module.definition;
      } else if (module.default?.definition) {
        definition = module.default.definition;
      } else {
        throw new SkillExecutionError(
          'SKILL_LOAD_FAILED',
          `Package '${packageName}' does not export a skill definition`
        );
      }

      this._cache.set(cacheKey, { definition, timestamp: Date.now() });
      return definition;
    } catch (error) {
      throw new SkillExecutionError(
        'SKILL_LOAD_FAILED',
        `Failed to load skill from npm: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load from skill registry
   */
  private async _loadFromRegistry(
    skillId: SkillId,
    version?: string
  ): Promise<SkillDefinition> {
    const cacheKey = `registry:${skillId}@${version || 'latest'}`;
    
    // Check cache
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    // This would connect to a remote registry
    // For now, throw an error
    throw new SkillExecutionError(
      'SKILL_LOAD_FAILED',
      'Registry loading not implemented'
    );
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Find a factory for a skill definition
   */
  private async _findFactory(
    definition: SkillDefinition,
    sandboxed: boolean
  ): Promise<SkillFactory | null> {
    const skillId = definition.metadata.id;

    // Check module cache
    const cachedModule = this._moduleCache.get(skillId);
    if (cachedModule) {
      return this._extractFactory(cachedModule);
    }

    // Try to load from known locations
    const possiblePaths = [
      `./builtin/${skillId}`,
      `./skills/${skillId}`,
      `@claude-code/skills/${skillId}`,
    ];

    for (const tryPath of possiblePaths) {
      try {
        const module = await import(tryPath);
        this._moduleCache.set(skillId, module);
        return this._extractFactory(module);
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Extract factory from module
   */
  private _extractFactory(module: SkillModule): SkillFactory | null {
    if (module.default && typeof module.default === 'function') {
      return module.default as SkillFactory;
    }
    
    if (module.factory && typeof module.factory === 'function') {
      return module.factory;
    }

    return null;
  }

  // ============================================================================
  // Path Resolution
  // ============================================================================

  /**
   * Resolve a path to an absolute path
   */
  private async _resolvePath(inputPath: string): Promise<string> {
    // If already absolute, return as-is
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }

    // Try search paths
    for (const searchPath of this._searchPaths) {
      const fullPath = path.join(searchPath, inputPath);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Continue to next search path
      }
    }

    // Try relative to current working directory
    const cwdPath = path.join(process.cwd(), inputPath);
    try {
      await fs.access(cwdPath);
      return cwdPath;
    } catch {
      // Path not found
    }

    // Return original path and let it fail
    return inputPath;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get from cache if not expired
   */
  private _getFromCache(key: string): SkillDefinition | null {
    const cached = this._cache.get(key);
    if (!cached) return null;

    // Cache expires after 5 minutes
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > maxAge) {
      this._cache.delete(key);
      return null;
    }

    return cached.definition;
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this._cache.clear();
    this._moduleCache.clear();
  }

  /**
   * Invalidate cache entry
   */
  public invalidateCache(key: string): boolean {
    return this._cache.delete(key);
  }

  // ============================================================================
  // Search Paths
  // ============================================================================

  /**
   * Add a search path
   */
  public addSearchPath(searchPath: string): void {
    if (!this._searchPaths.includes(searchPath)) {
      this._searchPaths.push(searchPath);
    }
  }

  /**
   * Remove a search path
   */
  public removeSearchPath(searchPath: string): void {
    const index = this._searchPaths.indexOf(searchPath);
    if (index !== -1) {
      this._searchPaths.splice(index, 1);
    }
  }

  /**
   * Get all search paths
   */
  public getSearchPaths(): string[] {
    return [...this._searchPaths];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a file is a skill file
   */
  private _isSkillFile(filename: string): boolean {
    return SKILL_FILE_EXTENSIONS.some(ext => filename.endsWith(ext));
  }

  /**
   * Verify skill signature
   */
  private async _verifySignature(definition: SkillDefinition): Promise<boolean> {
    // Signature verification would be implemented here
    // For now, always return true
    return true;
  }

  /**
   * Normalize error to SkillError
   */
  private _normalizeError(error: unknown): {
    code: SkillErrorCode;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  } {
    if (error instanceof SkillExecutionError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack,
      };
    }

    if (error instanceof Error) {
      return {
        code: 'SKILL_LOAD_FAILED',
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      code: 'SKILL_LOAD_FAILED',
      message: String(error),
    };
  }

  /**
   * Watch a directory for skill changes
   */
  public async watchDirectory(
    dirPath: string,
    callback: (event: 'add' | 'change' | 'remove', skillId: SkillId) => void
  ): Promise<() => void> {
    // This would use fs.watch or chokidar
    // For now, return a no-op cleanup function
    return () => {};
  }

  /**
   * Preload skills for faster access
   */
  public async preload(skillIds: SkillId[]): Promise<{
    loaded: SkillId[];
    failed: { skillId: SkillId; error: string }[];
  }> {
    const loaded: SkillId[] = [];
    const failed: { skillId: SkillId; error: string }[] = [];

    for (const skillId of skillIds) {
      try {
        // Try to find and cache the factory
        const factory = await this._findFactory(
          { metadata: { id: skillId } } as SkillDefinition,
          true
        );
        
        if (factory) {
          loaded.push(skillId);
        } else {
          failed.push({ skillId, error: 'Factory not found' });
        }
      } catch (error) {
        failed.push({
          skillId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { loaded, failed };
  }
}

export default SkillLoader;
