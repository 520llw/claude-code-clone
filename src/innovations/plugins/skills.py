"""
Skills - Skill system for domain-specific capabilities.
"""

from typing import Dict, List, Optional, Any, Callable, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
import asyncio
import logging


logger = logging.getLogger(__name__)


class SkillType(Enum):
    """Types of skills."""
    CODE = auto()
    ANALYSIS = auto()
    CREATIVE = auto()
    RESEARCH = auto()
    COMMUNICATION = auto()
    AUTOMATION = auto()
    CUSTOM = auto()


class SkillLevel(Enum):
    """Skill proficiency levels."""
    NOVICE = 1
    INTERMEDIATE = 2
    ADVANCED = 3
    EXPERT = 4
    MASTER = 5


@dataclass
class SkillResult:
    """Result of skill execution."""
    success: bool
    output: Any
    execution_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class SkillContext:
    """Context for skill execution."""
    user_input: str
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    files: List[str] = field(default_factory=list)
    environment: Dict[str, Any] = field(default_factory=dict)
    preferences: Dict[str, Any] = field(default_factory=dict)
    
    def get_file_content(self, filepath: str) -> Optional[str]:
        """Get content of a file."""
        try:
            with open(filepath, 'r') as f:
                return f.read()
        except Exception:
            return None


@dataclass
class SkillMetadata:
    """Skill metadata."""
    name: str
    description: str
    type: SkillType
    level: SkillLevel
    tags: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    triggers: List[str] = field(default_factory=list)


class Skill:
    """
    Base class for skills.
    
    Skills are domain-specific capabilities that can be
    dynamically loaded and executed.
    """
    
    METADATA: SkillMetadata = SkillMetadata(
        name="base_skill",
        description="Base skill class",
        type=SkillType.CUSTOM,
        level=SkillLevel.NOVICE
    )
    
    def __init__(self):
        self._initialized = False
        self._execution_count = 0
        self._last_used: Optional[datetime] = None
        
    @property
    def name(self) -> str:
        """Get skill name."""
        return self.METADATA.name
        
    def can_handle(self, context: SkillContext) -> float:
        """
        Check if this skill can handle the request.
        
        Returns:
            Confidence score (0.0 to 1.0)
        """
        # Check triggers
        for trigger in self.METADATA.triggers:
            if trigger.lower() in context.user_input.lower():
                return 0.8
                
        return 0.0
        
    async def execute(self, context: SkillContext) -> SkillResult:
        """
        Execute the skill.
        
        Args:
            context: Execution context
            
        Returns:
            SkillResult
        """
        start_time = datetime.now()
        
        try:
            result = await self._execute(context)
            
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            self._execution_count += 1
            self._last_used = datetime.now()
            
            return SkillResult(
                success=True,
                output=result,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            logger.error(f"Skill {self.name} execution error: {e}")
            
            return SkillResult(
                success=False,
                output=None,
                execution_time_ms=execution_time,
                error=str(e)
            )
            
    async def _execute(self, context: SkillContext) -> Any:
        """
        Override this method to implement skill logic.
        
        Args:
            context: Execution context
            
        Returns:
            Skill output
        """
        raise NotImplementedError("Skills must implement _execute")
        
    async def stream_execute(self, context: SkillContext) -> AsyncIterator[str]:
        """
        Stream execution results.
        
        Args:
            context: Execution context
            
        Yields:
            Output chunks
        """
        # Default implementation - just yield final result
        result = await self.execute(context)
        if result.success:
            yield str(result.output)
        else:
            yield f"Error: {result.error}"
            
    def get_stats(self) -> Dict[str, Any]:
        """Get skill statistics."""
        return {
            "name": self.name,
            "type": self.METADATA.type.name,
            "level": self.METADATA.level.name,
            "execution_count": self._execution_count,
            "last_used": self._last_used.isoformat() if self._last_used else None,
        }


# Example skills

class CodeReviewSkill(Skill):
    """Skill for reviewing code."""
    
    METADATA = SkillMetadata(
        name="code_review",
        description="Review code for issues and improvements",
        type=SkillType.CODE,
        level=SkillLevel.ADVANCED,
        tags=["code", "review", "quality"],
        examples=[
            "Review this code",
            "Check for bugs",
            "What issues do you see?"
        ],
        triggers=["review", "check", "issues", "bugs"]
    )
    
    async def _execute(self, context: SkillContext) -> Any:
        """Execute code review."""
        results = []
        
        for filepath in context.files:
            content = context.get_file_content(filepath)
            if content:
                # Simple checks
                issues = []
                
                if 'TODO' in content:
                    issues.append("Contains TODO comments")
                if 'FIXME' in content:
                    issues.append("Contains FIXME comments")
                if len(content) > 1000 and content.count('\n') < 10:
                    issues.append("Long lines detected")
                    
                results.append({
                    "file": filepath,
                    "issues": issues
                })
                
        return results


class DocumentationSkill(Skill):
    """Skill for generating documentation."""
    
    METADATA = SkillMetadata(
        name="documentation",
        description="Generate documentation for code",
        type=SkillType.CODE,
        level=SkillLevel.INTERMEDIATE,
        tags=["docs", "documentation", "comments"],
        examples=[
            "Document this function",
            "Add docstrings",
            "Generate README"
        ],
        triggers=["document", "docstring", "readme"]
    )
    
    async def _execute(self, context: SkillContext) -> Any:
        """Generate documentation."""
        docs = []
        
        for filepath in context.files:
            content = context.get_file_content(filepath)
            if content:
                # Extract functions/classes
                import re
                
                # Find Python functions
                functions = re.findall(
                    r'def\s+(\w+)\s*\([^)]*\)',
                    content
                )
                
                docs.append({
                    "file": filepath,
                    "functions": functions,
                    "suggested_docstring": f'"""\n{filepath} - Auto-generated documentation\n"""'
                })
                
        return docs


class RefactoringSkill(Skill):
    """Skill for code refactoring suggestions."""
    
    METADATA = SkillMetadata(
        name="refactoring",
        description="Suggest code refactoring improvements",
        type=SkillType.CODE,
        level=SkillLevel.EXPERT,
        tags=["refactor", "improve", "clean"],
        examples=[
            "How can I improve this code?",
            "Refactor this function",
            "Make this cleaner"
        ],
        triggers=["refactor", "improve", "clean", "simplify"]
    )
    
    async def _execute(self, context: SkillContext) -> Any:
        """Generate refactoring suggestions."""
        suggestions = []
        
        for filepath in context.files:
            content = context.get_file_content(filepath)
            if content:
                # Simple refactoring suggestions
                if content.count('if') > 5:
                    suggestions.append({
                        "file": filepath,
                        "suggestion": "Consider using a dictionary or strategy pattern for multiple if statements"
                    })
                    
                if 'for' in content and 'range(len(' in content:
                    suggestions.append({
                        "file": filepath,
                        "suggestion": "Use enumerate() instead of range(len())"
                    })
                    
        return suggestions


class SkillRegistry:
    """
    Registry for managing skills.
    """
    
    def __init__(self):
        self._skills: Dict[str, Skill] = {}
        self._by_type: Dict[SkillType, List[str]] = {t: [] for t in SkillType}
        self._by_tag: Dict[str, List[str]] = {}
        
    def register(self, skill: Skill) -> None:
        """Register a skill."""
        self._skills[skill.name] = skill
        
        # Index by type
        self._by_type[skill.METADATA.type].append(skill.name)
        
        # Index by tags
        for tag in skill.METADATA.tags:
            if tag not in self._by_tag:
                self._by_tag[tag] = []
            self._by_tag[tag].append(skill.name)
            
        logger.info(f"Registered skill: {skill.name}")
        
    def unregister(self, skill_name: str) -> bool:
        """Unregister a skill."""
        if skill_name not in self._skills:
            return False
            
        skill = self._skills[skill_name]
        
        # Remove from indices
        self._by_type[skill.METADATA.type].remove(skill_name)
        
        for tag in skill.METADATA.tags:
            if tag in self._by_tag:
                self._by_tag[tag].remove(skill_name)
                
        del self._skills[skill_name]
        return True
        
    def get(self, name: str) -> Optional[Skill]:
        """Get a skill by name."""
        return self._skills.get(name)
        
    def find_best_match(self, context: SkillContext) -> Optional[Skill]:
        """Find the best skill for a context."""
        best_skill = None
        best_score = 0.0
        
        for skill in self._skills.values():
            score = skill.can_handle(context)
            if score > best_score:
                best_score = score
                best_skill = skill
                
        return best_skill if best_score > 0.5 else None
        
    def find_by_type(self, skill_type: SkillType) -> List[Skill]:
        """Find skills by type."""
        return [
            self._skills[name]
            for name in self._by_type.get(skill_type, [])
        ]
        
    def find_by_tag(self, tag: str) -> List[Skill]:
        """Find skills by tag."""
        return [
            self._skills[name]
            for name in self._by_tag.get(tag, [])
        ]
        
    def list_skills(self) -> List[Dict[str, Any]]:
        """List all registered skills."""
        return [
            {
                "name": s.name,
                "description": s.METADATA.description,
                "type": s.METADATA.type.name,
                "level": s.METADATA.level.name,
                "tags": s.METADATA.tags,
            }
            for s in self._skills.values()
        ]
        
    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        return {
            "total_skills": len(self._skills),
            "by_type": {
                t.name: len(names)
                for t, names in self._by_type.items()
            },
            "tags": len(self._by_tag),
        }
