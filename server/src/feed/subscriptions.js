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
    const channel_id = params.channel_id || null;
    const cursor = decodeCursor(params.cursor);

    let query;
    let queryParams;

    const channelClause = channel_id ? ` and v.channel_id = ?` : "";
    const channelKey = channel_id || "all";

    if (cursor) {
        query = `select * from videos v inner join channels c on v.channel_id=v.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0${channelClause} and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [user_id, isShort];
        if (channel_id) queryParams.push(channel_id);
        queryParams.push(cursor.uploadTime, cursor.uploadTime, cursor.videoId);
    } else {
        const page_no = Number(params.page || 1);
        query = `select * from channels c join videos v on c.channel_id=v.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0${channelClause} order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [user_id, isShort];
        if (channel_id) queryParams.push(channel_id);
        queryParams.push(24 * (page_no - 1));
    }

    const cacheKey = `subscriptions:${user_id}:${isShort}:${channelKey}:${cursor || "page:" + (params.page || 1)}`;
    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, user_id);
    return {
        page: "subscription",
        videos,
        nextCursor: nextCursorFromVideos(videos),
    };
}

module.exports = subscriptionsFeed;
