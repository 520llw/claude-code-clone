/**
 * Event System
 * 
 * This module provides a robust event system for inter-module communication
 * with support for typed events, priorities, and async handlers.
 */

import type { IEventEmitter, EventHandler } from '@core/interfaces';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event priority levels
 */
export enum EventPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/**
 * Event listener entry
 */
interface EventListener<T = unknown> {
  handler: EventHandler<T>;
  priority: EventPriority;
  once: boolean;
}

/**
 * Event options
 */
export interface EventOptions {
  priority?: EventPriority;
  once?: boolean;
}

// ============================================================================
// Event Emitter Implementation
// ============================================================================

/**
 * Event emitter implementation
 */
export class EventEmitter implements IEventEmitter {
  private listeners: Map<string, EventListener[]> = new Map();
  private isDisposedFlag = false;

  /**
   * Register an event handler
   */
  on<T>(event: string, handler: EventHandler<T>, options: EventOptions = {}): void {
    this.ensureNotDisposed();
    
    const { priority = EventPriority.NORMAL, once = false } = options;
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const listeners = this.listeners.get(event)!;
    listeners.push({ handler: handler as EventHandler, priority, once });
    
    // Sort by priority (lower number = higher priority)
    listeners.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Register a one-time event handler
   */
  once<T>(event: string, handler: EventHandler<T>, priority?: EventPriority): void {
    this.on(event, handler, { priority, once: true });
  }

  /**
   * Remove an event handler
   */
  off<T>(event: string, handler: EventHandler<T>): void {
    this.ensureNotDisposed();
    
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.handler === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event
   */
  emit<T>(event: string, data: T): void {
    this.ensureNotDisposed();
    
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return;
    
    // Execute handlers
    const toRemove: number[] = [];
    
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      
      try {
        listener.handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
      
      if (listener.once) {
        toRemove.push(i);
      }
    }
    
    // Remove one-time listeners (in reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      listeners.splice(toRemove[i], 1);
    }
  }

  /**
   * Emit an event asynchronously
   */
  async emitAsync<T>(event: string, data: T): Promise<void> {
    this.ensureNotDisposed();
    
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return;
    
    // Execute handlers asynchronously
    const toRemove: number[] = [];
    
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      
      try {
        await listener.handler(data);
      } catch (error) {
        console.error(`Error in async event handler for "${event}":`, error);
      }
      
      if (listener.once) {
        toRemove.push(i);
      }
    }
    
    // Remove one-time listeners
    for (let i = toRemove.length - 1; i >= 0; i--) {
      listeners.splice(toRemove[i], 1);
    }
  }

  /**
   * Emit an event and wait for all handlers to complete
   */
  async emitAndWait<T, R = unknown>(
    event: string,
    data: T
  ): Promise<R[]> {
    this.ensureNotDisposed();
    
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) return [];
    
    const results: R[] = [];
    const toRemove: number[] = [];
    
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      
      try {
        const result = await listener.handler(data);
        if (result !== undefined) {
          results.push(result as R);
        }
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
      
      if (listener.once) {
        toRemove.push(i);
      }
    }
    
    // Remove one-time listeners
    for (let i = toRemove.length - 1; i >= 0; i--) {
      listeners.splice(toRemove[i], 1);
    }
    
    return results;
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners(event?: string): void {
    this.ensureNotDisposed();
    
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: string): number {
    const listeners = this.listeners.get(event);
    return listeners?.length ?? 0;
  }

  /**
   * Get all event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isDisposedFlag) return;
    
    this.removeAllListeners();
    this.isDisposedFlag = true;
  }

  /**
   * Check if disposed
   */
  get isDisposed(): boolean {
    return this.isDisposedFlag;
  }

  private ensureNotDisposed(): void {
    if (this.isDisposedFlag) {
      throw new Error('EventEmitter has been disposed');
    }
  }
}

// ============================================================================
// Event Bus
// ============================================================================

/**
 * Global event bus for cross-module communication
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private namespaces: Map<string, EventEmitter> = new Map();

  /**
   * Get the singleton instance
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Get or create a namespaced event emitter
   */
  namespace(name: string): EventEmitter {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new EventEmitter());
    }
    return this.namespaces.get(name)!;
  }

  /**
   * Remove a namespace
   */
  removeNamespace(name: string): void {
    const emitter = this.namespaces.get(name);
    if (emitter) {
      emitter.dispose();
      this.namespaces.delete(name);
    }
  }

  /**
   * Get all namespace names
   */
  getNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  /**
   * Dispose of all resources
   */
  override dispose(): void {
    for (const [name, emitter] of this.namespaces) {
      emitter.dispose();
    }
    this.namespaces.clear();
    super.dispose();
  }
}

// ============================================================================
// Typed Event Emitter
// ============================================================================

/**
 * Type-safe event emitter for specific event types
 */
export class TypedEventEmitter<TEventMap extends Record<string, unknown>> {
  private emitter = new EventEmitter();

  /**
   * Register an event handler
   */
  on<K extends keyof TEventMap>(
    event: K,
    handler: EventHandler<TEventMap[K]>,
    options?: EventOptions
  ): void {
    this.emitter.on(event as string, handler, options);
  }

  /**
   * Register a one-time event handler
   */
  once<K extends keyof TEventMap>(
    event: K,
    handler: EventHandler<TEventMap[K]>,
    priority?: EventPriority
  ): void {
    this.emitter.once(event as string, handler, priority);
  }

  /**
   * Remove an event handler
   */
  off<K extends keyof TEventMap>(
    event: K,
    handler: EventHandler<TEventMap[K]>
  ): void {
    this.emitter.off(event as string, handler);
  }

  /**
   * Emit an event
   */
  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
    this.emitter.emit(event as string, data);
  }

  /**
   * Emit an event asynchronously
   */
  emitAsync<K extends keyof TEventMap>(event: K, data: TEventMap[K]): Promise<void> {
    return this.emitter.emitAsync(event as string, data);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: keyof TEventMap): void {
    this.emitter.removeAllListeners(event as string);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.emitter.dispose();
  }
}

// ============================================================================
// Event Middleware
// ============================================================================

/**
 * Event middleware function type
 */
export type EventMiddleware<T = unknown> = (
  data: T,
  next: () => void
) => void | Promise<void>;

/**
 * Event pipeline with middleware support
 */
export class EventPipeline<T = unknown> {
  private middlewares: EventMiddleware<T>[] = [];

  /**
   * Add middleware to the pipeline
   */
  use(middleware: EventMiddleware<T>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute the pipeline
   */
  async execute(data: T): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) return;
      
      const middleware = this.middlewares[index++];
      await middleware(data, next);
    };

    await next();
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = [];
  }
}

// ============================================================================
// Predefined Events
// ============================================================================

/**
 * System events
 */
export const SystemEvents = {
  // Lifecycle events
  INITIALIZED: 'system:initialized',
  SHUTDOWN: 'system:shutdown',
  ERROR: 'system:error',
  
  // Configuration events
  CONFIG_LOADED: 'system:config:loaded',
  CONFIG_CHANGED: 'system:config:changed',
  
  // Feature events
  FEATURE_ENABLED: 'system:feature:enabled',
  FEATURE_DISABLED: 'system:feature:disabled',
} as const;

/**
 * Agent events
 */
export const AgentEvents = {
  // Lifecycle events
  INITIALIZED: 'agent:initialized',
  TERMINATED: 'agent:terminated',
  ERROR: 'agent:error',
  
  // Task events
  TASK_STARTED: 'agent:task:started',
  TASK_COMPLETED: 'agent:task:completed',
  TASK_FAILED: 'agent:task:failed',
  
  // Message events
  MESSAGE_RECEIVED: 'agent:message:received',
  MESSAGE_SENT: 'agent:message:sent',
  
  // State events
  STATE_CHANGED: 'agent:state:changed',
  PAUSED: 'agent:paused',
  RESUMED: 'agent:resumed',
} as const;

/**
 * Session events
 */
export const SessionEvents = {
  CREATED: 'session:created',
  STARTED: 'session:started',
  ENDED: 'session:ended',
  SAVED: 'session:saved',
  LOADED: 'session:loaded',
  MESSAGE_ADDED: 'session:message:added',
} as const;

/**
 * Tool events
 */
export const ToolEvents = {
  BEFORE_EXECUTE: 'tool:before:execute',
  AFTER_EXECUTE: 'tool:after:execute',
  ERROR: 'tool:error',
  PERMISSION_REQUESTED: 'tool:permission:requested',
  PERMISSION_GRANTED: 'tool:permission:granted',
  PERMISSION_DENIED: 'tool:permission:denied',
} as const;

/**
 * Plugin events
 */
export const PluginEvents = {
  LOADED: 'plugin:loaded',
  ACTIVATED: 'plugin:activated',
  DEACTIVATED: 'plugin:deactivated',
  ERROR: 'plugin:error',
} as const;

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global event bus instance
 */
export const eventBus = EventBus.getInstance();

export default eventBus;
