import type { SaveTrackResultInput, TrackResult } from "./types.ts";
import type { MaybePromise } from "./repository.ts";

export interface TrackResultRepository {
  listResults(): MaybePromise<TrackResult[]>;
  getResult(id: number): MaybePromise<TrackResult | null>;
  findByTrack(title: string, artists: string): MaybePromise<TrackResult | null>;
  deleteResult(id: number): MaybePromise<boolean>;
  saveResult(input: SaveTrackResultInput): MaybePromise<TrackResult>;
}
