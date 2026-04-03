/**
 * @fileoverview Review File Command - /review-file
 * @module commands/review/review-file
 * @description Review a single file for code quality, style, and potential issues.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { 
  Command, 
  CommandContext, 
  ParsedArguments, 
  CommandResult,
  CommandResultBuilder 
} from '../Command';

/**
 * Review issue severity
 * @type IssueSeverity
 */
type IssueSeverity = 'error' | 'warning' | 'info' | 'suggestion';

/**
 * Review issue
 * @interface ReviewIssue
 */
interface ReviewIssue {
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue message */
  message: string;
  /** Issue category */
  category: string;
  /** Suggested fix */
  suggestion?: string;
  /** Rule ID */
  rule?: string;
}

/**
 * File review result
 * @interface FileReviewResult
 */
interface FileReviewResult {
  /** File path */
  filePath: string;
  /** File extension */
  extension: string;
  /** Lines of code */
  linesOfCode: number;
  /** Issues found */
  issues: ReviewIssue[];
  /** Issue counts by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
    suggestions: number;
    total: number;
  };
  /** Code quality score (0-100) */
  qualityScore: number;
}

/**
 * Review File Command Implementation
 * @class ReviewFileCommand
 * @extends Command
 * @description Reviews a single file for code quality, style issues, potential bugs,
 * security concerns, and best practices.
 * 
 * @example
 * ```typescript
 * const cmd = new ReviewFileCommand();
 * const result = await cmd.run(context, {
 *   command: 'review-file',
 *   args: { file: 'src/index.ts' },
 *   options: { strict: true },
 *   raw: '/review-file src/index.ts --strict'
 * });
 * ```
 */
export class ReviewFileCommand extends Command {
  constructor() {
    super({
      name: 'review-file',
      description: 'Review a single file for code quality and issues',
      category: 'review',
      aliases: ['rf', 'review'],
      arguments: [
        {
          name: 'file',
          description: 'Path to the file to review',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          short: 's',
          long: 'strict',
          description: 'Enable strict mode - treat warnings as errors',
          type: 'boolean',
          default: false
        },
        {
          short: 'f',
          long: 'focus',
          description: 'Focus on specific review areas',
          type: 'array',
          choices: ['security', 'performance', 'style', 'maintainability', 'accessibility']
        },
        {
          short: 'i',
          long: 'ignore',
          description: 'Ignore specific rules or patterns',
          type: 'array'
        },
        {
          short: 'c',
          long: 'config',
          description: 'Path to review configuration file',
          type: 'string'
        },
        {
          short: 'o',
          long: 'output',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'text'
        },
        {
          long: 'max-issues',
          description: 'Maximum number of issues to report',
          type: 'number',
          default: 100
        },
        {
          long: 'show-suggestions',
          description: 'Show code improvement suggestions',
          type: 'boolean',
          default: true
        },
        {
          long: 'show-stats',
          description: 'Show code statistics',
          type: 'boolean',
          default: true
        },
        {
          long: 'no-color',
          description: 'Disable colored output',
          type: 'boolean',
          default: false
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
          description: 'Review a file',
          command: '/review-file src/index.ts'
        },
        {
          description: 'Review with strict mode',
          command: '/review-file src/index.ts --strict'
        },
        {
          description: 'Focus on security',
          command: '/review-file src/auth.ts --focus=security'
        },
        {
          description: 'Output as JSON',
          command: '/review-file src/index.ts --json'
        }
      ],
      permissions: {
        requireGit: false,
        requireCleanWorkingDir: false
      },
      relatedCommands: ['review-pr', 'review-changes', 'review-last-commit'],
      version: '1.0.0'
    });
  }

  async execute(context: CommandContext, args: ParsedArguments): Promise<CommandResult> {
    try {
      const options = args.options as {
        strict?: boolean;
        focus?: string[];
        ignore?: string[];
        config?: string;
        output?: string;
        'max-issues'?: number;
        'show-suggestions'?: boolean;
        'show-stats'?: boolean;
        'no-color'?: boolean;
        json?: boolean;
      };

      const filePath = resolve(context.cwd, args.args.file as string);

      // Validate file exists
      if (!existsSync(filePath)) {
        return CommandResultBuilder.failure(`File not found: ${args.args.file}`);
      }

      // Read file content
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (error) {
        return CommandResultBuilder.failure(`Cannot read file: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Perform review
      const result = await this.reviewFile(filePath, content, options);

      // Output result
      if (options.json || options.output === 'json') {
        return CommandResultBuilder.success(result);
      }

      this.displayResult(context, result, options);

      // Return appropriate exit code
      if (result.summary.errors > 0 || (options.strict && result.summary.warnings > 0)) {
        return CommandResultBuilder.failure(
          `Found ${result.summary.errors} error(s)${options.strict ? ` and ${result.summary.warnings} warning(s)` : ''}`,
          1
        );
      }

      return CommandResultBuilder.success(result);
    } catch (error) {
      return CommandResultBuilder.failure(
        `Review failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async reviewFile(
    filePath: string,
    content: string,
    options: Record<string, unknown>
  ): Promise<FileReviewResult> {
    const lines = content.split('\n');
    const extension = extname(filePath).toLowerCase();
    const issues: ReviewIssue[] = [];

    // Language-specific reviews
    switch (extension) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        issues.push(...this.reviewJavaScript(content, lines, options));
        break;
      case '.py':
        issues.push(...this.reviewPython(content, lines, options));
        break;
      case '.java':
        issues.push(...this.reviewJava(content, lines, options));
        break;
      case '.go':
        issues.push(...this.reviewGo(content, lines, options));
        break;
      case '.rs':
        issues.push(...this.reviewRust(content, lines, options));
        break;
      case '.md':
      case '.mdx':
        issues.push(...this.reviewMarkdown(content, lines, options));
        break;
      default:
        issues.push(...this.reviewGeneric(content, lines, options));
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(lines.length, issues);

    // Calculate summary
    const summary = {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      suggestions: issues.filter(i => i.severity === 'suggestion').length,
      total: issues.length
    };

    // Limit issues
    const maxIssues = (options['max-issues'] as number) || 100;
    const limitedIssues = issues.slice(0, maxIssues);

    return {
      filePath,
      extension,
      linesOfCode: lines.length,
      issues: limitedIssues,
      summary,
      qualityScore
    };
  }

  private reviewJavaScript(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const focus = (options.focus as string[]) || [];
    const checkSecurity = focus.length === 0 || focus.includes('security');
    const checkStyle = focus.length === 0 || focus.includes('style');
    const checkPerformance = focus.length === 0 || focus.includes('performance');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Security checks
      if (checkSecurity) {
        if (line.includes('eval(') && !line.includes('//')) {
          issues.push({
            line: lineNum,
            severity: 'error',
            message: 'Use of eval() is dangerous and should be avoided',
            category: 'security',
            suggestion: 'Use JSON.parse for JSON, or safer alternatives'
          });
        }

        if (/innerHTML\s*=/.test(line)) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: 'innerHTML assignment can lead to XSS vulnerabilities',
            category: 'security',
            suggestion: 'Use textContent or sanitize input with DOMPurify'
          });
        }

        if (/password|secret|token|key/i.test(line) && /[=:]\s*["\'][^"\']+["\']/.test(line)) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: 'Potential hardcoded secret detected',
            category: 'security',
            suggestion: 'Use environment variables or secret management'
          });
        }
      }

      // Style checks
      if (checkStyle) {
        if (line.length > 120) {
          issues.push({
            line: lineNum,
            severity: 'suggestion',
            message: 'Line exceeds 120 characters',
            category: 'style',
            suggestion: 'Break into multiple lines'
          });
        }

        if (line.endsWith(' ') || line.endsWith('\t')) {
          issues.push({
            line: lineNum,
            severity: 'suggestion',
            message: 'Trailing whitespace detected',
            category: 'style',
            suggestion: 'Remove trailing whitespace'
          });
        }

        if (/console\.(log|warn|error|info)\(/.test(line)) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: 'Console statement found',
            category: 'maintainability',
            suggestion: 'Remove console statements or use a proper logger'
          });
        }
      }

      // Performance checks
      if (checkPerformance) {
        if (/\.forEach\(/.test(line) && /await/.test(line)) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: 'forEach with async operations executes sequentially',
            category: 'performance',
            suggestion: 'Use Promise.all() with map() for parallel execution'
          });
        }
      }
    });

    // Check for TODO/FIXME comments
    lines.forEach((line, index) => {
      if (/TODO|FIXME|HACK|XXX/.test(line)) {
        issues.push({
          line: index + 1,
          severity: 'info',
          message: `Found ${line.match(/TODO|FIXME|HACK|XXX/)?.[0]} comment`,
          category: 'maintainability',
          suggestion: 'Address or track this item'
        });
      }
    });

    return issues;
  }

  private reviewPython(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (line.includes('except:') && !line.includes('except Exception')) {
        issues.push({
          line: lineNum,
          severity: 'warning',
          message: 'Bare except clause catches all exceptions including KeyboardInterrupt',
          category: 'maintainability',
          suggestion: 'Use "except Exception:" or specify the exception type'
        });
      }

      if (/print\s*\(/.test(line)) {
        issues.push({
          line: lineNum,
          severity: 'suggestion',
          message: 'Print statement found',
          category: 'maintainability',
          suggestion: 'Use logging module for production code'
        });
      }
    });

    return issues;
  }

  private reviewJava(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    return this.reviewGeneric(content, lines, options);
  }

  private reviewGo(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    return this.reviewGeneric(content, lines, options);
  }

  private reviewRust(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    return this.reviewGeneric(content, lines, options);
  }

  private reviewMarkdown(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for common markdown issues
      if (/^#{1,6}[^\s]/.test(line)) {
        issues.push({
          line: lineNum,
          severity: 'suggestion',
          message: 'Header should have space after #',
          category: 'style'
        });
      }
    });

    return issues;
  }

  private reviewGeneric(content: string, lines: string[], options: Record<string, unknown>): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for very long lines
      if (line.length > 150) {
        issues.push({
          line: lineNum,
          severity: 'suggestion',
          message: 'Line is very long',
          category: 'style'
        });
      }

      // Check for trailing whitespace
      if (/[ \t]$/.test(line)) {
        issues.push({
          line: lineNum,
          severity: 'suggestion',
          message: 'Trailing whitespace',
          category: 'style'
        });
      }
    });

    return issues;
  }

  private calculateQualityScore(linesOfCode: number, issues: ReviewIssue[]): number {
    if (issues.length === 0) return 100;

    const errorWeight = 10;
    const warningWeight = 3;
    const infoWeight = 1;
    const suggestionWeight = 0.5;

    const penalty = 
      issues.filter(i => i.severity === 'error').length * errorWeight +
      issues.filter(i => i.severity === 'warning').length * warningWeight +
      issues.filter(i => i.severity === 'info').length * infoWeight +
      issues.filter(i => i.severity === 'suggestion').length * suggestionWeight;

    const maxPenalty = Math.max(linesOfCode * 0.5, 50);
    const normalizedPenalty = Math.min(penalty, maxPenalty);

    return Math.max(0, Math.round(100 - (normalizedPenalty / maxPenalty) * 100));
  }

  private displayResult(
    context: CommandContext,
    result: FileReviewResult,
    options: Record<string, unknown>
  ): void {
    const noColor = options['no-color'];

    // Header
    context.output.write('\n');
    context.output.write(`\x1b[1mFile Review: ${result.filePath}\x1b[0m\n`);
    context.output.write(`Lines of code: ${result.linesOfCode}\n`);

    // Quality score
    const scoreColor = result.qualityScore >= 80 ? '\x1b[32m' : 
                       result.qualityScore >= 60 ? '\x1b[33m' : '\x1b[31m';
    context.output.write(`Quality Score: ${noColor ? '' : scoreColor}${result.qualityScore}/100${noColor ? '' : '\x1b[0m'}\n`);

    // Summary
    context.output.write('\n\x1b[1mSummary:\x1b[0m\n');
    if (result.summary.errors > 0) {
      context.output.write(`  \x1b[31m✖ ${result.summary.errors} error(s)\x1b[0m\n`);
    }
    if (result.summary.warnings > 0) {
      context.output.write(`  \x1b[33m⚠ ${result.summary.warnings} warning(s)\x1b[0m\n`);
    }
    if (result.summary.info > 0) {
      context.output.write(`  ℹ ${result.summary.info} info\n`);
    }
    if (result.summary.suggestions > 0) {
      context.output.write(`  💡 ${result.summary.suggestions} suggestion(s)\n`);
    }

    // Issues
    if (result.issues.length > 0) {
      context.output.write('\n\x1b[1mIssues:\x1b[0m\n');
      
      for (const issue of result.issues) {
        const severityIcon = issue.severity === 'error' ? '✖' :
                            issue.severity === 'warning' ? '⚠' :
                            issue.severity === 'info' ? 'ℹ' : '💡';
        const severityColor = issue.severity === 'error' ? '\x1b[31m' :
                             issue.severity === 'warning' ? '\x1b[33m' :
                             issue.severity === 'info' ? '\x1b[36m' : '\x1b[90m';
        
        context.output.write(`  ${noColor ? '' : severityColor}${severityIcon} Line ${issue.line}:${noColor ? '' : '\x1b[0m'} ${issue.message}\n`);
        
        if (options['show-suggestions'] && issue.suggestion) {
          context.output.write(`     \x1b[90m→ ${issue.suggestion}\x1b[0m\n`);
        }
      }
    }

    context.output.write('\n');
  }

  public getHelp(): string {
    return super.getHelp() + `
\x1b[1m\x1b[36mREVIEW CATEGORIES\x1b[0m

  security:        Security vulnerabilities, unsafe patterns
  performance:     Performance issues, inefficient code
  style:           Code style, formatting issues
  maintainability: Complexity, code smells
  accessibility:   Accessibility concerns (for web)

\x1b[1m\x1b[36mQUALITY SCORE\x1b[0m

  90-100: Excellent - Minimal issues
  70-89:  Good - Some minor issues
  50-69:  Fair - Several issues to address
  0-49:   Poor - Significant issues need attention

\x1b[1m\x1b[36mCOMMON WORKFLOWS\x1b[0m

  Review a file:
    /review-file src/index.ts

  Focus on security:
    /review-file src/auth.ts --focus=security

  Strict mode (warnings as errors):
    /review-file src/index.ts --strict

`;
  }
}

export default ReviewFileCommand;
