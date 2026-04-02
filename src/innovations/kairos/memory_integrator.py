"""
Memory Integrator - Cross-session memory consolidation and retrieval.
"""

import asyncio
import hashlib
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from collections import defaultdict
import json
import numpy as np


@dataclass
class MemoryFragment:
    """A piece of extracted memory."""
    id: str
    content: str
    source_session: str
    created_at: datetime
    importance: float = 1.0
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    tags: Set[str] = field(default_factory=set)
    embedding: Optional[List[float]] = None
    
    def touch(self):
        """Update access metadata."""
        self.access_count += 1
        self.last_accessed = datetime.now()


@dataclass
class MemoryCluster:
    """Cluster of related memories."""
    id: str
    memories: List[MemoryFragment] = field(default_factory=list)
    centroid: Optional[List[float]] = None
    theme: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class MemoryIntegrator:
    """
    Integrates memories across sessions for persistent context.
    
    Features:
    - Session memory extraction
    - Semantic clustering
    - Importance scoring
    - Retrieval with relevance ranking
    - Consolidation and pruning
    """
    
    def __init__(self):
        self._memories: Dict[str, MemoryFragment] = {}
        self._clusters: Dict[str, MemoryCluster] = {}
        self._session_memories: Dict[str, Set[str]] = defaultdict(set)
        self._tag_index: Dict[str, Set[str]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._embedding_dim = 128
        
    async def integrate_session(self, session_id: str) -> None:
        """Integrate memories from a session."""
        async with self._lock:
            # Extract memories from session
            memories = await self._extract_session_memories(session_id)
            
            for memory in memories:
                # Generate embedding
                memory.embedding = await self._generate_embedding(memory.content)
                
                # Store memory
                self._memories[memory.id] = memory
                self._session_memories[session_id].add(memory.id)
                
                # Index tags
                for tag in memory.tags:
                    self._tag_index[tag].add(memory.id)
                    
            # Cluster new memories
            await self._cluster_memories()
            
            # Consolidate if needed
            await self._consolidate()
            
    async def retrieve(
        self,
        query: str,
        limit: int = 10,
        min_relevance: float = 0.5
    ) -> List[MemoryFragment]:
        """Retrieve relevant memories."""
        async with self._lock:
            query_embedding = await self._generate_embedding(query)
            
            # Calculate similarities
            scored_memories = []
            for memory in self._memories.values():
                if memory.embedding:
                    similarity = self._cosine_similarity(
                        query_embedding,
                        memory.embedding
                    )
                    if similarity >= min_relevance:
                        scored_memories.append((similarity, memory))
                        
            # Sort by relevance
            scored_memories.sort(key=lambda x: x[0], reverse=True)
            
            # Return top results
            results = []
            for score, memory in scored_memories[:limit]:
                memory.touch()
                results.append(memory)
                
            return results
            
    async def retrieve_by_tags(
        self,
        tags: List[str],
        limit: int = 10
    ) -> List[MemoryFragment]:
        """Retrieve memories by tags."""
        async with self._lock:
            # Find memory IDs matching all tags
            matching_ids = None
            for tag in tags:
                if matching_ids is None:
                    matching_ids = self._tag_index[tag].copy()
                else:
                    matching_ids &= self._tag_index[tag]
                    
            if not matching_ids:
                return []
                
            # Get memories sorted by importance
            memories = [
                self._memories[mid] for mid in matching_ids
                if mid in self._memories
            ]
            memories.sort(key=lambda m: m.importance, reverse=True)
            
            for m in memories[:limit]:
                m.touch()
                
            return memories[:limit]
            
    async def update_importance(self, memory_id: str, delta: float) -> None:
        """Update memory importance."""
        async with self._lock:
            if memory_id in self._memories:
                self._memories[memory_id].importance = max(
                    0.0,
                    min(1.0, self._memories[memory_id].importance + delta)
                )
                
    async def forget_session(self, session_id: str) -> None:
        """Remove all memories from a session."""
        async with self._lock:
            memory_ids = self._session_memories.get(session_id, set())
            
            for mid in memory_ids:
                if mid in self._memories:
                    memory = self._memories[mid]
                    # Remove from tag index
                    for tag in memory.tags:
                        self._tag_index[tag].discard(mid)
                    del self._memories[mid]
                    
            del self._session_memories[session_id]
            
    async def sync(self) -> None:
        """Synchronize memory state."""
        async with self._lock:
            await self._consolidate()
            
    async def _extract_session_memories(
        self,
        session_id: str
    ) -> List[MemoryFragment]:
        """Extract memories from a session."""
        # This would integrate with actual session data
        # For now, return empty list
        return []
        
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate text embedding (simplified)."""
        # Simplified embedding - in production would use proper embedding model
        hash_val = hashlib.md5(text.encode()).hexdigest()
        embedding = []
        for i in range(0, len(hash_val), 2):
            val = int(hash_val[i:i+2], 16) / 255.0
            embedding.append(val)
        
        # Pad or truncate to embedding dimension
        if len(embedding) < self._embedding_dim:
            embedding.extend([0.0] * (self._embedding_dim - len(embedding)))
        else:
            embedding = embedding[:self._embedding_dim]
            
        return embedding
        
    def _cosine_similarity(
        self,
        a: List[float],
        b: List[float]
    ) -> float:
        """Calculate cosine similarity between two vectors."""
        a_arr = np.array(a)
        b_arr = np.array(b)
        
        norm_a = np.linalg.norm(a_arr)
        norm_b = np.linalg.norm(b_arr)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))
        
    async def _cluster_memories(self) -> None:
        """Cluster memories by semantic similarity."""
        # Simplified clustering - in production would use proper clustering
        unclustered = [
            m for m in self._memories.values()
            if not any(m.id in cluster.memories for cluster in self._clusters.values())
        ]
        
        for memory in unclustered:
            # Find best matching cluster
            best_cluster = None
            best_similarity = 0.7  # Threshold
            
            for cluster in self._clusters.values():
                if cluster.centroid:
                    similarity = self._cosine_similarity(
                        memory.embedding or [0] * self._embedding_dim,
                        cluster.centroid
                    )
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_cluster = cluster
                        
            if best_cluster:
                best_cluster.memories.append(memory)
                await self._update_cluster_centroid(best_cluster)
            else:
                # Create new cluster
                cluster_id = f"cluster_{len(self._clusters)}"
                self._clusters[cluster_id] = MemoryCluster(
                    id=cluster_id,
                    memories=[memory],
                    centroid=memory.embedding
                )
                
    async def _update_cluster_centroid(self, cluster: MemoryCluster) -> None:
        """Update cluster centroid."""
        if not cluster.memories:
            return
            
        embeddings = [
            m.embedding for m in cluster.memories if m.embedding
        ]
        
        if embeddings:
            cluster.centroid = list(np.mean(embeddings, axis=0))
            cluster.updated_at = datetime.now()
            
    async def _consolidate(self) -> None:
        """Consolidate and prune memories."""
        now = datetime.now()
        to_remove = []
        
        for memory_id, memory in self._memories.items():
            # Remove very old, unimportant memories
            age = now - memory.created_at
            if age > timedelta(days=30) and memory.importance < 0.1:
                to_remove.append(memory_id)
                continue
                
            # Remove memories never accessed
            if memory.access_count == 0 and age > timedelta(days=7):
                to_remove.append(memory_id)
                continue
                
        for mid in to_remove:
            del self._memories[mid]
            
    def serialize(self) -> Dict[str, Any]:
        """Serialize memory state."""
        return {
            "memories": {
                mid: {
                    **asdict(m),
                    "tags": list(m.tags),
                }
                for mid, m in self._memories.items()
            },
            "clusters": {
                cid: {
                    **asdict(c),
                    "memories": [m.id for m in c.memories],
                }
                for cid, c in self._clusters.items()
            },
        }
        
    async def deserialize(self, data: Dict[str, Any]) -> None:
        """Deserialize memory state."""
        # Memories would need to be reconstructed
        pass
