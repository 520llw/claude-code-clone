"""
Commands - Voice command processing.
"""

import re
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass
from enum import Enum, auto
import logging


logger = logging.getLogger(__name__)


class CommandType(Enum):
    """Types of voice commands."""
    # Navigation
    OPEN = auto()
    CLOSE = auto()
    GO_TO = auto()
    BACK = auto()
    FORWARD = auto()
    
    # Actions
    CREATE = auto()
    DELETE = auto()
    EDIT = auto()
    SAVE = auto()
    RUN = auto()
    STOP = auto()
    
    # Search
    SEARCH = auto()
    FIND = auto()
    REPLACE = auto()
    
    # Communication
    SEND = auto()
    CALL = auto()
    MESSAGE = auto()
    
    # System
    HELP = auto()
    SETTINGS = auto()
    STATUS = auto()
    EXIT = auto()
    
    # Custom
    CUSTOM = auto()


@dataclass
class VoiceCommand:
    """Parsed voice command."""
    type: CommandType
    raw_text: str
    confidence: float
    parameters: Dict[str, Any]
    target: Optional[str] = None
    action: Optional[str] = None


class VoiceCommandProcessor:
    """
    Processes voice input into structured commands.
    
    Features:
    - Natural language parsing
    - Command pattern matching
    - Parameter extraction
    - Context awareness
    """
    
    # Command patterns
    PATTERNS: Dict[CommandType, List[str]] = {
        CommandType.OPEN: [
            r"open\s+(?:the\s+)?(.+)",
            r"show\s+(?:me\s+)?(?:the\s+)?(.+)",
            r"display\s+(?:the\s+)?(.+)",
            r"go\s+to\s+(.+)",
        ],
        CommandType.CLOSE: [
            r"close\s+(?:the\s+)?(.+)",
            r"hide\s+(?:the\s+)?(.+)",
            r"exit\s+(?:the\s+)?(.+)",
        ],
        CommandType.CREATE: [
            r"create\s+(?:a\s+|an\s+|new\s+)?(.+)",
            r"make\s+(?:a\s+|an\s+|new\s+)?(.+)",
            r"add\s+(?:a\s+|an\s+|new\s+)?(.+)",
        ],
        CommandType.DELETE: [
            r"delete\s+(?:the\s+)?(.+)",
            r"remove\s+(?:the\s+)?(.+)",
            r"destroy\s+(?:the\s+)?(.+)",
        ],
        CommandType.EDIT: [
            r"edit\s+(?:the\s+)?(.+)",
            r"modify\s+(?:the\s+)?(.+)",
            r"change\s+(?:the\s+)?(.+)",
        ],
        CommandType.SAVE: [
            r"save\s+(?:the\s+)?(.+)",
            r"save",
            r"store\s+(?:the\s+)?(.+)",
        ],
        CommandType.RUN: [
            r"run\s+(?:the\s+)?(.+)",
            r"execute\s+(?:the\s+)?(.+)",
            r"start\s+(?:the\s+)?(.+)",
            r"launch\s+(?:the\s+)?(.+)",
        ],
        CommandType.STOP: [
            r"stop\s+(?:the\s+)?(.+)",
            r"halt\s+(?:the\s+)?(.+)",
            r"cancel\s+(?:the\s+)?(.+)",
            r"end\s+(?:the\s+)?(.+)",
        ],
        CommandType.SEARCH: [
            r"search\s+(?:for\s+)?(.+)",
            r"find\s+(?:the\s+)?(.+)",
            r"look\s+(?:for\s+)?(.+)",
        ],
        CommandType.FIND: [
            r"find\s+(?:the\s+)?(.+)",
            r"locate\s+(?:the\s+)?(.+)",
        ],
        CommandType.REPLACE: [
            r"replace\s+(.+)\s+with\s+(.+)",
            r"change\s+(.+)\s+to\s+(.+)",
        ],
        CommandType.SEND: [
            r"send\s+(?:the\s+)?(.+)",
            r"email\s+(?:the\s+)?(.+)",
            r"message\s+(?:the\s+)?(.+)",
        ],
        CommandType.HELP: [
            r"help",
            r"help\s+me",
            r"what\s+can\s+you\s+do",
            r"show\s+commands",
        ],
        CommandType.SETTINGS: [
            r"open\s+settings",
            r"show\s+settings",
            r"change\s+settings",
            r"preferences",
        ],
        CommandType.STATUS: [
            r"status",
            r"what's\s+the\s+status",
            r"show\s+status",
        ],
        CommandType.EXIT: [
            r"exit",
            r"quit",
            r"goodbye",
            r"bye",
        ],
    }
    
    def __init__(self):
        self._handlers: Dict[CommandType, List[Callable[[VoiceCommand], Any]]] = {
            ct: [] for ct in CommandType
        }
        self._custom_patterns: Dict[str, CommandType] = {}
        self._context: Dict[str, Any] = {}
        
    def register_handler(
        self,
        command_type: CommandType,
        handler: Callable[[VoiceCommand], Any]
    ) -> None:
        """Register a handler for a command type."""
        self._handlers[command_type].append(handler)
        
    def register_custom_pattern(
        self,
        pattern: str,
        command_type: CommandType
    ) -> None:
        """Register a custom command pattern."""
        self._custom_patterns[pattern] = command_type
        
    def set_context(self, key: str, value: Any) -> None:
        """Set context for command processing."""
        self._context[key] = value
        
    def process(self, text: str, confidence: float = 1.0) -> Optional[VoiceCommand]:
        """
        Process voice input into a command.
        
        Args:
            text: Recognized speech text
            confidence: Recognition confidence
            
        Returns:
            VoiceCommand or None if no match
        """
        text_lower = text.lower().strip()
        
        # Try built-in patterns
        for command_type, patterns in self.PATTERNS.items():
            for pattern in patterns:
                match = re.match(pattern, text_lower)
                if match:
                    return self._create_command(
                        command_type,
                        text,
                        confidence,
                        match.groups()
                    )
                    
        # Try custom patterns
        for pattern, command_type in self._custom_patterns.items():
            match = re.match(pattern, text_lower)
            if match:
                return self._create_command(
                    command_type,
                    text,
                    confidence,
                    match.groups()
                )
                
        # No match - could be custom command
        return VoiceCommand(
            type=CommandType.CUSTOM,
            raw_text=text,
            confidence=confidence,
            parameters={"text": text}
        )
        
    def _create_command(
        self,
        command_type: CommandType,
        raw_text: str,
        confidence: float,
        groups: tuple
    ) -> VoiceCommand:
        """Create a VoiceCommand from pattern match."""
        parameters = {}
        target = None
        action = None
        
        if groups:
            target = groups[0]
            parameters["target"] = target
            
        if len(groups) > 1:
            parameters["value"] = groups[1]
            
        # Extract additional parameters
        parameters.update(self._extract_parameters(raw_text))
        
        return VoiceCommand(
            type=command_type,
            raw_text=raw_text,
            confidence=confidence,
            parameters=parameters,
            target=target,
            action=command_type.name.lower()
        )
        
    def _extract_parameters(self, text: str) -> Dict[str, Any]:
        """Extract additional parameters from text."""
        params = {}
        
        # Extract numbers
        numbers = re.findall(r'\b\d+\b', text)
        if numbers:
            params["numbers"] = [int(n) for n in numbers]
            
        # Extract quoted strings
        quotes = re.findall(r'["\']([^"\']+)["\']', text)
        if quotes:
            params["quoted"] = quotes
            
        # Extract file paths
        paths = re.findall(r'[\w\-/\\]+\.[\w]+', text)
        if paths:
            params["files"] = paths
            
        return params
        
    async def execute(self, command: VoiceCommand) -> Any:
        """
        Execute a command using registered handlers.
        
        Args:
            command: VoiceCommand to execute
            
        Returns:
            Handler result
        """
        handlers = self._handlers.get(command.type, [])
        
        if not handlers:
            logger.warning(f"No handlers for command type: {command.type}")
            return None
            
        # Execute first handler
        handler = handlers[0]
        
        try:
            if asyncio.iscoroutinefunction(handler):
                return await handler(command)
            else:
                return handler(command)
        except Exception as e:
            logger.error(f"Command handler error: {e}")
            raise
            
    def get_available_commands(self) -> List[Dict[str, Any]]:
        """Get list of available commands."""
        commands = []
        
        for command_type, patterns in self.PATTERNS.items():
            example = patterns[0].replace(r'\s+', ' ').replace(r'(.+)', '...')
            commands.append({
                "type": command_type.name,
                "example": example,
                "description": self._get_description(command_type)
            })
            
        return commands
        
    def _get_description(self, command_type: CommandType) -> str:
        """Get description for command type."""
        descriptions = {
            CommandType.OPEN: "Open or display something",
            CommandType.CLOSE: "Close or hide something",
            CommandType.CREATE: "Create something new",
            CommandType.DELETE: "Delete or remove something",
            CommandType.EDIT: "Edit or modify something",
            CommandType.SAVE: "Save current work",
            CommandType.RUN: "Run or execute something",
            CommandType.STOP: "Stop or cancel something",
            CommandType.SEARCH: "Search for information",
            CommandType.FIND: "Find something specific",
            CommandType.REPLACE: "Replace text or content",
            CommandType.SEND: "Send a message or email",
            CommandType.HELP: "Get help information",
            CommandType.SETTINGS: "Open settings",
            CommandType.STATUS: "Check system status",
            CommandType.EXIT: "Exit the application",
            CommandType.CUSTOM: "Custom command",
        }
        return descriptions.get(command_type, "Unknown command")


# Common command handlers
class CommandHandlers:
    """Built-in command handlers."""
    
    @staticmethod
    async def handle_open(command: VoiceCommand) -> str:
        """Handle open command."""
        target = command.target or "unknown"
        return f"Opening {target}..."
        
    @staticmethod
    async def handle_create(command: VoiceCommand) -> str:
        """Handle create command."""
        target = command.target or "item"
        return f"Creating new {target}..."
        
    @staticmethod
    async def handle_search(command: VoiceCommand) -> str:
        """Handle search command."""
        target = command.target or ""
        return f"Searching for '{target}'..."
        
    @staticmethod
    async def handle_help(command: VoiceCommand) -> str:
        """Handle help command."""
        return """Available voice commands:
        - Open [item]
        - Create [something]
        - Search for [query]
        - Save
        - Run [command]
        - Help
        Say "show commands" for more options.
        """
