/**
 * Built-in Skills Export
 * 
 * All built-in skills for the Claude Code Skills system.
 */

// ============================================================================
// Code Skills
// ============================================================================

export { CodeReviewSkill, createSkill as createCodeReviewSkill } from './CodeReviewSkill';
export { RefactoringSkill, createSkill as createRefactoringSkill } from './RefactoringSkill';
export { DocumentationSkill, createSkill as createDocumentationSkill } from './DocumentationSkill';
export { TestingSkill, createSkill as createTestingSkill } from './TestingSkill';

// ============================================================================
// Analysis Skills
// ============================================================================

export { CodeAnalysisSkill, createSkill as createCodeAnalysisSkill } from './CodeAnalysisSkill';

// ============================================================================
// Generation Skills
// ============================================================================

export { CodeGenerationSkill, createSkill as createCodeGenerationSkill } from './CodeGenerationSkill';

// ============================================================================
// Git Skills
// ============================================================================

export { CommitMessageSkill, createSkill as createCommitMessageSkill } from './CommitMessageSkill';

// ============================================================================
// Utility Skills
// ============================================================================

export { DebuggingSkill, createSkill as createDebuggingSkill } from './DebuggingSkill';
export { OptimizationSkill, createSkill as createOptimizationSkill } from './OptimizationSkill';

// ============================================================================
// Skill Factories Map
// ============================================================================

import { SkillFactory } from '../types';
import createCodeReviewSkill from './CodeReviewSkill';
import createRefactoringSkill from './RefactoringSkill';
import createDocumentationSkill from './DocumentationSkill';
import createTestingSkill from './TestingSkill';
import createCodeAnalysisSkill from './CodeAnalysisSkill';
import createCodeGenerationSkill from './CodeGenerationSkill';
import createCommitMessageSkill from './CommitMessageSkill';
import createDebuggingSkill from './DebuggingSkill';
import createOptimizationSkill from './OptimizationSkill';

/**
 * Map of all built-in skill factories
 */
export const builtinSkillFactories: Map<string, SkillFactory> = new Map([
  ['code-review', createCodeReviewSkill],
  ['refactoring', createRefactoringSkill],
  ['documentation', createDocumentationSkill],
  ['testing', createTestingSkill],
  ['code-analysis', createCodeAnalysisSkill],
  ['code-generation', createCodeGenerationSkill],
  ['commit-message', createCommitMessageSkill],
  ['debugging', createDebuggingSkill],
  ['optimization', createOptimizationSkill],
]);

/**
 * Get a built-in skill factory by ID
 */
export function getBuiltinSkillFactory(skillId: string): SkillFactory | undefined {
  return builtinSkillFactories.get(skillId);
}

/**
 * Get all built-in skill IDs
 */
export function getBuiltinSkillIds(): string[] {
  return Array.from(builtinSkillFactories.keys());
}

/**
 * Check if a skill ID is a built-in skill
 */
export function isBuiltinSkill(skillId: string): boolean {
  return builtinSkillFactories.has(skillId);
}

// ============================================================================
// Auto-registration Helper
// ============================================================================

import { SkillManager } from '../SkillManager';

/**
 * Register all built-in skills with a skill manager
 */
export async function registerAllBuiltinSkills(manager: SkillManager): Promise<void> {
  for (const [skillId, factory] of builtinSkillFactories) {
    try {
      const skill = factory();
      await manager.register(skill.definition, { autoLoad: false });
    } catch (error) {
      console.warn(`Failed to register built-in skill '${skillId}':`, error);
    }
  }
}
