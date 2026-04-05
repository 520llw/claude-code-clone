/**
 * Agent Orchestrator Example
 * 
 * 演示如何使用重构后的多Agent协调系统
 */

import {
  AgentOrchestrator,
  PlanningAgent,
  AgentPool,
  ResultAggregator,
  createOrchestrator,
  createPlanningAgent,
  AggregationStrategy,
} from '../src/agent';

async function main() {
  console.log('🚀 Agent Orchestrator Demo\n');

  // ============================================================================
  // 1. 基础用法 - 执行复杂任务
  // ============================================================================
  console.log('📌 Example 1: Basic Task Execution');
  
  const orchestrator = createOrchestrator({
    maxConcurrentAgents: 5,
    defaultTimeout: 300000,
    enableCheckpoints: true,
    retryAttempts: 3,
    aggregationStrategy: 'sequential' as AggregationStrategy,
  }, {
    onPlanCreated: (plan) => {
      console.log(`  📋 Plan created: ${plan.goal}`);
      console.log(`     Tasks: ${plan.tasks.length}`);
      console.log(`     Parallel groups: ${plan.parallelGroups.length}`);
    },
    onTaskStarted: (taskId, agentId) => {
      console.log(`  ▶️ Task started: ${taskId.slice(0, 8)} by Agent ${agentId.slice(0, 8)}`);
    },
    onTaskCompleted: (taskId, result) => {
      console.log(`  ✅ Task completed: ${taskId.slice(0, 8)} (${result.executionTime}ms)`);
    },
    onCheckpointCreated: (checkpoint) => {
      console.log(`  💾 Checkpoint created: ${checkpoint.id.slice(0, 8)}`);
    },
    onExecutionCompleted: (planId, results) => {
      console.log(`  🎉 Execution completed: ${results.length} results`);
    },
  });

  await orchestrator.initialize();

  // 执行一个复杂任务
  const result = await orchestrator.execute(
    'Refactor the authentication module to use JWT tokens with refresh token rotation',
    {
      context: 'Current auth uses session-based authentication',
      constraints: ['maintain backward compatibility', 'add comprehensive tests'],
    }
  );

  console.log('\n📊 Execution Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Output: ${result.output.substring(0, 200)}...`);
  console.log(`  Execution time: ${result.executionTime}ms`);

  // ============================================================================
  // 2. 使用Planning Agent进行任务分析
  // ============================================================================
  console.log('\n\n📌 Example 2: Task Analysis with Planning Agent');

  const planner = createPlanningAgent({
    model: 'gpt-4',
  }, {
    enableComplexityAnalysis: true,
    enableRiskAssessment: true,
  });

  const analysis = await planner.analyze(
    'Implement a distributed caching layer with Redis clustering',
    { techStack: 'Node.js, TypeScript, Redis' }
  );

  console.log(`  🎯 Goal: ${analysis.goal}`);
  console.log(`  📊 Complexity: ${analysis.complexity}`);
  console.log(`  ⏱️ Estimated duration: ${analysis.estimatedTotalDuration} minutes`);
  console.log(`  🔄 Parallelization opportunities: ${analysis.parallelizationOpportunities}`);
  console.log(`  ⚠️ Risk factors: ${analysis.riskFactors.join(', ')}`);
  console.log(`  📋 Subtasks:`);
  analysis.subtasks.forEach((task, i) => {
    console.log(`    ${i + 1}. [${task.priority}] ${task.description} (${task.estimatedDuration}min)`);
  });

  // ============================================================================
  // 3. 使用不同的聚合策略
  // ============================================================================
  console.log('\n\n📌 Example 3: Different Aggregation Strategies');

  const strategies: AggregationStrategy[] = ['sequential', 'weighted', 'voting', 'best', 'merge'];
  
  for (const strategy of strategies) {
    const aggregator = new ResultAggregator(strategy);
    console.log(`  \n  Strategy: ${strategy}`);
    console.log(`  Description: ${getStrategyDescription(strategy)}`);
  }

  // ============================================================================
  // 4. 断点续传演示
  // ============================================================================
  console.log('\n\n📌 Example 4: Checkpoint and Recovery');

  // 模拟创建checkpoint
  const { CheckpointManager } = await import('../src/agent/checkpoint');
  const checkpointManager = new CheckpointManager();
  await checkpointManager.initialize();

  // 模拟执行中断，然后恢复
  console.log('  💡 Simulating interruption and recovery...');
  console.log('  1. Task execution started');
  console.log('  2. Checkpoint created after 3 tasks');
  console.log('  3. System interrupted (simulated)');
  console.log('  4. Resuming from checkpoint...');

  // 查找可恢复的checkpoint
  const resumableCheckpoint = await checkpointManager.findResumableCheckpoint(
    'Refactor authentication module'
  );

  if (resumableCheckpoint) {
    console.log(`  ✅ Found resumable checkpoint: ${resumableCheckpoint.id.slice(0, 8)}`);
    console.log(`     Progress: ${resumableCheckpoint.completedTasks.length}/${resumableCheckpoint.taskResults.length} tasks`);
  } else {
    console.log('  ℹ️ No resumable checkpoint found (expected in demo)');
  }

  // ============================================================================
  // 5. Agent间通信
  // ============================================================================
  console.log('\n\n📌 Example 5: Inter-Agent Communication');

  const { AgentMessageBus, createMessageFilter } = await import('../src/agent/message-bus');
  const messageBus = new AgentMessageBus();
  await messageBus.initialize();

  // Agent 1订阅消息
  const agent1Id = 'agent-001';
  const subscription1 = messageBus.subscribe(
    agent1Id,
    createMessageFilter({ types: ['share_result'], planId: 'plan-001' }),
    (message) => {
      console.log(`  📨 Agent 1 received: ${message.type} from ${message.from}`);
    }
  );

  // Agent 2发送消息
  const agent2Id = 'agent-002';
  await messageBus.send(
    agent2Id,
    agent1Id,
    'share_result',
    { data: 'Task completed successfully' },
    { planId: 'plan-001', priority: 8 }
  );

  console.log('  ✅ Message sent from Agent 2 to Agent 1');

  // 广播消息
  await messageBus.broadcast(
    agent2Id,
    'status_update',
    { status: 'in_progress', progress: 50 },
    { planId: 'plan-001' }
  );

  console.log('  📢 Broadcast message sent');

  // 获取统计
  const stats = messageBus.getStats();
  console.log(`  📊 Message bus stats: ${stats.totalSent} sent, ${stats.totalReceived} received`);

  // ============================================================================
  // 6. 获取执行统计
  // ============================================================================
  console.log('\n\n📌 Example 6: Execution Statistics');

  const orchestratorStats = orchestrator.getStats();
  console.log(`  Active plans: ${orchestratorStats.activePlans}`);
  console.log(`  Active agents: ${orchestratorStats.activeAgents}`);
  console.log(`  Completed tasks: ${orchestratorStats.completedTasks}`);
  console.log(`  Failed tasks: ${orchestratorStats.failedTasks}`);

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log('\n\n🧹 Cleaning up...');
  
  await orchestrator.dispose();
  await checkpointManager.dispose();
  await messageBus.dispose();

  console.log('✅ Demo completed!');
}

function getStrategyDescription(strategy: AggregationStrategy): string {
  const descriptions: Record<AggregationStrategy, string> = {
    sequential: 'Merge results in execution order',
    weighted: 'Combine results using configurable weights',
    voting: 'Select result based on majority consensus',
    best: 'Choose the highest quality result',
    merge: 'Intelligent merge with conflict resolution',
    hierarchical: 'Multi-level aggregation by task type',
  };
  return descriptions[strategy];
}

// 运行示例
main().catch(console.error);
