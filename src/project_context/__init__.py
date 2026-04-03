"""
项目上下文理解模块
解析 CLAUDE.md 并理解项目结构
"""

import os
import re
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProjectMetadata:
    """项目元数据"""
    name: str = ""
    version: str = ""
    description: str = ""
    language: str = ""
    framework: str = ""
    build_system: str = ""
    test_framework: str = ""


@dataclass
class ProjectRules:
    """项目规则"""
    coding_style: str = ""
    testing_requirements: str = ""
    documentation_requirements: str = ""
    architecture_patterns: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)


@dataclass
class ProjectContext:
    """项目上下文"""
    metadata: ProjectMetadata = field(default_factory=ProjectMetadata)
    rules: ProjectRules = field(default_factory=ProjectRules)
    structure: Dict[str, Any] = field(default_factory=dict)
    symbols: Dict[str, List[str]] = field(default_factory=dict)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)
    key_files: Dict[str, str] = field(default_factory=dict)
    raw_content: str = ""


class ClaudeMdParser:
    """CLAUDE.md 解析器"""

    def __init__(self):
        self.context = ProjectContext()

    def parse(self, content: str) -> ProjectContext:
        """
        解析 CLAUDE.md 内容

        Args:
            content: CLAUDE.md 文件内容

        Returns:
            ProjectContext: 解析后的项目上下文
        """
        self.context.raw_content = content

        # 解析 YAML frontmatter
        frontmatter = self._extract_frontmatter(content)
        if frontmatter:
            self._parse_frontmatter(frontmatter)

        # 解析 Markdown 内容
        body = self._extract_body(content)
        self._parse_body(body)

        return self.context

    def _extract_frontmatter(self, content: str) -> Optional[str]:
        """提取 YAML frontmatter"""
        pattern = r'^---\s*\n(.*?)\n---\s*\n'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            return match.group(1)
        return None

    def _extract_body(self, content: str) -> str:
        """提取 Markdown 正文"""
        pattern = r'^---\s*\n.*?\n---\s*\n'
        return re.sub(pattern, '', content, count=1, flags=re.DOTALL).strip()

    def _parse_frontmatter(self, frontmatter: str):
        """解析 YAML frontmatter（简化版）"""
        # 简单的键值对解析
        for line in frontmatter.split('\n'):
            line = line.strip()
            if ':' in line and not line.startswith('#'):
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip().strip('"\'')

                if key == 'name':
                    self.context.metadata.name = value
                elif key == 'version':
                    self.context.metadata.version = value
                elif key == 'description':
                    self.context.metadata.description = value
                elif key == 'language':
                    self.context.metadata.language = value
                elif key == 'framework':
                    self.context.metadata.framework = value
                elif key == 'build_system':
                    self.context.metadata.build_system = value
                elif key == 'test_framework':
                    self.context.metadata.test_framework = value

    def _parse_body(self, body: str):
        """解析 Markdown 正文"""
        # 提取各部分
        sections = self._extract_sections(body)

        for section_title, section_content in sections.items():
            section_lower = section_title.lower()

            if 'architecture' in section_lower or '架构' in section_lower:
                self.context.rules.architecture_patterns = self._extract_list(section_content)

            elif 'constraint' in section_lower or '约束' in section_lower or '限制' in section_lower:
                self.context.rules.constraints = self._extract_list(section_content)

            elif 'style' in section_lower or '风格' in section_lower or '规范' in section_lower:
                self.context.rules.coding_style = section_content.strip()

            elif 'test' in section_lower or '测试' in section_lower:
                self.context.rules.testing_requirements = section_content.strip()

            elif 'doc' in section_lower or '文档' in section_lower:
                self.context.rules.documentation_requirements = section_content.strip()

            elif 'structure' in section_lower or '结构' in section_lower or '目录' in section_lower:
                self.context.structure = self._parse_structure(section_content)

            elif 'key' in section_lower or '关键' in section_lower or '重要' in section_lower:
                self.context.key_files = self._parse_key_files(section_content)

    def _extract_sections(self, content: str) -> Dict[str, str]:
        """提取 Markdown 章节"""
        sections = {}
        current_section = "Introduction"
        current_content = []

        for line in content.split('\n'):
            if line.startswith('# '):
                # 保存上一章节
                if current_content:
                    sections[current_section] = '\n'.join(current_content)
                current_section = line[2:].strip()
                current_content = []
            elif line.startswith('## '):
                # 保存上一章节
                if current_content:
                    sections[current_section] = '\n'.join(current_content)
                current_section = line[3:].strip()
                current_content = []
            else:
                current_content.append(line)

        # 保存最后一个章节
        if current_content:
            sections[current_section] = '\n'.join(current_content)

        return sections

    def _extract_list(self, content: str) -> List[str]:
        """提取列表项"""
        items = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                items.append(line[2:])
            elif re.match(r'^\d+\.', line):
                items.append(re.sub(r'^\d+\.\s*', '', line))
        return items

    def _parse_structure(self, content: str) -> Dict[str, Any]:
        """解析项目结构"""
        structure = {}
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                item = line[2:]
                if ':' in item:
                    key, desc = item.split(':', 1)
                    structure[key.strip()] = desc.strip()
                else:
                    structure[item] = ""
        return structure

    def _parse_key_files(self, content: str) -> Dict[str, str]:
        """解析关键文件"""
        files = {}
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                item = line[2:]
                if ':' in item:
                    path, desc = item.split(':', 1)
                    files[path.strip()] = desc.strip()
                else:
                    files[item] = ""
        return files


class ProjectAnalyzer:
    """项目分析器"""

    # 语言检测映射
    LANGUAGE_FILES = {
        'Python': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
        'JavaScript': ['package.json', 'yarn.lock'],
        'TypeScript': ['tsconfig.json'],
        'Java': ['pom.xml', 'build.gradle'],
        'Go': ['go.mod', 'go.sum'],
        'Rust': ['Cargo.toml', 'Cargo.lock'],
        'Ruby': ['Gemfile', 'Gemfile.lock'],
        'PHP': ['composer.json', 'composer.lock'],
        'C++': ['CMakeLists.txt', 'Makefile'],
    }

    # 框架检测映射
    FRAMEWORK_PATTERNS = {
        'React': ['react', 'jsx', 'tsx'],
        'Vue': ['vue'],
        'Angular': ['@angular'],
        'Django': ['django'],
        'Flask': ['flask'],
        'FastAPI': ['fastapi'],
        'Express': ['express'],
        'NestJS': ['@nestjs'],
        'Spring': ['spring'],
        'Laravel': ['laravel'],
    }

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.context = ProjectContext()

    def analyze(self) -> ProjectContext:
        """
        分析项目

        Returns:
            ProjectContext: 项目上下文
        """
        # 尝试解析 CLAUDE.md
        claude_md_path = self.project_path / 'CLAUDE.md'
        if claude_md_path.exists():
            parser = ClaudeMdParser()
            self.context = parser.parse(claude_md_path.read_text())

        # 自动检测项目信息
        self._detect_language()
        self._detect_framework()
        self._detect_build_system()
        self._detect_test_framework()
        self._analyze_structure()
        self._extract_symbols()
        self._detect_dependencies()

        return self.context

    def _detect_language(self):
        """检测编程语言"""
        if self.context.metadata.language:
            return

        for language, files in self.LANGUAGE_FILES.items():
            for file in files:
                if (self.project_path / file).exists():
                    self.context.metadata.language = language
                    return

    def _detect_framework(self):
        """检测框架"""
        if self.context.metadata.framework:
            return

        # 检查 package.json
        pkg_path = self.project_path / 'package.json'
        if pkg_path.exists():
            try:
                pkg = json.loads(pkg_path.read_text())
                deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}

                for framework, patterns in self.FRAMEWORK_PATTERNS.items():
                    for pattern in patterns:
                        if any(pattern in dep.lower() for dep in deps):
                            self.context.metadata.framework = framework
                            return
            except:
                pass

        # 检查 Python 框架
        req_path = self.project_path / 'requirements.txt'
        if req_path.exists():
            content = req_path.read_text().lower()
            if 'django' in content:
                self.context.metadata.framework = 'Django'
            elif 'flask' in content:
                self.context.metadata.framework = 'Flask'
            elif 'fastapi' in content:
                self.context.metadata.framework = 'FastAPI'

    def _detect_build_system(self):
        """检测构建系统"""
        if self.context.metadata.build_system:
            return

        build_files = {
            'npm': ['package.json'],
            'yarn': ['yarn.lock'],
            'pnpm': ['pnpm-lock.yaml'],
            'webpack': ['webpack.config.js'],
            'vite': ['vite.config.js', 'vite.config.ts'],
            'CMake': ['CMakeLists.txt'],
            'Gradle': ['build.gradle'],
            'Maven': ['pom.xml'],
        }

        for system, files in build_files.items():
            for file in files:
                if (self.project_path / file).exists():
                    self.context.metadata.build_system = system
                    return

    def _detect_test_framework(self):
        """检测测试框架"""
        if self.context.metadata.test_framework:
            return

        test_files = {
            'pytest': ['pytest.ini', 'conftest.py'],
            'unittest': [],  # Python 内置
            'Jest': ['jest.config.js', 'jest.config.ts'],
            'Mocha': ['.mocharc.js'],
            'Junit': [],  # Java 默认
        }

        for framework, files in test_files.items():
            for file in files:
                if (self.project_path / file).exists():
                    self.context.metadata.test_framework = framework
                    return

        # 检查 package.json 中的测试命令
        pkg_path = self.project_path / 'package.json'
        if pkg_path.exists():
            try:
                pkg = json.loads(pkg_path.read_text())
                test_cmd = pkg.get('scripts', {}).get('test', '')
                if 'jest' in test_cmd:
                    self.context.metadata.test_framework = 'Jest'
                elif 'mocha' in test_cmd:
                    self.context.metadata.test_framework = 'Mocha'
            except:
                pass

    def _analyze_structure(self):
        """分析项目结构"""
        structure = {}

        for item in self.project_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                # 统计目录中的文件数
                file_count = sum(1 for _ in item.rglob('*') if _.is_file())
                structure[item.name] = f"{file_count} files"
            elif item.is_file():
                structure[item.name] = f"{item.stat().st_size} bytes"

        self.context.structure.update(structure)

    def _extract_symbols(self):
        """提取代码符号"""
        symbols = {'classes': [], 'functions': [], 'variables': []}

        # 只分析源码目录
        src_dirs = ['src', 'lib', 'app', 'src']
        for src_dir in src_dirs:
            src_path = self.project_path / src_dir
            if src_path.exists():
                for py_file in src_path.rglob('*.py'):
                    content = py_file.read_text()

                    # 提取类定义
                    classes = re.findall(r'^class\s+(\w+)', content, re.MULTILINE)
                    symbols['classes'].extend(classes)

                    # 提取函数定义
                    functions = re.findall(r'^def\s+(\w+)', content, re.MULTILINE)
                    symbols['functions'].extend(functions)

        self.context.symbols = symbols

    def _detect_dependencies(self):
        """检测依赖"""
        deps = {}

        # Python 依赖
        req_path = self.project_path / 'requirements.txt'
        if req_path.exists():
            deps['python'] = [
                line.strip()
                for line in req_path.read_text().split('\n')
                if line.strip() and not line.startswith('#')
            ]

        # Node.js 依赖
        pkg_path = self.project_path / 'package.json'
        if pkg_path.exists():
            try:
                pkg = json.loads(pkg_path.read_text())
                deps['production'] = list(pkg.get('dependencies', {}).keys())
                deps['development'] = list(pkg.get('devDependencies', {}).keys())
            except:
                pass

        self.context.dependencies = deps

    def generate_summary(self) -> str:
        """
        生成项目摘要

        Returns:
            str: 项目摘要文本
        """
        lines = []
        meta = self.context.metadata

        lines.append(f"# {meta.name or 'Project'}")
        lines.append("")

        if meta.description:
            lines.append(meta.description)
            lines.append("")

        lines.append(f"**Language:** {meta.language or 'Unknown'}")
        if meta.framework:
            lines.append(f"**Framework:** {meta.framework}")
        if meta.build_system:
            lines.append(f"**Build:** {meta.build_system}")
        if meta.test_framework:
            lines.append(f"**Test:** {meta.test_framework}")
        lines.append("")

        if self.context.structure:
            lines.append("## Structure")
            for name, info in list(self.context.structure.items())[:10]:
                lines.append(f"- `{name}`: {info}")
            lines.append("")

        if self.context.dependencies:
            lines.append("## Dependencies")
            for category, packages in self.context.dependencies.items():
                if packages:
                    lines.append(f"- {category}: {len(packages)} packages")
            lines.append("")

        if self.context.symbols.get('classes') or self.context.symbols.get('functions'):
            lines.append("## Symbols")
            if self.context.symbols.get('classes'):
                lines.append(f"- Classes: {len(self.context.symbols['classes'])}")
            if self.context.symbols.get('functions'):
                lines.append(f"- Functions: {len(self.context.symbols['functions'])}")
            lines.append("")

        return '\n'.join(lines)


def parse_claude_md(content: str) -> ProjectContext:
    """
    快捷函数：解析 CLAUDE.md

    Args:
        content: CLAUDE.md 内容

    Returns:
        ProjectContext: 项目上下文
    """
    parser = ClaudeMdParser()
    return parser.parse(content)


def analyze_project(project_path: str) -> ProjectContext:
    """
    快捷函数：分析项目

    Args:
        project_path: 项目路径

    Returns:
        ProjectContext: 项目上下文
    """
    analyzer = ProjectAnalyzer(project_path)
    return analyzer.analyze()


if __name__ == '__main__':
    # 测试
    import sys

    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        path = '.'

    analyzer = ProjectAnalyzer(path)
    context = analyzer.analyze()
    print(analyzer.generate_summary())
