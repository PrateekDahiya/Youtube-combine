# Improvements Plan

This file tracks the requested UI and backend improvements. We will execute them one by one.

## 1. Fix related-videos SQL bug

Goal:
- Remove the duplicate `LIMIT` issue in `/api/related-videos`.

Plan:
1. Update `server/server.js` so `createFeedAndGenerateSQL()` owns the limit.
2. Stop appending `LIMIT 20` in `fetchRelatedVideos()`.
3. Verify `/api/personalized-feed` does not append invalid SQL after a `LIMIT` clause.
4. Confirm the endpoint returns related videos without SQL errors.

Files:
- `server/server.js`

## 2. Add home page tags above videos

Goal:
- Show clickable tags above the home feed, similar to YouTube.

Plan:
1. Build a tag strip at the top of `Home.js`.
2. Populate it with the top 5 keyword tags from the current feed or user history.
3. Add video-type tags such as `All`, `Music`, `Gaming`, `Shorts`, `Movies`, `Live`, or similar mapped types.
4. On click, reload the home feed using the selected tag filter.
5. Keep the selected tag visible as active.

Files:
- `client/src/Home.js`
- `client/src/Home.css`
- `server/server.js`

## 3. Make tag clicks return related videos

Goal:
- Clicking a tag should show videos related to that tag.

Plan:
1. Add a query parameter or route state for the selected tag.
2. Update the API so tag-based filtering can be requested directly.
3. Reuse the existing related-video scoring logic where possible.
4. Ensure the home feed and related feed use the same tag semantics.

Files:
- `client/src/Home.js`
- `client/src/Watch.js`
- `server/server.js`

## 4. Add top 5 keyword tags

Goal:
- Use the user's or channel's top 5 keywords as the main tag row.

Plan:
1. Define how keywords are derived: channel keywords, watched history tags, or current feed tags.
2. Normalize and count tags.
3. Pick the top 5 by frequency.
4. Display them before the general video grid.

Files:
- `server/server.js`
- `client/src/Home.js`

## 5. Add video type tags

Goal:
- Separate tags for video types like shorts, normal videos, and category-style filters.

Plan:
1. Map existing metadata to type tags.
2. Show type tags in the same row or a second row above the feed.
3. Make the type selection affect the API query.
4. Keep shorts and long-form results consistent with current page behavior.

Files:
- `client/src/Home.js`
- `client/src/Subscription.js`
- `server/server.js`

## 6. Add default avatar fallback

Goal:
- Show a default profile image when the user has no avatar.

Plan:
1. Add a shared fallback avatar source.
2. Use it anywhere `channel_icon` can be missing or null.
3. Apply it in the header, settings, channel pages, cards, shorts, and watch page as needed.
4. Keep the UI stable when the image URL fails.

Files:
- `client/src/Header.js`
- `client/src/Card.js`
- `client/src/Channel.js`
- `client/src/You.js`
- `client/src/Yourchannel.js`
- `client/src/Settings.js`
- `client/src/Watch.js`
- `client/src/Shortbox.js`

## 7. Add subscription channel slider

Goal:
- Put subscribed channels in a horizontal slider at the top of the subscriptions page.

Plan:
1. Fetch subscribed channels and render them as a horizontal carousel/scroll row.
2. Show channel icon and channel name.
3. Clicking a channel should filter the page to that channel's videos and shorts.
4. Keep an `All` option to clear the filter.

Files:
- `client/src/Subscription.js`
- `client/src/Subscription.css`
- `server/server.js`

## 8. Include channels in search results

Goal:
- Search should return both videos and channels.

Plan:
1. Expand `/api/search` to query channels alongside videos.
2. Return a structured response that separates video and channel hits, or a unified result type.
3. Update `Search.js` to render channel cards or a channel section.
4. Keep the existing video results intact.

Files:
- `server/server.js`
- `client/src/Search.js`
- `client/src/Search.css`

## 9. Fetch 100 videos per channel for feedback

Goal:
- When feedback provides a `channelId`, ingest 100 videos for that channel.

Plan:
1. Update the feedback route to call the ingestion helper with a 100-video target.
2. Confirm the helper can handle the larger fetch size without breaking existing behavior.
3. Keep feedback email delivery unchanged.
4. Verify channel ingestion still completes on Render.

Files:
- `server/server.js`

## Suggested execution order

1. Fix the related-videos SQL bug.
2. Add the default avatar fallback.
3. Add search channels.
4. Add subscription channel slider.
5. Increase feedback channel ingestion to 100 videos.
6. Add home tags and tag-click filtering.
7. Add top 5 keyword tags.
8. Add video type tags.
