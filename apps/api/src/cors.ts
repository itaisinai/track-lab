import type { RequestHandler } from "express";

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://trackylab.com",
  "https://www.trackylab.com",
]);

export function createCorsMiddleware(): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  };
}