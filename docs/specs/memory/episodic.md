# Episodic Memory Specification

## Overview

Episodic memory stores and retrieves discrete events or experiences Bob has encountered. It supports both short-term (working) and long-term memory with temporal indexing, attention-based retrieval, and sleep-like consolidation.

## Requirements

### 5.1 Short-Term Working Memory

- [ ] Attention-based retrieval using recent experience prioritization
- [ ] Sliding window memory with configurable horizon
- [ ] Contextual retrieval based on query similarity
- [ ] Attention gating for selective access
- [ ] Working memory consolidation into long-term storage
- [ ] Buffer overflow policies (FIFO, LRU, recency-weighted)

### 5.2 Long-Term Episodic Storage

- [ ] Temporal indexing for time-aware retrieval
- [ ] Semantic indexing for concept-based retrieval
- [ ] Episodic clustering for related experience grouping
- [ ] Multi-resolution temporal indexing (seconds, minutes, hours, days)
- [ ] Distributed storage across memory banks
- [ ] Compression and deduplication of similar episodes

### 5.3 Memory Consolidation

- [ ] Sleep-like replay mechanisms (offline consolidation)
- [ ] Hippocampo-cortical-like replay (fast/Slow) phases
- [ ] Consolidation priority based on recency and significance
- [ ] Conflict resolution during consolidation
- [ ] Distributed consolidation across memory subsystems
- [ ] Replay-based memory strengthening

### 5.4 Forgetting Policies

- [ ] Recency-based decay (recent memories retained longer)
- [ ] Frequency-based decay (frequently accessed memories retained)
- [ ] Interference-based forgetting (similar episodes compete)
- [ ] Importance-weighted forgetting (task-critical memories protected)
- [ ] Active forgetting via selective pruning
- [ ] Forgetting curve optimization (Zeno-like asymptotes)

### 5.5 Temporal Reasoning

- [ ] Time-based memory pruning (age-dependent forgetting)
- [ ] Causal chain reconstruction across episodes
- [ ] Temporal generalization (similar past → current situation)
- [ ] Prediction based on episodic patterns
- [ ] Memory-based extrapolation over time

### 5.6 Query and Retrieval

- [ ] Multi-modal query support (text, image, audio)
- [ ] Semantic similarity retrieval
- [ ] Temporal range queries
- [ ] Multi-hop episodic reasoning
- [ ] Episodic summarization for long-term storage
- [ ] Retrieval with ranked relevance scores

## Interfaces

### External Interfaces

**Episodic Memory Interface:**

```
episodic_memory {
  store(episode: Episode) -> storage_id
  retrieve(query: Query) -> Episode[]
  consolidate(batch: Episode[]) -> statistics
  forget(policies: Policy) -> removed_items
  get_statistics() -> metrics
}
```

**Query Interface:**

```
query {
  id: string                        // Unique query identifier
  timestamp: datetime                // Query time
  context: map<string, any>         // Query context
  parameters: map<string, any>      // Query parameters
  priority: float                   // Query priority
}
```

### Internal Interfaces

**Semantic Memory:**
- Summarize episodic content for semantic updates
- Retrieve semantic concepts for episodic indexing
- Consolidate episodic information into semantic concepts

**Procedural Memory:**
- Extract successful patterns into procedures
- Retrieve procedures based on episodic triggers
- Use procedural knowledge for episodic prediction

**Self-Supervised Learning:**
- Use episodic data for representation learning
- Consolidate representations during sleep phases
- Apply forgetting policies to representations

**Reinforcement Learning:**
- Replay past experiences for policy refinement
- Use episodic rewards for reward model calibration
- Consolidate episodic RL experiences

**Online Learning:**
- Store new experiences in episodic memory
- Apply forgetting to prevent interference
- Consolidate episodic updates

## Data Contracts

### Episode Schema

```
episode {
  id: string                         // Unique episode ID
  timestamp: datetime                // Occurrence time
  modality: string[]                  // Observation modalities
  context: map<string, any>          // Environmental context
  summary: string                     // Episode summary
  tags: string[]                     // Categorization tags
  similarity_to: string[]             // Similar episode IDs
  importance: float                   // Assigned or learned importance
}
```

### Storage Schema

```
storage {
  id: string                          // Internal storage ID
  episode_id: string                  // Original episode ID
  timestamp: datetime                // Storage time
  metadata: map<string, any>         // Storage metadata
  compressed: bool                    // Compression flag
  location: string                   // Physical/abstract location
}
```

### Consolidation Schema

```
consolidation {
  id: string                           // Consolidation ID
  phase: string                        // Fast, slow, or other
  source: string                        // Source memory bank
  destination: string                   // Destination memory bank
  items: int                           // Items consolidated
  success: bool                        // Success indicator
  duration: float                      // Processing duration
}
```

### Forgetting Schema

```
forgetting {
  id: string                           // Forgetting event ID
  policy: string                        // Applied forgetting policy
  items: string[]                      // Forgetting IDs
  priority: float                      // Forgetting priority
  reason: string                       // Forgetting rationale
}
```

## Success Criteria

1. **Retrieval Performance**
   - Retrieval latency ≤10ms p99
   - Retrieval accuracy ≥95% on standard benchmarks
   - Relevance ranking nDCG ≥0.8
   - Multi-modal query resolution rate ≥90%

2. **Consolidation Efficiency**
   - Consolidation reduces memory footprint by ≥50%
   - Consolidation maintains ≥95% retrieval accuracy
   - Offline consolidation completes within 1× real-time
   - Fast/slow phase separation achieves optimal forgetting curves

3. **Forgetting Characteristics**
   - Forgetting curve follows expected asymptotic behavior
   - Recency-based retention ≥80% of recent items
   - Frequency-based protection maintains ≥85% access rate
   - Importance-weighted forgetting preserves ≥90% of critical memories

4. **Temporal Reasoning**
   - Causal chain reconstruction accuracy ≥85%
   - Temporal generalization F1 ≥0.8
   - Extrapolation error ≤5× baseline
   - Multi-hop reasoning success rate ≥70%

5. **Memory Management**
   - Memory utilization maintained within ±10% of target
   - Compression achieves ≥80% size reduction with ≥90% accuracy
   - Deduplication reduces duplicate storage by ≥95%
   - Distributed storage achieves ≥99.9% availability

## Open Questions

1. **Consolidation Timing:** What is the optimal schedule for fast/slow consolidation phases?
2. **Forgetting Trade-offs:** How to balance forgetting with retention for different task types?
3. **Episodic Summarization:** What summarization strategy minimizes information loss?
4. **Temporal Indexing:** What temporal granularity optimizes both retrieval and storage?
5. **Sleep Mechanisms:** How to emulate biological sleep cycles computationally?

## References

- Tulving (1972). Priming and human memory systems
- McLean & Miller (2010). Memory consolidation during sleep
- Wilson & McNaughton (1994). Reactivation of hippocampal ensemble memories during sleep
- Desteno et al. (2009). Remembering the past, imagining the future
- Drosopoulou et al. (2022). Hippocampus-dependent temporal generalization
