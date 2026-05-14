import type { AgentSessionStore } from "@track-lab/datastore";
import { AgentOrchestrator } from "@track-lab/agent-chat";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import type { Request, Response } from "express";
import { Router } from "express";

export function createAgentRouter(
  store: AgentSessionStore,
  orchestrator: TrackAnalysisOrchestrator,
) {
  const router = Router();
  const agentOrchestrator = new AgentOrchestrator({
    store,
    trackAnalysis: orchestrator,
  });

  router.get("/agent/sessions", (_req: Request, res: Response) => {
    res.json({ sessions: store.listSessions() });
  });

  router.post("/agent/sessions", (_req: Request, res: Response) => {
    const session = store.createSession();
    res.status(201).json({ session });
  });

  router.get("/agent/sessions/:sessionId", (req: Request, res: Response) => {
    const sessionId = Number(req.params.sessionId);
    const session = store.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: "Agent session was not found." });
      return;
    }

    res.json({
      session,
      messages: store.listMessages(sessionId),
      toolCalls: store.listToolCalls(sessionId),
    });
  });

  router.delete("/agent/sessions/:sessionId", (req: Request, res: Response) => {
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(sessionId)) {
      res.status(400).json({ error: "Agent session id is required." });
      return;
    }

    const deleted = store.deleteSession(sessionId);
    if (!deleted) {
      res.status(404).json({ error: "Agent session was not found." });
      return;
    }

    res.json({ sessionId });
  });

  router.post(
    "/agent/sessions/:sessionId/messages",
    async (req: Request, res: Response) => {
      const sessionId = Number(req.params.sessionId);

      try {
        const response = await agentOrchestrator.sendMessage(
          sessionId,
          getMessageContent(req.body),
        );
        res.status(201).json(response);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not send agent message.";
        const status = message.includes("not found") ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  return router;
}

function getMessageContent(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Message content is required.");
  }

  const content = (body as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Message content is required.");
  }

  return content;
}
