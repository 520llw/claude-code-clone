/**
 * AgentTools Unit Tests
 * Tests for agent delegation, sub-agent management, and task distribution
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestContext, cleanupTestContext, wait } from '../../setup';

// ============================================================================
// Type Definitions
// ============================================================================

interface AgentTask {
  id: string;
  description: string;
  context?: string;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}

interface AgentResult {
  success: boolean;
  taskId: string;
  output?: string;
  error?: string;
  executionTime: number;
}

interface SubAgent {
  id: string;
  name: string;
  capabilities: string[];
  isAvailable: boolean;
  activeTasks: number;
  maxConcurrentTasks: number;
}

// ============================================================================
// Mock AgentTools Implementation
// ============================================================================

class TestAgentTools {
  private subAgents: Map<string, SubAgent> = new Map();
  private taskHistory: Array<{
    task: AgentTask;
    result: AgentResult;
    timestamp: number;
  }> = [];
  private mockResults: Map<string, AgentResult> = new Map();

  // ============================================================================
  // Sub-Agent Management
  // ============================================================================

  registerSubAgent(agent: Omit<SubAgent, 'activeTasks'>): SubAgent {
    const fullAgent: SubAgent = {
      ...agent,
      activeTasks: 0,
    };
    this.subAgents.set(agent.id, fullAgent);
    return fullAgent;
  }

  unregisterSubAgent(id: string): boolean {
    return this.subAgents.delete(id);
  }

  getSubAgent(id: string): SubAgent | undefined {
    return this.subAgents.get(id);
  }

  getAllSubAgents(): SubAgent[] {
    return Array.from(this.subAgents.values());
  }

  getAvailableAgents(): SubAgent[] {
    return this.getAllSubAgents().filter(agent => 
      agent.isAvailable && agent.activeTasks < agent.maxConcurrentTasks
    );
  }

  getAgentsByCapability(capability: string): SubAgent[] {
    return this.getAllSubAgents().filter(agent =>
      agent.capabilities.includes(capability)
    );
  }

  updateSubAgent(id: string, updates: Partial<SubAgent>): boolean {
    const agent = this.subAgents.get(id);
    if (!agent) return false;

    Object.assign(agent, updates);
    return true;
  }

  setAgentAvailability(id: string, isAvailable: boolean): boolean {
    return this.updateSubAgent(id, { isAvailable });
  }

  // ============================================================================
  // Task Delegation
  // ============================================================================

  async delegateTask(agentId: string, task: Omit<AgentTask, 'id'>): Promise<AgentResult> {
    const startTime = Date.now();
    const agent = this.subAgents.get(agentId);

    if (!agent) {
      return {
        success: false,
        taskId: this.generateTaskId(),
        error: `Sub-agent not found: ${agentId}`,
        executionTime: Date.now() - startTime,
      };
    }

    if (!agent.isAvailable) {
      return {
        success: false,
        taskId: this.generateTaskId(),
        error: `Sub-agent ${agentId} is not available`,
        executionTime: Date.now() - startTime,
      };
    }

    if (agent.activeTasks >= agent.maxConcurrentTasks) {
      return {
        success: false,
        taskId: this.generateTaskId(),
        error: `Sub-agent ${agentId} has reached max concurrent tasks`,
        executionTime: Date.now() - startTime,
      };
    }

    const fullTask: AgentTask = {
      ...task,
      id: this.generateTaskId(),
    };

    // Increment active tasks
    agent.activeTasks++;

    try {
      // Check for mock result
      const mockResult = this.mockResults.get(fullTask.description);
      if (mockResult) {
        const result = { ...mockResult, taskId: fullTask.id };
        this.recordTask(fullTask, result);
        return result;
      }

      // Simulate task execution
      await wait(10);

      const result: AgentResult = {
        success: true,
        taskId: fullTask.id,
        output: `Task completed by ${agent.name}: ${task.description}`,
        executionTime: Date.now() - startTime,
      };

      this.recordTask(fullTask, result);
      return result;
    } finally {
      agent.activeTasks--;
    }
  }

  async delegateToBestAgent(task: Omit<AgentTask, 'id'>): Promise<AgentResult> {
    const availableAgents = this.getAvailableAgents();

    if (availableAgents.length === 0) {
      return {
        success: false,
        taskId: this.generateTaskId(),
        error: 'No available sub-agents',
        executionTime: 0,
      };
    }

    // Select agent with fewest active tasks
    const bestAgent = availableAgents.reduce((best, current) =>
      current.activeTasks < best.activeTasks ? current : best
    );

    return this.delegateTask(bestAgent.id, task);
  }

  async delegateToAll(task: Omit<AgentTask, 'id'>): Promise<AgentResult[]> {
    const availableAgents = this.getAvailableAgents();
    
    return Promise.all(
      availableAgents.map(agent => this.delegateTask(agent.id, task))
    );
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  getTaskHistory(): typeof this.taskHistory {
    return [...this.taskHistory];
  }

  getTasksByAgent(agentId: string): typeof this.taskHistory {
    return this.taskHistory.filter(entry => {
      // In a real implementation, tasks would track which agent executed them
      return true;
    });
  }

  getSuccessfulTasks(): typeof this.taskHistory {
    return this.taskHistory.filter(entry => entry.result.success);
  }

  getFailedTasks(): typeof this.taskHistory {
    return this.taskHistory.filter(entry => !entry.result.success);
  }

  clearHistory(): void {
    this.taskHistory = [];
  }

  // ============================================================================
  // Mock Results
  // ============================================================================

  setMockResult(taskDescription: string, result: Omit<AgentResult, 'taskId'>): void {
    this.mockResults.set(taskDescription, result as AgentResult);
  }

  clearMockResults(): void {
    this.mockResults.clear();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordTask(task: AgentTask, result: AgentResult): void {
    this.taskHistory.push({
      task,
      result,
      timestamp: Date.now(),
    });
  }

  getAgentStats(): {
    totalAgents: number;
    availableAgents: number;
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
  } {
    return {
      totalAgents: this.subAgents.size,
      availableAgents: this.getAvailableAgents().length,
      totalTasks: this.taskHistory.length,
      successfulTasks: this.getSuccessfulTasks().length,
      failedTasks: this.getFailedTasks().length,
    };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AgentTools', () => {
  let agentTools: TestAgentTools;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    agentTools = new TestAgentTools();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  // ============================================================================
  // Sub-Agent Registration Tests
  // ============================================================================

  describe('Sub-Agent Registration', () => {
    test('should register sub-agent', () => {
      const agent = agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'File Agent',
        capabilities: ['file_read', 'file_write'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-1');
      expect(agent.activeTasks).toBe(0);
    });

    test('should unregister sub-agent', () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: [],
        isAvailable: true,
        maxConcurrentTasks: 1,
      });

      const removed = agentTools.unregisterSubAgent('agent-1');

      expect(removed).toBe(true);
      expect(agentTools.getSubAgent('agent-1')).toBeUndefined();
    });

    test('should return false when unregistering non-existent agent', () => {
      const removed = agentTools.unregisterSubAgent('non-existent');
      expect(removed).toBe(false);
    });

    test('should get sub-agent by id', () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: [],
        isAvailable: true,
        maxConcurrentTasks: 1,
      });

      const retrieved = agentTools.getSubAgent('agent-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Agent');
    });

    test('should get all sub-agents', () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Agent 1',
        capabilities: [],
        isAvailable: true,
        maxConcurrentTasks: 1,
      });
      agentTools.registerSubAgent({
        id: 'agent-2',
        name: 'Agent 2',
        capabilities: [],
        isAvailable: true,
        maxConcurrentTasks: 1,
      });

      const all = agentTools.getAllSubAgents();

      expect(all).toHaveLength(2);
    });
  });

  // ============================================================================
  // Agent Query Tests
  // ============================================================================

  describe('Agent Query', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'file-agent',
        name: 'File Agent',
        capabilities: ['file_read', 'file_write'],
        isAvailable: true,
        maxConcurrentTasks: 3,
      });
      agentTools.registerSubAgent({
        id: 'web-agent',
        name: 'Web Agent',
        capabilities: ['web_fetch', 'web_search'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
      agentTools.registerSubAgent({
        id: 'busy-agent',
        name: 'Busy Agent',
        capabilities: ['compute'],
        isAvailable: false,
        maxConcurrentTasks: 1,
      });
    });

    test('should get available agents', () => {
      const available = agentTools.getAvailableAgents();

      expect(available).toHaveLength(2);
      expect(available.every(a => a.isAvailable)).toBe(true);
    });

    test('should get agents by capability', () => {
      const fileAgents = agentTools.getAgentsByCapability('file_read');

      expect(fileAgents).toHaveLength(1);
      expect(fileAgents[0].id).toBe('file-agent');
    });

    test('should update sub-agent', () => {
      const updated = agentTools.updateSubAgent('file-agent', { maxConcurrentTasks: 10 });

      expect(updated).toBe(true);
      expect(agentTools.getSubAgent('file-agent')?.maxConcurrentTasks).toBe(10);
    });

    test('should return false when updating non-existent agent', () => {
      const updated = agentTools.updateSubAgent('non-existent', { isAvailable: false });
      expect(updated).toBe(false);
    });

    test('should set agent availability', () => {
      agentTools.setAgentAvailability('file-agent', false);

      expect(agentTools.getSubAgent('file-agent')?.isAvailable).toBe(false);
    });
  });

  // ============================================================================
  // Task Delegation Tests
  // ============================================================================

  describe('Task Delegation', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 3,
      });
    });

    test('should delegate task to agent', async () => {
      const result = await agentTools.delegateTask('agent-1', {
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test task');
    });

    test('should return error for non-existent agent', async () => {
      const result = await agentTools.delegateTask('non-existent', {
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should return error for unavailable agent', async () => {
      agentTools.setAgentAvailability('agent-1', false);

      const result = await agentTools.delegateTask('agent-1', {
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    test('should enforce max concurrent tasks', async () => {
      // Fill up agent's concurrent task limit
      const promises: Promise<AgentResult>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(agentTools.delegateTask('agent-1', {
          description: `Task ${i}`,
          priority: 'medium',
        }));
      }

      const results = await Promise.all(promises);
      
      // Some should fail due to max concurrent limit
      const failedResults = results.filter(r => !r.success);
      expect(failedResults.length).toBeGreaterThan(0);
    });

    test('should track task execution time', async () => {
      const result = await agentTools.delegateTask('agent-1', {
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should include task context', async () => {
      agentTools.setMockResult('Context task', {
        success: true,
        output: 'Processed with context',
        executionTime: 0,
      });

      const result = await agentTools.delegateTask('agent-1', {
        description: 'Context task',
        context: 'Additional context here',
        priority: 'high',
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Best Agent Selection Tests
  // ============================================================================

  describe('Best Agent Selection', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Agent 1',
        capabilities: ['task'],
        isAvailable: true,
        maxConcurrentTasks: 3,
      });
      agentTools.registerSubAgent({
        id: 'agent-2',
        name: 'Agent 2',
        capabilities: ['task'],
        isAvailable: true,
        maxConcurrentTasks: 3,
      });
    });

    test('should delegate to best available agent', async () => {
      // Make agent-1 busy
      await agentTools.delegateTask('agent-1', {
        description: 'Busy task',
        priority: 'medium',
      });

      const result = await agentTools.delegateToBestAgent({
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
    });

    test('should return error when no agents available', async () => {
      agentTools.setAgentAvailability('agent-1', false);
      agentTools.setAgentAvailability('agent-2', false);

      const result = await agentTools.delegateToBestAgent({
        description: 'Test task',
        priority: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available');
    });
  });

  // ============================================================================
  // Broadcast Tests
  // ============================================================================

  describe('Broadcast', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Agent 1',
        capabilities: ['notify'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
      agentTools.registerSubAgent({
        id: 'agent-2',
        name: 'Agent 2',
        capabilities: ['notify'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
    });

    test('should delegate to all available agents', async () => {
      const results = await agentTools.delegateToAll({
        description: 'Broadcast message',
        priority: 'low',
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should only delegate to available agents', async () => {
      agentTools.setAgentAvailability('agent-2', false);

      const results = await agentTools.delegateToAll({
        description: 'Broadcast message',
        priority: 'low',
      });

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Task History Tests
  // ============================================================================

  describe('Task History', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
    });

    test('should record task history', async () => {
      await agentTools.delegateTask('agent-1', {
        description: 'Task 1',
        priority: 'medium',
      });

      const history = agentTools.getTaskHistory();

      expect(history).toHaveLength(1);
      expect(history[0].task.description).toBe('Task 1');
    });

    test('should get successful tasks', async () => {
      agentTools.setMockResult('Fail task', {
        success: false,
        error: 'Task failed',
        executionTime: 0,
      });

      await agentTools.delegateTask('agent-1', {
        description: 'Success task',
        priority: 'medium',
      });
      await agentTools.delegateTask('agent-1', {
        description: 'Fail task',
        priority: 'medium',
      });

      const successful = agentTools.getSuccessfulTasks();

      expect(successful).toHaveLength(1);
      expect(successful[0].task.description).toBe('Success task');
    });

    test('should get failed tasks', async () => {
      agentTools.setMockResult('Fail task', {
        success: false,
        error: 'Task failed',
        executionTime: 0,
      });

      await agentTools.delegateTask('agent-1', {
        description: 'Success task',
        priority: 'medium',
      });
      await agentTools.delegateTask('agent-1', {
        description: 'Fail task',
        priority: 'medium',
      });

      const failed = agentTools.getFailedTasks();

      expect(failed).toHaveLength(1);
      expect(failed[0].task.description).toBe('Fail task');
    });

    test('should clear history', async () => {
      await agentTools.delegateTask('agent-1', {
        description: 'Task',
        priority: 'medium',
      });

      agentTools.clearHistory();

      expect(agentTools.getTaskHistory()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Agent 1',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
    });

    test('should get agent stats', async () => {
      await agentTools.delegateTask('agent-1', {
        description: 'Task 1',
        priority: 'medium',
      });
      await agentTools.delegateTask('agent-1', {
        description: 'Task 2',
        priority: 'medium',
      });

      const stats = agentTools.getAgentStats();

      expect(stats.totalAgents).toBe(1);
      expect(stats.totalTasks).toBe(2);
      expect(stats.successfulTasks).toBe(2);
    });

    test('should track available agents', () => {
      const stats = agentTools.getAgentStats();

      expect(stats.availableAgents).toBe(1);
    });
  });

  // ============================================================================
  // Mock Results Tests
  // ============================================================================

  describe('Mock Results', () => {
    beforeEach(() => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });
    });

    test('should use mock result', async () => {
      agentTools.setMockResult('Mocked task', {
        success: true,
        output: 'Mocked output',
        executionTime: 100,
      });

      const result = await agentTools.delegateTask('agent-1', {
        description: 'Mocked task',
        priority: 'medium',
      });

      expect(result.output).toBe('Mocked output');
    });

    test('should clear mock results', async () => {
      agentTools.setMockResult('Mocked task', {
        success: true,
        output: 'Mocked',
        executionTime: 0,
      });
      agentTools.clearMockResults();

      const result = await agentTools.delegateTask('agent-1', {
        description: 'Mocked task',
        priority: 'medium',
      });

      expect(result.output).not.toBe('Mocked');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty task description', async () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });

      const result = await agentTools.delegateTask('agent-1', {
        description: '',
        priority: 'low',
      });

      expect(result.success).toBe(true);
    });

    test('should handle very long task description', async () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });

      const longDescription = 'a'.repeat(10000);
      const result = await agentTools.delegateTask('agent-1', {
        description: longDescription,
        priority: 'medium',
      });

      expect(result.success).toBe(true);
    });

    test('should handle rapid task delegation', async () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 100,
      });

      const promises: Promise<AgentResult>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(agentTools.delegateTask('agent-1', {
          description: `Task ${i}`,
          priority: 'medium',
        }));
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(50);
    });

    test('should handle all priority levels', async () => {
      agentTools.registerSubAgent({
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: ['test'],
        isAvailable: true,
        maxConcurrentTasks: 5,
      });

      const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      
      for (const priority of priorities) {
        const result = await agentTools.delegateTask('agent-1', {
          description: `${priority} priority task`,
          priority,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
