/**
 * RefactoringSkill.ts - Code Refactoring
 * 
 * Performs automated code refactoring including:
 * - Variable renaming
 * - Function extraction
 * - Code simplification
 * - Import organization
 * - Dead code elimination
 */

import { Skill } from '../Skill';
import {
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillDefinition,
  SkillConfig,
} from '../types';

/**
 * Refactoring operation type
 */
export type RefactoringType =
  | 'rename'
  | 'extract-function'
  | 'extract-variable'
  | 'inline'
  | 'organize-imports'
  | 'remove-dead-code'
  | 'simplify'
  | 'convert-arrow-function'
  | 'add-types'
  | 'optimize-imports';

/**
 * Refactoring change
 */
export interface RefactoringChange {
  id: string;
  type: RefactoringType;
  description: string;
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  originalCode: string;
  newCode: string;
  isSafe: boolean;
  confidence: number; // 0-1
}

/**
 * Refactoring result
 */
export interface RefactoringResult {
  filePath: string;
  changes: RefactoringChange[];
  appliedChanges: RefactoringChange[];
  rejectedChanges: RefactoringChange[];
  originalCode: string;
  refactoredCode: string;
  summary: {
    totalChanges: number;
    safeChanges: number;
    unsafeChanges: number;
    linesChanged: number;
  };
}

/**
 * Refactoring options
 */
export interface RefactoringOptions {
  types: RefactoringType[];
  autoApplySafe: boolean;
  skipConfirmation: boolean;
  preserveComments: boolean;
  preserveFormatting: boolean;
  maxChangesPerFile: number;
}

const definition: SkillDefinition = {
  metadata: {
    id: 'refactoring',
    name: 'Code Refactoring',
    version: '1.0.0',
    description: 'Performs automated code refactoring with support for renaming, extraction, simplification, and code organization.',
    category: 'code',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['refactoring', 'code-quality', 'automation'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 120000,
    retries: 1,
    retryDelay: 1000,
    parallel: false,
    maxConcurrency: 1,
    cacheResults: false,
    cacheTtl: 0,
    logLevel: 'info',
    customSettings: {},
  },
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        name: 'filePath',
        type: 'string',
        description: 'Path to the file to refactor',
        required: true,
      },
      code: {
        name: 'code',
        type: 'string',
        description: 'Code content to refactor',
        required: false,
      },
      refactoringType: {
        name: 'refactoringType',
        type: 'string',
        description: 'Type of refactoring to perform',
        required: true,
        enum: ['rename', 'extract-function', 'extract-variable', 'inline', 'organize-imports', 'remove-dead-code', 'simplify'],
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Refactoring options',
        required: false,
      },
      selection: {
        name: 'selection',
        type: 'object',
        description: 'Code selection range',
        required: false,
      },
    },
    required: ['filePath', 'refactoringType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      filePath: { name: 'filePath', type: 'string', required: true },
      changes: { name: 'changes', type: 'array', required: true },
      appliedChanges: { name: 'appliedChanges', type: 'array', required: true },
      refactoredCode: { name: 'refactoredCode', type: 'string', required: true },
      summary: { name: 'summary', type: 'object', required: true },
    },
    required: ['filePath', 'changes', 'refactoredCode', 'summary'],
  },
  examples: [
    {
      name: 'Rename variable',
      description: 'Rename a variable throughout the codebase',
      input: {
        filePath: 'src/utils.ts',
        refactoringType: 'rename',
        options: { oldName: 'data', newName: 'userData' },
      },
      expectedOutput: {
        filePath: 'src/utils.ts',
        changes: [],
        appliedChanges: [],
        refactoredCode: '',
        summary: { totalChanges: 5, safeChanges: 5, unsafeChanges: 0, linesChanged: 3 },
      },
    },
  ],
  requiredTools: ['file-reader', 'file-writer', 'ast-parser'],
  requiredContext: ['workspacePath'],
  successCriteria: [{ name: 'success', description: 'Refactoring completed', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Code Refactoring Skill\n\nAutomated code refactoring for various transformations.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class RefactoringSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing RefactoringSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    const refactoringType = input.refactoringType as RefactoringType;
    
    this._log('info', `Starting ${refactoringType} refactoring`, { filePath: input.filePath });

    // Get code content
    const code = await this._getCodeContent(input, context);
    if (!code) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Could not read code' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Perform refactoring based on type
    let changes: RefactoringChange[] = [];
    
    switch (refactoringType) {
      case 'rename':
        changes = this._performRename(code, input.options as Record<string, string>);
        break;
      case 'extract-function':
        changes = this._extractFunction(code, input.selection as Record<string, number>);
        break;
      case 'extract-variable':
        changes = this._extractVariable(code, input.selection as Record<string, number>);
        break;
      case 'organize-imports':
        changes = this._organizeImports(code);
        break;
      case 'remove-dead-code':
        changes = this._removeDeadCode(code);
        break;
      case 'simplify':
        changes = this._simplifyCode(code);
        break;
      default:
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: `Unknown refactoring type: ${refactoringType}` },
          metadata: this._createMetadata(startTime),
        };
    }

    // Apply changes
    const { refactoredCode, appliedChanges, rejectedChanges } = this._applyChanges(code, changes, input.options as RefactoringOptions);

    const result: RefactoringResult = {
      filePath: input.filePath as string,
      changes,
      appliedChanges,
      rejectedChanges,
      originalCode: code,
      refactoredCode,
      summary: {
        totalChanges: changes.length,
        safeChanges: changes.filter(c => c.isSafe).length,
        unsafeChanges: changes.filter(c => !c.isSafe).length,
        linesChanged: this._countChangedLines(code, refactoredCode),
      },
    };

    return {
      success: true,
      data: result,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing RefactoringSkill');
  }

  // ============================================================================
  // Refactoring Operations
  // ============================================================================

  private _performRename(code: string, options: Record<string, string>): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    const { oldName, newName } = options;
    
    if (!oldName || !newName) return changes;

    const lines = code.split('\n');
    const pattern = new RegExp(`\\b${oldName}\\b`, 'g');

    lines.forEach((line, index) => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        changes.push({
          id: `rename-${index + 1}-${match.index}`,
          type: 'rename',
          description: `Rename '${oldName}' to '${newName}'`,
          filePath: '',
          startLine: index + 1,
          startColumn: match.index + 1,
          endLine: index + 1,
          endColumn: match.index + oldName.length + 1,
          originalCode: oldName,
          newCode: newName,
          isSafe: true,
          confidence: 0.95,
        });
      }
    });

    return changes;
  }

  private _extractFunction(code: string, selection?: Record<string, number>): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    
    if (!selection) return changes;

    const lines = code.split('\n');
    const selectedLines = lines.slice(selection.startLine - 1, selection.endLine);
    const selectedCode = selectedLines.join('\n');

    // Generate function name based on content
    const functionName = this._generateFunctionName(selectedCode);

    changes.push({
      id: `extract-func-${selection.startLine}`,
      type: 'extract-function',
      description: `Extract code into function '${functionName}'`,
      filePath: '',
      startLine: selection.startLine,
      startColumn: 1,
      endLine: selection.endLine,
      endColumn: lines[selection.endLine - 1]?.length || 1,
      originalCode: selectedCode,
      newCode: `${functionName}()`,
      isSafe: false,
      confidence: 0.8,
    });

    return changes;
  }

  private _extractVariable(code: string, selection?: Record<string, number>): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    
    if (!selection) return changes;

    const lines = code.split('\n');
    const line = lines[selection.startLine - 1];
    const expression = line?.substring(selection.startColumn - 1, selection.endColumn - 1);

    if (!expression) return changes;

    const varName = this._generateVariableName(expression);

    changes.push({
      id: `extract-var-${selection.startLine}`,
      type: 'extract-variable',
      description: `Extract expression into variable '${varName}'`,
      filePath: '',
      startLine: selection.startLine,
      startColumn: selection.startColumn,
      endLine: selection.endLine,
      endColumn: selection.endColumn,
      originalCode: expression,
      newCode: varName,
      isSafe: true,
      confidence: 0.9,
    });

    return changes;
  }

  private _organizeImports(code: string): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    const lines = code.split('\n');
    
    const importLines: { index: number; line: string }[] = [];
    lines.forEach((line, index) => {
      if (line.trim().startsWith('import ')) {
        importLines.push({ index, line });
      }
    });

    if (importLines.length === 0) return changes;

    // Sort imports
    const sortedImports = [...importLines].sort((a, b) => {
      const aIsRelative = a.line.includes("'./") || a.line.includes("'../");
      const bIsRelative = b.line.includes("'./") || b.line.includes("'../");
      
      if (aIsRelative && !bIsRelative) return 1;
      if (!aIsRelative && bIsRelative) return -1;
      
      return a.line.localeCompare(b.line);
    });

    // Check if reordering is needed
    let needsReorder = false;
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].index !== sortedImports[i].index) {
        needsReorder = true;
        break;
      }
    }

    if (needsReorder) {
      changes.push({
        id: 'organize-imports',
        type: 'organize-imports',
        description: 'Organize and sort imports',
        filePath: '',
        startLine: importLines[0].index + 1,
        startColumn: 1,
        endLine: importLines[importLines.length - 1].index + 1,
        endColumn: lines[importLines[importLines.length - 1].index].length + 1,
        originalCode: importLines.map(i => i.line).join('\n'),
        newCode: sortedImports.map(i => i.line).join('\n'),
        isSafe: true,
        confidence: 0.99,
      });
    }

    // Remove duplicate imports
    const seen = new Set<string>();
    for (const { index, line } of importLines) {
      const normalized = line.replace(/\s+/g, ' ').trim();
      if (seen.has(normalized)) {
        changes.push({
          id: `remove-dup-import-${index}`,
          type: 'optimize-imports',
          description: 'Remove duplicate import',
          filePath: '',
          startLine: index + 1,
          startColumn: 1,
          endLine: index + 1,
          endColumn: line.length + 1,
          originalCode: line,
          newCode: '',
          isSafe: true,
          confidence: 0.99,
        });
      } else {
        seen.add(normalized);
      }
    }

    return changes;
  }

  private _removeDeadCode(code: string): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    const lines = code.split('\n');

    // Find unused variables
    const declaredVars = new Map<string, number>();
    const usedVars = new Set<string>();

    lines.forEach((line, index) => {
      // Match variable declarations
      const declMatch = line.match(/(?:const|let|var)\s+(\w+)/);
      if (declMatch) {
        declaredVars.set(declMatch[1], index);
      }

      // Match variable usage (simple heuristic)
      const varMatches = line.match(/\b\w+\b/g);
      if (varMatches) {
        varMatches.forEach(v => usedVars.add(v));
      }
    });

    // Find unused variables
    for (const [varName, lineIndex] of declaredVars) {
      if (!usedVars.has(varName) || (usedVars.has(varName) && lineIndex === undefined)) {
        const line = lines[lineIndex];
        changes.push({
          id: `dead-code-${lineIndex}`,
          type: 'remove-dead-code',
          description: `Remove unused variable '${varName}'`,
          filePath: '',
          startLine: lineIndex + 1,
          startColumn: 1,
          endLine: lineIndex + 1,
          endColumn: line.length + 1,
          originalCode: line,
          newCode: '',
          isSafe: false,
          confidence: 0.7,
        });
      }
    }

    return changes;
  }

  private _simplifyCode(code: string): RefactoringChange[] {
    const changes: RefactoringChange[] = [];
    const lines = code.split('\n');

    // Simplify if/return patterns
    lines.forEach((line, index) => {
      // if (condition) { return true; } else { return false; }
      const simplified = line.replace(
        /if\s*\(\s*(.+?)\s*\)\s*\{\s*return\s+true\s*;?\s*\}\s*else\s*\{\s*return\s+false\s*;?\s*\}/,
        'return $1;'
      );
      
      if (simplified !== line) {
        changes.push({
          id: `simplify-${index}`,
          type: 'simplify',
          description: 'Simplify if/return pattern',
          filePath: '',
          startLine: index + 1,
          startColumn: 1,
          endLine: index + 1,
          endColumn: line.length + 1,
          originalCode: line,
          newCode: simplified,
          isSafe: true,
          confidence: 0.95,
        });
      }
    });

    return changes;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async _getCodeContent(input: SkillInput, context: SkillContext): Promise<string | null> {
    if (input.code) return input.code as string;
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      return await fs.readFile(path.join(context.workspacePath, input.filePath as string), 'utf-8');
    } catch {
      return null;
    }
  }

  private _applyChanges(
    code: string,
    changes: RefactoringChange[],
    options?: RefactoringOptions
  ): { refactoredCode: string; appliedChanges: RefactoringChange[]; rejectedChanges: RefactoringChange[] } {
    const autoApplySafe = options?.autoApplySafe ?? false;
    const appliedChanges: RefactoringChange[] = [];
    const rejectedChanges: RefactoringChange[] = [];

    let refactoredCode = code;
    const lines = code.split('\n');

    // Sort changes by position (reverse order to apply from end to start)
    const sortedChanges = [...changes].sort((a, b) => {
      if (a.startLine !== b.startLine) return b.startLine - a.startLine;
      return b.startColumn - a.startColumn;
    });

    for (const change of sortedChanges) {
      const shouldApply = change.isSafe && autoApplySafe;
      
      if (shouldApply) {
        // Apply the change
        const lineIndex = change.startLine - 1;
        const line = lines[lineIndex];
        
        if (line !== undefined) {
          lines[lineIndex] = line.substring(0, change.startColumn - 1) +
            change.newCode +
            line.substring(change.endColumn - 1);
          appliedChanges.push(change);
        } else {
          rejectedChanges.push(change);
        }
      } else {
        rejectedChanges.push(change);
      }
    }

    refactoredCode = lines.join('\n');

    return { refactoredCode, appliedChanges, rejectedChanges };
  }

  private _generateFunctionName(code: string): string {
    // Simple heuristic to generate function name
    if (code.includes('fetch') || code.includes('get')) return 'fetchData';
    if (code.includes('save') || code.includes('update')) return 'saveData';
    if (code.includes('delete') || code.includes('remove')) return 'deleteData';
    if (code.includes('validate') || code.includes('check')) return 'validateData';
    return 'extractedFunction';
  }

  private _generateVariableName(expression: string): string {
    // Simple heuristic to generate variable name
    if (expression.includes('user')) return 'user';
    if (expression.includes('data')) return 'data';
    if (expression.includes('config')) return 'config';
    if (expression.includes('options')) return 'options';
    return 'extractedValue';
  }

  private _countChangedLines(original: string, modified: string): number {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    let count = 0;
    
    const maxLines = Math.max(origLines.length, modLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (origLines[i] !== modLines[i]) count++;
    }
    
    return count;
  }

  private _createMetadata(startTime: number) {
    return {
      executionTime: Date.now() - startTime,
      startTime: new Date(startTime),
      endTime: new Date(),
      cached: false,
      retryCount: 0,
    };
  }
}

export default function createSkill(config?: Partial<SkillConfig>): RefactoringSkill {
  return new RefactoringSkill(config);
}

export { definition };
