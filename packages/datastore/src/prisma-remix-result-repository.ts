import type {
  SaveRemixCandidateRequest,
  SavedRemixCandidate,
  RemixSearchCandidate,
} from "@track-lab/api-types";
import { parseJson } from "./lib/json.ts";
import type { RemixResultRepository } from "./remix-result-repository.ts";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";

type PrismaRemixResultRow = {
  id: number;
  provider: string;
  link: string;
  title: string;
  artists: string;
  remixArtist: string | null;
  album: string | null;
  genre: string | null;
  subGenre: string | null;
  bpm: number | null;
  uploadedAt: string | null;
  durationMs: number | null;
  confidence: number;
  relevanceReason: string;
  originalTrackJson: string;
  requestedGenre: string | null;
  candidateJson: string;
  savedAt: Date;
  updatedAt: Date;
};

type PrismaRemixResultDelegate = {
  findMany(args: {
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaRemixResultRow[]>;
  upsert(args: {
    where: {
      provider_link: {
        provider: string;
        link: string;
      };
    };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<PrismaRemixResultRow>;
};

export type PrismaRemixResultClient = PrismaDatastoreClient & {
  remixResult: PrismaRemixResultDelegate;
};

export type PrismaRemixResultRepositoryOptions = {
  client?: PrismaRemixResultClient;
};

export class PrismaRemixResultRepository implements RemixResultRepository {
  private readonly client: PrismaRemixResultClient;

  constructor(options: PrismaRemixResultRepositoryOptions = {}) {
    this.client = options.client ?? (createPrismaDatastoreClient() as PrismaRemixResultClient);
  }

  async listRemixes(): Promise<SavedRemixCandidate[]> {
    const rows = await this.client.remixResult.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(mapRowToSavedRemix);
  }

  async saveRemix(input: SaveRemixCandidateRequest): Promise<SavedRemixCandidate> {
    const now = new Date();
    const { candidate } = input;

    const saved = await this.client.remixResult.upsert({
      where: {
        provider_link: {
          provider: candidate.provider,
          link: candidate.link,
        },
      },
      create: {
        provider: candidate.provider,
        link: candidate.link,
        title: candidate.title,
        artists: candidate.artists,
        remixArtist: candidate.remixArtist ?? null,
        album: candidate.album ?? null,
        genre: candidate.genre ?? null,
        subGenre: candidate.subGenre ?? null,
        bpm: candidate.bpm ?? null,
        uploadedAt: candidate.createdAt ?? null,
        durationMs: candidate.durationMs ?? null,
        confidence: candidate.confidence,
        relevanceReason: candidate.relevanceReason,
        originalTrackJson: JSON.stringify(input.originalTrack),
        requestedGenre: input.requestedGenre ?? null,
        candidateJson: JSON.stringify(candidate),
        savedAt: now,
        updatedAt: now,
      },
      update: {
        title: candidate.title,
        artists: candidate.artists,
        remixArtist: candidate.remixArtist ?? null,
        album: candidate.album ?? null,
        genre: candidate.genre ?? null,
        subGenre: candidate.subGenre ?? null,
        bpm: candidate.bpm ?? null,
        uploadedAt: candidate.createdAt ?? null,
        durationMs: candidate.durationMs ?? null,
        confidence: candidate.confidence,
        relevanceReason: candidate.relevanceReason,
        originalTrackJson: JSON.stringify(input.originalTrack),
        requestedGenre: input.requestedGenre ?? null,
        candidateJson: JSON.stringify(candidate),
        updatedAt: now,
      },
    });

    return mapRowToSavedRemix(saved);
  }
}

function mapRowToSavedRemix(row: PrismaRemixResultRow): SavedRemixCandidate {
  const candidate = parseJson(row.candidateJson) as RemixSearchCandidate;

  return {
    ...candidate,
    id: row.id,
    title: row.title,
    artists: row.artists,
    remixArtist: row.remixArtist,
    album: row.album,
    genre: row.genre,
    subGenre: row.subGenre,
    bpm: row.bpm,
    provider: row.provider as RemixSearchCandidate["provider"],
    link: row.link,
    createdAt: row.uploadedAt,
    durationMs: row.durationMs,
    confidence: row.confidence,
    relevanceReason: row.relevanceReason,
    originalTrack: parseJson(row.originalTrackJson) as SavedRemixCandidate["originalTrack"],
    requestedGenre: row.requestedGenre,
    savedAt: row.savedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
