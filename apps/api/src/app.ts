import { TrackResultStore } from "@track-lab/datastore";
import express from "express";
import { createCorsMiddleware } from "./cors.ts";
import { createAgentRouter } from "./routes/agent.ts";
import { createResultsRouter } from "./routes/results.ts";

export function createApp(store = new TrackResultStore()) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createCorsMiddleware());
  app.use(createAgentRouter());
  app.use(createResultsRouter(store));

  return app;
}
