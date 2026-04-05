# Agent Orchestrator - 多Agent并行协调系统

## 概述

重构后的Agent系统实现了真正的多Agent并行协调，类似Claude Code的Agent编排能力。

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentOrchestrator                        │
│                  (协调器 - 中央调度)                         │
└──────────────┬──────────────────────────────────────────────┘
               │
       ┌───────┴───────┬───────────────┬───────────────┐
       ▼               ▼               ▼               ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Planning │   │  Agent   │   │ Result   │   │Checkpoint│
│  Agent   │   │   Pool   │   │Aggregator│   │ Manager  │
│(任务规划) │   │(Agent池) │   │(结果聚合) │   │(断点续传) │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Task Graph                               │
│              (任务依赖图管理)                                │
└─────────────────────────────────────────────────────────────┘
```

### 组件说明

1. **AgentOrchestrator** - 中央协调器
   - 接收用户任务
   - 创建执行计划
   - 调度Agent执行任务
   - 管理任务生命周期

2. **PlanningAgent** - 任务规划
   - 分析任务复杂度
   - 分解任务为子任务
   - 识别任务依赖
   - 优化执行顺序

3. **AgentPool** - Agent池
   - 管理Agent生命周期
   - 资源分配和回收
   - 负载均衡
   - 故障恢复

4. **TaskGraph** - 任务依赖图
   - 构建任务依赖关系
   - 计算并行执行组
   - 检测循环依赖
   - 拓扑排序

5. **ResultAggregator** - 结果聚合器
   - 支持多种聚合策略
   - 冲突检测和解决
   - 质量评估

6. **CheckpointManager** - 检查点管理
   - 创建执行检查点
   - 保存和恢复状态
   - 断点续传

7. **AgentMessageBus** - 消息总线
   - Agent间通信
   - 发布/订阅模式
   - 消息路由

## 核心特性

### 1. 任务分解与规划

```typescript
const orchestrator = createOrchestrator({
  maxConcurrentAgents: 5,
  aggregationStrategy: 'sequential',
});

const result = await orchestrator.execute(
  'Refactor authentication module',
  { context: 'Current auth uses session-based auth' }
);
```

### 2. 并行执行

```typescript
// PlanningAgent自动识别可并行执行的任务
const analysis = await planner.analyze('Implement distributed caching');
// 返回并行化机会：analysis.parallelizationOpportunities
```

### 3. 依赖管理

```typescript
// TaskGraph自动处理任务依赖
const graph = createTaskGraph();
graph.build(tasks);
const parallelGroups = graph.computeParallelGroups(tasks);
```

### 4. 多种聚合策略

```typescript
const strategies: AggregationStrategy[] = [
  'sequential',  // 顺序合并
  'weighted',    // 加权合并
  'voting',      // 投票决策
  'best',        // 选择最佳
  'merge',       // 智能合并
  'hierarchical', // 分层聚合
];
```

### 5. 断点续传

```typescript
// 自动创建checkpoint
if (config.enableCheckpoints) {
  await createCheckpoint(planId, context);
}

// 从checkpoint恢复
const checkpoint = await checkpointManager.findResumableCheckpoint(goal);
if (checkpoint) {
  return orchestrator.resumeFromCheckpoint(checkpoint);
}
```

### 6. Agent间通信

```typescript
// 订阅消息
const subscription = messageBus.subscribe(
  agentId,
  { types: ['share_result'], planId: 'plan-001' },
  (message) => console.log('Received:', message)
);

// 发送消息
await messageBus.send(from, to, 'share_result', { data: 'result' });

// 广播
await messageBus.broadcast(from, 'status_update', { progress: 50 });
```

## 使用示例

### 基础用法

```typescript
import { createOrchestrator } from './agent';

const orchestrator = createOrchestrator(
  {
    maxConcurrentAgents: 5,
    enableCheckpoints: true,
    retryAttempts: 3,
  },
  {
    onPlanCreated: (plan) => console.log('Plan created:', plan.goal),
    onTaskCompleted: (taskId, result) => console.log('Task done:', taskId),
  }
);

await orchestrator.initialize();

const result = await orchestrator.execute(
  'Implement JWT authentication with refresh tokens'
);

console.log('Success:', result.success);
console.log('Output:', result.output);
```

### 使用Planning Agent

```typescript
import { createPlanningAgent } from './agent';

const planner = createPlanningAgent({ model: 'gpt-4' });

const analysis = await planner.analyze(
  'Build a microservice architecture',
  { techStack: 'Node.js, Kubernetes, Redis' }
);

console.log('Complexity:', analysis.complexity);
console.log('Subtasks:', analysis.subtasks.length);
console.log('Risks:', analysis.riskFactors);
```

### 自定义聚合策略

```typescript
import { ResultAggregator } from './agent';

const aggregator = new ResultAggregator('weighted', {
  weights: new Map([
    ['task-1', 0.5],
    ['task-2', 0.3],
    ['task-3', 0.2],
  ]),
});

const result = await aggregator.aggregate(results, plan);
```

### 检查点管理

```typescript
import { createCheckpointManager, FileSystemCheckpointStorage } from './agent';

const checkpointManager = createCheckpointManager(
  new FileSystemCheckpointStorage('./checkpoints'),
  { maxCheckpoints: 50, retentionPeriod: 7 * 24 * 60 * 60 * 1000 }
);

// 创建检查点
const checkpoint = await checkpointManager.create(
  planId, goal, completedTasks, taskResults, sharedContext, results
);

// 列出检查点
const checkpoints = await checkpointManager.listCheckpoints();

// 恢复
const resumable = await checkpointManager.findResumableCheckpoint(goal);
```

## 事件监听

```typescript
const orchestrator = createOrchestrator(config, {
  onPlanCreated: (plan) => {
    console.log(`📋 Plan created: ${plan.goal}`);
  },
  onExecutionStarted: (planId) => {
    console.log(`🚀 Execution started: ${planId}`);
  },
  onTaskStarted: (taskId, agentId) => {
    console.log(`▶️ Task ${taskId} started by Agent ${agentId}`);
  },
  onTaskCompleted: (taskId, result) => {
    console.log(`✅ Task ${taskId} completed in ${result.executionTime}ms`);
  },
  onTaskFailed: (taskId, error) => {
    console.log(`❌ Task ${taskId} failed: ${error.message}`);
  },
  onCheckpointCreated: (checkpoint) => {
    console.log(`💾 Checkpoint created: ${checkpoint.id}`);
  },
  onExecutionCompleted: (planId, results) => {
    console.log(`🎉 Execution completed: ${results.length} results`);
  },
  onExecutionFailed: (planId, error) => {
    console.log(`💥 Execution failed: ${error.message}`);
  },
});
```

## 配置选项

### OrchestratorConfig

```typescript
interface OrchestratorConfig {
  maxConcurrentAgents: number;    // 最大并发Agent数
  defaultTimeout: number;         // 默认超时时间(ms)
  enableCheckpoints: boolean;     // 是否启用检查点
  checkpointInterval: number;     // 检查点创建间隔(ms)
  retryAttempts: number;          // 重试次数
  retryDelay: number;             // 重试延迟(ms)
  aggregationStrategy: AggregationStrategy; // 聚合策略
}
```

### AgentPoolConfig

```typescript
interface AgentPoolConfig {
  maxAgents: number;              // 最大Agent数
  minAgents: number;              // 最小Agent数
  defaultTimeout: number;         // 默认超时时间
  idleTimeout: number;            // 空闲超时时间
  scaleUpThreshold: number;       // 扩容阈值
  scaleDownThreshold: number;     // 缩容阈值
}
```

## 性能优化

1. **并行执行**: 自动识别可并行任务，最大化资源利用
2. **Agent池**: 复用Agent实例，减少创建开销
3. **增量检查点**: 只保存增量变化，减少IO开销
4. **智能路由**: 根据Agent能力匹配任务

## 故障处理

1. **任务重试**: 自动重试失败任务
2. **断点续传**: 从检查点恢复执行
3. **Agent故障转移**: Agent故障时重新调度任务
4. **超时处理**: 任务超时自动取消

## 路线图

- [ ] 实现真正的LLM集成
- [ ] 添加更多聚合策略
- [ ] 支持动态任务调整
- [ ] 添加可视化监控界面
- [ ] 实现分布式Agent池
- [ ] 添加更多通信模式
