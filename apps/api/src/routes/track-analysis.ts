import {
  type AgentSessionRepository,
  type TrackAnalysisQueueProvider,
  type TrackAnalysisJobStatus,
  type TrackAnalysisJobRepository,
} from "@track-lab/datastore";
import { Router, type Request, type Response } from "express";

const VALID_STATUSES = new Set<TrackAnalysisJobStatus>([
  "queued",
  "processing",
  "completed",
  "failed",
  "dead_lettered",
]);

export function createTrackAnalysisRouter(
  jobs: TrackAnalysisJobRepository,
  agentSessions?: AgentSessionRepository,
  queue?: TrackAnalysisQueueProvider,
) {
  const router = Router();

  router.get("/track-analysis/jobs", async (req: Request, res: Response) => {
    const statuses = getStatuses(req);

    const listedJobs = await jobs.listJobs({
      statuses,
      unresolvedOnly: req.query.unresolved === "true",
      unreadOnly: req.query.unread === "true",
    });
    for (const job of listedJobs) {
      await agentSessions?.syncCompletedAnalysisJob(job);
    }

    res.json({ jobs: listedJobs });
  });

  router.get("/track-analysis/jobs/:id", async (req: Request, res: Response) => {
    const job = await jobs.getJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    await agentSessions?.syncCompletedAnalysisJob(job);
    res.json({ job });
  });

  router.post("/track-analysis/jobs/:id/retry", async (req: Request, res: Response) => {
    const job = await jobs.retryJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Retryable job not found." });
      return;
    }

    await queue?.enqueue(job.id);
    res.json({ job });
  });

  router.post("/track-analysis/jobs/:id/resolve", async (req: Request, res: Response) => {
    const job = await jobs.resolveJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.json({ job });
  });

  router.post(
    "/track-analysis/jobs/:id/notification-read",
    async (req: Request, res: Response) => {
      const job = await jobs.markNotificationRead(Number(req.params.id));

      if (!job) {
        res.status(404).json({ error: "Job not found." });
        return;
      }

      res.json({ job });
    },
  );

  return router;
}

function getStatuses(req: Request): TrackAnalysisJobStatus[] | undefined {
  const value = req.query.status;

  if (!value) {
    return undefined;
  }

  const statuses = (Array.isArray(value) ? value : String(value).split(","))
    .map((status) => String(status).trim())
    .filter((status): status is TrackAnalysisJobStatus =>
      VALID_STATUSES.has(status as TrackAnalysisJobStatus),
    );

  return statuses.length ? statuses : undefined;
}
