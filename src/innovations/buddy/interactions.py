"""
Interactions - Buddy interaction system.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
import random


class InteractionType(Enum):
    """Types of interactions with buddies."""
    FEED = auto()
    PLAY = auto()
    PET = auto()
    TRAIN = auto()
    CLEAN = auto()
    SLEEP = auto()
    TALK = auto()
    GIFT = auto()
    EXPLORE = auto()
    BATTLE = auto()
    EVOLVE = auto()
    CUSTOM = auto()


@dataclass
class InteractionResult:
    """Result of an interaction."""
    success: bool
    message: str
    stat_changes: Dict[str, int] = field(default_factory=dict)
    experience_gained: int = 0
    items_found: List[str] = field(default_factory=list)
    evolution_triggered: bool = False
    new_ability_unlocked: Optional[str] = None
    special_event: Optional[str] = None
    animation: Optional[str] = None
    sound: Optional[str] = None


@dataclass
class Action:
    """An action to perform with a buddy."""
    type: InteractionType
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


class InteractionSystem:
    """
    Handles all buddy interactions.
    
    Each interaction affects stats, experience, and happiness.
    """
    
    # Food items and their effects
    FOOD_ITEMS = {
        "berry": {"hunger": -20, "health": 5, "happiness": 5},
        "apple": {"hunger": -25, "health": 8, "happiness": 5},
        "cookie": {"hunger": -15, "happiness": 15, "health": -2},
        "pizza": {"hunger": -40, "happiness": 20, "health": -5, "energy": -5},
        "salad": {"hunger": -30, "health": 15, "happiness": 5},
        "cake": {"hunger": -35, "happiness": 30, "health": -5, "energy": 10},
        "golden_apple": {"hunger": -50, "health": 30, "happiness": 20, "max_health": 5},
        "energy_drink": {"hunger": -10, "energy": 30, "fatigue": -20},
    }
    
    # Play activities
    PLAY_ACTIVITIES = {
        "ball": {"happiness": 15, "energy": -10, "fatigue": 10, "speed": 1},
        "fetch": {"happiness": 20, "energy": -15, "fatigue": 15, "speed": 2},
        "puzzle": {"happiness": 10, "energy": -5, "intelligence": 2},
        "dance": {"happiness": 25, "energy": -20, "fatigue": 20},
        "hide_seek": {"happiness": 20, "energy": -10, "intelligence": 1},
        "race": {"happiness": 15, "energy": -25, "fatigue": 25, "speed": 3},
    }
    
    # Training types
    TRAINING_TYPES = {
        "strength": {"strength": 3, "energy": -20, "fatigue": 20, "happiness": -5},
        "speed": {"speed": 3, "energy": -20, "fatigue": 20, "happiness": -5},
        "intelligence": {"intelligence": 3, "energy": -15, "fatigue": 15, "happiness": -5},
        "defense": {"defense": 3, "energy": -20, "fatigue": 20, "happiness": -5},
        "endurance": {"max_health": 2, "energy": -25, "fatigue": 25, "happiness": -10},
    }
    
    @classmethod
    def feed(cls, buddy, food_item: str) -> InteractionResult:
        """Feed the buddy."""
        if food_item not in cls.FOOD_ITEMS:
            return InteractionResult(
                success=False,
                message=f"Unknown food: {food_item}"
            )
            
        effects = cls.FOOD_ITEMS[food_item].copy()
        
        # Check if hungry enough
        if buddy.stats.hunger < 10:
            return InteractionResult(
                success=False,
                message=f"{buddy.name} is not hungry right now!",
                stat_changes={},
                animation="shake_head"
            )
            
        # Apply effects
        changes = {}
        for stat, delta in effects.items():
            actual = buddy.stats.modify(stat, delta)
            if actual != 0:
                changes[stat] = actual
                
        # Experience gain
        exp = 5 + random.randint(0, 5)
        leveled = buddy.stats.add_experience(exp)
        
        messages = {
            "berry": f"{buddy.name} happily munches on a berry!",
            "apple": f"{buddy.name} crunches into a fresh apple!",
            "cookie": f"{buddy.name} nibbles on a sweet cookie!",
            "pizza": f"{buddy.name} devours a slice of pizza!",
            "salad": f"{buddy.name} enjoys a healthy salad!",
            "cake": f"{buddy.name}'s eyes light up eating cake!",
            "golden_apple": f"{buddy.name} glows after eating the golden apple!",
            "energy_drink": f"{buddy.name} chugs an energy drink!",
        }
        
        return InteractionResult(
            success=True,
            message=messages.get(food_item, f"{buddy.name} enjoys the {food_item}!"),
            stat_changes=changes,
            experience_gained=exp,
            animation="eat",
            sound="crunch"
        )
        
    @classmethod
    def play(cls, buddy, activity: str) -> InteractionResult:
        """Play with the buddy."""
        if activity not in cls.PLAY_ACTIVITIES:
            return InteractionResult(
                success=False,
                message=f"Unknown activity: {activity}"
            )
            
        effects = cls.PLAY_ACTIVITIES[activity].copy()
        
        # Check energy
        if buddy.stats.energy < 20:
            return InteractionResult(
                success=False,
                message=f"{buddy.name} is too tired to play!",
                stat_changes={},
                animation="tired"
            )
            
        # Apply effects
        changes = {}
        for stat, delta in effects.items():
            actual = buddy.stats.modify(stat, delta)
            if actual != 0:
                changes[stat] = actual
                
        # Experience gain
        exp = 8 + random.randint(0, 7)
        leveled = buddy.stats.add_experience(exp)
        
        # Random item find chance
        items = []
        if random.random() < 0.1:
            found = random.choice(["shiny_stone", "berry", "coin", "feather"])
            items.append(found)
            
        messages = {
            "ball": f"{buddy.name} chases the ball excitedly!",
            "fetch": f"{buddy.name} runs after the toy and brings it back!",
            "puzzle": f"{buddy.name} concentrates on solving the puzzle!",
            "dance": f"{buddy.name} dances with joy!",
            "hide_seek": f"{buddy.name} finds you hiding!",
            "race": f"{buddy.name} runs as fast as possible!",
        }
        
        return InteractionResult(
            success=True,
            message=messages.get(activity, f"{buddy.name} plays happily!"),
            stat_changes=changes,
            experience_gained=exp,
            items_found=items,
            animation=f"play_{activity}",
            sound="happy"
        )
        
    @classmethod
    def pet(cls, buddy) -> InteractionResult:
        """Pet the buddy."""
        changes = {
            "happiness": buddy.stats.modify("happiness", 10),
            "loyalty": buddy.stats.modify("loyalty", 2),
        }
        
        exp = 2 + random.randint(0, 3)
        buddy.stats.add_experience(exp)
        
        reactions = [
            f"{buddy.name} purrs happily!",
            f"{buddy.name} snuggles closer!",
            f"{buddy.name} wags with joy!",
            f"{buddy.name} closes its eyes contentedly!",
        ]
        
        return InteractionResult(
            success=True,
            message=random.choice(reactions),
            stat_changes=changes,
            experience_gained=exp,
            animation="happy_pet",
            sound="purr"
        )
        
    @classmethod
    def train(cls, buddy, training_type: str) -> InteractionResult:
        """Train the buddy."""
        if training_type not in cls.TRAINING_TYPES:
            return InteractionResult(
                success=False,
                message=f"Unknown training: {training_type}"
            )
            
        effects = cls.TRAINING_TYPES[training_type].copy()
        
        # Check energy
        if buddy.stats.energy < 30:
            return InteractionResult(
                success=False,
                message=f"{buddy.name} is too tired to train!",
                stat_changes={},
                animation="tired"
            )
            
        # Apply effects
        changes = {}
        for stat, delta in effects.items():
            actual = buddy.stats.modify(stat, delta)
            if actual != 0:
                changes[stat] = actual
                
        # Better experience for training
        exp = 15 + random.randint(0, 10)
        leveled = buddy.stats.add_experience(exp)
        
        messages = {
            "strength": f"{buddy.name} lifts weights and gets stronger!",
            "speed": f"{buddy.name} runs laps around the track!",
            "intelligence": f"{buddy.name} studies hard and learns new things!",
            "defense": f"{buddy.name} practices blocking attacks!",
            "endurance": f"{buddy.name} pushes through a tough workout!",
        }
        
        return InteractionResult(
            success=True,
            message=messages.get(training_type, f"{buddy.name} trains hard!"),
            stat_changes=changes,
            experience_gained=exp,
            animation=f"train_{training_type}",
            sound="effort"
        )
        
    @classmethod
    def clean(cls, buddy) -> InteractionResult:
        """Clean the buddy."""
        if buddy.stats.cleanliness >= 90:
            return InteractionResult(
                success=False,
                message=f"{buddy.name} is already sparkling clean!",
                stat_changes={},
                animation="shake"
            )
            
        changes = {
            "cleanliness": buddy.stats.modify("cleanliness", 50),
            "happiness": buddy.stats.modify("happiness", 5),
        }
        
        exp = 3 + random.randint(0, 3)
        buddy.stats.add_experience(exp)
        
        return InteractionResult(
            success=True,
            message=f"{buddy.name} is now squeaky clean!",
            stat_changes=changes,
            experience_gained=exp,
            animation="clean",
            sound="splash"
        )
        
    @classmethod
    def sleep(cls, buddy, duration_hours: int = 8) -> InteractionResult:
        """Put the buddy to sleep."""
        changes = {
            "energy": buddy.stats.modify("energy", 20 * duration_hours),
            "fatigue": buddy.stats.modify("fatigue", -15 * duration_hours),
            "health": buddy.stats.modify("health", 5 * duration_hours),
        }
        
        # Cap values
        changes = {k: v for k, v in changes.items() if v != 0}
        
        return InteractionResult(
            success=True,
            message=f"{buddy.name} sleeps peacefully for {duration_hours} hours.",
            stat_changes=changes,
            animation="sleep",
            sound="snore"
        )
        
    @classmethod
    def talk(cls, buddy) -> InteractionResult:
        """Talk to the buddy."""
        changes = {
            "happiness": buddy.stats.modify("happiness", 5),
            "loyalty": buddy.stats.modify("loyalty", 3),
            "intelligence": buddy.stats.modify("intelligence", 1),
        }
        
        exp = 3 + random.randint(0, 4)
        buddy.stats.add_experience(exp)
        
        responses = [
            f"{buddy.name} listens attentively!",
            f"{buddy.name} tilts its head curiously!",
            f"{buddy.name} responds with happy sounds!",
            f"{buddy.name} seems to understand you!",
        ]
        
        return InteractionResult(
            success=True,
            message=random.choice(responses),
            stat_changes=changes,
            experience_gained=exp,
            animation="listen",
            sound="chatter"
        )
        
    @classmethod
    def explore(cls, buddy) -> InteractionResult:
        """Send buddy to explore."""
        # Check energy
        if buddy.stats.energy < 30:
            return InteractionResult(
                success=False,
                message=f"{buddy.name} is too tired to explore!",
                stat_changes={},
                animation="tired"
            )
            
        changes = {
            "energy": buddy.stats.modify("energy", -20),
            "fatigue": buddy.stats.modify("fatigue", 15),
            "happiness": buddy.stats.modify("happiness", 10),
        }
        
        exp = 12 + random.randint(0, 10)
        buddy.stats.add_experience(exp)
        
        # Random discoveries
        items = []
        events = []
        
        if random.random() < 0.3:
            found = random.choice([
                "shiny_stone", "ancient_coin", "mystic_berry",
                "pretty_feather", "smooth_pebble", "rare_flower"
            ])
            items.append(found)
            
        if random.random() < 0.1:
            events.append("found_secret_area")
            
        locations = [
            f"{buddy.name} explores a nearby forest!",
            f"{buddy.name} ventures into a cave!",
            f"{buddy.name} climbs a small hill!",
            f"{buddy.name} discovers a hidden path!",
            f"{buddy.name} explores the beach!",
        ]
        
        return InteractionResult(
            success=True,
            message=random.choice(locations),
            stat_changes=changes,
            experience_gained=exp,
            items_found=items,
            special_event=events[0] if events else None,
            animation="explore",
            sound="adventure"
        )
