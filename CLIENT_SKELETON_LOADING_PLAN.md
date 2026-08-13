# Client Skeleton Loading Plan

Goal: replace the current loading UI with YouTube-style skeleton loaders (grey shimmering placeholders that mirror the final layout) for **every** page/component that fetches data. Work is done **one page at a time**, in phases, so each page can be verified independently before moving on.

## Current state (audit)

| Page / component | File | Loading today | Quality |
|------------------|------|---------------|---------|
| Home (feed) | `Home.js` | `<Cardloading />` (grid of cards) | OK shape, improve shimmer + count |
| Category | `Category.js` | none — renders blank until loaded | ❌ missing |
| Trending | `Trendings.js` | none — blank until loaded | ❌ missing |
| Search | `Search.js` | none — blank until loaded | ❌ missing |
| Subscriptions | `Subscription.js` | none — blank until loaded | ❌ missing |
| Watch (player + related) | `Watch.js` | none – blank until loaded | ❌ missing |
| Channel | `Channel.js` | `<Cardloading page="channel" />` | Partial |
| Yourchannel | `Yourchannel.js` | `<Cardloading page="yourchannel" />` | Partial |
| You (`/me`) | `You.js` | `<p>loading...</p>` | ❌ text only |
| History | `History.js` | none | ❌ missing |
| Liked videos | `Likedvideos.js` | none | ❌ missing |
| Watch later | `Watchlater.js` | none | ❌ missing |
| Shorts | `Shorts.js`/`Shortbox.js`/`Shortplayer.js` | bespoke loading class | Partial |
| **Shared primitive** | `Cardloading.js` + `Cardloading.css` | hand-rolled blocks | to be upgraded |

## Shared foundation (do FIRST)

Refactor `Cardloading.js`/`Cardloading.css` into a reusable, layout-mirroring skeleton system before touching individual pages.

1. **Add a shimmer animation** (YouTube-style): a moving diagonal highlight over a grey base, driven by keyframes in `Cardloading.css`; apply via a base class `.skeleton-item` rather than per-block duplication.
2. **Build a `SkeletonCard` primitive** that mirrors `Card.js` layout: thumbnail block + channel icon + two text lines, sized to the real grid columns.
3. **Add a `SkeletonGrid`** that renders `SkeletonCard` × N with the same responsive column counts as `CardGrid.css` (so skeletons sit in the same grid the real cards will).
4. **Add per-page header/hero skeleton variants** (category heading, channel banner+info, watch player+buttons, search header) following the existing `params.page` switch.
5. Keep the existing `params.page` API so pages only pass a `page` prop; put all variant markup inside `Cardloading.js`.
6. Move the skeleton into the same scroll/flex containers produced by the page so the loader matches the final geometry (one custom scrollbar, grid owns scroll).

**Sequence note:** Phase 0 is a *shared* deliverable, but per the "one page at a time" rule, it is refined page by page in each later phase and finalized there.

## Phases (one page per phase)

### Phase 1 — Home
- Files: `Home.js`, `Cardloading.css` (card grid variant)
- Use `SkeletonGrid` matching Home's `card-grid-default` responsive columns.
- Matches final: tag strip stays real at top; only the grid below is skeleton.
- Verify: correct column count at 1550/1200/992/768/575 breakpoints.

### Phase 2 — Category
- Files: `Category.js`, `Cardloading.css` (`page="category"`)
- Add skeleton for heading icon + title, the Videos/Shorts menu, then `SkeletonGrid` in multi-column (category is now multi-column per recent work).
- Add missing `data` guard so loader shows before `data.videos` exists.

### Phase 3 — Trending
- Files: `Trendings.js`, `Cardloading.css`
- Skeleton mirrors trending layout: heading, menu tabs, then **single-column** rows that match the wide horizontal `trending-card` thumbnail (left thumb, right text lines).

### Phase 4 — Search
- Files: `Search.js`, `Cardloading.css`
- Skeleton for the channels section (row of pill cards) + the videos grid (multi-column `fluid`).
- Add loading state on the `data` fetch.

### Phase 5 — Subscriptions
- Files: `Subscription.js`, `Cardloading.css` (`page="subscription"`)
- Skeleton for heading, channel-strip pills, then multi-column `SkeletonGrid`.

### Phase 6 — Watch (player + related)
- Files: `Watch.js`, `Cardloading.css` (`page="watch"`)
- Skeleton for: video player area, title line, channel row (icon + subscribe + like/share buttons), then related-videos column.
- Gate on both `data` (video) and `relateddata`.

### Phase 7 — Channel
- Files: `Channel.js`, `Cardloading.css` (`page="channel"`)
- Upgrade existing: banner, round avatar, name/subs/desc lines, menu buttons, then card grid.
- Verify against the real `Channel` layout (tabs ).

### Phase 8 — Yourchannel
- Files: `Yourchannel.js`, `Cardloading.css` (`page="yourchannel"`)
- Upgrade existing channel-hero skeleton + Videos/Shorts grid skeletons.

### Phase 9 — You (`/me`)
- Files: `You.js`
- Replace `<p>loading...</p>` with a channel-hero skeleton (banner + avatar + name + buttons), reusing the channel variant.

### Phase 10 — History
- Files: `History.js`, `Cardloading.css`
- Skeleton: page title, then a stacked set of section skeletons (one per time group: heading + 3-column cards) since History renders multiple grids.

### Phase 11 — Liked videos
- Files: `Likedvideos.js`, `Cardloading.css`
- Skeleton: heading + multi-column `SkeletonGrid` (`likes` variant).

### Phase 12 — Watch later
- Files: `Watchlater.js`, `Cardloading.css`
- Skeleton: heading + multi-column `SkeletonGrid` (`watchlater` variant).

### Phase 13 — Shorts
- Files: `Shortbox.js`, `Shortplayer.js`, `Shorts.css`, `Cardloading.css`
- Align the existing short-player `loading` class with the shared shimmer; add a vertical full-screen skeleton for the short card (buttons + like/dislike column) so it has a shimmer like the rest.

## Verification per phase

For each page, after implementing:
1. Hard-refresh the route — the skeleton must show immediately and cover the full layout.
2. Confirm the skeleton uses the **same grid geometry** as the loaded content (no layout shift / jump).
3. Confirm **one** scrollbar (the custom one) — no double scrollbar while loading.
4. Confirm it works in light AND dark theme (uses `--alt-color` var).
5. Run `npm run build:client` (no top-level lint exists; CRA has no `lint` script).
6. Commit that page's change in isolation.

## Definition of done

- Every data-fetching page shows a shimmering skeleton matching its real layout.
- No page shows blank space, a text-only "loading...", or an empty grid while fetching.
- Shared `Cardloading` primitives are reused; no per-page loader duplication.
