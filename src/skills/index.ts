/**
 * Skills System - Main Export
 * 
 * Central export point for the Claude Code Skills system.
 */

// ============================================================================
// Core Classes
// ============================================================================

export { Skill } from './Skill';
export { SkillManager, DEFAULT_MANAGER_CONFIG } from './SkillManager';
export { SkillRegistry } from './SkillRegistry';
export { SkillLoader } from './SkillLoader';
export { SkillComposer } from './SkillComposer';

// ============================================================================
// Types
// ============================================================================

export * from './types';

// ============================================================================
// Utilities
// ============================================================================

export { SkillParser } from './utils/parser';
export { SkillValidator } from './utils/validator';
export { SkillTemplateGenerator } from './utils/template';

// ============================================================================
// Built-in Skills
// ============================================================================

// Code Skills
export { CodeReviewSkill } from './builtin/CodeReviewSkill';
export { RefactoringSkill } from './builtin/RefactoringSkill';
export { DocumentationSkill } from './builtin/DocumentationSkill';
export { TestingSkill } from './builtin/TestingSkill';

// Analysis Skills
export { CodeAnalysisSkill } from './builtin/CodeAnalysisSkill';

// Generation Skills
export { CodeGenerationSkill } from './builtin/CodeGenerationSkill';

// Git Skills
export { CommitMessageSkill } from './builtin/CommitMessageSkill';

// Utility Skills
export { DebuggingSkill } from './builtin/DebuggingSkill';
export { OptimizationSkill } from './builtin/OptimizationSkill';

// ============================================================================
// Skill Registry Helper
// ============================================================================

import { SkillManager } from './SkillManager';
import { SkillRegistry } from './SkillRegistry';

/**
 * Global skill manager instance
 */
let globalSkillManager: SkillManager | null = null;

/**
 * Get or create the global skill manager
 */
export function getSkillManager(): SkillManager {
  if (!globalSkillManager) {
    globalSkillManager = new SkillManager();
  }
  return globalSkillManager;
}

/**
 * Set the global skill manager
 */
export function setSkillManager(manager: SkillManager): void {
  globalSkillManager = manager;
}

/**
 * Reset the global skill manager
 */
export function resetSkillManager(): void {
  globalSkillManager = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Register a skill
 */
export async function registerSkill(skill: any, options?: any) {
  return getSkillManager().register(skill, options);
}

/**
 * Execute a skill
 */
export async function executeSkill(skillId: string, input: any, context?: any) {
  return getSkillManager().execute(skillId, input, context);
}

/**
 * Load a skill
 */
export async function loadSkill(skillId: string) {
  return getSkillManager().loadSkill(skillId);
}

/**
 * Get all registered skills
 */
export function getAllSkills() {
  return getSkillManager().getAllSkills();
}

// ============================================================================
// Version
// ============================================================================

export const SKILLS_VERSION = '1.0.0';
