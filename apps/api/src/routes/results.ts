import { invokeTrackMetadataAgent } from "@track-lab/agent";
import { extractAgentResponse, type TrackResultStore } from "@track-lab/datastore";
import { Router, type Request, type Response } from "express";
import { createTrackPrompt } from "../lib/track-prompt.ts";

export function createResultsRouter(store: TrackResultStore) {
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
      const agentResponse = req.body.agentResponse ?? req.body;
      const saved = store.saveResult(extractAgentResponse(agentResponse));
      res.status(201).json({ result: saved });
    } catch (error) {
      console.error("Error saving result:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save result.",
      });
    }
  });

  router.post("/results/:id/enrich", async (req: Request, res: Response) => {
    const saved = store.getResult(Number(req.params.id));

    if (!saved) {
      res.status(404).json({ error: "Result not found." });
      return;
    }

    try {
      res.json(
        await invokeTrackMetadataAgent(
          createTrackPrompt(saved.title, saved.artists),
          { preferDatastore: false },
        ),
      );
    } catch (error) {
      console.error("Error re-enriching result:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request." });
    }
  });

  return router;
}
