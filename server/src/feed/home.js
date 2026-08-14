const {
    HOME_TTL,
    cachedQuery,
    flagVideos,
    nextCursorFromVideos,
    decodeCursor,
} = require("./helpers");

async function homeFeed(params) {
    const cursor = decodeCursor(params.cursor);
    const page_no = Number(params.page || 1);
    const cacheKey = cursor ? `home:${cursor}` : `home:page:${page_no}`;
    let query;
    let queryParams;

    if (cursor) {
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [24 * (page_no - 1)];
    }

    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return { page: "home", videos, nextCursor: nextCursorFromVideos(videos) };
}

module.exports = homeFeed;
