import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-client.ts";
import { normalizeTrackResult } from "./normalization.ts";
import { normalizeUniqueKey } from "./lib/object.ts";
import type { TrackResultRepository } from "./track-result-repository.ts";
import type {
  ProviderExecutionStatus,
  ResultError,
  ResultStatus,
  SaveTrackResultInput,
  TrackResult,
} from "./types.ts";

type PrismaTrackResultRow = {
  id: number;
  title: string;
  artists: string;
  album: string | null;
  titleKey: string;
  artistsKey: string;
  bpm: number | null;
  genre: string | null;
  subGenre: string | null;
  trackKey: string | null;
  summary: string | null;
  status: ResultStatus;
  providersUsedJson: string;
  errorsJson: string;
  responseJson: string;
  rawResponse: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaTrackResultDelegate = {
  findMany(args: {
    orderBy: Array<{ updatedAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
  }): Promise<PrismaTrackResultRow[]>;
  findUnique(args: {
    where: {
      id?: number;
      titleKey_artistsKey?: {
        titleKey: string;
        artistsKey: string;
      };
    };
  }): Promise<PrismaTrackResultRow | null>;
  deleteMany(args: { where: { id: number } }): Promise<{ count: number }>;
  upsert(args: {
    where: {
      titleKey_artistsKey: {
        titleKey: string;
        artistsKey: string;
      };
    };
    create: Omit<PrismaTrackResultRow, "id" | "createdAt" | "updatedAt">;
    update: Partial<Omit<PrismaTrackResultRow, "id" | "createdAt" | "updatedAt">>;
  }): Promise<PrismaTrackResultRow>;
};

export type PrismaTrackResultClient = {
  trackResult: PrismaTrackResultDelegate;
};

export class PrismaTrackResultRepository implements TrackResultRepository {
  private readonly client: PrismaTrackResultClient;

  constructor(client: PrismaTrackResultClient = createPrismaClient()) {
    this.client = client;
  }

  async listResults(): Promise<TrackResult[]> {
    const rows = await this.client.trackResult.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(mapPrismaTrackResultToTrackResult);
  }

  async getResult(id: number): Promise<TrackResult | null> {
    const row = await this.client.trackResult.findUnique({ where: { id } });

    return row ? mapPrismaTrackResultToTrackResult(row) : null;
  }

  async findByTrack(
    title: string,
    artists: string,
  ): Promise<TrackResult | null> {
    const row = await this.client.trackResult.findUnique({
      where: {
        titleKey_artistsKey: {
          titleKey: normalizeUniqueKey(title),
          artistsKey: normalizeUniqueKey(artists),
        },
      },
    });

    return row ? mapPrismaTrackResultToTrackResult(row) : null;
  }

  async deleteResult(id: number): Promise<boolean> {
    const result = await this.client.trackResult.deleteMany({ where: { id } });

    return result.count > 0;
  }

  async saveResult(input: SaveTrackResultInput): Promise<TrackResult> {
    const normalized = normalizeTrackResult(input);

    const saved = await this.client.trackResult.upsert({
      where: {
        titleKey_artistsKey: {
          titleKey: normalizeUniqueKey(normalized.title),
          artistsKey: normalizeUniqueKey(normalized.artists),
        },
      },
      create: toPrismaCreateInput(normalized, input),
      update: toPrismaUpdateInput(normalized, input),
    });

    return mapPrismaTrackResultToTrackResult(saved);
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });

  return new PrismaClient({ adapter }) as unknown as PrismaTrackResultClient;
}

function toPrismaCreateInput(
  normalized: ReturnType<typeof normalizeTrackResult>,
  input: SaveTrackResultInput,
): Omit<PrismaTrackResultRow, "id" | "createdAt" | "updatedAt"> {
  return {
    title: normalized.title,
    artists: normalized.artists,
    album: normalized.album,
    titleKey: normalizeUniqueKey(normalized.title),
    artistsKey: normalizeUniqueKey(normalized.artists),
    bpm: normalized.bpm,
    genre: normalized.genre,
    subGenre: normalized.subGenre,
    trackKey: normalized.key,
    summary: normalized.summary,
    status: normalized.status,
    providersUsedJson: JSON.stringify(normalized.providersUsed),
    errorsJson: JSON.stringify(normalized.errors),
    responseJson: JSON.stringify(input.json),
    rawResponse: input.rawResponse,
  };
}

function toPrismaUpdateInput(
  normalized: ReturnType<typeof normalizeTrackResult>,
  input: SaveTrackResultInput,
): Partial<Omit<PrismaTrackResultRow, "id" | "createdAt" | "updatedAt">> {
  return {
    title: normalized.title,
    artists: normalized.artists,
    album: normalized.album,
    titleKey: normalizeUniqueKey(normalized.title),
    artistsKey: normalizeUniqueKey(normalized.artists),
    bpm: normalized.bpm,
    genre: normalized.genre,
    subGenre: normalized.subGenre,
    trackKey: normalized.key,
    summary: normalized.summary,
    status: normalized.status,
    providersUsedJson: JSON.stringify(normalized.providersUsed),
    errorsJson: JSON.stringify(normalized.errors),
    responseJson: JSON.stringify(input.json),
    rawResponse: input.rawResponse,
  };
}

function mapPrismaTrackResultToTrackResult(
  row: PrismaTrackResultRow,
): TrackResult {
  return {
    id: row.id,
    title: row.title,
    artists: row.artists,
    album: row.album,
    bpm: row.bpm,
    genre: row.genre,
    subGenre: row.subGenre,
    key: row.trackKey,
    summary: row.summary,
    status: row.status,
    providersUsed: parseProvidersUsed(row.providersUsedJson),
    errors: parseErrors(row.errorsJson),
    json: parseJson(row.responseJson),
    rawResponse: row.rawResponse,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseProvidersUsed(value: string): ProviderExecutionStatus[] {
  const parsed = parseJson(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((provider) => {
      if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
        return null;
      }

      const record = provider as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;

      if (!name) {
        return null;
      }

      return {
        name,
        matched: typeof record.matched === "boolean" ? record.matched : null,
        url: typeof record.url === "string" ? record.url : null,
        error: typeof record.error === "string" ? record.error : null,
      };
    })
    .filter((provider): provider is ProviderExecutionStatus => Boolean(provider));
}

function parseErrors(value: string): ResultError[] {
  const parsed = parseJson(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((error) => {
      if (!error || typeof error !== "object" || Array.isArray(error)) {
        return null;
      }

      const record = error as Record<string, unknown>;
      const source = typeof record.source === "string" ? record.source : null;
      const message = typeof record.message === "string" ? record.message : null;

      if (!source || !message) {
        return null;
      }

      return { source, message };
    })
    .filter((error): error is ResultError => Boolean(error));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
