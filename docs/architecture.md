# Claude Code 架构设计文档

## 1. 系统概述

Claude Code 是 Anthropic 开发的旗舰编码智能体系统，采用多Agent协调架构，支持持久化会话、工具调用、权限沙箱和上下文压缩等高级功能。

### 1.1 核心特性

- **多Agent协调**: 通过Coordinator模式管理多个Worker Agent
- **工具系统**: 40+工具支持文件操作、代码编辑、命令执行等
- **权限沙箱**: 细粒度的文件系统和命令执行权限控制
- **上下文压缩**: 长会话上下文自动压缩管理
- **Feature Flag**: 44个功能开关支持灰度发布
- **Kairos模式**: 持久化自主守护进程（未发布）
- **Buddy系统**: 虚拟宠物AI伴侣（未发布）

### 1.2 技术栈

- **运行时**: Bun/Node.js
- **UI框架**: React Ink（终端UI）
- **语言**: TypeScript (~51.2万行)
- **状态管理**: 自定义Signal系统
- **Feature Flags**: GrowthBook

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Claude Code 系统架构                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        用户交互层 (UI Layer)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Terminal UI │  │  Voice Input │  │  Buddy UI    │              │   │
│  │  │  (React Ink) │  │  (Voice Mode)│  │  (Virtual Pet)│              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      会话管理层 (Session Manager)                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │Session State │  │Context Store │  │Message Queue │              │   │
│  │  │   Manager    │  │              │  │   (Mailbox)  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    核心引擎层 (Core Engine)                          │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Query Engine                             │   │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │   │
│  │  │  │ LLM Client   │  │ Tool Router  │  │ Cost Tracker │      │   │   │
│  │  │  │(Capybara API)│  │              │  │              │      │   │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                  Coordinator Mode                           │   │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │   │
│  │  │  │   Master     │  │   Worker     │  │   Worker     │      │   │   │
│  │  │  │   Agent      │  │   Agent 1    │  │   Agent N    │      │   │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Kairos Mode (Daemon)                     │   │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │   │
│  │  │  │Task Queue    │  │Event System  │  │Memory        │      │   │   │
│  │  │  │              │  │              │  │Integrator    │      │   │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      工具系统层 (Tool System)                         │   │
│  │                                                                     │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ File Tools  │ │ Bash Tools  │ │  MCP Tools  │ │ Skill Tools │   │   │
│  │  │(Read/Edit)  │ │(Command)    │ │(External)   │ │(Domain)     │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ Agent Tool  │ │ REPL Tool   │ │ LSP Tool    │ │ Glob/Grep   │   │   │
│  │  │(Spawn)      │ │(Interactive)│ │(Code Intel) │ │(Search)     │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    权限与安全层 (Security Layer)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │Permission    │  │   Sandbox    │  │  Policy      │              │   │
│  │  │  Manager     │  │   (Bwrap)    │  │  Engine      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    基础设施层 (Infrastructure)                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │Feature Flags │  │   Context    │  │   Session    │              │   │
│  │  │ (GrowthBook) │  │  Compaction  │  │ Persistence  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Plugins    │  │   Skills     │  │   Memory     │              │   │
│  │  │   System     │  │   Registry   │  │   Store      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块架构

### 3.1 模块层次结构

```
src/
├── assistant/          # KAIROS模式 - 持久化自主守护进程
├── bootstrap/          # 应用启动和初始化
├── bridge/             # 跨进程通信桥接
├── buddy/              # AI伴侣UI (虚拟宠物系统)
├── cli/                # 命令行接口
├── commands/           # 斜杠命令实现
├── components/         # React Ink UI组件
├── constants/          # 常量定义
├── context/            # React Context Providers
├── coordinator/        # 多Agent协调核心
├── entrypoints/        # 应用入口点
├── hooks/              # React Hooks
├── ink/                # Ink UI扩展
├── jobs/               # 后台任务管理
├── keybindings/        # 键盘快捷键
├── memdir/             # 内存文件系统
├── migrations/         # 数据迁移
├── proactive/          # 主动建议系统
├── query/              # 查询引擎
├── remote/             # 远程管理
├── schemas/            # 数据验证Schema
├── screens/            # 屏幕组件
├── server/             # 本地服务器
├── services/           # 业务服务
│   ├── analytics/      # 分析和Feature Flags
│   ├── compact/        # 上下文压缩
│   ├── contextCollapse/# 上下文折叠
│   ├── mcp/            # MCP (Model Context Protocol)
│   └── ...
├── skills/             # 技能系统
├── state/              # 状态管理
├── tasks/              # 任务管理
├── tools/              # 工具实现
├── types/              # TypeScript类型
├── utils/              # 工具函数
└── voice/              # 语音交互
```

---

## 4. 多Agent协调机制 (Coordinator)

### 4.1 架构设计

Coordinator模式是Claude Code的核心创新，允许一个Master Agent协调多个Worker Agent并行工作。

```
┌─────────────────────────────────────────────────────────────────┐
│                     Coordinator Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Master Agent                          │   │
│  │  - 接收用户输入                                          │   │
│  │  - 分析任务并制定执行计划                                 │   │
│  │  - 协调Worker Agents                                     │   │
│  │  - 整合结果并返回给用户                                   │   │
│  │                                                          │   │
│  │  Tools:                                                  │   │
│  │  - AgentTool: 创建Worker                                │   │
│  │  - SendMessageTool: 与Worker通信                        │   │
│  │  - TaskStopTool: 停止Worker                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │ Worker Agent │   │ Worker Agent │   │ Worker Agent │       │
│  │     #1       │   │     #2       │   │     #N       │       │
│  ├──────────────┤   ├──────────────┤   ├──────────────┤       │
│  │独立上下文窗口 │   │独立上下文窗口 │   │独立上下文窗口 │       │
│  │受限工具权限   │   │受限工具权限   │   │受限工具权限   │       │
│  │隔离执行环境   │   │隔离执行环境   │   │隔离执行环境   │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Shared Resources                       │   │
│  │  - Scratchpad Directory (跨Worker知识共享)               │   │
│  │  - MCP Tools (外部工具访问)                              │   │
│  │  - Project Skills (项目特定技能)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 工作流程

1. **任务分析**: Master Agent分析用户请求，决定如何分解任务
2. **Worker创建**: 使用AgentTool创建专门的Worker Agent
3. **并行执行**: 多个Worker同时处理不同子任务
4. **结果收集**: Worker通过task-notification XML格式返回结果
5. **结果整合**: Master Agent整合所有Worker的结果
6. **响应生成**: 生成最终响应返回给用户

### 4.3 Worker工具权限

Worker Agent拥有受限的工具集：

```typescript
// 标准Worker工具集
const ASYNC_AGENT_ALLOWED_TOOLS = [
  'Bash',           // 命令执行
  'FileRead',       // 文件读取
  'FileEdit',       // 文件编辑
  'FileWrite',      // 文件写入
  'Glob',           // 文件匹配
  'Grep',           // 文本搜索
  'LSP',            // 语言服务器
  'Skill',          // 技能调用
  // MCP工具（动态添加）
];

// 简化模式工具集
const SIMPLE_MODE_TOOLS = ['Bash', 'FileRead', 'FileEdit'];
```

### 4.4 Scratchpad机制

Scratchpad是一个特殊的目录，Worker可以无权限提示地读写：

```
~/Library/Application Support/claude/scratchpad/
├── task-001/           # 任务1的工作区
│   ├── notes.md
│   ├── findings.json
│   └── plan.md
├── task-002/           # 任务2的工作区
└── shared/             # 跨任务共享知识
    ├── project-context.md
    └── conventions.md
```

---

## 5. 工具系统架构

### 5.1 工具分类

Claude Code实现了40+工具，分为以下几类：

| 类别 | 工具 | 描述 |
|------|------|------|
| **文件操作** | FileRead, FileEdit, FileWrite, Glob, Grep | 文件系统操作 |
| **命令执行** | Bash, PowerShell | 系统命令执行 |
| **代码智能** | LSP, NotebookEdit | 代码分析和编辑 |
| **Agent管理** | Agent, SendMessage, TaskStop | 多Agent协调 |
| **交互** | AskUserQuestion, REPL | 用户交互 |
| **配置** | Config, Enter/ExitPlanMode | 模式切换 |
| **MCP** | MCPTool, McpAuth | 外部工具集成 |
| **技能** | DiscoverSkills, Skill | 领域知识 |
| **监控** | Monitor, Brief | 系统监控 |
| **其他** | TeamCreate, TeamDelete, ScheduleCron | 团队功能 |

### 5.2 工具接口设计

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable, TypeVar, Generic
from enum import Enum, auto
import json


class ToolPermission(Enum):
    """工具权限级别"""
    READONLY = auto()      # 只读权限
    WRITE = auto()         # 读写权限
    EXECUTE = auto()       # 执行权限
    ADMIN = auto()         # 管理权限


class ToolCategory(Enum):
    """工具类别"""
    FILE = "file"
    SHELL = "shell"
    AGENT = "agent"
    MCP = "mcp"
    SKILL = "skill"
    INTERACTIVE = "interactive"
    SYSTEM = "system"


@dataclass
class ToolParameter:
    """工具参数定义"""
    name: str
    type: str
    description: str
    required: bool = True
    default: Any = None
    enum: Optional[List[str]] = None


@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    data: Any
    error: Optional[str] = None
    metadata: Dict[str, Any] = None


@dataclass
class ToolContext:
    """工具执行上下文"""
    session_id: str
    agent_id: str
    working_directory: str
    permissions: List[ToolPermission]
    scratchpad_dir: Optional[str] = None
    mcp_clients: List[Dict[str, Any]] = None


class BaseTool(ABC):
    """工具基类"""
    
    def __init__(self):
        self.name = self.__class__.__name__
        self.category = ToolCategory.SYSTEM
        self.permissions = [ToolPermission.READONLY]
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述"""
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> List[ToolParameter]:
        """工具参数定义"""
        pass
    
    @abstractmethod
    async def execute(self, params: Dict[str, Any], context: ToolContext) -> ToolResult:
        """执行工具"""
        pass
    
    def get_schema(self) -> Dict[str, Any]:
        """获取工具Schema（用于LLM）"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    p.name: {
                        "type": p.type,
                        "description": p.description,
                        **({"enum": p.enum} if p.enum else {})
                    }
                    for p in self.parameters
                },
                "required": [p.name for p in self.parameters if p.required]
            }
        }


class ToolRegistry:
    """工具注册中心"""
    
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._middlewares: List[Callable] = []
    
    def register(self, tool: BaseTool) -> None:
        """注册工具"""
        self._tools[tool.name] = tool
    
    def get(self, name: str) -> Optional[BaseTool]:
        """获取工具"""
        return self._tools.get(name)
    
    def list_tools(self, category: Optional[ToolCategory] = None) -> List[BaseTool]:
        """列出工具"""
        tools = list(self._tools.values())
        if category:
            tools = [t for t in tools if t.category == category]
        return tools
    
    def get_schemas(self) -> List[Dict[str, Any]]:
        """获取所有工具Schema"""
        return [tool.get_schema() for tool in self._tools.values()]


class ToolRouter:
    """工具路由器 - 执行工具调用"""
    
    def __init__(self, registry: ToolRegistry, permission_manager: 'PermissionManager'):
        self.registry = registry
        self.permission_manager = permission_manager
        self.cost_tracker = CostTracker()
    
    async def route(self, tool_call: Dict[str, Any], context: ToolContext) -> ToolResult:
        """路由工具调用"""
        tool_name = tool_call.get("name")
        params = tool_call.get("parameters", {})
        
        # 查找工具
        tool = self.registry.get(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                data=None,
                error=f"Tool '{tool_name}' not found"
            )
        
        # 权限检查
        if not self.permission_manager.check_permissions(tool, context):
            return ToolResult(
                success=False,
                data=None,
                error=f"Permission denied for tool '{tool_name}'"
            )
        
        # 执行工具
        try:
            result = await tool.execute(params, context)
            self.cost_tracker.track_tool_use(tool_name)
            return result
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e)
            )
```

---

## 6. 会话管理系统

### 6.1 会话状态模型

```python
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum
import uuid


class SessionMode(Enum):
    """会话模式"""
    NORMAL = "normal"
    COORDINATOR = "coordinator"
    PLAN = "plan"
    KAIROS = "kairos"


class MessageRole(Enum):
    """消息角色"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"
    NOTIFICATION = "notification"


@dataclass
class Message:
    """消息"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    role: MessageRole = MessageRole.USER
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    tool_calls: Optional[List[Dict]] = None
    tool_results: Optional[List[Dict]] = None


@dataclass
class AgentState:
    """Agent状态"""
    agent_id: str
    parent_id: Optional[str] = None
    mode: SessionMode = SessionMode.NORMAL
    context_window: List[Message] = field(default_factory=list)
    tool_permissions: List[str] = field(default_factory=list)
    status: str = "idle"  # idle, running, completed, failed
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Session:
    """会话"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    mode: SessionMode = SessionMode.NORMAL
    messages: List[Message] = field(default_factory=list)
    agents: Dict[str, AgentState] = field(default_factory=dict)
    master_agent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    # Context compaction
    is_compacted: bool = False
    compaction_summary: Optional[str] = None
    original_message_count: int = 0
    
    def add_message(self, message: Message) -> None:
        """添加消息"""
        self.messages.append(message)
        self.updated_at = datetime.now()
    
    def get_context_window(self, max_tokens: int = 200000) -> List[Message]:
        """获取上下文窗口（考虑token限制）"""
        # 简化实现：按消息数量截断
        # 实际实现应该使用token计数
        return self.messages[-50:]  # 最近50条消息
    
    def create_agent(self, mode: SessionMode = SessionMode.NORMAL) -> AgentState:
        """创建子Agent"""
        agent = AgentState(
            agent_id=str(uuid.uuid4()),
            parent_id=self.master_agent_id,
            mode=mode
        )
        self.agents[agent.agent_id] = agent
        return agent


class SessionManager:
    """会话管理器"""
    
    def __init__(self, persistence: 'SessionPersistence'):
        self.persistence = persistence
        self._sessions: Dict[str, Session] = {}
    
    def create_session(self, mode: SessionMode = SessionMode.NORMAL) -> Session:
        """创建会话"""
        session = Session(mode=mode)
        self._sessions[session.id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self._sessions.get(session_id)
    
    async def save_session(self, session: Session) -> None:
        """保存会话"""
        await self.persistence.save(session)
    
    async def load_session(self, session_id: str) -> Optional[Session]:
        """加载会话"""
        if session_id in self._sessions:
            return self._sessions[session_id]
        session = await self.persistence.load(session_id)
        if session:
            self._sessions[session_id] = session
        return session
    
    def list_sessions(self) -> List[Session]:
        """列出所有会话"""
        return list(self._sessions.values())
```

---

## 7. 权限沙箱设计

### 7.1 权限模型

```python
from dataclasses import dataclass
from typing import List, Set, Optional, Callable
from enum import Enum, auto
from pathlib import Path
import fnmatch


class PermissionLevel(Enum):
    """权限级别"""
    NONE = 0
    READ = 1
    WRITE = 2
    EXECUTE = 3
    ADMIN = 4


class PermissionType(Enum):
    """权限类型"""
    FILE_READ = auto()
    FILE_WRITE = auto()
    FILE_DELETE = auto()
    DIR_READ = auto()
    DIR_WRITE = auto()
    COMMAND_EXEC = auto()
    NETWORK_ACCESS = auto()
    ENV_ACCESS = auto()
    TOOL_USE = auto()


@dataclass
class FilePermission:
    """文件权限规则"""
    pattern: str           # glob模式
    level: PermissionLevel
    recursive: bool = True


@dataclass
class CommandPermission:
    """命令权限规则"""
    command: str           # 命令名或通配符
    args_pattern: Optional[str] = None
    level: PermissionLevel = PermissionLevel.EXECUTE


@dataclass
class PermissionSet:
    """权限集合"""
    name: str
    file_permissions: List[FilePermission] = None
    command_permissions: List[CommandPermission] = None
    allowed_tools: Set[str] = None
    denied_tools: Set[str] = None
    
    def __post_init__(self):
        if self.file_permissions is None:
            self.file_permissions = []
        if self.command_permissions is None:
            self.command_permissions = []
        if self.allowed_tools is None:
            self.allowed_tools = set()
        if self.denied_tools is None:
            self.denied_tools = set()


class PermissionManager:
    """权限管理器"""
    
    # 预定义权限集
    PRESETS = {
        "worker": PermissionSet(
            name="worker",
            file_permissions=[
                FilePermission("*", PermissionLevel.READ),
                FilePattern("~/Library/Application Support/claude/scratchpad/**", PermissionLevel.WRITE),
            ],
            command_permissions=[
                CommandPermission("*", level=PermissionLevel.EXECUTE),
            ],
            allowed_tools={
                "Bash", "FileRead", "FileEdit", "FileWrite",
                "Glob", "Grep", "LSP", "Skill"
            }
        ),
        "readonly": PermissionSet(
            name="readonly",
            file_permissions=[
                FilePermission("*", PermissionLevel.READ),
            ],
            command_permissions=[],
            allowed_tools={"FileRead", "Glob", "Grep"}
        ),
        "untrusted": PermissionSet(
            name="untrusted",
            file_permissions=[
                FilePermission("*", PermissionLevel.READ),
            ],
            command_permissions=[
                CommandPermission("ls"),
                CommandPermission("cat"),
                CommandPermission("grep"),
            ],
            allowed_tools={"FileRead", "Glob", "Grep"}
        ),
    }
    
    def __init__(self):
        self._custom_presets: Dict[str, PermissionSet] = {}
        self._hooks: List[Callable] = []
    
    def get_preset(self, name: str) -> Optional[PermissionSet]:
        """获取预设权限集"""
        return self.PRESETS.get(name) or self._custom_presets.get(name)
    
    def check_file_access(self, path: str, level: PermissionLevel, 
                          permission_set: PermissionSet) -> bool:
        """检查文件访问权限"""
        for perm in permission_set.file_permissions:
            if fnmatch.fnmatch(path, perm.pattern):
                return perm.level.value >= level.value
        return False
    
    def check_command_exec(self, command: str, 
                           permission_set: PermissionSet) -> bool:
        """检查命令执行权限"""
        for perm in permission_set.command_permissions:
            if fnmatch.fnmatch(command, perm.command):
                return perm.level.value >= PermissionLevel.EXECUTE.value
        return False
    
    def check_tool_use(self, tool_name: str, 
                       permission_set: PermissionSet) -> bool:
        """检查工具使用权限"""
        if tool_name in permission_set.denied_tools:
            return False
        if permission_set.allowed_tools:
            return tool_name in permission_set.allowed_tools
        return True
    
    def request_permission(self, action: str, resource: str) -> bool:
        """请求用户授权"""
        # 在实际实现中，这会触发UI提示
        # 返回用户是否授权
        pass


class Sandbox:
    """沙箱执行环境"""
    
    def __init__(self, permission_set: PermissionSet):
        self.permission_set = permission_set
        self.bwrap_enabled = True  # bubblewrap
        self.working_directory = Path.cwd()
    
    def create_file_context(self, path: str) -> 'FileContext':
        """创建文件操作上下文"""
        return FileContext(path, self.permission_set, self)
    
    def create_command_context(self, command: str) -> 'CommandContext':
        """创建命令执行上下文"""
        return CommandContext(command, self.permission_set, self)
    
    def get_bwrap_args(self) -> List[str]:
        """获取bubblewrap参数"""
        args = ["bwrap"]
        
        # 绑定工作目录
        args.extend(["--bind", str(self.working_directory), str(self.working_directory)])
        
        # 只读绑定系统目录
        args.extend(["--ro-bind", "/usr", "/usr"])
        args.extend(["--ro-bind", "/bin", "/bin"])
        args.extend(["--ro-bind", "/lib", "/lib"])
        
        # 临时目录
        args.extend(["--tmpfs", "/tmp"])
        
        # 禁止网络（根据需要开启）
        args.append("--unshare-net")
        
        return args


class FileContext:
    """文件操作上下文"""
    
    def __init__(self, path: str, permission_set: PermissionSet, sandbox: Sandbox):
        self.path = Path(path)
        self.permission_set = permission_set
        self.sandbox = sandbox
    
    def can_read(self) -> bool:
        """是否可以读取"""
        return self.sandbox.permission_manager.check_file_access(
            str(self.path), PermissionLevel.READ, self.permission_set
        )
    
    def can_write(self) -> bool:
        """是否可以写入"""
        return self.sandbox.permission_manager.check_file_access(
            str(self.path), PermissionLevel.WRITE, self.permission_set
        )


class CommandContext:
    """命令执行上下文"""
    
    def __init__(self, command: str, permission_set: PermissionSet, sandbox: Sandbox):
        self.command = command
        self.permission_set = permission_set
        self.sandbox = sandbox
    
    def can_execute(self) -> bool:
        """是否可以执行"""
        return self.sandbox.permission_manager.check_command_exec(
            self.command, self.permission_set
        )
```

---

## 8. Context Compaction机制

### 8.1 压缩策略

```python
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum
import json


class CompactionStrategy(Enum):
    """压缩策略"""
    SUMMARIZE = "summarize"      # LLM总结
    TRUNCATE = "truncate"        # 简单截断
    ARCHIVE = "archive"          # 归档存储
    SMART = "smart"              # 智能选择


@dataclass
class CompactionResult:
    """压缩结果"""
    original_tokens: int
    compacted_tokens: int
    summary: str
    archived_messages: List[Dict]
    strategy_used: CompactionStrategy


class ContextCompactor:
    """上下文压缩器"""
    
    def __init__(self, llm_client: 'LLMClient'):
        self.llm_client = llm_client
        self.token_limit = 200000  # 200k上下文窗口
        self.warning_threshold = 180000
        self.compaction_threshold = 190000
    
    async def check_and_compact(self, session: 'Session') -> Optional[CompactionResult]:
        """检查并压缩上下文"""
        token_count = self._estimate_tokens(session.messages)
        
        if token_count < self.warning_threshold:
            return None
        
        if token_count >= self.compaction_threshold:
            return await self.compact(session, CompactionStrategy.SMART)
        
        # 发送警告
        return None
    
    async def compact(self, session: 'Session', 
                      strategy: CompactionStrategy) -> CompactionResult:
        """压缩上下文"""
        original_tokens = self._estimate_tokens(session.messages)
        
        if strategy == CompactionStrategy.SUMMARIZE:
            result = await self._summarize_compaction(session)
        elif strategy == CompactionStrategy.TRUNCATE:
            result = self._truncate_compaction(session)
        elif strategy == CompactionStrategy.ARCHIVE:
            result = await self._archive_compaction(session)
        else:  # SMART
            result = await self._smart_compaction(session)
        
        # 更新会话状态
        session.is_compacted = True
        session.compaction_summary = result.summary
        session.original_message_count = len(session.messages)
        
        return result
    
    async def _summarize_compaction(self, session: 'Session') -> CompactionResult:
        """总结压缩 - 使用LLM生成摘要"""
        messages_to_compact = session.messages[:-10]  # 保留最近10条
        
        # 构建总结提示
        prompt = self._build_summary_prompt(messages_to_compact)
        
        # 调用LLM生成摘要
        summary = await self.llm_client.complete(prompt)
        
        # 创建摘要消息
        summary_message = Message(
            role=MessageRole.SYSTEM,
            content=f"[Context Summary]\n{summary}",
            metadata={"is_compaction_summary": True}
        )
        
        # 替换消息
        archived = [m.to_dict() for m in messages_to_compact]
        session.messages = [summary_message] + session.messages[-10:]
        
        return CompactionResult(
            original_tokens=self._estimate_tokens(messages_to_compact),
            compacted_tokens=self._estimate_tokens([summary_message]),
            summary=summary,
            archived_messages=archived,
            strategy_used=CompactionStrategy.SUMMARIZE
        )
    
    def _truncate_compaction(self, session: 'Session') -> CompactionResult:
        """截断压缩 - 简单删除旧消息"""
        messages_to_archive = session.messages[:-50]
        archived = [m.to_dict() for m in messages_to_archive]
        
        truncation_notice = Message(
            role=MessageRole.SYSTEM,
            content=f"[Earlier conversation truncated. {len(messages_to_archive)} messages removed.]",
            metadata={"is_truncation_notice": True}
        )
        
        session.messages = [truncation_notice] + session.messages[-50:]
        
        return CompactionResult(
            original_tokens=self._estimate_tokens(messages_to_archive),
            compacted_tokens=self._estimate_tokens([truncation_notice]),
            summary=f"Truncated {len(messages_to_archive)} messages",
            archived_messages=archived,
            strategy_used=CompactionStrategy.TRUNCATE
        )
    
    async def _archive_compaction(self, session: 'Session') -> CompactionResult:
        """归档压缩 - 将旧消息存储到外部存储"""
        messages_to_archive = session.messages[:-20]
        archived = [m.to_dict() for m in messages_to_archive]
        
        # 存储到外部存储
        archive_id = await self._store_archive(session.id, archived)
        
        archive_notice = Message(
            role=MessageRole.SYSTEM,
            content=f"[Earlier conversation archived. Archive ID: {archive_id}]",
            metadata={"archive_id": archive_id}
        )
        
        session.messages = [archive_notice] + session.messages[-20:]
        
        return CompactionResult(
            original_tokens=self._estimate_tokens(messages_to_archive),
            compacted_tokens=self._estimate_tokens([archive_notice]),
            summary=f"Archived to {archive_id}",
            archived_messages=archived,
            strategy_used=CompactionStrategy.ARCHIVE
        )
    
    async def _smart_compaction(self, session: 'Session') -> CompactionResult:
        """智能压缩 - 根据消息重要性选择策略"""
        # 分析消息重要性
        important_messages = []
        routine_messages = []
        
        for msg in session.messages[:-10]:
            if self._is_important_message(msg):
                important_messages.append(msg)
            else:
                routine_messages.append(msg)
        
        # 对例行消息使用总结
        if routine_messages:
            routine_summary = await self._summarize_messages(routine_messages)
        else:
            routine_summary = ""
        
        # 构建压缩后的消息列表
        compacted = []
        if routine_summary:
            compacted.append(Message(
                role=MessageRole.SYSTEM,
                content=f"[Routine tasks summary]\n{routine_summary}"
            ))
        compacted.extend(important_messages)
        compacted.extend(session.messages[-10:])
        
        session.messages = compacted
        
        return CompactionResult(
            original_tokens=self._estimate_tokens(session.messages),
            compacted_tokens=self._estimate_tokens(compacted),
            summary=routine_summary,
            archived_messages=[m.to_dict() for m in routine_messages],
            strategy_used=CompactionStrategy.SMART
        )
    
    def _estimate_tokens(self, messages: List['Message']) -> int:
        """估算token数量（简化实现）"""
        # 实际实现应该使用tiktoken或类似库
        total_chars = sum(len(m.content) for m in messages)
        return total_chars // 4  # 粗略估算
    
    def _is_important_message(self, message: 'Message') -> bool:
        """判断消息是否重要"""
        # 基于启发式规则
        important_keywords = [
            "decision", "conclusion", "agreed", "final",
            "important", "critical", "key", "summary"
        ]
        content_lower = message.content.lower()
        return any(kw in content_lower for kw in important_keywords)
    
    def _build_summary_prompt(self, messages: List['Message']) -> str:
        """构建总结提示"""
        conversation = "\n".join([
            f"{m.role.value}: {m.content[:500]}"  # 截断长消息
            for m in messages
        ])
        
        return f"""Please summarize the following conversation concisely, 
retaining all important decisions, conclusions, and context:

{conversation}

Summary:"""
```

---

## 9. Feature Flag系统

### 9.1 GrowthBook集成

```python
from dataclasses import dataclass
from typing import Dict, Any, Optional, Callable
from enum import Enum
import asyncio
from growthbook import GrowthBook


class FeatureFlag(Enum):
    """Feature Flag定义（44个）"""
    # Coordinator模式
    COORDINATOR_MODE = "tengu_coordinator"
    
    # Kairos模式
    KAIROS_MODE = "tengu_kairos"
    KAIROS_BACKGROUND = "tengu_kairos_background"
    
    # Buddy系统
    BUDDY_SYSTEM = "tengu_buddy"
    BUDDY_SHINY = "tengu_buddy_shiny"
    
    # 语音
    VOICE_MODE = "tengu_voice"
    VOICE_STREAMING = "tengu_voice_streaming"
    
    # 上下文管理
    CONTEXT_COMPACTION = "tengu_context_compaction"
    SMART_COMPACTION = "tengu_smart_compaction"
    
    # 权限
    AUTO_APPROVE = "tengu_auto_approve"
    PERMISSION_SANDBOX = "tengu_permission_sandbox"
    
    # 工具
    MCP_TOOLS = "tengu_mcp"
    SKILL_SYSTEM = "tengu_skills"
    AGENT_TOOL = "tengu_agent_tool"
    
    # UI
    REACT_INK_V3 = "tengu_ink_v3"
    BUBBLE_UI = "tengu_bubble_ui"
    
    # 分析
    ANALYTICS_1P = "tengu_analytics_1p"
    ERROR_REPORTING = "tengu_error_reporting"
    
    # 其他
    SCRATCHPAD = "tengu_scratch"
    UNDERCOVER_MODE = "tengu_undercover"
    PLAN_MODE = "tengu_plan_mode"
    REMOTE_SESSIONS = "tengu_remote"
    

@dataclass
class UserAttributes:
    """用户属性（用于Feature Flag定位）"""
    id: str
    session_id: str
    device_id: str
    platform: str  # win32, darwin, linux
    api_base_url_host: Optional[str] = None
    organization_uuid: Optional[str] = None
    account_uuid: Optional[str] = None
    user_type: Optional[str] = None
    subscription_type: Optional[str] = None
    rate_limit_tier: Optional[str] = None
    first_token_time: Optional[int] = None
    email: Optional[str] = None
    app_version: Optional[str] = None


class FeatureFlagManager:
    """Feature Flag管理器"""
    
    def __init__(self, client_key: str, api_host: str = "https://cdn.growthbook.io"):
        self.client_key = client_key
        self.api_host = api_host
        self.gb: Optional[GrowthBook] = None
        self._cache: Dict[str, Any] = {}
        self._listeners: List[Callable] = []
        self._initialized = False
    
    async def initialize(self, user: UserAttributes) -> None:
        """初始化GrowthBook客户端"""
        self.gb = GrowthBook(
            api_host=self.api_host,
            client_key=self.client_key,
            attributes=user.__dict__
        )
        
        # 加载特性
        await self.gb.load_features()
        self._initialized = True
        
        # 启动后台刷新
        asyncio.create_task(self._refresh_loop())
    
    async def _refresh_loop(self, interval: int = 60) -> None:
        """后台刷新循环"""
        while True:
            await asyncio.sleep(interval)
            try:
                await self.gb.refresh_features()
                self._notify_listeners()
            except Exception as e:
                print(f"Failed to refresh features: {e}")
    
    def is_enabled(self, flag: FeatureFlag, default: bool = False) -> bool:
        """检查特性是否启用"""
        if not self._initialized or not self.gb:
            return default
        
        return self.gb.is_on(flag.value, default)
    
    def get_value(self, flag: FeatureFlag, default: Any = None) -> Any:
        """获取特性值"""
        if not self._initialized or not self.gb:
            return default
        
        return self.gb.get_feature_value(flag.value, default)
    
    def add_listener(self, callback: Callable) -> None:
        """添加变更监听器"""
        self._listeners.append(callback)
    
    def _notify_listeners(self) -> None:
        """通知监听器"""
        for listener in self._listeners:
            try:
                listener()
            except Exception as e:
                print(f"Listener error: {e}")
    
    def update_user(self, user: UserAttributes) -> None:
        """更新用户属性"""
        if self.gb:
            self.gb.set_attributes(user.__dict__)


class FeatureFlagDecorator:
    """Feature Flag装饰器"""
    
    def __init__(self, manager: FeatureFlagManager):
        self.manager = manager
    
    def require_flag(self, flag: FeatureFlag, default: bool = False):
        """要求特性启用的装饰器"""
        def decorator(func):
            def wrapper(*args, **kwargs):
                if not self.manager.is_enabled(flag, default):
                    raise FeatureDisabledError(f"Feature {flag.value} is disabled")
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def with_flag_value(self, flag: FeatureFlag, param_name: str):
        """将特性值作为参数注入的装饰器"""
        def decorator(func):
            def wrapper(*args, **kwargs):
                value = self.manager.get_value(flag)
                kwargs[param_name] = value
                return func(*args, **kwargs)
            return wrapper
        return decorator


class FeatureDisabledError(Exception):
    """特性禁用错误"""
    pass


# 使用示例
class CoordinatorMode:
    """Coordinator模式（受Feature Flag控制）"""
    
    def __init__(self, feature_manager: FeatureFlagManager):
        self.feature_manager = feature_manager
    
    def is_enabled(self) -> bool:
        """检查Coordinator模式是否启用"""
        # 检查Feature Flag
        if not self.feature_manager.is_enabled(FeatureFlag.COORDINATOR_MODE):
            return False
        
        # 检查环境变量
        return os.environ.get("CLAUDE_CODE_COORDINATOR_MODE") == "1"
    
    def enable(self) -> None:
        """启用Coordinator模式"""
        if not self.feature_manager.is_enabled(FeatureFlag.COORDINATOR_MODE):
            raise FeatureDisabledError("Coordinator mode not available")
        
        os.environ["CLAUDE_CODE_COORDINATOR_MODE"] = "1"
```

---

## 10. Kairos模式（持久化守护进程）

### 10.1 架构设计

```python
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum, auto
import asyncio
import uuid


class KairosMode(Enum):
    """Kairos运行模式"""
    DAEMON = "daemon"           # 后台守护进程
    INTERACTIVE = "interactive" # 交互模式
    HYBRID = "hybrid"           # 混合模式


class TaskStatus(Enum):
    """任务状态"""
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()


class TaskPriority(Enum):
    """任务优先级"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class Task:
    """任务"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    parent_id: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)


class TaskQueue:
    """任务队列"""
    
    def __init__(self):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._tasks: Dict[str, Task] = {}
        self._running: Dict[str, asyncio.Task] = {}
        self._listeners: List[Callable] = []
    
    async def submit(self, task: Task) -> str:
        """提交任务"""
        self._tasks[task.id] = task
        
        # 优先级队列：(优先级, 创建时间, 任务ID)
        await self._queue.put((
            task.priority.value,
            task.created_at.timestamp(),
            task.id
        ))
        
        self._notify_listeners("submitted", task)
        return task.id
    
    async def get_next(self) -> Optional[Task]:
        """获取下一个任务"""
        if self._queue.empty():
            return None
        
        _, _, task_id = await self._queue.get()
        return self._tasks.get(task_id)
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self._tasks.get(task_id)
    
    def update_status(self, task_id: str, status: TaskStatus, 
                      result: Any = None, error: str = None) -> None:
        """更新任务状态"""
        task = self._tasks.get(task_id)
        if task:
            task.status = status
            if status == TaskStatus.RUNNING:
                task.started_at = datetime.now()
            elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                task.completed_at = datetime.now()
            task.result = result
            task.error = error
            self._notify_listeners("updated", task)
    
    def _notify_listeners(self, event: str, task: Task) -> None:
        """通知监听器"""
        for listener in self._listeners:
            try:
                listener(event, task)
            except Exception as e:
                print(f"Listener error: {e}")


class EventType(Enum):
    """事件类型"""
    FILE_CHANGED = "file_changed"
    GIT_EVENT = "git_event"
    SCHEDULED = "scheduled"
    EXTERNAL = "external"
    USER = "user"


@dataclass
class Event:
    """事件"""
    type: EventType
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    source: Optional[str] = None


class EventSystem:
    """事件系统"""
    
    def __init__(self):
        self._handlers: Dict[EventType, List[Callable]] = {}
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
    
    def on(self, event_type: EventType, handler: Callable) -> None:
        """注册事件处理器"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    async def emit(self, event: Event) -> None:
        """发送事件"""
        await self._event_queue.put(event)
    
    async def start(self) -> None:
        """启动事件循环"""
        self._running = True
        while self._running:
            try:
                event = await asyncio.wait_for(
                    self._event_queue.get(), 
                    timeout=1.0
                )
                await self._process_event(event)
            except asyncio.TimeoutError:
                continue
    
    async def _process_event(self, event: Event) -> None:
        """处理事件"""
        handlers = self._handlers.get(event.type, [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception as e:
                print(f"Event handler error: {e}")
    
    def stop(self) -> None:
        """停止事件循环"""
        self._running = False


class MemoryIntegrator:
    """记忆整合器 - 跨会话记忆管理"""
    
    def __init__(self, memory_store: 'MemoryStore'):
        self.memory_store = memory_store
        self.consolidation_threshold = 10  # 需要整合的记忆数量阈值
    
    async def add_memory(self, session_id: str, memory: Dict[str, Any]) -> None:
        """添加记忆"""
        await self.memory_store.store(session_id, memory)
        
        # 检查是否需要整合
        memories = await self.memory_store.get_session_memories(session_id)
        if len(memories) >= self.consolidation_threshold:
            await self._consolidate_memories(session_id, memories)
    
    async def _consolidate_memories(self, session_id: str, 
                                     memories: List[Dict]) -> None:
        """整合记忆"""
        # 使用LLM总结和提炼记忆
        summary = await self._summarize_memories(memories)
        
        # 存储整合后的记忆
        await self.memory_store.store_consolidated(session_id, {
            "summary": summary,
            "original_count": len(memories),
            "consolidated_at": datetime.now().isoformat()
        })
        
        # 清理原始记忆
        await self.memory_store.clear_session_memories(session_id)
    
    async def _summarize_memories(self, memories: List[Dict]) -> str:
        """总结记忆"""
        # 实际实现会调用LLM
        pass


class StateManager:
    """状态管理器 - 持久化Kairos状态"""
    
    def __init__(self, persistence: 'StatePersistence'):
        self.persistence = persistence
        self._state: Dict[str, Any] = {}
    
    async def load(self) -> Dict[str, Any]:
        """加载状态"""
        self._state = await self.persistence.load()
        return self._state
    
    async def save(self) -> None:
        """保存状态"""
        await self.persistence.save(self._state)
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取状态值"""
        return self._state.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """设置状态值"""
        self._state[key] = value


class KairosDaemon:
    """Kairos守护进程"""
    
    def __init__(
        self,
        task_queue: TaskQueue,
        event_system: EventSystem,
        memory_integrator: MemoryIntegrator,
        state_manager: StateManager,
        llm_client: 'LLMClient'
    ):
        self.task_queue = task_queue
        self.event_system = event_system
        self.memory_integrator = memory_integrator
        self.state_manager = state_manager
        self.llm_client = llm_client
        
        self.mode = KairosMode.DAEMON
        self._running = False
        self._workers: List[asyncio.Task] = []
    
    async def start(self) -> None:
        """启动守护进程"""
        self._running = True
        
        # 加载状态
        await self.state_manager.load()
        
        # 启动事件系统
        self._workers.append(asyncio.create_task(self.event_system.start()))
        
        # 启动任务处理器
        self._workers.append(asyncio.create_task(self._task_processor()))
        
        # 注册事件处理器
        self._register_event_handlers()
        
        print("Kairos daemon started")
    
    async def stop(self) -> None:
        """停止守护进程"""
        self._running = False
        
        # 停止事件系统
        self.event_system.stop()
        
        # 取消所有worker
        for worker in self._workers:
            worker.cancel()
        
        # 保存状态
        await self.state_manager.save()
        
        print("Kairos daemon stopped")
    
    async def submit_task(self, description: str, 
                          priority: TaskPriority = TaskPriority.NORMAL) -> str:
        """提交任务"""
        task = Task(
            description=description,
            priority=priority
        )
        return await self.task_queue.submit(task)
    
    async def _task_processor(self) -> None:
        """任务处理器"""
        while self._running:
            task = await self.task_queue.get_next()
            if task:
                await self._execute_task(task)
            else:
                await asyncio.sleep(1)
    
    async def _execute_task(self, task: Task) -> None:
        """执行任务"""
        self.task_queue.update_status(task.id, TaskStatus.RUNNING)
        
        try:
            # 使用LLM规划和执行任务
            result = await self._plan_and_execute(task)
            self.task_queue.update_status(
                task.id, 
                TaskStatus.COMPLETED, 
                result=result
            )
        except Exception as e:
            self.task_queue.update_status(
                task.id,
                TaskStatus.FAILED,
                error=str(e)
            )
    
    async def _plan_and_execute(self, task: Task) -> Any:
        """规划和执行任务"""
        # 1. 分析任务
        # 2. 制定计划
        # 3. 执行步骤
        # 4. 返回结果
        pass
    
    def _register_event_handlers(self) -> None:
        """注册事件处理器"""
        self.event_system.on(EventType.FILE_CHANGED, self._on_file_changed)
        self.event_system.on(EventType.GIT_EVENT, self._on_git_event)
        self.event_system.on(EventType.SCHEDULED, self._on_scheduled)
    
    async def _on_file_changed(self, event: Event) -> None:
        """文件变更处理器"""
        # 检查是否需要触发任务
        pass
    
    async def _on_git_event(self, event: Event) -> None:
        """Git事件处理器"""
        pass
    
    async def _on_scheduled(self, event: Event) -> None:
        """定时任务处理器"""
        pass
```

---

## 11. Buddy系统（虚拟宠物）

### 11.1 架构设计

```python
from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime
import random


class BuddySpecies(Enum):
    """Buddy物种（18种）"""
    CAPYBARA = "capybara"
    CAT = "cat"
    DOG = "dog"
    FOX = "fox"
    OWL = "owl"
    PENGUIN = "penguin"
    RABBIT = "rabbit"
    RED_PANDA = "red_panda"
    OTTER = "otter"
    HEDGEHOG = "hedgehog"
    HAMSTER = "hamster"
    BIRD = "bird"
    TURTLE = "turtle"
    AXOLOTL = "axolotl"
    SQUIRREL = "squirrel"
    RACCOON = "raccoon"
    FROG = "frog"
    DRAGON = "dragon"  # 稀有


class Rarity(Enum):
    """稀有度"""
    COMMON = 1
    UNCOMMON = 2
    RARE = 3
    EPIC = 4
    LEGENDARY = 5


class AccessoryType(Enum):
    """配饰类型"""
    HAT = "hat"
    GLASSES = "glasses"
    SCARF = "scarf"
    BOW = "bow"
    COLLAR = "collar"


@dataclass
class Accessory:
    """配饰"""
    id: str
    name: str
    type: AccessoryType
    rarity: Rarity
    equipped: bool = False


@dataclass
class Buddy:
    """Buddy（虚拟宠物）"""
    id: str
    name: str
    species: BuddySpecies
    rarity: Rarity
    is_shiny: bool  # 闪光变体
    
    # 状态
    happiness: int = 50  # 0-100
    energy: int = 50     # 0-100
    hunger: int = 50     # 0-100 (0 = full, 100 = starving)
    
    # 成长
    level: int = 1
    experience: int = 0
    
    # 外观
    accessories: List[Accessory] = None
    color_variant: Optional[str] = None
    
    # 元数据
    created_at: datetime = None
    last_interaction: datetime = None
    
    def __post_init__(self):
        if self.accessories is None:
            self.accessories = []
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.last_interaction is None:
            self.last_interaction = datetime.now()
    
    def interact(self, interaction_type: str) -> str:
        """交互"""
        self.last_interaction = datetime.now()
        
        if interaction_type == "pet":
            self.happiness = min(100, self.happiness + 5)
            return f"{self.name} seems happy!"
        elif interaction_type == "feed":
            self.hunger = max(0, self.hunger - 20)
            self.happiness = min(100, self.happiness + 3)
            return f"{self.name} enjoys the food!"
        elif interaction_type == "play":
            if self.energy >= 10:
                self.energy -= 10
                self.happiness = min(100, self.happiness + 10)
                self.experience += 5
                return f"{self.name} had fun playing!"
            else:
                return f"{self.name} is too tired to play."
        
        return "Unknown interaction"
    
    def update(self) -> List[str]:
        """更新状态（随时间衰减）"""
        events = []
        
        # 随时间衰减
        time_passed = (datetime.now() - self.last_interaction).seconds
        
        if time_passed > 3600:  # 1小时
            self.hunger = min(100, self.hunger + 5)
            self.energy = min(100, self.energy + 10)
        
        # 检查状态
        if self.hunger > 80:
            events.append(f"{self.name} is very hungry!")
        if self.energy < 20:
            events.append(f"{self.name} is exhausted.")
        if self.happiness < 20:
            events.append(f"{self.name} seems sad.")
        
        return events
    
    def get_display_art(self) -> str:
        """获取ASCII艺术显示"""
        arts = {
            BuddySpecies.CAPYBARA: """
    ╭─────╮
   ╱       ╲
  │  ◕   ◕  │
  │    ▽    │
   ╲_______╱
            """,
            BuddySpecies.CAT: """
   ╱\_/╲
  ( o.o )
   > ^ <
  ╱|   |╲
            """,
        }
        return arts.get(self.species, "[buddy]")


class BuddySystem:
    """Buddy系统"""
    
    def __init__(self):
        self.buddies: Dict[str, Buddy] = {}
        self.inventory: List[Accessory] = []
    
    def generate_buddy(self, species: Optional[BuddySpecies] = None) -> Buddy:
        """生成Buddy"""
        if species is None:
            species = random.choice(list(BuddySpecies))
        
        # 确定稀有度
        rarity_roll = random.random()
        if rarity_roll < 0.01:
            rarity = Rarity.LEGENDARY
        elif rarity_roll < 0.05:
            rarity = Rarity.EPIC
        elif rarity_roll < 0.15:
            rarity = Rarity.RARE
        elif rarity_roll < 0.35:
            rarity = Rarity.UNCOMMON
        else:
            rarity = Rarity.COMMON
        
        # 闪光概率
        is_shiny = random.random() < 0.01
        
        buddy = Buddy(
            id=str(random.randint(10000, 99999)),
            name=f"Buddy-{species.value}",
            species=species,
            rarity=rarity,
            is_shiny=is_shiny
        )
        
        self.buddies[buddy.id] = buddy
        return buddy
    
    def get_buddy(self, buddy_id: str) -> Optional[Buddy]:
        """获取Buddy"""
        return self.buddies.get(buddy_id)
    
    def update_all(self) -> Dict[str, List[str]]:
        """更新所有Buddy"""
        events = {}
        for buddy_id, buddy in self.buddies.items():
            buddy_events = buddy.update()
            if buddy_events:
                events[buddy_id] = buddy_events
        return events


# Buddy UI组件（React Ink风格）
class BuddyUI:
    """Buddy UI渲染器"""
    
    def __init__(self, buddy_system: BuddySystem):
        self.buddy_system = buddy_system
    
    def render(self, buddy_id: str) -> str:
        """渲染Buddy UI"""
        buddy = self.buddy_system.get_buddy(buddy_id)
        if not buddy:
            return "Buddy not found"
        
        # 构建UI
        ui = []
        ui.append("╔" + "═" * 38 + "╗")
        ui.append(f"║ {buddy.name:^36} ║")
        ui.append("╠" + "═" * 38 + "╣")
        
        # 显示ASCII艺术
        art_lines = buddy.get_display_art().strip().split("\n")
        for line in art_lines:
            ui.append(f"║{line:^38}║")
        
        ui.append("╠" + "═" * 38 + "╣")
        
        # 状态条
        ui.append(f"║ Happiness: {self._render_bar(buddy.happiness)} ║")
        ui.append(f"║ Energy:    {self._render_bar(buddy.energy)} ║")
        ui.append(f"║ Hunger:    {self._render_bar(buddy.hunger)} ║")
        
        ui.append("╠" + "═" * 38 + "╣")
        ui.append(f"║ Level: {buddy.level} | XP: {buddy.experience}          ║")
        ui.append(f"║ Rarity: {buddy.rarity.name} {'✨ SHINY' if buddy.is_shiny else ''}      ║")
        ui.append("╚" + "═" * 38 + "╝")
        
        return "\n".join(ui)
    
    def _render_bar(self, value: int, width: int = 20) -> str:
        """渲染状态条"""
        filled = int(value / 100 * width)
        bar = "█" * filled + "░" * (width - filled)
        return f"{bar} {value}%"
```

---

## 12. 完整Python接口定义

### 12.1 核心类型定义

```python
# types.py
from typing import (
    TypedDict, Dict, List, Any, Optional, Union, 
    Callable, Awaitable, Protocol, runtime_checkable
)
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


# ============ 基础类型 ============

class JSON = Union[Dict[str, Any], List[Any], str, int, float, bool, None]

class TokenCount(TypedDict):
    input: int
    output: int
    total: int

class UsageStats(TypedDict):
    tokens: TokenCount
    tool_uses: int
    duration_ms: int


# ============ 消息类型 ============

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"

class ToolCall(TypedDict):
    id: str
    name: str
    parameters: Dict[str, Any]

class Message(TypedDict, total=False):
    id: str
    role: MessageRole
    content: str
    timestamp: datetime
    tool_calls: List[ToolCall]
    tool_results: List[Any]
    metadata: Dict[str, Any]


# ============ 工具类型 ============

class ToolParameterSchema(TypedDict):
    type: str
    description: str
    enum: Optional[List[str]]
    default: Optional[Any]

class ToolSchema(TypedDict):
    name: str
    description: str
    parameters: Dict[str, Any]

class ToolResult(TypedDict):
    success: bool
    data: Any
    error: Optional[str]


# ============ Agent类型 ============

class AgentConfig(TypedDict, total=False):
    model: str
    temperature: float
    max_tokens: int
    tools: List[str]
    system_prompt: str

class AgentState(TypedDict):
    id: str
    parent_id: Optional[str]
    status: str  # idle, running, completed, failed
    context_window: List[Message]
    created_at: datetime
    updated_at: datetime


# ============ 会话类型 ============

class SessionMode(str, Enum):
    NORMAL = "normal"
    COORDINATOR = "coordinator"
    PLAN = "plan"
    KAIROS = "kairos"

class SessionConfig(TypedDict, total=False):
    mode: SessionMode
    project_path: Optional[str]
    enable_mcp: bool
    auto_approve: bool


# ============ 协议定义 ============

@runtime_checkable
class LLMClient(Protocol):
    """LLM客户端协议"""
    
    async def complete(
        self, 
        messages: List[Message],
        tools: Optional[List[ToolSchema]] = None,
        **kwargs
    ) -> Message:
        ...
    
    async def stream(
        self,
        messages: List[Message],
        tools: Optional[List[ToolSchema]] = None,
        **kwargs
    ):
        ...

@runtime_checkable
class Tool(Protocol):
    """工具协议"""
    
    @property
    def name(self) -> str: ...
    
    @property
    def description(self) -> str: ...
    
    @property
    def schema(self) -> ToolSchema: ...
    
    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        ...

@runtime_checkable
class Persistence(Protocol):
    """持久化协议"""
    
    async def save(self, key: str, data: Any) -> None:
        ...
    
    async def load(self, key: str) -> Optional[Any]:
        ...
    
    async def delete(self, key: str) -> None:
        ...


# ============ 事件类型 ============

class EventType(str, Enum):
    MESSAGE_RECEIVED = "message_received"
    TOOL_CALLED = "tool_called"
    AGENT_CREATED = "agent_created"
    AGENT_COMPLETED = "agent_completed"
    SESSION_SAVED = "session_saved"
    CONTEXT_COMPACTED = "context_compacted"

EventHandler = Callable[[EventType, Dict[str, Any]], Awaitable[None]]
```

### 12.2 主应用接口

```python
# app.py
from typing import Optional, AsyncIterator
import asyncio


class ClaudeCodeApp:
    """Claude Code 主应用"""
    
    def __init__(
        self,
        llm_client: LLMClient,
        tool_registry: ToolRegistry,
        session_manager: SessionManager,
        permission_manager: PermissionManager,
        feature_manager: FeatureFlagManager,
        config: AppConfig
    ):
        self.llm_client = llm_client
        self.tool_registry = tool_registry
        self.session_manager = session_manager
        self.permission_manager = permission_manager
        self.feature_manager = feature_manager
        self.config = config
        
        self._current_session: Optional[Session] = None
        self._running = False
    
    async def start(self) -> None:
        """启动应用"""
        self._running = True
        
        # 初始化Feature Flags
        await self.feature_manager.initialize(self._get_user_attributes())
        
        # 创建或恢复会话
        if self.config.resume_last_session:
            self._current_session = await self.session_manager.load_last_session()
        
        if not self._current_session:
            self._current_session = self.session_manager.create_session(
                mode=self.config.default_mode
            )
        
        # 启动主循环
        await self._main_loop()
    
    async def stop(self) -> None:
        """停止应用"""
        self._running = False
        
        # 保存会话
        if self._current_session:
            await self.session_manager.save_session(self._current_session)
    
    async def process_input(self, user_input: str) -> AsyncIterator[str]:
        """处理用户输入"""
        # 添加用户消息
        message = Message(
            role=MessageRole.USER,
            content=user_input
        )
        self._current_session.add_message(message)
        
        # 检查上下文压缩
        await self._check_context_compaction()
        
        # 获取上下文窗口
        context = self._current_session.get_context_window()
        
        # 调用LLM
        tools = self._get_available_tools()
        
        async for chunk in self.llm_client.stream(context, tools):
            yield chunk
    
    async def execute_tool(self, tool_call: ToolCall) -> ToolResult:
        """执行工具调用"""
        tool = self.tool_registry.get(tool_call["name"])
        if not tool:
            return ToolResult(
                success=False,
                error=f"Tool '{tool_call['name']}' not found"
            )
        
        # 权限检查
        if not self.permission_manager.can_use_tool(
            tool, 
            self._current_session
        ):
            return ToolResult(
                success=False,
                error=f"Permission denied for tool '{tool_call['name']}'"
            )
        
        # 执行工具
        return await tool.execute(tool_call["parameters"])
    
    def _get_available_tools(self) -> List[ToolSchema]:
        """获取可用工具"""
        if self._current_session.mode == SessionMode.COORDINATOR:
            # Coordinator模式有额外工具
            return self.tool_registry.get_coordinator_tools()
        
        return self.tool_registry.get_schemas()
    
    async def _check_context_compaction(self) -> None:
        """检查上下文压缩"""
        if not self.feature_manager.is_enabled(
            FeatureFlag.CONTEXT_COMPACTION
        ):
            return
        
        compactor = ContextCompactor(self.llm_client)
        result = await compactor.check_and_compact(self._current_session)
        
        if result:
            print(f"Context compacted: {result.original_tokens} -> "
                  f"{result.compacted_tokens} tokens")
```

---

## 13. 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            数据流图 (Data Flow)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  用户输入                                                                    │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Input Parser                                │   │
│  │  - 解析斜杠命令 (/commit, /verify, etc.)                           │   │
│  │  - 检测模式切换请求                                                 │   │
│  │  - 提取用户意图                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Session Manager                               │   │
│  │  - 添加消息到会话历史                                               │   │
│  │  - 更新会话状态                                                     │   │
│  │  - 触发持久化                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Context Manager                                 │   │
│  │  - 构建上下文窗口                                                   │   │
│  │  - 应用Context Compaction                                          │   │
│  │  - 注入系统提示词                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Query Engine                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │  │ Tool Router │  │ LLM Client  │  │ Cost Tracker│                │   │
│  │  │             │◄─┤  (Capybara) │  │             │                │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘                │   │
│  │         │                                                          │   │
│  │         ▼                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Tool Execution Loop                       │  │   │
│  │  │  1. LLM生成工具调用                                          │  │   │
│  │  │  2. Tool Router分发到具体工具                                 │  │   │
│  │  │  3. 权限检查 (PermissionManager)                              │  │   │
│  │  │  4. 沙箱执行 (Sandbox)                                        │  │   │
│  │  │  5. 结果返回LLM                                              │  │   │
│  │  │  6. 重复直到完成                                             │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Output Formatter                              │   │
│  │  - 格式化响应                                                       │   │
│  │  - 添加语法高亮                                                     │   │
│  │  - 生成diff视图                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      UI Renderer (Ink)                             │   │
│  │  - 渲染终端UI                                                       │   │
│  │  - 处理用户交互                                                     │   │
│  │  - 更新状态显示                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  用户看到响应                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. 状态管理图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           状态管理 (State Management)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Global State (Signal-based)                     │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ SessionState │  │  UIState     │  │  ConfigState │              │   │
│  │  │              │  │              │  │              │              │   │
│  │  │ - sessionId  │  │ - isLoading  │  │ - theme      │              │   │
│  │  │ - messages[] │  │ - error      │  │ - keybindings│              │   │
│  │  │ - mode       │  │ - activeView │  │ - flags      │              │   │
│  │  │ - agents     │  │ - modalStack │  │ - mcpServers │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                      │   │
│  │  State Updates ──────► Subscribers ──────► UI Re-render           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Persistence                            │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Storage Layer                                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │  LocalStorage   │  │   SQLite DB     │  │   File System   │     │   │
│  │  │  (Browser)      │  │   (Sessions)    │  │   (Projects)    │     │   │
│  │  │                 │  │                 │  │                 │     │   │
│  │  │ - auth token    │  │ - session data  │  │ - project config│     │   │
│  │  │ - user prefs    │  │ - message hist  │  │ - skills        │     │   │
│  │  │ - feature flags │  │ - agent states  │  │ - scratchpad    │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. 总结

本文档详细描述了Claude Code的架构设计，包括：

1. **多Agent协调机制**: Coordinator模式允许Master Agent协调多个Worker Agent并行工作
2. **工具系统**: 40+工具支持各种操作，通过ToolRouter统一分发
3. **会话管理**: 支持多种会话模式，Context Compaction管理长会话
4. **权限沙箱**: 细粒度的权限控制，支持bubblewrap沙箱
5. **Feature Flag**: GrowthBook集成，44个功能开关
6. **Kairos模式**: 持久化守护进程，支持后台任务和事件驱动
7. **Buddy系统**: 虚拟宠物系统，18个物种，稀有度等级

所有接口均使用Python类型注解定义，便于理解和实现。

---

*文档版本: 1.0*
*生成日期: 2026年*
*基于: Claude Code v2.1.88 泄露代码分析*
