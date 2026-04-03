/**
 * Array Utilities Module
 * 
 * Provides comprehensive array manipulation utilities including sorting,
 * filtering, transformation, and advanced operations.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type Comparator<T> = (a: T, b: T) => number;
export type Predicate<T> = (value: T, index: number, array: T[]) => boolean;
export type Mapper<T, R> = (value: T, index: number, array: T[]) => R;
export type Reducer<T, R> = (accumulator: R, value: T, index: number, array: T[]) => R;

export interface GroupByResult<T> {
  [key: string]: T[];
}

export interface ChunkOptions {
  size: number;
}

export interface SortOptions<T> {
  key?: keyof T | ((item: T) => unknown);
  order?: 'asc' | 'desc';
  comparator?: Comparator<T>;
}

export interface UniqueOptions<T> {
  key?: keyof T | ((item: T) => unknown);
}

// ============================================================================
// Creation and Conversion
// ============================================================================

export function range(start: number, end?: number, step: number = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }

  const result: number[] = [];
  const actualStep = step * (start < end ? 1 : -1);

  for (let i = start; start < end ? i < end : i > end; i += actualStep) {
    result.push(i);
  }

  return result;
}

export function times<T>(n: number, iteratee: (index: number) => T): T[] {
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(iteratee(i));
  }
  return result;
}

export function fill<T>(array: T[], value: T, start: number = 0, end?: number): T[] {
  const actualEnd = end === undefined ? array.length : end;
  for (let i = start; i < actualEnd; i++) {
    array[i] = value;
  }
  return array;
}

export function repeat<T>(value: T, count: number): T[] {
  return times(count, () => value);
}

// ============================================================================
// Chunking and Slicing
// ============================================================================

export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [array];

  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

export function compact<T>(array: (T | null | undefined | false | 0 | '')[]): T[] {
  return array.filter(Boolean) as T[];
}

export function drop<T>(array: T[], n: number = 1): T[] {
  return array.slice(n);
}

export function dropRight<T>(array: T[], n: number = 1): T[] {
  return n === 0 ? [...array] : array.slice(0, -n || array.length);
}

export function dropWhile<T>(array: T[], predicate: Predicate<T>): T[] {
  const index = array.findIndex((value, i, arr) => !predicate(value, i, arr));
  return index === -1 ? [] : array.slice(index);
}

export function dropRightWhile<T>(array: T[], predicate: Predicate<T>): T[] {
  let index = array.length - 1;
  while (index >= 0 && predicate(array[index], index, array)) {
    index--;
  }
  return array.slice(0, index + 1);
}

export function take<T>(array: T[], n: number = 1): T[] {
  return array.slice(0, n);
}

export function takeRight<T>(array: T[], n: number = 1): T[] {
  return n === 0 ? [] : array.slice(-n);
}

export function takeWhile<T>(array: T[], predicate: Predicate<T>): T[] {
  const index = array.findIndex((value, i, arr) => !predicate(value, i, arr));
  return index === -1 ? [...array] : array.slice(0, index);
}

export function takeRightWhile<T>(array: T[], predicate: Predicate<T>): T[] {
  let index = array.length - 1;
  while (index >= 0 && predicate(array[index], index, array)) {
    index--;
  }
  return array.slice(index + 1);
}

export function slice<T>(array: T[], start: number = 0, end?: number): T[] {
  return array.slice(start, end);
}

// ============================================================================
// Filtering and Searching
// ============================================================================

export function filter<T>(array: T[], predicate: Predicate<T>): T[] {
  return array.filter(predicate);
}

export function find<T>(array: T[], predicate: Predicate<T>): T | undefined {
  return array.find(predicate);
}

export function findIndex<T>(array: T[], predicate: Predicate<T>): number {
  return array.findIndex(predicate);
}

export function findLast<T>(array: T[], predicate: Predicate<T>): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return array[i];
    }
  }
  return undefined;
}

export function findLastIndex<T>(array: T[], predicate: Predicate<T>): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1;
}

export function includes<T>(array: T[], value: T, fromIndex: number = 0): boolean {
  return array.includes(value, fromIndex);
}

export function indexOf<T>(array: T[], value: T, fromIndex: number = 0): number {
  return array.indexOf(value, fromIndex);
}

export function lastIndexOf<T>(array: T[], value: T, fromIndex?: number): number {
  return array.lastIndexOf(value, fromIndex);
}

export function every<T>(array: T[], predicate: Predicate<T>): boolean {
  return array.every(predicate);
}

export function some<T>(array: T[], predicate: Predicate<T>): boolean {
  return array.some(predicate);
}

export function none<T>(array: T[], predicate: Predicate<T>): boolean {
  return !array.some(predicate);
}

// ============================================================================
// Transformation
// ============================================================================

export function map<T, R>(array: T[], mapper: Mapper<T, R>): R[] {
  return array.map(mapper);
}

export function flatMap<T, R>(array: T[], mapper: (value: T, index: number, array: T[]) => R | R[]): R[] {
  return array.flatMap(mapper);
}

export function flatten<T>(array: (T | T[])[]): T[] {
  return array.flat() as T[];
}

export function flattenDeep<T>(array: unknown[]): T[] {
  const result: T[] = [];

  for (const item of array) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep<T>(item));
    } else {
      result.push(item as T);
    }
  }

  return result;
}

export function mapKeys<T extends Record<string, unknown>>(
  array: T[],
  keyMapper: (item: T, index: number) => string
): Record<string, T> {
  const result: Record<string, T> = {};
  array.forEach((item, index) => {
    result[keyMapper(item, index)] = item;
  });
  return result;
}

export function mapValues<T, R>(
  array: T[],
  valueMapper: (item: T, index: number) => R
): R[] {
  return array.map(valueMapper);
}

// ============================================================================
// Sorting
// ============================================================================

export function sort<T>(array: T[], options: SortOptions<T> = {}): T[] {
  const { key, order = 'asc', comparator } = options;

  const sorted = [...array];

  sorted.sort((a, b) => {
    let comparison: number;

    if (comparator) {
      comparison = comparator(a, b);
    } else if (key) {
      const aValue = typeof key === 'function' ? key(a) : a[key];
      const bValue = typeof key === 'function' ? key(b) : b[key];
      comparison = compareValues(aValue, bValue);
    } else {
      comparison = compareValues(a, b);
    }

    return order === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

function compareValues<T>(a: T, b: T): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortBy<T>(array: T[], key: keyof T | ((item: T) => unknown)): T[] {
  return sort(array, { key });
}

export function orderBy<T>(
  array: T[],
  keys: Array<keyof T | ((item: T) => unknown)>,
  orders: Array<'asc' | 'desc'> = []
): T[] {
  const sorted = [...array];

  sorted.sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const order = orders[i] || 'asc';

      const aValue = typeof key === 'function' ? key(a) : a[key];
      const bValue = typeof key === 'function' ? key(b) : b[key];

      const comparison = compareValues(aValue, bValue);

      if (comparison !== 0) {
        return order === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });

  return sorted;
}

export function reverse<T>(array: T[]): T[] {
  return [...array].reverse();
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// ============================================================================
// Aggregation
// ============================================================================

export function reduce<T, R>(array: T[], reducer: Reducer<T, R>, initialValue: R): R {
  return array.reduce(reducer, initialValue);
}

export function reduceRight<T, R>(array: T[], reducer: Reducer<T, R>, initialValue: R): R {
  return array.reduceRight(reducer, initialValue);
}

export function sum(array: number[]): number {
  return array.reduce((acc, val) => acc + val, 0);
}

export function sumBy<T>(array: T[], key: keyof T | ((item: T) => number)): number {
  return array.reduce((acc, item) => {
    const value = typeof key === 'function' ? key(item) : (item[key] as number);
    return acc + (value || 0);
  }, 0);
}

export function mean(array: number[]): number {
  return array.length === 0 ? 0 : sum(array) / array.length;
}

export function meanBy<T>(array: T[], key: keyof T | ((item: T) => number)): number {
  return array.length === 0 ? 0 : sumBy(array, key) / array.length;
}

export function min(array: number[]): number | undefined {
  return array.length === 0 ? undefined : Math.min(...array);
}

export function minBy<T>(array: T[], key: keyof T | ((item: T) => number)): T | undefined {
  if (array.length === 0) return undefined;

  return array.reduce((min, item) => {
    const value = typeof key === 'function' ? key(item) : (item[key] as number);
    const minValue = typeof key === 'function' ? key(min) : (min[key] as number);
    return value < minValue ? item : min;
  });
}

export function max(array: number[]): number | undefined {
  return array.length === 0 ? undefined : Math.max(...array);
}

export function maxBy<T>(array: T[], key: keyof T | ((item: T) => number)): T | undefined {
  if (array.length === 0) return undefined;

  return array.reduce((max, item) => {
    const value = typeof key === 'function' ? key(item) : (item[key] as number);
    const maxValue = typeof key === 'function' ? key(max) : (max[key] as number);
    return value > maxValue ? item : max;
  });
}

export function countBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of array) {
    const keyValue = typeof key === 'function' ? key(item) : String(item[key]);
    result[keyValue] = (result[keyValue] || 0) + 1;
  }

  return result;
}

// ============================================================================
// Grouping and Partitioning
// ============================================================================

export function groupBy<T>(
  array: T[],
  key: keyof T | ((item: T) => string)
): GroupByResult<T> {
  const result: GroupByResult<T> = {};

  for (const item of array) {
    const keyValue = typeof key === 'function' ? key(item) : String(item[key]);
    if (!result[keyValue]) {
      result[keyValue] = [];
    }
    result[keyValue].push(item);
  }

  return result;
}

export function keyBy<T>(
  array: T[],
  key: keyof T | ((item: T) => string)
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const item of array) {
    const keyValue = typeof key === 'function' ? key(item) : String(item[key]);
    result[keyValue] = item;
  }

  return result;
}

export function partition<T>(array: T[], predicate: Predicate<T>): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];

  for (let i = 0; i < array.length; i++) {
    if (predicate(array[i], i, array)) {
      truthy.push(array[i]);
    } else {
      falsy.push(array[i]);
    }
  }

  return [truthy, falsy];
}

// ============================================================================
// Uniqueness
// ============================================================================

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function uniqueBy<T>(array: T[], key: keyof T | ((item: T) => unknown)): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];

  for (const item of array) {
    const keyValue = typeof key === 'function' ? key(item) : item[key];
    if (!seen.has(keyValue)) {
      seen.add(keyValue);
      result.push(item);
    }
  }

  return result;
}

export function intersection<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return [...arrays[0]];

  const [first, ...rest] = arrays;
  const restSets = rest.map(arr => new Set(arr));

  return first.filter(item => restSets.every(set => set.has(item)));
}

export function intersectionBy<T>(
  arrays: T[][],
  key: keyof T | ((item: T) => unknown)
): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return [...arrays[0]];

  const [first, ...rest] = arrays;

  const getKey = typeof key === 'function' ? key : (item: T) => item[key];

  const restKeySets = rest.map(arr => new Set(arr.map(getKey)));

  return first.filter(item => {
    const itemKey = getKey(item);
    return restKeySets.every(set => set.has(itemKey));
  });
}

export function difference<T>(array1: T[], array2: T[]): T[] {
  const set2 = new Set(array2);
  return array1.filter(item => !set2.has(item));
}

export function differenceBy<T>(
  array1: T[],
  array2: T[],
  key: keyof T | ((item: T) => unknown)
): T[] {
  const getKey = typeof key === 'function' ? key : (item: T) => item[key];
  const set2 = new Set(array2.map(getKey));
  return array1.filter(item => !set2.has(getKey(item)));
}

export function union<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat());
}

export function unionBy<T>(
  arrays: T[][],
  key: keyof T | ((item: T) => unknown)
): T[] {
  return uniqueBy(arrays.flat(), key);
}

export function xor<T>(array1: T[], array2: T[]): T[] {
  const set1 = new Set(array1);
  const set2 = new Set(array2);

  return [
    ...array1.filter(item => !set2.has(item)),
    ...array2.filter(item => !set1.has(item)),
  ];
}

// ============================================================================
// Access
// ============================================================================

export function first<T>(array: T[]): T | undefined {
  return array[0];
}

export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function nth<T>(array: T[], n: number = 0): T | undefined {
  const index = n >= 0 ? n : array.length + n;
  return array[index];
}

export function head<T>(array: T[]): T | undefined {
  return first(array);
}

export function tail<T>(array: T[]): T[] {
  return array.slice(1);
}

export function initial<T>(array: T[]): T[] {
  return array.slice(0, -1);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  range,
  times,
  fill,
  repeat,
  chunk,
  compact,
  drop,
  dropRight,
  dropWhile,
  dropRightWhile,
  take,
  takeRight,
  takeWhile,
  takeRightWhile,
  slice,
  filter,
  find,
  findIndex,
  findLast,
  findLastIndex,
  includes,
  indexOf,
  lastIndexOf,
  every,
  some,
  none,
  map,
  flatMap,
  flatten,
  flattenDeep,
  mapKeys,
  mapValues,
  sort,
  sortBy,
  orderBy,
  reverse,
  shuffle,
  reduce,
  reduceRight,
  sum,
  sumBy,
  mean,
  meanBy,
  min,
  minBy,
  max,
  maxBy,
  countBy,
  groupBy,
  keyBy,
  partition,
  unique,
  uniqueBy,
  intersection,
  intersectionBy,
  difference,
  differenceBy,
  union,
  unionBy,
  xor,
  first,
  last,
  nth,
  head,
  tail,
  initial,
};
