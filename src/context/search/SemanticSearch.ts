/**
 * Semantic Search - Semantic code and content search
 * 
 * Provides semantic search capabilities:
 * - Vector-based similarity search
 * - Code-aware search
 * - Natural language queries
 * - Multi-modal search
 * 
 * Features:
 * - Embedding generation
 * - Similarity scoring
 * - Result ranking
 * - Query expansion
 */

import type {
  SemanticSearchResult,
  SearchResultItem,
  SearchSource,
} from '../types/index.js';
import { EmbeddingCache } from './EmbeddingCache.js';
import { SimilarityScorer } from './SimilarityScorer.js';
import { EventEmitter } from 'events';

// ============================================================================
// Semantic Search Configuration
// ============================================================================

export interface SemanticSearchConfig {
  embeddingModel: string;
  similarityThreshold: number;
  maxResults: number;
  enableQueryExpansion: boolean;
  enableCodeSearch: boolean;
  cacheEmbeddings: boolean;
  cacheSize: number;
  cacheTtl: number;
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticSearchConfig = {
  embeddingModel: 'default',
  similarityThreshold: 0.7,
  maxResults: 20,
  enableQueryExpansion: true,
  enableCodeSearch: true,
  cacheEmbeddings: true,
  cacheSize: 1000,
  cacheTtl: 3600000, // 1 hour
};

// ============================================================================
// Search Document
// ============================================================================

export interface SearchDocument {
  id: string;
  content: string;
  source: SearchSource;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

// ============================================================================
// Semantic Search Events
// ============================================================================

export interface SemanticSearchEvents {
  'search:start': { query: string; documentCount: number };
  'search:complete': { results: number; time: number };
  'embedding:generated': { documentId: string; dimensions: number };
  'cache:hit': { documentId: string };
  'cache:miss': { documentId: string };
}

// ============================================================================
// Semantic Search Class
// ============================================================================

export class SemanticSearch extends EventEmitter {
  private config: SemanticSearchConfig;
  private documents: Map<string, SearchDocument>;
  private embeddingCache: EmbeddingCache;
  private similarityScorer: SimilarityScorer;
  private stats: {
    searchesPerformed: number;
    totalResults: number;
    averageSearchTime: number;
    embeddingsGenerated: number;
    cacheHits: number;
    cacheMisses: number;
  };

  constructor(config: Partial<SemanticSearchConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SEMANTIC_CONFIG, ...config };
    
    this.documents = new Map();
    this.embeddingCache = new EmbeddingCache({
      maxSize: this.config.cacheSize,
      ttl: this.config.cacheTtl,
    });
    this.similarityScorer = new SimilarityScorer();
    
    this.stats = {
      searchesPerformed: 0,
      totalResults: 0,
      averageSearchTime: 0,
      embeddingsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Document Management
  // --------------------------------------------------------------------------

  addDocument(document: SearchDocument): void {
    // Generate embedding if not provided
    if (!document.embedding) {
      document.embedding = this.generateEmbedding(document.content);
    }

    this.documents.set(document.id, document);

    // Cache the embedding
    if (this.config.cacheEmbeddings && document.embedding) {
      this.embeddingCache.set(document.id, document.embedding);
    }
  }

  addDocuments(documents: SearchDocument[]): void {
    for (const doc of documents) {
      this.addDocument(doc);
    }
  }

  removeDocument(id: string): boolean {
    this.embeddingCache.delete(id);
    return this.documents.delete(id);
  }

  getDocument(id: string): SearchDocument | undefined {
    return this.documents.get(id);
  }

  clearDocuments(): void {
    this.documents.clear();
    this.embeddingCache.clear();
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  async search(query: string, options?: {
    threshold?: number;
    maxResults?: number;
    sources?: SearchSource[];
  }): Promise<SemanticSearchResult> {
    const startTime = Date.now();
    
    this.emit('search:start', { 
      query, 
      documentCount: this.documents.size 
    });

    // Expand query if enabled
    const searchQuery = this.config.enableQueryExpansion
      ? this.expandQuery(query)
      : query;

    // Generate query embedding
    const queryEmbedding = this.generateEmbedding(searchQuery);

    // Score all documents
    const scored: Array<{ document: SearchDocument; score: number }> = [];

    for (const document of this.documents.values()) {
      // Filter by source if specified
      if (options?.sources && !options.sources.includes(document.source)) {
        continue;
      }

      // Get or generate document embedding
      let docEmbedding = document.embedding;
      
      if (!docEmbedding) {
        // Check cache
        const cached = this.embeddingCache.get(document.id);
        if (cached) {
          docEmbedding = cached;
          this.stats.cacheHits++;
          this.emit('cache:hit', { documentId: document.id });
        } else {
          // Generate new embedding
          docEmbedding = this.generateEmbedding(document.content);
          document.embedding = docEmbedding;
          
          if (this.config.cacheEmbeddings) {
            this.embeddingCache.set(document.id, docEmbedding);
          }
          
          this.stats.embeddingsGenerated++;
          this.stats.cacheMisses++;
          this.emit('cache:miss', { documentId: document.id });
          this.emit('embedding:generated', { 
            documentId: document.id, 
            dimensions: docEmbedding.length 
          });
        }
      }

      // Calculate similarity
      const score = this.similarityScorer.cosineSimilarity(
        queryEmbedding,
        docEmbedding
      );

      const threshold = options?.threshold || this.config.similarityThreshold;
      if (score >= threshold) {
        scored.push({ document, score });
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Limit results
    const maxResults = options?.maxResults || this.config.maxResults;
    const topResults = scored.slice(0, maxResults);

    // Build result items
    const results: SearchResultItem[] = topResults.map(({ document, score }) => ({
      id: document.id,
      content: this.truncateContent(document.content, 200),
      score,
      source: document.source,
      metadata: document.metadata,
    }));

    const searchTime = Date.now() - startTime;

    // Update stats
    this.stats.searchesPerformed++;
    this.stats.totalResults += results.length;
    this.updateAverageSearchTime(searchTime);

    this.emit('search:complete', { results: results.length, time: searchTime });

    return {
      query,
      results,
      totalResults: results.length,
      searchTime,
    };
  }

  // --------------------------------------------------------------------------
  // Code Search
  // --------------------------------------------------------------------------

  async searchCode(
    query: string,
    options?: {
      language?: string;
      threshold?: number;
      maxResults?: number;
    }
  ): Promise<SemanticSearchResult> {
    if (!this.config.enableCodeSearch) {
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: 0,
      };
    }

    // Filter documents by source
    const codeSources: SearchSource[] = ['code', 'file'];

    // Enhance query for code search
    const codeQuery = this.enhanceCodeQuery(query, options?.language);

    return this.search(codeQuery, {
      ...options,
      sources: codeSources,
    });
  }

  private enhanceCodeQuery(query: string, language?: string): string {
    let enhanced = query;

    // Add language context
    if (language) {
      enhanced = `${language} ${enhanced}`;
    }

    // Add code-specific terms
    const codeTerms = ['function', 'class', 'method', 'variable'];
    const hasCodeTerm = codeTerms.some(term => 
      query.toLowerCase().includes(term)
    );

    if (!hasCodeTerm) {
      enhanced = `code ${enhanced}`;
    }

    return enhanced;
  }

  // --------------------------------------------------------------------------
  // Embedding Generation
  // --------------------------------------------------------------------------

  private generateEmbedding(text: string): number[] {
    // Simple embedding generation using term frequency
    // In production, this would use a proper embedding model
    
    const tokens = this.tokenize(text);
    const vocabulary = this.buildVocabulary(tokens);
    const embedding = new Array(vocabulary.size).fill(0);

    // Term frequency
    for (const token of tokens) {
      const index = vocabulary.get(token);
      if (index !== undefined) {
        embedding[index]++;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      return embedding.map(v => v / magnitude);
    }

    return embedding;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private buildVocabulary(tokens: string[]): Map<string, number> {
    const vocab = new Map<string, number>();
    
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, vocab.size);
      }
    }

    return vocab;
  }

  // --------------------------------------------------------------------------
  // Query Expansion
  // --------------------------------------------------------------------------

  private expandQuery(query: string): string {
    if (!this.config.enableQueryExpansion) {
      return query;
    }

    const expansions: string[] = [query];

    // Add synonyms
    const synonyms = this.findSynonyms(query);
    expansions.push(...synonyms);

    // Add related terms
    const related = this.findRelatedTerms(query);
    expansions.push(...related);

    return expansions.join(' ');
  }

  private findSynonyms(query: string): string[] {
    // Simple synonym mapping
    const synonymMap: Record<string, string[]> = {
      'function': ['method', 'procedure', 'routine'],
      'class': ['type', 'object', 'struct'],
      'variable': ['field', 'property', 'attribute'],
      'import': ['require', 'include', 'use'],
      'export': ['expose', 'publish', 'module'],
    };

    const synonyms: string[] = [];
    const words = query.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (synonymMap[word]) {
        synonyms.push(...synonymMap[word]);
      }
    }

    return synonyms;
  }

  private findRelatedTerms(query: string): string[] {
    // Find terms that appear in similar contexts
    const related: string[] = [];
    const queryTokens = new Set(this.tokenize(query));

    for (const document of this.documents.values()) {
      const docTokens = new Set(this.tokenize(document.content));
      
      // Check for overlap
      const intersection = new Set([...queryTokens].filter(t => docTokens.has(t)));
      
      if (intersection.size > 0) {
        // Add unique terms from this document
        for (const token of docTokens) {
          if (!queryTokens.has(token) && !related.includes(token)) {
            related.push(token);
          }
        }
      }
    }

    return related.slice(0, 10);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.slice(0, maxLength) + '...';
  }

  private updateAverageSearchTime(newTime: number): void {
    const n = this.stats.searchesPerformed;
    this.stats.averageSearchTime = 
      (this.stats.averageSearchTime * (n - 1) + newTime) / n;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getStats(): {
    searchesPerformed: number;
    totalResults: number;
    averageSearchTime: number;
    embeddingsGenerated: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    documentCount: number;
  } {
    const totalCache = this.stats.cacheHits + this.stats.cacheMisses;
    
    return {
      searchesPerformed: this.stats.searchesPerformed,
      totalResults: this.stats.totalResults,
      averageSearchTime: this.stats.averageSearchTime,
      embeddingsGenerated: this.stats.embeddingsGenerated,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: totalCache > 0 ? this.stats.cacheHits / totalCache : 0,
      documentCount: this.documents.size,
    };
  }

  resetStats(): void {
    this.stats = {
      searchesPerformed: 0,
      totalResults: 0,
      averageSearchTime: 0,
      embeddingsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<SemanticSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SemanticSearchConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    this.removeAllListeners();
    this.clearDocuments();
    this.embeddingCache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSemanticSearch(
  config?: Partial<SemanticSearchConfig>
): SemanticSearch {
  return new SemanticSearch(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function semanticSearch(
  documents: SearchDocument[],
  query: string,
  config?: Partial<SemanticSearchConfig>
): Promise<SemanticSearchResult> {
  const search = new SemanticSearch(config);
  search.addDocuments(documents);
  return search.search(query);
}

export function addDocumentsToSearch(
  search: SemanticSearch,
  documents: SearchDocument[]
): void {
  search.addDocuments(documents);
}

export function clearSearchIndex(search: SemanticSearch): void {
  search.clearDocuments();
}
