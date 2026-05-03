import { HumanMessage } from "@langchain/core/messages";
import { agent } from "@track-lab/agent";
import { Router, type Request, type Response } from "express";

export function createAgentRouter() {
  const router = Router();

  router.post("/agent", async (req: Request, res: Response) => {
    try {
      const result = await agent.invoke({
        messages: [new HumanMessage(req.body.message)],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      res.json(lastMessage);
    } catch (error) {
      console.error("Error invoking agent:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request." });
    }
  });

  return router;
}
