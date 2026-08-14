const { fetchVideoHistory } = require("../youtube");
const { createFeedAndGenerateSQL } = require("../utils");
const { httpError, runQuery, cachedFetch, flagVideos } = require("./helpers");

async function personalizedFeed(params) {
    const user_chl_id = params.user_id;
    const page_no = params.page || 1;

    if (!user_chl_id) {
        throw httpError(400, "Missing user_id parameter");
    }

    const cacheKey = `personalized-feed:${user_chl_id}:${page_no}`;

    const feed = await cachedFetch(cacheKey, 60, async () => {
        const videoHistory = await fetchVideoHistory(user_chl_id);

        const excludedVideoIds = videoHistory.map((video) => video.video_id);

        const tags = videoHistory
            .map((video) => video.tags)
            .join(",")
            .split(",")
            .map((tag) => tag.trim());

        const sqlQuery = createFeedAndGenerateSQL(
            tags,
            excludedVideoIds,
            5,
            24,
            24 * (page_no - 1)
        );

        return runQuery(sqlQuery);
    });

    const videos = await flagVideos(feed, user_chl_id);
    return { page: "personalized_feed", videos };
}

module.exports = personalizedFeed;
