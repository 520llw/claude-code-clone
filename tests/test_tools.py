"""
Tests for the Claude Code Tool System.
"""

import asyncio
import tempfile
import os
from pathlib import Path
import pytest

# Add src to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tools.base import ToolResult, ToolStatus
from tools.permission import PermissionManager, PermissionType
from tools.file_tools import ReadTool, WriteTool, EditTool, GlobTool, GrepTool, LSTool
from tools.bash_tool import BashTool
from tools.code_tools import ViewTool, AnalyzeTool
from tools.registry import ToolRegistry, register_default_tools


class TestToolResult:
    """Tests for ToolResult."""
    
    def test_success_result(self):
        result = ToolResult.success(output="test output")
        assert result.is_success()
        assert not result.is_error()
        assert result.output == "test output"
    
    def test_error_result(self):
        result = ToolResult.error("error message")
        assert not result.is_success()
        assert result.is_error()
        assert result.error_message == "error message"
    
    def test_permission_denied_result(self):
        result = ToolResult.permission_denied("read", "/secret")
        assert result.is_permission_denied()
        assert "read" in result.error_message
        assert "/secret" in result.error_message
    
    def test_to_dict(self):
        result = ToolResult.success(output="test", metadata={"key": "value"})
        d = result.to_dict()
        assert d["status"] == "SUCCESS"
        assert d["output"] == "test"
        assert d["metadata"]["key"] == "value"


class TestPermissionManager:
    """Tests for PermissionManager."""
    
    def test_default_paths(self):
        pm = PermissionManager()
        # Should have default safe paths
        assert len(pm.get_trusted_directories()) > 0
    
    def test_add_trusted_directory(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True, write_allowed=True)
            assert pm.check_read_permission(tmpdir)
            assert pm.check_write_permission(tmpdir)
    
    def test_check_read_permission(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("test")
            assert pm.check_read_permission(test_file)
    
    def test_check_write_permission(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, write_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            assert pm.check_write_permission(test_file)
    
    def test_dangerous_command_blocked(self):
        pm = PermissionManager()
        assert not pm.check_execute_permission("rm -rf /")
    
    def test_auto_approve(self):
        pm = PermissionManager()
        pm.set_auto_approve(PermissionType.READ, True)
        # Auto-approve doesn't bypass path checks, just approval flow


class TestReadTool:
    """Tests for ReadTool."""
    
    @pytest.mark.asyncio
    async def test_read_file(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("line 1\nline 2\nline 3")
            
            tool = ReadTool(pm)
            result = await tool.execute(file_path=str(test_file))
            
            assert result.is_success()
            assert "line 1" in result.output
            assert "line 2" in result.output
    
    @pytest.mark.asyncio
    async def test_read_with_offset(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("line 1\nline 2\nline 3")
            
            tool = ReadTool(pm)
            result = await tool.execute(file_path=str(test_file), offset=2)
            
            assert result.is_success()
            assert "line 1" not in result.output
            assert "line 2" in result.output
    
    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self):
        pm = PermissionManager()
        tool = ReadTool(pm)
        result = await tool.execute(file_path="/nonexistent/file.txt")
        assert result.is_error()


class TestWriteTool:
    """Tests for WriteTool."""
    
    @pytest.mark.asyncio
    async def test_write_file(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, write_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            
            tool = WriteTool(pm)
            result = await tool.execute(
                file_path=str(test_file),
                content="Hello, World!"
            )
            
            assert result.is_success()
            assert test_file.exists()
            assert test_file.read_text() == "Hello, World!"
    
    @pytest.mark.asyncio
    async def test_append_file(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, write_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("First line\n")
            
            tool = WriteTool(pm)
            result = await tool.execute(
                file_path=str(test_file),
                content="Second line",
                append=True
            )
            
            assert result.is_success()
            content = test_file.read_text()
            assert "First line" in content
            assert "Second line" in content


class TestEditTool:
    """Tests for EditTool."""
    
    @pytest.mark.asyncio
    async def test_edit_file(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True, write_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("Hello, World!")
            
            tool = EditTool(pm)
            result = await tool.execute(
                file_path=str(test_file),
                old_string="World",
                new_string="Universe"
            )
            
            assert result.is_success()
            assert test_file.read_text() == "Hello, Universe!"
    
    @pytest.mark.asyncio
    async def test_edit_nonexistent_string(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True, write_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("Hello, World!")
            
            tool = EditTool(pm)
            result = await tool.execute(
                file_path=str(test_file),
                old_string="Nonexistent",
                new_string="Replacement"
            )
            
            assert result.is_error()


class TestGlobTool:
    """Tests for GlobTool."""
    
    @pytest.mark.asyncio
    async def test_glob_files(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            (Path(tmpdir) / "test1.py").write_text("")
            (Path(tmpdir) / "test2.py").write_text("")
            (Path(tmpdir) / "test.txt").write_text("")
            
            tool = GlobTool(pm)
            result = await tool.execute(pattern="*.py", path=tmpdir)
            
            assert result.is_success()
            assert len(result.output) == 2


class TestGrepTool:
    """Tests for GrepTool."""
    
    @pytest.mark.asyncio
    async def test_grep_content(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.py"
            test_file.write_text("def hello():\n    pass\n\ndef world():\n    pass")
            
            tool = GrepTool(pm)
            result = await tool.execute(pattern="def ", path=tmpdir)
            
            assert result.is_success()
            assert "def hello" in result.output
            assert "def world" in result.output


class TestBashTool:
    """Tests for BashTool."""
    
    @pytest.mark.asyncio
    async def test_execute_command(self):
        pm = PermissionManager()
        pm.set_auto_approve(PermissionType.EXECUTE, True)
        
        tool = BashTool(pm)
        result = await tool.execute(command="echo 'Hello, World!'")
        
        assert result.is_success()
        assert "Hello, World!" in result.output
    
    @pytest.mark.asyncio
    async def test_execute_with_cwd(self):
        pm = PermissionManager()
        pm.set_auto_approve(PermissionType.EXECUTE, True)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            
            tool = BashTool(pm)
            result = await tool.execute(command="pwd", cwd=tmpdir)
            
            assert result.is_success()
            assert tmpdir in result.output
    
    @pytest.mark.asyncio
    async def test_blocked_command(self):
        pm = PermissionManager()
        
        tool = BashTool(pm)
        result = await tool.execute(command="rm -rf /")
        
        assert result.is_error()
        assert "blocked" in result.output.lower() or result.error_message.lower()


class TestViewTool:
    """Tests for ViewTool."""
    
    @pytest.mark.asyncio
    async def test_view_python_file(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.py"
            test_file.write_text("""
def hello():
    \"\"\"Say hello.\"\"\"
    print("Hello")

class MyClass:
    def method(self):
        pass
""")
            
            tool = ViewTool(pm)
            result = await tool.execute(file_path=str(test_file))
            
            assert result.is_success()
            assert "hello" in result.output.lower()
            assert "MyClass" in result.output


class TestToolRegistry:
    """Tests for ToolRegistry."""
    
    def test_register_tool(self):
        registry = ToolRegistry()
        registry.register(ReadTool, category="file")
        assert registry.has_tool("read")
    
    def test_list_tools(self):
        registry = ToolRegistry()
        registry.register(ReadTool, category="file")
        registry.register(WriteTool, category="file")
        
        tools = registry.list_tools()
        assert "read" in tools
        assert "write" in tools
    
    def test_list_by_category(self):
        registry = ToolRegistry()
        registry.register(ReadTool, category="file")
        registry.register(BashTool, category="shell")
        
        file_tools = registry.list_tools(category="file")
        assert "read" in file_tools
        assert "bash" not in file_tools
    
    @pytest.mark.asyncio
    async def test_execute_tool(self):
        pm = PermissionManager()
        with tempfile.TemporaryDirectory() as tmpdir:
            pm.add_trusted_directory(tmpdir, read_allowed=True)
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("Hello")
            
            registry = ToolRegistry(pm)
            registry.register(ReadTool, category="file")
            
            result = await registry.execute("read", file_path=str(test_file))
            assert result.is_success()
            assert "Hello" in result.output
    
    def test_get_tool_info(self):
        registry = ToolRegistry()
        registry.register(ReadTool, category="file", tags=["read"])
        
        info = registry.get_tool_info("read")
        assert info is not None
        assert info["name"] == "read"
        assert info["category"] == "file"
        assert "read" in info["tags"]


class TestRegisterDefaultTools:
    """Tests for register_default_tools."""
    
    def test_registers_all_tools(self):
        registry = register_default_tools()
        
        # File tools
        assert registry.has_tool("read")
        assert registry.has_tool("write")
        assert registry.has_tool("edit")
        assert registry.has_tool("glob")
        assert registry.has_tool("grep")
        assert registry.has_tool("find")
        assert registry.has_tool("ls")
        
        # Bash tools
        assert registry.has_tool("bash")
        assert registry.has_tool("shell")
        assert registry.has_tool("pipeline")
        
        # Code tools
        assert registry.has_tool("view")
        assert registry.has_tool("analyze")
        assert registry.has_tool("dependencies")
        assert registry.has_tool("code_search")


def run_tests():
    """Run all tests."""
    pytest.main([__file__, "-v"])


if __name__ == "__main__":
    run_tests()
