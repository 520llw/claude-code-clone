/**
 * Token Counter - Accurate token counting for context management
 * 
 * Provides multiple token counting strategies:
 - Character-based estimation (fast, no dependencies)
 - Tiktoken-compatible counting (when available)
 - Model-specific tokenizers
 * 
 * Also includes utilities for:
 - Counting tokens in messages
 - Estimating compression savings
 - Budget calculations
 */

import type { ContextMessage } from '../types/index.js';

// ============================================================================
// Token Counting Constants
// ============================================================================

// Average tokens per character for different languages/content types
export const TOKENS_PER_CHAR = {
  english: 0.25,
  code: 0.3,
  markdown: 0.28,
  json: 0.35,
  xml: 0.4,
  mixed: 0.3,
};

// Claude-specific token overhead
export const CLAUSE_OVERHEAD = {
  messageBase: 4,
  messagePerRole: 2,
  systemMessage: 3,
  toolCall: 8,
  toolResult: 8,
};

// Default budget constants
export const DEFAULT_MAX_TOKENS = 200000;
export const DEFAULT_RESERVE_TOKENS = 8192;
export const DEFAULT_BUFFER_TOKENS = 1024;

// Model-specific token limits
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3-5-sonnet': 200000,
  'gpt-4': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  'default': 128000,
};

// ============================================================================
// Token Counter Interface
// ============================================================================

export interface TokenCounter {
  count(text: string): number;
  countMessages(messages: ContextMessage[]): number;
  estimate(text: string, contentType?: keyof typeof TOKENS_PER_CHAR): number;
}

// ============================================================================
// Character-Based Token Counter (Fast, No Dependencies)
// ============================================================================

export class CharacterTokenCounter implements TokenCounter {
  private tokensPerChar: number;

  constructor(tokensPerChar: number = TOKENS_PER_CHAR.mixed) {
    this.tokensPerChar = tokensPerChar;
  }

  count(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }

  countMessages(messages: ContextMessage[]): number {
    let total = 0;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  private countMessage(message: ContextMessage): number {
    let tokens = CLAUSE_OVERHEAD.messageBase;
    tokens += CLAUSE_OVERHEAD.messagePerRole;
    
    // Add content tokens
    tokens += this.count(message.content);
    
    // Add overhead for special message types
    if (message.role === 'system') {
      tokens += CLAUSE_OVERHEAD.systemMessage;
    }
    
    if (message.metadata?.codeBlocks && message.metadata.codeBlocks.length > 0) {
      // Code blocks typically have higher token density
      for (const block of message.metadata.codeBlocks) {
        tokens += this.count(block.content) * 1.2; // 20% overhead for code
      }
    }
    
    return Math.ceil(tokens);
  }

  estimate(text: string, contentType: keyof typeof TOKENS_PER_CHAR = 'mixed'): number {
    const multiplier = TOKENS_PER_CHAR[contentType] || this.tokensPerChar;
    return Math.ceil(text.length * multiplier);
  }

  setTokensPerChar(tokensPerChar: number): void {
    this.tokensPerChar = tokensPerChar;
  }
}

// ============================================================================
// Tiktoken Token Counter (More Accurate, Requires tiktoken)
// ============================================================================

export class TiktokenCounter implements TokenCounter {
  private encoder: any = null;
  private model: string;
  private fallback: CharacterTokenCounter;

  constructor(model: string = 'cl100k_base') {
    this.model = model;
    this.fallback = new CharacterTokenCounter();
    this.initializeEncoder();
  }

  private async initializeEncoder(): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      const { encoding_for_model } = await import('tiktoken');
      this.encoder = encoding_for_model(this.model as any);
    } catch {
      // Fallback to character-based counting
      this.encoder = null;
    }
  }

  count(text: string): number {
    if (this.encoder) {
      try {
        return this.encoder.encode(text).length;
      } catch {
        return this.fallback.count(text);
      }
    }
    return this.fallback.count(text);
  }

  countMessages(messages: ContextMessage[]): number {
    let total = 0;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  private countMessage(message: ContextMessage): number {
    let tokens = CLAUSE_OVERHEAD.messageBase;
    tokens += CLAUSE_OVERHEAD.messagePerRole;
    tokens += this.count(message.content);
    
    if (message.role === 'system') {
      tokens += CLAUSE_OVERHEAD.systemMessage;
    }
    
    return tokens;
  }

  estimate(text: string, contentType?: keyof typeof TOKENS_PER_CHAR): number {
    return this.count(text);
  }

  dispose(): void {
    if (this.encoder) {
      try {
        this.encoder.free();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// Smart Token Counter (Auto-selects best method)
// ============================================================================

export class SmartTokenCounter implements TokenCounter {
  private tiktoken: TiktokenCounter | null = null;
  private fallback: CharacterTokenCounter;
  private useTiktoken: boolean;

  constructor(preferTiktoken: boolean = true) {
    this.fallback = new CharacterTokenCounter();
    this.useTiktoken = preferTiktoken;
    
    if (preferTiktoken) {
      this.initializeTiktoken();
    }
  }

  private async initializeTiktoken(): Promise<void> {
    try {
      this.tiktoken = new TiktokenCounter();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization
    } catch {
      this.tiktoken = null;
      this.useTiktoken = false;
    }
  }

  count(text: string): number {
    if (this.useTiktoken && this.tiktoken) {
      return this.tiktoken.count(text);
    }
    return this.fallback.count(text);
  }

  countMessages(messages: ContextMessage[]): number {
    if (this.useTiktoken && this.tiktoken) {
      return this.tiktoken.countMessages(messages);
    }
    return this.fallback.countMessages(messages);
  }

  estimate(text: string, contentType?: keyof typeof TOKENS_PER_CHAR): number {
    return this.fallback.estimate(text, contentType);
  }

  getActiveMethod(): 'tiktoken' | 'character' {
    return this.useTiktoken && this.tiktoken ? 'tiktoken' : 'character';
  }

  dispose(): void {
    if (this.tiktoken) {
      this.tiktoken.dispose();
    }
  }
}

// ============================================================================
// Token Budget Utilities
// ============================================================================

export interface BudgetCalculation {
  total: number;
  used: number;
  available: number;
  reserved: number;
  canAdd: boolean;
  overflow: number;
}

export function calculateBudget(
  totalTokens: number,
  usedTokens: number,
  reservedTokens: number = 0
): BudgetCalculation {
  const available = Math.max(0, totalTokens - usedTokens - reservedTokens);
  const overflow = Math.max(0, usedTokens + reservedTokens - totalTokens);
  
  return {
    total: totalTokens,
    used: usedTokens,
    available,
    reserved: reservedTokens,
    canAdd: overflow === 0,
    overflow,
  };
}

export function calculateCompressionSavings(
  originalTokens: number,
  compressedTokens: number
): { saved: number; ratio: number; percent: number } {
  const saved = Math.max(0, originalTokens - compressedTokens);
  const ratio = originalTokens > 0 ? compressedTokens / originalTokens : 1;
  const percent = (1 - ratio) * 100;
  
  return { saved, ratio, percent };
}

// ============================================================================
// Message Token Utilities
// ============================================================================

export function updateMessageTokenCounts(
  messages: ContextMessage[],
  counter: TokenCounter
): ContextMessage[] {
  return messages.map(msg => ({
    ...msg,
    tokenCount: counter.count(msg.content),
  }));
}

export function findTokenHeavyMessages(
  messages: ContextMessage[],
  threshold: number = 0.1
): ContextMessage[] {
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
  const thresholdTokens = totalTokens * threshold;
  
  return messages
    .filter(m => (m.tokenCount || 0) > thresholdTokens)
    .sort((a, b) => (b.tokenCount || 0) - (a.tokenCount || 0));
}

export function estimateMessageTokens(
  content: string,
  role: string,
  contentType?: keyof typeof TOKENS_PER_CHAR
): number {
  const counter = new CharacterTokenCounter();
  let tokens = counter.estimate(content, contentType);
  
  tokens += CLAUSE_OVERHEAD.messageBase;
  tokens += CLAUSE_OVERHEAD.messagePerRole;
  
  if (role === 'system') {
    tokens += CLAUSE_OVERHEAD.systemMessage;
  }
  
  return Math.ceil(tokens);
}

// ============================================================================
// Content Analysis
// ============================================================================

export function detectContentType(text: string): keyof typeof TOKENS_PER_CHAR {
  // Check for code patterns
  const codePatterns = [
    /```[\s\S]*?```/,  // Code blocks
    /function\s+\w+\s*\(/,  // Function definitions
    /class\s+\w+/,  // Class definitions
    /import\s+.*\s+from/,  // Import statements
    /{\s*["']\w+["']\s*:/,  // JSON-like objects
  ];
  
  const codeMatches = codePatterns.filter(p => p.test(text)).length;
  if (codeMatches >= 2) {
    return 'code';
  }
  
  // Check for JSON
  try {
    JSON.parse(text);
    return 'json';
  } catch {
    // Not JSON
  }
  
  // Check for XML/HTML
  if (/<[\w-]+(\s|>)/.test(text) && /<\/[\w-]+>/.test(text)) {
    return 'xml';
  }
  
  // Check for markdown
  if (/^#{1,6}\s/m.test(text) || /\[.*?\]\(.*?\)/.test(text)) {
    return 'markdown';
  }
  
  return 'mixed';
}

export function analyzeTokenDistribution(
  messages: ContextMessage[]
): {
  total: number;
  byRole: Record<string, number>;
  byCompression: Record<string, number>;
  average: number;
  max: number;
  min: number;
} {
  const byRole: Record<string, number> = {};
  const byCompression: Record<string, number> = {};
  
  let total = 0;
  let max = 0;
  let min = Infinity;
  
  for (const msg of messages) {
    const tokens = msg.tokenCount || 0;
    total += tokens;
    
    byRole[msg.role] = (byRole[msg.role] || 0) + tokens;
    byCompression[msg.compressionLevel || 'none'] = 
      (byCompression[msg.compressionLevel || 'none'] || 0) + tokens;
    
    max = Math.max(max, tokens);
    min = Math.min(min, tokens);
  }
  
  return {
    total,
    byRole,
    byCompression,
    average: messages.length > 0 ? total / messages.length : 0,
    max: max === 0 && messages.length === 0 ? 0 : max,
    min: min === Infinity ? 0 : min,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCounter: TokenCounter | null = null;

export function getGlobalCounter(): TokenCounter {
  if (!globalCounter) {
    globalCounter = new SmartTokenCounter();
  }
  return globalCounter;
}

export function setGlobalCounter(counter: TokenCounter): void {
  globalCounter = counter;
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function countTokens(text: string): number {
  return getGlobalCounter().count(text);
}

export function countMessageTokens(messages: ContextMessage[]): number {
  return getGlobalCounter().countMessages(messages);
}

export function estimateTokens(
  text: string,
  contentType?: keyof typeof TOKENS_PER_CHAR
): number {
  return getGlobalCounter().estimate(text, contentType);
}

export function getModelTokenLimit(model: string): number {
  return MODEL_TOKEN_LIMITS[model] || MODEL_TOKEN_LIMITS.default;
}

export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(2)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
