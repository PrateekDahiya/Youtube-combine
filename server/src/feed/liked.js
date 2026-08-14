const { httpError, runQuery, flagVideos } = require("./helpers");

async function likedFeed(params) {
    const user_id = params.user_id;
    if (!user_id) {
        throw httpError(400, "Missing user_id parameter");
    }
    const query = `SELECT v.*, c.* FROM likedvideos lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by liked_time desc limit 100`;

    const feed = await runQuery(query, [user_id]);
    const videos = await flagVideos(feed, user_id);
    return { page: "likedvideos", videos };
}

module.exports = likedFeed;
