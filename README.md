# Track Lab

Track Lab enriches music track metadata with a metadata enrichment pipeline,
stores saved results in a local SQLite database by default with optional
Prisma/PostgreSQL support, and reuses saved results before calling external
providers.

## Structure

- `apps/api` - Express API.
- `apps/web` - React/Vite UI.
- `packages/agent-chat` - track-focused agent orchestration, session routing, and tool execution.
- `packages/metadata-enrichment` - metadata enrichment strategy, provider planning,
  provider evidence merging, and metadata synthesis.
- `packages/providers` - external data providers. Providers fetch evidence only.
- `packages/remix-search` - Remix discovery providers and ranking.
- `packages/datastore` - track result repository with SQLite default and Prisma/PostgreSQL support.

## Architecture

The canonical architecture diagram is [`docs/system-architecture.md`](docs/system-architecture.md).

## Pipeline Strategy

The current strategy doc is [`packages/track-analysis/src/strategy/pipeline-strategy.md`](packages/track-analysis/src/strategy/pipeline-strategy.md).

The workflow graph is [`packages/track-analysis/src/strategy/pipeline-workflow.md`](packages/track-analysis/src/strategy/pipeline-workflow.md).

The agent workflow graph is [`docs/agent-workflow.md`](docs/agent-workflow.md).

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
  G -->|ambiguous| J[Ask LLM EDM classifier]
  J --> H
  H --> K[Normalize / dedupe evidence]
  I --> K
  K --> L[metadata synthesis]
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

## Run

```sh
yarn install
yarn dev
yarn dev:web
```

Docker setup: [`docker/README.md`](docker/README.md)

## Docker Development

Run the full local stack with:

```sh
yarn dev:docker
```

This starts the API, worker, web app, PostgreSQL, and the one-shot migration
service that applies Prisma migrations and copies existing `track_results`
from SQLite into PostgreSQL when present.

Useful checks:

```sh
yarn typecheck
yarn workspace @track-lab/web build
```

## Environment

Create `.env` in the repo root.

```sh
OPENAI_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
GETSONGBPM_API_KEY=
# Optional fallback search service for SoundCloud discovery.
SEARXNG_SEARCH_URL=http://localhost:8080/search
```

Provider credentials are optional for local wiring, but real enrichment quality
depends on them.
Beatport currently uses public web search only and may be blocked by Cloudflare.
SoundCloud remix discovery can use SoundCloud's public search fallback directly.
`SEARXNG_SEARCH_URL` is optional and can provide another free search source.

Run SearXNG locally with Docker:

```sh
docker run --rm -p 8080:8080 searxng/searxng
```

## Persistence

Saved results are stored in:

```sh
data/track-lab.sqlite
```

Override with:

```sh
TRACK_LAB_DB_PATH=/path/to/track-lab.sqlite
```

Saved tracks are unique by returned `Title + Artists`.

To use the Prisma/PostgreSQL repository instead of SQLite:

```sh
DATASTORE_PROVIDER=prisma
DATABASE_URL=postgresql://track_lab:track_lab@localhost:5432/track_lab?schema=public
```

To copy existing `track_results` rows from the SQLite database into
PostgreSQL:

```sh
yarn migrate:track-results
```

## Worker Jobs

Background work is stored in the `track_analysis_jobs` SQLite table and exposed
as `TrackAnalysisJob` API objects.

Job operations:

- `analyze` - enrich track metadata, preferring saved datastore results.
- `enrich` - fresh metadata enrichment using optional known metadata.
- `remix_search` - find remix candidates for a track or Spotify URL.

Job statuses:

- `queued` - waiting for the worker to claim it.
- `processing` - claimed by the worker; `attemptCount` has been incremented.
- `completed` - worker stored a JSON result and `completedAt`.
- `failed` - reserved retryable failure status.
- `dead_lettered` - exhausted `maxAttempts`; stores `errorMessage` and
  `completedAt`.

Job payloads:

```ts
type TrackAnalysisPayload =
  | {
      operation: "analyze" | "enrich";
      track: { title: string; artists: string };
      knownMetadata?: {
        album?: string | null;
        bpm?: number | null;
        genre?: string | null;
        subGenre?: string | null;
        key?: string | null;
        spotifyUrl?: string | null;
      };
      source?: "manual" | "saved_result" | "bulk_saved_results";
    }
  | {
      operation: "remix_search";
      request: {
        title?: string | null;
        artists?: string | null;
        spotifyUrl?: string | null;
        genre?: string | null;
      };
    };
```

Job API shape:

```ts
type TrackAnalysisJob = {
  id: number;
  operation: "analyze" | "enrich" | "remix_search";
  status: "queued" | "processing" | "completed" | "failed" | "dead_lettered";
  payload: TrackAnalysisPayload;
  result: unknown | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationReadAt: string | null;
  resolvedAt: string | null;
};
```

Persisted columns use snake_case names: `id`, `operation`, `status`,
`payload_json`, `result_json`, `error_message`, `attempt_count`, `max_attempts`,
`created_at`, `updated_at`, `completed_at`, `notification_read_at`, and
`resolved_at`. The worker claims the oldest queued job, writes `result_json` on
success, and requeues failures until `attempt_count >= max_attempts`.

## Behavior

- The metadata enrichment pipeline returns `Title`, `Artists`, `Album`, `BPM`,
  `Genre`, `SubGenre`, `Key`, summary, provider status, provider URLs, and
  errors.
- By default, enrichment checks saved results first.
- The UI can skip saved results to force a fresh enrichment.
- Saved results can be viewed, re-enriched, saved again, or removed.

## Terminology

See [`docs/ai-terminology.md`](docs/ai-terminology.md) for the project naming
rules. In short: providers fetch external evidence, planners decide execution
paths, pipelines run multi-step flows, and tools are only capabilities directly
callable by an LLM or agent orchestrator.

## API

- `POST /track-analysis` - enqueue analyze/enrich metadata work.
- `POST /agent` - legacy compatibility alias for enqueueing analyze/enrich
  metadata work. New code should use `/track-analysis`.
- `POST /remix-search` - search remix candidates.
- `GET /track-analysis/jobs` - list worker jobs; supports `status`,
  `unresolved=true`, and `unread=true`.
- `GET /track-analysis/jobs/:id` - get one worker job.
- `POST /track-analysis/jobs/:id/retry` - requeue a failed or dead-lettered job.
- `POST /track-analysis/jobs/:id/resolve` - mark a terminal job resolved.
- `POST /track-analysis/jobs/:id/notification-read` - mark a job notification
  read.
- `GET /results` - list saved results.
- `GET /results/:id` - get one saved result.
- `POST /results` - save an enrichment response.
- `POST /results/:id/enrich` - fresh enrichment for a saved result.
- `DELETE /results/:id` - remove a saved result.

## Notes

The web action icons use inline SVGs from [Heroicons](https://heroicons.com/),
which is MIT licensed.
