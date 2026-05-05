export function createTrackPrompt(title: string, artists: string) {
  return `I have a track and I want you to enrich the details:
Title: ${title}
Artist: ${artists}

I want you to send back object with:
Title, Artists, Album, BPM, Genre, SubGenre, Key, AI-generated summary, provider statuses, Spotify URL, Beatport URL, GetSongBPM URL, and Wikipedia URL when available`;
}
