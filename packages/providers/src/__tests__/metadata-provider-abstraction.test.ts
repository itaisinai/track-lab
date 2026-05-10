import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultProviders,
  createGetSongBpmMetadataProvider,
  createSpotifyMetadataProvider,
} from "../index.ts";

test("default metadata provider registry exposes provider interface objects", () => {
  const providers = createDefaultProviders();

  assert.deepEqual(
    providers.map((provider) => provider.name),
    ["Spotify", "GetSongBPM", "Beatport", "SoundCloud"],
  );

  for (const provider of providers) {
    assert.equal(typeof provider.name, "string");
    assert.equal(typeof provider.lookup, "function");
  }
});

test("credential-backed providers return null when no useful data is available", async () => {
  await withMissingProviderCredentials(async () => {
    assert.equal(
      await createSpotifyMetadataProvider().lookup({
        trackName: "Unconfigured Track",
        artist: "Unconfigured Artist",
      }),
      null,
    );
    assert.equal(
      await createGetSongBpmMetadataProvider().lookup({
        trackName: "Unconfigured Track",
        artist: "Unconfigured Artist",
      }),
      null,
    );
  });
});

test("provider results normalize data and keep provider-specific shape only in raw", async () => {
  await withMissingProviderCredentials(async () => {
    const provider = createSpotifyMetadataProvider();
    const result = await provider.lookup({
      trackName: "Unconfigured Track",
      artist: "Unconfigured Artist",
    });

    assert.equal(result, null);
  });
});

async function withMissingProviderCredentials(callback: () => Promise<void>) {
  const previous = {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    GETSONGBPM_API_KEY: process.env.GETSONGBPM_API_KEY,
  };

  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.GETSONGBPM_API_KEY;

  try {
    await callback();
  } finally {
    restoreEnv("SPOTIFY_CLIENT_ID", previous.SPOTIFY_CLIENT_ID);
    restoreEnv("SPOTIFY_CLIENT_SECRET", previous.SPOTIFY_CLIENT_SECRET);
    restoreEnv("GETSONGBPM_API_KEY", previous.GETSONGBPM_API_KEY);
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
