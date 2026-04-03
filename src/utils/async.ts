/**
 * Async Utilities Module
 * 
 * Provides comprehensive async/await utilities including promise helpers,
 * concurrency control, debouncing, throttling, and async iterators.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type AsyncFunction<T = unknown, Args extends unknown[] = unknown[]> = (
  ...args: Args
) => Promise<T>;

export type MaybePromise<T> = T | Promise<T>;

export interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  isResolved: boolean;
  isRejected: boolean;
  isSettled: boolean;
}

export interface ConcurrencyOptions {
  concurrency: number;
}

export interface DebounceOptions {
  wait: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface ThrottleOptions {
  interval: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface RetryOptions {
  attempts: number;
  delay?: number;
  backoff?: 'fixed' | 'linear' | 'exponential';
  backoffMultiplier?: number;
  retryIf?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface TimeoutOptions {
  timeout: number;
  message?: string;
}

export interface PoolOptions {
  min?: number;
  max?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
}

export interface QueueOptions {
  concurrency?: number;
  autoStart?: boolean;
}

export interface Task<T> {
  id: string;
  fn: () => Promise<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Promise Helpers
// ============================================================================

export function createDeferred<T = void>(): DeferredPromise<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const deferred: DeferredPromise<T> = {
    promise,
    resolve,
    reject,
    isResolved: false,
    isRejected: false,
    isSettled: false,
  };

  promise.then(
    () => {
      deferred.isResolved = true;
      deferred.isSettled = true;
    },
    () => {
      deferred.isRejected = true;
      deferred.isSettled = true;
    }
  );

  return deferred;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  return timeout(fn(), options.timeout, options.message);
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    attempts,
    delay = 0,
    backoff = 'fixed',
    backoffMultiplier = 2,
    retryIf,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === attempts) {
        throw lastError;
      }

      if (retryIf && !retryIf(lastError, attempt)) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      const waitTime = calculateBackoff(
        delay,
        attempt,
        backoff,
        backoffMultiplier
      );

      if (waitTime > 0) {
        await sleep(waitTime);
      }
    }
  }

  throw lastError!;
}

function calculateBackoff(
  baseDelay: number,
  attempt: number,
  backoff: 'fixed' | 'linear' | 'exponential',
  multiplier: number
): number {
  switch (backoff) {
    case 'linear':
      return baseDelay * attempt;
    case 'exponential':
      return baseDelay * Math.pow(multiplier, attempt - 1);
    case 'fixed':
    default:
      return baseDelay;
  }
}

export async function allSettled<T>(
  promises: Promise<T>[]
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(promises);
}

export async function all<T>(
  promises: Promise<T>[],
  options?: { concurrency?: number }
): Promise<T[]> {
  if (!options?.concurrency || options.concurrency >= promises.length) {
    return Promise.all(promises);
  }

  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, promise] of promises.entries()) {
    const p = promise.then(result => {
      results[index] = result;
    });

    executing.push(p);

    if (executing.length >= options.concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(ep => ep === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export async function race<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.race(promises);
}

export async function any<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.any(promises);
}

// ============================================================================
// Concurrency Control
// ============================================================================

export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.permits++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get availablePermits(): number {
    return this.permits;
  }

  get queuedCount(): number {
    return this.queue.length;
  }
}

export class Mutex {
  private semaphore: Semaphore;

  constructor() {
    this.semaphore = new Semaphore(1);
  }

  async acquire(): Promise<void> {
    return this.semaphore.acquire();
  }

  release(): void {
    this.semaphore.release();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.semaphore.run(fn);
  }

  get isLocked(): boolean {
    return this.semaphore.availablePermits === 0;
  }
}

export class ReadWriteLock {
  private readSemaphore: Semaphore;
  private writeMutex: Mutex;
  private readCount: number = 0;

  constructor() {
    this.readSemaphore = new Semaphore(Infinity);
    this.writeMutex = new Mutex();
  }

  async read<T>(fn: () => Promise<T>): Promise<T> {
    await this.readSemaphore.acquire();
    this.readCount++;

    try {
      return await fn();
    } finally {
      this.readCount--;
      this.readSemaphore.release();
    }
  }

  async write<T>(fn: () => Promise<T>): Promise<T> {
    await this.writeMutex.acquire();

    // Wait for all readers to finish
    while (this.readCount > 0) {
      await sleep(10);
    }

    try {
      return await fn();
    } finally {
      this.writeMutex.release();
    }
  }
}

export class Barrier {
  private count: number;
  private current: number = 0;
  private deferred: DeferredPromise<void>;

  constructor(count: number) {
    this.count = count;
    this.deferred = createDeferred();
  }

  async wait(): Promise<void> {
    this.current++;

    if (this.current >= this.count) {
      this.deferred.resolve();
    }

    return this.deferred.promise;
  }

  reset(): void {
    this.current = 0;
    this.deferred = createDeferred();
  }
}

// ============================================================================
// Debounce and Throttle
// ============================================================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: DebounceOptions
): T & { cancel: () => void; flush: () => void } {
  const { wait, leading = false, trailing = true, maxWait } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime: number | null = null;
  let lastArgs: unknown[] | null = null;
  let result: unknown;

  const invoke = (args: unknown[]): unknown => {
    lastCallTime = Date.now();
    result = fn(...args);
    return result;
  };

  const startTimer = (pendingFunc: () => void, waitMs: number): NodeJS.Timeout => {
    return setTimeout(pendingFunc, waitMs);
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = lastCallTime === null ? Infinity : time - lastCallTime;
    return lastCallTime === null || timeSinceLastCall >= wait;
  };

  const trailingEdge = (): void => {
    timeoutId = null;
    if (trailing && lastArgs) {
      invoke(lastArgs);
    }
    lastArgs = null;
  };

  const debounced = (...args: unknown[]): unknown => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;

    if (isInvoking) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (leading) {
        if (lastCallTime === null) {
          return invoke(args);
        }
      }

      timeoutId = startTimer(trailingEdge, wait);

      if (maxWait && !maxTimeoutId) {
        maxTimeoutId = startTimer(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          trailingEdge();
          maxTimeoutId = null;
        }, maxWait);
      }
    }

    return result;
  };

  debounced.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
    }
    lastCallTime = null;
    lastArgs = null;
    timeoutId = null;
    maxTimeoutId = null;
  };

  debounced.flush = (): unknown => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      trailingEdge();
    }
    return result;
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: ThrottleOptions
): T & { cancel: () => void } {
  const { interval, leading = true, trailing = true } = options;

  let lastCallTime: number = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: unknown[] | null = null;

  const throttled = (...args: unknown[]): unknown => {
    const now = Date.now();
    lastArgs = args;

    const remaining = interval - (now - lastCallTime);

    if (remaining <= 0 || remaining > interval) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      lastCallTime = now;

      if (leading) {
        return fn(...args);
      }
    } else if (!timeoutId && trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
          fn(...lastArgs);
        }
      }, remaining);
    }

    return undefined;
  };

  throttled.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    lastArgs = null;
    timeoutId = null;
    lastCallTime = 0;
  };

  return throttled as T & { cancel: () => void };
}

// ============================================================================
// Async Queue
// ============================================================================

export class AsyncQueue<T> {
  private queue: Task<T>[] = [];
  private running: number = 0;
  private concurrency: number;
  private autoStart: boolean;

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency || 1;
    this.autoStart = options.autoStart !== false;
  }

  add<R>(fn: () => Promise<R>, priority: number = 0): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: Task<R> = {
        id: generateId(),
        fn,
        priority,
        resolve: resolve as (value: T) => void,
        reject: reject as (error: Error) => void,
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task as Task<T>);
      } else {
        this.queue.splice(insertIndex, 0, task as Task<T>);
      }

      if (this.autoStart) {
        this.process();
      }
    }) as Promise<R>;
  }

  async process(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();

    if (task) {
      try {
        const result = await task.fn();
        task.resolve(result as T);
      } catch (error) {
        task.reject(error as Error);
      } finally {
        this.running--;
        this.process();
      }
    }
  }

  pause(): void {
    this.autoStart = false;
  }

  resume(): void {
    this.autoStart = true;
    this.process();
  }

  clear(): void {
    for (const task of this.queue) {
      task.reject(new Error('Task cancelled'));
    }
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }

  get isProcessing(): boolean {
    return this.running > 0;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Async Iterator Helpers
// ============================================================================

export async function* mapAsync<T, R>(
  iterable: AsyncIterable<T> | Iterable<T>,
  mapper: (item: T, index: number) => Promise<R>,
  options?: { concurrency?: number }
): AsyncGenerator<R> {
  const items = await collect(iterable);
  const concurrency = options?.concurrency || items.length;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((item, idx) => mapper(item, i + idx))
    );
    yield* results;
  }
}

export async function* filterAsync<T>(
  iterable: AsyncIterable<T> | Iterable<T>,
  predicate: (item: T, index: number) => Promise<boolean>
): AsyncGenerator<T> {
  let index = 0;
  for await (const item of iterable) {
    if (await predicate(item, index++)) {
      yield item;
    }
  }
}

export async function* batchAsync<T>(
  iterable: AsyncIterable<T> | Iterable<T>,
  size: number
): AsyncGenerator<T[]> {
  let batch: T[] = [];

  for await (const item of iterable) {
    batch.push(item);

    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

export async function collect<T>(
  iterable: AsyncIterable<T> | Iterable<T>
): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

export async function first<T>(
  iterable: AsyncIterable<T> | Iterable<T>
): Promise<T | undefined> {
  for await (const item of iterable) {
    return item;
  }
  return undefined;
}

// ============================================================================
// Pool
// ============================================================================

export class Pool<T> {
  private resources: T[] = [];
  private available: T[] = [];
  private waiting: Array<(resource: T) => void> = [];
  private min: number;
  private max: number;
  private factory: () => Promise<T>;
  private destroy: (resource: T) => Promise<void>;

  constructor(
    factory: () => Promise<T>,
    destroy: (resource: T) => Promise<void>,
    options: PoolOptions = {}
  ) {
    this.factory = factory;
    this.destroy = destroy;
    this.min = options.min || 0;
    this.max = options.max || 10;

    // Initialize minimum resources
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const promises: Promise<T>[] = [];
    for (let i = this.resources.length; i < this.min; i++) {
      promises.push(this.createResource());
    }
    await Promise.all(promises);
  }

  private async createResource(): Promise<T> {
    const resource = await this.factory();
    this.resources.push(resource);
    this.available.push(resource);
    return resource;
  }

  async acquire(): Promise<T> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    if (this.resources.length < this.max) {
      return this.createResource();
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(resource: T): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next(resource);
    } else {
      this.available.push(resource);
    }
  }

  async use<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }

  async drain(): Promise<void> {
    await Promise.all(this.resources.map(r => this.destroy(r)));
    this.resources = [];
    this.available = [];
    this.waiting = [];
  }

  get size(): number {
    return this.resources.length;
  }

  get availableCount(): number {
    return this.available.length;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createDeferred,
  sleep,
  timeout,
  retry,
  all,
  allSettled,
  race,
  any,
  debounce,
  throttle,
  Semaphore,
  Mutex,
  ReadWriteLock,
  Barrier,
  AsyncQueue,
  Pool,
  collect,
  first,
  mapAsync,
  filterAsync,
  batchAsync,
};
