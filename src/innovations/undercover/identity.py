"""
Identity - Anonymous identity generation.
"""

import hashlib
import random
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime


# Neutral adjectives for usernames
ADJECTIVES = [
    'happy', 'bright', 'calm', 'clever', 'cool', 'creative', 'curious',
    'eager', 'fair', 'fancy', 'friendly', 'funny', 'gentle', 'gifted',
    'helpful', 'honest', 'jolly', 'joyful', 'keen', 'kind', 'lively',
    'lovely', 'lucky', 'merry', 'neat', 'nice', 'noble', 'polite',
    'proud', 'quick', 'quiet', 'ready', 'rich', 'shy', 'silly',
    'smart', 'strong', 'sweet', 'tidy', 'vast', 'warm', 'wise',
    'witty', 'zany', 'zealous', 'brave', 'bold', 'chill', 'daring',
    'elegant', 'fierce', 'graceful', 'humble', 'mighty', 'nimble',
    'peaceful', 'quirky', 'radiant', 'serene', 'swift', 'tender',
    'unique', 'valiant', 'wild', 'young', 'active', 'balanced',
]

# Neutral nouns for usernames
NOUNS = [
    'alpaca', 'badger', 'beaver', 'bison', 'buffalo', 'butterfly',
    'camel', 'cardinal', 'chipmunk', 'cobra', 'crane', 'crow',
    'deer', 'dolphin', 'dove', 'duck', 'eagle', 'elephant', 'falcon',
    'finch', 'fox', 'frog', 'gazelle', 'giraffe', 'goose', 'hawk',
    'heron', 'horse', 'hummingbird', 'ibex', 'iguana', 'jaguar',
    'jay', 'kangaroo', 'koala', 'lemur', 'leopard', 'lion', 'lizard',
    'llama', 'lynx', 'magpie', 'meerkat', 'moose', 'mouse', 'newt',
    'octopus', 'otter', 'owl', 'panda', 'panther', 'parrot', 'pelican',
    'penguin', 'pheasant', 'rabbit', 'raccoon', 'raven', 'robin',
    'salmon', 'seal', 'shark', 'sheep', 'snake', 'sparrow', 'squid',
    'squirrel', 'stork', 'swan', 'tiger', 'toad', 'trout', 'turtle',
    'viper', 'vulture', 'walrus', 'weasel', 'whale', 'wolf', 'wombat',
    'woodpecker', 'yak', 'zebra', 'acorn', 'aster', 'bamboo', 'bloom',
    'blossom', 'breeze', 'brook', 'canyon', 'cascade', 'cedar', 'cliff',
    'cloud', 'coral', 'crystal', 'dawn', 'dew', 'drift', 'dune',
    'echo', 'ember', 'fern', 'field', 'flame', 'fog', 'forest',
    'frost', 'galaxy', 'garden', 'glade', 'glen', 'grove', 'harbor',
    'hill', 'horizon', 'island', 'jade', 'lake', 'leaf', 'meadow',
    'mist', 'moon', 'mountain', 'ocean', 'peak', 'petal', 'pine',
    'pond', 'rain', 'reef', 'ridge', 'river', 'rock', 'root',
    'rose', 'sea', 'shadow', 'shore', 'sky', 'snow', 'spring',
    'star', 'stone', 'storm', 'stream', 'sun', 'surf', 'swamp',
    'thorn', 'thunder', 'tide', 'timber', 'valley', 'vine', 'wave',
    'willow', 'wind', 'wood',
]

# Neutral domains
DOMAINS = [
    'example.com', 'anonymous.test', 'contributor.local',
    'opensource.dev', 'coder.mail', 'dev.null'
]


@dataclass
class AnonymousIdentity:
    """Anonymous contributor identity."""
    username: str
    email: str
    name: str
    created_at: datetime
    fingerprint: str
    
    def to_git_config(self) -> Dict[str, str]:
        """Convert to git config format."""
        return {
            'user.name': self.name,
            'user.email': self.email,
        }


class IdentityGenerator:
    """
    Generates anonymous identities for contributions.
    
    Creates consistent, neutral identities that don't reveal
    the actual contributor's information.
    """
    
    def __init__(self, seed: Optional[str] = None):
        self.seed = seed
        self._identities: Dict[str, AnonymousIdentity] = {}
        
    def generate(
        self,
        real_identity: Optional[str] = None,
        consistent: bool = True
    ) -> AnonymousIdentity:
        """
        Generate an anonymous identity.
        
        Args:
            real_identity: Optional real identity to base generation on
            consistent: If True, same real_identity produces same result
            
        Returns:
            AnonymousIdentity
        """
        if consistent and real_identity:
            # Check cache
            if real_identity in self._identities:
                return self._identities[real_identity]
                
            # Generate consistent identity from hash
            identity = self._generate_from_hash(real_identity)
            self._identities[real_identity] = identity
            return identity
        else:
            # Generate random identity
            return self._generate_random()
            
    def _generate_from_hash(self, source: str) -> AnonymousIdentity:
        """Generate identity deterministically from source."""
        # Create hash
        hash_input = f"{self.seed or ''}:{source}"
        hash_obj = hashlib.sha256(hash_input.encode())
        hash_hex = hash_obj.hexdigest()
        
        # Use hash to select components
        adj_index = int(hash_hex[:8], 16) % len(ADJECTIVES)
        noun_index = int(hash_hex[8:16], 16) % len(NOUNS)
        domain_index = int(hash_hex[16:24], 16) % len(DOMAINS)
        
        adjective = ADJECTIVES[adj_index]
        noun = NOUNS[noun_index]
        domain = DOMAINS[domain_index]
        
        # Generate username
        username = f"{adjective}_{noun}"
        
        # Generate email
        email = f"{username}@{domain}"
        
        # Generate display name
        name = f"{adjective.capitalize()} {noun.capitalize()}"
        
        # Generate fingerprint
        fingerprint = hash_obj.hexdigest()[:16]
        
        return AnonymousIdentity(
            username=username,
            email=email,
            name=name,
            created_at=datetime.now(),
            fingerprint=fingerprint
        )
        
    def _generate_random(self) -> AnonymousIdentity:
        """Generate a random identity."""
        adjective = random.choice(ADJECTIVES)
        noun = random.choice(NOUNS)
        domain = random.choice(DOMAINS)
        
        username = f"{adjective}_{noun}"
        email = f"{username}@{domain}"
        name = f"{adjective.capitalize()} {noun.capitalize()}"
        
        # Generate random fingerprint
        fingerprint = hashlib.sha256(
            f"{datetime.now().timestamp()}:{random.random()}".encode()
        ).hexdigest()[:16]
        
        return AnonymousIdentity(
            username=username,
            email=email,
            name=name,
            created_at=datetime.now(),
            fingerprint=fingerprint
        )
        
    def get_anonymous_identity(self, source: Optional[str] = None) -> AnonymousIdentity:
        """
        Get anonymous identity (alias for generate).
        
        Args:
            source: Optional source identity
            
        Returns:
            AnonymousIdentity
        """
        return self.generate(source, consistent=True)
        
    def rotate_identity(self, source: str) -> AnonymousIdentity:
        """
        Generate a new identity for the same source.
        
        Args:
            source: Source identity
            
        Returns:
            New AnonymousIdentity
        """
        # Remove from cache to force regeneration
        if source in self._identities:
            del self._identities[source]
            
        # Add random component to seed
        old_seed = self.seed
        self.seed = f"{self.seed or ''}:{random.random()}"
        
        identity = self.generate(source, consistent=True)
        
        # Restore seed
        self.seed = old_seed
        
        return identity


# Predefined neutral identities for common use cases
PREDEFINED_IDENTITIES = {
    'default': AnonymousIdentity(
        username='opensource_contributor',
        email='contributor@example.com',
        name='Open Source Contributor',
        created_at=datetime.now(),
        fingerprint='0000000000000000'
    ),
    'bot': AnonymousIdentity(
        username='automation_bot',
        email='bot@example.com',
        name='Automation Bot',
        created_at=datetime.now(),
        fingerprint='1111111111111111'
    ),
    'maintainer': AnonymousIdentity(
        username='project_maintainer',
        email='maintainer@example.com',
        name='Project Maintainer',
        created_at=datetime.now(),
        fingerprint='2222222222222222'
    ),
}


def get_predefined_identity(name: str) -> Optional[AnonymousIdentity]:
    """Get a predefined anonymous identity."""
    identity = PREDEFINED_IDENTITIES.get(name)
    if identity:
        # Return a copy with updated timestamp
        return AnonymousIdentity(
            username=identity.username,
            email=identity.email,
            name=identity.name,
            created_at=datetime.now(),
            fingerprint=identity.fingerprint
        )
    return None
