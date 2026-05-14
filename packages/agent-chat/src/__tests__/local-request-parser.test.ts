import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAnalyzeRequest,
  parseRemixRequest,
} from "../planning/local-request-parser.ts";

test("local parser extracts track and artist from conversational analyze request", () => {
  assert.deepEqual(
    parseAnalyzeRequest("Hi, I want to analyze a track dracula by tame impala"),
    {
      title: "dracula",
      artists: "tame impala",
      operation: "enrich",
    },
  );
});

test("local parser extracts track and artist from direct remix request", () => {
  assert.deepEqual(parseRemixRequest("find remixes for Strobe by deadmau5"), {
    title: "Strobe",
    artists: "deadmau5",
    spotifyUrl: null,
    genre: null,
  });
});
