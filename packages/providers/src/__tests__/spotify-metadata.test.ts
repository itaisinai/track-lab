import assert from "node:assert/strict";
import test from "node:test";
import { searchSpotifyTrack } from "../spotify/metadata-utils.ts";

test("spotify metadata search accepts official extended mix titles", async () => {
  await withMockedFetch(async () => {
    const track = await searchSpotifyTrack("test-token", "Click Click Click", "Tiesto");

    assert.equal(track?.name, "Click Click Click - Extended Mix");
  });
});

test("spotify metadata search rejects remix titles for the requested original track", async () => {
  await withMockedFetch(async () => {
    const track = await searchSpotifyTrack("test-token", "Click Click Click", "Tiesto");

    assert.equal(track, null);
  }, {
    name: "Click Click Click (Some Remix)",
    artists: [{ name: "Other Artist", id: "artist-1" }],
  });
});

async function withMockedFetch(
  callback: () => Promise<void>,
  track = {
    name: "Click Click Click - Extended Mix",
    artists: [{ name: "Tiësto", id: "artist-1" }],
  },
) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/search?")) {
      return new Response(
        JSON.stringify({
          tracks: {
            items: [track],
          },
        }),
        { status: 200 },
      );
    }

    throw new Error(`Unexpected fetch request: ${url}`);
  }) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
