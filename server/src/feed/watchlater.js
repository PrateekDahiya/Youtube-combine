const { httpError, runQuery } = require("./helpers");

async function watchlaterFeed(params) {
    const user_id = params.user_id;
    if (!user_id) {
        throw httpError(400, "Missing user_id parameter");
    }
    const query = `SELECT v.*, c.* FROM watchlater lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by added_time desc limit 100`;

    const feed = await runQuery(query, [user_id]);
    const videos = feed.map((video) => ({ ...video, is_watchlater: 1 }));
    return { page: "watchlater", videos };
}

module.exports = watchlaterFeed;
