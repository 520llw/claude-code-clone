"""
Evolution - Buddy evolution system.
"""

from enum import Enum, auto
from dataclasses import dataclass
from typing import Dict, List, Optional, Callable, Any
import random

from .species import Species, get_species, Rarity


class EvolutionCondition(Enum):
    """Conditions that can trigger evolution."""
    LEVEL = auto()
    ITEM = auto()
    HAPPINESS = auto()
    STAT_THRESHOLD = auto()
    TIME = auto()
    LOCATION = auto()
    BATTLE = auto()
    TRADE = auto()
    FRIENDSHIP = auto()
    SPECIAL = auto()


@dataclass
class EvolutionPath:
    """Defines how a buddy evolves."""
    from_species: str
    to_species: str
    condition: EvolutionCondition
    requirements: Dict[str, Any]
    
    def check(self, buddy) -> bool:
        """Check if evolution conditions are met."""
        if buddy.species.id != self.from_species:
            return False
            
        if self.condition == EvolutionCondition.LEVEL:
            return buddy.stats.level >= self.requirements.get("level", 100)
            
        elif self.condition == EvolutionCondition.HAPPINESS:
            return buddy.stats.happiness >= self.requirements.get("happiness", 100)
            
        elif self.condition == EvolutionCondition.ITEM:
            return self.requirements.get("item") in buddy.inventory
            
        elif self.condition == EvolutionCondition.STAT_THRESHOLD:
            stat = self.requirements.get("stat")
            threshold = self.requirements.get("threshold", 100)
            return getattr(buddy.stats, stat, 0) >= threshold
            
        elif self.condition == EvolutionCondition.FRIENDSHIP:
            return buddy.stats.loyalty >= self.requirements.get("loyalty", 100)
            
        return False


class EvolutionSystem:
    """
    Handles buddy evolution.
    
    Evolution transforms a buddy into a more powerful form,
    often changing appearance, type, and stats.
    """
    
    # Evolution paths database
    EVOLUTION_PATHS: Dict[str, List[EvolutionPath]] = {}
    
    @classmethod
    def register_path(cls, path: EvolutionPath) -> None:
        """Register an evolution path."""
        if path.from_species not in cls.EVOLUTION_PATHS:
            cls.EVOLUTION_PATHS[path.from_species] = []
        cls.EVOLUTION_PATHS[path.from_species].append(path)
        
    @classmethod
    def get_possible_evolutions(cls, buddy) -> List[EvolutionPath]:
        """Get all possible evolutions for a buddy."""
        paths = cls.EVOLUTION_PATHS.get(buddy.species.id, [])
        return [p for p in paths if p.check(buddy)]
        
    @classmethod
    def can_evolve(cls, buddy) -> bool:
        """Check if buddy can evolve."""
        return len(cls.get_possible_evolutions(buddy)) > 0
        
    @classmethod
    def evolve(cls, buddy, path: Optional[EvolutionPath] = None) -> Dict[str, Any]:
        """
        Evolve a buddy.
        
        Returns evolution result with changes.
        """
        if path is None:
            possible = cls.get_possible_evolutions(buddy)
            if not possible:
                return {"success": False, "message": "Cannot evolve"}
            path = possible[0]
            
        if not path.check(buddy):
            return {"success": False, "message": "Evolution requirements not met"}
            
        old_species = buddy.species
        new_species = get_species(path.to_species)
        
        if not new_species:
            return {"success": False, "message": "Unknown evolution target"}
            
        # Store old stats
        old_level = buddy.stats.level
        
        # Apply evolution
        buddy.species = new_species
        buddy.is_shiny = buddy.is_shiny  # Keep shiny status
        
        # Boost stats on evolution
        stat_boosts = {
            "max_health": random.randint(10, 20),
            "max_energy": random.randint(10, 20),
            "strength": random.randint(5, 15),
            "intelligence": random.randint(5, 15),
            "speed": random.randint(5, 15),
            "defense": random.randint(5, 15),
        }
        
        for stat, boost in stat_boosts.items():
            current = getattr(buddy.stats, stat)
            setattr(buddy.stats, stat, current + boost)
            
        # Restore health and energy
        buddy.stats.health = buddy.stats.max_health
        buddy.stats.energy = buddy.stats.max_energy
        
        # Big happiness boost
        buddy.stats.happiness = min(100, buddy.stats.happiness + 30)
        
        return {
            "success": True,
            "message": f"Congratulations! {buddy.name} evolved into {new_species.name}!",
            "old_species": old_species.name,
            "new_species": new_species.name,
            "stat_boosts": stat_boosts,
            "animation": "evolution",
            "sound": "evolution_fanfare",
        }


# Register evolution paths

# Pyro -> Inferno -> Phoenix
EvolutionSystem.register_path(EvolutionPath(
    from_species="pyro",
    to_species="inferno",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 16}
))

EvolutionSystem.register_path(EvolutionPath(
    from_species="inferno",
    to_species="phoenix",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 36}
))

# Aquo -> Marina -> Oceanus
EvolutionSystem.register_path(EvolutionPath(
    from_species="aquo",
    to_species="marina",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 16}
))

EvolutionSystem.register_path(EvolutionPath(
    from_species="marina",
    to_species="oceanus",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 36}
))

# Sparky -> Volt -> Raiju
EvolutionSystem.register_path(EvolutionPath(
    from_species="sparky",
    to_species="volt",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 15}
))

EvolutionSystem.register_path(EvolutionPath(
    from_species="volt",
    to_species="raiju",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 35}
))

# Flora -> Bloom -> Dryad
EvolutionSystem.register_path(EvolutionPath(
    from_species="flora",
    to_species="bloom",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 18}
))

EvolutionSystem.register_path(EvolutionPath(
    from_species="bloom",
    to_species="dryad",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 38}
))

# Luna -> Cosmos (happiness evolution)
EvolutionSystem.register_path(EvolutionPath(
    from_species="luna",
    to_species="cosmos",
    condition=EvolutionCondition.HAPPINESS,
    requirements={"happiness": 90}
))

# Shade -> Umbra -> Void
EvolutionSystem.register_path(EvolutionPath(
    from_species="shade",
    to_species="umbra",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 20}
))

EvolutionSystem.register_path(EvolutionPath(
    from_species="umbra",
    to_species="void",
    condition=EvolutionCondition.LEVEL,
    requirements={"level": 40}
))

# Prism -> Spectrum (friendship evolution)
EvolutionSystem.register_path(EvolutionPath(
    from_species="prism",
    to_species="spectrum",
    condition=EvolutionCondition.FRIENDSHIP,
    requirements={"loyalty": 95}
))
