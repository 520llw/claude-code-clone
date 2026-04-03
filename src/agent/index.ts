/**
 * Agent Module
 *
 * This module exports all agent-related classes and interfaces.
 */

// Types
export type {
  AgentConfig,
  AgentInfo,
  AgentState,
  AgentType,
  AgentCapability,
  AgentEvent,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
} from '@types/index';

// Re-export from core
export { BaseAgent } from '@core/base-classes';
export type { IAgent, IAgentOrchestrator } from '@core/interfaces';
export { AgentLoop } from '@core/AgentLoop';
export type { AgentEvents, AgentOptions } from '@core/AgentLoop';

// Sub-agent system
export { SubAgent } from './sub-agent';
export type { SubAgentOptions } from './sub-agent';
export { AgentOrchestrator } from './orchestrator';
export type { OrchestratorConfig } from './orchestrator';
