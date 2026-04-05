/**
 * Agent Module - Refactored Multi-Agent Orchestration System
 * 
 * This module provides a comprehensive multi-agent coordination system
 * inspired by Claude Code's agent orchestration capabilities.
 * 
 * Architecture:
 * - AgentOrchestrator: Main coordinator for multi-agent task execution
 * - PlanningAgent: Analyzes tasks and creates execution plans
 * - TaskGraph: Manages task dependencies and parallelization
 * - AgentPool: Manages pool of sub-agents for parallel execution
 * - ResultAggregator: Aggregates results from multiple agents
 * - CheckpointManager: Enables fault tolerance and recovery
 * - AgentMessageBus: Facilitates inter-agent communication
 * 
 * Features:
 * - True parallel task execution
 * - Dynamic task decomposition
 * - Dependency management
 * - Checkpoint/recovery (断点续传)
 * - Inter-agent messaging
 * - Multiple aggregation strategies
 * 
 * @module Agent
 * @version 2.0.0
 */

// Core Orchestrator
export {
  AgentOrchestrator,
  createOrchestrator,
  type ExecutionPlan,
  type ExecutionContext,
  type OrchestratorConfig,
  type OrchestratorEvents,
} from './orchestrator';

// Planning Agent
export {
  PlanningAgent,
  createPlanningAgent,
  type SubTask,
  type TaskAnalysis,
  type TaskDependency,
  type PlanningAgentConfig,
} from './planner';

// Agent Pool
export {
  AgentPool,
  createAgentPool,
  type PoolAgent,
  type AgentPoolConfig,
  type AcquireAgentOptions,
  type AgentPoolStats,
  type AgentFactory,
} from './pool';

// Result Aggregator
export {
  ResultAggregator,
  createResultAggregator,
  type AggregationStrategy,
  type AggregatorConfig,
  type AggregatedResult,
  type Conflict,
  type ResultScore,
} from './aggregator';

// Task Graph
export {
  TaskGraph,
  createTaskGraph,
  type TaskNode,
  type DependencyType,
  type DependencyEdge,
  type Graph,
} from './task-graph';

// Checkpoint Manager
export {
  CheckpointManager,
  createCheckpointManager,
  FileSystemCheckpointStorage,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointConfig,
  type CheckpointStorage,
  type CheckpointSummary,
  type ResumeOptions,
} from './checkpoint';

// Message Bus
export {
  AgentMessageBus,
  createMessageBus,
  createMessageFilter,
  createBroadcastMessage,
  type AgentMessageType,
  type AgentMessage,
  type MessageHandler,
  type MessageFilter,
  type MessageBusConfig,
  type MessageBusStats,
} from './message-bus';

// Legacy exports for backward compatibility
export { AgentTool, AgentInputSchema, AgentOutputSchema } from '../tools/implementations/agent/AgentTool';
export { PlanTool, PlanInputSchema, PlanOutputSchema } from '../tools/implementations/agent/PlanTool';

// Re-export from core for backward compatibility
export { BaseAgent } from '@core/base-classes';
export type { IAgent, IAgentOrchestrator } from '@core/interfaces';
export { AgentLoop } from '@core/AgentLoop';
export type { AgentEvents, AgentOptions } from '@core/AgentLoop';
