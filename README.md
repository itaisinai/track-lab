# Track Lab

Node monorepo scaffold for TrackLab experiments.

## Apps

- `apps/api` contains the Node service.

## Scripts

- `yarn dev` starts the API service.
- `yarn dev:web` starts the React web app.
- `yarn test` runs the test suite.

## Spotify API

The API service can use Spotify public metadata through a LangChain tool.

Set these optional environment variables before running `yarn dev`:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Create them from the Spotify Developer Dashboard. The backend uses Spotify's Client Credentials flow, so keep the client secret server-side only.

## GetSongBPM API

The API service uses GetSongBPM for BPM/tempo lookup. This is required for real BPM values.

Set this environment variable before running `yarn dev`:

- `GETSONGBPM_API_KEY`

GetSongBPM requires a real API key and backlink attribution. See https://getsongbpm.com/api.

BPM data provided by [GetSongBPM](https://getsongbpm.com).

## Endpoint

- `GET /noop` returns `204 No Content`.
- `POST /tools/create_track_profile` creates a rule-based track metadata profile.

## Track Profile POC

The `create_track_profile` tool accepts track metadata and returns a structured profile with normalized metadata, energy classification, tags, DJ usage, production notes, and recommendations.

The `TrackProfileAgent` calls the local tool endpoint. If `OPENAI_API_KEY` is set and the optional `openai` package is installed, the agent asks the LLM to enrich `djUsage`, `productionNotes`, and `recommendedNotes`. Without an API key, it returns the rule-based profile.
