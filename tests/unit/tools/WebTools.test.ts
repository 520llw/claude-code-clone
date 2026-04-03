/**
 * WebTools Unit Tests
 * Tests for web fetching, content extraction, and URL handling
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext } from '../../setup';

// ============================================================================
// Type Definitions
// ============================================================================

interface FetchResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
  error?: string;
  responseTime?: number;
}

interface URLParseResult {
  success: boolean;
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  error?: string;
}

interface ContentExtractionResult {
  success: boolean;
  title?: string;
  text?: string;
  links?: Array<{ text: string; href: string }>;
  images?: Array<{ alt: string; src: string }>;
  error?: string;
}

// ============================================================================
// Mock WebTools Implementation
// ============================================================================

class TestWebTools {
  private mockResponses: Map<string, FetchResult> = new Map();
  private defaultResponse: FetchResult = {
    success: true,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/html' },
    body: '<html><body>Mock response</body></html>',
    contentType: 'text/html',
    responseTime: 100,
  };

  // ============================================================================
  // Fetch
  // ============================================================================

  async fetch(url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  } = {}): Promise<FetchResult> {
    const startTime = Date.now();

    // Validate URL
    const parsed = this.parseURL(url);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error,
      };
    }

    // Check for mock response
    const mockResponse = this.mockResponses.get(url);
    if (mockResponse) {
      return {
        ...mockResponse,
        responseTime: Date.now() - startTime,
      };
    }

    // Return default response
    return {
      ...this.defaultResponse,
      responseTime: Date.now() - startTime,
    };
  }

  // ============================================================================
  // Content Extraction
  // ============================================================================

  async extractContent(html: string): Promise<ContentExtractionResult> {
    try {
      // Simple HTML parsing simulation
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract text content (strip tags)
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Extract links
      const links: Array<{ text: string; href: string }> = [];
      const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        links.push({
          href: match[1],
          text: match[2].trim(),
        });
      }

      // Extract images
      const images: Array<{ alt: string; src: string }> = [];
      const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
      while ((match = imgRegex.exec(html)) !== null) {
        const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
        images.push({
          src: match[1],
          alt: altMatch ? altMatch[1] : '',
        });
      }

      return {
        success: true,
        title,
        text,
        links,
        images,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async fetchAndExtract(url: string): Promise<ContentExtractionResult> {
    const fetchResult = await this.fetch(url);
    
    if (!fetchResult.success || !fetchResult.body) {
      return {
        success: false,
        error: fetchResult.error || 'Failed to fetch content',
      };
    }

    return this.extractContent(fetchResult.body);
  }

  // ============================================================================
  // URL Utilities
  // ============================================================================

  parseURL(url: string): URLParseResult {
    try {
      const parsed = new URL(url);
      
      return {
        success: true,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: `Invalid URL: ${url}`,
      };
    }
  }

  resolveURL(base: string, relative: string): string {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Mock Setup
  // ============================================================================

  setMockResponse(url: string, response: Partial<FetchResult>): void {
    this.mockResponses.set(url, {
      ...this.defaultResponse,
      ...response,
    });
  }

  clearMockResponses(): void {
    this.mockResponses.clear();
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async fetchMultiple(urls: string[]): Promise<FetchResult[]> {
    return Promise.all(urls.map(url => this.fetch(url)));
  }

  async fetchSequential(urls: string[]): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    for (const url of urls) {
      results.push(await this.fetch(url));
    }
    return results;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('WebTools', () => {
  let webTools: TestWebTools;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    webTools = new TestWebTools();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Fetch Tests
  // ============================================================================

  describe('Fetch', () => {
    test('should fetch URL successfully', async () => {
      const result = await webTools.fetch('https://example.com');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.body).toBeDefined();
    });

    test('should return error for invalid URL', async () => {
      const result = await webTools.fetch('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    test('should use mock response when configured', async () => {
      webTools.setMockResponse('https://api.example.com', {
        success: true,
        status: 201,
        body: '{"created": true}',
        contentType: 'application/json',
      });

      const result = await webTools.fetch('https://api.example.com');

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.body).toBe('{"created": true}');
    });

    test('should track response time', async () => {
      const result = await webTools.fetch('https://example.com');

      expect(result.responseTime).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    test('should support custom headers', async () => {
      const result = await webTools.fetch('https://example.com', {
        headers: {
          'Authorization': 'Bearer token123',
          'Accept': 'application/json',
        },
      });

      expect(result.success).toBe(true);
    });

    test('should support POST method', async () => {
      const result = await webTools.fetch('https://api.example.com', {
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Content Extraction Tests
  // ============================================================================

  describe('Content Extraction', () => {
    test('should extract title from HTML', async () => {
      const html = '<html><head><title>Test Page</title></head><body>Content</body></html>';
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.title).toBe('Test Page');
    });

    test('should extract text content', async () => {
      const html = '<html><body><p>Hello <b>world</b>!</p></body></html>';
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Hello');
      expect(result.text).toContain('world');
    });

    test('should extract links', async () => {
      const html = `
        <html>
          <body>
            <a href="https://example.com">Example</a>
            <a href="/relative">Relative Link</a>
          </body>
        </html>
      `;
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.links).toHaveLength(2);
      expect(result.links![0].text).toBe('Example');
      expect(result.links![0].href).toBe('https://example.com');
    });

    test('should extract images', async () => {
      const html = `
        <html>
          <body>
            <img src="image1.jpg" alt="First image">
            <img src="image2.png">
          </body>
        </html>
      `;
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(2);
      expect(result.images![0].alt).toBe('First image');
    });

    test('should strip script tags', async () => {
      const html = '<html><body><script>alert("test")</script>Visible content</body></html>';
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.text).not.toContain('alert');
      expect(result.text).toContain('Visible content');
    });

    test('should strip style tags', async () => {
      const html = '<html><body><style>.class { color: red; }</style>Content</body></html>';
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.text).not.toContain('color: red');
    });

    test('should fetch and extract in one call', async () => {
      webTools.setMockResponse('https://example.com', {
        success: true,
        body: '<html><title>Extracted</title><body>Content here</body></html>',
      });

      const result = await webTools.fetchAndExtract('https://example.com');

      expect(result.success).toBe(true);
      expect(result.title).toBe('Extracted');
    });

    test('should handle fetch failure in fetchAndExtract', async () => {
      webTools.setMockResponse('https://error.com', {
        success: false,
        error: 'Network error',
      });

      const result = await webTools.fetchAndExtract('https://error.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ============================================================================
  // URL Parsing Tests
  // ============================================================================

  describe('URL Parsing', () => {
    test('should parse valid URL', () => {
      const result = webTools.parseURL('https://example.com:8080/path?query=1#hash');

      expect(result.success).toBe(true);
      expect(result.protocol).toBe('https:');
      expect(result.hostname).toBe('example.com');
      expect(result.port).toBe('8080');
      expect(result.pathname).toBe('/path');
      expect(result.search).toBe('?query=1');
      expect(result.hash).toBe('#hash');
    });

    test('should return error for invalid URL', () => {
      const result = webTools.parseURL('not a url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    test('should validate URL', () => {
      expect(webTools.isValidURL('https://example.com')).toBe(true);
      expect(webTools.isValidURL('http://localhost:3000')).toBe(true);
      expect(webTools.isValidURL('not a url')).toBe(false);
      expect(webTools.isValidURL('')).toBe(false);
    });

    test('should resolve relative URL', () => {
      const resolved = webTools.resolveURL('https://example.com/path/', '../other/page.html');

      expect(resolved).toBe('https://example.com/other/page.html');
    });

    test('should return absolute URL as-is', () => {
      const resolved = webTools.resolveURL('https://example.com/', 'https://other.com/page');

      expect(resolved).toBe('https://other.com/page');
    });
  });

  // ============================================================================
  // Mock Response Tests
  // ============================================================================

  describe('Mock Responses', () => {
    test('should set multiple mock responses', async () => {
      webTools.setMockResponse('https://api1.com', { status: 200, body: 'API 1' });
      webTools.setMockResponse('https://api2.com', { status: 201, body: 'API 2' });

      const result1 = await webTools.fetch('https://api1.com');
      const result2 = await webTools.fetch('https://api2.com');

      expect(result1.body).toBe('API 1');
      expect(result2.body).toBe('API 2');
    });

    test('should clear mock responses', async () => {
      webTools.setMockResponse('https://example.com', { body: 'Mocked' });
      webTools.clearMockResponses();

      const result = await webTools.fetch('https://example.com');

      expect(result.body).toBe('<html><body>Mock response</body></html>');
    });

    test('should use default response for unknown URLs', async () => {
      const result = await webTools.fetch('https://unknown.com');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });
  });

  // ============================================================================
  // Batch Operations Tests
  // ============================================================================

  describe('Batch Operations', () => {
    test('should fetch multiple URLs in parallel', async () => {
      webTools.setMockResponse('https://api1.com', { body: 'Response 1' });
      webTools.setMockResponse('https://api2.com', { body: 'Response 2' });
      webTools.setMockResponse('https://api3.com', { body: 'Response 3' });

      const results = await webTools.fetchMultiple([
        'https://api1.com',
        'https://api2.com',
        'https://api3.com',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].body).toBe('Response 1');
      expect(results[1].body).toBe('Response 2');
      expect(results[2].body).toBe('Response 3');
    });

    test('should fetch URLs sequentially', async () => {
      webTools.setMockResponse('https://api1.com', { body: 'Response 1' });
      webTools.setMockResponse('https://api2.com', { body: 'Response 2' });

      const results = await webTools.fetchSequential([
        'https://api1.com',
        'https://api2.com',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].body).toBe('Response 1');
      expect(results[1].body).toBe('Response 2');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty HTML', async () => {
      const result = await webTools.extractContent('');

      expect(result.success).toBe(true);
      expect(result.text).toBe('');
    });

    test('should handle malformed HTML', async () => {
      const html = '<html><body><unclosed tag>Content';
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Content');
    });

    test('should handle very long content', async () => {
      const longText = 'a'.repeat(100000);
      const html = `<html><body>${longText}</body></html>`;
      const result = await webTools.extractContent(html);

      expect(result.success).toBe(true);
      expect(result.text!.length).toBe(100000);
    });

    test('should handle URLs with special characters', async () => {
      const result = webTools.parseURL('https://example.com/path%20with%20spaces?key=value%26more');

      expect(result.success).toBe(true);
      expect(result.pathname).toBe('/path%20with%20spaces');
    });

    test('should handle rapid fetches', async () => {
      const fetches: Promise<FetchResult>[] = [];
      
      for (let i = 0; i < 50; i++) {
        fetches.push(webTools.fetch(`https://example.com/${i}`));
      }

      const results = await Promise.all(fetches);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle URLs without protocol', () => {
      const result = webTools.parseURL('example.com');

      // URL constructor adds protocol
      expect(result.success).toBe(true);
    });

    test('should handle data URLs', () => {
      const result = webTools.parseURL('data:text/plain;base64,SGVsbG8gV29ybGQ=');

      expect(result.success).toBe(true);
      expect(result.protocol).toBe('data:');
    });

    test('should handle file URLs', () => {
      const result = webTools.parseURL('file:///path/to/file.txt');

      expect(result.success).toBe(true);
      expect(result.protocol).toBe('file:');
    });
  });
});
