# Track Lab Pipeline Strategy

This document describes how the worker-owned analysis pipeline is structured.

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

## Remix search pipeline

1. Normalize the request.
2. Resolve the original track.
3. Build remix search queries.
4. Run remix providers in code.
5. Normalize, dedupe, and score all candidates deterministically.
6. Send compact candidate batches to the LLM judge.
7. If the first batch returns no useful result, try one more batch.
8. Fall back deterministically if needed.

## RAG clarification

The existing `planner-policy-context` module is not vector-based RAG.

It is static planner policy context:

- deterministic provider guidance
- application preferences
- short policy reminders for the LLM planner

That policy context is added to the prompt so the planner stays consistent, but it is not a retrieval system.
