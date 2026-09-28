const { fetchVideoHistory } = require("../youtube");
const { sanitizeTag } = require("../utils");
const { httpError, runQuery, cachedFetch, flagVideos } = require("./helpers");

const DISCOVERY_CANDIDATE_LIMIT = 3000;

async function newForYouFeed(params) {
    const user_chl_id = params.user_id;
    const page_no = params.page || 1;

    if (!user_chl_id) {
        throw httpError(400, "Missing user_id parameter");
    }

    const cacheKey = `newforyou-feed:${user_chl_id}:${page_no}`;

    const feed = await cachedFetch(cacheKey, 180, async () => {
        const videoHistory = (await fetchVideoHistory(user_chl_id)).slice(0, 50);

        const excludedVideoIds = videoHistory.map((video) => video.video_id);

        const wordCount = {};
        videoHistory
            .map((video) => video.tags || "")
            .join(",")
            .split(",")
            .map((tag) => tag.trim())
            .forEach((tag) => {
                tag.split(/[\s,]+/).forEach((word) => {
                    const cleanedWord = word.toLowerCase().trim();
                    if (cleanedWord) {
                        wordCount[cleanedWord] = (wordCount[cleanedWord] || 0) + 1;
                    }
                });
            });

        const frequentWords = Object.entries(wordCount)
            .filter(([word, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40)
            .map(([word]) => word);

        // Phase 1: cheapest popular set via the views index — no scoring yet.
        const popularRows = await runQuery(
            `SELECT video_id FROM videos USE INDEX (idx_video_views)
             WHERE isShort = 0 AND upload_status = 0
             ORDER BY views DESC
             LIMIT ?`,
            [DISCOVERY_CANDIDATE_LIMIT]
        );
        const candidateIds = (popularRows || []).map((row) => row.video_id);
        if (candidateIds.length === 0) {
            return [];
        }

        const conditions = [
            "v.isShort = 0",
            "v.upload_status = 0",
            `v.video_id IN (${candidateIds
                .filter((id) => id && id !== "undefined")
                .map((id) => `'${sanitizeTag(id)}'`)
                .join(", ")})`,
        ];

        const filteredExcludedIds = excludedVideoIds
            .filter((id) => id && id !== "undefined")
            .map((id) => `'${sanitizeTag(id)}'`);
        if (filteredExcludedIds.length > 0) {
            conditions.push(`v.video_id NOT IN (${filteredExcludedIds.join(", ")})`);
        }

        if (frequentWords.length > 0) {
            const outsideTaste = frequentWords
                .map((word) => `LOCATE('${sanitizeTag(word)}', COALESCE(v.tags, '')) = 0`)
                .join(" AND ");
            conditions.push(`(${outsideTaste})`);
        }

        // Phase 2: exact outside-taste filter + per-channel cap on candidates only.
        const sqlQuery = `
            SELECT
                v.*, c.*
            FROM (
                SELECT v.*, ROW_NUMBER() OVER(PARTITION BY v.channel_id ORDER BY v.video_id) AS channel_row_number
                FROM videos v
                WHERE ${conditions.join(" AND ")}
            ) AS v
            JOIN channels c ON v.channel_id = c.channel_id
            WHERE v.channel_row_number <= 5
            ORDER BY v.views DESC, v.upload_time DESC, v.video_id
            LIMIT 24 OFFSET ${24 * (page_no - 1)}
        `;

        return runQuery(sqlQuery);
    });

    const videos = await flagVideos(feed, user_chl_id);
    return { page: "newforyou_feed", videos };
}

module.exports = newForYouFeed;
