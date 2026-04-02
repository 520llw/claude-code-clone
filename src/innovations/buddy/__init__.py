"""
Buddy System - Virtual AI Companion

A complete virtual pet system with species, rarity, stats,
accessories, and interactive gameplay.
"""

from .core import BuddySystem, Buddy, BuddyStatus
from .species import Species, SpeciesType, Rarity, get_all_species
from .stats import Stats, Personality
from .accessories import Accessory, AccessoryType, AccessorySlot
from .interactions import Action, InteractionResult, InteractionType
from .evolution import EvolutionPath, EvolutionCondition

__all__ = [
    'BuddySystem',
    'Buddy',
    'BuddyStatus',
    'Species',
    'SpeciesType',
    'Rarity',
    'get_all_species',
    'Stats',
    'Personality',
    'Accessory',
    'AccessoryType',
    'AccessorySlot',
    'Action',
    'InteractionResult',
    'InteractionType',
    'EvolutionPath',
    'EvolutionCondition',
]
