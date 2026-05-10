import {
  RemixResultStore,
  TrackAnalysisJobStore,
  TrackResultStore,
} from "@track-lab/datastore";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import express from "express";
import { createCorsMiddleware } from "./cors.ts";
import { createRemixSearchRouter } from "./routes/remix-search.ts";
import { createResultsRouter } from "./routes/results.ts";
import { createTrackAnalysisRouter } from "./routes/track-analysis.ts";
import { createTrackAnalysisEnqueueRouter } from "./routes/track-analysis-enqueue.ts";

export function createApp(store = new TrackResultStore()) {
  const jobStore = new TrackAnalysisJobStore();
  const remixStore = new RemixResultStore();
  const orchestrator = new TrackAnalysisOrchestrator(jobStore);
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createCorsMiddleware());
  app.use(createTrackAnalysisEnqueueRouter(orchestrator));
  app.use(createRemixSearchRouter(orchestrator, remixStore));
  app.use(createResultsRouter(store, orchestrator));
  app.use(createTrackAnalysisRouter(jobStore));

  return app;
}
