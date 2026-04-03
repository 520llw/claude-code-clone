/**
 * Content Splitter - Intelligent content splitting for context management
 * 
 * Provides strategies for splitting large content into manageable chunks:
 * - Semantic splitting (by paragraphs, sentences)
 * - Code-aware splitting (by functions, classes)
 * - Token-aware splitting (respecting token limits)
 * - Smart reassembly with overlap
 */

import type { TokenCounter } from './tokenCounter.js';
import { countTokens } from './tokenCounter.js';

// ============================================================================
// Splitter Configuration
// ============================================================================

export interface SplitterConfig {
  maxChunkSize: number;
  overlapSize: number;
  respectBoundaries: boolean;
  preserveCodeBlocks: boolean;
  minChunkSize: number;
}

export const DEFAULT_SPLITTER_CONFIG: SplitterConfig = {
  maxChunkSize: 4000,
  overlapSize: 200,
  respectBoundaries: true,
  preserveCodeBlocks: true,
  minChunkSize: 100,
};

// ============================================================================
// Content Chunk
// ============================================================================

export interface ContentChunk {
  id: string;
  content: string;
  index: number;
  totalChunks: number;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  type: 'text' | 'code' | 'mixed';
  boundaries: string[];
  parentId?: string;
  tags?: string[];
}

// ============================================================================
// Base Splitter Interface
// ============================================================================

export interface ContentSplitter {
  split(content: string): ContentChunk[];
  canSplit(content: string): boolean;
  estimateChunks(content: string): number;
}

// ============================================================================
// Token-Aware Splitter
// ============================================================================

export class TokenAwareSplitter implements ContentSplitter {
  private config: SplitterConfig;
  private tokenCounter: TokenCounter;

  constructor(
    config: Partial<SplitterConfig> = {},
    tokenCounter?: TokenCounter
  ) {
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
    this.tokenCounter = tokenCounter || { count: countTokens } as TokenCounter;
  }

  split(content: string): ContentChunk[] {
    const totalTokens = this.tokenCounter.count(content);
    
    if (totalTokens <= this.config.maxChunkSize) {
      return [this.createChunk(content, 0, 1, 0, content.length)];
    }

    const chunks: ContentChunk[] = [];
    const boundaries = this.findBoundaries(content);
    
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    let startOffset = 0;
    let lastBoundaryEnd = 0;

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const segment = content.slice(lastBoundaryEnd, boundary.end);
      const segmentTokens = this.tokenCounter.count(segment);

      if (currentTokens + segmentTokens > this.config.maxChunkSize && currentChunk) {
        // Save current chunk
        chunks.push(this.createChunk(
          currentChunk,
          chunkIndex++,
          0, // Will update later
          startOffset,
          lastBoundaryEnd
        ));

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + segment;
        currentTokens = this.tokenCounter.count(currentChunk);
        startOffset = lastBoundaryEnd - overlapText.length;
      } else {
        currentChunk += segment;
        currentTokens += segmentTokens;
      }

      lastBoundaryEnd = boundary.end;
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createChunk(
        currentChunk,
        chunkIndex,
        0,
        startOffset,
        content.length
      ));
    }

    // Update total chunks
    return chunks.map((chunk, i) => ({
      ...chunk,
      totalChunks: chunks.length,
      index: i,
    }));
  }

  canSplit(content: string): boolean {
    return this.tokenCounter.count(content) > this.config.maxChunkSize;
  }

  estimateChunks(content: string): number {
    const totalTokens = this.tokenCounter.count(content);
    const effectiveChunkSize = this.config.maxChunkSize - this.config.overlapSize;
    return Math.ceil(totalTokens / effectiveChunkSize);
  }

  private findBoundaries(content: string): Array<{ start: number; end: number; type: string }> {
    const boundaries: Array<{ start: number; end: number; type: string }> = [];
    let lastEnd = 0;

    // Find paragraph boundaries
    const paragraphRegex = /\n\s*\n/g;
    let match;
    while ((match = paragraphRegex.exec(content)) !== null) {
      boundaries.push({
        start: lastEnd,
        end: match.index + match[0].length,
        type: 'paragraph',
      });
      lastEnd = match.index + match[0].length;
    }

    // If no paragraph boundaries, use sentence boundaries
    if (boundaries.length === 0) {
      const sentenceRegex = /[.!?]+\s+/g;
      while ((match = sentenceRegex.exec(content)) !== null) {
        boundaries.push({
          start: lastEnd,
          end: match.index + match[0].length,
          type: 'sentence',
        });
        lastEnd = match.index + match[0].length;
      }
    }

    // If still no boundaries, use fixed positions
    if (boundaries.length === 0) {
      const approxCharsPerToken = 4;
      const chunkChars = this.config.maxChunkSize * approxCharsPerToken;
      for (let i = 0; i < content.length; i += chunkChars) {
        boundaries.push({
          start: i,
          end: Math.min(i + chunkChars, content.length),
          type: 'fixed',
        });
      }
    }

    // Add final boundary
    if (lastEnd < content.length) {
      boundaries.push({
        start: lastEnd,
        end: content.length,
        type: 'end',
      });
    }

    return boundaries;
  }

  private getOverlapText(chunk: string): string {
    if (!this.config.overlapSize || this.config.overlapSize === 0) {
      return '';
    }

    const tokens = chunk.split(/\s+/);
    const overlapTokens = Math.min(
      tokens.length,
      Math.floor(this.config.overlapSize / 2) // Approximate tokens
    );
    
    return tokens.slice(-overlapTokens).join(' ') + ' ';
  }

  private createChunk(
    content: string,
    index: number,
    totalChunks: number,
    startOffset: number,
    endOffset: number
  ): ContentChunk {
    return {
      id: `chunk-${index}-${Date.now()}`,
      content: content.trim(),
      index,
      totalChunks,
      tokenCount: this.tokenCounter.count(content),
      startOffset,
      endOffset,
      metadata: {
        type: this.detectContentType(content),
        boundaries: this.extractBoundaries(content),
      },
    };
  }

  private detectContentType(content: string): 'text' | 'code' | 'mixed' {
    const codePatterns = [
      /```[\s\S]*?```/,
      /function\s+\w+/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
    ];

    const codeMatches = codePatterns.filter(p => p.test(content)).length;
    const hasCodeBlocks = /```/.test(content);

    if (hasCodeBlocks || codeMatches >= 2) {
      return /\n\n/.test(content.replace(/```[\s\S]*?```/g, '')) ? 'mixed' : 'code';
    }

    return 'text';
  }

  private extractBoundaries(content: string): string[] {
    const boundaries: string[] = [];
    
    // Extract headers
    const headerMatches = content.match(/^#{1,6}\s+.+$/gm);
    if (headerMatches) {
      boundaries.push(...headerMatches);
    }

    // Extract code block markers
    const codeMatches = content.match(/```\w*/g);
    if (codeMatches) {
      boundaries.push(...codeMatches);
    }

    return boundaries;
  }
}

// ============================================================================
// Code-Aware Splitter
// ============================================================================

export class CodeAwareSplitter implements ContentSplitter {
  private config: SplitterConfig;
  private tokenCounter: TokenCounter;

  constructor(
    config: Partial<SplitterConfig> = {},
    tokenCounter?: TokenCounter
  ) {
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
    this.tokenCounter = tokenCounter || { count: countTokens } as TokenCounter;
  }

  split(content: string): ContentChunk[] {
    const codeBlocks = this.extractCodeBlocks(content);
    const textParts = this.extractTextParts(content, codeBlocks);

    const chunks: ContentChunk[] = [];
    let chunkIndex = 0;

    // Process text parts
    for (const text of textParts) {
      const textChunks = this.splitText(text.content);
      for (const chunk of textChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          metadata: { ...chunk.metadata, type: 'text' } as ChunkMetadata,
        });
      }
    }

    // Process code blocks
    for (const block of codeBlocks) {
      if (this.tokenCounter.count(block.content) <= this.config.maxChunkSize) {
        chunks.push(this.createCodeChunk(block, chunkIndex++));
      } else {
        const codeChunks = this.splitCodeBlock(block);
        for (const chunk of codeChunks) {
          chunks.push({ ...chunk, index: chunkIndex++ });
        }
      }
    }

    // Sort by position and update indices
    chunks.sort((a, b) => a.startOffset - b.startOffset);
    return chunks.map((chunk, i) => ({
      ...chunk,
      index: i,
      totalChunks: chunks.length,
    }));
  }

  canSplit(content: string): boolean {
    return this.tokenCounter.count(content) > this.config.maxChunkSize;
  }

  estimateChunks(content: string): number {
    const totalTokens = this.tokenCounter.count(content);
    return Math.ceil(totalTokens / this.config.maxChunkSize);
  }

  private extractCodeBlocks(content: string): Array<{
    content: string;
    language?: string;
    start: number;
    end: number;
  }> {
    const blocks: Array<{
      content: string;
      language?: string;
      start: number;
      end: number;
    }> = [];

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1],
        content: match[2],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return blocks;
  }

  private extractTextParts(
    content: string,
    codeBlocks: Array<{ start: number; end: number }>
  ): Array<{ content: string; start: number; end: number }> {
    const parts: Array<{ content: string; start: number; end: number }> = [];
    let lastEnd = 0;

    for (const block of codeBlocks) {
      if (block.start > lastEnd) {
        parts.push({
          content: content.slice(lastEnd, block.start),
          start: lastEnd,
          end: block.start,
        });
      }
      lastEnd = block.end;
    }

    if (lastEnd < content.length) {
      parts.push({
        content: content.slice(lastEnd),
        start: lastEnd,
        end: content.length,
      });
    }

    return parts;
  }

  private splitText(content: string): ContentChunk[] {
    const splitter = new TokenAwareSplitter(this.config, this.tokenCounter);
    return splitter.split(content);
  }

  private splitCodeBlock(block: {
    content: string;
    language?: string;
    start: number;
    end: number;
  }): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const lines = block.content.split('\n');
    
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const line of lines) {
      const lineTokens = this.tokenCounter.count(line);

      if (currentTokens + lineTokens > this.config.maxChunkSize && currentChunk) {
        chunks.push(this.createCodeChunk({
          content: currentChunk,
          language: block.language,
          start: block.start,
          end: block.end,
        }, chunkIndex++));

        currentChunk = line + '\n';
        currentTokens = lineTokens;
      } else {
        currentChunk += line + '\n';
        currentTokens += lineTokens;
      }
    }

    if (currentChunk) {
      chunks.push(this.createCodeChunk({
        content: currentChunk,
        language: block.language,
        start: block.start,
        end: block.end,
      }, chunkIndex));
    }

    return chunks;
  }

  private createCodeChunk(
    block: { content: string; language?: string; start: number; end: number },
    index: number
  ): ContentChunk {
    return {
      id: `code-chunk-${index}-${Date.now()}`,
      content: block.language 
        ? `\`\`\`${block.language}\n${block.content}\n\`\`\``
        : block.content,
      index,
      totalChunks: 0,
      tokenCount: this.tokenCounter.count(block.content),
      startOffset: block.start,
      endOffset: block.end,
      metadata: {
        type: 'code',
        boundaries: block.language ? [block.language] : [],
      },
    };
  }
}

// ============================================================================
// Semantic Splitter
// ============================================================================

export class SemanticSplitter implements ContentSplitter {
  private config: SplitterConfig;
  private tokenCounter: TokenCounter;

  constructor(
    config: Partial<SplitterConfig> = {},
    tokenCounter?: TokenCounter
  ) {
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
    this.tokenCounter = tokenCounter || { count: countTokens } as TokenCounter;
  }

  split(content: string): ContentChunk[] {
    const sections = this.extractSemanticSections(content);
    const chunks: ContentChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionTokens = this.tokenCounter.count(section.content);

      if (sectionTokens <= this.config.maxChunkSize) {
        chunks.push(this.createChunk(section, chunkIndex++));
      } else {
        // Split large sections
        const subChunks = this.splitSection(section);
        for (const chunk of subChunks) {
          chunks.push({ ...chunk, index: chunkIndex++ });
        }
      }
    }

    return chunks.map((chunk, i) => ({
      ...chunk,
      index: i,
      totalChunks: chunks.length,
    }));
  }

  canSplit(content: string): boolean {
    return this.tokenCounter.count(content) > this.config.maxChunkSize;
  }

  estimateChunks(content: string): number {
    const sections = this.extractSemanticSections(content);
    let estimate = 0;

    for (const section of sections) {
      estimate += Math.ceil(
        this.tokenCounter.count(section.content) / this.config.maxChunkSize
      );
    }

    return estimate;
  }

  private extractSemanticSections(content: string): Array<{
    content: string;
    type: string;
    header?: string;
    start: number;
    end: number;
  }> {
    const sections: Array<{
      content: string;
      type: string;
      header?: string;
      start: number;
      end: number;
    }> = [];

    // Split by headers
    const headerRegex = /^(#{1,6}\s+.+)$/gm;
    const matches = Array.from(content.matchAll(headerRegex));

    if (matches.length === 0) {
      // No headers, treat as single section
      return [{
        content,
        type: 'text',
        start: 0,
        end: content.length,
      }];
    }

    let lastEnd = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];

      if (match.index !== undefined) {
        const sectionStart = match.index;
        const sectionEnd = nextMatch?.index ?? content.length;

        sections.push({
          header: match[1],
          content: content.slice(sectionStart, sectionEnd),
          type: 'section',
          start: sectionStart,
          end: sectionEnd,
        });

        lastEnd = sectionEnd;
      }
    }

    return sections;
  }

  private splitSection(section: {
    content: string;
    type: string;
    header?: string;
    start: number;
    end: number;
  }): ContentChunk[] {
    const splitter = new TokenAwareSplitter(this.config, this.tokenCounter);
    const subChunks = splitter.split(section.content);

    return subChunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        parentId: section.header,
      },
    }));
  }

  private createChunk(
    section: {
      content: string;
      type: string;
      header?: string;
      start: number;
      end: number;
    },
    index: number
  ): ContentChunk {
    return {
      id: `semantic-chunk-${index}-${Date.now()}`,
      content: section.content,
      index,
      totalChunks: 0,
      tokenCount: this.tokenCounter.count(section.content),
      startOffset: section.start,
      endOffset: section.end,
      metadata: {
        type: section.type as 'text' | 'code' | 'mixed',
        boundaries: section.header ? [section.header] : [],
      },
    };
  }
}

// ============================================================================
// Smart Splitter (Auto-selects best strategy)
// ============================================================================

export class SmartSplitter implements ContentSplitter {
  private tokenSplitter: TokenAwareSplitter;
  private codeSplitter: CodeAwareSplitter;
  private semanticSplitter: SemanticSplitter;

  constructor(
    config: Partial<SplitterConfig> = {},
    tokenCounter?: TokenCounter
  ) {
    this.tokenSplitter = new TokenAwareSplitter(config, tokenCounter);
    this.codeSplitter = new CodeAwareSplitter(config, tokenCounter);
    this.semanticSplitter = new SemanticSplitter(config, tokenCounter);
  }

  split(content: string): ContentChunk[] {
    const contentType = this.detectContentType(content);

    switch (contentType) {
      case 'code':
        return this.codeSplitter.split(content);
      case 'structured':
        return this.semanticSplitter.split(content);
      default:
        return this.tokenSplitter.split(content);
    }
  }

  canSplit(content: string): boolean {
    return this.tokenSplitter.canSplit(content);
  }

  estimateChunks(content: string): number {
    return this.tokenSplitter.estimateChunks(content);
  }

  private detectContentType(content: string): 'code' | 'structured' | 'text' {
    // Check for significant code content
    const codeBlockCount = (content.match(/```/g) || []).length / 2;
    const codePatterns = [
      /function\s+\w+/g,
      /class\s+\w+/g,
      /import\s+.*from/g,
    ];
    const codeMatches = codePatterns.reduce(
      (sum, pattern) => sum + (content.match(pattern) || []).length,
      0
    );

    if (codeBlockCount >= 2 || codeMatches >= 5) {
      return 'code';
    }

    // Check for structured content (headers, sections)
    const headerCount = (content.match(/^#{1,6}\s/m) || []).length;
    if (headerCount >= 3) {
      return 'structured';
    }

    return 'text';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function splitContent(
  content: string,
  config?: Partial<SplitterConfig>
): ContentChunk[] {
  const splitter = new SmartSplitter(config);
  return splitter.split(content);
}

export function splitByTokens(
  content: string,
  maxTokens: number,
  overlap?: number
): ContentChunk[] {
  const splitter = new TokenAwareSplitter({
    maxChunkSize: maxTokens,
    overlapSize: overlap || 0,
  });
  return splitter.split(content);
}

export function splitCode(
  content: string,
  maxTokens: number
): ContentChunk[] {
  const splitter = new CodeAwareSplitter({
    maxChunkSize: maxTokens,
  });
  return splitter.split(content);
}

export function reassembleChunks(chunks: ContentChunk[]): string {
  // Sort by index
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  
  // Remove overlaps and concatenate
  let result = '';
  let lastEnd = 0;

  for (const chunk of sorted) {
    if (chunk.startOffset >= lastEnd) {
      result += chunk.content;
      lastEnd = chunk.endOffset;
    } else {
      // Handle overlap
      const overlap = lastEnd - chunk.startOffset;
      result += chunk.content.slice(overlap);
      lastEnd = chunk.endOffset;
    }
  }

  return result;
}
