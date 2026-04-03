/**
 * Model Context Protocol (MCP) Resources Manager
 * 
 * This module provides resource registration, management, and retrieval
 * capabilities for MCP servers. Supports both static resources and
 * resource templates with parameter substitution.
 */

import { EventEmitter } from 'events';
import {
  Resource,
  ResourceTemplate,
  TextResourceContents,
  BlobResourceContents,
  ResourceDefinition,
  ResourceTemplateDefinition,
  MCP_ERROR_CODES,
} from '../types';

/**
 * Resource read context
 */
export interface ResourceReadContext {
  clientId?: string;
}

/**
 * Resource read error
 */
export class ResourceReadError extends Error {
  constructor(
    message: string,
    public readonly resourceUri: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ResourceReadError';
  }
}

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends Error {
  constructor(uri: string) {
    super(`Resource not found: ${uri}`);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Resource template not found error
 */
export class ResourceTemplateNotFoundError extends Error {
  constructor(template: string) {
    super(`Resource template not found: ${template}`);
    this.name = 'ResourceTemplateNotFoundError';
  }
}

/**
 * Invalid resource URI error
 */
export class InvalidResourceUriError extends Error {
  constructor(uri: string, reason: string) {
    super(`Invalid resource URI '${uri}': ${reason}`);
    this.name = 'InvalidResourceUriError';
  }
}

/**
 * Resources Manager
 * 
 * Manages resource registration and retrieval for MCP servers.
 * Supports both static resources and URI templates.
 */
export class ResourcesManager extends EventEmitter {
  private _resources = new Map<string, ResourceDefinition>();
  private _templates = new Map<string, ResourceTemplateDefinition>();
  private _subscriptions = new Map<string, Set<string>>(); // uri -> clientIds
  private _isDisposed = false;

  /**
   * Get all registered resources
   */
  get resources(): Resource[] {
    return this.listResources();
  }

  /**
   * Get all registered resource templates
   */
  get templates(): ResourceTemplate[] {
    return this.listResourceTemplates();
  }

  /**
   * Get number of registered resources
   */
  get resourceCount(): number {
    return this._resources.size;
  }

  /**
   * Get number of registered templates
   */
  get templateCount(): number {
    return this._templates.size;
  }

  /**
   * Get number of active subscriptions
   */
  get subscriptionCount(): number {
    let count = 0;
    for (const clientIds of this._subscriptions.values()) {
      count += clientIds.size;
    }
    return count;
  }

  /**
   * Check if the manager has any resources
   */
  hasResources(): boolean {
    return this._resources.size > 0 || this._templates.size > 0;
  }

  /**
   * Check if a resource is registered
   */
  hasResource(uri: string): boolean {
    return this._resources.has(uri);
  }

  /**
   * Check if a resource template is registered
   */
  hasTemplate(uriTemplate: string): boolean {
    return this._templates.has(uriTemplate);
  }

  /**
   * Register a static resource
   */
  registerResource(resource: ResourceDefinition): void {
    this.ensureNotDisposed();

    if (this._resources.has(resource.uri)) {
      throw new Error(`Resource with URI '${resource.uri}' is already registered`);
    }

    // Validate URI
    if (!this.isValidUri(resource.uri)) {
      throw new InvalidResourceUriError(resource.uri, 'URI must be a valid URI string');
    }

    this._resources.set(resource.uri, resource);
    this.emit('resourceRegistered', resource.uri);
    this.emit('resourcesChanged');
  }

  /**
   * Register a resource template
   */
  registerResourceTemplate(template: ResourceTemplateDefinition): void {
    this.ensureNotDisposed();

    if (this._templates.has(template.uriTemplate)) {
      throw new Error(`Resource template '${template.uriTemplate}' is already registered`);
    }

    // Validate template
    if (!this.isValidTemplate(template.uriTemplate)) {
      throw new Error(`Invalid resource template: '${template.uriTemplate}'`);
    }

    this._templates.set(template.uriTemplate, template);
    this.emit('templateRegistered', template.uriTemplate);
    this.emit('resourcesChanged');
  }

  /**
   * Unregister a resource
   */
  unregisterResource(uri: string): boolean {
    this.ensureNotDisposed();

    const deleted = this._resources.delete(uri);
    if (deleted) {
      // Clear subscriptions for this resource
      this._subscriptions.delete(uri);
      this.emit('resourceUnregistered', uri);
      this.emit('resourcesChanged');
    }
    return deleted;
  }

  /**
   * Unregister a resource template
   */
  unregisterResourceTemplate(uriTemplate: string): boolean {
    this.ensureNotDisposed();

    const deleted = this._templates.delete(uriTemplate);
    if (deleted) {
      this.emit('templateUnregistered', uriTemplate);
      this.emit('resourcesChanged');
    }
    return deleted;
  }

  /**
   * Get a resource definition
   */
  getResource(uri: string): ResourceDefinition | undefined {
    return this._resources.get(uri);
  }

  /**
   * Get a resource template definition
   */
  getTemplate(uriTemplate: string): ResourceTemplateDefinition | undefined {
    return this._templates.get(uriTemplate);
  }

  /**
   * List all registered resources in MCP format
   */
  listResources(): Resource[] {
    const resources: Resource[] = [];

    for (const [uri, resource] of this._resources) {
      resources.push({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      });
    }

    return resources;
  }

  /**
   * List all registered resource templates in MCP format
   */
  listResourceTemplates(): ResourceTemplate[] {
    const templates: ResourceTemplate[] = [];

    for (const [uriTemplate, template] of this._templates) {
      templates.push({
        uriTemplate: template.uriTemplate,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
      });
    }

    return templates;
  }

  /**
   * Read a resource by URI
   */
  async readResource(
    uri: string,
    context: ResourceReadContext = {}
  ): Promise<TextResourceContents | BlobResourceContents> {
    this.ensureNotDisposed();

    // First, try to find a static resource
    const resource = this._resources.get(uri);
    if (resource) {
      try {
        return await resource.handler();
      } catch (error) {
        throw new ResourceReadError(
          `Failed to read resource '${uri}': ${error instanceof Error ? error.message : String(error)}`,
          uri,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Try to match against templates
    const templateMatch = this.matchTemplate(uri);
    if (templateMatch) {
      try {
        return await templateMatch.template.handler(templateMatch.params);
      } catch (error) {
        throw new ResourceReadError(
          `Failed to read resource '${uri}': ${error instanceof Error ? error.message : String(error)}`,
          uri,
          error instanceof Error ? error : undefined
        );
      }
    }

    throw new ResourceNotFoundError(uri);
  }

  /**
   * Match a URI against registered templates
   */
  private matchTemplate(uri: string): { template: ResourceTemplateDefinition; params: Record<string, string> } | null {
    for (const [uriTemplate, template] of this._templates) {
      const params = this.extractTemplateParams(uri, uriTemplate);
      if (params !== null) {
        return { template, params };
      }
    }
    return null;
  }

  /**
   * Extract parameters from a URI using a template
   * 
   * Template format: scheme://path/{param1}/fixed/{param2}
   */
  private extractTemplateParams(uri: string, template: string): Record<string, string> | null {
    // Convert template to regex pattern
    const paramNames: string[] = [];
    const pattern = template.replace(/\{([^}]+)\}/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${pattern}$`);
    const match = uri.match(regex);

    if (!match) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = decodeURIComponent(match[i + 1]);
    }

    return params;
  }

  /**
   * Subscribe a client to resource updates
   */
  subscribe(clientId: string, uri: string): void {
    this.ensureNotDisposed();

    if (!this._subscriptions.has(uri)) {
      this._subscriptions.set(uri, new Set());
    }

    this._subscriptions.get(uri)!.add(clientId);
    this.emit('subscribed', { clientId, uri });
  }

  /**
   * Unsubscribe a client from resource updates
   */
  unsubscribe(clientId: string, uri: string): boolean {
    this.ensureNotDisposed();

    const subscribers = this._subscriptions.get(uri);
    if (!subscribers) {
      return false;
    }

    const removed = subscribers.delete(clientId);
    if (removed) {
      this.emit('unsubscribed', { clientId, uri });

      // Clean up empty subscription sets
      if (subscribers.size === 0) {
        this._subscriptions.delete(uri);
      }
    }

    return removed;
  }

  /**
   * Unsubscribe a client from all resources
   */
  unsubscribeAll(clientId: string): void {
    for (const [uri, subscribers] of this._subscriptions) {
      if (subscribers.has(clientId)) {
        this.unsubscribe(clientId, uri);
      }
    }
  }

  /**
   * Get subscribers for a resource
   */
  getSubscribers(uri: string): string[] {
    const subscribers = this._subscriptions.get(uri);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Check if a resource has subscribers
   */
  hasSubscribers(uri: string): boolean {
    const subscribers = this._subscriptions.get(uri);
    return subscribers !== undefined && subscribers.size > 0;
  }

  /**
   * Notify subscribers that a resource has been updated
   */
  async updateResource(uri: string): Promise<void> {
    this.ensureNotDisposed();

    if (this.hasSubscribers(uri)) {
      this.emit('resourceUpdated', uri);
    }
  }

  /**
   * Validate URI format
   */
  private isValidUri(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      // Allow relative URIs (like file://path/to/file)
      return uri.includes('://') || uri.startsWith('/');
    }
  }

  /**
   * Validate template format
   */
  private isValidTemplate(template: string): boolean {
    // Template should have at least one parameter
    return template.includes('{') && template.includes('}');
  }

  /**
   * Create a text resource content
   */
  static createTextContent(uri: string, text: string, mimeType?: string): TextResourceContents {
    return {
      uri,
      mimeType,
      text,
    };
  }

  /**
   * Create a blob resource content
   */
  static createBlobContent(uri: string, blob: string, mimeType?: string): BlobResourceContents {
    return {
      uri,
      mimeType,
      blob,
    };
  }

  /**
   * Create a blob resource content from a Buffer
   */
  static createBlobContentFromBuffer(
    uri: string,
    buffer: Buffer,
    mimeType?: string
  ): BlobResourceContents {
    return {
      uri,
      mimeType,
      blob: buffer.toString('base64'),
    };
  }

  /**
   * Ensure manager is not disposed
   */
  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('ResourcesManager has been disposed');
    }
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._resources.clear();
    this._templates.clear();
    this._subscriptions.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a resources manager instance
 */
export function createResourcesManager(): ResourcesManager {
  return new ResourcesManager();
}

/**
 * Helper function to create a resource definition
 */
export function defineResource(
  uri: string,
  name: string,
  handler: () => Promise<TextResourceContents | BlobResourceContents>,
  options: { description?: string; mimeType?: string } = {}
): ResourceDefinition {
  return {
    uri,
    name,
    description: options.description,
    mimeType: options.mimeType,
    handler,
  };
}

/**
 * Helper function to create a resource template definition
 */
export function defineResourceTemplate(
  uriTemplate: string,
  name: string,
  handler: (params: Record<string, string>) => Promise<TextResourceContents | BlobResourceContents>,
  options: { description?: string; mimeType?: string } = {}
): ResourceTemplateDefinition {
  return {
    uriTemplate,
    name,
    description: options.description,
    mimeType: options.mimeType,
    handler,
  };
}

/**
 * Common resource helpers
 */
export const ResourceHelpers = {
  /**
   * Create a file resource
   */
  createFileResource(
    uri: string,
    name: string,
    readFile: () => Promise<string>,
    mimeType?: string
  ): ResourceDefinition {
    return defineResource(
      uri,
      name,
      async () => ResourcesManager.createTextContent(uri, await readFile(), mimeType),
      { mimeType }
    );
  },

  /**
   * Create a JSON resource
   */
  createJsonResource<T>(
    uri: string,
    name: string,
    getData: () => Promise<T>
  ): ResourceDefinition {
    return defineResource(
      uri,
      name,
      async () => {
        const data = await getData();
        return ResourcesManager.createTextContent(
          uri,
          JSON.stringify(data, null, 2),
          'application/json'
        );
      },
      { mimeType: 'application/json' }
    );
  },

  /**
   * Create a text file resource template
   */
  createTextFileTemplate(
    uriTemplate: string,
    name: string,
    readFile: (path: string) => Promise<string>
  ): ResourceTemplateDefinition {
    return defineResourceTemplate(
      uriTemplate,
      name,
      async (params) => {
        const path = params.path || params.file || Object.values(params)[0];
        if (!path) {
          throw new Error('No path parameter provided');
        }
        const content = await readFile(path);
        return ResourcesManager.createTextContent(
          uriTemplate.replace(/\{[^}]+\}/g, path),
          content,
          'text/plain'
        );
      },
      { mimeType: 'text/plain' }
    );
  },

  /**
   * Create a directory listing resource template
   */
  createDirectoryTemplate(
    uriTemplate: string,
    name: string,
    listDirectory: (path: string) => Promise<Array<{ name: string; type: string }>>
  ): ResourceTemplateDefinition {
    return defineResourceTemplate(
      uriTemplate,
      name,
      async (params) => {
        const path = params.path || Object.values(params)[0];
        if (!path) {
          throw new Error('No path parameter provided');
        }
        const entries = await listDirectory(path);
        const content = entries.map((e) => `${e.type}: ${e.name}`).join('\n');
        return ResourcesManager.createTextContent(
          uriTemplate.replace(/\{[^}]+\}/g, path),
          content,
          'text/plain'
        );
      },
      { mimeType: 'text/plain' }
    );
  },
};
