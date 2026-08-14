const { httpError, runQuery, flagVideos } = require("./helpers");

async function historyFeed(params) {
    const user_id = params.user_id;
    if (!user_id) {
        throw httpError(400, "Missing user_id parameter");
    }
    const query = `SELECT v.*, c.*, h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;

    const feed = await runQuery(query, [user_id]);
    const videos = await flagVideos(feed, user_id);
    return { videos };
}

module.exports = historyFeed;
