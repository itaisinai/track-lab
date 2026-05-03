export const config = {
  port: process.env.PORT ?? "3000",
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  beatport: {
    clientId: process.env.BEATPORT_CLIENT_ID,
    clientSecret: process.env.BEATPORT_CLIENT_SECRET,
  },
  getSongBpm: {
    apiKey: process.env.GETSONGBPM_API_KEY,
  },
};
