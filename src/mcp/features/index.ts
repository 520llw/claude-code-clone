/**
 * Model Context Protocol (MCP) Features
 * 
 * This module exports all MCP feature managers.
 */

// Export tools manager
export {
  ToolsManager,
  createToolsManager,
  defineTool,
  ToolSchemas,
  ToolHelpers,
  ToolExecutionError,
  ToolValidationError,
  ToolNotFoundError,
} from './ToolsManager';

// Export resources manager
export {
  ResourcesManager,
  createResourcesManager,
  defineResource,
  defineResourceTemplate,
  ResourceHelpers,
  ResourceReadError,
  ResourceNotFoundError,
  ResourceTemplateNotFoundError,
  InvalidResourceUriError,
} from './ResourcesManager';

// Export prompts manager
export {
  PromptsManager,
  createPromptsManager,
  definePrompt,
  createPromptArgument,
  PromptHelpers,
  CommonPrompts,
  PromptGetError,
  PromptNotFoundError,
  MissingRequiredArgumentError,
  InvalidArgumentValueError,
} from './PromptsManager';

// Re-export types
export type {
  ToolExecutionContext,
  ToolRegistration,
  ResourceReadContext,
  ResourceDefinition,
  ResourceTemplateDefinition,
  PromptGetContext,
  PromptArgumentValue,
  PromptDefinition,
} from '../types';
