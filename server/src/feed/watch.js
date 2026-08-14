const { httpError, runQuery } = require("./helpers");

async function watchFeed(params) {
    const videoId = params.video_id;
    if (!videoId) {
        throw httpError(400, "Missing video_id parameter");
    }
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;
    const results = await runQuery(query, [videoId]);
    return { page: "watch", data: results };
}

module.exports = watchFeed;
