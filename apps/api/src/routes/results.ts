import {
  extractEnrichmentResponse,
  type TrackResultRepository,
} from "@track-lab/datastore";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { Router, type Request, type Response } from "express";

export function createResultsRouter(
  store: TrackResultRepository,
  orchestrator: TrackAnalysisOrchestrator,
) {
  const router = Router();

  router.get("/results", async (_req: Request, res: Response) => {
    try {
      res.json({ results: await store.listResults() });
    } catch (error) {
      console.error("Error listing results:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Could not list results.",
      });
    }
  });

  router.get("/results/:id", async (req: Request, res: Response) => {
    try {
      const result = await store.getResult(Number(req.params.id));

      if (!result) {
        res.status(404).json({ error: "Result not found." });
        return;
      }

      res.json({ result });
    } catch (error) {
      console.error("Error loading result:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Could not load result.",
      });
    }
  });

  router.post("/results", async (req: Request, res: Response) => {
    try {
      const enrichmentResponse =
        req.body.enrichmentResponse ?? req.body.agentResponse ?? req.body;
      const saved = await store.saveResult(extractEnrichmentResponse(enrichmentResponse));
      res.status(201).json({ result: saved });
    } catch (error) {
      console.error("Error saving result:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save result.",
      });
    }
  });

  router.delete("/results/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await store.deleteResult(Number(req.params.id));

      if (!deleted) {
        res.status(404).json({ error: "Result not found." });
        return;
      }

      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting result:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Could not delete result.",
      });
    }
  });

  router.post("/results/:id/enrich", async (req: Request, res: Response) => {
    try {
      const saved = await store.getResult(Number(req.params.id));

      if (!saved) {
        res.status(404).json({ error: "Result not found." });
        return;
      }

      const job = await orchestrator.enqueue({
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
