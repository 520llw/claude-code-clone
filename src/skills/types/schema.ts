/**
 * Skills System - Zod Schemas
 * 
 * Validation schemas for skill definitions using Zod.
 * Ensures type safety and runtime validation.
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Skill ID schema
 */
export const SkillIdSchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
  .describe('Unique skill identifier (kebab-case)');

/**
 * Semantic version schema
 */
export const SkillVersionSchema = z.string()
  .regex(/^\d+\.\d+\.\d+$/)
  .describe('Semantic version (MAJOR.MINOR.PATCH)');

/**
 * Skill category schema
 */
export const SkillCategorySchema = z.enum([
  'code',
  'analysis',
  'generation',
  'git',
  'utility',
  'custom',
]);

/**
 * Skill lifecycle state schema
 */
export const SkillLifecycleStateSchema = z.enum([
  'registered',
  'initialized',
  'ready',
  'running',
  'completed',
  'error',
  'unloaded',
]);

// ============================================================================
// Author & Metadata Schemas
// ============================================================================

/**
 * Skill author schema
 */
export const SkillAuthorSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
  organization: z.string().optional(),
});

/**
 * Skill metadata schema
 */
export const SkillMetadataSchema = z.object({
  id: SkillIdSchema,
  name: z.string().min(1).max(100),
  version: SkillVersionSchema,
  description: z.string().min(10).max(1000),
  category: SkillCategorySchema,
  author: SkillAuthorSchema,
  tags: z.array(z.string().min(1).max(50)).max(20),
  license: z.string().min(1),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  issues: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deprecated: z.boolean().optional(),
  deprecationMessage: z.string().optional(),
  replaces: z.array(SkillIdSchema).optional(),
});

// ============================================================================
// Compatibility Schema
// ============================================================================

/**
 * Skill compatibility schema
 */
export const SkillCompatibilitySchema = z.object({
  minPlatformVersion: SkillVersionSchema,
  maxPlatformVersion: SkillVersionSchema.optional(),
  requiredSkills: z.array(SkillIdSchema).optional(),
  conflictsWith: z.array(SkillIdSchema).optional(),
  os: z.array(z.enum(['windows', 'macos', 'linux', 'unix'])).optional(),
  nodeVersion: z.string().optional(),
});

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * Skill configuration schema
 */
export const SkillConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().default(30000),
  retries: z.number().int().min(0).default(3),
  retryDelay: z.number().int().positive().default(1000),
  parallel: z.boolean().default(false),
  maxConcurrency: z.number().int().positive().default(1),
  cacheResults: z.boolean().default(false),
  cacheTtl: z.number().int().positive().default(3600000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  customSettings: z.record(z.unknown()).default({}),
});

// ============================================================================
// Parameter & Schema Schemas
// ============================================================================

/**
 * Base parameter type schema
 */
const BaseParameterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().default(false),
});

/**
 * String parameter schema
 */
const StringParameterSchema = BaseParameterSchema.extend({
  type: z.literal('string'),
  default: z.string().optional(),
  enum: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().positive().optional(),
});

/**
 * Number parameter schema
 */
const NumberParameterSchema = BaseParameterSchema.extend({
  type: z.literal('number'),
  default: z.number().optional(),
  enum: z.array(z.number()).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  multipleOf: z.number().positive().optional(),
});

/**
 * Boolean parameter schema
 */
const BooleanParameterSchema = BaseParameterSchema.extend({
  type: z.literal('boolean'),
  default: z.boolean().optional(),
});

/**
 * Array parameter schema
 */
const ArrayParameterSchema: z.ZodType<any> = BaseParameterSchema.extend({
  type: z.literal('array'),
  default: z.array(z.unknown()).optional(),
  minItems: z.number().int().min(0).optional(),
  maxItems: z.number().int().positive().optional(),
  uniqueItems: z.boolean().optional(),
  items: z.lazy(() => SkillParameterSchema).optional(),
});

/**
 * Object parameter schema
 */
const ObjectParameterSchema: z.ZodType<any> = BaseParameterSchema.extend({
  type: z.literal('object'),
  default: z.record(z.unknown()).optional(),
  properties: z.lazy(() => z.record(SkillParameterSchema)).optional(),
  additionalProperties: z.boolean().optional(),
});

/**
 * File parameter schema
 */
const FileParameterSchema = BaseParameterSchema.extend({
  type: z.literal('file'),
  accept: z.array(z.string()).optional(),
  multiple: z.boolean().optional(),
  maxSize: z.number().int().positive().optional(),
});

/**
 * Union parameter schema
 */
export const SkillParameterSchema = z.union([
  StringParameterSchema,
  NumberParameterSchema,
  BooleanParameterSchema,
  ArrayParameterSchema,
  ObjectParameterSchema,
  FileParameterSchema,
]);

/**
 * Input schema definition
 */
export const SkillInputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(SkillParameterSchema),
  required: z.array(z.string()),
  additionalProperties: z.boolean().optional(),
});

/**
 * Output schema definition
 */
export const SkillOutputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(SkillParameterSchema),
  required: z.array(z.string()),
});

// ============================================================================
// Example & Documentation Schemas
// ============================================================================

/**
 * Skill example schema
 */
export const SkillExampleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  input: z.record(z.unknown()),
  expectedOutput: z.unknown().optional(),
  notes: z.string().optional(),
});

/**
 * Skill documentation schema
 */
export const SkillDocumentationSchema = z.object({
  readme: z.string().min(1),
  changelog: z.string(),
  apiReference: z.string(),
  tutorials: z.array(z.string()),
});

// ============================================================================
// Dependency & Hook Schemas
// ============================================================================

/**
 * Skill dependency schema
 */
export const SkillDependencySchema = z.object({
  skillId: SkillIdSchema,
  versionRange: z.string(),
  optional: z.boolean().default(false),
});

/**
 * Success criterion schema
 */
export const SuccessCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().min(1),
});

/**
 * Skill hooks schema (serialized form)
 */
export const SkillHooksSchema = z.object({
  beforeLoad: z.string().optional(),
  afterLoad: z.string().optional(),
  beforeExecute: z.string().optional(),
  afterExecute: z.string().optional(),
  onError: z.string().optional(),
  beforeUnload: z.string().optional(),
});

// ============================================================================
// Complete Skill Definition Schema
// ============================================================================

/**
 * Complete skill definition schema
 */
export const SkillDefinitionSchema = z.object({
  metadata: SkillMetadataSchema,
  compatibility: SkillCompatibilitySchema,
  config: SkillConfigSchema,
  inputSchema: SkillInputSchemaSchema,
  outputSchema: SkillOutputSchemaSchema,
  examples: z.array(SkillExampleSchema).min(1),
  requiredTools: z.array(z.string()).default([]),
  requiredContext: z.array(z.string()).default([]),
  successCriteria: z.array(SuccessCriterionSchema).min(1),
  dependencies: z.array(SkillDependencySchema).default([]),
  hooks: SkillHooksSchema.optional(),
  documentation: SkillDocumentationSchema,
});

// ============================================================================
// Registration & Loading Schemas
// ============================================================================

/**
 * Registration options schema
 */
export const SkillRegistrationOptionsSchema = z.object({
  overrideExisting: z.boolean().default(false),
  validateOnRegister: z.boolean().default(true),
  autoLoad: z.boolean().default(true),
  lazyLoad: z.boolean().default(false),
});

/**
 * Load options schema
 */
export const SkillLoadOptionsSchema = z.object({
  from: z.enum(['file', 'directory', 'url', 'npm', 'registry']),
  path: z.string().min(1),
  version: z.string().optional(),
  verifySignature: z.boolean().default(false),
  sandboxed: z.boolean().default(true),
});

// ============================================================================
// Composition Schemas
// ============================================================================

/**
 * Composition node schema
 */
export const SkillCompositionNodeSchema = z.object({
  skillId: SkillIdSchema,
  inputMapping: z.record(z.string()),
  outputMapping: z.record(z.string()),
  condition: z.string().optional(),
  onError: z.enum(['stop', 'continue', 'retry']).default('stop'),
  retryCount: z.number().int().min(0).default(0),
});

/**
 * Composition edge schema
 */
export const SkillCompositionEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  condition: z.string().optional(),
});

/**
 * Skill composition schema
 */
export const SkillCompositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  nodes: z.array(SkillCompositionNodeSchema),
  edges: z.array(SkillCompositionEdgeSchema),
  variables: z.record(z.unknown()).default({}),
});

// ============================================================================
// Error Schemas
// ============================================================================

/**
 * Skill error code schema
 */
export const SkillErrorCodeSchema = z.enum([
  'SKILL_NOT_FOUND',
  'SKILL_ALREADY_REGISTERED',
  'SKILL_LOAD_FAILED',
  'SKILL_EXECUTION_FAILED',
  'SKILL_TIMEOUT',
  'SKILL_VALIDATION_FAILED',
  'SKILL_DEPENDENCY_MISSING',
  'SKILL_INCOMPATIBLE',
  'SKILL_DEPRECATED',
  'SKILL_CANCELLED',
  'INVALID_INPUT',
  'INVALID_OUTPUT',
  'TOOL_NOT_AVAILABLE',
  'CONTEXT_MISSING',
  'PERMISSION_DENIED',
]);

/**
 * Skill error schema
 */
export const SkillErrorSchema = z.object({
  code: SkillErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  stack: z.string().optional(),
});

// ============================================================================
// Output Schemas
// ============================================================================

/**
 * Output metadata schema
 */
export const SkillOutputMetadataSchema = z.object({
  executionTime: z.number().nonnegative(),
  startTime: z.date(),
  endTime: z.date(),
  tokensUsed: z.number().int().nonnegative().optional(),
  modelUsed: z.string().optional(),
  cached: z.boolean(),
  retryCount: z.number().int().nonnegative(),
});

/**
 * Skill output schema
 */
export const SkillOutputSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: SkillErrorSchema.optional(),
  metadata: SkillOutputMetadataSchema,
});

// ============================================================================
// Context Schemas
// ============================================================================

/**
 * Skill context schema
 */
export const SkillContextSchema = z.object({
  sessionId: z.string().min(1),
  workspacePath: z.string().min(1),
  projectRoot: z.string().min(1),
  files: z.array(z.string()),
  selectedFiles: z.array(z.string()).optional(),
  environment: z.record(z.string()),
  variables: z.instanceof(Map).optional(),
  history: z.array(z.unknown()).default([]),
  parentExecution: z.unknown().optional(),
});

// ============================================================================
// Marketplace Schemas
// ============================================================================

/**
 * Marketplace skill schema
 */
export const MarketplaceSkillSchema = z.object({
  metadata: SkillMetadataSchema,
  downloadUrl: z.string().url(),
  installCount: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  verified: z.boolean(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
});

/**
 * Search filters schema
 */
export const SkillSearchFiltersSchema = z.object({
  category: SkillCategorySchema.optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minRating: z.number().min(0).max(5).optional(),
  verifiedOnly: z.boolean().optional(),
  freeOnly: z.boolean().optional(),
  compatibleWith: SkillVersionSchema.optional(),
});

// ============================================================================
// Statistics Schemas
// ============================================================================

/**
 * Skill statistics schema
 */
export const SkillStatisticsSchema = z.object({
  skillId: SkillIdSchema,
  totalExecutions: z.number().int().nonnegative(),
  successfulExecutions: z.number().int().nonnegative(),
  failedExecutions: z.number().int().nonnegative(),
  averageExecutionTime: z.number().nonnegative(),
  totalTokensUsed: z.number().int().nonnegative(),
  lastUsedAt: z.date().optional(),
});

// ============================================================================
// Validation Result Schema
// ============================================================================

/**
 * Validation result schema
 */
export const SkillValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type SkillIdType = z.infer<typeof SkillIdSchema>;
export type SkillVersionType = z.infer<typeof SkillVersionSchema>;
export type SkillCategoryType = z.infer<typeof SkillCategorySchema>;
export type SkillMetadataType = z.infer<typeof SkillMetadataSchema>;
export type SkillCompatibilityType = z.infer<typeof SkillCompatibilitySchema>;
export type SkillConfigType = z.infer<typeof SkillConfigSchema>;
export type SkillParameterType = z.infer<typeof SkillParameterSchema>;
export type SkillInputSchemaType = z.infer<typeof SkillInputSchemaSchema>;
export type SkillOutputSchemaType = z.infer<typeof SkillOutputSchemaSchema>;
export type SkillExampleType = z.infer<typeof SkillExampleSchema>;
export type SkillDependencyType = z.infer<typeof SkillDependencySchema>;
export type SuccessCriterionType = z.infer<typeof SuccessCriterionSchema>;
export type SkillDocumentationType = z.infer<typeof SkillDocumentationSchema>;
export type SkillDefinitionType = z.infer<typeof SkillDefinitionSchema>;
export type SkillRegistrationOptionsType = z.infer<typeof SkillRegistrationOptionsSchema>;
export type SkillLoadOptionsType = z.infer<typeof SkillLoadOptionsSchema>;
export type SkillCompositionType = z.infer<typeof SkillCompositionSchema>;
export type SkillErrorCodeType = z.infer<typeof SkillErrorCodeSchema>;
export type SkillErrorType = z.infer<typeof SkillErrorSchema>;
export type SkillOutputMetadataType = z.infer<typeof SkillOutputMetadataSchema>;
export type SkillOutputType = z.infer<typeof SkillOutputSchema>;
export type SkillContextType = z.infer<typeof SkillContextSchema>;
export type MarketplaceSkillType = z.infer<typeof MarketplaceSkillSchema>;
export type SkillSearchFiltersType = z.infer<typeof SkillSearchFiltersSchema>;
export type SkillStatisticsType = z.infer<typeof SkillStatisticsSchema>;
export type SkillValidationResultType = z.infer<typeof SkillValidationResultSchema>;
