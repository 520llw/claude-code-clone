/**
 * Skills System - Type Definitions
 * 
 * Comprehensive type definitions for the Claude Code Skills system.
 * Supports skill composition, versioning, and marketplace integration.
 */

import { z } from 'zod';

// ============================================================================
// Core Skill Types
// ============================================================================

/**
 * Unique identifier for a skill
 */
export type SkillId = string;

/**
 * Semantic version for skills
 */
export type SkillVersion = `${number}.${number}.${number}`;

/**
 * Skill categories for organization
 */
export type SkillCategory = 
  | 'code' 
  | 'analysis' 
  | 'generation' 
  | 'git' 
  | 'utility' 
  | 'custom';

/**
 * Skill execution status
 */
export type SkillExecutionStatus = 
  | 'idle'
  | 'loading'
  | 'validating'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Skill lifecycle states
 */
export type SkillLifecycleState = 
  | 'registered'
  | 'initialized'
  | 'ready'
  | 'running'
  | 'completed'
  | 'error'
  | 'unloaded';

// ============================================================================
// Skill Metadata
// ============================================================================

/**
 * Author information for a skill
 */
export interface SkillAuthor {
  name: string;
  email?: string;
  url?: string;
  organization?: string;
}

/**
 * Skill metadata for marketplace and documentation
 */
export interface SkillMetadata {
  id: SkillId;
  name: string;
  version: SkillVersion;
  description: string;
  category: SkillCategory;
  author: SkillAuthor;
  tags: string[];
  license: string;
  homepage?: string;
  repository?: string;
  issues?: string;
  createdAt: Date;
  updatedAt: Date;
  deprecated?: boolean;
  deprecationMessage?: string;
  replaces?: SkillId[];
}

/**
 * Skill compatibility information
 */
export interface SkillCompatibility {
  minPlatformVersion: SkillVersion;
  maxPlatformVersion?: SkillVersion;
  requiredSkills?: SkillId[];
  conflictsWith?: SkillId[];
  os?: ('windows' | 'macos' | 'linux' | 'unix')[];
  nodeVersion?: string;
}

// ============================================================================
// Skill Configuration
// ============================================================================

/**
 * Skill configuration options
 */
export interface SkillConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  retryDelay: number;
  parallel: boolean;
  maxConcurrency: number;
  cacheResults: boolean;
  cacheTtl: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customSettings: Record<string, unknown>;
}

/**
 * Default skill configuration
 */
export const DEFAULT_SKILL_CONFIG: SkillConfig = {
  enabled: true,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  parallel: false,
  maxConcurrency: 1,
  cacheResults: false,
  cacheTtl: 3600000,
  logLevel: 'info',
  customSettings: {},
};

// ============================================================================
// Skill Input/Output
// ============================================================================

/**
 * Skill parameter definition
 */
export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
  pattern?: string;
  min?: number;
  max?: number;
  items?: SkillParameter;
  properties?: Record<string, SkillParameter>;
}

/**
 * Skill input schema definition
 */
export interface SkillInputSchema {
  type: 'object';
  properties: Record<string, SkillParameter>;
  required: string[];
  additionalProperties?: boolean;
}

/**
 * Skill output schema definition
 */
export interface SkillOutputSchema {
  type: 'object';
  properties: Record<string, SkillParameter>;
  required: string[];
}

/**
 * Skill input data
 */
export type SkillInput = Record<string, unknown>;

/**
 * Skill output data
 */
export interface SkillOutput {
  success: boolean;
  data?: unknown;
  error?: SkillError;
  metadata: SkillOutputMetadata;
}

/**
 * Skill output metadata
 */
export interface SkillOutputMetadata {
  executionTime: number;
  startTime: Date;
  endTime: Date;
  tokensUsed?: number;
  modelUsed?: string;
  cached: boolean;
  retryCount: number;
}

// ============================================================================
// Skill Error Handling
// ============================================================================

/**
 * Skill error codes
 */
export type SkillErrorCode =
  | 'SKILL_NOT_FOUND'
  | 'SKILL_ALREADY_REGISTERED'
  | 'SKILL_LOAD_FAILED'
  | 'SKILL_EXECUTION_FAILED'
  | 'SKILL_TIMEOUT'
  | 'SKILL_VALIDATION_FAILED'
  | 'SKILL_DEPENDENCY_MISSING'
  | 'SKILL_INCOMPATIBLE'
  | 'SKILL_DEPRECATED'
  | 'SKILL_CANCELLED'
  | 'INVALID_INPUT'
  | 'INVALID_OUTPUT'
  | 'TOOL_NOT_AVAILABLE'
  | 'CONTEXT_MISSING'
  | 'PERMISSION_DENIED';

/**
 * Skill error details
 */
export interface SkillError {
  code: SkillErrorCode;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  cause?: Error;
}

/**
 * Skill execution error class
 */
export class SkillExecutionError extends Error {
  constructor(
    public readonly code: SkillErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SkillExecutionError';
  }
}

// ============================================================================
// Skill Context
// ============================================================================

/**
 * Execution context for skills
 */
export interface SkillContext {
  sessionId: string;
  workspacePath: string;
  projectRoot: string;
  files: string[];
  selectedFiles?: string[];
  environment: Record<string, string>;
  variables: Map<string, unknown>;
  history: SkillExecutionRecord[];
  parentExecution?: SkillExecutionRecord;
}

/**
 * Skill execution record
 */
export interface SkillExecutionRecord {
  id: string;
  skillId: SkillId;
  input: SkillInput;
  output: SkillOutput;
  context: SkillContext;
  timestamp: Date;
}

/**
 * Tool availability in context
 */
export interface ToolAvailability {
  name: string;
  available: boolean;
  version?: string;
  config?: Record<string, unknown>;
}

// ============================================================================
// Skill Definition
// ============================================================================

/**
 * Complete skill definition
 */
export interface SkillDefinition {
  metadata: SkillMetadata;
  compatibility: SkillCompatibility;
  config: SkillConfig;
  inputSchema: SkillInputSchema;
  outputSchema: SkillOutputSchema;
  examples: SkillExample[];
  requiredTools: string[];
  requiredContext: string[];
  successCriteria: SuccessCriterion[];
  dependencies: SkillDependency[];
  hooks: SkillHooks;
  documentation: SkillDocumentation;
}

/**
 * Skill example usage
 */
export interface SkillExample {
  name: string;
  description: string;
  input: SkillInput;
  expectedOutput?: unknown;
  notes?: string;
}

/**
 * Skill dependency
 */
export interface SkillDependency {
  skillId: SkillId;
  versionRange: string;
  optional: boolean;
}

/**
 * Success criterion for skill execution
 */
export interface SuccessCriterion {
  name: string;
  description: string;
  check: (output: SkillOutput) => boolean;
}

/**
 * Skill lifecycle hooks
 */
export interface SkillHooks {
  beforeLoad?: () => Promise<void> | void;
  afterLoad?: () => Promise<void> | void;
  beforeExecute?: (input: SkillInput) => Promise<SkillInput> | SkillInput;
  afterExecute?: (output: SkillOutput) => Promise<SkillOutput> | SkillOutput;
  onError?: (error: SkillError) => Promise<void> | void;
  beforeUnload?: () => Promise<void> | void;
}

/**
 * Skill documentation
 */
export interface SkillDocumentation {
  readme: string;
  changelog: string;
  apiReference: string;
  tutorials: string[];
}

// ============================================================================
// Skill Registration
// ============================================================================

/**
 * Skill registration options
 */
export interface SkillRegistrationOptions {
  overrideExisting: boolean;
  validateOnRegister: boolean;
  autoLoad: boolean;
  lazyLoad: boolean;
}

/**
 * Default registration options
 */
export const DEFAULT_REGISTRATION_OPTIONS: SkillRegistrationOptions = {
  overrideExisting: false,
  validateOnRegister: true,
  autoLoad: true,
  lazyLoad: false,
};

/**
 * Registered skill entry
 */
export interface RegisteredSkill {
  definition: SkillDefinition;
  instance?: Skill;
  state: SkillLifecycleState;
  registeredAt: Date;
  loadedAt?: Date;
  executionCount: number;
  lastExecutedAt?: Date;
  options: SkillRegistrationOptions;
}

// ============================================================================
// Skill Loading
// ============================================================================

/**
 * Skill load options
 */
export interface SkillLoadOptions {
  from: 'file' | 'directory' | 'url' | 'npm' | 'registry';
  path: string;
  version?: string;
  verifySignature: boolean;
  sandboxed: boolean;
}

/**
 * Skill loader result
 */
export interface SkillLoadResult {
  success: boolean;
  skill?: SkillDefinition;
  error?: SkillError;
  warnings: string[];
}

/**
 * Skill source types
 */
export type SkillSource =
  | { type: 'local'; path: string }
  | { type: 'remote'; url: string }
  | { type: 'npm'; package: string; version?: string }
  | { type: 'registry'; id: SkillId; version?: string };

// ============================================================================
// Skill Composition
// ============================================================================

/**
 * Skill composition node
 */
export interface SkillCompositionNode {
  skillId: SkillId;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  condition?: string;
  onError: 'stop' | 'continue' | 'retry';
  retryCount: number;
}

/**
 * Skill composition definition
 */
export interface SkillComposition {
  id: string;
  name: string;
  description: string;
  nodes: SkillCompositionNode[];
  edges: SkillCompositionEdge[];
  variables: Record<string, unknown>;
}

/**
 * Skill composition edge
 */
export interface SkillCompositionEdge {
  from: string;
  to: string;
  condition?: string;
}

/**
 * Composed skill result
 */
export interface ComposedSkillResult {
  success: boolean;
  results: Map<string, SkillOutput>;
  finalOutput?: SkillOutput;
  executionGraph: ExecutionGraph;
}

/**
 * Execution graph for composition
 */
export interface ExecutionGraph {
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
}

export interface ExecutionNode {
  id: string;
  skillId: SkillId;
  status: SkillExecutionStatus;
  startTime?: Date;
  endTime?: Date;
}

export interface ExecutionEdge {
  from: string;
  to: string;
  dataFlow: string[];
}

// ============================================================================
// Skill Marketplace
// ============================================================================

/**
 * Marketplace skill listing
 */
export interface MarketplaceSkill {
  metadata: SkillMetadata;
  downloadUrl: string;
  installCount: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  price?: number;
  currency?: string;
}

/**
 * Skill search filters
 */
export interface SkillSearchFilters {
  category?: SkillCategory;
  author?: string;
  tags?: string[];
  minRating?: number;
  verifiedOnly?: boolean;
  freeOnly?: boolean;
  compatibleWith?: SkillVersion;
}

/**
 * Skill installation result
 */
export interface SkillInstallationResult {
  success: boolean;
  skill?: RegisteredSkill;
  error?: SkillError;
  installedPath?: string;
}

// ============================================================================
// Skill Events
// ============================================================================

/**
 * Skill event types
 */
export type SkillEventType =
  | 'skill:registered'
  | 'skill:loaded'
  | 'skill:unloaded'
  | 'skill:executing'
  | 'skill:completed'
  | 'skill:failed'
  | 'skill:cancelled'
  | 'skill:updated'
  | 'skill:deprecated';

/**
 * Skill event payload
 */
export interface SkillEvent {
  type: SkillEventType;
  skillId: SkillId;
  timestamp: Date;
  data?: unknown;
}

/**
 * Skill event handler
 */
export type SkillEventHandler = (event: SkillEvent) => void | Promise<void>;

// ============================================================================
// Skill Statistics
// ============================================================================

/**
 * Skill usage statistics
 */
export interface SkillStatistics {
  skillId: SkillId;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalTokensUsed: number;
  lastUsedAt?: Date;
  usageByDay: Map<string, number>;
  popularInputs: Map<string, number>;
}

// ============================================================================
// Abstract Skill Class (forward reference)
// ============================================================================

export interface Skill {
  readonly definition: SkillDefinition;
  readonly state: SkillLifecycleState;
  
  initialize(): Promise<void>;
  execute(input: SkillInput, context: SkillContext): Promise<SkillOutput>;
  validate(input: SkillInput): Promise<boolean>;
  dispose(): Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for skill result with typed data
 */
export type TypedSkillOutput<T> = SkillOutput & { data: T };

/**
 * Skill factory function type
 */
export type SkillFactory = (config?: Partial<SkillConfig>) => Skill;

/**
 * Skill module interface
 */
export interface SkillModule {
  default?: SkillFactory;
  factory?: SkillFactory;
  definition?: SkillDefinition;
}

/**
 * Skill validation result
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Skill parser result
 */
export interface SkillParserResult {
  success: boolean;
  definition?: SkillDefinition;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const SKILL_FILE_EXTENSIONS = ['.skill.ts', '.skill.js', '.json'];
export const SKILL_CONFIG_FILENAME = 'skill.config.json';
export const SKILL_README_FILENAME = 'README.md';
export const SKILL_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Re-exports for convenience
// ============================================================================

export * from './schema';
