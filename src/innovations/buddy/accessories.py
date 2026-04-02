"""
Accessories - Buddy accessory and equipment system.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
import random


class AccessorySlot(Enum):
    """Equipment slots for accessories."""
    HEAD = auto()       # Hats, crowns, headbands
    FACE = auto()       # Glasses, masks
    NECK = auto()       # Scarves, necklaces
    BODY = auto()       # Shirts, capes, armor
    BACK = auto()       # Wings, backpacks
    FEET = auto()       # Shoes, boots
    HELD = auto()       # Items held in hands/paws
    SPECIAL = auto()    # Unique accessories


class AccessoryType(Enum):
    """Types of accessories."""
    HAT = auto()
    GLASSES = auto()
    SCARF = auto()
    CAPE = auto()
    WINGS = auto()
    SHOES = auto()
    JEWELRY = auto()
    TOY = auto()
    BADGE = auto()
    SKIN = auto()  # Shiny/recolor


class AccessoryRarity(Enum):
    """Accessory rarity levels."""
    BASIC = 1
    UNCOMMON = 2
    RARE = 3
    EPIC = 4
    LEGENDARY = 5
    LIMITED = 6  # Event-only


@dataclass
class Accessory:
    """A buddy accessory."""
    id: str
    name: str
    description: str
    slot: AccessorySlot
    type: AccessoryType
    rarity: AccessoryRarity
    stat_modifiers: Dict[str, int] = field(default_factory=dict)
    visual_effect: Optional[str] = None
    animation: Optional[str] = None
    particle_effect: Optional[str] = None
    color_variants: List[str] = field(default_factory=lambda: ["default"])
    equip_requirements: Dict[str, int] = field(default_factory=dict)
    
    def can_equip(self, buddy_level: int, buddy_stats: Dict) -> bool:
        """Check if buddy can equip this accessory."""
        if 'level' in self.equip_requirements:
            if buddy_level < self.equip_requirements['level']:
                return False
        return True
        
    def get_random_color(self) -> str:
        """Get a random color variant."""
        return random.choice(self.color_variants)


# === ACCESSORY DATABASE ===

ACCESSORY_DATABASE: Dict[str, Accessory] = {}


def register_accessory(acc: Accessory) -> None:
    """Register an accessory."""
    ACCESSORY_DATABASE[acc.id] = acc


# Head accessories
register_accessory(Accessory(
    id="party_hat",
    name="Party Hat",
    description="A colorful cone hat for celebrations!",
    slot=AccessorySlot.HEAD,
    type=AccessoryType.HAT,
    rarity=AccessoryRarity.BASIC,
    stat_modifiers={"happiness": 5},
    color_variants=["red", "blue", "green", "gold", "rainbow"],
))

register_accessory(Accessory(
    id="crown",
    name="Royal Crown",
    description="A golden crown fit for royalty.",
    slot=AccessorySlot.HEAD,
    type=AccessoryType.HAT,
    rarity=AccessoryRarity.EPIC,
    stat_modifiers={"loyalty": 15, "happiness": 10},
    particle_effect="sparkle",
    equip_requirements={"level": 20},
))

register_accessory(Accessory(
    id="wizard_hat",
    name="Wizard Hat",
    description="A mystical hat that boosts magical abilities.",
    slot=AccessorySlot.HEAD,
    type=AccessoryType.HAT,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"intelligence": 10, "energy": 5},
    color_variants=["purple", "blue", "black"],
    equip_requirements={"level": 15},
))

register_accessory(Accessory(
    id="crown_of_stars",
    name="Crown of Stars",
    description="A legendary crown woven from starlight.",
    slot=AccessorySlot.HEAD,
    type=AccessoryType.HAT,
    rarity=AccessoryRarity.LEGENDARY,
    stat_modifiers={"intelligence": 20, "max_energy": 20, "happiness": 15},
    particle_effect="stardust",
    equip_requirements={"level": 50},
))

# Face accessories
register_accessory(Accessory(
    id="cool_shades",
    name="Cool Shades",
    description="Sunglasses that make your buddy look awesome.",
    slot=AccessorySlot.FACE,
    type=AccessoryType.GLASSES,
    rarity=AccessoryRarity.UNCOMMON,
    stat_modifiers={"sociability": 10, "happiness": 5},
    color_variants=["black", "gold", "pink", "blue"],
))

register_accessory(Accessory(
    id="monocle",
    name="Gentleman's Monocle",
    description="A sophisticated monocle for distinguished buddies.",
    slot=AccessorySlot.FACE,
    type=AccessoryType.GLASSES,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"intelligence": 15, "sociability": 5},
))

register_accessory(Accessory(
    id="eye_patch",
    name="Pirate Eye Patch",
    description="Yarr! Become a fearsome pirate!",
    slot=AccessorySlot.FACE,
    type=AccessoryType.GLASSES,
    rarity=AccessoryRarity.UNCOMMON,
    stat_modifiers={"strength": 10, "happiness": 5},
))

# Neck accessories
register_accessory(Accessory(
    id="red_scarf",
    name="Cozy Scarf",
    description="A warm scarf for cold days.",
    slot=AccessorySlot.NECK,
    type=AccessoryType.SCARF,
    rarity=AccessoryRarity.BASIC,
    stat_modifiers={"health": 5, "happiness": 5},
    color_variants=["red", "blue", "green", "yellow", "purple", "rainbow"],
))

register_accessory(Accessory(
    id="golden_locket",
    name="Golden Locket",
    description="A precious locket containing a tiny photo.",
    slot=AccessorySlot.NECK,
    type=AccessoryType.JEWELRY,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"loyalty": 20, "happiness": 10},
    particle_effect="sparkle",
))

register_accessory(Accessory(
    id="friendship_necklace",
    name="Friendship Necklace",
    description="A symbol of unbreakable bonds.",
    slot=AccessorySlot.NECK,
    type=AccessoryType.JEWELRY,
    rarity=AccessoryRarity.EPIC,
    stat_modifiers={"loyalty": 25, "happiness": 20, "sociability": 15},
    particle_effect="hearts",
))

# Body accessories
register_accessory(Accessory(
    id="hero_cape",
    name="Hero Cape",
    description="A flowing cape for aspiring heroes.",
    slot=AccessorySlot.BODY,
    type=AccessoryType.CAPE,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"strength": 10, "defense": 10, "happiness": 10},
    color_variants=["red", "blue", "green", "gold", "black"],
    animation="cape_flow",
    equip_requirements={"level": 25},
))

register_accessory(Accessory(
    id="mystic_cloak",
    name="Mystic Cloak",
    description="A cloak woven with ancient magic.",
    slot=AccessorySlot.BODY,
    type=AccessoryType.CAPE,
    rarity=AccessoryRarity.EPIC,
    stat_modifiers={"intelligence": 15, "max_energy": 15, "defense": 5},
    particle_effect="magic_swirl",
    color_variants=["purple", "blue", "black"],
    equip_requirements={"level": 30},
))

# Back accessories
register_accessory(Accessory(
    id="angel_wings",
    name="Angel Wings",
    description="Pure white wings that grant a gentle glow.",
    slot=AccessorySlot.BACK,
    type=AccessoryType.WINGS,
    rarity=AccessoryRarity.EPIC,
    stat_modifiers={"happiness": 15, "loyalty": 15, "speed": 10},
    particle_effect="feathers",
    animation="wing_flap",
    equip_requirements={"level": 40},
))

register_accessory(Accessory(
    id="bat_wings",
    name="Bat Wings",
    description="Dark wings for creatures of the night.",
    slot=AccessorySlot.BACK,
    type=AccessoryType.WINGS,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"speed": 15, "strength": 10},
    animation="wing_flap",
    color_variants=["black", "purple", "red"],
))

register_accessory(Accessory(
    id="butterfly_wings",
    name="Butterfly Wings",
    description="Beautiful wings with intricate patterns.",
    slot=AccessorySlot.BACK,
    type=AccessoryType.WINGS,
    rarity=AccessoryRarity.UNCOMMON,
    stat_modifiers={"happiness": 20, "speed": 5},
    particle_effect="sparkle",
    animation="wing_flap",
    color_variants=["rainbow", "blue", "pink", "yellow"],
))

# Feet accessories
register_accessory(Accessory(
    id="running_shoes",
    name="Running Shoes",
    description="Shoes that make you run faster!",
    slot=AccessorySlot.FEET,
    type=AccessoryType.SHOES,
    rarity=AccessoryRarity.UNCOMMON,
    stat_modifiers={"speed": 15, "energy": 5},
    color_variants=["red", "blue", "green", "gold"],
))

register_accessory(Accessory(
    id="bunny_slippers",
    name="Bunny Slippers",
    description="Cute and comfy slippers.",
    slot=AccessorySlot.FEET,
    type=AccessoryType.SHOES,
    rarity=AccessoryRarity.BASIC,
    stat_modifiers={"happiness": 15, "health": 5},
    color_variants=["pink", "white", "brown"],
))

# Held accessories
register_accessory(Accessory(
    id="lollipop",
    name="Giant Lollipop",
    description="A sweet treat that boosts happiness!",
    slot=AccessorySlot.HELD,
    type=AccessoryType.TOY,
    rarity=AccessoryRarity.BASIC,
    stat_modifiers={"happiness": 20},
    color_variants=["rainbow", "red", "blue", "green"],
))

register_accessory(Accessory(
    id="magic_wand",
    name="Magic Wand",
    description="A wand that channels magical energy.",
    slot=AccessorySlot.HELD,
    type=AccessoryType.TOY,
    rarity=AccessoryRarity.RARE,
    stat_modifiers={"intelligence": 15, "max_energy": 10},
    particle_effect="magic_sparkle",
    equip_requirements={"level": 20},
))

register_accessory(Accessory(
    id="golden_staff",
    name="Golden Staff",
    description="A legendary staff of immense power.",
    slot=AccessorySlot.HELD,
    type=AccessoryType.TOY,
    rarity=AccessoryRarity.LEGENDARY,
    stat_modifiers={"intelligence": 25, "strength": 15, "max_energy": 25},
    particle_effect="golden_glow",
    equip_requirements={"level": 50},
))

# Special accessories
register_accessory(Accessory(
    id="halo",
    name="Golden Halo",
    description="A divine halo that floats above your buddy's head.",
    slot=AccessorySlot.SPECIAL,
    type=AccessoryType.JEWELRY,
    rarity=AccessoryRarity.LEGENDARY,
    stat_modifiers={"happiness": 25, "loyalty": 25, "health": 20},
    particle_effect="holy_light",
    animation="halo_float",
    equip_requirements={"level": 50},
))

register_accessory(Accessory(
    id="aura",
    name="Mystic Aura",
    description="A glowing aura that surrounds your buddy.",
    slot=AccessorySlot.SPECIAL,
    type=AccessoryType.SKIN,
    rarity=AccessoryRarity.EPIC,
    stat_modifiers={"max_energy": 20, "intelligence": 10, "speed": 10},
    particle_effect="aura_glow",
    color_variants=["blue", "purple", "gold", "rainbow"],
    equip_requirements={"level": 35},
))


def get_accessory(accessory_id: str) -> Optional[Accessory]:
    """Get an accessory by ID."""
    return ACCESSORY_DATABASE.get(accessory_id)


def get_accessories_by_slot(slot: AccessorySlot) -> List[Accessory]:
    """Get all accessories for a slot."""
    return [a for a in ACCESSORY_DATABASE.values() if a.slot == slot]


def get_accessories_by_rarity(rarity: AccessoryRarity) -> List[Accessory]:
    """Get all accessories of a rarity."""
    return [a for a in ACCESSORY_DATABASE.values() if a.rarity == rarity]


def get_random_accessory(
    rarity: Optional[AccessoryRarity] = None,
    slot: Optional[AccessorySlot] = None
) -> Optional[Accessory]:
    """Get a random accessory, optionally filtered."""
    accessories = list(ACCESSORY_DATABASE.values())
    
    if rarity:
        accessories = [a for a in accessories if a.rarity == rarity]
    if slot:
        accessories = [a for a in accessories if a.slot == slot]
        
    return random.choice(accessories) if accessories else None


def get_all_accessories() -> List[Accessory]:
    """Get all registered accessories."""
    return list(ACCESSORY_DATABASE.values())
