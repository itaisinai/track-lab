# Track Lab Agent Workflow

This diagram covers the focused music-discovery agent that powers the chat
panel. It interprets each message with the current session context, routes the
message to the right session, and uses only the user-facing tools.

```mermaid
flowchart TD
  U[User message] --> W[apps/web agent chat]
  W --> A[apps/api /agent/sessions/:id/messages]
  A --> R[packages/agent-chat AgentRuntime]

  R --> I[LLM message interpretation]
  I --> S{Session routing}
  S -->|continue current session| C[Use existing session]
  S -->|start new session| N[Create new session]
  S -->|ask clarifying question| Q[Return clarification]

  C --> P[Build agent prompt from session metadata, recent messages, and relevant tool results]
  N --> P
  P --> L[LLM agent loop]

  L --> T1[analyze_track]
  L --> T2[search_remixes]

  T1 --> J[Track analysis job queue]
  T2 --> M[Remix search orchestration]

  J --> X[apps/worker]
  M --> X

  X --> D[SQLite datastore]
  D --> U1[Update session title and metadata]
  U1 --> W

  T1 --> U2[Queued analysis result in chat]
  T2 --> U3[Queued remix result in chat]
  U2 --> W
  U3 --> W

  U -->|follow-up about this track| I
  U -->|explicit different track| N
```

## Notes

- `analyze_track` updates the current focus track and session title after the
  worker result is available.
- `search_remixes` reuses the current focus track for follow-ups such as
  “this track” or “the same song.”
- The agent never exposes provider-specific tools to the user.
- New explicit track analysis starts a new session instead of mixing contexts.
