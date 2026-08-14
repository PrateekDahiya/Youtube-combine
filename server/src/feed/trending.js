const { trendingCategoryMapping } = require("../utils");
const { runQuery, flagVideos } = require("./helpers");

async function trendingFeed(params) {
    const tab = params.tab;
    const page_no = Number(params.page || 1);

    let query = `SELECT *, ((LOG(v.views + 1) * 0.3) + (v.likes * 0.3) + ((1 / (DATEDIFF(NOW(), v.upload_time) + 1)) * 0.4)) AS trending_score
                 FROM videos v
                 JOIN channels c ON v.channel_id = c.channel_id
                 WHERE v.upload_time >= NOW() - INTERVAL 10 DAY AND isShort = 0 AND v.upload_status = 0`;

    let queryParams;
    if (tab != 0) {
        query += " AND v.category IN (?)";
        queryParams = [trendingCategoryMapping[tab], 24 * (page_no - 1)];
    } else {
        queryParams = [24 * (page_no - 1)];
    }

    query += " ORDER BY trending_score DESC LIMIT 24 OFFSET ?";

    const feed = await runQuery(query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return { page: "trendings", videos };
}

module.exports = trendingFeed;
