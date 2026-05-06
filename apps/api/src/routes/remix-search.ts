import type { RemixSearchRequest } from "@track-lab/api-types";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { Router, type Request, type Response } from "express";

export function createRemixSearchRouter(
  orchestrator = new RemixSearchOrchestrator(),
) {
  const router = Router();

  router.post("/remix-search", async (req: Request, res: Response) => {
    try {
      const result = await orchestrator.search(req.body as RemixSearchRequest);
      res.json(result);
    } catch (error) {
      console.error("Error searching remixes:", error);
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Could not search remixes.",
      });
    }
  });

  return router;
}
