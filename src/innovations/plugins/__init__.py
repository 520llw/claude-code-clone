"""
Plugins - Plugin and Skill System

A modular system for loading, managing, and executing plugins and skills.
"""

from .core import PluginManager, Plugin, PluginStatus
from .loader import PluginLoader, SkillLoader
from .registry import PluginRegistry, SkillRegistry
from .hooks import HookManager, HookType
from .skills import Skill, SkillContext, SkillResult

__all__ = [
    'PluginManager',
    'Plugin',
    'PluginStatus',
    'PluginLoader',
    'SkillLoader',
    'PluginRegistry',
    'SkillRegistry',
    'HookManager',
    'HookType',
    'Skill',
    'SkillContext',
    'SkillResult',
]
