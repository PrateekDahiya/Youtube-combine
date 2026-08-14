const { categoryMappingFeed, caticon } = require("../utils");
const {
    HOME_TTL,
    cachedQuery,
    flagVideos,
    nextCursorFromVideos,
    decodeCursor,
} = require("./helpers");

async function categoryFeed(params) {
    const category = params.category;
    const type = params.isShort;
    const cursor = decodeCursor(params.cursor);

    let query;
    let queryParams;
    let cacheKey;

    if (cursor) {
        query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [categoryMappingFeed[category], type, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        const page_no = Number(params.page || 1);
        query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [categoryMappingFeed[category], type, 24 * (page_no - 1)];
    }

    cacheKey = `category:${category}:${type}:${cursor || "page:" + (params.page || 1)}`;
    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return {
        page: "category",
        caticon: caticon[category],
        videos,
        category,
        nextCursor: nextCursorFromVideos(videos),
    };
}

module.exports = categoryFeed;
