/**
 * Validation Utilities Module
 * 
 * Provides comprehensive validation utilities including type checking,
 * schema validation, and constraint validation.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type Validator<T> = (value: unknown) => value is T;
export type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] };

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
  code: string;
}

export interface SchemaField<T> {
  type: string;
  required?: boolean;
  default?: T;
  validate?: (value: T) => boolean | string;
  transform?: (value: unknown) => T;
}

export interface SchemaDefinition {
  [key: string]: SchemaField<unknown>;
}

export interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

export interface NumberConstraints {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  negative?: boolean;
}

export interface ArrayConstraints<T> {
  minLength?: number;
  maxLength?: number;
  unique?: boolean;
  itemValidator?: (item: T) => boolean;
}

export interface ObjectConstraints {
  allowUnknown?: boolean;
  strict?: boolean;
}

// ============================================================================
// Type Validators
// ============================================================================

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isArrayOf<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(itemValidator);
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise || (
    isObject(value) &&
    isFunction((value as Record<string, unknown>).then)
  );
}

export function isMap<K = unknown, V = unknown>(value: unknown): value is Map<K, V> {
  return value instanceof Map;
}

export function isSet<T = unknown>(value: unknown): value is Set<T> {
  return value instanceof Set;
}

// ============================================================================
// String Validators
// ============================================================================

export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

export function isBlankString(value: unknown): value is string {
  return isString(value) && value.trim().length === 0;
}

export function isEmail(value: unknown): boolean {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isURL(value: unknown, options: { protocols?: string[] } = {}): boolean {
  if (!isString(value)) return false;

  try {
    const url = new URL(value);
    if (options.protocols) {
      return options.protocols.includes(url.protocol.slice(0, -1));
    }
    return true;
  } catch {
    return false;
  }
}

export function isUUID(value: unknown, version: number = 4): boolean {
  if (!isString(value)) return false;

  const patterns: Record<number, RegExp> = {
    1: /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    3: /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    5: /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  };

  const pattern = patterns[version];
  return pattern ? pattern.test(value) : false;
}

export function isJSON(value: unknown): boolean {
  if (!isString(value)) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function matchesPattern(value: unknown, pattern: RegExp): boolean {
  return isString(value) && pattern.test(value);
}

export function hasLength(
  value: unknown,
  min: number,
  max?: number
): boolean {
  if (!isString(value) && !isArray(value)) return false;
  const len = value.length;
  return len >= min && (max === undefined || len <= max);
}

// ============================================================================
// Number Validators
// ============================================================================

export function isPositive(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNegative(value: unknown): value is number {
  return isNumber(value) && value < 0;
}

export function isNonNegative(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

export function isNonPositive(value: unknown): value is number {
  return isNumber(value) && value <= 0;
}

export function isFinite(value: unknown): value is number {
  return isNumber(value) && Number.isFinite(value);
}

export function isInfinite(value: unknown): value is number {
  return isNumber(value) && !Number.isFinite(value);
}

export function isSafeInteger(value: unknown): value is number {
  return isNumber(value) && Number.isSafeInteger(value);
}

export function isInRange(
  value: unknown,
  min: number,
  max: number,
  inclusive: boolean = true
): boolean {
  if (!isNumber(value)) return false;
  return inclusive
    ? value >= min && value <= max
    : value > min && value < max;
}

export function isPort(value: unknown): boolean {
  return isInteger(value) && isInRange(value, 1, 65535);
}

// ============================================================================
// Array Validators
// ============================================================================

export function isNonEmptyArray<T = unknown>(value: unknown): value is T[] {
  return isArray(value) && value.length > 0;
}

export function hasUniqueItems<T>(value: T[]): boolean {
  return new Set(value).size === value.length;
}

export function contains<T>(array: T[], item: T): boolean {
  return array.includes(item);
}

export function containsAll<T>(array: T[], items: T[]): boolean {
  return items.every(item => array.includes(item));
}

export function containsAny<T>(array: T[], items: T[]): boolean {
  return items.some(item => array.includes(item));
}

// ============================================================================
// Object Validators
// ============================================================================

export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasKeys(obj: unknown, keys: string[]): boolean {
  return isObject(obj) && keys.every(key => key in obj);
}

export function isEmpty(value: unknown): boolean {
  if (isNullOrUndefined(value)) return true;
  if (isString(value) || isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  if (isMap(value) || isSet(value)) return value.size === 0;
  return false;
}

export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (isNullOrUndefined(a) || isNullOrUndefined(b)) return false;

  if (isDate(a) && isDate(b)) {
    return a.getTime() === b.getTime();
  }

  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isDeepEqual(item, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => isDeepEqual(a[key], b[key]));
  }

  return false;
}

// ============================================================================
// Schema Validation
// ============================================================================

export class Schema {
  private definition: SchemaDefinition;

  constructor(definition: SchemaDefinition) {
    this.definition = definition;
  }

  validate(data: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (!isObject(data)) {
      return {
        valid: false,
        errors: [{ path: '', message: 'Data must be an object', code: 'INVALID_TYPE' }],
      };
    }

    for (const [key, field] of Object.entries(this.definition)) {
      const value = (data as Record<string, unknown>)[key];
      const path = key;

      // Check required
      if (field.required && isNullOrUndefined(value)) {
        errors.push({
          path,
          message: `Field '${key}' is required`,
          code: 'REQUIRED',
          value,
        });
        continue;
      }

      // Skip validation for undefined optional fields
      if (isNullOrUndefined(value)) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, field.type)) {
        errors.push({
          path,
          message: `Field '${key}' must be of type '${field.type}'`,
          code: 'INVALID_TYPE',
          value,
        });
        continue;
      }

      // Custom validation
      if (field.validate) {
        const result = field.validate(value as never);
        if (result !== true) {
          errors.push({
            path,
            message: typeof result === 'string' ? result : `Validation failed for '${key}'`,
            code: 'VALIDATION_FAILED',
            value,
          });
        }
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return isString(value);
      case 'number':
        return isNumber(value);
      case 'integer':
        return isInteger(value);
      case 'boolean':
        return isBoolean(value);
      case 'date':
        return isDate(value);
      case 'array':
        return isArray(value);
      case 'object':
        return isObject(value);
      case 'any':
        return true;
      default:
        return false;
    }
  }
}

// ============================================================================
// Constraint Validation
// ============================================================================

export function validateString(
  value: unknown,
  constraints: StringConstraints
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isString(value)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Value must be a string', code: 'INVALID_TYPE', value }],
    };
  }

  if (constraints.minLength !== undefined && value.length < constraints.minLength) {
    errors.push({
      path: '',
      message: `String must be at least ${constraints.minLength} characters`,
      code: 'MIN_LENGTH',
      value,
    });
  }

  if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
    errors.push({
      path: '',
      message: `String must be at most ${constraints.maxLength} characters`,
      code: 'MAX_LENGTH',
      value,
    });
  }

  if (constraints.pattern && !constraints.pattern.test(value)) {
    errors.push({
      path: '',
      message: 'String does not match required pattern',
      code: 'PATTERN_MISMATCH',
      value,
    });
  }

  if (constraints.enum && !constraints.enum.includes(value)) {
    errors.push({
      path: '',
      message: `String must be one of: ${constraints.enum.join(', ')}`,
      code: 'INVALID_ENUM_VALUE',
      value,
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function validateNumber(
  value: unknown,
  constraints: NumberConstraints
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isNumber(value)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Value must be a number', code: 'INVALID_TYPE', value }],
    };
  }

  if (constraints.integer && !Number.isInteger(value)) {
    errors.push({
      path: '',
      message: 'Value must be an integer',
      code: 'NOT_INTEGER',
      value,
    });
  }

  if (constraints.positive && value <= 0) {
    errors.push({
      path: '',
      message: 'Value must be positive',
      code: 'NOT_POSITIVE',
      value,
    });
  }

  if (constraints.negative && value >= 0) {
    errors.push({
      path: '',
      message: 'Value must be negative',
      code: 'NOT_NEGATIVE',
      value,
    });
  }

  if (constraints.min !== undefined && value < constraints.min) {
    errors.push({
      path: '',
      message: `Value must be at least ${constraints.min}`,
      code: 'MIN_VALUE',
      value,
    });
  }

  if (constraints.max !== undefined && value > constraints.max) {
    errors.push({
      path: '',
      message: `Value must be at most ${constraints.max}`,
      code: 'MAX_VALUE',
      value,
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function validateArray<T>(
  value: unknown,
  constraints: ArrayConstraints<T>
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isArray(value)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Value must be an array', code: 'INVALID_TYPE', value }],
    };
  }

  if (constraints.minLength !== undefined && value.length < constraints.minLength) {
    errors.push({
      path: '',
      message: `Array must have at least ${constraints.minLength} items`,
      code: 'MIN_LENGTH',
      value,
    });
  }

  if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
    errors.push({
      path: '',
      message: `Array must have at most ${constraints.maxLength} items`,
      code: 'MAX_LENGTH',
      value,
    });
  }

  if (constraints.unique && !hasUniqueItems(value)) {
    errors.push({
      path: '',
      message: 'Array items must be unique',
      code: 'DUPLICATE_ITEMS',
      value,
    });
  }

  if (constraints.itemValidator) {
    value.forEach((item, index) => {
      if (!constraints.itemValidator!(item)) {
        errors.push({
          path: `[${index}]`,
          message: `Item at index ${index} is invalid`,
          code: 'INVALID_ITEM',
          value: item,
        });
      }
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function assert<T>(
  condition: boolean,
  message: string,
  code: string = 'ASSERTION_FAILED'
): asserts condition {
  if (!condition) {
    throw new ValidationError([{ path: '', message, code }]);
  }
}

export function assertType<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  message?: string
): asserts value is T {
  if (!validator(value)) {
    throw new ValidationError([{
      path: '',
      message: message || 'Type assertion failed',
      code: 'TYPE_ASSERTION_FAILED',
      value,
    }]);
  }
}

export class ValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(errors.map(e => e.message).join(', '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  isString,
  isNumber,
  isInteger,
  isBoolean,
  isNull,
  isUndefined,
  isNullOrUndefined,
  isSymbol,
  isBigInt,
  isFunction,
  isObject,
  isPlainObject,
  isArray,
  isArrayOf,
  isDate,
  isRegExp,
  isError,
  isPromise,
  isMap,
  isSet,
  isNonEmptyString,
  isBlankString,
  isEmail,
  isURL,
  isUUID,
  isJSON,
  matchesPattern,
  hasLength,
  isPositive,
  isNegative,
  isNonNegative,
  isNonPositive,
  isFinite,
  isInfinite,
  isSafeInteger,
  isInRange,
  isPort,
  isNonEmptyArray,
  hasUniqueItems,
  contains,
  containsAll,
  containsAny,
  hasKey,
  hasKeys,
  isEmpty,
  isDeepEqual,
  Schema,
  validateString,
  validateNumber,
  validateArray,
  assert,
  assertType,
  ValidationError,
};
