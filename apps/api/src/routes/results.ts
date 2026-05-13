import { extractEnrichmentResponse, type TrackResultStore } from "@track-lab/datastore";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createResultsRouter(
  store: TrackResultStore,
  orchestrator: TrackAnalysisOrchestrator,
) {
  const router = Router();

  router.get("/results", (_req: Request, res: Response) => {
    res.json({ results: store.listResults() });
  });

  router.get("/results/:id", (req: Request, res: Response) => {
    const result = store.getResult(Number(req.params.id));

    if (!result) {
      res.status(404).json({ error: "Result not found." });
      return;
    }

    res.json({ result });
  });

  router.post("/results", (req: Request, res: Response) => {
    try {
      const enrichmentResponse =
        req.body.enrichmentResponse ?? req.body.agentResponse ?? req.body;
      const saved = store.saveResult(extractEnrichmentResponse(enrichmentResponse));
      res.status(201).json({ result: saved });
    } catch (error) {
      console.error("Error saving result:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save result.",
      });
    }
  });

  router.delete("/results/:id", (req: Request, res: Response) => {
    const deleted = store.deleteResult(Number(req.params.id));

    if (!deleted) {
      res.status(404).json({ error: "Result not found." });
      return;
    }

    res.sendStatus(204);
  });

  router.post("/results/:id/enrich", (req: Request, res: Response) => {
    const saved = store.getResult(Number(req.params.id));

    if (!saved) {
      res.status(404).json({ error: "Result not found." });
      return;
    }

    try {
      const job = orchestrator.enqueue({
        operation: "enrich",
        track: {
          title: saved.title,
          artists: saved.artists,
        },
        source: "saved_result",
        knownMetadata: {
          album: saved.album,
          bpm: saved.bpm,
          genre: saved.genre,
          subGenre: saved.subGenre,
          key: saved.key,
          spotifyUrl: getSpotifyUrl(saved.providersUsed),
        },
      });

      res.status(202).json({
        job: {
          id: job.id,
          status: job.status,
        },
      });
    } catch (error) {
      console.error("Error enqueueing re-enrichment:", error);
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Could not enqueue enrichment.",
      });
    }
  });

  return router;
}

function getSpotifyUrl(providersUsed: Array<{ name: string; url: string | null }>) {
  return providersUsed.find((provider) => provider.name === "Spotify")?.url ?? null;
}
