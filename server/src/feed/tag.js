const { categoryMap } = require("../utils");
const {
    HOME_TTL,
    cachedQuery,
    flagVideos,
    nextCursorFromVideos,
    decodeCursor,
} = require("./helpers");

async function tagFeed(params) {
    const tag = params.tag || "";
    const category = params.category || "";
    const cursor = decodeCursor(params.cursor);
    const searchQuery = `%${tag}%`;

    const keysetClause =
        "and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?))";
    const orderClause = "order by v.upload_time desc, v.video_id desc limit 24";

    let query;
    let queryParams;
    let cacheKey;

    if (category) {
        cacheKey = `feed-by-tag:${category}:${cursor || "page:" + (params.page || 1)}`;
        if (cursor) {
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) ${keysetClause} ${orderClause}`;
            queryParams = [categoryMap[category] || [category], cursor.uploadTime, cursor.uploadTime, cursor.videoId];
        } else {
            const page_no = Number(params.page || 1);
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) ${orderClause} offset ?`;
            queryParams = [categoryMap[category] || [category], 24 * (page_no - 1)];
        }
    } else {
        cacheKey = `feed-by-tag:${tag}:${cursor || "page:" + (params.page || 1)}`;
        if (cursor) {
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) ${keysetClause} ${orderClause}`;
            queryParams = [searchQuery, searchQuery, searchQuery, searchQuery, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
        } else {
            const page_no = Number(params.page || 1);
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) ${orderClause} offset ?`;
            queryParams = [searchQuery, searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];
        }
    }

    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return {
        page: "home_tag",
        videos,
        tag,
        category,
        nextCursor: nextCursorFromVideos(videos),
    };
}

module.exports = tagFeed;
