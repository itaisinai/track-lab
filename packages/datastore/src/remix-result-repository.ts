import type { SaveRemixCandidateRequest, SavedRemixCandidate } from "./types.ts";
import type { MaybePromise } from "./repository.ts";

export interface RemixResultRepository {
  listRemixes(): MaybePromise<SavedRemixCandidate[]>;
  saveRemix(input: SaveRemixCandidateRequest): MaybePromise<SavedRemixCandidate>;
}
