/**
 * SkillComposer.ts - Skill Composition System
 * 
 * Enables composing multiple skills into workflows and pipelines.
 * Supports linear, branching, and conditional compositions.
 */

import { EventEmitter } from 'events';
import {
  Skill,
  SkillId,
  SkillInput,
  SkillOutput,
  SkillContext,
  SkillComposition,
  SkillCompositionNode,
  SkillCompositionEdge,
  ComposedSkillResult,
  ExecutionGraph,
  ExecutionNode,
  ExecutionEdge,
  SkillExecutionStatus,
  SkillError,
  SkillErrorCode,
  SkillExecutionError,
} from './types';
import { SkillRegistry } from './SkillRegistry';

/**
 * Node execution result
 */
interface NodeExecutionResult {
  nodeId: string;
  output: SkillOutput;
  startTime: Date;
  endTime: Date;
}

/**
 * Variable context for composition
 */
interface VariableContext {
  variables: Map<string, unknown>;
  nodeOutputs: Map<string, SkillOutput>;
}

/**
 * Skill composer for creating and executing skill compositions
 */
export class SkillComposer extends EventEmitter {
  /**
   * Skill registry reference
   */
  private _registry: SkillRegistry;

  /**
   * Active compositions
   */
  private _activeCompositions: Map<string, AbortController> = new Map();

  /**
   * Create a new skill composer
   */
  constructor(registry: SkillRegistry) {
    super();
    this._registry = registry;
  }

  // ============================================================================
  // Composition Creation
  // ============================================================================

  /**
   * Create a linear composition (pipeline)
   */
  public createLinear(
    id: string,
    name: string,
    skillIds: SkillId[],
    options?: {
      description?: string;
      inputMappings?: Record<string, Record<string, string>>;
      outputMappings?: Record<string, Record<string, string>>;
    }
  ): SkillComposition {
    const nodes: SkillCompositionNode[] = skillIds.map((skillId, index) => ({
      skillId,
      inputMapping: options?.inputMappings?.[skillId] || {},
      outputMapping: options?.outputMappings?.[skillId] || {},
      onError: 'stop',
      retryCount: 0,
    }));

    const edges: SkillCompositionEdge[] = [];
    for (let i = 0; i < skillIds.length - 1; i++) {
      edges.push({
        from: skillIds[i],
        to: skillIds[i + 1],
      });
    }

    return {
      id,
      name,
      description: options?.description || `Linear composition: ${name}`,
      nodes,
      edges,
      variables: {},
    };
  }

  /**
   * Create a parallel composition
   */
  public createParallel(
    id: string,
    name: string,
    skillIds: SkillId[],
    options?: {
      description?: string;
      mergeStrategy?: 'array' | 'object' | 'custom';
    }
  ): SkillComposition {
    const nodes: SkillCompositionNode[] = skillIds.map(skillId => ({
      skillId,
      inputMapping: {},
      outputMapping: {},
      onError: 'continue',
      retryCount: 0,
    }));

    // No edges means parallel execution
    return {
      id,
      name,
      description: options?.description || `Parallel composition: ${name}`,
      nodes,
      edges: [],
      variables: {
        mergeStrategy: options?.mergeStrategy || 'object',
      },
    };
  }

  /**
   * Create a conditional composition
   */
  public createConditional(
    id: string,
    name: string,
    condition: string,
    trueSkillId: SkillId,
    falseSkillId?: SkillId,
    options?: {
      description?: string;
    }
  ): SkillComposition {
    const nodes: SkillCompositionNode[] = [
      {
        skillId: trueSkillId,
        inputMapping: {},
        outputMapping: {},
        condition,
        onError: 'stop',
        retryCount: 0,
      },
    ];

    if (falseSkillId) {
      nodes.push({
        skillId: falseSkillId,
        inputMapping: {},
        outputMapping: {},
        condition: `!(${condition})`,
        onError: 'stop',
        retryCount: 0,
      });
    }

    return {
      id,
      name,
      description: options?.description || `Conditional composition: ${name}`,
      nodes,
      edges: [],
      variables: {},
    };
  }

  /**
   * Create a branching composition
   */
  public createBranch(
    id: string,
    name: string,
    branches: { condition: string; skillId: SkillId }[],
    options?: {
      description?: string;
      defaultBranch?: SkillId;
    }
  ): SkillComposition {
    const nodes: SkillCompositionNode[] = branches.map((branch, index) => ({
      skillId: branch.skillId,
      inputMapping: {},
      outputMapping: {},
      condition: branch.condition,
      onError: 'continue',
      retryCount: 0,
    }));

    if (options?.defaultBranch) {
      const conditions = branches.map(b => b.condition).join(' || ');
      nodes.push({
        skillId: options.defaultBranch,
        inputMapping: {},
        outputMapping: {},
        condition: `!(${conditions})`,
        onError: 'continue',
        retryCount: 0,
      });
    }

    return {
      id,
      name,
      description: options?.description || `Branching composition: ${name}`,
      nodes,
      edges: [],
      variables: {},
    };
  }

  /**
   * Create a loop composition
   */
  public createLoop(
    id: string,
    name: string,
    skillId: SkillId,
    condition: string,
    options?: {
      description?: string;
      maxIterations?: number;
    }
  ): SkillComposition {
    return {
      id,
      name,
      description: options?.description || `Loop composition: ${name}`,
      nodes: [
        {
          skillId,
          inputMapping: {},
          outputMapping: {},
          condition,
          onError: 'stop',
          retryCount: 0,
        },
      ],
      edges: [
        {
          from: skillId,
          to: skillId,
          condition,
        },
      ],
      variables: {
        maxIterations: options?.maxIterations || 100,
        iterationCount: 0,
      },
    };
  }

  // ============================================================================
  // Composition Execution
  // ============================================================================

  /**
   * Execute a composition
   */
  public async execute(
    composition: SkillComposition,
    initialInput: SkillInput,
    context: SkillContext
  ): Promise<ComposedSkillResult> {
    const executionId = this._generateExecutionId();
    const abortController = new AbortController();
    this._activeCompositions.set(executionId, abortController);

    this.emit('composition:started', { executionId, compositionId: composition.id });

    try {
      // Build execution graph
      const executionGraph = this._buildExecutionGraph(composition);

      // Initialize variable context
      const varContext: VariableContext = {
        variables: new Map(Object.entries(composition.variables)),
        nodeOutputs: new Map(),
      };

      // Set initial input
      varContext.variables.set('input', initialInput);

      // Execute nodes
      const results = new Map<string, SkillOutput>();
      const executedNodes = new Set<string>();

      // Determine execution order
      const executionOrder = this._determineExecutionOrder(composition, executionGraph);

      for (const nodeId of executionOrder) {
        // Check for abort
        if (abortController.signal.aborted) {
          throw new SkillExecutionError('SKILL_CANCELLED', 'Composition was cancelled');
        }

        const node = composition.nodes.find(n => n.skillId === nodeId);
        if (!node) continue;

        // Check condition
        if (node.condition && !this._evaluateCondition(node.condition, varContext)) {
          continue;
        }

        // Check if already executed
        if (executedNodes.has(nodeId)) {
          continue;
        }

        // Execute node
        const result = await this._executeNode(
          node,
          varContext,
          context,
          abortController.signal
        );

        results.set(nodeId, result.output);
        varContext.nodeOutputs.set(nodeId, result.output);
        executedNodes.add(nodeId);

        // Handle error
        if (!result.output.success) {
          if (node.onError === 'stop') {
            break;
          } else if (node.onError === 'retry' && node.retryCount > 0) {
            // Retry logic would go here
          }
          // 'continue' - proceed to next node
        }

        // Map outputs to variables
        this._mapOutputs(node, result.output, varContext);
      }

      // Build final result
      const finalOutput = this._buildFinalOutput(composition, results, varContext);

      const composedResult: ComposedSkillResult = {
        success: finalOutput.success,
        results,
        finalOutput,
        executionGraph,
      };

      this.emit('composition:completed', { executionId, compositionId: composition.id, result: composedResult });

      return composedResult;
    } catch (error) {
      this.emit('composition:failed', { executionId, compositionId: composition.id, error });
      
      return {
        success: false,
        results: new Map(),
        executionGraph: this._buildExecutionGraph(composition),
      };
    } finally {
      this._activeCompositions.delete(executionId);
    }
  }

  /**
   * Cancel a composition
   */
  public cancelComposition(executionId: string): boolean {
    const controller = this._activeCompositions.get(executionId);
    if (controller) {
      controller.abort();
      this._activeCompositions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all compositions
   */
  public cancelAll(): number {
    let count = 0;
    for (const [id, controller] of this._activeCompositions) {
      controller.abort();
      this._activeCompositions.delete(id);
      count++;
    }
    return count;
  }

  // ============================================================================
  // Composition Validation
  // ============================================================================

  /**
   * Validate a composition
   */
  public validate(composition: SkillComposition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for empty composition
    if (composition.nodes.length === 0) {
      errors.push('Composition must have at least one node');
    }

    // Validate all skill IDs exist
    for (const node of composition.nodes) {
      if (!this._registry.has(node.skillId)) {
        errors.push(`Skill '${node.skillId}' is not registered`);
      }
    }

    // Validate edges
    for (const edge of composition.edges) {
      const fromExists = composition.nodes.some(n => n.skillId === edge.from);
      const toExists = composition.nodes.some(n => n.skillId === edge.to);

      if (!fromExists) {
        errors.push(`Edge references unknown source node: ${edge.from}`);
      }
      if (!toExists) {
        errors.push(`Edge references unknown target node: ${edge.to}`);
      }
    }

    // Check for cycles in non-loop compositions
    if (!this._hasLoopEdges(composition)) {
      if (this._detectCycle(composition)) {
        errors.push('Composition contains a cycle (use createLoop for loops)');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if composition has valid flow
   */
  public hasValidFlow(composition: SkillComposition): boolean {
    const { valid } = this.validate(composition);
    return valid;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get composition info
   */
  public getInfo(composition: SkillComposition): {
    nodeCount: number;
    edgeCount: number;
    skillIds: SkillId[];
    estimatedComplexity: 'low' | 'medium' | 'high';
  } {
    const nodeCount = composition.nodes.length;
    const edgeCount = composition.edges.length;
    const skillIds = composition.nodes.map(n => n.skillId);

    let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
    if (nodeCount > 10 || edgeCount > 15) {
      estimatedComplexity = 'high';
    } else if (nodeCount > 5 || edgeCount > 8) {
      estimatedComplexity = 'medium';
    }

    return {
      nodeCount,
      edgeCount,
      skillIds,
      estimatedComplexity,
    };
  }

  /**
   * Export composition to JSON
   */
  public toJSON(composition: SkillComposition): string {
    return JSON.stringify(composition, null, 2);
  }

  /**
   * Import composition from JSON
   */
  public fromJSON(json: string): SkillComposition {
    return JSON.parse(json);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build execution graph
   */
  private _buildExecutionGraph(composition: SkillComposition): ExecutionGraph {
    const nodes: ExecutionNode[] = composition.nodes.map(node => ({
      id: node.skillId,
      skillId: node.skillId,
      status: 'idle',
    }));

    const edges: ExecutionEdge[] = composition.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      dataFlow: [],
    }));

    return { nodes, edges };
  }

  /**
   * Determine execution order (topological sort)
   */
  private _determineExecutionOrder(
    composition: SkillComposition,
    graph: ExecutionGraph
  ): string[] {
    // If no edges, execute in parallel (all at once)
    if (composition.edges.length === 0) {
      return composition.nodes.map(n => n.skillId);
    }

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of composition.nodes) {
      adjacency.set(node.skillId, []);
      inDegree.set(node.skillId, 0);
    }

    for (const edge of composition.edges) {
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const neighbor of adjacency.get(node)!) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Execute a single node
   */
  private async _executeNode(
    node: SkillCompositionNode,
    varContext: VariableContext,
    context: SkillContext,
    abortSignal: AbortSignal
  ): Promise<NodeExecutionResult> {
    const startTime = new Date();

    // Get skill
    const skill = await this._registry.load(node.skillId);

    // Build input from mappings
    const input = this._buildNodeInput(node, varContext);

    // Execute
    const output = await skill.execute(input, context, { abortSignal });

    const endTime = new Date();

    return {
      nodeId: node.skillId,
      output,
      startTime,
      endTime,
    };
  }

  /**
   * Build input for a node
   */
  private _buildNodeInput(
    node: SkillCompositionNode,
    varContext: VariableContext
  ): SkillInput {
    const input: SkillInput = {};

    for (const [paramName, varPath] of Object.entries(node.inputMapping)) {
      const value = this._resolveVariable(varPath, varContext);
      if (value !== undefined) {
        input[paramName] = value;
      }
    }

    return input;
  }

  /**
   * Map outputs to variables
   */
  private _mapOutputs(
    node: SkillCompositionNode,
    output: SkillOutput,
    varContext: VariableContext
  ): void {
    for (const [outputName, varName] of Object.entries(node.outputMapping)) {
      const value = (output.data as Record<string, unknown>)?.[outputName];
      if (value !== undefined) {
        varContext.variables.set(varName, value);
      }
    }
  }

  /**
   * Resolve a variable path
   */
  private _resolveVariable(path: string, varContext: VariableContext): unknown {
    // Handle special paths
    if (path === 'input') {
      return varContext.variables.get('input');
    }

    if (path.startsWith('nodes.')) {
      const nodeId = path.split('.')[1];
      const output = varContext.nodeOutputs.get(nodeId);
      const dataPath = path.split('.').slice(2);
      return this._getNestedValue(output?.data, dataPath);
    }

    if (path.startsWith('vars.')) {
      const varName = path.substring(5);
      return varContext.variables.get(varName);
    }

    // Direct variable access
    return varContext.variables.get(path);
  }

  /**
   * Get nested value from object
   */
  private _getNestedValue(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Evaluate a condition
   */
  private _evaluateCondition(condition: string, varContext: VariableContext): boolean {
    try {
      // Simple condition evaluation
      // In production, use a proper expression evaluator
      const vars: Record<string, unknown> = {};
      varContext.variables.forEach((value, key) => {
        vars[key] = value;
      });

      // Create safe evaluation function
      const fn = new Function('vars', `with(vars) { return ${condition}; }`);
      return Boolean(fn(vars));
    } catch {
      return false;
    }
  }

  /**
   * Build final output
   */
  private _buildFinalOutput(
    composition: SkillComposition,
    results: Map<string, SkillOutput>,
    varContext: VariableContext
  ): SkillOutput {
    // Collect all successful outputs
    const successfulOutputs: unknown[] = [];
    let hasErrors = false;

    for (const [nodeId, output] of results) {
      if (output.success) {
        successfulOutputs.push(output.data);
      } else {
        hasErrors = true;
      }
    }

    const mergeStrategy = composition.variables.mergeStrategy as string;

    let finalData: unknown;
    if (mergeStrategy === 'array') {
      finalData = successfulOutputs;
    } else if (mergeStrategy === 'object') {
      finalData = Object.fromEntries(results.entries());
    } else {
      // Default: return last output or all outputs
      finalData = successfulOutputs[successfulOutputs.length - 1];
    }

    return {
      success: !hasErrors || successfulOutputs.length > 0,
      data: finalData,
      metadata: {
        executionTime: 0, // Would calculate from node executions
        startTime: new Date(),
        endTime: new Date(),
        cached: false,
        retryCount: 0,
      },
    };
  }

  /**
   * Check if composition has loop edges
   */
  private _hasLoopEdges(composition: SkillComposition): boolean {
    const nodeIds = new Set(composition.nodes.map(n => n.skillId));
    
    for (const edge of composition.edges) {
      if (edge.from === edge.to) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect cycles in composition
   */
  private _detectCycle(composition: SkillComposition): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adjacency = new Map<string, string[]>();

    for (const node of composition.nodes) {
      adjacency.set(node.skillId, []);
    }

    for (const edge of composition.edges) {
      adjacency.get(edge.from)!.push(edge.to);
    }

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      for (const neighbor of adjacency.get(node) || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of composition.nodes) {
      if (!visited.has(node.skillId)) {
        if (hasCycle(node.skillId)) return true;
      }
    }

    return false;
  }

  /**
   * Generate execution ID
   */
  private _generateExecutionId(): string {
    return `composition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SkillComposer;
