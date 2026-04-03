/**
 * Trim Strategy - Content trimming strategies for micro compression
 * 
 * Provides intelligent content trimming:
 * - Sentence-aware trimming
 * - Paragraph-aware trimming
 * - Section-aware trimming
 * - Code-aware trimming
 * - Preserves semantic boundaries
 */

import type { ContextMessage } from '../../types/index.js';
import { countTokens } from '../../utils/tokenCounter.js';

// ============================================================================
// Trim Configuration
// ============================================================================

export interface TrimConfig {
  maxTokens: number;
  preserveSentences: boolean;
  preserveParagraphs: boolean;
  preserveCodeBlocks: boolean;
  minContentRatio: number;
  truncationMarker: string;
}

export const DEFAULT_TRIM_CONFIG: TrimConfig = {
  maxTokens: 800,
  preserveSentences: true,
  preserveParagraphs: true,
  preserveCodeBlocks: true,
  minContentRatio: 0.3,
  truncationMarker: '\n...[content trimmed]',
};

// ============================================================================
// Trim Result
// ============================================================================

export interface TrimResult {
  content: string;
  wasTrimmed: boolean;
  originalTokens: number;
  finalTokens: number;
  tokensRemoved: number;
  trimPoints: number;
}

// ============================================================================
// Base Trim Strategy
// ============================================================================

export interface TrimStrategy {
  name: string;
  trim(content: string, targetTokens?: number): TrimResult;
  canTrim(content: string): boolean;
  estimateTrimSavings(content: string): number;
}

// ============================================================================
// Sentence-Aware Trimmer
// ============================================================================

export class SentenceTrimmer implements TrimStrategy {
  name = 'sentence';
  private config: TrimConfig;

  constructor(config: Partial<TrimConfig> = {}) {
    this.config = { ...DEFAULT_TRIM_CONFIG, ...config };
  }

  trim(content: string, targetTokens?: number): TrimResult {
    const target = targetTokens || this.config.maxTokens;
    const originalTokens = countTokens(content);

    if (originalTokens <= target) {
      return {
        content,
        wasTrimmed: false,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        trimPoints: 0,
      };
    }

    // Split into sentences
    const sentences = this.splitIntoSentences(content);
    
    if (sentences.length <= 2) {
      // Not enough sentences for meaningful trimming
      return this.fallbackTrim(content, target);
    }

    // Build content up to target
    let result = '';
    let currentTokens = 0;
    let trimPoints = 0;

    for (const sentence of sentences) {
      const sentenceTokens = countTokens(sentence);
      
      if (currentTokens + sentenceTokens > target * 0.9) {
        trimPoints++;
        break;
      }

      result += sentence + ' ';
      currentTokens += sentenceTokens;
    }

    const trimmed = result.trim() + this.config.truncationMarker;
    const finalTokens = countTokens(trimmed);

    return {
      content: trimmed,
      wasTrimmed: true,
      originalTokens,
      finalTokens,
      tokensRemoved: originalTokens - finalTokens,
      trimPoints,
    };
  }

  canTrim(content: string): boolean {
    const tokens = countTokens(content);
    return tokens > this.config.maxTokens;
  }

  estimateTrimSavings(content: string): number {
    const tokens = countTokens(content);
    if (tokens <= this.config.maxTokens) {
      return 0;
    }
    return Math.floor(tokens * 0.3); // Estimate 30% savings
  }

  private splitIntoSentences(text: string): string[] {
    // Match sentences ending with . ! ? followed by space or end
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
    const matches = text.match(sentenceRegex);
    return matches ? matches.map(s => s.trim()) : [text];
  }

  private fallbackTrim(content: string, target: number): TrimResult {
    const originalTokens = countTokens(content);
    const approxChars = target * 4;
    
    if (content.length <= approxChars) {
      return {
        content,
        wasTrimmed: false,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        trimPoints: 0,
      };
    }

    const trimmed = content.slice(0, approxChars) + this.config.truncationMarker;
    const finalTokens = countTokens(trimmed);

    return {
      content: trimmed,
      wasTrimmed: true,
      originalTokens,
      finalTokens,
      tokensRemoved: originalTokens - finalTokens,
      trimPoints: 1,
    };
  }
}

// ============================================================================
// Paragraph-Aware Trimmer
// ============================================================================

export class ParagraphTrimmer implements TrimStrategy {
  name = 'paragraph';
  private config: TrimConfig;

  constructor(config: Partial<TrimConfig> = {}) {
    this.config = { ...DEFAULT_TRIM_CONFIG, ...config };
  }

  trim(content: string, targetTokens?: number): TrimResult {
    const target = targetTokens || this.config.maxTokens;
    const originalTokens = countTokens(content);

    if (originalTokens <= target) {
      return {
        content,
        wasTrimmed: false,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        trimPoints: 0,
      };
    }

    // Split into paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    
    if (paragraphs.length <= 2) {
      // Use sentence trimmer as fallback
      const sentenceTrimmer = new SentenceTrimmer(this.config);
      return sentenceTrimmer.trim(content, target);
    }

    // Build content up to target
    let result = '';
    let currentTokens = 0;
    let trimPoints = 0;

    for (const paragraph of paragraphs) {
      const paraTokens = countTokens(paragraph);
      
      if (currentTokens + paraTokens > target * 0.9) {
        trimPoints++;
        break;
      }

      result += paragraph + '\n\n';
      currentTokens += paraTokens;
    }

    const trimmed = result.trim() + this.config.truncationMarker;
    const finalTokens = countTokens(trimmed);

    return {
      content: trimmed,
      wasTrimmed: true,
      originalTokens,
      finalTokens,
      tokensRemoved: originalTokens - finalTokens,
      trimPoints,
    };
  }

  canTrim(content: string): boolean {
    return countTokens(content) > this.config.maxTokens;
  }

  estimateTrimSavings(content: string): number {
    const tokens = countTokens(content);
    if (tokens <= this.config.maxTokens) {
      return 0;
    }
    return Math.floor(tokens * 0.35);
  }
}

// ============================================================================
// Section-Aware Trimmer (for markdown content)
// ============================================================================

export class SectionTrimmer implements TrimStrategy {
  name = 'section';
  private config: TrimConfig;

  constructor(config: Partial<TrimConfig> = {}) {
    this.config = { ...DEFAULT_TRIM_CONFIG, ...config };
  }

  trim(content: string, targetTokens?: number): TrimResult {
    const target = targetTokens || this.config.maxTokens;
    const originalTokens = countTokens(content);

    if (originalTokens <= target) {
      return {
        content,
        wasTrimmed: false,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        trimPoints: 0,
      };
    }

    // Extract sections based on headers
    const sections = this.extractSections(content);
    
    if (sections.length <= 2) {
      // Use paragraph trimmer as fallback
      const paragraphTrimmer = new ParagraphTrimmer(this.config);
      return paragraphTrimmer.trim(content, target);
    }

    // Build content up to target
    let result = '';
    let currentTokens = 0;
    let trimPoints = 0;

    for (const section of sections) {
      const sectionTokens = countTokens(section.content);
      
      if (currentTokens + sectionTokens > target * 0.9) {
        trimPoints++;
        break;
      }

      result += section.content + '\n\n';
      currentTokens += sectionTokens;
    }

    const trimmed = result.trim() + this.config.truncationMarker;
    const finalTokens = countTokens(trimmed);

    return {
      content: trimmed,
      wasTrimmed: true,
      originalTokens,
      finalTokens,
      tokensRemoved: originalTokens - finalTokens,
      trimPoints,
    };
  }

  canTrim(content: string): boolean {
    return countTokens(content) > this.config.maxTokens;
  }

  estimateTrimSavings(content: string): number {
    const tokens = countTokens(content);
    if (tokens <= this.config.maxTokens) {
      return 0;
    }
    return Math.floor(tokens * 0.4);
  }

  private extractSections(content: string): Array<{ header: string; content: string }> {
    const sections: Array<{ header: string; content: string }> = [];
    const headerRegex = /^(#{1,6}\s+.+)$/gm;
    
    let lastIndex = 0;
    let lastHeader = '';
    let match;

    while ((match = headerRegex.exec(content)) !== null) {
      if (lastHeader) {
        sections.push({
          header: lastHeader,
          content: content.slice(lastIndex, match.index),
        });
      }
      lastHeader = match[1];
      lastIndex = match.index;
    }

    // Add final section
    if (lastHeader) {
      sections.push({
        header: lastHeader,
        content: content.slice(lastIndex),
      });
    } else {
      // No headers found, treat as single section
      sections.push({ header: '', content });
    }

    return sections;
  }
}

// ============================================================================
// Code-Aware Trimmer
// ============================================================================

export class CodeTrimmer implements TrimStrategy {
  name = 'code';
  private config: TrimConfig;

  constructor(config: Partial<TrimConfig> = {}) {
    this.config = { ...DEFAULT_TRIM_CONFIG, ...config };
  }

  trim(content: string, targetTokens?: number): TrimResult {
    const target = targetTokens || this.config.maxTokens;
    const originalTokens = countTokens(content);

    if (originalTokens <= target) {
      return {
        content,
        wasTrimmed: false,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        trimPoints: 0,
      };
    }

    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content);
    const textParts = this.extractTextParts(content, codeBlocks);

    // Trim text parts
    const sentenceTrimmer = new SentenceTrimmer(this.config);
    const trimmedTextParts = textParts.map(part => sentenceTrimmer.trim(part, target / textParts.length));

    // Trim code blocks
    const trimmedCodeBlocks = codeBlocks.map(block => this.trimCodeBlock(block, target / codeBlocks.length));

    // Reassemble
    let result = '';
    for (let i = 0; i < Math.max(trimmedTextParts.length, trimmedCodeBlocks.length); i++) {
      if (i < trimmedTextParts.length) {
        result += trimmedTextParts[i].content;
      }
      if (i < trimmedCodeBlocks.length) {
        result += trimmedCodeBlocks[i];
      }
    }

    const finalTokens = countTokens(result);

    return {
      content: result,
      wasTrimmed: true,
      originalTokens,
      finalTokens,
      tokensRemoved: originalTokens - finalTokens,
      trimPoints: codeBlocks.length + textParts.length,
    };
  }

  canTrim(content: string): boolean {
    return countTokens(content) > this.config.maxTokens;
  }

  estimateTrimSavings(content: string): number {
    const tokens = countTokens(content);
    if (tokens <= this.config.maxTokens) {
      return 0;
    }
    return Math.floor(tokens * 0.25);
  }

  private extractCodeBlocks(content: string): Array<{ language?: string; code: string; fullMatch: string }> {
    const blocks: Array<{ language?: string; code: string; fullMatch: string }> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1],
        code: match[2],
        fullMatch: match[0],
      });
    }

    return blocks;
  }

  private extractTextParts(
    content: string,
    codeBlocks: Array<{ fullMatch: string }>
  ): string[] {
    let remaining = content;
    const parts: string[] = [];

    for (const block of codeBlocks) {
      const index = remaining.indexOf(block.fullMatch);
      if (index > 0) {
        parts.push(remaining.slice(0, index));
      }
      remaining = remaining.slice(index + block.fullMatch.length);
    }

    if (remaining.length > 0) {
      parts.push(remaining);
    }

    return parts;
  }

  private trimCodeBlock(
    block: { language?: string; code: string; fullMatch: string },
    targetTokens: number
  ): string {
    const codeTokens = countTokens(block.code);
    
    if (codeTokens <= targetTokens) {
      return block.fullMatch;
    }

    // Trim code by keeping first part and adding ellipsis
    const lines = block.code.split('\n');
    let result = '';
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = countTokens(line);
      
      if (currentTokens + lineTokens > targetTokens * 0.8) {
        break;
      }

      result += line + '\n';
      currentTokens += lineTokens;
    }

    return `\`\`\`${block.language || ''}\n${result}// ... [code truncated]\n\`\`\``;
  }
}

// ============================================================================
// Smart Trimmer (Auto-selects best strategy)
// ============================================================================

export class SmartTrimmer implements TrimStrategy {
  name = 'smart';
  private config: TrimConfig;
  private strategies: TrimStrategy[];

  constructor(config: Partial<TrimConfig> = {}) {
    this.config = { ...DEFAULT_TRIM_CONFIG, ...config };
    this.strategies = [
      new SectionTrimmer(this.config),
      new ParagraphTrimmer(this.config),
      new SentenceTrimmer(this.config),
      new CodeTrimmer(this.config),
    ];
  }

  trim(content: string, targetTokens?: number): TrimResult {
    const strategy = this.selectStrategy(content);
    return strategy.trim(content, targetTokens);
  }

  canTrim(content: string): boolean {
    return countTokens(content) > this.config.maxTokens;
  }

  estimateTrimSavings(content: string): number {
    const strategy = this.selectStrategy(content);
    return strategy.estimateTrimSavings(content);
  }

  private selectStrategy(content: string): TrimStrategy {
    // Check for markdown sections
    if (/^#{1,6}\s/m.test(content)) {
      return this.strategies[0]; // Section
    }

    // Check for code blocks
    if (/```/.test(content)) {
      return this.strategies[3]; // Code
    }

    // Check for multiple paragraphs
    if (content.split(/\n\s*\n/).length > 3) {
      return this.strategies[1]; // Paragraph
    }

    // Default to sentence
    return this.strategies[2];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createTrimmer(
  type: 'sentence' | 'paragraph' | 'section' | 'code' | 'smart',
  config?: Partial<TrimConfig>
): TrimStrategy {
  switch (type) {
    case 'sentence':
      return new SentenceTrimmer(config);
    case 'paragraph':
      return new ParagraphTrimmer(config);
    case 'section':
      return new SectionTrimmer(config);
    case 'code':
      return new CodeTrimmer(config);
    case 'smart':
    default:
      return new SmartTrimmer(config);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function trimMessage(
  message: ContextMessage,
  maxTokens?: number
): ContextMessage {
  const trimmer = new SmartTrimmer(maxTokens ? { maxTokens } : undefined);
  const result = trimmer.trim(message.content);
  
  if (result.wasTrimmed) {
    return {
      ...message,
      content: result.content,
      tokenCount: result.finalTokens,
      compressionLevel: 'light',
      originalContent: message.content,
    };
  }

  return message;
}

export function estimateTrim(message: ContextMessage, maxTokens?: number): {
  canTrim: boolean;
  estimatedSavings: number;
} {
  const trimmer = new SmartTrimmer(maxTokens ? { maxTokens } : undefined);
  
  return {
    canTrim: trimmer.canTrim(message.content),
    estimatedSavings: trimmer.estimateTrimSavings(message.content),
  };
}
