import type { SaveTrackResultInput, TrackResult } from "./types.ts";

export type MaybePromise<T> = T | Promise<T>;

export interface TrackResultRepository {
  listResults(): MaybePromise<TrackResult[]>;
  getResult(id: number): MaybePromise<TrackResult | null>;
  findByTrack(title: string, artists: string): MaybePromise<TrackResult | null>;
  deleteResult(id: number): MaybePromise<boolean>;
  saveResult(input: SaveTrackResultInput): MaybePromise<TrackResult>;
}
