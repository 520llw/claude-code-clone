"""
Stats - Buddy statistics and personality system.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import random


class Personality(Enum):
    """Buddy personality types affecting behavior."""
    BRAVE = auto()      # Higher attack, lower fear
    TIMID = auto()      # Faster but less brave
    JOLLY = auto()      # Higher happiness growth
    SERIOUS = auto()    # Balanced stats
    NAUGHTY = auto()    # Mischievous, unpredictable
    QUIET = auto()      # Higher intelligence, lower social
    HARDY = auto()      # Higher health, lower energy
    LONELY = auto()     # Needs more attention
    ADAMANT = auto()    # Higher strength, lower intelligence
    MODEST = auto()     # Higher intelligence, lower strength


@dataclass
class Stats:
    """
    Buddy statistics tracking.
    
    All stats range from 0-100, with 50 being average.
    """
    # Core stats
    health: int = 50
    max_health: int = 50
    energy: int = 50
    max_energy: int = 50
    happiness: int = 50
    max_happiness: int = 100
    
    # Experience and level
    experience: int = 0
    level: int = 1
    
    # Combat stats (affects interactions)
    strength: int = 50
    intelligence: int = 50
    speed: int = 50
    defense: int = 50
    
    # Social stats
    loyalty: int = 50
    sociability: int = 50
    
    # State tracking
    hunger: int = 0  # 0 = full, 100 = starving
    fatigue: int = 0  # 0 = rested, 100 = exhausted
    cleanliness: int = 100  # 0 = dirty, 100 = clean
    
    def __post_init__(self):
        # Clamp all values
        self._clamp_all()
        
    def _clamp_all(self):
        """Clamp all stats to valid ranges."""
        self.health = max(0, min(self.max_health, self.health))
        self.energy = max(0, min(self.max_energy, self.energy))
        self.happiness = max(0, min(self.max_happiness, self.happiness))
        self.hunger = max(0, min(100, self.hunger))
        self.fatigue = max(0, min(100, self.fatigue))
        self.cleanliness = max(0, min(100, self.cleanliness))
        
    def modify(self, stat: str, delta: int) -> int:
        """Modify a stat by delta, returns actual change."""
        old_val = getattr(self, stat)
        new_val = old_val + delta
        
        # Get max if applicable
        max_attr = f"max_{stat}"
        if hasattr(self, max_attr):
            max_val = getattr(self, max_attr)
            new_val = max(0, min(max_val, new_val))
        else:
            new_val = max(0, min(100, new_val))
            
        setattr(self, stat, new_val)
        return new_val - old_val
        
    def add_experience(self, amount: int) -> bool:
        """
        Add experience points.
        Returns True if leveled up.
        """
        self.experience += amount
        
        # Check for level up
        needed = self.experience_needed()
        if self.experience >= needed:
            self.level_up()
            return True
        return False
        
    def experience_needed(self) -> int:
        """Calculate experience needed for next level."""
        return int(100 * (self.level ** 1.5))
        
    def level_up(self) -> None:
        """Level up the buddy."""
        self.experience -= self.experience_needed()
        self.level += 1
        
        # Increase max stats
        self.max_health += random.randint(2, 5)
        self.max_energy += random.randint(2, 4)
        
        # Increase base stats
        self.strength += random.randint(1, 3)
        self.intelligence += random.randint(1, 3)
        self.speed += random.randint(1, 3)
        self.defense += random.randint(1, 3)
        
        # Restore health and energy
        self.health = self.max_health
        self.energy = self.max_energy
        
        # Boost happiness
        self.happiness = min(self.max_happiness, self.happiness + 20)
        
    def decay(self, time_passed_minutes: int = 1) -> Dict[str, int]:
        """
        Apply natural stat decay over time.
        Returns dict of changes.
        """
        changes = {}
        
        # Hunger increases
        hunger_increase = time_passed_minutes // 30
        if hunger_increase > 0:
            changes['hunger'] = self.modify('hunger', hunger_increase)
            
        # Energy decreases based on activity
        if self.fatigue > 50:
            energy_loss = time_passed_minutes // 60
            if energy_loss > 0:
                changes['energy'] = self.modify('energy', -energy_loss)
                
        # Cleanliness decreases
        cleanliness_loss = time_passed_minutes // 120
        if cleanliness_loss > 0:
            changes['cleanliness'] = self.modify('cleanliness', -cleanliness_loss)
            
        # Happiness affected by other stats
        if self.hunger > 80:
            changes['happiness'] = self.modify('happiness', -2)
        if self.fatigue > 80:
            changes['happiness'] = self.modify('happiness', -1)
        if self.cleanliness < 20:
            changes['happiness'] = self.modify('happiness', -1)
            
        return changes
        
    def is_alive(self) -> bool:
        """Check if buddy is alive."""
        return self.health > 0
        
    def is_happy(self) -> bool:
        """Check if buddy is happy."""
        return self.happiness >= 70
        
    def is_hungry(self) -> bool:
        """Check if buddy is hungry."""
        return self.hunger >= 50
        
    def is_tired(self) -> bool:
        """Check if buddy is tired."""
        return self.energy < 30 or self.fatigue > 70
        
    def needs_attention(self) -> List[str]:
        """Get list of needs."""
        needs = []
        if self.hunger > 50:
            needs.append("hungry")
        if self.energy < 30:
            needs.append("tired")
        if self.happiness < 40:
            needs.append("sad")
        if self.cleanliness < 30:
            needs.append("dirty")
        if self.fatigue > 70:
            needs.append("exhausted")
        return needs
        
    def get_overall_mood(self) -> str:
        """Get overall mood description."""
        if self.happiness >= 80:
            return "ecstatic"
        elif self.happiness >= 60:
            return "happy"
        elif self.happiness >= 40:
            return "content"
        elif self.happiness >= 20:
            return "sad"
        else:
            return "depressed"
            
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'health': self.health,
            'max_health': self.max_health,
            'energy': self.energy,
            'max_energy': self.max_energy,
            'happiness': self.happiness,
            'max_happiness': self.max_happiness,
            'experience': self.experience,
            'level': self.level,
            'strength': self.strength,
            'intelligence': self.intelligence,
            'speed': self.speed,
            'defense': self.defense,
            'loyalty': self.loyalty,
            'sociability': self.sociability,
            'hunger': self.hunger,
            'fatigue': self.fatigue,
            'cleanliness': self.cleanliness,
        }
        
    @classmethod
    def from_dict(cls, data: Dict) -> 'Stats':
        """Create from dictionary."""
        return cls(**{k: v for k, v in data.items() if hasattr(cls, k)})


def generate_personality() -> Personality:
    """Generate a random personality."""
    return random.choice(list(Personality))


def apply_personality_modifiers(stats: Stats, personality: Personality) -> Stats:
    """Apply personality modifiers to stats."""
    modifiers = {
        Personality.BRAVE: {'strength': 10, 'defense': 5, 'intelligence': -5},
        Personality.TIMID: {'speed': 15, 'sociability': -10, 'defense': -5},
        Personality.JOLLY: {'happiness': 20, 'sociability': 10, 'defense': -5},
        Personality.SERIOUS: {},  # No changes
        Personality.NAUGHTY: {'intelligence': 10, 'loyalty': -10, 'happiness': 5},
        Personality.QUIET: {'intelligence': 15, 'sociability': -15},
        Personality.HARDY: {'max_health': 20, 'max_energy': -10, 'defense': 10},
        Personality.LONELY: {'loyalty': 20, 'sociability': -20},
        Personality.ADAMANT: {'strength': 15, 'intelligence': -15},
        Personality.MODEST: {'intelligence': 15, 'strength': -15},
    }
    
    mods = modifiers.get(personality, {})
    for stat, delta in mods.items():
        if hasattr(stats, stat):
            current = getattr(stats, stat)
            setattr(stats, stat, current + delta)
            
    return stats
