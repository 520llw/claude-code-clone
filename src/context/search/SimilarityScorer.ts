/**
 * Similarity Scorer - Similarity scoring for semantic search
 * 
 * Provides multiple similarity metrics:
 * - Cosine similarity
 * - Euclidean distance
 * - Dot product
 * - Hybrid scoring
 * 
 * Features:
 * - Normalized scores
 * - Batch scoring
 * - Configurable metrics
 * - Performance optimization
 */

// ============================================================================
// Scorer Configuration
// ============================================================================

export interface SimilarityScorerConfig {
  defaultMethod: 'cosine' | 'euclidean' | 'dot' | 'hybrid';
  normalizeScores: boolean;
  minScore: number;
  maxScore: number;
}

export const DEFAULT_SCORER_CONFIG: SimilarityScorerConfig = {
  defaultMethod: 'cosine',
  normalizeScores: true,
  minScore: 0,
  maxScore: 1,
};

// ============================================================================
// Similarity Result
// ============================================================================

export interface SimilarityResult {
  score: number;
  method: string;
  normalized: boolean;
}

// ============================================================================
// Similarity Scorer
// ============================================================================

export class SimilarityScorer {
  private config: SimilarityScorerConfig;

  constructor(config: Partial<SimilarityScorerConfig> = {}) {
    this.config = { ...DEFAULT_SCORER_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Core Similarity Methods
  // --------------------------------------------------------------------------

  /**
   * Calculate cosine similarity between two vectors
   * Range: -1 to 1 (normalized to 0-1 if configured)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    const similarity = dotProduct / (normA * normB);

    return this.config.normalizeScores
      ? this.normalizeCosine(similarity)
      : similarity;
  }

  /**
   * Calculate Euclidean distance between two vectors
   * Range: 0 to infinity (normalized to 0-1 if configured)
   */
  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let sum = 0;

    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    const distance = Math.sqrt(sum);

    return this.config.normalizeScores
      ? this.normalizeEuclidean(distance)
      : distance;
  }

  /**
   * Calculate dot product of two vectors
   * Range: -infinity to infinity (normalized to 0-1 if configured)
   */
  dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let product = 0;

    for (let i = 0; i < a.length; i++) {
      product += a[i] * b[i];
    }

    return this.config.normalizeScores
      ? this.normalizeDotProduct(product, a, b)
      : product;
  }

  /**
   * Calculate hybrid similarity combining multiple methods
   */
  hybridSimilarity(a: number[], b: number[]): number {
    const cosine = this.cosineSimilarity(a, b);
    const euclidean = this.euclideanDistance(a, b);
    const dot = this.dotProduct(a, b);

    // Weighted combination
    const score = cosine * 0.5 + (1 - euclidean) * 0.3 + dot * 0.2;

    return this.clampScore(score);
  }

  // --------------------------------------------------------------------------
  // Generic Score Method
  // --------------------------------------------------------------------------

  calculate(
    a: number[],
    b: number[],
    method?: SimilarityScorerConfig['defaultMethod']
  ): number {
    const scoringMethod = method || this.config.defaultMethod;

    switch (scoringMethod) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return this.euclideanDistance(a, b);
      case 'dot':
        return this.dotProduct(a, b);
      case 'hybrid':
        return this.hybridSimilarity(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  // --------------------------------------------------------------------------
  // Batch Scoring
  // --------------------------------------------------------------------------

  calculateBatch(
    query: number[],
    documents: Array<{ id: string; embedding: number[] }>,
    method?: SimilarityScorerConfig['defaultMethod']
  ): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];

    for (const doc of documents) {
      const score = this.calculate(query, doc.embedding, method);
      results.push({ id: doc.id, score });
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  calculateMatrix(
    vectors: number[][],
    method?: SimilarityScorerConfig['defaultMethod']
  ): number[][] {
    const n = vectors.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const score = this.calculate(vectors[i], vectors[j], method);
        matrix[i][j] = score;
        matrix[j][i] = score;
      }
    }

    return matrix;
  }

  // --------------------------------------------------------------------------
  // Normalization
  // --------------------------------------------------------------------------

  private normalizeCosine(similarity: number): number {
    // Cosine similarity ranges from -1 to 1
    // Normalize to 0 to 1
    return (similarity + 1) / 2;
  }

  private normalizeEuclidean(distance: number): number {
    // Convert distance to similarity
    // Using exponential decay
    return Math.exp(-distance);
  }

  private normalizeDotProduct(
    product: number,
    a: number[],
    b: number[]
  ): number {
    // Normalize by vector magnitudes
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));

    if (normA === 0 || normB === 0) {
      return 0;
    }

    // This effectively becomes cosine similarity
    return product / (normA * normB);
  }

  private clampScore(score: number): number {
    return Math.max(
      this.config.minScore,
      Math.min(this.config.maxScore, score)
    );
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    
    if (magnitude === 0) {
      return vector;
    }

    return vector.map(v => v / magnitude);
  }

  centerVector(vector: number[]): number[] {
    const mean = vector.reduce((sum, v) => sum + v, 0) / vector.length;
    return vector.map(v => v - mean);
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  updateConfig(config: Partial<SimilarityScorerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SimilarityScorerConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSimilarityScorer(
  config?: Partial<SimilarityScorerConfig>
): SimilarityScorer {
  return new SimilarityScorer(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function cosineSimilarity(a: number[], b: number[]): number {
  const scorer = new SimilarityScorer();
  return scorer.cosineSimilarity(a, b);
}

export function euclideanDistance(a: number[], b: number[]): number {
  const scorer = new SimilarityScorer({ normalizeScores: false });
  return scorer.euclideanDistance(a, b);
}

export function dotProduct(a: number[], b: number[]): number {
  const scorer = new SimilarityScorer({ normalizeScores: false });
  return scorer.dotProduct(a, b);
}

export function hybridSimilarity(a: number[], b: number[]): number {
  const scorer = new SimilarityScorer();
  return scorer.hybridSimilarity(a, b);
}

export function calculateSimilarity(
  a: number[],
  b: number[],
  method: 'cosine' | 'euclidean' | 'dot' | 'hybrid' = 'cosine'
): number {
  const scorer = new SimilarityScorer({ defaultMethod: method });
  return scorer.calculate(a, b);
}

export function rankBySimilarity(
  query: number[],
  items: Array<{ id: string; embedding: number[] }>,
  method?: 'cosine' | 'euclidean' | 'dot' | 'hybrid'
): Array<{ id: string; score: number }> {
  const scorer = new SimilarityScorer({ defaultMethod: method });
  return scorer.calculateBatch(query, items);
}
