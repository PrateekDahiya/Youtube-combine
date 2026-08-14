const {
    HOME_TTL,
    cachedQuery,
    flagVideos,
    nextCursorFromVideos,
    decodeCursor,
} = require("./helpers");

async function subscriptionsFeed(params) {
    const user_id = params.user_id;
    const isShort = params.isShort;
    const cursor = decodeCursor(params.cursor);

    let query;
    let queryParams;

    if (cursor) {
        query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [user_id, isShort, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        const page_no = Number(params.page || 1);
        query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [user_id, isShort, 24 * (page_no - 1)];
    }

    const cacheKey = `subscriptions:${user_id}:${isShort}:${cursor || "page:" + (params.page || 1)}`;
    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, user_id);
    return {
        page: "subscription",
        videos,
        nextCursor: nextCursorFromVideos(videos),
    };
}

module.exports = subscriptionsFeed;
