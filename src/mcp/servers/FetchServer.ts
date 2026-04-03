/**
 * Model Context Protocol (MCP) Fetch Server
 * 
 * This module provides a built-in MCP server that exposes HTTP fetching
 * capabilities as MCP tools. Supports GET, POST, PUT, DELETE and other
 * HTTP methods with configurable restrictions.
 */

import { z } from 'zod';
import { MCPServer, MCPServerOptions, createMCPServer } from '../MCPServer';
import { FetchConfig, FetchResult } from '../types';
import { ToolsManager } from '../features/ToolsManager';

/**
 * Fetch server options
 */
export interface FetchServerOptions extends MCPServerOptions {
  fetch: FetchConfig;
}

/**
 * HTTP method
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Fetch request options
 */
export interface FetchRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * Fetch Server
 * 
 * An MCP server that provides HTTP fetching capabilities through tools.
 */
export class FetchServer {
  private _server: MCPServer;
  private _config: Required<FetchConfig>;
  private _isRunning = false;

  constructor(options: FetchServerOptions) {
    this._config = {
      allowedDomains: options.fetch.allowedDomains ?? [],
      blockedDomains: options.fetch.blockedDomains ?? [],
      allowedProtocols: options.fetch.allowedProtocols ?? ['http:', 'https:'],
      maxResponseSize: options.fetch.maxResponseSize ?? 10 * 1024 * 1024, // 10MB
      timeout: options.fetch.timeout ?? 30000, // 30 seconds
      followRedirects: options.fetch.followRedirects ?? true,
      defaultHeaders: options.fetch.defaultHeaders ?? {
        'User-Agent': 'MCP-Fetch-Server/1.0',
      },
    };

    this._server = createMCPServer({
      name: options.name,
      version: options.version,
      capabilities: {
        ...options.capabilities,
        tools: { listChanged: true },
      },
      instructions: options.instructions ?? this.getDefaultInstructions(),
    });

    this.registerTools();
  }

  /**
   * Get the underlying MCP server
   */
  get server(): MCPServer {
    return this._server;
  }

  /**
   * Get fetch configuration
   */
  get config(): FetchConfig {
    return { ...this._config };
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get default server instructions
   */
  private getDefaultInstructions(): string {
    return `Fetch Server

This server provides HTTP fetching capabilities through MCP tools.

Configuration:
- Allowed protocols: ${this._config.allowedProtocols.join(', ')}
- Max response size: ${this._config.maxResponseSize} bytes
- Request timeout: ${this._config.timeout}ms
- Follow redirects: ${this._config.followRedirects}

${this._config.allowedDomains.length > 0 ? `Allowed domains:\n${this._config.allowedDomains.map((d) => `  - ${d}`).join('\n')}` : 'All domains allowed (except blocked)'}

${this._config.blockedDomains.length > 0 ? `Blocked domains:\n${this._config.blockedDomains.map((d) => `  - ${d}`).join('\n')}` : ''}

Available tools:
- fetch: Make an HTTP request to a URL
- fetch_get: Make a GET request to a URL
- fetch_post: Make a POST request to a URL
- fetch_json: Fetch JSON data from a URL`;
  }

  // ========================================================================
  // URL Validation
  // ========================================================================

  /**
   * Validate that a URL is allowed
   */
  private validateUrl(urlString: string): { valid: boolean; error?: string } {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check protocol
    if (!this._config.allowedProtocols.includes(url.protocol)) {
      return {
        valid: false,
        error: `Protocol '${url.protocol}' is not allowed. Allowed: ${this._config.allowedProtocols.join(', ')}`,
      };
    }

    // Check blocked domains
    const hostname = url.hostname.toLowerCase();
    for (const blocked of this._config.blockedDomains) {
      if (hostname === blocked.toLowerCase() || hostname.endsWith(`.${blocked.toLowerCase()}`)) {
        return { valid: false, error: `Domain '${hostname}' is blocked` };
      }
    }

    // Check allowed domains (if specified)
    if (this._config.allowedDomains.length > 0) {
      const isAllowed = this._config.allowedDomains.some(
        (allowed) =>
          hostname === allowed.toLowerCase() || hostname.endsWith(`.${allowed.toLowerCase()}`)
      );
      if (!isAllowed) {
        return {
          valid: false,
          error: `Domain '${hostname}' is not in the allowed list`,
        };
      }
    }

    return { valid: true };
  }

  // ========================================================================
  // Tool Registration
  // ========================================================================

  /**
   * Register all fetch tools
   */
  private registerTools(): void {
    // Generic fetch tool
    this._server.registerTool(
      {
        name: 'fetch',
        description: 'Make an HTTP request to a URL.',
        parameters: z.object({
          url: z.string().describe('The URL to fetch'),
          method: z
            .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
            .optional()
            .describe('HTTP method'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
          body: z.string().optional().describe('Request body'),
        }),
      },
      async (args) => {
        const { url, method, headers, body } = args as {
          url: string;
          method?: HttpMethod;
          headers?: Record<string, string>;
          body?: string;
        };

        const validation = this.validateUrl(url);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const result = await this.fetch(url, { method, headers, body });
          return this.formatResult(result);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // GET tool
    this._server.registerTool(
      {
        name: 'fetch_get',
        description: 'Make a GET request to a URL.',
        parameters: z.object({
          url: z.string().describe('The URL to fetch'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
        }),
      },
      async (args) => {
        const { url, headers } = args as { url: string; headers?: Record<string, string> };

        const validation = this.validateUrl(url);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const result = await this.fetch(url, { method: 'GET', headers });
          return this.formatResult(result);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // POST tool
    this._server.registerTool(
      {
        name: 'fetch_post',
        description: 'Make a POST request to a URL.',
        parameters: z.object({
          url: z.string().describe('The URL to fetch'),
          body: z.string().describe('Request body'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
        }),
      },
      async (args) => {
        const { url, body, headers } = args as {
          url: string;
          body: string;
          headers?: Record<string, string>;
        };

        const validation = this.validateUrl(url);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const result = await this.fetch(url, { method: 'POST', headers, body });
          return this.formatResult(result);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // JSON fetch tool
    this._server.registerTool(
      {
        name: 'fetch_json',
        description: 'Fetch JSON data from a URL. Automatically parses and formats JSON responses.',
        parameters: z.object({
          url: z.string().describe('The URL to fetch'),
          method: z
            .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
            .optional()
            .describe('HTTP method'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
          body: z.string().optional().describe('Request body (JSON string)'),
        }),
      },
      async (args) => {
        const { url, method, headers, body } = args as {
          url: string;
          method?: HttpMethod;
          headers?: Record<string, string>;
          body?: string;
        };

        const validation = this.validateUrl(url);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const jsonHeaders = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...headers,
          };
          const result = await this.fetch(url, { method: method ?? 'GET', headers: jsonHeaders, body });

          // Try to parse and format JSON
          try {
            const json = JSON.parse(result.body);
            return ToolsManager.createTextResult(JSON.stringify(json, null, 2));
          } catch {
            // Not valid JSON, return as-is
            return this.formatResult(result);
          }
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // HTML fetch tool
    this._server.registerTool(
      {
        name: 'fetch_html',
        description: 'Fetch HTML content from a URL and extract text.',
        parameters: z.object({
          url: z.string().describe('The URL to fetch'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
        }),
      },
      async (args) => {
        const { url, headers } = args as { url: string; headers?: Record<string, string> };

        const validation = this.validateUrl(url);
        if (!validation.valid) {
          return ToolsManager.createErrorResult(validation.error!);
        }

        try {
          const htmlHeaders = {
            Accept: 'text/html,application/xhtml+xml',
            ...headers,
          };
          const result = await this.fetch(url, { method: 'GET', headers: htmlHeaders });

          // Simple HTML to text conversion
          const text = this.htmlToText(result.body);
          return ToolsManager.createTextResult(text);
        } catch (error) {
          return ToolsManager.createErrorResult(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  // ========================================================================
  // Fetch Operations
  // ========================================================================

  /**
   * Perform an HTTP fetch
   */
  private async fetch(url: string, options: FetchRequestOptions = {}): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._config.timeout);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          ...this._config.defaultHeaders,
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
        redirect: this._config.followRedirects ? 'follow' : 'manual',
      });

      clearTimeout(timeoutId);

      // Check response size
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > this._config.maxResponseSize) {
        throw new FetchServerError(
          `Response too large: ${contentLength} bytes (max: ${this._config.maxResponseSize})`,
          'RESPONSE_TOO_LARGE'
        );
      }

      // Read response body
      const body = await response.text();

      // Check actual body size
      if (body.length > this._config.maxResponseSize) {
        throw new FetchServerError(
          `Response body too large: ${body.length} bytes (max: ${this._config.maxResponseSize})`,
          'RESPONSE_TOO_LARGE'
        );
      }

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        contentType: response.headers.get('content-type') ?? undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FetchServerError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new FetchServerError(
          `Request timeout after ${this._config.timeout}ms`,
          'REQUEST_TIMEOUT'
        );
      }

      throw new FetchServerError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Format fetch result as tool result
   */
  private formatResult(result: FetchResult): ReturnType<typeof ToolsManager.createTextResult> {
    const headerText = Object.entries(result.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const formatted = `Status: ${result.status} ${result.statusText}
Content-Type: ${result.contentType || 'unknown'}

Headers:
${headerText}

Body:
${result.body}`;

    return ToolsManager.createTextResult(formatted);
  }

  /**
   * Simple HTML to text conversion
   */
  private htmlToText(html: string): string {
    // Remove script and style elements
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Replace common block elements with newlines
    text = text.replace(/<\/(div|p|h[1-6]|li|tr)>/gi, '\n');
    text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');

    // Replace remaining tags with spaces
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Normalize newlines
    text = text.replace(/\n\s*\n/g, '\n\n');

    return text;
  }

  // ========================================================================
  // Server Lifecycle
  // ========================================================================

  /**
   * Start the server with a transport
   */
  async start(transport: import('../MCPTransport').MCPTransport): Promise<void> {
    await this._server.start(transport);
    this._isRunning = true;
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this._server.stop();
    this._isRunning = false;
  }

  /**
   * Dispose of the server
   */
  async dispose(): Promise<void> {
    await this._server.dispose();
    this._isRunning = false;
  }
}

/**
 * Create a fetch server instance
 */
export function createFetchServer(
  name: string,
  version: string,
  config: FetchConfig
): FetchServer {
  return new FetchServer({
    name,
    version,
    fetch: config,
  });
}

/**
 * Fetch server error
 */
export class FetchServerError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'FetchServerError';
  }
}

/**
 * URL not allowed error
 */
export class UrlNotAllowedError extends FetchServerError {
  constructor(url: string, reason: string) {
    super(`URL not allowed: ${url} - ${reason}`, 'URL_NOT_ALLOWED');
    this.name = 'UrlNotAllowedError';
  }
}

/**
 * Protocol not allowed error
 */
export class ProtocolNotAllowedError extends FetchServerError {
  constructor(protocol: string) {
    super(`Protocol not allowed: ${protocol}`, 'PROTOCOL_NOT_ALLOWED');
    this.name = 'ProtocolNotAllowedError';
  }
}

/**
 * Domain blocked error
 */
export class DomainBlockedError extends FetchServerError {
  constructor(domain: string) {
    super(`Domain blocked: ${domain}`, 'DOMAIN_BLOCKED');
    this.name = 'DomainBlockedError';
  }
}

/**
 * Response too large error
 */
export class ResponseTooLargeError extends FetchServerError {
  constructor(size: number, maxSize: number) {
    super(`Response too large: ${size} bytes (max: ${maxSize})`, 'RESPONSE_TOO_LARGE');
    this.name = 'ResponseTooLargeError';
  }
}

/**
 * Request timeout error
 */
export class RequestTimeoutError extends FetchServerError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`, 'REQUEST_TIMEOUT');
    this.name = 'RequestTimeoutError';
  }
}
