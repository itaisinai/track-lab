# Web App Rules

These rules capture the frontend practices we want Track Lab to follow as the app grows.

## Structure

- Keep app orchestration in `apps/web/src/app`.
- Keep domain screens in `apps/web/src/features/<feature-name>`.
- Keep reusable primitives in `apps/web/src/shared`.
- Keep API clients in `apps/web/src/api` and parsing/formatting helpers in `apps/web/src/lib`.
- Prefer moving code into a feature folder before adding more top-level component files.

## SOLID

- Single responsibility: a file should have one main reason to change.
- Open/closed: add new providers, table columns, or actions by extending small modules instead of editing one large switchboard.
- Interface segregation: component props should expose the smallest useful contract.
- Dependency inversion: views receive data and callbacks; hooks own API/mutation details.
- Avoid general-purpose controller hooks or contexts, such as `useAppController`, that collect unrelated state and actions. Split by feature responsibility and expose narrow contexts/contracts.

## File Size

- Aim for files under 200 lines.
- A file over 250 lines needs a reason.
- A file over 350 lines should be split before adding new behavior.
- Split by responsibility, not by arbitrary line count.

## Reuse

- Reuse when two call sites share the same behavior and vocabulary.
- Do not abstract just because code looks similar once.
- Good rule of thumb: duplicate once, abstract on the third use or when the shared behavior is business-critical.
- Shared components should stay visually and behaviorally boring; feature-specific rules belong in feature folders.

## Terminology

- Use `Review Queue` for unresolved completed/failed jobs.
- Use `notification` only for unread completed/failed jobs.
- Use `resolve` to mean “user handled this result.”
- Use `dismiss` to mean “resolve without saving.”
- Use `save` only when writing into saved track results.
- Use `provider`, not `tool`, for external data sources in UI and frontend code.
- Use provider names consistently: `Spotify`, `Beatport`, `GetSongBPM`, `Wikipedia`.

## Data Fetching

- Use React Query for server state, polling, refetching, and mutations.
- Prefer one query or mutation hook per API operation. Avoid bundle hooks that subscribe a caller to unrelated server state.
- Local React state is for form inputs, open drawers, selected rows, and transient UI messages.
- After a mutation changes jobs or results, invalidate/refetch the relevant query instead of hand-updating unrelated arrays.

## Tables

- Use the shared TanStack `DataTable` for sortable/searchable/paginated tables.
- Keep column definitions close to the feature view using them.
- Put row-specific action buttons in the feature, not in the shared table.
