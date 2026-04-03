/**
 * Priority Queue - Efficient priority-based queue for context management
 * 
 * Provides:
 * - Min/max heap implementation for O(log n) operations
 * - Priority-based item ordering
 * - Capacity management with eviction policies
 * - Batch operations for efficiency
 */

// ============================================================================
// Priority Queue Item
// ============================================================================

export interface PriorityQueueItem<T = unknown> {
  id: string;
  priority: number;
  data: T;
  timestamp: number;
  accessCount: number;
}

// ============================================================================
// Eviction Policy
// ============================================================================

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'priority';

// ============================================================================
// Priority Queue Configuration
// ============================================================================

export interface PriorityQueueConfig {
  maxSize: number;
  evictionPolicy: EvictionPolicy;
  priorityRange: { min: number; max: number };
  autoEvict: boolean;
}

export const DEFAULT_QUEUE_CONFIG: PriorityQueueConfig = {
  maxSize: 1000,
  evictionPolicy: 'lru',
  priorityRange: { min: 0, max: 100 },
  autoEvict: true,
};

// ============================================================================
// Priority Queue Statistics
// ============================================================================

export interface PriorityQueueStats {
  size: number;
  maxSize: number;
  isFull: boolean;
  utilization: number;
  averagePriority: number;
  oldestItem: number;
  newestItem: number;
  mostAccessed: { id: string; count: number } | null;
  leastAccessed: { id: string; count: number } | null;
}

// ============================================================================
// Base Priority Queue Interface
// ============================================================================

export interface IPriorityQueue<T = unknown> {
  enqueue(item: PriorityQueueItem<T>): boolean;
  dequeue(): PriorityQueueItem<T> | undefined;
  peek(): PriorityQueueItem<T> | undefined;
  get(id: string): PriorityQueueItem<T> | undefined;
  remove(id: string): boolean;
  updatePriority(id: string, priority: number): boolean;
  size(): number;
  isEmpty(): boolean;
  isFull(): boolean;
  clear(): void;
  toArray(): PriorityQueueItem<T>[];
  getStats(): PriorityQueueStats;
}

// ============================================================================
// Binary Heap Implementation
// ============================================================================

export class BinaryHeapPriorityQueue<T = unknown> implements IPriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];
  private itemMap: Map<string, number> = new Map();
  private config: PriorityQueueConfig;

  constructor(config: Partial<PriorityQueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Core Operations
  // --------------------------------------------------------------------------

  enqueue(item: PriorityQueueItem<T>): boolean {
    // Check if item already exists
    if (this.itemMap.has(item.id)) {
      this.updateItem(item);
      return true;
    }

    // Check capacity
    if (this.isFull() && this.config.autoEvict) {
      this.evict();
    }

    if (this.isFull()) {
      return false;
    }

    // Add to heap
    this.heap.push(item);
    const index = this.heap.length - 1;
    this.itemMap.set(item.id, index);
    this.heapifyUp(index);

    return true;
  }

  dequeue(): PriorityQueueItem<T> | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    const item = this.heap[0];
    this.removeAt(0);
    return item;
  }

  peek(): PriorityQueueItem<T> | undefined {
    return this.heap[0];
  }

  get(id: string): PriorityQueueItem<T> | undefined {
    const index = this.itemMap.get(id);
    if (index === undefined) {
      return undefined;
    }

    const item = this.heap[index];
    // Update access statistics
    item.accessCount++;
    return item;
  }

  remove(id: string): boolean {
    const index = this.itemMap.get(id);
    if (index === undefined) {
      return false;
    }

    this.removeAt(index);
    return true;
  }

  updatePriority(id: string, priority: number): boolean {
    const index = this.itemMap.get(id);
    if (index === undefined) {
      return false;
    }

    const oldPriority = this.heap[index].priority;
    this.heap[index].priority = this.clampPriority(priority);

    // Re-heapify
    if (priority > oldPriority) {
      this.heapifyUp(index);
    } else {
      this.heapifyDown(index);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  enqueueBatch(items: PriorityQueueItem<T>[]): {
    successful: string[];
    failed: string[];
  } {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      if (this.enqueue(item)) {
        successful.push(item.id);
      } else {
        failed.push(item.id);
      }
    }

    return { successful, failed };
  }

  dequeueBatch(count: number): PriorityQueueItem<T>[] {
    const items: PriorityQueueItem<T>[] = [];
    for (let i = 0; i < count && !this.isEmpty(); i++) {
      const item = this.dequeue();
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  removeBatch(ids: string[]): { successful: string[]; failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      if (this.remove(id)) {
        successful.push(id);
      } else {
        failed.push(id);
      }
    }

    return { successful, failed };
  }

  // --------------------------------------------------------------------------
  // Query Operations
  // --------------------------------------------------------------------------

  find(predicate: (item: PriorityQueueItem<T>) => boolean): PriorityQueueItem<T>[] {
    return this.heap.filter(predicate);
  }

  findByPriority(minPriority: number, maxPriority?: number): PriorityQueueItem<T>[] {
    return this.heap.filter(
      item => item.priority >= minPriority && 
              (maxPriority === undefined || item.priority <= maxPriority)
    );
  }

  findByTimeRange(startTime: number, endTime: number): PriorityQueueItem<T>[] {
    return this.heap.filter(
      item => item.timestamp >= startTime && item.timestamp <= endTime
    );
  }

  getTopK(k: number): PriorityQueueItem<T>[] {
    return [...this.heap]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, k);
  }

  getBottomK(k: number): PriorityQueueItem<T>[] {
    return [...this.heap]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, k);
  }

  // --------------------------------------------------------------------------
  // Utility Operations
  // --------------------------------------------------------------------------

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  isFull(): boolean {
    return this.heap.length >= this.config.maxSize;
  }

  clear(): void {
    this.heap = [];
    this.itemMap.clear();
  }

  toArray(): PriorityQueueItem<T>[] {
    return [...this.heap].sort((a, b) => b.priority - a.priority);
  }

  getStats(): PriorityQueueStats {
    if (this.isEmpty()) {
      return {
        size: 0,
        maxSize: this.config.maxSize,
        isFull: false,
        utilization: 0,
        averagePriority: 0,
        oldestItem: 0,
        newestItem: 0,
        mostAccessed: null,
        leastAccessed: null,
      };
    }

    const priorities = this.heap.map(item => item.priority);
    const averagePriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;

    const timestamps = this.heap.map(item => item.timestamp);
    const accessCounts = this.heap.map(item => ({ id: item.id, count: item.accessCount }));

    const mostAccessed = accessCounts.reduce((max, curr) => 
      curr.count > max.count ? curr : max
    );
    const leastAccessed = accessCounts.reduce((min, curr) => 
      curr.count < min.count ? curr : min
    );

    return {
      size: this.heap.length,
      maxSize: this.config.maxSize,
      isFull: this.isFull(),
      utilization: this.heap.length / this.config.maxSize,
      averagePriority,
      oldestItem: Math.min(...timestamps),
      newestItem: Math.max(...timestamps),
      mostAccessed: mostAccessed.count > 0 ? mostAccessed : null,
      leastAccessed: leastAccessed.count < Infinity ? leastAccessed : null,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private heapifyUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.heap[parent].priority >= this.heap[current].priority) {
        break;
      }
      this.swap(current, parent);
      current = parent;
    }
  }

  private heapifyDown(index: number): void {
    let current = index;
    const n = this.heap.length;

    while (true) {
      let largest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (left < n && this.heap[left].priority > this.heap[largest].priority) {
        largest = left;
      }
      if (right < n && this.heap[right].priority > this.heap[largest].priority) {
        largest = right;
      }

      if (largest === current) {
        break;
      }

      this.swap(current, largest);
      current = largest;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    this.itemMap.set(this.heap[i].id, i);
    this.itemMap.set(this.heap[j].id, j);
  }

  private removeAt(index: number): void {
    const lastIndex = this.heap.length - 1;
    
    if (index === lastIndex) {
      this.itemMap.delete(this.heap[index].id);
      this.heap.pop();
      return;
    }

    // Replace with last element
    this.heap[index] = this.heap[lastIndex];
    this.itemMap.set(this.heap[index].id, index);
    this.heap.pop();

    // Re-heapify
    this.heapifyDown(index);
    this.heapifyUp(index);
  }

  private updateItem(item: PriorityQueueItem<T>): void {
    const index = this.itemMap.get(item.id);
    if (index !== undefined) {
      this.heap[index] = { ...item, accessCount: this.heap[index].accessCount + 1 };
      this.heapifyDown(index);
      this.heapifyUp(index);
    }
  }

  private evict(): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
      case 'priority':
        this.evictLowestPriority();
        break;
    }
  }

  private evictLRU(): void {
    let oldestIndex = 0;
    let oldestTime = this.heap[0].timestamp;

    for (let i = 1; i < this.heap.length; i++) {
      if (this.heap[i].timestamp < oldestTime) {
        oldestTime = this.heap[i].timestamp;
        oldestIndex = i;
      }
    }

    this.removeAt(oldestIndex);
  }

  private evictLFU(): void {
    let leastIndex = 0;
    let leastCount = this.heap[0].accessCount;

    for (let i = 1; i < this.heap.length; i++) {
      if (this.heap[i].accessCount < leastCount) {
        leastCount = this.heap[i].accessCount;
        leastIndex = i;
      }
    }

    this.removeAt(leastIndex);
  }

  private evictFIFO(): void {
    // Remove the oldest item by timestamp
    this.evictLRU();
  }

  private evictLowestPriority(): void {
    // Remove the lowest priority item
    let lowestIndex = 0;
    let lowestPriority = this.heap[0].priority;

    for (let i = 1; i < this.heap.length; i++) {
      if (this.heap[i].priority < lowestPriority) {
        lowestPriority = this.heap[i].priority;
        lowestIndex = i;
      }
    }

    this.removeAt(lowestIndex);
  }

  private clampPriority(priority: number): number {
    return Math.max(
      this.config.priorityRange.min,
      Math.min(this.config.priorityRange.max, priority)
    );
  }
}

// ============================================================================
// Sorted Array Priority Queue (for smaller datasets)
// ============================================================================

export class SortedArrayPriorityQueue<T = unknown> implements IPriorityQueue<T> {
  private items: PriorityQueueItem<T>[] = [];
  private config: PriorityQueueConfig;

  constructor(config: Partial<PriorityQueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  enqueue(item: PriorityQueueItem<T>): boolean {
    if (this.itemExists(item.id)) {
      this.updateItem(item);
      return true;
    }

    if (this.isFull() && this.config.autoEvict) {
      this.evict();
    }

    if (this.isFull()) {
      return false;
    }

    // Insert in sorted order
    const insertIndex = this.findInsertIndex(item.priority);
    this.items.splice(insertIndex, 0, item);

    return true;
  }

  dequeue(): PriorityQueueItem<T> | undefined {
    return this.items.shift();
  }

  peek(): PriorityQueueItem<T> | undefined {
    return this.items[0];
  }

  get(id: string): PriorityQueueItem<T> | undefined {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.accessCount++;
    }
    return item;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }

  updatePriority(id: string, priority: number): boolean {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) {
      return false;
    }

    const item = this.items[index];
    item.priority = this.clampPriority(priority);

    // Re-sort
    this.items.splice(index, 1);
    const newIndex = this.findInsertIndex(item.priority);
    this.items.splice(newIndex, 0, item);

    return true;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  isFull(): boolean {
    return this.items.length >= this.config.maxSize;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): PriorityQueueItem<T>[] {
    return [...this.items];
  }

  getStats(): PriorityQueueStats {
    if (this.isEmpty()) {
      return {
        size: 0,
        maxSize: this.config.maxSize,
        isFull: false,
        utilization: 0,
        averagePriority: 0,
        oldestItem: 0,
        newestItem: 0,
        mostAccessed: null,
        leastAccessed: null,
      };
    }

    const priorities = this.items.map(i => i.priority);
    const averagePriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;

    const timestamps = this.items.map(i => i.timestamp);
    const accessCounts = this.items.map(i => ({ id: i.id, count: i.accessCount }));

    return {
      size: this.items.length,
      maxSize: this.config.maxSize,
      isFull: this.isFull(),
      utilization: this.items.length / this.config.maxSize,
      averagePriority,
      oldestItem: Math.min(...timestamps),
      newestItem: Math.max(...timestamps),
      mostAccessed: accessCounts.reduce((max, c) => c.count > max.count ? c : max),
      leastAccessed: accessCounts.reduce((min, c) => c.count < min.count ? c : min),
    };
  }

  private itemExists(id: string): boolean {
    return this.items.some(i => i.id === id);
  }

  private updateItem(item: PriorityQueueItem<T>): void {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items[index] = { ...item, accessCount: this.items[index].accessCount + 1 };
    }
  }

  private findInsertIndex(priority: number): number {
    let left = 0;
    let right = this.items.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].priority < priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  private evict(): void {
    // Remove lowest priority item (last in array)
    this.items.pop();
  }

  private clampPriority(priority: number): number {
    return Math.max(
      this.config.priorityRange.min,
      Math.min(this.config.priorityRange.max, priority)
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPriorityQueue<T = unknown>(
  config: Partial<PriorityQueueConfig> = {}
): IPriorityQueue<T> {
  const fullConfig = { ...DEFAULT_QUEUE_CONFIG, ...config };
  
  // Use sorted array for small queues, heap for large ones
  if (fullConfig.maxSize <= 100) {
    return new SortedArrayPriorityQueue<T>(config);
  }
  
  return new BinaryHeapPriorityQueue<T>(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function createItem<T>(
  id: string,
  priority: number,
  data: T
): PriorityQueueItem<T> {
  return {
    id,
    priority,
    data,
    timestamp: Date.now(),
    accessCount: 0,
  };
}

export function mergeQueues<T>(
  queues: IPriorityQueue<T>[],
  config?: Partial<PriorityQueueConfig>
): IPriorityQueue<T> {
  const merged = createPriorityQueue<T>(config);
  
  for (const queue of queues) {
    for (const item of queue.toArray()) {
      merged.enqueue(item);
    }
  }
  
  return merged;
}
