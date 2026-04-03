/**
 * @fileoverview Review PR Command - /review-pr
 * @module commands/review/review-pr
 * @description Review a pull request with comprehensive analysis.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { spawn } from 'child_process';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * PR review result
 * @interface PRReviewResult
 */
interface PRReviewResult {
  /** PR number or branch */
  pr: string;
  /** Source branch */
  sourceBranch: string;
  /** Target branch */
  targetBranch: string;
  /** Commits in PR */
  commits: number;
  /** Files changed */
  filesChanged: number;
  /** Insertions */
  insertions: number;
  /** Deletions */
  deletions: number;
  /** Review comments */
  comments: ReviewComment[];
  /** Overall assessment */
  assessment: {
    approved: boolean;
    requiresChanges: boolean;
    summary: string;
  };
}

/**
 * Review comment
 * @interface ReviewComment
 */
interface ReviewComment {
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Severity */
  severity: 'critical' | 'major' | 'minor' | 'info';
  /** Comment message */
  message: string;
  /** Suggested change */
  suggestion?: string;
  /** Category */
  category: string;
}

/**
 * Review PR Command Implementation
 * @class ReviewPRCommand
 * @extends Command
 * @description Reviews a pull request with comprehensive analysis of changes,
 * code quality, security, and best practices.
 * 
 * @example
 * ```typescript
 * const cmd = new ReviewPRCommand();
 * const result = await cmd.run(context, {
 *   command: 'review-pr',
 *   args: { pr: '42' },
 *   options: { detailed: true },
 *   raw: '/review-pr 42 --detailed'
 * });
 * ```
 */
export class ReviewPRCommand extends Command {
  constructor() {
    super({
      name: 'review-pr',
      description: 'Review a pull request with comprehensive analysis',
      category: 'review',
      aliases: ['rpr', 'pr-review'],
      arguments: [
        {
          name: 'pr',
          description: 'PR number, branch name, or commit range',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 'd',
          long: 'detailed',
          description: 'Show detailed review with line-by-line comments',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'focus',
          description: 'Focus areas for review',
          type: 'array',
          choices: ['security', 'performance', 'architecture', 'tests', 'documentation']
        },
        {
          short: 's',
          long: 'summary-only',
          description: 'Only show summary, skip detailed analysis',
          type: 'boolean',
          default: false
        },
        {
          short: 'a',
          long: 'auto-approve',
          description: 'Auto-approve if no issues found',
          type: 'boolean',
          default: false
        },
        {
          long: 'max-comments',
          description: 'Maximum number of comments to show',
          type: 'number',
          default: 50
        },
        {
          long: 'check-tests',
          description: 'Verify tests are included',
          type: 'boolean',
          default: true
        },
        {
          long: 'check-docs',
          description: 'Verify documentation is updated',
          type: 'boolean',
          default: true
        },
        {
          long: 'json',
          description: 'Output as JSON',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        {
          description: 'Review PR by number',
          command: '/review-pr 42'
        },
        {
          description: 'Review branch changes',
          command: '/review-pr feature-branch'
        },
        {
          description: 'Detailed review',
          command: '/review-pr 42 --detailed'
        },
        {
          description: 'Focus on security',
          command: '/review-pr 42 --focus=security'
        }
      ],
      permissions: {
        requireGit: true,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['review-file', 'review-changes', 'review-last-commit'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        detailed?: boolean;
        focus?: string[];
        'summary-only'?: boolean;
        'auto-approve'?: boolean;
        'max-comments'?: number;
        'check-tests'?: boolean;
        'check-docs'?: boolean;
        json?: boolean;
      };

      const pr = args.args.pr as string;

      // Get PR information
      const prInfo = await this.getPRInfo(context, pr);

      // Get changed files
      const changedFiles = await this.getChangedFiles(context, prInfo.base, prInfo.head);

      // Analyze changes
      const analysis = await this.analyzeChanges(context, changedFiles, options);

      // Generate review
      const review: PRReviewResult = {
        pr,
        sourceBranch: prInfo.head,
        targetBranch: prInfo.base,
        commits: prInfo.commits,
        filesChanged: changedFiles.length,
        insertions: analysis.insertions,
        deletions: analysis.deletions,
        comments: analysis.comments,
        assessment: this.generateAssessment(analysis, options)
      };

      if (options.json) {
        return CommandResultBuilder.success(review);
      }

      this.displayResult(context, review, options);

      return CommandResultBuilder.success(review);
    } catch (error) {
      return CommandResultBuilder.failure(
        `PR review failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getPRInfo(context: CommandContext, pr: string): Promise<{
    base: string;
    head: string;
    commits: number;
  }> {
    // Try to get PR info from git
    try {
      // Check if it's a branch name
      const branches = await this.executeGitCommand(['branch', '-a'], context.cwd);
      
      if (branches.includes(pr)) {
        return {
          base: 'main',
          head: pr,
          commits: 0
        };
      }

      // Default to comparing against main/master
      return {
        base: 'HEAD',
        head: pr,
        commits: 0
      };
    } catch {
      return {
        base: 'main',
        head: pr,
        commits: 0
      };
    }
  }

  private async getChangedFiles(
    context: CommandContext,
    base: string,
    head: string
  ): Promise<string[]> {
    const output = await this.executeGitCommand(
      ['diff', '--name-only', `${base}...${head}`],
      context.cwd
    );
    return output.split('\n').filter(f => f.trim());
  }

  private async analyzeChanges(
    context: CommandContext,
    files: string[],
    options: Record<string, unknown>
  ): Promise<{
    insertions: number;
    deletions: number;
    comments: ReviewComment[];
  }> {
    const comments: ReviewComment[] = [];
    let insertions = 0;
    let deletions = 0;

    // Get diff stats
    const diffOutput = await this.executeGitCommand(
      ['diff', '--stat', 'HEAD'],
      context.cwd
    );

    const statsMatch = diffOutput.match(/(\d+) insertions?\(\+\)/);
    const delMatch = diffOutput.match(/(\d+) deletions?\(-\)/);
    insertions = statsMatch ? parseInt(statsMatch[1], 10) : 0;
    deletions = delMatch ? parseInt(delMatch[1], 10) : 0;

    // Check for test files
    const hasTestFiles = files.some(f => 
      f.includes('.test.') || 
      f.includes('.spec.') || 
      f.includes('__tests__') ||
      f.includes('/test/')
    );

    if (options['check-tests'] && !hasTestFiles && files.some(f => 
      f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py')
    )) {
      comments.push({
        file: 'PR',
        severity: 'minor',
        message: 'No test files detected in this PR',
        category: 'testing',
        suggestion: 'Consider adding tests for new functionality'
      });
    }

    // Check for documentation updates
    const hasDocUpdates = files.some(f => 
      f.endsWith('.md') || 
      f.includes('docs/') ||
      f.includes('README')
    );

    if (options['check-docs'] && !hasDocUpdates) {
      comments.push({
        file: 'PR',
        severity: 'info',
        message: 'No documentation updates detected',
        category: 'documentation',
        suggestion: 'Consider updating documentation if needed'
      });
    }

    // Check file sizes
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          const output = await this.executeGitCommand(
            ['diff', '--stat', 'HEAD', '--', file],
            context.cwd
          );
          const fileStats = output.match(/(\d+)\s+\+\+\+/);
          if (fileStats) {
            const added = parseInt(fileStats[1], 10);
            if (added > 500) {
              comments.push({
                file,
                severity: 'minor',
                message: `Large file with ${added} lines added`,
                category: 'maintainability',
                suggestion: 'Consider breaking into smaller modules'
              });
            }
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    }

    return { insertions, deletions, comments };
  }

  private generateAssessment(
    analysis: { comments: ReviewComment[] },
    options: Record<string, unknown>
  ): {
    approved: boolean;
    requiresChanges: boolean;
    summary: string;
  } {
    const criticalIssues = analysis.comments.filter(c => c.severity === 'critical').length;
    const majorIssues = analysis.comments.filter(c => c.severity === 'major').length;

    if (criticalIssues > 0) {
      return {
        approved: false,
        requiresChanges: true,
        summary: `Critical issues found (${criticalIssues}). Changes required.`
      };
    }

    if (majorIssues > 0) {
      return {
        approved: false,
        requiresChanges: true,
        summary: `Major issues found (${majorIssues}). Changes recommended.`
      };
    }

    if (options['auto-approve'] && analysis.comments.length === 0) {
      return {
        approved: true,
        requiresChanges: false,
        summary: 'No issues found. Auto-approved.'
      };
    }

    return {
      approved: false,
      requiresChanges: false,
      summary: 'Minor suggestions provided. Ready for review.'
    };
  }

  private displayResult(
    context: CommandContext,
    review: PRReviewResult,
    options: Record<string, unknown>
  ): void {
    context.output.write('\n');
    context.output.write(`\x1b[1mPR Review: ${review.pr}\x1b[0m\n`);
    context.output.write(`  ${review.sourceBranch} → ${review.targetBranch}\n`);
    context.output.write(`\n`);

    // Stats
    context.output.write(`\x1b[1mChanges:\x1b[0m\n`);
    context.output.write(`  Files changed: ${review.filesChanged}\n`);
    context.output.write(`  Commits: ${review.commits}\n`);
    context.output.write(`  Insertions: \x1b[32m+${review.insertions}\x1b[0m\n`);
    context.output.write(`  Deletions: \x1b[31m-${review.deletions}\x1b[0m\n`);

    // Assessment
    context.output.write(`\n\x1b[1mAssessment:\x1b[0m\n`);
    if (review.assessment.approved) {
      context.output.write(`  \x1b[32m✓ Approved\x1b[0m\n`);
    } else if (review.assessment.requiresChanges) {
      context.output.write(`  \x1b[31m✗ Changes Required\x1b[0m\n`);
    } else {
      context.output.write(`  \x1b[33m⚠ Review Comments\x1b[0m\n`);
    }
    context.output.write(`  ${review.assessment.summary}\n`);

    // Comments
    if (review.comments.length > 0 && !options['summary-only']) {
      context.output.write(`\n\x1b[1mComments (${review.comments.length}):\x1b[0m\n`);
      
      for (const comment of review.comments.slice(0, options['max-comments'] as number || 50)) {
        const icon = comment.severity === 'critical' ? '🔴' :
                    comment.severity === 'major' ? '🟠' :
                    comment.severity === 'minor' ? '🟡' : '🔵';
        context.output.write(`\n  ${icon} \x1b[1m${comment.file}${comment.line ? `:${comment.line}` : ''}\x1b[0m\n`);
        context.output.write(`     ${comment.message}\n`);
        if (comment.suggestion) {
          context.output.write(`     \x1b[90m→ ${comment.suggestion}\x1b[0m\n`);
        }
      }
    }

    context.output.write('\n');
  }

  private async executeGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(stderr || `Git exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mREVIEW SEVERITY LEVELS\x1b[0m

  🔴 Critical: Must fix before merge
  🟠 Major: Should fix, significant impact
  🟡 Minor: Nice to have, minor impact
  🔵 Info: Informational, no action required

\x1b[1m\x1b[36mREVIEW CHECKLIST\x1b[0m

  ✓ Code follows style guidelines
  ✓ Tests are included
  ✓ Documentation is updated
  ✓ Security considerations addressed
  ✓ Performance impact considered
  ✓ Backwards compatibility maintained

`;
  }
}

export default ReviewPRCommand;
