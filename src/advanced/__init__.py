"""
高级功能模块
包含上下文压缩、权限 UI、智能提交、会话持久化等高级功能
"""

import os
import re
import json
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path


# ==================== Context Compressor ====================

@dataclass
class CompressionResult:
    """压缩结果"""
    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    compressed_content: str
    method: str


class ContextCompressor:
    """上下文压缩器 - 三层压缩系统"""

    def __init__(self):
        self.compression_stats: List[CompressionResult] = []

    def micro_compact(self, content: str) -> CompressionResult:
        """
        MicroCompact - 轻量级压缩
        - 移除多余空白
        - 截断长代码块
        - 保留关键信息
        """
        original = len(content)

        # 移除多余空行
        content = re.sub(r'\n{3,}', '\n\n', content)

        # 压缩连续空格
        content = re.sub(r'[ \t]+', ' ', content)

        # 截断长代码块（保留前30行）
        lines = content.split('\n')
        in_code_block = False
        result_lines = []
        code_buffer = []

        for line in lines:
            if line.strip().startswith('```'):
                if in_code_block and len(code_buffer) > 30:
                    # 截断长代码块
                    result_lines.extend(code_buffer[:15])
                    result_lines.append('...')
                    result_lines.extend(code_buffer[-15:])
                else:
                    result_lines.extend(code_buffer)
                result_lines.append(line)
                code_buffer = []
                in_code_block = not in_code_block
            elif in_code_block:
                code_buffer.append(line)
            else:
                result_lines.append(line)

        compressed = '\n'.join(result_lines)
        compressed_len = len(compressed)

        return CompressionResult(
            original_tokens=original,
            compressed_tokens=compressed_len,
            compression_ratio=(original - compressed_len) / original if original > 0 else 0,
            compressed_content=compressed,
            method="micro"
        )

    def auto_compact(self, content: str, summary_fn=None) -> CompressionResult:
        """
        AutoCompact - 自动压缩
        - 摘要远距离消息
        - 压缩代码但保留结构
        - 维持关键决策点
        """
        original = len(content)

        # 分段处理
        sections = self._split_into_sections(content)
        compressed_sections = []

        for section in sections:
            if self._is_code_section(section):
                # 保留代码结构但压缩
                compressed_sections.append(self._compress_code_structure(section))
            elif len(section) > 500 and summary_fn:
                # 长文本摘要
                summary = summary_fn(section[:1000])  # 简化的摘要
                compressed_sections.append(f"[摘要] {section[:200]}...")
            else:
                compressed_sections.append(section)

        compressed = '\n\n'.join(compressed_sections)
        compressed_len = len(compressed)

        return CompressionResult(
            original_tokens=original,
            compressed_tokens=compressed_len,
            compression_ratio=(original - compressed_len) / original if original > 0 else 0,
            compressed_content=compressed,
            method="auto"
        )

    def full_compact(self, content: str, summary: str = "") -> CompressionResult:
        """
        FullCompact - 完整压缩
        - 全对话摘要
        - 只保留关键信息
        """
        original = len(content)

        if not summary:
            # 生成简单摘要
            summary = self._generate_summary(content)

        compressed = f"[完整摘要]\n{summary}\n\n[原始内容已压缩]"
        compressed_len = len(compressed)

        return CompressionResult(
            original_tokens=original,
            compressed_tokens=compressed_len,
            compression_ratio=(original - compressed_len) / original if original > 0 else 0,
            compressed_content=compressed,
            method="full"
        )

    def _split_into_sections(self, content: str) -> List[str]:
        """将内容分割成段落"""
        return [s.strip() for s in content.split('\n\n') if s.strip()]

    def _is_code_section(self, section: str) -> bool:
        """判断是否为代码段"""
        return section.startswith('```') or 'def ' in section[:50] or 'class ' in section[:50]

    def _compress_code_structure(self, code: str) -> str:
        """压缩代码但保留结构"""
        # 保留函数/类签名，压缩实现
        lines = code.split('\n')
        result = []
        skip_until_dedent = False
        base_indent = None

        for line in lines:
            if re.match(r'^(def|class)\s+', line.strip()):
                result.append(line)
                skip_until_dedent = True
                base_indent = len(line) - len(line.lstrip())
            elif skip_until_dedent:
                current_indent = len(line) - len(line.lstrip())
                if line.strip() and current_indent <= base_indent:
                    skip_until_dedent = False
                    result.append(line)
                elif not line.strip():
                    result.append(line)
            else:
                result.append(line)

        return '\n'.join(result)

    def _generate_summary(self, content: str) -> str:
        """生成内容摘要"""
        # 提取关键点
        key_points = []

        # 提取决策点
        decisions = re.findall(r'(决定|decided?|选择|chose?)[：:]\s*(.+?)(?=\n|$)', content, re.IGNORECASE)
        for _, decision in decisions:
            key_points.append(f"- 决策: {decision.strip()}")

        # 提取行动项
        actions = re.findall(r'(TODO|FIXME|行动|action)[：:]\s*(.+?)(?=\n|$)', content, re.IGNORECASE)
        for _, action in actions:
            key_points.append(f"- 行动: {action.strip()}")

        return '\n'.join(key_points) if key_points else "关键对话内容已摘要"


# ==================== Permission UI ====================

@dataclass
class PermissionRequest:
    """权限请求"""
    tool_name: str
    action: str
    target: str
    reason: str
    risk_level: str  # low, medium, high


class PermissionUI:
    """权限确认 UI"""

    RISK_COLORS = {
        'low': 'green',
        'medium': 'yellow',
        'high': 'red'
    }

    def __init__(self, auto_approve: List[str] = None, auto_deny: List[str] = None):
        self.auto_approve = auto_approve or []
        self.auto_deny = auto_deny or []
        self.history: List[Dict] = []

    def request_permission(self, request: PermissionRequest) -> bool:
        """
        请求权限

        Args:
            request: 权限请求

        Returns:
            bool: 是否批准
        """
        # 自动批准列表
        if request.tool_name in self.auto_approve:
            self._log_decision(request, True, 'auto')
            return True

        # 自动拒绝列表
        if request.tool_name in self.auto_deny:
            self._log_decision(request, False, 'auto')
            return False

        # 显示权限请求
        self._display_request(request)

        # 获取用户输入
        response = input("允许? (y/n/a/d/h): ").strip().lower()

        if response in ('y', 'yes'):
            self._log_decision(request, True, 'manual')
            return True
        elif response == 'a':  # 总是允许
            self.auto_approve.append(request.tool_name)
            self._log_decision(request, True, 'always')
            return True
        elif response == 'd':  # 总是拒绝
            self.auto_deny.append(request.tool_name)
            self._log_decision(request, False, 'never')
            return False
        elif response == 'h':  # 帮助
            self._show_help()
            return self.request_permission(request)
        else:
            self._log_decision(request, False, 'manual')
            return False

    def _display_request(self, request: PermissionRequest):
        """显示权限请求"""
        color = self.RISK_COLORS.get(request.risk_level, 'white')

        print(f"\n{'─' * 60}")
        print(f"🔒 权限请求")
        print(f"{'─' * 60}")
        print(f"工具: {request.tool_name}")
        print(f"操作: {request.action}")
        print(f"目标: {request.target}")
        print(f"风险: [{color}]{request.risk_level.upper()}[/]")
        print(f"原因: {request.reason}")
        print(f"{'─' * 60}")
        print("y - 允许 | n - 拒绝 | a - 总是允许 | d - 总是拒绝 | h - 帮助")

    def _log_decision(self, request: PermissionRequest, approved: bool, method: str):
        """记录决策"""
        self.history.append({
            'timestamp': datetime.now().isoformat(),
            'tool': request.tool_name,
            'action': request.action,
            'target': request.target,
            'approved': approved,
            'method': method
        })

    def _show_help(self):
        """显示帮助"""
        print("""
帮助:
  y / yes  - 允许本次操作
  n / no   - 拒绝本次操作
  a        - 总是允许此工具的操作
  d        - 总是拒绝此工具的操作
  h        - 显示此帮助
        """)

    def get_stats(self) -> Dict:
        """获取权限统计"""
        total = len(self.history)
        approved = sum(1 for h in self.history if h['approved'])
        return {
            'total_requests': total,
            'approved': approved,
            'denied': total - approved,
            'auto_approved': len(self.auto_approve),
            'auto_denied': len(self.auto_deny)
        }


# ==================== Smart Commit ====================

class SmartCommit:
    """智能提交消息生成器"""

    # Conventional Commit 类型
    COMMIT_TYPES = {
        'feat': '新功能',
        'fix': '修复',
        'docs': '文档',
        'style': '格式',
        'refactor': '重构',
        'perf': '性能',
        'test': '测试',
        'chore': '构建/工具',
        'ci': 'CI/CD',
        'build': '构建',
        'revert': '回滚'
    }

    def __init__(self):
        self.emoji_map = {
            'feat': '✨',
            'fix': '🐛',
            'docs': '📚',
            'style': '🎨',
            'refactor': '♻️',
            'perf': '⚡',
            'test': '✅',
            'chore': '🔧',
            'ci': '🚀',
            'build': '📦',
            'revert': '⏪'
        }

    def generate(
        self,
        diff: str,
        files_changed: List[str],
        custom_message: str = ""
    ) -> str:
        """
        生成智能提交消息

        Args:
            diff: 代码差异
            files_changed: 变更的文件列表
            custom_message: 自定义消息

        Returns:
            str: 生成的提交消息
        """
        # 分析变更类型
        commit_type = self._analyze_type(diff, files_changed)

        # 分析范围
        scope = self._analyze_scope(files_changed)

        # 生成描述
        if custom_message:
            description = custom_message
        else:
            description = self._generate_description(diff, files_changed, commit_type)

        # 组合提交消息
        emoji = self.emoji_map.get(commit_type, '')

        if scope:
            message = f"{commit_type}({scope}): {description}"
        else:
            message = f"{commit_type}: {description}"

        if emoji:
            message = f"{emoji} {message}"

        return message

    def _analyze_type(self, diff: str, files: List[str]) -> str:
        """分析提交类型"""
        diff_lower = diff.lower()

        # 测试相关
        if any('test' in f.lower() or 'spec' in f.lower() for f in files):
            return 'test'

        # 文档相关
        if any(f.endswith(('.md', '.rst', '.txt')) for f in files):
            return 'docs'

        # 修复相关
        if any(kw in diff_lower for kw in ['fix', 'bug', '修复', '解决']):
            return 'fix'

        # 性能相关
        if any(kw in diff_lower for kw in ['perf', 'performance', '优化', '加速']):
            return 'perf'

        # 重构相关
        if any(kw in diff_lower for kw in ['refactor', '重构', '重写']):
            return 'refactor'

        # 配置/工具相关
        if any(f.endswith(('.json', '.yaml', '.yml', '.toml')) for f in files):
            return 'chore'

        # 默认新功能
        return 'feat'

    def _analyze_scope(self, files: List[str]) -> str:
        """分析变更范围"""
        if not files:
            return ""

        # 提取共同目录
        dirs = [os.path.dirname(f).split('/')[0] for f in files if os.path.dirname(f)]
        if dirs and len(set(dirs)) == 1:
            return dirs[0]

        # 根据文件类型
        if all(f.endswith('.py') for f in files):
            return "core"
        if all(f.endswith(('.js', '.ts', '.tsx')) for f in files):
            return "ui"

        return ""

    def _generate_description(self, diff: str, files: List[str], commit_type: str) -> str:
        """生成描述"""
        # 基于变更的文件名
        if len(files) == 1:
            filename = os.path.basename(files[0])
            name_without_ext = os.path.splitext(filename)[0]

            if commit_type == 'feat':
                return f"add {name_without_ext} functionality"
            elif commit_type == 'fix':
                return f"fix {name_without_ext} issue"
            elif commit_type == 'docs':
                return f"update {name_without_ext} documentation"

        # 基于统计
        added = diff.count('\n+')
        removed = diff.count('\n-')

        if commit_type == 'feat':
            return f"add new feature with {len(files)} files changed"
        elif commit_type == 'fix':
            return f"fix bugs and improve stability"
        elif commit_type == 'refactor':
            return f"refactor code structure"

        return "update code"


# ==================== Session Persistence ====================

@dataclass
class Session:
    """会话数据"""
    id: str
    name: str
    created_at: str
    updated_at: str
    messages: List[Dict] = field(default_factory=list)
    context: Dict = field(default_factory=dict)
    metadata: Dict = field(default_factory=dict)


class SessionPersistence:
    """会话持久化"""

    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            storage_dir = os.path.expanduser("~/.claude-code-clone/sessions")
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save(self, session: Session) -> bool:
        """
        保存会话

        Args:
            session: 会话对象

        Returns:
            bool: 是否成功
        """
        try:
            session.updated_at = datetime.now().isoformat()
            filepath = self.storage_dir / f"{session.id}.json"

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(asdict(session), f, ensure_ascii=False, indent=2)

            return True
        except Exception as e:
            print(f"保存会话失败: {e}")
            return False

    def load(self, session_id: str) -> Optional[Session]:
        """
        加载会话

        Args:
            session_id: 会话 ID

        Returns:
            Optional[Session]: 会话对象
        """
        try:
            filepath = self.storage_dir / f"{session_id}.json"

            if not filepath.exists():
                return None

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            return Session(**data)
        except Exception as e:
            print(f"加载会话失败: {e}")
            return None

    def list_sessions(self) -> List[Session]:
        """
        列出所有会话

        Returns:
            List[Session]: 会话列表
        """
        sessions = []

        for filepath in self.storage_dir.glob("*.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                sessions.append(Session(**data))
            except:
                continue

        return sorted(sessions, key=lambda s: s.updated_at, reverse=True)

    def delete(self, session_id: str) -> bool:
        """
        删除会话

        Args:
            session_id: 会话 ID

        Returns:
            bool: 是否成功
        """
        try:
            filepath = self.storage_dir / f"{session_id}.json"
            if filepath.exists():
                filepath.unlink()
            return True
        except Exception as e:
            print(f"删除会话失败: {e}")
            return False

    def export(self, session_id: str, export_path: str) -> bool:
        """
        导出会话

        Args:
            session_id: 会话 ID
            export_path: 导出路径

        Returns:
            bool: 是否成功
        """
        session = self.load(session_id)
        if not session:
            return False

        try:
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(asdict(session), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"导出会话失败: {e}")
            return False

    def import_session(self, import_path: str) -> Optional[Session]:
        """
        导入会话

        Args:
            import_path: 导入路径

        Returns:
            Optional[Session]: 会话对象
        """
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            session = Session(**data)
            # 生成新 ID 避免冲突
            session.id = hashlib.md5(
                f"{session.id}{datetime.now()}".encode()
            ).hexdigest()[:12]

            self.save(session)
            return session
        except Exception as e:
            print(f"导入会话失败: {e}")
            return None


# ==================== Tool Chain ====================

class ToolChain:
    """工具链执行器 - 支持多个工具链式执行"""

    def __init__(self):
        self.steps: List[Dict] = []
        self.results: List[Any] = []

    def add_step(self, tool_name: str, params: Dict, condition: str = None):
        """
        添加执行步骤

        Args:
            tool_name: 工具名
            params: 参数
            condition: 执行条件（可选）
        """
        self.steps.append({
            'tool': tool_name,
            'params': params,
            'condition': condition
        })

    def execute(self, context: Dict = None) -> List[Any]:
        """
        执行工具链

        Args:
            context: 执行上下文

        Returns:
            List[Any]: 执行结果列表
        """
        self.results = []
        ctx = context or {}

        for i, step in enumerate(self.steps):
            # 检查条件
            if step['condition'] and not self._eval_condition(step['condition'], ctx):
                continue

            # 执行工具
            try:
                # 这里应该调用实际的工具执行器
                # 简化版只记录
                result = {
                    'step': i,
                    'tool': step['tool'],
                    'params': step['params'],
                    'status': 'success',
                    'result': f"执行 {step['tool']}"
                }
                self.results.append(result)
                ctx[f'step_{i}_result'] = result
            except Exception as e:
                self.results.append({
                    'step': i,
                    'tool': step['tool'],
                    'status': 'failed',
                    'error': str(e)
                })
                break

        return self.results

    def _eval_condition(self, condition: str, context: Dict) -> bool:
        """评估条件"""
        # 简化版条件评估
        # 支持: "step_0_result.status == 'success'"
        try:
            parts = condition.split('==')
            if len(parts) == 2:
                key = parts[0].strip()
                expected = parts[1].strip().strip("'\"")
                return context.get(key) == expected
        except:
            pass
        return True


# ==================== Export ====================

__all__ = [
    'ContextCompressor',
    'CompressionResult',
    'PermissionUI',
    'PermissionRequest',
    'SmartCommit',
    'Session',
    'SessionPersistence',
    'ToolChain'
]
