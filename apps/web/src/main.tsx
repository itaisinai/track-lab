import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = "http://localhost:3000/agent";

type TrackDetails = {
  bpm?: string;
  genre?: string;
  summary?: string;
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
              <div className="summary">
                <span>Summary</span>
                <p>{trackDetails.summary ?? "No summary returned."}</p>
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
BPM, Genre, AI-generated summary`;
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
    summary:
      matchLabeledValue(response, "AI-generated summary") ??
      matchLabeledValue(response, "AI generated summary") ??
      matchLabeledValue(response, "Summary"),
  };

  return hasTrackDetails(details) ? details : null;
}

function extractTrackDetails(record: Record<string, unknown>): TrackDetails {
  return {
    bpm: valueToString(findValue(record, ["bpm"])),
    genre: valueToString(findValue(record, ["genre"])),
    summary: valueToString(
      findValue(record, [
        "ai-generated summary",
        "ai generated summary",
        "summary",
        "aiSummary",
        "ai_generated_summary",
      ]),
    ),
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

function hasTrackDetails(details: TrackDetails) {
  return Boolean(details.bpm || details.genre || details.summary);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
