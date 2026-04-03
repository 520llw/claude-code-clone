"""
Diff 查看器模块
提供代码差异的可视化展示和编辑确认功能
"""

import re
import difflib
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass
from enum import Enum


class ChangeType(Enum):
    """变更类型"""
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"
    CONTEXT = "context"


@dataclass
class DiffHunk:
    """差异块"""
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    lines: List[Tuple[ChangeType, str]]
    header: str = ""


@dataclass
class DiffFile:
    """文件差异"""
    old_path: str
    new_path: str
    hunks: List[DiffHunk]
    is_new: bool = False
    is_deleted: bool = False
    is_binary: bool = False


@dataclass
class DiffStats:
    """差异统计"""
    files_changed: int
    insertions: int
    deletions: int
    hunks: int


class DiffViewer:
    """Diff 查看器"""

    def __init__(self, context_lines: int = 3):
        """
        初始化 Diff 查看器

        Args:
            context_lines: 上下文行数
        """
        self.context_lines = context_lines

    def unified_diff(
        self,
        old_content: str,
        new_content: str,
        old_path: str = "a/file",
        new_path: str = "b/file",
        context: int = None
    ) -> str:
        """
        生成 Unified Diff 格式

        Args:
            old_content: 旧内容
            new_content: 新内容
            old_path: 旧文件路径
            new_path: 新文件路径
            context: 上下文行数

        Returns:
            str: Unified diff 字符串
        """
        if context is None:
            context = self.context_lines

        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        # 确保每行都以换行符结尾
        if old_lines and not old_lines[-1].endswith('\n'):
            old_lines[-1] += '\n'
            old_lines.append('\\ No newline at end of file\n')
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines[-1] += '\n'
            new_lines.append('\\ No newline at end of file\n')

        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=old_path,
            tofile=new_path,
            n=context
        )

        return ''.join(diff)

    def parse_unified_diff(self, diff_text: str) -> List[DiffFile]:
        """
        解析 Unified Diff 格式

        Args:
            diff_text: diff 文本

        Returns:
            List[DiffFile]: 文件差异列表
        """
        files = []
        current_file = None
        current_hunk = None
        lines = diff_text.splitlines()
        i = 0

        while i < len(lines):
            line = lines[i]

            # 文件头
            if line.startswith('--- '):
                old_path = line[4:].split('\t')[0].strip()
                if i + 1 < len(lines) and lines[i + 1].startswith('+++ '):
                    new_path = lines[i + 1][4:].split('\t')[0].strip()
                    current_file = DiffFile(
                        old_path=old_path,
                        new_path=new_path,
                        hunks=[],
                        is_new=old_path == '/dev/null',
                        is_deleted=new_path == '/dev/null'
                    )
                    files.append(current_file)
                    i += 1

            # Diff hunk 头
            elif line.startswith('@@'):
                match = re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)', line)
                if match and current_file:
                    old_start = int(match.group(1))
                    old_count = int(match.group(2)) if match.group(2) else 1
                    new_start = int(match.group(3))
                    new_count = int(match.group(4)) if match.group(4) else 1
                    header = match.group(5).strip()

                    current_hunk = DiffHunk(
                        old_start=old_start,
                        old_count=old_count,
                        new_start=new_start,
                        new_count=new_count,
                        lines=[],
                        header=header
                    )
                    current_file.hunks.append(current_hunk)

            # Diff 内容行
            elif current_hunk:
                if line.startswith('+'):
                    current_hunk.lines.append((ChangeType.ADDED, line[1:]))
                elif line.startswith('-'):
                    current_hunk.lines.append((ChangeType.REMOVED, line[1:]))
                elif line.startswith(' '):
                    current_hunk.lines.append((ChangeType.UNCHANGED, line[1:]))
                elif line.startswith('\\'):
                    # "\ No newline at end of file"
                    pass

            i += 1

        return files

    def side_by_side_diff(
        self,
        old_content: str,
        new_content: str,
        old_path: str = "Old",
        new_path: str = "New",
        width: int = 80
    ) -> str:
        """
        生成并排 Diff 格式（用于终端显示）

        Args:
            old_content: 旧内容
            new_content: 新内容
            old_path: 旧文件路径标签
            new_path: 新文件路径标签
            width: 每侧宽度

        Returns:
            str: 并排 diff 字符串
        """
        half_width = (width - 3) // 2
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()

        # 对齐行数
        max_lines = max(len(old_lines), len(new_lines))
        old_lines.extend([''] * (max_lines - len(old_lines)))
        new_lines.extend([''] * (max_lines - len(new_lines)))

        # 生成并排视图
        result = []
        result.append(f"{'─' * width}")
        result.append(f"{old_path:<{half_width}} │ {new_path}")
        result.append(f"{'─' * width}")

        for i, (old, new) in enumerate(zip(old_lines, new_lines)):
            old_display = old[:half_width]
            new_display = new[:half_width]

            if old != new:
                # 有变更的行
                marker = "│"
                if not old:
                    marker = "▶"  # 新增
                elif not new:
                    marker = "◀"  # 删除
                else:
                    marker = "↔"  # 修改

                result.append(f"{old_display:<{half_width}} {marker} {new_display}")
            else:
                # 未变更的行
                result.append(f"{old_display:<{half_width}} │ {new_display}")

        result.append(f"{'─' * width}")
        return '\n'.join(result)

    def highlight_diff(self, diff_text: str) -> str:
        """
        为 diff 文本添加颜色标记（Rich 格式）

        Args:
            diff_text: diff 文本

        Returns:
            str: 带颜色标记的 diff
        """
        lines = diff_text.splitlines()
        highlighted = []

        for line in lines:
            if line.startswith('+++'):
                highlighted.append(f"[green]{line}[/green]")
            elif line.startswith('---'):
                highlighted.append(f"[red]{line}[/red]")
            elif line.startswith('@@'):
                highlighted.append(f"[cyan]{line}[/cyan]")
            elif line.startswith('+'):
                highlighted.append(f"[green]{line}[/green]")
            elif line.startswith('-'):
                highlighted.append(f"[red]{line}[/red]")
            elif line.startswith(' '):
                highlighted.append(line)
            elif line.startswith('diff '):
                highlighted.append(f"[bold yellow]{line}[/bold yellow]")
            elif line.startswith('index '):
                highlighted.append(f"[dim]{line}[/dim]")
            else:
                highlighted.append(line)

        return '\n'.join(highlighted)

    def get_stats(self, diff_text: str) -> DiffStats:
        """
        获取 diff 统计信息

        Args:
            diff_text: diff 文本

        Returns:
            DiffStats: 统计信息
        """
        files = self.parse_unified_diff(diff_text)

        insertions = 0
        deletions = 0
        hunks = 0

        for file in files:
            for hunk in file.hunks:
                hunks += 1
                for change_type, _ in hunk.lines:
                    if change_type == ChangeType.ADDED:
                        insertions += 1
                    elif change_type == ChangeType.REMOVED:
                        deletions += 1

        return DiffStats(
            files_changed=len(files),
            insertions=insertions,
            deletions=deletions,
            hunks=hunks
        )

    def format_stats(self, stats: DiffStats) -> str:
        """
        格式化统计信息

        Args:
            stats: 统计信息

        Returns:
            str: 格式化后的字符串
        """
        parts = [f"{stats.files_changed} files changed"]
        if stats.insertions > 0:
            parts.append(f"{stats.insertions} insertions(+)")
        if stats.deletions > 0:
            parts.append(f"{stats.deletions} deletions(-)")
        return ", ".join(parts)


class EditConfirm:
    """编辑确认系统"""

    def __init__(self, diff_viewer: Optional[DiffViewer] = None):
        """
        初始化编辑确认系统

        Args:
            diff_viewer: Diff 查看器实例
        """
        self.diff_viewer = diff_viewer or DiffViewer()

    def preview_edit(
        self,
        file_path: str,
        old_content: str,
        new_content: str,
        show_side_by_side: bool = True
    ) -> str:
        """
        预览编辑效果

        Args:
            file_path: 文件路径
            old_content: 旧内容
            new_content: 新内容
            show_side_by_side: 是否显示并排视图

        Returns:
            str: 预览文本
        """
        lines = []
        lines.append(f"📄 {file_path}")
        lines.append("")

        # Unified diff
        diff = self.diff_viewer.unified_diff(
            old_content, new_content,
            old_path=f"a/{file_path}",
            new_path=f"b/{file_path}"
        )

        if diff:
            lines.append("Diff:")
            lines.append("```diff")
            lines.append(diff)
            lines.append("```")
            lines.append("")

            # 统计
            stats = self.diff_viewer.get_stats(diff)
            lines.append(self.diff_viewer.format_stats(stats))
        else:
            lines.append("(No changes)")

        return '\n'.join(lines)

    def should_confirm(self, diff_text: str, threshold: int = 10) -> bool:
        """
        判断是否需要用户确认

        Args:
            diff_text: diff 文本
            threshold: 阈值（变更行数超过此值需要确认）

        Returns:
            bool: 是否需要确认
        """
        stats = self.diff_viewer.get_stats(diff_text)
        total_changes = stats.insertions + stats.deletions
        return total_changes > threshold


def create_diff(
    old_content: str,
    new_content: str,
    old_path: str = "a/file",
    new_path: str = "b/file"
) -> str:
    """
    快捷函数：创建 unified diff

    Args:
        old_content: 旧内容
        new_content: 新内容
        old_path: 旧文件路径
        new_path: 新文件路径

    Returns:
        str: Unified diff
    """
    viewer = DiffViewer()
    return viewer.unified_diff(old_content, new_content, old_path, new_path)


def get_file_diff_summary(old_content: str, new_content: str) -> Dict[str, int]:
    """
    获取文件差异摘要

    Args:
        old_content: 旧内容
        new_content: 新内容

    Returns:
        Dict: 包含 insertions, deletions, changes
    """
    viewer = DiffViewer()
    diff = viewer.unified_diff(old_content, new_content)
    stats = viewer.get_stats(diff)

    return {
        "insertions": stats.insertions,
        "deletions": stats.deletions,
        "changes": stats.insertions + stats.deletions
    }


if __name__ == '__main__':
    # 测试
    old = """def hello():
    print("Hello")
    return True

x = 1
y = 2"""

    new = """def hello():
    print("Hello, World!")
    return False

x = 1
z = 3"""

    viewer = DiffViewer()

    print("=== Unified Diff ===")
    diff = viewer.unified_diff(old, new, "a/test.py", "b/test.py")
    print(diff)

    print("\n=== Stats ===")
    stats = viewer.get_stats(diff)
    print(viewer.format_stats(stats))

    print("\n=== Side by Side ===")
    print(viewer.side_by_side_diff(old, new, width=100))
