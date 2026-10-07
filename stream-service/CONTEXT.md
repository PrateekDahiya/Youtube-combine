# CONTEXT.md — `stream-service/`

On-demand yt-dlp download cache for VidVault adaptive qualities. Separate deployable (see `Dockerfile`, `render.yaml` `vidvault-stream-service`); the main Node app talks to it only when `STREAM_SERVICE_URL` is set.

## Why it exists

`googlevideo.com` adaptive URLs are throttled for bare server-side fetches (~1.3MB grace, then permanent 403 per URL — verified empirically, see root `AGENTS.md`/chat history). `yt-dlp` handles YouTube throttling natively, so this service downloads the requested quality once (muxed mp4 via ffmpeg), then serves bytes itself with full Range support — no throttling, no expiry, no IP binding.

## Endpoints

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/health` | Liveness probe (also Render `healthCheckPath`). |
| `POST` | `/api/ensure` `{video_id, quality}` | Downloads `{videoId}.{quality}p.mp4` if absent (`bv*[height=Q]+ba` preferring avc/mp4a, merged to mp4). Returns `{status: "ready", url, size}`; `too-big` (404) when the pre-checked size exceeds 3GB; `failed` (502) otherwise. Concurrent ensures for one key share a single download (single-flight map). |
| `GET` | `/api/file/:videoId/:quality` | Serves the cached mp4 with `200`/`206`/`416` Range handling; every hit refreshes `lastAccess`. 404 when absent. |

## Cache policy (`store.js`)

- `MEDIA_DIR` (default `./media`, `/data/media` in Docker) + `manifest.json` `{key: {file, size, lastAccess, videoId, quality}}`.
- **3GB total cap** (`MAX_TOTAL_BYTES`) with LRU overflow eviction; **5-minute idle TTL** (`IDLE_TTL_MS`) via a 30s sweeper. Evicted files re-download on next ensure.
- Per-file guard: `inspect` sums `filesize || filesize_approx` before downloading (refuse over 3GB), plus yt-dlp `--max-filesize 3G` as a hard stop mid-download.

## Conventions

- Zero npm dependencies (plain `node:http`); host must provide `yt-dlp`, `ffmpeg`, and a JS runtime (`--js-runtimes node`).
- `PORT` (default 5001). Behind a proxy, `X-Forwarded-Proto` is honored when building file URLs.
- Never commit `media/` (gitignored) — the cache is disposable by design.
