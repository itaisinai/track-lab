import assert from "node:assert/strict";
import test from "node:test";
import { parseBeatportSearchHtml } from "../index.ts";

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
