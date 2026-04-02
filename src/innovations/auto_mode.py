"""
Auto Mode - Intelligent Tool Permission Auto-Approval

A system for automatically approving low-risk tool operations
while learning user preferences over time.
"""

import hashlib
import json
import time
from typing import Dict, List, Optional, Any, Callable, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from collections import defaultdict
import logging


logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Risk levels for operations."""
    NONE = 0        # No risk (reading, listing)
    LOW = 1         # Low risk (safe writes)
    MEDIUM = 2      # Medium risk (modifications)
    HIGH = 3        # High risk (deletions, system changes)
    CRITICAL = 4    # Critical (irreversible, external)


class ApprovalStatus(Enum):
    """Approval decision status."""
    APPROVED = auto()
    DENIED = auto()
    REQUIRES_CONFIRMATION = auto()
    DEFERRED = auto()


@dataclass
class ToolOperation:
    """Represents a tool operation request."""
    tool_name: str
    operation: str
    parameters: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    context: Dict[str, Any] = field(default_factory=dict)
    
    def get_fingerprint(self) -> str:
        """Generate unique fingerprint for this operation pattern."""
        # Create normalized representation
        data = {
            "tool": self.tool_name,
            "operation": self.operation,
            "params": self._normalize_params(self.parameters)
        }
        return hashlib.sha256(
            json.dumps(data, sort_keys=True).encode()
        ).hexdigest()[:16]
        
    def _normalize_params(self, params: Dict) -> Dict:
        """Normalize parameters for comparison."""
        normalized = {}
        for key, value in params.items():
            if isinstance(value, str):
                # Normalize paths
                if '/' in value or '\\' in value:
                    normalized[key] = "<PATH>"
                else:
                    normalized[key] = value
            elif isinstance(value, (int, float, bool)):
                normalized[key] = value
            elif isinstance(value, dict):
                normalized[key] = self._normalize_params(value)
            else:
                normalized[key] = "<VALUE>"
        return normalized


@dataclass
class ApprovalRecord:
    """Record of an approval decision."""
    operation_fingerprint: str
    status: ApprovalStatus
    timestamp: datetime
    user_overridden: bool = False
    risk_level: RiskLevel = RiskLevel.LOW
    execution_time_ms: float = 0.0
    success: bool = True


@dataclass
class RiskProfile:
    """Risk assessment for an operation type."""
    level: RiskLevel
    reasons: List[str] = field(default_factory=list)
    mitigations: List[str] = field(default_factory=list)


class RiskAssessor:
    """
    Assesses risk levels for tool operations.
    """
    
    # Tool-specific risk rules
    TOOL_RISKS: Dict[str, Dict[str, RiskLevel]] = {
        "file_read": {"default": RiskLevel.NONE},
        "file_write": {"default": RiskLevel.MEDIUM},
        "file_delete": {"default": RiskLevel.HIGH},
        "shell": {"default": RiskLevel.HIGH},
        "web_search": {"default": RiskLevel.LOW},
        "browser": {"default": RiskLevel.LOW},
        "code_execute": {"default": RiskLevel.MEDIUM},
        "git": {
            "status": RiskLevel.NONE,
            "log": RiskLevel.NONE,
            "add": RiskLevel.LOW,
            "commit": RiskLevel.MEDIUM,
            "push": RiskLevel.HIGH,
            "reset": RiskLevel.HIGH,
            "checkout": RiskLevel.MEDIUM,
            "branch": RiskLevel.LOW,
            "merge": RiskLevel.HIGH,
            "default": RiskLevel.MEDIUM,
        },
        "database": {
            "select": RiskLevel.NONE,
            "insert": RiskLevel.LOW,
            "update": RiskLevel.MEDIUM,
            "delete": RiskLevel.HIGH,
            "drop": RiskLevel.CRITICAL,
            "default": RiskLevel.MEDIUM,
        },
    }
    
    # High-risk patterns
    DANGEROUS_PATTERNS = [
        r"rm\s+-rf",
        r"DROP\s+TABLE",
        r"DELETE\s+FROM.*WHERE",
        r">\s*/dev/null",
        r"curl.*\|.*sh",
        r"wget.*\|.*sh",
    ]
    
    # Protected paths
    PROTECTED_PATHS = [
        "/etc",
        "/usr",
        "/bin",
        "/sbin",
        "/sys",
        "/proc",
        "C:\\Windows",
        "~/.ssh",
        "~/.gnupg",
    ]
    
    def __init__(self):
        self._custom_rules: List[Callable[[ToolOperation], Optional[RiskLevel]]] = []
        
    def register_custom_rule(self, rule: Callable[[ToolOperation], Optional[RiskLevel]]) -> None:
        """Register a custom risk assessment rule."""
        self._custom_rules.append(rule)
        
    def assess(self, operation: ToolOperation) -> RiskProfile:
        """
        Assess risk for an operation.
        
        Args:
            operation: The operation to assess
            
        Returns:
            RiskProfile with level and reasoning
        """
        reasons = []
        mitigations = []
        
        # Check custom rules first
        for rule in self._custom_rules:
            custom_level = rule(operation)
            if custom_level is not None:
                return RiskProfile(
                    level=custom_level,
                    reasons=["Custom rule matched"],
                    mitigations=[]
                )
        
        # Get base risk from tool/operation
        tool_risks = self.TOOL_RISKS.get(operation.tool_name, {})
        base_level = tool_risks.get(
            operation.operation,
            tool_risks.get("default", RiskLevel.MEDIUM)
        )
        
        reasons.append(f"Base risk for {operation.tool_name}.{operation.operation}")
        
        # Check for dangerous patterns
        params_str = json.dumps(operation.parameters)
        for pattern in self.DANGEROUS_PATTERNS:
            import re
            if re.search(pattern, params_str, re.IGNORECASE):
                base_level = RiskLevel(max(base_level.value, RiskLevel.HIGH.value))
                reasons.append(f"Dangerous pattern detected: {pattern}")
                
        # Check for protected paths
        for protected in self.PROTECTED_PATHS:
            if protected in params_str:
                base_level = RiskLevel(max(base_level.value, RiskLevel.HIGH.value))
                reasons.append(f"Protected path access: {protected}")
                
        # Check for irreversible operations
        if operation.operation in ['delete', 'drop', 'remove', 'destroy']:
            base_level = RiskLevel(max(base_level.value, RiskLevel.HIGH.value))
            reasons.append("Irreversible operation")
            
        # Check for external communication
        if operation.tool_name in ['web', 'http', 'api']:
            base_level = RiskLevel(max(base_level.value, RiskLevel.MEDIUM.value))
            reasons.append("External communication")
            mitigations.append("Verify destination is trusted")
            
        return RiskProfile(
            level=base_level,
            reasons=reasons,
            mitigations=mitigations
        )


class PreferenceLearner:
    """
    Learns user approval preferences over time.
    """
    
    def __init__(self, memory_size: int = 1000):
        self.memory_size = memory_size
        self._history: List[ApprovalRecord] = []
        self._pattern_approvals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "approved": 0,
            "denied": 0,
            "last_decision": None,
            "confidence": 0.0,
        })
        
    def record(self, record: ApprovalRecord) -> None:
        """Record an approval decision."""
        self._history.append(record)
        
        # Trim history if too large
        if len(self._history) > self.memory_size:
            self._history = self._history[-self.memory_size:]
            
        # Update pattern stats
        pattern = record.operation_fingerprint
        stats = self._pattern_approvals[pattern]
        
        if record.status == ApprovalStatus.APPROVED:
            stats["approved"] += 1
        elif record.status == ApprovalStatus.DENIED:
            stats["denied"] += 1
            
        total = stats["approved"] + stats["denied"]
        if total > 0:
            stats["confidence"] = max(stats["approved"], stats["denied"]) / total
        stats["last_decision"] = record.status
        
    def get_confidence(self, fingerprint: str) -> float:
        """Get confidence level for a pattern."""
        stats = self._pattern_approvals.get(fingerprint, {})
        return stats.get("confidence", 0.0)
        
    def get_likely_approval(self, fingerprint: str) -> Optional[ApprovalStatus]:
        """Predict likely approval based on history."""
        stats = self._pattern_approvals.get(fingerprint)
        if not stats:
            return None
            
        if stats["confidence"] < 0.7:
            return None  # Not confident enough
            
        if stats["approved"] > stats["denied"]:
            return ApprovalStatus.APPROVED
        else:
            return ApprovalStatus.DENIED
            
    def get_stats(self) -> Dict[str, Any]:
        """Get learning statistics."""
        total = len(self._history)
        approved = sum(1 for r in self._history if r.status == ApprovalStatus.APPROVED)
        denied = sum(1 for r in self._history if r.status == ApprovalStatus.DENIED)
        
        return {
            "total_decisions": total,
            "approved": approved,
            "denied": denied,
            "patterns_learned": len(self._pattern_approvals),
            "auto_approval_rate": approved / total if total > 0 else 0,
        }


class AutoMode:
    """
    Main auto-approval system.
    
    Features:
    - Intelligent risk assessment
    - Automatic approval of low-risk operations
    - Learning from user preferences
    - Configurable thresholds
    """
    
    def __init__(
        self,
        auto_approve_threshold: RiskLevel = RiskLevel.LOW,
        confidence_threshold: float = 0.8,
        learning_enabled: bool = True
    ):
        self.auto_approve_threshold = auto_approve_threshold
        self.confidence_threshold = confidence_threshold
        self.learning_enabled = learning_enabled
        
        self.risk_assessor = RiskAssessor()
        self.preference_learner = PreferenceLearner()
        
        self._enabled = False
        self._whitelist: Set[str] = set()
        self._blacklist: Set[str] = set()
        self._session_approvals: Dict[str, datetime] = {}
        
    def enable(self) -> None:
        """Enable auto mode."""
        self._enabled = True
        logger.info("Auto mode enabled")
        
    def disable(self) -> None:
        """Disable auto mode."""
        self._enabled = False
        logger.info("Auto mode disabled")
        
    @property
    def is_enabled(self) -> bool:
        """Check if auto mode is enabled."""
        return self._enabled
        
    def add_to_whitelist(self, operation_pattern: str) -> None:
        """Add an operation pattern to whitelist."""
        self._whitelist.add(operation_pattern)
        
    def add_to_blacklist(self, operation_pattern: str) -> None:
        """Add an operation pattern to blacklist."""
        self._blacklist.add(operation_pattern)
        
    def request_approval(
        self,
        tool_name: str,
        operation: str,
        parameters: Dict[str, Any],
        context: Optional[Dict] = None
    ) -> ApprovalStatus:
        """
        Request approval for an operation.
        
        Args:
            tool_name: Name of the tool
            operation: Operation being performed
            parameters: Operation parameters
            context: Additional context
            
        Returns:
            ApprovalStatus
        """
        if not self._enabled:
            return ApprovalStatus.REQUIRES_CONFIRMATION
            
        op = ToolOperation(
            tool_name=tool_name,
            operation=operation,
            parameters=parameters,
            context=context or {}
        )
        
        fingerprint = op.get_fingerprint()
        
        # Check blacklist first
        if fingerprint in self._blacklist:
            return ApprovalStatus.DENIED
            
        # Check whitelist
        if fingerprint in self._whitelist:
            return ApprovalStatus.APPROVED
            
        # Assess risk
        risk_profile = self.risk_assessor.assess(op)
        
        # Check if below auto-approve threshold
        if risk_profile.level.value <= self.auto_approve_threshold.value:
            # Check learning confidence
            if self.learning_enabled:
                confidence = self.preference_learner.get_confidence(fingerprint)
                likely = self.preference_learner.get_likely_approval(fingerprint)
                
                if confidence >= self.confidence_threshold:
                    if likely == ApprovalStatus.APPROVED:
                        return ApprovalStatus.APPROVED
                    elif likely == ApprovalStatus.DENIED:
                        return ApprovalStatus.DENIED
                        
            # No learning data or not confident - auto-approve based on risk
            return ApprovalStatus.APPROVED
            
        # Higher risk - require confirmation
        return ApprovalStatus.REQUIRES_CONFIRMATION
        
    def record_decision(
        self,
        tool_name: str,
        operation: str,
        parameters: Dict[str, Any],
        status: ApprovalStatus,
        user_overridden: bool = False,
        execution_time_ms: float = 0.0,
        success: bool = True
    ) -> None:
        """
        Record a user decision for learning.
        
        Args:
            tool_name: Tool name
            operation: Operation
            parameters: Parameters
            status: Decision made
            user_overridden: Whether user overrode auto decision
            execution_time_ms: Execution time
            success: Whether operation succeeded
        """
        if not self.learning_enabled:
            return
            
        op = ToolOperation(
            tool_name=tool_name,
            operation=operation,
            parameters=parameters
        )
        
        # Assess risk for the record
        risk_profile = self.risk_assessor.assess(op)
        
        record = ApprovalRecord(
            operation_fingerprint=op.get_fingerprint(),
            status=status,
            timestamp=datetime.now(),
            user_overridden=user_overridden,
            risk_level=risk_profile.level,
            execution_time_ms=execution_time_ms,
            success=success
        )
        
        self.preference_learner.record(record)
        
    def get_stats(self) -> Dict[str, Any]:
        """Get auto mode statistics."""
        return {
            "enabled": self._enabled,
            "threshold": self.auto_approve_threshold.name,
            "whitelist_size": len(self._whitelist),
            "blacklist_size": len(self._blacklist),
            "learning": self.preference_learner.get_stats(),
        }
        
    def suggest_auto_approvals(self, count: int = 5) -> List[Dict[str, Any]]:
        """Suggest operations that could be auto-approved."""
        suggestions = []
        
        for fingerprint, stats in self.preference_learner._pattern_approvals.items():
            if stats["confidence"] >= self.confidence_threshold:
                if stats["approved"] > stats["denied"]:
                    if fingerprint not in self._whitelist:
                        suggestions.append({
                            "fingerprint": fingerprint,
                            "confidence": stats["confidence"],
                            "approvals": stats["approved"],
                            "denials": stats["denied"],
                        })
                        
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        return suggestions[:count]
