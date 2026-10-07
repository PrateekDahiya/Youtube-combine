# CONTEXT.md — `client/src/`

## What this directory is

All React application source for the VidVault front-end: the root component, page components, shared building blocks, a theme context, and co-located CSS files. Complied by Create React App. There are no subdirectories here — every file sits flat in this folder.

## Entry points

- `index.js` — renders `<App/>` inside `<ThemeProvider>` into `#root`. Imports `index.css`.
- `App.js` — root component. Holds the global `crntuser` state (read from the `user` cookie), the menu state machine, and feature toggles (`iswatchlater`, `islikedvideos`, `ishistory`, `isShorts`) persisted to `localStorage`. Defines all routes via `react-router-dom@6`. Imports `App.css`.

## File-by-file index

### Routing & shell
| File | Component | Role |
|------|-----------|------|
| `App.js` | `App` | Root; routes; passes `user` prop to every page. |
| `Header.js` + `Header.css` | `Header` | Top bar: hamburger, VidVault logo, search box with typeahead dropdown (`GET /api/suggest`, 250ms debounce, keyboard nav), profile dropdown (login/logout, theme toggle, settings). Receives `onClick` and `user` from `App`. |
| `Menu.js` + `Menu.css` | `Menu` | Left sidebar with three modes (`Full`, `Narrow`, `Hidden`) controlled by a `menu` prop. Order: Home/Shorts, Subscriptions section (heading links to `/subscriptions`; channel pills or Guest sign-in card), You section (You/Your channel/Uploads/History/Watch later/Liked), Explore categories, Settings/Feedback. Narrow rail shows Home/Shorts/You only. Fetches subscriptions via `/api/get-subs`. |
| `Menuitem.js` + `Menuitem.css` | `Menuitem` | Reusable sidebar item (icon + label as a `<Link>`). Used by `Menu.js`. |

### Pages
| File | Component | Route(s) | What it renders |
|------|-----------|----------|-----------------|
| `Home.js` + `Home.css` | `Home` | `/`, `/home` | Infinite-scroll grid of `Card`s. Logged-out → `POST /api/videos {type:"home"}`; logged-in → `POST /api/videos {type:"personalized"}` (uses history tags). One merged filter row (shuffled top-tags + video types, multi-select OR-union via `type:"tag"` with `tags[]`+`categories[]`) plus pinned "New for you" (`type:"newforyou"`) and Clear chips. Filter row always renders — the skeleton covers only the video grid. |
| `Shorts.js` + `Shorts.css` | `Shorts` | `/shorts` | Vertical Shorts feed with three rotating `Shortbox` slots and up/down arrow + keyboard navigation. Fetches `POST /api/videos {type:"shorts"}`. |
| `Watch.js` + `Watch.css` | `Watch` | `/watch` | Video page: fetches `POST /api/videos {type:"watch"}` for metadata and `GET /api/stream/:videoId` (server-side `youtubei.js`, see `server/CONTEXT.md`) for stream URLs; falls back to YouTube `<iframe>` only when the resolver reports `extraction_ok: false`. Checks `GET /api/local-stream/list` first: listed videos play self-hosted (`mode="local"`, manifest qualities only) ahead of everything else. Otherwise picks a playback `mode` (`hls` > `progressive` > `adaptive`) from whichever tier the response populated. A "Save locally" button posts the video id to `/api/local-stream/add` (360p, ephemeral until committed) and switches to local playback on success. When `videos.link` points to an uploaded file (starts with `/uploads/` or a `res.cloudinary.com` URL) it plays the file directly via the custom player (`mode="progressive"`) and skips the resolver entirely. Like/dislike/subscribe/related-videos. Share button opens a `Modal` with copyable link (+ native share sheet where supported); Download saves uploaded files directly, opens resolved YouTube streams in a new tab, or explains unavailability with a YouTube-link fallback — all confirmed via toast. Autoplay toggle under the player (shown for both the custom player and the YouTube iframe fallback): when on, video end advances to the first related video — via `onEnded` for the custom player, via the YouTube IFrame Player API (`enablejsapi=1` + `onStateChange` ENDED) for the iframe. The setting persists to `user.autoplay` via `/api/updateUserDetail` (Guests fall back to `localStorage`). |
| `Search.js` + `Search.css` | `Search` | `/search` | Hits `POST /api/videos {type:"search"}` and renders a grid of `Card`s. |
| `Yourchannel.js` + `Yourchannel.css` | `Yourchannel` | `/yourchannel` | The logged-in user's own channel: banner, info, Videos/Shorts tabs, and search. Each video card shows an edit button that opens the `EditVideo` modal. Uses `/api/yourchannel` + `POST /api/videos {type:"channel"}`. The About "more" popup uses the shared `Modal` component. Layout: full-height flex column with sticky tab bar over a self-scrolling video grid. (Uploading a video lives on the `/uploads` page.) |
| `EditVideo.js` | `EditVideo` | `Yourchannel.js`. Modal to edit a video's metadata (title, description, tags, category, type, thumbnail) via `/api/updateVideo`. The video file itself is never re-uploaded. Thumbnail changes upload through `/api/upload` first. Reuses the `UploadVideo.css` classes. |
| `Channel.js` + `Channel.css` | `Channel` | `/channel` | Any channel view (by `?channel_id=`). Videos via `POST /api/videos {type:"channel"}`. Subscribe button (`/api/issub`, `/api/addtosubs`, `/api/removefromsubs`). The About "more" popup uses the shared `Modal` component. Layout: full-height flex column with sticky tab bar over a self-scrolling video grid. |
| `You.js` + `You.css` | `You` | `/me` | "Account" landing for signed-in users: channel banner + name. Guests see a sign-in CTA. |
| `Subscription.js` + `Subscription.css` | `Subscription` | `/subscriptions` | Videos/Shorts from subscribed channels: `POST /api/videos {type:"subscriptions"}`. |
| `Trendings.js` + `Trendings.css` | `Trendings` | `/trendings` | Trending list with Now/Music/Gaming/Movies tabs: `POST /api/videos {type:"trending"}`. |
| `Category.js` + `Category.css` | `Category` | `/category?category=` | Browses a category (gaming, music, movies, news, sports, courses, fashionbeauty, shopping): `POST /api/videos {type:"category"}`. |
| `History.js` + `History.css` | `History` | `/history` | Watch history grouped by Today/Yesterday/This Week/This Month/Older. Items removable via `/api/removefromhistory`. Honors the `ishistory` toggle. |
| `Likedvideos.js` + `Likedvideos.css` | `Likedvideos` | `/likedvideos` | User's liked videos via `POST /api/videos {type:"liked"}`. Honors the `islikedvideos` toggle. |
| `Watchlater.js` + `Watchlater.css` | `Watchlater` | `/watchlater` | User's watch-later list via `POST /api/videos {type:"watchlater"}`. Honors the `iswatchlater` toggle. |
| `Settings.js` + `Settings.css` | `Settings` | `/settings` | Settings hub: Account, General (theme/shorts/privacy toggles), Profile (editable user fields → `/api/updateUserDetail`), Channel (editable channel fields → `/api/updateChannelDetail` + profile photo/banner upload via `/api/upload` then saving the returned URL), Advanced (channel_id/user_id/Delete account → `/api/deleteUser`). Refetches user via `/api/getUser` after edits. |
| `Login.js` + `Login.css` | `Login` | `/login` (also `?type=register|feedback|logout`) | Grouped auth forms with pure validators + a `touched` set (errors/`invalid` only after blur or page submit; Next/Submit marks the page touched and advances only when the group validates). Register: About you → Account → Channel (+Back buttons). Login: identifier + password on one page (password rule gate preserved). Feedback: single page. Hashes password client-side before sending. Covered by `Login.test.js` (6 interaction tests). |

### Reusable building blocks
| File | Component | Used by |
|------|-----------|---------|
| `Card.js` + `Card.css` | `Card` | Almost every listing page. Renders a 16:9 `.card-thumb` with CSS 2-line title clamp and single-line channel/views/time meta. A ⋮ trigger (top-right, hover/focus/touch-visible) opens a dropdown: Share (Modal + clipboard + toast), Download (direct link or on-demand stream URL), Watch-later toggle, Add to queue, plus `onRemoveHistory` (History), `onEdit`/`onDelete` (Your channel) rows when those props are passed. |
| `QueueContext.js` | `QueueProvider` + `useQueue` | Global queue state (reducer + `localStorage` persistence): enqueue/dequeue/clear/playAt/advance/rewind, loop off→all→one, shuffle, play history (cap 50), popup open flag. Pure `computeNext`/`computePrev` helpers. Survives page navigation; consumed by `Card.js`, `Watch.js`, `QueuePopup.js`, `QueuePage.js`. |
| `QueuePopup.js` + `QueuePopup.css` | `QueuePopup` | Bottom-right panel mounted in `App.js`: now-playing, prev/next/loop/shuffle/close, click-to-play rows with remove, Clear, link to `/queue`. |
| `QueuePage.js` + `QueuePage.css` | `QueuePage` | `/queue` route: Up-next playlist (click any row to play from there) + Recently-played history, both with clear actions. | The watch-later state comes from the video row's `is_watchlater` field (set by the server on every `POST /api/videos` response) — no per-hover API call. Clicking navigates to `/watch` or `/shorts` depending on `isShort`. Adds history on click via `/api/addtohistory`. Optional `onEdit` prop shows an edit button that calls back with the video row (used by `Yourchannel`). Thumbnail falls back to a Cloudinary poster frame derived from the video `link` when `thumbnail_link` is empty. |
| `Cardloading.js` + `Cardloading.css` | `Cardloading` | Skeleton loader with shape variants for `home`, `category`, `channel`, `yourchannel`, `subscription`, `watch`. |
| `imgFallback.js` | (shared helpers, no component) | Theme-aware (`document.body` class / `localStorage.theme`) inline-SVG data-URI placeholders — `avatarFallback()` / `thumbFallback()` (light: gray-on-light, dark: gray-on-dark, no network dependency) + `handleImgError(fn)` (resolves the function lazily at error time, once-guarded swap) + `hideImgOnError` (for banners). Used by every data-driven `<img>` (thumbnails, avatars, banners); static UI icons are intentionally left alone. |
| `Videoplayer.js` + `Videoplayer.css` | `VideoPlayer` | `Watch.js`/`Shortbox.js`. Custom player with `hls`/`progressive`/`adaptive`/`local` modes, separate `<video>`+`<audio>` sync in adaptive mode, quality/speed menus, volume, fullscreen, buffering spinner, buffered-progress bar. Media elements remount per stream URL (`key`), so quality switches always load fresh; position/resume rides in refs. Quality selection prefers the progressive tier and only drops to adaptive when the resolution is adaptive-only. Covered by `Videoplayer.test.js`. |
| `streamUtils.js` | (helpers, no component) | `pickAdaptiveAudio(audioList)` — prefers `audio/mp4` over opus/webm so adaptive playback works cross-browser (Safari can't play opus). `isGoogleVideoUrl` / `proxyStreamUrl` — route googlevideo URLs through same-origin `GET /api/stream/fetch?u=` when direct playback 403s. Re-exported via `api/stream.js`; used by `Videoplayer.js`, `Watch.js`, `Shortbox.js`. |
| `Shortbox.js` + `Shortbox.css` | `Shortbox` | `Shorts.js`. Fetches the short's stream URL from `GET /api/stream/:videoId` (same resolver as `Watch.js`), preferring `hls_url` then the first `progressive` entry. |
| `Shortplayer.js` + `Shortplayer.css` | `Shortplayer` | `Shortbox.js`. Plays the short, auto-loops, falls back to YouTube `<iframe>` when fetching the stream URL fails. |
| `Uploads.js` + `Uploads.css` | `Uploads` | `/uploads` | Dedicated uploads page: lists **all** of the logged-in user's uploaded videos (`/api/uploadingVideos`, polls every 2s while anything is uploading) with status (Uploading + progress bar / Failed + reason / Uploaded), a thumbnail, and an edit button opening the `EditVideo` modal. Has an "Upload video" button opening the `UploadVideo` modal. Guests see a sign-in CTA. |
| `UploadVideo.js` + `UploadVideo.css` | `UploadVideo` | `Header.js`, `Uploads.js`. Popup modal to upload a video to the user's own channel: collects video file, thumbnail, title, description, tags, category, type (video/short). When Cloudinary is configured it **chunk-uploads the file directly from the browser to Cloudinary** (signed via `/api/uploadSignature`, ~5 MB chunks with `X-Unique-Upload-Id` + `Content-Range` headers) to bypass proxy request-size limits, then persists metadata via `/api/completeVideoUpload`. Shows a live progress bar in the modal. Falls back to the legacy multipart `/api/uploadVideo` POST when Cloudinary is unavailable (local dev). |
| `Modal.js` + `Modal.css` | `Modal` | `Channel.js`, `Yourchannel.js` (About dialog); reusable for any popup. Portal-rendered onto `document.body` so no ancestor `transform`/`overflow` can break `position: fixed`. Renders an overlay (blur backdrop, click-to-close) containing a card with animated gradient top border, header (title + close), scrollable body, optional footer. Props: `isOpen`, `onClose`, `title`, `icon`, `size` (`small`/`medium`/`large`), `showClose`, `closeOnBackdrop`, `closeOnEscape`, `footer`, `className`, `width`, `children`. Supports Esc-to-close, focus trapping, and body scroll lock. |
| `ShareDialog.js` + `ShareDialog.css` | `ShareDialog` | Shared share popup used by `Watch.js` and `Card.js`: theme-styled link row (readonly input + blue Copy button with "Copied" feedback) plus native share sheet where supported. Props: `isOpen`, `onClose`, `url`, `title`, `onCopied(ok)`. | Portal-rendered onto `document.body` so no ancestor `transform`/`overflow` can break `position: fixed`. Renders an overlay (blur backdrop, click-to-close) containing a card with animated gradient top border, header (title + close), scrollable body, optional footer. Props: `isOpen`, `onClose`, `title`, `icon`, `size` (`small`/`medium`/`large`), `showClose`, `closeOnBackdrop`, `closeOnEscape`, `footer`, `className`, `width`, `children`. Supports Esc-to-close, focus trapping, and body scroll lock. |

### Theme & styles
| File | Role |
|------|------|
| `ThemeContext.js` | React context providing `theme` (`"light"` | `"dark"`) and `toggleTheme`. Persisted to `localStorage.theme`. |
| `themes.css` | Light/dark CSS variables applied via `body.light` / `body.dark`. |
| `index.css` | Global base styles + CSS reset imported once in `index.js`. |
| `App.css` | App-level layout (header + menu + content grid). |

## Conventions

- **Naming**: one PascalCase `.js` file per component, paired with a same-name `.css` (e.g. `Watch.js` ↔ `Watch.css`). All files live flat in this directory.
- **Default export**: every component is a default export of a function component that accepts a single object argument. The codebase calls this argument `params` (not `props`).
- **API base**: `const serverurl = process.env.REACT_APP_SERVER_URL;` then call `${serverurl}/<route>` where `<route>` does **not** include the `/api` prefix (the env value does). e.g. `${serverurl}/videos` → `/api/videos`.
- **Unified videos endpoint**: all video lists (home, tag, category, trending, subscriptions, search, personalized, watchlater, liked, history, channel, related, shorts) go through `POST /api/videos` with a `type` field in the body (see `src/api/videos.js`). Mutations (like/subscribe/history/watch-later add/remove) keep their own endpoints.
- **User propagation**: `App.js` holds `crntuser` and forwards it as the `user` prop to every page. Pages forward `user.channel_id` to `Card` (which uses it for watch-later/history calls).
- **Guest handling**: when a page needs a logged-in user it checks `user === "Guest"` and renders a sign-in CTA instead of an error.
- **Format helpers** (`formatNumber`, `formatISODate`, `getDateDifference`, `formatDuration`) are duplicated across `Card.js`, `Watch.js`, `Channel.js`, `Yourchannel.js`, `Subscription.js`, and others. If you change one, search for the rest.
- **Stream resolution is in-process**: `Watch.js`/`Shortbox.js` call `streamApi.getStream(videoId)` (`src/api/stream.js` → `GET /api/stream/:videoId`), which runs entirely inside the Node server via `youtubei.js` (see `server/CONTEXT.md`). There is no longer a separate external Flask/yt-dlp service.
- **No tests** live here; the CRA `test` script exists but no `*.test.js` files are present.

## Dependencies actually used (from `client/package.json`)

- `react@^18.2.0`, `react-dom@^18.2.0` — UI
- `react-router-dom@^6.23.1` — routing
- `axios@^1.7.2` — all API calls
- `crypto-js@^4.2.0` — client-side password hashing in `Login.js`
- `js-cookie@^3.0.5` — `user` cookie in `App.js`, `Card.js`, `Login.js`
- `node-fetch@^3.3.2` — pulled in but not directly imported anywhere in `src/`
- `web-vitals`, `@testing-library/*` — CRA scaffolding, effectively unused
