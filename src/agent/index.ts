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

// Placeholder for future agent implementations
// These will be implemented in separate files:
// - parent-agent.ts
// - sub-agent.ts
// - orchestrator.ts
// - registry.ts
