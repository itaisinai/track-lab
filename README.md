# Track Lab

Node monorepo scaffold for TrackLab experiments.

## Apps

- `apps/api` contains the Node service.

## Scripts

- `npm run dev` starts the API service in watch mode.
- `npm run demo:track-profile` runs the Track Profile Agent demo.
- `npm test` runs the test suite.

## Endpoint

- `GET /noop` returns `204 No Content`.
- `POST /tools/create_track_profile` creates a rule-based track metadata profile.

## Track Profile POC

The `create_track_profile` tool accepts track metadata and returns a structured profile with normalized metadata, energy classification, tags, DJ usage, production notes, and recommendations.

The `TrackProfileAgent` calls the local tool endpoint. If `OPENAI_API_KEY` is set and the optional `openai` package is installed, the agent asks the LLM to enrich `djUsage`, `productionNotes`, and `recommendedNotes`. Without an API key, it returns the rule-based profile.
