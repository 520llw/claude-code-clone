/**
 * Agent Message Bus
 * 
 * Agent间通信系统。
 * 支持:
 * - 点对点通信
 * - 广播消息
 * - 发布/订阅模式
 * - 消息路由
 * 
 * @module AgentMessageBus
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../core/events';
import { UUID } from '../types/index';

// ============================================================================
// Types
// ============================================================================

/**
 * 消息类型
 */
export type AgentMessageType = 
  | 'request_help'
  | 'share_result'
  | 'coordination'
  | 'heartbeat'
  | 'status_update'
  | 'command'
  | 'response'
  | 'broadcast';

/**
 * Agent消息
 */
export interface AgentMessage {
  id: UUID;
  type: AgentMessageType;
  from: UUID;
  to?: UUID; // undefined表示广播
  planId?: UUID;
  payload: unknown;
  timestamp: number;
  priority: number;
  ttl: number; // 生存时间（毫秒）
  correlationId?: UUID; // 用于请求-响应模式
}

/**
 * 消息处理器
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * 消息过滤器
 */
export interface MessageFilter {
  types?: AgentMessageType[];
  from?: UUID[];
  to?: UUID[];
  planId?: UUID;
  minPriority?: number;
}

/**
 * 消息总线配置
 */
export interface MessageBusConfig {
  maxQueueSize: number;
  defaultTTL: number;
  maxPriority: number;
  enablePersistence: boolean;
  deliveryGuarantee: 'at-most-once' | 'at-least-once' | 'exactly-once';
}

/**
 * 消息统计
 */
export interface MessageBusStats {
  totalSent: number;
  totalReceived: number;
  totalBroadcast: number;
  queueSize: number;
  droppedMessages: number;
  averageLatency: number;
}

/**
 * 订阅信息
 */
interface Subscription {
  id: UUID;
  agentId: UUID;
  filter: MessageFilter;
  handler: MessageHandler;
}

// ============================================================================
// Agent Message Bus Class
// ============================================================================

export class AgentMessageBus extends EventEmitter {
  private config: MessageBusConfig;
  private subscriptions: Map<UUID, Subscription> = new Map();
  private messageQueue: AgentMessage[] = [];
  private messageHistory: AgentMessage[] = [];
  private pendingResponses: Map<UUID, {
    resolve: (message: AgentMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private stats = {
    totalSent: 0,
    totalReceived: 0,
    totalBroadcast: 0,
    droppedMessages: 0,
    totalLatency: 0,
  };
  private processingInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config?: Partial<MessageBusConfig>) {
    super();
    
    this.config = {
      maxQueueSize: 10000,
      defaultTTL: 60000,
      maxPriority: 10,
      enablePersistence: false,
      deliveryGuarantee: 'at-least-once',
      ...config,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * 初始化消息总线
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 启动消息处理循环
    this.startProcessingLoop();

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * 发送消息
   */
  async send(
    from: UUID,
    to: UUID,
    type: AgentMessageType,
    payload: unknown,
    options?: {
      planId?: UUID;
      priority?: number;
      ttl?: number;
      correlationId?: UUID;
    }
  ): Promise<UUID> {
    const message: AgentMessage = {
      id: uuidv4(),
      type,
      from,
      to,
      planId: options?.planId,
      payload,
      timestamp: Date.now(),
      priority: Math.min(options?.priority || 5, this.config.maxPriority),
      ttl: options?.ttl || this.config.defaultTTL,
      correlationId: options?.correlationId,
    };

    await this.enqueueMessage(message);
    this.stats.totalSent++;
    
    this.emit('messageSent', message);

    return message.id;
  }

  /**
   * 广播消息
   */
  async broadcast(
    from: UUID,
    type: AgentMessageType,
    payload: unknown,
    options?: {
      planId?: UUID;
      priority?: number;
      exclude?: UUID[];
    }
  ): Promise<UUID> {
    const message: AgentMessage = {
      id: uuidv4(),
      type,
      from,
      planId: options?.planId,
      payload,
      timestamp: Date.now(),
      priority: Math.min(options?.priority || 5, this.config.maxPriority),
      ttl: options?.ttl || this.config.defaultTTL,
    };

    await this.enqueueMessage(message);
    this.stats.totalBroadcast++;
    
    this.emit('messageBroadcast', message);

    return message.id;
  }

  /**
   * 发送请求并等待响应
   */
  async sendRequest(
    from: UUID,
    to: UUID,
    type: AgentMessageType,
    payload: unknown,
    timeout = 30000
  ): Promise<AgentMessage> {
    const correlationId = uuidv4();

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // 存储等待响应
      this.pendingResponses.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // 发送请求
      this.send(from, to, type, payload, {
        correlationId,
        priority: 8, // 请求优先级较高
      }).catch(reject);
    });
  }

  /**
   * 发送响应
   */
  async sendResponse(
    from: UUID,
    to: UUID,
    correlationId: UUID,
    payload: unknown,
    success = true
  ): Promise<UUID> {
    return this.send(from, to, 'response', {
      success,
      data: payload,
    }, {
      correlationId,
      priority: 8,
    });
  }

  /**
   * 订阅消息
   */
  subscribe(
    agentId: UUID,
    filter: MessageFilter,
    handler: MessageHandler
  ): UUID {
    const subscriptionId = uuidv4();
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      agentId,
      filter,
      handler,
    });

    this.emit('subscriptionAdded', { subscriptionId, agentId, filter });

    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: UUID): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.emit('subscriptionRemoved', subscriptionId);
    }
    return deleted;
  }

  /**
   * 取消Agent的所有订阅
   */
  unsubscribeAll(agentId: UUID): number {
    const toDelete: UUID[] = [];
    
    for (const [id, sub] of this.subscriptions) {
      if (sub.agentId === agentId) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.subscriptions.delete(id);
    }

    this.emit('subscriptionsCleared', { agentId, count: toDelete.length });

    return toDelete.length;
  }

  /**
   * 获取Agent的消息历史
   */
  getMessageHistory(
    agentId?: UUID,
    options?: {
      limit?: number;
      types?: AgentMessageType[];
      since?: number;
    }
  ): AgentMessage[] {
    let messages = [...this.messageHistory];

    if (agentId) {
      messages = messages.filter(
        m => m.from === agentId || m.to === agentId
      );
    }

    if (options?.types) {
      messages = messages.filter(m => 
        options.types!.includes(m.type)
      );
    }

    if (options?.since) {
      messages = messages.filter(m => 
        m.timestamp >= options.since!
      );
    }

    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
  }

  /**
   * 获取统计信息
   */
  getStats(): MessageBusStats {
    return {
      totalSent: this.stats.totalSent,
      totalReceived: this.stats.totalReceived,
      totalBroadcast: this.stats.totalBroadcast,
      queueSize: this.messageQueue.length,
      droppedMessages: this.stats.droppedMessages,
      averageLatency: this.stats.totalReceived > 0 
        ? this.stats.totalLatency / this.stats.totalReceived 
        : 0,
    };
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    this.stopProcessingLoop();
    
    // 拒绝所有待处理的响应
    for (const [correlationId, { reject, timeout }] of this.pendingResponses) {
      clearTimeout(timeout);
      reject(new Error('MessageBus disposed'));
    }
    this.pendingResponses.clear();

    this.subscriptions.clear();
    this.messageQueue = [];
    this.messageHistory = [];
    
    this.removeAllListeners();
    this.isInitialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 消息入队
   */
  private async enqueueMessage(message: AgentMessage): Promise<void> {
    // 检查队列大小
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.stats.droppedMessages++;
      this.emit('messageDropped', message);
      
      // 移除最低优先级的消息
      const lowestPriorityIndex = this.messageQueue.findIndex(
        m => m.priority < message.priority
      );
      
      if (lowestPriorityIndex >= 0) {
        this.messageQueue.splice(lowestPriorityIndex, 1);
        this.messageQueue.push(message);
      }
      
      return;
    }

    // 按优先级插入
    const insertIndex = this.messageQueue.findIndex(
      m => m.priority < message.priority
    );
    
    if (insertIndex >= 0) {
      this.messageQueue.splice(insertIndex, 0, message);
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * 启动处理循环
   */
  private startProcessingLoop(): void {
    this.processingInterval = setInterval(() => {
      this.processMessages();
    }, 10); // 每10ms处理一次
  }

  /**
   * 停止处理循环
   */
  private stopProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * 处理消息
   */
  private processMessages(): void {
    const now = Date.now();
    const batchSize = 100; // 每批处理100条
    let processed = 0;

    while (this.messageQueue.length > 0 && processed < batchSize) {
      const message = this.messageQueue.shift()!;

      // 检查TTL
      if (now - message.timestamp > message.ttl) {
        this.emit('messageExpired', message);
        continue;
      }

      // 处理消息
      this.deliverMessage(message);
      processed++;
    }
  }

  /**
   * 投递消息
   */
  private deliverMessage(message: AgentMessage): void {
    const startTime = Date.now();

    // 检查是否是响应
    if (message.correlationId && message.type === 'response') {
      const pending = this.pendingResponses.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(message);
        this.pendingResponses.delete(message.correlationId);
        return;
      }
    }

    // 找到匹配的订阅
    const matchingSubs: Subscription[] = [];

    for (const sub of this.subscriptions.values()) {
      if (this.matchesFilter(message, sub.filter)) {
        matchingSubs.push(sub);
      }
    }

    // 投递给匹配的订阅
    for (const sub of matchingSubs) {
      try {
        const result = sub.handler(message);
        if (result instanceof Promise) {
          result.catch(error => {
            this.emit('handlerError', { message, subscription: sub, error });
          });
        }
      } catch (error) {
        this.emit('handlerError', { message, subscription: sub, error });
      }
    }

    // 保存到历史
    if (this.config.enablePersistence) {
      this.messageHistory.push(message);
      
      // 限制历史大小
      if (this.messageHistory.length > 10000) {
        this.messageHistory = this.messageHistory.slice(-5000);
      }
    }

    // 更新统计
    this.stats.totalReceived++;
    this.stats.totalLatency += Date.now() - startTime;

    this.emit('message', message);
  }

  /**
   * 检查消息是否匹配过滤器
   */
  private matchesFilter(message: AgentMessage, filter: MessageFilter): boolean {
    // 检查类型
    if (filter.types && !filter.types.includes(message.type)) {
      return false;
    }

    // 检查发送者
    if (filter.from && !filter.from.includes(message.from)) {
      return false;
    }

    // 检查接收者
    if (filter.to && message.to && !filter.to.includes(message.to)) {
      return false;
    }

    // 检查planId
    if (filter.planId && message.planId !== filter.planId) {
      return false;
    }

    // 检查优先级
    if (filter.minPriority !== undefined && 
        message.priority < filter.minPriority) {
      return false;
    }

    return true;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 创建消息过滤器
 */
export function createMessageFilter(
  options: Partial<MessageFilter> = {}
): MessageFilter {
  return {
    types: options.types,
    from: options.from,
    to: options.to,
    planId: options.planId,
    minPriority: options.minPriority,
  };
}

/**
 * 创建广播消息
 */
export function createBroadcastMessage(
  from: UUID,
  type: AgentMessageType,
  payload: unknown,
  planId?: UUID
): AgentMessage {
  return {
    id: uuidv4(),
    type,
    from,
    planId,
    payload,
    timestamp: Date.now(),
    priority: 5,
    ttl: 60000,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMessageBus(
  config?: Partial<MessageBusConfig>
): AgentMessageBus {
  return new AgentMessageBus(config);
}

export default AgentMessageBus;
