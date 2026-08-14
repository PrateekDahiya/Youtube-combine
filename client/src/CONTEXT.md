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
| `Header.js` + `Header.css` | `Header` | Top bar: hamburger, VidVault logo, search box, profile dropdown (login/logout, theme toggle, settings). Receives `onClick` and `user` from `App`. |
| `Menu.js` + `Menu.css` | `Menu` | Left sidebar with three modes (`Full`, `Narrow`, `Hidden`) controlled by a `menu` prop. Lists Home/Shorts/Subscriptions/You/Your channel/Uploads (→ `/uploads`)/History/Watch later/Liked/Trending/Categories/Settings/Feedback. Fetches subscriptions via `/api/get-subs`. |
| `Menuitem.js` + `Menuitem.css` | `Menuitem` | Reusable sidebar item (icon + label as a `<Link>`). Used by `Menu.js`. |

### Pages
| File | Component | Route(s) | What it renders |
|------|-----------|----------|-----------------|
| `Home.js` + `Home.css` | `Home` | `/`, `/home` | Infinite-scroll grid of `Card`s. Logged-out → `/api/home`; logged-in → `/api/personalized-feed` (uses history tags). |
| `Shorts.js` + `Shorts.css` | `Shorts` | `/shorts` | Vertical Shorts feed with three rotating `Shortbox` slots and up/down arrow + keyboard navigation. Fetches `/api/shorts`. |
| `Watch.js` + `Watch.css` | `Watch` | `/watch` | Video page: fetches `/api/watch` for metadata and the Flask service for stream URLs; falls back to YouTube `<iframe>` if the Flask call fails. When `videos.link` points to an uploaded file (starts with `/uploads/` or a `res.cloudinary.com` URL) it plays the file directly via the custom player and skips the Flask/YouTube pipeline. Like/dislike/subscribe/related-videos. |
| `Search.js` + `Search.css` | `Search` | `/search` | Hits `/api/search?query=…` and renders a grid of `Card`s. |
| `Yourchannel.js` + `Yourchannel.css` | `Yourchannel` | `/yourchannel` | The logged-in user's own channel: banner, info, Videos/Shorts tabs, and search. Each video card shows an edit button that opens the `EditVideo` modal. Uses `/api/yourchannel` + `/api/getvideosofchannel`. (Uploading a video lives on the `/uploads` page.) |
| `EditVideo.js` | `EditVideo` | `Yourchannel.js`. Modal to edit a video's metadata (title, description, tags, category, type, thumbnail) via `/api/updateVideo`. The video file itself is never re-uploaded. Thumbnail changes upload through `/api/upload` first. Reuses the `UploadVideo.css` classes. |
| `Channel.js` + `Channel.css` | `Channel` | `/channel` | Any channel view (by `?channel_id=`). Subscribe button (`/api/issub`, `/api/addtosubs`, `/api/removefromsubs`). |
| `You.js` + `You.css` | `You` | `/me` | "Account" landing for signed-in users: channel banner + name. Guests see a sign-in CTA. |
| `Subscription.js` + `Subscription.css` | `Subscription` | `/subscriptions` | Videos/Shorts from subscribed channels: `/api/subscriptions?isShort=&user_id=`. |
| `Trendings.js` + `Trendings.css` | `Trendings` | `/trendings` | Trending list with Now/Music/Gaming/Movies tabs: `/api/trendings?type=`. |
| `Category.js` + `Category.css` | `Category` | `/category?category=` | Browses a category (gaming, music, movies, news, sports, courses, fashionbeauty, shopping): `/api/category`. |
| `History.js` + `History.css` | `History` | `/history` | Watch history grouped by Today/Yesterday/This Week/This Month/Older. Items removable via `/api/removefromhistory`. Honors the `ishistory` toggle. |
| `Likedvideos.js` + `Likedvideos.css` | `Likedvideos` | `/likedvideos` | User's liked videos via `/api/likedvideos`. Honors the `islikedvideos` toggle. |
| `Watchlater.js` + `Watchlater.css` | `Watchlater` | `/watchlater` | User's watch-later list via `/api/watchlater`. Honors the `iswatchlater` toggle. |
| `Settings.js` + `Settings.css` | `Settings` | `/settings` | Settings hub: Account, General (theme/shorts/privacy toggles), Profile (editable user fields → `/api/updateUserDetail`), Channel (editable channel fields → `/api/updateChannelDetail` + profile photo/banner upload via `/api/upload` then saving the returned URL), Advanced (channel_id/user_id/Delete account → `/api/deleteUser`). Refetches user via `/api/getUser` after edits. |
| `Login.js` + `Login.css` | `Login` | `/login` (also `?type=register|feedback|logout`) | Multi-step auth form. Login (`/api/login`), Registration (`/api/register`), Feedback (`/api/feedback`), and Logout (clears `user` cookie). Hashes password client-side before sending. |

### Reusable building blocks
| File | Component | Used by |
|------|-----------|---------|
| `Card.js` + `Card.css` | `Card` | Almost every listing page. Renders a video thumbnail with title, channel icon, views, upload time, duration badge, hover watch-later button. Clicking navigates to `/watch` or `/shorts` depending on `isShort`. Adds history on click via `/api/addtohistory`. Optional `onEdit` prop shows an edit button that calls back with the video row (used by `Yourchannel`). Thumbnail falls back to a Cloudinary poster frame derived from the video `link` when `thumbnail_link` is empty. |
| `Cardloading.js` + `Cardloading.css` | `Cardloading` | Skeleton loader with shape variants for `home`, `category`, `channel`, `yourchannel`, `subscription`, `watch`. |
| `Videoplayer.js` + `Videoplayer.css` | `VideoPlayer` | `Watch.js`. Custom video player with separate `<video>` (webm) and `<audio>` sources, sync logic, quality menu, playback-speed menu, volume, fullscreen. |
| `Shortbox.js` + `Shortbox.css` | `Shortbox` | `Shorts.js`. Fetches the short's stream URL from the Flask `/get-short-url` endpoint. |
| `Shortplayer.js` + `Shortplayer.css` | `Shortplayer` | `Shortbox.js`. Plays the short, auto-loops, falls back to YouTube `<iframe>` when fetching the stream URL fails. |
| `Uploads.js` + `Uploads.css` | `Uploads` | `/uploads` | Dedicated uploads page: lists **all** of the logged-in user's uploaded videos (`/api/uploadingVideos`, polls every 2s while anything is uploading) with status (Uploading + progress bar / Failed + reason / Uploaded), a thumbnail, and an edit button opening the `EditVideo` modal. Has an "Upload video" button opening the `UploadVideo` modal. Guests see a sign-in CTA. |
| `UploadVideo.js` + `UploadVideo.css` | `UploadVideo` | `Header.js`, `Uploads.js`. Popup modal to upload a video to the user's own channel: collects video file, thumbnail, title, description, tags, category, type (video/short). When Cloudinary is configured it **chunk-uploads the file directly from the browser to Cloudinary** (signed via `/api/uploadSignature`, ~5 MB chunks with `X-Unique-Upload-Id` + `Content-Range` headers) to bypass proxy request-size limits, then persists metadata via `/api/completeVideoUpload`. Shows a live progress bar in the modal. Falls back to the legacy multipart `/api/uploadVideo` POST when Cloudinary is unavailable (local dev). |

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
- **API base**: `const serverurl = process.env.REACT_APP_SERVER_URL;` then call `${serverurl}/<route>` where `<route>` does **not** include the `/api` prefix (the env value does). e.g. `${serverurl}/home` → `/api/home`.
- **User propagation**: `App.js` holds `crntuser` and forwards it as the `user` prop to every page. Pages forward `user.channel_id` to `Card` (which uses it for watch-later/history calls).
- **Guest handling**: when a page needs a logged-in user it checks `user === "Guest"` and renders a sign-in CTA instead of an error.
- **Format helpers** (`formatNumber`, `formatISODate`, `getDateDifference`, `formatDuration`) are duplicated across `Card.js`, `Watch.js`, `Channel.js`, `Yourchannel.js`, `Subscription.js`, and others. If you change one, search for the rest.
- **External Flask endpoint** `https://flaskapp-5c1j.onrender.com` is hard-coded in `Watch.js` and `Shortbox.js`.
- **No tests** live here; the CRA `test` script exists but no `*.test.js` files are present.

## Dependencies actually used (from `client/package.json`)

- `react@^18.2.0`, `react-dom@^18.2.0` — UI
- `react-router-dom@^6.23.1` — routing
- `axios@^1.7.2` — all API calls
- `crypto-js@^4.2.0` — client-side password hashing in `Login.js`
- `js-cookie@^3.0.5` — `user` cookie in `App.js`, `Card.js`, `Login.js`
- `node-fetch@^3.3.2` — pulled in but not directly imported anywhere in `src/`
- `web-vitals`, `@testing-library/*` — CRA scaffolding, effectively unused
