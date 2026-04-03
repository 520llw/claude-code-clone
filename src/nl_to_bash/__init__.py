"""
自然语言转 Bash 命令模块
将用户的自然语言描述转换为可执行的 Bash 命令
"""

import re
import os
from typing import Optional, List, Dict
from dataclasses import dataclass


@dataclass
class BashCommand:
    """Bash 命令结果"""
    command: str
    description: str
    safe: bool  # 是否安全（只读操作）
    risky: bool  # 是否有风险（删除、修改等）


class NLToBashConverter:
    """自然语言转 Bash 转换器"""

    # 常见命令模式映射
    PATTERNS = {
        # 文件操作
        r'列出?.*文件|显示?.*文件|看.*文件': 'ls -la',
        r'列出?.*目录|显示?.*目录': 'ls -la',
        r'找.*文件|搜索.*文件': 'find . -name "{pattern}" -type f',
        r'找.*目录|搜索.*目录': 'find . -name "{pattern}" -type d',
        r'查看.*内容|显示.*内容|cat.*文件': 'cat {path}',
        r'查看.*头部|看.*开头': 'head -20 {path}',
        r'查看.*尾部|看.*结尾|看.*最后': 'tail -20 {path}',
        r'统计.*行数|多少行': 'wc -l {path}',
        r'创建.*目录|新建.*目录|mkdir': 'mkdir -p {path}',
        r'删除.*文件|删掉.*文件': 'rm {path}',
        r'删除.*目录|删掉.*目录': 'rm -rf {path}',
        r'复制.*文件|拷贝.*文件': 'cp {src} {dst}',
        r'移动.*文件|剪切.*文件|重命名': 'mv {src} {dst}',

        # Git 操作
        r'git.*状态|查看.*git.*状态': 'git status',
        r'git.*日志|查看.*提交.*历史': 'git log --oneline -20',
        r'git.*差异|查看.*修改': 'git diff',
        r'git.*分支|查看.*分支': 'git branch -a',
        r'git.*提交|commit.*代码': 'git commit -m "{message}"',
        r'git.*推送|push.*代码': 'git push',
        r'git.*拉取|pull.*代码': 'git pull',
        r'git.*添加|add.*文件': 'git add {path}',
        r'git.*克隆|clone.*仓库': 'git clone {url}',

        # 搜索操作
        r'搜索.*内容|grep.*查找': 'grep -r "{pattern}" . --include="{ext}"',
        r'搜索.*函数|找.*函数': 'grep -r "def {name}" . --include="*.py"',
        r'搜索.*类|找.*类': 'grep -r "class {name}" . --include="*.py"',

        # Python 相关
        r'运行.*python|执行.*py': 'python {script}',
        r'安装.*依赖|pip.*install': 'pip install {package}',
        r'运行.*测试|pytest|运行.*test': 'pytest {path}',

        # 系统操作
        r'查看.*进程|ps.*进程': 'ps aux | grep {pattern}',
        r'查看.*端口|netstat|ss.*端口': 'netstat -tlnp | grep {port}',
        r'查看.*磁盘|df.*空间': 'df -h',
        r'查看.*内存|free.*内存': 'free -h',
        r'查看.*cpu|top.*cpu': 'top -bn1 | head -20',

        # Node.js 相关
        r'npm.*install|安装.*npm': 'npm install',
        r'npm.*run|运行.*npm': 'npm run {script}',
        r'npm.*build|构建.*npm': 'npm run build',
        r'npm.*test|测试.*npm': 'npm test',
    }

    # 高风险命令标记
    RISKY_PATTERNS = [
        r'rm\s+-rf',
        r'rm\s+.*\*',
        r'dd\s+if=',
        r'format',
        r'mkfs',
        r'>:?\s*/\w+',
        r'sudo.*rm',
    ]

    def __init__(self):
        self.context: Dict[str, str] = {}

    def convert(self, natural_language: str, context: Optional[Dict] = None) -> BashCommand:
        """
        将自然语言转换为 Bash 命令

        Args:
            natural_language: 用户输入的自然语言
            context: 上下文信息（当前目录、项目类型等）

        Returns:
            BashCommand: 转换后的命令
        """
        if context:
            self.context.update(context)

        nl = natural_language.lower().strip()

        # 尝试匹配已知模式
        for pattern, template in self.PATTERNS.items():
            if re.search(pattern, nl, re.IGNORECASE):
                command = self._fill_template(template, nl)
                return BashCommand(
                    command=command,
                    description=f"基于模式匹配: {pattern[:30]}...",
                    safe=self._is_safe(command),
                    risky=self._is_risky(command)
                )

        # 智能推断
        command = self._smart_infer(nl)
        return BashCommand(
            command=command,
            description="智能推断生成",
            safe=self._is_safe(command),
            risky=self._is_risky(command)
        )

    def _fill_template(self, template: str, nl: str) -> str:
        """填充模板中的变量"""
        command = template

        # 提取文件路径
        path_match = re.search(r'[\w\-./]+\.(py|js|ts|json|md|txt|yaml|yml)', nl)
        if path_match and '{path}' in command:
            command = command.replace('{path}', path_match.group(0))
        elif '{path}' in command:
            command = command.replace('{path}', '.')

        # 提取源和目标
        if '{src}' in command and '{dst}' in command:
            paths = re.findall(r'[\w\-./]+', nl)
            if len(paths) >= 2:
                command = command.replace('{src}', paths[0]).replace('{dst}', paths[1])

        # 提取搜索模式
        if '{pattern}' in command:
            # 尝试提取引号中的内容
            quote_match = re.search(r'["\'](.+?)["\']', nl)
            if quote_match:
                command = command.replace('{pattern}', quote_match.group(1))
            else:
                # 提取关键词
                words = re.findall(r'\b\w+\b', nl)
                ignore_words = {'查找', '搜索', '找', '文件', '包含', '中的', 'the', 'find', 'search'}
                keywords = [w for w in words if w not in ignore_words]
                if keywords:
                    command = command.replace('{pattern}', keywords[-1])
                else:
                    command = command.replace('{pattern}', '*')

        # 提取扩展名
        if '{ext}' in command:
            ext_match = re.search(r'\.(py|js|ts|java|go|rs|c|cpp|h|md|json|yaml)', nl)
            if ext_match:
                command = command.replace('{ext}', f'*{ext_match.group(0)}')
            else:
                command = command.replace('{ext}', '*')

        # 提取包名
        if '{package}' in command:
            pkg_match = re.search(r'(?:install|安装)\s+(\w+)', nl)
            if pkg_match:
                command = command.replace('{package}', pkg_match.group(1))

        # 提取提交信息
        if '{message}' in command:
            msg_match = re.search(r'(?:提交|commit)\s*["\']?(.+?)["\']?$', nl)
            if msg_match:
                command = command.replace('{message}', msg_match.group(1))
            else:
                command = command.replace('{message}', 'update')

        # 提取脚本名
        if '{script}' in command:
            script_match = re.search(r'([\w\-]+\.py)', nl)
            if script_match:
                command = command.replace('{script}', script_match.group(1))

        # 提取 URL
        if '{url}' in command:
            url_match = re.search(r'(https?://\S+)', nl)
            if url_match:
                command = command.replace('{url}', url_match.group(1))

        return command

    def _smart_infer(self, nl: str) -> str:
        """智能推断命令"""
        # 基于关键词推断
        if any(kw in nl for kw in ['列出', 'list', '显示', 'show', '看']):
            if any(kw in nl for kw in ['隐藏', 'hidden', '所有', 'all']):
                return 'ls -la'
            return 'ls -la'

        if any(kw in nl for kw in ['当前目录', '当前路径', 'pwd']):
            return 'pwd'

        if any(kw in nl for kw in ['环境变量', 'env', 'environment']):
            return 'env | grep -i "${pattern:-}"'

        if any(kw in nl for kw in ['时间', 'date', '日期']):
            return 'date'

        if any(kw in nl for kw in ['我是谁', 'whoami', '当前用户']):
            return 'whoami'

        # 默认返回帮助
        return 'echo "无法识别命令，请尝试更具体的描述"'

    def _is_safe(self, command: str) -> bool:
        """检查命令是否安全（只读）"""
        read_only_patterns = [
            r'^ls\s', r'^cat\s', r'^head\s', r'^tail\s', r'^grep\s',
            r'^find\s', r'^pwd$', r'^whoami$', r'^date$', r'^env$',
            r'^git\s+(status|log|diff|show|branch)',
            r'^wc\s', r'^echo\s',
        ]
        return any(re.search(pattern, command) for pattern in read_only_patterns)

    def _is_risky(self, command: str) -> bool:
        """检查命令是否有风险"""
        return any(re.search(pattern, command) for pattern in self.RISKY_PATTERNS)

    def suggest(self, partial: str) -> List[str]:
        """
        基于部分输入给出命令建议

        Args:
            partial: 用户输入的部分内容

        Returns:
            List[str]: 建议的命令列表
        """
        suggestions = []
        partial_lower = partial.lower()

        suggestion_map = {
            'ls': ['ls -la', 'ls -lh', 'ls -ltr'],
            'git': ['git status', 'git log', 'git diff', 'git add .', 'git commit -m ""'],
            'find': ['find . -name "*.py"', 'find . -type f', 'find . -type d'],
            'grep': ['grep -r "pattern" .', 'grep -i "pattern" file'],
            'cat': ['cat file.txt', 'cat -n file.txt'],
            'docker': ['docker ps', 'docker images', 'docker-compose up -d'],
            'npm': ['npm install', 'npm run dev', 'npm run build', 'npm test'],
            'python': ['python script.py', 'python -m pytest', 'pip install package'],
        }

        for keyword, commands in suggestion_map.items():
            if keyword in partial_lower:
                suggestions.extend(commands)

        return suggestions[:10]  # 最多返回10条


# 全局转换器实例
_converter = None


def get_converter() -> NLToBashConverter:
    """获取全局转换器实例"""
    global _converter
    if _converter is None:
        _converter = NLToBashConverter()
    return _converter


def nl_to_bash(natural_language: str, context: Optional[Dict] = None) -> str:
    """
    快捷函数：自然语言转 Bash 命令

    Args:
        natural_language: 自然语言描述
        context: 上下文信息

    Returns:
        str: Bash 命令字符串
    """
    converter = get_converter()
    result = converter.convert(natural_language, context)
    return result.command


def explain_command(command: str) -> str:
    """
    解释 Bash 命令的含义

    Args:
        command: Bash 命令

    Returns:
        str: 命令解释
    """
    explanations = {
        r'^ls\s+-la$': '列出当前目录所有文件（包括隐藏文件），显示详细信息',
        r'^ls\s+-lh$': '列出文件，以人类可读格式显示文件大小',
        r'^cat\s+': '显示文件内容',
        r'^head\s+': '显示文件头部内容',
        r'^tail\s+': '显示文件尾部内容',
        r'^grep\s+': '在文件中搜索匹配的内容',
        r'^find\s+': '在目录中查找文件',
        r'^git\s+status$': '查看 Git 仓库当前状态',
        r'^git\s+log': '查看提交历史',
        r'^git\s+diff$': '查看工作区与暂存区的差异',
        r'^git\s+add': '将文件添加到 Git 暂存区',
        r'^git\s+commit': '提交暂存区的更改',
        r'^git\s+push': '将本地提交推送到远程仓库',
        r'^pwd$': '显示当前工作目录',
        r'^whoami$': '显示当前用户名',
        r'^wc\s+-l': '统计文件的行数',
        r'^rm\s+': '删除文件或目录',
        r'^cp\s+': '复制文件或目录',
        r'^mv\s+': '移动或重命名文件',
        r'^mkdir\s+': '创建目录',
    }

    for pattern, explanation in explanations.items():
        if re.search(pattern, command):
            return explanation

    return f"执行命令: {command}"


if __name__ == '__main__':
    # 测试
    converter = NLToBashConverter()

    test_inputs = [
        "列出所有 Python 文件",
        "查看 git 状态",
        "搜索包含 main 函数的文件",
        "查看当前目录",
        "删除 test.txt 文件",
    ]

    for text in test_inputs:
        result = converter.convert(text)
        print(f"输入: {text}")
        print(f"命令: {result.command}")
        print(f"安全: {result.safe}, 风险: {result.risky}")
        print(f"解释: {explain_command(result.command)}")
        print()
