import assert from "node:assert/strict";
import test from "node:test";
import type { SoundCloudWebSearchResult } from "../soundcloud/web-search.ts";
import {
  findBestSoundCloudMetadataMatch,
  isSoundCloudRemixCandidate,
} from "../soundcloud/metadata-match.ts";

test("soundcloud metadata matching rejects remix candidates", () => {
  const remix = candidate({
    title: "RL GRIME & KNOCK2 & ISOXO - SMACK TALK (SULLIVAN KING REMIX)",
    artists: "Sullivan King",
    link: "https://soundcloud.com/sullivankingmusic/smack-talk-remix",
  });

  assert.equal(isSoundCloudRemixCandidate(remix), true);
  assert.equal(
    findBestSoundCloudMetadataMatch([remix], "smack talk", "Isoxo"),
    null,
  );
});

test("soundcloud metadata matching prefers original candidate over remix", () => {
  const remix = candidate({
    title: "RL GRIME & KNOCK2 & ISOXO - SMACK TALK (SULLIVAN KING REMIX)",
    artists: "Sullivan King",
    link: "https://soundcloud.com/sullivankingmusic/smack-talk-remix",
  });
  const original = candidate({
    title: "RL Grime, Knock2, ISOxo - SMACK TALK",
    artists: "RL Grime",
    link: "https://soundcloud.com/rlgrime/smack-talk",
  });

  assert.equal(
    findBestSoundCloudMetadataMatch(
      [remix, original],
      "smack talk",
      "Isoxo",
    )?.link,
    original.link,
  );
});

test("soundcloud metadata matching accepts canonical title matches without artist evidence", () => {
  const canonical = candidate({
    title: "ISOKNOCK, RL Grime - SMACK TALK",
    artists: "Unknown",
    link: "https://soundcloud.com/isoknock/smack-talk",
  });

  assert.equal(
    findBestSoundCloudMetadataMatch([canonical], "smack talk", "Isoxo")?.link,
    canonical.link,
  );
});

function candidate(
  overrides: Partial<SoundCloudWebSearchResult>,
): SoundCloudWebSearchResult {
  return {
    title: "SMACK TALK",
    artists: "ISOxo",
    remixArtist: "ISOxo",
    album: null,
    genre: null,
    subGenre: null,
    bpm: null,
    provider: "SoundCloud",
    link: "https://soundcloud.com/isoxo/smack-talk",
    createdAt: null,
    durationMs: null,
    confidence: 0,
    relevanceReason: "",
    ...overrides,
  };
}
