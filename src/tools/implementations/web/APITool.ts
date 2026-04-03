/**
 * @fileoverview API Tool for Claude Code Clone
 * 
 * This tool makes HTTP API requests:
 * - REST API calls
 * - JSON handling
 * - Authentication support
 * 
 * @module APITool
 * @version 1.0.0
 * @author Claude Code Clone
 */

import { z } from 'zod';
import { Tool, ToolCategory, PermissionLevel, ToolResult, ToolContext, ToolExecutionStatus, createToolError } from '../../Tool';

// ============================================================================
// Input Schema
// ============================================================================

export const APIInputSchema = z.object({
  endpoint: z.string().describe('API endpoint URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET').describe('HTTP method'),
  headers: z.record(z.string()).optional().describe('HTTP headers'),
  query_params: z.record(z.string()).optional().describe('Query parameters'),
  body: z.unknown().optional().describe('Request body (will be JSON serialized)'),
  auth_token: z.string().optional().describe('Bearer token for authentication'),
  timeout: z.number().int().min(1000).max(60000).default(30000).describe('Timeout in milliseconds'),
}).describe('Input for API request');

export type APIInput = z.infer<typeof APIInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const APIOutputSchema = z.object({
  endpoint: z.string().describe('API endpoint'),
  method: z.string().describe('HTTP method'),
  status: z.number().int().describe('HTTP status code'),
  status_text: z.string().describe('HTTP status text'),
  headers: z.record(z.string()).describe('Response headers'),
  data: z.unknown().optional().describe('Parsed response data'),
  raw_response: z.string().describe('Raw response text'),
}).describe('Result of API request');

export type APIOutput = z.infer<typeof APIOutputSchema>;

// ============================================================================
// Tool Implementation
// ============================================================================

export class APITool extends Tool {
  public readonly name = 'api';
  public readonly description = 'Make HTTP API requests with JSON handling';
  public readonly documentation = `
## API Tool

Makes HTTP API requests:
- REST API calls
- JSON request/response handling
- Authentication support
- Query parameters

### Input Parameters

- **endpoint** (required): API endpoint URL
- **method** (optional): HTTP method (default: GET)
- **headers** (optional): HTTP headers
- **query_params** (optional): Query parameters
- **body** (optional): Request body (JSON serialized)
- **auth_token** (optional): Bearer token
- **timeout** (optional): Timeout in ms (default: 30000)

### Output

Returns API response:
- endpoint: API endpoint
- method: HTTP method
- status: HTTP status code
- status_text: HTTP status text
- headers: Response headers
- data: Parsed JSON response
- raw_response: Raw response text

### Examples

GET request:
\`\`\`json
{
  "endpoint": "https://api.example.com/users"
}
\`\`\`

POST with body:
\`\`\`json
{
  "endpoint": "https://api.example.com/users",
  "method": "POST",
  "body": { "name": "John", "email": "john@example.com" }
}
\`\`\`

With authentication:
\`\`\`json
{
  "endpoint": "https://api.example.com/protected",
  "auth_token": "your-token-here"
}
\`\`\`
  `;
  public readonly category = ToolCategory.WEB;
  public readonly permissionLevel = PermissionLevel.AUTO_APPROVE;
  public readonly inputSchema = APIInputSchema;
  public readonly outputSchema = APIOutputSchema;
  public readonly tags = ['api', 'http', 'rest', 'json', 'request'];
  public readonly examples = [
    { description: 'GET request', input: { endpoint: 'https://api.example.com/users' } },
    { description: 'POST request', input: { endpoint: 'https://api.example.com/users', method: 'POST', body: { name: 'John' } } },
    { description: 'With auth', input: { endpoint: 'https://api.example.com/protected', auth_token: 'token' } },
  ];

  protected async executeImpl(input: unknown, context: ToolContext): Promise<ToolResult> {
    const startedAt = new Date();
    const params = input as APIInput;

    try {
      // Build URL with query params
      let url = params.endpoint;
      if (params.query_params) {
        const searchParams = new URLSearchParams(params.query_params);
        url += (url.includes('?') ? '&' : '?') + searchParams.toString();
      }

      // Build headers
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...params.headers,
      };

      if (params.auth_token) {
        headers['Authorization'] = `Bearer ${params.auth_token}`;
      }

      // Build request body
      let body: string | undefined;
      if (params.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(params.body);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeout);

      const response = await fetch(url, {
        method: params.method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawResponse = await response.text();
      
      // Try to parse JSON
      let data: unknown;
      try {
        data = JSON.parse(rawResponse);
      } catch {
        data = undefined;
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const output: APIOutput = {
        endpoint: params.endpoint,
        method: params.method,
        status: response.status,
        status_text: response.statusText,
        headers: responseHeaders,
        data,
        raw_response: rawResponse.slice(0, 100000),
      };

      return this.createSuccessResult(startedAt, output, this.formatOutput(output));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createErrorResult(startedAt, createToolError('TIMEOUT', 'Request timed out'));
      }
      return this.createErrorResult(startedAt, createToolError('API_ERROR', String(error)));
    }
  }

  protected async validateContext(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  private formatOutput(output: APIOutput): string {
    const parts: string[] = [];
    parts.push(`🔌 API ${output.method} ${output.endpoint}`);
    parts.push(`Status: ${output.status} ${output.status_text}`);
    parts.push('');
    
    if (output.data !== undefined) {
      parts.push('Response Data:');
      parts.push(JSON.stringify(output.data, null, 2));
    } else {
      parts.push('Raw Response:');
      parts.push(output.raw_response.substring(0, 2000));
    }
    
    return parts.join('\n');
  }

  private createSuccessResult(startedAt: Date, data: APIOutput, output: string): ToolResult {
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

export default APITool;
