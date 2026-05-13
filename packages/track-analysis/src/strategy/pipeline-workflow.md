# Track Lab Pipeline Workflow

This is the lightweight Markdown workflow companion to the pipeline strategy
doc. It intentionally replaces the older SVG strategy diagrams.

```mermaid
flowchart TD
  A[User request] --> B[Normalize request]
  B --> C{Operation}

  C -->|analyze / enrich| D[Load known metadata]
  D --> E[Run Spotify identity search]
  E --> F[Run GetSongBPM if BPM or key is missing]
  F --> G{Deterministic EDM signals clear?}
  G -->|yes| H[Run Beatport + SoundCloud in code]
  G -->|no| I[Skip EDM providers]
  G -->|ambiguous| J[Ask LLM EDM planner]
  J --> H
  H --> K[Normalize / dedupe evidence]
  I --> K
  K --> L[LLM synthesis]
  L --> M[Final metadata]

  C -->|remix_search| N[Resolve original track]
  N --> O[Build remix queries]
  O --> P[Run remix providers in code]
  P --> Q[Deterministic scoring + dedupe]
  Q --> R[Compact LLM judge batches]
  R --> S{Batch yielded results?}
  S -->|yes| T[Select final candidates]
  S -->|no| U[Try one more batch]
  U --> V{Any candidates?}
  V -->|yes| T
  V -->|no| W[Deterministic fallback]

  M --> X[Store result / review queue]
  T --> X
  W --> X
```

## Notes

- The worker/orchestrator owns execution.
- Providers execute in application code.
- The LLM only plans, judges, or synthesizes.
- Beatport and SoundCloud run as one EDM provider group.
- Search and judging are separate phases for remix search.
