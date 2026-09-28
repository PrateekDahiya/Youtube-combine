const { fetchVideoHistory } = require("../youtube");
const { createFeedAndGenerateSQL, extractFrequentWords, buildTastePrefilterQuery } = require("../utils");
const { checkFullTextAvailability, isFullTextAvailable } = require("../utils/fulltext");
const { httpError, runQuery, cachedFetch, flagVideos, fetchTasteCandidates } = require("./helpers");

async function personalizedFeed(params) {
    const user_chl_id = params.user_id;
    const page_no = params.page || 1;

    if (!user_chl_id) {
        throw httpError(400, "Missing user_id parameter");
    }

    const cacheKey = `personalized-feed:${user_chl_id}:${page_no}`;

    const feed = await cachedFetch(cacheKey, 180, async () => {
        await new Promise((resolve) => {
            checkFullTextAvailability(() => resolve());
        });

        const videoHistory = (await fetchVideoHistory(user_chl_id)).slice(0, 50);

        const excludedVideoIds = videoHistory.map((video) => video.video_id);

        const tags = videoHistory
            .map((video) => video.tags)
            .join(",")
            .split(",")
            .map((tag) => tag.trim());

        let candidateIds = null;
        if (isFullTextAvailable()) {
            const ftQuery = buildTastePrefilterQuery(extractFrequentWords(tags));
            if (ftQuery) {
                candidateIds = await fetchTasteCandidates(ftQuery);
            }
        }

        const sqlQuery = createFeedAndGenerateSQL(
            tags,
            excludedVideoIds,
            5,
            24,
            24 * (page_no - 1),
            candidateIds && candidateIds.length > 0 ? candidateIds : null
        );

        return runQuery(sqlQuery);
    });

    const videos = await flagVideos(feed, user_chl_id);
    return { page: "personalized_feed", videos };
}

module.exports = personalizedFeed;
