import {
  type TrackAnalysisJobStatus,
  type TrackAnalysisJobStore,
} from "@track-lab/datastore";
import { Router, type Request, type Response } from "express";

const VALID_STATUSES = new Set<TrackAnalysisJobStatus>([
  "queued",
  "processing",
  "completed",
  "failed",
  "dead_lettered",
]);

export function createTrackAnalysisRouter(jobs: TrackAnalysisJobStore) {
  const router = Router();

  router.get("/track-analysis/jobs", (req: Request, res: Response) => {
    const statuses = getStatuses(req);

    res.json({
      jobs: jobs.listJobs({
        statuses,
        unresolvedOnly: req.query.unresolved === "true",
        unreadOnly: req.query.unread === "true",
      }),
    });
  });

  router.get("/track-analysis/jobs/:id", (req: Request, res: Response) => {
    const job = jobs.getJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.json({ job });
  });

  router.post("/track-analysis/jobs/:id/retry", (req: Request, res: Response) => {
    const job = jobs.retryJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Retryable job not found." });
      return;
    }

    res.json({ job });
  });

  router.post("/track-analysis/jobs/:id/resolve", (req: Request, res: Response) => {
    const job = jobs.resolveJob(Number(req.params.id));

    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.json({ job });
  });

  router.post(
    "/track-analysis/jobs/:id/notification-read",
    (req: Request, res: Response) => {
      const job = jobs.markNotificationRead(Number(req.params.id));

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
