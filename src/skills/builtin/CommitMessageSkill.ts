/**
 * CommitMessageSkill.ts - Commit Message Generation
 * 
 * Generates conventional commit messages based on:
 * - Git diff analysis
 * - Changed files
 * - Code context
 * - Commit history patterns
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
 * Commit type following conventional commits
 */
export type ConventionalCommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'chore'
  | 'ci'
  | 'build'
  | 'revert';

/**
 * Generated commit message
 */
export interface CommitMessage {
  type: ConventionalCommitType;
  scope?: string;
  description: string;
  body?: string;
  footer?: string;
  breaking: boolean;
  fullMessage: string;
  alternatives: string[];
}

/**
 * Commit analysis result
 */
export interface CommitAnalysis {
  filesChanged: string[];
  additions: number;
  deletions: number;
  changeTypes: string[];
  suggestedScopes: string[];
}

/**
 * Commit message options
 */
export interface CommitMessageOptions {
  style: 'conventional' | 'semantic' | 'simple';
  maxLength: number;
  includeBody: boolean;
  includeFooter: boolean;
  emoji: boolean;
  scopes: string[];
}

const definition: SkillDefinition = {
  metadata: {
    id: 'commit-message',
    name: 'Commit Message Generation',
    version: '1.0.0',
    description: 'Generates conventional commit messages based on git diff analysis and code changes.',
    category: 'git',
    author: { name: 'Claude Code', organization: 'Anthropic' },
    tags: ['git', 'commit', 'conventional-commits', 'automation'],
    license: 'MIT',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  compatibility: { minPlatformVersion: '1.0.0' },
  config: {
    enabled: true,
    timeout: 30000,
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
      diff: {
        name: 'diff',
        type: 'string',
        description: 'Git diff content',
        required: false,
      },
      files: {
        name: 'files',
        type: 'array',
        description: 'List of changed files',
        required: false,
      },
      context: {
        name: 'context',
        type: 'string',
        description: 'Additional context about the changes',
        required: false,
      },
      options: {
        name: 'options',
        type: 'object',
        description: 'Commit message options',
        required: false,
      },
    },
    required: [],
  },
  outputSchema: {
    type: 'object',
    properties: {
      type: { name: 'type', type: 'string', required: true },
      scope: { name: 'scope', type: 'string', required: false },
      description: { name: 'description', type: 'string', required: true },
      body: { name: 'body', type: 'string', required: false },
      footer: { name: 'footer', type: 'string', required: false },
      breaking: { name: 'breaking', type: 'boolean', required: true },
      fullMessage: { name: 'fullMessage', type: 'string', required: true },
      alternatives: { name: 'alternatives', type: 'array', required: true },
    },
    required: ['type', 'description', 'breaking', 'fullMessage', 'alternatives'],
  },
  examples: [
    {
      name: 'Generate from diff',
      description: 'Generate commit message from git diff',
      input: {
        diff: 'diff --git a/src/utils.ts b/src/utils.ts\n+export function formatDate...',
        files: ['src/utils.ts'],
      },
      expectedOutput: {
        type: 'feat',
        scope: 'utils',
        description: 'add date formatting function',
        breaking: false,
        fullMessage: 'feat(utils): add date formatting function',
        alternatives: ['feat: add formatDate utility'],
      },
    },
  ],
  requiredTools: ['git'],
  requiredContext: ['workspacePath'],
  successCriteria: [{ name: 'success', description: 'Commit message generated', check: (o) => o.success }],
  dependencies: [],
  documentation: {
    readme: '# Commit Message Generation Skill\n\nGenerates conventional commit messages.',
    changelog: '# Changelog\n\n## 1.0.0\n- Initial release',
    apiReference: 'See schemas for details.',
    tutorials: [],
  },
};

export class CommitMessageSkill extends Skill {
  constructor(config?: Partial<SkillConfig>) {
    super(definition, config);
  }

  protected async onInitialize(): Promise<void> {
    this._log('info', 'Initializing CommitMessageSkill');
  }

  protected async onExecute(input: SkillInput, context: SkillContext): Promise<SkillOutput> {
    const startTime = Date.now();
    
    const options: CommitMessageOptions = {
      style: 'conventional',
      maxLength: 72,
      includeBody: false,
      includeFooter: false,
      emoji: false,
      scopes: [],
      ...(input.options as Partial<CommitMessageOptions> || {}),
    };

    // Get diff if not provided
    let diff = input.diff as string;
    let files = input.files as string[];

    if (!diff && !files) {
      const gitInfo = await this._getGitDiff(context);
      diff = gitInfo.diff;
      files = gitInfo.files;
    }

    if (!diff && (!files || files.length === 0)) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No changes to generate commit message for' },
        metadata: this._createMetadata(startTime),
      };
    }

    // Analyze changes
    const analysis = this._analyzeChanges(diff || '', files || []);

    // Generate commit message
    const commitMessage = this._generateCommitMessage(analysis, input.context as string, options);

    return {
      success: true,
      data: commitMessage,
      metadata: this._createMetadata(startTime),
    };
  }

  protected async onDispose(): Promise<void> {
    this._log('info', 'Disposing CommitMessageSkill');
  }

  // ============================================================================
  // Git Methods
  // ============================================================================

  private async _getGitDiff(context: SkillContext): Promise<{ diff: string; files: string[] }> {
    try {
      const { execSync } = await import('child_process');
      const cwd = context.workspacePath;

      const diff = execSync('git diff --cached', { cwd, encoding: 'utf-8' });
      const filesOutput = execSync('git diff --cached --name-only', { cwd, encoding: 'utf-8' });
      const files = filesOutput.split('\n').filter(f => f.trim());

      return { diff, files };
    } catch {
      return { diff: '', files: [] };
    }
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  private _analyzeChanges(diff: string, files: string[]): CommitAnalysis {
    const changeTypes: string[] = [];
    const suggestedScopes: string[] = [];
    let additions = 0;
    let deletions = 0;

    // Count additions and deletions
    const lines = diff.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    // Determine change types from diff
    if (diff.includes('export function') || diff.includes('export class') || diff.includes('export const')) {
      changeTypes.push('addition');
    }
    if (diff.includes('delete') || diff.includes('remove')) {
      changeTypes.push('removal');
    }
    if (diff.includes('fix') || diff.includes('bug') || diff.includes('error')) {
      changeTypes.push('fix');
    }
    if (diff.includes('test') || diff.includes('spec') || diff.includes('describe')) {
      changeTypes.push('test');
    }
    if (diff.includes('doc') || diff.includes('README') || diff.includes('comment')) {
      changeTypes.push('docs');
    }
    if (diff.includes('refactor') || diff.includes('rename') || diff.includes('move')) {
      changeTypes.push('refactor');
    }
    if (diff.includes('style') || diff.includes('format') || diff.includes('lint')) {
      changeTypes.push('style');
    }

    // Suggest scopes from file paths
    for (const file of files) {
      const parts = file.split('/');
      if (parts.length > 1) {
        const scope = parts[0] === 'src' ? parts[1] : parts[0];
        if (scope && !suggestedScopes.includes(scope)) {
          suggestedScopes.push(scope);
        }
      }
    }

    return {
      filesChanged: files,
      additions,
      deletions,
      changeTypes,
      suggestedScopes,
    };
  }

  // ============================================================================
  // Generation Methods
  // ============================================================================

  private _generateCommitMessage(
    analysis: CommitAnalysis,
    context?: string,
    options?: CommitMessageOptions
  ): CommitMessage {
    // Determine commit type
    const type = this._determineCommitType(analysis);

    // Determine scope
    const scope = this._determineScope(analysis, options);

    // Generate description
    const description = this._generateDescription(analysis, context, options);

    // Check for breaking changes
    const breaking = this._isBreakingChange(analysis, context);

    // Generate full message
    let fullMessage = `${type}`;
    if (scope) {
      fullMessage += `(${scope})`;
    }
    if (breaking) {
      fullMessage += '!';
    }
    fullMessage += `: ${description}`;

    // Generate body if needed
    let body: string | undefined;
    if (options?.includeBody && (analysis.additions > 50 || analysis.deletions > 20)) {
      body = this._generateBody(analysis);
    }

    // Generate footer if breaking
    let footer: string | undefined;
    if (breaking) {
      footer = 'BREAKING CHANGE: This change may break existing functionality';
    }

    // Generate alternatives
    const alternatives = this._generateAlternatives(type, scope, description, analysis);

    return {
      type,
      scope,
      description,
      body,
      footer,
      breaking,
      fullMessage,
      alternatives,
    };
  }

  private _determineCommitType(analysis: CommitAnalysis): ConventionalCommitType {
    const changeTypes = analysis.changeTypes;

    if (changeTypes.includes('fix')) return 'fix';
    if (changeTypes.includes('test')) return 'test';
    if (changeTypes.includes('docs')) return 'docs';
    if (changeTypes.includes('style')) return 'style';
    if (changeTypes.includes('refactor')) return 'refactor';
    if (changeTypes.includes('addition')) return 'feat';
    if (changeTypes.includes('removal')) return 'chore';

    // Default based on file patterns
    const files = analysis.filesChanged.join(' ');
    if (files.includes('test') || files.includes('spec')) return 'test';
    if (files.includes('package') || files.includes('lock')) return 'chore';
    if (files.includes('.github') || files.includes('.yml') || files.includes('.yaml')) return 'ci';

    return 'chore';
  }

  private _determineScope(analysis: CommitAnalysis, options?: CommitMessageOptions): string | undefined {
    // Use suggested scopes
    if (analysis.suggestedScopes.length > 0) {
      return analysis.suggestedScopes[0];
    }

    // Check user-defined scopes
    if (options?.scopes && options.scopes.length > 0) {
      for (const scope of options.scopes) {
        if (analysis.filesChanged.some(f => f.includes(scope))) {
          return scope;
        }
      }
    }

    return undefined;
  }

  private _generateDescription(
    analysis: CommitAnalysis,
    context?: string,
    options?: CommitMessageOptions
  ): string {
    const parts: string[] = [];

    // Base description from change type
    const changeType = analysis.changeTypes[0];
    switch (changeType) {
      case 'addition':
        parts.push('add');
        break;
      case 'removal':
        parts.push('remove');
        break;
      case 'fix':
        parts.push('fix');
        break;
      case 'refactor':
        parts.push('refactor');
        break;
      default:
        parts.push('update');
    }

    // Add subject from files
    const fileNames = analysis.filesChanged
      .map(f => f.split('/').pop()?.replace(/\.[^.]+$/, ''))
      .filter(Boolean)
      .slice(0, 2);

    if (fileNames.length > 0) {
      parts.push(fileNames.join(' and '));
    }

    // Add context if provided
    if (context) {
      const contextWords = context.toLowerCase().split(' ').slice(0, 3);
      parts.push(...contextWords);
    }

    let description = parts.join(' ');

    // Truncate if needed
    const maxLen = options?.maxLength || 72;
    if (description.length > maxLen - 20) {
      description = description.substring(0, maxLen - 23) + '...';
    }

    return description;
  }

  private _isBreakingChange(analysis: CommitAnalysis, context?: string): boolean {
    if (context?.toLowerCase().includes('breaking')) return true;
    if (analysis.changeTypes.includes('removal')) return true;

    const diff = analysis.filesChanged.join(' ');
    if (diff.includes('BREAKING') || diff.includes('breaking-change')) return true;

    return false;
  }

  private _generateBody(analysis: CommitAnalysis): string {
    const lines: string[] = [];

    lines.push(`Changes in ${analysis.filesChanged.length} file(s):`);
    for (const file of analysis.filesChanged.slice(0, 10)) {
      lines.push(`- ${file}`);
    }

    lines.push('');
    lines.push(`+${analysis.additions} additions, -${analysis.deletions} deletions`);

    return lines.join('\n');
  }

  private _generateAlternatives(
    type: ConventionalCommitType,
    scope: string | undefined,
    description: string,
    analysis: CommitAnalysis
  ): string[] {
    const alternatives: string[] = [];

    // Alternative without scope
    if (scope) {
      alternatives.push(`${type}: ${description}`);
    }

    // Alternative type
    const altTypes: ConventionalCommitType[] = ['chore', 'refactor', 'docs'];
    for (const altType of altTypes) {
      if (altType !== type) {
        alternatives.push(`${altType}${scope ? `(${scope})` : ''}: ${description}`);
      }
    }

    // Shorter description
    const shortDesc = description.split(' ').slice(0, 3).join(' ');
    alternatives.push(`${type}${scope ? `(${scope})` : ''}: ${shortDesc}`);

    return alternatives.slice(0, 3);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

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

export default function createSkill(config?: Partial<SkillConfig>): CommitMessageSkill {
  return new CommitMessageSkill(config);
}

export { definition };
