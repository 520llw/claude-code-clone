"""
Claude Code Tool System - Code Analysis Tools

This module provides tools for code analysis, AST parsing, dependency analysis,
and code structure visualization.
"""

import os
import re
import ast
import json
import fnmatch
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio

from .base import Tool, ToolResult, ToolParameter
from .permission import PermissionManager, get_permission_manager


@dataclass
class CodeSymbol:
    """Represents a code symbol (function, class, variable, etc.)."""
    name: str
    symbol_type: str  # 'function', 'class', 'method', 'variable', 'import'
    line_start: int
    line_end: Optional[int] = None
    docstring: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    parameters: List[str] = field(default_factory=list)
    parent: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.symbol_type,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "docstring": self.docstring,
            "decorators": self.decorators,
            "parameters": self.parameters,
            "parent": self.parent
        }


class ASTAnalyzer:
    """Python AST analyzer for extracting code structure."""
    
    def __init__(self, source_code: str):
        self.source_code = source_code
        self.lines = source_code.split('\n')
        self.tree: Optional[ast.AST] = None
        self.symbols: List[CodeSymbol] = []
        self.imports: List[Dict[str, Any]] = []
        self.errors: List[str] = []
    
    def parse(self) -> bool:
        """Parse the source code into an AST."""
        try:
            self.tree = ast.parse(self.source_code)
            return True
        except SyntaxError as e:
            self.errors.append(f"Syntax error: {e}")
            return False
    
    def analyze(self) -> Dict[str, Any]:
        """Analyze the AST and extract symbols."""
        if not self.tree and not self.parse():
            return {"error": "Failed to parse source code", "errors": self.errors}
        
        self._extract_imports()
        self._extract_classes()
        self._extract_functions()
        
        return {
            "symbols": [s.to_dict() for s in self.symbols],
            "imports": self.imports,
            "line_count": len(self.lines),
            "errors": self.errors
        }
    
    def _extract_imports(self) -> None:
        """Extract import statements."""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self.imports.append({
                        "type": "import",
                        "module": alias.name,
                        "alias": alias.asname,
                        "line": node.lineno
                    })
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    self.imports.append({
                        "type": "from_import",
                        "module": module,
                        "name": alias.name,
                        "alias": alias.asname,
                        "line": node.lineno
                    })
    
    def _extract_classes(self) -> None:
        """Extract class definitions."""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ClassDef):
                # Get docstring
                docstring = ast.get_docstring(node)
                
                # Get decorators
                decorators = []
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Name):
                        decorators.append(dec.id)
                    elif isinstance(dec, ast.Call):
                        if isinstance(dec.func, ast.Name):
                            decorators.append(dec.func.id)
                
                # Get base classes
                bases = []
                for base in node.bases:
                    if isinstance(base, ast.Name):
                        bases.append(base.id)
                    elif isinstance(base, ast.Attribute):
                        bases.append(f"{base.value.id}.{base.attr}")
                
                class_symbol = CodeSymbol(
                    name=node.name,
                    symbol_type="class",
                    line_start=node.lineno,
                    line_end=getattr(node, 'end_lineno', None),
                    docstring=docstring,
                    decorators=decorators
                )
                self.symbols.append(class_symbol)
                
                # Extract methods
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        self._extract_function(item, parent=node.name)
    
    def _extract_functions(self) -> None:
        """Extract function definitions (not methods)."""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.FunctionDef):
                # Check if it's a method (has parent class)
                is_method = False
                for parent in ast.walk(self.tree):
                    if isinstance(parent, ast.ClassDef):
                        if node in parent.body:
                            is_method = True
                            break
                
                if not is_method:
                    self._extract_function(node)
    
    def _extract_function(self, node: ast.FunctionDef, parent: Optional[str] = None) -> None:
        """Extract a function definition."""
        docstring = ast.get_docstring(node)
        
        # Get decorators
        decorators = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name):
                decorators.append(dec.id)
            elif isinstance(dec, ast.Call):
                if isinstance(dec.func, ast.Name):
                    decorators.append(dec.func.id)
        
        # Get parameters
        params = []
        for arg in node.args.args:
            param_str = arg.arg
            if arg.annotation:
                if isinstance(arg.annotation, ast.Name):
                    param_str += f": {arg.annotation.id}"
                elif isinstance(arg.annotation, ast.Constant):
                    param_str += f": {arg.annotation.value}"
            params.append(param_str)
        
        # Handle *args and **kwargs
        if node.args.vararg:
            params.append(f"*{node.args.vararg.arg}")
        if node.args.kwarg:
            params.append(f"**{node.args.kwarg.arg}")
        
        symbol_type = "method" if parent else "function"
        
        func_symbol = CodeSymbol(
            name=node.name,
            symbol_type=symbol_type,
            line_start=node.lineno,
            line_end=getattr(node, 'end_lineno', None),
            docstring=docstring,
            decorators=decorators,
            parameters=params,
            parent=parent
        )
        self.symbols.append(func_symbol)


class ViewTool(Tool):
    """Tool for viewing code structure."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "view"
    
    @property
    def description(self) -> str:
        return "View the structure of a Python file."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("file_path", str, "Path to the file to analyze", required=True),
            ToolParameter("show_source", bool, "Show source code", required=False, default=False),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        file_path: str,
        show_source: bool = False
    ) -> ToolResult:
        """View the structure of a Python file."""
        path = Path(file_path)
        
        # Check read permission
        if not self._pm.check_read_permission(path):
            return ToolResult.permission_denied("read", str(path))
        
        try:
            if not path.exists():
                return ToolResult.error(f"File not found: {file_path}")
            
            if not path.is_file():
                return ToolResult.error(f"Path is not a file: {file_path}")
            
            # Read file
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                source_code = f.read()
            
            # Analyze with AST
            analyzer = ASTAnalyzer(source_code)
            analysis = analyzer.analyze()
            
            if "error" in analysis:
                return ToolResult.error(analysis["error"])
            
            # Format output
            output_lines = []
            output_lines.append(f"File: {path.name}")
            output_lines.append(f"Lines: {analysis['line_count']}")
            output_lines.append("")
            
            # Show imports
            if analysis['imports']:
                output_lines.append("Imports:")
                for imp in analysis['imports']:
                    if imp['type'] == 'import':
                        line = f"  line {imp['line']}: import {imp['module']}"
                        if imp['alias']:
                            line += f" as {imp['alias']}"
                    else:
                        line = f"  line {imp['line']}: from {imp['module']} import {imp['name']}"
                        if imp['alias']:
                            line += f" as {imp['alias']}"
                    output_lines.append(line)
                output_lines.append("")
            
            # Show symbols
            if analysis['symbols']:
                output_lines.append("Symbols:")
                
                # Group by type
                classes = [s for s in analysis['symbols'] if s['type'] == 'class']
                functions = [s for s in analysis['symbols'] if s['type'] == 'function']
                methods = [s for s in analysis['symbols'] if s['type'] == 'method']
                
                if classes:
                    output_lines.append("  Classes:")
                    for cls in classes:
                        output_lines.append(f"    line {cls['line_start']}: class {cls['name']}")
                        if cls['docstring']:
                            doc_preview = cls['docstring'][:50].replace('\n', ' ')
                            output_lines.append(f"      \"{doc_preview}...\"")
                        
                        # Show methods of this class
                        class_methods = [m for m in methods if m['parent'] == cls['name']]
                        for method in class_methods:
                            params = ', '.join(method['parameters'])
                            output_lines.append(f"      line {method['line_start']}: def {method['name']}({params})")
                
                if functions:
                    output_lines.append("  Functions:")
                    for func in functions:
                        params = ', '.join(func['parameters'])
                        output_lines.append(f"    line {func['line_start']}: def {func['name']}({params})")
                        if func['docstring']:
                            doc_preview = func['docstring'][:50].replace('\n', ' ')
                            output_lines.append(f"      \"{doc_preview}...\"")
            
            output = "\n".join(output_lines)
            
            # Add source if requested
            if show_source:
                output += "\n\n" + "=" * 50 + "\nSource Code:\n" + "=" * 50 + "\n"
                output += source_code
            
            return ToolResult.success(
                output=output,
                metadata={
                    "file_path": str(path.resolve()),
                    "analysis": analysis
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error analyzing file: {str(e)}")


class AnalyzeTool(Tool):
    """Tool for analyzing code quality and complexity."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "analyze"
    
    @property
    def description(self) -> str:
        return "Analyze code for complexity, style issues, and potential problems."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("path", str, "File or directory to analyze", required=True),
            ToolParameter("recursive", bool, "Analyze recursively", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    def _calculate_complexity(self, node: ast.AST) -> int:
        """Calculate cyclomatic complexity of a function."""
        complexity = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
        return complexity
    
    def _analyze_file(self, file_path: Path) -> Dict[str, Any]:
        """Analyze a single file."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                source_code = f.read()
            
            lines = source_code.split('\n')
            
            # Basic metrics
            metrics = {
                "total_lines": len(lines),
                "code_lines": len([l for l in lines if l.strip() and not l.strip().startswith('#')]),
                "blank_lines": len([l for l in lines if not l.strip()]),
                "comment_lines": len([l for l in lines if l.strip().startswith('#')]),
            }
            
            # Try to parse AST
            try:
                tree = ast.parse(source_code)
                
                # Count definitions
                classes = len([n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)])
                functions = len([n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)])
                
                metrics["classes"] = classes
                metrics["functions"] = functions
                
                # Calculate complexity
                complexities = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        complexity = self._calculate_complexity(node)
                        complexities.append({
                            "name": node.name,
                            "line": node.lineno,
                            "complexity": complexity
                        })
                
                metrics["function_complexities"] = complexities
                metrics["average_complexity"] = sum(c["complexity"] for c in complexities) / len(complexities) if complexities else 0
                metrics["max_complexity"] = max((c["complexity"] for c in complexities), default=0)
                
                # Check for issues
                issues = []
                
                # Check for long functions
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        line_count = getattr(node, 'end_lineno', node.lineno) - node.lineno
                        if line_count > 50:
                            issues.append({
                                "type": "long_function",
                                "message": f"Function '{node.name}' is {line_count} lines long",
                                "line": node.lineno,
                                "severity": "warning"
                            })
                
                # Check for bare except
                for node in ast.walk(tree):
                    if isinstance(node, ast.ExceptHandler):
                        if node.type is None:
                            issues.append({
                                "type": "bare_except",
                                "message": "Bare except clause found",
                                "line": node.lineno,
                                "severity": "warning"
                            })
                
                metrics["issues"] = issues
                metrics["issue_count"] = len(issues)
                
            except SyntaxError as e:
                metrics["parse_error"] = str(e)
            
            return metrics
            
        except Exception as e:
            return {"error": str(e)}
    
    async def execute(
        self, 
        path: str,
        recursive: bool = True
    ) -> ToolResult:
        """Analyze code."""
        target_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(target_path):
            return ToolResult.permission_denied("read", str(target_path))
        
        try:
            if not target_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            results = []
            
            if target_path.is_file():
                if target_path.suffix == '.py':
                    results.append({
                        "file": str(target_path),
                        "analysis": self._analyze_file(target_path)
                    })
            elif recursive:
                for root, dirs, files in os.walk(target_path):
                    for filename in files:
                        if filename.endswith('.py'):
                            file_path = Path(root) / filename
                            if self._pm.check_read_permission(file_path):
                                results.append({
                                    "file": str(file_path),
                                    "analysis": self._analyze_file(file_path)
                                })
            else:
                for file_path in target_path.iterdir():
                    if file_path.is_file() and file_path.suffix == '.py':
                        if self._pm.check_read_permission(file_path):
                            results.append({
                                "file": str(file_path),
                                "analysis": self._analyze_file(file_path)
                            })
            
            # Aggregate metrics
            total_lines = sum(r['analysis'].get('total_lines', 0) for r in results)
            total_functions = sum(r['analysis'].get('functions', 0) for r in results)
            total_classes = sum(r['analysis'].get('classes', 0) for r in results)
            total_issues = sum(r['analysis'].get('issue_count', 0) for r in results)
            
            summary = {
                "files_analyzed": len(results),
                "total_lines": total_lines,
                "total_functions": total_functions,
                "total_classes": total_classes,
                "total_issues": total_issues
            }
            
            # Format output
            output_lines = ["Code Analysis Summary:", ""]
            output_lines.append(f"Files analyzed: {summary['files_analyzed']}")
            output_lines.append(f"Total lines: {summary['total_lines']}")
            output_lines.append(f"Total functions: {summary['total_functions']}")
            output_lines.append(f"Total classes: {summary['total_classes']}")
            output_lines.append(f"Total issues: {summary['total_issues']}")
            output_lines.append("")
            
            if results:
                output_lines.append("File Details:")
                for r in results:
                    analysis = r['analysis']
                    output_lines.append(f"\n{r['file']}:")
                    output_lines.append(f"  Lines: {analysis.get('total_lines', 0)}")
                    output_lines.append(f"  Functions: {analysis.get('functions', 0)}")
                    output_lines.append(f"  Classes: {analysis.get('classes', 0)}")
                    if analysis.get('issues'):
                        output_lines.append(f"  Issues: {len(analysis['issues'])}")
                        for issue in analysis['issues']:
                            output_lines.append(f"    - Line {issue['line']}: {issue['message']}")
            
            return ToolResult.success(
                output="\n".join(output_lines),
                metadata={
                    "summary": summary,
                    "results": results
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error analyzing code: {str(e)}")


class DependencyTool(Tool):
    """Tool for analyzing code dependencies."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "dependencies"
    
    @property
    def description(self) -> str:
        return "Analyze code dependencies and imports."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("path", str, "File or directory to analyze", required=True),
            ToolParameter("recursive", bool, "Analyze recursively", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    def _extract_imports(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract imports from a Python file."""
        imports = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                source_code = f.read()
            
            try:
                tree = ast.parse(source_code)
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            imports.append({
                                "type": "import",
                                "module": alias.name,
                                "alias": alias.asname,
                                "line": node.lineno
                            })
                    elif isinstance(node, ast.ImportFrom):
                        module = node.module or ""
                        for alias in node.names:
                            imports.append({
                                "type": "from_import",
                                "module": module,
                                "name": alias.name,
                                "alias": alias.asname,
                                "line": node.lineno
                            })
            except SyntaxError:
                pass
                
        except Exception:
            pass
        
        return imports
    
    async def execute(
        self, 
        path: str,
        recursive: bool = True
    ) -> ToolResult:
        """Analyze dependencies."""
        target_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(target_path):
            return ToolResult.permission_denied("read", str(target_path))
        
        try:
            if not target_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            all_imports = []
            stdlib_modules = set([
                'abc', 'argparse', 'ast', 'asyncio', 'base64', 'collections', 'copy',
                'csv', 'datetime', 'decimal', 'enum', 'functools', 'glob', 'hashlib',
                'http', 'importlib', 'inspect', 'io', 'itertools', 'json', 'logging',
                'math', 'multiprocessing', 'operator', 'os', 'pathlib', 'pickle',
                'random', 're', 'shutil', 'socket', 'sqlite3', 'string', 'subprocess',
                'sys', 'tempfile', 'threading', 'time', 'typing', 'unittest', 'urllib',
                'uuid', 'warnings', 'xml', 'zipfile'
            ])
            
            if target_path.is_file():
                imports = self._extract_imports(target_path)
                all_imports.extend([{"file": str(target_path), **imp} for imp in imports])
            elif recursive:
                for root, dirs, files in os.walk(target_path):
                    for filename in files:
                        if filename.endswith('.py'):
                            file_path = Path(root) / filename
                            if self._pm.check_read_permission(file_path):
                                imports = self._extract_imports(file_path)
                                all_imports.extend([{"file": str(file_path), **imp} for imp in imports])
            
            # Categorize imports
            stdlib_imports = []
            third_party_imports = []
            local_imports = []
            
            for imp in all_imports:
                module = imp.get('module', '')
                base_module = module.split('.')[0] if module else ''
                
                if base_module in stdlib_modules:
                    stdlib_imports.append(imp)
                elif module.startswith('.') or module.startswith(target_path.name):
                    local_imports.append(imp)
                else:
                    third_party_imports.append(imp)
            
            # Get unique modules
            stdlib_modules_used = set(imp['module'].split('.')[0] for imp in stdlib_imports if imp.get('module'))
            third_party_modules = set(imp['module'].split('.')[0] for imp in third_party_imports if imp.get('module'))
            
            # Format output
            output_lines = ["Dependency Analysis:", ""]
            
            output_lines.append(f"Total imports: {len(all_imports)}")
            output_lines.append(f"Standard library: {len(stdlib_imports)}")
            output_lines.append(f"Third-party: {len(third_party_imports)}")
            output_lines.append(f"Local: {len(local_imports)}")
            output_lines.append("")
            
            if stdlib_modules_used:
                output_lines.append("Standard Library Modules:")
                for mod in sorted(stdlib_modules_used):
                    output_lines.append(f"  - {mod}")
                output_lines.append("")
            
            if third_party_modules:
                output_lines.append("Third-Party Modules:")
                for mod in sorted(third_party_modules):
                    output_lines.append(f"  - {mod}")
                output_lines.append("")
            
            return ToolResult.success(
                output="\n".join(output_lines),
                metadata={
                    "total_imports": len(all_imports),
                    "stdlib": {
                        "count": len(stdlib_imports),
                        "modules": sorted(stdlib_modules_used)
                    },
                    "third_party": {
                        "count": len(third_party_imports),
                        "modules": sorted(third_party_modules)
                    },
                    "local": {
                        "count": len(local_imports)
                    },
                    "all_imports": all_imports
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error analyzing dependencies: {str(e)}")


class CodeSearchTool(Tool):
    """Tool for searching code by symbol name or pattern."""
    
    def __init__(self, permission_manager: Optional[PermissionManager] = None):
        super().__init__(permission_manager)
        self._pm = permission_manager or get_permission_manager()
    
    @property
    def name(self) -> str:
        return "code_search"
    
    @property
    def description(self) -> str:
        return "Search for symbols (functions, classes, etc.) in code."
    
    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("query", str, "Symbol name or pattern to search for", required=True),
            ToolParameter("path", str, "Directory to search in", required=False, default="."),
            ToolParameter("symbol_type", str, "Type of symbol: 'function', 'class', 'all'", required=False, default="all"),
            ToolParameter("recursive", bool, "Search recursively", required=False, default=True),
        ]
    
    @property
    def required_permissions(self) -> List[str]:
        return ["read"]
    
    async def execute(
        self, 
        query: str,
        path: str = ".",
        symbol_type: str = "all",
        recursive: bool = True
    ) -> ToolResult:
        """Search for symbols in code."""
        search_path = Path(path)
        
        # Check read permission
        if not self._pm.check_read_permission(search_path):
            return ToolResult.permission_denied("read", str(search_path))
        
        try:
            if not search_path.exists():
                return ToolResult.error(f"Path not found: {path}")
            
            matches = []
            
            def search_file(file_path: Path) -> None:
                """Search a single file."""
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        source_code = f.read()
                    
                    try:
                        tree = ast.parse(source_code)
                        
                        for node in ast.walk(tree):
                            if isinstance(node, ast.ClassDef):
                                if symbol_type in ('all', 'class') and query in node.name:
                                    matches.append({
                                        "file": str(file_path),
                                        "type": "class",
                                        "name": node.name,
                                        "line": node.lineno
                                    })
                            elif isinstance(node, ast.FunctionDef):
                                if symbol_type in ('all', 'function') and query in node.name:
                                    matches.append({
                                        "file": str(file_path),
                                        "type": "function",
                                        "name": node.name,
                                        "line": node.lineno
                                    })
                    except SyntaxError:
                        pass
                        
                except Exception:
                    pass
            
            if search_path.is_file():
                if search_path.suffix == '.py':
                    search_file(search_path)
            elif recursive:
                for root, dirs, files in os.walk(search_path):
                    for filename in files:
                        if filename.endswith('.py'):
                            file_path = Path(root) / filename
                            if self._pm.check_read_permission(file_path):
                                search_file(file_path)
            
            # Format output
            output_lines = [f"Code Search Results for '{query}':", ""]
            output_lines.append(f"Found {len(matches)} match(es)")
            output_lines.append("")
            
            for match in matches:
                output_lines.append(f"{match['file']}:{match['line']} - {match['type']} {match['name']}")
            
            return ToolResult.success(
                output="\n".join(output_lines),
                metadata={
                    "query": query,
                    "symbol_type": symbol_type,
                    "match_count": len(matches),
                    "matches": matches
                }
            )
            
        except Exception as e:
            return ToolResult.error(f"Error searching code: {str(e)}")
