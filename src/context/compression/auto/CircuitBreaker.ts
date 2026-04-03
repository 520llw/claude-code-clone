/**
 * Circuit Breaker - Failure protection for compression operations
 * 
 * Implements the circuit breaker pattern to prevent cascading failures:
 * - Closed: Normal operation
 * - Open: Failing requests are rejected immediately
 * - Half-Open: Testing if service has recovered
 * 
 * Features:
 * - Configurable failure thresholds
 * - Automatic recovery timeout
 * - Success/failure tracking
 * - State change notifications
 */

import { EventEmitter } from 'events';

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
  enabled: boolean;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
  enabled: true,
};

// ============================================================================
// Circuit State
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

// ============================================================================
// Circuit Breaker State
// ============================================================================

export interface CircuitStateData {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  halfOpenCalls: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

// ============================================================================
// Circuit Breaker Events
// ============================================================================

export interface CircuitBreakerEvents {
  'state:change': { from: CircuitState; to: CircuitState };
  'failure': { count: number; threshold: number };
  'success': { count: number };
  'threshold:exceeded': { failures: number };
  'timeout:elapsed': {};
}

// ============================================================================
// Circuit Breaker Class
// ============================================================================

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitStateData;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private createInitialState(): CircuitStateData {
    return {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      halfOpenCalls: 0,
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main API
  // --------------------------------------------------------------------------

  /**
   * Check if an operation can be executed
   */
  canExecute(): boolean {
    if (!this.config.enabled) {
      return true;
    }

    this.checkTimeout();

    switch (this.state.state) {
      case 'closed':
        return true;
      
      case 'open':
        return false;
      
      case 'half-open':
        return this.state.halfOpenCalls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (!this.config.enabled) {
      return;
    }

    this.state.totalCalls++;
    this.state.totalSuccesses++;
    this.state.lastSuccessTime = Date.now();
    this.state.consecutiveSuccesses++;
    this.state.consecutiveFailures = 0;

    switch (this.state.state) {
      case 'half-open':
        this.state.successCount++;
        this.state.halfOpenCalls++;
        
        if (this.state.successCount >= this.config.successThreshold) {
          this.closeCircuit();
        }
        break;
      
      case 'closed':
        // Reset failure count on success
        if (this.state.consecutiveSuccesses >= this.config.successThreshold) {
          this.state.failureCount = 0;
        }
        break;
    }

    this.emit('success', { count: this.state.successCount });
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    if (!this.config.enabled) {
      return;
    }

    this.state.totalCalls++;
    this.state.totalFailures++;
    this.state.lastFailureTime = Date.now();
    this.state.consecutiveFailures++;
    this.state.consecutiveSuccesses = 0;

    switch (this.state.state) {
      case 'half-open':
        this.openCircuit();
        break;
      
      case 'closed':
        this.state.failureCount++;
        
        this.emit('failure', { 
          count: this.state.failureCount, 
          threshold: this.config.failureThreshold 
        });

        if (this.state.failureCount >= this.config.failureThreshold) {
          this.emit('threshold:exceeded', { failures: this.state.failureCount });
          this.openCircuit();
        }
        break;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    if (!this.canExecute()) {
      if (fallback) {
        return fallback();
      }
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Synchronous execute
   */
  executeSync<T>(fn: () => T, fallback?: () => T): T {
    if (!this.canExecute()) {
      if (fallback) {
        return fallback();
      }
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private openCircuit(): void {
    const previousState = this.state.state;
    this.state.state = 'open';
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.halfOpenCalls = 0;

    this.emit('state:change', { from: previousState, to: 'open' });
  }

  private closeCircuit(): void {
    const previousState = this.state.state;
    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.consecutiveFailures = 0;
    this.state.halfOpenCalls = 0;

    this.emit('state:change', { from: previousState, to: 'closed' });
  }

  private halfOpenCircuit(): void {
    const previousState = this.state.state;
    this.state.state = 'half-open';
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.halfOpenCalls = 0;

    this.emit('state:change', { from: previousState, to: 'half-open' });
    this.emit('timeout:elapsed', {});
  }

  private checkTimeout(): void {
    if (this.state.state !== 'open') {
      return;
    }

    const elapsed = Date.now() - this.state.lastFailureTime;
    if (elapsed >= this.config.timeout) {
      this.halfOpenCircuit();
    }
  }

  // --------------------------------------------------------------------------
  // Public State Control
  // --------------------------------------------------------------------------

  /**
   * Force the circuit open
   */
  forceOpen(): void {
    this.openCircuit();
  }

  /**
   * Force the circuit closed
   */
  forceClose(): void {
    this.closeCircuit();
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    const previousState = this.state.state;
    this.state = this.createInitialState();
    
    if (previousState !== 'closed') {
      this.emit('state:change', { from: previousState, to: 'closed' });
    }
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get current circuit state
   */
  getState(): CircuitStateData {
    // Check timeout before returning state
    this.checkTimeout();
    return { ...this.state };
  }

  /**
   * Get current state name
   */
  getCurrentState(): CircuitState {
    return this.getState().state;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.getCurrentState() === 'closed';
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.getCurrentState() === 'open';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.getCurrentState() === 'half-open';
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
    failureRate: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
  } {
    return {
      totalCalls: this.state.totalCalls,
      totalFailures: this.state.totalFailures,
      totalSuccesses: this.state.totalSuccesses,
      failureRate: this.state.totalCalls > 0 
        ? this.state.totalFailures / this.state.totalCalls 
        : 0,
      consecutiveFailures: this.state.consecutiveFailures,
      consecutiveSuccesses: this.state.consecutiveSuccesses,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.reset();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return new CircuitBreaker(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  return breaker.execute(fn, fallback);
}

export function isCircuitHealthy(breaker: CircuitBreaker): boolean {
  return breaker.isClosed() || breaker.isHalfOpen();
}

export function getCircuitStatus(breaker: CircuitBreaker): {
  state: CircuitState;
  canExecute: boolean;
  stats: ReturnType<CircuitBreaker['getStats']>;
} {
  return {
    state: breaker.getCurrentState(),
    canExecute: breaker.canExecute(),
    stats: breaker.getStats(),
  };
}
