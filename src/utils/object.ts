/**
 * Object Utilities Module
 * 
 * Provides comprehensive object manipulation utilities including deep operations,
 * property access, transformation, and comparison.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type FlattenedObject = Record<string, unknown>;

export interface MergeOptions {
  deep?: boolean;
  arrayMerge?: 'replace' | 'concat' | 'merge';
}

export interface CloneOptions {
  deep?: boolean;
}

export interface PickOptions {
  strict?: boolean;
}

export type PropertyPath = string | string[] | number | symbol;

// ============================================================================
// Property Access
// ============================================================================

export function get<T = unknown>(
  obj: Record<string, unknown>,
  path: PropertyPath,
  defaultValue?: T
): T | undefined {
  const keys = normalizePath(path);
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined ? (current as T) : defaultValue;
}

export function set<T = unknown>(
  obj: Record<string, unknown>,
  path: PropertyPath,
  value: T
): Record<string, unknown> {
  const keys = normalizePath(path);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];

    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = typeof nextKey === 'number' ? [] : {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return obj;
}

export function has(obj: Record<string, unknown>, path: PropertyPath): boolean {
  const keys = normalizePath(path);
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

export function unset(obj: Record<string, unknown>, path: PropertyPath): boolean {
  const keys = normalizePath(path);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      return false;
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }

  return false;
}

function normalizePath(path: PropertyPath): (string | number)[] {
  if (Array.isArray(path)) {
    return path.map(key => (typeof key === 'number' ? key : String(key)));
  }

  if (typeof path === 'string') {
    return path.split('.').flatMap(part => {
      const match = part.match(/^([^\[]+)\[(\d+)\]$/);
      if (match) {
        return [match[1], parseInt(match[2], 10)];
      }
      return part;
    });
  }

  return [String(path)];
}

// ============================================================================
// Deep Operations
// ============================================================================

export function deepClone<T>(obj: T, options: CloneOptions = {}): T {
  const { deep = true } = options;

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    const copy: unknown[] = [];
    for (let i = 0; i < obj.length; i++) {
      copy[i] = deep ? deepClone(obj[i], options) : obj[i];
    }
    return copy as T;
  }

  if (obj instanceof Object) {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      copy[key] = deep ? deepClone((obj as Record<string, unknown>)[key], options) : (obj as Record<string, unknown>)[key];
    }
    return copy as T;
  }

  throw new Error('Unable to copy object');
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Record<string, unknown>>
): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return target;

  for (const key of Object.keys(source)) {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      if (!targetValue || typeof targetValue !== 'object') {
        (target as Record<string, unknown>)[key] = {};
      }
      deepMerge(
        (target as Record<string, unknown>)[key] as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      (target as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return deepMerge(target, ...sources);
}

export function deepFreeze<T>(obj: T): DeepReadonly<T> {
  const propNames = Object.getOwnPropertyNames(obj);

  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj) as DeepReadonly<T>;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Object Transformation
// ============================================================================

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
  options: PickOptions = {}
): Pick<T, K> {
  const { strict = false } = options;
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    } else if (strict) {
      throw new Error(`Key '${String(key)}' not found in object`);
    }
  }

  return result;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };

  for (const key of keys) {
    delete (result as Record<string, unknown>)[key as string];
  }

  return result as Omit<T, K>;
}

export function mapValues<T extends Record<string, unknown>, R>(
  obj: T,
  iteratee: (value: T[keyof T], key: keyof T, obj: T) => R
): Record<keyof T, R> {
  const result = {} as Record<keyof T, R>;

  for (const key of Object.keys(obj) as Array<keyof T>) {
    result[key] = iteratee(obj[key], key, obj);
  }

  return result;
}

export function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  iteratee: (value: T[keyof T], key: keyof T, obj: T) => string
): Record<string, T[keyof T]> {
  const result: Record<string, T[keyof T]> = {};

  for (const key of Object.keys(obj) as Array<keyof T>) {
    const newKey = iteratee(obj[key], key, obj);
    result[newKey] = obj[key];
  }

  return result;
}

export function filterObject<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T, obj: T) => boolean
): Partial<T> {
  const result = {} as Partial<T>;

  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (predicate(obj[key], key, obj)) {
      result[key] = obj[key];
    }
  }

  return result;
}

export function invert<K extends string, V extends string>(
  obj: Record<K, V>
): Record<V, K> {
  const result = {} as Record<V, K>;

  for (const [key, value] of Object.entries(obj) as [K, V][]) {
    result[value] = key;
  }

  return result;
}

export function flatten(
  obj: Record<string, unknown>,
  prefix: string = '',
  separator: string = '.'
): FlattenedObject {
  const result: FlattenedObject = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flatten(value as Record<string, unknown>, newKey, separator));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

export function unflatten(
  obj: FlattenedObject,
  separator: string = '.'
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split(separator);
    set(result, keys, value);
  }

  return result;
}

// ============================================================================
// Object Inspection
// ============================================================================

export function isEmpty(obj: Record<string, unknown> | unknown[]): boolean {
  if (Array.isArray(obj)) {
    return obj.length === 0;
  }

  if (obj && typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }

  return true;
}

export function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(obj);
  return proto === null || proto === Object.prototype;
}

export function size(obj: Record<string, unknown> | unknown[]): number {
  if (Array.isArray(obj)) {
    return obj.length;
  }

  return Object.keys(obj).length;
}

export function keys<T extends Record<string, unknown>>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

export function values<T extends Record<string, unknown>>(obj: T): Array<T[keyof T]> {
  return Object.values(obj) as Array<T[keyof T]>;
}

export function entries<T extends Record<string, unknown>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

// ============================================================================
// Object Comparison
// ============================================================================

export function isEqual(a: unknown, b: unknown): boolean {
  return deepEqual(a, b);
}

export function difference<T extends Record<string, unknown>>(
  obj1: T,
  obj2: T
): Partial<T> {
  const result = {} as Partial<T>;

  for (const key of Object.keys(obj1) as Array<keyof T>) {
    if (!deepEqual(obj1[key], obj2[key])) {
      result[key] = obj1[key];
    }
  }

  return result;
}

export function intersection<T extends Record<string, unknown>>(
  obj1: T,
  obj2: T
): Partial<T> {
  const result = {} as Partial<T>;

  for (const key of Object.keys(obj1) as Array<keyof T>) {
    if (deepEqual(obj1[key], obj2[key])) {
      result[key] = obj1[key];
    }
  }

  return result;
}

// ============================================================================
// Object Creation
// ============================================================================

export function fromEntries<K extends string, V>(entries: Array<[K, V]>): Record<K, V> {
  const result = {} as Record<K, V>;

  for (const [key, value] of entries) {
    result[key] = value;
  }

  return result;
}

export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keySelector: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;

  for (const item of array) {
    const key = keySelector(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }

  return result;
}

export function keyBy<T, K extends string | number | symbol>(
  array: T[],
  keySelector: (item: T) => K
): Record<K, T> {
  const result = {} as Record<K, T>;

  for (const item of array) {
    const key = keySelector(item);
    result[key] = item;
  }

  return result;
}

// ============================================================================
// Safe Operations
// ============================================================================

export function safeGet<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  path: PropertyPath,
  defaultValue?: T
): T | undefined {
  if (!obj) return defaultValue;
  return get(obj, path, defaultValue);
}

export function defaults<T extends Record<string, unknown>>(
  obj: Partial<T>,
  ...sources: Array<Partial<T>>
): T {
  const result = { ...obj } as T;

  for (const source of sources) {
    for (const key of Object.keys(source) as Array<keyof T>) {
      if (result[key] === undefined) {
        result[key] = source[key] as T[keyof T];
      }
    }
  }

  return result;
}

export function mergeWith<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
  customizer: (objValue: unknown, srcValue: unknown, key: string) => unknown
): T {
  for (const key of Object.keys(source)) {
    const targetValue = (target as Record<string, unknown>)[key];
    const sourceValue = source[key];

    const merged = customizer(targetValue, sourceValue, key);

    if (merged !== undefined) {
      (target as Record<string, unknown>)[key] = merged;
    } else if (sourceValue && typeof sourceValue === 'object') {
      if (!targetValue || typeof targetValue !== 'object') {
        (target as Record<string, unknown>)[key] = {};
      }
      mergeWith(
        (target as Record<string, unknown>)[key] as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        customizer
      );
    } else {
      (target as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return target;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  get,
  set,
  has,
  unset,
  deepClone,
  deepMerge,
  deepFreeze,
  deepEqual,
  pick,
  omit,
  mapValues,
  mapKeys,
  filterObject,
  invert,
  flatten,
  unflatten,
  isEmpty,
  isPlainObject,
  size,
  keys,
  values,
  entries,
  isEqual,
  difference,
  intersection,
  fromEntries,
  groupBy,
  keyBy,
  safeGet,
  defaults,
  mergeWith,
};
