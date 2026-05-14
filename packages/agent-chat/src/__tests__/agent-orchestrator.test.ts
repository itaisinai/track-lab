import assert from "node:assert/strict";
import test from "node:test";
import { AgentOrchestrator } from "../agent-orchestrator.ts";

test("agent orchestrator requires an OpenAI API key", () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    assert.throws(
      () => new AgentOrchestrator(),
      /OPENAI_API_KEY is required/,
    );
  } finally {
    if (previousOpenAiKey) {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});
