"""
Loader - Plugin and skill loading utilities.
"""

import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any, Type
import logging

from .core import Plugin, PluginMetadata, PluginCapabilities
from .skills import Skill, SkillMetadata, SkillType, SkillLevel


logger = logging.getLogger(__name__)


class PluginLoader:
    """
    Loads plugins from various sources.
    """
    
    @staticmethod
    def load_from_directory(directory: str) -> List[Type[Plugin]]:
        """
        Load all plugins from a directory.
        
        Args:
            directory: Path to plugin directory
            
        Returns:
            List of plugin classes
        """
        plugins = []
        path = Path(directory)
        
        if not path.exists():
            logger.warning(f"Plugin directory not found: {directory}")
            return plugins
            
        for item in path.iterdir():
            if item.is_dir():
                plugin_class = PluginLoader.load_from_module(item)
                if plugin_class:
                    plugins.append(plugin_class)
                    
        return plugins
        
    @staticmethod
    def load_from_module(module_path: Path) -> Optional[Type[Plugin]]:
        """
        Load a plugin from a module path.
        
        Args:
            module_path: Path to plugin module
            
        Returns:
            Plugin class or None
        """
        import importlib.util
        import sys
        
        try:
            # Find main file
            if (module_path / "plugin.py").exists():
                main_file = module_path / "plugin.py"
            elif (module_path / "__init__.py").exists():
                main_file = module_path / "__init__.py"
            else:
                return None
                
            # Load module
            spec = importlib.util.spec_from_file_location(
                module_path.name,
                main_file
            )
            
            if not spec or not spec.loader:
                return None
                
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_path.name] = module
            spec.loader.exec_module(module)
            
            # Find Plugin subclass
            for name in dir(module):
                obj = getattr(module, name)
                if (isinstance(obj, type) and 
                    issubclass(obj, Plugin) and 
                    obj is not Plugin):
                    return obj
                    
        except Exception as e:
            logger.error(f"Failed to load plugin from {module_path}: {e}")
            
        return None
        
    @staticmethod
    def load_manifest(manifest_path: str) -> Optional[Dict[str, Any]]:
        """
        Load plugin manifest.
        
        Args:
            manifest_path: Path to manifest file
            
        Returns:
            Manifest dictionary or None
        """
        path = Path(manifest_path)
        
        if not path.exists():
            return None
            
        try:
            with open(path, 'r') as f:
                if path.suffix == '.json':
                    return json.load(f)
                elif path.suffix in ['.yml', '.yaml']:
                    return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load manifest: {e}")
            
        return None
        
    @staticmethod
    def create_plugin_from_manifest(manifest: Dict[str, Any]) -> Optional[Type[Plugin]]:
        """
        Create a plugin class from manifest.
        
        Args:
            manifest: Plugin manifest
            
        Returns:
            Plugin class or None
        """
        # Create metadata
        metadata = PluginMetadata(
            name=manifest.get('name', 'unnamed'),
            version=manifest.get('version', '0.0.1'),
            description=manifest.get('description', ''),
            author=manifest.get('author', ''),
            license=manifest.get('license', ''),
            homepage=manifest.get('homepage', ''),
            dependencies=manifest.get('dependencies', []),
            tags=manifest.get('tags', []),
            min_api_version=manifest.get('min_api_version', '1.0'),
            max_api_version=manifest.get('max_api_version', ''),
        )
        
        capabilities = PluginCapabilities(
            hooks=manifest.get('capabilities', {}).get('hooks', []),
            commands=manifest.get('capabilities', {}).get('commands', []),
            tools=manifest.get('capabilities', {}).get('tools', []),
            file_extensions=manifest.get('capabilities', {}).get('file_extensions', []),
            languages=manifest.get('capabilities', {}).get('languages', []),
        )
        
        # Create dynamic plugin class
        class DynamicPlugin(Plugin):
            METADATA = metadata
            CAPABILITIES = capabilities
            
            def on_initialize(self) -> bool:
                # Load initialization code from manifest
                init_code = manifest.get('initialization', {})
                # Would execute initialization
                return True
                
            def on_shutdown(self) -> bool:
                # Load shutdown code from manifest
                return True
                
        DynamicPlugin.__name__ = metadata.name
        
        return DynamicPlugin


class SkillLoader:
    """
    Loads skills from various sources.
    """
    
    @staticmethod
    def load_from_directory(directory: str) -> List[Type[Skill]]:
        """
        Load all skills from a directory.
        
        Args:
            directory: Path to skills directory
            
        Returns:
            List of skill classes
        """
        skills = []
        path = Path(directory)
        
        if not path.exists():
            logger.warning(f"Skills directory not found: {directory}")
            return skills
            
        for item in path.iterdir():
            if item.suffix == '.py':
                skill_class = SkillLoader.load_from_file(item)
                if skill_class:
                    skills.append(skill_class)
                    
        return skills
        
    @staticmethod
    def load_from_file(filepath: Path) -> Optional[Type[Skill]]:
        """
        Load a skill from a file.
        
        Args:
            filepath: Path to skill file
            
        Returns:
            Skill class or None
        """
        import importlib.util
        import sys
        
        try:
            spec = importlib.util.spec_from_file_location(
                filepath.stem,
                filepath
            )
            
            if not spec or not spec.loader:
                return None
                
            module = importlib.util.module_from_spec(spec)
            sys.modules[filepath.stem] = module
            spec.loader.exec_module(module)
            
            # Find Skill subclass
            for name in dir(module):
                obj = getattr(module, name)
                if (isinstance(obj, type) and 
                    issubclass(obj, Skill) and 
                    obj is not Skill):
                    return obj
                    
        except Exception as e:
            logger.error(f"Failed to load skill from {filepath}: {e}")
            
        return None
        
    @staticmethod
    def load_from_dict(data: Dict[str, Any]) -> Optional[Type[Skill]]:
        """
        Create a skill class from dictionary.
        
        Args:
            data: Skill definition
            
        Returns:
            Skill class or None
        """
        metadata = SkillMetadata(
            name=data.get('name', 'unnamed_skill'),
            description=data.get('description', ''),
            type=SkillType[data.get('type', 'CUSTOM')],
            level=SkillLevel[data.get('level', 'NOVICE')],
            tags=data.get('tags', []),
            examples=data.get('examples', []),
            triggers=data.get('triggers', []),
        )
        
        # Create dynamic skill class
        class DynamicSkill(Skill):
            METADATA = metadata
            
            async def _execute(self, context):
                # Execute logic from data
                logic = data.get('logic', {})
                # Would execute skill logic
                return {"executed": True}
                
        DynamicSkill.__name__ = metadata.name
        
        return DynamicSkill


class PluginRegistry:
    """
    Central registry for plugin metadata.
    """
    
    def __init__(self):
        self._plugins: Dict[str, Dict[str, Any]] = {}
        self._by_tag: Dict[str, List[str]] = {}
        self._by_capability: Dict[str, List[str]] = {}
        
    def register(self, plugin_class: Type[Plugin]) -> None:
        """Register a plugin class."""
        metadata = plugin_class.METADATA
        
        self._plugins[metadata.name] = {
            "name": metadata.name,
            "version": metadata.version,
            "description": metadata.description,
            "author": metadata.author,
            "tags": metadata.tags,
            "capabilities": plugin_class.CAPABILITIES,
            "class": plugin_class,
        }
        
        # Index by tags
        for tag in metadata.tags:
            if tag not in self._by_tag:
                self._by_tag[tag] = []
            self._by_tag[tag].append(metadata.name)
            
        # Index by capabilities
        for cap in plugin_class.CAPABILITIES.hooks:
            key = f"hook:{cap}"
            if key not in self._by_capability:
                self._by_capability[key] = []
            self._by_capability[key].append(metadata.name)
            
    def find_by_tag(self, tag: str) -> List[Dict[str, Any]]:
        """Find plugins by tag."""
        return [
            self._plugins[name]
            for name in self._by_tag.get(tag, [])
        ]
        
    def find_by_capability(self, capability: str) -> List[Dict[str, Any]]:
        """Find plugins by capability."""
        return [
            self._plugins[name]
            for name in self._by_capability.get(capability, [])
        ]
        
    def get(self, name: str) -> Optional[Dict[str, Any]]:
        """Get plugin info by name."""
        return self._plugins.get(name)
        
    def list_all(self) -> List[Dict[str, Any]]:
        """List all registered plugins."""
        return list(self._plugins.values())
