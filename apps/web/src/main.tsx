import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = "http://localhost:3000/agent";

type TrackDetails = {
  bpm?: string;
  genre?: string;
  subGenre?: string;
  key?: string;
  summary?: string;
  spotifyUrl?: string;
};

function App() {
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const trackDetails = response ? parseTrackDetails(response) : null;

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedArtists = artists.trim();

    if (!trimmedTitle || !trimmedArtists || isLoading) {
      return;
    }

    const message = createTrackPrompt(trimmedTitle, trimmedArtists);

    setIsLoading(true);
    setError("");
    setResponse("");

    try {
      const result = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setResponse(formatAgentResponse(data));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <form className="panel" onSubmit={submitPrompt}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Hot Honey"
        />

        <label htmlFor="artists">Artists</label>
        <input
          id="artists"
          value={artists}
          onChange={(event) => setArtists(event.target.value)}
          placeholder="LIAD MEIR, Eden Derso"
        />
        <button
          type="submit"
          disabled={isLoading || !title.trim() || !artists.trim()}
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>

      {(response || error) && (
        <section className="response" aria-live="polite">
          {trackDetails && !error && (
            <div className="details">
              <div className="detail">
                <span>BPM</span>
                <strong>{trackDetails.bpm ?? "Unknown"}</strong>
              </div>
              <div className="detail">
                <span>Genre</span>
                <strong>{trackDetails.genre ?? "Unknown"}</strong>
              </div>
              <div className="detail">
                <span>Subgenre</span>
                <strong>{trackDetails.subGenre ?? "Unknown"}</strong>
              </div>
              <div className="detail">
                <span>Key</span>
                <strong>{trackDetails.key ?? "Unknown"}</strong>
              </div>
              <div className="summary">
                <span>Summary</span>
                <p>{trackDetails.summary ?? "No summary returned."}</p>
                {trackDetails.spotifyUrl && (
                  <a
                    className="spotify-link"
                    href={trackDetails.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Spotify
                  </a>
                )}
              </div>
            </div>
          )}

          <h2>Full Response</h2>
          <pre>{error || response}</pre>
        </section>
      )}
    </main>
  );
}

function createTrackPrompt(title: string, artists: string) {
  return `I have a track and I want you to enrich the details:
Title: ${title}
Artist: ${artists}

I want you to send back object with:
BPM, Genre, SubGenre, Key, AI-generated summary, Spotify matched status and Spotify URL, Beatport matched status and Beatport URL, GetSongBPM matched status and GetSongBPM URL`;
}

function formatAgentResponse(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "content" in data &&
    typeof data.content === "string"
  ) {
    return data.content;
  }

  return JSON.stringify(data, null, 2);
}

function parseTrackDetails(response: string): TrackDetails | null {
  const parsed = parseJsonFromResponse(response);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const details = extractTrackDetails(record);

    if (hasTrackDetails(details)) {
      return details;
    }

    for (const content of findContentStrings(record)) {
      const nestedDetails = parseTrackDetails(content);

      if (nestedDetails) {
        return nestedDetails;
      }
    }
  }

  const details = {
    bpm: matchLabeledValue(response, "BPM"),
    genre: matchLabeledValue(response, "Genre"),
    subGenre:
      matchLabeledValue(response, "SubGenre") ??
      matchLabeledValue(response, "Sub Genre"),
    key: matchLabeledValue(response, "Key"),
    summary:
      matchLabeledValue(response, "AI-generated summary") ??
      matchLabeledValue(response, "AI generated summary") ??
      matchLabeledValue(response, "Summary"),
    spotifyUrl: matchUrl(response, "open.spotify.com"),
  };

  return hasTrackDetails(details) ? details : null;
}

function extractTrackDetails(record: Record<string, unknown>): TrackDetails {
  return {
    bpm: valueToString(findValue(record, ["bpm"])),
    genre: valueToString(findValue(record, ["genre"])),
    subGenre: valueToString(findValue(record, ["subGenre", "sub_genre"])),
    key: valueToString(findValue(record, ["key"])),
    summary: valueToString(
      findValue(record, [
        "ai-generated summary",
        "ai generated summary",
        "summary",
        "aiSummary",
        "ai_generated_summary",
      ]),
    ),
    spotifyUrl:
      valueToString(findValue(record, ["spotifyUrl", "spotify_url"])) ??
      findNestedProviderUrl(record, "spotify"),
  };
}

function parseJsonFromResponse(response: string): unknown {
  const fencedJson = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fencedJson ?? response;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0];
    if (!objectText) {
      return null;
    }

    try {
      return JSON.parse(objectText);
    } catch {
      return null;
    }
  }
}

function findContentStrings(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(findContentStrings);
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nestedValue]) => {
      if (normalizeKey(key) === "content" && typeof nestedValue === "string") {
        return [nestedValue];
      }

      return findContentStrings(nestedValue);
    },
  );
}

function findValue(record: Record<string, unknown>, names: string[]) {
  const normalizedNames = new Set(names.map(normalizeKey));
  const entry = Object.entries(record).find(([key]) =>
    normalizedNames.has(normalizeKey(key)),
  );

  return entry?.[1];
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueToString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}

function matchLabeledValue(response: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = response.match(
    new RegExp(
      `${escapedLabel}\\s*[:\\-]\\s*(.+?)(?=\\n\\s*[A-Za-z][^\\n:]{0,40}\\s*[:\\-]|$)`,
      "is",
    ),
  );

  return match?.[1].trim();
}

function matchUrl(response: string, domain: string) {
  return response.match(new RegExp(`https?://[^\\s"']*${domain}[^\\s"']*`, "i"))
    ?.[0];
}

function findNestedProviderUrl(
  record: Record<string, unknown>,
  provider: string,
) {
  const value = Object.entries(record).find(
    ([key]) => normalizeKey(key) === provider,
  )?.[1];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return valueToString(findValue(value as Record<string, unknown>, ["url"]));
}

function hasTrackDetails(details: TrackDetails) {
  return Boolean(
    details.bpm ||
      details.genre ||
      details.subGenre ||
      details.key ||
      details.summary ||
      details.spotifyUrl,
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
