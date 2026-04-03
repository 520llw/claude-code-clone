/**
 * Summary Generator - Intelligent summary generation for context compression
 * 
 * Provides multiple summary generation strategies:
 * - Extraction-based summarization
 * - Abstraction-based summarization (when API available)
 * - Hybrid summarization
 * - Topic-based summarization
 * 
 * Features:
 * - Configurable summary length
 * - Multi-message batch summarization
 * - Topic extraction
 * - Key point identification
 */

import type { ContextMessage } from '../../types/index.js';
import { countTokens } from '../../utils/tokenCounter.js';
import { EventEmitter } from 'events';

// ============================================================================
// Summary Generator Configuration
// ============================================================================

export interface SummaryConfig {
  maxSummaryLength: number;
  minSummaryLength: number;
  strategy: 'extraction' | 'abstraction' | 'hybrid';
  extractKeyPoints: boolean;
  extractTopics: boolean;
  preserveCodeReferences: boolean;
  preserveFileReferences: boolean;
  sentenceCount: number;
}

export const DEFAULT_SUMMARY_CONFIG: SummaryConfig = {
  maxSummaryLength: 500,
  minSummaryLength: 50,
  strategy: 'extraction',
  extractKeyPoints: true,
  extractTopics: true,
  preserveCodeReferences: true,
  preserveFileReferences: true,
  sentenceCount: 3,
};

// ============================================================================
// Summary Result
// ============================================================================

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  tokenCount: number;
  compressionRatio: number;
  method: string;
}

// ============================================================================
// Summary Generator Events
// ============================================================================

export interface SummaryGeneratorEvents {
  'summary:generated': SummaryResult;
  'batch:completed': { count: number; totalTokens: number };
  'error': { error: Error; content?: string };
}

// ============================================================================
// Summary Generator Class
// ============================================================================

export class SummaryGenerator extends EventEmitter {
  private config: SummaryConfig;
  private stats: {
    summariesGenerated: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageCompressionRatio: number;
  };

  constructor(config: Partial<SummaryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SUMMARY_CONFIG, ...config };
    this.stats = {
      summariesGenerated: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageCompressionRatio: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Generation Methods
  // --------------------------------------------------------------------------

  /**
   * Generate a summary for single content
   */
  generate(content: string): string {
    const result = this.generateWithDetails(content);
    return result.summary;
  }

  /**
   * Generate a summary with detailed results
   */
  generateWithDetails(content: string): SummaryResult {
    const inputTokens = countTokens(content);
    
    let result: SummaryResult;

    switch (this.config.strategy) {
      case 'extraction':
        result = this.extractiveSummarize(content);
        break;
      case 'abstraction':
        result = this.abstractiveSummarize(content);
        break;
      case 'hybrid':
      default:
        result = this.hybridSummarize(content);
        break;
    }

    // Update statistics
    this.stats.summariesGenerated++;
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += result.tokenCount;
    this.updateAverageCompressionRatio(result.compressionRatio);

    this.emit('summary:generated', result);

    return result;
  }

  /**
   * Generate a summary for multiple messages
   */
  generateBatch(contents: string[]): string {
    if (contents.length === 0) {
      return '';
    }

    if (contents.length === 1) {
      return this.generate(contents[0]);
    }

    // Combine contents with separators
    const combined = contents.join('\n\n---\n\n');
    const result = this.generateWithDetails(combined);

    this.emit('batch:completed', { 
      count: contents.length, 
      totalTokens: result.tokenCount 
    });

    return result.summary;
  }

  /**
   * Generate summary for messages
   */
  generateForMessages(messages: ContextMessage[]): string {
    const contents = messages.map(m => m.content);
    return this.generateBatch(contents);
  }

  // --------------------------------------------------------------------------
  // Extraction-Based Summarization
  // --------------------------------------------------------------------------

  private extractiveSummarize(content: string): SummaryResult {
    const sentences = this.extractSentences(content);
    const keyPoints = this.extractKeyPoints(content);
    const topics = this.extractTopics(content);

    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.scoreSentence(sentence, keyPoints, topics),
    }));

    // Sort by score and select top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    const topSentences = scoredSentences
      .slice(0, this.config.sentenceCount)
      .map(s => s.sentence);

    // Restore original order
    const orderedSentences = this.restoreSentenceOrder(
      topSentences,
      sentences
    );

    let summary = orderedSentences.join(' ');

    // Add key points if configured
    if (this.config.extractKeyPoints && keyPoints.length > 0) {
      summary += '\n\nKey points: ' + keyPoints.slice(0, 3).join('; ');
    }

    // Ensure length constraints
    summary = this.enforceLengthConstraints(summary);

    const tokenCount = countTokens(summary);
    const compressionRatio = tokenCount / countTokens(content);

    return {
      summary,
      keyPoints,
      topics,
      tokenCount,
      compressionRatio,
      method: 'extraction',
    };
  }

  private extractSentences(text: string): string[] {
    // Match sentences ending with . ! ? followed by space or end
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
    const matches = text.match(sentenceRegex);
    return matches ? matches.map(s => s.trim()) : [text];
  }

  private scoreSentence(
    sentence: string,
    keyPoints: string[],
    topics: string[]
  ): number {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Position scoring (first and last sentences are often important)
    // This is handled by restoreSentenceOrder

    // Key point overlap
    for (const point of keyPoints) {
      if (lowerSentence.includes(point.toLowerCase())) {
        score += 2;
      }
    }

    // Topic overlap
    for (const topic of topics) {
      if (lowerSentence.includes(topic.toLowerCase())) {
        score += 1.5;
      }
    }

    // Length scoring (avoid very short or very long sentences)
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 30) {
      score += 0.5;
    }

    // Indicator words
    const indicators = [
      'important', 'key', 'critical', 'essential', 'main',
      'primary', 'significant', 'crucial', 'vital',
    ];
    for (const indicator of indicators) {
      if (lowerSentence.includes(indicator)) {
        score += 1;
      }
    }

    return score;
  }

  private restoreSentenceOrder(
    selected: string[],
    original: string[]
  ): string[] {
    // Return selected sentences in their original order
    return original.filter(s => selected.includes(s));
  }

  // --------------------------------------------------------------------------
  // Abstraction-Based Summarization
  // --------------------------------------------------------------------------

  private abstractiveSummarize(content: string): SummaryResult {
    // For now, fall back to extraction
    // In a real implementation, this would use an LLM API
    const result = this.extractiveSummarize(content);
    result.method = 'abstraction (fallback to extraction)';
    return result;
  }

  // --------------------------------------------------------------------------
  // Hybrid Summarization
  // --------------------------------------------------------------------------

  private hybridSummarize(content: string): SummaryResult {
    // Start with extraction
    const extracted = this.extractiveSummarize(content);

    // If extraction is too long, further compress
    if (extracted.tokenCount > this.config.maxSummaryLength * 0.8) {
      const compressed = this.compressSummary(extracted.summary);
      extracted.summary = compressed;
      extracted.tokenCount = countTokens(compressed);
      extracted.compressionRatio = extracted.tokenCount / countTokens(content);
    }

    extracted.method = 'hybrid';
    return extracted;
  }

  private compressSummary(summary: string): string {
    const sentences = this.extractSentences(summary);
    
    if (sentences.length <= 2) {
      return summary;
    }

    // Keep first and last sentences, compress middle
    const first = sentences[0];
    const last = sentences[sentences.length - 1];
    
    if (sentences.length === 3) {
      return `${first} ${last}`;
    }

    // Compress middle sentences
    const middle = sentences.slice(1, -1);
    const middleCompressed = middle.map(s => {
      const words = s.split(/\s+/);
      if (words.length > 10) {
        return words.slice(0, 7).join(' ') + '...';
      }
      return s;
    }).join(' ');

    return `${first} ${middleCompressed} ${last}`;
  }

  // --------------------------------------------------------------------------
  // Key Point Extraction
  // --------------------------------------------------------------------------

  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];

    // Look for explicit markers
    const markerPatterns = [
      /(?:important|key|note|remember)\s*[:;-]\s*([^\n.]+)/gi,
      /\*\s*([^\n*]+)/g, // Bullet points
      /-\s*([^\n-]+)/g,  // Dash points
      /\d+\.\s*([^\n]+)/g, // Numbered points
    ];

    for (const pattern of markerPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const point = match[1].trim();
        if (point.length > 10 && point.length < 200) {
          keyPoints.push(point);
        }
      }
    }

    // Remove duplicates
    return [...new Set(keyPoints)].slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // Topic Extraction
  // --------------------------------------------------------------------------

  private extractTopics(content: string): string[] {
    const topics = new Set<string>();

    // Extract potential topics from capitalized phrases
    const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = capitalizedPattern.exec(content)) !== null) {
      if (match[0].length > 3) {
        topics.add(match[0].toLowerCase());
      }
    }

    // Extract from headers
    const headerPattern = /#{1,6}\s+(.+)/g;
    while ((match = headerPattern.exec(content)) !== null) {
      topics.add(match[1].toLowerCase().trim());
    }

    // Extract code-related topics
    if (this.config.preserveCodeReferences) {
      const codePatterns = [
        /\b(function|class|method|interface)\s+(\w+)/g,
        /\b(const|let|var)\s+(\w+)\s*=/g,
      ];

      for (const pattern of codePatterns) {
        while ((match = pattern.exec(content)) !== null) {
          topics.add(match[2].toLowerCase());
        }
      }
    }

    // Extract file references
    if (this.config.preserveFileReferences) {
      const filePattern = /[\w\/-]+\.(ts|js|tsx|jsx|py|java|go|rs|json|md|yaml)/gi;
      while ((match = filePattern.exec(content)) !== null) {
        topics.add(match[0].toLowerCase());
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private enforceLengthConstraints(summary: string): string {
    let result = summary;

    // Ensure minimum length
    if (result.length < this.config.minSummaryLength) {
      // Can't do much if it's too short
      return result;
    }

    // Enforce maximum length
    const maxChars = this.config.maxSummaryLength * 4; // Approximate chars per token
    if (result.length > maxChars) {
      result = result.slice(0, maxChars);
      // Try to end at a sentence boundary
      const lastSentence = result.match(/.*[.!?]/);
      if (lastSentence) {
        result = lastSentence[0];
      }
    }

    return result;
  }

  private updateAverageCompressionRatio(newRatio: number): void {
    const n = this.stats.summariesGenerated;
    this.stats.averageCompressionRatio = 
      (this.stats.averageCompressionRatio * (n - 1) + newRatio) / n;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    summariesGenerated: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageCompressionRatio: number;
    averageSavings: number;
  } {
    return {
      summariesGenerated: this.stats.summariesGenerated,
      totalInputTokens: this.stats.totalInputTokens,
      totalOutputTokens: this.stats.totalOutputTokens,
      averageCompressionRatio: this.stats.averageCompressionRatio,
      averageSavings: this.stats.totalInputTokens > 0
        ? 1 - (this.stats.totalOutputTokens / this.stats.totalInputTokens)
        : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      summariesGenerated: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageCompressionRatio: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<SummaryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SummaryConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.resetStats();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSummaryGenerator(config?: Partial<SummaryConfig>): SummaryGenerator {
  return new SummaryGenerator(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function summarize(content: string, maxLength?: number): string {
  const generator = new SummaryGenerator(
    maxLength ? { maxSummaryLength: maxLength } : undefined
  );
  return generator.generate(content);
}

export function summarizeMessages(messages: ContextMessage[]): string {
  const generator = new SummaryGenerator();
  return generator.generateForMessages(messages);
}

export function extractTopics(content: string): string[] {
  const generator = new SummaryGenerator();
  const result = generator.generateWithDetails(content);
  return result.topics;
}

export function extractKeyPoints(content: string): string[] {
  const generator = new SummaryGenerator();
  const result = generator.generateWithDetails(content);
  return result.keyPoints;
}
