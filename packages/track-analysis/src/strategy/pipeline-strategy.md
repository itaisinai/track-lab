# Track Lab Pipeline Strategy

This is the canonical strategy document for the worker-owned analysis pipeline.
Older SVG workflow diagrams were retired in favor of this single source of truth.

## Core principle

The worker/orchestrator owns execution.

- Application code executes providers and tools.
- The LLM does not autonomously browse or call tools.
- The LLM only plans, judges, or synthesizes based on evidence that application code already collected.

## Analyze / enrich pipeline

1. Parse the request.
2. Apply known metadata.
3. Optionally load local datastore metadata.
4. Run identity providers.
5. Run BPM/key providers when needed.
6. Ask the EDM planner whether Beatport and SoundCloud should run.
7. Execute Beatport and SoundCloud in code when the planner says to run them.
8. Normalize and dedupe provider evidence.
9. Synthesize final metadata with the LLM.

### Execution boundaries

- The worker/orchestrator owns execution order.
- Provider calls happen in application code.
- The LLM only plans, judges, or synthesizes.
- EDM-specific providers are Beatport and SoundCloud.
- Spotify identity search can always run.
- GetSongBPM can run when BPM or key is missing.

### EDM planning

- Deterministic signals are checked first.
- Clearly EDM tracks run Beatport and SoundCloud without an LLM planner.
- Clearly non-EDM tracks skip Beatport and SoundCloud without an LLM planner.
- Ambiguous cases get a compact JSON planner prompt.
- The planner returns a strict JSON decision and application code executes the providers.

## Remix search pipeline

1. Normalize the request.
2. Resolve the original track.
3. Build remix search queries.
4. Run remix providers in code.
5. Normalize, dedupe, and score all candidates deterministically.
6. Send compact candidate batches to the LLM judge.
7. If the first batch returns no useful result, try one more batch.
8. Fall back deterministically if needed.

### Remix judging

- Search and judging are separate phases.
- Providers execute in code and return raw candidates.
- Deterministic scoring and dedupe happen before the LLM sees anything.
- The judge only receives compact candidate summaries.
- The judge returns strict JSON indexes, not invented candidates.
- Batches are capped to keep LLM usage predictable.

## Planner policy context

The existing `planner-policy-context` module is static prompt context.

It is not a retrieval system. It exists to keep planning consistent by
supplying:

- deterministic provider guidance
- application preferences
- short policy reminders for the LLM planner

The application adds this context directly to planner prompts.
