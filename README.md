# VidVault

A full-stack YouTube clone. Browse, watch, and organize videos pulled from real YouTube channels via the YouTube Data API, alongside your own uploaded videos — with subscriptions, likes, watch history, watch-later, comments, and a personalized feed.

## Tech stack

- **Client:** React (Create React App), React Router
- **Server:** Node.js + Express, MySQL (`mysql2`)
- **Video streaming:** in-process stream URL resolution via `youtubei.js`, with `hls.js` for adaptive playback in the browser
- **Media storage:** Cloudinary (uploaded videos/thumbnails)
- **Email:** Resend (registration + feedback notifications)
- **Data source:** YouTube Data API v3 (with rotating API keys)
- **Deployment:** Render (single web service serving the built client + API)

## Architecture

```
 browser  ──HTTP──►  Express (server/server.js)
                        │
                        ├── /api/*             → MySQL queries + YouTube Data API v3 fetcher
                        ├── /api/health/*       → health checks
                        └── static + SPA fallback → client/build/index.html

 Express also calls out (server-side) to:
   • YouTube Data API v3 (search.list, videos.list, channels.list)
   • Resend email API
   • youtubei.js (in-process) — resolves stream URLs for /api/stream/:videoId
```

Two endpoints (`/api/update_channels`, `/api/addnewchannel`) are meant to be triggered on a schedule (e.g. an external cron) to keep the video catalog fresh and occasionally discover new channels.

## Project structure

```
client/     React front-end (built to static files, served by Express)
server/     Express API, MySQL schema (server/db/), YouTube fetcher (server/src/youtube/)
render.yaml Render deployment blueprint
```

See `CONTEXT.md` (and the `CONTEXT.md` in each subdirectory) for a deeper tour of the codebase.

## Getting started (local dev)

### Prerequisites
- Node.js 20+
- A MySQL 8.0+ database (schema in `server/db/schema.sql`)
- At least one YouTube Data API v3 key
- (Optional) Cloudinary account, Resend API key

### Server

```bash
cd server
cp .env.example .env   # fill in DB credentials, API_KEYS, etc.
npm install
npm run dev            # nodemon, http://localhost:5000
```

### Client

```bash
cd client
cp .env.example .env.development   # REACT_APP_SERVER_URL=http://localhost:5000/api
npm install
npm start                          # http://localhost:3000
```

## Deployment

This repo deploys as a single Render web service via `render.yaml`:

```bash
npm run render-build   # installs + builds the client, then installs the server
npm start               # node server/server.js — serves the API and the built client
```

Required environment variables are listed in `server/.env.example` and declared in `render.yaml` (DB credentials, `API_KEYS`, Cloudinary, Resend, etc.).
