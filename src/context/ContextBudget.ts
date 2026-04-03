/**
 * Context Budget - Token budget management for context compression
 * 
 * Manages token allocation across different context components:
 * - Conversation history
 * - Memory system
 * - System prompts
 * - Working context
 * - Safety buffer
 * 
 * Provides automatic budget rebalancing and threshold monitoring.
 */

import type {
  TokenBudget,
  BudgetAllocation,
  BudgetThresholds,
  TokenUsage,
  ContextMessage,
} from './types/index.js';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_RESERVE_TOKENS,
  DEFAULT_BUFFER_TOKENS,
  countMessageTokens,
  calculateBudget,
  calculateCompressionSavings,
} from './utils/tokenCounter.js';
import { EventEmitter } from 'events';

// ============================================================================
// Budget Events
// ============================================================================

export interface BudgetEvents {
  'warning': { utilization: number; available: number };
  'critical': { utilization: number; available: number };
  'emergency': { utilization: number; available: number };
  'rebalanced': { oldAllocation: BudgetAllocation; newAllocation: BudgetAllocation };
  'tokens-reclaimed': { component: string; tokens: number };
}

// ============================================================================
// Budget Configuration
// ============================================================================

export interface BudgetConfig {
  maxTokens: number;
  reservedTokens: number;
  bufferTokens: number;
  allocation: BudgetAllocation;
  thresholds: BudgetThresholds;
  autoRebalance: boolean;
  reclaimStrategy: 'proportional' | 'priority' | 'oldest-first';
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxTokens: DEFAULT_MAX_TOKENS,
  reservedTokens: DEFAULT_RESERVE_TOKENS,
  bufferTokens: DEFAULT_BUFFER_TOKENS,
  allocation: {
    conversation: 0.6,
    memory: 0.15,
    system: 0.1,
    working: 0.1,
    buffer: 0.05,
  },
  thresholds: {
    warning: 0.7,
    critical: 0.8,
    emergency: 0.95,
  },
  autoRebalance: true,
  reclaimStrategy: 'priority',
};

// ============================================================================
// Component Usage Tracking
// ============================================================================

interface ComponentUsage {
  component: string;
  used: number;
  allocated: number;
  priority: number;
  reclaimable: boolean;
  lastAccessed: number;
}

// ============================================================================
// Context Budget Manager
// ============================================================================

export class ContextBudget extends EventEmitter {
  private config: BudgetConfig;
  private usage: Map<string, ComponentUsage> = new Map();
  private messages: ContextMessage[] = [];
  private lastRebalanceTime: number = 0;
  private rebalanceCooldown: number = 5000; // 5 seconds

  constructor(config: Partial<BudgetConfig> = {}) {
    super();
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
    this.initializeComponents();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private initializeComponents(): void {
    const components = ['conversation', 'memory', 'system', 'working', 'buffer'];
    
    for (const component of components) {
      const allocation = this.config.allocation[component as keyof BudgetAllocation];
      this.usage.set(component, {
        component,
        used: 0,
        allocated: Math.floor(this.config.maxTokens * allocation),
        priority: this.getComponentPriority(component),
        reclaimable: component !== 'system' && component !== 'buffer',
        lastAccessed: Date.now(),
      });
    }
  }

  private getComponentPriority(component: string): number {
    const priorities: Record<string, number> = {
      system: 10,
      buffer: 9,
      conversation: 8,
      working: 6,
      memory: 4,
    };
    return priorities[component] || 5;
  }

  // --------------------------------------------------------------------------
  // Budget Queries
  // --------------------------------------------------------------------------

  getBudget(): TokenBudget {
    const totalUsed = this.getTotalUsed();
    const available = this.config.maxTokens - totalUsed - this.config.reservedTokens;

    return {
      total: this.config.maxTokens,
      reserved: this.config.reservedTokens,
      used: totalUsed,
      available: Math.max(0, available),
      thresholds: this.config.thresholds,
    };
  }

  getUtilization(): number {
    return this.getTotalUsed() / this.config.maxTokens;
  }

  getTotalUsed(): number {
    let total = 0;
    for (const usage of this.usage.values()) {
      total += usage.used;
    }
    return total;
  }

  getAvailableTokens(): number {
    return this.config.maxTokens - this.getTotalUsed() - this.config.reservedTokens;
  }

  getComponentUsage(component: string): ComponentUsage | undefined {
    return this.usage.get(component);
  }

  getAllUsage(): ComponentUsage[] {
    return Array.from(this.usage.values());
  }

  // --------------------------------------------------------------------------
  // Threshold Checking
  // --------------------------------------------------------------------------

  checkThresholds(): {
    warning: boolean;
    critical: boolean;
    emergency: boolean;
    utilization: number;
  } {
    const utilization = this.getUtilization();
    const { warning, critical, emergency } = this.config.thresholds;

    const result = {
      warning: utilization >= warning,
      critical: utilization >= critical,
      emergency: utilization >= emergency,
      utilization,
    };

    // Emit events if thresholds crossed
    if (result.emergency) {
      this.emit('emergency', { utilization, available: this.getAvailableTokens() });
    } else if (result.critical) {
      this.emit('critical', { utilization, available: this.getAvailableTokens() });
    } else if (result.warning) {
      this.emit('warning', { utilization, available: this.getAvailableTokens() });
    }

    return result;
  }

  isNearLimit(threshold: 'warning' | 'critical' | 'emergency' = 'critical'): boolean {
    const utilization = this.getUtilization();
    return utilization >= this.config.thresholds[threshold];
  }

  // --------------------------------------------------------------------------
  // Token Allocation
  // --------------------------------------------------------------------------

  allocateTokens(component: string, tokens: number): boolean {
    const usage = this.usage.get(component);
    if (!usage) {
      return false;
    }

    const available = this.getAvailableTokens();
    if (tokens > available) {
      return false;
    }

    usage.used += tokens;
    usage.lastAccessed = Date.now();
    
    this.checkThresholds();
    return true;
  }

  allocateTokensForce(component: string, tokens: number): {
    success: boolean;
    reclaimed: number;
  } {
    const usage = this.usage.get(component);
    if (!usage) {
      return { success: false, reclaimed: 0 };
    }

    const available = this.getAvailableTokens();
    
    if (tokens <= available) {
      usage.used += tokens;
      usage.lastAccessed = Date.now();
      return { success: true, reclaimed: 0 };
    }

    // Need to reclaim tokens
    const needed = tokens - available;
    const reclaimed = this.reclaimTokens(needed);

    if (reclaimed >= needed) {
      usage.used += tokens;
      usage.lastAccessed = Date.now();
      return { success: true, reclaimed };
    }

    // Could not reclaim enough
    return { success: false, reclaimed };
  }

  releaseTokens(component: string, tokens: number): boolean {
    const usage = this.usage.get(component);
    if (!usage) {
      return false;
    }

    usage.used = Math.max(0, usage.used - tokens);
    return true;
  }

  setComponentUsage(component: string, tokens: number): void {
    const usage = this.usage.get(component);
    if (usage) {
      usage.used = tokens;
      usage.lastAccessed = Date.now();
      this.checkThresholds();
    }
  }

  // --------------------------------------------------------------------------
  // Message Management
  // --------------------------------------------------------------------------

  setMessages(messages: ContextMessage[]): void {
    this.messages = messages;
    const conversationTokens = countMessageTokens(messages);
    this.setComponentUsage('conversation', conversationTokens);
  }

  addMessage(message: ContextMessage): boolean {
    const messageTokens = message.tokenCount || countMessageTokens([message]);
    
    if (!this.allocateTokens('conversation', messageTokens)) {
      // Try to reclaim and allocate
      const result = this.allocateTokensForce('conversation', messageTokens);
      if (!result.success) {
        return false;
      }
    }

    this.messages.push(message);
    return true;
  }

  removeMessage(messageId: string): boolean {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index === -1) {
      return false;
    }

    const message = this.messages[index];
    const tokens = message.tokenCount || countMessageTokens([message]);
    
    this.messages.splice(index, 1);
    this.releaseTokens('conversation', tokens);
    
    return true;
  }

  getMessages(): ContextMessage[] {
    return [...this.messages];
  }

  // --------------------------------------------------------------------------
  // Token Reclamation
  // --------------------------------------------------------------------------

  reclaimTokens(amount: number): number {
    let reclaimed = 0;
    const reclaimable = this.getReclaimableComponents();

    switch (this.config.reclaimStrategy) {
      case 'proportional':
        reclaimed = this.reclaimProportional(amount, reclaimable);
        break;
      case 'priority':
        reclaimed = this.reclaimByPriority(amount, reclaimable);
        break;
      case 'oldest-first':
        reclaimed = this.reclaimOldestFirst(amount, reclaimable);
        break;
    }

    if (reclaimed > 0) {
      this.emit('tokens-reclaimed', { component: 'multiple', tokens: reclaimed });
    }

    return reclaimed;
  }

  private getReclaimableComponents(): ComponentUsage[] {
    return Array.from(this.usage.values())
      .filter(u => u.reclaimable && u.used > 0)
      .sort((a, b) => a.priority - b.priority);
  }

  private reclaimProportional(
    amount: number,
    components: ComponentUsage[]
  ): number {
    let reclaimed = 0;
    const totalUsed = components.reduce((sum, c) => sum + c.used, 0);

    if (totalUsed === 0) {
      return 0;
    }

    for (const component of components) {
      const proportion = component.used / totalUsed;
      const toReclaim = Math.min(
        Math.floor(amount * proportion),
        component.used
      );
      
      component.used -= toReclaim;
      reclaimed += toReclaim;

      if (reclaimed >= amount) {
        break;
      }
    }

    return reclaimed;
  }

  private reclaimByPriority(
    amount: number,
    components: ComponentUsage[]
  ): number {
    let reclaimed = 0;

    // Sort by priority (lowest first)
    const sorted = [...components].sort((a, b) => a.priority - b.priority);

    for (const component of sorted) {
      const toReclaim = Math.min(amount - reclaimed, component.used);
      component.used -= toReclaim;
      reclaimed += toReclaim;

      if (reclaimed >= amount) {
        break;
      }
    }

    return reclaimed;
  }

  private reclaimOldestFirst(
    amount: number,
    components: ComponentUsage[]
  ): number {
    let reclaimed = 0;

    // Sort by last accessed (oldest first)
    const sorted = [...components].sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const component of sorted) {
      const toReclaim = Math.min(amount - reclaimed, component.used);
      component.used -= toReclaim;
      reclaimed += toReclaim;

      if (reclaimed >= amount) {
        break;
      }
    }

    return reclaimed;
  }

  // --------------------------------------------------------------------------
  // Budget Rebalancing
  // --------------------------------------------------------------------------

  rebalance(): boolean {
    const now = Date.now();
    if (now - this.lastRebalanceTime < this.rebalanceCooldown) {
      return false;
    }

    const oldAllocation = { ...this.config.allocation };
    const utilization = this.getUtilization();

    // Adjust allocations based on usage patterns
    if (utilization > this.config.thresholds.critical) {
      // Reduce memory allocation, increase conversation
      this.config.allocation.memory *= 0.8;
      this.config.allocation.conversation += this.config.allocation.memory * 0.2;
    } else if (utilization < this.config.thresholds.warning) {
      // Can increase memory allocation
      const headroom = this.config.thresholds.warning - utilization;
      this.config.allocation.memory = Math.min(
        0.25,
        this.config.allocation.memory + headroom * 0.1
      );
    }

    // Normalize allocations
    this.normalizeAllocations();

    // Update component allocations
    for (const [component, usage] of this.usage) {
      usage.allocated = Math.floor(
        this.config.maxTokens * this.config.allocation[component as keyof BudgetAllocation]
      );
    }

    this.lastRebalanceTime = now;
    this.emit('rebalanced', { oldAllocation, newAllocation: { ...this.config.allocation } });

    return true;
  }

  private normalizeAllocations(): void {
    const total = Object.values(this.config.allocation).reduce((a, b) => a + b, 0);
    
    if (total !== 1) {
      for (const key of Object.keys(this.config.allocation)) {
        this.config.allocation[key as keyof BudgetAllocation] /= total;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Compression Planning
  // --------------------------------------------------------------------------

  calculateCompressionNeeded(): {
    needed: boolean;
    targetTokens: number;
    currentTokens: number;
    strategy: 'none' | 'light' | 'aggressive';
  } {
    const budget = this.getBudget();
    const utilization = this.getUtilization();

    if (utilization < this.config.thresholds.warning) {
      return {
        needed: false,
        targetTokens: budget.available,
        currentTokens: this.getTotalUsed(),
        strategy: 'none',
      };
    }

    let strategy: 'none' | 'light' | 'aggressive' = 'none';
    let targetReduction = 0;

    if (utilization >= this.config.thresholds.emergency) {
      strategy = 'aggressive';
      targetReduction = 0.5; // Reduce by 50%
    } else if (utilization >= this.config.thresholds.critical) {
      strategy = 'light';
      targetReduction = 0.2; // Reduce by 20%
    } else {
      strategy = 'light';
      targetReduction = 0.1; // Reduce by 10%
    }

    const targetTokens = Math.floor(this.getTotalUsed() * (1 - targetReduction));

    return {
      needed: strategy !== 'none',
      targetTokens,
      currentTokens: this.getTotalUsed(),
      strategy,
    };
  }

  estimateCompressionSavings(
    compressionLevel: 'light' | 'medium' | 'heavy'
  ): { saved: number; remaining: number } {
    const ratios: Record<string, number> = {
      light: 0.8,
      medium: 0.5,
      heavy: 0.3,
    };

    const conversationTokens = this.usage.get('conversation')?.used || 0;
    const memoryTokens = this.usage.get('memory')?.used || 0;

    const compressible = conversationTokens + memoryTokens;
    const saved = Math.floor(compressible * (1 - ratios[compressionLevel]));

    return {
      saved,
      remaining: this.getTotalUsed() - saved,
    };
  }

  // --------------------------------------------------------------------------
  // Statistics and Reporting
  // --------------------------------------------------------------------------

  getStatistics(): {
    totalTokens: number;
    usedTokens: number;
    availableTokens: number;
    reservedTokens: number;
    utilization: number;
    byComponent: Record<string, { used: number; allocated: number; utilization: number }>;
  } {
    const byComponent: Record<string, { used: number; allocated: number; utilization: number }> = {};

    for (const [name, usage] of this.usage) {
      byComponent[name] = {
        used: usage.used,
        allocated: usage.allocated,
        utilization: usage.allocated > 0 ? usage.used / usage.allocated : 0,
      };
    }

    return {
      totalTokens: this.config.maxTokens,
      usedTokens: this.getTotalUsed(),
      availableTokens: this.getAvailableTokens(),
      reservedTokens: this.config.reservedTokens,
      utilization: this.getUtilization(),
      byComponent,
    };
  }

  generateReport(): string {
    const stats = this.getStatistics();
    const budget = this.getBudget();
    const thresholds = this.checkThresholds();

    let report = '=== Context Budget Report ===\n\n';
    report += `Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;
    report += `Used Tokens: ${stats.usedTokens.toLocaleString()} (${(stats.utilization * 100).toFixed(1)}%)\n`;
    report += `Available Tokens: ${stats.availableTokens.toLocaleString()}\n`;
    report += `Reserved Tokens: ${stats.reservedTokens.toLocaleString()}\n\n`;

    report += '--- Component Breakdown ---\n';
    for (const [name, comp] of Object.entries(stats.byComponent)) {
      report += `${name}: ${comp.used.toLocaleString()} / ${comp.allocated.toLocaleString()} `;
      report += `(${(comp.utilization * 100).toFixed(1)}%)\n`;
    }

    report += '\n--- Threshold Status ---\n';
    report += `Warning: ${thresholds.warning ? 'TRIGGERED' : 'OK'} (${(this.config.thresholds.warning * 100).toFixed(0)}%)\n`;
    report += `Critical: ${thresholds.critical ? 'TRIGGERED' : 'OK'} (${(this.config.thresholds.critical * 100).toFixed(0)}%)\n`;
    report += `Emergency: ${thresholds.emergency ? 'TRIGGERED' : 'OK'} (${(this.config.thresholds.emergency * 100).toFixed(0)}%)\n`;

    return report;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<BudgetConfig>): void {
    const oldMaxTokens = this.config.maxTokens;
    this.config = { ...this.config, ...config };

    // Reinitialize if max tokens changed
    if (this.config.maxTokens !== oldMaxTokens) {
      this.initializeComponents();
    }
  }

  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  reset(): void {
    this.initializeComponents();
    this.messages = [];
    this.lastRebalanceTime = 0;
  }

  dispose(): void {
    this.removeAllListeners();
    this.usage.clear();
    this.messages = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createContextBudget(
  config?: Partial<BudgetConfig>
): ContextBudget {
  return new ContextBudget(config);
}
