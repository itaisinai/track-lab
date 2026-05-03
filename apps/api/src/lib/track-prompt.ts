export function createTrackPrompt(title: string, artists: string) {
  return `I have a track and I want you to enrich the details:
Title: ${title}
Artist: ${artists}

I want you to send back object with:
Title, Artists, BPM, Genre, SubGenre, Key, AI-generated summary, Spotify matched status and Spotify URL, Beatport matched status and Beatport URL, GetSongBPM matched status and GetSongBPM URL`;
}
