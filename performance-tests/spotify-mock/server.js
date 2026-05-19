'use strict';

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────────────────────
// Static mock data
// ──────────────────────────────────────────────────────────────

const MOCK_ACCESS_TOKEN = 'mock_spotify_access_token_fitbeat_perf';
const MOCK_REFRESH_TOKEN = 'mock_spotify_refresh_token_fitbeat_perf';

const MOCK_TRACKS = [
  {
    uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
    name: 'Never Gonna Give You Up',
    artists: [{ name: 'Rick Astley' }],
    album: { name: 'Whenever You Need Somebody' },
    duration_ms: 213573,
    external_urls: { spotify: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
  },
  {
    uri: 'spotify:track:3n3Ppam7vgaVa1iaRUIOKE',
    name: 'Eye of the Tiger',
    artists: [{ name: 'Survivor' }],
    album: { name: 'Eye of the Tiger' },
    duration_ms: 245573,
    external_urls: { spotify: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUIOKE' },
  },
  {
    uri: 'spotify:track:7ouMYWpwJ422jRcDASZB7P',
    name: 'Kashmir',
    artists: [{ name: 'Led Zeppelin' }],
    album: { name: 'Physical Graffiti' },
    duration_ms: 508000,
    external_urls: { spotify: 'https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P' },
  },
  {
    uri: 'spotify:track:2TpxZ7JUBn3uw46aR7qd6V',
    name: 'Lose Yourself',
    artists: [{ name: 'Eminem' }],
    album: { name: '8 Mile' },
    duration_ms: 326173,
    external_urls: { spotify: 'https://open.spotify.com/track/2TpxZ7JUBn3uw46aR7qd6V' },
  },
  {
    uri: 'spotify:track:6habFhsOp2NvshLv26DqMb',
    name: 'Stronger',
    artists: [{ name: 'Kanye West' }],
    album: { name: 'Graduation' },
    duration_ms: 311867,
    external_urls: { spotify: 'https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb' },
  },
];

// ──────────────────────────────────────────────────────────────
// Logging middleware
// ──────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ──────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'spotify-mock' });
});

// ──────────────────────────────────────────────────────────────
// accounts.spotify.com  →  POST /api/token
// Handles: authorization_code and refresh_token grants
// ──────────────────────────────────────────────────────────────
app.post('/api/token', (_req, res) => {
  res.json({
    access_token: MOCK_ACCESS_TOKEN,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: MOCK_REFRESH_TOKEN,
    scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state',
  });
});

// ──────────────────────────────────────────────────────────────
// api.spotify.com  →  GET /v1/me
// ──────────────────────────────────────────────────────────────
app.get('/v1/me', (_req, res) => {
  res.json({
    id: 'mock_user_fitbeat',
    display_name: 'FitBeat Test User',
    email: 'mockuser@fitbeat.test',
    product: 'premium',
    country: 'CO',
    followers: { total: 42 },
    images: [],
    external_urls: { spotify: 'https://open.spotify.com/user/mock_user_fitbeat' },
  });
});

// ──────────────────────────────────────────────────────────────
// api.spotify.com  →  GET /v1/me/player/currently-playing
// ──────────────────────────────────────────────────────────────
app.get('/v1/me/player/currently-playing', (_req, res) => {
  const track = MOCK_TRACKS[0];
  res.json({
    is_playing: true,
    progress_ms: 45000,
    item: {
      uri: track.uri,
      name: track.name,
      artists: track.artists,
      album: track.album,
      duration_ms: track.duration_ms,
      external_urls: track.external_urls,
    },
    currently_playing_type: 'track',
    timestamp: Date.now(),
  });
});

// ──────────────────────────────────────────────────────────────
// api.spotify.com  →  GET /v1/search
// Returns 5 mock tracks regardless of query params
// ──────────────────────────────────────────────────────────────
app.get('/v1/search', (_req, res) => {
  res.json({
    tracks: {
      href: 'https://api.spotify.com/v1/search?q=mock&type=track&limit=5',
      items: MOCK_TRACKS,
      limit: 5,
      next: null,
      offset: 0,
      previous: null,
      total: MOCK_TRACKS.length,
    },
  });
});

// ──────────────────────────────────────────────────────────────
// api.spotify.com  →  POST /v1/me/player/queue
// Spotify returns 204 No Content on success
// ──────────────────────────────────────────────────────────────
app.post('/v1/me/player/queue', (_req, res) => {
  res.status(204).send();
});

// ──────────────────────────────────────────────────────────────
// api.spotify.com  →  PUT /v1/me/player
// Playback control (play/pause) — 204 on success
// ──────────────────────────────────────────────────────────────
app.put('/v1/me/player', (_req, res) => {
  res.status(204).send();
});

// ──────────────────────────────────────────────────────────────
// Catch-all: log unknown routes so we can see missing endpoints
// ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`[MOCK] Unhandled route: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'mock_not_implemented', path: req.path });
});

app.listen(PORT, () => {
  console.log(`Spotify mock server running on port ${PORT}`);
});
