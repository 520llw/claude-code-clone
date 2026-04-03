/**
 * @fileoverview Web Fetch Tool for Claude Code Clone
 * 
 * This tool fetches web pages:
 * - HTTP/HTTPS requests
 * - Support for various methods
 * - Header and body handling
 * 
 * @module WebFetchTool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const WebFetchInputSchema = z.object({
  url: z.string().url().describe('URL to fetch'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET').describe('HTTP method'),
  headers: z.record(z.string()).optional().describe('HTTP headers'),
  body: z.string().optional().describe('Request body'),
  timeout: z.number().int().min(1000).max(60000).default(30000).describe('Timeout in milliseconds'),
  follow_redirects: z.boolean().default(true).describe('Follow redirects'),
  max_redirects: z.number().int().min(0).max(10).default(5).describe('Maximum redirects'),
}).describe('Input for fetching web page');

export type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const WebFetchOutputSchema = z.object({
  url: z.string().describe('Final URL after redirects'),
  status: z.number().int().describe('HTTP status code'),
  status_text: z.string().describe('HTTP status text'),
  headers: z.record(z.string()).describe('Response headers'),
  content: z.string().describe('Response content'),
  content_type: z.string().optional().describe('Content-Type header'),
  content_length: z.number().int().optional().describe('Content length'),
  redirect_count: z.number().int().describe('Number of redirects followed'),
}).describe('Result of web fetch');

export type WebFetchOutput = z.infer<typeof WebFetchOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class WebFetchTool extends Tool {
  public readonly name = 'web_fetch';
  public readonly description = 'Fetch web pages and API endpoints';
  public readonly documentation = `
## Web Fetch Tool

Fetches web pages and API endpoints:
- HTTP/HTTPS requests
- Support for all HTTP methods
- Custom headers and body
- Redirect handling

### Input Parameters

- **url** (required): URL to fetch
- **method** (optional): HTTP method (default: GET)
- **headers** (optional): HTTP headers
- **body** (optional): Request body
- **timeout** (optional): Timeout in ms (default: 30000)
- **follow_redirects** (optional): Follow redirects (default: true)
- **max_redirects** (optional): Max redirects (default: 5)

### Output

Returns response data:
- url: Final URL after redirects
- status: HTTP status code
- status_text: HTTP status text
- headers: Response headers
- content: Response content
- content_type: Content-Type
- content_length: Content length
- redirect_count: Redirects followed

### Examples

Fetch page:
\`\`\`json
{
  "url": "https://api.example.com/data"
}
\`\`\`

POST request:
\`\`\`json
{
  "url": "https://api.example.com/users",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"name\":\"John\"}"
}
\`\`\`
  `;
  public readonly category = ToolCategory.WEB;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = WebFetchInputSchema;
  public readonly outputSchema = WebFetchOutputSchema;
  public readonly tags = ['web', 'http', 'fetch', 'api', 'request'];
  public readonly examples = [
    { description: 'Fetch page', input: { url: 'https://example.com' } },
    { description: 'POST request', input: { url: 'https://api.example.com/users', method: 'POST', body: '{"name":"John"}' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as WebFetchInput;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeout);

      const response = await fetch(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.body,
        redirect: params.follow_redirects ? 'follow' : 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const content = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const output: WebFetchOutput = {
        url: response.url,
        status: response.status,
        status_text: response.statusText,
        headers,
        content: content.slice(0, 100000), // Limit content size
        content_type: headers['content-type'],
        content_length: content.length,
        redirect_count: 0, // Not available in standard fetch
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createErrorResult(startedAt, createToolError('TIMEOUT', 'Request timed out'));
      }
      return this.createErrorResult(startedAt, createToolError('FETCH_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: WebFetchOutput): string {
    const parts: string[] = [];
    parts.push(`🌐 ${output.method || 'GET'} ${output.url}`);
    parts.push(`Status: ${output.status} ${output.status_text}`);
    parts.push(`Content-Type: ${output.content_type || 'unknown'}`);
    parts.push(`Length: ${output.content_length} bytes`);
    parts.push('');
    parts.push('Response:');
    parts.push(output.content.substring(0, 2000));
    if (output.content.length > 2000) {
      parts.push('... (truncated)');
    }
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: WebFetchOutput, output: string): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.SUCCESS,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: data.status >= 200 && data.status < 300,
      data,
      output,
    };
  }

  private createErrorResult(startedAt: Date, error: ReturnType<typeof createToolError>): ToolResult {
    return {
      executionId: `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: ToolExecutionStatus.FAILURE,
      toolName: this.name,
      startedAt,
      completedAt: new Date(),
      duration: Date.now() - startedAt.getTime(),
      success: false,
      error,
    };
  }
}

export default WebFetchTool;
