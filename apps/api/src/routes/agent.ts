import { invokeTrackMetadataAgent } from "@track-lab/agent";
import { Router, type Request, type Response } from "express";

export function createAgentRouter() {
  const router = Router();

  router.post("/agent", async (req: Request, res: Response) => {
    try {
      const operation = req.body.operation === "enrich" ? "enrich" : "analyze";
      res.json(
        await invokeTrackMetadataAgent(req.body.message, {
          operation,
          preferDatastore:
            operation === "analyze" && req.body.skipPersistedResults !== true,
          knownMetadata: req.body.knownMetadata,
        }),
      );
    } catch (error) {
      console.error("Error invoking agent:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request." });
    }
  });

  return router;
}
