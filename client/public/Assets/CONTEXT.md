# CONTEXT.md — `client/public/Assets/`

## What this directory is

A small folder of static binary assets that CRA copies verbatim into the build's root `/Assets/` path. Referenced from JavaScript by absolute path.

## Contents

| File | Purpose | Referenced from |
|------|---------|-----------------|
| `loading.mp4` | Short looping placeholder video shown while a real video stream URL is being resolved (and as the initial state before the Flask service responds). | `src/Videoplayer.js` (`<video src="/Assets/loading.mp4" autoPlay muted />`), and indirectly via `src/Shortplayer.js`. |

## Notes & gotchas

- Path must stay `/Assets/loading.mp4` (absolute) — CRA serves `public/` at the site root in both dev and prod. Relative paths would break because `Videoplayer.js` is loaded from various routes.
- Keep this file small; it is fetched eagerly by any page that mounts `Videoplayer`.
- There is no `AGENTS.md` here because this directory has no subdirectories — see the parent `client/public/AGENTS.md`.
