import assert from "node:assert/strict";
import test from "node:test";
import {
  createTitleFirstTrackQueries,
  createTitleFirstTrackQueriesWithArtistVariants,
  normalizeTrackLookupInput,
} from "../shared/track-query.ts";

test("track queries do not append artist when title already contains artist prefix", () => {
  assert.deepEqual(
    createTitleFirstTrackQueries("FISHER - Losing It", "FISHER"),
    ["FISHER - Losing It", "FISHER Losing It", "Losing It"],
  );
});

test("track query normalization keeps simple dash and uses stripped title for matching", () => {
  const input = normalizeTrackLookupInput("FISHER – Losing It", "FISHER");

  assert.equal(input.title, "FISHER - Losing It");
  assert.equal(input.matchTitle, "Losing It");
  assert.equal(input.titleHasArtistPrefix, true);
});

test("track queries are title first when title does not include artist", () => {
  assert.deepEqual(
    createTitleFirstTrackQueries("Losing It", "FISHER"),
    ["Losing It FISHER", "Losing It", "Losing It original"],
  );
});

test("track queries try each artist variant for SoundCloud searches", () => {
  assert.deepEqual(
    createTitleFirstTrackQueriesWithArtistVariants(
      "Smack Talk",
      "RL Grime, Isoxo, Knock2, ISOKNOCK",
    ),
    [
      "Smack Talk RL Grime",
      "Smack Talk",
      "Smack Talk original",
      "Smack Talk Isoxo",
      "Smack Talk Knock2",
      "Smack Talk ISOKNOCK",
    ],
  );
});
