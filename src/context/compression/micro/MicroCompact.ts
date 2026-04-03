/**
 * MicroCompact - Lightweight local compression for context management
 * 
 * MicroCompact provides fast, local-only compression operations:
 * - No API calls required
 * - Minimal processing overhead
 * - Preserves recent messages
 * - Maintains semantic boundaries
 * 
 * Use cases:
 * - Quick cleanup of whitespace and formatting
 * - Light content trimming
 * - Code block optimization
 * - Early warning compression
 */

import type {
  ContextMessage,
  CompressionLevel,
  CompressionResult,
  CodeBlock,
} from '../../types/index.js';
import { countTokens, countMessageTokens } from '../../utils/tokenCounter.js';
import { EventEmitter } from 'events';

// ============================================================================
// MicroCompact Configuration
// ============================================================================

export interface MicroCompactConfig {
  preserveRecent: number;
  maxWhitespaceLines: number;
  trimThreshold: number;
  codeBlockThreshold: number;
  enableFormatting: boolean;
  enableTrimming: boolean;
  enableCodeOptimization: boolean;
}

export const DEFAULT_MICRO_CONFIG: MicroCompactConfig = {
  preserveRecent: 5,
  maxWhitespaceLines: 2,
  trimThreshold: 800,
  codeBlockThreshold: 500,
  enableFormatting: true,
  enableTrimming: true,
  enableCodeOptimization: true,
};

// ============================================================================
// MicroCompact Events
// ============================================================================

export interface MicroCompactEvents {
  'compact:start': { messagesCount: number };
  'compact:complete': { messagesProcessed: number; tokensSaved: number };
  'message:formatted': { messageId: string };
  'message:trimmed': { messageId: string; originalLength: number; newLength: number };
  'code:optimized': { messageId: string; blocksOptimized: number };
}

// ============================================================================
// MicroCompact Class
// ============================================================================

export class MicroCompact extends EventEmitter {
  private config: MicroCompactConfig;
  private stats: {
    messagesProcessed: number;
    tokensSaved: number;
    formatsApplied: number;
    trimsApplied: number;
    codeOptimizations: number;
  };

  constructor(config: Partial<MicroCompactConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MICRO_CONFIG, ...config };
    this.stats = {
      messagesProcessed: 0,
      tokensSaved: 0,
      formatsApplied: 0,
      trimsApplied: 0,
      codeOptimizations: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Main Compression Entry
  // --------------------------------------------------------------------------

  compact(messages: ContextMessage[]): CompressionResult {
    this.emit('compact:start', { messagesCount: messages.length });

    const tokensBefore = countMessageTokens(messages);
    const preserveCount = this.config.preserveRecent;
    
    // Split messages into compressible and preserved
    const compressibleMessages = messages.slice(0, -preserveCount);
    const preservedMessages = messages.slice(-preserveCount);

    const processedMessages: ContextMessage[] = [];
    let messagesCompressed = 0;
    const errors: string[] = [];

    for (const message of compressibleMessages) {
      try {
        const processed = this.processMessage(message);
        
        if (this.isCompressed(processed, message)) {
          messagesCompressed++;
        }
        
        processedMessages.push(processed);
      } catch (error) {
        errors.push(`Failed to process message ${message.id}: ${error}`);
        processedMessages.push(message);
      }
    }

    const resultMessages = [...processedMessages, ...preservedMessages];
    const tokensAfter = countMessageTokens(resultMessages);
    const tokensSaved = tokensBefore - tokensAfter;

    this.stats.messagesProcessed += messages.length;
    this.stats.tokensSaved += tokensSaved;

    this.emit('compact:complete', { 
      messagesProcessed: messages.length, 
      tokensSaved 
    });

    return {
      success: errors.length === 0,
      strategy: 'micro',
      messagesRemoved: 0,
      messagesCompressed,
      tokensBefore,
      tokensAfter,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // --------------------------------------------------------------------------
  // Message Processing
  // --------------------------------------------------------------------------

  private processMessage(message: ContextMessage): ContextMessage {
    let processed = { ...message };
    let wasModified = false;

    // Apply formatting
    if (this.config.enableFormatting) {
      const formatted = this.applyFormatting(processed);
      if (formatted.content !== processed.content) {
        processed = formatted;
        wasModified = true;
        this.stats.formatsApplied++;
        this.emit('message:formatted', { messageId: message.id });
      }
    }

    // Apply trimming
    if (this.config.enableTrimming) {
      const trimmed = this.applyTrimming(processed);
      if (trimmed.content !== processed.content) {
        const originalLength = processed.content.length;
        processed = trimmed;
        wasModified = true;
        this.stats.trimsApplied++;
        this.emit('message:trimmed', { 
          messageId: message.id, 
          originalLength, 
          newLength: processed.content.length 
        });
      }
    }

    // Optimize code blocks
    if (this.config.enableCodeOptimization && processed.metadata?.codeBlocks) {
      const optimized = this.optimizeCodeBlocks(processed);
      if (optimized.content !== processed.content) {
        processed = optimized;
        wasModified = true;
        this.stats.codeOptimizations++;
        this.emit('code:optimized', { 
          messageId: message.id, 
          blocksOptimized: processed.metadata?.codeBlocks?.length || 0 
        });
      }
    }

    // Update compression level if modified
    if (wasModified) {
      processed.compressionLevel = 'light';
      processed.originalContent = message.content;
      processed.tokenCount = countTokens(processed.content);
    }

    return processed;
  }

  // --------------------------------------------------------------------------
  // Formatting Operations
  // --------------------------------------------------------------------------

  private applyFormatting(message: ContextMessage): ContextMessage {
    let content = message.content;

    // Normalize line endings
    content = content.replace(/\r\n/g, '\n');

    // Collapse multiple blank lines
    const maxBlankLines = this.config.maxWhitespaceLines;
    const blankLinePattern = new RegExp(`\n{${maxBlankLines + 2},}`, 'g');
    content = content.replace(blankLinePattern, '\n'.repeat(maxBlankLines + 1));

    // Trim trailing whitespace
    content = content.replace(/[ \t]+$/gm, '');

    // Normalize multiple spaces (but preserve indentation)
    content = content.replace(/^(\s*)\s+/gm, (match, indent) => indent);

    return {
      ...message,
      content: content.trim(),
    };
  }

  // --------------------------------------------------------------------------
  // Trimming Operations
  // --------------------------------------------------------------------------

  private applyTrimming(message: ContextMessage): ContextMessage {
    const tokenCount = message.tokenCount || countTokens(message.content);
    
    if (tokenCount <= this.config.trimThreshold) {
      return message;
    }

    let content = message.content;
    const targetTokens = Math.floor(this.config.trimThreshold * 0.9);
    const approxCharsPerToken = 4;
    const targetChars = targetTokens * approxCharsPerToken;

    // Smart truncation - try to find a good breaking point
    if (content.length > targetChars) {
      content = this.smartTruncate(content, targetChars);
    }

    return {
      ...message,
      content,
    };
  }

  private smartTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Look for sentence boundary
    const truncated = content.slice(0, maxChars);
    const lastSentence = truncated.match(/.*[.!?]/);
    
    if (lastSentence && lastSentence[0].length > maxChars * 0.5) {
      return lastSentence[0] + ' [truncated...]';
    }

    // Look for paragraph boundary
    const lastParagraph = truncated.match(/.*\n\n/);
    if (lastParagraph && lastParagraph[0].length > maxChars * 0.3) {
      return lastParagraph[0].trim() + '\n\n[truncated...]';
    }

    // Fallback: just truncate with ellipsis
    return truncated.trim() + ' [truncated...]';
  }

  // --------------------------------------------------------------------------
  // Code Block Optimization
  // --------------------------------------------------------------------------

  private optimizeCodeBlocks(message: ContextMessage): ContextMessage {
    if (!message.metadata?.codeBlocks || message.metadata.codeBlocks.length === 0) {
      return message;
    }

    let content = message.content;
    const optimizedBlocks: CodeBlock[] = [];

    for (const block of message.metadata.codeBlocks) {
      const blockContent = block.content;
      const blockTokens = countTokens(blockContent);

      if (blockTokens > this.config.codeBlockThreshold) {
        // Optimize this block
        const optimized = this.optimizeSingleBlock(block);
        
        // Replace in content
        const originalMarker = `\`\`\`${block.language || ''}\n${blockContent}\n\`\`\``;
        const optimizedMarker = `\`\`\`${block.language || ''}\n${optimized.content}\n\`\`\``;
        content = content.replace(originalMarker, optimizedMarker);

        optimizedBlocks.push(optimized);
      } else {
        optimizedBlocks.push(block);
      }
    }

    return {
      ...message,
      content,
      metadata: {
        ...message.metadata,
        codeBlocks: optimizedBlocks,
      },
    };
  }

  private optimizeSingleBlock(block: CodeBlock): CodeBlock {
    let content = block.content;

    // Remove excessive blank lines in code
    content = content.replace(/\n{4,}/g, '\n\n\n');

    // Remove trailing whitespace
    content = content.replace(/[ \t]+$/gm, '');

    // Truncate if still too long
    const tokens = countTokens(content);
    if (tokens > this.config.codeBlockThreshold) {
      const targetChars = this.config.codeBlockThreshold * 3;
      content = this.smartTruncateCode(content, targetChars);
    }

    return {
      ...block,
      content,
    };
  }

  private smartTruncateCode(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to find a good function/class boundary
    const lines = content.split('\n');
    let currentLength = 0;
    let cutoffIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      currentLength += lines[i].length + 1;
      
      // Look for function/class end
      if (currentLength > maxChars * 0.8) {
        // Check if we're at a good boundary
        if (/^[}\]]\s*$/.test(lines[i]) || /^\s*$/.test(lines[i + 1] || '')) {
          cutoffIndex = i + 1;
          break;
        }
      }

      if (currentLength > maxChars) {
        cutoffIndex = i;
        break;
      }
    }

    const truncated = lines.slice(0, cutoffIndex).join('\n');
    return truncated + '\n\n// ... [code truncated]';
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private isCompressed(original: ContextMessage, processed: ContextMessage): boolean {
    return (
      original.compressionLevel !== processed.compressionLevel ||
      original.content !== processed.content
    );
  }

  estimateSavings(messages: ContextMessage[]): number {
    const tokensBefore = countMessageTokens(messages);
    const result = this.compact(messages);
    return tokensBefore - result.tokensAfter;
  }

  canCompact(messages: ContextMessage[]): boolean {
    // Check if there are messages that could benefit from micro compression
    const compressible = messages.slice(0, -this.config.preserveRecent);
    
    for (const message of compressible) {
      const tokenCount = message.tokenCount || countTokens(message.content);
      
      // Check for excessive whitespace
      if (/\n{4,}/.test(message.content)) {
        return true;
      }

      // Check for long content
      if (tokenCount > this.config.trimThreshold) {
        return true;
      }

      // Check for long code blocks
      if (message.metadata?.codeBlocks) {
        for (const block of message.metadata.codeBlocks) {
          if (countTokens(block.content) > this.config.codeBlockThreshold) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    messagesProcessed: number;
    tokensSaved: number;
    formatsApplied: number;
    trimsApplied: number;
    codeOptimizations: number;
  } {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      messagesProcessed: 0,
      tokensSaved: 0,
      formatsApplied: 0,
      trimsApplied: 0,
      codeOptimizations: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<MicroCompactConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MicroCompactConfig {
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

export function createMicroCompact(config?: Partial<MicroCompactConfig>): MicroCompact {
  return new MicroCompact(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function quickCompact(messages: ContextMessage[]): CompressionResult {
  const compactor = new MicroCompact();
  return compactor.compact(messages);
}

export function formatMessage(message: ContextMessage): ContextMessage {
  const compactor = new MicroCompact({ enableTrimming: false, enableCodeOptimization: false });
  const result = compactor.compact([message]);
  return result.success && result.messagesCompressed > 0
    ? { ...message, content: result.summary || message.content }
    : message;
}
