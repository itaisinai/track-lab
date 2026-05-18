# Track Lab System Architecture

This is the canonical architecture diagram in Mermaid form.

```mermaid
flowchart TD
  U[User] --> W[apps/web]
  W --> A[apps/api]
  A --> Q[SQLite job queue]
  Q --> R[apps/worker]
  R --> D[Datastore provider]

  R --> P1[packages/metadata-enrichment]
  R --> P2[packages/remix-search]

  P1 --> S1[Spotify identity search]
  P1 --> S2[GetSongBPM]
  P1 --> S3[EDM planner]
  P1 --> S4[Beatport]
  P1 --> S5[SoundCloud]
  P1 --> S6[Wikipedia context]
  P1 --> S7[metadata synthesis]

  P2 --> T1[Spotify remix search]
  P2 --> T2[SoundCloud web search]
  P2 --> T3[SoundCloud API]
  P2 --> T4[Deterministic scoring]
  P2 --> T5[LLM judge]

  R --> N[Notifications / review queue]
  D --> N

  S1 --> D
  S2 --> D
  S4 --> D
  S5 --> D
  S6 --> D
  S7 --> D

  T1 --> D
  T2 --> D
  T3 --> D
  T4 --> D
  T5 --> D
```

## Notes

- The worker/orchestrator owns execution.
- Providers fetch evidence in application code.
- The LLM plans, judges, or synthesizes; it does not autonomously call tools.
- Beatport and SoundCloud are the EDM optional provider group.
- Remix search separates deterministic provider search from LLM judging.
- The datastore provider defaults to SQLite and can switch to Prisma/PostgreSQL for the datastore tables that have Prisma support.
- Terminology rules are documented in [`ai-terminology.md`](./ai-terminology.md).
- The agent orchestrator flow is documented in [`agent-workflow.md`](./agent-workflow.md).
