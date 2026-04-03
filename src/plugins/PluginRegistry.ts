/**
 * PluginRegistry.ts
 * 
 * Plugin Registration and Discovery for Claude Code Clone Plugin System
 * 
 * This file implements the PluginRegistry class which is responsible for:
 * - Plugin registration and deregistration
 * - Plugin metadata storage and retrieval
 * - Plugin discovery and search
 * - Plugin categorization
 * - Plugin marketplace integration
 * - Plugin version tracking
 * - Plugin source management
 * 
 * The PluginRegistry maintains a centralized database of all available plugins
 * and provides APIs for querying and managing the plugin catalog.
 * 
 * @module PluginSystem
 * @author Claude Code Clone
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  PluginMetadata,
  PluginCategory,
  PluginAuthor,
  PluginCapabilities,
  PluginDependency
} from './Plugin';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Registered plugin entry
 */
export interface RegisteredPlugin {
  /** Unique registration ID */
  registrationId: string;
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin source (path, URL, or package name) */
  source: string;
  /** Source type */
  sourceType: PluginSourceType;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Plugin status */
  status: PluginRegistrationStatus;
  /** Verification status */
  verified: boolean;
  /** Verification timestamp */
  verifiedAt?: Date;
  /** Plugin rating (0-5) */
  rating?: number;
  /** Download count */
  downloads?: number;
  /** Plugin reviews */
  reviews?: PluginReview[];
  /** Plugin tags */
  tags?: string[];
  /** Plugin size in bytes */
  size?: number;
  /** Plugin checksum */
  checksum?: string;
  /** Additional properties */
  [key: string]: any;
}

/**
 * Plugin source type
 */
export enum PluginSourceType {
  LOCAL = 'local',
  NPM = 'npm',
  GITHUB = 'github',
  MARKETPLACE = 'marketplace',
  BUILTIN = 'builtin',
  DEVELOPMENT = 'development',
  REMOTE = 'remote'
}

/**
 * Plugin registration status
 */
export enum PluginRegistrationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  SUSPENDED = 'suspended',
  REMOVED = 'removed',
  BLACKLISTED = 'blacklisted'
}

/**
 * Plugin review
 */
export interface PluginReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  helpful?: number;
  verified?: boolean;
}

/**
 * Plugin search options
 */
export interface PluginSearchOptions {
  /** Search query */
  query?: string;
  /** Filter by category */
  category?: PluginCategory;
  /** Filter by categories */
  categories?: PluginCategory[];
  /** Filter by author */
  author?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by status */
  status?: PluginRegistrationStatus;
  /** Filter by source type */
  sourceType?: PluginSourceType;
  /** Filter by verification status */
  verified?: boolean;
  /** Minimum rating */
  minRating?: number;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'name' | 'rating' | 'downloads' | 'updatedAt' | 'createdAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Plugin search result
 */
export interface PluginSearchResult {
  plugins: RegisteredPlugin[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Plugin marketplace package
 */
export interface MarketplacePackage {
  id: string;
  name: string;
  version: string;
  description: string;
  author: PluginAuthor;
  downloadUrl: string;
  iconUrl?: string;
  screenshots?: string[];
  readme?: string;
  license?: string;
  keywords?: string[];
  category?: PluginCategory;
  rating?: number;
  downloads?: number;
  publishedAt?: Date;
  updatedAt?: Date;
  dependencies?: PluginDependency[];
  size?: number;
  checksum?: string;
}

/**
 * Registry configuration options
 */
export interface RegistryOptions {
  /** Storage backend for registry data */
  storage?: RegistryStorage;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Marketplace URL */
  marketplaceUrl?: string;
  /** API key for marketplace */
  marketplaceApiKey?: string;
  /** Auto-sync with marketplace */
  autoSync?: boolean;
  /** Sync interval in milliseconds */
  syncInterval?: number;
}

/**
 * Registry storage interface
 */
export interface RegistryStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * Plugin update information
 */
export interface PluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  changelog?: string;
  downloadUrl?: string;
  publishedAt?: Date;
  breakingChanges?: boolean;
  recommended?: boolean;
}

// ============================================================================
// Plugin Registry Class
// ============================================================================

/**
 * PluginRegistry - Central registry for plugin management.
 * 
 * The PluginRegistry maintains a catalog of all available plugins and provides
 * APIs for registration, discovery, and search. It also integrates with the
 * plugin marketplace for fetching and updating plugins.
 * 
 * @example
 * ```typescript
 * const registry = new PluginRegistry();
 * await registry.initialize();
 * 
 * // Register a plugin
 * registry.register({
 *   id: 'com.example.myplugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   description: 'An example plugin',
 *   author: 'John Doe'
 * });
 * 
 * // Search for plugins
 * const results = registry.search({ category: PluginCategory.INTEGRATION });
 * 
 * // Get plugin info
 * const plugin = registry.get('com.example.myplugin');
 * ```
 */
export class PluginRegistry extends EventEmitter {
  /**
   * Registered plugins map (by plugin ID)
   */
  private plugins: Map<string, RegisteredPlugin> = new Map();

  /**
   * Plugins by registration ID
   */
  private pluginsByRegId: Map<string, RegisteredPlugin> = new Map();

  /**
   * Plugins by category
   */
  private pluginsByCategory: Map<PluginCategory, Set<string>> = new Map();

  /**
   * Plugins by tag
   */
  private pluginsByTag: Map<string, Set<string>> = new Map();

  /**
   * Plugins by author
   */
  private pluginsByAuthor: Map<string, Set<string>> = new Map();

  /**
   * Plugin name index for search
   */
  private nameIndex: Map<string, string> = new Map();

  /**
   * Registry configuration
   */
  private options: RegistryOptions;

  /**
   * In-memory cache
   */
  private cache: Map<string, { value: any; expires: number }> = new Map();

  /**
   * Sync interval handle
   */
  private syncIntervalHandle?: NodeJS.Timeout;

  /**
   * Whether the registry is initialized
   */
  private initialized: boolean = false;

  /**
   * Creates a new PluginRegistry instance.
   * 
   * @param options - Registry configuration options
   */
  constructor(options: RegistryOptions = {}) {
    super();
    this.setMaxListeners(100);

    this.options = {
      enableCache: true,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      autoSync: false,
      syncInterval: 60 * 60 * 1000, // 1 hour
      ...options
    };
  }

  /**
   * Initializes the registry.
   * 
   * @returns A promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load persisted data if storage is available
    if (this.options.storage) {
      await this.loadFromStorage();
    }

    // Set up auto-sync if enabled
    if (this.options.autoSync && this.options.marketplaceUrl) {
      this.startAutoSync();
    }

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Disposes the registry.
   */
  public async dispose(): Promise<void> {
    // Stop auto-sync
    if (this.syncIntervalHandle) {
      clearInterval(this.syncIntervalHandle);
      this.syncIntervalHandle = undefined;
    }

    // Persist data if storage is available
    if (this.options.storage) {
      await this.saveToStorage();
    }

    // Clear caches
    this.cache.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Registers a plugin.
   * 
   * @param metadata - Plugin metadata
   * @param source - Plugin source
   * @param sourceType - Source type
   * @param options - Additional registration options
   * @returns The registered plugin entry
   */
  public register(
    metadata: PluginMetadata,
    source: string = '',
    sourceType: PluginSourceType = PluginSourceType.LOCAL,
    options: Partial<RegisteredPlugin> = {}
  ): RegisteredPlugin {
    // Validate metadata
    this.validateMetadata(metadata);

    // Check if already registered
    const existing = this.plugins.get(metadata.id);
    if (existing) {
      // Update existing registration
      return this.update(metadata.id, { metadata, source, sourceType, ...options });
    }

    // Create registration entry
    const registrationId = uuidv4();
    const registeredAt = new Date();

    const entry: RegisteredPlugin = {
      registrationId,
      metadata,
      source,
      sourceType,
      registeredAt,
      updatedAt: registeredAt,
      status: PluginRegistrationStatus.ACTIVE,
      verified: false,
      tags: metadata.keywords || [],
      ...options
    };

    // Store in maps
    this.plugins.set(metadata.id, entry);
    this.pluginsByRegId.set(registrationId, entry);

    // Index by category
    if (metadata.category) {
      if (!this.pluginsByCategory.has(metadata.category)) {
        this.pluginsByCategory.set(metadata.category, new Set());
      }
      this.pluginsByCategory.get(metadata.category)!.add(metadata.id);
    }

    // Index by tags
    for (const tag of entry.tags || []) {
      if (!this.pluginsByTag.has(tag)) {
        this.pluginsByTag.set(tag, new Set());
      }
      this.pluginsByTag.get(tag)!.add(metadata.id);
    }

    // Index by author
    const authorName = typeof metadata.author === 'string' 
      ? metadata.author 
      : metadata.author.name;
    if (!this.pluginsByAuthor.has(authorName)) {
      this.pluginsByAuthor.set(authorName, new Set());
    }
    this.pluginsByAuthor.get(authorName)!.add(metadata.id);

    // Index name for search
    this.nameIndex.set(metadata.name.toLowerCase(), metadata.id);

    this.emit('registered', { pluginId: metadata.id, entry });

    return entry;
  }

  /**
   * Unregisters a plugin.
   * 
   * @param pluginId - The plugin ID
   * @returns True if the plugin was unregistered
   */
  public unregister(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return false;
    }

    // Remove from maps
    this.plugins.delete(pluginId);
    this.pluginsByRegId.delete(entry.registrationId);

    // Remove from category index
    if (entry.metadata.category) {
      this.pluginsByCategory.get(entry.metadata.category)?.delete(pluginId);
    }

    // Remove from tag index
    for (const tag of entry.tags || []) {
      this.pluginsByTag.get(tag)?.delete(pluginId);
    }

    // Remove from author index
    const authorName = typeof entry.metadata.author === 'string' 
      ? entry.metadata.author 
      : entry.metadata.author.name;
    this.pluginsByAuthor.get(authorName)?.delete(pluginId);

    // Remove from name index
    this.nameIndex.delete(entry.metadata.name.toLowerCase());

    this.emit('unregistered', { pluginId, entry });

    return true;
  }

  /**
   * Updates a registered plugin.
   * 
   * @param pluginId - The plugin ID
   * @param updates - Updates to apply
   * @returns The updated plugin entry
   */
  public update(
    pluginId: string,
    updates: Partial<Omit<RegisteredPlugin, 'registrationId' | 'registeredAt'>>
  ): RegisteredPlugin {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Handle metadata update
    if (updates.metadata) {
      // Update category index if changed
      if (updates.metadata.category !== entry.metadata.category) {
        if (entry.metadata.category) {
          this.pluginsByCategory.get(entry.metadata.category)?.delete(pluginId);
        }
        if (updates.metadata.category) {
          if (!this.pluginsByCategory.has(updates.metadata.category)) {
            this.pluginsByCategory.set(updates.metadata.category, new Set());
          }
          this.pluginsByCategory.get(updates.metadata.category)!.add(pluginId);
        }
      }

      // Update name index if changed
      if (updates.metadata.name !== entry.metadata.name) {
        this.nameIndex.delete(entry.metadata.name.toLowerCase());
        this.nameIndex.set(updates.metadata.name.toLowerCase(), pluginId);
      }

      entry.metadata = updates.metadata;
    }

    // Update tags
    if (updates.tags) {
      // Remove old tags
      for (const tag of entry.tags || []) {
        this.pluginsByTag.get(tag)?.delete(pluginId);
      }
      // Add new tags
      for (const tag of updates.tags) {
        if (!this.pluginsByTag.has(tag)) {
          this.pluginsByTag.set(tag, new Set());
        }
        this.pluginsByTag.get(tag)!.add(pluginId);
      }
      entry.tags = updates.tags;
    }

    // Update other fields
    Object.assign(entry, updates);
    entry.updatedAt = new Date();

    this.emit('updated', { pluginId, entry });

    return entry;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Gets a registered plugin.
   * 
   * @param pluginId - The plugin ID
   * @returns The registered plugin or undefined
   */
  public get(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Gets a registered plugin by registration ID.
   * 
   * @param registrationId - The registration ID
   * @returns The registered plugin or undefined
   */
  public getByRegistrationId(registrationId: string): RegisteredPlugin | undefined {
    return this.pluginsByRegId.get(registrationId);
  }

  /**
   * Gets all registered plugins.
   * 
   * @returns Array of all registered plugins
   */
  public getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets plugins by category.
   * 
   * @param category - The category
   * @returns Array of plugins in the category
   */
  public getByCategory(category: PluginCategory): RegisteredPlugin[] {
    const ids = this.pluginsByCategory.get(category);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.plugins.get(id))
      .filter((p): p is RegisteredPlugin => p !== undefined);
  }

  /**
   * Gets plugins by tag.
   * 
   * @param tag - The tag
   * @returns Array of plugins with the tag
   */
  public getByTag(tag: string): RegisteredPlugin[] {
    const ids = this.pluginsByTag.get(tag);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.plugins.get(id))
      .filter((p): p is RegisteredPlugin => p !== undefined);
  }

  /**
   * Gets plugins by author.
   * 
   * @param author - The author name
   * @returns Array of plugins by the author
   */
  public getByAuthor(author: string): RegisteredPlugin[] {
    const ids = this.pluginsByAuthor.get(author);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.plugins.get(id))
      .filter((p): p is RegisteredPlugin => p !== undefined);
  }

  /**
   * Checks if a plugin is registered.
   * 
   * @param pluginId - The plugin ID
   * @returns True if the plugin is registered
   */
  public has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Gets the count of registered plugins.
   * 
   * @returns The number of registered plugins
   */
  public count(): number {
    return this.plugins.size;
  }

  // ============================================================================
  // Search Methods
  // ============================================================================

  /**
   * Searches for plugins.
   * 
   * @param options - Search options
   * @returns Search results
   */
  public search(options: PluginSearchOptions = {}): PluginSearchResult {
    let results = Array.from(this.plugins.values());

    // Filter by query
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(p => 
        p.metadata.name.toLowerCase().includes(query) ||
        p.metadata.description.toLowerCase().includes(query) ||
        p.metadata.id.toLowerCase().includes(query) ||
        (p.metadata.keywords || []).some(k => k.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (options.category) {
      results = results.filter(p => p.metadata.category === options.category);
    }

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      results = results.filter(p => 
        p.metadata.category && options.categories!.includes(p.metadata.category)
      );
    }

    // Filter by author
    if (options.author) {
      const authorLower = options.author.toLowerCase();
      results = results.filter(p => {
        const authorName = typeof p.metadata.author === 'string' 
          ? p.metadata.author 
          : p.metadata.author.name;
        return authorName.toLowerCase().includes(authorLower);
      });
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(p => 
        options.tags!.some(tag => (p.tags || []).includes(tag))
      );
    }

    // Filter by status
    if (options.status) {
      results = results.filter(p => p.status === options.status);
    }

    // Filter by source type
    if (options.sourceType) {
      results = results.filter(p => p.sourceType === options.sourceType);
    }

    // Filter by verification
    if (options.verified !== undefined) {
      results = results.filter(p => p.verified === options.verified);
    }

    // Filter by rating
    if (options.minRating !== undefined) {
      results = results.filter(p => (p.rating || 0) >= options.minRating!);
    }

    // Sort results
    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'downloads':
          comparison = (a.downloads || 0) - (b.downloads || 0);
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'createdAt':
          comparison = a.registeredAt.getTime() - b.registeredAt.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = results.length;
    const offset = options.offset || 0;
    const limit = options.limit || total;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      plugins: paginatedResults,
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  /**
   * Finds plugins by name (fuzzy search).
   * 
   * @param name - The name to search for
   * @returns Array of matching plugins
   */
  public findByName(name: string): RegisteredPlugin[] {
    const query = name.toLowerCase();
    const results: RegisteredPlugin[] = [];

    for (const [pluginName, pluginId] of this.nameIndex) {
      if (pluginName.includes(query)) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
          results.push(plugin);
        }
      }
    }

    return results;
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  /**
   * Sets the status of a plugin.
   * 
   * @param pluginId - The plugin ID
   * @param status - The new status
   * @returns The updated plugin entry
   */
  public setStatus(pluginId: string, status: PluginRegistrationStatus): RegisteredPlugin {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    entry.status = status;
    entry.updatedAt = new Date();

    this.emit('statusChanged', { pluginId, status, entry });

    return entry;
  }

  /**
   * Verifies a plugin.
   * 
   * @param pluginId - The plugin ID
   * @returns The updated plugin entry
   */
  public verify(pluginId: string): RegisteredPlugin {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    entry.verified = true;
    entry.verifiedAt = new Date();
    entry.updatedAt = new Date();

    this.emit('verified', { pluginId, entry });

    return entry;
  }

  /**
   * Blacklists a plugin.
   * 
   * @param pluginId - The plugin ID
   * @param reason - Reason for blacklisting
   * @returns The updated plugin entry
   */
  public blacklist(pluginId: string, reason?: string): RegisteredPlugin {
    const entry = this.setStatus(pluginId, PluginRegistrationStatus.BLACKLISTED);
    
    this.emit('blacklisted', { pluginId, reason, entry });

    return entry;
  }

  // ============================================================================
  // Marketplace Integration
  // ============================================================================

  /**
   * Fetches available plugins from the marketplace.
   * 
   * @returns A promise that resolves with marketplace packages
   */
  public async fetchMarketplacePlugins(): Promise<MarketplacePackage[]> {
    if (!this.options.marketplaceUrl) {
      throw new Error('Marketplace URL not configured');
    }

    const cacheKey = 'marketplace:plugins';
    const cached = this.getCache<MarketplacePackage[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // In a real implementation, this would make an HTTP request
      // For now, return an empty array
      const packages: MarketplacePackage[] = [];
      
      this.setCache(cacheKey, packages);
      
      return packages;
    } catch (error) {
      this.emit('marketplaceError', { error });
      throw error;
    }
  }

  /**
   * Fetches plugin details from the marketplace.
   * 
   * @param packageId - The package ID
   * @returns A promise that resolves with package details
   */
  public async fetchPackageDetails(packageId: string): Promise<MarketplacePackage> {
    if (!this.options.marketplaceUrl) {
      throw new Error('Marketplace URL not configured');
    }

    const cacheKey = `marketplace:package:${packageId}`;
    const cached = this.getCache<MarketplacePackage>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // In a real implementation, this would make an HTTP request
      throw new Error('Not implemented');
    } catch (error) {
      this.emit('marketplaceError', { packageId, error });
      throw error;
    }
  }

  /**
   * Checks for plugin updates.
   * 
   * @param pluginId - The plugin ID (optional, checks all if not provided)
   * @returns A promise that resolves with update information
   */
  public async checkForUpdates(pluginId?: string): Promise<PluginUpdateInfo[]> {
    const pluginsToCheck = pluginId 
      ? [this.plugins.get(pluginId)].filter(Boolean) as RegisteredPlugin[]
      : Array.from(this.plugins.values());

    const updates: PluginUpdateInfo[] = [];

    for (const plugin of pluginsToCheck) {
      try {
        const updateInfo = await this.checkPluginUpdate(plugin);
        if (updateInfo) {
          updates.push(updateInfo);
        }
      } catch (error) {
        this.emit('updateCheckError', { pluginId: plugin.metadata.id, error });
      }
    }

    return updates;
  }

  /**
   * Checks for a single plugin update.
   * 
   * @param plugin - The registered plugin
   * @returns Update information or undefined
   */
  private async checkPluginUpdate(plugin: RegisteredPlugin): Promise<PluginUpdateInfo | undefined> {
    // In a real implementation, this would check the marketplace
    // For now, return undefined (no updates)
    return undefined;
  }

  /**
   * Starts auto-sync with the marketplace.
   */
  private startAutoSync(): void {
    if (this.syncIntervalHandle) {
      return;
    }

    this.syncIntervalHandle = setInterval(async () => {
      try {
        await this.syncWithMarketplace();
      } catch (error) {
        this.emit('syncError', { error });
      }
    }, this.options.syncInterval);
  }

  /**
   * Syncs with the marketplace.
   */
  public async syncWithMarketplace(): Promise<void> {
    if (!this.options.marketplaceUrl) {
      throw new Error('Marketplace URL not configured');
    }

    this.emit('syncStarted');

    try {
      const packages = await this.fetchMarketplacePlugins();
      
      // Update local registry with marketplace data
      for (const pkg of packages) {
        const existing = this.plugins.get(pkg.id);
        if (existing) {
          // Update existing entry
          this.update(pkg.id, {
            metadata: {
              ...existing.metadata,
              version: pkg.version,
              description: pkg.description
            },
            rating: pkg.rating,
            downloads: pkg.downloads
          });
        }
      }

      this.emit('syncCompleted', { packages: packages.length });
    } catch (error) {
      this.emit('syncError', { error });
      throw error;
    }
  }

  // ============================================================================
  // Review Management
  // ============================================================================

  /**
   * Adds a review to a plugin.
   * 
   * @param pluginId - The plugin ID
   * @param review - The review to add
   * @returns The updated plugin entry
   */
  public addReview(pluginId: string, review: Omit<PluginReview, 'id' | 'createdAt'>): RegisteredPlugin {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const newReview: PluginReview = {
      ...review,
      id: uuidv4(),
      createdAt: new Date()
    };

    if (!entry.reviews) {
      entry.reviews = [];
    }

    entry.reviews.push(newReview);

    // Update rating
    const totalRating = entry.reviews.reduce((sum, r) => sum + r.rating, 0);
    entry.rating = totalRating / entry.reviews.length;

    entry.updatedAt = new Date();

    this.emit('reviewAdded', { pluginId, review: newReview });

    return entry;
  }

  /**
   * Gets reviews for a plugin.
   * 
   * @param pluginId - The plugin ID
   * @returns Array of reviews
   */
  public getReviews(pluginId: string): PluginReview[] {
    const entry = this.plugins.get(pluginId);
    return entry?.reviews || [];
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Gets registry statistics.
   * 
   * @returns Registry statistics
   */
  public getStats(): RegistryStats {
    const plugins = Array.from(this.plugins.values());

    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter(p => p.status === PluginRegistrationStatus.ACTIVE).length,
      verifiedPlugins: plugins.filter(p => p.verified).length,
      pluginsByCategory: this.getCategoryCounts(),
      pluginsBySourceType: this.getSourceTypeCounts(),
      averageRating: this.calculateAverageRating(plugins),
      totalDownloads: plugins.reduce((sum, p) => sum + (p.downloads || 0), 0)
    };
  }

  /**
   * Gets category counts.
   * 
   * @returns Map of category to count
   */
  private getCategoryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const category of Object.values(PluginCategory)) {
      counts[category] = this.pluginsByCategory.get(category)?.size || 0;
    }

    return counts;
  }

  /**
   * Gets source type counts.
   * 
   * @returns Map of source type to count
   */
  private getSourceTypeCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const plugin of this.plugins.values()) {
      counts[plugin.sourceType] = (counts[plugin.sourceType] || 0) + 1;
    }

    return counts;
  }

  /**
   * Calculates average rating.
   * 
   * @param plugins - Array of plugins
   * @returns Average rating
   */
  private calculateAverageRating(plugins: RegisteredPlugin[]): number {
    const ratedPlugins = plugins.filter(p => p.rating !== undefined);
    if (ratedPlugins.length === 0) {
      return 0;
    }

    const totalRating = ratedPlugins.reduce((sum, p) => sum + (p.rating || 0), 0);
    return totalRating / ratedPlugins.length;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validates plugin metadata.
   * 
   * @param metadata - The metadata to validate
   * @throws Error if validation fails
   */
  private validateMetadata(metadata: PluginMetadata): void {
    if (!metadata.id) {
      throw new Error('Plugin ID is required');
    }

    if (!metadata.name) {
      throw new Error('Plugin name is required');
    }

    if (!metadata.version) {
      throw new Error('Plugin version is required');
    }

    if (!metadata.description) {
      throw new Error('Plugin description is required');
    }

    if (!metadata.author) {
      throw new Error('Plugin author is required');
    }

    // Validate ID format (reverse domain notation)
    const idPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    if (!idPattern.test(metadata.id)) {
      throw new Error(`Invalid plugin ID format: ${metadata.id}. Use reverse domain notation (e.g., com.example.plugin)`);
    }

    // Validate version format (semver)
    const versionPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9._-]+)?(\+[a-zA-Z0-9._-]+)?$/;
    if (!versionPattern.test(metadata.version)) {
      throw new Error(`Invalid version format: ${metadata.version}. Use semantic versioning (e.g., 1.0.0)`);
    }
  }

  /**
   * Gets a cached value.
   * 
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  private getCache<T>(key: string): T | undefined {
    if (!this.options.enableCache) {
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Sets a cached value.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   */
  private setCache<T>(key: string, value: T): void {
    if (!this.options.enableCache) {
      return;
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (this.options.cacheTtl || 5 * 60 * 1000)
    });
  }

  /**
   * Loads registry data from storage.
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.options.storage) {
      return;
    }

    try {
      const data = await this.options.storage.get<{
        plugins: RegisteredPlugin[];
      }>('registry:data');

      if (data && data.plugins) {
        for (const plugin of data.plugins) {
          // Convert date strings back to Date objects
          plugin.registeredAt = new Date(plugin.registeredAt);
          plugin.updatedAt = new Date(plugin.updatedAt);
          if (plugin.verifiedAt) {
            plugin.verifiedAt = new Date(plugin.verifiedAt);
          }
          if (plugin.reviews) {
            for (const review of plugin.reviews) {
              review.createdAt = new Date(review.createdAt);
              if (review.updatedAt) {
                review.updatedAt = new Date(review.updatedAt);
              }
            }
          }

          this.register(plugin.metadata, plugin.source, plugin.sourceType, plugin);
        }
      }
    } catch (error) {
      this.emit('storageError', { operation: 'load', error });
    }
  }

  /**
   * Saves registry data to storage.
   */
  private async saveToStorage(): Promise<void> {
    if (!this.options.storage) {
      return;
    }

    try {
      const data = {
        plugins: Array.from(this.plugins.values())
      };

      await this.options.storage.set('registry:data', data);
    } catch (error) {
      this.emit('storageError', { operation: 'save', error });
    }
  }
}

/**
 * Registry statistics interface
 */
export interface RegistryStats {
  totalPlugins: number;
  activePlugins: number;
  verifiedPlugins: number;
  pluginsByCategory: Record<string, number>;
  pluginsBySourceType: Record<string, number>;
  averageRating: number;
  totalDownloads: number;
}

export default PluginRegistry;
