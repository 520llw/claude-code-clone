/**
 * HTTP Utilities Module
 * 
 * Provides comprehensive HTTP client utilities including request/response handling,
 * status code management, header manipulation, and content negotiation.
 */

import { URL, URLSearchParams } from 'url';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';

export type HttpStatusCode =
  | 100 | 101 | 102 | 103
  | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226
  | 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308
  | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410
  | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423
  | 424 | 425 | 426 | 428 | 429 | 431 | 451
  | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

export interface HttpHeaders {
  [key: string]: string | string[] | undefined;
}

export interface QueryParams {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: HttpHeaders;
  body?: unknown;
  query?: QueryParams;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  status: HttpStatusCode;
  statusText: string;
  headers: HttpHeaders;
  body: T;
  url: string;
  duration: number;
}

export interface RequestOptions {
  method?: HttpMethod;
  headers?: HttpHeaders;
  body?: unknown;
  query?: QueryParams;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateStatus?: (status: number) => boolean;
}

export interface UrlParts {
  protocol: string;
  hostname: string;
  port?: string;
  pathname: string;
  search: string;
  hash: string;
  username?: string;
  password?: string;
}

export interface ContentTypeInfo {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
}

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS: Record<string, HttpStatusCode> = {
  // 1xx Informational
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,

  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,

  // 3xx Redirection
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // 4xx Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,

  // 5xx Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
};

export const HTTP_STATUS_TEXT: Record<HttpStatusCode, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  103: 'Early Hints',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
};

// ============================================================================
// Status Code Helpers
// ============================================================================

export function isInformational(status: number): boolean {
  return status >= 100 && status < 200;
}

export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

export function isError(status: number): boolean {
  return status >= 400;
}

export function getStatusText(status: HttpStatusCode): string {
  return HTTP_STATUS_TEXT[status] || 'Unknown Status';
}

export function getStatusCategory(status: number): string {
  if (isInformational(status)) return 'informational';
  if (isSuccess(status)) return 'success';
  if (isRedirect(status)) return 'redirect';
  if (isClientError(status)) return 'client-error';
  if (isServerError(status)) return 'server-error';
  return 'unknown';
}

// ============================================================================
// URL Utilities
// ============================================================================

export function parseUrl(url: string): UrlParts {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol.slice(0, -1), // Remove trailing colon
    hostname: parsed.hostname,
    port: parsed.port || undefined,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
  };
}

export function buildUrl(base: string, params?: QueryParams): string {
  if (!params || Object.keys(params).length === 0) {
    return base;
  }

  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function encodeQueryParams(params: QueryParams): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
    } else {
      searchParams.set(key, String(value));
    }
  }

  return searchParams.toString();
}

export function decodeQueryParams(queryString: string): Record<string, string | string[]> {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of params) {
    const existing = result[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function joinUrls(...parts: string[]): string {
  return parts
    .map(part => part.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/');
}

// ============================================================================
// Header Utilities
// ============================================================================

export function parseContentType(contentType: string): ContentTypeInfo {
  const parts = contentType.split(';').map(p => p.trim());
  const [type, subtype] = parts[0].split('/');

  const parameters: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split('=');
    if (key && value) {
      parameters[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  }

  return { type, subtype, parameters };
}

export function buildContentType(
  type: string,
  subtype: string,
  parameters?: Record<string, string>
): string {
  let contentType = `${type}/${subtype}`;

  if (parameters) {
    for (const [key, value] of Object.entries(parameters)) {
      contentType += `; ${key}="${value}"`;
    }
  }

  return contentType;
}

export function getCharset(contentType: string): string | undefined {
  const parsed = parseContentType(contentType);
  return parsed.parameters.charset;
}

export function normalizeHeaderName(name: string): string {
  return name
    .toLowerCase()
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

export function parseHeaders(headerString: string): HttpHeaders {
  const headers: HttpHeaders = {};
  const lines = headerString.split('\r\n');

  for (const line of lines) {
    const index = line.indexOf(':');
    if (index > 0) {
      const name = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();

      const existing = headers[name];
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          headers[name] = [existing, value];
        }
      } else {
        headers[name] = value;
      }
    }
  }

  return headers;
}

// ============================================================================
// Content Negotiation
// ============================================================================

export interface AcceptHeader {
  type: string;
  subtype: string;
  quality: number;
  parameters: Record<string, string>;
}

export function parseAcceptHeader(header: string): AcceptHeader[] {
  const items: AcceptHeader[] = [];

  for (const part of header.split(',')) {
    const [mediaRange, ...paramParts] = part.trim().split(';');
    const [type, subtype] = mediaRange.trim().split('/');

    const parameters: Record<string, string> = {};
    let quality = 1;

    for (const param of paramParts) {
      const [key, value] = param.trim().split('=');
      if (key === 'q') {
        quality = parseFloat(value) || 1;
      } else if (key && value) {
        parameters[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    items.push({ type, subtype, quality, parameters });
  }

  return items.sort((a, b) => b.quality - a.quality);
}

export function negotiateContentType(
  acceptHeader: string,
  availableTypes: string[]
): string | undefined {
  const accepted = parseAcceptHeader(acceptHeader);

  for (const accept of accepted) {
    for (const available of availableTypes) {
      const [type, subtype] = available.split('/');

      if (
        (accept.type === '*' || accept.type === type) &&
        (accept.subtype === '*' || accept.subtype === subtype)
      ) {
        return available;
      }
    }
  }

  return undefined;
}

// ============================================================================
// Request Body Utilities
// ============================================================================

export function encodeRequestBody(
  body: unknown,
  contentType: string
): string | Buffer | Uint8Array {
  if (body === null || body === undefined) {
    return '';
  }

  const parsed = parseContentType(contentType);

  switch (`${parsed.type}/${parsed.subtype}`) {
    case 'application/json':
      return JSON.stringify(body);

    case 'application/x-www-form-urlencoded':
      if (typeof body === 'object' && body !== null) {
        return encodeQueryParams(body as QueryParams);
      }
      return String(body);

    case 'text/plain':
    case 'text/html':
    case 'text/xml':
      return String(body);

    default:
      if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
        return body as Buffer | Uint8Array;
      }
      return String(body);
  }
}

export function decodeResponseBody<T = unknown>(
  body: string | Buffer,
  contentType: string
): T {
  const parsed = parseContentType(contentType);

  switch (`${parsed.type}/${parsed.subtype}`) {
    case 'application/json':
      return JSON.parse(body.toString()) as T;

    case 'application/x-www-form-urlencoded':
      return decodeQueryParams(body.toString()) as unknown as T;

    default:
      return body as unknown as T;
  }
}

// ============================================================================
// Cookie Utilities
// ============================================================================

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export function parseCookieHeader(header: string): Cookie[] {
  const cookies: Cookie[] = [];

  for (const part of header.split(',')) {
    const [nameValue, ...attrs] = part.trim().split(';');
    const [name, value] = nameValue.trim().split('=');

    const cookie: Cookie = {
      name: name.trim(),
      value: decodeURIComponent(value?.trim() || ''),
    };

    for (const attr of attrs) {
      const [attrName, attrValue] = attr.trim().split('=');
      const lowerName = attrName.trim().toLowerCase();

      switch (lowerName) {
        case 'domain':
          cookie.domain = attrValue?.trim();
          break;
        case 'path':
          cookie.path = attrValue?.trim();
          break;
        case 'expires':
          cookie.expires = new Date(attrValue?.trim() || '');
          break;
        case 'max-age':
          cookie.maxAge = parseInt(attrValue?.trim() || '0', 10);
          break;
        case 'secure':
          cookie.secure = true;
          break;
        case 'httponly':
          cookie.httpOnly = true;
          break;
        case 'samesite':
          cookie.sameSite = (attrValue?.trim().toLowerCase() as 'strict' | 'lax' | 'none') || 'lax';
          break;
      }
    }

    cookies.push(cookie);
  }

  return cookies;
}

export function buildCookieHeader(cookie: Cookie): string {
  let header = `${cookie.name}=${encodeURIComponent(cookie.value)}`;

  if (cookie.domain) {
    header += `; Domain=${cookie.domain}`;
  }

  if (cookie.path) {
    header += `; Path=${cookie.path}`;
  }

  if (cookie.expires) {
    header += `; Expires=${cookie.expires.toUTCString()}`;
  }

  if (cookie.maxAge !== undefined) {
    header += `; Max-Age=${cookie.maxAge}`;
  }

  if (cookie.secure) {
    header += '; Secure';
  }

  if (cookie.httpOnly) {
    header += '; HttpOnly';
  }

  if (cookie.sameSite) {
    header += `; SameSite=${cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1)}`;
  }

  return header;
}

// ============================================================================
// CORS Utilities
// ============================================================================

export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export function buildCorsHeaders(
  requestOrigin: string,
  options: CorsOptions
): HttpHeaders {
  const headers: HttpHeaders = {};

  // Determine allowed origin
  let allowedOrigin: string | false = false;

  if (options.origin === true) {
    allowedOrigin = requestOrigin;
  } else if (options.origin === false) {
    allowedOrigin = false;
  } else if (typeof options.origin === 'string') {
    allowedOrigin = options.origin;
  } else if (Array.isArray(options.origin)) {
    allowedOrigin = options.origin.includes(requestOrigin) ? requestOrigin : false;
  } else if (typeof options.origin === 'function') {
    allowedOrigin = options.origin(requestOrigin) ? requestOrigin : false;
  }

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  // Methods
  if (options.methods) {
    headers['Access-Control-Allow-Methods'] = options.methods.join(', ');
  }

  // Allowed headers
  if (options.allowedHeaders) {
    headers['Access-Control-Allow-Headers'] = options.allowedHeaders.join(', ');
  }

  // Exposed headers
  if (options.exposedHeaders) {
    headers['Access-Control-Expose-Headers'] = options.exposedHeaders.join(', ');
  }

  // Credentials
  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Max age
  if (options.maxAge) {
    headers['Access-Control-Max-Age'] = String(options.maxAge);
  }

  return headers;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  HTTP_STATUS,
  HTTP_STATUS_TEXT,
  isInformational,
  isSuccess,
  isRedirect,
  isClientError,
  isServerError,
  isError,
  getStatusText,
  getStatusCategory,
  parseUrl,
  buildUrl,
  encodeQueryParams,
  decodeQueryParams,
  joinUrls,
  parseContentType,
  buildContentType,
  getCharset,
  normalizeHeaderName,
  parseHeaders,
  parseAcceptHeader,
  negotiateContentType,
  encodeRequestBody,
  decodeResponseBody,
  parseCookieHeader,
  buildCookieHeader,
  buildCorsHeaders,
};
