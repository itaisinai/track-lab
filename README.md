# Track Lab

Track Lab enriches music track metadata with an agent, stores saved results in a
local SQLite database, and reuses saved results before calling external providers.

## Structure

- `apps/api` - Express API.
- `apps/web` - React/Vite UI.
- `packages/agent` - LangChain metadata agent.
- `packages/remix-search` - Remix discovery providers and ranking.
- `packages/datastore` - SQLite result store.

## Architecture

![Track Lab system architecture](docs/system-architecture.svg)

## Run

```sh
yarn install
yarn dev
yarn dev:web
```

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
BEATPORT_CLIENT_ID=
BEATPORT_CLIENT_SECRET=
# Optional fallback search service for SoundCloud discovery.
SEARXNG_SEARCH_URL=http://localhost:8080/search
```

Provider credentials are optional for local wiring, but real enrichment quality
depends on them.
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

## Behavior

- The agent returns `Title`, `Artists`, `Album`, `BPM`, `Genre`, `SubGenre`,
  `Key`, summary, provider status, provider URLs, and errors.
- By default, the agent checks saved results first.
- The UI can skip saved results to force a fresh enrichment.
- Saved results can be viewed, re-enriched, saved again, or removed.

## API

- `POST /agent` - run enrichment.
- `POST /remix-search` - search remix candidates.
- `GET /results` - list saved results.
- `GET /results/:id` - get one saved result.
- `POST /results` - save an agent response.
- `POST /results/:id/enrich` - fresh enrichment for a saved result.
- `DELETE /results/:id` - remove a saved result.

## Notes

The web action icons use inline SVGs from [Heroicons](https://heroicons.com/),
which is MIT licensed.
