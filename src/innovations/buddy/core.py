"""
Core - Main Buddy system implementation.
"""

import uuid
import random
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .species import Species, get_species, Rarity, get_random_species
from .stats import Stats, Personality, apply_personality_modifiers
from .accessories import (
    Accessory, AccessorySlot, get_accessory, get_random_accessory
)
from .interactions import InteractionSystem, InteractionResult, InteractionType
from .evolution import EvolutionSystem


@dataclass
class BuddyStatus:
    """Complete buddy status snapshot."""
    id: str
    name: str
    species_name: str
    species_type: str
    rarity: str
    level: int
    is_shiny: bool
    personality: str
    stats: Dict[str, Any]
    equipped_accessories: Dict[str, str]
    mood: str
    needs: List[str]
    can_evolve: bool


class Buddy:
    """
    A virtual AI companion buddy.
    
    Each buddy has:
    - Species and rarity
    - Stats that change over time
    - Personality affecting behavior
    - Equipable accessories
    - Evolution potential
    """
    
    def __init__(
        self,
        species: Species,
        name: str,
        is_shiny: bool = False,
        personality: Optional[Personality] = None
    ):
        self.id = str(uuid.uuid4())
        self.species = species
        self.name = name
        self.is_shiny = is_shiny
        self.personality = personality or random.choice(list(Personality))
        self.created_at = datetime.now()
        self.last_interaction = datetime.now()
        
        # Initialize stats from species base
        self.stats = Stats(**species.base_stats)
        self.stats = apply_personality_modifiers(self.stats, self.personality)
        
        # Accessories
        self.equipped: Dict[AccessorySlot, Optional[Accessory]] = {
            slot: None for slot in AccessorySlot
        }
        
        # Inventory
        self.inventory: List[str] = []
        
        # History
        self.interaction_history: List[Dict] = []
        
    def interact(self, action_type: InteractionType, **kwargs) -> InteractionResult:
        """Perform an interaction with the buddy."""
        self.last_interaction = datetime.now()
        
        # Route to appropriate handler
        if action_type == InteractionType.FEED:
            result = InteractionSystem.feed(self, kwargs.get("food", "berry"))
        elif action_type == InteractionType.PLAY:
            result = InteractionSystem.play(self, kwargs.get("activity", "ball"))
        elif action_type == InteractionType.PET:
            result = InteractionSystem.pet(self)
        elif action_type == InteractionType.TRAIN:
            result = InteractionSystem.train(self, kwargs.get("training_type", "strength"))
        elif action_type == InteractionType.CLEAN:
            result = InteractionSystem.clean(self)
        elif action_type == InteractionType.SLEEP:
            result = InteractionSystem.sleep(self, kwargs.get("duration", 8))
        elif action_type == InteractionType.TALK:
            result = InteractionSystem.talk(self)
        elif action_type == InteractionType.EXPLORE:
            result = InteractionSystem.explore(self)
        elif action_type == InteractionType.EVOLVE:
            result = self._try_evolve()
        else:
            result = InteractionResult(
                success=False,
                message=f"Unknown interaction: {action_type}"
            )
            
        # Log interaction
        self.interaction_history.append({
            "type": action_type.name,
            "timestamp": datetime.now().isoformat(),
            "result": result.success,
        })
        
        return result
        
    def _try_evolve(self) -> InteractionResult:
        """Attempt to evolve the buddy."""
        if not EvolutionSystem.can_evolve(self):
            return InteractionResult(
                success=False,
                message=f"{self.name} cannot evolve yet!",
                animation="shake_head"
            )
            
        result = EvolutionSystem.evolve(self)
        
        return InteractionResult(
            success=result["success"],
            message=result["message"],
            stat_changes=result.get("stat_boosts", {}),
            evolution_triggered=True,
            animation=result.get("animation"),
            sound=result.get("sound")
        )
        
    def equip_accessory(self, accessory_id: str) -> bool:
        """Equip an accessory."""
        accessory = get_accessory(accessory_id)
        if not accessory:
            return False
            
        if not accessory.can_equip(self.stats.level, self.stats.to_dict()):
            return False
            
        # Unequip existing
        if self.equipped[accessory.slot]:
            self.unequip_accessory(accessory.slot)
            
        # Equip new
        self.equipped[accessory.slot] = accessory
        
        # Apply stat modifiers
        for stat, delta in accessory.stat_modifiers.items():
            self.stats.modify(stat, delta)
            
        return True
        
    def unequip_accessory(self, slot: AccessorySlot) -> Optional[Accessory]:
        """Unequip an accessory from a slot."""
        accessory = self.equipped[slot]
        if accessory:
            # Remove stat modifiers
            for stat, delta in accessory.stat_modifiers.items():
                self.stats.modify(stat, -delta)
            self.equipped[slot] = None
        return accessory
        
    def update(self, time_passed_minutes: int = 1) -> Dict[str, int]:
        """Update buddy state over time."""
        return self.stats.decay(time_passed_minutes)
        
    def get_status(self) -> BuddyStatus:
        """Get complete buddy status."""
        return BuddyStatus(
            id=self.id,
            name=self.name,
            species_name=self.species.name,
            species_type=self.species.species_type.name,
            rarity=self.species.rarity.name,
            level=self.stats.level,
            is_shiny=self.is_shiny,
            personality=self.personality.name,
            stats=self.stats.to_dict(),
            equipped_accessories={
                slot.name: acc.name if acc else None
                for slot, acc in self.equipped.items()
            },
            mood=self.stats.get_overall_mood(),
            needs=self.stats.needs_attention(),
            can_evolve=EvolutionSystem.can_evolve(self)
        )
        
    def to_dict(self) -> Dict[str, Any]:
        """Serialize buddy to dictionary."""
        return {
            "id": self.id,
            "species_id": self.species.id,
            "name": self.name,
            "is_shiny": self.is_shiny,
            "personality": self.personality.name,
            "stats": self.stats.to_dict(),
            "equipped": {
                slot.name: acc.id if acc else None
                for slot, acc in self.equipped.items()
            },
            "inventory": self.inventory,
            "created_at": self.created_at.isoformat(),
            "last_interaction": self.last_interaction.isoformat(),
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Buddy':
        """Deserialize buddy from dictionary."""
        species = get_species(data["species_id"])
        if not species:
            raise ValueError(f"Unknown species: {data['species_id']}")
            
        buddy = cls(
            species=species,
            name=data["name"],
            is_shiny=data.get("is_shiny", False),
            personality=Personality[data.get("personality", "SERIOUS")]
        )
        
        buddy.id = data["id"]
        buddy.stats = Stats.from_dict(data["stats"])
        buddy.inventory = data.get("inventory", [])
        
        # Restore equipped accessories
        for slot_name, acc_id in data.get("equipped", {}).items():
            if acc_id:
                buddy.equip_accessory(acc_id)
                
        return buddy


class BuddySystem:
    """
    Main system for managing buddies.
    
    Handles creation, storage, and interaction with all buddies.
    """
    
    def __init__(self):
        self._buddies: Dict[str, Buddy] = {}
        self._active_buddy: Optional[str] = None
        
    def create_buddy(
        self,
        species: Species,
        name: str,
        force_shiny: bool = False
    ) -> Buddy:
        """Create a new buddy."""
        # Roll for shiny
        is_shiny = force_shiny
        if not is_shiny and species.shiny_variant:
            is_shiny = random.random() < species.get_shiny_chance()
            
        buddy = Buddy(species, name, is_shiny)
        self._buddies[buddy.id] = buddy
        
        if not self._active_buddy:
            self._active_buddy = buddy.id
            
        return buddy
        
    def get_buddy(self, buddy_id: str) -> Optional[Buddy]:
        """Get a buddy by ID."""
        return self._buddies.get(buddy_id)
        
    def get_active_buddy(self) -> Optional[Buddy]:
        """Get the currently active buddy."""
        if self._active_buddy:
            return self._buddies.get(self._active_buddy)
        return None
        
    def set_active_buddy(self, buddy_id: str) -> bool:
        """Set the active buddy."""
        if buddy_id in self._buddies:
            self._active_buddy = buddy_id
            return True
        return False
        
    def interact(
        self,
        buddy_id: str,
        action_type: InteractionType,
        **kwargs
    ) -> Optional[InteractionResult]:
        """Interact with a buddy."""
        buddy = self._buddies.get(buddy_id)
        if not buddy:
            return None
        return buddy.interact(action_type, **kwargs)
        
    def get_status(self, buddy_id: str) -> Optional[BuddyStatus]:
        """Get buddy status."""
        buddy = self._buddies.get(buddy_id)
        if not buddy:
            return None
        return buddy.get_status()
        
    def list_buddies(self) -> List[Dict[str, Any]]:
        """List all buddies with basic info."""
        return [
            {
                "id": b.id,
                "name": b.name,
                "species": b.species.name,
                "level": b.stats.level,
                "is_shiny": b.is_shiny,
            }
            for b in self._buddies.values()
        ]
        
    def update_all(self, time_passed_minutes: int = 1) -> Dict[str, Dict[str, int]]:
        """Update all buddies over time."""
        changes = {}
        for buddy_id, buddy in self._buddies.items():
            changes[buddy_id] = buddy.update(time_passed_minutes)
        return changes
        
    def save(self, filepath: str) -> None:
        """Save all buddies to file."""
        import json
        data = {
            "active": self._active_buddy,
            "buddies": [b.to_dict() for b in self._buddies.values()]
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
            
    def load(self, filepath: str) -> None:
        """Load buddies from file."""
        import json
        with open(filepath, 'r') as f:
            data = json.load(f)
            
        self._buddies = {}
        for buddy_data in data.get("buddies", []):
            buddy = Buddy.from_dict(buddy_data)
            self._buddies[buddy.id] = buddy
            
        self._active_buddy = data.get("active")
