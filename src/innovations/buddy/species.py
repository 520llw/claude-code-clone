"""
Species - Buddy species definitions with rarity and traits.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import random


class Rarity(Enum):
    """Buddy rarity levels."""
    COMMON = 1
    UNCOMMON = 2
    RARE = 3
    EPIC = 4
    LEGENDARY = 5
    MYTHIC = 6
    
    def __str__(self):
        return self.name.title()


class SpeciesType(Enum):
    """Buddy species types (like Pokemon types)."""
    NORMAL = auto()
    FIRE = auto()
    WATER = auto()
    ELECTRIC = auto()
    GRASS = auto()
    ICE = auto()
    FIGHTING = auto()
    POISON = auto()
    GROUND = auto()
    FLYING = auto()
    PSYCHIC = auto()
    BUG = auto()
    ROCK = auto()
    GHOST = auto()
    DRAGON = auto()
    DARK = auto()
    STEEL = auto()
    FAIRY = auto()
    COSMIC = auto()  # Special type


@dataclass
class Species:
    """Defines a Buddy species."""
    id: str
    name: str
    description: str
    species_type: SpeciesType
    rarity: Rarity
    base_stats: Dict[str, int] = field(default_factory=dict)
    shiny_variant: bool = True
    evolution_target: Optional[str] = None
    evolution_level: int = 20
    sprite_front: str = ""
    sprite_back: str = ""
    animation_frames: int = 4
    sound_cry: str = ""
    habitat: str = "various"
    diet: List[str] = field(default_factory=lambda: ["berries"])
    
    # Type effectiveness multipliers
    strengths: List[SpeciesType] = field(default_factory=list)
    weaknesses: List[SpeciesType] = field(default_factory=list)
    
    def __post_init__(self):
        # Set default base stats
        defaults = {
            "health": 50,
            "energy": 50,
            "happiness": 50,
            "intelligence": 50,
            "speed": 50,
            "strength": 50,
        }
        for key, val in defaults.items():
            if key not in self.base_stats:
                self.base_stats[key] = val
                
    def get_shiny_chance(self) -> float:
        """Get shiny encounter chance."""
        chances = {
            Rarity.COMMON: 1/4096,
            Rarity.UNCOMMON: 1/2048,
            Rarity.RARE: 1/1024,
            Rarity.EPIC: 1/512,
            Rarity.LEGENDARY: 1/256,
            Rarity.MYTHIC: 1/128,
        }
        return chances.get(self.rarity, 1/4096)


# Define all 18 species
SPECIES_DATABASE: Dict[str, Species] = {}


def register_species(species: Species) -> None:
    """Register a species in the database."""
    SPECIES_DATABASE[species.id] = species


# === 18 BUDDY SPECIES ===

# 1. Pyro (Fire)
register_species(Species(
    id="pyro",
    name="Pyro",
    description="A small flame spirit that dances around warm places. Its body flickers with eternal fire.",
    species_type=SpeciesType.FIRE,
    rarity=Rarity.COMMON,
    base_stats={"health": 45, "energy": 70, "happiness": 50, "intelligence": 40, "speed": 60, "strength": 45},
    evolution_target="inferno",
    evolution_level=16,
    habitat="volcanoes",
    strengths=[SpeciesType.GRASS, SpeciesType.ICE, SpeciesType.BUG, SpeciesType.STEEL],
    weaknesses=[SpeciesType.WATER, SpeciesType.GROUND, SpeciesType.ROCK],
))

# 2. Inferno (Fire) - Evolution of Pyro
register_species(Species(
    id="inferno",
    name="Inferno",
    description="A powerful fire elemental that commands flames. Its presence warms entire rooms.",
    species_type=SpeciesType.FIRE,
    rarity=Rarity.UNCOMMON,
    base_stats={"health": 65, "energy": 90, "happiness": 55, "intelligence": 55, "speed": 80, "strength": 65},
    evolution_target="phoenix",
    evolution_level=36,
    habitat="volcanoes",
    strengths=[SpeciesType.GRASS, SpeciesType.ICE, SpeciesType.BUG, SpeciesType.STEEL],
    weaknesses=[SpeciesType.WATER, SpeciesType.GROUND, SpeciesType.ROCK],
))

# 3. Phoenix (Fire/Flying) - Evolution of Inferno
register_species(Species(
    id="phoenix",
    name="Phoenix",
    description="A majestic firebird of legend. It is said to be reborn from its own ashes.",
    species_type=SpeciesType.FIRE,
    rarity=Rarity.LEGENDARY,
    base_stats={"health": 90, "energy": 110, "happiness": 70, "intelligence": 80, "speed": 100, "strength": 90},
    habitat="sacred mountains",
    strengths=[SpeciesType.GRASS, SpeciesType.ICE, SpeciesType.BUG, SpeciesType.STEEL, SpeciesType.FIGHTING],
    weaknesses=[SpeciesType.WATER, SpeciesType.ELECTRIC, SpeciesType.ROCK, SpeciesType.ICE],
))

# 4. Aquo (Water)
register_species(Species(
    id="aquo",
    name="Aquo",
    description="A playful water droplet creature. It leaves a trail of moisture wherever it goes.",
    species_type=SpeciesType.WATER,
    rarity=Rarity.COMMON,
    base_stats={"health": 55, "energy": 50, "happiness": 60, "intelligence": 50, "speed": 40, "strength": 45},
    evolution_target="marina",
    evolution_level=16,
    habitat="oceans",
    strengths=[SpeciesType.FIRE, SpeciesType.GROUND, SpeciesType.ROCK],
    weaknesses=[SpeciesType.ELECTRIC, SpeciesType.GRASS],
))

# 5. Marina (Water) - Evolution of Aquo
register_species(Species(
    id="marina",
    name="Marina",
    description="A graceful water nymph. It can control small bodies of water with its thoughts.",
    species_type=SpeciesType.WATER,
    rarity=Rarity.UNCOMMON,
    base_stats={"health": 75, "energy": 70, "happiness": 70, "intelligence": 70, "speed": 60, "strength": 65},
    evolution_target="oceanus",
    evolution_level=36,
    habitat="oceans",
    strengths=[SpeciesType.FIRE, SpeciesType.GROUND, SpeciesType.ROCK],
    weaknesses=[SpeciesType.ELECTRIC, SpeciesType.GRASS],
))

# 6. Oceanus (Water/Psychic) - Evolution of Marina
register_species(Species(
    id="oceanus",
    name="Oceanus",
    description="An ancient sea deity. Its wisdom spans the depths of all oceans.",
    species_type=SpeciesType.WATER,
    rarity=Rarity.EPIC,
    base_stats={"health": 100, "energy": 90, "happiness": 80, "intelligence": 110, "speed": 80, "strength": 85},
    habitat="deep ocean",
    strengths=[SpeciesType.FIRE, SpeciesType.GROUND, SpeciesType.ROCK, SpeciesType.POISON, SpeciesType.FIGHTING],
    weaknesses=[SpeciesType.ELECTRIC, SpeciesType.GRASS, SpeciesType.BUG, SpeciesType.GHOST, SpeciesType.DARK],
))

# 7. Sparky (Electric)
register_species(Species(
    id="sparky",
    name="Sparky",
    description="A tiny electrical spark that zips around energetically. It crackles with static.",
    species_type=SpeciesType.ELECTRIC,
    rarity=Rarity.COMMON,
    base_stats={"health": 35, "energy": 60, "happiness": 55, "intelligence": 55, "speed": 90, "strength": 40},
    evolution_target="volt",
    evolution_level=15,
    habitat="cities",
    strengths=[SpeciesType.WATER, SpeciesType.FLYING],
    weaknesses=[SpeciesType.GROUND],
))

# 8. Volt (Electric) - Evolution of Sparky
register_species(Species(
    id="volt",
    name="Volt",
    description="A lightning bolt given form. It can power small devices with its touch.",
    species_type=SpeciesType.ELECTRIC,
    rarity=Rarity.RARE,
    base_stats={"health": 60, "energy": 90, "happiness": 65, "intelligence": 75, "speed": 110, "strength": 65},
    evolution_target="raiju",
    evolution_level=35,
    habitat="thunderstorms",
    strengths=[SpeciesType.WATER, SpeciesType.FLYING],
    weaknesses=[SpeciesType.GROUND],
))

# 9. Raiju (Electric) - Evolution of Volt
register_species(Species(
    id="raiju",
    name="Raiju",
    description="A thunder beast of legend. It rides lightning bolts across stormy skies.",
    species_type=SpeciesType.ELECTRIC,
    rarity=Rarity.LEGENDARY,
    base_stats={"health": 80, "energy": 110, "happiness": 75, "intelligence": 90, "speed": 130, "strength": 85},
    habitat="thunderstorms",
    strengths=[SpeciesType.WATER, SpeciesType.FLYING],
    weaknesses=[SpeciesType.GROUND],
))

# 10. Flora (Grass)
register_species(Species(
    id="flora",
    name="Flora",
    description="A gentle flower spirit. It brings life to any garden it visits.",
    species_type=SpeciesType.GRASS,
    rarity=Rarity.COMMON,
    base_stats={"health": 50, "energy": 55, "happiness": 65, "intelligence": 50, "speed": 35, "strength": 45},
    evolution_target="bloom",
    evolution_level=18,
    habitat="forests",
    strengths=[SpeciesType.WATER, SpeciesType.GROUND, SpeciesType.ROCK],
    weaknesses=[SpeciesType.FIRE, SpeciesType.ICE, SpeciesType.POISON, SpeciesType.FLYING, SpeciesType.BUG],
))

# 11. Bloom (Grass/Fairy) - Evolution of Flora
register_species(Species(
    id="bloom",
    name="Bloom",
    description="A beautiful flower fairy. Its petals can heal minor wounds.",
    species_type=SpeciesType.GRASS,
    rarity=Rarity.RARE,
    base_stats={"health": 70, "energy": 75, "happiness": 80, "intelligence": 70, "speed": 55, "strength": 65},
    evolution_target="dryad",
    evolution_level=38,
    habitat="enchanted forests",
    strengths=[SpeciesType.WATER, SpeciesType.GROUND, SpeciesType.ROCK, SpeciesType.FIGHTING, SpeciesType.DARK, SpeciesType.DRAGON],
    weaknesses=[SpeciesType.FIRE, SpeciesType.ICE, SpeciesType.POISON, SpeciesType.FLYING, SpeciesType.STEEL],
))

# 12. Dryad (Grass/Fairy) - Evolution of Bloom
register_species(Species(
    id="dryad",
    name="Dryad",
    description="A forest guardian spirit. It protects the woods and all who dwell within.",
    species_type=SpeciesType.GRASS,
    rarity=Rarity.EPIC,
    base_stats={"health": 90, "energy": 95, "happiness": 90, "intelligence": 90, "speed": 75, "strength": 85},
    habitat="ancient forests",
    strengths=[SpeciesType.WATER, SpeciesType.GROUND, SpeciesType.ROCK, SpeciesType.FIGHTING, SpeciesType.DARK, SpeciesType.DRAGON],
    weaknesses=[SpeciesType.FIRE, SpeciesType.ICE, SpeciesType.POISON, SpeciesType.FLYING, SpeciesType.STEEL],
))

# 13. Luna (Psychic)
register_species(Species(
    id="luna",
    name="Luna",
    description="A mysterious moon spirit. It appears only on starry nights.",
    species_type=SpeciesType.PSYCHIC,
    rarity=Rarity.RARE,
    base_stats={"health": 40, "energy": 70, "happiness": 50, "intelligence": 80, "speed": 60, "strength": 35},
    evolution_target="cosmos",
    evolution_level=25,
    habitat="night skies",
    strengths=[SpeciesType.FIGHTING, SpeciesType.POISON],
    weaknesses=[SpeciesType.BUG, SpeciesType.GHOST, SpeciesType.DARK],
))

# 14. Cosmos (Psychic/Cosmic) - Evolution of Luna
register_species(Species(
    id="cosmos",
    name="Cosmos",
    description="A celestial entity that holds the wisdom of the stars.",
    species_type=SpeciesType.COSMIC,
    rarity=Rarity.MYTHIC,
    base_stats={"health": 70, "energy": 110, "happiness": 70, "intelligence": 130, "speed": 90, "strength": 70},
    habitat="space",
    strengths=[SpeciesType.FIGHTING, SpeciesType.POISON, SpeciesType.PSYCHIC, SpeciesType.GHOST],
    weaknesses=[SpeciesType.BUG, SpeciesType.GHOST, SpeciesType.DARK],
))

# 15. Shade (Dark)
register_species(Species(
    id="shade",
    name="Shade",
    description="A playful shadow that detaches from its owner at night.",
    species_type=SpeciesType.DARK,
    rarity=Rarity.UNCOMMON,
    base_stats={"health": 35, "energy": 45, "happiness": 45, "intelligence": 60, "speed": 70, "strength": 50},
    evolution_target="umbra",
    evolution_level=20,
    habitat="shadows",
    strengths=[SpeciesType.PSYCHIC, SpeciesType.GHOST],
    weaknesses=[SpeciesType.FIGHTING, SpeciesType.BUG, SpeciesType.FAIRY],
))

# 16. Umbra (Dark/Ghost) - Evolution of Shade
register_species(Species(
    id="umbra",
    name="Umbra",
    description="A master of shadows that can slip through the smallest cracks.",
    species_type=SpeciesType.DARK,
    rarity=Rarity.RARE,
    base_stats={"health": 60, "energy": 70, "happiness": 55, "intelligence": 85, "speed": 95, "strength": 75},
    evolution_target="void",
    evolution_level=40,
    habitat="darkness",
    strengths=[SpeciesType.PSYCHIC, SpeciesType.GHOST],
    weaknesses=[SpeciesType.FIGHTING, SpeciesType.BUG, SpeciesType.FAIRY],
))

# 17. Void (Dark/Ghost) - Evolution of Umbra
register_species(Species(
    id="void",
    name="Void",
    description="An entity from beyond reality. Its gaze can freeze souls.",
    species_type=SpeciesType.DARK,
    rarity=Rarity.LEGENDARY,
    base_stats={"health": 85, "energy": 95, "happiness": 65, "intelligence": 110, "speed": 120, "strength": 95},
    habitat="void",
    strengths=[SpeciesType.PSYCHIC, SpeciesType.GHOST],
    weaknesses=[SpeciesType.FIGHTING, SpeciesType.BUG, SpeciesType.FAIRY],
))

# 18. Prism (Fairy)
register_species(Species(
    id="prism",
    name="Prism",
    description="A crystalline fairy that refracts light into beautiful rainbows.",
    species_type=SpeciesType.FAIRY,
    rarity=Rarity.EPIC,
    base_stats={"health": 55, "energy": 80, "happiness": 80, "intelligence": 75, "speed": 70, "strength": 55},
    evolution_target="spectrum",
    evolution_level=30,
    habitat="crystal caves",
    strengths=[SpeciesType.FIGHTING, SpeciesType.DRAGON, SpeciesType.DARK],
    weaknesses=[SpeciesType.POISON, SpeciesType.STEEL],
))

# 19. Spectrum (Fairy) - Evolution of Prism
register_species(Species(
    id="spectrum",
    name="Spectrum",
    description="A radiant being of pure light and joy. Its presence banishes darkness.",
    species_type=SpeciesType.FAIRY,
    rarity=Rarity.MYTHIC,
    base_stats={"health": 80, "energy": 110, "happiness": 100, "intelligence": 100, "speed": 95, "strength": 80},
    habitat="rainbow bridges",
    strengths=[SpeciesType.FIGHTING, SpeciesType.DRAGON, SpeciesType.DARK],
    weaknesses=[SpeciesType.POISON, SpeciesType.STEEL],
))


def get_all_species() -> List[Species]:
    """Get all registered species."""
    return list(SPECIES_DATABASE.values())


def get_species(species_id: str) -> Optional[Species]:
    """Get a species by ID."""
    return SPECIES_DATABASE.get(species_id)


def get_species_by_rarity(rarity: Rarity) -> List[Species]:
    """Get all species of a specific rarity."""
    return [s for s in SPECIES_DATABASE.values() if s.rarity == rarity]


def get_species_by_type(species_type: SpeciesType) -> List[Species]:
    """Get all species of a specific type."""
    return [s for s in SPECIES_DATABASE.values() if s.species_type == species_type]


def get_random_species(rarity: Optional[Rarity] = None) -> Species:
    """Get a random species, optionally filtered by rarity."""
    if rarity:
        species_list = get_species_by_rarity(rarity)
    else:
        species_list = get_all_species()
    return random.choice(species_list)


def get_starter_species() -> List[Species]:
    """Get the three starter species (Fire, Water, Electric)."""
    return [
        SPECIES_DATABASE["pyro"],
        SPECIES_DATABASE["aquo"],
        SPECIES_DATABASE["sparky"],
    ]
