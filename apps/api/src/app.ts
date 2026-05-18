import {
  createAgentSessionRepository,
  createRemixResultRepository,
  createTrackAnalysisJobRepository,
  createTrackAnalysisQueueProvider,
  createTrackResultRepository,
} from "@track-lab/datastore";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import express from "express";
import { createCorsMiddleware } from "./cors.ts";
import { createAgentRouter } from "./routes/agent.ts";
import { createRemixSearchRouter } from "./routes/remix-search.ts";
import { createResultsRouter } from "./routes/results.ts";
import { createTrackAnalysisRouter } from "./routes/track-analysis.ts";
import { createTrackAnalysisEnqueueRouter } from "./routes/track-analysis-enqueue.ts";

export function createApp(trackResultRepository = createTrackResultRepository()) {
  const jobStore = createTrackAnalysisJobRepository();
  const queue = createTrackAnalysisQueueProvider();
  const remixStore = createRemixResultRepository();
  const agentStore = createAgentSessionRepository();
  const orchestrator = new TrackAnalysisOrchestrator(jobStore, queue);
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createCorsMiddleware());
  app.use(createAgentRouter(agentStore, orchestrator));
  app.use(createTrackAnalysisEnqueueRouter(orchestrator));
  app.use(createRemixSearchRouter(orchestrator, remixStore));
  app.use(createResultsRouter(trackResultRepository, orchestrator));
  app.use(createTrackAnalysisRouter(jobStore, agentStore));

  return app;
}
