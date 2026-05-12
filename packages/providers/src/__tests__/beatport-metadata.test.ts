import assert from "node:assert/strict";
import test from "node:test";
import { parseBeatportSearchHtml } from "../index.ts";
import {
  findBestBeatportMatch,
  isBeatportRemixTrack,
} from "../beatport/metadata-utils.ts";
import { normalizeProviderGenre } from "../shared/genre-normalization.ts";

test("beatport public search parser reads embedded track rows", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        dehydratedState: {
          queries: [
            {
              state: {
                data: {
                  tracks: {
                    data: [
                      {
                        track_id: 11777847,
                        track_name: "I AM BASS",
                        mix_name: "Original Mix",
                        bpm: 145,
                        key_name: "E Major",
                        artists: [{ artist_name: "LSDREAM" }],
                        label: { label_name: "Wakaan" },
                        release: { release_name: "RENAGADES OF LIGHT" },
                        genre: [{ genre_name: "Dance / Pop" }],
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    },
  })}</script>`;

  const tracks = parseBeatportSearchHtml(html);

  assert.equal(tracks.length, 1);
  assert.equal(tracks[0]?.track_name, "I AM BASS");
  assert.equal(tracks[0]?.bpm, 145);
  assert.equal(tracks[0]?.key_name, "E Major");
});

test("beatport metadata matching rejects remix versions", () => {
  const remix = {
    id: 20444756,
    name: "סבבה 5",
    mix_name: "Remix",
    artists: [{ name: "Peled" }],
    release: { name: "סבבה 5 (Remix)" },
  };
  const original = {
    id: 1,
    name: "סבבה 5",
    mix_name: "Original Mix",
    artists: [{ name: "Peled" }],
    release: { name: "סבבה 5" },
  };

  assert.equal(isBeatportRemixTrack(remix), true);
  assert.equal(isBeatportRemixTrack(original), false);
  assert.equal(findBestBeatportMatch([remix], "סבבה 5", "Peled"), null);
  assert.equal(findBestBeatportMatch([remix, original], "סבבה 5", "Peled")?.id, 1);
});

test("beatport non-genre buckets normalize through subgenre parent inference", () => {
  assert.deepEqual(
    normalizeProviderGenre({
      source: "beatport",
      genre: "Mainstage",
      subGenre: "Speed House",
    }),
    {
      genre: "Electronic",
      subGenre: "Speed House",
    },
  );
});

test("beatport non-genre buckets remain unchanged without subgenre inference", () => {
  assert.deepEqual(
    normalizeProviderGenre({
      source: "beatport",
      genre: "Mainstage",
      subGenre: null,
    }),
    {
      genre: "Mainstage",
      subGenre: null,
    },
  );
});

test("non-beatport genres are not normalized by beatport rules", () => {
  assert.deepEqual(
    normalizeProviderGenre({
      source: "soundcloud",
      genre: "Mainstage",
      subGenre: "Speed House",
    }),
    {
      genre: "Mainstage",
      subGenre: "Speed House",
    },
  );
});
